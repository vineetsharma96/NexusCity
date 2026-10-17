import * as THREE from 'three';
import { InteractionSystem, InteractiveEntity } from '../interaction/InteractionSystem';
import { InputManager } from '../player/InputManager';
import { KinematicCollisionSolver } from '../player/KinematicCollision';
import { SaveSystem, VehicleUpgrades } from '../core/SaveSystem';

export type VehicleMode = 'ON_FOOT' | 'RIDING' | 'TRANSIT_LINKED';
export interface VehicleState {
  mode: VehicleMode;
  vehicleId: string | null;
  upgrades: VehicleUpgrades;
  vehiclePosition: [number, number, number];
  vehicleRotationY: number;
}

type VehicleListener = (state: VehicleState) => void;
const DEFAULT_UPGRADES: VehicleUpgrades = { speed: 0, handling: 0, neon: 0 };
const UP = new THREE.Vector3(0, 1, 0);

export class VehicleInteractionSystem {
  private static instance: VehicleInteractionSystem;
  private state: VehicleState;
  private listeners = new Set<VehicleListener>();
  private vehicleEntities = new Map<string, InteractiveEntity>();
  private vehiclePosition = new THREE.Vector3(4.5, 0.45, 10);
  private transitPosition = new THREE.Vector3(-7, 0.62, 10);
  private vehicleRotationY = 0;
  private transitRotationY = 0;
  private dismountPosition = new THREE.Vector3(0, 0.2, 10);

  private constructor() {
    const saved = SaveSystem.getInstance().getData().vehicleUpgrades;
    this.state = { mode: 'ON_FOOT', vehicleId: null, upgrades: { ...DEFAULT_UPGRADES, ...(saved || {}) }, vehiclePosition: [4.5, 0.45, 10], vehicleRotationY: 0 };
  }

  public static getInstance(): VehicleInteractionSystem { return this.instance || (this.instance = new VehicleInteractionSystem()); }

  public registerRideable(id: string, name: string, position: THREE.Vector3, kind: 'vehicle' | 'transit'): void {
    const entity: InteractiveEntity = { id, name, actionText: kind === 'vehicle' ? 'ENTER HOVER VEHICLE' : 'LINK TO TRANSIT NODE', position: position.clone(), radius: kind === 'vehicle' ? 4.5 : 3.5, onInteract: () => this.interact(id, kind) };
    this.vehicleEntities.set(id, entity);
    InteractionSystem.getInstance().register(entity);
  }

  public unregisterRideable(id: string): void {
    if (this.state.vehicleId === id) this.dismount();
    this.vehicleEntities.delete(id);
    InteractionSystem.getInstance().unregister(id);
  }

  public syncRideablePosition(id: string, position: THREE.Vector3): void {
    this.vehicleEntities.get(id)?.position.copy(position);
  }

  public syncTransitPosition(position: THREE.Vector3, rotationY: number): void {
    this.transitPosition.copy(position);
    this.transitRotationY = rotationY;
    if (this.state.mode === 'TRANSIT_LINKED' && this.state.vehicleId) {
      this.syncRideablePosition(this.state.vehicleId, position);
      this.state = { ...this.state, vehicleRotationY: rotationY };
    }
  }

  public getState(): VehicleState { return this.state; }
  public getVehiclePosition(): THREE.Vector3 { return this.vehiclePosition; }
  public getMountedPosition(): THREE.Vector3 {
    return (this.state.mode === 'TRANSIT_LINKED' ? this.transitPosition : this.vehiclePosition).clone().add(new THREE.Vector3(0, 0.82, 0));
  }

  public getDismountPosition(): THREE.Vector3 {
    if (this.state.mode === 'ON_FOOT') return this.dismountPosition.clone();
    const position = this.state.mode === 'TRANSIT_LINKED' ? this.transitPosition : this.vehiclePosition;
    const rotation = this.state.mode === 'TRANSIT_LINKED' ? this.transitRotationY : this.vehicleRotationY;
    const origin = position.clone().add(new THREE.Vector3(2.4, 0, 0).applyAxisAngle(UP, rotation));
    return KinematicCollisionSolver.findSafePosition(origin, 0.45, 1.8);
  }

  public subscribe(listener: VehicleListener): () => void { this.listeners.add(listener); listener(this.state); return () => this.listeners.delete(listener); }

  public cycleUpgrade(upgrade: keyof VehicleUpgrades): void {
    const next = ((this.state.upgrades[upgrade] || 0) + 1) % 4;
    this.state = { ...this.state, upgrades: { ...this.state.upgrades, [upgrade]: next } };
    SaveSystem.getInstance().setVehicleUpgrades(this.state.upgrades);
    this.notify();
    this.notifyUser('VEHICLE CONFIGURATION', `${upgrade.toUpperCase()} UPGRADE LEVEL ${next}/3.`);
  }

