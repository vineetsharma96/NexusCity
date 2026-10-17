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
      if (leftLegRef.current) leftLegRef.current.rotation.x = stride;
      if (rightLegRef.current) rightLegRef.current.rotation.x = -stride;
      if (leftArmRef.current) leftArmRef.current.rotation.x = -stride * 0.8;
      if (rightArmRef.current) rightArmRef.current.rotation.x = stride * 0.8;
    } else {
      if (leftLegRef.current) leftLegRef.current.rotation.x = 0;
      if (rightLegRef.current) rightLegRef.current.rotation.x = 0;
      if (leftArmRef.current) leftArmRef.current.rotation.x = 0;
      if (rightArmRef.current) rightArmRef.current.rotation.x = 0;
    }

    if (headRef.current) {
      headRef.current.rotation.y = THREE.MathUtils.lerp(headRef.current.rotation.y, 0, delta * 4);
    }
  });

  return (
    <group ref={rootRef} name={`npc-${npc.id}`}>
      {isNearby && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.68, 0.82, 24]} />
          <meshBasicMaterial color="#f59e0b" transparent opacity={0.8} />
        </mesh>
      )}
      <group position={[0, 0.95, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.34, 0.14, 0.22]} />
          <meshStandardMaterial color="#0b0f19" metalness={0.8} />
        </mesh>
        <group position={[0, 0.26, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.4, 0.38, 0.24]} />
            <meshStandardMaterial color={npc.armorColor} metalness={0.75} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.05, 0.13]}>
            <circleGeometry args={[0.045, 12]} />
            <meshBasicMaterial color={npc.visorColor} />
          </mesh>
        </group>
        <group ref={headRef} position={[0, 0.58, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.145, 12, 12]} />
            <meshStandardMaterial color="#0b0f19" metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh position={[0, 0.02, 0.1]}>
            <boxGeometry args={[0.19, 0.055, 0.08]} />
            <meshBasicMaterial color={npc.visorColor} />
          </mesh>
        </group>
        <group ref={leftArmRef} position={[-0.24, 0.4, 0]}>
          <mesh position={[0, -0.18, 0]}>
            <cylinderGeometry args={[0.048, 0.042, 0.4, 8]} />
            <meshStandardMaterial color={npc.armorColor} metalness={0.65} />
          </mesh>
        </group>
        <group ref={rightArmRef} position={[0.24, 0.4, 0]}>
          <mesh position={[0, -0.18, 0]}>
            <cylinderGeometry args={[0.048, 0.042, 0.4, 8]} />
            <meshStandardMaterial color={npc.armorColor} metalness={0.65} />
          </mesh>
        </group>
        <group ref={leftLegRef} position={[-0.11, -0.06, 0]}>
          <mesh position={[0, -0.42, 0]}>
            <cylinderGeometry args={[0.065, 0.055, 0.76, 8]} />
            <meshStandardMaterial color="#0f172a" metalness={0.8} />
          </mesh>
        </group>
        <group ref={rightLegRef} position={[0.11, -0.06, 0]}>
          <mesh position={[0, -0.42, 0]}>
            <cylinderGeometry args={[0.065, 0.055, 0.76, 8]} />
            <meshStandardMaterial color="#0f172a" metalness={0.8} />
          </mesh>
        </group>
      </group>
    </group>
  );
};
