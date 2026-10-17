import * as THREE from 'three';
import { DistrictGenerator, DistrictInfo, DistrictType } from '../city/DistrictGenerator';
import { QualityManager } from '../rendering/QualityManager';
import { SaveSystem } from '../core/SaveSystem';

export type ChunkLOD = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNLOADED';

export interface ChunkInfo {
  key: string;
  cx: number;
  cz: number;
  center: THREE.Vector3;
  lod: ChunkLOD;
  district: DistrictInfo;
  distanceToPlayer: number;
}

export interface ChunkManagerState {
  currentDistrict: DistrictInfo;
  activeChunkCount: number;
  highLodCount: number;
  mediumLodCount: number;
  lowLodCount: number;
  chunks: ChunkInfo[];
  recentDiscovery: DistrictInfo | null;
  discoveredChunks: Set<string>;
  exploredPercent: number;
}

type ChunkListener = (state: ChunkManagerState) => void;

function cloneChunk(chunk: ChunkInfo): ChunkInfo {
  return { ...chunk, center: chunk.center.clone() };
}

export class ChunkManager {
  private static instance: ChunkManager;
  public static readonly GRID_RADIUS = 12;
  public readonly CHUNK_SIZE = 120;
  public readonly GRID_RADIUS = 12;

  private chunks = new Map<string, ChunkInfo>();
  private currentDistrict: DistrictInfo;
  private discoveredDistricts = new Set<DistrictType>(['CENTRAL_CITY']);
  private discoveredChunks = new Set<string>(['0_0', '0_-1', '-1_0', '-1_-1']);
  private recentDiscovery: DistrictInfo | null;
  private discoveryTime = 0;

  private lastPlayerChunkX = -999;
  private lastPlayerChunkZ = -999;
  private lastQualitySignature = '';
  private listeners = new Set<ChunkListener>();

  constructor() {
    this.currentDistrict = DistrictGenerator.getDistrictAt(0, 0);
    this.recentDiscovery = null;
    const saved = SaveSystem.getInstance().getData().discoveredDistricts;
    if (Array.isArray(saved)) {
      saved.forEach((d) => this.discoveredDistricts.add(d as DistrictType));
    }
    this.initGrid();
  }

  public static getInstance(): ChunkManager {
    if (!ChunkManager.instance) {
      ChunkManager.instance = new ChunkManager();
    }
    return ChunkManager.instance;
  }

  private initGrid(): void {
    for (let cx = -this.GRID_RADIUS; cx < this.GRID_RADIUS; cx++) {
      for (let cz = -this.GRID_RADIUS; cz < this.GRID_RADIUS; cz++) {
        const key = `${cx}_${cz}`;
        const centerX = (cx + 0.5) * this.CHUNK_SIZE;
        const centerZ = (cz + 0.5) * this.CHUNK_SIZE;
        const center = new THREE.Vector3(centerX, 0, centerZ);
        const district = DistrictGenerator.getDistrictAt(centerX, centerZ);
        const dist = Math.hypot(centerX, centerZ);

        this.chunks.set(key, {
          key,
          cx,
          cz,
          center,
          lod: dist < 190 ? 'HIGH' : dist < 380 ? 'MEDIUM' : dist < 650 ? 'LOW' : 'UNLOADED',
          district,
          distanceToPlayer: dist,
        });
      }
    }
  }

  public isChunkExplored(cx: number, cz: number): boolean {
    return this.discoveredChunks.has(`${cx}_${cz}`);
  }

