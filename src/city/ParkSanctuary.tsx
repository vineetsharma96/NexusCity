import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { KinematicCollisionSolver } from '../player/KinematicCollision';
import { WeatherSystem } from '../world/WeatherSystem';
import { TimeSystem } from '../world/TimeSystem';
import { WindSystem } from '../world/WindSystem';
import { QualityManager, QualitySettings } from '../rendering/QualityManager';
import { InstanceBatchBuilder } from '../rendering/StaticInstanceBatcher';
import { InstanceBucketSpec, InstancedBatchLayer } from '../rendering/InstancedBatchView';
import {
  createSmoothBeveledBoxGeometry,
  createSmoothFoliageCrownGeometry,
} from '../rendering/SmoothWorldGeometries';

interface ParkSanctuaryProps {
  position?: [number, number, number];
}

interface ParkTreeSpec {
  pos: [number, number];
  height: number;
  crownRadius: number;
  primaryColor: string;
  secondaryColor: string;
}

const PARK_TREES: ParkTreeSpec[] = [
  { pos: [-22, -20], height: 6.4, crownRadius: 3.3, primaryColor: '#fb7185', secondaryColor: '#fda4af' },
  { pos: [-14, -24], height: 5.8, crownRadius: 2.9, primaryColor: '#fda4af', secondaryColor: '#fecdd3' },
  { pos: [-26, -12], height: 6.2, crownRadius: 3.1, primaryColor: '#fb7185', secondaryColor: '#fda4af' },
  { pos: [-17, -13], height: 5.5, crownRadius: 2.7, primaryColor: '#f43f5e', secondaryColor: '#fda4af' },
  { pos: [22, -20], height: 6.8, crownRadius: 3.4, primaryColor: '#f59e0b', secondaryColor: '#fbbf24' },
  { pos: [14, -24], height: 6.0, crownRadius: 2.9, primaryColor: '#fbbf24', secondaryColor: '#fde047' },
  { pos: [26, -12], height: 6.4, crownRadius: 3.2, primaryColor: '#f59e0b', secondaryColor: '#fbbf24' },
  { pos: [17, -13], height: 5.6, crownRadius: 2.7, primaryColor: '#fbbf24', secondaryColor: '#fde047' },
  { pos: [-22, 20], height: 6.5, crownRadius: 3.3, primaryColor: '#10b981', secondaryColor: '#34d399' },
  { pos: [-14, 24], height: 5.9, crownRadius: 2.9, primaryColor: '#34d399', secondaryColor: '#6ee7b7' },
  { pos: [-26, 12], height: 6.2, crownRadius: 3.1, primaryColor: '#059669', secondaryColor: '#38bdf8' },
  { pos: [22, 20], height: 6.6, crownRadius: 3.3, primaryColor: '#fb7185', secondaryColor: '#f59e0b' },
  { pos: [14, 24], height: 5.9, crownRadius: 2.8, primaryColor: '#f59e0b', secondaryColor: '#fda4af' },
  { pos: [26, 12], height: 6.2, crownRadius: 3.0, primaryColor: '#10b981', secondaryColor: '#fbbf24' },
  { pos: [-27, -4.5], height: 6.0, crownRadius: 3.0, primaryColor: '#10b981', secondaryColor: '#34d399' },
  { pos: [27, 4.5], height: 6.0, crownRadius: 3.0, primaryColor: '#f59e0b', secondaryColor: '#fbbf24' },
];

const LOTUS_PADS: { x: number; z: number; r: number; flowerColor: string; phase: number }[] = [
  { x: -11, z: -7.5, r: 0.95, flowerColor: '#fb7185', phase: 0.2 },
  { x: -8.2, z: -9.5, r: 0.72, flowerColor: '#fda4af', phase: 1.1 },
  { x: 10.5, z: -8.0, r: 0.9, flowerColor: '#f59e0b', phase: 2.0 },
  { x: 13.0, z: -5.5, r: 0.75, flowerColor: '#fbbf24', phase: 2.9 },
  { x: -12.0, z: 7.2, r: 0.92, flowerColor: '#38bdf8', phase: 3.7 },
  { x: -8.5, z: 9.2, r: 0.68, flowerColor: '#10b981', phase: 4.4 },
  { x: 11.2, z: 7.8, r: 0.88, flowerColor: '#fb7185', phase: 5.1 },
  { x: 8.4, z: 9.6, r: 0.7, flowerColor: '#34d399', phase: 5.8 },
];

