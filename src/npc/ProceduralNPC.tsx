import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { NPCDef } from './NPCManager';
import { QualityManager } from '../rendering/QualityManager';

interface ProceduralNPCProps {
  npc: NPCDef;
  isNearby: boolean;
}

export const ProceduralNPC: React.FC<ProceduralNPCProps> = ({ npc, isNearby }) => {
  const rootRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const timerRef = useRef(Math.random() * 10);

  useFrame((state, delta) => {
    if (!rootRef.current) return;
    const camDist = state.camera.position.distanceTo(npc.position);
    const lod = QualityManager.current.LODQuality;
    const maxDist = lod === 'LOW' ? 55 : lod === 'MEDIUM' ? 85 : 125;

    if (camDist > maxDist) {
      rootRef.current.visible = false;
      return;
    }
    rootRef.current.visible = true;
    rootRef.current.position.copy(npc.position);

    let diff = npc.facingYaw - rootRef.current.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    rootRef.current.rotation.y += diff * Math.min(1, delta * 9);

    if (npc.isWalking) {
      timerRef.current += delta * npc.walkSpeed * 3.2;
      const stride = Math.sin(timerRef.current) * 0.55;
      if (bodyRef.current) {
        bodyRef.current.position.y = 0.95 + Math.abs(Math.sin(timerRef.current)) * 0.035;
      }
      if (leftLegRef.current) leftLegRef.current.rotation.x = stride;
      if (rightLegRef.current) rightLegRef.current.rotation.x = -stride;
      if (leftArmRef.current) leftArmRef.current.rotation.x = -stride * 0.8;
      if (rightArmRef.current) rightArmRef.current.rotation.x = stride * 0.8;
    } else {
      timerRef.current += delta * 1.8;
      if (bodyRef.current) {
        bodyRef.current.position.y = 0.95 + Math.sin(timerRef.current) * 0.015;
      }
      if (leftLegRef.current) leftLegRef.current.rotation.x = 0;
      if (rightLegRef.current) rightLegRef.current.rotation.x = 0;
      if (leftArmRef.current) leftArmRef.current.rotation.x = 0.05;
      if (rightArmRef.current) rightArmRef.current.rotation.x = 0.05;
    }

    if (headRef.current) {
      headRef.current.rotation.y = THREE.MathUtils.lerp(headRef.current.rotation.y, 0, delta * 4);
    }
  });

  return (
    <group ref={rootRef} name={`npc-${npc.id}`}>
      {isNearby && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
          <ringGeometry args={[0.68, 0.82, 24]} />
          <meshBasicMaterial color="#f59e0b" transparent opacity={0.85} />
        </mesh>
      )}
      <group ref={bodyRef} position={[0, 0.95, 0]}>
        {/* Pelvis & Utility Belt */}
        <mesh castShadow>
          <boxGeometry args={[0.34, 0.14, 0.22]} />
          <meshStandardMaterial color="#0b0f19" metalness={0.82} roughness={0.28} />
        </mesh>
        <mesh position={[0, 0.075, 0]}>
          <boxGeometry args={[0.37, 0.04, 0.24]} />
          <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.2} />
        </mesh>

        {/* Jacket Torso, Collar, Chest Emblem & Courier Backpack */}
        <group position={[0, 0.26, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.41, 0.39, 0.24]} />
            <meshStandardMaterial color={npc.armorColor} metalness={0.76} roughness={0.3} />
          </mesh>
          {/* Jacket High Collar */}
          <mesh position={[0, 0.21, -0.02]}>
            <boxGeometry args={[0.28, 0.07, 0.2]} />
            <meshStandardMaterial color="#0f172a" metalness={0.85} roughness={0.25} />
          </mesh>
          {/* Chest Status Badge */}
          <mesh position={[0, 0.06, 0.126]}>
            <circleGeometry args={[0.045, 12]} />
            <meshBasicMaterial color={npc.visorColor} />
          </mesh>
          {/* Dorsal Courier Pack */}
          <mesh position={[0, 0.02, -0.15]} castShadow>
            <boxGeometry args={[0.24, 0.26, 0.09]} />
            <meshStandardMaterial color="#0b1120" metalness={0.88} roughness={0.22} />
          </mesh>
          <mesh position={[0, 0.02, -0.2]}>
            <boxGeometry args={[0.14, 0.025, 0.01]} />
            <meshBasicMaterial color={npc.visorColor} />
          </mesh>
        </group>

        {/* Sculpted Head, Visor & Ear Comms */}
        <group ref={headRef} position={[0, 0.59, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.145, 14, 14]} />
            <meshStandardMaterial color="#0b0f19" metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh position={[0, 0.02, 0.105]}>
            <boxGeometry args={[0.195, 0.056, 0.085]} />
            <meshBasicMaterial color={npc.visorColor} />
          </mesh>
          <mesh position={[0, 0.11, 0.01]}>
            <boxGeometry args={[0.06, 0.04, 0.16]} />
            <meshStandardMaterial color={npc.armorColor} metalness={0.85} roughness={0.25} />
          </mesh>
        </group>

        {/* Left Arm with Pauldron & Cuff */}
        <group ref={leftArmRef} position={[-0.245, 0.4, 0]}>
          <mesh position={[-0.02, -0.01, 0]}>
            <boxGeometry args={[0.11, 0.1, 0.12]} />
            <meshStandardMaterial color="#1e293b" metalness={0.85} roughness={0.25} />
          </mesh>
          <mesh position={[0, -0.19, 0]}>
            <cylinderGeometry args={[0.048, 0.042, 0.38, 8]} />
            <meshStandardMaterial color={npc.armorColor} metalness={0.68} roughness={0.32} />
          </mesh>
          <mesh position={[0, -0.39, 0.01]}>
            <boxGeometry args={[0.06, 0.065, 0.065]} />
            <meshStandardMaterial color="#090d16" metalness={0.9} roughness={0.2} />
          </mesh>
        </group>

        {/* Right Arm with Pauldron & Cuff */}
        <group ref={rightArmRef} position={[0.245, 0.4, 0]}>
          <mesh position={[0.02, -0.01, 0]}>
            <boxGeometry args={[0.11, 0.1, 0.12]} />
            <meshStandardMaterial color="#1e293b" metalness={0.85} roughness={0.25} />
          </mesh>
          <mesh position={[0, -0.19, 0]}>
            <cylinderGeometry args={[0.048, 0.042, 0.38, 8]} />
            <meshStandardMaterial color={npc.armorColor} metalness={0.68} roughness={0.32} />
          </mesh>
          <mesh position={[0, -0.39, 0.01]}>
            <boxGeometry args={[0.06, 0.065, 0.065]} />
            <meshStandardMaterial color="#090d16" metalness={0.9} roughness={0.2} />
          </mesh>
        </group>

        {/* Left Leg & Boot */}
        <group ref={leftLegRef} position={[-0.11, -0.06, 0]}>
          <mesh position={[0, -0.38, 0]}>
            <cylinderGeometry args={[0.068, 0.054, 0.72, 8]} />
            <meshStandardMaterial color="#0f172a" metalness={0.82} roughness={0.28} />
          </mesh>
          <mesh position={[0, -0.36, 0.058]}>
            <boxGeometry args={[0.075, 0.08, 0.025]} />
            <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh position={[0, -0.77, 0.04]}>
            <boxGeometry args={[0.1, 0.085, 0.21]} />
            <meshStandardMaterial color="#090d16" metalness={0.9} roughness={0.2} />
          </mesh>
        </group>

        {/* Right Leg & Boot */}
        <group ref={rightLegRef} position={[0.11, -0.06, 0]}>
          <mesh position={[0, -0.38, 0]}>
            <cylinderGeometry args={[0.068, 0.054, 0.72, 8]} />
            <meshStandardMaterial color="#0f172a" metalness={0.82} roughness={0.28} />
          </mesh>
          <mesh position={[0, -0.36, 0.058]}>
            <boxGeometry args={[0.075, 0.08, 0.025]} />
            <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh position={[0, -0.77, 0.04]}>
            <boxGeometry args={[0.1, 0.085, 0.21]} />
            <meshStandardMaterial color="#090d16" metalness={0.9} roughness={0.2} />
          </mesh>
        </group>
      </group>
    </group>
  );
};
