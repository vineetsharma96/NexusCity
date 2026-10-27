import * as THREE from 'three';

export interface CityHistoryEntry {
  id: string;
  title: string;
  detail: string;
  timestamp: number;
}

export interface SavedTerminalObjective {
  terminalId: string;
  objectiveId: string;
  title: string;
  detail: string;
  kind: 'LORE' | 'SCAN' | 'MISSION';
  revealed: boolean;
  active: boolean;
  updatedAt: number;
}

export type MissionStatus = 'AVAILABLE' | 'ACCEPTED' | 'COMPLETED';

export interface SavedMissionState {
  id: string;
  status: MissionStatus;
  progress: number;
  updatedAt: number;
}

export interface VehicleUpgradeState {
  speed: number;
  handling: number;
  neon: number;
}

export interface SaveData {
  version: number;
  seed: number;
  lastSavedAt: number;
  player: {
    position: [number, number, number];
    rotationY: number;
    currentDistrict: string;
  };
  world: {
    timeOfDayHours: number;
    timeSpeedMultiplier: number;
    isTimePaused: boolean;
    weather: string;
  };
  discoveredDistricts: string[];
  discoveredLandmarks: Record<string, { id: string; name: string; category: string; discoveredAt: number }>;
  interactedNodes: string[];
  cityHistory: CityHistoryEntry[];
  terminalObjectives: Record<string, SavedTerminalObjective>;
  districtReputation: Record<string, number>;
  factionRelations: Record<string, number>;
  missionStates: Record<string, SavedMissionState>;
  vehicleUpgrades: VehicleUpgradeState;
  stats: {
    totalPlayTimeSeconds: number;
    distanceTraveledMeters: number;
  };
}

const STORAGE_KEY = 'nexus_city_flagship_save_v2';

const DEFAULT_SAVE: SaveData = {
  version: 2,
  seed: 847291,
  lastSavedAt: Date.now(),
  player: {
    position: [0, 0.2, 10],
    rotationY: 0,
    currentDistrict: 'CENTRAL_CITY',
  },
  world: {
    timeOfDayHours: 22.0,
    timeSpeedMultiplier: 1.0,
    isTimePaused: false,
    weather: 'CLEAR',
  },
  discoveredDistricts: ['CENTRAL_CITY'],
  discoveredLandmarks: {},
  interactedNodes: [],
  cityHistory: [],
  terminalObjectives: {},
  districtReputation: {},
  factionRelations: {},
  missionStates: {},
  vehicleUpgrades: { speed: 0, handling: 0, neon: 0 },
  stats: {
    totalPlayTimeSeconds: 0,
    distanceTraveledMeters: 0,
  },
};

function sanitizeNumberMap(val: unknown): Record<string, number> {
  if (!val || typeof val !== 'object') return {};
  const result: Record<string, number> = {};
  for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
    if (typeof v === 'number' && Number.isFinite(v)) {
      result[k] = Math.max(-100, Math.min(100, Math.round(v)));
    }
  }
  return result;
}

function sanitizeTerminalObjectives(val: unknown): Record<string, SavedTerminalObjective> {
  if (!val || typeof val !== 'object') return {};
  const result: Record<string, SavedTerminalObjective> = {};
  for (const [k, raw] of Object.entries(val as Record<string, unknown>)) {
    const entry = raw as Partial<SavedTerminalObjective>;
    if (!entry || typeof entry.terminalId !== 'string' || typeof entry.objectiveId !== 'string' || typeof entry.title !== 'string') {
      continue;
    }
    const kind = entry.kind === 'LORE' || entry.kind === 'SCAN' || entry.kind === 'MISSION' ? entry.kind : 'SCAN';
    result[k] = {
      terminalId: entry.terminalId,
      objectiveId: entry.objectiveId,
      title: entry.title,
      detail: typeof entry.detail === 'string' ? entry.detail : '',
      kind,
      revealed: Boolean(entry.revealed),
      active: Boolean(entry.active),
      updatedAt: typeof entry.updatedAt === 'number' && Number.isFinite(entry.updatedAt) ? entry.updatedAt : 0,
    };
  }
  return result;
}

