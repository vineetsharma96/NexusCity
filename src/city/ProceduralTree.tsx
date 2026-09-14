import React, { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { TreeDef } from './VegetationGenerator';
import { WindSystem } from '../world/WindSystem';
import { KinematicCollisionSolver } from '../player/KinematicCollision';

interface ProceduralTreeProps {
  tree: TreeDef;
  registerGlobalCollider?: boolean;
}

export const ProceduralTree: React.FC<ProceduralTreeProps> = ({
  tree,
  registerGlobalCollider = false,
}) => {
  const canopyGroupRef = useRef<THREE.Group>(null);
  const windSystem = WindSystem.getInstance();

  // Register physical collision for tree trunk if not handled by chunk collider system
  useEffect(() => {
    if (!registerGlobalCollider) return;

    const halfRadius = Math.max(0.35, tree.trunkRadius * 1.2);
    const center = tree.position.clone().add(new THREE.Vector3(0, tree.trunkHeight / 2, 0));
    const size = new THREE.Vector3(halfRadius * 2, tree.trunkHeight, halfRadius * 2);

    KinematicCollisionSolver.addBox(center, size);

    return () => {
      KinematicCollisionSolver.removeBox(center);
    };
  }, [tree.position, tree.trunkHeight, tree.trunkRadius, registerGlobalCollider]);

  // Procedural wind sway animation on the tree foliage and upper canopy
  useFrame(({ clock }) => {
    if (!canopyGroupRef.current) return;

    const t = clock.getElapsedTime();
    const wind = windSystem.getVector();
    const gust = windSystem.getGustFactor();

    // Natural multi-frequency harmonic sway
    const freq = 1.4;
    const phase = tree.position.x * 0.15 + tree.position.z * 0.12;
    const swayAmp = (0.04 + (gust - 1.0) * 0.06) * (tree.species === 'WILLOW' ? 1.6 : 1.0);

    const swayX = Math.sin(t * freq + phase) * swayAmp + (wind.x * 0.003 * gust);
    const swayZ = Math.cos(t * (freq * 0.85) + phase) * swayAmp + (wind.z * 0.003 * gust);

    canopyGroupRef.current.rotation.x = swayX;
    canopyGroupRef.current.rotation.z = swayZ;
  });

  return (
    <group position={tree.position}>
      {/* 1. Base Planter Box or Natural Mound */}
      {tree.hasPlanter ? (
        <>
          {/* Sidewalk Planter Curb */}
          <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
            <boxGeometry args={[tree.planterSize.x, tree.planterSize.y, tree.planterSize.z]} />
            <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.2} />
          </mesh>
          {/* Mulch / Soil Bed */}
          <mesh position={[0, 0.38, 0]}>
            <boxGeometry args={[tree.planterSize.x - 0.3, 0.05, tree.planterSize.z - 0.3]} />
            <meshStandardMaterial color="#1a1410" roughness={0.9} />
          </mesh>
          {/* Decorative Corner Planter Neon Trim */}
          <mesh position={[0, 0.41, tree.planterSize.z / 2]}>
            <boxGeometry args={[tree.planterSize.x, 0.04, 0.04]} />
            <meshBasicMaterial
              color={tree.emissiveColor || '#00ffaa'}
            />
          </mesh>
        </>
      ) : (
        /* Natural Turf Mound Bed */
        <mesh position={[0, 0.08, 0]} receiveShadow>
          <cylinderGeometry args={[1.8, 2.2, 0.16, 12]} />
          <meshStandardMaterial color="#062e1a" roughness={0.8} />
        </mesh>
      )}

      {/* 2. Rigid Lower Trunk */}
      <mesh position={[0, tree.trunkHeight / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry
          args={[tree.trunkRadius * 0.7, tree.trunkRadius, tree.trunkHeight, 8]}
        />
        <meshStandardMaterial color="#2d2218" roughness={0.8} metalness={0.1} />
      </mesh>

      {/* 3. Swaying Organic Branches & Canopy Group */}
      <group ref={canopyGroupRef} position={[0, tree.trunkHeight * 0.45, 0]}>
        {/* Upper Branches */}
        {tree.branches.map((b, bIdx) => {
          // Adjust start/end relative to canopy group pivot
          const localStart = b.start.clone().sub(new THREE.Vector3(0, tree.trunkHeight * 0.45, 0));
          const localEnd = b.end.clone().sub(new THREE.Vector3(0, tree.trunkHeight * 0.45, 0));
          const mid = localStart.clone().add(localEnd).multiplyScalar(0.5);
          const len = localStart.distanceTo(localEnd);
          const dir = localEnd.clone().sub(localStart).normalize();
          const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);

          return (
            <mesh
              key={`b-${bIdx}`}
              position={mid}
              quaternion={quat}
              castShadow
            >
              <cylinderGeometry args={[b.radius * 0.7, b.radius, len, 6]} />
              <meshStandardMaterial color="#2d2218" roughness={0.8} />
            </mesh>
          );
        })}

        {/* Volumetric Leaf Canopy Clusters */}
        {tree.leafClusters.map((lc, lcIdx) => {
          const localOffset = lc.offset.clone().sub(new THREE.Vector3(0, tree.trunkHeight * 0.45, 0));
          return (
            <mesh
              key={`lc-${lcIdx}`}
              position={localOffset}
              scale={lc.scale}
              castShadow
              receiveShadow
            >
              <dodecahedronGeometry args={[1, 1]} />
              <meshStandardMaterial
                color={lc.color}
                emissive={tree.emissiveColor}
                emissiveIntensity={tree.emissiveIntensity || 0.05}
                roughness={0.5}
                metalness={0.05}
                flatShading
              />
            </mesh>
          );
        })}
      </group>
    </group>
  );
};
