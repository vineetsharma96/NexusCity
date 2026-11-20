import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { QualitySettings } from '../rendering/QualityManager';
import { WebGLCapabilities } from '../rendering/WebGLCapabilities';
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

const STREET_POOL_OFFSETS: readonly [number, number, number][] = [
  [-12, 6.6, -12],
  [12, 6.6, -12],
  [-12, 6.6, 12],
  [12, 6.6, 12],
  [0, 7.2, -28],
  [0, 7.2, 28],
];

interface PmremEnvController {
  pmrem: THREE.PMREMGenerator;
  envScene: THREE.Scene;
  envSkyUniforms: {
    uTop: { value: THREE.Color };
    uMid: { value: THREE.Color };
    uBot: { value: THREE.Color };
    uSolarGlow: { value: THREE.Color };
    uSunDir: { value: THREE.Vector3 };
    uGlowStrength: { value: number };
  };
  accentStripMats: { mat: THREE.MeshBasicMaterial; baseColor: THREE.Color }[];
  currentRT: THREE.WebGLRenderTarget | null;
  rendered: boolean;
}

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
  const streetPoolRefs = useRef<(THREE.PointLight | null)[]>([]);
  const centralBeaconLightRef = useRef<THREE.PointLight>(null);
  const pmremCtrlRef = useRef<PmremEnvController | null>(null);

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
  const warmLampColor = useMemo(() => new THREE.Color('#ffd699'), []);
  const coolLampColor = useMemo(() => new THREE.Color('#bae6fd'), []);
  const fallbackPos = useRef(new THREE.Vector3(0, 0, 0));
  const lastShadowTarget = useRef(new THREE.Vector3(NaN, 0, NaN));
  const lastEnvPhaseKey = useRef<string>('');

  const skyUniforms = useMemo(
    () => ({
      topColor: { value: new THREE.Color('#030714') },
      midColor: { value: new THREE.Color('#081229') },
      bottomColor: { value: new THREE.Color('#102142') },
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
    let lastSubPhase = TimeSystem.getInstance().getState().subPhaseLabel;
    let lastLightsOn = TimeSystem.getInstance().getState().streetLightsOn;
    let lastStarBucket = Math.round(TimeSystem.getInstance().getState().starOpacity * 20);
    const uTime = TimeSystem.getInstance().subscribe((s) => {
      const starBucket = Math.round(s.starOpacity * 20);
      if (
        s.subPhaseLabel !== lastSubPhase ||
        s.streetLightsOn !== lastLightsOn ||
        starBucket !== lastStarBucket
      ) {
        lastSubPhase = s.subPhaseLabel;
        lastLightsOn = s.streetLightsOn;
        lastStarBucket = starBucket;
        setTimeState(s);
      }
    });

    let lastWeatherType = WeatherSystem.getInstance().getState().currentWeather;
    let lastPrecipBucket = Math.round(WeatherSystem.getInstance().getState().precipitationIntensity * 10);
    let lastFlashBucket = Math.round(WeatherSystem.getInstance().getState().lightningFlash * 5);
    const uWea = WeatherSystem.getInstance().subscribe((w) => {
      const precipBucket = Math.round(w.precipitationIntensity * 10);
      const flashBucket = Math.round(w.lightningFlash * 5);
      if (
        w.currentWeather !== lastWeatherType ||
        precipBucket !== lastPrecipBucket ||
        flashBucket !== lastFlashBucket
      ) {
        lastWeatherType = w.currentWeather;
        lastPrecipBucket = precipBucket;
        lastFlashBucket = flashBucket;
        setWeatherState({ ...w });
      }
    });

    let lastDistrictType = ChunkManager.getInstance().getState().currentDistrict.type;
    const uChunk = ChunkManager.getInstance().subscribe((s) => {
      if (s.currentDistrict.type !== lastDistrictType) {
        lastDistrictType = s.currentDistrict.type;
        setDistrict(s.currentDistrict);
      }
    });
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
      snowIntensity: weatherState.snowIntensity,
      wetnessFactor: weatherState.wetnessFactor,
      fogDensityMultiplier: weatherState.fogDensityMultiplier,
      lightningFlash: weatherState.lightningFlash,
      districtFogColor: district.fogColor,
      districtAccentColor: district.accentColor,
      cityEventLightScale: cityEvent.lightScale,
    });
  }, [
    weatherState.rainIntensity,
    weatherState.snowIntensity,
    weatherState.wetnessFactor,
    weatherState.fogDensityMultiplier,
    weatherState.lightningFlash,
    district.fogColor,
    district.accentColor,
    cityEvent.lightScale,
  ]);

  const gpuCaps = useMemo(() => WebGLCapabilities.detect(), []);
  const maxShadowBudget = gpuCaps.isMobile ? 1024 : 2048;
  const safeShadowMapSize = Math.min(quality.shadowMapSize, maxShadowBudget, gl.capabilities.maxTextureSize || 2048);
  const isUltra = quality.name === 'ULTRA';
  const shadowCamRange = isUltra ? 92 : 70;

  // Dynamically reallocate directional shadow map when shadowMapSize, range, or shadows toggle changes
  useEffect(() => {
    const light = dirLightRef.current;
    if (!light) return;
    light.shadow.mapSize.set(safeShadowMapSize, safeShadowMapSize);
    light.shadow.camera.left = -shadowCamRange;
    light.shadow.camera.right = shadowCamRange;
    light.shadow.camera.top = shadowCamRange;
    light.shadow.camera.bottom = -shadowCamRange;
    light.shadow.camera.updateProjectionMatrix();
    if (light.shadow.map) {
      light.shadow.map.dispose();
      light.shadow.map = null;
    }
    light.shadow.needsUpdate = true;
  }, [safeShadowMapSize, shadowCamRange, quality.shadows]);

  // Physically prefiltered PMREM Image-Based Lighting (IBL) synchronized with live diurnal sky & urban softboxes
  useEffect(() => {
    if (quality.reflectionQuality === 'OFF') {
      scene.environment = null;
      pmremCtrlRef.current = null;
      return;
    }

    const pmrem = new THREE.PMREMGenerator(gl);
    pmrem.compileCubemapShader();

    const envScene = new THREE.Scene();
    const skyGeo = new THREE.SphereGeometry(60, 28, 16);
    const envSkyUniforms = {
      uTop: { value: new THREE.Color('#030714') },
      uMid: { value: new THREE.Color('#102a52') },
      uBot: { value: new THREE.Color('#070e1f') },
      uSolarGlow: { value: new THREE.Color('#38bdf8') },
      uSunDir: { value: new THREE.Vector3(0.4, 0.7, 0.2).normalize() },
      uGlowStrength: { value: 0.6 },
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
        uniform vec3 uSolarGlow;
        uniform vec3 uSunDir;
        uniform float uGlowStrength;
        varying vec3 vWorldPos;
        void main() {
          vec3 dir = normalize(vWorldPos);
          float h = dir.y;
          vec3 col = h > 0.0
            ? mix(uMid, uTop, pow(h, 0.52))
            : mix(uMid, uBot, min(1.0, -h * 2.8));
          float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
          float sunHighlight = pow(sunDot, 12.0) * 0.9 + pow(sunDot, 48.0) * 1.4;
          col += uSolarGlow * sunHighlight * uGlowStrength;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      side: THREE.BackSide,
    });
    envScene.add(new THREE.Mesh(skyGeo, skyMat));

    const stripGeo = new THREE.BoxGeometry(11, 2.4, 0.5);
    const towerGeo = new THREE.BoxGeometry(4.5, 19, 4.5);
    const disposableMats: THREE.Material[] = [skyMat];
    const accentStripMats: { mat: THREE.MeshBasicMaterial; baseColor: THREE.Color }[] = [];

    const addSoftbox = (hex: string, x: number, y: number, z: number, scale: [number, number, number] = [1, 1, 1]) => {
      const baseColor = new THREE.Color(hex);
      const mat = new THREE.MeshBasicMaterial({ color: baseColor.clone(), toneMapped: false });
      disposableMats.push(mat);
      accentStripMats.push({ mat, baseColor });
      const m = new THREE.Mesh(stripGeo, mat);
      m.position.set(x, y, z);
      m.scale.set(...scale);
      m.lookAt(0, 0, 0);
      envScene.add(m);
    };

    // Urban skyline emissive bounce panels & zenith skylight softboxes for crisp PBR specular reflections
    addSoftbox('#f59e0b', 22, 7.5, 0);
    addSoftbox('#38bdf8', -22, 7.5, 0);
    addSoftbox('#10b981', 0, 7.5, 22);
    addSoftbox('#f43f5e', 0, 7.5, -22);
    addSoftbox('#fef3c7', 15, 16, 15, [1.4, 1.3, 1]);
    addSoftbox('#bae6fd', -15, 16, -15, [1.4, 1.3, 1]);
    addSoftbox('#e0f2fe', 0, 26, 0, [2.2, 1.8, 1]);

    const towerMatA = new THREE.MeshBasicMaterial({ color: '#091121' });
    const towerMatB = new THREE.MeshBasicMaterial({ color: '#111d36' });
    disposableMats.push(towerMatA, towerMatB);

    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const dist = 28;
      const tMesh = new THREE.Mesh(towerGeo, i % 2 === 0 ? towerMatA : towerMatB);
      tMesh.position.set(Math.cos(angle) * dist, 6, Math.sin(angle) * dist);
      envScene.add(tMesh);
    }

    const ctrl: PmremEnvController = {
      pmrem,
      envScene,
      envSkyUniforms,
      accentStripMats,
      currentRT: null,
      rendered: false,
    };
    pmremCtrlRef.current = ctrl;
    lastEnvPhaseKey.current = '';

    return () => {
      scene.environment = null;
      if (ctrl.currentRT) {
        ctrl.currentRT.dispose();
        ctrl.currentRT = null;
      }
      pmrem.dispose();
      skyGeo.dispose();
      stripGeo.dispose();
      towerGeo.dispose();
      disposableMats.forEach((m) => m.dispose());
      pmremCtrlRef.current = null;
    };
  }, [scene, gl, quality.reflectionQuality]);

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

  useEffect(() => {
    return () => {
      fogPuffGeo.dispose();
    };
  }, [fogPuffGeo]);

  const fogStrength = THREE.MathUtils.clamp((weatherState.fogDensityMultiplier - 1.0) / 4.2, 0, 1);

  const fogColorTarget = useMemo(() => {
    const baseFog = new THREE.Color(timeState.fogColor);
    if (weatherState.lightningFlash > 0.1) {
      baseFog.lerp(new THREE.Color('#e0f2fe'), weatherState.lightningFlash * 0.45);
    }
    return `#${baseFog.getHexString()}`;
  }, [timeState.fogColor, weatherState.lightningFlash]);

  const localPoolCount =
    !quality.nightLightsEnabled || quality.maxLights < 4
      ? 0
      : quality.maxLights >= 20
      ? 4
      : quality.maxLights >= 12
      ? 3
      : 2;

  const envQualityScale =
    quality.reflectionQuality === 'HIGH'
      ? 1.15
      : quality.reflectionQuality === 'MEDIUM'
      ? 0.92
      : quality.reflectionQuality === 'LOW'
      ? 0.65
      : 0;

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    const dampAlpha = 1 - Math.exp(-7.5 * dt);
    const liveTime = TimeSystem.getInstance().getState();
    const liveWeather = WeatherSystem.getInstance().getState();
    const liveEvent = LivingCityEventSystem.getInstance().getState();
    const liveFogStrength = THREE.MathUtils.clamp((liveWeather.fogDensityMultiplier - 1.0) / 4.2, 0, 1);

    // 1. Refresh prefiltered PMREM IBL map when solar sub-phase or weather bucket shifts
    const ctrl = pmremCtrlRef.current;
    const phaseKey = `${liveTime.subPhaseLabel}:${liveWeather.currentWeather}`;
    if (ctrl && (!ctrl.rendered || lastEnvPhaseKey.current !== phaseKey)) {
      ctrl.envSkyUniforms.uTop.value.set(liveTime.skyTopColor);
      ctrl.envSkyUniforms.uMid.value.set(liveTime.skyMidColor);
      ctrl.envSkyUniforms.uBot.value.set(liveTime.skyHorizonColor);
      ctrl.envSkyUniforms.uSolarGlow.value.set(liveTime.solarGlowColor);
      ctrl.envSkyUniforms.uSunDir.value.copy(liveTime.isNight ? liveTime.moonDirection : liveTime.sunDirection);
      ctrl.envSkyUniforms.uGlowStrength.value = liveTime.isNight ? 0.55 : 1.05 + liveTime.goldenHourFactor * 0.45;

      // Boost urban neon bounce strips at night while keeping zenith skylight crisp by day
      const urbanStripGain = THREE.MathUtils.lerp(0.65, 1.45, liveTime.nightFactor);
      for (let i = 0; i < ctrl.accentStripMats.length; i++) {
        const entry = ctrl.accentStripMats[i];
        const isZenithBox = i >= 4;
        const gain = isZenithBox ? THREE.MathUtils.lerp(1.25, 0.65, liveTime.nightFactor) : urbanStripGain;
        entry.mat.color.copy(entry.baseColor).multiplyScalar(gain);
      }

      const nextRT = ctrl.pmrem.fromScene(ctrl.envScene, 0.035);
      if (ctrl.currentRT) {
        ctrl.currentRT.dispose();
      }
      ctrl.currentRT = nextRT;
      scene.environment = nextRT.texture;
      ctrl.rendered = true;
      lastEnvPhaseKey.current = phaseKey;
    }

    if (scene.environment) {
      const targetEnvIntensity =
        THREE.MathUtils.lerp(1.18, 0.88, liveTime.nightFactor) *
        envQualityScale *
        (1.0 - liveFogStrength * 0.25);
      scene.environmentIntensity = THREE.MathUtils.lerp(
        scene.environmentIntensity ?? targetEnvIntensity,
        targetEnvIntensity,
        dampAlpha
      );
    }

    // 2. Smoothly interpolate Sun / Moon Orbital Direction & Texel-Snapped Shadow Key Light
    const activeDir = liveTime.isNight ? liveTime.moonDirection : liveTime.sunDirection;
    smoothLightDir.current.lerp(activeDir, dampAlpha).normalize();
    const pPos = playerPosRef?.current || fallbackPos.current;

    if (dirLightRef.current) {
      // Texel-exact shadow camera snapping eliminates shadow swimming on all resolutions
      const texelWorldSize = (2 * shadowCamRange) / Math.max(256, safeShadowMapSize);
      const snappedX = Math.round(pPos.x / texelWorldSize) * texelWorldSize;
      const snappedZ = Math.round(pPos.z / texelWorldSize) * texelWorldSize;
      dirLightRef.current.position.set(
        snappedX + smoothLightDir.current.x * 110,
        Math.max(32, smoothLightDir.current.y * 130),
        snappedZ + smoothLightDir.current.z * 110
      );
      if (lastShadowTarget.current.x !== snappedX || lastShadowTarget.current.z !== snappedZ) {
        lastShadowTarget.current.set(snappedX, 0, snappedZ);
        dirLightRef.current.target.position.set(snappedX, 0, snappedZ);
        dirLightRef.current.target.updateMatrixWorld();
      }

      const keyColorTarget = liveWeather.lightningFlash > 0.2 ? '#e0f2fe' : liveTime.sunColor;
      smoothKeyColor.current.lerp(scratchColor.current.set(keyColorTarget), dampAlpha);
      dirLightRef.current.color.copy(smoothKeyColor.current);

      const targetKeyIntensity =
        (liveTime.isNight ? liveTime.moonIntensity : liveTime.sunIntensity) +
        liveWeather.lightningFlash * 4.5;
      dirLightRef.current.intensity = THREE.MathUtils.lerp(
        dirLightRef.current.intensity,
        targetKeyIntensity,
        dampAlpha
      );
    }

    // 3. Smoothly interpolate Global Illumination Sky-Bounce Rim Fill Light (opposite key light)
    if (bounceLightRef.current) {
      bounceLightRef.current.position.set(
        pPos.x - smoothLightDir.current.x * 85,
        52,
        pPos.z - smoothLightDir.current.z * 85
      );
      smoothBounceColor.current.lerp(scratchColor.current.set(liveTime.giBounceColor), dampAlpha);
      bounceLightRef.current.color.copy(smoothBounceColor.current);
      bounceLightRef.current.intensity = THREE.MathUtils.lerp(
        bounceLightRef.current.intensity,
        liveTime.giBounceIntensity,
        dampAlpha
      );
    }

    // 4. Smoothly interpolate Hemisphere GI & Ambient Illumination
    if (hemiLightRef.current) {
      smoothHemiSky.current.lerp(scratchColor.current.set(liveTime.hemiSkyColor), dampAlpha);
      smoothHemiGround.current.lerp(scratchColor.current.set(liveTime.hemiGroundColor), dampAlpha);
      hemiLightRef.current.color.copy(smoothHemiSky.current);
      hemiLightRef.current.groundColor.copy(smoothHemiGround.current);
      hemiLightRef.current.intensity = THREE.MathUtils.lerp(
        hemiLightRef.current.intensity,
        liveTime.hemiIntensity,
        dampAlpha
      );
    }

    if (ambientLightRef.current) {
      smoothAmbientColor.current.lerp(scratchColor.current.set(liveTime.ambientColor), dampAlpha);
      ambientLightRef.current.color.copy(smoothAmbientColor.current);
      ambientLightRef.current.intensity = THREE.MathUtils.lerp(
        ambientLightRef.current.intensity,
        liveTime.ambientIntensity,
        dampAlpha
      );
    }

    // 5. Update City-Wide Player-Local Dynamic Night Streetlight Pool (ON at night, OFF during day)
    const gridOut = liveEvent.type === 'POWER_OUTAGE' && liveEvent.phase === 'ACTIVE';
    if (localPoolCount > 0) {
      const targetLampIntensity =
        liveTime.streetLightsOn && !gridOut
          ? (0.65 + liveTime.nightFactor * 3.4) * liveEvent.lightScale * (1.0 + liveWeather.wetnessFactor * 0.25)
          : 0.0;
      const anchorX = Math.round(pPos.x / 24) * 24;
      const anchorZ = Math.round(pPos.z / 24) * 24;

      for (let i = 0; i < localPoolCount; i++) {
        const pl = streetPoolRefs.current[i];
        if (!pl) continue;
        const [ox, oy, oz] = STREET_POOL_OFFSETS[i];
        pl.position.set(anchorX + ox, oy, anchorZ + oz);
        pl.intensity = THREE.MathUtils.lerp(pl.intensity, targetLampIntensity, dampAlpha);
        pl.color.copy(i % 2 === 0 ? warmLampColor : coolLampColor);
      }
    }

    if (centralBeaconLightRef.current) {
      const targetCentral =
        liveTime.streetLightsOn && !gridOut
          ? (0.5 + liveTime.nightFactor * 2.2) * liveEvent.lightScale
          : 0.0;
      centralBeaconLightRef.current.intensity = THREE.MathUtils.lerp(
        centralBeaconLightRef.current.intensity,
        targetCentral,
        dampAlpha
      );
    }

    // 6. Smoothly interpolate 3-Stop Sky Dome Palette & Solar Mie Scatter Glow
    skyUniforms.topColor.value.lerp(scratchColor.current.set(liveTime.skyTopColor), dampAlpha);
    skyUniforms.midColor.value.lerp(scratchColor.current.set(liveTime.skyMidColor), dampAlpha);
    skyUniforms.bottomColor.value.lerp(scratchColor.current.set(liveTime.skyHorizonColor), dampAlpha);
    skyUniforms.solarGlowColor.value.lerp(scratchColor.current.set(liveTime.solarGlowColor), dampAlpha);
    skyUniforms.sunDir.value.copy(smoothLightDir.current);

    const targetGlowStrength =
      (liveTime.isNight ? 0.28 : 0.46 + liveTime.goldenHourFactor * 0.5) *
      (1.0 - Math.max(liveWeather.rainIntensity, liveWeather.snowIntensity) * 0.7) *
      (1.0 - liveFogStrength * 0.85);
    skyUniforms.solarGlowStrength.value = THREE.MathUtils.lerp(
      skyUniforms.solarGlowStrength.value,
      targetGlowStrength,
      dampAlpha
    );

    // 7. Smoothly interpolate Fog & Background Color/Distances
    const liveFogHex = liveWeather.lightningFlash > 0.1 ? '#e0f2fe' : liveTime.fogColor;
    smoothFogColor.current.lerp(scratchColor.current.set(liveFogHex), dampAlpha);
    if (bgColorRef.current) {
      bgColorRef.current.copy(smoothFogColor.current);
    }
    if (fogRef.current) {
      fogRef.current.color.copy(smoothFogColor.current);
      const clearFar =
        Math.min(liveTime.fogFar * (isUltra ? 1.35 : 1.0), quality.drawDistance) * district.fogDensity;
      const targetFar = quality.fogEnabled
        ? THREE.MathUtils.lerp(Math.max(180, clearFar), 52, liveFogStrength)
        : 12000;
      const targetNear = quality.fogEnabled
        ? THREE.MathUtils.lerp(liveTime.fogNear, 3.0, liveFogStrength)
        : 9000;
      fogRef.current.near = THREE.MathUtils.lerp(fogRef.current.near, targetNear, dampAlpha);
      fogRef.current.far = THREE.MathUtils.lerp(fogRef.current.far, targetFar, dampAlpha);
    }

    // 8. Update wind-driven volumetric street fog banks around the player
    if (fogBankMeshRef.current && fogBankMatRef.current) {
      const showBanks = quality.fogEnabled && liveFogStrength > 0.08;
      fogBankMeshRef.current.visible = showBanks;
      if (showBanks) {
        const t = clock.getElapsedTime();
        const wind = windSystem.getVector();
        fogBankMatRef.current.color.copy(smoothFogColor.current);
        fogBankMatRef.current.opacity = liveFogStrength * 0.16;

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
              vec3 baseSky = h < 0.35
                ? mix(bottomColor, midColor, smoothstep(0.0, 0.35, h))
                : mix(midColor, topColor, pow((h - 0.35) / 0.65, exponent));

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
            opacity={isUltra ? 0.05 : 0.028}
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

      {/* 3-Point Physically Balanced Global Illumination Rig */}
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
        position={[-45, 52, -35]}
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
        shadow-camera-near={5}
        shadow-camera-far={300}
        shadow-camera-left={-shadowCamRange}
        shadow-camera-right={shadowCamRange}
        shadow-camera-top={shadowCamRange}
        shadow-camera-bottom={-shadowCamRange}
        shadow-bias={-0.00025}
        shadow-normalBias={0.045}
        shadow-radius={3}
      />

      {/* City-Wide Player-Local Dynamic Streetlight Pools (Follows Player Everywhere at Night, OFF by Day) */}
      {Array.from({ length: localPoolCount }).map((_, idx) => (
        <pointLight
          key={`street-pool-${idx}`}
          ref={(el) => {
            streetPoolRefs.current[idx] = el;
          }}
          position={STREET_POOL_OFFSETS[idx]}
          color={idx % 2 === 0 ? '#ffd699' : '#bae6fd'}
          intensity={0}
          distance={38}
          decay={2}
        />
      ))}

      {quality.nightLightsEnabled && quality.maxLights >= 4 && (
        <pointLight
          ref={centralBeaconLightRef}
          position={[0, 16, 0]}
          intensity={0}
          distance={95}
          color={district.primaryLightColor}
          decay={2}
        />
      )}
    </>
  );
};
