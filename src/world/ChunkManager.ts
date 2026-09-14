import * as THREE from 'three';
import { DistrictGenerator, DistrictInfo } from '../city/DistrictGenerator';
import { QualityManager } from '../rendering/QualityManager';

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
  discoveredChunks: Set<string>;
  exploredPercent: number;
  recentDiscovery: DistrictInfo | null;
}

type ChunkChangeListener = (state: ChunkManagerState) => void;

export class ChunkManager {
  private static instance: ChunkManager;

  public static readonly CHUNK_SIZE = 120; // meters
  public static readonly GRID_RADIUS = 12; // -12 .. 11 (24x24 grid = 2880m x 2880m, roughly 3km wide)

  private chunks: Map<string, ChunkInfo> = new Map();
  private activeDistrict: DistrictInfo = DistrictGenerator.getDistrictAt(0, 0);
  private discoveredDistricts: Set<string> = new Set(['CENTRAL_CITY']);
  private discoveredChunks: Set<string> = new Set();
  private recentDiscovery: DistrictInfo | null = null;
  private listeners: Set<ChunkChangeListener> = new Set();

  constructor() {
    this.loadExploredChunks();
    this.initGrid();
  }

  private loadExploredChunks(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem('nexus_city_explored_chunks_v1');
        if (saved) {
          const arr = JSON.parse(saved);
          if (Array.isArray(arr)) {
            arr.forEach((k: string) => this.discoveredChunks.add(k));
          }
        }
      }
    } catch (e) {}

    // Ensure core 3x3 plaza chunks are always explored
    for (let cx = -1; cx <= 1; cx++) {
      for (let cz = -1; cz <= 1; cz++) {
        this.discoveredChunks.add(`${cx}_${cz}`);
      }
    }
  }

  private saveTimer: any = null;
  private saveExploredChunks(): void {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(
            'nexus_city_explored_chunks_v1',
            JSON.stringify(Array.from(this.discoveredChunks))
          );
        }
      } catch (e) {}
    }, 1200);
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

  private lastCheckedPos: THREE.Vector3 = new THREE.Vector3(999999, 0, 999999);

  public updatePlayerPosition(playerPos: THREE.Vector3): void {
    // 1. Resolve Active District at player position
    let stateChanged = false;
    const currentDistrict = DistrictGenerator.getDistrictAt(playerPos.x, playerPos.z);
    if (currentDistrict.type !== this.activeDistrict.type) {
      this.activeDistrict = currentDistrict;
      stateChanged = true;
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

    // Throttle distance & LOD recalculation to when player moves at least 4m
    if (playerPos.distanceToSquared(this.lastCheckedPos) < 16 && !stateChanged) {
      return;
    }
    this.lastCheckedPos.copy(playerPos);

    // 2. Evaluate Distance, Discovery & LOD for Each Chunk using active Quality Preset
    const quality = QualityManager.current;
    const maxDrawDist = quality.drawDistance || 1200;
    const highCutoff = quality.LODQuality === 'HIGH' ? 220 : quality.LODQuality === 'MEDIUM' ? 165 : 120;
    const medCutoff = quality.LODQuality === 'HIGH' ? 440 : quality.LODQuality === 'MEDIUM' ? 330 : 240;
    const lowCutoff = Math.min(maxDrawDist, quality.LODQuality === 'HIGH' ? 1800 : quality.LODQuality === 'MEDIUM' ? 1100 : 650);

    this.chunks.forEach((chunk) => {
      const dist = playerPos.distanceTo(chunk.center);
      chunk.distanceToPlayer = dist;

      // Mark chunk as explored when player approaches within 260m
      if (dist < 260 && !this.discoveredChunks.has(chunk.key)) {
        this.discoveredChunks.add(chunk.key);
        stateChanged = true;
        this.saveExploredChunks();
      }

      let newLod: ChunkLOD = 'UNLOADED';
      if (dist < highCutoff) {
        newLod = 'HIGH';
      } else if (dist < medCutoff) {
        newLod = 'MEDIUM';
      } else if (dist < lowCutoff) {
        newLod = 'LOW';
      } else {
        newLod = 'UNLOADED';
      }

      if (chunk.lod !== newLod) {
        chunk.lod = newLod;
        stateChanged = true;
      }
    });

    if (stateChanged) {
      this.notify();
    }
  }

  public getActiveChunks(): ChunkInfo[] {
    return Array.from(this.chunks.values()).filter((c) => c.lod !== 'UNLOADED');
  }

  public isChunkExplored(cx: number, cz: number): boolean {
    return this.discoveredChunks.has(`${cx}_${cz}`);
  }

  public getExploredPercent(): number {
    const totalChunks = (ChunkManager.GRID_RADIUS * 2) * (ChunkManager.GRID_RADIUS * 2);
    return parseFloat(((this.discoveredChunks.size / totalChunks) * 100).toFixed(1));
  }

  public getState(): ChunkManagerState {
    return {
      chunks: Array.from(this.chunks.values()),
      activeDistrict: this.activeDistrict,
      discoveredDistricts: this.discoveredDistricts,
      discoveredChunks: this.discoveredChunks,
      exploredPercent: this.getExploredPercent(),
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