function sanitizeMissionStates(val: unknown): Record<string, SavedMissionState> {
  if (!val || typeof val !== 'object') return {};
  const result: Record<string, SavedMissionState> = {};
  for (const [k, raw] of Object.entries(val as Record<string, unknown>)) {
    const entry = raw as Partial<SavedMissionState>;
    if (!entry || typeof entry.id !== 'string') continue;
    if (entry.status !== 'AVAILABLE' && entry.status !== 'ACCEPTED' && entry.status !== 'COMPLETED') continue;
    result[k] = {
      id: entry.id,
      status: entry.status,
      progress: typeof entry.progress === 'number' && Number.isFinite(entry.progress) ? Math.max(0, Math.min(1, entry.progress)) : 0,
      updatedAt: typeof entry.updatedAt === 'number' && Number.isFinite(entry.updatedAt) ? entry.updatedAt : 0,
    };
  }
  return result;
}

function clampUpgrade(val: unknown, max: number = 3): number {
  const num = typeof val === 'boolean' ? (val ? 1 : 0) : typeof val === 'number' ? val : NaN;
  return Number.isFinite(num) ? Math.max(0, Math.min(max, Math.floor(num))) : 0;
}

export class SaveSystem {
  private static instance: SaveSystem;
  private data: SaveData;
  private lastPos = new THREE.Vector3(0, 0.2, 10);
  public autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<(data: SaveData) => void>();

  private constructor() {
    this.data = this.loadFromStorage();
    this.lastPos.set(...this.data.player.position);
  }

  public static getInstance(): SaveSystem {
    if (!SaveSystem.instance) {
      SaveSystem.instance = new SaveSystem();
    }
    return SaveSystem.instance;
  }

  private scheduleAutoSave(): void {
    if (this.autoSaveTimer !== null) return;
    this.autoSaveTimer = setTimeout(() => {
      this.autoSaveTimer = null;
      this.saveToStorage();
    }, 2500);
    if (this.autoSaveTimer && typeof (this.autoSaveTimer as unknown as { unref?: () => void }).unref === 'function') {
      (this.autoSaveTimer as unknown as { unref: () => void }).unref();
    }
  }

