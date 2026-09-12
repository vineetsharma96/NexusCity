import React, { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { KinematicCollisionSolver } from '../player/KinematicCollision';

interface ParkSanctuaryProps {
  position?: [number, number, number];
}

export const ParkSanctuary: React.FC<ParkSanctuaryProps> = ({ position = [75, 0, 75] }) => {
  const parkOrigin = useMemo(() => new THREE.Vector3(...position), [position]);
  const waterMeshRef = useRef<THREE.Mesh>(null);
  const waterMatRef = useRef<THREE.ShaderMaterial>(null);

  // Register physical collisions for park amenities and bridge
  useEffect(() => {
    // 1. Arching Bridge Collider across pond (center at relative [0, 1.2, 0])
    // Steps on West side
    KinematicCollisionSolver.addBox(
      parkOrigin.clone().add(new THREE.Vector3(-10, 0.4, 0)),
      new THREE.Vector3(4, 0.8, 5)
    );
    // Bridge center span
    KinematicCollisionSolver.addBox(
      parkOrigin.clone().add(new THREE.Vector3(0, 1.1, 0)),
      new THREE.Vector3(16, 0.5, 4.5)
    );
    // Steps on East side
    KinematicCollisionSolver.addBox(
      parkOrigin.clone().add(new THREE.Vector3(10, 0.4, 0)),
      new THREE.Vector3(4, 0.8, 5)
    );

    // 2. Park Perimeter Stone Retaining Wall Colliders (Four corners)
    const wallH = 1.2;
    KinematicCollisionSolver.addBox(
      parkOrigin.clone().add(new THREE.Vector3(0, wallH / 2, -35)),
      new THREE.Vector3(70, wallH, 1.5)
    );
    KinematicCollisionSolver.addBox(
      parkOrigin.clone().add(new THREE.Vector3(0, wallH / 2, 35)),
      new THREE.Vector3(70, wallH, 1.5)
    );
    KinematicCollisionSolver.addBox(
      parkOrigin.clone().add(new THREE.Vector3(-35, wallH / 2, 0)),
      new THREE.Vector3(1.5, wallH, 70)
    );
    KinematicCollisionSolver.addBox(
      parkOrigin.clone().add(new THREE.Vector3(35, wallH / 2, 0)),
      new THREE.Vector3(1.5, wallH, 70)
    );
  }, [parkOrigin]);

  // Water Shader Uniforms
  const waterUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uDeepColor: { value: new THREE.Color('#022c22') },
      uShallowColor: { value: new THREE.Color('#065f46') },
      uHighlightColor: { value: new THREE.Color('#00f0ff') },
    }),
    []
  );

  const waterVertexShader = `
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    uniform float uTime;

    void main() {
      vUv = uv;
      vec3 pos = position;
      // Gentle surface wave displacement
      float wave1 = sin(pos.x * 0.4 + uTime * 1.8) * 0.12;
      float wave2 = cos(pos.y * 0.5 + uTime * 1.4) * 0.08;
      pos.z += wave1 + wave2;

      vec4 worldPos = modelMatrix * vec4(pos, 1.0);
      vWorldPosition = worldPos.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `;

  const waterFragmentShader = `
    uniform float uTime;
    uniform vec3 uDeepColor;
    uniform vec3 uShallowColor;
    uniform vec3 uHighlightColor;
    varying vec2 vUv;
    varying vec3 vWorldPosition;

    void main() {
      // Procedural rippling caustics & specular glint
      vec2 p = vUv * 16.0;
      float ripple1 = sin(p.x * 2.0 + uTime * 2.2 + cos(p.y * 1.5));
      float ripple2 = cos(p.y * 2.5 - uTime * 1.8 + sin(p.x * 1.8));
      float caustic = pow(max(0.0, (ripple1 + ripple2) * 0.5), 3.0);

      // Distance from center of pond for shoreline gradient
      float dist = length(vUv - 0.5) * 2.0;
      vec3 waterColor = mix(uDeepColor, uShallowColor, clamp(dist, 0.0, 1.0));
      waterColor += uHighlightColor * caustic * 0.45;

      // Subtle cyan neon rim reflection
      float edgeRim = smoothstep(0.75, 1.0, dist);
      waterColor = mix(waterColor, uHighlightColor, edgeRim * 0.4);

      gl_FragColor = vec4(waterColor, 0.88);
    }
  `;

  useFrame(({ clock }) => {
    if (waterMatRef.current) {
      waterMatRef.current.uniforms.uTime.value = clock.getElapsedTime();
    }
  });

  return (
    <group position={position}>
      {/* 1. Park Lawn Ground Base (68m x 68m) */}
      <mesh position={[0, 0.12, 0]} receiveShadow>
        <boxGeometry args={[70, 0.24, 70]} />
        <meshStandardMaterial color="#062e1a" roughness={0.7} metalness={0.1} />
      </mesh>

      {/* Perimeter Granite Retaining Wall with Neon Accent Trim */}
      <mesh position={[0, 0.6, -35]} castShadow receiveShadow>
        <boxGeometry args={[70, 1.2, 1.2]} />
        <meshStandardMaterial color="#1e293b" roughness={0.3} metalness={0.8} />
      </mesh>
      <mesh position={[0, 1.22, -35]}>
        <boxGeometry args={[70, 0.05, 0.2]} />
        <meshBasicMaterial color="#00ffaa" />
      </mesh>

      <mesh position={[0, 0.6, 35]} castShadow receiveShadow>
        <boxGeometry args={[70, 1.2, 1.2]} />
        <meshStandardMaterial color="#1e293b" roughness={0.3} metalness={0.8} />
      </mesh>
      <mesh position={[0, 1.22, 35]}>
        <boxGeometry args={[70, 0.05, 0.2]} />
        <meshBasicMaterial color="#00ffaa" />
      </mesh>

      <mesh position={[-35, 0.6, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.2, 1.2, 70]} />
        <meshStandardMaterial color="#1e293b" roughness={0.3} metalness={0.8} />
      </mesh>
      <mesh position={[-35, 1.22, 0]}>
        <boxGeometry args={[0.2, 0.05, 70]} />
        <meshBasicMaterial color="#00ffaa" />
      </mesh>

      <mesh position={[35, 0.6, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.2, 1.2, 70]} />
        <meshStandardMaterial color="#1e293b" roughness={0.3} metalness={0.8} />
      </mesh>
      <mesh position={[35, 1.22, 0]}>
        <boxGeometry args={[0.2, 0.05, 70]} />
        <meshBasicMaterial color="#00ffaa" />
      </mesh>

      {/* 2. Recessed Water Pond Basin & Bed */}
      <mesh position={[0, -0.4, 0]} receiveShadow>
        <cylinderGeometry args={[18, 16, 0.8, 32]} />
        <meshStandardMaterial color="#0b1e16" roughness={0.9} />
      </mesh>

      {/* Water Surface Plane with Animated Rippling Caustics Shader */}
      <mesh
        ref={waterMeshRef}
        position={[0, 0.08, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[32, 26, 48, 48]} />
        <shaderMaterial
          ref={waterMatRef}
          vertexShader={waterVertexShader}
          fragmentShader={waterFragmentShader}
          uniforms={waterUniforms}
          transparent
          depthWrite={false}
        />
      </mesh>

      {/* Shoreline Stone Cobbles Ring */}
      {Array.from({ length: 28 }).map((_, i) => {
        const angle = (i / 28) * Math.PI * 2;
        const r = 15.5 + Math.sin(i * 3) * 0.8;
        const px = Math.cos(angle) * r;
        const pz = Math.sin(angle) * (r * 0.82);
        return (
          <mesh
            key={`rock-${i}`}
            position={[px, 0.25, pz]}
            rotation={[0, Math.random() * Math.PI, 0]}
            castShadow
          >
            <dodecahedronGeometry args={[0.65 + Math.random() * 0.4, 0]} />
            <meshStandardMaterial color="#334155" roughness={0.8} />
          </mesh>
        );
      })}

      {/* 3. Arching Pedestrian Footbridge Over Water Pond */}
      <group position={[0, 0, 0]}>
        {/* Curved Bridge Deck Base */}
        <mesh position={[0, 0.85, 0]} castShadow receiveShadow>
          <boxGeometry args={[22, 0.35, 4.2]} />
          <meshStandardMaterial color="#382516" roughness={0.6} metalness={0.2} />
        </mesh>
        {/* Arching Arch Trusses */}
        <mesh position={[0, 0.4, -1.9]}>
          <boxGeometry args={[20, 0.4, 0.3]} />
          <meshStandardMaterial color="#1e293b" metalness={0.8} />
        </mesh>
        <mesh position={[0, 0.4, 1.9]}>
          <boxGeometry args={[20, 0.4, 0.3]} />
          <meshStandardMaterial color="#1e293b" metalness={0.8} />
        </mesh>
        {/* Bridge Glowing Handrails */}
        <mesh position={[0, 1.5, -2.0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.06, 0.06, 22, 8]} />
          <meshBasicMaterial color="#00f0ff" />
        </mesh>
        <mesh position={[0, 1.5, 2.0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.06, 0.06, 22, 8]} />
          <meshBasicMaterial color="#00f0ff" />
        </mesh>
        {/* Bridge Approach Steps (West & East) */}
        <mesh position={[-10.5, 0.4, 0]} castShadow receiveShadow>
          <boxGeometry args={[3, 0.7, 4.4]} />
          <meshStandardMaterial color="#382516" roughness={0.6} />
        </mesh>
        <mesh position={[10.5, 0.4, 0]} castShadow receiveShadow>
          <boxGeometry args={[3, 0.7, 4.4]} />
          <meshStandardMaterial color="#382516" roughness={0.6} />
        </mesh>
      </group>

      {/* 4. Bioluminescent Floating Water Flora (Water Lilies & Lotus Blossoms) */}
      {[
        [-5, -4],
        [6, -5],
        [-8, 4],
        [7, 5],
        [-2, 6],
        [3, -7],
      ].map(([lx, lz], lIdx) => (
        <group key={`lotus-${lIdx}`} position={[lx, 0.14, lz]}>
          {/* Lily Pad Leaf */}
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.85, 12]} />
            <meshStandardMaterial color="#059669" roughness={0.4} />
          </mesh>
          {/* Glowing Pink/Cyan Lotus Blossom */}
          <mesh position={[0, 0.2, 0]}>
            <coneGeometry args={[0.32, 0.45, 6]} />
            <meshStandardMaterial
              color={lIdx % 2 === 0 ? '#f43f5e' : '#38bdf8'}
              emissive={lIdx % 2 === 0 ? '#f43f5e' : '#38bdf8'}
              emissiveIntensity={1.8}
            />
          </mesh>
          {/* Bioluminescent Point Light */}
          <pointLight
            color={lIdx % 2 === 0 ? '#f43f5e' : '#38bdf8'}
            intensity={0.6}
            distance={4}
          />
        </group>
      ))}

      {/* 5. Pink Sakura Cherry Blossom Trees */}
      {[
        [-22, -18],
        [22, -18],
        [-22, 18],
        [22, 18],
      ].map(([tx, tz], tIdx) => (
        <group key={`sakura-${tIdx}`} position={[tx, 0.2, tz]}>
          {/* Dark Bark Trunk */}
          <mesh position={[0, 3.0, 0]} castShadow>
            <cylinderGeometry args={[0.25, 0.45, 6.0, 8]} />
            <meshStandardMaterial color="#2d1b14" roughness={0.8} />
          </mesh>
          {/* Glowing Sakura Pink Foliage Cloud */}
          <mesh position={[0, 6.5, 0]} castShadow>
            <dodecahedronGeometry args={[3.2, 1]} />
            <meshStandardMaterial
              color="#fb7185"
              emissive="#f43f5e"
              emissiveIntensity={0.25}
              roughness={0.5}
            />
          </mesh>
          <mesh position={[1.4, 7.2, 0.8]} castShadow>
            <dodecahedronGeometry args={[2.2, 1]} />
            <meshStandardMaterial
              color="#fda4af"
              emissive="#fb7185"
              emissiveIntensity={0.2}
              roughness={0.5}
            />
          </mesh>
        </group>
      ))}

      {/* 6. Weeping Willow Cyber-Trees with Drooping Tendrils */}
      {[
        [-14, -2],
        [14, 2],
      ].map(([wx, wz], wIdx) => (
        <group key={`willow-${wIdx}`} position={[wx, 0.2, wz]}>
          <mesh position={[0, 3.5, 0]} castShadow>
            <cylinderGeometry args={[0.3, 0.5, 7.0, 8]} />
            <meshStandardMaterial color="#1a2e22" roughness={0.8} />
          </mesh>
          {/* Main Canopy Dome */}
          <mesh position={[0, 6.8, 0]} castShadow>
            <sphereGeometry args={[3.8, 8, 8]} />
            <meshStandardMaterial color="#10b981" roughness={0.4} />
          </mesh>
          {/* Drooping Tendrils */}
          {Array.from({ length: 8 }).map((_, dIdx) => {
            const da = (dIdx / 8) * Math.PI * 2;
            return (
              <mesh
                key={`tendril-${dIdx}`}
                position={[Math.cos(da) * 3.2, 4.2, Math.sin(da) * 3.2]}
                castShadow
              >
                <cylinderGeometry args={[0.08, 0.15, 4.2, 6]} />
                <meshStandardMaterial color="#059669" roughness={0.4} />
              </mesh>
            );
          })}
        </group>
      ))}

      {/* 7. Park Benches with Glowing Cyber-Wood Slats */}
      {[
        { pos: [-12, 0.2, -10], rot: Math.PI / 4 },
        { pos: [12, 0.2, -10], rot: -Math.PI / 4 },
        { pos: [-12, 0.2, 10], rot: (3 * Math.PI) / 4 },
        { pos: [12, 0.2, 10], rot: (-3 * Math.PI) / 4 },
      ].map((bench, bIdx) => (
        <group key={`bench-${bIdx}`} position={bench.pos as [number, number, number]} rotation={[0, bench.rot, 0]}>
          {/* Metal Legs */}
          <mesh position={[-0.9, 0.3, 0]} castShadow>
            <boxGeometry args={[0.1, 0.6, 0.7]} />
            <meshStandardMaterial color="#0f172a" metalness={0.9} />
          </mesh>
          <mesh position={[0.9, 0.3, 0]} castShadow>
            <boxGeometry args={[0.1, 0.6, 0.7]} />
            <meshStandardMaterial color="#0f172a" metalness={0.9} />
          </mesh>
          {/* Seat Slats */}
          <mesh position={[0, 0.55, 0.05]} castShadow>
            <boxGeometry args={[2.0, 0.08, 0.6]} />
            <meshStandardMaterial color="#78350f" roughness={0.5} />
          </mesh>
          {/* Backrest */}
          <mesh position={[0, 0.95, -0.22]} rotation={[-0.2, 0, 0]} castShadow>
            <boxGeometry args={[2.0, 0.5, 0.08]} />
            <meshStandardMaterial color="#78350f" roughness={0.5} />
          </mesh>
          {/* Glowing Neon Strip Under Seat */}
          <mesh position={[0, 0.48, 0]}>
            <boxGeometry args={[1.9, 0.04, 0.04]} />
            <meshBasicMaterial color="#00ffaa" />
          </mesh>
        </group>
      ))}

      {/* 8. Stepping Stone Footpaths */}
      {Array.from({ length: 18 }).map((_, sIdx) => {
        const t = (sIdx / 18) * Math.PI * 2;
        const px = Math.cos(t) * 20;
        const pz = Math.sin(t) * 20;
        return (
          <mesh key={`path-${sIdx}`} position={[px, 0.24, pz]} rotation={[0, t, 0]}>
            <boxGeometry args={[1.6, 0.06, 1.2]} />
            <meshStandardMaterial color="#64748b" roughness={0.8} />
          </mesh>
        );
      })}
    </group>
  );
};