const BAMBOO_STALKS: readonly [number, number, number][] = [
  [-2.2, -1.8, 6.2],
  [-1.5, -2.4, 5.4],
  [-2.8, -0.9, 5.8],
  [1.8, 2.1, 6.5],
  [2.5, 1.4, 5.6],
  [1.2, 2.7, 5.9],
  [-0.5, 1.6, 5.2],
  [0.8, -1.5, 6.0],
];

const LANTERN_POSITIONS: readonly [number, number][] = [
  [-16, -6], [16, -6], [-16, 6], [16, 6],
  [-6, -18], [6, -18], [-6, 18], [6, 18],
  [-24, -4], [24, -4], [-24, 4], [24, 4],
];

const BENCH_SPECS: readonly [number, number, number][] = [
  [-18, -10, Math.PI / 4],
  [18, -10, -Math.PI / 4],
  [-18, 10, (3 * Math.PI) / 4],
  [18, 10, -(3 * Math.PI) / 4],
];

// Shared static smooth geometries & materials across both ParkSanctuary instances
const UNIT_BOX = createSmoothBeveledBoxGeometry(0.06, 2);
const UNIT_CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
const UNIT_TRUNK = new THREE.CylinderGeometry(0.22, 0.44, 1, 14);
const UNIT_CROWN = createSmoothFoliageCrownGeometry();
const UNIT_SPHERE = new THREE.SphereGeometry(0.2, 14, 12);
const STEP_STONE_GEO = new THREE.CylinderGeometry(1.15, 1.25, 0.1, 20);
const STEP_RING_GEO = new THREE.RingGeometry(0.98, 1.08, 20);
const LILY_PAD_GEO = new THREE.CircleGeometry(1, 24);
const LILY_FLOWER_GEO = (() => {
  const g = new THREE.SphereGeometry(0.22, 14, 10);
  g.scale(1.0, 0.72, 1.0);
  return g;
})();

const MAT_WALL = new THREE.MeshStandardMaterial({ color: '#0b1120', roughness: 0.28, metalness: 0.86 });
const MAT_NAVY = new THREE.MeshStandardMaterial({ color: '#0f172a', metalness: 0.9, roughness: 0.2 });
const MAT_SLATE = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.35, metalness: 0.75 });
const MAT_BAMBOO = new THREE.MeshStandardMaterial({
  color: '#10b981',
  emissive: '#059669',
  emissiveIntensity: 0.28,
  roughness: 0.35,
});
const MAT_TRUNK = new THREE.MeshStandardMaterial({ color: '#271e16', roughness: 0.82 });
const MAT_CROWN = new THREE.MeshStandardMaterial({
  color: '#ffffff',
  emissive: '#1e293b',
  emissiveIntensity: 0.24,
  roughness: 0.48,
});
const MAT_BASIC_COLORED = new THREE.MeshBasicMaterial({ color: '#ffffff' });
const MAT_LILY_PAD = new THREE.MeshStandardMaterial({ color: '#065f46', roughness: 0.65, metalness: 0.15 });

