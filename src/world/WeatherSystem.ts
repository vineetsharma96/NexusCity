import * as THREE from 'three';

export type WeatherType = 'CLEAR' | 'CLOUDY' | 'RAIN' | 'HEAVY_RAIN' | 'FOG';

export interface WeatherState {
  currentWeather: WeatherType;
  targetWeather: WeatherType;
  rainIntensity: number; // 0.0 to 1.0
  wetnessFactor: number; // 0.0 to 1.0 (smooth buildup and drying)
  fogDensityMultiplier: number; // 1.0 (clear) to 4.0 (dense fog)
  fogColorTint: string;
  skyDarkness: number; // 0.0 (normal) to 0.7 (stormy overcast)
  windVector: THREE.Vector3; // Current wind drift velocity for particles
  isLightningActive: boolean;
  lightningIntensity: number; // 0.0 to 1.0 spike during strikes
}

type WeatherListener = (state: WeatherState) => void;

export class WeatherSystem {
  private static instance: WeatherSystem;

  private currentWeather: WeatherType = 'CLEAR';
  private targetWeather: WeatherType = 'CLEAR';

  // Smoothly interpolated atmospheric variables
  private rainIntensity: number = 0.0;
  private wetnessFactor: number = 0.0;
  private fogDensityMultiplier: number = 1.0;
  private skyDarkness: number = 0.0;
  private windVector: THREE.Vector3 = new THREE.Vector3(-4, -32, 2);

  // Lightning system for HEAVY_RAIN / STORM
  private lightningTimer: number = 0;
  private nextLightningTime: number = 10;
  private isLightningActive: boolean = false;
  private lightningIntensity: number = 0.0;
  private lightningFlashDuration: number = 0;

  // Auto weather cycle timer
  private autoCycleTimer: number = 0;
  private autoCycleEnabled: boolean = false;
  private weatherCycleOrder: WeatherType[] = ['CLEAR', 'CLOUDY', 'RAIN', 'HEAVY_RAIN', 'FOG'];
  private currentCycleIndex: number = 0;

  private listeners: Set<WeatherListener> = new Set();

  private constructor() {
    this.resetLightningTimer();
  }

  public static getInstance(): WeatherSystem {
    if (!WeatherSystem.instance) {
      WeatherSystem.instance = new WeatherSystem();
    }
    return WeatherSystem.instance;
  }

  public setWeather(weather: WeatherType, autoCycle: boolean = false): void {
    this.targetWeather = weather;
    this.currentWeather = weather;
    this.autoCycleEnabled = autoCycle;
    if (weather === 'HEAVY_RAIN') {
      this.resetLightningTimer();
    }
    this.notify();
  }

  public toggleAutoCycle(): boolean {
    this.autoCycleEnabled = !this.autoCycleEnabled;
    return this.autoCycleEnabled;
  }

  public isAutoCycle(): boolean {
    return this.autoCycleEnabled;
  }

  private resetLightningTimer(): void {
    this.lightningTimer = 0;
    this.nextLightningTime = 5 + Math.random() * 8; // lightning every 5–13s in storm
  }

