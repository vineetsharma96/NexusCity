import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { NPCDef } from './NPCManager';
import { QualityManager } from '../rendering/QualityManager';
import { WeatherSystem } from '../world/WeatherSystem';

interface ProceduralNPCProps {
  npc: NPCDef;
  isNearby: boolean;
}

// Shared module-level geometries to eliminate 720+ duplicate buffer allocations across 40 NPCs
const RING_GEO = new THREE.RingGeometry(0.68, 0.82, 20);
const UMBRELLA_CANOPY_GEO = new THREE.CylinderGeometry(0.06, 0.56, 0.16, 10, 1, true);
const UMBRELLA_HUB_GEO = new THREE.CylinderGeometry(0.08, 0.08, 0.04, 8);
const PELVIS_GEO = new THREE.BoxGeometry(0.34, 0.14, 0.22);
const BELT_GEO = new THREE.BoxGeometry(0.37, 0.04, 0.24);
const TORSO_GEO = new THREE.BoxGeometry(0.41, 0.39, 0.24);
const COLLAR_GEO = new THREE.BoxGeometry(0.28, 0.07, 0.2);
const BADGE_GEO = new THREE.CircleGeometry(0.045, 10);
const PACK_GEO = new THREE.BoxGeometry(0.24, 0.26, 0.09);
const PACK_STRIP_GEO = new THREE.BoxGeometry(0.14, 0.025, 0.01);
const HEAD_GEO = new THREE.SphereGeometry(0.145, 10, 10);
const VISOR_GEO = new THREE.BoxGeometry(0.195, 0.056, 0.085);
const CREST_GEO = new THREE.BoxGeometry(0.06, 0.04, 0.16);
const PAULDRON_GEO = new THREE.BoxGeometry(0.11, 0.1, 0.12);
const ARM_GEO = new THREE.CylinderGeometry(0.048, 0.042, 0.38, 6);
const HAND_GEO = new THREE.BoxGeometry(0.06, 0.065, 0.065);
const TABLET_BASE_GEO = new THREE.BoxGeometry(0.13, 0.014, 0.18);
const TABLET_SCREEN_GEO = new THREE.BoxGeometry(0.11, 0.006, 0.15);
const BRIEFCASE_BODY_GEO = new THREE.BoxGeometry(0.055, 0.22, 0.3);
const BRIEFCASE_TRIM_GEO = new THREE.BoxGeometry(0.008, 0.03, 0.24);
const LEG_GEO = new THREE.CylinderGeometry(0.068, 0.054, 0.72, 6);
const KNEE_GEO = new THREE.BoxGeometry(0.075, 0.08, 0.025);
const BOOT_GEO = new THREE.BoxGeometry(0.1, 0.085, 0.21);

// Shared common materials
const RING_MAT = new THREE.MeshBasicMaterial({ color: '#f59e0b', transparent: true, opacity: 0.85 });
const DARK_ARMOR_MAT = new THREE.MeshStandardMaterial({ color: '#0b0f19', metalness: 0.85, roughness: 0.24 });
const SLATE_TRIM_MAT = new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.88, roughness: 0.22 });
const NAVY_LIMB_MAT = new THREE.MeshStandardMaterial({ color: '#0f172a', metalness: 0.84, roughness: 0.26 });
const PACK_MAT = new THREE.MeshStandardMaterial({ color: '#0b1120', metalness: 0.88, roughness: 0.22 });
const BOOT_MAT = new THREE.MeshStandardMaterial({ color: '#090d16', metalness: 0.9, roughness: 0.2 });

const armorMatCache = new Map<string, THREE.MeshStandardMaterial>();
function getArmorMaterial(color: string): THREE.MeshStandardMaterial {
  let mat = armorMatCache.get(color);
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({ color, metalness: 0.74, roughness: 0.3 });
    armorMatCache.set(color, mat);
  }
  return mat;
}

