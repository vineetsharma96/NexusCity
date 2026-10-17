import { SaveSystem } from '../core/SaveSystem';
import { TimeOfDayPhase, TimeSystem } from '../world/TimeSystem';
import { WeatherSystem, WeatherType } from '../world/WeatherSystem';
import { EmergencyAlertSystem } from '../world/EmergencyAlertSystem';
import { LivingCityEventSystem, LivingCityEventState } from '../world/LivingCityEventSystem';

export type NPCActivity = 'HOME' | 'COMMUTE' | 'WORK' | 'LEISURE' | 'NIGHT_PATROL' | 'SHELTER';

export interface LivingCitySnapshot {
  activity: NPCActivity;
  label: string;
  speedMultiplier: number;
  shouldWalk: boolean;
  weatherResponse: string;
  eventResponse: string;
}

/**
 * Coarse, deterministic population simulation. It only recalculates when the
 * simulation crosses a 15-minute game bucket or the weather target changes.
 */
export class LivingCitySystem {
  private static instance: LivingCitySystem;
  private lastBucket = -1;
  private lastWeather: WeatherType | null = null;
  private lastAlertKey = '';
  private activeEvent: LivingCityEventState = LivingCityEventSystem.getInstance().getState();
  private lastBroadcastKey = '';
  private snapshots = new Map<string, LivingCitySnapshot>();

  private constructor() {
    TimeSystem.getInstance().subscribe((state) => this.refresh(state.hour, state.phase));
    WeatherSystem.getInstance().subscribe((state) => this.refresh(TimeSystem.getInstance().getHour(), TimeSystem.getInstance().getState().phase, state.targetWeather));
    EmergencyAlertSystem.getInstance().subscribe(() => this.refresh(TimeSystem.getInstance().getHour(), TimeSystem.getInstance().getState().phase));
    LivingCityEventSystem.getInstance().subscribe((state) => { this.activeEvent = state; this.refresh(TimeSystem.getInstance().getHour(), TimeSystem.getInstance().getState().phase); });
  }

  public static getInstance(): LivingCitySystem {
    if (!LivingCitySystem.instance) LivingCitySystem.instance = new LivingCitySystem();
    return LivingCitySystem.instance;
  }

  public getSnapshot(npcId: string, role: string): LivingCitySnapshot {
    let snapshot = this.snapshots.get(npcId);
    if (!snapshot) {
      this.refresh(TimeSystem.getInstance().getHour(), TimeSystem.getInstance().getState().phase);
      snapshot = this.snapshots.get(npcId);
    }
    if (snapshot) return snapshot;
    const built = this.buildSnapshot(npcId, role, TimeSystem.getInstance().getHour(), WeatherSystem.getInstance().getState().targetWeather);
    this.snapshots.set(npcId, built);
    return built;
  }

  public getDialogueContext(npcId: string, role: string): string {
    const state = this.getSnapshot(npcId, role);
    return `[CITY RHYTHM] ${state.label}. ${state.weatherResponse}${state.eventResponse ? ` ${state.eventResponse}` : ''}`;
  }

