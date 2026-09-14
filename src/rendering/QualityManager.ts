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
  LODQuality: 'LOW' | 'MEDIUM' | 'HIGH';
  postProcessing: boolean;
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
    renderScale: 1.5,
    dpr: [1, 2],
    shadows: true,
    shadowQuality: 'ULTRA',
    shadowMapSize: 2048,
    shadowDistance: 250,
    GIQuality: 'HIGH',
    reflectionQuality: 'HIGH',
    particleDensity: 1.0,
    vegetationDensity: 1.0,
    NPCDensity: 1.0,
    vehicleDensity: 1.0,
    drawDistance: 2600,
    LODQuality: 'HIGH',
    postProcessing: true,
    volumetrics: true,
    antiAliasing: true,
    textureQuality: 'HIGH',
    anisotropy: 8,
    maxLights: 24,
    particlesDensity: 1.0,
    cloudsEnabled: true,
    windParticlesEnabled: true,
    nightLightsEnabled: true,
  },
  HIGH: {
    name: 'HIGH',
    renderScale: 1.25,
    dpr: [1, 1.75],
    shadows: true,
    shadowQuality: 'HIGH',
    shadowMapSize: 1024,
    shadowDistance: 180,
    GIQuality: 'MEDIUM',
    reflectionQuality: 'MEDIUM',
    particleDensity: 0.8,
    vegetationDensity: 0.9,
    NPCDensity: 0.9,
    vehicleDensity: 0.85,
    drawDistance: 1800,
    LODQuality: 'HIGH',
    postProcessing: true,
    volumetrics: true,
    antiAliasing: true,
    textureQuality: 'HIGH',
    anisotropy: 4,
    maxLights: 16,
    particlesDensity: 0.8,
    cloudsEnabled: true,
    windParticlesEnabled: true,
    nightLightsEnabled: true,
  },
  MEDIUM: {
    name: 'MEDIUM',
    renderScale: 1.0,
    dpr: [1, 1.25],
    shadows: true,
    shadowQuality: 'MEDIUM',
    shadowMapSize: 512,
    shadowDistance: 120,
    GIQuality: 'LOW',
    reflectionQuality: 'LOW',
    particleDensity: 0.5,
    vegetationDensity: 0.7,
    NPCDensity: 0.7,
    vehicleDensity: 0.7,
    drawDistance: 1200,
    LODQuality: 'MEDIUM',
    postProcessing: false,
    volumetrics: false,
    antiAliasing: true,
    textureQuality: 'MEDIUM',
    anisotropy: 2,
    maxLights: 10,
    particlesDensity: 0.5,
    cloudsEnabled: true,
    windParticlesEnabled: true,
    nightLightsEnabled: true,
  },
  LOW: {
    name: 'LOW',
    renderScale: 0.85,
    dpr: [0.85, 1],
    shadows: false,
    shadowQuality: 'OFF',
    shadowMapSize: 256,
    shadowDistance: 80,
    GIQuality: 'OFF',
    reflectionQuality: 'OFF',
    particleDensity: 0.25,
    vegetationDensity: 0.5,
    NPCDensity: 0.5,
    vehicleDensity: 0.5,
    drawDistance: 800,
    LODQuality: 'LOW',
    postProcessing: false,
    volumetrics: false,
    antiAliasing: false,
    textureQuality: 'LOW',
    anisotropy: 1,
    maxLights: 6,
    particlesDensity: 0.25,
    cloudsEnabled: false,
    windParticlesEnabled: false,
    nightLightsEnabled: true,
  },
  LITE: {
    name: 'LITE',
    renderScale: 0.75,
    dpr: [0.75, 1],
    shadows: false,
    shadowQuality: 'OFF',
    shadowMapSize: 256,
    shadowDistance: 50,
    GIQuality: 'OFF',
    reflectionQuality: 'OFF',
    particleDensity: 0.1,
    vegetationDensity: 0.3,
    NPCDensity: 0.3,
    vehicleDensity: 0.3,
    drawDistance: 500,
    LODQuality: 'LOW',
    postProcessing: false,
    volumetrics: false,
    antiAliasing: false,
    textureQuality: 'LOW',
    anisotropy: 1,
    maxLights: 4,
    particlesDensity: 0.1,
    cloudsEnabled: false,
    windParticlesEnabled: false,
    nightLightsEnabled: false,
  },
};

const STORAGE_KEY = 'nexus_city_graphics_settings_v2';

type QualityChangeListener = (settings: QualitySettings) => void;

class QualityManagerClass {
  private currentPreset: QualityPreset = 'AUTO';
  private autoBasePreset: 'ULTRA' | 'HIGH' | 'MEDIUM' | 'LOW' | 'LITE' = 'HIGH';
  private customSettings: QualitySettings = {
    ...QUALITY_PROFILES.HIGH,
    name: 'CUSTOM',
  };
  private listeners: Set<QualityChangeListener> = new Set();

  constructor() {
    this.init();
  }

  private init(): void {
    // 1. Detect base tier for AUTO mode
    if (typeof window !== 'undefined') {
      const isMobileUA = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );
      const isSmallScreen = window.innerWidth < 768;
      const isLowCores = typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 4;

      if (isMobileUA || (isSmallScreen && ('ontouchstart' in window || navigator.maxTouchPoints > 0))) {
        this.autoBasePreset = isLowCores ? 'LOW' : 'MEDIUM';
      } else {
        this.autoBasePreset = 'HIGH';
      }
    }

    // 2. Restore saved settings from localStorage
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.preset) {
            this.currentPreset = parsed.preset;
          }
          if (parsed.customSettings) {
            this.customSettings = {
              ...QUALITY_PROFILES.HIGH,
              ...parsed.customSettings,
              name: 'CUSTOM',
            };
          }
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
    if (typeof window === 'undefined') return false;
    const isMobileUA = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
    const isSmallScreen = window.innerWidth < 768;
    return isMobileUA || (isSmallScreen && ('ontouchstart' in window || navigator.maxTouchPoints > 0));
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

    // On mobile devices, clamp DPR to prevent severe GPU memory and fill-rate bottlenecks
    if (this.isMobileDevice) {
      return {
        ...settings,
        dpr: [Math.min(settings.dpr[0], 0.85), Math.min(settings.dpr[1], 1.25)],
      };
    }
    return settings;
  }

  public get preset(): QualityPreset {
    return this.currentPreset;
  }

  public setPreset(preset: QualityPreset): void {
    if (this.currentPreset === preset) return;
    this.currentPreset = preset;

    if (preset !== 'CUSTOM' && preset !== 'AUTO') {
      // Sync custom baseline with selected profile
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
    this.currentPreset = 'CUSTOM';
    this.customSettings = {
      ...this.customSettings,
      ...partial,
      name: 'CUSTOM',
    };
    this.save();
    const settings = this.customSettings;
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
      // Never overwrite or degrade CUSTOM or explicit user presets
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


