import * as THREE from 'three';
import { InteractionSystem } from './InteractionSystem';
import { SaveSystem, TerminalObjectiveRecord } from '../core/SaveSystem';
import { WeatherSystem } from '../world/WeatherSystem';
import { EmergencyAlertSystem } from '../world/EmergencyAlertSystem';
import { LivingCityEventSystem } from '../world/LivingCityEventSystem';

export interface TerminalDefinition {
  id: string;
  name: string;
  position: THREE.Vector3;
  district: string;
}

type TerminalListener = (objective: TerminalObjectiveRecord | null) => void;

/** Lightweight deterministic bridge between world state and interactive terminals. */
export class TerminalSystem {
  private static instance: TerminalSystem;
  private readonly terminals = new Map<string, TerminalDefinition>();
  private readonly listeners = new Set<TerminalListener>();
  private activeObjective: TerminalObjectiveRecord | null = null;

  private constructor() {
    const saved = Object.values(SaveSystem.getInstance().getTerminalObjectives());
    // Event responses belong to a simulation session; persistent telemetry
    // objectives can resume when the operative returns to the city.
    this.activeObjective = saved.filter((record) => record.active && record.revealed && record.kind === 'MISSION').sort((a, b) => b.updatedAt - a.updatedAt)[0] || null;
  }

  public static getInstance(): TerminalSystem {
    if (!TerminalSystem.instance) TerminalSystem.instance = new TerminalSystem();
    return TerminalSystem.instance;
  }

  public register(definition: TerminalDefinition): void {
    this.terminals.set(definition.id, definition);
    InteractionSystem.getInstance().register({
      id: definition.id,
      name: definition.name,
      actionText: 'ACCESS CITY TERMINAL',
      position: definition.position,
      radius: 2.8,
      onInteract: () => this.interact(definition),
    });
  }

  public unregister(id: string): void {
    this.terminals.delete(id);
    InteractionSystem.getInstance().unregister(id);
  }

  public update(): void {
    const objective = this.activeObjective;
    const event = LivingCityEventSystem.getInstance().getState();
    if (objective?.kind === 'EVENT' && (!event.id || event.id !== objective.eventId || event.phase !== 'ACTIVE')) {
      this.activeObjective = null;
      SaveSystem.getInstance().setTerminalObjective({ ...objective, active: false, updatedAt: Date.now() });
      this.listeners.forEach((listener) => listener(null));
    }
  }

  public getActiveObjective(): TerminalObjectiveRecord | null { return this.activeObjective; }

  public subscribe(listener: TerminalListener): () => void {
    this.listeners.add(listener);
    listener(this.activeObjective);
    return () => this.listeners.delete(listener);
  }

  private interact(terminal: TerminalDefinition): void {
    const event = LivingCityEventSystem.getInstance().getState();
    const alert = EmergencyAlertSystem.getInstance().getState();
    const weather = WeatherSystem.getInstance().getState().currentWeather;
    const eventObjective = event.phase === 'ACTIVE' && event.id
      ? { objectiveId: `${event.type?.toLowerCase() || 'city'}_${terminal.id}`, title: `${event.title} // RESPONSE`, detail: `Reach the ${event.district} response zone and monitor the temporary disruption.`, kind: 'EVENT' as const, eventId: event.id }
      : null;
    const weatherObjective = alert.active
      ? { objectiveId: `${alert.kind?.toLowerCase() || 'weather'}_${terminal.id}`, title: `${alert.kind} PROTOCOL`, detail: alert.message, kind: 'MISSION' as const }
      : null;
    const fallback = { objectiveId: `scan_${terminal.id}`, title: 'CITY TELEMETRY SCAN', detail: `Review ${terminal.district} telemetry and reveal the next route objective.`, kind: 'MISSION' as const };
    const selected = eventObjective || weatherObjective || fallback;
    const record: TerminalObjectiveRecord = { terminalId: terminal.id, ...selected, revealed: true, active: true, updatedAt: Date.now() };
    const previous = this.activeObjective;
    if (previous && previous.terminalId !== terminal.id) SaveSystem.getInstance().setTerminalObjective({ ...previous, active: false, updatedAt: Date.now() });
    this.activeObjective = record;
    SaveSystem.getInstance().setTerminalObjective(record);
    SaveSystem.getInstance().recordHistory(`terminal_${terminal.id}_${record.objectiveId}`, `${record.title} // OBJECTIVE`, record.detail);
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('nexus:notification', { detail: { title: `${terminal.name} // LINK ESTABLISHED`, message: `${record.title}: ${record.detail}`, type: record.kind === 'EVENT' ? 'warning' : 'system', duration: 4800 } }));
    this.listeners.forEach((listener) => listener(record));
  }
}
