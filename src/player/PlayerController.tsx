import React, { useRef, useState, useEffect } from 'react';
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

export interface PlayerControllerProps {
  playerPosRef?: React.MutableRefObject<THREE.Vector3>;
  registerTeleport?: (teleportFn: (pos: THREE.Vector3) => void) => void;
}

import { ContactShadowDecal } from './ContactShadowDecal';
import { VehicleInteractionSystem, VehicleState } from '../vehicle/VehicleInteractionSystem';

export const PlayerController: React.FC<PlayerControllerProps> = ({ playerPosRef, registerTeleport }) => {
  // Controller instance
  const controllerRef = useRef<KinematicController | null>(null);
  if (!controllerRef.current) controllerRef.current = new KinematicController();
  const [kinematicState, setKinematicState] = useState<KinematicState>(() => ({
    position: controllerRef.current!.position,
    velocity: controllerRef.current!.velocity,
    rotationY: controllerRef.current!.rotationY,
    speed: 0,
    bankAngle: 0,
    isGrounded: true,
    gait: 'IDLE',
  }));
  const [vehicleState, setVehicleState] = useState<VehicleState>(() => VehicleInteractionSystem.getInstance().getState());

  const cameraYaw = useRef(0);
  const controller = controllerRef.current;

  const teleport = React.useCallback((newPos: THREE.Vector3) => {
    if (![newPos.x, newPos.y, newPos.z].every(Number.isFinite)) return;
    VehicleInteractionSystem.getInstance().dismount();
    const safePosition = KinematicCollisionSolver.findSafePosition(newPos, controller.playerRadius, controller.playerHeight);
    controller.position.copy(safePosition);
    controller.resetMotion();
    controller.isGrounded = true;
    if (playerPosRef) playerPosRef.current.copy(safePosition);
  }, [controller, playerPosRef]);

  // Spawns player from save or default in Central Plaza intersection & registers teleport
  useEffect(() => {
    let previousMode = VehicleInteractionSystem.getInstance().getState().mode;
    return VehicleInteractionSystem.getInstance().subscribe((nextState) => {
      const dismounted = previousMode !== 'ON_FOOT' && nextState.mode === 'ON_FOOT';
      previousMode = nextState.mode;
      if (dismounted) {
        teleport(VehicleInteractionSystem.getInstance().getDismountPosition());
      }
      setVehicleState(nextState);
    });
  }, [teleport]);

  useEffect(() => {
    const saved = SaveSystem.getInstance().getData().player;
    if (saved && Array.isArray(saved.position) && saved.position.length === 3 && saved.position.every(Number.isFinite) && saved.position[1] >= 0) {
      teleport(new THREE.Vector3(...saved.position));
      controller.rotationY = Number.isFinite(saved.rotationY) ? saved.rotationY : 0;
    } else {
      teleport(new THREE.Vector3(0, 0.2, 10));
    }

    if (playerPosRef) {
      playerPosRef.current.copy(controller.position);
    }
  }, [controller, playerPosRef, teleport]);

  useEffect(() => {
    registerTeleport?.(teleport);
  }, [registerTeleport, teleport]);

  useEffect(() => {
    // Global custom event listener for fast-travel teleportation
    const handleCustomTeleport = (e: Event) => {
      const detail = (e as CustomEvent<THREE.Vector3>).detail;
      if (detail) teleport(detail);
    };

    // Hotkey: [V] for Cinematic Vista
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (e.repeat || activeTag === 'input' || activeTag === 'textarea' || (document.activeElement as HTMLElement)?.isContentEditable || InputManager.isUIBlocked()) return;

      if (e.key === 'v' || e.key === 'V') {
        CinematicManager.getInstance().toggleVista(
          controller.position,
          'CINEMATIC DRONE VISTA // SECTOR RECON',
          'SWEEPING AERIAL DRONE OVERVIEW • PRESS [V] OR MOVE TO RESUME CONTROL'
        );
        AudioManager.getInstance().playUI('toggle');
      }
    };

    const handleCustomVista = () => {
      if (InputManager.isUIBlocked()) return;
      CinematicManager.getInstance().toggleVista(
        controller.position,
        'CINEMATIC DRONE VISTA // SECTOR RECON',
        'SWEEPING AERIAL DRONE OVERVIEW • PRESS [V] OR MOVE TO RESUME CONTROL'
      );
      AudioManager.getInstance().playUI('toggle');
    };

    window.addEventListener('nexus:teleport', handleCustomTeleport);
    window.addEventListener('nexus:vista', handleCustomVista);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('nexus:teleport', handleCustomTeleport);
      window.removeEventListener('nexus:vista', handleCustomVista);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [controller, teleport]);

  useFrame((_, delta) => {
    const cinematic = CinematicManager.getInstance();
    const cinState = cinematic.getState();
    const isCinematic = cinState.phase !== 'GAMEPLAY';

    const input = InputManager.getState();
    if (cinState.phase === 'VISTA_MODE' && (Math.abs(input.moveX) > 0.05 || Math.abs(input.moveZ) > 0.05)) cinematic.exitVista();

    const vehicle = VehicleInteractionSystem.getInstance();
    let updatedState: KinematicState;
    if (vehicleState.mode !== 'ON_FOOT') {
      if (vehicleState.mode === 'RIDING' && !isCinematic && !InputManager.isUIBlocked()) vehicle.updateMounted(delta, cameraYaw.current);
      const mountedPosition = vehicle.getMountedPosition();
      controller.position.copy(mountedPosition);
      controller.velocity.set(0, 0, 0);
      controller.rotationY = vehicle.getState().vehicleRotationY;
      updatedState = {
        position: controller.position,
        velocity: controller.velocity,
        rotationY: controller.rotationY,
        speed: vehicle.getMovementMultiplier() * 16,
        isGrounded: true,
        gait: 'IDLE',
        bankAngle: 0,
      };
    } else if (isCinematic || InputManager.isUIBlocked()) {
      controller.resetMotion();
      updatedState = { ...kinematicState, position: controller.position, velocity: controller.velocity, speed: 0, gait: 'IDLE', bankAngle: 0 };
    } else {
      updatedState = controller.update(delta, cameraYaw.current);
    }
    // The avatar reads this mutable frame state. React only needs a render for material/gait changes.
    const needsRender = kinematicState.gait !== updatedState.gait || kinematicState.isGrounded !== updatedState.isGrounded;
    Object.assign(kinematicState, updatedState);
    if (needsRender) setKinematicState({ ...updatedState });

    if (playerPosRef) {
      playerPosRef.current.copy(updatedState.position);
    }

    // Always update InteractionSystem position so interactive entities (NPCs, terminals, exit door) work indoors and outdoors
    InteractionSystem.getInstance().updatePlayerPosition(updatedState.position);

    // Update persistent SaveSystem & DiscoverySystem
    SaveSystem.getInstance().updatePlayerPosition(updatedState.position, updatedState.rotationY);
    DiscoverySystem.getInstance().update(updatedState.position);
    NavigationSystem.getInstance().updatePlayerPosition(updatedState.position);
  });

  const posRef = playerPosRef || { current: kinematicState.position };

  return (
    <>
      <ContactShadowDecal playerPosRef={posRef as React.MutableRefObject<THREE.Vector3>} isGrounded={kinematicState.isGrounded} />
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
