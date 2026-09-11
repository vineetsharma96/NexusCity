import * as THREE from 'three';
import { KinematicCollisionSolver } from '../player/KinematicCollision';

export type InteriorType = 'NONE' | 'LAB' | 'LOUNGE';

export interface InteriorState {
  current: InteriorType;
  name: string;
  isTransitioning: boolean;
}

type InteriorChangeListener = (state: InteriorState) => void;

export class InteriorManager {
  private static instance: InteriorManager;

  public currentInterior: InteriorType = 'NONE';
  public savedExteriorPos: THREE.Vector3 = new THREE.Vector3(0, 0.2, 10);
  public isTransitioning: boolean = false;
  private listeners: Set<InteriorChangeListener> = new Set();

  // Interior world offset coordinate
  public static readonly INTERIOR_ORIGIN = new THREE.Vector3(0, -80, 0);

  public static getInstance(): InteriorManager {
    if (!InteriorManager.instance) {
      InteriorManager.instance = new InteriorManager();
    }
    return InteriorManager.instance;
  }

  public enter(type: InteriorType, playerPos: THREE.Vector3, onTeleport: (newPos: THREE.Vector3) => void): void {
    if (this.isTransitioning || type === 'NONE') return;

    this.isTransitioning = true;
    this.savedExteriorPos.copy(playerPos);
    this.notify();

    // Brief fade transition
    setTimeout(() => {
      this.currentInterior = type;
      // Spawn player inside room near entrance door
      const interiorSpawn = InteriorManager.INTERIOR_ORIGIN.clone().add(new THREE.Vector3(0, 0.15, 8.5));
      onTeleport(interiorSpawn);

      setTimeout(() => {
        this.isTransitioning = false;
        this.notify();
      }, 300);
    }, 400);
  }

  public exit(onTeleport: (newPos: THREE.Vector3) => void): void {
    if (this.isTransitioning || this.currentInterior === 'NONE') return;

    this.isTransitioning = true;
    this.notify();

    setTimeout(() => {
      this.currentInterior = 'NONE';
      // Restore player back to exterior sidewalk in front of entrance door
      const exitPos = this.savedExteriorPos.clone();
      onTeleport(exitPos);

      setTimeout(() => {
        this.isTransitioning = false;
        this.notify();
      }, 300);
    }, 400);
  }

  public getState(): InteriorState {
    let name = 'DISTRICT 1: CENTRAL METROPOLIS';
    if (this.currentInterior === 'LAB') {
      name = 'NEXUS ADVANCED LABS // LEVEL 1';
    } else if (this.currentInterior === 'LOUNGE') {
      name = 'NEON VELOCITY // CYBER LOUNGE';
    }

    return {
      current: this.currentInterior,
      name,
      isTransitioning: this.isTransitioning,
    };
  }

  public subscribe(listener: InteriorChangeListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const state = this.getState();
    this.listeners.forEach((l) => l(state));
  }
}
