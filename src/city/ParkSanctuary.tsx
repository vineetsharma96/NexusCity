import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { KinematicCollisionSolver } from '../player/KinematicCollision';
import { WeatherSystem } from '../world/WeatherSystem';
import { WindSystem } from '../world/WindSystem';
import { QualityManager, QualitySettings } from '../rendering/QualityManager';

interface ParkSanctuaryProps {
  position?: [number, number, number];
}

interface ParkTreeSpec {
  pos: [number, number];
  height: number;
  crownRadius: number;
  primaryColor: string;
  secondaryColor: string;
  emissiveColor: string;
}

const PARK_TREES: ParkTreeSpec[] = [
  // NW Quadrant: Sakura Blossom Grove
  { pos: [-22, -20], height: 6.4, crownRadius: 3.3, primaryColor: '#fb7185', secondaryColor: '#fda4af', emissiveColor: '#e11d48' },
  { pos: [-14, -24], height: 5.8, crownRadius: 2.9, primaryColor: '#fda4af', secondaryColor: '#fecdd3', emissiveColor: '#f43f5e' },
  { pos: [-26, -12], height: 6.2, crownRadius: 3.1, primaryColor: '#fb7185', secondaryColor: '#fda4af', emissiveColor: '#e11d48' },
  { pos: [-17, -13], height: 5.5, crownRadius: 2.7, primaryColor: '#f43f5e', secondaryColor: '#fda4af', emissiveColor: '#e11d48' },
  // NE Quadrant: Golden Ginkgo Zen Grove
  { pos: [22, -20], height: 6.8, crownRadius: 3.4, primaryColor: '#f59e0b', secondaryColor: '#fbbf24', emissiveColor: '#d97706' },
  { pos: [14, -24], height: 6.0, crownRadius: 2.9, primaryColor: '#fbbf24', secondaryColor: '#fde047', emissiveColor: '#d97706' },
  { pos: [26, -12], height: 6.4, crownRadius: 3.2, primaryColor: '#f59e0b', secondaryColor: '#fbbf24', emissiveColor: '#b45309' },
  { pos: [17, -13], height: 5.6, crownRadius: 2.7, primaryColor: '#fbbf24', secondaryColor: '#fde047', emissiveColor: '#d97706' },
  // SW Quadrant: Bioluminescent Emerald & Cyan Glade
  { pos: [-22, 20], height: 6.5, crownRadius: 3.3, primaryColor: '#10b981', secondaryColor: '#34d399', emissiveColor: '#059669' },
  { pos: [-14, 24], height: 5.9, crownRadius: 2.9, primaryColor: '#34d399', secondaryColor: '#6ee7b7', emissiveColor: '#10b981' },
  { pos: [-26, 12], height: 6.2, crownRadius: 3.1, primaryColor: '#059669', secondaryColor: '#38bdf8', emissiveColor: '#0284c7' },
  // SE Quadrant: Autumn & Sakura Overlook Grove
  { pos: [22, 20], height: 6.6, crownRadius: 3.3, primaryColor: '#fb7185', secondaryColor: '#f59e0b', emissiveColor: '#e11d48' },
  { pos: [14, 24], height: 5.9, crownRadius: 2.8, primaryColor: '#f59e0b', secondaryColor: '#fda4af', emissiveColor: '#d97706' },
  { pos: [26, 12], height: 6.2, crownRadius: 3.0, primaryColor: '#10b981', secondaryColor: '#fbbf24', emissiveColor: '#059669' },
  // Lagoon Perimeter Willows
  { pos: [-27, -4.5], height: 6.0, crownRadius: 3.0, primaryColor: '#10b981', secondaryColor: '#34d399', emissiveColor: '#059669' },
  { pos: [27, 4.5], height: 6.0, crownRadius: 3.0, primaryColor: '#f59e0b', secondaryColor: '#fbbf24', emissiveColor: '#d97706' },
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

export const ParkSanctuary: React.FC<ParkSanctuaryProps> = ({ position = [75, 0, 75] }) => {
  const origin = useMemo(() => new THREE.Vector3(...position), [position[0], position[1], position[2]]);
  const waterMatRef = useRef<THREE.ShaderMaterial>(null);
  const foliageRef = useRef<THREE.Group>(null);
  const lotusRef = useRef<THREE.Group>(null);
  const lilyGroupRef = useRef<THREE.Group>(null);
  const windSystem = WindSystem.getInstance();
  const [quality, setQuality] = useState<QualitySettings>(() => QualityManager.current);

  useEffect(() => {
    return QualityManager.subscribe(setQuality);
  }, []);

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

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const wState = WeatherSystem.getInstance().getState();
    const windVec = windSystem.getVector();
    const gust = windSystem.getGustFactor();

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

    if (foliageRef.current) {
      const swayX = Math.sin(t * 1.45) * 0.045 * gust + windVec.x * 0.003;
      const swayZ = Math.cos(t * 1.2) * 0.045 * gust + windVec.z * 0.003;
      foliageRef.current.children.forEach((c, idx) => {
        c.rotation.x = swayX * (0.85 + (idx % 3) * 0.2);
        c.rotation.z = swayZ * (0.85 + ((idx + 1) % 3) * 0.2);
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
      <mesh position={[0, 0.245, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow={quality.shadows}>
        <ringGeometry args={[19.5, 31.5, 48]} />
        <meshStandardMaterial color="#064e3b" roughness={0.72} metalness={0.12} />
      </mesh>

      {/* East-West & North-South Basalt Promenade Walkways with Brass Inlays */}
      <mesh position={[0, 0.255, 0]} receiveShadow={quality.shadows}>
        <boxGeometry args={[68.5, 0.03, 5.4]} />
        <meshStandardMaterial color="#0f172a" roughness={0.36} metalness={0.68} />
      </mesh>
      <mesh position={[0, 0.255, 0]} receiveShadow={quality.shadows}>
        <boxGeometry args={[5.4, 0.03, 68.5]} />
        <meshStandardMaterial color="#0f172a" roughness={0.36} metalness={0.68} />
      </mesh>
      {/* Circular Perimeter Ring Promenade */}
      <mesh position={[0, 0.258, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow={quality.shadows}>
        <ringGeometry args={[23.5, 26.2, 48]} />
        <meshStandardMaterial color="#111827" roughness={0.38} metalness={0.65} />
      </mesh>
      <mesh position={[0, 0.262, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[23.35, 23.5, 48]} />
        <meshBasicMaterial color="#10b981" />
      </mesh>
      <mesh position={[0, 0.262, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[26.2, 26.35, 48]} />
        <meshBasicMaterial color="#38bdf8" />
      </mesh>

      {/* Perimeter Architectural Sanctuary Walls */}
      {walls.map((w, idx) => (
        <group key={idx} position={w.position}>
          <mesh castShadow={quality.shadows} receiveShadow={quality.shadows}>
            <boxGeometry args={w.size} />
            <meshStandardMaterial color="#0b1120" roughness={0.28} metalness={0.86} />
          </mesh>
          <mesh position={[0, 0.62, 0]}>
            <boxGeometry args={[w.size[0], 0.04, w.size[2]]} />
            <meshBasicMaterial color={idx % 2 === 0 ? '#10b981' : '#38bdf8'} />
          </mesh>
        </group>
      ))}

      {/* 4 Cardinal Illuminated Sanctuary Portal Gates (Torii-inspired Neo-Arches) */}
      {(
        [
          [0, -34.4, 0, '#10b981'],
          [0, 34.4, Math.PI, '#10b981'],
          [-34.4, 0, Math.PI / 2, '#38bdf8'],
          [34.4, 0, -Math.PI / 2, '#f59e0b'],
        ] as const
      ).map(([gx, gz, rot, accent], idx) => (
        <group key={`gate-${idx}`} position={[gx, 0.24, gz]} rotation={[0, rot, 0]}>
          <mesh position={[-3.6, 2.6, 0]} castShadow={quality.shadows}>
            <cylinderGeometry args={[0.22, 0.28, 5.2, 10]} />
            <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh position={[3.6, 2.6, 0]} castShadow={quality.shadows}>
            <cylinderGeometry args={[0.22, 0.28, 5.2, 10]} />
            <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh position={[0, 5.1, 0]} castShadow={quality.shadows}>
            <boxGeometry args={[9.2, 0.36, 0.55]} />
            <meshStandardMaterial color="#0b1120" metalness={0.92} roughness={0.2} />
          </mesh>
          <mesh position={[0, 4.45, 0]}>
            <boxGeometry args={[7.8, 0.16, 0.36]} />
            <meshBasicMaterial color={accent} />
          </mesh>
        </group>
      ))}

      {/* Sunken Bioluminescent Mirror Lagoon & Basalt Basin Rim */}
      <mesh position={[0, 0.26, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[16.2, 17.4, 48]} />
        <meshStandardMaterial color="#0f172a" metalness={0.85} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0.27, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[16.05, 16.22, 48]} />
        <meshBasicMaterial color="#38bdf8" />
      </mesh>

      <mesh position={[0, 0.29, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[16.1, 48]} />
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
              pos.z += (sin(pos.x * 0.42 + uTime * 2.1) * 0.08 + cos(pos.y * 0.48 - uTime * 1.6) * 0.06) * uWindStrength;
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
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[pad.r, 16]} />
              <meshStandardMaterial color="#065f46" roughness={0.65} metalness={0.15} />
            </mesh>
            <mesh position={[0, 0.08, 0]}>
              <octahedronGeometry args={[0.22, 0]} />
              <meshBasicMaterial color={pad.flowerColor} />
            </mesh>
          </group>
        ))}
      </group>

      {/* North-South Lagoon Stepping Stones */}
      {([-13, -10.5, -8, -5.5, 5.5, 8, 10.5, 13] as const).map((sz, idx) => (
        <group key={`step-${idx}`} position={[0, 0.3, sz]}>
          <mesh>
            <cylinderGeometry args={[1.15, 1.25, 0.1, 12]} />
            <meshStandardMaterial color="#1e293b" roughness={0.35} metalness={0.75} />
          </mesh>
          <mesh position={[0, 0.055, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.98, 1.08, 12]} />
            <meshBasicMaterial color={idx % 2 === 0 ? '#10b981' : '#38bdf8'} />
          </mesh>
        </group>
      ))}

      {/* Grand Botanical Conservatory Rib Arches Spanning Lagoon */}
      {([-0.55, 0, 0.55] as const).map((rotY, idx) => (
        <group key={`arch-${idx}`} position={[0, 0.25, 0]} rotation={[0, rotY, 0]}>
          <mesh rotation={[0, 0, 0]}>
            <torusGeometry args={[16.5, 0.14, 10, 48, Math.PI]} />
            <meshStandardMaterial color="#0f172a" metalness={0.92} roughness={0.18} />
          </mesh>
          <mesh rotation={[0, 0, 0]}>
            <torusGeometry args={[16.22, 0.045, 8, 48, Math.PI]} />
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
          <torusGeometry args={[2.1, 0.05, 8, 36]} />
          <meshBasicMaterial color="#38bdf8" />
        </mesh>
        <mesh rotation={[Math.PI / 4, Math.PI / 4, 0]}>
          <torusGeometry args={[2.75, 0.04, 8, 36]} />
          <meshBasicMaterial color="#f59e0b" />
        </mesh>
      </group>

      {/* Sculpted Central Promenade Bridge with Illuminated Glass Balustrades */}
      <group>
        <mesh position={[0, 0.85, 0]} castShadow={quality.shadows} receiveShadow={quality.shadows}>
          <boxGeometry args={[23, 0.35, 4.6]} />
          <meshStandardMaterial color="#1e293b" roughness={0.42} metalness={0.65} />
        </mesh>
        {/* Glass Balustrades */}
        <mesh position={[0, 1.25, -2.15]}>
          <boxGeometry args={[22.4, 0.55, 0.06]} />
          <meshStandardMaterial color="#38bdf8" transparent opacity={0.32} metalness={0.9} roughness={0.1} />
        </mesh>
        <mesh position={[0, 1.25, 2.15]}>
          <boxGeometry args={[22.4, 0.55, 0.06]} />
          <meshStandardMaterial color="#38bdf8" transparent opacity={0.32} metalness={0.9} roughness={0.1} />
        </mesh>
        {/* Brass Handrails */}
        <mesh position={[0, 1.55, -2.15]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.055, 0.055, 22.8, 8]} />
          <meshBasicMaterial color="#f59e0b" />
        </mesh>
        <mesh position={[0, 1.55, 2.15]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.055, 0.055, 22.8, 8]} />
          <meshBasicMaterial color="#f59e0b" />
        </mesh>
        {/* Approach Ramps */}
        <mesh position={[-11.5, 0.4, 0]} castShadow={quality.shadows} receiveShadow={quality.shadows}>
          <boxGeometry args={[3.2, 0.7, 4.8]} />
          <meshStandardMaterial color="#1e293b" roughness={0.48} />
        </mesh>
        <mesh position={[11.5, 0.4, 0]} castShadow={quality.shadows} receiveShadow={quality.shadows}>
          <boxGeometry args={[3.2, 0.7, 4.8]} />
          <meshStandardMaterial color="#1e293b" roughness={0.48} />
        </mesh>
      </group>

      {/* NE Quadrant: Zen Raked Gravel Rings & Sculptural Monolith Stones */}
      <group position={[19, 0.25, -19]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[5.5, 32]} />
          <meshStandardMaterial color="#1e293b" roughness={0.85} />
        </mesh>
        {[2.0, 3.4, 4.8].map((r, rIdx) => (
          <mesh key={rIdx} position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[r - 0.08, r, 32]} />
            <meshBasicMaterial color="#f59e0b" transparent opacity={0.45} />
          </mesh>
        ))}
        <mesh position={[-1.2, 0.9, 0.5]} castShadow={quality.shadows}>
          <dodecahedronGeometry args={[1.1, 0]} />
          <meshStandardMaterial color="#334155" roughness={0.75} metalness={0.2} />
        </mesh>
        <mesh position={[1.4, 0.65, -0.8]} castShadow={quality.shadows}>
          <dodecahedronGeometry args={[0.8, 0]} />
          <meshStandardMaterial color="#475569" roughness={0.75} metalness={0.2} />
        </mesh>
      </group>

      {/* SW Quadrant: Bioluminescent Bamboo Stalk Clusters */}
      {quality.vegetationEnabled && (
        <group position={[-19, 0.24, 19]}>
          {(
            [
              [-2.2, -1.8, 6.2],
              [-1.5, -2.4, 5.4],
              [-2.8, -0.9, 5.8],
              [1.8, 2.1, 6.5],
              [2.5, 1.4, 5.6],
              [1.2, 2.7, 5.9],
              [-0.5, 1.6, 5.2],
              [0.8, -1.5, 6.0],
            ] as const
          ).map(([bx, bz, bh], bIdx) => (
            <group key={`bamboo-${bIdx}`} position={[bx, 0, bz]}>
              <mesh position={[0, bh / 2, 0]} castShadow={quality.shadows}>
                <cylinderGeometry args={[0.11, 0.14, bh, 8]} />
                <meshStandardMaterial
                  color="#10b981"
                  emissive="#059669"
                  emissiveIntensity={0.28}
                  roughness={0.35}
                />
              </mesh>
              <mesh position={[0, bh * 0.5, 0]}>
                <cylinderGeometry args={[0.14, 0.14, 0.08, 8]} />
                <meshBasicMaterial color="#34d399" />
              </mesh>
            </group>
          ))}
        </group>
      )}

      {/* SE Quadrant: Meditation Sundial Terrace */}
      <group position={[19, 0.26, 19]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[5.2, 32]} />
          <meshStandardMaterial color="#0f172a" metalness={0.78} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[4.85, 5.1, 32]} />
          <meshBasicMaterial color="#38bdf8" />
        </mesh>
        <mesh position={[0, 1.1, 0]} rotation={[0.4, 0.5, 0]}>
          <torusGeometry args={[1.1, 0.06, 8, 24]} />
          <meshBasicMaterial color="#f59e0b" />
        </mesh>
      </group>

      {/* Sanctuary Lantern Bollards & Curved Viewing Benches */}
      {quality.streetFurnitureEnabled && (
        <>
          {(
            [
              [-16, -6],
              [16, -6],
              [-16, 6],
              [16, 6],
              [-6, -18],
              [6, -18],
              [-6, 18],
              [6, 18],
              [-24, -4],
              [24, -4],
              [-24, 4],
              [24, 4],
            ] as const
          ).map(([lx, lz], idx) => (
            <group key={`lantern-${idx}`} position={[lx, 0.24, lz]}>
              <mesh position={[0, 0.65, 0]}>
                <cylinderGeometry args={[0.12, 0.16, 1.3, 8]} />
                <meshStandardMaterial color="#0f172a" metalness={0.88} roughness={0.2} />
              </mesh>
              <mesh position={[0, 1.38, 0]}>
                <sphereGeometry args={[0.2, 8, 8]} />
                <meshBasicMaterial color={idx % 3 === 0 ? '#10b981' : idx % 3 === 1 ? '#f59e0b' : '#38bdf8'} />
              </mesh>
            </group>
          ))}

          {(
            [
              [-18, -10, Math.PI / 4],
              [18, -10, -Math.PI / 4],
              [-18, 10, (3 * Math.PI) / 4],
              [18, 10, -(3 * Math.PI) / 4],
            ] as const
          ).map(([bx, bz, rot], idx) => (
            <group key={`park-bench-${idx}`} position={[bx, 0.25, bz]} rotation={[0, rot, 0]}>
              <mesh position={[0, 0.32, 0]} castShadow={quality.shadows}>
                <boxGeometry args={[2.6, 0.14, 0.7]} />
                <meshStandardMaterial color="#1e293b" metalness={0.75} roughness={0.32} />
              </mesh>
              <mesh position={[0, 0.62, -0.28]}>
                <boxGeometry args={[2.6, 0.45, 0.1]} />
                <meshStandardMaterial color="#0f172a" metalness={0.85} roughness={0.25} />
              </mesh>
              <mesh position={[0, 0.12, 0]}>
                <boxGeometry args={[2.2, 0.04, 0.45]} />
                <meshBasicMaterial color={idx % 2 === 0 ? '#10b981' : '#f59e0b'} />
              </mesh>
            </group>
          ))}
        </>
      )}

      {/* Multi-Layered Botanical Grove Trees (16 Sculpted Multi-Crown Trees) */}
      {quality.vegetationEnabled && (
        <group ref={foliageRef}>
          {PARK_TREES.map((tree, idx) => (
            <group key={idx} position={[tree.pos[0], 0.2, tree.pos[1]]}>
              {/* Sculpted Trunk & Root Flare */}
              <mesh position={[0, tree.height * 0.45, 0]} castShadow={quality.shadows}>
                <cylinderGeometry args={[0.22, 0.44, tree.height * 0.9, 8]} />
                <meshStandardMaterial color="#271e16" roughness={0.82} />
              </mesh>
              {/* Primary Canopy Crown */}
              <mesh position={[0, tree.height, 0]} castShadow={quality.shadows}>
                <dodecahedronGeometry args={[tree.crownRadius, 1]} />
                <meshStandardMaterial
                  color={tree.primaryColor}
                  emissive={tree.emissiveColor}
                  emissiveIntensity={0.26}
                  roughness={0.48}
                />
              </mesh>
              {/* Secondary Upper Blossom/Foliage Crown */}
              <mesh
                position={[tree.crownRadius * 0.35, tree.height + tree.crownRadius * 0.42, tree.crownRadius * 0.25]}
                castShadow={quality.shadows}
              >
                <dodecahedronGeometry args={[tree.crownRadius * 0.72, 1]} />
                <meshStandardMaterial
                  color={tree.secondaryColor}
                  emissive={tree.emissiveColor}
                  emissiveIntensity={0.32}
                  roughness={0.45}
                />
              </mesh>
              {/* Lower Weeping Bough Cluster */}
              <mesh
                position={[-tree.crownRadius * 0.42, tree.height - tree.crownRadius * 0.25, -tree.crownRadius * 0.3]}
                castShadow={quality.shadows}
              >
                <dodecahedronGeometry args={[tree.crownRadius * 0.65, 1]} />
                <meshStandardMaterial
                  color={tree.secondaryColor}
                  emissive={tree.emissiveColor}
                  emissiveIntensity={0.22}
                  roughness={0.5}
                />
              </mesh>
            </group>
          ))}
        </group>
      )}
    </group>
  );
};
