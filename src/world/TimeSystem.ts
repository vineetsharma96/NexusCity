import * as THREE from 'three';

export type DayPhase = 'SUNRISE' | 'DAY' | 'SUNSET' | 'NIGHT';

export interface TimeLightingState {
  hours: number;
  timeString: string;
  phase: DayPhase;
  sunDirection: THREE.Vector3;
  moonDirection: THREE.Vector3;
  sunIntensity: number;
  moonIntensity: number;
  ambientIntensity: number;
  hemiIntensity: number;
  sunColor: string;
  skyTopColor: string;
  skyHorizonColor: string;
  fogColor: string;
  fogNear: number;
  fogFar: number;
  isNight: boolean;
  nightFactor: number;
  starOpacity: number;
  cloudColor: string;
}

type TimeListener = (state: TimeLightingState) => void;

export class TimeSystem {
  private static instance: TimeSystem;
  private hours = 22.0;
  private speedMultiplier = 1.0;
  private isPaused = false;
  private listeners = new Set<TimeListener>();
  private state: TimeLightingState;

  private readonly cNightTop = new THREE.Color('#04070f');
  private readonly cNightHorizon = new THREE.Color('#0b1326');
  private readonly cNightFog = new THREE.Color('#080d1a');
  private readonly cNightSun = new THREE.Color('#38bdf8');
  private readonly cNightCloud = new THREE.Color('#1e293b');

  private readonly cDawnTop = new THREE.Color('#171836');
  private readonly cDawnHorizon = new THREE.Color('#ea580c');
  private readonly cDawnFog = new THREE.Color('#7c2d12');
  private readonly cDawnSun = new THREE.Color('#fb923c');
  private readonly cDawnCloud = new THREE.Color('#fdba74');

  private readonly cDayTop = new THREE.Color('#0284c7');
  private readonly cDayHorizon = new THREE.Color('#bae6fd');
  private readonly cDayFog = new THREE.Color('#93c5fd');
  private readonly cDaySun = new THREE.Color('#fef9c3');
  private readonly cDayCloud = new THREE.Color('#f8fafc');

  private readonly cDuskTop = new THREE.Color('#0f172a');
  private readonly cDuskHorizon = new THREE.Color('#d97706');
  private readonly cDuskFog = new THREE.Color('#451a03');
  private readonly cDuskSun = new THREE.Color('#f59e0b');
  private readonly cDuskCloud = new THREE.Color('#fcd34d');

  private constructor() {
    this.state = this.computeState(this.hours);
  }

  public static getInstance(): TimeSystem {
    if (!TimeSystem.instance) {
      TimeSystem.instance = new TimeSystem();
    }
    return TimeSystem.instance;
  }

  public update(delta: number): void {
    if (this.isPaused) return;
    this.hours = (this.hours + delta * 0.04 * this.speedMultiplier) % 24;
    if (this.hours < 0) this.hours += 24;
    this.state = this.computeState(this.hours);
    this.notify();
  }

  public setTime(hours: number): void {
    this.hours = ((hours % 24) + 24) % 24;
    this.state = this.computeState(this.hours);
    this.notify();
  }

  public setSpeed(multiplier: number): void {
    this.speedMultiplier = multiplier;
    this.notify();
  }

  public getSpeed(): number {
    return this.speedMultiplier;
  }

  public togglePause(force?: boolean): void {
    this.isPaused = force !== undefined ? force : !this.isPaused;
    this.notify();
  }

  public getIsPaused(): boolean {
    return this.isPaused;
  }

  public getState(): TimeLightingState {
    return this.state;
  }

