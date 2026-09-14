import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { TimeSystem } from '../world/TimeSystem';
import { WeatherSystem } from '../world/WeatherSystem';
import { QualitySettings } from '../rendering/QualityManager';

interface CelestialVolumetricRaysProps {
  quality: QualitySettings;
  playerPosRef?: React.MutableRefObject<THREE.Vector3>;
}

// Custom shader for atmospheric celestial light beams
const VolumetricRayShader = {
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vWorldPos;
    void main() {
      vUv = uv;
      vec4 worldP = modelMatrix * vec4(position, 1.0);
      vWorldPos = worldP.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldP;
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    varying vec3 vWorldPos;
    uniform vec3 uColor;
    uniform float uIntensity;
    uniform float uTime;

    void main() {
      // Top-to-bottom decay (brightest at apex near sun/moon, dispersing near ground)
      float yGrad = pow(vUv.y, 1.5);
      
      // Radial cosine falloff across the beam cone
      float radial = 1.0 - abs(vUv.x - 0.5) * 2.0;
      radial = smoothstep(0.0, 0.5, radial);
      
      // Atmospheric dust turbulence shimmer
      float dustShimmer = 0.82 + 0.18 * sin(uTime * 1.8 + vUv.y * 12.0 + vWorldPos.x * 0.05);
      
      float alpha = yGrad * radial * uIntensity * dustShimmer;
      gl_FragColor = vec4(uColor, clamp(alpha, 0.0, 0.85));
    }
  `,
};

export const CelestialVolumetricRays: React.FC<CelestialVolumetricRaysProps> = ({
  quality,
  playerPosRef,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  if (playerPosRef && playerPosRef.current.y < -50) {
    return null;
  }

  // Setup ray cone geometries (multiple concentric and angled beams)
  const rayGeometries = useMemo(() => {
    // 5 cascading beam cones of varied heights and base spreads
    return [
      { radiusTop: 2.0, radiusBottom: 65, height: 260, rotZ: 0.02, offset: new THREE.Vector3(0, 0, 0) },
      { radiusTop: 1.5, radiusBottom: 50, height: 240, rotZ: -0.04, offset: new THREE.Vector3(15, 0, -10) },
      { radiusTop: 1.8, radiusBottom: 75, height: 280, rotZ: 0.05, offset: new THREE.Vector3(-20, 0, 15) },
      { radiusTop: 1.2, radiusBottom: 40, height: 220, rotZ: -0.02, offset: new THREE.Vector3(-10, 0, -25) },
      { radiusTop: 2.2, radiusBottom: 85, height: 300, rotZ: 0.03, offset: new THREE.Vector3(25, 0, 20) },
    ];
  }, []);

  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color('#ffe6aa') },
      uIntensity: { value: 0.35 },
      uTime: { value: 0 },
    }),
    []
  );

  useFrame((state, delta) => {
    if (!materialRef.current || !groupRef.current) return;

    uniforms.uTime.value += delta;

    const timeSys = TimeSystem.getInstance();
    const timeState = timeSys.getState();
    const weatherSys = WeatherSystem.getInstance();
    const weatherState = weatherSys.getState();

    const pPos = playerPosRef?.current || new THREE.Vector3(0, 0, 0);

    // Position rays origin high along celestial direction vector
    const celPos = timeState.celestialPosition;
    const originX = pPos.x + celPos.x * 2.8;
    const originY = Math.max(90, celPos.y * 2.8);
    const originZ = pPos.z + celPos.z * 2.8;

    groupRef.current.position.set(originX, originY, originZ);

    // Aim the cones towards the player's ground vicinity
    const target = new THREE.Vector3(pPos.x, 0, pPos.z);
    groupRef.current.lookAt(target);
    // Rotate cone geometry so it points along lookAt (-Z axis in Three.js)
    groupRef.current.rotateX(-Math.PI / 2);

    // Evaluate ray color and intensity based on time and weather
    let baseRayColor = new THREE.Color(timeState.celestialColor);
    if (timeState.isNight) {
      baseRayColor = new THREE.Color('#7dd3fc').multiplyScalar(0.7); // Cool moonbeam
    } else if (timeState.phase === 'DAWN' || timeState.phase === 'DUSK') {
      baseRayColor = new THREE.Color('#f59e0b'); // Rich sunset/sunrise amber
    }

    // Storm darkness attenuates rays, while cyber fog diffuses and brightens them
    const stormAtten = Math.max(0.1, 1.0 - weatherState.skyDarkness * 0.75);
    const fogBoost = weatherState.fogDensityMultiplier > 1.8 ? 1.4 : 1.0;
    const intensity = (timeState.isNight ? 0.18 : 0.32) * stormAtten * fogBoost;

    uniforms.uColor.value.copy(baseRayColor);
    uniforms.uIntensity.value = THREE.MathUtils.lerp(
      uniforms.uIntensity.value,
      intensity,
      0.08
    );
  });

  // Only active when volumetrics is enabled in quality profile
  if (!quality.volumetrics) {
    return null;
  }

  return (
    <group ref={groupRef} name="CelestialVolumetricRays">
      <shaderMaterial
        ref={materialRef}
        vertexShader={VolumetricRayShader.vertexShader}
        fragmentShader={VolumetricRayShader.fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
      />
      {rayGeometries.map((rg, idx) => (
        <mesh
          key={idx}
          position={[rg.offset.x, -rg.height / 2, rg.offset.z]}
          rotation={[0, 0, rg.rotZ]}
        >
          <coneGeometry args={[rg.radiusBottom, rg.height, 16, 1, true]} />
        </mesh>
      ))}
    </group>
  );
};
