import { AudioManager } from '../audio/AudioManager';
import { DistrictType } from '../city/DistrictGenerator';
import { SaveSystem } from '../core/SaveSystem';

export type LivingCityEventType = 'NONE' | 'POWER_OUTAGE' | 'PUBLIC_FESTIVAL' | 'CORPORATE_LOCKDOWN';
export type LivingCityEventPhase = 'IDLE' | 'ACTIVE' | 'RECOVERY';

export interface LivingCityEventState {
  id: string;
  type: LivingCityEventType;
  phase: LivingCityEventPhase;
  district: DistrictType;
  title: string;
  message: string;
  remainingSeconds: number;
  lightScale: number;
  trafficSpeedMultiplier: number;
}

type EventListener = (state: LivingCityEventState) => void;

const EVENT_CYCLE: Array<Omit<LivingCityEventState, 'id' | 'phase' | 'remainingSeconds'>> = [
  {
    type: 'POWER_OUTAGE',
    district: 'INDUSTRIAL_DISTRICT',
    title: 'SECTOR GRID DROP // INDUSTRIAL FOUNDRY',
    message: 'Substation load shedding in progress; backup sodium beacons active.',
    lightScale: 0.35,
    trafficSpeedMultiplier: 0.65,
  },
  {
    type: 'PUBLIC_FESTIVAL',
    district: 'CENTRAL_CITY',
    title: 'NEXUS NIGHT MARKET // CITY BROADCAST',
    message: 'Central Plaza illuminated for the civic architectural biennial.',
    lightScale: 1.25,
    trafficSpeedMultiplier: 0.78,
  },
  {
    type: 'CORPORATE_LOCKDOWN',
    district: 'NEURAL_DISTRICT',
    title: 'SECURITY CONTAINMENT // NEURAL SECTOR',
    message: 'Quantum data perimeter restricted; transit speed throttled.',
    lightScale: 0.75,
    trafficSpeedMultiplier: 0.55,
  },
];

export class LivingCityEventSystem {
  private static instance: LivingCityEventSystem;
  private timer = 0;
  private cycleIndex = 0;
  private listeners = new Set<EventListener>();
  private state: LivingCityEventState = {
    id: 'idle',
    type: 'NONE',
    phase: 'IDLE',
    district: 'CENTRAL_CITY',
    title: 'METROPOLITAN SYSTEMS NOMINAL',
    message: 'All civic sectors operating within standard parameters.',
    remainingSeconds: 22,
    lightScale: 1,
    trafficSpeedMultiplier: 1,
  };

  private constructor() {}

  public static getInstance(): LivingCityEventSystem {
    if (!LivingCityEventSystem.instance) {
      LivingCityEventSystem.instance = new LivingCityEventSystem();
    }
    return LivingCityEventSystem.instance;
  }

  public update(delta: number): void {
    this.timer += Math.min(Math.max(delta, 0), 0.25);
    const slot = this.timer % 78;
    const cycleCount = Math.floor(this.timer / 78);
    this.cycleIndex = cycleCount % EVENT_CYCLE.length;
    const spec = EVENT_CYCLE[this.cycleIndex];

    const nextPhase: LivingCityEventPhase = slot < 18 ? 'IDLE' : slot < 39 ? 'ACTIVE' : 'RECOVERY';
    const nextRemaining = Math.ceil(slot < 18 ? 18 - slot : slot < 39 ? 39 - slot : 78 - slot);
    const nextType: LivingCityEventType = nextPhase === 'IDLE' ? 'NONE' : spec.type;
    const nextId = nextPhase === 'IDLE' ? 'idle' : `${spec.type.toLowerCase()}_${cycleCount}_${nextPhase.toLowerCase()}`;

    if (this.state.id === nextId && this.state.remainingSeconds === nextRemaining) return;

    const changedPhase = this.state.id !== nextId;
    this.state =
      nextPhase === 'IDLE'
        ? {
            id: nextId,
            type: 'NONE',
            phase: 'IDLE',
            district: 'CENTRAL_CITY',
            title: 'METROPOLITAN SYSTEMS NOMINAL',
            message: 'All civic sectors operating within standard parameters.',
            remainingSeconds: nextRemaining,
            lightScale: 1,
            trafficSpeedMultiplier: 1,
          }
        : {
            ...spec,
            id: nextId,
            type: nextType,
            phase: nextPhase,
            remainingSeconds: nextRemaining,
            lightScale: nextPhase === 'RECOVERY' ? 0.92 : spec.lightScale,
            trafficSpeedMultiplier: nextPhase === 'RECOVERY' ? 0.9 : spec.trafficSpeedMultiplier,
          };

    if (changedPhase && nextPhase !== 'IDLE') {
      const summary = nextPhase === 'ACTIVE' ? this.state.message : `${this.state.district} restoring normal operations.`;
      AudioManager.getInstance().playAlertChime();
      SaveSystem.getInstance().recordHistory(`event_${nextId}`, this.state.title, summary);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('nexus:notification', {
            detail: { title: this.state.title, message: summary, type: 'event', duration: 4200 },
          })
        );
      }
    }
    this.listeners.forEach((l) => l(this.state));
  }

  public getState(): LivingCityEventState {
    return this.state;
  }

  public subscribe(listener: EventListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }
}
