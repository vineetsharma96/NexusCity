import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { TreeDef } from './VegetationGenerator';

interface FallingLeavesProps {
  trees: TreeDef[];
  count?: number;
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

export const FallingLeaves: React.FC<FallingLeavesProps> = ({ trees, count = 750 }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Initialize individual leaf simulation states
  const particles = useMemo(() => {
    const list: LeafParticle[] = [];
    if (trees.length === 0) return list;

    const colors = [
      new THREE.Color('#f59e0b'), // Golden amber
      new THREE.Color('#10b981'), // Emerald jade
      new THREE.Color('#fbbf24'), // Warm yellow
      new THREE.Color('#d97706'), // Rust autumn
      new THREE.Color('#34d399'), // Cyber spring green
    ];

    for (let i = 0; i < count; i++) {
      const tree = trees[i % trees.length];
      // Random canopy spawn position
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 2.8;
      const startX = tree.position.x + Math.cos(angle) * radius;
      const startZ = tree.position.z + Math.sin(angle) * radius;
      const startY = tree.position.y + Math.random() * tree.trunkHeight + 2.0;

      list.push({
        pos: new THREE.Vector3(startX, startY, startZ),
        rot: new THREE.Euler(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI),
        rotSpeed: new THREE.Vector3(
          (Math.random() - 0.5) * 3.5,
          (Math.random() - 0.5) * 4.0,
          (Math.random() - 0.5) * 3.0
        ),
        fallSpeed: 0.9 + Math.random() * 1.5,
        wobbleSpeed: 2.5 + Math.random() * 3.5,
        wobbleAmp: 0.25 + Math.random() * 0.45,
        scale: 0.7 + Math.random() * 0.6,
        treePos: tree.position,
        groundRestTime: 0,
      });
    }

    return list;
  }, [trees, count]);

  // Set initial colors once
  useMemo(() => {
    if (!meshRef.current) return;
    const colors = [
      new THREE.Color('#f59e0b'),
      new THREE.Color('#10b981'),
      new THREE.Color('#fbbf24'),
      new THREE.Color('#d97706'),
      new THREE.Color('#34d399'),
    ];
    for (let i = 0; i < count; i++) {
      const c = colors[i % colors.length];
      meshRef.current.setColorAt(i, c);
    }
    meshRef.current.instanceColor!.needsUpdate = true;
  }, [count]);

  // Leaf Geometry: double-sided faceted diamond leaf
  const leafGeometry = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    // 4 vertices forming a curved diamond leaf
    const vertices = new Float32Array([
      0, 0, 0.22,      // Top tip
      -0.12, 0.02, 0,  // Left edge
      0.12, 0.02, 0,   // Right edge
      0, 0, -0.15,     // Stem bottom
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
    // Continuous dynamic wind force vector with gusts
    const gust = Math.sin(t * 0.4) * 0.8;
    const windX = (Math.sin(t * 0.7) * 1.4 + 1.8 + gust) * delta;
    const windZ = (Math.cos(t * 0.5) * 0.9) * delta;

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];

      // If resting on ground
      if (p.pos.y <= 0.2) {
        p.groundRestTime += delta;
        // Rest on ground for 1.5 - 3.5 seconds before respawning in tree
        if (p.groundRestTime > 2.5) {
          const angle = Math.random() * Math.PI * 2;
          const r = Math.random() * 2.8;
          p.pos.set(
            p.treePos.x + Math.cos(angle) * r,
            p.treePos.y + 5.5 + Math.random() * 2.5,
            p.treePos.z + Math.sin(angle) * r
          );
          p.groundRestTime = 0;
        }
      } else {
        // Falling with sinusoidal horizontal flutter
        const flutter = Math.sin(t * p.wobbleSpeed + i) * p.wobbleAmp * delta;
        p.pos.y -= p.fallSpeed * delta;
        p.pos.x += windX + flutter;
        p.pos.z += windZ + flutter * 0.6;

        // Tumbling rotations
        p.rot.x += p.rotSpeed.x * delta;
        p.rot.y += p.rotSpeed.y * delta;
        p.rot.z += p.rotSpeed.z * delta;
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
