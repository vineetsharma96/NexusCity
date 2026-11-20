import * as THREE from 'three';

export type DayPhase = 'NIGHT' | 'SUNRISE' | 'DAY' | 'SUNSET';

export interface EnvironmentSyncInput {
  rainIntensity?: number;
  snowIntensity?: number;
  wetnessFactor?: number;
  fogDensityMultiplier?: number;
  lightningFlash?: number;
  districtFogColor?: string;
  districtAccentColor?: string;
  cityEventLightScale?: number;
}

export interface TimeLightingState {
  timeOfDay: number; // 0.0 to 24.0
  hours: number; // alias for 0.0 to 24.0
  timeString: string; // "HH:MM"
  phase: DayPhase;
  subPhaseLabel: string;
  isNight: boolean;
  streetLightsOn: boolean;
  nightFactor: number; // 0.0 (day) to 1.0 (deep night)
  goldenHourFactor: number; // 0.0 to 1.0 (peaks at sunrise/sunset)
  sunDirection: THREE.Vector3;
  moonDirection: THREE.Vector3;
  sunElevationDeg: number; // -90 to +90
  sunAzimuthDeg: number; // 0 to 360
  sunColor: string;
  sunIntensity: number;
  moonIntensity: number;
  ambientColor: string;
  ambientIntensity: number;
  hemiSkyColor: string;
  hemiGroundColor: string;
  hemiIntensity: number;
  giBounceColor: string;
  giBounceIntensity: number;
  skyTopColor: string;
  skyMidColor: string;
  skyHorizonColor: string;
  solarGlowColor: string;
  cloudColor: string;
  fogColor: string;
  fogNear: number;
  fogFar: number;
  starOpacity: number;
  colorTemperatureK: number;
  exposureTarget: number;
  timeScaleMultiplier: number;
  isPaused: boolean;
}

interface DiurnalKeyframe {
  hour: number;
  skyTop: string;
  skyMid: string;
  skyHorizon: string;
  solarGlow: string;
  sunColor: string;
  ambientColor: string;
  hemiSky: string;
  hemiGround: string;
  giBounce: string;
  cloudColor: string;
  fogColor: string;
  sunIntensity: number;
  moonIntensity: number;
  ambientIntensity: number;
  hemiIntensity: number;
  giBounceIntensity: number;
  fogNear: number;
  fogFar: number;
  starOpacity: number;
  nightFactor: number;
  goldenHour: number;
  colorTempK: number;
  exposure: number;
}

