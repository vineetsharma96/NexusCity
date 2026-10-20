import * as THREE from 'three';

export interface InteractiveEntity {
  id: string;
  name: string;
  actionText: string;
  position: THREE.Vector3;
  radius: number;
  onInteract: () => void;
}

type InteractionListener = (active: InteractiveEntity | null) => void;

export class InteractionSystem {
  private static instance: InteractionSystem;
  private entities = new Map<string, InteractiveEntity>();
  private activeEntity: InteractiveEntity | null = null;
  private listeners = new Set<InteractionListener>();

  private constructor() {}

  public static getInstance(): InteractionSystem {
    if (!InteractionSystem.instance) {
      InteractionSystem.instance = new InteractionSystem();
    }
    return InteractionSystem.instance;
  }

  public register(entity: InteractiveEntity): void {
    this.entities.set(entity.id, entity);
  }

  public unregister(id: string): void {
    this.entities.delete(id);
    if (this.activeEntity?.id === id) {
      this.activeEntity = null;
      this.notify();
    }
  }

  public updatePlayerPosition(playerPos: THREE.Vector3): void {
    let closest: InteractiveEntity | null = null;
    let minDistSq = Infinity;

    for (const entity of this.entities.values()) {
      const rSq = entity.radius * entity.radius;
      const distSq = playerPos.distanceToSquared(entity.position);
      if (distSq <= rSq && distSq < minDistSq) {
        minDistSq = distSq;
        closest = entity;
      }
    }

    if (closest?.id !== this.activeEntity?.id || closest?.actionText !== this.activeEntity?.actionText) {
      this.activeEntity = closest;
      this.notify();
    }
  }

  public triggerInteract(): boolean {
    if (this.activeEntity) {
      this.activeEntity.onInteract();
      return true;
    }
    return false;
  }

  public getActive(): InteractiveEntity | null {
    return this.activeEntity;
  }

  public subscribe(listener: InteractionListener): () => void {
    this.listeners.add(listener);
    listener(this.activeEntity);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((l) => l(this.activeEntity));
  }
}
