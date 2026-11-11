import * as THREE from 'three';
import { AudioManager } from '../audio/AudioManager';
import { SaveSystem, VehicleUpgradeState } from '../core/SaveSystem';
import { InteractionSystem } from '../interaction/InteractionSystem';
import { InputManager } from '../player/InputManager';
import { KinematicCollisionSolver } from '../player/KinematicCollision';

export type VehicleMode = 'ON_FOOT' | 'RIDING' | 'TRANSIT_LINKED';

export interface VehicleState {
  mode: VehicleMode;
  activeId: string | null;
  label: string;
  speedMultiplier: number;
  vehiclePosition: [number, number, number];
  vehicleRotationY: number;
  upgrades: VehicleUpgradeState;
}

type VehicleListener = (state: VehicleState) => void;

export class VehicleInteractionSystem {
  private static instance: VehicleInteractionSystem;
  private readonly save = SaveSystem.getInstance();
  private listeners = new Set<VehicleListener>();
  private state: VehicleState;
  private vehiclePosition = new THREE.Vector3(4.5, 0.45, 10);
  private transitPosition = new THREE.Vector3(-7, 0.62, 10);
  private rideables = new Map<
    string,
    { id: string; label: string; kind: 'vehicle' | 'transit'; position: THREE.Vector3; rotationY: number }
  >();

  private readonly _forward = new THREE.Vector3();
  private readonly _right = new THREE.Vector3();
  private readonly _moveDir = new THREE.Vector3();
  private readonly _targetPos = new THREE.Vector3();

  private constructor() {
    const upgrades = this.save.getData().vehicleUpgrades;
    this.state = {
      mode: 'ON_FOOT',
      activeId: null,
      label: 'On Foot',
      speedMultiplier: 1,
      vehiclePosition: [4.5, 0.45, 10],
      vehicleRotationY: 0,
      upgrades,
    };
  }

  public static getInstance(): VehicleInteractionSystem {
    if (!VehicleInteractionSystem.instance) {
      VehicleInteractionSystem.instance = new VehicleInteractionSystem();
    }
    return VehicleInteractionSystem.instance;
  }

  public getState(): VehicleState {
    return this.state;
  }

  public getVehiclePosition(targetOut?: THREE.Vector3): THREE.Vector3 {
    return targetOut ? targetOut.copy(this.vehiclePosition) : this.vehiclePosition.clone();
  }

  public getRideablePosition(id: string, targetOut?: THREE.Vector3): THREE.Vector3 {
    if (this.state.mode === 'RIDING' && this.state.activeId === id) {
      return targetOut ? targetOut.copy(this.vehiclePosition) : this.vehiclePosition.clone();
    }
    const pos = this.rideables.get(id)?.position ?? this.vehiclePosition;
    return targetOut ? targetOut.copy(pos) : pos.clone();
  }

  public getRideableRotationY(id: string): number {
    if (this.state.mode === 'RIDING' && this.state.activeId === id) {
      return this.state.vehicleRotationY;
    }
    return this.rideables.get(id)?.rotationY ?? 0;
  }

  public getMountedPosition(targetOut?: THREE.Vector3): THREE.Vector3 {
    const pos = this.state.mode === 'TRANSIT_LINKED' ? this.transitPosition : this.vehiclePosition;
    return targetOut ? targetOut.copy(pos) : pos.clone();
  }

  public getDismountPosition(): THREE.Vector3 {
    const origin = this.getMountedPosition();
    const offset = new THREE.Vector3(1.9, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.state.vehicleRotationY);
    return KinematicCollisionSolver.findSafePosition(
      new THREE.Vector3(origin.x + offset.x, 0, origin.z + offset.z),
      0.45,
      1.8
    );
  }

