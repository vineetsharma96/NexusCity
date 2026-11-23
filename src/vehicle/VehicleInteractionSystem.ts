import * as THREE from 'three';
import { AudioManager } from '../audio/AudioManager';
import { SaveSystem, VehicleUpgradeState } from '../core/SaveSystem';
import { InteractionSystem } from '../interaction/InteractionSystem';
import { InputManager } from '../player/InputManager';
import { KinematicCollisionSolver } from '../player/KinematicCollision';
import { PhysicsBodyProfile, WorldPhysicsEngine } from '../world/WorldPhysicsEngine';

export type VehicleMode = 'ON_FOOT' | 'RIDING' | 'TRANSIT_LINKED';
export type VehicleVariant = 'hover' | 'car';
export type CarGear = 'P' | 'N' | 'D' | 'R';

export interface VehicleTelemetry {
  /** Signed forward speed along vehicle heading (+ forward, - reverse) in m/s */
  forwardSpeedMs: number;
  /** Unsigned total horizontal speed in m/s */
  speedMs: number;
  /** Unsigned speed in km/h */
  speedKmh: number;
  /** Smoothed longitudinal acceleration in Gs (+ accel, - braking/decel) for screen & suspension effects */
  longitudinalAccelG: number;
  /** Lateral cornering G-force for body roll */
  lateralAccelG: number;
  /** Front wheel steering angle in radians */
  steeringAngle: number;
  /** Accumulated wheel rotation angle in radians (rotates backward in reverse) */
  wheelSpinRad: number;
  /** Current transmission gear */
  gear: CarGear;
  isBraking: boolean;
  isReversing: boolean;
  isBoosting: boolean;
  /** Live aerodynamic drag force in Newtons from WorldPhysicsEngine */
  dragForceN: number;
  /** Live surface/rolling friction force in Newtons from WorldPhysicsEngine */
  frictionForceN: number;
  surfaceLabel: string;
  surfaceGrip: number;
}

export interface CarPerformanceSpec {
  codeName: string;
  accentColor: string;
  physicsProfile: PhysicsBodyProfile;
  wheelRadiusM: number;
  wheelbaseM: number;
  maxSteerRad: number;
  steerResponse: number;
  maxForwardSpeedMs: number;
  maxBoostSpeedMs: number;
  maxReverseSpeedMs: number;
  engineAccel: number;
  boostAccel: number;
  reverseAccel: number;
  brakeDecel: number;
  handbrakeDecel: number;
  tractionMultiplier: number;
  lateralGripScale: number;
  /** Speed-proportional Venturi aero downforce grip gain */
  aeroDownforceCoeff: number;
  collisionRadius: number;
}

export interface VehicleState {
  mode: VehicleMode;
  activeId: string | null;
  variant: VehicleVariant;
  label: string;
  carCodeName: string;
  carAccentColor: string;
  speedMultiplier: number;
  vehiclePosition: [number, number, number];
  vehicleRotationY: number;
  upgrades: VehicleUpgradeState;
  telemetry: VehicleTelemetry;
}

type VehicleListener = (state: VehicleState) => void;

export const DEFAULT_CAR_PERFORMANCE_SPEC: CarPerformanceSpec = {
  codeName: 'VX-01',
  accentColor: '#38bdf8',
  physicsProfile: {
    massKg: 1460,
    dragCoefficient: 0.27,
    frontalAreaM2: 2.18,
    surfaceFrictionScale: 1.0,
  },
  wheelRadiusM: 0.37,
  wheelbaseM: 2.86,
  maxSteerRad: 0.54,
  steerResponse: 11.5,
  maxForwardSpeedMs: 35,
  maxBoostSpeedMs: 48,
  maxReverseSpeedMs: 14.5,
  engineAccel: 17.5,
  boostAccel: 26.5,
  reverseAccel: 13.5,
  brakeDecel: 30.0,
  handbrakeDecel: 34.0,
  tractionMultiplier: 2.25,
  lateralGripScale: 9.8,
  aeroDownforceCoeff: 0,
  collisionRadius: 1.12,
};

