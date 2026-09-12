export type QualityPreset = 'ULTRA' | 'HIGH' | 'MEDIUM' | 'LOW' | 'LITE';

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
}

export const QUALITY_PROFILES: Record<QualityPreset, QualitySettings> = {
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
  },
};

type QualityChangeListener = (settings: QualitySettings) => void;

class QualityManagerClass {
  private currentPreset: QualityPreset = 'HIGH';
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
    return QUALITY_PROFILES[this.currentPreset];
  }

  public get preset(): QualityPreset {
    return this.currentPreset;
  }

  public setPreset(preset: QualityPreset): void {
    if (this.currentPreset === preset) return;
    this.currentPreset = preset;
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
   * Automatically drops one quality tier if FPS is constrained.
   */
  public throttleDown(): boolean {
    const order: QualityPreset[] = ['ULTRA', 'HIGH', 'MEDIUM', 'LOW', 'LITE'];
    const idx = order.indexOf(this.currentPreset);
    if (idx < order.length - 1) {
      this.setPreset(order[idx + 1]);
      return true;
    }
    return false;
  }
}

export const QualityManager = new QualityManagerClass();
