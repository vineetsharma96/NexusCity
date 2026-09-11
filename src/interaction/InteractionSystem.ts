import * as THREE from 'three';

export interface InteractiveEntity {
  id: string;
  name: string;
  actionText: string;
  position: THREE.Vector3;
  radius: number;
  onInteract: () => void;
}

type InteractionChangeListener = (active: InteractiveEntity | null) => void;

export class InteractionSystem {
  private static instance: InteractionSystem;
  private entities: Map<string, InteractiveEntity> = new Map();
  private activeEntity: InteractiveEntity | null = null;
  private listeners: Set<InteractionChangeListener> = new Set();

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
    let closestDistSq = Infinity;

    this.entities.forEach((entity) => {
      const distSq = playerPos.distanceToSquared(entity.position);
      const maxDistSq = entity.radius * entity.radius;

      if (distSq <= maxDistSq && distSq < closestDistSq) {
        closest = entity;
        closestDistSq = distSq;
      }
    });

    if (closest !== this.activeEntity) {
      this.activeEntity = closest;
      this.notify();
    }
  }

  public getActive(): InteractiveEntity | null {
    return this.activeEntity;
  }

  public triggerInteract(): boolean {
    if (this.activeEntity) {
      this.activeEntity.onInteract();
      return true;
    }
    return false;
  }

  public subscribe(listener: InteractionChangeListener): () => void {
    this.listeners.add(listener);
    listener(this.activeEntity);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((l) => l(this.activeEntity));
  }
}
