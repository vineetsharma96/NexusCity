import * as THREE from 'three';

import { INTERIOR_DESTINATIONS } from '../world/InteriorDestinations';

export interface LandmarkDef {
  id: string;
  name: string;
  category: 'PLAZA' | 'LAB' | 'LOUNGE' | 'TOWER' | 'CROSSWAY' | 'INTERIOR' | 'SANCTUARY' | 'TRANSIT';
  position: THREE.Vector3;
  description: string;
  isEnterable?: boolean;
}

export interface NavigationState {
  activeLandmark: LandmarkDef | null;
  distance: number;
  routeWaypoints: THREE.Vector3[];
  isMapOpen: boolean;
}

type NavigationChangeListener = (state: NavigationState) => void;

export class NavigationSystem {
  private static instance: NavigationSystem;

  public readonly landmarks: LandmarkDef[] = [
    {
      id: 'central_plaza',
      name: 'Central Plaza Hub',
      category: 'PLAZA',
      position: new THREE.Vector3(0, 0.2, 0),
      description: 'The monumental core public square and holographic nexus of District 1.',
    },
    {
      id: 'twin_spires',
      name: 'Twin Spire Skybridge',
      category: 'TOWER',
      position: new THREE.Vector3(40, 0.2, -40),
      description: 'Twin commercial spires linked by an elevated skybridge at 60m altitude.',
    },
    {
      id: 'apex_tower',
      name: 'Apex Monolith Tower',
      category: 'TOWER',
      position: new THREE.Vector3(35, 0.2, 35),
      description: 'The tallest corporate skyscraper in the central district with panoramic spires.',
    },
    {
      id: 'north_crossway',
      name: 'North Crossing Avenue',
      category: 'CROSSWAY',
      position: new THREE.Vector3(0, 0.2, -75),
      description: 'Arterial North-South boulevard intersection connecting to outer districts.',
    },
    {
      id: 'south_crossway',
      name: 'South Crossing Avenue',
      category: 'CROSSWAY',
      position: new THREE.Vector3(0, 0.2, 75),
      description: 'Commercial crossing connecting avenue sidewalks to residential sectors.',
    },
    // Dynamically include all 11 registered enterable interior destinations
    ...Object.entries(INTERIOR_DESTINATIONS).map(([id, dest]) => ({
      id,
      name: dest.name,
      category: (dest.interiorId === 'LAB' ? 'LAB' : dest.interiorId === 'LOUNGE' ? 'LOUNGE' : 'INTERIOR') as LandmarkDef['category'],
      position: dest.entrancePosition.clone(),
      description: dest.description,
      isEnterable: true,
    })),
  ];

  private activeLandmark: LandmarkDef | null = null;
  private routeWaypoints: THREE.Vector3[] = [];
  private distance: number = 0;
  private isMapOpen: boolean = false;
  private listeners: Set<NavigationChangeListener> = new Set();

  public static getInstance(): NavigationSystem {
    if (!NavigationSystem.instance) {
      NavigationSystem.instance = new NavigationSystem();
    }
    return NavigationSystem.instance;
  }

  public setDestination(landmarkId: string | null, playerPos?: THREE.Vector3): void {
    if (!landmarkId) {
      this.activeLandmark = null;
      this.routeWaypoints = [];
      this.distance = 0;
      this.notify();
      return;
    }

    const target = this.landmarks.find((l) => l.id === landmarkId);
    if (target) {
      this.activeLandmark = target;
      if (playerPos) {
        this.calculateRoute(playerPos);
      }
      this.notify();
    }
  }

  public updatePlayerPosition(playerPos: THREE.Vector3): void {
    if (!this.activeLandmark) return;

    this.distance = Math.round(playerPos.distanceTo(this.activeLandmark.position));

    // Recalculate street route when player moves
    this.calculateRoute(playerPos);
    this.notify();
  }

  /**
   * Street-grid Manhattan pathfinder following the central avenue and cross streets.
   */
  private calculateRoute(playerPos: THREE.Vector3): void {
    if (!this.activeLandmark) return;

    const start = playerPos.clone();
    const target = this.activeLandmark.position.clone();
    const waypoints: THREE.Vector3[] = [start];

    // Check closest east-west cross street: z = -75, z = 0, z = 75
    const crossStreetsZ = [-75, 0, 75];
    let closestCrossZ = 0;
    let minDistZ = Infinity;

    for (const z of crossStreetsZ) {
      const d = Math.abs(start.z - z) + Math.abs(target.z - z);
      if (d < minDistZ) {
        minDistZ = d;
        closestCrossZ = z;
      }
    }

    // Step 1: Move from current position to Main Central Avenue (x=0) or cross street
    if (Math.abs(start.x) > 2.0) {
      // Move to cross street junction
      waypoints.push(new THREE.Vector3(start.x, 0.08, closestCrossZ));
      waypoints.push(new THREE.Vector3(0, 0.08, closestCrossZ));
    } else {
      waypoints.push(new THREE.Vector3(0, 0.08, start.z));
    }

    // Step 2: Traverse Central Avenue to target's cross street
    let targetCrossZ = 0;
    let minTargetZ = Infinity;
    for (const z of crossStreetsZ) {
      const d = Math.abs(target.z - z);
      if (d < minTargetZ) {
        minTargetZ = d;
        targetCrossZ = z;
      }
    }

    waypoints.push(new THREE.Vector3(0, 0.08, targetCrossZ));

    // Step 3: Turn from Central Avenue towards target along cross street
    waypoints.push(new THREE.Vector3(target.x, 0.08, targetCrossZ));

    // Step 4: Final approach to destination
    waypoints.push(new THREE.Vector3(target.x, 0.08, target.z));

    this.routeWaypoints = waypoints;
  }

  public toggleMap(): boolean {
    this.isMapOpen = !this.isMapOpen;
    this.notify();
    return this.isMapOpen;
  }

  public setMapOpen(open: boolean): void {
    this.isMapOpen = open;
    this.notify();
  }

  public getState(): NavigationState {
    return {
      activeLandmark: this.activeLandmark,
      distance: this.distance,
      routeWaypoints: this.routeWaypoints,
      isMapOpen: this.isMapOpen,
    };
  }

  public subscribe(listener: NavigationChangeListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const state = this.getState();
    this.listeners.forEach((l) => l(state));
  }
}