// 9-keyframe 24-hour loop (0.0 through 24.0) for seamless C1-continuous Hermite interpolation
const DIURNAL_KEYFRAMES: DiurnalKeyframe[] = [
  {
    hour: 0.0, // Deep Midnight
    skyTop: '#030714',
    skyMid: '#081229',
    skyHorizon: '#102142',
    solarGlow: '#38bdf8',
    sunColor: '#93c5fd',
    ambientColor: '#162440',
    hemiSky: '#38bdf8',
    hemiGround: '#070c18',
    giBounce: '#2563eb',
    cloudColor: '#162138',
    fogColor: '#070e1f',
    sunIntensity: 0.0,
    moonIntensity: 1.15,
    ambientIntensity: 0.28,
    hemiIntensity: 0.56,
    giBounceIntensity: 0.42,
    fogNear: 120,
    fogFar: 540,
    starOpacity: 0.95,
    nightFactor: 1.0,
    goldenHour: 0.0,
    colorTempK: 4200,
    exposure: 1.24,
  },
  {
    hour: 4.5, // Pre-Dawn Indigo
    skyTop: '#060c1f',
    skyMid: '#131d3b',
    skyHorizon: '#2b2448',
    solarGlow: '#fb7185',
    sunColor: '#fda4af',
    ambientColor: '#1e2640',
    hemiSky: '#4776b8',
    hemiGround: '#0b1020',
    giBounce: '#38bdf8',
    cloudColor: '#292c4c',
    fogColor: '#141a30',
    sunIntensity: 0.25,
    moonIntensity: 0.72,
    ambientIntensity: 0.32,
    hemiIntensity: 0.6,
    giBounceIntensity: 0.44,
    fogNear: 115,
    fogFar: 510,
    starOpacity: 0.72,
    nightFactor: 0.85,
    goldenHour: 0.25,
    colorTempK: 3400,
    exposure: 1.22,
  },
  {
    hour: 6.2, // Crimson-Gold Sunrise
    skyTop: '#16294c',
    skyMid: '#563c6b',
    skyHorizon: '#f59e0b',
    solarGlow: '#fb923c',
    sunColor: '#ffb470',
    ambientColor: '#5c4b66',
    hemiSky: '#fbbf24',
    hemiGround: '#1e1926',
    giBounce: '#f59e0b',
    cloudColor: '#fed7aa',
    fogColor: '#43324d',
    sunIntensity: 2.15,
    moonIntensity: 0.1,
    ambientIntensity: 0.38,
    hemiIntensity: 0.74,
    giBounceIntensity: 0.6,
    fogNear: 105,
    fogFar: 500,
    starOpacity: 0.12,
    nightFactor: 0.32,
    goldenHour: 1.0,
    colorTempK: 2600,
    exposure: 1.15,
  },
  {
    hour: 8.5, // Crisp Solar Morning
    skyTop: '#0c467d',
    skyMid: '#2882c8',
    skyHorizon: '#93c5fd',
    solarGlow: '#fef08a',
    sunColor: '#fff1d0',
    ambientColor: '#9fb8d4',
    hemiSky: '#e0f2fe',
    hemiGround: '#1e293b',
    giBounce: '#7dd3fc',
    cloudColor: '#f8fafc',
    fogColor: '#7ca5c8',
    sunIntensity: 2.75,
    moonIntensity: 0.0,
    ambientIntensity: 0.44,
    hemiIntensity: 0.86,
    giBounceIntensity: 0.68,
    fogNear: 135,
    fogFar: 630,
    starOpacity: 0.0,
    nightFactor: 0.0,
    goldenHour: 0.22,
    colorTempK: 5100,
    exposure: 1.08,
  },
  {
    hour: 13.0, // Solar Zenith
    skyTop: '#093968',
    skyMid: '#1e7bc4',
    skyHorizon: '#bae6fd',
    solarGlow: '#fffbeb',
    sunColor: '#fff7e6',
    ambientColor: '#b8cbe0',
    hemiSky: '#f0f9ff',
    hemiGround: '#243044',
    giBounce: '#93c5fd',
    cloudColor: '#ffffff',
    fogColor: '#8eb6d4',
    sunIntensity: 3.15,
    moonIntensity: 0.0,
    ambientIntensity: 0.48,
    hemiIntensity: 0.94,
    giBounceIntensity: 0.76,
    fogNear: 155,
    fogFar: 700,
    starOpacity: 0.0,
    nightFactor: 0.0,
    goldenHour: 0.0,
    colorTempK: 5800,
    exposure: 1.04,
  },
  {
    hour: 16.5, // Late Afternoon Warmth
    skyTop: '#103e6b',
    skyMid: '#2d6fa3',
    skyHorizon: '#fde68a',
    solarGlow: '#fcd34d',
    sunColor: '#fde2a0',
    ambientColor: '#b2bfd1',
    hemiSky: '#fef3c7',
    hemiGround: '#222938',
    giBounce: '#fbbf24',
    cloudColor: '#fef3c7',
    fogColor: '#8a9bb5',
    sunIntensity: 2.7,
    moonIntensity: 0.0,
    ambientIntensity: 0.44,
    hemiIntensity: 0.85,
    giBounceIntensity: 0.68,
    fogNear: 135,
    fogFar: 620,
    starOpacity: 0.0,
    nightFactor: 0.05,
    goldenHour: 0.45,
    colorTempK: 4700,
    exposure: 1.09,
  },
  {
    hour: 18.5, // Solar Dusk / Amber-Violet Twilight
    skyTop: '#131d3d',
    skyMid: '#5c3061',
    skyHorizon: '#f97316',
    solarGlow: '#f43f5e',
    sunColor: '#ff9e5e',
    ambientColor: '#56445e',
    hemiSky: '#fb923c',
    hemiGround: '#181424',
    giBounce: '#e11d48',
    cloudColor: '#fdba74',
    fogColor: '#3b2844',
    sunIntensity: 2.2,
    moonIntensity: 0.18,
    ambientIntensity: 0.36,
    hemiIntensity: 0.72,
    giBounceIntensity: 0.58,
    fogNear: 105,
    fogFar: 500,
    starOpacity: 0.22,
    nightFactor: 0.42,
    goldenHour: 1.0,
    colorTempK: 2400,
    exposure: 1.16,
  },
  {
    hour: 20.5, // Blue Hour / Neon Ignition
    skyTop: '#050a1a',
    skyMid: '#0c1936',
    skyHorizon: '#182a54',
    solarGlow: '#38bdf8',
    sunColor: '#7dd3fc',
    ambientColor: '#1a2744',
    hemiSky: '#38bdf8',
    hemiGround: '#090d1a',
    giBounce: '#2563eb',
    cloudColor: '#1e293b',
    fogColor: '#0b142b',
    sunIntensity: 0.0,
    moonIntensity: 1.05,
    ambientIntensity: 0.3,
    hemiIntensity: 0.6,
    giBounceIntensity: 0.46,
    fogNear: 118,
    fogFar: 525,
    starOpacity: 0.85,
    nightFactor: 0.92,
    goldenHour: 0.08,
    colorTempK: 4100,
    exposure: 1.22,
  },
  {
    hour: 24.0, // Wrap to Deep Midnight
    skyTop: '#030714',
    skyMid: '#081229',
    skyHorizon: '#102142',
    solarGlow: '#38bdf8',
    sunColor: '#93c5fd',
    ambientColor: '#162440',
    hemiSky: '#38bdf8',
    hemiGround: '#070c18',
    giBounce: '#2563eb',
    cloudColor: '#162138',
    fogColor: '#070e1f',
    sunIntensity: 0.0,
    moonIntensity: 1.15,
    ambientIntensity: 0.28,
    hemiIntensity: 0.56,
    giBounceIntensity: 0.42,
    fogNear: 120,
    fogFar: 540,
    starOpacity: 0.95,
    nightFactor: 1.0,
    goldenHour: 0.0,
    colorTempK: 4200,
    exposure: 1.24,
  },
];