  public subscribe(listener: VehicleListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  public registerRideable(
    id: string,
    label: string,
    position: THREE.Vector3,
    kind: 'vehicle' | 'transit',
    rotationY: number = 0
  ): void {
    const stored = position.clone();
    const existing = this.rideables.get(id);
    const vehicleCount = Array.from(this.rideables.values()).filter((r) => r.kind === 'vehicle').length;
    this.rideables.set(id, {
      id,
      label,
      kind,
      position: existing && this.state.activeId === id ? existing.position : stored,
      rotationY: existing ? existing.rotationY : rotationY,
    });
    if (
      kind === 'vehicle' &&
      this.state.mode !== 'RIDING' &&
      (vehicleCount === 0 || id === 'nexus-hover-01' || id === 'hover')
    ) {
      this.vehiclePosition.copy(stored);
      this.state = { ...this.state, vehiclePosition: [stored.x, stored.y, stored.z] };
    }
    this.refreshInteraction(id);
  }

  public unregisterRideable(id: string): void {
    this.rideables.delete(id);
    InteractionSystem.getInstance().unregister(`rideable_${id}`);
  }

  public syncRideablePosition(id: string, position: THREE.Vector3): void {
    const entry = this.rideables.get(id);
    if (!entry) return;
    entry.position.copy(position);
    this.refreshInteraction(id);
  }

  private refreshInteraction(id: string): void {
    const entry = this.rideables.get(id);
    if (!entry) return;
    const isActive = this.state.activeId === id && this.state.mode !== 'ON_FOOT';
    const actionText = isActive
      ? entry.kind === 'vehicle'
        ? 'EXIT HOVER VEHICLE'
        : 'RELEASE TRANSIT LINK'
      : entry.kind === 'vehicle'
      ? `BOARD ${entry.label.toUpperCase()}`
      : `LINK ${entry.label.toUpperCase()}`;

    InteractionSystem.getInstance().register({
      id: `rideable_${id}`,
      name: entry.label,
      actionText,
      position: entry.position,
      radius: isActive ? 5.2 : 3.8,
      onInteract: () => this.toggleMount(entry.id, entry.label, entry.kind),
    });
  }

  public toggleMount(id: string, label: string, kind: 'vehicle' | 'transit'): void {
    if (this.state.activeId === id && this.state.mode !== 'ON_FOOT') {
      this.dismount();
      return;
    }

    const entry = this.rideables.get(id);
    if (kind === 'vehicle' && entry) {
      this.vehiclePosition.copy(entry.position);
      this.state.vehicleRotationY = entry.rotationY;
    }

    const upgrades = this.save.getData().vehicleUpgrades;
    const speedMultiplier = kind === 'vehicle' ? 1.55 + upgrades.speed * 0.18 : 1.35;
    this.state = {
      mode: kind === 'vehicle' ? 'RIDING' : 'TRANSIT_LINKED',
      activeId: id,
      label,
      speedMultiplier,
      vehiclePosition: [this.vehiclePosition.x, this.vehiclePosition.y, this.vehiclePosition.z],
      vehicleRotationY: this.state.vehicleRotationY,
      upgrades,
    };

    const activePos = kind === 'vehicle' ? this.vehiclePosition : this.transitPosition;
    this.syncRideablePosition(id, activePos);
    this.save.recordHistory(
      `vehicle_${id}`,
      `TRANSIT ENGAGED // ${label.toUpperCase()}`,
      `Speed profile x${speedMultiplier.toFixed(2)} online.`
    );
    AudioManager.getInstance().playUI('open');
    this.emit();
  }

  public dismount(): void {
    if (this.state.mode === 'ON_FOOT') return;
    const prevId = this.state.activeId;
    if (prevId && this.state.mode === 'RIDING') {
      const entry = this.rideables.get(prevId);
      if (entry) {
        entry.position.copy(this.vehiclePosition);
        entry.rotationY = this.state.vehicleRotationY;
      }
    }
    this.state = {
      ...this.state,
      mode: 'ON_FOOT',
      activeId: null,
      label: 'On Foot',
      speedMultiplier: 1,
      vehiclePosition: [this.vehiclePosition.x, this.vehiclePosition.y, this.vehiclePosition.z],
    };
    if (prevId) {
      this.syncRideablePosition(prevId, this.rideables.get(prevId)?.position ?? this.vehiclePosition);
    }
    AudioManager.getInstance().playUI('close');
    this.emit();
  }

  public updateMounted(delta: number, cameraYaw: number): THREE.Vector3 {
    if (this.state.mode !== 'RIDING') return this.vehiclePosition;
    const dt = Math.min(Math.max(delta, 0), 0.05);
    const input = InputManager.getState();
    const len = Math.hypot(input.moveX, input.moveZ);

    if (len > 0.02) {
      this._forward.set(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
      this._right.set(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw));
      this._moveDir.set(0, 0, 0)
        .addScaledVector(this._right, input.moveX / len)
        .addScaledVector(this._forward, input.moveZ / len)
        .normalize();

      const speed = (input.sprint ? 24 : 16) * this.getMovementMultiplier();
      this._targetPos.copy(this.vehiclePosition).addScaledVector(this._moveDir, speed * dt);
      const resolved = KinematicCollisionSolver.resolveHorizontal(this._targetPos, 0.9, 1.4, this.vehiclePosition);

      this.vehiclePosition.set(resolved.x, 0.45, resolved.z);
      this.state.vehicleRotationY = Math.atan2(this._moveDir.x, this._moveDir.z);
      this.state.vehiclePosition = [this.vehiclePosition.x, this.vehiclePosition.y, this.vehiclePosition.z];
      if (this.state.activeId) {
        const entry = this.rideables.get(this.state.activeId);
        if (entry) {
          entry.rotationY = this.state.vehicleRotationY;
        }
        this.syncRideablePosition(this.state.activeId, this.vehiclePosition);
      }
    }
    return this.vehiclePosition;
  }

  public syncTransitPosition(position: THREE.Vector3, rotationY: number): void {
    this.transitPosition.copy(position);
    if (this.state.mode === 'TRANSIT_LINKED' && this.state.activeId) {
      this.state.vehicleRotationY = rotationY;
      this.syncRideablePosition(this.state.activeId, this.transitPosition);
    }
  }

  public upgrade(key: keyof VehicleUpgradeState): void {
    const current = this.save.getData().vehicleUpgrades[key];
    this.save.setVehicleUpgrade(key, current + 1);
    const upgrades = this.save.getData().vehicleUpgrades;
    const speedMultiplier = this.state.mode === 'RIDING' ? 1.55 + upgrades.speed * 0.18 : this.state.speedMultiplier;
    this.state = { ...this.state, upgrades, speedMultiplier };
    AudioManager.getInstance().playUI('waypoint');
    this.emit();
  }

  public getMovementMultiplier(): number {
    return this.state.mode === 'ON_FOOT' ? 1 : this.state.speedMultiplier;
  }

  private emit(): void {
    this.listeners.forEach((l) => l(this.state));
  }
}
