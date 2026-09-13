import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { TreeDef } from './VegetationGenerator';
import { WindSystem } from '../world/WindSystem';

interface FallingLeavesProps {
  trees: TreeDef[];
  count?: number;
  playerPosRef?: React.MutableRefObject<THREE.Vector3>;
}

interface LeafParticle {
  pos: THREE.Vector3;
  rot: THREE.Euler;
  rotSpeed: THREE.Vector3;
  fallSpeed: number;
  wobbleSpeed: number;
  wobbleAmp: number;
  scale: number;
  treePos: THREE.Vector3;
  groundRestTime: number;
}

export const FallingLeaves: React.FC<FallingLeavesProps> = ({ trees, count = 850, playerPosRef }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const windSystem = WindSystem.getInstance();

  const colors = useMemo(
    () => [
      new THREE.Color('#f59e0b'), // Golden amber ginkgo
      new THREE.Color('#10b981'), // Emerald jade
      new THREE.Color('#fb7185'), // Sakura blossom pink
      new THREE.Color('#fbbf24'), // Warm neon yellow
      new THREE.Color('#2dd4bf'), // Cyber teal
      new THREE.Color('#d97706'), // Rust copper
      new THREE.Color('#34d399'), // Spring cyber green
    ],
    []
  );

  // Initialize individual leaf simulation states
  const particles = useMemo(() => {
    const list: LeafParticle[] = [];
    const hasTrees = trees.length > 0;

    for (let i = 0; i < count; i++) {
      const tree = hasTrees ? trees[i % trees.length] : null;
      const basePos = tree
        ? tree.position
        : playerPosRef?.current
        ? playerPosRef.current
        : new THREE.Vector3(0, 0, 0);

      // Random canopy spawn position
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 3.5;
      const startX = basePos.x + Math.cos(angle) * radius;
      const startZ = basePos.z + Math.sin(angle) * radius;
      const startY = basePos.y + (tree ? tree.trunkHeight : 6.0) + Math.random() * 2.5;

      list.push({
        pos: new THREE.Vector3(startX, startY, startZ),
        rot: new THREE.Euler(
          Math.random() * Math.PI,
          Math.random() * Math.PI,
          Math.random() * Math.PI
        ),
        rotSpeed: new THREE.Vector3(
          (Math.random() - 0.5) * 4.0,
          (Math.random() - 0.5) * 4.5,
          (Math.random() - 0.5) * 3.5
        ),
        fallSpeed: 0.8 + Math.random() * 1.6,
        wobbleSpeed: 2.2 + Math.random() * 3.8,
        wobbleAmp: 0.25 + Math.random() * 0.45,
        scale: 0.7 + Math.random() * 0.6,
        treePos: basePos.clone(),
        groundRestTime: 0,
      });
    }

    return list;
  }, [trees, count, playerPosRef]);

  // Set initial colors once
  useMemo(() => {
    if (!meshRef.current) return;
    for (let i = 0; i < count; i++) {
      const c = colors[i % colors.length];
      meshRef.current.setColorAt(i, c);
    }
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  }, [count, colors]);

  // Leaf Geometry: double-sided faceted aerodynamic diamond leaf
  const leafGeometry = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      0, 0, 0.24,     // Top tip
      -0.13, 0.025, 0, // Left edge
      0.13, 0.025, 0,  // Right edge
      0, 0, -0.16,    // Stem bottom
    ]);
    const indices = [
      0, 1, 2, // Upper face
      1, 3, 2, // Lower face
    ];
    geom.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    return geom;
  }, []);

  useFrame(({ clock }, delta) => {
    if (!meshRef.current) return;

    const t = clock.getElapsedTime();
    const windVec = windSystem.getVector();
    const gustFactor = windSystem.getGustFactor();
    const pPos = playerPosRef?.current;

    // Wind vector components scaled with gusts
    const windForceX = (windVec.x * 0.35 * gustFactor) * delta;
    const windForceZ = (windVec.z * 0.35 * gustFactor) * delta;

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];

      // Ground settling behavior
      if (p.pos.y <= 0.22) {
        p.groundRestTime += delta;

        // If gust is strong, blown off the ground early!
        const maxRestTime = gustFactor > 1.4 ? 0.8 : 2.6;

        if (p.groundRestTime > maxRestTime) {
          // Respawn in canopy
          let targetTree = trees.length > 0 ? trees[i % trees.length] : null;

          // If playerPosRef exists, check if player is near other trees
          if (pPos && trees.length > 4) {
            // Find trees within 65m of player
            const nearTree = trees.find((tr) => tr.position.distanceTo(pPos) < 65);
            if (nearTree && Math.random() > 0.4) {
              targetTree = nearTree;
            }
          }

          const baseOrigin = targetTree
            ? targetTree.position
            : pPos
            ? pPos
            : p.treePos;

          const angle = Math.random() * Math.PI * 2;
          const r = Math.random() * 3.2;
          p.pos.set(
            baseOrigin.x + Math.cos(angle) * r,
            baseOrigin.y + (targetTree ? targetTree.trunkHeight : 6.0) + Math.random() * 2.5,
            baseOrigin.z + Math.sin(angle) * r
          );
          p.groundRestTime = 0;
        }
      } else {
        // Natural airborne flutter with wind turbulence
        const flutter = Math.sin(t * p.wobbleSpeed + i) * p.wobbleAmp * delta * gustFactor;
        const updraft = Math.sin(t * 2.0 + p.pos.x * 0.2) * 0.15 * delta * (gustFactor - 1.0);

        p.pos.y -= (p.fallSpeed * delta) - updraft;
        p.pos.x += windForceX + flutter;
        p.pos.z += windForceZ + flutter * 0.7;

        // Tumbling rotational dynamics
        p.rot.x += p.rotSpeed.x * delta * gustFactor;
        p.rot.y += p.rotSpeed.y * delta * gustFactor;
        p.rot.z += p.rotSpeed.z * delta * gustFactor;
      }

      // Update instanced transform
      dummy.position.copy(p.pos);
      dummy.rotation.copy(p.rot);
      dummy.scale.setScalar(p.scale);
      dummy.updateMatrix();

      meshRef.current.setMatrixAt(i, dummy.matrix);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[leafGeometry, undefined, count]}
      castShadow
    >
      <meshStandardMaterial
        color="#f59e0b"
        roughness={0.4}
        metalness={0.1}
        side={THREE.DoubleSide}
      />
    </instancedMesh>
  );
};