  private loadFromStorage(): SaveData {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.version === 2) {
          const validPos =
            Array.isArray(parsed.player?.position) &&
            parsed.player.position.length === 3 &&
            parsed.player.position.every(Number.isFinite) &&
            parsed.player.position[1] >= 0;

          return {
            ...DEFAULT_SAVE,
            ...parsed,
            player: {
              ...DEFAULT_SAVE.player,
              ...parsed.player,
              position: validPos ? parsed.player.position : [...DEFAULT_SAVE.player.position],
              rotationY: Number.isFinite(parsed.player?.rotationY) ? parsed.player.rotationY : 0,
            },
            world: { ...DEFAULT_SAVE.world, ...parsed.world },
            discoveredDistricts: Array.isArray(parsed.discoveredDistricts)
              ? parsed.discoveredDistricts.filter((item: unknown): item is string => typeof item === 'string')
              : [...DEFAULT_SAVE.discoveredDistricts],
            discoveredLandmarks:
              parsed.discoveredLandmarks && typeof parsed.discoveredLandmarks === 'object'
                ? parsed.discoveredLandmarks
                : {},
            interactedNodes: Array.isArray(parsed.interactedNodes)
              ? parsed.interactedNodes.filter((item: unknown): item is string => typeof item === 'string')
              : [],
            cityHistory: Array.isArray(parsed.cityHistory)
              ? parsed.cityHistory.filter((item: Partial<CityHistoryEntry>) => item && typeof item.id === 'string' && typeof item.title === 'string')
              : [],
            terminalObjectives: sanitizeTerminalObjectives(parsed.terminalObjectives),
            districtReputation: sanitizeNumberMap(parsed.districtReputation),
            factionRelations: sanitizeNumberMap(parsed.factionRelations),
            missionStates: sanitizeMissionStates(parsed.missionStates),
            vehicleUpgrades: {
              speed: clampUpgrade(parsed.vehicleUpgrades?.speed, 3),
              handling: clampUpgrade(parsed.vehicleUpgrades?.handling, 3),
              neon: clampUpgrade(parsed.vehicleUpgrades?.neon, 3),
            },
            stats: {
              totalPlayTimeSeconds:
                typeof parsed.stats?.totalPlayTimeSeconds === 'number' && Number.isFinite(parsed.stats.totalPlayTimeSeconds)
                  ? Math.max(0, parsed.stats.totalPlayTimeSeconds)
                  : 0,
              distanceTraveledMeters:
                typeof parsed.stats?.distanceTraveledMeters === 'number' && Number.isFinite(parsed.stats.distanceTraveledMeters)
                  ? Math.max(0, parsed.stats.distanceTraveledMeters)
                  : 0,
            },
          };
        }
      }
    } catch {
      // Storage inaccessible
    }
    return JSON.parse(JSON.stringify(DEFAULT_SAVE));
  }

  public saveToStorage(): void {
    try {
      this.data.lastSavedAt = Date.now();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
      this.notify();
    } catch {
      // Ignore quota errors
    }
  }

  public updatePlayerPosition(pos: THREE.Vector3, rotationY: number = 0): void {
    if (![pos.x, pos.y, pos.z].every(Number.isFinite)) return;
    const dist = pos.distanceTo(this.lastPos);
    if (dist > 0.05 && dist < 50) {
      this.data.stats.distanceTraveledMeters = Math.round((this.data.stats.distanceTraveledMeters + dist) * 10) / 10;
    }
    if (dist > 0.05) {
      this.lastPos.copy(pos);
    }
    this.data.player.position = [
      Math.round(pos.x * 100) / 100,
      Math.round(pos.y * 100) / 100,
      Math.round(pos.z * 100) / 100,
    ];
    this.data.player.rotationY = Math.round((Number.isFinite(rotationY) ? rotationY : 0) * 100) / 100;
    this.scheduleAutoSave();
  }

  public updateDistrict(districtType: string): boolean {
    this.data.player.currentDistrict = districtType;
    if (!this.data.discoveredDistricts.includes(districtType)) {
      this.data.discoveredDistricts.push(districtType);
      this.recordHistory(`district_${districtType}`, `SECTOR ENTERED // ${districtType.replaceAll('_', ' ')}`, 'Atmospheric and architectural telemetry logged.');
      this.saveToStorage();
      return true;
    }
    return false;
  }

  public discoverLandmark(id: string, name: string, category: string): boolean {
    if (this.data.discoveredLandmarks[id]) return false;
    this.data.discoveredLandmarks[id] = { id, name, category, discoveredAt: Date.now() };
    this.recordHistory(`landmark_${id}`, `LANDMARK LOGGED // ${name}`, `${category} registered in city atlas.`);
    this.saveToStorage();
    return true;
  }

  public recordNodeInteraction(nodeId: string): void {
    if (!this.data.interactedNodes.includes(nodeId)) {
      this.data.interactedNodes.push(nodeId);
      this.saveToStorage();
    }
  }

  public recordHistory(id: string, title: string, detail: string): void {
    if (this.data.cityHistory.some((entry) => entry.id === id)) return;
    this.data.cityHistory = [{ id, title, detail, timestamp: Date.now() }, ...this.data.cityHistory].slice(0, 40);
    this.saveToStorage();
  }

  public getTerminalObjectives(): Record<string, SavedTerminalObjective> {
    return { ...this.data.terminalObjectives };
  }

  public setTerminalObjective(objective: SavedTerminalObjective): void {
    if (objective.active) {
      for (const existing of Object.values(this.data.terminalObjectives)) {
        if (existing.terminalId !== objective.terminalId) existing.active = false;
      }
    }
    this.data.terminalObjectives[objective.terminalId] = { ...objective };
    this.saveToStorage();
  }

  public setReputation(district: string, value: number): void {
    if (!Number.isFinite(value)) return;
    this.data.districtReputation[district] = Math.max(-100, Math.min(100, Math.round(value)));
    this.saveToStorage();
  }

  public setFactionRelation(faction: string, value: number): void {
    if (!Number.isFinite(value)) return;
    this.data.factionRelations[faction] = Math.max(-100, Math.min(100, Math.round(value)));
    this.saveToStorage();
  }

  public setMissionState(mission: SavedMissionState): void {
    this.data.missionStates[mission.id] = {
      ...mission,
      progress: Math.max(0, Math.min(1, mission.progress)),
    };
    this.saveToStorage();
  }

  public setVehicleUpgrade(key: keyof VehicleUpgradeState, level: number): void {
    const max = key === 'speed' ? 3 : key === 'handling' ? 2 : 1;
    this.data.vehicleUpgrades[key] = clampUpgrade(level, max);
    this.saveToStorage();
  }

  public updateWorldSettings(timeHours: number, speedMult: number, isPaused: boolean, weather: string): void {
    this.data.world.timeOfDayHours = timeHours;
    this.data.world.timeSpeedMultiplier = speedMult;
    this.data.world.isTimePaused = isPaused;
    this.data.world.weather = weather;
  }

  public getData(): SaveData {
    return this.data;
  }

  public resetProgress(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
    this.data = JSON.parse(JSON.stringify(DEFAULT_SAVE));
    this.notify();
    window.location.reload();
  }

  public subscribe(listener: (data: SaveData) => void): () => void {
    this.listeners.add(listener);
    listener(this.data);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((l) => l(this.data));
  }
}
