import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { QualitySettings } from '../rendering/QualityManager';
import { TimeSystem, TimeLightingState } from '../world/TimeSystem';
import { WeatherSystem, WeatherState } from '../world/WeatherSystem';
import { WindSystem } from '../world/WindSystem';
import { ChunkManager } from '../world/ChunkManager';
import { DistrictInfo } from '../city/DistrictGenerator';
import { CelestialVolumetricRays } from './CelestialVolumetricRays';
import { LivingCityEventState, LivingCityEventSystem } from '../world/LivingCityEventSystem';

interface LightingManagerProps {
  quality: QualitySettings;
  playerPosRef?: React.MutableRefObject<THREE.Vector3>;
}

const FOG_PUFF_COUNT = 64;

export const LightingManager: React.FC<LightingManagerProps> = ({ quality, playerPosRef }) => {
  const { scene, gl } = useThree();
  const dirLightRef = useRef<THREE.DirectionalLight>(null);
  const fogBankMeshRef = useRef<THREE.InstancedMesh>(null);
  const fogBankMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const windSystem = WindSystem.getInstance();
  const dummy = useMemo(() => new THREE.Object3D(), []);

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

  // Volumetric low-lying street fog puffs that drift with the wind when FOG or storm mist is active
  const fogPuffs = useMemo(
    () =>
      Array.from({ length: FOG_PUFF_COUNT }, (_, i) => ({
        x: ((i * 73) % 150) - 75,
        y: 1.4 + (i % 6) * 1.45,
        z: ((i * 137) % 150) - 75,
        sx: 14 + (i % 5) * 4.5,
        sy: 1.6 + (i % 3) * 0.8,
        sz: 14 + ((i + 2) % 5) * 4.5,
        phase: i * 0.85,
      })),
    []
  );
  const fogPuffGeo = useMemo(() => new THREE.DodecahedronGeometry(1, 1), []);

  const fogStrength = THREE.MathUtils.clamp((weatherState.fogDensityMultiplier - 1.0) / 4.2, 0, 1);

  const fogColorFinal = useMemo(() => {
    const baseFog = new THREE.Color(timeState.fogColor).lerp(new THREE.Color(district.fogColor), 0.5);
    // In dense fog, shift toward a rich atmospheric mist tone so buildings silhouette dramatically
    if (fogStrength > 0.1) {
      const mistTint = timeState.isNight ? new THREE.Color('#132038') : new THREE.Color('#94a3b8');
      baseFog.lerp(mistTint, fogStrength * 0.65);
    }
    if (weatherState.lightningFlash > 0.1) {
      baseFog.lerp(new THREE.Color('#e0f2fe'), weatherState.lightningFlash * 0.45);
    }
    return `#${baseFog.getHexString()}`;
  }, [timeState.fogColor, timeState.isNight, district.fogColor, weatherState.lightningFlash, fogStrength]);

  useFrame(({ gl: renderer, clock }, delta) => {
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
    // Envelop the sky dome in fog when FOG weather is active
    if (quality.fogEnabled && fogStrength > 0.05) {
      const fCol = new THREE.Color(fogColorFinal);
      topCol.lerp(fCol, fogStrength * 0.88);
      baseHor.lerp(fCol, fogStrength * 0.95);
    }
    skyUniforms.topColor.value.copy(topCol);
    skyUniforms.bottomColor.value.copy(baseHor);

    // Update wind-driven volumetric street fog banks around the player
    if (fogBankMeshRef.current && fogBankMatRef.current) {
      const showBanks = quality.fogEnabled && fogStrength > 0.08;
      fogBankMeshRef.current.visible = showBanks;
      if (showBanks) {
        const dt = Math.min(delta, 0.05);
        const t = clock.getElapsedTime();
        const wind = windSystem.getVector();
        fogBankMatRef.current.color.set(fogColorFinal);
        fogBankMatRef.current.opacity = fogStrength * 0.16;

        for (let i = 0; i < FOG_PUFF_COUNT; i++) {
          const p = fogPuffs[i];
          p.x += wind.x * 0.55 * dt;
          p.z += wind.z * 0.55 * dt;

          if (p.x - pPos.x > 75) p.x -= 150;
          else if (p.x - pPos.x < -75) p.x += 150;
          if (p.z - pPos.z > 75) p.z -= 150;
          else if (p.z - pPos.z < -75) p.z += 150;

          dummy.position.set(p.x, p.y + Math.sin(t * 0.6 + p.phase) * 0.35, p.z);
          dummy.rotation.set(0, t * 0.08 + p.phase, 0);
          dummy.scale.set(p.sx, p.sy, p.sz);
          dummy.updateMatrix();
          fogBankMeshRef.current.setMatrixAt(i, dummy.matrix);
        }
        fogBankMeshRef.current.instanceMatrix.needsUpdate = true;
      }
    }
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

  // In CLEAR weather, fog starts far away (~130m..650m).
  // When switching to FOG (fogStrength -> 1.0), fog pulls right into the streets (near = 3m, far = 52m)!
  const clearFar = Math.min(timeState.fogFar * (isUltra ? 1.35 : 1.0), quality.drawDistance) * district.fogDensity;
  const fogFarFinal = quality.fogEnabled
    ? THREE.MathUtils.lerp(Math.max(180, clearFar), 52, fogStrength)
    : 12000;
  const fogNearFinal = quality.fogEnabled
    ? THREE.MathUtils.lerp(timeState.fogNear, 3.0, fogStrength)
    : 9000;

  const keyLightIntensity =
    (timeState.isNight ? timeState.moonIntensity : timeState.sunIntensity) *
      (1.0 - weatherState.rainIntensity * 0.35 - fogStrength * 0.35) *
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

      {/* Wind-Driven Street-Level Volumetric Fog Banks */}
      <instancedMesh
        ref={fogBankMeshRef}
        args={[fogPuffGeo, undefined, FOG_PUFF_COUNT]}
        frustumCulled={false}
      >
        <meshBasicMaterial
          ref={fogBankMatRef}
          color={fogColorFinal}
          transparent
          opacity={0}
          depthWrite={false}
        />
      </instancedMesh>

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

      {quality.starsEnabled &&
        timeState.starOpacity > 0.05 &&
        weatherState.rainIntensity < 0.5 &&
        fogStrength < 0.45 && (
          <points>
            <bufferGeometry>
              <bufferAttribute attach="attributes-position" args={[starPositions, 3]} />
            </bufferGeometry>
            <pointsMaterial
              color="#e2e8f0"
              size={isUltra ? 2.4 : 2.0}
              sizeAttenuation={false}
              transparent
              opacity={timeState.starOpacity * (1.0 - weatherState.rainIntensity * 2) * (1.0 - fogStrength * 2)}
            />
          </points>
        )}

      {quality.volumetricRaysEnabled && fogStrength < 0.7 && (
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
