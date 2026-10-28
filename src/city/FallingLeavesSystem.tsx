import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { VegetationGenerator } from './VegetationGenerator';
import { WindSystem } from '../world/WindSystem';
import { QualityManager } from '../rendering/QualityManager';

interface FallingLeavesSystemProps {
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
  seed?: number;
}

interface CanopySource {
  x: number;
  y: number;
  z: number;
  groundY: number;
  radius: number;
  colors: string[];
}

interface LeafAgent {
  sourceIdx: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  rz: number;
  vrx: number;
  vry: number;
  vrz: number;
  scale: number;
  phase: number;
  restTimer: number;
  color: string;
}

const MAX_LEAVES = 760;

export const FallingLeavesSystem: React.FC<FallingLeavesSystemProps> = ({
  playerPosRef,
  seed = 847291,
}) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const windSystem = WindSystem.getInstance();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorObj = useMemo(() => new THREE.Color(), []);
  const prevPlayerPosRef = useRef(new THREE.Vector3());

  // Gather canopy spawn sources from Central District Avenue Trees + Redesigned Central Park Sanctuary Groves
  const canopySources = useMemo<CanopySource[]>(() => {
    const avenueTrees = VegetationGenerator.generateTrees(seed);
    const list: CanopySource[] = avenueTrees.map((t) => ({
      x: t.position.x,
      y: t.position.y + t.trunkHeight * 0.85,
      z: t.position.z,
      groundY: 0.065,
      radius: 2.3,
      colors:
        t.species === 'SAKURA'
          ? ['#fb7185', '#fda4af', '#f43f5e']
          : t.species === 'GINKGO'
          ? ['#f59e0b', '#fbbf24', '#fde047']
          : ['#10b981', '#34d399', '#059669'],
    }));

    // Add Central Park Sanctuary trees at [75, 0, 75]
    const parkTreeCoords: { dx: number; dz: number; colors: string[] }[] = [
      // NW Sakura Grove
      { dx: -22, dz: -20, colors: ['#fb7185', '#fda4af', '#f43f5e'] },
      { dx: -14, dz: -24, colors: ['#fb7185', '#fda4af', '#fecdd3'] },
      { dx: -26, dz: -12, colors: ['#fb7185', '#fda4af', '#f43f5e'] },
      { dx: -17, dz: -13, colors: ['#fb7185', '#fda4af', '#fecdd3'] },
      // NE Golden Ginkgo Zen Grove
      { dx: 22, dz: -20, colors: ['#f59e0b', '#fbbf24', '#fde047'] },
      { dx: 14, dz: -24, colors: ['#f59e0b', '#fbbf24', '#fde047'] },
      { dx: 26, dz: -12, colors: ['#f59e0b', '#fbbf24', '#d97706'] },
      { dx: 17, dz: -13, colors: ['#f59e0b', '#fbbf24', '#fde047'] },
      // SW Emerald & Cyan Bioluminescent Grove
      { dx: -22, dz: 20, colors: ['#10b981', '#34d399', '#38bdf8'] },
      { dx: -14, dz: 24, colors: ['#10b981', '#34d399', '#6ee7b7'] },
      { dx: -26, dz: 12, colors: ['#10b981', '#34d399', '#38bdf8'] },
      // SE Autumn & Sakura Overlook Grove
      { dx: 22, dz: 20, colors: ['#fb7185', '#f59e0b', '#fda4af'] },
      { dx: 14, dz: 24, colors: ['#f59e0b', '#fbbf24', '#fb7185'] },
      { dx: 26, dz: 12, colors: ['#10b981', '#f59e0b', '#34d399'] },
      // Lagoon Perimeter Willows
      { dx: -26, dz: 0, colors: ['#10b981', '#34d399', '#fb7185'] },
      { dx: 26, dz: 0, colors: ['#f59e0b', '#fbbf24', '#10b981'] },
      { dx: 0, dz: -25, colors: ['#fb7185', '#fda4af', '#f59e0b'] },
      { dx: 0, dz: 25, colors: ['#10b981', '#34d399', '#fbbf24'] },
    ];

    parkTreeCoords.forEach((pt) => {
      list.push({
        x: 75 + pt.dx,
        y: 6.2,
        z: 75 + pt.dz,
        groundY: 0.27,
        radius: 3.2,
        colors: pt.colors,
      });
    });

    return list;
  }, [seed]);

  const leaves = useMemo<LeafAgent[]>(() => {
    const list: LeafAgent[] = [];
    for (let i = 0; i < MAX_LEAVES; i++) {
      const sIdx = i % canopySources.length;
      const src = canopySources[sIdx];
      const angle = (i * 2.39996) % (Math.PI * 2);
      const r = Math.sqrt((i % 17) / 17) * src.radius;
      const startY = src.groundY + ((i * 37) % 100) / 100 * (src.y - src.groundY);
      const color = src.colors[i % src.colors.length];

      list.push({
        sourceIdx: sIdx,
        x: src.x + Math.cos(angle) * r,
        y: startY,
        z: src.z + Math.sin(angle) * r,
        vx: 0,
        vy: -0.9 - (i % 5) * 0.16,
        vz: 0,
        rx: (i * 0.7) % Math.PI,
        ry: (i * 1.3) % Math.PI,
        rz: (i * 1.9) % Math.PI,
        vrx: (i % 2 === 0 ? 1 : -1) * (1.5 + (i % 4) * 0.4),
        vry: (1.2 + (i % 3) * 0.5),
        vrz: (i % 2 === 1 ? 1 : -1) * (1.4 + (i % 5) * 0.35),
        scale: 0.11 + (i % 4) * 0.028,
        phase: i * 0.93,
        restTimer: 0,
        color,
      });
    }
    return list;
  }, [canopySources]);

  // Sculpted diamond-leaf blade geometry
  const leafGeo = useMemo(() => {
    const geo = new THREE.OctahedronGeometry(1, 0);
    geo.scale(1.35, 0.16, 0.72);
    return geo;
  }, []);

  React.useEffect(() => {
    if (!meshRef.current) return;
    for (let i = 0; i < leaves.length; i++) {
      meshRef.current.setColorAt(i, colorObj.set(leaves[i].color));
    }
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  }, [leaves, colorObj]);

  useFrame(({ clock }, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const quality = QualityManager.current;
    if (!quality.vegetationEnabled || quality.particlesDensity <= 0.02) {
      mesh.visible = false;
      return;
    }
    mesh.visible = true;

    const dt = Math.min(delta, 0.05);
    const t = clock.getElapsedTime();
    const windVec = windSystem.getVector();
    const gust = windSystem.getGustFactor();
    const pPos = playerPosRef.current;

    // Instantaneous player movement velocity for physical leaf-wake interaction
    const pvx = (pPos.x - prevPlayerPosRef.current.x) / Math.max(0.001, dt);
    const pvz = (pPos.z - prevPlayerPosRef.current.z) / Math.max(0.001, dt);
    const playerSpeed = Math.hypot(pvx, pvz);
    prevPlayerPosRef.current.copy(pPos);

    const activeCount = Math.min(
      MAX_LEAVES,
      Math.max(160, Math.round(520 * Math.min(1.45, quality.particlesDensity)))
    );

    const sectorShiftX = Math.abs(pPos.x) > 190 ? Math.round(pPos.x / 240) * 240 : 0;
    const sectorShiftZ = Math.abs(pPos.z) > 190 ? Math.round(pPos.z / 240) * 240 : 0;

    for (let i = 0; i < activeCount; i++) {
      const leaf = leaves[i];
      const src = canopySources[leaf.sourceIdx];

      // Determine local ground elevation (raised in Central Park Sanctuary [40..110, 40..110])
      const inPark = leaf.x >= 40 && leaf.x <= 110 && leaf.z >= 40 && leaf.z <= 110;
      const floorY = inPark ? 0.27 : src.groundY;

      // Check Character Physical Proximity & Wake Interaction (both in air and on the ground!)
      const dx = leaf.x - pPos.x;
      const dy = leaf.y - (pPos.y + 0.65);
      const dz = leaf.z - pPos.z;
      const horizDistSq = dx * dx + dz * dz;
      const interactRadius = 3.5;

      if (horizDistSq < interactRadius * interactRadius && Math.abs(dy) < 2.6) {
        const horizDist = Math.max(0.15, Math.sqrt(horizDistSq));
        const proximity = 1 - horizDist / interactRadius;
        const motionBoost = 1.0 + Math.min(2.8, playerSpeed * 0.26);

        // Tangential swirl vector around player + radial scatter + player slipstream
        const radialX = dx / horizDist;
        const radialZ = dz / horizDist;
        const swirlX = -radialZ;
        const swirlZ = radialX;

        const impulse = proximity * 9.5 * motionBoost;
        leaf.vx += (radialX * impulse * 0.85 + swirlX * impulse * 0.95 + pvx * 0.42) * dt;
        leaf.vz += (radialZ * impulse * 0.85 + swirlZ * impulse * 0.95 + pvz * 0.42) * dt;
        // Upward vortex kicks grounded or falling leaves into the air around the character!
        leaf.vy = Math.max(leaf.vy, 1.6 + proximity * (2.4 + Math.min(3.5, playerSpeed * 0.35)));
        leaf.restTimer = 0;
        leaf.vrx += (Math.random() - 0.5) * 8 * dt;
        leaf.vry += 6 * proximity * dt;
      }

      if (leaf.y <= floorY && leaf.vy <= 0) {
        // Leaf is resting on the ground/grass
        leaf.y = floorY;
        leaf.restTimer += dt;

        // Strong wind gusts can slide or re-lift grounded leaves
        if (gust > 1.55) {
          leaf.x += windVec.x * 0.14 * dt;
          leaf.z += windVec.z * 0.14 * dt;
        }

        // Respawn in tree canopy after resting on the ground
        if (leaf.restTimer > 3.8) {
          const angle = Math.random() * Math.PI * 2;
          const r = Math.sqrt(Math.random()) * src.radius;
          const shiftX = i % 2 === 0 ? sectorShiftX : 0;
          const shiftZ = i % 2 === 0 ? sectorShiftZ : 0;
          leaf.x = src.x + shiftX + Math.cos(angle) * r;
          leaf.y = src.y + (Math.random() - 0.3) * 1.4;
          leaf.z = src.z + shiftZ + Math.sin(angle) * r;
          leaf.vx = 0;
          leaf.vy = -0.95 - Math.random() * 0.6;
          leaf.vz = 0;
          leaf.restTimer = 0;
        }

        dummy.position.set(leaf.x, leaf.y, leaf.z);
        dummy.rotation.set(0.08, leaf.ry, 0.06);
        dummy.scale.setScalar(leaf.scale);
      } else {
        // Leaf is airborne: apply aerodynamic flutter, gravity, and global WindSystem drift
        const flutterX = Math.sin(t * 2.8 + leaf.phase) * 1.35;
        const flutterZ = Math.cos(t * 2.4 + leaf.phase * 1.3) * 1.35;

        // Aerodynamic drag & terminal fall velocity
        leaf.vx *= Math.max(0, 1 - dt * 2.2);
        leaf.vz *= Math.max(0, 1 - dt * 2.2);
        leaf.vy = THREE.MathUtils.lerp(leaf.vy, -1.15, dt * 2.6);

        leaf.x += (windVec.x * 0.36 * gust + flutterX + leaf.vx) * dt;
        leaf.y += (leaf.vy + windVec.y * 0.18) * dt;
        leaf.z += (windVec.z * 0.36 * gust + flutterZ + leaf.vz) * dt;

        leaf.rx += leaf.vrx * gust * dt;
        leaf.ry += leaf.vry * gust * dt;
        leaf.rz += leaf.vrz * gust * dt;

        dummy.position.set(leaf.x, Math.max(floorY, leaf.y), leaf.z);
        dummy.rotation.set(leaf.rx, leaf.ry, leaf.rz);
        dummy.scale.setScalar(leaf.scale);
      }

      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }

    mesh.count = activeCount;
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[leafGeo, undefined, MAX_LEAVES]}
      frustumCulled={false}
      name="FallingLeavesLayer"
    >
      <meshStandardMaterial
        color="#ffffff"
        roughness={0.45}
        metalness={0.12}
        side={THREE.DoubleSide}
      />
    </instancedMesh>
  );
};
