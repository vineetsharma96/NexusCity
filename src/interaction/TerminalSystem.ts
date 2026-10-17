import * as THREE from 'three';
import { AudioManager } from '../audio/AudioManager';
import { SaveSystem, SavedTerminalObjective } from '../core/SaveSystem';
import { InteractionSystem } from './InteractionSystem';

export interface TerminalNode {
  id: string;
  name: string;
  position: THREE.Vector3;
  district: string;
  objective?: {
    id: string;
    title: string;
    detail: string;
    kind: 'LORE' | 'SCAN' | 'MISSION';
  };
}

export class TerminalSystem {
  private static instance: TerminalSystem;
  private terminals = new Map<string, TerminalNode>();
  private objectives = new Map<string, SavedTerminalObjective>();
  private listeners = new Set<(objectives: SavedTerminalObjective[]) => void>();

  private constructor() {
    const saved = SaveSystem.getInstance().getTerminalObjectives();
    Object.values(saved).forEach((entry) => this.objectives.set(entry.terminalId, entry));
  }

  public static getInstance(): TerminalSystem {
    if (!TerminalSystem.instance) {
      TerminalSystem.instance = new TerminalSystem();
    }
    return TerminalSystem.instance;
  }

  public register(node: TerminalNode): void {
    this.terminals.set(node.id, node);
    InteractionSystem.getInstance().register({
      id: `terminal_${node.id}`,
      name: node.name,
      actionText: `SCAN ${node.name.toUpperCase()}`,
      position: node.position,
      radius: 3.4,
      onInteract: () => this.activate(node),
    });
  }

  public unregister(id: string): void {
    this.terminals.delete(id);
    InteractionSystem.getInstance().unregister(`terminal_${id}`);
  }

  private activate(node: TerminalNode): void {
    for (const [key, existing] of this.objectives.entries()) {
      if (key !== node.id && existing.active) {
        this.objectives.set(key, { ...existing, active: false });
      }
    }

    const objective: SavedTerminalObjective = {
      terminalId: node.id,
      objectiveId: node.objective?.id ?? `scan_${node.id}`,
      title: node.objective?.title ?? `${node.district} TELEMETRY SYNC`,
      detail: node.objective?.detail ?? `${node.name} linked in ${node.district} sector.`,
      kind: node.objective?.kind ?? 'SCAN',
      revealed: true,
      active: true,
      updatedAt: Date.now(),
    };

    this.objectives.set(node.id, objective);
    SaveSystem.getInstance().recordNodeInteraction(node.id);
    SaveSystem.getInstance().setTerminalObjective(objective);
    SaveSystem.getInstance().recordHistory(`terminal_${node.id}`, objective.title, objective.detail);
    AudioManager.getInstance().playUI('waypoint');

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('nexus:notification', {
          detail: { title: objective.title, message: objective.detail, type: 'terminal', duration: 3600 },
        })
      );
    }
    this.notify();
  }

  public getObjectives(): SavedTerminalObjective[] {
    return Array.from(this.objectives.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  public getActiveObjective(): SavedTerminalObjective | null {
    return this.getObjectives().find((item) => item.active) ?? this.getObjectives()[0] ?? null;
  }

  public subscribe(listener: (objectives: SavedTerminalObjective[]) => void): () => void {
    this.listeners.add(listener);
    listener(this.getObjectives());
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const list = this.getObjectives();
    this.listeners.forEach((l) => l(list));
  }
}
