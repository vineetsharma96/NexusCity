import * as THREE from 'three';

export type WeatherType = 'CLEAR' | 'RAIN' | 'HEAVY_RAIN' | 'SNOW' | 'BLIZZARD' | 'FOG';

export interface WeatherState {
  currentWeather: WeatherType;
  rainIntensity: number;
  snowIntensity: number;
  precipitationIntensity: number;
  precipitationRateMmHr: number;
  temperatureC: number;
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
    snowIntensity: 0.0,
    precipitationIntensity: 0.0,
    precipitationRateMmHr: 0.0,
    temperatureC: 16.0,
    wetnessFactor: 0.15,
    fogDensityMultiplier: 1.0,
    windVector: new THREE.Vector3(2.2, -18.0, 1.4),
    lightningFlash: 0.0,
    autoCycle: true,
  };

  private targetRain = 0.0;
  private targetSnow = 0.0;
  private targetTempC = 16.0;
  private targetWetness = 0.15;
  private targetFogMult = 1.0;
  private cycleTimer = 0;
  private readonly weatherSequence: WeatherType[] = [
    'CLEAR',
    'RAIN',
    'HEAVY_RAIN',
    'FOG',
    'SNOW',
    'BLIZZARD',
    'CLEAR',
  ];
  private seqIndex = 0;
  private listeners = new Set<WeatherListener>();

  private constructor() {}

  public static getInstance(): WeatherSystem {
    if (!WeatherSystem.instance) {
      WeatherSystem.instance = new WeatherSystem();
    }
    return WeatherSystem.instance;
  }

  private syncDerivedTelemetry(): void {
    const rain = THREE.MathUtils.clamp(this.state.rainIntensity, 0, 1);
    const snow = THREE.MathUtils.clamp(this.state.snowIntensity, 0, 1);
    this.state.precipitationIntensity = Math.max(rain, snow);
    this.state.precipitationRateMmHr = Math.round((rain * 48 + snow * 26) * 10) / 10;
  }

  public setWeather(type: WeatherType, keepAutoCycle: boolean = false): void {
    this.state.currentWeather = type;
    this.state.autoCycle = keepAutoCycle;
    const idx = this.weatherSequence.indexOf(type);
    if (idx !== -1) this.seqIndex = idx;

    switch (type) {
      case 'CLEAR':
        this.targetRain = 0.0;
        this.targetSnow = 0.0;
        this.targetTempC = 18.0;
        this.targetWetness = 0.12;
        this.targetFogMult = 1.0;
        this.state.windVector.set(1.5, -16.0, 0.8);
        break;
      case 'RAIN':
        this.targetRain = 0.55;
        this.targetSnow = 0.0;
        this.targetTempC = 11.5;
        this.targetWetness = 0.78;
        this.targetFogMult = 1.85;
        this.state.windVector.set(3.2, -22.0, 1.8);
        break;
      case 'HEAVY_RAIN':
        this.targetRain = 1.0;
        this.targetSnow = 0.0;
        this.targetTempC = 8.5;
        this.targetWetness = 1.0;
        this.targetFogMult = 2.8;
        this.state.windVector.set(5.8, -28.0, 3.2);
        break;
      case 'SNOW':
        this.targetRain = 0.0;
        this.targetSnow = 0.62;
        this.targetTempC = -2.5;
        this.targetWetness = 0.65;
        this.targetFogMult = 2.15;
        this.state.windVector.set(1.8, -5.2, 1.2);
        break;
      case 'BLIZZARD':
        this.targetRain = 0.0;
        this.targetSnow = 1.0;
        this.targetTempC = -9.0;
        this.targetWetness = 0.92;
        this.targetFogMult = 3.85;
        this.state.windVector.set(5.4, -8.5, 3.4);
        break;
      case 'FOG':
        this.targetRain = 0.06;
        this.targetSnow = 0.0;
        this.targetTempC = 9.0;
        this.targetWetness = 0.58;
        this.targetFogMult = 6.2;
        this.state.windVector.set(1.2, -14.0, 0.7);
        break;
    }

    // When manually triggered by user, immediately apply a strong step toward the target weather
    // so changing to FOG, RAIN, or SNOW is instantaneously visible without waiting 10 seconds.
    if (!keepAutoCycle) {
      this.state.rainIntensity = THREE.MathUtils.lerp(this.state.rainIntensity, this.targetRain, 0.85);
      this.state.snowIntensity = THREE.MathUtils.lerp(this.state.snowIntensity, this.targetSnow, 0.85);
      this.state.temperatureC = this.targetTempC;
      this.state.wetnessFactor = THREE.MathUtils.lerp(this.state.wetnessFactor, this.targetWetness, 0.85);
      this.state.fogDensityMultiplier = THREE.MathUtils.lerp(
        this.state.fogDensityMultiplier,
        this.targetFogMult,
        0.92
      );
    }

    this.syncDerivedTelemetry();
    this.notify();
  }

  /**
   * Directly adjusts precipitation intensity (0..1) and synchronizes the active weather state
   * in the city's telemetry.
   */
  public setPrecipitationIntensity(intensity: number, mode?: 'RAIN' | 'SNOW'): void {
    const clamped = THREE.MathUtils.clamp(intensity, 0, 1);
    this.state.autoCycle = false;

    const useSnow =
      mode === 'SNOW' ||
      (mode === undefined &&
        (this.state.currentWeather === 'SNOW' ||
          this.state.currentWeather === 'BLIZZARD' ||
          this.state.snowIntensity > this.state.rainIntensity));

    if (clamped <= 0.01) {
      this.targetRain = 0;
      this.targetSnow = 0;
      this.state.rainIntensity = 0;
      this.state.snowIntensity = 0;
      if (this.state.currentWeather !== 'FOG') {
        this.state.currentWeather = 'CLEAR';
        this.targetTempC = 17.0;
        this.targetFogMult = 1.0;
      }
    } else if (useSnow) {
      this.targetRain = 0;
      this.state.rainIntensity = 0;
      this.targetSnow = clamped;
      this.state.snowIntensity = clamped;
      this.state.currentWeather = clamped >= 0.78 ? 'BLIZZARD' : 'SNOW';
      this.targetTempC = clamped >= 0.78 ? -8.5 : -2.5;
      this.state.temperatureC = this.targetTempC;
      this.targetWetness = Math.max(0.45, clamped * 0.9);
      this.state.wetnessFactor = this.targetWetness;
      this.targetFogMult = 1.3 + clamped * 2.4;
      this.state.windVector.set(1.5 + clamped * 4.2, -(4.2 + clamped * 4.5), 1.0 + clamped * 2.4);
    } else {
      this.targetSnow = 0;
      this.state.snowIntensity = 0;
      this.targetRain = clamped;
      this.state.rainIntensity = clamped;
      this.state.currentWeather = clamped >= 0.78 ? 'HEAVY_RAIN' : 'RAIN';
      this.targetTempC = clamped >= 0.78 ? 8.5 : 11.5;
      this.state.temperatureC = this.targetTempC;
      this.targetWetness = Math.max(0.5, clamped);
      this.state.wetnessFactor = this.targetWetness;
      this.targetFogMult = 1.2 + clamped * 1.6;
      this.state.windVector.set(2.0 + clamped * 3.8, -(18.0 + clamped * 10.0), 1.2 + clamped * 2.0);
    }

    this.syncDerivedTelemetry();
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
    const lerpSpeed = Math.min(1, delta * 1.6);

    if (Math.abs(this.state.rainIntensity - this.targetRain) > 0.005) {
      this.state.rainIntensity = THREE.MathUtils.lerp(this.state.rainIntensity, this.targetRain, lerpSpeed);
      changed = true;
    } else if (this.state.rainIntensity !== this.targetRain) {
      this.state.rainIntensity = this.targetRain;
      changed = true;
    }

    if (Math.abs(this.state.snowIntensity - this.targetSnow) > 0.005) {
      this.state.snowIntensity = THREE.MathUtils.lerp(this.state.snowIntensity, this.targetSnow, lerpSpeed);
      changed = true;
    } else if (this.state.snowIntensity !== this.targetSnow) {
      this.state.snowIntensity = this.targetSnow;
      changed = true;
    }

    if (Math.abs(this.state.temperatureC - this.targetTempC) > 0.02) {
      this.state.temperatureC = THREE.MathUtils.lerp(this.state.temperatureC, this.targetTempC, lerpSpeed);
      changed = true;
    } else if (this.state.temperatureC !== this.targetTempC) {
      this.state.temperatureC = this.targetTempC;
      changed = true;
    }

    if (Math.abs(this.state.wetnessFactor - this.targetWetness) > 0.005) {
      this.state.wetnessFactor = THREE.MathUtils.lerp(this.state.wetnessFactor, this.targetWetness, delta * 0.8);
      changed = true;
    } else if (this.state.wetnessFactor !== this.targetWetness) {
      this.state.wetnessFactor = this.targetWetness;
      changed = true;
    }

    if (Math.abs(this.state.fogDensityMultiplier - this.targetFogMult) > 0.005) {
      this.state.fogDensityMultiplier = THREE.MathUtils.lerp(
        this.state.fogDensityMultiplier,
        this.targetFogMult,
        lerpSpeed
      );
      changed = true;
    } else if (this.state.fogDensityMultiplier !== this.targetFogMult) {
      this.state.fogDensityMultiplier = this.targetFogMult;
      changed = true;
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

    if (changed) {
      this.syncDerivedTelemetry();
      this.notify();
    }
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
