import * as THREE from 'three';
import { KinematicCollisionSolver } from '../player/KinematicCollision';

export type InteriorType =
  | 'NONE'
  | 'LAB'
  | 'LOUNGE'
  | 'CLINIC'
  | 'NETRUNNER_DEN'
  | 'RAMEN_DINER'
  | 'DRONE_HANGAR'
  | 'PENTHOUSE'
  | 'SERVER_VAULT'
  | 'GREENHOUSE'
  | 'METRO_STATION'
  | 'ARCADE';

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
    switch (this.currentInterior) {
      case 'LAB':
        name = 'NEXUS ADVANCED LABS // LEVEL 1';
        break;
      case 'LOUNGE':
        name = 'NEON VELOCITY // CYBER LOUNGE';
        break;
      case 'CLINIC':
        name = 'KROM-DOC // AUGMENTATION CLINIC';
        break;
      case 'NETRUNNER_DEN':
        name = 'BLACK-ICE // NETRUNNER SAFEHOUSE';
        break;
      case 'RAMEN_DINER':
        name = 'TOKYO-NEO // SYNTH-RAMEN NOODLES';
        break;
      case 'DRONE_HANGAR':
        name = 'AERO-CARGO // DRONE REPAIR BAY';
        break;
      case 'PENTHOUSE':
        name = 'APEX TOWER // SKY OBSERVATION SUITE';
        break;
      case 'SERVER_VAULT':
        name = 'MEGACORP // SECURE DATA CORES';
        break;
      case 'GREENHOUSE':
        name = 'BIOSPHERE // HYDROPONIC LAB';
        break;
      case 'METRO_STATION':
        name = 'HYPERLOOP // METRO TRANSIT HUB';
        break;
      case 'ARCADE':
        name = 'CYBER-STRIKE // 2099 RETRO ARCADE';
        break;
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
