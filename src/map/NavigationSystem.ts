import * as THREE from 'three';

export interface Landmark {
  id: string;
  name: string;
  category: 'PLAZA' | 'TOWER' | 'ARCADE' | 'TRANSIT' | 'INFRASTRUCTURE';
  position: THREE.Vector3;
  description: string;
  color: string;
}

export type LandmarkDef = Landmark;

export interface NavigationState {
  activeLandmark: Landmark | null;
  routeWaypoints: THREE.Vector3[];
  distance: number;
  isMapOpen: boolean;
}

type NavListener = (state: NavigationState) => void;

export class NavigationSystem {
  private static instance: NavigationSystem;

  public readonly landmarks: Landmark[] = [
    {
      id: 'central_plaza',
      name: 'Central Plaza Hub',
      category: 'PLAZA',
      position: new THREE.Vector3(0, 0.2, 0),
      description: 'Primary metropolitan civic axis and pedestrian crossroads.',
      color: '#38bdf8',
    },
    {
      id: 'apex_tower',
      name: 'Apex Monolith Tower',
      category: 'TOWER',
      position: new THREE.Vector3(38, 0.2, 38),
      description: '130m titanium-clad corporate spire anchoring the Southeast block.',
      color: '#f59e0b',
    },
    {
      id: 'neon_arcade',
      name: 'Cyber-Synth Lounge',
      category: 'ARCADE',
      position: new THREE.Vector3(-38, 0.2, 38),
      description: 'Southwest cultural concourse and acoustic synthesizer pavilion.',
      color: '#f43f5e',
    },
    {
      id: 'helix_spire',
      name: 'Helix Data Citadel',
      category: 'TOWER',
      position: new THREE.Vector3(-38, 0.2, -38),
      description: 'Northwest quantum telemetry core and atmospheric mast.',
      color: '#10b981',
    },
    {
      id: 'twin_spires',
      name: 'Twin Spire Skybridge',
      category: 'TOWER',
      position: new THREE.Vector3(38, 0.2, -38),
      description: 'Northeast twin architectural towers linked by high-altitude skybridges.',
      color: '#4a8ad6',
    },
    {
      id: 'north_crossway',
      name: 'North Crossing Avenue',
      category: 'TRANSIT',
      position: new THREE.Vector3(0, 0.2, -75),
      description: 'Northern arterial transit gateway and signal gantry.',
      color: '#38bdf8',
    },
    {
      id: 'south_crossway',
      name: 'South Crossing Avenue',
      category: 'TRANSIT',
      position: new THREE.Vector3(0, 0.2, 75),
      description: 'Southern arterial boulevard and autonomous shuttle corridor.',
      color: '#38bdf8',
    },
    {
      id: 'park_sanctuary',
      name: 'Central Park Sanctuary',
      category: 'PLAZA',
      position: new THREE.Vector3(75, 0.2, 75),
      description: 'Tranquil hydrological basin, arched footbridge, and botanical reserve.',
      color: '#10b981',
    },
  ];

  private activeLandmark: Landmark | null = null;
  private routeWaypoints: THREE.Vector3[] = [];
  private distance = 0;
  private isMapOpen = false;
  private lastPlayerPos = new THREE.Vector3(0, 0.2, 10);
  private listeners = new Set<NavListener>();

  private constructor() {}

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

    const found = this.landmarks.find((l) => l.id === landmarkId) || null;
    this.activeLandmark = found;
    if (playerPos) this.lastPlayerPos.copy(playerPos);

    if (found) {
      this.distance = Math.round(this.lastPlayerPos.distanceTo(found.position));
      this.recomputeRoute(this.lastPlayerPos, found.position);
    }
    this.notify();
  }

  public setMapOpen(open: boolean): void {
    if (this.isMapOpen === open) return;
    this.isMapOpen = open;
    this.notify();
  }

  public toggleMap(force?: boolean): void {
    this.isMapOpen = force !== undefined ? force : !this.isMapOpen;
    this.notify();
  }

  public updatePlayerPosition(playerPos: THREE.Vector3): void {
    this.lastPlayerPos.copy(playerPos);
    if (!this.activeLandmark) return;

    const dist = playerPos.distanceTo(this.activeLandmark.position);
    if (dist < 4.5) {
      this.activeLandmark = null;
      this.routeWaypoints = [];
      this.distance = 0;
      this.notify();
      return;
    }

    if (Math.abs(dist - this.distance) > 0.8) {
      this.distance = Math.round(dist);
      this.recomputeRoute(playerPos, this.activeLandmark.position);
      this.notify();
    }
  }

  private recomputeRoute(start: THREE.Vector3, end: THREE.Vector3): void {
    const pts: THREE.Vector3[] = [new THREE.Vector3(start.x, 0.15, start.z)];
    if (Math.abs(start.x - end.x) > 8 && Math.abs(start.z - end.z) > 8) {
      if (Math.abs(start.x) < Math.abs(start.z)) {
        pts.push(new THREE.Vector3(0, 0.15, start.z));
        pts.push(new THREE.Vector3(0, 0.15, end.z));
      } else {
        pts.push(new THREE.Vector3(start.x, 0.15, 0));
        pts.push(new THREE.Vector3(end.x, 0.15, 0));
      }
    }
    pts.push(new THREE.Vector3(end.x, 0.15, end.z));
    this.routeWaypoints = pts;
  }

  public getState(): NavigationState {
    return {
      activeLandmark: this.activeLandmark,
      routeWaypoints: this.routeWaypoints,
      distance: this.distance,
      isMapOpen: this.isMapOpen,
    };
  }

  public subscribe(listener: NavListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const state = this.getState();
    this.listeners.forEach((l) => l(state));
  }
}
