import * as THREE from 'three';
import { WeatherSystem } from './WeatherSystem';
import { WindSystem } from './WindSystem';

export type WorldSurfaceType = 'ASPHALT' | 'SIDEWALK' | 'PARK_GRASS';

export interface SurfaceProperties {
  type: WorldSurfaceType;
  label: string;
  /** Static/kinetic grip coefficient mu (scaled dynamically by rain/snow) */
  frictionMu: number;
  /** Rolling resistance coefficient C_rr for wheeled vehicles */
  rollingResistance: number;
  /** Effective lateral cornering traction multiplier */
  lateralGrip: number;
}

export interface PhysicsBodyProfile {
  /** Mass in kilograms */
  massKg: number;
  /** Aerodynamic drag coefficient (Cd) */
  dragCoefficient: number;
  /** Frontal cross-sectional area in m^2 */
  frontalAreaM2: number;
  /** Extra linear ground damping multiplier (1.0 = standard) */
  surfaceFrictionScale?: number;
}

export interface WorldPhysicsStepResult {
  dragForceN: number;
  frictionForceN: number;
  airDensityKgM3: number;
  surface: SurfaceProperties;
}

const GRAVITY_MS2 = 9.81;

/**
 * Unified World Physics Engine providing physically grounded:
 * 1. Quadratic aerodynamic air resistance coupled to live WindSystem & WeatherSystem air density
 * 2. Surface-aware static/kinetic friction & rolling resistance (asphalt, granite sidewalk, park grass)
 * 3. Weather-coupled traction degradation (rain wetness & snow/blizzard slickness)
 *
 * Applied across the Experimental Car, Hover Vehicles, Player Controller, Falling Leaves, and City Traffic.
 */
export class WorldPhysicsEngine {
  private static instance: WorldPhysicsEngine;
  private readonly _relVel = new THREE.Vector3();

  private constructor() {}

  public static getInstance(): WorldPhysicsEngine {
    if (!WorldPhysicsEngine.instance) {
      WorldPhysicsEngine.instance = new WorldPhysicsEngine();
    }
    return WorldPhysicsEngine.instance;
  }

  /**
   * Computes local atmospheric air density (kg/m^3) from ambient temperature and humidity/precipitation.
   * Cold blizzard air is denser (~1.29 kg/m^3); warm humid clear air is lighter (~1.19 kg/m^3).
   */
  public getAirDensity(temperatureC?: number, wetnessFactor?: number): number {
    const weather = WeatherSystem.getInstance().getState();
    const tempC = temperatureC ?? weather.temperatureC;
    const wet = wetnessFactor ?? weather.wetnessFactor;
    const tempK = Math.max(230, tempC + 273.15);
    // Ideal gas approximation normalized to 1.225 kg/m^3 at 15°C (288.15K)
    const dryRho = 1.225 * (288.15 / tempK);
    return Math.max(1.05, Math.min(1.42, dryRho * (1 - wet * 0.025)));
  }

  /**
   * Determines world surface material at (x, z) and adjusts grip for current rain wetness and snow accumulation.
   */
  public getSurfaceAt(
    x: number,
    z: number,
    wetnessOverride?: number,
    snowOverride?: number
  ): SurfaceProperties {
    const weather = WeatherSystem.getInstance().getState();
    const wetness = Math.max(0, Math.min(1, wetnessOverride ?? weather.wetnessFactor));
    const snow = Math.max(0, Math.min(1, snowOverride ?? weather.snowIntensity));

    // Car-free Park Sanctuaries at (75, 75) and (0, 240)
    const inEastPark = x >= 39 && x <= 111 && z >= 39 && z <= 111;
    const inNorthPark = x >= -36 && x <= 36 && z >= 204 && z <= 276;

    let type: WorldSurfaceType = 'SIDEWALK';
    let baseMu = 0.86;
    let baseCrr = 0.024;
    let baseLat = 0.9;

    if (inEastPark || inNorthPark) {
      type = 'PARK_GRASS';
      baseMu = 0.68;
      baseCrr = 0.058;
      baseLat = 0.72;
    } else {
      // Check widened roadway corridors: 22m Grand Boulevards (±11m), 18m central avenues (±75, ±165), streamed chunk avenues
      const onGrandNS = Math.abs(x) <= 11.2;
      const onGrandEW = Math.abs(z) <= 11.2;
      const inCentralCore = Math.abs(x) <= 174 && Math.abs(z) <= 174;
      const onCentralSecondary =
        inCentralCore &&
        (Math.abs(Math.abs(x) - 75) <= 9.2 ||
          Math.abs(Math.abs(z) - 75) <= 9.2 ||
          Math.abs(Math.abs(x) - 165) <= 9.2 ||
          Math.abs(Math.abs(z) - 165) <= 9.2);

      const modX = Math.abs((((x % 120) + 120) % 120) - 60);
      const modZ = Math.abs((((z % 120) + 120) % 120) - 60);
      const onStreamedRoad = !inCentralCore && (modX <= 10.2 || modZ <= 9.2);

      if (onGrandNS || onGrandEW || onCentralSecondary || onStreamedRoad) {
        type = 'ASPHALT';
        baseMu = 0.94;
        baseCrr = 0.015;
        baseLat = 1.0;
      }
    }

    // Rain reduces surface grip up to 30%; snow/blizzard reduces grip up to 54% and increases rolling drag
    const gripScale = Math.max(0.38, 1 - wetness * 0.3 - snow * 0.48);
    const frictionMu = Number((baseMu * gripScale).toFixed(3));
    const rollingResistance = Number((baseCrr + wetness * 0.008 + snow * 0.032).toFixed(4));
    const lateralGrip = Number((baseLat * gripScale).toFixed(3));

    const conditionPrefix = snow > 0.25 ? 'SNOWY ' : wetness > 0.25 ? 'WET ' : 'DRY ';
    const surfaceName = type === 'ASPHALT' ? 'ASPHALT' : type === 'PARK_GRASS' ? 'TURF' : 'GRANITE';

    return {
      type,
      label: `${conditionPrefix}${surfaceName}`,
      frictionMu,
      rollingResistance,
      lateralGrip,
    };
  }

