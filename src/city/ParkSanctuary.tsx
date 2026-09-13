import React, { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { KinematicCollisionSolver } from '../player/KinematicCollision';
import { WeatherSystem } from '../world/WeatherSystem';
import { WindSystem } from '../world/WindSystem';

interface ParkSanctuaryProps {
  position?: [number, number, number];
}

export const ParkSanctuary: React.FC<ParkSanctuaryProps> = ({ position = [75, 0, 75] }) => {
  const parkOrigin = useMemo(() => new THREE.Vector3(...position), [position]);
  const waterMeshRef = useRef<THREE.Mesh>(null);
  const waterMatRef = useRef<THREE.ShaderMaterial>(null);
  const foliageGroupRef = useRef<THREE.Group>(null);
  const firefliesRef = useRef<THREE.Points>(null);

  const windSystem = WindSystem.getInstance();

  // Register physical collisions for park amenities and bridge
  useEffect(() => {
    // 1. Arching Bridge Collider across pond (center at relative [0, 1.2, 0])
    KinematicCollisionSolver.addBox(
      parkOrigin.clone().add(new THREE.Vector3(-10, 0.4, 0)),
      new THREE.Vector3(4, 0.8, 5)
    );
    KinematicCollisionSolver.addBox(
      parkOrigin.clone().add(new THREE.Vector3(0, 1.1, 0)),
      new THREE.Vector3(16, 0.5, 4.5)
    );
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

  // Water Shader Uniforms with wind coupling
  const waterUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uWindDir: { value: new THREE.Vector2(0.8, 0.5) },
      uWindSpeed: { value: 1.0 },
      uDeepColor: { value: new THREE.Color('#022c22') },
      uShallowColor: { value: new THREE.Color('#065f46') },
      uHighlightColor: { value: new THREE.Color('#00f0ff') },
      uRainIntensity: { value: 0 },
    }),
    []
  );

  const waterVertexShader = `
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    uniform float uTime;
    uniform vec2 uWindDir;
    uniform float uWindSpeed;

    void main() {
      vUv = uv;
      vec3 pos = position;

      // Wind-aligned directional wave displacement
      float wavePhase = dot(pos.xy, uWindDir) * 0.35 + uTime * (1.8 * uWindSpeed);
      float wave1 = sin(wavePhase) * 0.12;
      float wave2 = cos(pos.y * 0.6 - uTime * 1.2) * 0.08;
      pos.z += wave1 + wave2;

      vec4 worldPos = modelMatrix * vec4(pos, 1.0);
      vWorldPosition = worldPos.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `;

  const waterFragmentShader = `
    uniform float uTime;
    uniform vec2 uWindDir;
    uniform float uWindSpeed;
    uniform vec3 uDeepColor;
    uniform vec3 uShallowColor;
    uniform vec3 uHighlightColor;
    uniform float uRainIntensity;
    varying vec2 vUv;
    varying vec3 vWorldPosition;

    void main() {
      // Procedural rippling caustics & specular glint aligned with wind
      vec2 p = vUv * 18.0;
      float windFlow = dot(p, uWindDir) * 0.5;
      float ripple1 = sin(windFlow + uTime * 2.4 * uWindSpeed + cos(p.y * 1.5));
      float ripple2 = cos(p.y * 2.5 - uTime * 1.8 + sin(p.x * 1.8));
      float caustic = pow(max(0.0, (ripple1 + ripple2) * 0.5), 3.0);

      // Raindrop surface perturbation
      vec2 rainP = vUv * 48.0;
      float rainDisturb = sin(rainP.x * 3.2 + uTime * 8.0) * cos(rainP.y * 3.2 + uTime * 9.5);
      caustic += pow(max(0.0, rainDisturb), 2.0) * uRainIntensity * 0.55;

      // Distance from center of pond for shoreline gradient
      float dist = length(vUv - 0.5) * 2.0;
      vec3 waterColor = mix(uDeepColor, uShallowColor, clamp(dist, 0.0, 1.0));
      waterColor += uHighlightColor * caustic * 0.45;

      // Cyan neon rim reflection
      float edgeRim = smoothstep(0.75, 1.0, dist);
      waterColor = mix(waterColor, uHighlightColor, edgeRim * 0.4);

      gl_FragColor = vec4(waterColor, 0.88);
    }
  `;

  // Bioluminescent fireflies particle setup
  const fireflyCount = 60;
  const fireflyData = useMemo(() => {
    const pos = new Float32Array(fireflyCount * 3);
    const col = new Float32Array(fireflyCount * 3);
    const c1 = new THREE.Color('#34d399');
    const c2 = new THREE.Color('#38bdf8');
    const c3 = new THREE.Color('#f43f5e');

    for (let i = 0; i < fireflyCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * 22;
      pos[i * 3] = Math.cos(angle) * r;
      pos[i * 3 + 1] = 0.8 + Math.random() * 3.5;
      pos[i * 3 + 2] = Math.sin(angle) * (r * 0.85);

      const chosenColor = i % 3 === 0 ? c1 : i % 3 === 1 ? c2 : c3;
      col[i * 3] = chosenColor.r;
      col[i * 3 + 1] = chosenColor.g;
      col[i * 3 + 2] = chosenColor.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return geo;
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const wState = WeatherSystem.getInstance().getState();
    const wind = windSystem.getVector();
    const gust = windSystem.getGustFactor();

    // Update water shader uniforms
    if (waterMatRef.current) {
      waterMatRef.current.uniforms.uTime.value = t;
      waterMatRef.current.uniforms.uRainIntensity.value = wState.rainIntensity;
      const dir2D = new THREE.Vector2(wind.x, wind.z).normalize();
      waterMatRef.current.uniforms.uWindDir.value.copy(dir2D);
      waterMatRef.current.uniforms.uWindSpeed.value = Math.max(0.5, windSystem.getSpeed() / 6.5) * gust;
    }

    // Dynamic wind sway on weeping willow & sakura branches
    if (foliageGroupRef.current) {
      const swayX = Math.sin(t * 1.5) * 0.04 * gust;
      const swayZ = Math.cos(t * 1.2) * 0.04 * gust;
      foliageGroupRef.current.children.forEach((child, idx) => {
        child.rotation.x = swayX * (1 + (idx % 3) * 0.2);
        child.rotation.z = swayZ * (1 + (idx % 2) * 0.3);
      });
    }

    // Animate bioluminescent fireflies bobbing
    if (firefliesRef.current) {
      const posAttr = firefliesRef.current.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < fireflyCount; i++) {
        const py = posAttr.getY(i);
        const newY = py + Math.sin(t * 2.2 + i) * 0.012;
        posAttr.setY(i, Math.max(0.4, Math.min(4.8, newY)));

        // Slight drift with wind
        const px = posAttr.getX(i) + wind.x * 0.002 * (0.8 + Math.sin(t + i));
        const pz = posAttr.getZ(i) + wind.z * 0.002 * (0.8 + Math.cos(t + i));
        posAttr.setX(i, px > 28 ? -28 : px < -28 ? 28 : px);
        posAttr.setZ(i, pz > 28 ? -28 : pz < -28 ? 28 : pz);
      }
      posAttr.needsUpdate = true;
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
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.85, 12]} />
            <meshStandardMaterial color="#059669" roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.2, 0]}>
            <coneGeometry args={[0.32, 0.45, 6]} />
            <meshStandardMaterial
              color={lIdx % 2 === 0 ? '#f43f5e' : '#38bdf8'}
              emissive={lIdx % 2 === 0 ? '#f43f5e' : '#38bdf8'}
              emissiveIntensity={1.8}
            />
          </mesh>
          <pointLight
            color={lIdx % 2 === 0 ? '#f43f5e' : '#38bdf8'}
            intensity={0.6}
            distance={4}
          />
        </group>
      ))}

      {/* 5. Swaying Park Foliage: Pink Sakura Trees & Cyber Weeping Willows */}
      <group ref={foliageGroupRef}>
        {/* Pink Sakura Cherry Blossom Trees */}
        {[
          [-22, -18],
          [22, -18],
          [-22, 18],
          [22, 18],
        ].map(([tx, tz], tIdx) => (
          <group key={`sakura-${tIdx}`} position={[tx, 0.2, tz]}>
            <mesh position={[0, 3.0, 0]} castShadow>
              <cylinderGeometry args={[0.25, 0.45, 6.0, 8]} />
              <meshStandardMaterial color="#2d1b14" roughness={0.8} />
            </mesh>
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

        {/* Weeping Willow Cyber-Trees */}
        {[
          [-14, -2],
          [14, 2],
        ].map(([wx, wz], wIdx) => (
          <group key={`willow-${wIdx}`} position={[wx, 0.2, wz]}>
            <mesh position={[0, 3.5, 0]} castShadow>
              <cylinderGeometry args={[0.3, 0.5, 7.0, 8]} />
              <meshStandardMaterial color="#1a2e22" roughness={0.8} />
            </mesh>
            <mesh position={[0, 6.8, 0]} castShadow>
              <sphereGeometry args={[3.8, 8, 8]} />
              <meshStandardMaterial color="#10b981" roughness={0.4} />
            </mesh>
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
      </group>

      {/* 6. Bioluminescent Floating Fireflies / Spores Points */}
      <points ref={firefliesRef}>
        <bufferGeometry {...fireflyData} />
        <pointsMaterial
          size={0.35}
          vertexColors
          transparent
          opacity={0.85}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      {/* 7. Park Benches with Glowing Cyber-Wood Slats */}
      {[
        { pos: [-12, 0.2, -10], rot: Math.PI / 4 },
        { pos: [12, 0.2, -10], rot: -Math.PI / 4 },
        { pos: [-12, 0.2, 10], rot: (3 * Math.PI) / 4 },
        { pos: [12, 0.2, 10], rot: (-3 * Math.PI) / 4 },
      ].map((bench, bIdx) => (
        <group key={`bench-${bIdx}`} position={bench.pos as [number, number, number]} rotation={[0, bench.rot, 0]}>
          <mesh position={[-0.9, 0.3, 0]} castShadow>
            <boxGeometry args={[0.1, 0.6, 0.7]} />
            <meshStandardMaterial color="#0f172a" metalness={0.9} />
          </mesh>
          <mesh position={[0.9, 0.3, 0]} castShadow>
            <boxGeometry args={[0.1, 0.6, 0.7]} />
            <meshStandardMaterial color="#0f172a" metalness={0.9} />
          </mesh>
          <mesh position={[0, 0.55, 0.05]} castShadow>
            <boxGeometry args={[2.0, 0.08, 0.6]} />
            <meshStandardMaterial color="#78350f" roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.95, -0.22]} rotation={[-0.2, 0, 0]} castShadow>
            <boxGeometry args={[2.0, 0.5, 0.08]} />
            <meshStandardMaterial color="#78350f" roughness={0.5} />
          </mesh>
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