type TimeListener = (state: TimeLightingState) => void;

function smoothstep01(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

export class TimeSystem {
  private static instance: TimeSystem;
  private timeOfDay = 21.5;
  private targetTimeOfDay: number | null = null;
  private readonly baseTimeSpeed = 24 / 600; // Full 24h cycle in 10 real-world minutes at 1x
  private timeScaleMultiplier = 1.0;
  private isPaused = false;
  private envSync: EnvironmentSyncInput = {
    rainIntensity: 0,
    wetnessFactor: 0.15,
    fogDensityMultiplier: 1.0,
    lightningFlash: 0,
    districtFogColor: '#0b1326',
    districtAccentColor: '#38bdf8',
    cityEventLightScale: 1.0,
  };
  private listeners = new Set<TimeListener>();
  private state: TimeLightingState;

  private colA = new THREE.Color();
  private colB = new THREE.Color();
  private sunDir = new THREE.Vector3();
  private moonDir = new THREE.Vector3();
  private notifyAccum = 0;

  private constructor() {
    this.state = this.computeState(this.timeOfDay);
  }

  public static getInstance(): TimeSystem {
    if (!TimeSystem.instance) {
      TimeSystem.instance = new TimeSystem();
    }
    return TimeSystem.instance;
  }

  public update(delta: number): void {
    const dt = Math.min(Math.max(0, delta), 0.1);
    if (dt <= 0) return;

    // Smooth animated transition when a target solar phase is gliding, or steady diurnal progression
    if (this.targetTimeOfDay !== null) {
      let diff = this.targetTimeOfDay - this.timeOfDay;
      if (diff > 12) diff -= 24;
      if (diff < -12) diff += 24;

      if (Math.abs(diff) < 0.02) {
        this.timeOfDay = ((this.targetTimeOfDay % 24) + 24) % 24;
        this.targetTimeOfDay = null;
      } else {
        this.timeOfDay = (((this.timeOfDay + diff * Math.min(1, dt * 6.5)) % 24) + 24) % 24;
      }
      this.state = this.computeState(this.timeOfDay);
      this.notifyAccum = 0;
      this.notify();
    } else if (!this.isPaused && this.timeScaleMultiplier > 0) {
      this.timeOfDay = (this.timeOfDay + dt * this.baseTimeSpeed * this.timeScaleMultiplier) % 24;
      this.state = this.computeState(this.timeOfDay);
      this.notifyAccum += dt;
      if (this.notifyAccum >= 0.065) {
        this.notifyAccum = 0;
        this.notify();
      }
    }
  }

  /**
   * Synchronizes the time-of-day sky palette and global illumination with current weather,
   * district atmosphere, and city grid events.
   */
  public syncEnvironment(input: EnvironmentSyncInput): void {
    this.envSync = {
      ...this.envSync,
      ...input,
    };
    this.state = this.computeState(this.timeOfDay);
  }

  public setTime(hours: number, smoothGlide: boolean = false): void {
    const normalized = ((hours % 24) + 24) % 24;
    if (smoothGlide) {
      this.targetTimeOfDay = normalized;
    } else {
      this.targetTimeOfDay = null;
      this.timeOfDay = normalized;
    }
    this.state = this.computeState(this.timeOfDay);
    this.notify();
  }

  public setTimeScaleMultiplier(multiplier: number): void {
    this.timeScaleMultiplier = Math.max(0, Math.min(20, multiplier));
    this.isPaused = this.timeScaleMultiplier === 0;
    this.state = this.computeState(this.timeOfDay);
    this.notify();
  }

  public setPaused(paused: boolean): void {
    this.isPaused = paused;
    this.state = this.computeState(this.timeOfDay);
    this.notify();
  }

  public getState(): TimeLightingState {
    return this.state;
  }

  public subscribe(listener: TimeListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((l) => l(this.state));
  }

  private lerpHex(hexA: string, hexB: string, t: number): string {
    this.colA.set(hexA).lerp(this.colB.set(hexB), t);
    return `#${this.colA.getHexString()}`;
  }

  private computeState(h: number): TimeLightingState {
    const hour = ((h % 24) + 24) % 24;
    const hrs = Math.floor(hour);
    const mins = Math.floor((hour - hrs) * 60);
    const timeString = `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;

    // 1. Continuous 3D Solar & Lunar Orbital Mechanics
    // Sun rises in the East (+X) at 06:00, reaches Zenith (+Y) at 12:00, sets in the West (-X) at 18:00
    const sunOrbitalAngle = ((hour - 6) / 24) * Math.PI * 2;
    const sunX = Math.cos(sunOrbitalAngle);
    const sunY = Math.sin(sunOrbitalAngle);
    const sunZ = 0.28 * Math.sin(sunOrbitalAngle * 0.5 + 0.35);
    const sunDirection = this.sunDir.set(sunX, sunY, sunZ).normalize();
    const moonDirection = this.moonDir.set(-sunX, -sunY, -sunZ + 0.18).normalize();

    const sunElevationDeg = THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(sunDirection.y, -1, 1)));
    const sunAzimuthDeg = (THREE.MathUtils.radToDeg(Math.atan2(sunDirection.x, sunDirection.z)) + 360) % 360;

    // 2. Locate surrounding diurnal keyframes and interpolate with C1 Hermite smoothstep
    let k0 = DIURNAL_KEYFRAMES[0];
    let k1 = DIURNAL_KEYFRAMES[1];
    for (let i = 0; i < DIURNAL_KEYFRAMES.length - 1; i++) {
      if (hour >= DIURNAL_KEYFRAMES[i].hour && hour <= DIURNAL_KEYFRAMES[i + 1].hour) {
        k0 = DIURNAL_KEYFRAMES[i];
        k1 = DIURNAL_KEYFRAMES[i + 1];
        break;
      }
    }
    const span = Math.max(0.0001, k1.hour - k0.hour);
    const rawT = (hour - k0.hour) / span;
    const t = smoothstep01(rawT);

    // 3. Determine Phase & Architectural Sub-Phase Label
    let phase: DayPhase = 'NIGHT';
    if (hour >= 5.0 && hour < 7.5) phase = 'SUNRISE';
    else if (hour >= 7.5 && hour < 17.5) phase = 'DAY';
    else if (hour >= 17.5 && hour < 20.5) phase = 'SUNSET';

    let subPhaseLabel = 'NEON NOCTURNE';
    if (hour < 4.2 || hour >= 22.5) subPhaseLabel = 'DEEP MIDNIGHT';
    else if (hour < 5.5) subPhaseLabel = 'PRE-DAWN INDIGO';
    else if (hour < 7.5) subPhaseLabel = 'GOLDEN SUNRISE';
    else if (hour < 11.0) subPhaseLabel = 'SOLAR MORNING';
    else if (hour < 15.2) subPhaseLabel = 'SOLAR ZENITH';
    else if (hour < 17.5) subPhaseLabel = 'GOLDEN HOUR';
    else if (hour < 19.5) subPhaseLabel = 'CRIMSON DUSK';
    else if (hour < 22.5) subPhaseLabel = 'BLUE HOUR NOCTURNE';

    // 4. Interpolate Base Diurnal Colors & Intensities
    let skyTopColor = this.lerpHex(k0.skyTop, k1.skyTop, t);
    let skyMidColor = this.lerpHex(k0.skyMid, k1.skyMid, t);
    let skyHorizonColor = this.lerpHex(k0.skyHorizon, k1.skyHorizon, t);
    let solarGlowColor = this.lerpHex(k0.solarGlow, k1.solarGlow, t);
    let sunColor = this.lerpHex(k0.sunColor, k1.sunColor, t);
    let ambientColor = this.lerpHex(k0.ambientColor, k1.ambientColor, t);
    let hemiSkyColor = this.lerpHex(k0.hemiSky, k1.hemiSky, t);
    let hemiGroundColor = this.lerpHex(k0.hemiGround, k1.hemiGround, t);
    let giBounceColor = this.lerpHex(k0.giBounce, k1.giBounce, t);
    let cloudColor = this.lerpHex(k0.cloudColor, k1.cloudColor, t);
    let fogColor = this.lerpHex(k0.fogColor, k1.fogColor, t);

    let sunIntensity = THREE.MathUtils.lerp(k0.sunIntensity, k1.sunIntensity, t);
    let moonIntensity = THREE.MathUtils.lerp(k0.moonIntensity, k1.moonIntensity, t);
    let ambientIntensity = THREE.MathUtils.lerp(k0.ambientIntensity, k1.ambientIntensity, t);
    let hemiIntensity = THREE.MathUtils.lerp(k0.hemiIntensity, k1.hemiIntensity, t);
    let giBounceIntensity = THREE.MathUtils.lerp(k0.giBounceIntensity, k1.giBounceIntensity, t);
    const fogNear = THREE.MathUtils.lerp(k0.fogNear, k1.fogNear, t);
    const fogFar = THREE.MathUtils.lerp(k0.fogFar, k1.fogFar, t);
    const starOpacity = THREE.MathUtils.lerp(k0.starOpacity, k1.starOpacity, t);
    const nightFactor = THREE.MathUtils.lerp(k0.nightFactor, k1.nightFactor, t);
    const goldenHourFactor = THREE.MathUtils.lerp(k0.goldenHour, k1.goldenHour, t);
    const colorTemperatureK = Math.round(THREE.MathUtils.lerp(k0.colorTempK, k1.colorTempK, t));
    const exposureTarget = THREE.MathUtils.lerp(k0.exposure, k1.exposure, t);

    // 5. Synchronize Sky Palette & Global Illumination with Current Environment Settings
    const rain = THREE.MathUtils.clamp(this.envSync.rainIntensity ?? 0, 0, 1);
    const snow = THREE.MathUtils.clamp(this.envSync.snowIntensity ?? 0, 0, 1);
    const precip = Math.max(rain, snow);
    const fogMult = Math.max(1, this.envSync.fogDensityMultiplier ?? 1);
    const fogStrength = THREE.MathUtils.clamp((fogMult - 1.0) / 4.2, 0, 1);
    const lightScale = THREE.MathUtils.clamp(this.envSync.cityEventLightScale ?? 1, 0.15, 2.0);

    // Blend district atmospheric tint into horizon, fog, and GI bounce
    if (this.envSync.districtFogColor) {
      skyHorizonColor = this.lerpHex(skyHorizonColor, this.envSync.districtFogColor, 0.28);
      fogColor = this.lerpHex(fogColor, this.envSync.districtFogColor, 0.38);
    }
    if (this.envSync.districtAccentColor && nightFactor > 0.25) {
      giBounceColor = this.lerpHex(giBounceColor, this.envSync.districtAccentColor, nightFactor * 0.45);
    }

    // Overcast storm & rain synchronization
    if (rain > 0.02) {
      const overcastTone = nightFactor > 0.5 ? '#080f1e' : '#334155';
      skyTopColor = this.lerpHex(skyTopColor, overcastTone, rain * 0.62);
      skyMidColor = this.lerpHex(skyMidColor, overcastTone, rain * 0.66);
      skyHorizonColor = this.lerpHex(skyHorizonColor, overcastTone, rain * 0.58);
      cloudColor = this.lerpHex(cloudColor, '#1e293b', rain * 0.7);
      sunIntensity *= 1.0 - rain * 0.38;
      // Wet surfaces scatter more ambient/hemisphere fill
      hemiIntensity *= 1.0 + rain * 0.12;
    }

    // Cryogenic snowfall & blizzard synchronization
    if (snow > 0.02) {
      const snowSkyTone = nightFactor > 0.5 ? '#111c33' : '#64748b';
      const snowHorizonTone = nightFactor > 0.5 ? '#1e293b' : '#cbd5e1';
      skyTopColor = this.lerpHex(skyTopColor, snowSkyTone, snow * 0.58);
      skyMidColor = this.lerpHex(skyMidColor, snowSkyTone, snow * 0.64);
      skyHorizonColor = this.lerpHex(skyHorizonColor, snowHorizonTone, snow * 0.62);
      fogColor = this.lerpHex(fogColor, snowHorizonTone, snow * 0.52);
      cloudColor = this.lerpHex(cloudColor, '#e2e8f0', snow * 0.65);
      hemiGroundColor = this.lerpHex(hemiGroundColor, '#334155', snow * 0.48);
      sunIntensity *= 1.0 - snow * 0.32;
      hemiIntensity *= 1.0 + snow * 0.22;
    }

    // Dense fog synchronization
    if (fogStrength > 0.05) {
      const mistTone = nightFactor > 0.5 ? '#132038' : '#94a3b8';
      fogColor = this.lerpHex(fogColor, mistTone, fogStrength * 0.65);
      skyTopColor = this.lerpHex(skyTopColor, fogColor, fogStrength * 0.82);
      skyMidColor = this.lerpHex(skyMidColor, fogColor, fogStrength * 0.88);
      skyHorizonColor = this.lerpHex(skyHorizonColor, fogColor, fogStrength * 0.94);
      sunIntensity *= 1.0 - fogStrength * 0.35;
      giBounceIntensity *= 1.0 + fogStrength * 0.22;
    }

    // Apply city event grid scale
    sunIntensity *= lightScale;
    moonIntensity *= lightScale;
    ambientIntensity *= lightScale;
    hemiIntensity *= lightScale;
    giBounceIntensity *= lightScale;

    return {
      timeOfDay: hour,
      hours: hour,
      timeString,
      phase,
      subPhaseLabel,
      isNight: nightFactor > 0.55,
      streetLightsOn: nightFactor >= 0.25,
      nightFactor,
      goldenHourFactor,
      sunDirection,
      moonDirection,
      sunElevationDeg,
      sunAzimuthDeg,
      sunColor,
      sunIntensity,
      moonIntensity,
      ambientColor,
      ambientIntensity,
      hemiSkyColor,
      hemiGroundColor,
      hemiIntensity,
      giBounceColor,
      giBounceIntensity,
      skyTopColor,
      skyMidColor,
      skyHorizonColor,
      solarGlowColor,
      cloudColor,
      fogColor,
      fogNear,
      fogFar,
      starOpacity: starOpacity * (1.0 - precip * 0.85) * (1.0 - fogStrength * 0.9),
      colorTemperatureK,
      exposureTarget,
      timeScaleMultiplier: this.timeScaleMultiplier,
      isPaused: this.isPaused,
    };
  }
}
