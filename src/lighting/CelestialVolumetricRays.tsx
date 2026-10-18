import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { TimeLightingState } from '../world/TimeSystem';
import { WeatherState } from '../world/WeatherSystem';

interface CelestialVolumetricRaysProps {
  timeState: TimeLightingState;
  weatherState: WeatherState;
  playerPosRef?: React.MutableRefObject<THREE.Vector3>;
}

export const CelestialVolumetricRays: React.FC<CelestialVolumetricRaysProps> = ({
  timeState,
  weatherState,
  playerPosRef,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const rayGroupRef = useRef<THREE.Group>(null);
  const discMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const haloMatRef = useRef<THREE.ShaderMaterial>(null);

  const smoothDirRef = useRef(new THREE.Vector3(0.4, 0.7, 0.2).normalize());
  const smoothColorRef = useRef(new THREE.Color('#fef3c7'));
  const smoothShaftColorRef = useRef(new THREE.Color('#f59e0b'));

  const rayShafts = useMemo(
    () => [
      { rotZ: 0.15, scaleX: 54, len: 380, speed: 0.2 },
      { rotZ: -0.35, scaleX: 70, len: 420, speed: -0.15 },
      { rotZ: 0.65, scaleX: 46, len: 340, speed: 0.18 },
      { rotZ: -0.85, scaleX: 62, len: 400, speed: -0.22 },
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
    const dt = Math.min(delta, 0.05);
    const lerpAlpha = 1 - Math.exp(-6.5 * dt);

    const isNight = timeState.isNight;
    const targetDir = isNight ? timeState.moonDirection : timeState.sunDirection;
    smoothDirRef.current.lerp(targetDir, lerpAlpha).normalize();

    const pPos = playerPosRef?.current;
    const px = pPos ? pPos.x : 0;
    const pz = pPos ? pPos.z : 0;

    if (groupRef.current) {
      groupRef.current.position.set(
        px + smoothDirRef.current.x * 580,
        smoothDirRef.current.y * 580,
        pz + smoothDirRef.current.z * 580
      );
      groupRef.current.visible = groupRef.current.position.y > -25;
    }

    const discTargetHex = isNight ? '#e0f2fe' : timeState.goldenHourFactor > 0.4 ? '#fde68a' : '#fffbeb';
    const shaftTargetHex = isNight ? '#38bdf8' : timeState.solarGlowColor;
    smoothColorRef.current.lerp(new THREE.Color(discTargetHex), lerpAlpha);
    smoothShaftColorRef.current.lerp(new THREE.Color(shaftTargetHex), lerpAlpha);

    if (discMatRef.current) {
      discMatRef.current.color.copy(smoothColorRef.current);
    }

    const rainDim = 1.0 - weatherState.rainIntensity * 0.68;
    const goldenBoost = 1.0 + timeState.goldenHourFactor * 0.45;

    if (haloMatRef.current) {
      haloMatRef.current.uniforms.uColor.value.copy(smoothShaftColorRef.current);
      haloMatRef.current.uniforms.uOpacity.value = (isNight ? 0.46 : 0.72 * goldenBoost) * rainDim;
    }

    if (rayGroupRef.current) {
      rayGroupRef.current.lookAt(px, 14, pz);
      const baseShaftOpacity = (isNight ? 0.048 : (0.075 + timeState.goldenHourFactor * 0.045)) * rainDim;
      rayGroupRef.current.children.forEach((child, idx) => {
        if (child.name === 'ray-shaft') {
          child.rotation.z += dt * rayShafts[idx % rayShafts.length].speed * 0.14;
          const mesh = child as THREE.Mesh;
          const mat = mesh.material as THREE.MeshBasicMaterial;
          if (mat) {
            mat.color.copy(smoothShaftColorRef.current);
            mat.opacity = baseShaftOpacity;
          }
        }
      });
    }
  });

  return (
    <group ref={groupRef} position={[220, 320, 120]}>
      <mesh>
        <sphereGeometry args={[timeState.isNight ? 20 : 28, 24, 24]} />
        <meshBasicMaterial ref={discMatRef} color="#fef3c7" fog={false} />
      </mesh>
      <mesh scale={[155, 155, 1]}>
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
              float glow = pow(max(0.0, 1.0 - d), 2.5);
              gl_FragColor = vec4(uColor, glow * uOpacity);
            }
          `}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <group ref={rayGroupRef}>
        {rayShafts.map((s, idx) => (
          <mesh
            key={idx}
            name="ray-shaft"
            position={[0, 0, s.len * 0.45]}
            rotation={[Math.PI / 2, 0, s.rotZ]}
          >
            <coneGeometry args={[s.scaleX, s.len, 12, 1, true]} />
            <meshBasicMaterial
              color="#f59e0b"
              transparent
              opacity={0.075}
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
