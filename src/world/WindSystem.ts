import * as THREE from 'three';

export interface WindState {
  direction: THREE.Vector3;
  speed: number;
  gustStrength: number;
  turbulence: number;
  angle: number;
}

export class WindSystem {
  private static instance: WindSystem;
  private time = 0;
  private baseAngle = 0.65;
  private currentAngle = 0.65;
  private currentSpeed = 6.5;
  private gustStrength = 1.0;
  private direction = new THREE.Vector3(Math.cos(0.65), 0, Math.sin(0.65));
  private velocityVec = new THREE.Vector3();

  private constructor() {}

  public static getInstance(): WindSystem {
    if (!WindSystem.instance) {
      WindSystem.instance = new WindSystem();
    }
    return WindSystem.instance;
  }

  public update(delta: number, weatherIntensity: number = 0): void {
    this.time += delta;
    const angleDrift = Math.sin(this.time * 0.08) * 0.45 + Math.cos(this.time * 0.03) * 0.25;
    this.currentAngle = this.baseAngle + angleDrift;
    this.direction.set(Math.cos(this.currentAngle), 0, Math.sin(this.currentAngle)).normalize();

    const wave1 = Math.sin(this.time * 0.7) * 0.5 + 0.5;
    const wave2 = Math.sin(this.time * 1.9 + 1.3) * 0.5 + 0.5;
    const gustPulse = Math.pow(wave1 * wave2, 1.5);

    this.gustStrength = 0.8 + gustPulse * 1.4 + weatherIntensity * 0.9;
    const baseSpeed = 5.5 + weatherIntensity * 9.0;
    this.currentSpeed = baseSpeed * this.gustStrength;

    this.velocityVec.copy(this.direction).multiplyScalar(this.currentSpeed);
    this.velocityVec.y = Math.sin(this.time * 2.3) * (0.4 + gustPulse * 1.2);
  }

  public getVector(): THREE.Vector3 {
    return this.velocityVec;
  }

  public getDirection(): THREE.Vector3 {
    return this.direction;
  }

  public getSpeed(): number {
    return this.currentSpeed;
  }

  public getGustFactor(): number {
    return this.gustStrength;
  }

  public getState(): WindState {
    return {
      direction: this.direction,
      speed: this.currentSpeed,
      gustStrength: this.gustStrength,
      turbulence: 0.35 * this.gustStrength,
      angle: this.currentAngle,
    };
  }
}
