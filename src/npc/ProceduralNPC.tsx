import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { NPCDef } from './NPCManager';
import { QualityManager } from '../rendering/QualityManager';
import { WeatherSystem } from '../world/WeatherSystem';

interface ProceduralNPCProps {
  npc: NPCDef;
  isNearby: boolean;
}

export const ProceduralNPC: React.FC<ProceduralNPCProps> = React.memo(({ npc, isNearby }) => {
  const rootRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const umbrellaRef = useRef<THREE.Group>(null);
  const timerRef = useRef(Math.random() * 12);

  const scale = npc.scale ?? 1.0;
  const secondaryColor = npc.secondaryColor ?? npc.visorColor;

  useFrame((state, delta) => {
    if (!rootRef.current) return;
    const camDist = state.camera.position.distanceTo(npc.position);
    const lod = QualityManager.current.LODQuality;
    const maxDist = lod === 'LOW' ? 65 : lod === 'MEDIUM' ? 105 : 145;

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

    const activeSpeed = npc.currentSpeed || npc.walkSpeed;
    const isCheckingPad =
      !npc.isWalking &&
      (npc.aiState === 'WINDOW_SHOPPING' || npc.aiState === 'WAIT_CROSSWALK') &&
      (npc.accessory === 'HOLO_TABLET' || npc.isStoryNpc);

    if (npc.isWalking) {
      timerRef.current += delta * activeSpeed * 3.25;
      const strideAmp = THREE.MathUtils.clamp(activeSpeed * 0.25, 0.42, 0.68);
      const stride = Math.sin(timerRef.current) * strideAmp;
      if (bodyRef.current) {
        bodyRef.current.position.y = 0.95 + Math.abs(Math.sin(timerRef.current)) * 0.038;
        bodyRef.current.rotation.x = THREE.MathUtils.lerp(
          bodyRef.current.rotation.x,
          npc.aiState === 'CROSSING_STREET' || npc.aiState === 'SHELTER_SEEKING' ? 0.08 : 0.035,
          delta * 8
        );
        bodyRef.current.rotation.y = Math.sin(timerRef.current) * 0.06;
      }
      if (leftLegRef.current) leftLegRef.current.rotation.x = stride;
      if (rightLegRef.current) rightLegRef.current.rotation.x = -stride;
      if (leftArmRef.current) leftArmRef.current.rotation.x = -stride * 0.82;
      if (rightArmRef.current) {
        // Carry briefcase with dampened swing
        const swingScale = npc.accessory === 'BRIEFCASE' ? 0.35 : 0.82;
        rightArmRef.current.rotation.x = stride * swingScale;
      }
    } else {
      timerRef.current += delta * 1.8;
      if (bodyRef.current) {
        bodyRef.current.position.y = 0.95 + Math.sin(timerRef.current) * 0.015;
        bodyRef.current.rotation.x = THREE.MathUtils.lerp(bodyRef.current.rotation.x, 0, delta * 6);
        bodyRef.current.rotation.y = THREE.MathUtils.lerp(bodyRef.current.rotation.y, 0, delta * 6);
      }
      if (leftLegRef.current) leftLegRef.current.rotation.x = THREE.MathUtils.lerp(leftLegRef.current.rotation.x, 0, delta * 10);
      if (rightLegRef.current) rightLegRef.current.rotation.x = THREE.MathUtils.lerp(rightLegRef.current.rotation.x, 0, delta * 10);
      if (leftArmRef.current) leftArmRef.current.rotation.x = THREE.MathUtils.lerp(leftArmRef.current.rotation.x, 0.05, delta * 8);
      if (rightArmRef.current) {
        const targetRightArmX = isCheckingPad ? -0.95 : 0.05;
        rightArmRef.current.rotation.x = THREE.MathUtils.lerp(rightArmRef.current.rotation.x, targetRightArmX, delta * 8);
      }
    }

    if (headRef.current) {
      const scanOffset =
        npc.aiState === 'WINDOW_SHOPPING' || npc.aiState === 'WAIT_CROSSWALK'
          ? Math.sin(timerRef.current * 0.85) * 0.28
          : npc.headLookYaw || 0;
      headRef.current.rotation.y = THREE.MathUtils.lerp(headRef.current.rotation.y, scanOffset, delta * 6);
      headRef.current.rotation.x = THREE.MathUtils.lerp(
        headRef.current.rotation.x,
        isCheckingPad ? 0.26 : 0,
        delta * 6
      );
    }

    if (umbrellaRef.current) {
      const rain = WeatherSystem.getInstance().getState().rainIntensity;
      const showUmbrella = rain > 0.25 && (npc.accessory === 'UMBRELLA_DRONE' || npc.accessory === 'HOLO_TABLET');
      umbrellaRef.current.visible = showUmbrella;
      if (showUmbrella) {
        umbrellaRef.current.position.y = 1.92 + Math.sin(timerRef.current * 1.5) * 0.03;
        umbrellaRef.current.rotation.y += delta * 0.8;
      }
    }
  });

  return (
    <group ref={rootRef} name={`npc-${npc.id}`} scale={[scale, scale, scale]}>
      {isNearby && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
          <ringGeometry args={[0.68, 0.82, 24]} />
          <meshBasicMaterial color="#f59e0b" transparent opacity={0.85} />
        </mesh>
      )}

      {/* Personal Hovering Rain-Shield Drone (deploys during rain) */}
      <group ref={umbrellaRef} position={[0, 1.92, 0]} visible={false}>
        <mesh>
          <cylinderGeometry args={[0.06, 0.56, 0.16, 12, 1, true]} />
          <meshBasicMaterial
            color={npc.visorColor}
            transparent
            opacity={0.34}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
        <mesh position={[0, 0.09, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 0.04, 10]} />
          <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.2} />
        </mesh>
      </group>

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
          {/* Dorsal Courier Pack (larger for COURIER_PACK specialists) */}
          <mesh
            position={[0, 0.02, -0.15]}
            castShadow
            scale={npc.accessory === 'COURIER_PACK' ? [1.22, 1.25, 1.35] : [1, 1, 1]}
          >
            <boxGeometry args={[0.24, 0.26, 0.09]} />
            <meshStandardMaterial color="#0b1120" metalness={0.88} roughness={0.22} />
          </mesh>
          <mesh position={[0, 0.02, npc.accessory === 'COURIER_PACK' ? -0.22 : -0.2]}>
            <boxGeometry args={[0.14, 0.025, 0.01]} />
            <meshBasicMaterial color={secondaryColor} />
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

        {/* Right Arm with Pauldron, Cuff & Pedestrian Accessory (Holo-Tablet or Briefcase) */}
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

          {/* Handheld Holographic Datapad */}
          {npc.accessory === 'HOLO_TABLET' && (
            <group position={[0, -0.38, 0.09]} rotation={[0.45, 0, 0]}>
              <mesh>
                <boxGeometry args={[0.13, 0.014, 0.18]} />
                <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.2} />
              </mesh>
              <mesh position={[0, 0.01, 0]}>
                <boxGeometry args={[0.11, 0.006, 0.15]} />
                <meshBasicMaterial color={npc.visorColor} transparent opacity={0.85} />
              </mesh>
            </group>
          )}

          {/* Commuter Cyber-Briefcase */}
          {npc.accessory === 'BRIEFCASE' && (
            <group position={[0.04, -0.48, 0.02]}>
              <mesh castShadow>
                <boxGeometry args={[0.055, 0.22, 0.3]} />
                <meshStandardMaterial color="#0f172a" metalness={0.92} roughness={0.2} />
              </mesh>
              <mesh position={[0.03, 0, 0]}>
                <boxGeometry args={[0.008, 0.03, 0.24]} />
                <meshBasicMaterial color={secondaryColor} />
              </mesh>
            </group>
          )}
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
});
