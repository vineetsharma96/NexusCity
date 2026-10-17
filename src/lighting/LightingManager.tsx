import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { QualitySettings } from '../rendering/QualityManager';
import { TimeSystem, TimeLightingState } from '../world/TimeSystem';
import { WeatherSystem, WeatherState } from '../world/WeatherSystem';
import { ChunkManager } from '../world/ChunkManager';
import { DistrictInfo } from '../city/DistrictGenerator';
import { CelestialVolumetricRays } from './CelestialVolumetricRays';
import { LivingCityEventState, LivingCityEventSystem } from '../world/LivingCityEventSystem';

interface LightingManagerProps {
  quality: QualitySettings;
  playerPosRef?: React.MutableRefObject<THREE.Vector3>;
}

export const LightingManager: React.FC<LightingManagerProps> = ({ quality, playerPosRef }) => {
  const { scene, gl } = useThree();
  const dirLightRef = useRef<THREE.DirectionalLight>(null);
  const skyUniforms = useMemo(
    () => ({
      topColor: { value: new THREE.Color('#04070f') },
      bottomColor: { value: new THREE.Color('#0b1326') },
      offset: { value: 18 },
      exponent: { value: 0.65 },
    }),
    []
  );

  const [timeState, setTimeState] = useState<TimeLightingState>(() => TimeSystem.getInstance().getState());
  const [weatherState, setWeatherState] = useState<WeatherState>(() => WeatherSystem.getInstance().getState());
  const [district, setDistrict] = useState<DistrictInfo>(() => ChunkManager.getInstance().getState().currentDistrict);
  const [cityEvent, setCityEvent] = useState<LivingCityEventState>(() => LivingCityEventSystem.getInstance().getState());

  useEffect(() => {
    const uTime = TimeSystem.getInstance().subscribe(setTimeState);
    const uWea = WeatherSystem.getInstance().subscribe(setWeatherState);
    const uChunk = ChunkManager.getInstance().subscribe((s) => setDistrict(s.currentDistrict));
    const uEvt = LivingCityEventSystem.getInstance().subscribe(setCityEvent);
    return () => {
      uTime();
      uWea();
      uChunk();
      uEvt();
    };
  }, []);

  const safeShadowMapSize = Math.min(quality.shadowMapSize, gl.capabilities.maxTextureSize || 4096);

  // Dynamically reallocate directional shadow map when shadowMapSize changes
  useEffect(() => {
    const light = dirLightRef.current;
    if (!light) return;
    light.shadow.mapSize.set(safeShadowMapSize, safeShadowMapSize);
    if (light.shadow.map) {
      light.shadow.map.dispose();
      light.shadow.map = null;
    }
    light.shadow.needsUpdate = true;
  }, [safeShadowMapSize, quality.shadows]);

  // High-definition procedural environment cubemap scaled by reflectionQuality
  useEffect(() => {
    if (quality.reflectionQuality === 'OFF') {
      scene.environment = null;
      return;
    }

    const cubeSize =
      quality.reflectionQuality === 'HIGH' ? 256 : quality.reflectionQuality === 'MEDIUM' ? 128 : 64;
    const envScene = new THREE.Scene();
    const skyGeo = new THREE.SphereGeometry(60, 24, 12);
    const skyMat = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vWorldPos;
        void main() {
          float h = normalize(vWorldPos).y;
          vec3 top = vec3(0.02, 0.05, 0.12);
          vec3 mid = vec3(0.16, 0.52, 0.78);
          vec3 bot = vec3(0.04, 0.07, 0.14);
          vec3 col = h > 0.0 ? mix(mid, top, pow(h, 0.52)) : mix(mid, bot, min(1.0, -h * 3.2));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      side: THREE.BackSide,
    });
    envScene.add(new THREE.Mesh(skyGeo, skyMat));

    const stripGeo = new THREE.BoxGeometry(9, 2.2, 0.5);
    const towerGeo = new THREE.BoxGeometry(4, 18, 4);
    const addStrip = (color: string, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(stripGeo, new THREE.MeshBasicMaterial({ color }));
      m.position.set(x, y, z);
      m.lookAt(0, 0, 0);
      envScene.add(m);
    };
    addStrip('#f59e0b', 20, 7, 0);
    addStrip('#38bdf8', -20, 7, 0);
    addStrip('#10b981', 0, 7, 20);
    addStrip('#f43f5e', 0, 7, -20);
    addStrip('#fde68a', 14, 14, 14);
    addStrip('#7dd3fc', -14, 14, -14);

    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const dist = 26;
      const tMesh = new THREE.Mesh(
        towerGeo,
        new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? '#0b1324' : '#111c33' })
      );
      tMesh.position.set(Math.cos(angle) * dist, 6, Math.sin(angle) * dist);
      envScene.add(tMesh);
    }

    const cubeRT = new THREE.WebGLCubeRenderTarget(cubeSize, {
      format: THREE.RGBAFormat,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
    });
    const cubeCam = new THREE.CubeCamera(0.1, 120, cubeRT);
    scene.environment = cubeRT.texture;
    (scene as unknown as { __envUpdate?: { cubeCam: THREE.CubeCamera; envScene: THREE.Scene; rendered: boolean } }).__envUpdate = {
      cubeCam,
      envScene,
      rendered: false,
    };

    return () => {
      scene.environment = null;
      cubeRT.dispose();
      skyGeo.dispose();
      skyMat.dispose();
      stripGeo.dispose();
      towerGeo.dispose();
    };
  }, [scene, quality.reflectionQuality]);

  useFrame(({ gl: renderer }) => {
    const envData = (scene as unknown as { __envUpdate?: { cubeCam: THREE.CubeCamera; envScene: THREE.Scene; rendered: boolean } }).__envUpdate;
    if (envData && !envData.rendered) {
      envData.cubeCam.update(renderer, envData.envScene);
      envData.rendered = true;
    }

    const activeDir = timeState.isNight ? timeState.moonDirection : timeState.sunDirection;
    const pPos = playerPosRef?.current || new THREE.Vector3(0, 0, 0);

    if (dirLightRef.current) {
      dirLightRef.current.position.set(
        pPos.x + activeDir.x * 110,
        Math.max(36, activeDir.y * 130),
        pPos.z + activeDir.z * 110
      );
      dirLightRef.current.target.position.set(pPos.x, 0, pPos.z);
      dirLightRef.current.target.updateMatrixWorld();
    }

    const topCol = new THREE.Color(timeState.skyTopColor);
    const distFog = new THREE.Color(district.fogColor);
    const baseHor = new THREE.Color(timeState.skyHorizonColor).lerp(distFog, 0.45);
    if (weatherState.rainIntensity > 0.05) {
      const stormTint = new THREE.Color('#09101d');
      topCol.lerp(stormTint, weatherState.rainIntensity * 0.65);
      baseHor.lerp(stormTint, weatherState.rainIntensity * 0.55);
    }
    skyUniforms.topColor.value.copy(topCol);
    skyUniforms.bottomColor.value.copy(baseHor);
  });

  const isUltra = quality.name === 'ULTRA';

  const starPositions = useMemo(() => {
    const count = isUltra ? 1800 : 950;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = ((i * 137.508) % 360) * (Math.PI / 180);
      const yRatio = 0.14 + ((i * 7919) % 1000) / 1180;
      const phi = Math.acos(Math.min(0.99, yRatio));
      const r = 780;
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.cos(phi);
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    return pos;
  }, [isUltra]);

  const fogColorFinal = useMemo(() => {
    const c = new THREE.Color(timeState.fogColor).lerp(new THREE.Color(district.fogColor), 0.5);
    if (weatherState.lightningFlash > 0.1) {
      c.lerp(new THREE.Color('#e0f2fe'), weatherState.lightningFlash * 0.45);
    }
    return `#${c.getHexString()}`;
  }, [timeState.fogColor, district.fogColor, weatherState.lightningFlash]);

  const fogFarFinal = quality.fogEnabled
    ? Math.max(
        140,
        (Math.min(timeState.fogFar * (isUltra ? 1.35 : 1.0), quality.drawDistance) * district.fogDensity) /
          weatherState.fogDensityMultiplier
      )
    : 12000;
  const fogNearFinal = quality.fogEnabled
    ? Math.max(18, timeState.fogNear / weatherState.fogDensityMultiplier)
    : 9000;

  const keyLightIntensity =
    (timeState.isNight ? timeState.moonIntensity : timeState.sunIntensity) *
      (1.0 - weatherState.rainIntensity * 0.35) *
      cityEvent.lightScale +
    weatherState.lightningFlash * 4.5;

  const shadowCamRange = isUltra ? 125 : 85;

  return (
    <>
      <color attach="background" args={[fogColorFinal]} />
      <fog attach="fog" args={[fogColorFinal, fogNearFinal, fogFarFinal]} />

      <mesh scale={[-1, 1, 1]}>
        <sphereGeometry args={[1280, 32, 16]} />
        <shaderMaterial
          vertexShader={`
            varying vec3 vWorldPosition;
            void main() {
              vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            uniform vec3 topColor;
            uniform vec3 bottomColor;
            uniform float offset;
            uniform float exponent;
            varying vec3 vWorldPosition;
            void main() {
              float h = normalize(vWorldPosition + offset).y;
              gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
            }
          `}
          uniforms={skyUniforms}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      {/* Horizon Atmospheric Haze Band */}
      {quality.horizonHazeEnabled && (
        <mesh position={[0, 32, 0]}>
          <cylinderGeometry args={[1180, 1180, 140, 36, 1, true]} />
          <meshBasicMaterial
            color={district.accentColor}
            transparent
            opacity={isUltra ? 0.055 : 0.03}
            side={THREE.BackSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      )}

      {quality.starsEnabled && timeState.starOpacity > 0.05 && weatherState.rainIntensity < 0.5 && (
        <points>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[starPositions, 3]} />
          </bufferGeometry>
          <pointsMaterial
            color="#e2e8f0"
            size={isUltra ? 2.4 : 2.0}
            sizeAttenuation={false}
            transparent
            opacity={timeState.starOpacity * (1.0 - weatherState.rainIntensity * 2)}
          />
        </points>
      )}

      {quality.volumetricRaysEnabled && (
        <CelestialVolumetricRays timeState={timeState} weatherState={weatherState} />
      )}

      <ambientLight
        color={timeState.isNight ? '#1e293b' : '#cbd5e1'}
        intensity={timeState.ambientIntensity * cityEvent.lightScale}
      />
      <hemisphereLight
        args={[
          timeState.isNight ? '#38bdf8' : '#fef3c7',
          '#090d16',
          timeState.hemiIntensity * cityEvent.lightScale,
        ]}
      />

      <directionalLight
        ref={dirLightRef}
        position={[60, 120, 45]}
        intensity={keyLightIntensity}
        color={weatherState.lightningFlash > 0.2 ? '#e0f2fe' : timeState.sunColor}
        castShadow={quality.shadows}
        shadow-mapSize-width={safeShadowMapSize}
        shadow-mapSize-height={safeShadowMapSize}
        shadow-camera-near={10}
        shadow-camera-far={340}
        shadow-camera-left={-shadowCamRange}
        shadow-camera-right={shadowCamRange}
        shadow-camera-top={shadowCamRange}
        shadow-camera-bottom={-shadowCamRange}
        shadow-bias={-0.0004}
      />

      {quality.nightLightsEnabled && quality.maxLights >= 4 && (
        <pointLight
          position={[0, 16, 0]}
          intensity={(0.65 + timeState.nightFactor * 2.6) * cityEvent.lightScale}
          distance={105}
          color={district.primaryLightColor}
          decay={2}
        />
      )}
    </>
  );
};
