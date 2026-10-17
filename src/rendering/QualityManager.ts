import { WebGLCapabilities, WebGLDiagnosticInfo } from './WebGLCapabilities';

export type QualityPreset = 'AUTO' | 'ULTRA' | 'HIGH' | 'MEDIUM' | 'LOW' | 'LITE' | 'CUSTOM';

export interface QualitySettings {
  name: QualityPreset;
  renderScale: number; // 0.5 to 2.0 (resolution multiplier)
  dpr: [number, number]; // [min, max]
  shadows: boolean;
  shadowQuality: 'OFF' | 'LOW' | 'MEDIUM' | 'HIGH' | 'ULTRA';
  shadowMapSize: number;
  shadowDistance: number;
  GIQuality: 'OFF' | 'LOW' | 'MEDIUM' | 'HIGH';
  reflectionQuality: 'OFF' | 'LOW' | 'MEDIUM' | 'HIGH';
  particleDensity: number;
  vegetationDensity: number;
  NPCDensity: number;
  vehicleDensity: number;
  drawDistance: number;
  maxActiveChunks: number;
  LODQuality: 'LOW' | 'MEDIUM' | 'HIGH';
  postProcessing: boolean;
  bloom: boolean;
  volumetrics: boolean;
  antiAliasing: boolean;
  textureQuality: 'LOW' | 'MEDIUM' | 'HIGH';
  anisotropy: number;
  maxLights: number;
  particlesDensity: number;
  cloudsEnabled: boolean;
  windParticlesEnabled: boolean;
  nightLightsEnabled: boolean;
}

export const QUALITY_PROFILES: Record<Exclude<QualityPreset, 'CUSTOM' | 'AUTO'>, QualitySettings> = {
  ULTRA: {
    name: 'ULTRA',
    renderScale: 1.25,
    dpr: [1, 1.75],
    shadows: true,
    shadowQuality: 'ULTRA',
    shadowMapSize: 2048,
    shadowDistance: 220,
    GIQuality: 'HIGH',
    reflectionQuality: 'HIGH',
    particleDensity: 1.0,
    vegetationDensity: 1.0,
    NPCDensity: 1.0,
    vehicleDensity: 1.0,
    drawDistance: 2000,
    maxActiveChunks: 120,
    LODQuality: 'HIGH',
    postProcessing: true,
    bloom: true,
    volumetrics: true,
    antiAliasing: true,
    textureQuality: 'HIGH',
    anisotropy: 8,
    maxLights: 20,
    particlesDensity: 1.0,
    cloudsEnabled: true,
    windParticlesEnabled: true,
    nightLightsEnabled: true,
  },
  HIGH: {
    name: 'HIGH',
    renderScale: 1.0,
    dpr: [1, 1.25],
    shadows: true,
    shadowQuality: 'HIGH',
    shadowMapSize: 1024,
    shadowDistance: 150,
    GIQuality: 'MEDIUM',
    reflectionQuality: 'MEDIUM',
    particleDensity: 0.75,
    vegetationDensity: 0.8,
    NPCDensity: 0.8,
    vehicleDensity: 0.8,
    drawDistance: 1400,
    maxActiveChunks: 75,
    LODQuality: 'HIGH',
    postProcessing: true,
    bloom: true,
    volumetrics: true,
    antiAliasing: true,
    textureQuality: 'HIGH',
    anisotropy: 4,
    maxLights: 12,
    particlesDensity: 0.75,
    cloudsEnabled: true,
    windParticlesEnabled: true,
    nightLightsEnabled: true,
  },
  MEDIUM: {
    name: 'MEDIUM',
    renderScale: 0.9,
    dpr: [0.9, 1.1],
    shadows: true,
    shadowQuality: 'MEDIUM',
    shadowMapSize: 512,
    shadowDistance: 90,
    GIQuality: 'LOW',
    reflectionQuality: 'LOW',
    particleDensity: 0.45,
    vegetationDensity: 0.6,
    NPCDensity: 0.6,
    vehicleDensity: 0.6,
    drawDistance: 900,
    maxActiveChunks: 45,
    LODQuality: 'MEDIUM',
    postProcessing: false,
    bloom: false,
    volumetrics: false,
    antiAliasing: false,
    textureQuality: 'MEDIUM',
    anisotropy: 2,
    maxLights: 8,
    particlesDensity: 0.45,
    cloudsEnabled: true,
    windParticlesEnabled: true,
    nightLightsEnabled: true,
  },
  LOW: {
    name: 'LOW',
    renderScale: 0.8,
    dpr: [0.8, 1.0],
    shadows: false,
    shadowQuality: 'OFF',
    shadowMapSize: 256,
    shadowDistance: 60,
    GIQuality: 'OFF',
    reflectionQuality: 'OFF',
    particleDensity: 0.25,
    vegetationDensity: 0.4,
    NPCDensity: 0.4,
    vehicleDensity: 0.4,
    drawDistance: 650,
    maxActiveChunks: 25,
    LODQuality: 'LOW',
    postProcessing: false,
    bloom: false,
    volumetrics: false,
    antiAliasing: false,
    textureQuality: 'LOW',
    anisotropy: 1,
    maxLights: 4,
    particlesDensity: 0.25,
    cloudsEnabled: false,
    windParticlesEnabled: false,
    nightLightsEnabled: false,
  },
  LITE: {
    name: 'LITE',
    renderScale: 0.7,
    dpr: [0.75, 0.9],
    shadows: false,
    shadowQuality: 'OFF',
    shadowMapSize: 128,
    shadowDistance: 40,
    GIQuality: 'OFF',
    reflectionQuality: 'OFF',
    particleDensity: 0.1,
    vegetationDensity: 0.2,
    NPCDensity: 0.25,
    vehicleDensity: 0.25,
    drawDistance: 450,
    maxActiveChunks: 16,
    LODQuality: 'LOW',
    postProcessing: false,
    bloom: false,
    volumetrics: false,
    antiAliasing: false,
    textureQuality: 'LOW',
    anisotropy: 1,
    maxLights: 2,
    particlesDensity: 0.1,
    cloudsEnabled: false,
    windParticlesEnabled: false,
    nightLightsEnabled: false,
  },
};

