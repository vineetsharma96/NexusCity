import * as THREE from 'three';
import {
  InteriorDestination,
  INTERIOR_DESTINATIONS,
  validateInteriorDestination,
  getDestinationByInteriorType,
} from './InteriorDestinations';
import { AudioManager } from '../audio/AudioManager';

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

import { SaveSystem } from '../core/SaveSystem';

export interface InteriorState {
  current: InteriorType;
  currentDestinationId: string | null;
  activeDestination: InteriorDestination | null;
  destinationId?: string | null;
  destination?: InteriorDestination | null;
  name?: string;
  isTransitioning: boolean;
  currentFloor: number; // 1 = Main Floor, 2 = Mezzanine / Sky Observation
  lastError?: string | null;
  errorMessage?: string | null;
}

type InteriorChangeListener = (state: InteriorState) => void;

export class InteriorManager {
  private static instance: InteriorManager;

  public currentInterior: InteriorType = 'NONE';
  public currentDestinationId: string | null = null;
  public activeDestination: InteriorDestination | null = null;
  public currentFloor: number = 1; // 1 = Main Floor, 2 = Upper Mezzanine / Sky Deck
  public savedExteriorPos: THREE.Vector3 = new THREE.Vector3(0, 0.2, 10);
  public isTransitioning: boolean = false;
  private listeners: Set<InteriorChangeListener> = new Set();
  private lastError: string | null = null;

  // Interior room base offset coordinate (y = -80m)
  public static readonly INTERIOR_ORIGIN = new THREE.Vector3(0, -80, 0);

  public static getInstance(): InteriorManager {
    if (!InteriorManager.instance) {
      InteriorManager.instance = new InteriorManager();
    }
    return InteriorManager.instance;
  }