  private refresh(hour: number, phase: TimeOfDayPhase, weather = WeatherSystem.getInstance().getState().targetWeather): void {
    const bucket = Math.floor(hour * 4);
    const alert = EmergencyAlertSystem.getInstance().getState();
    const alertKey = `${alert.active}:${alert.kind || ''}:${this.activeEvent.id || ''}:${this.activeEvent.phase}`;
    if (bucket === this.lastBucket && weather === this.lastWeather && alertKey === this.lastAlertKey) return;
    this.lastBucket = bucket;
    this.lastWeather = weather;
    this.lastAlertKey = alertKey;

    // NPCManager supplies the deterministic roster; snapshots are lazily built
    // there so this system never owns a second copy of the NPC data.
    this.snapshots.clear();
    if (this.lastBroadcastKey !== `${bucket}:${weather}`) {
      this.lastBroadcastKey = `${bucket}:${weather}`;
      const cityBeat = this.getCityBeat(hour, phase, weather);
      if (cityBeat) {
        SaveSystem.getInstance().recordHistory(`city_beat_${bucket}_${weather}`, 'CITY RHYTHM UPDATED', cityBeat);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('nexus:notification', {
            detail: { title: 'CITY RHYTHM', message: cityBeat, type: 'system', duration: 2200 },
          }));
        }
      }
    }
  }

  private buildSnapshot(npcId: string, role: string, hour: number, weather: WeatherType): LivingCitySnapshot {
    const offset = this.stableIndex(npcId, 4) * 0.25;
    const isPeacekeeper = /peacekeeper|officer|patrol/i.test(role);
    const isCourier = /courier|runner|transit/i.test(role);
    const commute = (hour >= 6 + offset && hour < 8.75 + offset) || (hour >= 16.25 + offset && hour < 19 + offset);
    const night = hour >= 21 || hour < 5.5;
    const severeWeather = weather === 'HEAVY_RAIN' || weather === 'FOG';
    const alert = EmergencyAlertSystem.getInstance().getState();
    const event = this.activeEvent;
    const eventResponse = event.phase === 'ACTIVE' ? `${event.title} is active in ${event.district}; citizens are rerouting around the response zone.` : '';

    if (event.phase === 'ACTIVE' && event.type === 'CORPORATE_LOCKDOWN' && !isPeacekeeper) {
      return { activity: 'SHELTER', label: 'Rerouting around a corporate lockdown', speedMultiplier: 0.7, shouldWalk: true, weatherResponse: 'Public channels are directing residents away from sealed perimeters.', eventResponse };
    }

    if (severeWeather && !isPeacekeeper && !isCourier && !night) {
      return { activity: 'SHELTER', label: 'Sheltering from the weather', speedMultiplier: 0.45, shouldWalk: false, weatherResponse: weather === 'FOG' ? 'Visibility is low; residents are keeping to covered concourses.' : 'Storm cells are moving through; residents are waiting under awnings.', eventResponse };
    }
    if (isPeacekeeper && night) return { activity: 'NIGHT_PATROL', label: 'On the night patrol circuit', speedMultiplier: 1.08, shouldWalk: true, weatherResponse: severeWeather ? 'Patrol beacons are active through the reduced visibility.' : 'Night patrols are keeping the avenue crossings clear.', eventResponse };
    if (commute) return { activity: 'COMMUTE', label: isCourier ? 'Making a delivery run' : 'Commuting between districts', speedMultiplier: isCourier ? 1.18 : 1, shouldWalk: true, weatherResponse: weather === 'RAIN' ? 'The commute is slower on wet pavement.' : 'The morning and evening flow is gathering around transit corridors.', eventResponse };
    if (night) return { activity: 'HOME', label: 'Winding down in the residential sectors', speedMultiplier: 0.55, shouldWalk: false, weatherResponse: 'Most residents are off the main avenues for the night.', eventResponse };
    if (hour >= 9 && hour < 16) return { activity: 'WORK', label: 'Working the daytime shift', speedMultiplier: alert.active ? 0.78 : 0.9, shouldWalk: true, weatherResponse: weather === 'RAIN' ? 'Covered routes are preferred during the rain.' : 'Daytime services are operating at full capacity.', eventResponse };
    return { activity: 'LEISURE', label: 'Circulating through local plazas', speedMultiplier: 0.8, shouldWalk: true, weatherResponse: 'The population is gathering around illuminated public spaces.', eventResponse };
  }

  private getCityBeat(hour: number, phase: TimeOfDayPhase, weather: WeatherType): string | null {
    if (weather === 'HEAVY_RAIN') return 'A storm front is changing pedestrian routes; most citizens are sheltering while peacekeepers hold their patrols.';
    if (weather === 'FOG') return 'Dense fog is shifting foot traffic toward beacon-lit avenues and covered transit links.';
    if (hour >= 6 && hour < 9) return 'Morning commute lanes are opening across the city.';
    if (hour >= 21 || hour < 5.5) return 'Night patrols are active while most residents return home.';
    if (phase === 'GOLDEN_HOUR' || phase === 'SUNSET') return 'Evening commuters are trading places with plaza crowds as the city lights rise.';
    return null;
  }

  private stableIndex(value: string, length: number): number {
    let hash = 0;
    for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) | 0;
    return Math.abs(hash) % length;
  }
}
