import { DistrictType } from '../city/DistrictGenerator';
import { SaveSystem, MissionStatus, SavedMissionState } from '../core/SaveSystem';
import { LivingCityEventState } from '../world/LivingCityEventSystem';

export type MissionObjective = 'TALK' | 'VISIT_DISTRICT' | 'WITNESS_EVENT';
export type FactionId = 'CIVIC_DIRECTORATE' | 'HELIX_SYNDICATE' | 'FREE_RUNNERS' | 'VERDANT_ASSEMBLY';

export interface MissionDefinition {
  id: string;
  title: string;
  briefing: string;
  objective: MissionObjective;
  target: string;
  targetLabel: string;
  district: DistrictType;
  faction: FactionId;
  reward: number;
}

export interface MissionView extends MissionDefinition {
  status: MissionStatus;
  progress: number;
}

export interface MissionSystemState {
  missions: MissionView[];
  active: MissionView | null;
  districtReputation: Record<string, number>;
  factionRelations: Record<string, number>;
}

type MissionListener = (state: MissionSystemState) => void;

const DEFINITIONS: MissionDefinition[] = [
  { id: 'phase3_civic_signal', title: 'SIGNAL THROUGH THE STATIC', briefing: 'The Directorate needs a live read from the city core. Talk to any resident and relay what you learn.', objective: 'TALK', target: 'ANY_NPC', targetLabel: 'Speak with a resident', district: 'CENTRAL_CITY', faction: 'CIVIC_DIRECTORATE', reward: 8 },
  { id: 'phase3_neural_crossing', title: 'COLD ROUTE // NEURAL', briefing: 'A courier route has gone dark. Reach the Neural District and verify that its beacons are still online.', objective: 'VISIT_DISTRICT', target: 'NEURAL_DISTRICT', targetLabel: 'Reach Neural District', district: 'NEURAL_DISTRICT', faction: 'FREE_RUNNERS', reward: 10 },
  { id: 'phase3_grid_witness', title: 'WHEN THE GRID BLINKS', briefing: 'Helix wants an eyewitness account of a live infrastructure event. Stay alert for the next city broadcast.', objective: 'WITNESS_EVENT', target: 'POWER_OUTAGE', targetLabel: 'Witness a power outage', district: 'INDUSTRIAL_DISTRICT', faction: 'HELIX_SYNDICATE', reward: 12 },
  { id: 'phase3_green_protocol', title: 'ROOTS UNDER CONCRETE', briefing: 'The Verdant Assembly is mapping public gardens. Visit the biosphere sector and add your presence to the survey.', objective: 'VISIT_DISTRICT', target: 'GREEN_DISTRICT', targetLabel: 'Reach Biosphere Green District', district: 'GREEN_DISTRICT', faction: 'VERDANT_ASSEMBLY', reward: 10 },
];

/** Phase 3's compact mission loop. Definitions are fixed for seed #847291; state is save-backed. */
export class MissionSystem {
  private static instance: MissionSystem;
  private readonly save = SaveSystem.getInstance();
  private readonly definitions = DEFINITIONS;
  private listeners = new Set<MissionListener>();
  private state: MissionSystemState;
  private lastEventId: string | null = null;

  private constructor() {
    const data = this.save.getData();
    this.state = this.compose(data.missionStates || {}, data.districtReputation || {}, data.factionRelations || {});
  }

  public static getInstance(): MissionSystem {
    if (!MissionSystem.instance) MissionSystem.instance = new MissionSystem();
    return MissionSystem.instance;
  }

  public getState(): MissionSystemState { return this.state; }
  public subscribe(listener: MissionListener): () => void { this.listeners.add(listener); listener(this.state); return () => this.listeners.delete(listener); }

  public acceptMission(id: string): boolean {
    const mission = this.state.missions.find((entry) => entry.id === id);
    if (!mission || mission.status !== 'AVAILABLE' || this.state.active) return false;
    this.save.setMissionState({ id, status: 'ACCEPTED', progress: 0, updatedAt: Date.now() });
    this.save.recordHistory(`mission_accept_${id}`, `MISSION ACCEPTED // ${mission.title}`, mission.briefing);
    this.refresh();
    this.notify(`MISSION ACCEPTED // ${mission.title}`, mission.targetLabel);
    return true;
  }

  public recordInteraction(): void {
    const active = this.state.active;
    if (active?.objective === 'TALK') this.complete(active);
  }

  public update(currentDistrict: DistrictType, event: LivingCityEventState): void {
    const active = this.state.active;
    if (!active) return;
    if (active.objective === 'VISIT_DISTRICT' && active.target === currentDistrict) this.complete(active);
    if (active.objective === 'WITNESS_EVENT' && event.phase === 'ACTIVE' && event.type === active.target && event.id !== this.lastEventId) {
      this.lastEventId = event.id;
      this.complete(active);
    }
  }

  private complete(mission: MissionView): void {
    this.save.setMissionState({ id: mission.id, status: 'COMPLETED', progress: 1, updatedAt: Date.now() });
    this.save.setReputation(mission.district, (this.state.districtReputation[mission.district] || 0) + mission.reward);
    this.save.setFactionRelation(mission.faction, (this.state.factionRelations[mission.faction] || 0) + mission.reward);
    this.save.recordHistory(`mission_complete_${mission.id}`, `MISSION COMPLETE // ${mission.title}`, `Faction standing increased: ${mission.faction.replaceAll('_', ' ')} +${mission.reward}.`);
    this.refresh();
    this.notify(`MISSION COMPLETE // ${mission.title}`, `DISTRICT REP +${mission.reward} // FACTION +${mission.reward}`);
  }

  private refresh(): void {
    const data = this.save.getData();
    this.state = this.compose(data.missionStates || {}, data.districtReputation || {}, data.factionRelations || {});
    this.listeners.forEach((listener) => listener(this.state));
  }

  private compose(saved: Record<string, SavedMissionState>, districtReputation: Record<string, number>, factionRelations: Record<string, number>): MissionSystemState {
    const missions = this.definitions.map((definition) => ({ ...definition, status: saved[definition.id]?.status || 'AVAILABLE', progress: saved[definition.id]?.progress || 0 }));
    return { missions, active: missions.find((mission) => mission.status === 'ACCEPTED') || null, districtReputation, factionRelations };
  }

  private notify(title: string, message: string): void {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('nexus:notification', { detail: { title, message, type: 'system', duration: 4200 } }));
  }
}
