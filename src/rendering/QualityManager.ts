export type QualityPreset = 'ULTRA' | 'HIGH' | 'MEDIUM' | 'LOW' | 'LITE' | 'CUSTOM';

export interface QualitySettings {
  name: QualityPreset;
  dpr: [number, number]; // [min, max]
  shadows: boolean;
  shadowMapSize: number;
  postProcessing: boolean;
  anisotropy: number;
  drawDistance: number;
  maxLights: number;
  particlesDensity: number;
  cloudsEnabled: boolean;
  windParticlesEnabled: boolean;
  nightLightsEnabled: boolean;
}

export const QUALITY_PROFILES: Record<Exclude<QualityPreset, 'CUSTOM'>, QualitySettings> = {
  ULTRA: {
    name: 'ULTRA',
    dpr: [1, 2],
    shadows: true,
    shadowMapSize: 2048,
    postProcessing: true,
    anisotropy: 8,
    drawDistance: 2600,
    maxLights: 24,
    particlesDensity: 1.0,
    cloudsEnabled: true,
    windParticlesEnabled: true,
    nightLightsEnabled: true,
  },
  HIGH: {
    name: 'HIGH',
    dpr: [1, 1.75],
    shadows: true,
    shadowMapSize: 1024,
    postProcessing: true,
    anisotropy: 4,
    drawDistance: 1800,
    maxLights: 16,
    particlesDensity: 0.8,
    cloudsEnabled: true,
    windParticlesEnabled: true,
    nightLightsEnabled: true,
  },
  MEDIUM: {
    name: 'MEDIUM',
    dpr: [1, 1.25],
    shadows: true,
    shadowMapSize: 512,
    postProcessing: false,
    anisotropy: 2,
    drawDistance: 1200,
    maxLights: 10,
    particlesDensity: 0.5,
    cloudsEnabled: true,
    windParticlesEnabled: true,
    nightLightsEnabled: true,
  },
  LOW: {
    name: 'LOW',
    dpr: [0.85, 1],
    shadows: false,
    shadowMapSize: 256,
    postProcessing: false,
    anisotropy: 1,
    drawDistance: 800,
    maxLights: 6,
    particlesDensity: 0.25,
    cloudsEnabled: false,
    windParticlesEnabled: false,
    nightLightsEnabled: true,
  },
  LITE: {
    name: 'LITE',
    dpr: [0.75, 1],
    shadows: false,
    shadowMapSize: 256,
    postProcessing: false,
    anisotropy: 1,
    drawDistance: 500,
    maxLights: 4,
    particlesDensity: 0.1,
    cloudsEnabled: false,
    windParticlesEnabled: false,
    nightLightsEnabled: false,
  },
};

type QualityChangeListener = (settings: QualitySettings) => void;

class QualityManagerClass {
  private currentPreset: QualityPreset = 'HIGH';
  private customSettings: QualitySettings = {
    ...QUALITY_PROFILES.HIGH,
    name: 'CUSTOM',
  };
  private listeners: Set<QualityChangeListener> = new Set();

  constructor() {
    // Auto-detect mobile devices & performance capacity on startup
    if (typeof window !== 'undefined') {
      const isMobileUA = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );
      const isSmallScreen = window.innerWidth < 768;
      const isLowCores = typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 4;

      if (isMobileUA || (isSmallScreen && ('ontouchstart' in window || navigator.maxTouchPoints > 0))) {
        this.currentPreset = isLowCores ? 'LOW' : 'MEDIUM';
      }
    }
  }

  public get current(): QualitySettings {
    if (this.currentPreset === 'CUSTOM') {
      return this.customSettings;
    }
    return QUALITY_PROFILES[this.currentPreset];
  }

  public get preset(): QualityPreset {
    return this.currentPreset;
  }

  public setPreset(preset: QualityPreset): void {
    if (this.currentPreset === preset) return;
    this.currentPreset = preset;
    if (preset !== 'CUSTOM') {
      // Sync custom settings baseline with selected preset
      this.customSettings = {
        ...QUALITY_PROFILES[preset],
        name: 'CUSTOM',
      };
    }
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
   * Automatically drops one quality tier if FPS is constrained.
   */
  public throttleDown(): boolean {
    const order: QualityPreset[] = ['ULTRA', 'HIGH', 'MEDIUM', 'LOW', 'LITE'];
    const idx = order.indexOf(this.currentPreset);
    if (idx !== -1 && idx < order.length - 1) {
      this.setPreset(order[idx + 1]);
      return true;
    }
    return false;
  }
}

export const QualityManager = new QualityManagerClass();