  public toggleUpgrade(upgrade: keyof VehicleUpgrades): void { this.cycleUpgrade(upgrade); }
  public getMovementMultiplier(): number { return this.state.mode === 'RIDING' ? 1 + this.state.upgrades.speed * 0.12 : 1; }

  public updateMounted(delta: number, cameraYaw: number): void {
    if (this.state.mode !== 'RIDING' || !Number.isFinite(delta) || delta <= 0) return;
    const step = Math.min(delta, 0.05);
    const input = InputManager.getState();
    const direction = new THREE.Vector3(input.moveX, 0, input.moveZ);
    if (direction.lengthSq() > 1) direction.normalize();
    direction.applyAxisAngle(UP, cameraYaw);
    const speed = (input.sprint ? 24 : 16) * (1 + this.state.upgrades.speed * 0.12);
    const candidate = this.vehiclePosition.clone().addScaledVector(direction, speed * step);
    candidate.y = KinematicCollisionSolver.getGroundHeightAt(candidate.x, candidate.z, candidate.y).height + 0.45;
    this.vehiclePosition.copy(KinematicCollisionSolver.resolveHorizontal(candidate, 1.15, 1.4, this.vehiclePosition));
    if (direction.lengthSq() > 0.01) {
      const target = Math.atan2(direction.x, direction.z);
      const diff = Math.atan2(Math.sin(target - this.vehicleRotationY), Math.cos(target - this.vehicleRotationY));
      this.vehicleRotationY += diff * Math.min(1, step * (8 + this.state.upgrades.handling * 2));
    }
    if (this.state.vehicleId) this.syncRideablePosition(this.state.vehicleId, this.vehiclePosition);
    this.state = { ...this.state, vehiclePosition: this.vehiclePosition.toArray(), vehicleRotationY: this.vehicleRotationY };
  }

  public dismount(): void {
    const id = this.state.vehicleId;
    if (!id) return;
    const kind = this.state.mode === 'TRANSIT_LINKED' ? 'transit' : 'vehicle';
    const exit = this.getDismountPosition();
    this.dismountPosition.copy(exit);
    this.state = { ...this.state, mode: 'ON_FOOT', vehicleId: null };
    this.updateInteractionPrompt(id, false, kind);
    this.notify();
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('nexus:teleport', { detail: exit }));
    this.notifyUser(kind === 'transit' ? 'TRANSIT LINK RELEASED' : 'HOVER VEHICLE EXITED', 'Returned to pedestrian control.');
  }

  private interact(id: string, kind: 'vehicle' | 'transit'): void {
    if (this.state.mode !== 'ON_FOOT') { this.dismount(); return; }
    const entity = this.vehicleEntities.get(id);
    if (!entity) return;
    if (kind === 'vehicle') {
      this.vehiclePosition.copy(entity.position);
      SaveSystem.getInstance().markVehicleUsed(id, entity.name);
    }
    this.state = { ...this.state, mode: kind === 'vehicle' ? 'RIDING' : 'TRANSIT_LINKED', vehicleId: id, vehiclePosition: this.vehiclePosition.toArray(), vehicleRotationY: kind === 'vehicle' ? this.vehicleRotationY : this.transitRotationY };
    this.updateInteractionPrompt(id, true, kind);
    this.notify();
    this.notifyUser(kind === 'vehicle' ? 'HOVER VEHICLE ONLINE' : 'TRANSIT LINK ESTABLISHED', kind === 'vehicle' ? 'Use WASD and SHIFT to pilot. Interact again to exit.' : 'Following the city shuttle. Interact again to release the link.');
  }

  private updateInteractionPrompt(id: string, active: boolean, kind: 'vehicle' | 'transit'): void {
    const entity = this.vehicleEntities.get(id);
    if (!entity) return;
    entity.radius = active ? 5 : kind === 'vehicle' ? 4.5 : 3.5;
    entity.actionText = active ? (kind === 'vehicle' ? 'EXIT HOVER VEHICLE' : 'RELEASE TRANSIT LINK') : kind === 'vehicle' ? 'ENTER HOVER VEHICLE' : 'LINK TO TRANSIT NODE';
    const interactions = InteractionSystem.getInstance();
    interactions.unregister(id);
    interactions.register(entity);
  }

  private notifyUser(title: string, message: string): void { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('nexus:notification', { detail: { title, message, type: 'system', duration: 3000 } })); }
  private notify(): void { this.listeners.forEach((listener) => listener(this.state)); }
}
