import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { KinematicController, KinematicState } from './KinematicController';
import { ProceduralProtagonist } from './ProceduralProtagonist';
import { PlayerCamera } from './PlayerCamera';
import { KinematicCollisionSolver } from './KinematicCollision';
import { InputManager } from './InputManager';
import { CinematicManager } from '../cinematics/CinematicManager';
import { SaveSystem } from '../core/SaveSystem';
import { DiscoverySystem } from '../world/DiscoverySystem';
import { AudioManager } from '../audio/AudioManager';
import { InteractionSystem } from '../interaction/InteractionSystem';
import { NavigationSystem } from '../map/NavigationSystem';
import { ContactShadowDecal } from './ContactShadowDecal';
import { VehicleInteractionSystem, VehicleState } from '../vehicle/VehicleInteractionSystem';

export interface PlayerControllerProps {
  playerPosRef?: React.MutableRefObject<THREE.Vector3>;
  registerTeleport?: (teleportFn: (pos: THREE.Vector3) => void) => void;
}

export const PlayerController: React.FC<PlayerControllerProps> = ({ playerPosRef, registerTeleport }) => {
  const controllerRef = useRef<KinematicController | null>(null);
  if (!controllerRef.current) controllerRef.current = new KinematicController();
  const controller = controllerRef.current;

  const [kinematicState, setKinematicState] = useState<KinematicState>(() => ({
    position: controller.position,
    velocity: controller.velocity,
    rotationY: controller.rotationY,
    speed: 0,
    bankAngle: 0,
    isGrounded: true,
    gait: 'IDLE',
  }));
  const [vehicleState, setVehicleState] = useState<VehicleState>(() =>
    VehicleInteractionSystem.getInstance().getState()
  );

  const cameraYaw = useRef(0);
  const lastReportedPos = useRef(new THREE.Vector3(NaN, NaN, NaN));

  const teleport = useCallback(
    (newPos: THREE.Vector3) => {
      if (![newPos.x, newPos.y, newPos.z].every(Number.isFinite)) return;
      VehicleInteractionSystem.getInstance().dismount();
      const safe = KinematicCollisionSolver.findSafePosition(newPos, controller.playerRadius, controller.playerHeight);
      controller.position.copy(safe);
      controller.resetMotion();
      controller.isGrounded = true;
      if (playerPosRef) playerPosRef.current.copy(safe);
    },
    [controller, playerPosRef]
  );

  useEffect(() => {
    let prevMode = VehicleInteractionSystem.getInstance().getState().mode;
    return VehicleInteractionSystem.getInstance().subscribe((next) => {
      const dismounted = prevMode !== 'ON_FOOT' && next.mode === 'ON_FOOT';
      prevMode = next.mode;
      if (dismounted) {
        teleport(VehicleInteractionSystem.getInstance().getDismountPosition());
      }
      setVehicleState(next);
    });
  }, [teleport]);

  useEffect(() => {
    const saved = SaveSystem.getInstance().getData().player;
    if (
      saved &&
      Array.isArray(saved.position) &&
      saved.position.length === 3 &&
      saved.position.every(Number.isFinite) &&
      saved.position[1] >= 0
    ) {
      teleport(new THREE.Vector3(...saved.position));
      controller.rotationY = Number.isFinite(saved.rotationY) ? saved.rotationY : 0;
    } else {
      teleport(new THREE.Vector3(0, 0.2, 10));
    }
    if (playerPosRef) playerPosRef.current.copy(controller.position);
  }, [controller, playerPosRef, teleport]);

  useEffect(() => {
    registerTeleport?.(teleport);
  }, [registerTeleport, teleport]);

  useEffect(() => {
    const onTeleport = (e: Event) => {
      const detail = (e as CustomEvent<THREE.Vector3>).detail;
      if (detail) teleport(detail);
    };
    const triggerVista = () => {
      if (InputManager.isUIBlocked()) return;
      CinematicManager.getInstance().toggleVista(
        controller.position,
        'AERIAL ORBIT // SECTOR RECONNAISSANCE',
        'PRESS [V] OR INPUT MOVEMENT TO RESUME GROUND CONTROL'
      );
      AudioManager.getInstance().playUI('toggle');
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      if (e.repeat || tag === 'input' || tag === 'textarea' || (document.activeElement as HTMLElement)?.isContentEditable) {
        return;
      }
      if (e.key === 'v' || e.key === 'V') triggerVista();
    };

    window.addEventListener('nexus:teleport', onTeleport);
    window.addEventListener('nexus:vista', triggerVista);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('nexus:teleport', onTeleport);
      window.removeEventListener('nexus:vista', triggerVista);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [controller, teleport]);

  useFrame((_, delta) => {
    const cinematic = CinematicManager.getInstance();
    const cinState = cinematic.getState();
    const isCin = cinState.phase !== 'GAMEPLAY';

    const input = InputManager.getState();
    if (cinState.phase === 'VISTA_MODE' && (Math.abs(input.moveX) > 0.05 || Math.abs(input.moveZ) > 0.05)) {
      cinematic.exitVista();
    }

    const vehicle = VehicleInteractionSystem.getInstance();
    let updated: KinematicState;

    if (vehicleState.mode !== 'ON_FOOT') {
      if (vehicleState.mode === 'RIDING' && !isCin && !InputManager.isUIBlocked()) {
        vehicle.updateMounted(delta, cameraYaw.current);
      }
      const mountedPos = vehicle.getMountedPosition();
      controller.position.copy(mountedPos);
      controller.velocity.set(0, 0, 0);
      controller.rotationY = vehicle.getState().vehicleRotationY;
      updated = {
        position: controller.position,
        velocity: controller.velocity,
        rotationY: controller.rotationY,
        speed: vehicle.getMovementMultiplier() * 16,
        isGrounded: true,
        gait: 'IDLE',
        bankAngle: 0,
      };
    } else if (isCin || InputManager.isUIBlocked()) {
      controller.resetMotion();
      updated = {
        ...kinematicState,
        position: controller.position,
        velocity: controller.velocity,
        speed: 0,
        gait: 'IDLE',
        bankAngle: 0,
      };
    } else {
      updated = controller.update(delta, cameraYaw.current);
    }

    const needsRender = kinematicState.gait !== updated.gait || kinematicState.isGrounded !== updated.isGrounded;
    Object.assign(kinematicState, updated);
    if (needsRender) setKinematicState({ ...updated });

    if (playerPosRef) playerPosRef.current.copy(updated.position);

    InteractionSystem.getInstance().updatePlayerPosition(updated.position);
    const dx = updated.position.x - lastReportedPos.current.x;
    const dz = updated.position.z - lastReportedPos.current.z;
    if (!Number.isFinite(dx) || dx * dx + dz * dz >= 0.0064) {
      lastReportedPos.current.copy(updated.position);
      SaveSystem.getInstance().updatePlayerPosition(updated.position, updated.rotationY);
      DiscoverySystem.getInstance().update(updated.position);
      NavigationSystem.getInstance().updatePlayerPosition(updated.position);
    }
  });

  const posRef = playerPosRef || ({ current: kinematicState.position } as React.MutableRefObject<THREE.Vector3>);

  return (
    <>
      <ContactShadowDecal playerPosRef={posRef} isGrounded={kinematicState.isGrounded} />
      {vehicleState.mode === 'ON_FOOT' && <ProceduralProtagonist state={kinematicState} />}
      <PlayerCamera
        targetPos={kinematicState.position}
        onYawChange={(yaw) => {
          cameraYaw.current = yaw;
        }}
      />
    </>
  );
};
