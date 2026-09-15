import React, { useRef, useState, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { KinematicController, KinematicState } from './KinematicController';
import { ProceduralProtagonist } from './ProceduralProtagonist';
import { PlayerCamera } from './PlayerCamera';
import { KinematicCollisionSolver } from './KinematicCollision';
import { CinematicManager } from '../cinematics/CinematicManager';
import { SaveSystem } from '../core/SaveSystem';
import { DiscoverySystem } from '../world/DiscoverySystem';
import { AudioManager } from '../audio/AudioManager';
import { InteractionSystem } from '../interaction/InteractionSystem';

export interface PlayerControllerProps {
  playerPosRef?: React.MutableRefObject<THREE.Vector3>;
  registerTeleport?: (teleportFn: (pos: THREE.Vector3) => void) => void;
}

import { ContactShadowDecal } from './ContactShadowDecal';

export const PlayerController: React.FC<PlayerControllerProps> = ({ playerPosRef, registerTeleport }) => {
  // Controller instance
  const controllerRef = useRef<KinematicController>(new KinematicController());
  const [kinematicState, setKinematicState] = useState<KinematicState>(() => ({
    position: controllerRef.current.position,
    velocity: controllerRef.current.velocity,
    rotationY: controllerRef.current.rotationY,
    speed: 0,
    bankAngle: 0,
    isGrounded: true,
    gait: 'IDLE',
  }));

  const cameraYaw = useRef(0);

  // Spawns player from save or default in Central Plaza intersection & registers teleport
  useEffect(() => {
    const saved = SaveSystem.getInstance().getData().player;
    if (saved && Array.isArray(saved.position) && saved.position.length === 3 && saved.position[1] >= 0) {
      controllerRef.current.position.set(saved.position[0], saved.position[1], saved.position[2]);
      controllerRef.current.rotationY = saved.rotationY || 0;
    } else {
      controllerRef.current.position.set(0, 0.2, 10);
    }

    if (playerPosRef) {
      playerPosRef.current.copy(controllerRef.current.position);
    }

    if (registerTeleport) {
      registerTeleport((newPos: THREE.Vector3) => {
        controllerRef.current.position.copy(newPos);
        controllerRef.current.velocity.set(0, 0, 0);
        if (playerPosRef) {
          playerPosRef.current.copy(newPos);
        }
      });
    }

    // Global custom event listener for fast-travel teleportation
    const handleCustomTeleport = (e: Event) => {
      const detail = (e as CustomEvent<THREE.Vector3>).detail;
      if (detail) {
        controllerRef.current.position.copy(detail);
        controllerRef.current.velocity.set(0, 0, 0);
        if (playerPosRef) {
          playerPosRef.current.copy(detail);
        }
      }
    };

    // Hotkeys: [V] for Cinematic Vista, [F5] for Quick Save
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      if (e.key === 'v' || e.key === 'V') {
        CinematicManager.getInstance().toggleVista(
          controllerRef.current.position,
          'CINEMATIC DRONE VISTA // SECTOR RECON',
          'SWEEPING AERIAL DRONE OVERVIEW • PRESS [V] OR MOVE TO RESUME CONTROL'
        );
        AudioManager.getInstance().playUI('toggle');
      } else if (e.key === 'F5') {
        e.preventDefault();
        SaveSystem.getInstance().save(true);
        AudioManager.getInstance().playSaveSound();
      }
    };

    const handleCustomVista = () => {
      CinematicManager.getInstance().toggleVista(
        controllerRef.current.position,
        'CINEMATIC DRONE VISTA // SECTOR RECON',
        'SWEEPING AERIAL DRONE OVERVIEW • PRESS [V] OR MOVE TO RESUME CONTROL'
      );
      AudioManager.getInstance().playUI('toggle');
    };

    const handleCustomQuickSave = () => {
      SaveSystem.getInstance().save(true);
      AudioManager.getInstance().playSaveSound();
    };

    window.addEventListener('nexus:teleport', handleCustomTeleport);
    window.addEventListener('nexus:vista', handleCustomVista);
    window.addEventListener('nexus:quicksave', handleCustomQuickSave);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('nexus:teleport', handleCustomTeleport);
      window.removeEventListener('nexus:vista', handleCustomVista);
      window.removeEventListener('nexus:quicksave', handleCustomQuickSave);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [playerPosRef, registerTeleport]);

  useFrame((_, delta) => {
    const cinematic = CinematicManager.getInstance();
    const cinState = cinematic.getState();
    const isCinematic = cinState.phase !== 'GAMEPLAY';

    if (isCinematic) {
      controllerRef.current.velocity.set(0, 0, 0);
    }

    const updatedState = controllerRef.current.update(delta, cameraYaw.current);
    setKinematicState({ ...updatedState });

    if (playerPosRef) {
      playerPosRef.current.copy(updatedState.position);
    }

    // Always update InteractionSystem position so interactive entities (NPCs, terminals, exit door) work indoors and outdoors
    InteractionSystem.getInstance().updatePlayerPosition(updatedState.position);

    // Update persistent SaveSystem & DiscoverySystem
    SaveSystem.getInstance().updatePlayerPosition(updatedState.position, updatedState.rotationY);
    DiscoverySystem.getInstance().update(updatedState.position);

    // If in VISTA_MODE and player starts moving, automatically return to gameplay
    if (cinState.phase === 'VISTA_MODE' && controllerRef.current.isMoving) {
      cinematic.exitVista();
    }
  });

  const posRef = playerPosRef || { current: kinematicState.position };

  return (
    <>
      <ContactShadowDecal playerPosRef={posRef as React.MutableRefObject<THREE.Vector3>} isGrounded={kinematicState.isGrounded} />
      <ProceduralProtagonist state={kinematicState} />
      <PlayerCamera
        targetPos={kinematicState.position}
        onYawChange={(yaw) => {
          cameraYaw.current = yaw;
        }}
      />
    </>
  );
};
