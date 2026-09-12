import * as THREE from 'three';
import { WeatherSystem, WeatherState } from './WeatherSystem';

export interface WindState {
  vector: THREE.Vector3; // Current wind velocity (m/s)
  speed: number;
  direction: number; // Radian angle in XZ plane
  gustFactor: number; // 1.0 (calm) to 2.5 (strong gust)
  turbulence: THREE.Vector3;
}

type WindListener = (state: WindState) => void;

export class WindSystem {
  private static instance: WindSystem;

  private baseDirection: number = Math.PI * 0.35; // Prevailing wind angle (~63 deg)
  private currentDirection: number = Math.PI * 0.35;
  private baseSpeed: number = 6.5; // Base m/s
  private currentSpeed: number = 6.5;

  private gustTimer: number = 0;
  private gustDuration: number = 0;
  private nextGustTime: number = 4.0;
  private isGusting: boolean = false;
  private gustFactor: number = 1.0;

  private windVector: THREE.Vector3 = new THREE.Vector3();
  private turbulenceVector: THREE.Vector3 = new THREE.Vector3();

  private listeners: Set<WindListener> = new Set();
  private weatherState: WeatherState;

  private constructor() {
    this.weatherState = WeatherSystem.getInstance().getState();
    WeatherSystem.getInstance().subscribe((w) => {
      this.weatherState = w;
    });
    this.updateWindVectors(0);
  }

  public static getInstance(): WindSystem {
    if (!WindSystem.instance) {
      WindSystem.instance = new WindSystem();
    }
    return WindSystem.instance;
  }

  public update(delta: number): void {
    // 1. Scale base wind with weather
    let weatherSpeedMultiplier = 1.0;
    if (this.weatherState.currentWeather === 'HEAVY_RAIN') {
      weatherSpeedMultiplier = 2.4;
    } else if (this.weatherState.currentWeather === 'RAIN') {
      weatherSpeedMultiplier = 1.6;
    } else if (this.weatherState.currentWeather === 'CLOUDY') {
      weatherSpeedMultiplier = 1.2;
    } else if (this.weatherState.currentWeather === 'FOG') {
      weatherSpeedMultiplier = 0.5;
    }

    // 2. Random gust cycle
    this.gustTimer += delta;
    if (!this.isGusting && this.gustTimer >= this.nextGustTime) {
      this.isGusting = true;
      this.gustTimer = 0;
      this.gustDuration = 2.5 + Math.random() * 3.5;
      this.nextGustTime = 5.0 + Math.random() * 9.0;
    }

    if (this.isGusting) {
      this.gustDuration -= delta;
      if (this.gustDuration <= 0) {
        this.isGusting = false;
        this.gustFactor = 1.0;
      } else {
        // Bell-curve gust profile
        const peak = Math.sin((this.gustDuration / 4.0) * Math.PI);
        this.gustFactor = 1.0 + Math.max(0, peak) * (1.2 * weatherSpeedMultiplier);
      }
    } else {
      this.gustFactor = THREE.MathUtils.lerp(this.gustFactor, 1.0, delta * 2.0);
    }

    // 3. Subtle slow directional meandering
    const timeSec = performance.now() * 0.0003;
    const directionOffset = Math.sin(timeSec * 0.8) * 0.35 + Math.cos(timeSec * 0.3) * 0.2;
    this.currentDirection = this.baseDirection + directionOffset;

    // 4. Target speed with gusts
    const targetSpeed = this.baseSpeed * weatherSpeedMultiplier * this.gustFactor;
    this.currentSpeed = THREE.MathUtils.lerp(this.currentSpeed, targetSpeed, delta * 3.0);

    // 5. Compute vectors
    this.updateWindVectors(delta);
    this.notify();
  }

  private updateWindVectors(_delta: number): void {
    const t = performance.now() * 0.0015;
    const cosD = Math.cos(this.currentDirection);
    const sinD = Math.sin(this.currentDirection);

    // High frequency micro turbulence
    this.turbulenceVector.set(
      Math.sin(t * 3.2) * 1.5 + Math.cos(t * 7.1) * 0.8,
      Math.sin(t * 4.5) * 0.8 + Math.cos(t * 2.1) * 0.5,
      Math.cos(t * 3.7) * 1.5 + Math.sin(t * 6.3) * 0.8
    );

    this.windVector.set(
      cosD * this.currentSpeed + this.turbulenceVector.x,
      this.turbulenceVector.y,
      sinD * this.currentSpeed + this.turbulenceVector.z
    );
  }

  public getVector(): THREE.Vector3 {
    return this.windVector;
  }

  public getSpeed(): number {
    return this.currentSpeed;
  }

  public getGustFactor(): number {
    return this.gustFactor;
  }

  public getTurbulence(): THREE.Vector3 {
    return this.turbulenceVector;
  }

  public getState(): WindState {
    return {
      vector: this.windVector.clone(),
      speed: this.currentSpeed,
      direction: this.currentDirection,
      gustFactor: this.gustFactor,
      turbulence: this.turbulenceVector.clone(),
    };
  }

  public subscribe(listener: WindListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const state = this.getState();
    this.listeners.forEach((l) => l(state));
  }
}
