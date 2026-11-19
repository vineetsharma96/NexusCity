import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { CityGenerator, CityData } from './CityGenerator';
import { RoadGenerator } from './RoadGenerator';
import { VegetationGenerator, TreeDef } from './VegetationGenerator';
import { ProceduralTree } from './ProceduralTree';
import { CyberVideoBillboard } from './CyberVideoBillboard';
import { FacadeStyleVariant, ProceduralTextures } from '../core/ProceduralTextures';
import { TimeSystem, TimeLightingState } from '../world/TimeSystem';
import { WeatherSystem, WeatherState } from '../world/WeatherSystem';
import { QualityManager, QualitySettings } from '../rendering/QualityManager';
import { StreetSign } from './StreetSign';
import { NavigationSystem } from '../map/NavigationSystem';
import { LivingCityEventState, LivingCityEventSystem } from '../world/LivingCityEventSystem';

const SHARED_UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const SHARED_UNIT_CYLINDER = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
const SHARED_TAPER_POLE = new THREE.CylinderGeometry(0.08, 0.15, 1, 8);
const SHARED_OCT_PLINTH = new THREE.CylinderGeometry(0.28, 0.38, 1, 8);
const SHARED_BOLLARD_CAP = new THREE.CylinderGeometry(0.08, 0.14, 1, 10);
const SHARED_DRONE_SPHERE = new THREE.SphereGeometry(0.14, 8, 8);
const SHARED_DRONE_CONE = new THREE.ConeGeometry(2.2, 8.2, 10, 1, true);
const SHARED_STEAM_PLANE = new THREE.PlaneGeometry(1.8, 1.1);
const SHARED_STEAM_CONE = new THREE.ConeGeometry(0.85, 2.4, 8, 1, true);
const GLASS_WINDSCREEN_MAT = new THREE.MeshStandardMaterial({
  color: '#0f2238',
  metalness: 0.92,
  roughness: 0.08,
  transparent: true,
  opacity: 0.48,
});
const SOLAR_CELL_MAT = new THREE.MeshStandardMaterial({ color: '#0c2340', metalness: 0.92, roughness: 0.14 });
const TIMBER_SLAT_MAT = new THREE.MeshStandardMaterial({ color: '#6b4226', metalness: 0.08, roughness: 0.72 });
const CONCRETE_BASE_MAT = new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.22, roughness: 0.78 });
const CHROME_TRIM_MAT = new THREE.MeshStandardMaterial({ color: '#94a3b8', metalness: 0.94, roughness: 0.18 });
const PLAZA_NORMAL_SCALE = new THREE.Vector2(0.4, 0.4);
const AVE_NORMAL_SCALE = new THREE.Vector2(0.65, 0.65);
const AVE_ULTRA_NORMAL_SCALE = new THREE.Vector2(0.85, 0.85);
const SW_NORMAL_SCALE = new THREE.Vector2(0.32, 0.32);
const BLDG_NORMAL_SCALE = new THREE.Vector2(0.58, 0.58);
const BLDG_ULTRA_NORMAL_SCALE = new THREE.Vector2(0.8, 0.8);

const districtStdMatCache = new Map<string, THREE.MeshStandardMaterial>();
function getDistrictStdMat(
  color: string,
  metalness: number = 0.9,
  roughness: number = 0.2
): THREE.MeshStandardMaterial {
  const key = `${color}|${metalness}|${roughness}`;
  let m = districtStdMatCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, metalness, roughness });
    districtStdMatCache.set(key, m);
  }
  return m;
}

const districtBasicMatCache = new Map<string, THREE.MeshBasicMaterial>();
function getDistrictBasicMat(color: string): THREE.MeshBasicMaterial {
  let m = districtBasicMatCache.get(color);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color });
    districtBasicMatCache.set(color, m);
  }
  return m;
}

const districtBloomMatCache = new Map<string, THREE.MeshBasicMaterial>();
function getDistrictBloomMat(color: string, boost: number = 2.0): THREE.MeshBasicMaterial {
  const key = `${color}|${boost.toFixed(2)}`;
  let m = districtBloomMatCache.get(key);
  if (!m) {
    const hdrColor = new THREE.Color(color).multiplyScalar(boost);
    m = new THREE.MeshBasicMaterial({ color: hdrColor, toneMapped: false });
    districtBloomMatCache.set(key, m);
  }
  return m;
}

interface CityDistrictProps {
  seed?: number;
}

