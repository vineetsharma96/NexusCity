import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { InteractionSystem } from '../interaction/InteractionSystem';
import { InteriorManager, InteriorType } from '../world/InteriorManager';
import { AudioManager } from '../audio/AudioManager';

interface BuildingEntranceProps {
  id: string;
  name: string;
  type: InteriorType;
  position: THREE.Vector3;
  rotationY?: number;
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
  onTeleport: (newPos: THREE.Vector3) => void;
}

export const BuildingEntrance: React.FC<BuildingEntranceProps> = ({
  id,
  name,
  type,
  position,
  rotationY = 0,
  playerPosRef,
  onTeleport,
}) => {
  const leftDoorRef = useRef<THREE.Mesh>(null);
  const rightDoorRef = useRef<THREE.Mesh>(null);
  const isNearby = useRef(false);

  useEffect(() => {
    // Register entrance in InteractionSystem
    InteractionSystem.getInstance().register({
      id: `entrance_${id}`,
      name,
      actionText: `ENTER ${name.toUpperCase()}`,
      position: position.clone().add(new THREE.Vector3(0, 0, 1.5)),
      radius: 3.2,
      onInteract: () => {
        InteriorManager.getInstance().enter(type, playerPosRef.current, onTeleport);
      },
    });

    return () => {
      InteractionSystem.getInstance().unregister(`entrance_${id}`);
    };
  }, [id, name, type, position, playerPosRef, onTeleport]);

  useFrame((_, delta) => {
    const dist = playerPosRef.current.distanceTo(position);
    const wasNearby = isNearby.current;
    isNearby.current = dist < 5.0;

    if (!wasNearby && isNearby.current) {
      AudioManager.getInstance().playDoor();
    }

    // Automatic sliding glass doors
    const targetDoorOffset = isNearby.current ? 1.3 : 0.0;
    if (leftDoorRef.current) {
      leftDoorRef.current.position.x = THREE.MathUtils.lerp(
        leftDoorRef.current.position.x,
        -0.65 - targetDoorOffset,
        delta * 6
      );
    }
    if (rightDoorRef.current) {
      rightDoorRef.current.position.x = THREE.MathUtils.lerp(
        rightDoorRef.current.position.x,
        0.65 + targetDoorOffset,
        delta * 6
      );
    }
  });

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Entryway Portal Frame */}
      <mesh position={[0, 2.2, 0]} castShadow receiveShadow>
        <boxGeometry args={[4.2, 4.4, 0.6]} />
        <meshStandardMaterial color="#0b1324" metalness={0.9} roughness={0.2} />
      </mesh>

      {/* Door Opening Void */}
      <mesh position={[0, 1.7, 0]}>
        <boxGeometry args={[2.8, 3.4, 0.65]} />
        <meshBasicMaterial color="#040711" />
      </mesh>

      {/* Illuminated Header Marquee Sign */}
      <mesh position={[0, 3.8, 0.35]}>
        <boxGeometry args={[3.8, 0.65, 0.1]} />
        <meshStandardMaterial
          color={type === 'LAB' ? '#00f0ff' : '#ffaa00'}
          emissive={type === 'LAB' ? '#00f0ff' : '#ffaa00'}
          emissiveIntensity={1.4}
        />
      </mesh>

      {/* Left Sliding Glass Door */}
      <mesh ref={leftDoorRef} position={[-0.65, 1.7, 0]}>
        <boxGeometry args={[1.35, 3.3, 0.08]} />
        <meshPhysicalMaterial
          color="#00f0ff"
          transparent
          opacity={0.4}
          roughness={0.1}
          transmission={0.8}
        />
      </mesh>

      {/* Right Sliding Glass Door */}
      <mesh ref={rightDoorRef} position={[0.65, 1.7, 0]}>
        <boxGeometry args={[1.35, 3.3, 0.08]} />
        <meshPhysicalMaterial
          color="#00f0ff"
          transparent
          opacity={0.4}
          roughness={0.1}
          transmission={0.8}
        />
      </mesh>

      {/* Ground Welcome Light Mat */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 1.4]}>
        <planeGeometry args={[2.8, 2.0]} />
        <meshBasicMaterial
          color={type === 'LAB' ? '#00f0ff' : '#ffaa00'}
          transparent
          opacity={0.25}
        />
      </mesh>
    </group>
  );
};