  public updatePlayerPosition(playerPos: THREE.Vector3, elapsedSeconds: number = 0): void {
    const cx = Math.floor(playerPos.x / this.CHUNK_SIZE);
    const cz = Math.floor(playerPos.z / this.CHUNK_SIZE);
    let changed = false;

    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const rKey = `${cx + dx}_${cz + dz}`;
        if (this.chunks.has(rKey) && !this.discoveredChunks.has(rKey)) {
          this.discoveredChunks.add(rKey);
          changed = true;
        }
      }
    }

    if (this.recentDiscovery && elapsedSeconds - this.discoveryTime > 4.5) {
      this.recentDiscovery = null;
      changed = true;
    }

    const districtNow = DistrictGenerator.getDistrictAt(playerPos.x, playerPos.z);
    if (districtNow.type !== this.currentDistrict.type) {
      this.currentDistrict = districtNow;
      changed = true;
      const isNewSave = SaveSystem.getInstance().updateDistrict(districtNow.type);
      if (!this.discoveredDistricts.has(districtNow.type) || isNewSave) {
        this.discoveredDistricts.add(districtNow.type);
        this.recentDiscovery = districtNow;
        this.discoveryTime = elapsedSeconds;
      }
    }

    const quality = QualityManager.current;
    const maxBudget = Math.max(0, Math.floor(quality.maxActiveChunks || 75));
    const qualitySig = `${quality.name}:${quality.LODQuality}:${quality.drawDistance}:${maxBudget}`;

    if (cx !== this.lastPlayerChunkX || cz !== this.lastPlayerChunkZ || qualitySig !== this.lastQualitySignature) {
      this.lastPlayerChunkX = cx;
      this.lastPlayerChunkZ = cz;
      this.lastQualitySignature = qualitySig;
      changed = true;

      const isUltra = quality.name === 'ULTRA' || quality.drawDistance >= 950;
      const lodScale =
        quality.LODQuality === 'LOW'
          ? 0.65
          : quality.LODQuality === 'MEDIUM'
          ? 0.85
          : isUltra
          ? 1.45
          : 1.0;
      const highLimit = 185 * lodScale;
      const medLimit = 380 * lodScale;
      const lowLimit = Math.min(quality.drawDistance * 1.15, (isUltra ? 960 : 780) * lodScale);
      const candidates: ChunkInfo[] = [];

      for (const chunk of this.chunks.values()) {
        const dist = Math.hypot(chunk.center.x - playerPos.x, chunk.center.z - playerPos.z);
        chunk.distanceToPlayer = dist;
        if (dist <= highLimit) {
          chunk.lod = 'HIGH';
          candidates.push(chunk);
        } else if (dist <= medLimit) {
          chunk.lod = 'MEDIUM';
          candidates.push(chunk);
        } else if (dist <= lowLimit) {
          chunk.lod = 'LOW';
          candidates.push(chunk);
        } else {
          chunk.lod = 'UNLOADED';
        }
      }

      if (candidates.length > maxBudget) {
        candidates.sort((a, b) => a.distanceToPlayer - b.distanceToPlayer);
        for (let i = maxBudget; i < candidates.length; i++) {
          candidates[i].lod = 'UNLOADED';
        }
      }
    }

    if (changed) this.notify();
  }

  public getState(): ChunkManagerState {
    let activeChunkCount = 0;
    let highLodCount = 0;
    let mediumLodCount = 0;
    let lowLodCount = 0;
    const list: ChunkInfo[] = [];

    for (const c of this.chunks.values()) {
      list.push(cloneChunk(c));
      if (c.lod !== 'UNLOADED') {
        activeChunkCount++;
        if (c.lod === 'HIGH') highLodCount++;
        else if (c.lod === 'MEDIUM') mediumLodCount++;
        else if (c.lod === 'LOW') lowLodCount++;
      }
    }

    const total = Math.max(1, this.chunks.size);
    const exploredPercent = Math.min(100, Math.round((this.discoveredChunks.size / total) * 100));

    return {
      currentDistrict: this.currentDistrict,
      activeChunkCount,
      highLodCount,
      mediumLodCount,
      lowLodCount,
      chunks: list,
      recentDiscovery: this.recentDiscovery,
      discoveredChunks: new Set(this.discoveredChunks),
      exploredPercent,
    };
  }

  public getActiveChunks(): ChunkInfo[] {
    const active: ChunkInfo[] = [];
    for (const c of this.chunks.values()) {
      if (c.lod !== 'UNLOADED') active.push(cloneChunk(c));
    }
    return active;
  }

  public subscribe(listener: ChunkListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const state = this.getState();
    this.listeners.forEach((l) => l(state));
  }
}
