import { AudioManager } from '../audio/AudioManager';
import { SaveSystem } from '../core/SaveSystem';
import { TimeLightingState } from './TimeSystem';
import { WeatherState } from './WeatherSystem';

export interface EmergencyState {
  active: boolean;
  level: 'NOMINAL' | 'ADVISORY' | 'CRITICAL';
  kind: 'NONE' | 'STORM' | 'VISIBILITY' | 'CURFEW';
  message: string;
}

type EmergencyListener = (state: EmergencyState) => void;

export class EmergencyAlertSystem {
  private static instance: EmergencyAlertSystem;
  private state: EmergencyState = {
    active: false,
    level: 'NOMINAL',
    kind: 'NONE',
    message: 'CIVIC GRID NOMINAL',
  };
  private listeners = new Set<EmergencyListener>();
  private lastSignature = 'NONE:NOMINAL';

  private constructor() {}

  public static getInstance(): EmergencyAlertSystem {
    if (!EmergencyAlertSystem.instance) {
      EmergencyAlertSystem.instance = new EmergencyAlertSystem();
    }
    return EmergencyAlertSystem.instance;
  }

  public update(weather: WeatherState, time: TimeLightingState): void {
    let next: EmergencyState = {
      active: false,
      level: 'NOMINAL',
      kind: 'NONE',
      message: 'CIVIC GRID NOMINAL',
    };

    if (weather.currentWeather === 'HEAVY_RAIN' || weather.lightningFlash > 0.2) {
      next = {
        active: true,
        level: 'CRITICAL',
        kind: 'STORM',
        message: 'ELECTRICAL STORM ADVISORY // ELEVATED WIND SHEAR',
      };
    } else if (weather.currentWeather === 'FOG') {
      next = {
        active: true,
        level: 'ADVISORY',
        kind: 'VISIBILITY',
        message: 'LOW VISIBILITY CORRIDOR // OPTICAL BEACONS ENGAGED',
      };
    } else if (time.isNight && (time.hours >= 23 || time.hours < 4)) {
      next = {
        active: true,
        level: 'ADVISORY',
        kind: 'CURFEW',
        message: 'NOCTURNAL TRANSIT SCHEDULE // LOW-POWER SECTOR LIGHTING',
      };
    }

    const sig = `${next.kind}:${next.level}`;
    if (sig === this.lastSignature) return;
    this.lastSignature = sig;
    this.state = next;

    if (next.active) {
      AudioManager.getInstance().playAlertChime();
      SaveSystem.getInstance().recordHistory(`alert_${sig}`, `CITY ADVISORY // ${next.kind}`, next.message);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('nexus:notification', {
            detail: { title: `CIVIC ADVISORY // ${next.level}`, message: next.message, type: 'alert', duration: 3600 },
          })
        );
      }
    }
    this.listeners.forEach((l) => l(this.state));
  }

  public getState(): EmergencyState {
    return this.state;
  }

  public subscribe(listener: EmergencyListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }
}
