import React, { useRef, useState, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { KinematicController, KinematicState } from './KinematicController';
import { ProceduralProtagonist } from './ProceduralProtagonist';
import { PlayerCamera } from './PlayerCamera';
import { KinematicCollisionSolver } from './KinematicCollision';

export interface PlayerControllerProps {
  playerPosRef?: React.MutableRefObject<THREE.Vector3>;
  registerTeleport?: (teleportFn: (pos: THREE.Vector3) => void) => void;
}

export const PlayerController: React.FC<PlayerControllerProps> = ({ playerPosRef, registerTeleport }) => {
  // Controller instance
  const controllerRef = useRef<KinematicController>(new KinematicController());
  const [kinematicState, setKinematicState] = useState<KinematicState>(() => ({
    position: controllerRef.current.position,
    velocity: controllerRef.current.velocity,
    rotationY: controllerRef.current.rotationY,
    speed: 0,
    isGrounded: true,
    gait: 'IDLE',
  }));

  const cameraYaw = useRef(0);

  // Spawns player in Central Plaza intersection & registers teleport
  useEffect(() => {
    controllerRef.current.position.set(0, 0.2, 10);
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
    window.addEventListener('nexus:teleport', handleCustomTeleport);

    return () => {
      window.removeEventListener('nexus:teleport', handleCustomTeleport);
    };
  }, [playerPosRef, registerTeleport]);

  useFrame((_, delta) => {
    const updatedState = controllerRef.current.update(delta, cameraYaw.current);
    setKinematicState({ ...updatedState });
    if (playerPosRef) {
      playerPosRef.current.copy(updatedState.position);
    }
  });

  return (
    <>
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
