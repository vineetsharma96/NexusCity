import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

interface FluidBillboardProps {
  position: [number, number, number];
  rotationY?: number;
  width?: number;
  height?: number;
  title?: string;
  theme?: 'CYAN_MAGENTA' | 'GOLD_EMERALD' | 'PLASMA_VIOLET';
}

export const FluidBillboard: React.FC<FluidBillboardProps> = ({
  position,
  rotationY = 0,
  width = 18,
  height = 12,
  title = 'NEXUS DYNAMICS // QUANTUM FLUIDS',
  theme = 'CYAN_MAGENTA',
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  // Custom multi-frequency fluid wave shader uniforms
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor1: {
        value:
          theme === 'GOLD_EMERALD'
            ? new THREE.Color('#ffaa00')
            : theme === 'PLASMA_VIOLET'
            ? new THREE.Color('#a855f7')
            : new THREE.Color('#00f0ff'),
      },
      uColor2: {
        value:
          theme === 'GOLD_EMERALD'
            ? new THREE.Color('#00ffaa')
            : theme === 'PLASMA_VIOLET'
            ? new THREE.Color('#ec4899')
            : new THREE.Color('#ff0077'),
      },
      uColor3: {
        value:
          theme === 'GOLD_EMERALD'
            ? new THREE.Color('#064e3b')
            : theme === 'PLASMA_VIOLET'
            ? new THREE.Color('#1e1b4b')
            : new THREE.Color('#0b1938'),
      },
    }),
    [theme]
  );

  const vertexShader = `
    varying vec2 vUv;
    varying vec3 vNormal;
    void main() {
      vUv = uv;
      vNormal = normalMatrix * normal;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = `
    uniform float uTime;
    uniform vec3 uColor1;
    uniform vec3 uColor2;
    uniform vec3 uColor3;
    varying vec2 vUv;

    // Simplex-inspired 2D noise for fluid eddies
    vec2 hash2(vec2 p) {
      return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453);
    }

    float voronoiFluid(vec2 p) {
      vec2 n = floor(p);
      vec2 f = fract(p);
      float md = 8.0;
      for (int j = -1; j <= 1; j++) {
        for (int i = -1; i <= 1; i++) {
          vec2 g = vec2(float(i), float(j));
          vec2 o = hash2(n + g);
          // Animate fluid vortex motion
          o = 0.5 + 0.45 * sin(uTime * 1.4 + 6.2831 * o);
          vec2 r = g + o - f;
          float d = dot(r, r);
          md = min(md, d);
        }
      }
      return sqrt(md);
    }

    void main() {
      vec2 uv = vUv;

      // Multi-layer domain warping to simulate Navier-Stokes viscous flow
      vec2 q = vec2(
        sin(uv.x * 4.0 + uTime * 0.7) * 0.35,
        cos(uv.y * 4.0 + uTime * 0.6) * 0.35
      );
      vec2 r = vec2(
        sin(uv.x * 6.0 + q.x * 4.0 + uTime * 0.9) * 0.4,
        cos(uv.y * 6.0 + q.y * 4.0 + uTime * 0.8) * 0.4
      );

      // Fluid density pattern
      float fluid = voronoiFluid(uv * 4.5 + r * 2.2);
      float wave = sin(uv.x * 12.0 + r.x * 6.0 + uTime * 2.0) * 0.5 + 0.5;

      // Color mixing
      vec3 col = mix(uColor3, uColor2, fluid);
      col = mix(col, uColor1, wave * 0.65);

      // Cyberpunk scanline effect
      float scanline = sin(uv.y * 220.0 + uTime * 4.0) * 0.08;
      col += scanline;

      // Screen edge vignette & bezel border glow
      vec2 border = smoothstep(0.0, 0.04, uv) * smoothstep(1.0, 0.96, uv);
      float bezel = border.x * border.y;
      col *= bezel;

      // Emissive boost
      col *= 1.45;

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  useFrame((_, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value += delta * 0.85;
    }
  });

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* 1. Heavy Metal Bezel Enclosure */}
      <mesh position={[0, 0, -0.2]} castShadow receiveShadow>
        <boxGeometry args={[width + 0.8, height + 0.8, 0.4]} />
        <meshStandardMaterial color="#080c16" roughness={0.4} metalness={0.8} />
      </mesh>

      {/* 2. Top Banner Header Rail */}
      <mesh position={[0, height / 2 + 0.6, 0]}>
        <boxGeometry args={[width, 0.5, 0.3]} />
        <meshStandardMaterial color="#0e1726" metalness={0.7} />
      </mesh>

      {/* 3. Fluid Motion Screen */}
      <mesh ref={meshRef} position={[0, 0, 0.05]}>
        <planeGeometry args={[width, height]} />
        <shaderMaterial
          ref={materialRef}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={uniforms}
        />
      </mesh>

      {/* 4. Subtle Point Light illuminating the street below */}
      <pointLight
        position={[0, 0, 1.5]}
        color={theme === 'GOLD_EMERALD' ? '#ffaa00' : theme === 'PLASMA_VIOLET' ? '#a855f7' : '#00f0ff'}
        intensity={2.8}
        distance={24}
        decay={2}
      />
    </group>
  );
};