const STORAGE_KEY = 'nexus_city_graphics_settings_v3';
const LEGACY_STORAGE_KEY = 'nexus_city_graphics_settings_v2';
const isPreset = (value: unknown): value is QualityPreset =>
  typeof value === 'string' && ['AUTO', 'CUSTOM', ...Object.keys(QUALITY_PROFILES)].includes(value);

function restoreCustom(value: unknown): QualitySettings {
  const settings = { ...QUALITY_PROFILES.MEDIUM, name: 'CUSTOM' as const };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return settings;
  const input = value as Record<string, unknown>;
  const output = settings as unknown as Record<string, unknown>;
  for (const [key, fallback] of Object.entries(settings)) {
    const candidate = input[key];
    if (typeof fallback === 'boolean' && typeof candidate === 'boolean') output[key] = candidate;
    if (typeof fallback === 'number' && typeof candidate === 'number' && Number.isFinite(candidate) && candidate >= 0) {
      const values = Object.values(QUALITY_PROFILES).map((profile) => (profile as unknown as Record<string, number>)[key]);
      output[key] = Math.max(Math.min(...values), Math.min(Math.max(...values), candidate));
    }
    if (typeof fallback === 'string' && key !== 'name' && Object.values(QUALITY_PROFILES).some((profile) => (profile as unknown as Record<string, unknown>)[key] === candidate)) output[key] = candidate;
  }
  if (Array.isArray(input.dpr) && input.dpr.length === 2 && input.dpr.every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0.5 && n <= 2) && input.dpr[0] <= input.dpr[1]) {
    settings.dpr = [input.dpr[0], input.dpr[1]];
  }
  settings.maxActiveChunks = Math.floor(settings.maxActiveChunks);
  return settings;
}

type QualityChangeListener = (settings: QualitySettings) => void;

class QualityManagerClass {
  private currentPreset: QualityPreset = 'AUTO';
  // Start AUTO at MEDIUM so a cold load does not immediately activate the
  // highest draw distance and post-processing budget. Users can still opt
  // into HIGH/ULTRA explicitly, while AUTO remains usable on more hardware.
  private autoBasePreset: 'ULTRA' | 'HIGH' | 'MEDIUM' | 'LOW' | 'LITE' = 'MEDIUM';
  private customSettings: QualitySettings = {
    ...QUALITY_PROFILES.MEDIUM,
    name: 'CUSTOM',
  };
  private listeners: Set<QualityChangeListener> = new Set();
  private capabilities: WebGLDiagnosticInfo;

