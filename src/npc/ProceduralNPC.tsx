import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { NPCDef } from './NPCManager';

interface ProceduralNPCProps {
  npc: NPCDef;
  isNearby: boolean;
}

export const ProceduralNPC: React.FC<ProceduralNPCProps> = ({ npc, isNearby }) => {
  const rootRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);

  const walkTimer = useRef(Math.random() * 10);

  useFrame((_, delta) => {
    if (!rootRef.current) return;

    // Sync position and facing yaw
    rootRef.current.position.copy(npc.position);
    rootRef.current.rotation.y = npc.facingYaw;

    if (npc.isWalking) {
      walkTimer.current += delta * 7.0;
      const stride = Math.sin(walkTimer.current) * 0.55;

      if (leftLegRef.current) leftLegRef.current.rotation.x = stride;
      if (rightLegRef.current) rightLegRef.current.rotation.x = -stride;
      if (leftArmRef.current) leftArmRef.current.rotation.x = -stride * 0.8;
      if (rightArmRef.current) rightArmRef.current.rotation.x = stride * 0.8;
    } else {
      // Idle relaxation
      walkTimer.current += delta * 2.0;
      const breathe = Math.sin(walkTimer.current) * 0.04;
      if (leftLegRef.current) leftLegRef.current.rotation.x = 0;
      if (rightLegRef.current) rightLegRef.current.rotation.x = 0;
      if (leftArmRef.current) leftArmRef.current.rotation.x = breathe;
      if (rightArmRef.current) rightArmRef.current.rotation.x = -breathe;
    }
  });

  return (
    <group ref={rootRef} name={`npc-${npc.id}`}>
      {/* Proximity Interaction Ring on Sidewalk */}
      {isNearby && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.7, 0.85, 32]} />
          <meshBasicMaterial color="#00f0ff" transparent opacity={0.7} />
        </mesh>
      )}

      {/* Stylized Humanoid Rig */}
      <group position={[0, 0.95, 0]}>
        {/* Pelvis */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.34, 0.14, 0.22]} />
          <meshStandardMaterial color="#0b1220" metalness={0.8} />
        </mesh>

        {/* Torso with Custom Armor Palette */}
        <group position={[0, 0.26, 0]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.42, 0.38, 0.24]} />
            <meshStandardMaterial color={npc.armorColor} metalness={0.7} roughness={0.3} />
          </mesh>
          {/* Cybernetic Chest Badge */}
          <mesh position={[0, 0.05, 0.13]}>
            <circleGeometry args={[0.05, 12]} />
            <meshBasicMaterial color={npc.visorColor} />
          </mesh>
        </group>

        {/* Head & Stylized Cyber Visor */}
        <group position={[0, 0.58, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.15, 16, 16]} />
            <meshStandardMaterial color="#0a0f1d" metalness={0.9} roughness={0.2} />
          </mesh>
          {/* Glowing Visor */}
          <mesh position={[0, 0.02, 0.1]} rotation={[0.08, 0, 0]}>
            <boxGeometry args={[0.2, 0.06, 0.08]} />
            <meshStandardMaterial
              color={npc.visorColor}
              emissive={npc.visorColor}
              emissiveIntensity={1.8}
            />
          </mesh>
        </group>

        {/* Left Arm */}
        <group ref={leftArmRef} position={[-0.25, 0.4, 0]}>
          <mesh position={[0, -0.18, 0]} castShadow>
            <cylinderGeometry args={[0.05, 0.045, 0.42, 8]} />
            <meshStandardMaterial color={npc.armorColor} metalness={0.6} />
          </mesh>
        </group>

        {/* Right Arm */}
        <group ref={rightArmRef} position={[0.25, 0.4, 0]}>
          <mesh position={[0, -0.18, 0]} castShadow>
            <cylinderGeometry args={[0.05, 0.045, 0.42, 8]} />
            <meshStandardMaterial color={npc.armorColor} metalness={0.6} />
          </mesh>
        </group>

        {/* Left Leg */}
        <group ref={leftLegRef} position={[-0.11, -0.06, 0]}>
          <mesh position={[0, -0.42, 0]} castShadow>
            <cylinderGeometry args={[0.07, 0.06, 0.76, 8]} />
            <meshStandardMaterial color="#0f172a" metalness={0.8} />
          </mesh>
          {/* Boot */}
          <mesh position={[0, -0.82, 0.05]} castShadow>
            <boxGeometry args={[0.11, 0.08, 0.2]} />
            <meshStandardMaterial color="#080e1a" metalness={0.9} />
          </mesh>
        </group>

        {/* Right Leg */}
        <group ref={rightLegRef} position={[0.11, -0.06, 0]}>
          <mesh position={[0, -0.42, 0]} castShadow>
            <cylinderGeometry args={[0.07, 0.06, 0.76, 8]} />
            <meshStandardMaterial color="#0f172a" metalness={0.8} />
          </mesh>
          {/* Boot */}
          <mesh position={[0, -0.82, 0.05]} castShadow>
            <boxGeometry args={[0.11, 0.08, 0.2]} />
            <meshStandardMaterial color="#080e1a" metalness={0.9} />
          </mesh>
        </group>
      </group>
    </group>
  );
};
