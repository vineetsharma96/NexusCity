import * as THREE from 'three';

export type WeatherType = 'CLEAR' | 'RAIN' | 'HEAVY_RAIN' | 'FOG';

export interface WeatherState {
  currentWeather: WeatherType;
  rainIntensity: number;
  wetnessFactor: number;
  fogDensityMultiplier: number;
  windVector: THREE.Vector3;
  lightningFlash: number;
  autoCycle: boolean;
}

type WeatherListener = (state: WeatherState) => void;

export class WeatherSystem {
  private static instance: WeatherSystem;
  private state: WeatherState = {
    currentWeather: 'CLEAR',
    rainIntensity: 0.0,
    wetnessFactor: 0.15,
    fogDensityMultiplier: 1.0,
    windVector: new THREE.Vector3(2.2, -18.0, 1.4),
    lightningFlash: 0.0,
    autoCycle: true,
  };

  private targetRain = 0.0;
  private targetWetness = 0.15;
  private targetFogMult = 1.0;
  private cycleTimer = 0;
  private readonly weatherSequence: WeatherType[] = ['CLEAR', 'RAIN', 'HEAVY_RAIN', 'FOG', 'CLEAR'];
  private seqIndex = 0;
  private listeners = new Set<WeatherListener>();

  private constructor() {}

  public static getInstance(): WeatherSystem {
    if (!WeatherSystem.instance) {
      WeatherSystem.instance = new WeatherSystem();
    }
    return WeatherSystem.instance;
  }

  public setWeather(type: WeatherType, keepAutoCycle: boolean = false): void {
    this.state.currentWeather = type;
    this.state.autoCycle = keepAutoCycle;
    const idx = this.weatherSequence.indexOf(type);
    if (idx !== -1) this.seqIndex = idx;

    switch (type) {
      case 'CLEAR':
        this.targetRain = 0.0;
        this.targetWetness = 0.12;
        this.targetFogMult = 1.0;
        this.state.windVector.set(1.5, -16.0, 0.8);
        break;
      case 'RAIN':
        this.targetRain = 0.55;
        this.targetWetness = 0.78;
        this.targetFogMult = 1.6;
        this.state.windVector.set(3.2, -22.0, 1.8);
        break;
      case 'HEAVY_RAIN':
        this.targetRain = 1.0;
        this.targetWetness = 1.0;
        this.targetFogMult = 2.4;
        this.state.windVector.set(5.8, -28.0, 3.2);
        break;
      case 'FOG':
        this.targetRain = 0.08;
        this.targetWetness = 0.55;
        this.targetFogMult = 3.5;
        this.state.windVector.set(0.8, -14.0, 0.5);
        break;
    }
    this.notify();
  }

  public setAutoCycle(enabled: boolean): void {
    this.state.autoCycle = enabled;
    this.notify();
  }

  public update(delta: number): void {
    if (this.state.autoCycle) {
      this.cycleTimer += delta;
      if (this.cycleTimer > 85) {
        this.cycleTimer = 0;
        this.seqIndex = (this.seqIndex + 1) % this.weatherSequence.length;
        this.setWeather(this.weatherSequence[this.seqIndex], true);
      }
    }

    let changed = false;
    const lerpSpeed = delta * 0.45;

    if (Math.abs(this.state.rainIntensity - this.targetRain) > 0.005) {
      this.state.rainIntensity = THREE.MathUtils.lerp(this.state.rainIntensity, this.targetRain, lerpSpeed);
      changed = true;
    } else {
      this.state.rainIntensity = this.targetRain;
    }

    if (Math.abs(this.state.wetnessFactor - this.targetWetness) > 0.005) {
      this.state.wetnessFactor = THREE.MathUtils.lerp(this.state.wetnessFactor, this.targetWetness, delta * 0.25);
      changed = true;
    } else {
      this.state.wetnessFactor = this.targetWetness;
    }

    if (Math.abs(this.state.fogDensityMultiplier - this.targetFogMult) > 0.005) {
      this.state.fogDensityMultiplier = THREE.MathUtils.lerp(this.state.fogDensityMultiplier, this.targetFogMult, lerpSpeed);
      changed = true;
    } else {
      this.state.fogDensityMultiplier = this.targetFogMult;
    }

    if (this.state.currentWeather === 'HEAVY_RAIN') {
      if (this.state.lightningFlash > 0.01) {
        this.state.lightningFlash = Math.max(0, this.state.lightningFlash - delta * 4.5);
        changed = true;
      } else if (Math.random() < delta * 0.14) {
        this.state.lightningFlash = 0.8 + Math.random() * 0.6;
        changed = true;
      }
    } else if (this.state.lightningFlash > 0) {
      this.state.lightningFlash = 0;
      changed = true;
    }

    if (changed) this.notify();
  }

  public getState(): WeatherState {
    return this.state;
  }

  public subscribe(listener: WeatherListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((l) => l(this.state));
  }
}
