import { WebGLCapabilities } from './WebGLCapabilities';

export type QualityPreset = 'AUTO' | 'LITE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'ULTRA' | 'CUSTOM';

export interface QualitySettings {
  name: QualityPreset;
  dpr: [number, number];
  drawDistance: number;
  shadows: boolean;
  shadowMapSize: number;
  maxLights: number;
  particlesDensity: number;
  NPCDensity: number;
  LODQuality: 'LOW' | 'MEDIUM' | 'HIGH';
  postProcessing: boolean;
  bloom: boolean;
  sharpeningEnabled: boolean;
  vignetteEnabled: boolean;
  antiAliasing: boolean;
  cloudsEnabled: boolean;
  rainParticlesEnabled: boolean;
  windParticlesEnabled: boolean;
  nightLightsEnabled: boolean;
  volumetricRaysEnabled: boolean;
  starsEnabled: boolean;
  horizonHazeEnabled: boolean;
  fogEnabled: boolean;
  wetReflectionsEnabled: boolean;
  normalMapsEnabled: boolean;
  vegetationEnabled: boolean;
  trafficEnabled: boolean;
  npcsEnabled: boolean;
  billboardsEnabled: boolean;
  streetFurnitureEnabled: boolean;
  reflectionQuality: 'OFF' | 'LOW' | 'MEDIUM' | 'HIGH';
  maxActiveChunks: number;
}

export const QUALITY_PROFILES: Record<Exclude<QualityPreset, 'AUTO' | 'CUSTOM'>, QualitySettings> = {
  LITE: {
    name: 'LITE',
    dpr: [0.65, 0.75],
    drawDistance: 260,
    shadows: false,
    shadowMapSize: 256,
    maxLights: 2,
    particlesDensity: 0.15,
    NPCDensity: 0.25,
    LODQuality: 'LOW',
    postProcessing: false,
    bloom: false,
    sharpeningEnabled: false,
    vignetteEnabled: false,
    antiAliasing: false,
    cloudsEnabled: false,
    rainParticlesEnabled: true,
    windParticlesEnabled: false,
    nightLightsEnabled: false,
    volumetricRaysEnabled: false,
    starsEnabled: false,
    horizonHazeEnabled: false,
    fogEnabled: true,
    wetReflectionsEnabled: false,
    normalMapsEnabled: false,
    vegetationEnabled: false,
    trafficEnabled: true,
    npcsEnabled: true,
    billboardsEnabled: false,
    streetFurnitureEnabled: false,
    reflectionQuality: 'OFF',
    maxActiveChunks: 20,
  },
  LOW: {
    name: 'LOW',
    dpr: [0.75, 1.0],
    drawDistance: 360,
    shadows: false,
    shadowMapSize: 512,
    maxLights: 4,
    particlesDensity: 0.3,
    NPCDensity: 0.4,
    LODQuality: 'LOW',
    postProcessing: false,
    bloom: false,
    sharpeningEnabled: false,
    vignetteEnabled: true,
    antiAliasing: false,
    cloudsEnabled: true,
    rainParticlesEnabled: true,
    windParticlesEnabled: false,
    nightLightsEnabled: true,
    volumetricRaysEnabled: true,
    starsEnabled: true,
    horizonHazeEnabled: false,
    fogEnabled: true,
    wetReflectionsEnabled: false,
    normalMapsEnabled: false,
    vegetationEnabled: true,
    trafficEnabled: true,
    npcsEnabled: true,
    billboardsEnabled: true,
    streetFurnitureEnabled: false,
    reflectionQuality: 'OFF',
    maxActiveChunks: 35,
  },
  MEDIUM: {
    name: 'MEDIUM',
    dpr: [0.9, 1.1],
    drawDistance: 520,
    shadows: true,
    shadowMapSize: 1024,
    maxLights: 10,
    particlesDensity: 0.65,
    NPCDensity: 0.7,
    LODQuality: 'MEDIUM',
    postProcessing: true,
    bloom: true,
    sharpeningEnabled: false,
    vignetteEnabled: true,
    antiAliasing: false,
    cloudsEnabled: true,
    rainParticlesEnabled: true,
    windParticlesEnabled: true,
    nightLightsEnabled: true,
    volumetricRaysEnabled: true,
    starsEnabled: true,
    horizonHazeEnabled: true,
    fogEnabled: true,
    wetReflectionsEnabled: true,
    normalMapsEnabled: true,
    vegetationEnabled: true,
    trafficEnabled: true,
    npcsEnabled: true,
    billboardsEnabled: true,
    streetFurnitureEnabled: true,
    reflectionQuality: 'LOW',
    maxActiveChunks: 50,
  },
  HIGH: {
    name: 'HIGH',
    dpr: [1.0, 1.5],
    drawDistance: 720,
    shadows: true,
    shadowMapSize: 2048,
    maxLights: 20,
    particlesDensity: 1.0,
    NPCDensity: 1.0,
    LODQuality: 'HIGH',
    postProcessing: true,
    bloom: true,
    sharpeningEnabled: true,
    vignetteEnabled: true,
    antiAliasing: true,
    cloudsEnabled: true,
    rainParticlesEnabled: true,
    windParticlesEnabled: true,
    nightLightsEnabled: true,
    volumetricRaysEnabled: true,
    starsEnabled: true,
    horizonHazeEnabled: true,
    fogEnabled: true,
    wetReflectionsEnabled: true,
    normalMapsEnabled: true,
    vegetationEnabled: true,
    trafficEnabled: true,
    npcsEnabled: true,
    billboardsEnabled: true,
    streetFurnitureEnabled: true,
    reflectionQuality: 'MEDIUM',
    maxActiveChunks: 75,
  },
  ULTRA: {
    name: 'ULTRA',
    dpr: [1.5, 2.0],
    drawDistance: 1200,
    shadows: true,
    shadowMapSize: 4096,
    maxLights: 36,
    particlesDensity: 1.6,
    NPCDensity: 1.35,
    LODQuality: 'HIGH',
    postProcessing: true,
    bloom: true,
    sharpeningEnabled: true,
    vignetteEnabled: true,
    antiAliasing: true,
    cloudsEnabled: true,
    rainParticlesEnabled: true,
    windParticlesEnabled: true,
    nightLightsEnabled: true,
    volumetricRaysEnabled: true,
    starsEnabled: true,
    horizonHazeEnabled: true,
    fogEnabled: true,
    wetReflectionsEnabled: true,
    normalMapsEnabled: true,
    vegetationEnabled: true,
    trafficEnabled: true,
    npcsEnabled: true,
    billboardsEnabled: true,
    streetFurnitureEnabled: true,
    reflectionQuality: 'HIGH',
    maxActiveChunks: 120,
  },
};

