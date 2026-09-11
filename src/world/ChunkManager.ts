import * as THREE from 'three';
import { DistrictGenerator, DistrictInfo } from '../city/DistrictGenerator';

export type ChunkLOD = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNLOADED';

export interface ChunkInfo {
  key: string;
  cx: number;
  cz: number;
  center: THREE.Vector3;
  district: DistrictInfo;
  lod: ChunkLOD;
  distanceToPlayer: number;
}

export interface ChunkManagerState {
  chunks: ChunkInfo[];
  activeDistrict: DistrictInfo;
  discoveredDistricts: Set<string>;
  recentDiscovery: DistrictInfo | null;
}

type ChunkChangeListener = (state: ChunkManagerState) => void;

export class ChunkManager {
  private static instance: ChunkManager;

  public static readonly CHUNK_SIZE = 120; // meters
  public static readonly GRID_RADIUS = 4;  // -4 .. 3 (8x8 grid = 960m x 960m)

  private chunks: Map<string, ChunkInfo> = new Map();
  private activeDistrict: DistrictInfo = DistrictGenerator.getDistrictAt(0, 0);
  private discoveredDistricts: Set<string> = new Set(['CENTRAL_CITY']);
  private recentDiscovery: DistrictInfo | null = null;
  private listeners: Set<ChunkChangeListener> = new Set();

  constructor() {
    this.initGrid();
  }

  public static getInstance(): ChunkManager {
    if (!ChunkManager.instance) {
      ChunkManager.instance = new ChunkManager();
    }
    return ChunkManager.instance;
  }

  private initGrid(): void {
    const size = ChunkManager.CHUNK_SIZE;
    const r = ChunkManager.GRID_RADIUS;

    for (let cx = -r; cx < r; cx++) {
      for (let cz = -r; cz < r; cz++) {
        const key = `${cx}_${cz}`;
        const centerX = (cx + 0.5) * size;
        const centerZ = (cz + 0.5) * size;
        const center = new THREE.Vector3(centerX, 0, centerZ);
        const district = DistrictGenerator.getDistrictAt(centerX, centerZ);

        this.chunks.set(key, {
          key,
          cx,
          cz,
          center,
          district,
          lod: 'UNLOADED',
          distanceToPlayer: Infinity,
        });
      }
    }
  }

  public updatePlayerPosition(playerPos: THREE.Vector3): void {
    // 1. Resolve Active District at player position
    const currentDistrict = DistrictGenerator.getDistrictAt(playerPos.x, playerPos.z);
    if (currentDistrict.type !== this.activeDistrict.type) {
      this.activeDistrict = currentDistrict;
      if (!this.discoveredDistricts.has(currentDistrict.type)) {
        this.discoveredDistricts.add(currentDistrict.type);
        this.recentDiscovery = currentDistrict;
        // Auto-clear discovery banner after 4.5 seconds
        setTimeout(() => {
          if (this.recentDiscovery?.type === currentDistrict.type) {
            this.recentDiscovery = null;
            this.notify();
          }
        }, 4500);
      }
    }

    // 2. Evaluate Distance & LOD for Each Chunk
    this.chunks.forEach((chunk) => {
      const dist = playerPos.distanceTo(chunk.center);
      chunk.distanceToPlayer = dist;

      if (dist < 140) {
        chunk.lod = 'HIGH';
      } else if (dist < 280) {
        chunk.lod = 'MEDIUM';
      } else if (dist < 650) {
        chunk.lod = 'LOW';
      } else {
        chunk.lod = 'UNLOADED';
      }
    });

    this.notify();
  }

  public getState(): ChunkManagerState {
    return {
      chunks: Array.from(this.chunks.values()),
      activeDistrict: this.activeDistrict,
      discoveredDistricts: this.discoveredDistricts,
      recentDiscovery: this.recentDiscovery,
    };
  }

  public subscribe(listener: ChunkChangeListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const state = this.getState();
    this.listeners.forEach((l) => l(state));
  }
}
