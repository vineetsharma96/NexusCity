import * as THREE from 'three';
import { QualityPreset } from '../rendering/QualityManager';
import { WeatherType } from '../world/WeatherSystem';

export interface SavedPlayerState {
  position: [number, number, number];
  rotationY: number;
  currentDistrict: string;
  interiorId: string;
  floor: number;
}

export interface DiscoveredEntity {
  id: string;
  name: string;
  category: 'DISTRICT' | 'LANDMARK' | 'INTERIOR';
  discoveredAt: number; // timestamp
}

export interface OperativeStats {
  distanceTraveledMeters: number;
  interiorsEnteredCount: number;
  dialoguesCompletedCount: number;
  elevatorsRiddenCount: number;
  fastTravelsCount: number;
  timesSavedCount: number;
  firstPlayedTimestamp: number;
  lastPlayedTimestamp: number;
}

export interface NexusSaveData {
  version: number;
  player: SavedPlayerState;
  discoveredDistricts: string[];
  discoveredLandmarks: Record<string, DiscoveredEntity>;
  stats: OperativeStats;
  weatherPreference?: WeatherType;
  timePreferenceHour?: number;
  qualityPreset?: QualityPreset;
  audioMuted?: boolean;
  audioVolume?: number;
}

const STORAGE_KEY = 'nexus_city_flagship_save_v2';

type SaveListener = (data: NexusSaveData) => void;

export class SaveSystem {
  private static instance: SaveSystem;
  private data: NexusSaveData;
  private listeners: Set<SaveListener> = new Set();
  private autoSaveTimer: any = null;
  private lastPosition: THREE.Vector3 = new THREE.Vector3(0, 0, 10);

  private constructor() {
    this.data = this.getDefaultData();
    this.load();
  }

  public static getInstance(): SaveSystem {
    if (!SaveSystem.instance) {
      SaveSystem.instance = new SaveSystem();
    }
    return SaveSystem.instance;
  }

  private getDefaultData(): NexusSaveData {
    const now = Date.now();
    return {
      version: 2,
      player: {
        position: [0, 0.2, 10],
        rotationY: 0,
        currentDistrict: 'CENTRAL_PLAZA',
        interiorId: 'NONE',
        floor: 1,
      },
      discoveredDistricts: ['CENTRAL_PLAZA'],
      discoveredLandmarks: {
        central_plaza: {
          id: 'central_plaza',
          name: 'Central Plaza Hub',
          category: 'LANDMARK',
          discoveredAt: now,
        },
      },
      stats: {
        distanceTraveledMeters: 0,
        interiorsEnteredCount: 0,
        dialoguesCompletedCount: 0,
        elevatorsRiddenCount: 0,
        fastTravelsCount: 0,
        timesSavedCount: 0,
        firstPlayedTimestamp: now,
        lastPlayedTimestamp: now,
      },
    };
  }

  public load(): NexusSaveData {
    if (typeof window === 'undefined') return this.data;

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.version) {
          this.data = {
            ...this.getDefaultData(),
            ...parsed,
            stats: {
              ...this.getDefaultData().stats,
              ...(parsed.stats || {}),
              lastPlayedTimestamp: Date.now(),
            },
          };
        }
      }
    } catch (e) {
      console.warn('[SaveSystem] Failed to load save data, using defaults:', e);
    }
    return this.data;
  }

  public save(showToast: boolean = true): void {
    if (typeof window === 'undefined') return;

    try {
      this.data.stats.timesSavedCount += 1;
      this.data.stats.lastPlayedTimestamp = Date.now();

      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
      this.notify();

      if (showToast) {
        window.dispatchEvent(
          new CustomEvent('nexus:notification', {
            detail: {
              title: 'PROGRESS SAVED',
              message: 'Operative coordinates & discovery codex synchronized to neural cache.',
              type: 'system',
              duration: 2500,
            },
          })
        );
      }
    } catch (e) {
      console.error('[SaveSystem] Failed to write save to localStorage:', e);
    }
  }

  public updatePlayerPosition(pos: THREE.Vector3, rotY: number = 0): void {
    const dist = this.lastPosition.distanceTo(pos);
    if (dist > 0.05 && dist < 100) {
      this.data.stats.distanceTraveledMeters += dist;
      this.lastPosition.copy(pos);
    }

    this.data.player.position = [
      Math.round(pos.x * 100) / 100,
      Math.round(pos.y * 100) / 100,
      Math.round(pos.z * 100) / 100,
    ];
    this.data.player.rotationY = Math.round(rotY * 100) / 100;

    // Trigger debounced auto-save every 45 seconds of continuous gameplay
    if (!this.autoSaveTimer) {
      this.autoSaveTimer = setTimeout(() => {
        this.autoSaveTimer = null;
        this.save(false);
      }, 45000);
    }
  }

  public updateDistrict(districtId: string): void {
    this.data.player.currentDistrict = districtId;
    if (!this.data.discoveredDistricts.includes(districtId)) {
      this.data.discoveredDistricts.push(districtId);
      this.save(false);
    }
  }

  public updateInterior(interiorId: string, floor: number = 1): void {
    const wasOutside = this.data.player.interiorId === 'NONE';
    this.data.player.interiorId = interiorId;
    this.data.player.floor = floor;

    if (wasOutside && interiorId !== 'NONE') {
      this.data.stats.interiorsEnteredCount += 1;
      this.recordLandmarkDiscovery(interiorId, interiorId.toUpperCase(), 'INTERIOR');
      this.save(false);
    }
  }

  public recordLandmarkDiscovery(
    id: string,
    name: string,
    category: 'DISTRICT' | 'LANDMARK' | 'INTERIOR'
  ): boolean {
    if (!this.data.discoveredLandmarks[id]) {
      this.data.discoveredLandmarks[id] = {
        id,
        name,
        category,
        discoveredAt: Date.now(),
      };
      this.save(false);
      return true; // Newly discovered
    }
    return false; // Already known
  }

  public incrementDialogue(): void {
    this.data.stats.dialoguesCompletedCount += 1;
    this.save(false);
  }

  public incrementElevator(): void {
    this.data.stats.elevatorsRiddenCount += 1;
    this.save(false);
  }

  public incrementFastTravel(): void {
    this.data.stats.fastTravelsCount += 1;
    this.save(false);
  }

  public getData(): Readonly<NexusSaveData> {
    return this.data;
  }

  public resetProgress(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(STORAGE_KEY);
      this.data = this.getDefaultData();
      this.save(true);
      window.location.reload();
    } catch (e) {
      console.error('[SaveSystem] Reset failed:', e);
    }
  }

  public subscribe(listener: SaveListener): () => void {
    this.listeners.add(listener);
    listener(this.data);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((l) => l(this.data));
  }
}