  /**
   * Computes scalar quadratic aerodynamic drag force magnitude:
   * F_drag = 0.5 * rho * Cd * A * v^2
   */
  public computeAeroDragMagnitude(
    relativeSpeedMs: number,
    profile: PhysicsBodyProfile,
    airDensity?: number
  ): number {
    const rho = airDensity ?? this.getAirDensity();
    const v = Math.abs(relativeSpeedMs);
    return 0.5 * rho * profile.dragCoefficient * profile.frontalAreaM2 * v * v;
  }

  /**
   * Computes rolling/surface friction deceleration magnitude (m/s^2) on horizontal ground.
   */
  public computeRollingDecel(
    surface: SurfaceProperties,
    frictionScale: number = 1.0
  ): number {
    return surface.rollingResistance * GRAVITY_MS2 * Math.max(0.1, frictionScale);
  }

  /**
   * Applies quadratic air resistance (with live WindSystem coupling) and surface friction
   * directly to any 3D velocity vector in-place (zero allocations).
   */
  public applyWorldForcesToVelocity(
    velocity: THREE.Vector3,
    positionX: number,
    positionZ: number,
    profile: PhysicsBodyProfile,
    dt: number,
    isGrounded: boolean,
    windCoupling: number = 0.35,
    applySurfaceFriction: boolean = true
  ): WorldPhysicsStepResult {
    const safeDt = Math.min(Math.max(dt, 0), 0.05);
    const rho = this.getAirDensity();
    const surface = this.getSurfaceAt(positionX, positionZ);
    const wind = WindSystem.getInstance().getVector();
    const mass = Math.max(0.01, profile.massKg);

    // 1. Quadratic aerodynamic drag relative to moving air mass: F = -0.5 * rho * Cd * A * |v_rel| * v_rel
    this._relVel.set(
      velocity.x - wind.x * windCoupling,
      velocity.y - wind.y * windCoupling,
      velocity.z - wind.z * windCoupling
    );
    const relSpeed = this._relVel.length();
    let dragForceN = 0;

    if (relSpeed > 1e-4 && safeDt > 0) {
      dragForceN = 0.5 * rho * profile.dragCoefficient * profile.frontalAreaM2 * relSpeed * relSpeed;
      const dragAccel = dragForceN / mass;
      // Exponentially stable clamp so light objects (e.g., leaves) never invert velocity on large dt
      const maxDelta = relSpeed * 0.85;
      const dv = Math.min(maxDelta, dragAccel * safeDt);
      const scale = dv / relSpeed;
      velocity.x -= this._relVel.x * scale;
      velocity.y -= this._relVel.y * scale;
      velocity.z -= this._relVel.z * scale;
    }

    // 2. Ground surface / rolling friction on horizontal plane
    let frictionForceN = 0;
    if (isGrounded && applySurfaceFriction && safeDt > 0) {
      const horizSpeed = Math.hypot(velocity.x, velocity.z);
      if (horizSpeed > 1e-4) {
        const frictionScale = profile.surfaceFrictionScale ?? 1.0;
        const decel = surface.rollingResistance * GRAVITY_MS2 * frictionScale;
        frictionForceN = decel * mass;
        const dv = Math.min(horizSpeed, decel * safeDt);
        const keep = (horizSpeed - dv) / horizSpeed;
        velocity.x *= keep;
        velocity.z *= keep;
      } else {
        velocity.x = 0;
        velocity.z = 0;
      }
    }

    return {
      dragForceN,
      frictionForceN,
      airDensityKgM3: rho,
      surface,
    };
  }
}