const visorMatCache = new Map<string, THREE.MeshBasicMaterial>();
function getVisorMaterial(color: string): THREE.MeshBasicMaterial {
  let mat = visorMatCache.get(color);
  if (!mat) {
    mat = new THREE.MeshBasicMaterial({ color });
    visorMatCache.set(color, mat);
  }
  return mat;
}

const umbrellaMatCache = new Map<string, THREE.MeshBasicMaterial>();
function getUmbrellaMaterial(color: string): THREE.MeshBasicMaterial {
  let mat = umbrellaMatCache.get(color);
  if (!mat) {
    mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.34,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    umbrellaMatCache.set(color, mat);
  }
  return mat;
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
  const frameSkipRef = useRef(0);

  const scale = npc.scale ?? 1.0;
  const secondaryColor = npc.secondaryColor ?? npc.visorColor;
  const armorMat = useMemo(() => getArmorMaterial(npc.armorColor), [npc.armorColor]);
  const visorMat = useMemo(() => getVisorMaterial(npc.visorColor), [npc.visorColor]);
  const secondaryMat = useMemo(() => getVisorMaterial(secondaryColor), [secondaryColor]);
  const umbrellaMat = useMemo(() => getUmbrellaMaterial(npc.visorColor), [npc.visorColor]);

  useFrame((state, delta) => {
    if (!rootRef.current) return;
    const dx = state.camera.position.x - npc.position.x;
    const dy = state.camera.position.y - npc.position.y;
    const dz = state.camera.position.z - npc.position.z;
    const camDistSq = dx * dx + dy * dy + dz * dz;
    const lod = QualityManager.current.LODQuality;
    const maxDist = lod === 'LOW' ? 65 : lod === 'MEDIUM' ? 105 : 145;

    if (camDistSq > maxDist * maxDist) {
      rootRef.current.visible = false;
      return;
    }
    rootRef.current.visible = true;
    rootRef.current.position.copy(npc.position);

    let diff = npc.facingYaw - rootRef.current.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    rootRef.current.rotation.y += diff * Math.min(1, delta * 9);

    // Throttle detailed limb articulation to every other frame when beyond 45m
    if (camDistSq > 45 * 45) {
      frameSkipRef.current = (frameSkipRef.current + 1) & 1;
      if (frameSkipRef.current !== 0) return;
    }

    const dt = camDistSq > 45 * 45 ? delta * 2 : delta;
    const activeSpeed = npc.currentSpeed || npc.walkSpeed;
    const isCheckingPad =
      !npc.isWalking &&
      (npc.aiState === 'WINDOW_SHOPPING' || npc.aiState === 'WAIT_CROSSWALK') &&
      (npc.accessory === 'HOLO_TABLET' || npc.isStoryNpc);

    if (npc.isWalking) {
      timerRef.current += dt * activeSpeed * 3.25;
      const strideAmp = THREE.MathUtils.clamp(activeSpeed * 0.25, 0.42, 0.68);
      const stride = Math.sin(timerRef.current) * strideAmp;
      if (bodyRef.current) {
        bodyRef.current.position.y = 0.95 + Math.abs(Math.sin(timerRef.current)) * 0.038;
        bodyRef.current.rotation.x = THREE.MathUtils.lerp(
          bodyRef.current.rotation.x,
          npc.aiState === 'CROSSING_STREET' || npc.aiState === 'SHELTER_SEEKING' ? 0.08 : 0.035,
          dt * 8
        );
        bodyRef.current.rotation.y = Math.sin(timerRef.current) * 0.06;
      }
      if (leftLegRef.current) leftLegRef.current.rotation.x = stride;
      if (rightLegRef.current) rightLegRef.current.rotation.x = -stride;
      if (leftArmRef.current) leftArmRef.current.rotation.x = -stride * 0.82;
      if (rightArmRef.current) {
        const swingScale = npc.accessory === 'BRIEFCASE' ? 0.35 : 0.82;
        rightArmRef.current.rotation.x = stride * swingScale;
      }
    } else {
      timerRef.current += dt * 1.8;
      if (bodyRef.current) {
        bodyRef.current.position.y = 0.95 + Math.sin(timerRef.current) * 0.015;
        bodyRef.current.rotation.x = THREE.MathUtils.lerp(bodyRef.current.rotation.x, 0, dt * 6);
        bodyRef.current.rotation.y = THREE.MathUtils.lerp(bodyRef.current.rotation.y, 0, dt * 6);
      }
      if (leftLegRef.current) leftLegRef.current.rotation.x = THREE.MathUtils.lerp(leftLegRef.current.rotation.x, 0, dt * 10);
      if (rightLegRef.current) rightLegRef.current.rotation.x = THREE.MathUtils.lerp(rightLegRef.current.rotation.x, 0, dt * 10);
      if (leftArmRef.current) leftArmRef.current.rotation.x = THREE.MathUtils.lerp(leftArmRef.current.rotation.x, 0.05, dt * 8);
      if (rightArmRef.current) {
        const targetRightArmX = isCheckingPad ? -0.95 : 0.05;
        rightArmRef.current.rotation.x = THREE.MathUtils.lerp(rightArmRef.current.rotation.x, targetRightArmX, dt * 8);
      }
    }

    if (headRef.current) {
      const scanOffset =
        npc.aiState === 'WINDOW_SHOPPING' || npc.aiState === 'WAIT_CROSSWALK'
          ? Math.sin(timerRef.current * 0.85) * 0.28
          : npc.headLookYaw || 0;
      headRef.current.rotation.y = THREE.MathUtils.lerp(headRef.current.rotation.y, scanOffset, dt * 6);
      headRef.current.rotation.x = THREE.MathUtils.lerp(
        headRef.current.rotation.x,
        isCheckingPad ? 0.26 : 0,
        dt * 6
      );
    }

    if (umbrellaRef.current) {
      const rain = WeatherSystem.getInstance().getState().rainIntensity;
      const showUmbrella = rain > 0.25 && (npc.accessory === 'UMBRELLA_DRONE' || npc.accessory === 'HOLO_TABLET');
      umbrellaRef.current.visible = showUmbrella;
      if (showUmbrella) {
        umbrellaRef.current.position.y = 1.92 + Math.sin(timerRef.current * 1.5) * 0.03;
        umbrellaRef.current.rotation.y += dt * 0.8;
      }
    }
  });

  const castShadow = QualityManager.current.shadows && Boolean(npc.isStoryNpc);

  return (
    <group ref={rootRef} name={`npc-${npc.id}`} scale={[scale, scale, scale]}>
      {isNearby && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]} geometry={RING_GEO} material={RING_MAT} />
      )}

      {/* Personal Hovering Rain-Shield Drone (deploys during rain) */}
      <group ref={umbrellaRef} position={[0, 1.92, 0]} visible={false}>
        <mesh geometry={UMBRELLA_CANOPY_GEO} material={umbrellaMat} />
        <mesh position={[0, 0.09, 0]} geometry={UMBRELLA_HUB_GEO} material={NAVY_LIMB_MAT} />
      </group>

      <group ref={bodyRef} position={[0, 0.95, 0]}>
        {/* Pelvis & Utility Belt */}
        <mesh castShadow={castShadow} geometry={PELVIS_GEO} material={DARK_ARMOR_MAT} />
        <mesh position={[0, 0.075, 0]} geometry={BELT_GEO} material={SLATE_TRIM_MAT} />

        {/* Jacket Torso, Collar, Chest Emblem & Courier Backpack */}
        <group position={[0, 0.26, 0]}>
          <mesh castShadow={castShadow} geometry={TORSO_GEO} material={armorMat} />
          <mesh position={[0, 0.21, -0.02]} geometry={COLLAR_GEO} material={NAVY_LIMB_MAT} />
          <mesh position={[0, 0.06, 0.126]} geometry={BADGE_GEO} material={visorMat} />
          <mesh
            position={[0, 0.02, -0.15]}
            scale={npc.accessory === 'COURIER_PACK' ? [1.22, 1.25, 1.35] : [1, 1, 1]}
            geometry={PACK_GEO}
            material={PACK_MAT}
          />
          <mesh
            position={[0, 0.02, npc.accessory === 'COURIER_PACK' ? -0.22 : -0.2]}
            geometry={PACK_STRIP_GEO}
            material={secondaryMat}
          />
        </group>

        {/* Sculpted Head, Visor & Ear Comms */}
        <group ref={headRef} position={[0, 0.59, 0]}>
          <mesh castShadow={castShadow} geometry={HEAD_GEO} material={DARK_ARMOR_MAT} />
          <mesh position={[0, 0.02, 0.105]} geometry={VISOR_GEO} material={visorMat} />
          <mesh position={[0, 0.11, 0.01]} geometry={CREST_GEO} material={armorMat} />
        </group>

        {/* Left Arm with Pauldron & Cuff */}
        <group ref={leftArmRef} position={[-0.245, 0.4, 0]}>
          <mesh position={[-0.02, -0.01, 0]} geometry={PAULDRON_GEO} material={SLATE_TRIM_MAT} />
          <mesh position={[0, -0.19, 0]} geometry={ARM_GEO} material={armorMat} />
          <mesh position={[0, -0.39, 0.01]} geometry={HAND_GEO} material={BOOT_MAT} />
        </group>

        {/* Right Arm with Pauldron, Cuff & Pedestrian Accessory */}
        <group ref={rightArmRef} position={[0.245, 0.4, 0]}>
          <mesh position={[0.02, -0.01, 0]} geometry={PAULDRON_GEO} material={SLATE_TRIM_MAT} />
          <mesh position={[0, -0.19, 0]} geometry={ARM_GEO} material={armorMat} />
          <mesh position={[0, -0.39, 0.01]} geometry={HAND_GEO} material={BOOT_MAT} />

          {npc.accessory === 'HOLO_TABLET' && (
            <group position={[0, -0.38, 0.09]} rotation={[0.45, 0, 0]}>
              <mesh geometry={TABLET_BASE_GEO} material={NAVY_LIMB_MAT} />
              <mesh position={[0, 0.01, 0]} geometry={TABLET_SCREEN_GEO} material={visorMat} />
            </group>
          )}

          {npc.accessory === 'BRIEFCASE' && (
            <group position={[0.04, -0.48, 0.02]}>
              <mesh geometry={BRIEFCASE_BODY_GEO} material={NAVY_LIMB_MAT} />
              <mesh position={[0.03, 0, 0]} geometry={BRIEFCASE_TRIM_GEO} material={secondaryMat} />
            </group>
          )}
        </group>

        {/* Left Leg & Boot */}
        <group ref={leftLegRef} position={[-0.11, -0.06, 0]}>
          <mesh position={[0, -0.38, 0]} geometry={LEG_GEO} material={NAVY_LIMB_MAT} />
          <mesh position={[0, -0.36, 0.058]} geometry={KNEE_GEO} material={SLATE_TRIM_MAT} />
          <mesh position={[0, -0.77, 0.04]} geometry={BOOT_GEO} material={BOOT_MAT} />
        </group>

        {/* Right Leg & Boot */}
        <group ref={rightLegRef} position={[0.11, -0.06, 0]}>
          <mesh position={[0, -0.38, 0]} geometry={LEG_GEO} material={NAVY_LIMB_MAT} />
          <mesh position={[0, -0.36, 0.058]} geometry={KNEE_GEO} material={SLATE_TRIM_MAT} />
          <mesh position={[0, -0.77, 0.04]} geometry={BOOT_GEO} material={BOOT_MAT} />
        </group>
      </group>
    </group>
  );
});