/**
 * Distinct ultra-low-drag, high-velocity ground-effect performance profile for AX-09 Solaris Prototype:
 * Lighter carbon tub (1240 kg), ultra-slippery long-tail aero (Cd 0.19), explosive launch & overboost
 * (23.8 / 35.5 m/s^2), 44 m/s (158 km/h) cruise / 62 m/s (223 km/h) boost top speed, 18.5 m/s reverse,
 * carbon-ceramic + active airbrake deceleration, and speed-scaling Venturi downforce grip.
 */
export const SOLARIS_CAR_PERFORMANCE_SPEC: CarPerformanceSpec = {
  codeName: 'AX-09',
  accentColor: '#f59e0b',
  physicsProfile: {
    massKg: 1240,
    dragCoefficient: 0.19,
    frontalAreaM2: 1.92,
    surfaceFrictionScale: 0.92,
  },
  wheelRadiusM: 0.39,
  wheelbaseM: 3.04,
  maxSteerRad: 0.48,
  steerResponse: 14.2,
  maxForwardSpeedMs: 44,
  maxBoostSpeedMs: 62,
  maxReverseSpeedMs: 18.5,
  engineAccel: 23.8,
  boostAccel: 35.5,
  reverseAccel: 17.2,
  brakeDecel: 37.0,
  handbrakeDecel: 41.0,
  tractionMultiplier: 2.65,
  lateralGripScale: 11.6,
  aeroDownforceCoeff: 0.015,
  collisionRadius: 1.16,
};

const HOVER_COUPE_PROFILE: PhysicsBodyProfile = {
  massKg: 980,
  dragCoefficient: 0.31,
  frontalAreaM2: 1.95,
  surfaceFrictionScale: 2.4,
};

function createIdleTelemetry(): VehicleTelemetry {
  return {
    forwardSpeedMs: 0,
    speedMs: 0,
    speedKmh: 0,
    longitudinalAccelG: 0,
    lateralAccelG: 0,
    steeringAngle: 0,
    wheelSpinRad: 0,
    gear: 'P',
    isBraking: false,
    isReversing: false,
    isBoosting: false,
    dragForceN: 0,
    frictionForceN: 0,
    surfaceLabel: 'DRY ASPHALT',
    surfaceGrip: 0.94,
  };
}

export class VehicleInteractionSystem {
  private static instance: VehicleInteractionSystem;
  private readonly save = SaveSystem.getInstance();
  private listeners = new Set<VehicleListener>();
  private state: VehicleState;
  private vehiclePosition = new THREE.Vector3(4.5, 0.45, 10);
  private transitPosition = new THREE.Vector3(-7, 0.62, 10);

  // Live continuous vehicle physics state (zero allocations inside update loop)
  private vehicleVelocity = new THREE.Vector3(0, 0, 0);
  private steeringAngle = 0;
  private wheelSpinRad = 0;
  private prevForwardSpeed = 0;
  private smoothedLongG = 0;
  private smoothedLatG = 0;
  private manualReverseLatch = false;
  private lastTelemetryNotify = 0;

  private readonly _heading = new THREE.Vector3();
  private readonly _right = new THREE.Vector3();
  private readonly _targetPos = new THREE.Vector3();
  private readonly _resolvedPos = new THREE.Vector3();
  private readonly _moveDir = new THREE.Vector3();
  private readonly _camForward = new THREE.Vector3();
  private readonly _camRight = new THREE.Vector3();

  private rideables = new Map<
    string,
    {
      id: string;
      label: string;
      kind: 'vehicle' | 'transit';
      variant: VehicleVariant;
      position: THREE.Vector3;
      rotationY: number;
      carSpec: CarPerformanceSpec;
    }
  >();

  private constructor() {
    const upgrades = this.save.getData().vehicleUpgrades;
    this.state = {
      mode: 'ON_FOOT',
      activeId: null,
      variant: 'hover',
      label: 'On Foot',
      carCodeName: DEFAULT_CAR_PERFORMANCE_SPEC.codeName,
      carAccentColor: DEFAULT_CAR_PERFORMANCE_SPEC.accentColor,
      speedMultiplier: 1,
      vehiclePosition: [4.5, 0.45, 10],
      vehicleRotationY: 0,
      upgrades,
      telemetry: createIdleTelemetry(),
    };
  }

  public static getInstance(): VehicleInteractionSystem {
    if (!VehicleInteractionSystem.instance) {
      VehicleInteractionSystem.instance = new VehicleInteractionSystem();
    }
    return VehicleInteractionSystem.instance;
  }

