import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { TreeDef } from './VegetationGenerator';
import { WindSystem } from '../world/WindSystem';
import { KinematicCollisionSolver } from '../player/KinematicCollision';

interface ProceduralTreeProps {
  tree: TreeDef;
  registerGlobalCollider?: boolean;
}

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

  useFrame(({ clock }) => {
    if (!canopyRef.current) return;
    const t = clock.getElapsedTime();
    const wind = windSystem.getVector();
    const gust = windSystem.getGustFactor();
    const phase = tree.position.x * 0.15 + tree.position.z * 0.12;
    const amp = (0.035 + (gust - 1.0) * 0.05) * (tree.species === 'WILLOW' ? 1.5 : 1.0);

    canopyRef.current.rotation.x = Math.sin(t * 1.35 + phase) * amp + wind.x * 0.0025 * gust;
    canopyRef.current.rotation.z = Math.cos(t * 1.15 + phase) * amp + wind.z * 0.0025 * gust;
  });

  return (
    <group position={tree.position}>
      {tree.hasPlanter ? (
        <>
          <mesh position={[0, 0.19, 0]} castShadow receiveShadow>
            <boxGeometry args={[tree.planterSize.x, tree.planterSize.y, tree.planterSize.z]} />
            <meshStandardMaterial color="#0b0f19" metalness={0.85} roughness={0.25} />
          </mesh>
          <mesh position={[0, 0.39, tree.planterSize.z / 2]}>
            <boxGeometry args={[tree.planterSize.x, 0.03, 0.03]} />
            <meshBasicMaterial color={tree.emissiveColor || '#f59e0b'} />
          </mesh>
        </>
      ) : (
        <mesh position={[0, 0.07, 0]} receiveShadow>
          <cylinderGeometry args={[1.6, 2.0, 0.14, 10]} />
          <meshStandardMaterial color="#062e1a" roughness={0.85} />
        </mesh>
      )}

      <mesh position={[0, tree.trunkHeight / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[tree.trunkRadius * 0.7, tree.trunkRadius, tree.trunkHeight, 8]} />
        <meshStandardMaterial color="#271e16" roughness={0.82} />
      </mesh>

      <group ref={canopyRef} position={[0, tree.trunkHeight * 0.45, 0]}>
        {tree.branches.map((b, bIdx) => {
          const pivot = new THREE.Vector3(0, tree.trunkHeight * 0.45, 0);
          const s = b.start.clone().sub(pivot);
          const e = b.end.clone().sub(pivot);
          const mid = s.clone().add(e).multiplyScalar(0.5);
          const len = s.distanceTo(e);
          const quat = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            e.clone().sub(s).normalize()
          );
          return (
            <mesh key={bIdx} position={mid} quaternion={quat} castShadow>
              <cylinderGeometry args={[b.radius * 0.7, b.radius, len, 6]} />
              <meshStandardMaterial color="#271e16" roughness={0.82} />
            </mesh>
          );
        })}

        {tree.leafClusters.map((lc, lcIdx) => (
          <mesh
            key={lcIdx}
            position={[lc.offset.x, lc.offset.y - tree.trunkHeight * 0.45, lc.offset.z]}
            scale={lc.scale}
            castShadow
            receiveShadow
          >
            <dodecahedronGeometry args={[1, 1]} />
            <meshStandardMaterial
              color={lc.color}
              emissive={tree.emissiveColor}
              emissiveIntensity={tree.emissiveIntensity || 0.08}
              roughness={0.5}
              flatShading
            />
          </mesh>
        ))}
      </group>
    </group>
  );
});
