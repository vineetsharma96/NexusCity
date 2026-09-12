import * as THREE from 'three';

export type TimeOfDayPhase = 'DAWN' | 'DAY' | 'SUNSET' | 'DUSK' | 'NIGHT';

export interface TimeLightingState {
  hour: number;
  formattedTime: string;
  phase: TimeOfDayPhase;
  isNight: boolean;
  nightFactor: number; // 0 (day) .. 1 (night)
  celestialPosition: THREE.Vector3;
  celestialColor: string;
  celestialIntensity: number;
  skyColor: string;
  fogColor: string;
  hemiSkyColor: string;
  hemiGroundColor: string;
  ambientIntensity: number;
}

interface TimeKeyframe {
  hour: number;
  phase: TimeOfDayPhase;
  skyColor: string;
  fogColor: string;
  celestialColor: string;
  hemiSkyColor: string;
  hemiGroundColor: string;
  celestialIntensity: number;
  ambientIntensity: number;
  nightFactor: number;
}

const TIME_KEYFRAMES: TimeKeyframe[] = [
  {
    hour: 0.0,
    phase: 'NIGHT',
    skyColor: '#030612',
    fogColor: '#030612',
    celestialColor: '#93c5fd',
    hemiSkyColor: '#101726',
    hemiGroundColor: '#060912',
    celestialIntensity: 0.8,
    ambientIntensity: 0.24,
    nightFactor: 1.0,
  },
  {
    hour: 4.5,
    phase: 'NIGHT',
    skyColor: '#040816',
    fogColor: '#040816',
    celestialColor: '#a5b4fc',
    hemiSkyColor: '#121a2d',
    hemiGroundColor: '#080c18',
    celestialIntensity: 0.9,
    ambientIntensity: 0.26,
    nightFactor: 0.9,
  },
  {
    hour: 5.75,
    phase: 'DAWN',
    skyColor: '#121428',
    fogColor: '#14172c',
    celestialColor: '#fb923c',
    hemiSkyColor: '#f59e0b',
    hemiGroundColor: '#0e1626',
    celestialIntensity: 1.6,
    ambientIntensity: 0.35,
    nightFactor: 0.5,
  },
  {
    hour: 6.75,
    phase: 'DAWN',
    skyColor: '#1c1c38',
    fogColor: '#222040',
    celestialColor: '#fed7aa',
    hemiSkyColor: '#f97316',
    hemiGroundColor: '#172033',
    celestialIntensity: 2.2,
    ambientIntensity: 0.42,
    nightFactor: 0.2,
  },
  {
    hour: 9.0,
    phase: 'DAY',
    skyColor: '#132548',
    fogColor: '#132548',
    celestialColor: '#fffdf5',
    hemiSkyColor: '#60a5fa',
    hemiGroundColor: '#1e293b',
    celestialIntensity: 2.5,
    ambientIntensity: 0.48,
    nightFactor: 0.0,
  },
  {
    hour: 12.0,
    phase: 'DAY',
    skyColor: '#0f2244',
    fogColor: '#0f2244',
    celestialColor: '#fffbf0',
    hemiSkyColor: '#6fa4db',
    hemiGroundColor: '#202c3f',
    celestialIntensity: 2.6,
    ambientIntensity: 0.50,
    nightFactor: 0.0,
  },
  {
    hour: 16.5,
    phase: 'DAY',
    skyColor: '#15223e',
    fogColor: '#15223e',
    celestialColor: '#fef3c7',
    hemiSkyColor: '#6ba6e8',
    hemiGroundColor: '#1e283a',
    celestialIntensity: 2.4,
    ambientIntensity: 0.47,
    nightFactor: 0.05,
  },
  {
    hour: 17.75,
    phase: 'SUNSET',
    skyColor: '#2a1426',
    fogColor: '#33162c',
    celestialColor: '#ff7700',
    hemiSkyColor: '#c084fc',
    hemiGroundColor: '#ea580c',
    celestialIntensity: 2.3,
    ambientIntensity: 0.43,
    nightFactor: 0.35,
  },
  {
    hour: 19.25,
    phase: 'DUSK',
    skyColor: '#160e22',
    fogColor: '#1a1028',
    celestialColor: '#818cf8',
    hemiSkyColor: '#7c3aed',
    hemiGroundColor: '#7c2d12',
    celestialIntensity: 1.5,
    ambientIntensity: 0.34,
    nightFactor: 0.7,
  },
  {
    hour: 20.75,
    phase: 'NIGHT',
    skyColor: '#080a18',
    fogColor: '#080a18',
    celestialColor: '#60a5fa',
    hemiSkyColor: '#1e293b',
    hemiGroundColor: '#0c1322',
    celestialIntensity: 1.0,
    ambientIntensity: 0.28,
    nightFactor: 0.95,
  },
  {
    hour: 24.0,
    phase: 'NIGHT',
    skyColor: '#030612',
    fogColor: '#030612',
    celestialColor: '#93c5fd',
    hemiSkyColor: '#101726',
    hemiGroundColor: '#060912',
    celestialIntensity: 0.8,
    ambientIntensity: 0.24,
    nightFactor: 1.0,
  },
];