  public update(delta: number): void {
    // 1. Auto weather cycle if enabled (changes every 90 seconds)
    if (this.autoCycleEnabled) {
      this.autoCycleTimer += delta;
      if (this.autoCycleTimer >= 90) {
        this.autoCycleTimer = 0;
        this.currentCycleIndex = (this.currentCycleIndex + 1) % this.weatherCycleOrder.length;
        this.setWeather(this.weatherCycleOrder[this.currentCycleIndex], true);
      }
    }

    // 2. Compute target values based on weather type
    let targetRain = 0;
    let targetWetness = 0;
    let targetFog = 1.0;
    let targetDarkness = 0.0;
    const targetWind = new THREE.Vector3(-3, -30, 2);

    switch (this.targetWeather) {
      case 'CLEAR':
        targetRain = 0.0;
        targetWetness = 0.0;
        targetFog = 1.0;
        targetDarkness = 0.0;
        targetWind.set(-2, -30, 1);
        break;
      case 'CLOUDY':
        targetRain = 0.0;
        targetWetness = 0.05;
        targetFog = 1.3;
        targetDarkness = 0.28;
        targetWind.set(-5, -28, 3);
        break;
      case 'RAIN':
        targetRain = 0.65;
        targetWetness = 0.85;
        targetFog = 1.85;
        targetDarkness = 0.45;
        targetWind.set(-9, -32, 4);
        break;
      case 'HEAVY_RAIN':
        targetRain = 1.0;
        targetWetness = 1.0;
        targetFog = 2.5;
        targetDarkness = 0.65;
        targetWind.set(-18, -38, 9); // Strong storm wind
        break;
      case 'FOG':
        targetRain = 0.0;
        targetWetness = 0.35; // Wet dewy atmosphere
        targetFog = 4.2; // Very dense cyber fog
        targetDarkness = 0.35;
        targetWind.set(-1, -20, 1);
        break;
    }

    // 3. Smooth interpolation (lerp)
    const lerpRate = Math.min(1.0, delta * 1.5);
    // Dynamic drying hysteresis: wet up quickly during rainfall, evaporate gradually over 45-60s post-rain
    const wetnessLerpRate = Math.min(1.0, delta * (targetWetness > this.wetnessFactor ? 0.6 : 0.05));

    this.rainIntensity = THREE.MathUtils.lerp(this.rainIntensity, targetRain, lerpRate);
    this.wetnessFactor = THREE.MathUtils.lerp(this.wetnessFactor, targetWetness, wetnessLerpRate);
    this.fogDensityMultiplier = THREE.MathUtils.lerp(this.fogDensityMultiplier, targetFog, lerpRate);
    this.skyDarkness = THREE.MathUtils.lerp(this.skyDarkness, targetDarkness, lerpRate);
    this.windVector.lerp(targetWind, lerpRate);

    // 4. Lightning simulation for HEAVY_RAIN
    if (this.targetWeather === 'HEAVY_RAIN') {
      this.lightningTimer += delta;
      if (this.lightningTimer >= this.nextLightningTime) {
        this.isLightningActive = true;
        this.lightningFlashDuration = 0.28; // 280ms double-pulse flash
        this.resetLightningTimer();
      }

      if (this.isLightningActive) {
        this.lightningFlashDuration -= delta;
        if (this.lightningFlashDuration > 0) {
          // Double-pulse strobe profile
          const t = 1.0 - this.lightningFlashDuration / 0.28;
          const strobe = Math.sin(t * Math.PI * 3);
          this.lightningIntensity = Math.max(0, strobe);
        } else {
          this.isLightningActive = false;
          this.lightningIntensity = 0.0;
        }
      }
    } else {
      this.isLightningActive = false;
      this.lightningIntensity = 0.0;
    }

    this.notify();
  }

  public getState(): WeatherState {
    let fogColor = '#0b1428';
    if (this.targetWeather === 'FOG') {
      fogColor = '#102236'; // Cool cyan-tinted cyber smog
    } else if (this.targetWeather === 'HEAVY_RAIN' || this.targetWeather === 'RAIN') {
      fogColor = '#090d18'; // Dark atmospheric stormy navy
    }

    return {
      currentWeather: this.currentWeather,
      targetWeather: this.targetWeather,
      rainIntensity: this.rainIntensity,
      wetnessFactor: this.wetnessFactor,
      fogDensityMultiplier: this.fogDensityMultiplier,
      fogColorTint: fogColor,
      skyDarkness: this.skyDarkness,
      windVector: this.windVector,
      isLightningActive: this.isLightningActive,
      lightningIntensity: this.lightningIntensity,
    };
  }

  public subscribe(listener: WeatherListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const state = this.getState();
    this.listeners.forEach((l) => l(state));
  }
}