  constructor() {
    this.capabilities = WebGLCapabilities.detect();
    this.init();
  }

  private init(): void {
    // 1. Detect base tier for AUTO mode based on hardware and WebGL capabilities
    if (typeof window !== 'undefined') {
      const caps = this.capabilities;

      // Honor the detector's LOW recommendation for software/unsupported GPUs.
      // Keep the default at MEDIUM even when a faster device can opt into HIGH.
      this.autoBasePreset = caps.recommendedPreset === 'LOW' ? 'LOW' : 'MEDIUM';
    }

    // 2. Restore saved settings from localStorage
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (isPreset(parsed?.preset)) {
            this.currentPreset = parsed.preset;
          }
          this.customSettings = restoreCustom(parsed?.customSettings);
        }
      } catch (e) {
        console.warn('[QualityManager] Failed to load saved graphics settings:', e);
      }
    }
  }

  private save(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          preset: this.currentPreset,
          customSettings: this.customSettings,
        })
      );
    } catch (e) {
      console.warn('[QualityManager] Failed to save graphics settings:', e);
    }
  }

  public get isMobileDevice(): boolean {
    return this.capabilities.isMobile || this.capabilities.isVirGL;
  }

  public get isVirGLEnvironment(): boolean {
    return this.capabilities.isVirGL;
  }

  public get current(): QualitySettings {
    let settings: QualitySettings;
    if (this.currentPreset === 'CUSTOM') {
      settings = this.customSettings;
    } else if (this.currentPreset === 'AUTO') {
      settings = {
        ...QUALITY_PROFILES[this.autoBasePreset],
        name: 'AUTO',
      };
    } else {
      settings = QUALITY_PROFILES[this.currentPreset];
    }

    // Apply framebuffer guards on desktop as well as mobile: a desktop GPU can
    // also lack renderable half floats or use a constrained software renderer.
    const constrained = this.capabilities.isConstrained || this.isMobileDevice || this.isVirGLEnvironment;
    const maxAllowedDpr = this.capabilities.recommendedDpr;
    const maximumDpr = constrained ? Math.min(settings.dpr[1], maxAllowedDpr) : settings.dpr[1];
    const minimumDpr = constrained ? Math.min(settings.dpr[0], 0.85, maximumDpr) : settings.dpr[0];
    return {
      ...settings,
      dpr: [minimumDpr, maximumDpr],
      bloom: settings.bloom && this.capabilities.supportsHalfFloatRenderTarget,
      postProcessing: settings.postProcessing && this.capabilities.supportsHalfFloatRenderTarget,
    };
  }

  public get preset(): QualityPreset {
    return this.currentPreset;
  }

  public setPreset(preset: QualityPreset): void {
    if (!isPreset(preset)) return;
    if (this.currentPreset === preset) return;
    this.currentPreset = preset;

    if (preset !== 'CUSTOM' && preset !== 'AUTO') {
      this.customSettings = {
        ...QUALITY_PROFILES[preset],
        name: 'CUSTOM',
      };
    }

    this.save();
    const settings = this.current;
    this.listeners.forEach((listener) => listener(settings));
  }

  public updateCustomSettings(partial: Partial<QualitySettings>): void {
    // Start edits from the effective profile, including the adaptive AUTO tier.
    const baseline = this.current;
    this.currentPreset = 'CUSTOM';
    this.customSettings = restoreCustom({ ...baseline, ...partial });
    this.save();
    const settings = this.current;
    this.listeners.forEach((listener) => listener(settings));
  }

  public subscribe(listener: QualityChangeListener): () => void {
    this.listeners.add(listener);
    listener(this.current);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Automatically drops one quality tier if FPS is constrained (ONLY when preset is AUTO).
   */
  public throttleDown(): boolean {
    if (this.currentPreset !== 'AUTO') {
      return false;
    }

    const order: ('ULTRA' | 'HIGH' | 'MEDIUM' | 'LOW' | 'LITE')[] = ['ULTRA', 'HIGH', 'MEDIUM', 'LOW', 'LITE'];
    const idx = order.indexOf(this.autoBasePreset);
    if (idx !== -1 && idx < order.length - 1) {
      this.autoBasePreset = order[idx + 1];
      const settings = this.current;
      this.listeners.forEach((listener) => listener(settings));
      return true;
    }
    return false;
  }
}

export const QualityManager = new QualityManagerClass();
