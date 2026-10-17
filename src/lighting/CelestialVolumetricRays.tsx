import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { TimeLightingState } from '../world/TimeSystem';
import { WeatherState } from '../world/WeatherSystem';

interface CelestialVolumetricRaysProps {
  timeState: TimeLightingState;
  weatherState: WeatherState;
}

export const CelestialVolumetricRays: React.FC<CelestialVolumetricRaysProps> = ({ timeState, weatherState }) => {
  const groupRef = useRef<THREE.Group>(null);
  const haloMatRef = useRef<THREE.ShaderMaterial>(null);

  const isNight = timeState.isNight;
  const activeDir = isNight ? timeState.moonDirection : timeState.sunDirection;
  const celestialPos = useMemo(() => activeDir.clone().multiplyScalar(580), [activeDir]);

  const rayShafts = useMemo(
    () => [
      { rotZ: 0.15, scaleX: 52, len: 360, speed: 0.2 },
      { rotZ: -0.35, scaleX: 68, len: 410, speed: -0.15 },
      { rotZ: 0.65, scaleX: 44, len: 330, speed: 0.18 },
      { rotZ: -0.85, scaleX: 60, len: 390, speed: -0.22 },
    ],
    []
  );

  const haloUniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color('#f59e0b') },
      uOpacity: { value: 0.65 },
    }),
    []
  );

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.lookAt(0, 15, 0);
      groupRef.current.children.forEach((child, idx) => {
        if (child.name === 'ray-shaft') {
          child.rotation.z += delta * rayShafts[idx % rayShafts.length].speed * 0.12;
        }
      });
    }

    if (haloMatRef.current) {
      haloMatRef.current.uniforms.uColor.value.set(isNight ? '#38bdf8' : timeState.sunColor);
      const rainDim = 1.0 - weatherState.rainIntensity * 0.65;
      haloMatRef.current.uniforms.uOpacity.value = (isNight ? 0.48 : 0.72) * rainDim;
    }
  });

  if (celestialPos.y < -15) return null;
  const shaftColor = isNight ? '#38bdf8' : timeState.sunColor;
  const shaftOpacity = (isNight ? 0.05 : 0.085) * (1.0 - weatherState.rainIntensity * 0.6);

  return (
    <group position={celestialPos}>
      <mesh>
        <sphereGeometry args={[isNight ? 20 : 28, 24, 24]} />
        <meshBasicMaterial color={isNight ? '#e0f2fe' : '#fef3c7'} />
      </mesh>
      <mesh scale={[140, 140, 1]}>
        <planeGeometry args={[1, 1]} />
        <shaderMaterial
          ref={haloMatRef}
          uniforms={haloUniforms}
          vertexShader={`
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            uniform vec3 uColor;
            uniform float uOpacity;
            varying vec2 vUv;
            void main() {
              float d = length(vUv - 0.5) * 2.0;
              float glow = pow(max(0.0, 1.0 - d), 2.6);
              gl_FragColor = vec4(uColor, glow * uOpacity);
            }
          `}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <group ref={groupRef}>
        {rayShafts.map((s, idx) => (
          <mesh
            key={idx}
            name="ray-shaft"
            position={[0, 0, s.len * 0.45]}
            rotation={[Math.PI / 2, 0, s.rotZ]}
          >
            <coneGeometry args={[s.scaleX, s.len, 12, 1, true]} />
            <meshBasicMaterial
              color={shaftColor}
              transparent
              opacity={shaftOpacity}
              blending={THREE.AdditiveBlending}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
};