export const ParkSanctuary: React.FC<ParkSanctuaryProps> = ({ position = [75, 0, 75] }) => {
  const origin = useMemo(() => new THREE.Vector3(...position), [position[0], position[1], position[2]]);
  const waterMatRef = useRef<THREE.ShaderMaterial>(null);
  const lotusRef = useRef<THREE.Group>(null);
  const lilyGroupRef = useRef<THREE.Group>(null);
  const windSystem = WindSystem.getInstance();
  const [quality, setQuality] = useState<QualitySettings>(() => QualityManager.current);

  const lanternGlowMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), []);
  useEffect(() => () => lanternGlowMat.dispose(), [lanternGlowMat]);

  useEffect(() => QualityManager.subscribe(setQuality), []);

  // Perimeter walls with 8m-wide entry portals on all 4 cardinal directions
  const walls = useMemo(
    () => [
      ...([-19.5, 19.5] as const).flatMap((x) =>
        ([-35, 35] as const).map((z) => ({
          position: [x, 0.6, z] as [number, number, number],
          size: [31, 1.2, 1.2] as [number, number, number],
        }))
      ),
      ...([-35, 35] as const).flatMap((x) =>
        ([-19.5, 19.5] as const).map((z) => ({
          position: [x, 0.6, z] as [number, number, number],
          size: [1.2, 1.2, 31] as [number, number, number],
        }))
      ),
    ],
    []
  );

  useEffect(() => {
    const colliders = [
      { position: [-11.5, 0.4, 0] as [number, number, number], size: [3.2, 0.7, 4.8] as [number, number, number] },
      { position: [0, 0.85, 0] as [number, number, number], size: [23, 0.35, 4.6] as [number, number, number] },
      { position: [11.5, 0.4, 0] as [number, number, number], size: [3.2, 0.7, 4.8] as [number, number, number] },
      ...walls,
    ].map((b) => ({
      center: origin.clone().add(new THREE.Vector3(...b.position)),
      size: new THREE.Vector3(...b.size),
    }));

    colliders.forEach(({ center, size }) => KinematicCollisionSolver.addBox(center, size));
    return () => colliders.forEach(({ center }) => KinematicCollisionSolver.removeBox(center));
  }, [origin, walls]);

  // Batch static walls, gates, stepping stones, bamboo, lanterns, benches & 16 multi-crown trees (~12 draw calls total!)
  const batchedBuckets = useMemo(() => {
    const b = new InstanceBatchBuilder();

    // 4 Cardinal walkways
    b.addWorld('box_navy', -24.2, 0.265, 0, 20.0, 0.04, 5.4);
    b.addWorld('box_navy', 24.2, 0.265, 0, 20.0, 0.04, 5.4);
    b.addWorld('box_navy', 0, 0.265, -25.6, 5.4, 0.04, 17.2);
    b.addWorld('box_navy', 0, 0.265, 25.6, 5.4, 0.04, 17.2);

    // Perimeter walls + neon trims
    walls.forEach((w, idx) => {
      b.addWorld('box_wall', w.position[0], w.position[1], w.position[2], w.size[0], w.size[1], w.size[2]);
      b.addWorld(
        'box_basic',
        w.position[0],
        w.position[1] + 0.62,
        w.position[2],
        w.size[0],
        0.04,
        w.size[2],
        0,
        0,
        0,
        idx % 2 === 0 ? '#10b981' : '#38bdf8'
      );
    });

    // 4 Cardinal Sanctuary Portal Gates
    const gates: readonly [number, number, number, string][] = [
      [0, -34.4, 0, '#10b981'],
      [0, 34.4, Math.PI, '#10b981'],
      [-34.4, 0, Math.PI / 2, '#38bdf8'],
      [34.4, 0, -Math.PI / 2, '#f59e0b'],
    ];
    for (const [gx, gz, rot, accent] of gates) {
      b.addLocal('cyl_navy', gx, 0.24, gz, rot, -3.6, 2.6, 0, 0.5, 5.2, 0.5);
      b.addLocal('cyl_navy', gx, 0.24, gz, rot, 3.6, 2.6, 0, 0.5, 5.2, 0.5);
      b.addLocal('box_wall', gx, 0.24, gz, rot, 0, 5.1, 0, 9.2, 0.36, 0.55);
      b.addLocal('box_basic', gx, 0.24, gz, rot, 0, 4.45, 0, 7.8, 0.16, 0.36, 0, 0, 0, accent);
    }

    // North-South Lagoon Stepping Stones
    const stoneZs = [-13, -10.5, -8, -5.5, 5.5, 8, 10.5, 13];
    stoneZs.forEach((sz, idx) => {
      b.addWorld('step_stone', 0, 0.3, sz, 1, 1, 1);
      b.addWorld('step_ring', 0, 0.355, sz, 1, 1, 1, -Math.PI / 2, 0, 0, idx % 2 === 0 ? '#10b981' : '#38bdf8');
    });

    // SW Quadrant Bamboo Stalk Clusters
    if (quality.vegetationEnabled) {
      for (const [bx, bz, bh] of BAMBOO_STALKS) {
        b.addWorld('cyl_bamboo', -19 + bx, 0.24 + bh / 2, 19 + bz, 0.25, bh, 0.25);
        b.addWorld('cyl_basic', -19 + bx, 0.24 + bh * 0.5, 19 + bz, 0.28, 0.08, 0.28, 0, 0, 0, '#34d399');
      }
    }

    // Lantern Bollards & Curved Viewing Benches
    if (quality.streetFurnitureEnabled) {
      LANTERN_POSITIONS.forEach(([lx, lz], idx) => {
        b.addWorld('cyl_navy', lx, 0.24 + 0.65, lz, 0.28, 1.3, 0.28);
        b.addWorld(
          'lantern_orb',
          lx,
          0.24 + 1.38,
          lz,
          1,
          1,
          1,
          0,
          0,
          0,
          idx % 3 === 0 ? '#10b981' : idx % 3 === 1 ? '#f59e0b' : '#38bdf8'
        );
      });

      BENCH_SPECS.forEach(([bx, bz, rot], idx) => {
        b.addLocal('box_slate', bx, 0.25, bz, rot, 0, 0.32, 0, 2.6, 0.14, 0.7);
        b.addLocal('box_navy', bx, 0.25, bz, rot, 0, 0.62, -0.28, 2.6, 0.45, 0.1);
        b.addLocal('box_lantern', bx, 0.25, bz, rot, 0, 0.12, 0, 2.2, 0.04, 0.45, 0, 0, 0, idx % 2 === 0 ? '#10b981' : '#f59e0b');
      });
    }

    // 16 Multi-Layered Botanical Grove Trees (3 crowns + trunk = 64 meshes -> 2 draw calls!)
    if (quality.vegetationEnabled) {
      for (const tree of PARK_TREES) {
        const [tx, tz] = tree.pos;
        const r = tree.crownRadius;
        b.addWorld('tree_trunk', tx, 0.2 + tree.height * 0.45, tz, 1, tree.height * 0.9, 1);
        b.addWorld('tree_crown', tx, 0.2 + tree.height, tz, r, r, r, 0, 0, 0, tree.primaryColor);
        b.addWorld('tree_crown', tx + r * 0.35, 0.2 + tree.height + r * 0.42, tz + r * 0.25, r * 0.72, r * 0.72, r * 0.72, 0, 0, 0, tree.secondaryColor);
        b.addWorld('tree_crown', tx - r * 0.42, 0.2 + tree.height - r * 0.25, tz - r * 0.3, r * 0.65, r * 0.65, r * 0.65, 0, 0, 0, tree.secondaryColor);
      }
    }

    return b.build();
  }, [walls, quality.vegetationEnabled, quality.streetFurnitureEnabled]);

  const bucketSpecs = useMemo<InstanceBucketSpec[]>(
    () => [
      { key: 'box_wall', geometry: UNIT_BOX, material: MAT_WALL, castShadow: quality.shadows, receiveShadow: quality.shadows },
      { key: 'box_navy', geometry: UNIT_BOX, material: MAT_NAVY, receiveShadow: quality.shadows },
      { key: 'box_slate', geometry: UNIT_BOX, material: MAT_SLATE, receiveShadow: quality.shadows },
      { key: 'box_basic', geometry: UNIT_BOX, material: MAT_BASIC_COLORED },
      { key: 'box_lantern', geometry: UNIT_BOX, material: lanternGlowMat },
      { key: 'cyl_navy', geometry: UNIT_CYL, material: MAT_NAVY },
      { key: 'cyl_bamboo', geometry: UNIT_CYL, material: MAT_BAMBOO },
      { key: 'cyl_basic', geometry: UNIT_CYL, material: MAT_BASIC_COLORED },
      { key: 'step_stone', geometry: STEP_STONE_GEO, material: MAT_SLATE },
      { key: 'step_ring', geometry: STEP_RING_GEO, material: MAT_BASIC_COLORED },
      { key: 'lantern_orb', geometry: UNIT_SPHERE, material: lanternGlowMat },
      { key: 'tree_trunk', geometry: UNIT_TRUNK, material: MAT_TRUNK, castShadow: quality.shadows },
      { key: 'tree_crown', geometry: UNIT_CROWN, material: MAT_CROWN, castShadow: quality.shadows },
    ],
    [quality.shadows, lanternGlowMat]
  );

  const waterUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uRainIntensity: { value: 0 },
      uWindStrength: { value: 1.0 },
      uDeepColor: { value: new THREE.Color('#022c22') },
      uShallowColor: { value: new THREE.Color('#0d9488') },
      uHighlightColor: { value: new THREE.Color('#38bdf8') },
    }),
    []
  );

  useFrame(({ clock, camera }) => {
    const dx = camera.position.x - origin.x;
    const dz = camera.position.z - origin.z;
    if (dx * dx + dz * dz > 260 * 260) return;

    const t = clock.getElapsedTime();
    const wState = WeatherSystem.getInstance().getState();
    const tState = TimeSystem.getInstance().getState();
    const gust = windSystem.getGustFactor();

    const lanternActive = tState.streetLightsOn && QualityManager.current.nightLightsEnabled;
    if (lanternActive) {
      lanternGlowMat.color.setScalar(1.0 + tState.nightFactor * 1.1);
    } else {
      lanternGlowMat.color.set('#1e293b');
    }

    if (waterMatRef.current) {
      waterMatRef.current.uniforms.uTime.value = t;
      waterMatRef.current.uniforms.uRainIntensity.value = wState.rainIntensity;
      waterMatRef.current.uniforms.uWindStrength.value = gust;
    }

    if (lotusRef.current) {
      lotusRef.current.rotation.y = t * 0.45;
      lotusRef.current.position.y = 4.8 + Math.sin(t * 1.8) * 0.18;
      lotusRef.current.children.forEach((child, idx) => {
        if (idx > 0) child.rotation.z = t * (0.35 + idx * 0.2);
      });
    }

    if (lilyGroupRef.current) {
      lilyGroupRef.current.children.forEach((pad, idx) => {
        const spec = LOTUS_PADS[idx];
        if (!spec) return;
        pad.position.y = 0.31 + Math.sin(t * 2.1 + spec.phase) * 0.025;
        pad.rotation.z = Math.sin(t * 1.5 + spec.phase) * 0.04 * gust;
      });
    }
  });

  return (
    <group position={position} name="CentralParkSanctuary">
      {/* Main Botanical Lawn Terrace */}
      <mesh position={[0, 0.12, 0]} receiveShadow={quality.shadows}>
        <boxGeometry args={[70, 0.24, 70]} />
        <meshStandardMaterial color="#052e16" roughness={0.78} metalness={0.08} />
      </mesh>

      {/* Concentric Inner Moss & Clover Lawn Terrace */}
      <mesh position={[0, 0.255, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow={quality.shadows}>
        <ringGeometry args={[19.5, 31.5, 48]} />
        <meshStandardMaterial
          color="#064e3b"
          roughness={0.72}
          metalness={0.12}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </mesh>

      {/* Circular Perimeter Ring Promenade */}
      <mesh position={[0, 0.292, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow={quality.shadows}>
        <ringGeometry args={[23.5, 26.2, 48]} />
        <meshStandardMaterial
          color="#111827"
          roughness={0.38}
          metalness={0.65}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>
      <mesh position={[0, 0.302, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[23.35, 23.5, 48]} />
        <meshBasicMaterial color="#10b981" polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-3} />
      </mesh>
      <mesh position={[0, 0.302, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[26.2, 26.35, 48]} />
        <meshBasicMaterial color="#38bdf8" polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-3} />
      </mesh>

      {/* Sunken Bioluminescent Mirror Lagoon & Basalt Basin Rim */}
      <mesh position={[0, 0.285, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[16.2, 17.4, 48]} />
        <meshStandardMaterial
          color="#0f172a"
          metalness={0.85}
          roughness={0.25}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>
      <mesh position={[0, 0.298, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[16.05, 16.22, 48]} />
        <meshBasicMaterial color="#38bdf8" polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-3} />
      </mesh>

      <mesh position={[0, 0.305, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[16.08, 48]} />
        <shaderMaterial
          ref={waterMatRef}
          uniforms={waterUniforms}
          vertexShader={`
            varying vec2 vUv;
            uniform float uTime;
            uniform float uWindStrength;
            void main() {
              vUv = uv;
              vec3 pos = position;
              float wave = (sin(pos.x * 0.42 + uTime * 2.1) * 0.022 + cos(pos.y * 0.48 - uTime * 1.6) * 0.018) * min(uWindStrength, 1.5);
              pos.z += clamp(wave, -0.03, 0.03);
              gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
            }
          `}
          fragmentShader={`
            uniform float uTime;
            uniform float uRainIntensity;
            uniform vec3 uDeepColor;
            uniform vec3 uShallowColor;
            uniform vec3 uHighlightColor;
            varying vec2 vUv;
            void main() {
              vec2 centered = vUv - 0.5;
              float dist = length(centered) * 2.0;
              vec2 p = vUv * 18.0;
              float wave = sin(p.x + uTime * 2.2) * cos(p.y - uTime * 1.8);
              float ring = sin(dist * 24.0 - uTime * 3.0) * 0.5 + 0.5;
              float caustic = pow(max(0.0, wave), 3.0) + ring * 0.18 + uRainIntensity * 0.22;
              vec3 col = mix(uDeepColor, uShallowColor, clamp(dist, 0.0, 1.0)) + uHighlightColor * caustic * 0.42;
              gl_FragColor = vec4(col, 0.9);
            }
          `}
          transparent
          depthWrite={false}
        />
      </mesh>

      {/* Floating Illuminated Lotus & Lily Pad Islands */}
      <group ref={lilyGroupRef}>
        {LOTUS_PADS.map((pad, idx) => (
          <group key={`lily-${idx}`} position={[pad.x, 0.31, pad.z]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} scale={[pad.r, pad.r, 1]} geometry={LILY_PAD_GEO} material={MAT_LILY_PAD} />
            <mesh position={[0, 0.08, 0]} geometry={LILY_FLOWER_GEO}>
              <meshBasicMaterial color={pad.flowerColor} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Grand Botanical Conservatory Rib Arches Spanning Lagoon */}
      {([-0.55, 0, 0.55] as const).map((rotY, idx) => (
        <group key={`arch-${idx}`} position={[0, 0.25, 0]} rotation={[0, rotY, 0]}>
          <mesh material={MAT_NAVY}>
            <torusGeometry args={[16.5, 0.14, 10, 40, Math.PI]} />
          </mesh>
          <mesh>
            <torusGeometry args={[16.22, 0.045, 8, 40, Math.PI]} />
            <meshBasicMaterial color={idx === 1 ? '#10b981' : '#38bdf8'} />
          </mesh>
        </group>
      ))}

      {/* Suspended Kinetic Hydro-Sculpture & Botanical Core above Footbridge */}
      <group ref={lotusRef} position={[0, 4.8, 0]}>
        <mesh>
          <octahedronGeometry args={[1.05, 0]} />
          <meshBasicMaterial color="#10b981" wireframe />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[2.1, 0.05, 8, 32]} />
          <meshBasicMaterial color="#38bdf8" />
        </mesh>
        <mesh rotation={[Math.PI / 4, Math.PI / 4, 0]}>
          <torusGeometry args={[2.75, 0.04, 8, 32]} />
          <meshBasicMaterial color="#f59e0b" />
        </mesh>
      </group>

      {/* Sculpted Central Promenade Bridge */}
      <group>
        <mesh position={[0, 0.85, 0]} castShadow={quality.shadows} receiveShadow={quality.shadows} material={MAT_SLATE}>
          <boxGeometry args={[23, 0.35, 4.6]} />
        </mesh>
        <mesh position={[0, 1.25, -2.15]}>
          <boxGeometry args={[22.4, 0.55, 0.06]} />
          <meshStandardMaterial color="#38bdf8" transparent opacity={0.32} metalness={0.9} roughness={0.1} />
        </mesh>
        <mesh position={[0, 1.25, 2.15]}>
          <boxGeometry args={[22.4, 0.55, 0.06]} />
          <meshStandardMaterial color="#38bdf8" transparent opacity={0.32} metalness={0.9} roughness={0.1} />
        </mesh>
        <mesh position={[0, 1.55, -2.15]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.055, 0.055, 22.8, 8]} />
          <meshBasicMaterial color="#f59e0b" />
        </mesh>
        <mesh position={[0, 1.55, 2.15]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.055, 0.055, 22.8, 8]} />
          <meshBasicMaterial color="#f59e0b" />
        </mesh>
        <mesh position={[-12.9, 0.46, 0]} receiveShadow={quality.shadows} material={MAT_SLATE}>
          <boxGeometry args={[2.76, 0.44, 4.8]} />
        </mesh>
        <mesh position={[12.9, 0.46, 0]} receiveShadow={quality.shadows} material={MAT_SLATE}>
          <boxGeometry args={[2.76, 0.44, 4.8]} />
        </mesh>
      </group>

      {/* NE Quadrant: Zen Raked Gravel Rings & Sculptural Monolith Stones */}
      <group position={[19, 0.275, -19]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[5.5, 28]} />
          <meshStandardMaterial color="#1e293b" roughness={0.85} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
        </mesh>
        {[2.0, 3.4, 4.8].map((r, rIdx) => (
          <mesh key={rIdx} position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[r - 0.08, r, 28]} />
            <meshBasicMaterial color="#f59e0b" transparent opacity={0.45} polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-3} />
          </mesh>
        ))}
        <mesh position={[-1.2, 0.9, 0.5]} material={MAT_SLATE}>
          <dodecahedronGeometry args={[1.1, 0]} />
        </mesh>
        <mesh position={[1.4, 0.65, -0.8]} material={MAT_SLATE}>
          <dodecahedronGeometry args={[0.8, 0]} />
        </mesh>
      </group>

      {/* SE Quadrant: Meditation Sundial Terrace */}
      <group position={[19, 0.275, 19]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[5.2, 28]} />
          <meshStandardMaterial color="#0f172a" metalness={0.78} roughness={0.3} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
        </mesh>
        <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[4.85, 5.1, 28]} />
          <meshBasicMaterial color="#38bdf8" polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-3} />
        </mesh>
        <mesh position={[0, 1.1, 0]} rotation={[0.4, 0.5, 0]}>
          <torusGeometry args={[1.1, 0.06, 8, 24]} />
          <meshBasicMaterial color="#f59e0b" />
        </mesh>
      </group>

      {/* Instanced Walls, Gates, Stepping Stones, Bamboo, Lanterns, Benches & 16 Multi-Crown Grove Trees */}
      <InstancedBatchLayer buckets={batchedBuckets} specs={bucketSpecs} name="ParkSanctuaryStaticBatched" />
    </group>
  );
};
