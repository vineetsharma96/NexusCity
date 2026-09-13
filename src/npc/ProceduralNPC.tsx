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
  const torsoRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const walkTimer = useRef(Math.random() * 10);

  useFrame((state, delta) => {
    if (!rootRef.current) return;

    // Distance LOD & culling optimization: cull NPCs beyond 115m
    const camDist = state.camera.position.distanceTo(npc.position);
    if (camDist > 115) {
      if (rootRef.current.visible) rootRef.current.visible = false;
      return;
    }
    if (!rootRef.current.visible) rootRef.current.visible = true;

    // 1. Sync position & smoothly interpolate facing yaw (eliminates abrupt turn snaps)
    rootRef.current.position.copy(npc.position);
    
    // Shortest angular distance slerp
    let diff = npc.facingYaw - rootRef.current.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    rootRef.current.rotation.y += diff * Math.min(1.0, delta * 9.0);

    // Skip fine joint transforms for distant NPCs (>65m) to maximize FPS
    const isClose = camDist <= 65;

    if (npc.isWalking) {
      walkTimer.current += delta * (npc.walkSpeed * 3.2);
      const t = walkTimer.current;
      const stride = Math.sin(t) * 0.58;

      // Limb swing
      if (leftLegRef.current) leftLegRef.current.rotation.x = stride;
      if (rightLegRef.current) rightLegRef.current.rotation.x = -stride;

      if (isClose) {
        if (leftArmRef.current) {
          leftArmRef.current.rotation.x = -stride * 0.85;
          leftArmRef.current.rotation.z = 0.06;
        }
        if (rightArmRef.current) {
          rightArmRef.current.rotation.x = stride * 0.85;
          rightArmRef.current.rotation.z = -0.06;
        }

        // Natural torso counter-rotation & hip bounce
        if (torsoRef.current) {
          torsoRef.current.rotation.y = -Math.sin(t) * 0.08;
          torsoRef.current.position.y = 0.26 + Math.abs(Math.sin(t)) * 0.03;
        }
      }
    } else if (isClose) {
      // Idle breathing & gentle relaxation (only for close NPCs)
      walkTimer.current += delta * 2.0;
      const breathe = Math.sin(walkTimer.current) * 0.035;
      if (leftLegRef.current) leftLegRef.current.rotation.x = 0;
      if (rightLegRef.current) rightLegRef.current.rotation.x = 0;
      if (leftArmRef.current) {
        leftArmRef.current.rotation.x = breathe;
        leftArmRef.current.rotation.z = 0.1;
      }
      if (rightArmRef.current) {
        rightArmRef.current.rotation.x = -breathe;
        rightArmRef.current.rotation.z = -0.1;
      }
      if (torsoRef.current) {
        torsoRef.current.rotation.y = 0;
        torsoRef.current.position.y = 0.26 + breathe * 0.4;
      }
    }

    // Look naturally towards player if nearby
    if (headRef.current && isNearby) {
      const dx = state.camera.position.x - npc.position.x;
      const dz = state.camera.position.z - npc.position.z;
      const worldAngle = Math.atan2(dx, dz);
      let localAngle = worldAngle - (rootRef.current ? rootRef.current.rotation.y : 0);
      while (localAngle > Math.PI) localAngle -= Math.PI * 2;
      while (localAngle < -Math.PI) localAngle += Math.PI * 2;
      const clampedAngle = THREE.MathUtils.clamp(localAngle, -0.65, 0.65);
      headRef.current.rotation.y = THREE.MathUtils.lerp(headRef.current.rotation.y, clampedAngle, delta * 5);
    } else if (headRef.current && isClose) {
      headRef.current.rotation.y = THREE.MathUtils.lerp(headRef.current.rotation.y, 0, delta * 4);
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
        <group ref={torsoRef} position={[0, 0.26, 0]}>
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
        <group ref={headRef} position={[0, 0.58, 0]}>
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