export const CityDistrict: React.FC<CityDistrictProps> = ({ seed = 847291 }) => {
  const cityData: CityData = useMemo(() => CityGenerator.generateDistrict(seed), [seed]);
  const trees: TreeDef[] = useMemo(() => VegetationGenerator.generateTrees(seed), [seed]);
  const astrolabeRef = useRef<THREE.Group>(null);
  const droneGroupRef = useRef<THREE.Group>(null);

  const [streetLightsOn, setStreetLightsOn] = useState<boolean>(
    () => TimeSystem.getInstance().getState().streetLightsOn
  );
  const [nightBucket, setNightBucket] = useState<number>(
    () => Math.round(TimeSystem.getInstance().getState().nightFactor * 5) / 5
  );
  const [wetnessBucket, setWetnessBucket] = useState<number>(
    () => Math.round(WeatherSystem.getInstance().getState().wetnessFactor * 10) / 10
  );
  const [cityEvent, setCityEvent] = useState<LivingCityEventState>(() => LivingCityEventSystem.getInstance().getState());
  const [quality, setQuality] = useState<QualitySettings>(() => QualityManager.current);

  useEffect(() => {
    let lastLightsOn = TimeSystem.getInstance().getState().streetLightsOn;
    let lastNightBucket = Math.round(TimeSystem.getInstance().getState().nightFactor * 5) / 5;
    let lastWetBucket = Math.round(WeatherSystem.getInstance().getState().wetnessFactor * 10) / 10;
    const uTime = TimeSystem.getInstance().subscribe((s) => {
      const nb = Math.round(s.nightFactor * 5) / 5;
      if (s.streetLightsOn !== lastLightsOn) {
        lastLightsOn = s.streetLightsOn;
        setStreetLightsOn(s.streetLightsOn);
      }
      if (nb !== lastNightBucket) {
        lastNightBucket = nb;
        setNightBucket(nb);
      }
    });
    const uWea = WeatherSystem.getInstance().subscribe((s) => {
      const bucket = Math.round(s.wetnessFactor * 10) / 10;
      if (bucket !== lastWetBucket) {
        lastWetBucket = bucket;
        setWetnessBucket(bucket);
      }
    });
    const uEvt = LivingCityEventSystem.getInstance().subscribe(setCityEvent);
    const uQual = QualityManager.subscribe(setQuality);
    return () => {
      uTime();
      uWea();
      uEvt();
      uQual();
    };
  }, []);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();
    if (astrolabeRef.current) {
      astrolabeRef.current.rotation.y += delta * 0.45;
      astrolabeRef.current.children.forEach((child, idx) => {
        if (idx > 0) {
          child.rotation.x += delta * (0.3 + idx * 0.15);
        }
      });
    }
    if (droneGroupRef.current) {
      droneGroupRef.current.children.forEach((drone, idx) => {
        const radius = 34 + idx * 18;
        const speed = (idx % 2 === 0 ? 1 : -1) * (0.18 + (idx % 4) * 0.04);
        const angle = t * speed + idx * 1.05;
        const nextAngle = angle + speed * 0.1;
        drone.position.set(
          Math.cos(angle) * radius,
          19 + (idx % 5) * 4 + Math.sin(t * 1.8 + idx) * 0.8,
          Math.sin(angle) * radius
        );
        drone.lookAt(
          Math.cos(nextAngle) * radius,
          drone.position.y,
          Math.sin(nextAngle) * radius
        );
      });
    }
  });

  const envScale =
    quality.reflectionQuality === 'HIGH'
      ? 1.55
      : quality.reflectionQuality === 'MEDIUM'
      ? 0.95
      : quality.reflectionQuality === 'LOW'
      ? 0.4
      : 0.0;

  const isUltra = quality.name === 'ULTRA';
  const showFineMolding = quality.LODQuality !== 'LOW';
  const effectiveWetness = quality.wetReflectionsEnabled ? wetnessBucket : 0;
  const roadRoughness = THREE.MathUtils.lerp(isUltra ? 0.28 : 0.38, 0.06, effectiveWetness);
  const roadMetalness = THREE.MathUtils.lerp(0.68, 0.92, effectiveWetness);
  const sidewalkRoughness = THREE.MathUtils.lerp(0.52, 0.16, effectiveWetness);
  const sidewalkMetalness = THREE.MathUtils.lerp(0.36, 0.68, effectiveWetness);
  const gridIsOut = cityEvent.type === 'POWER_OUTAGE' && cityEvent.phase === 'ACTIVE';
  const streetLightsActive = !gridIsOut && streetLightsOn && quality.nightLightsEnabled;

  const asphaltTex = useMemo(() => RoadGenerator.getAsphaltTexture(), []);
  const sidewalkTex = useMemo(() => RoadGenerator.getSidewalkTexture(), []);
  const facadeTextures = useMemo<Record<FacadeStyleVariant, THREE.CanvasTexture>>(
    () => ({
      CURTAIN_GLASS: ProceduralTextures.getBuildingFacadeTexture(0.64, 'CURTAIN_GLASS'),
      DIAGRID_HEX: ProceduralTextures.getBuildingFacadeTexture(0.66, 'DIAGRID_HEX'),
      BRUTALIST_RIBBED: ProceduralTextures.getBuildingFacadeTexture(0.58, 'BRUTALIST_RIBBED'),
      ARCOLOGY_TERRACE: ProceduralTextures.getBuildingFacadeTexture(0.68, 'ARCOLOGY_TERRACE'),
    }),
    []
  );
  const facadeEmissiveTextures = useMemo<Record<FacadeStyleVariant, THREE.CanvasTexture>>(
    () => ({
      CURTAIN_GLASS: ProceduralTextures.getBuildingEmissiveTexture(0.64, 'CURTAIN_GLASS'),
      DIAGRID_HEX: ProceduralTextures.getBuildingEmissiveTexture(0.66, 'DIAGRID_HEX'),
      BRUTALIST_RIBBED: ProceduralTextures.getBuildingEmissiveTexture(0.58, 'BRUTALIST_RIBBED'),
      ARCOLOGY_TERRACE: ProceduralTextures.getBuildingEmissiveTexture(0.68, 'ARCOLOGY_TERRACE'),
    }),
    []
  );
  const plazaTex = useMemo(() => ProceduralTextures.getPlazaGridTexture(), []);
  const asphaltNormal = useMemo(() => ProceduralTextures.getAsphaltNormalMap(), []);
  const puddleRoughness = useMemo(() => ProceduralTextures.getWetPuddleRoughnessMap(), []);
  const claddingNormal = useMemo(() => ProceduralTextures.getBuildingCladdingNormalMap(), []);
  const landmarkNames = useMemo(
    () => new Map(NavigationSystem.getInstance().landmarks.map((l) => [l.id, l.name])),
    []
  );

  // All central avenue intersections (excluding (0,0) plaza and (75,75) park) get clean junction pads sized to widened 22m/18m avenues
  const centralJunctions = useMemo(() => {
    const coords = [-165, -75, 0, 75, 165];
    const pts: [number, number, number, number][] = [];
    for (const jx of coords) {
      for (const jz of coords) {
        if (jx === 0 && jz === 0) continue;
        if (jx === 75 && jz === 75) continue;
        const w = jx === 0 ? 22.4 : 18.4;
        const d = jz === 0 ? 22.4 : 18.4;
        pts.push([jx, jz, w, d]);
      }
    }
    return pts;
  }, []);

  const facadeEmissiveIntensity = gridIsOut ? 0.03 : 0.1 + nightBucket * 1.75;
  const neonBloomBoost = gridIsOut ? 0.45 : Number((0.95 + nightBucket * 1.35).toFixed(2));
  const beaconBloomBoost = gridIsOut ? 0.5 : Number((1.2 + nightBucket * 1.65).toFixed(2));
  const podiumBaseMat = getDistrictStdMat('#0b1120', 0.88, 0.26);
  const canopyMat = getDistrictStdMat('#0f172a', 0.92, 0.2);
  const pierMat = getDistrictStdMat('#111827', 0.9, 0.22);
  const megacolMat = getDistrictStdMat('#0b1120', 0.92, 0.2);
  const finMat = getDistrictStdMat('#111c33', 0.9, 0.22);
  const beltMat = getDistrictStdMat('#0f172a', 0.92, 0.22);
  const parapetMat = getDistrictStdMat('#1e293b', 0.9, 0.18);
  const streetPoleMat = getDistrictStdMat('#1e293b', 0.88, 0.24);
  const streetArmMat = getDistrictStdMat('#0f172a', 0.9, 0.2);
  const bulbOffMat = getDistrictStdMat('#1e293b', 0.65, 0.42);
  const bulbOnMat = getDistrictBloomMat('#fde68a', 2.65);

  return (
    <group name="CityDistrictCentral">
      {/* Ground Substrate (cleanly below NS y=0.02 and EW y=0.045 avenues) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} receiveShadow={quality.shadows}>
        <planeGeometry args={[2800, 2800]} />
        <meshStandardMaterial color="#05080f" roughness={roadRoughness + 0.18} metalness={0.38} />
      </mesh>

      {/* Central Intersection & Civic Plaza Pad (25.6m × 25.6m covering widened 22m boulevards, cleanly below crosswalks 0.095) */}
      <mesh position={[0, 0.072, 0]} receiveShadow={quality.shadows}>
        <boxGeometry args={[25.6, 0.02, 25.6]} />
        <meshStandardMaterial
          map={plazaTex}
          normalMap={quality.normalMapsEnabled ? asphaltNormal : undefined}
          normalScale={PLAZA_NORMAL_SCALE}
          roughness={sidewalkRoughness * 0.75}
          metalness={sidewalkMetalness}
          envMapIntensity={envScale}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </mesh>

      {/* Central District Avenue Junction Pads covering every NS/EW crossing so lane stripes never Z-fight */}
      {centralJunctions.map(([jx, jz, jw, jd]) => (
        <mesh key={`junc-${jx}-${jz}`} position={[jx, 0.072, jz]} receiveShadow={quality.shadows}>
          <boxGeometry args={[jw, 0.02, jd]} />
          <meshStandardMaterial
            color="#090d16"
            normalMap={quality.normalMapsEnabled ? asphaltNormal : undefined}
            roughness={roadRoughness}
            metalness={roadMetalness}
            envMapIntensity={envScale * 0.7}
            polygonOffset
            polygonOffsetFactor={-1}
            polygonOffsetUnits={-1}
          />
        </mesh>
      ))}

      {/* Central Plaza Sunken Reflective Meridian Ring & Overhead Astrolabe */}
      <group name="CentralPlazaPavilion">
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.088, 0]}>
          <ringGeometry args={[6.2, 9.4, 48]} />
          <meshStandardMaterial
            color="#042f2e"
            emissive="#38bdf8"
            emissiveIntensity={gridIsOut ? 0.02 : 0.22 + nightBucket * 0.3}
            roughness={0.05}
            metalness={0.95}
            envMapIntensity={envScale * 1.4}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.094, 0]}>
          <ringGeometry args={[6.0, 6.2, 48]} />
          <meshBasicMaterial color="#f59e0b" polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-3} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.094, 0]}>
          <ringGeometry args={[9.4, 9.6, 48]} />
          <meshBasicMaterial color="#38bdf8" polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-3} />
        </mesh>

        {/* 4 Detailed Corner Architectural Obelisk Light Pylons on Plaza Sidewalk Corners (outside 22m roadways) */}
        {(
          [
            [-13.4, -13.4],
            [13.4, -13.4],
            [-13.4, 13.4],
            [13.4, 13.4],
          ] as const
        ).map(([px, pz], idx) => {
          const pylonAccent = idx % 2 === 0 ? '#f59e0b' : '#38bdf8';
          const pylonGlowMat = streetLightsActive ? getDistrictBloomMat(pylonAccent, neonBloomBoost) : bulbOffMat;
          return (
            <group key={`pylon-${idx}`} position={[px, 0, pz]}>
              {/* Stepped Granite Base Plinth */}
              <mesh position={[0, 0.24, 0]} geometry={SHARED_UNIT_BOX} material={CONCRETE_BASE_MAT} scale={[1.1, 0.48, 1.1]} receiveShadow={quality.shadows} />
              <mesh position={[0, 0.56, 0]} geometry={SHARED_UNIT_BOX} material={CHROME_TRIM_MAT} scale={[0.84, 0.16, 0.84]} />
              {/* Primary Fluted Dark Alloy Shaft */}
              <mesh
                position={[0, 2.85, 0]}
                geometry={SHARED_UNIT_BOX}
                material={megacolMat}
                scale={[0.48, 4.45, 0.48]}
                castShadow={quality.shadows}
              />
              {/* Twin Flanking Architectural Exoskeleton Fins */}
              <mesh position={[-0.32, 2.65, 0]} geometry={SHARED_UNIT_BOX} material={finMat} scale={[0.1, 4.1, 0.56]} />
              <mesh position={[0.32, 2.65, 0]} geometry={SHARED_UNIT_BOX} material={finMat} scale={[0.1, 4.1, 0.56]} />
              {/* Recessed Glowing Crystal Light Core */}
              <mesh position={[0, 2.85, 0]} geometry={SHARED_UNIT_BOX} material={pylonGlowMat} scale={[0.54, 3.85, 0.14]} />
              <mesh position={[0, 2.85, 0]} geometry={SHARED_UNIT_BOX} material={pylonGlowMat} scale={[0.14, 3.85, 0.54]} />
              {/* Cantilevered Crown Cap & Apex Beacon */}
              <mesh position={[0, 5.2, 0]} geometry={SHARED_UNIT_BOX} material={parapetMat} scale={[0.78, 0.22, 0.78]} />
              <mesh position={[0, 5.42, 0]} geometry={SHARED_UNIT_CYLINDER} material={pylonGlowMat} scale={[0.22, 0.24, 0.22]} />
            </group>
          );
        })}

        {/* Suspended Kinetic Meridian Astrolabe (High Overhead at y=13.5m) */}
        <group ref={astrolabeRef} position={[0, 13.5, 0]}>
          <mesh>
            <octahedronGeometry args={[1.1, 0]} />
            <meshBasicMaterial color="#f59e0b" wireframe toneMapped={false} />
          </mesh>
          <mesh material={getDistrictBloomMat('#38bdf8', neonBloomBoost)}>
            <torusGeometry args={[2.6, 0.05, 8, 48]} />
          </mesh>
          <mesh rotation={[Math.PI / 3, 0, 0]} material={getDistrictBloomMat('#f59e0b', neonBloomBoost)}>
            <torusGeometry args={[3.4, 0.04, 8, 48]} />
          </mesh>
        </group>
      </group>

      {/* Arterial Avenues */}
      {cityData.avenues.map((ave, idx) => (
        <mesh
          key={`ave-${idx}`}
          position={ave.position}
          rotation={[0, ave.rotationY, 0]}
          geometry={SHARED_UNIT_BOX}
          scale={[ave.size.x, ave.size.y, ave.size.z]}
          receiveShadow={quality.shadows}
        >
          <meshStandardMaterial
            map={asphaltTex}
            normalMap={quality.normalMapsEnabled ? asphaltNormal : undefined}
            normalScale={isUltra ? AVE_ULTRA_NORMAL_SCALE : AVE_NORMAL_SCALE}
            roughnessMap={
              quality.wetReflectionsEnabled &&
              quality.reflectionQuality !== 'OFF' &&
              (effectiveWetness > 0.05 || isUltra)
                ? puddleRoughness
                : undefined
            }
            roughness={roadRoughness}
            metalness={roadMetalness}
            envMapIntensity={effectiveWetness > 0.05 ? envScale : envScale * 0.65}
          />
        </mesh>
      ))}

      {/* Raised Sidewalks with Curb Trim */}
      {cityData.sidewalks.map((sw, idx) => (
        <group key={`sw-${idx}`} position={sw.position}>
          <mesh
            geometry={SHARED_UNIT_BOX}
            scale={[sw.size.x, sw.size.y, sw.size.z]}
            receiveShadow={quality.shadows}
            castShadow={quality.shadows}
          >
            <meshStandardMaterial
              map={sidewalkTex}
              normalMap={quality.normalMapsEnabled ? asphaltNormal : undefined}
              normalScale={SW_NORMAL_SCALE}
              roughness={sidewalkRoughness}
              metalness={sidewalkMetalness}
              envMapIntensity={envScale * 0.5}
            />
          </mesh>
          {/* Recessed neon curb edge strip (top sits below sidewalk top so only outer curb glows, zero surface Z-fighting) */}
          <mesh
            position={[0, sw.size.y / 2 - 0.055, 0]}
            geometry={SHARED_UNIT_BOX}
            material={
              streetLightsActive
                ? getDistrictBloomMat(idx % 2 === 0 ? '#38bdf8' : '#f59e0b', Math.min(1.9, neonBloomBoost * 0.85))
                : getDistrictBasicMat(idx % 2 === 0 ? '#38bdf8' : '#f59e0b')
            }
            scale={[sw.size.x + 0.08, 0.045, sw.size.z + 0.08]}
          />
        </group>
      ))}

      {/* Detailed Multi-Tier Architectural Monoliths */}
      {cityData.buildings.map((bldg) => {
        const bldgFacadeTex = facadeTextures[bldg.facadeVariant] || facadeTextures.CURTAIN_GLASS;
        const bldgEmissiveTex = facadeEmissiveTextures[bldg.facadeVariant] || facadeEmissiveTextures.CURTAIN_GLASS;
        const topTier = bldg.tiers[bldg.tiers.length - 1];
        const topW = topTier.size.x;
        const topD = topTier.size.z;
        const totalH = bldg.totalSize.y;
        const storefrontBasicMat = getDistrictBasicMat(gridIsOut ? '#1e293b' : bldg.storefrontColor);
        const secondaryBasicMat = getDistrictBasicMat(gridIsOut ? '#1e293b' : bldg.secondaryAccentColor);

        return (
          <group key={bldg.id} position={bldg.position} name={bldg.name}>
            {/* 1. Wrap-Around Street-Level Granite Podium & 4-Sided Colonnade Storefront Arcade */}
            <group name="StreetLevelPodium">
              {/* Podium Base Plinth */}
              <mesh
                position={[0, 2.8, 0]}
                geometry={SHARED_UNIT_BOX}
                material={podiumBaseMat}
                scale={[bldg.totalSize.x + 0.9, 5.6, bldg.totalSize.z + 0.9]}
                castShadow={quality.shadows}
                receiveShadow={quality.shadows}
              />

              {/* 4-Sided Illuminated Recessed Atrium Lobbies (staggered height to avoid coplanar overlap) */}
              <mesh
                position={[0, 2.5, 0]}
                geometry={SHARED_UNIT_BOX}
                scale={[bldg.totalSize.x * 0.78, 4.6, bldg.totalSize.z + 1.05]}
              >
                <meshStandardMaterial
                  color="#091326"
                  emissive={bldg.storefrontColor}
                  emissiveIntensity={gridIsOut ? 0.03 : 0.25 + nightBucket * 0.45}
                  metalness={0.92}
                  roughness={0.14}
                  envMapIntensity={envScale * 1.2}
                />
              </mesh>
              <mesh
                position={[0, 2.48, 0]}
                geometry={SHARED_UNIT_BOX}
                scale={[bldg.totalSize.x + 1.05, 4.52, bldg.totalSize.z * 0.78]}
              >
                <meshStandardMaterial
                  color="#091326"
                  emissive={bldg.secondaryAccentColor}
                  emissiveIntensity={gridIsOut ? 0.03 : 0.2 + nightBucket * 0.4}
                  metalness={0.92}
                  roughness={0.14}
                  envMapIntensity={envScale * 1.2}
                />
              </mesh>

              {/* 4-Sided Cantilevered Entrance Marquee Canopies & Under-Soffit Light Bars (staggered Y/height) */}
              <mesh
                position={[0, 5.36, 0]}
                geometry={SHARED_UNIT_BOX}
                material={canopyMat}
                scale={[bldg.totalSize.x + 2.4, 0.3, bldg.totalSize.z * 0.84]}
                castShadow={quality.shadows}
              />
              <mesh
                position={[0, 5.32, 0]}
                geometry={SHARED_UNIT_BOX}
                material={canopyMat}
                scale={[bldg.totalSize.x * 0.84, 0.24, bldg.totalSize.z + 2.4]}
                castShadow={quality.shadows}
              />
              <mesh
                position={[0, 5.16, 0]}
                geometry={SHARED_UNIT_BOX}
                material={storefrontBasicMat}
                scale={[bldg.totalSize.x + 2.5, 0.07, bldg.totalSize.z * 0.8]}
              />
              <mesh
                position={[0, 5.1, 0]}
                geometry={SHARED_UNIT_BOX}
                material={secondaryBasicMat}
                scale={[bldg.totalSize.x * 0.8, 0.06, bldg.totalSize.z + 2.5]}
              />

              {/* Perimeter Colonnade Structural Piers */}
              {showFineMolding &&
                ([-0.32, 0.32] as const).map((frac, pIdx) => (
                  <React.Fragment key={`pier-${pIdx}`}>
                    <mesh
                      position={[bldg.totalSize.x * frac, 2.7, bldg.totalSize.z / 2 + 0.55]}
                      geometry={SHARED_UNIT_BOX}
                      material={pierMat}
                      scale={[0.55, 5.4, 0.55]}
                    />
                    <mesh
                      position={[bldg.totalSize.x * frac, 2.7, -bldg.totalSize.z / 2 - 0.55]}
                      geometry={SHARED_UNIT_BOX}
                      material={pierMat}
                      scale={[0.55, 5.4, 0.55]}
                    />
                    <mesh
                      position={[bldg.totalSize.x / 2 + 0.55, 2.7, bldg.totalSize.z * frac]}
                      geometry={SHARED_UNIT_BOX}
                      material={pierMat}
                      scale={[0.55, 5.4, 0.55]}
                    />
                    <mesh
                      position={[-bldg.totalSize.x / 2 - 0.55, 2.7, bldg.totalSize.z * frac]}
                      geometry={SHARED_UNIT_BOX}
                      material={pierMat}
                      scale={[0.55, 5.4, 0.55]}
                    />
                  </React.Fragment>
                ))}
            </group>

            {/* 2. Stepped Architectural Tiers with Corner Exoskeletons, Brise-Soleil Fins & Belt Courses */}
            {bldg.tiers.map((tier, tIdx) => {
              const tw = tier.size.x;
              const th = tier.size.y;
              const td = tier.size.z;
              return (
                <group key={tIdx} position={tier.offset}>
                  {/* Primary Curtain-Wall Volume */}
                  <mesh
                    geometry={SHARED_UNIT_BOX}
                    scale={[tw, th, td]}
                    castShadow={quality.shadows}
                    receiveShadow={quality.shadows}
                  >
                    <meshStandardMaterial
                      map={bldgFacadeTex}
                      emissive="#ffffff"
                      emissiveMap={bldgEmissiveTex}
                      emissiveIntensity={facadeEmissiveIntensity}
                      normalMap={quality.normalMapsEnabled ? claddingNormal : undefined}
                      normalScale={isUltra ? BLDG_ULTRA_NORMAL_SCALE : BLDG_NORMAL_SCALE}
                      roughness={isUltra ? 0.22 : 0.3}
                      metalness={0.86}
                      envMapIntensity={envScale}
                    />
                  </mesh>

                  {/* 4 Heavy Corner Megacolumns */}
                  {(
                    [
                      [-1, -1],
                      [1, -1],
                      [-1, 1],
                      [1, 1],
                    ] as const
                  ).map(([cx, cz], cIdx) => (
                    <mesh
                      key={`col-${cIdx}`}
                      position={[(cx * tw) / 2, 0, (cz * td) / 2]}
                      geometry={SHARED_UNIT_BOX}
                      material={megacolMat}
                      scale={[0.85, th + 0.2, 0.85]}
                      castShadow={quality.shadows && isUltra}
                    />
                  ))}

                  {/* Vertical Architectural Brise-Soleil Mullion Fins & Belt Courses (staggered height to prevent Z-fighting) */}
                  {showFineMolding && (
                    <>
                      {([-0.26, 0, 0.26] as const).map((frac, fIdx) => (
                        <React.Fragment key={`fin-${fIdx}`}>
                          <mesh
                            position={[tw * frac, 0, 0]}
                            geometry={SHARED_UNIT_BOX}
                            material={finMat}
                            scale={[0.32, th * 0.96, td + 0.42]}
                          />
                          <mesh
                            position={[0, 0, td * frac]}
                            geometry={SHARED_UNIT_BOX}
                            material={finMat}
                            scale={[tw + 0.42, th * 0.94, 0.32]}
                          />
                        </React.Fragment>
                      ))}

                      {([-0.25, 0.25] as const).map((yFrac, bIdx) => (
                        <mesh
                          key={`belt-${bIdx}`}
                          position={[0, th * yFrac, 0]}
                          geometry={SHARED_UNIT_BOX}
                          material={beltMat}
                          scale={[tw + 0.52, 0.55, td + 0.52]}
                        />
                      ))}
                    </>
                  )}

                  {/* Tier Setback Terrace Glass Parapet & Planter Rim */}
                  <mesh
                    position={[0, th / 2 + 0.45, 0]}
                    geometry={SHARED_UNIT_BOX}
                    material={parapetMat}
                    scale={[tw + 0.24, 0.85, td + 0.24]}
                  />
                </group>
              );
            })}

            {/* 3. Recessed Illuminated Sky-Lobby Mezzanines Between Tiers */}
            {bldg.skyLobbyFloors.map((sl, slIdx) => (
              <group key={`skylobby-${slIdx}`} position={[0, sl.y, 0]}>
                <mesh geometry={SHARED_UNIT_BOX} scale={[sl.width, sl.height, sl.depth]}>
                  <meshStandardMaterial
                    color="#0f172a"
                    emissive={slIdx % 2 === 0 ? bldg.storefrontColor : bldg.secondaryAccentColor}
                    emissiveIntensity={gridIsOut ? 0.04 : 0.25 + nightBucket * 1.45}
                    metalness={0.85}
                    roughness={0.15}
                  />
                </mesh>
              </group>
            ))}

            {/* 4. Sculpted Architectural Skyscraper Crown */}
            <group position={[0, totalH, 0]} name="BuildingCrown">
              {bldg.crownType === 'PYRAMID_LANTERN' && (
                <group>
                  <mesh position={[0, 1.8, 0]} geometry={SHARED_UNIT_BOX} scale={[topW * 0.72, 3.4, topD * 0.72]}>
                    <meshStandardMaterial
                      color="#0b1326"
                      emissive={bldg.storefrontColor}
                      emissiveIntensity={gridIsOut ? 0.04 : 0.22 + nightBucket * 1.4}
                      metalness={0.92}
                      roughness={0.15}
                    />
                  </mesh>
                  <mesh position={[0, 4.2, 0]} geometry={SHARED_UNIT_BOX} scale={[topW * 0.44, 2.2, topD * 0.44]}>
                    <meshStandardMaterial
                      color="#0f172a"
                      emissive={bldg.secondaryAccentColor}
                      emissiveIntensity={gridIsOut ? 0.04 : 0.28 + nightBucket * 1.65}
                      metalness={0.92}
                      roughness={0.12}
                    />
                  </mesh>
                </group>
              )}

              {bldg.crownType === 'TWIN_FIN_CREST' && (
                <group>
                  {([-1, 1] as const).map((side) => (
                    <mesh
                      key={side}
                      position={[(side * topW) / 2, 2.6, 0]}
                      geometry={SHARED_UNIT_BOX}
                      scale={[0.65, 5.2, topD * 0.86]}
                    >
                      <meshStandardMaterial color="#0f172a" metalness={0.92} roughness={0.18} />
                    </mesh>
                  ))}
                  <mesh
                    position={[0, 4.4, 0]}
                    geometry={SHARED_UNIT_BOX}
                    material={gridIsOut ? bulbOffMat : getDistrictBloomMat(bldg.storefrontColor, neonBloomBoost)}
                    scale={[topW, 0.35, topD * 0.5]}
                  />
                </group>
              )}

              {bldg.crownType === 'HALO_RING_CROWN' && (
                <group position={[0, 2.8, 0]}>
                  <mesh
                    rotation={[Math.PI / 2, 0, 0]}
                    material={gridIsOut ? bulbOffMat : getDistrictBloomMat(bldg.storefrontColor, neonBloomBoost)}
                  >
                    <torusGeometry args={[Math.min(topW, topD) * 0.42, 0.28, 10, 32]} />
                  </mesh>
                  <mesh position={[0, -1.4, 0]} geometry={SHARED_UNIT_CYLINDER} scale={[2.2, 2.8, 2.2]}>
                    <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.2} />
                  </mesh>
                </group>
              )}

              {bldg.crownType === 'SLANTED_BLADE' && (
                <group>
                  <mesh position={[0, 2.2, 0]} geometry={SHARED_UNIT_BOX} scale={[topW * 0.82, 4.2, topD * 0.82]}>
                    <meshStandardMaterial color="#0b1120" metalness={0.92} roughness={0.2} />
                  </mesh>
                  <mesh
                    position={[0, 4.4, 0]}
                    geometry={SHARED_UNIT_BOX}
                    material={gridIsOut ? bulbOffMat : getDistrictBloomMat(bldg.secondaryAccentColor, neonBloomBoost)}
                    scale={[topW * 0.86, 0.32, topD * 0.86]}
                  />
                </group>
              )}
            </group>

            {/* 5. Vertical & Horizontal Emissive Neon Light Strips */}
            {bldg.lightStrips.map((strip, sIdx) => (
              <mesh
                key={sIdx}
                position={strip.position}
                geometry={SHARED_UNIT_BOX}
                material={gridIsOut ? bulbOffMat : getDistrictBloomMat(strip.color, neonBloomBoost)}
                scale={[strip.size.x, strip.size.y, strip.size.z]}
              />
            ))}

            {/* 6. Detailed Rooftop Mechanical & Communications Complex */}
            {bldg.rooftopEquipment.map((eq, eIdx) => (
              <group key={eIdx} position={eq.position}>
                {eq.type === 'ANTENNA' ? (
                  <group>
                    {/* Lower Structural Lattice Base */}
                    <mesh position={[0, -eq.size.y * 0.25, 0]} geometry={SHARED_UNIT_CYLINDER} scale={[0.75, eq.size.y * 0.5, 0.75]}>
                      <meshStandardMaterial color="#1e293b" metalness={0.92} roughness={0.2} />
                    </mesh>
                    {/* Upper Tapered Mast */}
                    <mesh>
                      <cylinderGeometry args={[0.07, 0.28, eq.size.y, 8]} />
                      <meshStandardMaterial color="#475569" metalness={0.92} roughness={0.18} />
                    </mesh>
                    {/* Telemetry Cross-Arms */}
                    <mesh position={[0, eq.size.y * 0.15, 0]} geometry={SHARED_UNIT_BOX} scale={[2.2, 0.08, 0.08]}>
                      <meshStandardMaterial color="#334155" metalness={0.9} />
                    </mesh>
                    {/* Dual Aviation Warning Beacons */}
                    <mesh position={[0, eq.size.y / 2, 0]} material={getDistrictBloomMat('#f59e0b', beaconBloomBoost)}>
                      <sphereGeometry args={[0.34, 8, 8]} />
                    </mesh>
                    <mesh position={[0, eq.size.y * 0.18, 0]} material={getDistrictBloomMat('#f43f5e', beaconBloomBoost)}>
                      <sphereGeometry args={[0.22, 8, 8]} />
                    </mesh>
                  </group>
                ) : eq.type === 'HELIPAD' ? (
                  <group>
                    {/* Raised Landing Deck with Perimeter Apron */}
                    <mesh geometry={SHARED_UNIT_BOX} material={canopyMat} scale={[eq.size.x, eq.size.y, eq.size.z]} />
                    <mesh position={[0, -eq.size.y * 0.45, 0]} geometry={SHARED_UNIT_BOX} material={parapetMat} scale={[eq.size.x + 0.5, 0.18, eq.size.z + 0.5]} />
                    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, eq.size.y / 2 + 0.02, 0]}>
                      <ringGeometry args={[eq.size.x * 0.34, eq.size.x * 0.4, 24]} />
                      <meshBasicMaterial color="#38bdf8" />
                    </mesh>
                    {/* Crisp Center "H" Landing Emblem */}
                    <mesh position={[-eq.size.x * 0.12, eq.size.y / 2 + 0.025, 0]} geometry={SHARED_UNIT_BOX} material={getDistrictBasicMat('#f59e0b')} scale={[0.24, 0.03, eq.size.z * 0.36]} />
                    <mesh position={[eq.size.x * 0.12, eq.size.y / 2 + 0.025, 0]} geometry={SHARED_UNIT_BOX} material={getDistrictBasicMat('#f59e0b')} scale={[0.24, 0.03, eq.size.z * 0.36]} />
                    <mesh position={[0, eq.size.y / 2 + 0.025, 0]} geometry={SHARED_UNIT_BOX} material={getDistrictBasicMat('#f59e0b')} scale={[eq.size.x * 0.26, 0.03, 0.24]} />
                  </group>
                ) : eq.type === 'COOLING_TOWER' ? (
                  <group>
                    {/* Steel Skid Base */}
                    <mesh position={[0, -eq.size.y * 0.46, 0]} geometry={SHARED_UNIT_BOX} material={podiumBaseMat} scale={[eq.size.x * 1.12, 0.28, eq.size.z * 1.12]} />
                    {/* Cylindrical Cooling Shroud */}
                    <mesh geometry={SHARED_UNIT_CYLINDER} material={streetPoleMat} scale={[eq.size.x, eq.size.y, eq.size.z]} />
                    {/* 4 Vertical Structural Stiffener Ribs */}
                    <mesh geometry={SHARED_UNIT_BOX} material={streetArmMat} scale={[eq.size.x * 1.06, eq.size.y * 0.88, 0.18]} />
                    <mesh geometry={SHARED_UNIT_BOX} material={streetArmMat} scale={[0.18, eq.size.y * 0.88, eq.size.z * 1.06]} />
                    {/* Upper Exhaust Fan Cowl & Glowing Intake Ring */}
                    <mesh position={[0, eq.size.y * 0.48, 0]} geometry={SHARED_UNIT_CYLINDER} material={CHROME_TRIM_MAT} scale={[eq.size.x * 0.82, 0.26, eq.size.z * 0.82]} />
                    <mesh position={[0, eq.size.y / 2 + 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                      <ringGeometry args={[eq.size.x * 0.25, eq.size.x * 0.44, 16]} />
                      <meshBasicMaterial color="#38bdf8" />
                    </mesh>
                  </group>
                ) : eq.type === 'DISH' ? (
                  <group>
                    <mesh position={[0, -0.58, 0]} geometry={SHARED_UNIT_BOX} material={podiumBaseMat} scale={[0.95, 0.22, 0.95]} />
                    <mesh position={[0, -0.15, 0]} geometry={SHARED_UNIT_CYLINDER} material={streetPoleMat} scale={[0.32, 0.95, 0.32]} />
                    <mesh position={[0, 0.35, 0]} rotation={[0.55, 0.4, 0]}>
                      <coneGeometry args={[1.0, 0.55, 14, 1, true]} />
                      <meshStandardMaterial color="#e2e8f0" metalness={0.85} roughness={0.2} side={THREE.DoubleSide} />
                    </mesh>
                    {/* Parabolic Feedhorn Stalk & Tip */}
                    <mesh position={[0.18, 0.65, 0.26]} rotation={[0.55, 0.4, 0]} geometry={SHARED_UNIT_CYLINDER} material={CHROME_TRIM_MAT} scale={[0.08, 0.65, 0.08]} />
                  </group>
                ) : eq.type === 'SOLAR_ARRAY' ? (
                  <group>
                    {/* Steel Support Frame Struts */}
                    <mesh position={[-eq.size.x * 0.32, -eq.size.y * 0.15, 0]} geometry={SHARED_UNIT_BOX} material={streetArmMat} scale={[0.14, eq.size.y * 0.85, eq.size.z * 0.8]} />
                    <mesh position={[eq.size.x * 0.32, -eq.size.y * 0.15, 0]} geometry={SHARED_UNIT_BOX} material={streetArmMat} scale={[0.14, eq.size.y * 0.85, eq.size.z * 0.8]} />
                    {/* Tilted Photovoltaic Glass Array Panel & Metallic Grid Frame */}
                    <group position={[0, eq.size.y * 0.2, 0]} rotation={[0.36, 0, 0]}>
                      <mesh geometry={SHARED_UNIT_BOX} material={CHROME_TRIM_MAT} scale={[eq.size.x, 0.1, eq.size.z]} />
                      <mesh position={[0, 0.055, 0]} geometry={SHARED_UNIT_BOX} material={SOLAR_CELL_MAT} scale={[eq.size.x * 0.92, 0.04, eq.size.z * 0.92]} />
                      <mesh position={[0, 0.08, 0]} geometry={SHARED_UNIT_BOX} material={getDistrictBasicMat('#38bdf8')} scale={[eq.size.x * 0.9, 0.018, 0.06]} />
                    </group>
                  </group>
                ) : (
                  <group>
                    {/* Detailed HVAC Chiller Manifold Unit */}
                    <mesh position={[0, -eq.size.y * 0.44, 0]} geometry={SHARED_UNIT_BOX} material={podiumBaseMat} scale={[eq.size.x * 1.08, 0.22, eq.size.z * 1.08]} />
                    <mesh geometry={SHARED_UNIT_BOX} material={streetPoleMat} scale={[eq.size.x, eq.size.y, eq.size.z]} />
                    {/* Louvered Side Grille Band */}
                    <mesh position={[0, 0, 0]} geometry={SHARED_UNIT_BOX} material={streetArmMat} scale={[eq.size.x + 0.08, eq.size.y * 0.42, eq.size.z * 0.82]} />
                    {/* Twin Top Exhaust Fan Cowls */}
                    <mesh position={[-eq.size.x * 0.24, eq.size.y / 2 + 0.14, 0]} geometry={SHARED_UNIT_CYLINDER} material={CHROME_TRIM_MAT} scale={[eq.size.x * 0.34, 0.24, eq.size.x * 0.34]} />
                    <mesh position={[eq.size.x * 0.24, eq.size.y / 2 + 0.14, 0]} geometry={SHARED_UNIT_CYLINDER} material={CHROME_TRIM_MAT} scale={[eq.size.x * 0.34, 0.24, eq.size.x * 0.34]} />
                    {/* Coolant Conduit Header */}
                    <mesh position={[0, eq.size.y / 2 + 0.04, eq.size.z * 0.36]} geometry={SHARED_UNIT_BOX} material={getDistrictBasicMat('#38bdf8')} scale={[eq.size.x * 0.82, 0.05, 0.1]} />
                  </group>
                )}
              </group>
            ))}
          </group>
        );
      })}

      {/* Detailed Elevated Glazed Skybridges with Structural Ribs & Under-Deck Box Girder */}
      {quality.streetFurnitureEnabled &&
        cityData.skybridges.map((sb) => {
          const bridgeGlowMat = gridIsOut ? bulbOffMat : getDistrictBloomMat(sb.accentColor, neonBloomBoost);
          return (
            <group key={sb.id} position={sb.position} rotation={[0, sb.rotationY, 0]}>
              {/* Glazed Corridor Tube */}
              <mesh geometry={SHARED_UNIT_BOX} scale={[sb.size.x, sb.size.y, sb.size.z]} castShadow={quality.shadows}>
                <meshStandardMaterial
                  color="#0f172a"
                  metalness={0.9}
                  roughness={0.14}
                  transparent
                  opacity={0.82}
                  envMapIntensity={envScale}
                />
              </mesh>
              {/* Under-Deck Box Girder & Structural Spine */}
              <mesh position={[0, -sb.size.y / 2 - 0.16, 0]} geometry={SHARED_UNIT_BOX} material={podiumBaseMat} scale={[sb.size.x, 0.32, sb.size.z + 0.45]} />
              <mesh position={[0, -sb.size.y / 2 - 0.4, 0]} geometry={SHARED_UNIT_BOX} material={streetArmMat} scale={[sb.size.x * 0.94, 0.22, sb.size.z * 0.55]} />
              {/* Roof Crown Coping */}
              <mesh position={[0, sb.size.y / 2 + 0.12, 0]} geometry={SHARED_UNIT_BOX} material={parapetMat} scale={[sb.size.x, 0.2, sb.size.z + 0.32]} />
              {/* Rhythmic Exterior Structural Portal Ribs */}
              {([-0.36, -0.18, 0, 0.18, 0.36] as const).map((frac, rIdx) => (
                <mesh
                  key={`rib-${rIdx}`}
                  position={[sb.size.x * frac, 0, 0]}
                  geometry={SHARED_UNIT_BOX}
                  material={finMat}
                  scale={[0.38, sb.size.y + 0.55, sb.size.z + 0.52]}
                />
              ))}
              {/* Dual HDR Accent Light Strips */}
              <mesh position={[0, -sb.size.y / 2 - 0.32, 0]} geometry={SHARED_UNIT_BOX} material={bridgeGlowMat} scale={[sb.size.x * 0.94, 0.07, sb.size.z + 0.48]} />
              <mesh position={[0, sb.size.y / 2 + 0.24, 0]} geometry={SHARED_UNIT_BOX} material={bridgeGlowMat} scale={[sb.size.x * 0.94, 0.06, sb.size.z + 0.18]} />
            </group>
          );
        })}

      {/* Detailed Composite Streetscape Props (Transit Shelters, Cyber Kiosks, Benches, Bollards, Steam Grates) */}
      {quality.streetFurnitureEnabled &&
        cityData.streetProps.map((prop) => {
          const propGlowMat = streetLightsActive ? getDistrictBloomMat(prop.accentColor, neonBloomBoost) : bulbOffMat;
          return (
            <group key={prop.id} position={prop.position} rotation={[0, prop.rotationY, 0]}>
              {prop.type === 'TRANSIT_SHELTER' && (
                <group>
                  {/* Raised Shelter Curb Platform */}
                  <mesh position={[0, 0.06, 0]} geometry={SHARED_UNIT_BOX} material={CONCRETE_BASE_MAT} scale={[4.4, 0.12, 2.0]} receiveShadow={quality.shadows} />
                  {/* 4 Rear Steel Mullion Columns */}
                  {([-1.85, -0.62, 0.62, 1.85] as const).map((mx, mIdx) => (
                    <mesh key={mIdx} position={[mx, 1.42, -0.82]} geometry={SHARED_UNIT_BOX} material={streetArmMat} scale={[0.12, 2.65, 0.14]} castShadow={quality.shadows} />
                  ))}
                  {/* Tinted Glass Back Windscreen & Left Side Windscreen */}
                  <mesh position={[0, 1.42, -0.82]} geometry={SHARED_UNIT_BOX} material={GLASS_WINDSCREEN_MAT} scale={[3.62, 2.38, 0.05]} />
                  <mesh position={[-1.85, 1.42, -0.1]} geometry={SHARED_UNIT_BOX} material={GLASS_WINDSCREEN_MAT} scale={[0.05, 2.38, 1.42]} />
                  <mesh position={[-1.85, 1.42, 0.62]} geometry={SHARED_UNIT_BOX} material={streetArmMat} scale={[0.1, 2.65, 0.1]} />
                  {/* Cantilevered Ribbed Canopy Roof & Fascia */}
                  <mesh position={[0, 2.78, 0.04]} geometry={SHARED_UNIT_BOX} material={parapetMat} scale={[4.5, 0.18, 2.05]} castShadow={quality.shadows} />
                  <mesh position={[0, 2.9, 0.04]} geometry={SHARED_UNIT_BOX} material={streetArmMat} scale={[4.2, 0.08, 1.6]} />
                  <mesh position={[0, 2.68, 0.98]} geometry={SHARED_UNIT_BOX} material={propGlowMat} scale={[4.2, 0.055, 0.1]} />
                  {/* Integrated Timber-Slat Passenger Bench */}
                  <mesh position={[-0.35, 0.46, -0.34]} geometry={SHARED_UNIT_BOX} material={TIMBER_SLAT_MAT} scale={[2.35, 0.08, 0.48]} />
                  <mesh position={[-1.25, 0.25, -0.34]} geometry={SHARED_UNIT_BOX} material={streetArmMat} scale={[0.1, 0.42, 0.46]} />
                  <mesh position={[0.55, 0.25, -0.34]} geometry={SHARED_UNIT_BOX} material={streetArmMat} scale={[0.1, 0.42, 0.46]} />
                  {/* Right-Side Illuminated Transit Route Totem */}
                  <mesh position={[1.85, 1.38, 0.12]} geometry={SHARED_UNIT_BOX} material={podiumBaseMat} scale={[0.24, 2.52, 0.78]} />
                  <mesh position={[1.98, 1.5, 0.12]} geometry={SHARED_UNIT_BOX} material={propGlowMat} scale={[0.03, 1.55, 0.56]} />
                </group>
              )}
              {prop.type === 'CYBER_KIOSK' && (
                <group>
                  {/* Stepped Granite Pedestal */}
                  <mesh position={[0, 0.14, 0]} geometry={SHARED_UNIT_BOX} material={CONCRETE_BASE_MAT} scale={[1.15, 0.28, 0.68]} receiveShadow={quality.shadows} />
                  {/* Beveled Dark Alloy Monolith Chassis */}
                  <mesh position={[0, 1.42, 0]} geometry={SHARED_UNIT_BOX} material={podiumBaseMat} scale={[0.92, 2.32, 0.42]} castShadow={quality.shadows} />
                  {/* Brushed Side Bezel Trim Pillars */}
                  <mesh position={[-0.47, 1.42, 0.04]} geometry={SHARED_UNIT_BOX} material={CHROME_TRIM_MAT} scale={[0.06, 2.25, 0.44]} />
                  <mesh position={[0.47, 1.42, 0.04]} geometry={SHARED_UNIT_BOX} material={CHROME_TRIM_MAT} scale={[0.06, 2.25, 0.44]} />
                  {/* Recessed Interactive Display Screen & Angled Tactile Console */}
                  <mesh position={[0, 1.62, 0.22]} geometry={SHARED_UNIT_BOX} material={getDistrictBloomMat(prop.accentColor, neonBloomBoost)} scale={[0.72, 1.25, 0.03]} />
                  <mesh position={[0, 0.88, 0.28]} rotation={[0.42, 0, 0]} geometry={SHARED_UNIT_BOX} material={parapetMat} scale={[0.76, 0.08, 0.3]} />
                  {/* Overhead Rain Visor Hood & Roof Telemetry Beacon */}
                  <mesh position={[0, 2.56, 0.14]} geometry={SHARED_UNIT_BOX} material={streetArmMat} scale={[1.04, 0.12, 0.72]} />
                  <mesh position={[0, 2.66, 0.06]} geometry={SHARED_UNIT_BOX} material={getDistrictBloomMat('#f59e0b', neonBloomBoost)} scale={[0.92, 0.07, 0.48]} />
                  {/* Micro Telemetry Antenna Whip */}
                  <mesh position={[0.32, 2.95, -0.08]} geometry={SHARED_UNIT_CYLINDER} material={CHROME_TRIM_MAT} scale={[0.03, 0.56, 0.03]} />
                </group>
              )}
              {prop.type === 'BENCH' && (
                <group>
                  {/* 3 Sculpted Cast-Iron Support Frames & Armrests */}
                  {([-0.92, 0, 0.92] as const).map((lx, lIdx) => (
                    <group key={lIdx} position={[lx, 0, 0]}>
                      <mesh position={[0, 0.23, 0]} geometry={SHARED_UNIT_BOX} material={streetArmMat} scale={[0.08, 0.46, 0.58]} />
                      {lIdx !== 1 && (
                        <mesh position={[0, 0.56, -0.02]} geometry={SHARED_UNIT_BOX} material={CHROME_TRIM_MAT} scale={[0.07, 0.06, 0.56]} />
                      )}
                    </group>
                  ))}
                  {/* 3 Warm Timber Seat Slats */}
                  {([-0.18, 0, 0.18] as const).map((sz, sIdx) => (
                    <mesh key={sIdx} position={[0, 0.45, sz]} geometry={SHARED_UNIT_BOX} material={TIMBER_SLAT_MAT} scale={[2.24, 0.06, 0.14]} />
                  ))}
                  {/* Angled Dual-Slat Backrest & Rear Stanchions */}
                  <mesh position={[-0.92, 0.68, -0.28]} rotation={[-0.18, 0, 0]} geometry={SHARED_UNIT_BOX} material={streetArmMat} scale={[0.07, 0.52, 0.07]} />
                  <mesh position={[0.92, 0.68, -0.28]} rotation={[-0.18, 0, 0]} geometry={SHARED_UNIT_BOX} material={streetArmMat} scale={[0.07, 0.52, 0.07]} />
                  <mesh position={[0, 0.68, -0.26]} rotation={[-0.18, 0, 0]} geometry={SHARED_UNIT_BOX} material={TIMBER_SLAT_MAT} scale={[2.22, 0.14, 0.06]} />
                  <mesh position={[0, 0.86, -0.3]} rotation={[-0.18, 0, 0]} geometry={SHARED_UNIT_BOX} material={TIMBER_SLAT_MAT} scale={[2.22, 0.14, 0.06]} />
                  {/* Recessed Under-Seat HDR Glow Strip */}
                  <mesh position={[0, 0.16, 0]} geometry={SHARED_UNIT_BOX} material={propGlowMat} scale={[1.76, 0.04, 0.34]} />
                </group>
              )}
              {prop.type === 'BOLLARD_CLUSTER' && (
                <group>
                  {([-1.25, 0, 1.25] as const).map((bx, bIdx) => (
                    <group key={bIdx} position={[bx, 0, 0]}>
                      {/* Bolted Base Flange */}
                      <mesh position={[0, 0.05, 0]} geometry={SHARED_UNIT_CYLINDER} material={CHROME_TRIM_MAT} scale={[0.34, 0.1, 0.34]} />
                      {/* Cylindrical Bollard Core */}
                      <mesh position={[0, 0.52, 0]} geometry={SHARED_UNIT_CYLINDER} material={streetArmMat} scale={[0.24, 0.88, 0.24]} castShadow={quality.shadows} />
                      {/* Brushed Collar Ring */}
                      <mesh position={[0, 0.72, 0]} geometry={SHARED_UNIT_CYLINDER} material={CHROME_TRIM_MAT} scale={[0.26, 0.06, 0.26]} />
                      {/* Illuminated Perimeter Light Ring */}
                      <mesh position={[0, 0.88, 0]} geometry={SHARED_UNIT_CYLINDER} material={propGlowMat} scale={[0.25, 0.09, 0.25]} />
                      {/* Beveled Domed Crown Cap */}
                      <mesh position={[0, 0.99, 0]} geometry={SHARED_BOLLARD_CAP} material={parapetMat} scale={[0.92, 0.1, 0.92]} />
                    </group>
                  ))}
                </group>
              )}
              {prop.type === 'STEAM_GRATE' && (
                <group>
                  {/* Steel Perimeter Curb Frame */}
                  <mesh rotation={[-Math.PI / 2, 0, 0]} geometry={SHARED_STEAM_PLANE} material={streetArmMat} />
                  {/* 5 Raised Cast-Iron Grate Ribs */}
                  {([-0.68, -0.34, 0, 0.34, 0.68] as const).map((gx, gIdx) => (
                    <mesh key={gIdx} position={[gx, 0.02, 0]} geometry={SHARED_UNIT_BOX} material={CHROME_TRIM_MAT} scale={[0.08, 0.04, 1.02]} />
                  ))}
                  {/* Translucent Steam Plume */}
                  <mesh position={[0, 1.2, 0]} geometry={SHARED_STEAM_CONE}>
                    <meshBasicMaterial
                      color={prop.accentColor}
                      transparent
                      opacity={0.09}
                      depthWrite={false}
                      side={THREE.DoubleSide}
                    />
                  </mesh>
                </group>
              )}
            </group>
          );
        })}

      {/* Detailed Architectural Street Luminaires — Turn ON at Night & OFF during Day */}
      {cityData.streetlights.map((sl, idx) => (
        <group key={idx} position={sl.position} rotation={[0, sl.rotationY, 0]}>
          {/* Octagonal Cast-Iron Plinth Base */}
          <mesh position={[0, 0.28, 0]} geometry={SHARED_OCT_PLINTH} material={streetArmMat} scale={[1, 0.56, 1]} />
          {/* Brushed Bolted Base Collar */}
          <mesh position={[0, 0.62, 0]} geometry={SHARED_UNIT_CYLINDER} material={CHROME_TRIM_MAT} scale={[0.42, 0.12, 0.42]} />
          {/* Tapered Architectural Luminaire Pole */}
          <mesh position={[0, 3.45, 0]} geometry={SHARED_TAPER_POLE} material={streetPoleMat} scale={[1, 5.7, 1]} />
          {/* Mid-Height Telemetry & Sensor Control Box */}
          <mesh position={[-0.18, 2.35, 0]} geometry={SHARED_UNIT_BOX} material={streetArmMat} scale={[0.24, 0.55, 0.28]} />
          {/* Diagonal Support Gusset Bracket */}
          <mesh position={[0.42, 5.82, 0]} rotation={[0, 0, -0.68]} geometry={SHARED_UNIT_BOX} material={CHROME_TRIM_MAT} scale={[0.07, 1.05, 0.08]} />
          {/* Cantilevered Mast Arm */}
          <mesh position={[0.98, 6.26, 0]} geometry={SHARED_UNIT_BOX} material={streetArmMat} scale={[2.0, 0.13, 0.2]} />
          {/* Aerodynamic Luminaire Cowl Housing & Heat-Sink Crest */}
          <mesh position={[1.65, 6.22, 0]} geometry={SHARED_UNIT_BOX} material={parapetMat} scale={[0.96, 0.16, 0.44]} />
          <mesh position={[1.65, 6.33, 0]} geometry={SHARED_UNIT_BOX} material={CHROME_TRIM_MAT} scale={[0.64, 0.05, 0.26]} />
          {/* Warm HDR LED Diffuser Panel */}
          <mesh
            position={[1.65, 6.12, 0]}
            geometry={SHARED_UNIT_BOX}
            material={streetLightsActive ? bulbOnMat : bulbOffMat}
            scale={[0.82, 0.05, 0.34]}
          />
        </group>
      ))}

      {/* Avenue Trees */}
      {quality.vegetationEnabled &&
        trees.map((tree) => <ProceduralTree key={tree.id} tree={tree} registerGlobalCollider />)}

      {/* Broadcast Matrices across Central & Outer Avenue Intersections */}
      {quality.billboardsEnabled && (
        <>
          <CyberVideoBillboard position={[0, 18, -28]} rotationY={0} width={22} height={13} channel={1} />
          <CyberVideoBillboard position={[22, 18, 0]} rotationY={-Math.PI / 2} width={20} height={12} channel={2} />
          <CyberVideoBillboard position={[-22, 18, 0]} rotationY={Math.PI / 2} width={20} height={12} channel={3} />
          <CyberVideoBillboard position={[0, 18, 32]} rotationY={Math.PI} width={22} height={13} channel={1} />
          <CyberVideoBillboard position={[0, 19, -98]} rotationY={0} width={22} height={13} channel={2} />
          <CyberVideoBillboard position={[0, 19, 98]} rotationY={Math.PI} width={22} height={13} channel={3} />
          <CyberVideoBillboard position={[-98, 19, 0]} rotationY={Math.PI / 2} width={20} height={12} channel={1} />
          <CyberVideoBillboard position={[98, 19, 0]} rotationY={-Math.PI / 2} width={20} height={12} channel={2} />
        </>
      )}

      {/* Wayfinding Signage across Central & Outer Sectors (cleared outside widened 22m boulevards) */}
      <StreetSign position={[0, 4.25, -14.2]} rotationY={Math.PI} label={landmarkNames.get('central_plaza') ?? 'Central Plaza Hub'} direction="S" />
      <StreetSign position={[0, 4.25, -62]} rotationY={Math.PI} label={landmarkNames.get('north_crossway') ?? 'North Crossing Avenue'} direction="N" accent="#38bdf8" />
      <StreetSign position={[28, 4.25, 28]} rotationY={Math.PI / 2} label={landmarkNames.get('apex_tower') ?? 'Apex Monolith Tower'} direction="E" accent="#f59e0b" />
      <StreetSign position={[62, 4.25, 62]} rotationY={-Math.PI / 2} label={landmarkNames.get('park_sanctuary') ?? 'Central Park Sanctuary'} direction="E" accent="#10b981" />
      <StreetSign position={[0, 4.25, 62]} rotationY={0} label={landmarkNames.get('south_crossway') ?? 'South Crossing Avenue'} direction="S" accent="#38bdf8" />
      <StreetSign position={[-62, 4.25, -14.2]} rotationY={Math.PI / 2} label="Neural Quantum Sector" direction="W" accent="#4a8ad6" />
      <StreetSign position={[-62, 4.25, 62]} rotationY={Math.PI / 2} label="Solaris Foundry Sector" direction="W" accent="#f59e0b" />
      <StreetSign position={[120, 4.25, -14.2]} rotationY={-Math.PI / 2} label="Aerostrata Spires" direction="E" accent="#38bdf8" />

      {/* Wide-Span Overhead Avenue Wayfinding Truss Gantries (Straddling 22m 4-Lane Boulevards, clear of (0, 240) Park Sanctuary) */}
      {quality.streetFurnitureEnabled &&
        (
          [
            [0, -48, 0, '#38bdf8'],
            [0, 48, 0, '#f59e0b'],
            [-48, 0, Math.PI / 2, '#10b981'],
            [48, 0, Math.PI / 2, '#38bdf8'],
            [0, -135, 0, '#38bdf8'],
            [0, 135, 0, '#f43f5e'],
            [-135, 0, Math.PI / 2, '#f59e0b'],
            [135, 0, Math.PI / 2, '#10b981'],
            [0, -225, 0, '#4a8ad6'],
            [0, 190, 0, '#10b981'],
            [-225, 0, Math.PI / 2, '#10b981'],
            [225, 0, Math.PI / 2, '#f59e0b'],
          ] as const
        ).map(([gx, gz, rot, accent], idx) => (
          <group key={`ave-arch-${idx}`} position={[gx, 0, gz]} rotation={[0, rot, 0]}>
            {([-12.2, 12.2] as const).map((px, pIdx) => (
              <group key={pIdx} position={[px, 0, 0]}>
                {/* Concrete Curb Base Pedestal */}
                <mesh position={[0, 0.4, 0]} geometry={SHARED_UNIT_BOX} material={CONCRETE_BASE_MAT} scale={[0.98, 0.8, 1.05]} />
                {/* Twin-Flange Support Pier */}
                <mesh position={[0, 4.9, 0]} geometry={SHARED_UNIT_BOX} material={streetArmMat} scale={[0.52, 8.6, 0.58]} />
                {/* Upper Knee Brace */}
                <mesh
                  position={[px < 0 ? 0.65 : -0.65, 8.2, 0]}
                  rotation={[0, 0, px < 0 ? -0.68 : 0.68]}
                  geometry={SHARED_UNIT_BOX}
                  material={CHROME_TRIM_MAT}
                  scale={[0.16, 1.65, 0.24]}
                />
              </group>
            ))}
            {/* Lower & Upper Overhead Structural Truss Chords (25.2m Span) */}
            <mesh position={[0, 8.95, 0]} geometry={SHARED_UNIT_BOX} material={podiumBaseMat} scale={[25.2, 0.44, 0.66]} />
            <mesh position={[0, 9.65, 0]} geometry={SHARED_UNIT_BOX} material={parapetMat} scale={[25.2, 0.26, 0.48]} />
            {/* Full-Width HDR Status Accent Strip */}
            <mesh
              position={[0, 8.68, 0]}
              geometry={SHARED_UNIT_BOX}
              material={gridIsOut ? bulbOffMat : getDistrictBloomMat(accent, neonBloomBoost)}
              scale={[23.4, 0.1, 0.7]}
            />
            {/* 4 Overhead Multi-Lane Guidance Displays Aligned to 4-Lane Boulevard Traffic */}
            {([-6.8, -3.2, 3.2, 6.8] as const).map((lx, lIdx) => (
              <group key={lIdx} position={[lx, 8.35, 0]}>
                <mesh geometry={SHARED_UNIT_BOX} material={podiumBaseMat} scale={[2.0, 0.42, 0.22]} />
                <mesh
                  position={[0, 0, 0]}
                  geometry={SHARED_UNIT_BOX}
                  material={gridIsOut ? bulbOffMat : getDistrictBloomMat(lIdx < 2 ? '#10b981' : '#38bdf8', neonBloomBoost)}
                  scale={[1.76, 0.22, 0.26]}
                />
              </group>
            ))}
          </group>
        ))}

      {/* Autonomous Aerial Recon & Atmospheric Drones Patrolling Inner & Outer Rings */}
      {quality.trafficEnabled && (
        <group ref={droneGroupRef} name="AerialReconDrones">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((dIdx) => {
            const droneAccent = dIdx % 3 === 0 ? '#10b981' : dIdx % 2 === 0 ? '#38bdf8' : '#f59e0b';
            return (
              <group key={`drone-${dIdx}`} position={[25 + dIdx * 18, 22, 25]}>
                {/* Central Sensor Pod */}
                <mesh geometry={SHARED_UNIT_BOX} material={streetArmMat} scale={[0.95, 0.34, 1.35]} />
                {/* Quad Rotor Outrigger Arms & Glowing Shrouds */}
                {(
                  [
                    [-0.75, 0.65],
                    [0.75, 0.65],
                    [-0.75, -0.65],
                    [0.75, -0.65],
                  ] as const
                ).map(([rx, rz], rIdx) => (
                  <mesh
                    key={rIdx}
                    position={[rx, 0.02, rz]}
                    geometry={SHARED_UNIT_CYLINDER}
                    material={getDistrictBasicMat(droneAccent)}
                    scale={[0.48, 0.1, 0.48]}
                  />
                ))}
                {/* Forward Optical Eye */}
                <mesh
                  position={[0, -0.04, 0.7]}
                  geometry={SHARED_DRONE_SPHERE}
                  material={getDistrictBasicMat('#f43f5e')}
                />
                {/* Downward Volumetric Scan Cone */}
                <mesh position={[0, -4.2, 0.4]} rotation={[0.15, 0, 0]} geometry={SHARED_DRONE_CONE}>
                  <meshBasicMaterial
                    color={droneAccent}
                    transparent
                    opacity={0.075}
                    depthWrite={false}
                    side={THREE.DoubleSide}
                  />
                </mesh>
              </group>
            );
          })}
        </group>
      )}
    </group>
  );
};
