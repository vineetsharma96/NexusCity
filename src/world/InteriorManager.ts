import * as THREE from 'three';
import {
  InteriorDestination,
  INTERIOR_DESTINATIONS,
  validateInteriorDestination,
  getDestinationByInteriorType,
} from './InteriorDestinations';
import { AudioManager } from '../audio/AudioManager';
import { NavigationSystem } from '../map/NavigationSystem';

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

export type WorldMode =
  | 'WORLD_ACTIVE'
  | 'INTERIOR_TRANSITION_IN'
  | 'INTERIOR_ACTIVE'
  | 'INTERIOR_TRANSITION_OUT';

import { SaveSystem } from '../core/SaveSystem';

export interface InteriorState {
  current: InteriorType;
  currentDestinationId: string | null;
  activeDestination: InteriorDestination | null;
  destinationId?: string | null;
  destination?: InteriorDestination | null;
  name?: string;
  worldMode: WorldMode;
  isWorldActive: boolean;
  isTransitioning: boolean;
  currentFloor: number; // 1 = Main Floor, 2 = Mezzanine / Sky Observation
  lastError?: string | null;
  errorMessage?: string | null;
}

type InteriorChangeListener = (state: InteriorState) => void;

export class InteriorManager {
  private static instance: InteriorManager;

  public worldMode: WorldMode = 'WORLD_ACTIVE';
  public currentInterior: InteriorType = 'NONE';
  public currentDestinationId: string | null = null;
  public activeDestination: InteriorDestination | null = null;
  public currentFloor: number = 1; // 1 = Main Floor, 2 = Upper Mezzanine / Sky Deck
  public savedExteriorBuildingId: string | null = null;
  public savedExteriorPos: THREE.Vector3 = new THREE.Vector3(0, 0.2, 10);
  public savedExteriorRotY: number = 0;
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

    this.worldMode = 'INTERIOR_TRANSITION_IN';
    this.isTransitioning = true;
    this.lastError = null;
    this.savedExteriorBuildingId = dest.buildingId || destinationId;
    this.currentInterior = dest.interiorId;
    this.currentDestinationId = destinationId;
    this.activeDestination = dest;
    this.currentFloor = 1;
    AudioManager.getInstance().duck(1.5, 0.2);

    // Save exterior return point (using destination's specified exitPosition if available)
    if (dest.exitPosition) {
      this.savedExteriorPos.copy(dest.exitPosition);
    } else {
      this.savedExteriorPos.copy(playerPos);
    }

    // Force-close city map modal if open
    NavigationSystem.getInstance().setMapOpen(false);

    // Trigger visual fade transition and minimap hide
    this.notify();

    // Step 2: Under cover of fade, activate interior scene and teleport player
    setTimeout(() => {
      this.worldMode = 'INTERIOR_ACTIVE';

      SaveSystem.getInstance().updateInterior(dest.interiorId, 1);
      AudioManager.getInstance().setInteriorMode(true);

      const spawnPoint = dest.interiorSpawnPoint.clone();
      onTeleport(spawnPoint);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('nexus:teleport', { detail: spawnPoint }));
      }

      // Immediately notify to mount interiorRoot and lights
      this.notify();

      // Step 3: Fade in smoothly
      setTimeout(() => {
        this.isTransitioning = false;
        this.notify();
      }, 200);
    }, 300);

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
    this.worldMode = 'WORLD_ACTIVE';
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
  public exit(onTeleport?: (newPos: THREE.Vector3) => void): void {
    if (this.isTransitioning || this.currentInterior === 'NONE') return;

    this.worldMode = 'INTERIOR_TRANSITION_OUT';
    this.isTransitioning = true;
    AudioManager.getInstance().duck(1.5, 0.2);
    this.notify();

    // Step 2: Under cover of fade, restore exterior and teleport player
    setTimeout(() => {
      this.currentInterior = 'NONE';
      this.currentDestinationId = null;
      this.currentFloor = 1;
      this.worldMode = 'WORLD_ACTIVE';
      const exitPos = this.activeDestination?.exitPosition?.clone() || this.savedExteriorPos.clone();
      this.activeDestination = null;

      SaveSystem.getInstance().updateInterior('NONE', 1);
      AudioManager.getInstance().setInteriorMode(false);

      if (onTeleport) {
        onTeleport(exitPos);
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('nexus:teleport', { detail: exitPos }));
      }

      // Immediately notify to unmount interior and mount worldRoot
      this.notify();

      // Step 3: Fade in smoothly to restored exterior world
      setTimeout(() => {
        this.isTransitioning = false;
        this.notify();
      }, 200);
    }, 300);
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
    AudioManager.getInstance().duck(1.2, 0.3);
    AudioManager.getInstance().playElevatorMove();
    this.notify();

    setTimeout(() => {
      this.currentFloor = targetFloor;
      SaveSystem.getInstance().updateInterior(this.currentInterior, targetFloor);
      AudioManager.getInstance().playElevatorDing();

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
    const isWorldActive = this.worldMode === 'WORLD_ACTIVE';

    return {
      current: this.currentInterior,
      currentDestinationId: this.currentDestinationId,
      activeDestination: this.activeDestination,
      destinationId: this.currentDestinationId,
      destination: this.activeDestination,
      name,
      worldMode: this.worldMode,
      isWorldActive,
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

