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

export const ParkSanctuary: React.FC<ParkSanctuaryProps> = ({ position = [75, 0, 75] }) => {
  const origin = useMemo(() => new THREE.Vector3(...position), [position[0], position[1], position[2]]);
  const waterMatRef = useRef<THREE.ShaderMaterial>(null);
  const foliageRef = useRef<THREE.Group>(null);
  const lotusRef = useRef<THREE.Group>(null);
  const windSystem = WindSystem.getInstance();
  const [quality, setQuality] = useState<QualitySettings>(() => QualityManager.current);

  useEffect(() => {
    return QualityManager.subscribe(setQuality);
  }, []);

  const walls = useMemo(
    () => [
      { position: [0, 0.6, -35] as [number, number, number], size: [70, 1.2, 1.2] as [number, number, number] },
      { position: [0, 0.6, 35] as [number, number, number], size: [70, 1.2, 1.2] as [number, number, number] },
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
      { position: [-10.5, 0.4, 0] as [number, number, number], size: [3, 0.7, 4.4] as [number, number, number] },
      { position: [0, 0.85, 0] as [number, number, number], size: [22, 0.35, 4.2] as [number, number, number] },
      { position: [10.5, 0.4, 0] as [number, number, number], size: [3, 0.7, 4.4] as [number, number, number] },
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
      uDeepColor: { value: new THREE.Color('#042f2e') },
      uShallowColor: { value: new THREE.Color('#0f766e') },
      uHighlightColor: { value: new THREE.Color('#38bdf8') },
    }),
    []
  );

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const wState = WeatherSystem.getInstance().getState();
    const gust = windSystem.getGustFactor();

    if (waterMatRef.current) {
      waterMatRef.current.uniforms.uTime.value = t;
      waterMatRef.current.uniforms.uRainIntensity.value = wState.rainIntensity;
    }

    if (lotusRef.current) {
      lotusRef.current.rotation.y = t * 0.4;
      lotusRef.current.position.y = 3.6 + Math.sin(t * 1.8) * 0.14;
    }

    if (foliageRef.current) {
      const sway = Math.sin(t * 1.4) * 0.04 * gust;
      foliageRef.current.children.forEach((c, idx) => {
        c.rotation.x = sway * (1 + (idx % 2) * 0.25);
        c.rotation.z = Math.cos(t * 1.1 + idx) * 0.035 * gust;
      });
    }
  });

  return (
    <group position={position} name="CentralParkSanctuary">
      <mesh position={[0, 0.12, 0]} receiveShadow={quality.shadows}>
        <boxGeometry args={[70, 0.24, 70]} />
        <meshStandardMaterial color="#052e16" roughness={0.78} metalness={0.08} />
      </mesh>

      {/* Basalt Promenade Walkways */}
      <mesh position={[0, 0.25, 0]} receiveShadow={quality.shadows}>
        <boxGeometry args={[68, 0.04, 5.2]} />
        <meshStandardMaterial color="#0f172a" roughness={0.4} metalness={0.65} />
      </mesh>
      <mesh position={[0, 0.25, 0]} receiveShadow={quality.shadows}>
        <boxGeometry args={[5.2, 0.04, 68]} />
        <meshStandardMaterial color="#0f172a" roughness={0.4} metalness={0.65} />
      </mesh>

      {walls.map((w, idx) => (
        <group key={idx} position={w.position}>
          <mesh castShadow={quality.shadows} receiveShadow={quality.shadows}>
            <boxGeometry args={w.size} />
            <meshStandardMaterial color="#111827" roughness={0.3} metalness={0.85} />
          </mesh>
          <mesh position={[0, 0.62, 0]}>
            <boxGeometry args={[w.size[0], 0.04, w.size[2]]} />
            <meshBasicMaterial color="#10b981" />
          </mesh>
        </group>
      ))}

      <mesh position={[0, 0.28, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[32, 26, 32, 32]} />
        <shaderMaterial
          ref={waterMatRef}
          uniforms={waterUniforms}
          vertexShader={`
            varying vec2 vUv;
            uniform float uTime;
            void main() {
              vUv = uv;
              vec3 pos = position;
              pos.z += sin(pos.x * 0.35 + uTime * 1.8) * 0.09 + cos(pos.y * 0.45 - uTime * 1.3) * 0.07;
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
              vec2 p = vUv * 16.0;
              float r = sin(p.x + uTime * 2.1) * cos(p.y - uTime * 1.7);
              float caustic = pow(max(0.0, r), 3.0) + uRainIntensity * 0.2;
              float dist = length(vUv - 0.5) * 2.0;
              vec3 col = mix(uDeepColor, uShallowColor, clamp(dist, 0.0, 1.0)) + uHighlightColor * caustic * 0.4;
              gl_FragColor = vec4(col, 0.88);
            }
          `}
          transparent
          depthWrite={false}
        />
      </mesh>

      {/* Suspended Kinetic Hydro-Sculpture above Footbridge */}
      <group ref={lotusRef} position={[0, 3.6, 0]}>
        <mesh>
          <octahedronGeometry args={[0.85, 0]} />
          <meshBasicMaterial color="#10b981" wireframe />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.6, 0.04, 8, 32]} />
          <meshBasicMaterial color="#38bdf8" />
        </mesh>
      </group>

      {/* Footbridge */}
      <group>
        <mesh position={[0, 0.85, 0]} castShadow={quality.shadows} receiveShadow={quality.shadows}>
          <boxGeometry args={[22, 0.35, 4.2]} />
          <meshStandardMaterial color="#1e293b" roughness={0.45} metalness={0.6} />
        </mesh>
        <mesh position={[0, 1.45, -2.0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.05, 0.05, 22, 8]} />
          <meshBasicMaterial color="#f59e0b" />
        </mesh>
        <mesh position={[0, 1.45, 2.0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.05, 0.05, 22, 8]} />
          <meshBasicMaterial color="#f59e0b" />
        </mesh>
        <mesh position={[-10.5, 0.4, 0]} castShadow={quality.shadows} receiveShadow={quality.shadows}>
          <boxGeometry args={[3, 0.7, 4.4]} />
          <meshStandardMaterial color="#1e293b" roughness={0.5} />
        </mesh>
        <mesh position={[10.5, 0.4, 0]} castShadow={quality.shadows} receiveShadow={quality.shadows}>
          <boxGeometry args={[3, 0.7, 4.4]} />
          <meshStandardMaterial color="#1e293b" roughness={0.5} />
        </mesh>
      </group>

      {/* Sanctuary Lantern Bollards */}
      {quality.streetFurnitureEnabled &&
        (
          [
            [-16, -6],
            [16, -6],
            [-16, 6],
            [16, 6],
            [-6, -18],
            [6, -18],
            [-6, 18],
            [6, 18],
          ] as const
        ).map(([lx, lz], idx) => (
          <group key={`lantern-${idx}`} position={[lx, 0.24, lz]}>
            <mesh position={[0, 0.65, 0]}>
              <cylinderGeometry args={[0.12, 0.16, 1.3, 8]} />
              <meshStandardMaterial color="#0f172a" metalness={0.88} roughness={0.2} />
            </mesh>
            <mesh position={[0, 1.38, 0]}>
              <sphereGeometry args={[0.2, 8, 8]} />
              <meshBasicMaterial color={idx % 2 === 0 ? '#10b981' : '#f59e0b'} />
            </mesh>
          </group>
        ))}

      {/* Botanical Trees */}
      {quality.vegetationEnabled && (
        <group ref={foliageRef}>
          {(
            [
              [-22, -18],
              [22, -18],
              [-22, 18],
              [22, 18],
              [-26, 0],
              [26, 0],
              [0, -24],
              [0, 24],
            ] as const
          ).map(([tx, tz], idx) => (
            <group key={idx} position={[tx, 0.2, tz]}>
              <mesh position={[0, 3.0, 0]} castShadow={quality.shadows}>
                <cylinderGeometry args={[0.24, 0.42, 6.0, 8]} />
                <meshStandardMaterial color="#271e16" roughness={0.8} />
              </mesh>
              <mesh position={[0, 6.5, 0]} castShadow={quality.shadows}>
                <dodecahedronGeometry args={[3.2, 1]} />
                <meshStandardMaterial
                  color={idx % 3 === 0 ? '#fb7185' : idx % 3 === 1 ? '#10b981' : '#f59e0b'}
                  emissive={idx % 3 === 0 ? '#e11d48' : idx % 3 === 1 ? '#059669' : '#d97706'}
                  emissiveIntensity={0.24}
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
