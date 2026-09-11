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

type TimeChangeListener = (state: TimeLightingState) => void;

export class TimeSystem {
  private static instance: TimeSystem;

  // 17.5 = 17:30 (approaching golden hour by default)
  private currentHour: number = 17.5;
  private timeScale: number = 0.05; // ~1 real second = 3 game minutes
  private isPaused: boolean = false;
  private listeners: Set<TimeChangeListener> = new Set();

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
    this.currentHour = Math.max(0, Math.min(24, hour)) % 24;
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
    let phase: TimeOfDayPhase = 'DAY';
    let isNight = false;
    let nightFactor = 0;

    if (h >= 5.0 && h < 7.0) {
      phase = 'DAWN';
      // Transitions from 1.0 to 0.0
      nightFactor = 1.0 - (h - 5.0) / 2.0;
    } else if (h >= 7.0 && h < 17.5) {
      phase = 'DAY';
      nightFactor = 0.0;
    } else if (h >= 17.5 && h < 19.5) {
      phase = 'SUNSET';
      // Transitions from 0.0 to 0.6
      nightFactor = ((h - 17.5) / 2.0) * 0.6;
    } else if (h >= 19.5 && h < 21.0) {
      phase = 'DUSK';
      // Transitions from 0.6 to 1.0
      nightFactor = 0.6 + ((h - 19.5) / 1.5) * 0.4;
    } else {
      phase = 'NIGHT';
      isNight = true;
      nightFactor = 1.0;
    }

    // Format HH:MM
    const hours = Math.floor(h);
    const minutes = Math.floor((h % 1) * 60);
    const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

    // Celestial Sun / Moon trajectory
    // Sun rises East (+x), reaches zenith at noon (+y), sets West (-x)
    const sunAngle = ((h - 6.0) / 12.0) * Math.PI; // 0 at 06:00, PI at 18:00
    const celestialPos = new THREE.Vector3();

    let celestialColor = '#fff5e6';
    let celestialIntensity = 2.4;
    let skyColor = '#0b1428';
    let fogColor = '#0b1428';
    let hemiSkyColor = '#6085b3';
    let hemiGroundColor = '#141d2d';
    let ambientIntensity = 0.45;

    if (phase === 'DAY') {
      celestialPos.set(Math.cos(sunAngle) * 90, Math.sin(sunAngle) * 140, 45);
      celestialColor = '#fffbf0';
      celestialIntensity = 2.4;
      skyColor = '#0f1d38';
      fogColor = '#0f1d38';
      hemiSkyColor = '#6fa4db';
      hemiGroundColor = '#1e293b';
      ambientIntensity = 0.48;
    } else if (phase === 'SUNSET') {
      celestialPos.set(Math.cos(sunAngle) * 90, Math.sin(sunAngle) * 60, 40);
      celestialColor = '#ff8833'; // Fiery golden sunset
      celestialIntensity = 2.2;
      skyColor = '#1d1222';
      fogColor = '#241424';
      hemiSkyColor = '#a855f7'; // Purple-gold horizon
      hemiGroundColor = '#ff6600'; // Warm ground bounce
      ambientIntensity = 0.42;
    } else if (phase === 'DAWN') {
      celestialPos.set(Math.cos(sunAngle) * 90, Math.sin(sunAngle) * 60, 40);
      celestialColor = '#ffaa66';
      celestialIntensity = 1.8;
      skyColor = '#131b2e';
      fogColor = '#161e32';
      hemiSkyColor = '#f59e0b';
      hemiGroundColor = '#0f172a';
      ambientIntensity = 0.38;
    } else if (phase === 'DUSK') {
      celestialPos.set(-70, 30, -30);
      celestialColor = '#60a5fa';
      celestialIntensity = 1.2;
      skyColor = '#080d1a';
      fogColor = '#080d1a';
      hemiSkyColor = '#1e293b';
      hemiGroundColor = '#0c1322';
      ambientIntensity = 0.3;
    } else {
      // NIGHT
      const moonAngle = ((h - 18.0) / 12.0) * Math.PI;
      celestialPos.set(Math.cos(moonAngle) * 80, Math.sin(moonAngle) * 110, -40);
      celestialColor = '#93c5fd'; // Cool pale moonlight
      celestialIntensity = 0.75;
      skyColor = '#03050c';
      fogColor = '#03050c';
      hemiSkyColor = '#141d30';
      hemiGroundColor = '#070b14';
      ambientIntensity = 0.22;
    }

    return {
      hour: h,
      formattedTime,
      phase,
      isNight: nightFactor > 0.5,
      nightFactor,
      celestialPosition: celestialPos,
      celestialColor,
      celestialIntensity,
      skyColor,
      fogColor,
      hemiSkyColor,
      hemiGroundColor,
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