  private computeState(h: number): TimeLightingState {
    const hrs = Math.floor(h);
    const mins = Math.floor((h - hrs) * 60);
    const timeString = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;

    const sunAngle = ((h - 6) / 24) * Math.PI * 2;
    const sunY = Math.sin(sunAngle);
    const sunX = Math.cos(sunAngle);

    const sunDirection = new THREE.Vector3(sunX * 120, sunY * 140, 45).normalize();
    const moonDirection = sunDirection.clone().negate();

    let phase: DayPhase = 'NIGHT';
    if (h >= 5.0 && h < 8.0) phase = 'SUNRISE';
    else if (h >= 8.0 && h < 17.5) phase = 'DAY';
    else if (h >= 17.5 && h < 20.5) phase = 'SUNSET';

    const nightFactor = THREE.MathUtils.clamp(1.0 - (sunY + 0.2) / 0.65, 0.0, 1.0);
    const isNight = nightFactor > 0.55;
    const starOpacity = THREE.MathUtils.clamp((nightFactor - 0.35) * 1.6, 0.0, 1.0);

    const topCol = new THREE.Color();
    const horCol = new THREE.Color();
    const fogCol = new THREE.Color();
    const sunCol = new THREE.Color();
    const cldCol = new THREE.Color();

    if (h >= 5.0 && h < 8.0) {
      const t = (h - 5.0) / 3.0;
      if (t < 0.5) {
        const k = t * 2;
        topCol.lerpColors(this.cNightTop, this.cDawnTop, k);
        horCol.lerpColors(this.cNightHorizon, this.cDawnHorizon, k);
        fogCol.lerpColors(this.cNightFog, this.cDawnFog, k);
        sunCol.lerpColors(this.cNightSun, this.cDawnSun, k);
        cldCol.lerpColors(this.cNightCloud, this.cDawnCloud, k);
      } else {
        const k = (t - 0.5) * 2;
        topCol.lerpColors(this.cDawnTop, this.cDayTop, k);
        horCol.lerpColors(this.cDawnHorizon, this.cDayHorizon, k);
        fogCol.lerpColors(this.cDawnFog, this.cDayFog, k);
        sunCol.lerpColors(this.cDawnSun, this.cDaySun, k);
        cldCol.lerpColors(this.cDawnCloud, this.cDayCloud, k);
      }
    } else if (h >= 8.0 && h < 17.5) {
      topCol.copy(this.cDayTop);
      horCol.copy(this.cDayHorizon);
      fogCol.copy(this.cDayFog);
      sunCol.copy(this.cDaySun);
      cldCol.copy(this.cDayCloud);
    } else if (h >= 17.5 && h < 20.5) {
      const t = (h - 17.5) / 3.0;
      if (t < 0.5) {
        const k = t * 2;
        topCol.lerpColors(this.cDayTop, this.cDuskTop, k);
        horCol.lerpColors(this.cDayHorizon, this.cDuskHorizon, k);
        fogCol.lerpColors(this.cDayFog, this.cDuskFog, k);
        sunCol.lerpColors(this.cDaySun, this.cDuskSun, k);
        cldCol.lerpColors(this.cDayCloud, this.cDuskCloud, k);
      } else {
        const k = (t - 0.5) * 2;
        topCol.lerpColors(this.cDuskTop, this.cNightTop, k);
        horCol.lerpColors(this.cDuskHorizon, this.cNightHorizon, k);
        fogCol.lerpColors(this.cDuskFog, this.cNightFog, k);
        sunCol.lerpColors(this.cDuskSun, this.cNightSun, k);
        cldCol.lerpColors(this.cDuskCloud, this.cNightCloud, k);
      }
    } else {
      topCol.copy(this.cNightTop);
      horCol.copy(this.cNightHorizon);
      fogCol.copy(this.cNightFog);
      sunCol.copy(this.cNightSun);
      cldCol.copy(this.cNightCloud);
    }

    return {
      hours: h,
      timeString,
      phase,
      sunDirection,
      moonDirection,
      sunIntensity: THREE.MathUtils.lerp(3.4, 0.2, nightFactor),
      moonIntensity: THREE.MathUtils.lerp(0.15, 2.2, nightFactor),
      ambientIntensity: THREE.MathUtils.lerp(1.4, 0.85, nightFactor),
      hemiIntensity: THREE.MathUtils.lerp(1.6, 1.15, nightFactor),
      sunColor: `#${sunCol.getHexString()}`,
      skyTopColor: `#${topCol.getHexString()}`,
      skyHorizonColor: `#${horCol.getHexString()}`,
      fogColor: `#${fogCol.getHexString()}`,
      fogNear: THREE.MathUtils.lerp(160, 120, nightFactor),
      fogFar: THREE.MathUtils.lerp(720, 560, nightFactor),
      isNight,
      nightFactor,
      starOpacity,
      cloudColor: `#${cldCol.getHexString()}`,
    };
  }

  public subscribe(listener: TimeListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((l) => l(this.state));
  }
}
