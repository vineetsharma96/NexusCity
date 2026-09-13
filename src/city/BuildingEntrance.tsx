import React, { useEffect, useRef, useState } from 'react';
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
  const leftDoorRef = useRef<THREE.Group>(null);
  const rightDoorRef = useRef<THREE.Group>(null);
  const statusLightRef = useRef<THREE.MeshStandardMaterial>(null);
  const [isOpen, setIsOpen] = useState(false);
  const isNearby = useRef(false);

  // Palette per interior type
  const themeColor =
    type === 'LAB' ? '#00f0ff' :
    type === 'LOUNGE' ? '#ec4899' :
    type === 'CLINIC' ? '#06b6d4' :
    type === 'NETRUNNER_DEN' ? '#10b981' :
    type === 'RAMEN_DINER' ? '#f59e0b' :
    type === 'DRONE_HANGAR' ? '#f97316' :
    type === 'PENTHOUSE' ? '#38bdf8' :
    type === 'SERVER_VAULT' ? '#3b82f6' :
    type === 'GREENHOUSE' ? '#22c55e' :
    type === 'METRO_STATION' ? '#fbbf24' :
    type === 'ARCADE' ? '#d946ef' : '#00f0ff';

  const floatingBeaconRef = useRef<THREE.Group>(null);

  useEffect(() => {
    // Calculate world interaction position based on gate's rotation
    const forwardOffset = new THREE.Vector3(0, 0, 1.8).applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      rotationY
    );
    const interactionPos = position.clone().add(forwardOffset);

    InteractionSystem.getInstance().register({
      id: `entrance_${id}`,
      name,
      actionText: `ENTER ${name.toUpperCase()} [E]`,
      position: interactionPos,
      radius: 3.6,
      onInteract: () => {
        InteriorManager.getInstance().enterDestination(id, playerPosRef.current, onTeleport);
      },
    });

    return () => {
      InteractionSystem.getInstance().unregister(`entrance_${id}`);
    };
  }, [id, name, type, position, rotationY, playerPosRef, onTeleport]);

  useFrame(({ clock }, delta) => {
    const dist = playerPosRef.current.distanceTo(position);
    const wasNearby = isNearby.current;
    isNearby.current = dist < 5.4;

    if (!wasNearby && isNearby.current) {
      setIsOpen(true);
      AudioManager.getInstance().playDoor();
    } else if (wasNearby && !isNearby.current) {
      setIsOpen(false);
    }

    // Animate floating 3D portal beacon
    if (floatingBeaconRef.current) {
      const t = clock.getElapsedTime();
      floatingBeaconRef.current.position.y = 5.6 + Math.sin(t * 3.0) * 0.18;
      floatingBeaconRef.current.rotation.y = t * 1.5;
    }

    // Update status beacon emissive color
    if (statusLightRef.current) {
      const targetColor = isNearby.current ? new THREE.Color('#00ffaa') : new THREE.Color('#ff0055');
      statusLightRef.current.emissive.lerp(targetColor, delta * 8);
      statusLightRef.current.color.lerp(targetColor, delta * 8);
    }

    // Heavy hydraulic blast gate horizontal slide
    const targetOffset = isNearby.current ? 1.45 : 0.0;
    if (leftDoorRef.current) {
      leftDoorRef.current.position.x = THREE.MathUtils.lerp(
        leftDoorRef.current.position.x,
        -0.75 - targetOffset,
        delta * 5.5
      );
    }
    if (rightDoorRef.current) {
      rightDoorRef.current.position.x = THREE.MathUtils.lerp(
        rightDoorRef.current.position.x,
        0.75 + targetOffset,
        delta * 5.5
      );
    }
  });

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* 1. Main Armored Gate Portal Arch Frame */}
      {/* Top Bulkhead Header */}
      <mesh position={[0, 3.8, 0]} castShadow receiveShadow>
        <boxGeometry args={[4.6, 0.9, 0.8]} />
        <meshStandardMaterial color="#0b1220" metalness={0.9} roughness={0.25} />
      </mesh>

      {/* Left Heavy Pillar Stanchion */}
      <mesh position={[-2.05, 1.85, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.55, 3.7, 0.8]} />
        <meshStandardMaterial color="#0f172a" metalness={0.85} roughness={0.3} />
      </mesh>

      {/* Right Heavy Pillar Stanchion */}
      <mesh position={[2.05, 1.85, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.55, 3.7, 0.8]} />
        <meshStandardMaterial color="#0f172a" metalness={0.85} roughness={0.3} />
      </mesh>

      {/* Yellow/Black Caution Hazard Stripes on Left & Right Stanchions */}
      {[-1.8, 1.8].map((x, idx) => (
        <group key={idx} position={[x, 1.85, 0.41]}>
          <mesh>
            <planeGeometry args={[0.2, 3.4]} />
            <meshStandardMaterial color="#eab308" metalness={0.2} roughness={0.4} />
          </mesh>
          {/* Black chevron crossbars */}
          {[-1.2, -0.6, 0.0, 0.6, 1.2].map((y, k) => (
            <mesh key={k} position={[0, y, 0.005]} rotation={[0, 0, Math.PI / 4]}>
              <planeGeometry args={[0.22, 0.08]} />
              <meshBasicMaterial color="#020617" />
            </mesh>
          ))}
        </group>
      ))}

      {/* Overhead Hydraulic Actuator Cylinders */}
      <mesh position={[-1.4, 3.4, 0.42]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.07, 0.07, 0.7, 12]} />
        <meshStandardMaterial color="#64748b" metalness={0.9} roughness={0.1} />
      </mesh>
      <mesh position={[1.4, 3.4, 0.42]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.07, 0.07, 0.7, 12]} />
        <meshStandardMaterial color="#64748b" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Center Security Status Indicator Beacon */}
      <mesh position={[0, 3.4, 0.42]}>
        <boxGeometry args={[0.45, 0.16, 0.08]} />
        <meshStandardMaterial
          ref={statusLightRef}
          color="#ff0055"
          emissive="#ff0055"
          emissiveIntensity={2.0}
        />
      </mesh>

      {/* Interior Door Opening Void */}
      <mesh position={[0, 1.85, -0.1]}>
        <boxGeometry args={[3.4, 3.6, 0.6]} />
        <meshBasicMaterial color="#02040a" />
      </mesh>

      {/* 2. Holographic Security Curtain / Energy Field (inside gate) */}
      <mesh position={[0, 1.85, 0]}>
        <planeGeometry args={[3.3, 3.4]} />
        <meshBasicMaterial
          color={themeColor}
          transparent
          opacity={isOpen ? 0.08 : 0.28}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* 3. Heavy Blast Doors (Left & Right) */}
      {/* Left Blast Gate Panel */}
      <group ref={leftDoorRef} position={[-0.75, 1.85, 0.05]}>
        {/* Main armored armor plate */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1.52, 3.5, 0.12]} />
          <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.2} />
        </mesh>
        {/* Vertical Reinforcement Ribs */}
        <mesh position={[-0.35, 0, 0.08]}>
          <boxGeometry args={[0.1, 3.3, 0.06]} />
          <meshStandardMaterial color="#0f172a" metalness={0.95} />
        </mesh>
        <mesh position={[0.35, 0, 0.08]}>
          <boxGeometry args={[0.1, 3.3, 0.06]} />
          <meshStandardMaterial color="#0f172a" metalness={0.95} />
        </mesh>
        {/* Glowing Magnetic Locking Edge Bar */}
        <mesh position={[0.74, 0, 0.08]}>
          <boxGeometry args={[0.04, 3.4, 0.04]} />
          <meshBasicMaterial color={themeColor} />
        </mesh>
      </group>

      {/* Right Blast Gate Panel */}
      <group ref={rightDoorRef} position={[0.75, 1.85, 0.05]}>
        {/* Main armored armor plate */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1.52, 3.5, 0.12]} />
          <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.2} />
        </mesh>
        {/* Vertical Reinforcement Ribs */}
        <mesh position={[-0.35, 0, 0.08]}>
          <boxGeometry args={[0.1, 3.3, 0.06]} />
          <meshStandardMaterial color="#0f172a" metalness={0.95} />
        </mesh>
        <mesh position={[0.35, 0, 0.08]}>
          <boxGeometry args={[0.1, 3.3, 0.06]} />
          <meshStandardMaterial color="#0f172a" metalness={0.95} />
        </mesh>
        {/* Glowing Magnetic Locking Edge Bar */}
        <mesh position={[-0.74, 0, 0.08]}>
          <boxGeometry args={[0.04, 3.4, 0.04]} />
          <meshBasicMaterial color={themeColor} />
        </mesh>
      </group>

      {/* 4. Illuminated Overhead Marquee Facility Signboard */}
      <group position={[0, 4.6, 0.3]}>
        {/* Signboard Backing */}
        <mesh castShadow>
          <boxGeometry args={[4.4, 0.75, 0.12]} />
          <meshStandardMaterial color="#040813" metalness={0.8} />
        </mesh>
        {/* Glowing Outer Neon Frame Border */}
        <mesh position={[0, 0, 0.07]}>
          <boxGeometry args={[4.32, 0.68, 0.02]} />
          <meshStandardMaterial
            color={themeColor}
            emissive={themeColor}
            emissiveIntensity={1.8}
          />
        </mesh>
        {/* Inner Dark Mask */}
        <mesh position={[0, 0, 0.08]}>
          <boxGeometry args={[4.16, 0.54, 0.02]} />
          <meshStandardMaterial color="#050a18" metalness={0.9} />
        </mesh>
        {/* Facility Text Simulation Bar */}
        <mesh position={[0, 0, 0.1]}>
          <boxGeometry args={[3.6, 0.22, 0.02]} />
          <meshStandardMaterial
            color={themeColor}
            emissive={themeColor}
            emissiveIntensity={2.5}
          />
        </mesh>
        {/* Sub-label Bar */}
        <mesh position={[0, -0.16, 0.1]}>
          <boxGeometry args={[2.2, 0.06, 0.02]} />
          <meshStandardMaterial color="#94a3b8" emissive="#94a3b8" emissiveIntensity={0.8} />
        </mesh>
      </group>

      {/* 5. Cybernetic Ground Threshold Ramp */}
      <mesh position={[0, 0.04, 0.8]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[3.6, 1.8]} />
        <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.3} />
      </mesh>
      {/* Illuminated Gateway Approach Grid */}
      <mesh position={[0, 0.05, 0.8]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.9, 1.15, 32]} />
        <meshBasicMaterial
          color={themeColor}
          transparent
          opacity={isOpen ? 0.6 : 0.2}
        />
      </mesh>

      {/* 6. Floating 3D Holographic Portal Beacon & Visual Indicator */}
      <group ref={floatingBeaconRef} position={[0, 5.6, 0.4]}>
        {/* Floating Diamond Core */}
        <mesh>
          <octahedronGeometry args={[0.32, 0]} />
          <meshStandardMaterial
            color={themeColor}
            emissive={themeColor}
            emissiveIntensity={2.5}
            metalness={0.8}
            roughness={0.1}
          />
        </mesh>
        {/* Orbiting Holographic Reticle Ring */}
        <mesh rotation={[Math.PI / 4, 0, 0]}>
          <ringGeometry args={[0.48, 0.54, 16]} />
          <meshBasicMaterial color={themeColor} side={THREE.DoubleSide} wireframe />
        </mesh>
      </group>

      {/* 7. Holographic [ ENTER ] Floating Signage Plate */}
      <group position={[0, 5.15, 0.4]}>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[1.5, 0.32, 0.04]} />
          <meshStandardMaterial color="#020617" metalness={0.9} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0, 0.03]}>
          <boxGeometry args={[1.42, 0.24, 0.02]} />
          <meshStandardMaterial
            color={themeColor}
            emissive={themeColor}
            emissiveIntensity={2.2}
          />
        </mesh>
      </group>
    </group>
  );
};