type Listener = (settings: QualitySettings) => void;

const STORAGE_KEY = 'nexus_city_graphics_settings_v3';
const LEGACY_STORAGE_KEYS = ['nexus_city_graphics_settings_v2'];
const PRESETS = new Set<QualityPreset>(['AUTO', 'LITE', 'LOW', 'MEDIUM', 'HIGH', 'ULTRA', 'CUSTOM']);
const LOD_VALUES = new Set<QualitySettings['LODQuality']>(['LOW', 'MEDIUM', 'HIGH']);
const REFLECTION_VALUES = new Set<QualitySettings['reflectionQuality']>(['OFF', 'LOW', 'MEDIUM', 'HIGH']);

function clampNum(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function sanitizeBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function sanitizeDpr(value: unknown, fallback: [number, number]): [number, number] {
  if (!Array.isArray(value) || value.length !== 2) return [...fallback] as [number, number];
  const low = clampNum(value[0], 0.5, 2, fallback[0]);
  const high = clampNum(value[1], low, 2, Math.max(low, fallback[1]));
  return [low, high];
}

function sanitizeSettings(raw: Partial<QualitySettings> | undefined, base: QualitySettings): QualitySettings {
  if (!raw || typeof raw !== 'object') return { ...base, dpr: [...base.dpr] as [number, number] };
  return {
    name: raw.name && PRESETS.has(raw.name) ? raw.name : base.name,
    dpr: sanitizeDpr(raw.dpr, base.dpr),
    drawDistance: clampNum(raw.drawDistance, 180, 2000, base.drawDistance),
    shadows: sanitizeBool(raw.shadows, base.shadows),
    shadowMapSize: clampNum(raw.shadowMapSize, 256, 4096, base.shadowMapSize),
    maxLights: Math.round(clampNum(raw.maxLights, 0, 64, base.maxLights)),
    particlesDensity: clampNum(raw.particlesDensity, 0, 2, base.particlesDensity),
    NPCDensity: clampNum(raw.NPCDensity, 0, 2, base.NPCDensity),
    LODQuality: raw.LODQuality && LOD_VALUES.has(raw.LODQuality) ? raw.LODQuality : base.LODQuality,
    postProcessing: sanitizeBool(raw.postProcessing, base.postProcessing),
    bloom: sanitizeBool(raw.bloom, base.bloom),
    sharpeningEnabled: sanitizeBool(raw.sharpeningEnabled, base.sharpeningEnabled),
    vignetteEnabled: sanitizeBool(raw.vignetteEnabled, base.vignetteEnabled),
    antiAliasing: sanitizeBool(raw.antiAliasing, base.antiAliasing),
    cloudsEnabled: sanitizeBool(raw.cloudsEnabled, base.cloudsEnabled),
    rainParticlesEnabled: sanitizeBool(raw.rainParticlesEnabled, base.rainParticlesEnabled),
    windParticlesEnabled: sanitizeBool(raw.windParticlesEnabled, base.windParticlesEnabled),
    nightLightsEnabled: sanitizeBool(raw.nightLightsEnabled, base.nightLightsEnabled),
    volumetricRaysEnabled: sanitizeBool(raw.volumetricRaysEnabled, base.volumetricRaysEnabled),
    starsEnabled: sanitizeBool(raw.starsEnabled, base.starsEnabled),
    horizonHazeEnabled: sanitizeBool(raw.horizonHazeEnabled, base.horizonHazeEnabled),
    fogEnabled: sanitizeBool(raw.fogEnabled, base.fogEnabled),
    wetReflectionsEnabled: sanitizeBool(raw.wetReflectionsEnabled, base.wetReflectionsEnabled),
    normalMapsEnabled: sanitizeBool(raw.normalMapsEnabled, base.normalMapsEnabled),
    vegetationEnabled: sanitizeBool(raw.vegetationEnabled, base.vegetationEnabled),
    trafficEnabled: sanitizeBool(raw.trafficEnabled, base.trafficEnabled),
    npcsEnabled: sanitizeBool(raw.npcsEnabled, base.npcsEnabled),
    billboardsEnabled: sanitizeBool(raw.billboardsEnabled, base.billboardsEnabled),
    streetFurnitureEnabled: sanitizeBool(raw.streetFurnitureEnabled, base.streetFurnitureEnabled),
    reflectionQuality:
      raw.reflectionQuality && REFLECTION_VALUES.has(raw.reflectionQuality)
        ? raw.reflectionQuality
        : base.reflectionQuality,
    maxActiveChunks: Math.floor(clampNum(raw.maxActiveChunks, 12, 160, base.maxActiveChunks)),
  };
}

class QualityManagerImpl {
  private currentPreset: QualityPreset = 'AUTO';
  private settings: QualitySettings = QUALITY_PROFILES.HIGH;
  private listeners = new Set<Listener>();

  constructor() {
    if (!this.loadFromStorage()) {
      this.applyAutoDetection();
    }
  }

  private getAutoProfile(): QualitySettings {
    const caps = WebGLCapabilities.detect();
    if (caps.isVirGL) {
      return this.applyCapabilityGuards({ ...QUALITY_PROFILES.LOW, name: 'LOW', dpr: [0.85, 1.0] });
    }
    if (caps.isMobile) {
      return this.applyCapabilityGuards({
        ...QUALITY_PROFILES.LITE,
        name: 'LITE',
        dpr: [0.65, Math.min(caps.recommendedDpr, 0.85)],
        cloudsEnabled: true,
        nightLightsEnabled: true,
      });
    }
    if (caps.isConstrained || caps.recommendedPreset === 'LOW') {
      const base = caps.recommendedPreset === 'LOW' ? QUALITY_PROFILES.LOW : QUALITY_PROFILES.MEDIUM;
      return this.applyCapabilityGuards({
        ...base,
        dpr: [0.9, Math.min(caps.recommendedDpr, 1.1)],
      });
    }
    return this.applyCapabilityGuards({
      ...QUALITY_PROFILES.HIGH,
      dpr: [1.0, Math.min(1.5, caps.recommendedDpr)],
    });
  }

  private applyCapabilityGuards(settings: QualitySettings): QualitySettings {
    const caps = WebGLCapabilities.detect();
    const guarded = sanitizeSettings(settings, settings);

    if (!caps.supportsHalfFloatRenderTarget) {
      guarded.postProcessing = false;
      guarded.bloom = false;
    }

    if (caps.isMobile || caps.isConstrained) {
      const maxDpr = Math.max(0.65, Math.min(caps.recommendedDpr || 1, 1.25));
      guarded.dpr = [Math.min(guarded.dpr[0], maxDpr), Math.min(guarded.dpr[1], maxDpr)];
    }

    return guarded;
  }

  private loadFromStorage(): boolean {
    try {
      const raw =
        localStorage.getItem(STORAGE_KEY) ??
        LEGACY_STORAGE_KEYS.map((key) => localStorage.getItem(key)).find((val): val is string => val !== null) ??
        null;
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (parsed && PRESETS.has(parsed.preset)) {
        this.currentPreset = parsed.preset;
        if (parsed.preset === 'CUSTOM' && parsed.customSettings) {
          this.settings = this.applyCapabilityGuards(
            sanitizeSettings({ ...parsed.customSettings, name: 'CUSTOM' }, QUALITY_PROFILES.MEDIUM)
          );
          return true;
        }
        if (parsed.preset !== 'AUTO' && parsed.preset !== 'CUSTOM') {
          this.settings = this.applyCapabilityGuards({ ...QUALITY_PROFILES[parsed.preset as Exclude<QualityPreset, 'AUTO' | 'CUSTOM'>] });
          return true;
        }
      }
    } catch {
      // Ignore storage errors
    }
    return false;
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          preset: this.currentPreset,
          customSettings: this.currentPreset === 'CUSTOM' ? this.settings : undefined,
        })
      );
    } catch {
      // Ignore
    }
  }

  public applyAutoDetection(): void {
    this.currentPreset = 'AUTO';
    this.settings = this.getAutoProfile();
    this.notify();
  }

  public get current(): QualitySettings {
    return this.settings;
  }

  public get preset(): QualityPreset {
    return this.currentPreset;
  }

  public setPreset(preset: QualityPreset): void {
    this.currentPreset = preset;
    if (preset === 'AUTO') {
      this.applyAutoDetection();
    } else if (preset === 'CUSTOM') {
      this.settings = this.applyCapabilityGuards({
        ...this.settings,
        name: 'CUSTOM',
      });
      this.notify();
    } else {
      this.settings = this.applyCapabilityGuards({ ...QUALITY_PROFILES[preset] });
      this.notify();
    }
    this.saveToStorage();
  }

  public updateCustomSettings(partial: Partial<QualitySettings>): void {
    this.currentPreset = 'CUSTOM';
    this.settings = this.applyCapabilityGuards(sanitizeSettings({ ...this.settings, ...partial, name: 'CUSTOM' }, this.settings));
    this.saveToStorage();
    this.notify();
  }

  public setAllGraphicsToggles(enabled: boolean): void {
    this.updateCustomSettings({
      postProcessing: enabled,
      bloom: enabled,
      sharpeningEnabled: enabled,
      vignetteEnabled: enabled,
      antiAliasing: enabled,
      shadows: enabled,
      nightLightsEnabled: enabled,
      volumetricRaysEnabled: enabled,
      starsEnabled: enabled,
      horizonHazeEnabled: enabled,
      fogEnabled: enabled,
      cloudsEnabled: enabled,
      rainParticlesEnabled: enabled,
      windParticlesEnabled: enabled,
      wetReflectionsEnabled: enabled,
      normalMapsEnabled: enabled,
      vegetationEnabled: enabled,
      trafficEnabled: enabled,
      npcsEnabled: enabled,
      billboardsEnabled: enabled,
      streetFurnitureEnabled: enabled,
      reflectionQuality: enabled ? 'HIGH' : 'OFF',
    });
  }

  public throttleDown(): boolean {
    if (this.currentPreset !== 'AUTO') return false;
    if (this.settings.name === 'ULTRA') {
      this.settings = this.applyCapabilityGuards({ ...QUALITY_PROFILES.HIGH });
      this.notify();
      return true;
    }
    if (this.settings.name === 'HIGH') {
      this.settings = this.applyCapabilityGuards({ ...QUALITY_PROFILES.MEDIUM });
      this.notify();
      return true;
    }
    if (this.settings.name === 'MEDIUM') {
      this.settings = this.applyCapabilityGuards({ ...QUALITY_PROFILES.LOW });
      this.notify();
      return true;
    }
    if (this.settings.name === 'LOW') {
      this.settings = this.applyCapabilityGuards({ ...QUALITY_PROFILES.LITE });
      this.notify();
      return true;
    }
    return false;
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.settings);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((l) => l(this.settings));
  }
}

export const QualityManager = new QualityManagerImpl();