  /**
   * Enters an interior using a validated InteriorDestination.
   */
  public enterDestination(
    destinationId: string,
    playerPos: THREE.Vector3,
    onTeleport: (newPos: THREE.Vector3) => void
  ): boolean {
    if (this.isTransitioning) return false;

    // 1. Validate destination registration
    const validation = validateInteriorDestination(destinationId);
    if (!validation.valid || !validation.destination) {
      console.error(`[InteriorManager] Teleportation assertion failed: ${validation.error}`);
      this.handleFailedEntry(validation.error || 'Destination validation failed', playerPos);
      return false;
    }

    const dest = validation.destination;

    // 2. Validate interior exists
    if (!dest.interiorId || dest.interiorId === 'NONE') {
      const err = `[InteriorManager] Invalid interiorId '${dest.interiorId}' for destination '${destinationId}'.`;
      console.error(err);
      this.handleFailedEntry(err, playerPos);
      return false;
    }

    // 3. Validate spawn point coordinates
    if (!dest.interiorSpawnPoint || isNaN(dest.interiorSpawnPoint.y)) {
      const err = `[InteriorManager] Invalid interiorSpawnPoint for destination '${destinationId}'.`;
      console.error(err);
      this.handleFailedEntry(err, playerPos);
      return false;
    }

    // 4. Assert chunk exists
    if (!dest.interiorChunkId) {
      const err = `[InteriorManager] Missing interiorChunkId for destination '${destinationId}'.`;
      console.error(err);
      this.handleFailedEntry(err, playerPos);
      return false;
    }

    this.isTransitioning = true;
    this.lastError = null;
    AudioManager.getInstance().duck(1.5, 0.2);

    // Save exterior return point (using destination's specified exitPosition if available)
    if (dest.exitPosition) {
      this.savedExteriorPos.copy(dest.exitPosition);
    } else {
      this.savedExteriorPos.copy(playerPos);
    }

    this.notify();

    // Smooth transition into interior room
    setTimeout(() => {
      this.currentInterior = dest.interiorId;
      this.currentDestinationId = destinationId;
      this.activeDestination = dest;
      this.currentFloor = 1;

      SaveSystem.getInstance().updateInterior(dest.interiorId, 1);

      const spawnPoint = dest.interiorSpawnPoint.clone();
      onTeleport(spawnPoint);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('nexus:teleport', { detail: spawnPoint }));
      }

      setTimeout(() => {
        this.isTransitioning = false;
        this.notify();
      }, 250);
    }, 350);

    return true;
  }

  /**
   * Compatibility method to enter via InteriorType. Resolves to matching registered destination.
   */
  public enter(
    type: InteriorType,
    playerPos: THREE.Vector3,
    onTeleport: (newPos: THREE.Vector3) => void
  ): boolean {
    const dest = getDestinationByInteriorType(type);
    if (dest) {
      // Find matching destination key
      for (const [destId, d] of Object.entries(INTERIOR_DESTINATIONS)) {
        if (d.interiorId === dest.interiorId) {
          return this.enterDestination(destId, playerPos, onTeleport);
        }
      }
    }

    console.warn(`[InteriorManager] No registered destination found for interior type '${type}'. Using fallback.`);
    return this.enterDestination('nexus_labs', playerPos, onTeleport);
  }

  /**
   * Handles failure cleanly without silently dropping player at (0, 0, 0).
   */
  private handleFailedEntry(errorMessage: string, previousValidPos: THREE.Vector3): void {
    this.lastError = errorMessage;
    this.isTransitioning = false;
    this.notify();

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('nexus:notification', {
          detail: {
            title: 'ACCESS RESTRICTED',
            message: 'Interior temporarily unavailable. Position preserved.',
            type: 'warning',
          },
        })
      );
    }
  }

  /**
   * Exits current interior and restores player to exterior exit position.
   */
  public exit(onTeleport: (newPos: THREE.Vector3) => void): void {
    if (this.isTransitioning || this.currentInterior === 'NONE') return;

    this.isTransitioning = true;
    AudioManager.getInstance().duck(1.5, 0.2);
    this.notify();

    setTimeout(() => {
      this.currentInterior = 'NONE';
      this.currentDestinationId = null;
      this.currentFloor = 1;
      const exitPos = this.activeDestination?.exitPosition?.clone() || this.savedExteriorPos.clone();
      this.activeDestination = null;

      SaveSystem.getInstance().updateInterior('NONE', 1);

      onTeleport(exitPos);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('nexus:teleport', { detail: exitPos }));
      }

      setTimeout(() => {
        this.isTransitioning = false;
        this.notify();
      }, 250);
    }, 350);
  }

  /**
   * Switches elevator floors (Level 1 <-> Level 2 Mezzanine) inside an interior.
   */
  public changeFloor(
    targetFloor: number,
    onTeleport?: (newPos: THREE.Vector3) => void
  ): boolean {
    if (this.isTransitioning || this.currentInterior === 'NONE' || this.currentFloor === targetFloor) {
      return false;
    }

    this.isTransitioning = true;
    AudioManager.getInstance().playElevatorMove();
    AudioManager.getInstance().duck(1.8, 0.3);
    this.notify();

    setTimeout(() => {
      this.currentFloor = targetFloor;
      SaveSystem.getInstance().incrementElevator();
      SaveSystem.getInstance().updateInterior(this.currentInterior, targetFloor);

      // Elevator arrival position
      const elevatorSpawn =
        targetFloor === 2
          ? InteriorManager.INTERIOR_ORIGIN.clone().add(new THREE.Vector3(7.5, 0.15, 5.5))
          : InteriorManager.INTERIOR_ORIGIN.clone().add(new THREE.Vector3(7.5, 0.15, 5.5));

      if (onTeleport) {
        onTeleport(elevatorSpawn);
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('nexus:teleport', { detail: elevatorSpawn }));
      }

      setTimeout(() => {
        this.isTransitioning = false;
        this.notify();
      }, 250);
    }, 450);

    return true;
  }

  public getState(): InteriorState {
    const dest = this.activeDestination;
    const floorLabel = this.currentFloor === 2 ? 'MEZZANINE / SKY-DECK' : 'MAIN FLOOR';
    const name = dest
      ? `${dest.name.toUpperCase()} [LVL ${this.currentFloor}: ${floorLabel}]`
      : 'DISTRICT 1: CENTRAL METROPOLIS';

    return {
      current: this.currentInterior,
      currentDestinationId: this.currentDestinationId,
      activeDestination: this.activeDestination,
      destinationId: this.currentDestinationId,
      destination: this.activeDestination,
      name,
      currentFloor: this.currentFloor,
      isTransitioning: this.isTransitioning,
      lastError: this.lastError,
      errorMessage: this.lastError,
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

