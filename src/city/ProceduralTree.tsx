import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { TreeDef } from './VegetationGenerator';
import { WindSystem } from '../world/WindSystem';
import { KinematicCollisionSolver } from '../player/KinematicCollision';
import { QualityManager } from '../rendering/QualityManager';

interface ProceduralTreeProps {
  tree: TreeDef;
  registerGlobalCollider?: boolean;
}

const SHARED_BOX_GEO = new THREE.BoxGeometry(1, 1, 1);
const SHARED_MOUND_GEO = new THREE.CylinderGeometry(1.6, 2.0, 0.14, 8);
const SHARED_TRUNK_GEO = new THREE.CylinderGeometry(0.7, 1.0, 1.0, 7);
const SHARED_BRANCH_GEO = new THREE.CylinderGeometry(0.7, 1.0, 1.0, 5);
const SHARED_CROWN_GEO = new THREE.DodecahedronGeometry(1, 1);

const PLANTER_MAT = new THREE.MeshStandardMaterial({ color: '#0b0f19', metalness: 0.85, roughness: 0.25 });
const MOUND_MAT = new THREE.MeshStandardMaterial({ color: '#062e1a', roughness: 0.85 });
const TRUNK_MAT = new THREE.MeshStandardMaterial({ color: '#271e16', roughness: 0.82 });

const leafMatCache = new Map<string, THREE.MeshStandardMaterial>();
function getLeafMaterial(color: string, emissive: string, emissiveIntensity: number): THREE.MeshStandardMaterial {
  const key = `${color}|${emissive}|${emissiveIntensity}`;
  let mat = leafMatCache.get(key);
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({
      color,
      emissive,
      emissiveIntensity,
      roughness: 0.5,
      flatShading: true,
    });
    leafMatCache.set(key, mat);
  }
  return mat;
}

const trimMatCache = new Map<string, THREE.MeshBasicMaterial>();
function getTrimMaterial(color: string): THREE.MeshBasicMaterial {
  let mat = trimMatCache.get(color);
  if (!mat) {
    mat = new THREE.MeshBasicMaterial({ color });
    trimMatCache.set(color, mat);
  }
  return mat;
}

const UP_AXIS = new THREE.Vector3(0, 1, 0);

export const ProceduralTree: React.FC<ProceduralTreeProps> = React.memo(({ tree, registerGlobalCollider = false }) => {
  const canopyRef = useRef<THREE.Group>(null);
  const windSystem = WindSystem.getInstance();

  useEffect(() => {
    if (!registerGlobalCollider) return;
    const halfR = Math.max(0.35, tree.trunkRadius * 1.2);
    const center = tree.position.clone().add(new THREE.Vector3(0, tree.trunkHeight / 2, 0));
    const size = new THREE.Vector3(halfR * 2, tree.trunkHeight, halfR * 2);
    KinematicCollisionSolver.addBox(center, size);
    return () => KinematicCollisionSolver.removeBox(center);
  }, [tree.position, tree.trunkHeight, tree.trunkRadius, registerGlobalCollider]);

  const branchTransforms = useMemo(() => {
    const pivot = new THREE.Vector3(0, tree.trunkHeight * 0.45, 0);
    return tree.branches.map((b) => {
      const s = b.start.clone().sub(pivot);
      const e = b.end.clone().sub(pivot);
      const mid = s.clone().add(e).multiplyScalar(0.5);
      const len = s.distanceTo(e);
      const quat = new THREE.Quaternion().setFromUnitVectors(UP_AXIS, e.clone().sub(s).normalize());
      return { mid, len, radius: b.radius, quat };
    });
  }, [tree.branches, tree.trunkHeight]);

  useFrame(({ clock, camera }) => {
    if (!canopyRef.current) return;
    if (QualityManager.current.LODQuality === 'LOW') return;

    const dx = camera.position.x - tree.position.x;
    const dz = camera.position.z - tree.position.z;
    if (dx * dx + dz * dz > 95 * 95) return;

    const t = clock.getElapsedTime();
    const wind = windSystem.getVector();
    const gust = windSystem.getGustFactor();
    const phase = tree.position.x * 0.15 + tree.position.z * 0.12;
    const amp = (0.035 + (gust - 1.0) * 0.05) * (tree.species === 'WILLOW' ? 1.5 : 1.0);

    canopyRef.current.rotation.x = Math.sin(t * 1.35 + phase) * amp + wind.x * 0.0025 * gust;
    canopyRef.current.rotation.z = Math.cos(t * 1.15 + phase) * amp + wind.z * 0.0025 * gust;
  });

  const castShadow = QualityManager.current.shadows && registerGlobalCollider;
  const trimMat = getTrimMaterial(tree.emissiveColor || '#f59e0b');

  return (
    <group position={tree.position}>
      {tree.hasPlanter ? (
        <>
          <mesh
            position={[0, 0.19, 0]}
            scale={[tree.planterSize.x, tree.planterSize.y, tree.planterSize.z]}
            geometry={SHARED_BOX_GEO}
            material={PLANTER_MAT}
            receiveShadow
          />
          <mesh
            position={[0, 0.39, tree.planterSize.z / 2]}
            scale={[tree.planterSize.x, 0.03, 0.03]}
            geometry={SHARED_BOX_GEO}
            material={trimMat}
          />
        </>
      ) : (
        <mesh position={[0, 0.07, 0]} geometry={SHARED_MOUND_GEO} material={MOUND_MAT} receiveShadow />
      )}

      <mesh
        position={[0, tree.trunkHeight / 2, 0]}
        scale={[tree.trunkRadius, tree.trunkHeight, tree.trunkRadius]}
        geometry={SHARED_TRUNK_GEO}
        material={TRUNK_MAT}
        castShadow={castShadow}
        receiveShadow
      />

      <group ref={canopyRef} position={[0, tree.trunkHeight * 0.45, 0]}>
        {branchTransforms.map((bt, bIdx) => (
          <mesh
            key={bIdx}
            position={bt.mid}
            quaternion={bt.quat}
            scale={[bt.radius, bt.len, bt.radius]}
            geometry={SHARED_BRANCH_GEO}
            material={TRUNK_MAT}
          />
        ))}

        {tree.leafClusters.map((lc, lcIdx) => (
          <mesh
            key={lcIdx}
            position={[lc.offset.x, lc.offset.y - tree.trunkHeight * 0.45, lc.offset.z]}
            scale={lc.scale}
            geometry={SHARED_CROWN_GEO}
            material={getLeafMaterial(lc.color, tree.emissiveColor || '#000000', tree.emissiveIntensity || 0.08)}
            castShadow={castShadow}
          />
        ))}
      </group>
    </group>
  );
});
