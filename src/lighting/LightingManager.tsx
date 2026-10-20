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
  const bounceLightRef = useRef<THREE.DirectionalLight>(null);
  const hemiLightRef = useRef<THREE.HemisphereLight>(null);
  const ambientLightRef = useRef<THREE.AmbientLight>(null);
  const fogRef = useRef<THREE.Fog>(null);
  const bgColorRef = useRef<THREE.Color>(null);
  const fogBankMeshRef = useRef<THREE.InstancedMesh>(null);
  const fogBankMatRef = useRef<THREE.MeshBasicMaterial>(null);

  const windSystem = WindSystem.getInstance();
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Smoothly interpolated runtime state vectors/colors for 60fps jitter-free GI & sky transitions
  const smoothLightDir = useRef(new THREE.Vector3(0.4, 0.75, 0.2).normalize());
  const smoothKeyColor = useRef(new THREE.Color('#fef3c7'));
  const smoothAmbientColor = useRef(new THREE.Color('#1e293b'));
  const smoothHemiSky = useRef(new THREE.Color('#38bdf8'));
  const smoothHemiGround = useRef(new THREE.Color('#090d16'));
  const smoothBounceColor = useRef(new THREE.Color('#1d4ed8'));
  const smoothFogColor = useRef(new THREE.Color('#070d1c'));
  const scratchColor = useRef(new THREE.Color());
  const fallbackPos = useRef(new THREE.Vector3(0, 0, 0));
  const lastShadowTarget = useRef(new THREE.Vector3(NaN, 0, NaN));
  const lastEnvPhaseKey = useRef<string>('');

  const skyUniforms = useMemo(
    () => ({
      topColor: { value: new THREE.Color('#030611') },
      midColor: { value: new THREE.Color('#070f22') },
      bottomColor: { value: new THREE.Color('#0d1b36') },
      solarGlowColor: { value: new THREE.Color('#38bdf8') },
      sunDir: { value: new THREE.Vector3(0.4, 0.6, 0.2).normalize() },
      solarGlowStrength: { value: 0.45 },
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

  // Synchronize TimeSystem with current environment settings whenever weather, district, or city events change
  useEffect(() => {
    TimeSystem.getInstance().syncEnvironment({
      rainIntensity: weatherState.rainIntensity,
      wetnessFactor: weatherState.wetnessFactor,
      fogDensityMultiplier: weatherState.fogDensityMultiplier,
      lightningFlash: weatherState.lightningFlash,
      districtFogColor: district.fogColor,
      districtAccentColor: district.accentColor,
      cityEventLightScale: cityEvent.lightScale,
    });
  }, [
    weatherState.rainIntensity,
    weatherState.wetnessFactor,
    weatherState.fogDensityMultiplier,
    weatherState.lightningFlash,
    district.fogColor,
    district.accentColor,
    cityEvent.lightScale,
  ]);

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

  // High-definition procedural environment cubemap synchronized with time-of-day sky palette
  useEffect(() => {
    if (quality.reflectionQuality === 'OFF') {
      scene.environment = null;
      return;
    }

    const cubeSize =
      quality.reflectionQuality === 'HIGH' ? 256 : quality.reflectionQuality === 'MEDIUM' ? 128 : 64;
    const envScene = new THREE.Scene();
    const skyGeo = new THREE.SphereGeometry(60, 24, 12);
    const envSkyUniforms = {
      uTop: { value: new THREE.Color('#04091a') },
      uMid: { value: new THREE.Color('#165278') },
      uBot: { value: new THREE.Color('#070d1c') },
    };
    const skyMat = new THREE.ShaderMaterial({
      uniforms: envSkyUniforms,
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uTop;
        uniform vec3 uMid;
        uniform vec3 uBot;
        varying vec3 vWorldPos;
        void main() {
          float h = normalize(vWorldPos).y;
          vec3 col = h > 0.0 ? mix(uMid, uTop, pow(h, 0.52)) : mix(uMid, uBot, min(1.0, -h * 3.2));
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
    (
      scene as unknown as {
        __envUpdate?: {
          cubeCam: THREE.CubeCamera;
          envScene: THREE.Scene;
          envSkyUniforms: typeof envSkyUniforms;
          rendered: boolean;
        };
      }
    ).__envUpdate = {
      cubeCam,
      envScene,
      envSkyUniforms,
      rendered: false,
    };
    lastEnvPhaseKey.current = '';

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

  const fogColorTarget = useMemo(() => {
    const baseFog = new THREE.Color(timeState.fogColor);
    if (weatherState.lightningFlash > 0.1) {
      baseFog.lerp(new THREE.Color('#e0f2fe'), weatherState.lightningFlash * 0.45);
    }
    return `#${baseFog.getHexString()}`;
  }, [timeState.fogColor, weatherState.lightningFlash]);

  const isUltra = quality.name === 'ULTRA';

  useFrame(({ gl: renderer, clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    const dampAlpha = 1 - Math.exp(-7.5 * dt);

    // 1. Refresh reflection cubemap when solar sub-phase or weather bucket shifts
    const envData = (
      scene as unknown as {
        __envUpdate?: {
          cubeCam: THREE.CubeCamera;
          envScene: THREE.Scene;
          envSkyUniforms: {
            uTop: { value: THREE.Color };
            uMid: { value: THREE.Color };
            uBot: { value: THREE.Color };
          };
          rendered: boolean;
        };
      }
    ).__envUpdate;
    const phaseKey = `${timeState.subPhaseLabel}:${weatherState.currentWeather}`;
    if (envData && (!envData.rendered || lastEnvPhaseKey.current !== phaseKey)) {
      envData.envSkyUniforms.uTop.value.set(timeState.skyTopColor);
      envData.envSkyUniforms.uMid.value.set(timeState.skyMidColor);
      envData.envSkyUniforms.uBot.value.set(timeState.skyHorizonColor);
      envData.cubeCam.update(renderer, envData.envScene);
      envData.rendered = true;
      lastEnvPhaseKey.current = phaseKey;
    }

    // 2. Smoothly interpolate Sun / Moon Orbital Direction & Key Light Position
    const activeDir = timeState.isNight ? timeState.moonDirection : timeState.sunDirection;
    smoothLightDir.current.lerp(activeDir, dampAlpha).normalize();
    const pPos = playerPosRef?.current || fallbackPos.current;

    if (dirLightRef.current) {
      // Snap shadow camera target to 2m texel grid to prevent shadow swimming and redundant matrix updates
      const snappedX = Math.round(pPos.x * 0.5) * 2;
      const snappedZ = Math.round(pPos.z * 0.5) * 2;
      dirLightRef.current.position.set(
        snappedX + smoothLightDir.current.x * 115,
        Math.max(30, smoothLightDir.current.y * 135),
        snappedZ + smoothLightDir.current.z * 115
      );
      if (lastShadowTarget.current.x !== snappedX || lastShadowTarget.current.z !== snappedZ) {
        lastShadowTarget.current.set(snappedX, 0, snappedZ);
        dirLightRef.current.target.position.set(snappedX, 0, snappedZ);
        dirLightRef.current.target.updateMatrixWorld();
      }

      const keyColorTarget = weatherState.lightningFlash > 0.2 ? '#e0f2fe' : timeState.sunColor;
      smoothKeyColor.current.lerp(scratchColor.current.set(keyColorTarget), dampAlpha);
      dirLightRef.current.color.copy(smoothKeyColor.current);

      const targetKeyIntensity =
        (timeState.isNight ? timeState.moonIntensity : timeState.sunIntensity) +
        weatherState.lightningFlash * 4.5;
      dirLightRef.current.intensity = THREE.MathUtils.lerp(
        dirLightRef.current.intensity,
        targetKeyIntensity,
        dampAlpha
      );
    }

    // 3. Smoothly interpolate Global Illumination Sky-Bounce Fill Light (opposite key light)
    if (bounceLightRef.current) {
      bounceLightRef.current.position.set(
        pPos.x - smoothLightDir.current.x * 85,
        48,
        pPos.z - smoothLightDir.current.z * 85
      );
      smoothBounceColor.current.lerp(scratchColor.current.set(timeState.giBounceColor), dampAlpha);
      bounceLightRef.current.color.copy(smoothBounceColor.current);
      bounceLightRef.current.intensity = THREE.MathUtils.lerp(
        bounceLightRef.current.intensity,
        timeState.giBounceIntensity,
        dampAlpha
      );
    }

    // 4. Smoothly interpolate Hemisphere GI & Ambient Illumination
    if (hemiLightRef.current) {
      smoothHemiSky.current.lerp(scratchColor.current.set(timeState.hemiSkyColor), dampAlpha);
      smoothHemiGround.current.lerp(scratchColor.current.set(timeState.hemiGroundColor), dampAlpha);
      hemiLightRef.current.color.copy(smoothHemiSky.current);
      hemiLightRef.current.groundColor.copy(smoothHemiGround.current);
      hemiLightRef.current.intensity = THREE.MathUtils.lerp(
        hemiLightRef.current.intensity,
        timeState.hemiIntensity,
        dampAlpha
      );
    }

    if (ambientLightRef.current) {
      smoothAmbientColor.current.lerp(scratchColor.current.set(timeState.ambientColor), dampAlpha);
      ambientLightRef.current.color.copy(smoothAmbientColor.current);
      ambientLightRef.current.intensity = THREE.MathUtils.lerp(
        ambientLightRef.current.intensity,
        timeState.ambientIntensity,
        dampAlpha
      );
    }

    // 5. Smoothly interpolate 3-Stop Sky Dome Palette & Solar Mie Scatter Glow
    skyUniforms.topColor.value.lerp(scratchColor.current.set(timeState.skyTopColor), dampAlpha);
    skyUniforms.midColor.value.lerp(scratchColor.current.set(timeState.skyMidColor), dampAlpha);
    skyUniforms.bottomColor.value.lerp(scratchColor.current.set(timeState.skyHorizonColor), dampAlpha);
    skyUniforms.solarGlowColor.value.lerp(scratchColor.current.set(timeState.solarGlowColor), dampAlpha);
    skyUniforms.sunDir.value.copy(smoothLightDir.current);

    const targetGlowStrength =
      (timeState.isNight ? 0.25 : 0.42 + timeState.goldenHourFactor * 0.48) *
      (1.0 - weatherState.rainIntensity * 0.7) *
      (1.0 - fogStrength * 0.85);
    skyUniforms.solarGlowStrength.value = THREE.MathUtils.lerp(
      skyUniforms.solarGlowStrength.value,
      targetGlowStrength,
      dampAlpha
    );

    // 6. Smoothly interpolate Fog & Background Color/Distances
    smoothFogColor.current.lerp(scratchColor.current.set(fogColorTarget), dampAlpha);
    if (bgColorRef.current) {
      bgColorRef.current.copy(smoothFogColor.current);
    }
    if (fogRef.current) {
      fogRef.current.color.copy(smoothFogColor.current);
      const clearFar =
        Math.min(timeState.fogFar * (isUltra ? 1.35 : 1.0), quality.drawDistance) * district.fogDensity;
      const targetFar = quality.fogEnabled
        ? THREE.MathUtils.lerp(Math.max(180, clearFar), 52, fogStrength)
        : 12000;
      const targetNear = quality.fogEnabled
        ? THREE.MathUtils.lerp(timeState.fogNear, 3.0, fogStrength)
        : 9000;
      fogRef.current.near = THREE.MathUtils.lerp(fogRef.current.near, targetNear, dampAlpha);
      fogRef.current.far = THREE.MathUtils.lerp(fogRef.current.far, targetFar, dampAlpha);
    }

    // 7. Update wind-driven volumetric street fog banks around the player
    if (fogBankMeshRef.current && fogBankMatRef.current) {
      const showBanks = quality.fogEnabled && fogStrength > 0.08;
      fogBankMeshRef.current.visible = showBanks;
      if (showBanks) {
        const t = clock.getElapsedTime();
        const wind = windSystem.getVector();
        fogBankMatRef.current.color.copy(smoothFogColor.current);
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

  const shadowCamRange = isUltra ? 125 : 85;

  return (
    <>
      <color ref={bgColorRef} attach="background" args={[fogColorTarget]} />
      <fog ref={fogRef} attach="fog" args={[fogColorTarget, 110, 520]} />

      {/* 3-Stop Atmospheric Sky Dome with Directional Solar/Lunar Mie Scattering */}
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
            uniform vec3 midColor;
            uniform vec3 bottomColor;
            uniform vec3 solarGlowColor;
            uniform vec3 sunDir;
            uniform float solarGlowStrength;
            uniform float offset;
            uniform float exponent;
            varying vec3 vWorldPosition;
            void main() {
              vec3 viewDir = normalize(vWorldPosition + vec3(0.0, offset, 0.0));
              float h = max(viewDir.y, 0.0);
              // Smooth 3-stop Rayleigh sky gradient: Horizon -> Mid-Sky -> Zenith
              vec3 baseSky = h < 0.35
                ? mix(bottomColor, midColor, smoothstep(0.0, 0.35, h))
                : mix(midColor, topColor, pow((h - 0.35) / 0.65, exponent));

              // Anisotropic Mie solar/lunar scattering halo near the sun/moon azimuth
              float cosTheta = max(dot(normalize(vWorldPosition), normalize(sunDir)), 0.0);
              float mieHalo = pow(cosTheta, 6.0) * 0.55 + pow(cosTheta, 28.0) * 0.65;
              float horizonBand = pow(1.0 - max(abs(viewDir.y), 0.0), 3.2) * pow(cosTheta, 2.2) * 0.45;
              vec3 finalSky = baseSky + solarGlowColor * (mieHalo + horizonBand) * solarGlowStrength;

              gl_FragColor = vec4(finalSky, 1.0);
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
          color={fogColorTarget}
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

      {quality.starsEnabled && timeState.starOpacity > 0.04 && (
        <points>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[starPositions, 3]} />
          </bufferGeometry>
          <pointsMaterial
            color="#e2e8f0"
            size={isUltra ? 2.4 : 2.0}
            sizeAttenuation={false}
            transparent
            opacity={timeState.starOpacity}
          />
        </points>
      )}

      {quality.volumetricRaysEnabled && fogStrength < 0.7 && (
        <CelestialVolumetricRays
          timeState={timeState}
          weatherState={weatherState}
          playerPosRef={playerPosRef}
        />
      )}

      {/* Global Illumination Rig: Ambient + Hemisphere Sky/Ground Bounce + Secondary GI Fill + Primary Solar Key */}
      <ambientLight
        ref={ambientLightRef}
        color={timeState.ambientColor}
        intensity={timeState.ambientIntensity}
      />
      <hemisphereLight
        ref={hemiLightRef}
        args={[timeState.hemiSkyColor, timeState.hemiGroundColor, timeState.hemiIntensity]}
      />
      <directionalLight
        ref={bounceLightRef}
        position={[-45, 48, -35]}
        color={timeState.giBounceColor}
        intensity={timeState.giBounceIntensity}
      />

      <directionalLight
        ref={dirLightRef}
        position={[60, 120, 45]}
        intensity={timeState.isNight ? timeState.moonIntensity : timeState.sunIntensity}
        color={timeState.sunColor}
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
