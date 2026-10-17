import { SaveSystem } from '../core/SaveSystem';

export type LivingCityEventType =
  | 'PUBLIC_FESTIVAL'
  | 'POWER_OUTAGE'
  | 'INFRASTRUCTURE_FAILURE'
  | 'CORPORATE_LOCKDOWN';
export type LivingCityEventPhase = 'IDLE' | 'ACTIVE' | 'RECOVERY';

export interface LivingCityEventState {
  phase: LivingCityEventPhase;
  type: LivingCityEventType | null;
  id: string | null;
  title: string;
  message: string;
  district: string;
  elapsed: number;
  duration: number;
  intensity: number;
}

interface EventDefinition {
  type: LivingCityEventType;
  title: string;
  message: string;
  district: string;
  duration: number;
  recovery: number;
}

type LivingCityEventListener = (state: LivingCityEventState) => void;

/**
 * Small, deterministic city director. The timeline is driven by simulation time,
 * never wall-clock time or random values, so every run produces the same city beat.
 */
export class LivingCityEventSystem {
  private static instance: LivingCityEventSystem;
  private readonly cycle: EventDefinition[] = [
    { type: 'PUBLIC_FESTIVAL', title: 'NEXUS NIGHT MARKET', message: 'Public festival traffic is moving toward Central Plaza.', district: 'CENTRAL METROPOLIS', duration: 18, recovery: 14 },
    { type: 'POWER_OUTAGE', title: 'GRID EVENT // OUTER SECTOR', message: 'A controlled power outage is isolating non-critical lighting. Grid crews are responding.', district: 'INDUSTRIAL REACTOR ZONE', duration: 12, recovery: 16 },
    { type: 'CORPORATE_LOCKDOWN', title: 'CORPORATE LOCKDOWN', message: 'Apex Tower has sealed its perimeter. Corporate broadcast channels are overriding local ads.', district: 'CENTRAL METROPOLIS', duration: 16, recovery: 12 },
    { type: 'INFRASTRUCTURE_FAILURE', title: 'INFRASTRUCTURE FAILURE', message: 'Transit conduit pressure is unstable. Avoid the east interchange until service recovers.', district: 'NEURAL DISTRICT', duration: 14, recovery: 15 },
  ];
  private elapsed = 0;
  private state: LivingCityEventState = this.idleState();
  private listeners = new Set<LivingCityEventListener>();
  private lastEventId: string | null = null;

  private constructor() {}

  public static getInstance(): LivingCityEventSystem {
    if (!LivingCityEventSystem.instance) LivingCityEventSystem.instance = new LivingCityEventSystem();
    return LivingCityEventSystem.instance;
  }

  public getState(): LivingCityEventState { return this.state; }

  public subscribe(listener: LivingCityEventListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  public update(delta: number): void {
    if (!Number.isFinite(delta) || delta <= 0) return;
    this.elapsed += Math.min(delta, 0.25);
    const cycleLength = this.cycle.reduce((total, event) => total + event.duration + event.recovery, 0);
    const cycleTime = this.elapsed % cycleLength;
    let cursor = 0;
    let eventIndex = -1;
    let phase: LivingCityEventPhase = 'IDLE';
    let eventElapsed = 0;
    for (let i = 0; i < this.cycle.length; i += 1) {
      const event = this.cycle[i];
      if (cycleTime < cursor + event.duration) {
        eventIndex = i;
        phase = 'ACTIVE';
        eventElapsed = cycleTime - cursor;
        break;
      }
      cursor += event.duration;
      if (cycleTime < cursor + event.recovery) {
        eventIndex = i;
        phase = 'RECOVERY';
        eventElapsed = cycleTime - (cursor - event.duration);
        break;
      }
      cursor += event.recovery;
    }

    const next = eventIndex < 0 ? this.idleState() : this.stateFor(this.cycle[eventIndex], eventIndex, phase, eventElapsed, Math.floor(this.elapsed / cycleLength));
    if (next.id === this.state.id && next.phase === this.state.phase) {
      this.state = next;
      return;
    }
    const previous = this.state;
    this.state = next;
    this.listeners.forEach((listener) => listener(next));
    if (next.phase === 'ACTIVE' && next.id !== previous.id) this.announce(next);
    if (next.phase === 'RECOVERY' && previous.phase === 'ACTIVE') this.announceRecovery(next);
  }

  private stateFor(event: EventDefinition, index: number, phase: LivingCityEventPhase, elapsed: number, cycleIndex: number): LivingCityEventState {
    const id = `living_event_${cycleIndex}_${index}`;
    return { phase, type: event.type, id, title: event.title, message: event.message, district: event.district, elapsed, duration: event.duration, intensity: phase === 'ACTIVE' ? 1 : Math.max(0, 1 - Math.max(0, elapsed - event.duration) / event.recovery) };
  }

  private idleState(): LivingCityEventState {
    return { phase: 'IDLE', type: null, id: null, title: '', message: '', district: '', elapsed: 0, duration: 0, intensity: 0 };
  }

  private announce(state: LivingCityEventState): void {
    if (!state.id || this.lastEventId === state.id) return;
    this.lastEventId = state.id;
    SaveSystem.getInstance().recordHistory(state.id, `${state.title} // CITY EVENT`, state.message);
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('nexus:notification', { detail: { title: `${state.title} // CITY BROADCAST`, message: state.message, type: state.type === 'POWER_OUTAGE' ? 'warning' : 'system', duration: 4600 } }));
  }

  private announceRecovery(state: LivingCityEventState): void {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('nexus:notification', { detail: { title: `${state.title} // RECOVERY`, message: 'Infrastructure crews have stabilized the affected service. Normal operations are resuming.', type: 'system', duration: 3000 } }));
  }
}