  public getState(): VehicleState {
    return this.state;
  }

  public getTelemetry(): VehicleTelemetry {
    return this.state.telemetry;
  }

  public getVehiclePosition(): THREE.Vector3 {
    return this.vehiclePosition.clone();
  }

  public getRideablePosition(id: string): THREE.Vector3 {
    if (this.state.mode === 'RIDING' && this.state.activeId === id) {
      return this.vehiclePosition.clone();
    }
    return this.rideables.get(id)?.position.clone() ?? this.vehiclePosition.clone();
  }

  public getRideableRotationY(id: string): number {
    if (this.state.mode === 'RIDING' && this.state.activeId === id) {
      return this.state.vehicleRotationY;
    }
    return this.rideables.get(id)?.rotationY ?? 0;
  }

  public getMountedPosition(): THREE.Vector3 {
    return this.state.mode === 'TRANSIT_LINKED' ? this.transitPosition.clone() : this.vehiclePosition.clone();
  }

  public getDismountPosition(): THREE.Vector3 {
    const origin = this.getMountedPosition();
    const sideDist = this.state.variant === 'car' ? 2.25 : 1.9;
    const offset = new THREE.Vector3(sideDist, 0, 0).applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      this.state.vehicleRotationY
    );
    return KinematicCollisionSolver.findSafePosition(
      new THREE.Vector3(origin.x + offset.x, 0, origin.z + offset.z),
      0.45,
      1.8
    );
  }

  public subscribe(listener: VehicleListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  public registerRideable(
    id: string,
    label: string,
    position: THREE.Vector3,
    kind: 'vehicle' | 'transit',
    rotationY: number = 0,
    variant: VehicleVariant = 'hover',
    carSpec?: Partial<CarPerformanceSpec>
  ): void {
    const stored = position.clone();
    const existing = this.rideables.get(id);
    const vehicleCount = Array.from(this.rideables.values()).filter((r) => r.kind === 'vehicle').length;
    const resolvedCarSpec: CarPerformanceSpec = carSpec
      ? {
          ...DEFAULT_CAR_PERFORMANCE_SPEC,
          ...carSpec,
          physicsProfile: {
            ...DEFAULT_CAR_PERFORMANCE_SPEC.physicsProfile,
            ...(carSpec.physicsProfile ?? {}),
          },
        }
      : DEFAULT_CAR_PERFORMANCE_SPEC;
    this.rideables.set(id, {
      id,
      label,
      kind,
      variant,
      position: existing && this.state.activeId === id ? existing.position : stored,
      rotationY: existing ? existing.rotationY : rotationY,
      carSpec: resolvedCarSpec,
    });
    if (
      kind === 'vehicle' &&
      this.state.mode !== 'RIDING' &&
      (vehicleCount === 0 || id === 'nexus-hover-01' || id === 'hover')
    ) {
      this.vehiclePosition.copy(stored);
      this.state = { ...this.state, vehiclePosition: [stored.x, stored.y, stored.z] };
    }
    this.refreshInteraction(id);
  }

  public unregisterRideable(id: string): void {
    this.rideables.delete(id);
    InteractionSystem.getInstance().unregister(`rideable_${id}`);
  }

  public syncRideablePosition(id: string, position: THREE.Vector3): void {
    const entry = this.rideables.get(id);
    if (!entry) return;
    entry.position.copy(position);
    this.refreshInteraction(id);
  }

  public toggleReverseGear(): void {
    if (this.state.mode !== 'RIDING' || this.state.variant !== 'car') return;
    if (this.state.telemetry.forwardSpeedMs > 2.5) return;
    this.manualReverseLatch = !this.manualReverseLatch;
    this.state.telemetry.gear = this.manualReverseLatch ? 'R' : 'D';
    this.state.telemetry.isReversing = this.manualReverseLatch;
    AudioManager.getInstance().playUI('toggle');
    this.emit();
  }

  private refreshInteraction(id: string): void {
    const entry = this.rideables.get(id);
    if (!entry) return;
    const isActive = this.state.activeId === id && this.state.mode !== 'ON_FOOT';
    const actionText = isActive
      ? entry.kind === 'vehicle'
        ? entry.variant === 'car'
          ? 'EXIT EXPERIMENTAL CAR'
          : 'EXIT HOVER VEHICLE'
        : 'RELEASE TRANSIT LINK'
      : entry.kind === 'vehicle'
      ? entry.variant === 'car'
        ? `DRIVE ${entry.label.toUpperCase()}`
        : `BOARD ${entry.label.toUpperCase()}`
      : `LINK ${entry.label.toUpperCase()}`;

    InteractionSystem.getInstance().register({
      id: `rideable_${id}`,
      name: entry.label,
      actionText,
      position: entry.position,
      radius: isActive ? 5.2 : entry.variant === 'car' ? 4.4 : 3.8,
      onInteract: () => this.toggleMount(entry.id, entry.label, entry.kind),
    });
  }

  public toggleMount(id: string, label: string, kind: 'vehicle' | 'transit'): void {
    if (this.state.activeId === id && this.state.mode !== 'ON_FOOT') {
      this.dismount();
      return;
    }

    const entry = this.rideables.get(id);
    const variant: VehicleVariant = entry?.variant ?? 'hover';
    if (kind === 'vehicle' && entry) {
      this.vehiclePosition.copy(entry.position);
      this.state.vehicleRotationY = entry.rotationY;
    }

    this.vehicleVelocity.set(0, 0, 0);
    this.steeringAngle = 0;
    this.prevForwardSpeed = 0;
    this.smoothedLongG = 0;
    this.smoothedLatG = 0;
    this.manualReverseLatch = false;

    const upgrades = this.save.getData().vehicleUpgrades;
    const speedMultiplier = kind === 'vehicle' ? 1.55 + upgrades.speed * 0.18 : 1.35;
    const surface = WorldPhysicsEngine.getInstance().getSurfaceAt(this.vehiclePosition.x, this.vehiclePosition.z);
    const telemetry: VehicleTelemetry = {
      ...createIdleTelemetry(),
      gear: variant === 'car' ? 'N' : 'D',
      surfaceLabel: surface.label,
      surfaceGrip: surface.frictionMu,
    };

    const spec = entry?.carSpec ?? DEFAULT_CAR_PERFORMANCE_SPEC;

    this.state = {
      mode: kind === 'vehicle' ? 'RIDING' : 'TRANSIT_LINKED',
      activeId: id,
      variant,
      label,
      carCodeName: spec.codeName,
      carAccentColor: spec.accentColor,
      speedMultiplier,
      vehiclePosition: [this.vehiclePosition.x, this.vehiclePosition.y, this.vehiclePosition.z],
      vehicleRotationY: this.state.vehicleRotationY,
      upgrades,
      telemetry,
    };

    const activePos = kind === 'vehicle' ? this.vehiclePosition : this.transitPosition;
    this.syncRideablePosition(id, activePos);
    this.save.recordHistory(
      `vehicle_${id}`,
      variant === 'car' ? `EXPERIMENTAL DRIVE // ${label.toUpperCase()}` : `TRANSIT ENGAGED // ${label.toUpperCase()}`,
      variant === 'car'
        ? `4-wheel drive, reverse gear, aerodynamic drag & surface traction online.`
        : `Speed profile x${speedMultiplier.toFixed(2)} online.`
    );
    AudioManager.getInstance().playUI('open');
    this.emit();
  }

  public dismount(): void {
    if (this.state.mode === 'ON_FOOT') return;
    const prevId = this.state.activeId;
    if (prevId && this.state.mode === 'RIDING') {
      const entry = this.rideables.get(prevId);
      if (entry) {
        entry.position.copy(this.vehiclePosition);
        entry.rotationY = this.state.vehicleRotationY;
      }
    }
    this.vehicleVelocity.set(0, 0, 0);
    this.steeringAngle = 0;
    this.prevForwardSpeed = 0;
    this.smoothedLongG = 0;
    this.smoothedLatG = 0;
    this.manualReverseLatch = false;

    this.state = {
      ...this.state,
      mode: 'ON_FOOT',
      activeId: null,
      variant: 'hover',
      label: 'On Foot',
      speedMultiplier: 1,
      vehiclePosition: [this.vehiclePosition.x, this.vehiclePosition.y, this.vehiclePosition.z],
      telemetry: createIdleTelemetry(),
    };
    if (prevId) {
      this.syncRideablePosition(prevId, this.rideables.get(prevId)?.position ?? this.vehiclePosition);
    }
    AudioManager.getInstance().playUI('close');
    this.emit();
  }

  /**
   * Steps vehicle motion for either the Experimental 4-Wheel Car (Ackermann steering,
   * spinning wheels, reverse gear, handbrake, boost, air drag, tire friction)
   * or Hover-Coupes (camera-relative thrust with WorldPhysicsEngine drag & damping).
   */
  public updateMounted(delta: number, cameraYaw: number): THREE.Vector3 {
    if (this.state.mode !== 'RIDING') return this.vehiclePosition;
    const dt = Math.min(Math.max(delta, 0), 0.05);
    if (dt <= 0) return this.vehiclePosition;

    const input = InputManager.getState();

    if (this.state.variant === 'car') {
      return this.updateExperimentalCar(dt, input);
    }
    return this.updateHoverVehicle(dt, cameraYaw, input);
  }

  private updateExperimentalCar(
    dt: number,
    input: ReturnType<typeof InputManager.getState>
  ): THREE.Vector3 {
    const physics = WorldPhysicsEngine.getInstance();
    const activeEntry = this.state.activeId ? this.rideables.get(this.state.activeId) : undefined;
    const spec = activeEntry?.carSpec ?? DEFAULT_CAR_PERFORMANCE_SPEC;
    const surface = physics.getSurfaceAt(this.vehiclePosition.x, this.vehiclePosition.z);
    const speedUpgrade = 1 + this.state.upgrades.speed * 0.1;
    const handlingUpgrade = 1 + this.state.upgrades.handling * 0.08;

    const throttleInput = Math.max(0, input.moveZ); // W / Up / Touch Joystick Up
    const brakeReverseInput = Math.max(0, -input.moveZ); // S / Down / Touch Joystick Down
    const steerInput = -input.moveX; // A (+left yaw) / D (-right yaw)
    const handbrake = input.jump; // Space = handbrake
    const boost = input.sprint && throttleInput > 0.1;

    // Heading & lateral basis vectors (+Z is local vehicle nose forward)
    const rotY = this.state.vehicleRotationY;
    this._heading.set(Math.sin(rotY), 0, Math.cos(rotY));
    this._right.set(Math.cos(rotY), 0, -Math.sin(rotY));

    let forwardSpeed = this.vehicleVelocity.dot(this._heading);
    let lateralSpeed = this.vehicleVelocity.dot(this._right);

    // Steering wheel response (speed-sensitive clamp so high-speed driving feels planted)
    const speedSteerScale = 1 / (1 + Math.abs(forwardSpeed) * 0.032);
    const targetSteer = steerInput * spec.maxSteerRad * speedSteerScale;
    this.steeringAngle = THREE.MathUtils.lerp(
      this.steeringAngle,
      targetSteer,
      1 - Math.exp(-spec.steerResponse * handlingUpgrade * dt)
    );

    // Determine Drive / Reverse / Braking state cleanly
    let isBraking = false;
    let isReversing = false;
    let gear: CarGear = 'N';

    const maxForwardSpeed = (boost ? spec.maxBoostSpeedMs : spec.maxForwardSpeedMs) * speedUpgrade;
    const maxReverseSpeed = spec.maxReverseSpeedMs * speedUpgrade;
    const aeroDownforceBonus = 1 + Math.abs(forwardSpeed) * spec.aeroDownforceCoeff;
    const tractionAccelLimit =
      surface.frictionMu * 9.81 * spec.tractionMultiplier * aeroDownforceBonus * handlingUpgrade;

    // Throttle & Brake / Reverse longitudinal force
    let longitudinalAccel = 0;

    if (throttleInput > 0.02) {
      if (this.manualReverseLatch && forwardSpeed <= 0.6) {
        // Explicit Reverse gear latch: W accelerates in reverse when user toggled Reverse button
        isReversing = true;
        gear = 'R';
        const revRatio = Math.max(0, 1 - Math.abs(forwardSpeed) / maxReverseSpeed);
        longitudinalAccel = -throttleInput * Math.min(tractionAccelLimit, spec.reverseAccel * (0.45 + 0.55 * revRatio));
      } else if (forwardSpeed < -0.6) {
        // Pressing forward while rolling backward applies brakes first
        isBraking = true;
        gear = 'R';
        longitudinalAccel = Math.min(tractionAccelLimit * 1.2, spec.brakeDecel * 0.87) * throttleInput;
      } else {
        this.manualReverseLatch = false;
        gear = 'D';
        const engineBase = boost ? spec.boostAccel : spec.engineAccel;
        const speedRatio = Math.max(0, 1 - Math.max(0, forwardSpeed) / maxForwardSpeed);
        const engineAccel = engineBase * speedUpgrade * (0.32 + 0.68 * speedRatio);
        longitudinalAccel = throttleInput * Math.min(tractionAccelLimit, engineAccel);
      }
    } else if (brakeReverseInput > 0.02) {
      if (forwardSpeed > 0.85) {
        // Forward motion -> apply strong hydraulic + aero brakes
        isBraking = true;
        gear = 'D';
        longitudinalAccel = -Math.min(tractionAccelLimit * 1.35, spec.brakeDecel) * brakeReverseInput;
      } else {
        // Stopped or already moving backward -> engage Reverse gear smoothly!
        isReversing = true;
        gear = 'R';
        const revRatio = Math.max(0, 1 - Math.abs(forwardSpeed) / maxReverseSpeed);
        const revAccel = spec.reverseAccel * speedUpgrade * (0.4 + 0.6 * revRatio);
        longitudinalAccel = -brakeReverseInput * Math.min(tractionAccelLimit, revAccel);
      }
    } else {
      if (Math.abs(forwardSpeed) < 0.25) {
        gear = this.manualReverseLatch ? 'R' : 'N';
      } else {
        gear = forwardSpeed < 0 ? 'R' : 'D';
        isReversing = forwardSpeed < -0.15;
      }
    }

    if (handbrake) {
      isBraking = true;
      if (Math.abs(forwardSpeed) > 0.15) {
        const hbDecel = Math.min(tractionAccelLimit * 1.45, spec.handbrakeDecel);
        longitudinalAccel -= Math.sign(forwardSpeed) * hbDecel;
      }
    }

    // Integrate engine/braking acceleration along heading
    forwardSpeed += longitudinalAccel * dt;

    // Clamp top speed safely
    if (forwardSpeed > maxForwardSpeed) forwardSpeed = maxForwardSpeed;
    if (forwardSpeed < -maxReverseSpeed) forwardSpeed = -maxReverseSpeed;

    // Ackermann bicycle-model yaw rate (naturally reverses steering direction when backing up!)
    if (Math.abs(forwardSpeed) > 0.12 && Math.abs(this.steeringAngle) > 0.002) {
      const yawRate = (forwardSpeed / spec.wheelbaseM) * Math.tan(this.steeringAngle);
      this.state.vehicleRotationY += yawRate * dt;
    }

    // Recompute heading after yaw update
    const nextRotY = this.state.vehicleRotationY;
    this._heading.set(Math.sin(nextRotY), 0, Math.cos(nextRotY));
    this._right.set(Math.cos(nextRotY), 0, -Math.sin(nextRotY));

    // Tire lateral friction (scaled by surface grip & active ground-effect downforce)
    const lateralDamp =
      (handbrake ? 2.4 : spec.lateralGripScale) * surface.lateralGrip * aeroDownforceBonus * handlingUpgrade;
    lateralSpeed *= Math.exp(-lateralDamp * dt);

    // Reconstruct world-space velocity before applying unified WorldPhysicsEngine air drag & rolling friction
    this.vehicleVelocity
      .copy(this._heading)
      .multiplyScalar(forwardSpeed)
      .addScaledVector(this._right, lateralSpeed);

    const physicsStep = physics.applyWorldForcesToVelocity(
      this.vehicleVelocity,
      this.vehiclePosition.x,
      this.vehiclePosition.z,
      spec.physicsProfile,
      dt,
      true,
      0.28,
      true
    );

    // Bring creeping car cleanly to rest when no pedal is pressed
    const totalSpeed = Math.hypot(this.vehicleVelocity.x, this.vehicleVelocity.z);
    if (throttleInput < 0.02 && brakeReverseInput < 0.02 && totalSpeed < 0.18) {
      this.vehicleVelocity.set(0, 0, 0);
    }

    // Integrate position with swept horizontal collision resolution
    this._targetPos.set(
      this.vehiclePosition.x + this.vehicleVelocity.x * dt,
      0.02,
      this.vehiclePosition.z + this.vehicleVelocity.z * dt
    );
    const resolved = KinematicCollisionSolver.resolveHorizontal(
      this._targetPos,
      spec.collisionRadius,
      1.45,
      this.vehiclePosition,
      this._resolvedPos
    );

    // Compute true post-collision velocity so bumping a building zeroes impact velocity cleanly
    const actualVx = (resolved.x - this.vehiclePosition.x) / dt;
    const actualVz = (resolved.z - this.vehiclePosition.z) / dt;
    this.vehicleVelocity.set(actualVx, 0, actualVz);
    this.vehiclePosition.set(resolved.x, 0.02, resolved.z);

    // Update wheel spin from true signed forward distance traveled (spins backward in reverse!)
    const resolvedForwardSpeed = this.vehicleVelocity.dot(this._heading);
    const resolvedSpeed = Math.hypot(actualVx, actualVz);
    this.wheelSpinRad += (resolvedForwardSpeed * dt) / spec.wheelRadiusM;

    // Longitudinal & lateral G-forces for screen effects (FOV/radial blur/brake pulse) & chassis pitch/roll
    const rawLongG = (resolvedForwardSpeed - this.prevForwardSpeed) / (dt * 9.81);
    this.prevForwardSpeed = resolvedForwardSpeed;
    const clampedLongG = THREE.MathUtils.clamp(rawLongG, -3.6, 3.6);
    this.smoothedLongG = THREE.MathUtils.lerp(this.smoothedLongG, clampedLongG, 1 - Math.exp(-9.5 * dt));

    const yawSpeed = (resolvedForwardSpeed / spec.wheelbaseM) * Math.tan(this.steeringAngle);
    const rawLatG = THREE.MathUtils.clamp((resolvedForwardSpeed * yawSpeed) / 9.81, -2.4, 2.4);
    this.smoothedLatG = THREE.MathUtils.lerp(this.smoothedLatG, rawLatG, 1 - Math.exp(-8.5 * dt));

    const telemetry = this.state.telemetry;
    telemetry.forwardSpeedMs = resolvedForwardSpeed;
    telemetry.speedMs = resolvedSpeed;
    telemetry.speedKmh = Math.round(resolvedSpeed * 3.6);
    telemetry.longitudinalAccelG = this.smoothedLongG;
    telemetry.lateralAccelG = this.smoothedLatG;
    telemetry.steeringAngle = this.steeringAngle;
    telemetry.wheelSpinRad = this.wheelSpinRad;
    telemetry.gear = resolvedForwardSpeed < -0.15 ? 'R' : gear;
    telemetry.isBraking = isBraking;
    telemetry.isReversing = isReversing || resolvedForwardSpeed < -0.15;
    telemetry.isBoosting = boost && resolvedForwardSpeed > 2.0;
    telemetry.dragForceN = Math.round(physicsStep.dragForceN);
    telemetry.frictionForceN = Math.round(physicsStep.frictionForceN);
    telemetry.surfaceLabel = physicsStep.surface.label;
    telemetry.surfaceGrip = physicsStep.surface.frictionMu;

    this.state.vehiclePosition = [this.vehiclePosition.x, this.vehiclePosition.y, this.vehiclePosition.z];
    if (this.state.activeId) {
      const entry = this.rideables.get(this.state.activeId);
      if (entry) {
        entry.rotationY = this.state.vehicleRotationY;
      }
      this.syncRideablePosition(this.state.activeId, this.vehiclePosition);
    }

    // Throttle React HUD notifications (~15Hz) while keeping live telemetry mutated every frame for 60+ FPS camera/mesh reads
    this.lastTelemetryNotify += dt;
    if (this.lastTelemetryNotify >= 0.065) {
      this.lastTelemetryNotify = 0;
      this.emit();
    }

    return this.vehiclePosition;
  }

  private updateHoverVehicle(
    dt: number,
    cameraYaw: number,
    input: ReturnType<typeof InputManager.getState>
  ): THREE.Vector3 {
    const physics = WorldPhysicsEngine.getInstance();
    const len = Math.hypot(input.moveX, input.moveZ);

    if (len > 0.02) {
      this._camForward.set(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
      this._camRight.set(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw));
      this._moveDir
        .set(0, 0, 0)
        .addScaledVector(this._camRight, input.moveX / len)
        .addScaledVector(this._camForward, input.moveZ / len)
        .normalize();

      const targetSpeed = (input.sprint ? 26 : 17) * this.getMovementMultiplier();
      const accelRate = 1 - Math.exp(-7.5 * dt);
      this.vehicleVelocity.x = THREE.MathUtils.lerp(this.vehicleVelocity.x, this._moveDir.x * targetSpeed, accelRate);
      this.vehicleVelocity.z = THREE.MathUtils.lerp(this.vehicleVelocity.z, this._moveDir.z * targetSpeed, accelRate);
      this.state.vehicleRotationY = Math.atan2(this._moveDir.x, this._moveDir.z);
    }

    // Apply unified WorldPhysicsEngine air resistance & magnetic hover damping
    const step = physics.applyWorldForcesToVelocity(
      this.vehicleVelocity,
      this.vehiclePosition.x,
      this.vehiclePosition.z,
      HOVER_COUPE_PROFILE,
      dt,
      true,
      0.32,
      len <= 0.02
    );

    if (len <= 0.02) {
      const hoverBrake = Math.exp(-4.2 * dt);
      this.vehicleVelocity.x *= hoverBrake;
      this.vehicleVelocity.z *= hoverBrake;
    }

    const speed = Math.hypot(this.vehicleVelocity.x, this.vehicleVelocity.z);
    if (speed > 0.04) {
      this._targetPos.set(
        this.vehiclePosition.x + this.vehicleVelocity.x * dt,
        0.45,
        this.vehiclePosition.z + this.vehicleVelocity.z * dt
      );
      const resolved = KinematicCollisionSolver.resolveHorizontal(
        this._targetPos,
        0.9,
        1.4,
        this.vehiclePosition,
        this._resolvedPos
      );
      this.vehiclePosition.set(resolved.x, 0.45, resolved.z);
      this.state.vehiclePosition = [this.vehiclePosition.x, this.vehiclePosition.y, this.vehiclePosition.z];
      if (this.state.activeId) {
        const entry = this.rideables.get(this.state.activeId);
        if (entry) {
          entry.rotationY = this.state.vehicleRotationY;
        }
        this.syncRideablePosition(this.state.activeId, this.vehiclePosition);
      }
    }

    const rawLongG = (speed - this.prevForwardSpeed) / (dt * 9.81);
    this.prevForwardSpeed = speed;
    this.smoothedLongG = THREE.MathUtils.lerp(
      this.smoothedLongG,
      THREE.MathUtils.clamp(rawLongG, -2.5, 2.5),
      1 - Math.exp(-8 * dt)
    );

    const telemetry = this.state.telemetry;
    telemetry.forwardSpeedMs = speed;
    telemetry.speedMs = speed;
    telemetry.speedKmh = Math.round(speed * 3.6);
    telemetry.longitudinalAccelG = this.smoothedLongG;
    telemetry.dragForceN = Math.round(step.dragForceN);
    telemetry.frictionForceN = Math.round(step.frictionForceN);
    telemetry.surfaceLabel = step.surface.label;
    telemetry.surfaceGrip = step.surface.frictionMu;
    telemetry.isBoosting = input.sprint && speed > 4;

    return this.vehiclePosition;
  }

  public syncTransitPosition(position: THREE.Vector3, rotationY: number): void {
    this.transitPosition.copy(position);
    if (this.state.mode === 'TRANSIT_LINKED' && this.state.activeId) {
      this.state.vehicleRotationY = rotationY;
      this.syncRideablePosition(this.state.activeId, this.transitPosition);
    }
  }

  public upgrade(key: keyof VehicleUpgradeState): void {
    const current = this.save.getData().vehicleUpgrades[key];
    this.save.setVehicleUpgrade(key, current + 1);
    const upgrades = this.save.getData().vehicleUpgrades;
    const speedMultiplier = this.state.mode === 'RIDING' ? 1.55 + upgrades.speed * 0.18 : this.state.speedMultiplier;
    this.state = { ...this.state, upgrades, speedMultiplier };
    AudioManager.getInstance().playUI('waypoint');
    this.emit();
  }

  public getMovementMultiplier(): number {
    return this.state.mode === 'ON_FOOT' ? 1 : this.state.speedMultiplier;
  }

  private emit(): void {
    this.listeners.forEach((l) => l(this.state));
  }
}