type TimeChangeListener = (state: TimeLightingState) => void;

export class TimeSystem {
  private static instance: TimeSystem;

  // 17.5 = 17:30 (approaching golden hour by default)
  private currentHour: number = 17.5;
  private timeScale: number = 0.05; // ~1 real second = 3 game minutes
  private isPaused: boolean = false;
  private listeners: Set<TimeChangeListener> = new Set();

  private constructor() {}

  public static getInstance(): TimeSystem {
    if (!TimeSystem.instance) {
      TimeSystem.instance = new TimeSystem();
    }
    return TimeSystem.instance;
  }

  public update(delta: number): void {
    if (!this.isPaused) {
      this.currentHour = (this.currentHour + delta * this.timeScale) % 24;
      this.notify();
    }
  }

  public setHour(hour: number): void {
    this.currentHour = ((hour % 24) + 24) % 24;
    this.notify();
  }

  public getHour(): number {
    return this.currentHour;
  }

  public togglePause(): boolean {
    this.isPaused = !this.isPaused;
    return this.isPaused;
  }

  public setTimeScale(scale: number): void {
    this.timeScale = scale;
  }

  public getState(): TimeLightingState {
    const h = this.currentHour;

    // Find bounding keyframes for smooth continuous interpolation
    let k0 = TIME_KEYFRAMES[0];
    let k1 = TIME_KEYFRAMES[1];

    for (let i = 0; i < TIME_KEYFRAMES.length - 1; i++) {
      if (h >= TIME_KEYFRAMES[i].hour && h <= TIME_KEYFRAMES[i + 1].hour) {
        k0 = TIME_KEYFRAMES[i];
        k1 = TIME_KEYFRAMES[i + 1];
        break;
      }
    }

    const span = k1.hour - k0.hour;
    const rawT = span > 0 ? (h - k0.hour) / span : 0;
    // Smooth cosine S-curve interpolation between keyframes
    const t = 0.5 - 0.5 * Math.cos(rawT * Math.PI);

    // Interpolate colors smoothly
    const cSky = new THREE.Color(k0.skyColor).lerp(new THREE.Color(k1.skyColor), t);
    const cFog = new THREE.Color(k0.fogColor).lerp(new THREE.Color(k1.fogColor), t);
    const cCelestial = new THREE.Color(k0.celestialColor).lerp(new THREE.Color(k1.celestialColor), t);
    const cHemiSky = new THREE.Color(k0.hemiSkyColor).lerp(new THREE.Color(k1.hemiSkyColor), t);
    const cHemiGround = new THREE.Color(k0.hemiGroundColor).lerp(new THREE.Color(k1.hemiGroundColor), t);

    // Interpolate scalar intensities
    const celestialIntensity = THREE.MathUtils.lerp(k0.celestialIntensity, k1.celestialIntensity, t);
    const ambientIntensity = THREE.MathUtils.lerp(k0.ambientIntensity, k1.ambientIntensity, t);
    const nightFactor = THREE.MathUtils.lerp(k0.nightFactor, k1.nightFactor, t);

    // Determine descriptive phase from current hour
    let phase: TimeOfDayPhase = 'DAY';
    if (h >= 5.0 && h < 7.5) phase = 'DAWN';
    else if (h >= 7.5 && h < 17.0) phase = 'DAY';
    else if (h >= 17.0 && h < 19.0) phase = 'SUNSET';
    else if (h >= 19.0 && h < 20.75) phase = 'DUSK';
    else phase = 'NIGHT';

    // Format HH:MM
    const hours = Math.floor(h);
    const minutes = Math.floor((h % 1) * 60);
    const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

    // Continuous 360-degree celestial orbit
    // Sun rises East (+x) at 06:00, zenith at 12:00, sets West (-x) at 18:00
    // Moon rises East at 18:00, zenith at 00:00, sets West at 06:00
    const celestialPos = new THREE.Vector3();
    const isDaytime = h >= 6.0 && h <= 18.0;

    if (isDaytime) {
      const sunAngle = ((h - 6.0) / 12.0) * Math.PI;
      const height = Math.sin(sunAngle) * 140;
      const x = Math.cos(sunAngle) * 110;
      celestialPos.set(x, Math.max(8, height), 45);
    } else {
      const moonHour = h > 18.0 ? h - 18.0 : h + 6.0;
      const moonAngle = (moonHour / 12.0) * Math.PI;
      const height = Math.sin(moonAngle) * 115;
      const x = Math.cos(moonAngle) * 95;
      celestialPos.set(x, Math.max(8, height), -45);
    }

    return {
      hour: h,
      formattedTime,
      phase,
      isNight: nightFactor > 0.5,
      nightFactor,
      celestialPosition: celestialPos,
      celestialColor: `#${cCelestial.getHexString()}`,
      celestialIntensity,
      skyColor: `#${cSky.getHexString()}`,
      fogColor: `#${cFog.getHexString()}`,
      hemiSkyColor: `#${cHemiSky.getHexString()}`,
      hemiGroundColor: `#${cHemiGround.getHexString()}`,
      ambientIntensity,
    };
  }

  public subscribe(listener: TimeChangeListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const state = this.getState();
    this.listeners.forEach((l) => l(state));
  }
}
