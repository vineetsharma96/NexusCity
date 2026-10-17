import { WeatherState, WeatherSystem, WeatherType } from './WeatherSystem';
import { SaveSystem } from '../core/SaveSystem';

export type EmergencyKind = 'STORM' | 'FOG' | 'POWER';

export interface EmergencyState {
  active: boolean;
  kind: EmergencyKind | null;
  level: 'ADVISORY' | 'WARNING';
  message: string;
}

type EmergencyListener = (state: EmergencyState) => void;

/** Deterministic, edge-triggered public safety alerts derived from weather. */
export class EmergencyAlertSystem {
  private static instance: EmergencyAlertSystem;
  private state: EmergencyState = { active: false, kind: null, level: 'ADVISORY', message: '' };
  private listeners = new Set<EmergencyListener>();
  private unsubscribeWeather: (() => void) | null = null;

  private constructor() {}

  public static getInstance(): EmergencyAlertSystem {
    if (!EmergencyAlertSystem.instance) EmergencyAlertSystem.instance = new EmergencyAlertSystem();
    return EmergencyAlertSystem.instance;
  }

  public start(): void {
    if (this.unsubscribeWeather) return;
    this.unsubscribeWeather = WeatherSystem.getInstance().subscribe((weather) => this.evaluate(weather));
  }

  public stop(): void {
    this.unsubscribeWeather?.();
    this.unsubscribeWeather = null;
  }

  public getState(): EmergencyState { return this.state; }

  public subscribe(listener: EmergencyListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private evaluate(weather: WeatherState): void {
    const next = this.stateForWeather(weather.currentWeather);
    if (next.kind === this.state.kind && next.active === this.state.active) return;
    const previous = this.state;
    this.state = next;
    this.listeners.forEach((listener) => listener(next));

    if (typeof window !== 'undefined' && next.active) {
      SaveSystem.getInstance().recordHistory(
        `emergency_${next.kind}_${Date.now()}`,
        `${next.kind} ALERT LOGGED`,
        next.message,
      );
      window.dispatchEvent(new CustomEvent('nexus:notification', {
        detail: {
          title: `${next.kind} ALERT // CITYWIDE BROADCAST`,
          message: next.message,
          type: 'warning',
          duration: 5200,
        },
      }));
    } else if (typeof window !== 'undefined' && previous.active) {
      window.dispatchEvent(new CustomEvent('nexus:notification', {
        detail: { title: 'EMERGENCY STATUS // STANDBY', message: 'Public safety channels returning to normal operations.', type: 'system', duration: 3200 },
      }));
    }
  }

  private stateForWeather(weather: WeatherType): EmergencyState {
    switch (weather) {
      case 'HEAVY_RAIN':
        return { active: true, kind: 'STORM', level: 'WARNING', message: 'Seek covered routes. High winds and lightning detected across the metro grid.' };
      case 'FOG':
        return { active: true, kind: 'FOG', level: 'ADVISORY', message: 'Visibility reduced. Aerial lanes and high-speed transit operating at limited speed.' };
      case 'RAIN':
        return { active: true, kind: 'POWER', level: 'ADVISORY', message: 'Wet-weather power load protocol active. Expect brief grid fluctuations in outer sectors.' };
      default:
        return { active: false, kind: null, level: 'ADVISORY', message: '' };
    }
  }
}
