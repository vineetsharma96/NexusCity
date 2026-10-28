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
const SHARED_DRONE_SPHERE = new THREE.SphereGeometry(0.14, 8, 8);
const SHARED_DRONE_CONE = new THREE.ConeGeometry(2.2, 8.2, 10, 1, true);
const SHARED_STEAM_PLANE = new THREE.PlaneGeometry(1.8, 1.1);
const SHARED_STEAM_CONE = new THREE.ConeGeometry(0.85, 2.4, 8, 1, true);
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
  const [wetnessBucket, setWetnessBucket] = useState<number>(
    () => Math.round(WeatherSystem.getInstance().getState().wetnessFactor * 10) / 10
  );
  const [cityEvent, setCityEvent] = useState<LivingCityEventState>(() => LivingCityEventSystem.getInstance().getState());
  const [quality, setQuality] = useState<QualitySettings>(() => QualityManager.current);

  useEffect(() => {
    let lastLightsOn = TimeSystem.getInstance().getState().streetLightsOn;
    let lastWetBucket = Math.round(WeatherSystem.getInstance().getState().wetnessFactor * 10) / 10;
    const uTime = TimeSystem.getInstance().subscribe((s) => {
      if (s.streetLightsOn !== lastLightsOn) {
        lastLightsOn = s.streetLightsOn;
        setStreetLightsOn(s.streetLightsOn);
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
  const plazaTex = useMemo(() => ProceduralTextures.getPlazaGridTexture(), []);
  const asphaltNormal = useMemo(() => ProceduralTextures.getAsphaltNormalMap(), []);
  const puddleRoughness = useMemo(() => ProceduralTextures.getWetPuddleRoughnessMap(), []);
  const claddingNormal = useMemo(() => ProceduralTextures.getBuildingCladdingNormalMap(), []);
  const landmarkNames = useMemo(
    () => new Map(NavigationSystem.getInstance().landmarks.map((l) => [l.id, l.name])),
    []
  );

  const lightStep = quality.maxLights >= 30 ? 4 : quality.maxLights >= 18 ? 6 : 10;
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
  const bulbOnMat = getDistrictBasicMat('#fef3c7');

  return (
    <group name="CityDistrictCentral">
      {/* Ground Substrate */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow={quality.shadows}>
        <planeGeometry args={[2800, 2800]} />
        <meshStandardMaterial color="#05080f" roughness={roadRoughness + 0.18} metalness={0.38} />
      </mesh>

      {/* Central Intersection & Civic Plaza Pad (top at y=0.048, cleanly above avenue tops 0.040 and inside ±15.2m crosswalks) */}
      <mesh position={[0, 0.038, 0]} receiveShadow={quality.shadows}>
        <boxGeometry args={[26.4, 0.02, 26.4]} />
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

      {/* Secondary Avenue Junction Pads at z = ±75 and ±165 so N-S and E-W lane lines do not Z-fight */}
      {([-165, -75, 75, 165] as const).map((jz) => (
        <mesh key={`junc-${jz}`} position={[0, 0.036, jz]} receiveShadow={quality.shadows}>
          <boxGeometry args={[14.2, 0.018, 14.2]} />
          <meshStandardMaterial
            color="#090d16"
            normalMap={quality.normalMapsEnabled ? asphaltNormal : undefined}
            roughness={roadRoughness}
            metalness={roadMetalness}
            envMapIntensity={envScale * 0.7}
          />
        </mesh>
      ))}

      {/* Central Plaza Sunken Reflective Meridian Ring & Overhead Astrolabe */}
      <group name="CentralPlazaPavilion">
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.052, 0]}>
          <ringGeometry args={[5.4, 8.2, 48]} />
          <meshStandardMaterial
            color="#042f2e"
            emissive="#38bdf8"
            emissiveIntensity={gridIsOut ? 0.02 : 0.22}
            roughness={0.05}
            metalness={0.95}
            envMapIntensity={envScale * 1.4}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.055, 0]}>
          <ringGeometry args={[5.2, 5.4, 48]} />
          <meshBasicMaterial color="#f59e0b" />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.055, 0]}>
          <ringGeometry args={[8.2, 8.4, 48]} />
          <meshBasicMaterial color="#38bdf8" />
        </mesh>

        {/* 4 Corner Architectural Light Pylons at Plaza Perimeter (outside crosswalks & traffic lanes) */}
        {(
          [
            [-11.2, -11.2],
            [11.2, -11.2],
            [-11.2, 11.2],
            [11.2, 11.2],
          ] as const
        ).map(([px, pz], idx) => (
          <group key={`pylon-${idx}`} position={[px, 0, pz]}>
            <mesh
              position={[0, 2.4, 0]}
              geometry={SHARED_UNIT_BOX}
              material={megacolMat}
              scale={[0.42, 4.8, 0.42]}
              castShadow={quality.shadows}
            />
            <mesh
              position={[0, 2.5, 0]}
              geometry={SHARED_UNIT_BOX}
              material={
                streetLightsActive
                  ? getDistrictBasicMat(idx % 2 === 0 ? '#f59e0b' : '#38bdf8')
                  : bulbOffMat
              }
              scale={[0.46, 3.8, 0.12]}
            />
          </group>
        ))}

        {/* Suspended Kinetic Meridian Astrolabe (High Overhead at y=13.5m) */}
        <group ref={astrolabeRef} position={[0, 13.5, 0]}>
          <mesh>
            <octahedronGeometry args={[1.1, 0]} />
            <meshBasicMaterial color="#f59e0b" wireframe />
          </mesh>
          <mesh>
            <torusGeometry args={[2.6, 0.05, 8, 48]} />
            <meshBasicMaterial color="#38bdf8" />
          </mesh>
          <mesh rotation={[Math.PI / 3, 0, 0]}>
            <torusGeometry args={[3.4, 0.04, 8, 48]} />
            <meshBasicMaterial color="#f59e0b" />
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
          <mesh
            position={[0, sw.size.y / 2 + 0.01, 0]}
            geometry={SHARED_UNIT_BOX}
            material={getDistrictBasicMat(idx % 2 === 0 ? '#38bdf8' : '#f59e0b')}
            scale={[sw.size.x + 0.08, 0.03, sw.size.z + 0.08]}
          />
        </group>
      ))}

      {/* Detailed Multi-Tier Architectural Monoliths */}
      {cityData.buildings.map((bldg) => {
        const bldgFacadeTex = facadeTextures[bldg.facadeVariant] || facadeTextures.CURTAIN_GLASS;
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

              {/* 4-Sided Illuminated Recessed Atrium Lobbies (North, South, East, West) */}
              <mesh
                position={[0, 2.5, 0]}
                geometry={SHARED_UNIT_BOX}
                scale={[bldg.totalSize.x * 0.78, 4.6, bldg.totalSize.z + 1.05]}
              >
                <meshStandardMaterial
                  color="#091326"
                  emissive={bldg.storefrontColor}
                  emissiveIntensity={gridIsOut ? 0.03 : 0.36}
                  metalness={0.92}
                  roughness={0.14}
                  envMapIntensity={envScale * 1.2}
                />
              </mesh>
              <mesh
                position={[0, 2.5, 0]}
                geometry={SHARED_UNIT_BOX}
                scale={[bldg.totalSize.x + 1.05, 4.6, bldg.totalSize.z * 0.78]}
              >
                <meshStandardMaterial
                  color="#091326"
                  emissive={bldg.secondaryAccentColor}
                  emissiveIntensity={gridIsOut ? 0.03 : 0.3}
                  metalness={0.92}
                  roughness={0.14}
                  envMapIntensity={envScale * 1.2}
                />
              </mesh>

              {/* 4-Sided Cantilevered Entrance Marquee Canopies & Under-Soffit Light Bars */}
              <mesh
                position={[0, 5.35, 0]}
                geometry={SHARED_UNIT_BOX}
                material={canopyMat}
                scale={[bldg.totalSize.x + 2.4, 0.32, bldg.totalSize.z * 0.84]}
                castShadow={quality.shadows}
              />
              <mesh
                position={[0, 5.35, 0]}
                geometry={SHARED_UNIT_BOX}
                material={canopyMat}
                scale={[bldg.totalSize.x * 0.84, 0.32, bldg.totalSize.z + 2.4]}
                castShadow={quality.shadows}
              />
              <mesh
                position={[0, 5.15, 0]}
                geometry={SHARED_UNIT_BOX}
                material={storefrontBasicMat}
                scale={[bldg.totalSize.x + 2.5, 0.08, bldg.totalSize.z * 0.8]}
              />
              <mesh
                position={[0, 5.15, 0]}
                geometry={SHARED_UNIT_BOX}
                material={secondaryBasicMat}
                scale={[bldg.totalSize.x * 0.8, 0.08, bldg.totalSize.z + 2.5]}
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

                  {/* Vertical Architectural Brise-Soleil Mullion Fins & Belt Courses on Medium/High/Ultra LOD */}
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
                            scale={[tw + 0.42, th * 0.96, 0.32]}
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
                    emissiveIntensity={gridIsOut ? 0.04 : 0.48}
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
                      emissiveIntensity={gridIsOut ? 0.04 : 0.42}
                      metalness={0.92}
                      roughness={0.15}
                    />
                  </mesh>
                  <mesh position={[0, 4.2, 0]} geometry={SHARED_UNIT_BOX} scale={[topW * 0.44, 2.2, topD * 0.44]}>
                    <meshStandardMaterial
                      color="#0f172a"
                      emissive={bldg.secondaryAccentColor}
                      emissiveIntensity={gridIsOut ? 0.04 : 0.55}
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
                  <mesh position={[0, 4.4, 0]} geometry={SHARED_UNIT_BOX} scale={[topW, 0.35, topD * 0.5]}>
                    <meshBasicMaterial color={gridIsOut ? '#1e293b' : bldg.storefrontColor} />
                  </mesh>
                </group>
              )}

              {bldg.crownType === 'HALO_RING_CROWN' && (
                <group position={[0, 2.8, 0]}>
                  <mesh rotation={[Math.PI / 2, 0, 0]}>
                    <torusGeometry args={[Math.min(topW, topD) * 0.42, 0.28, 10, 32]} />
                    <meshBasicMaterial color={gridIsOut ? '#1e293b' : bldg.storefrontColor} />
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
                  <mesh position={[0, 4.4, 0]} geometry={SHARED_UNIT_BOX} scale={[topW * 0.86, 0.32, topD * 0.86]}>
                    <meshBasicMaterial color={gridIsOut ? '#1e293b' : bldg.secondaryAccentColor} />
                  </mesh>
                </group>
              )}
            </group>

            {/* 5. Vertical & Horizontal Emissive Neon Light Strips */}
            {bldg.lightStrips.map((strip, sIdx) => (
              <mesh
                key={sIdx}
                position={strip.position}
                geometry={SHARED_UNIT_BOX}
                scale={[strip.size.x, strip.size.y, strip.size.z]}
              >
                <meshBasicMaterial color={gridIsOut ? '#1e293b' : strip.color} />
              </mesh>
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
                    <mesh position={[0, eq.size.y / 2, 0]}>
                      <sphereGeometry args={[0.34, 8, 8]} />
                      <meshBasicMaterial color="#f59e0b" />
                    </mesh>
                    <mesh position={[0, eq.size.y * 0.18, 0]}>
                      <sphereGeometry args={[0.22, 8, 8]} />
                      <meshBasicMaterial color="#f43f5e" />
                    </mesh>
                  </group>
                ) : eq.type === 'HELIPAD' ? (
                  <group>
                    <mesh geometry={SHARED_UNIT_BOX} scale={[eq.size.x, eq.size.y, eq.size.z]}>
                      <meshStandardMaterial color="#0f172a" metalness={0.85} roughness={0.28} />
                    </mesh>
                    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, eq.size.y / 2 + 0.02, 0]}>
                      <ringGeometry args={[eq.size.x * 0.34, eq.size.x * 0.4, 24]} />
                      <meshBasicMaterial color="#38bdf8" />
                    </mesh>
                  </group>
                ) : eq.type === 'COOLING_TOWER' ? (
                  <group>
                    <mesh geometry={SHARED_UNIT_CYLINDER} scale={[eq.size.x, eq.size.y, eq.size.z]}>
                      <meshStandardMaterial color="#1e293b" metalness={0.88} roughness={0.26} />
                    </mesh>
                    <mesh position={[0, eq.size.y / 2 + 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                      <ringGeometry args={[eq.size.x * 0.25, eq.size.x * 0.44, 16]} />
                      <meshBasicMaterial color="#38bdf8" />
                    </mesh>
                  </group>
                ) : eq.type === 'DISH' ? (
                  <group>
                    <mesh position={[0, -0.4, 0]} geometry={SHARED_UNIT_CYLINDER} scale={[0.35, 1.2, 0.35]}>
                      <meshStandardMaterial color="#334155" metalness={0.9} />
                    </mesh>
                    <mesh position={[0, 0.35, 0]} rotation={[0.55, 0.4, 0]}>
                      <coneGeometry args={[0.95, 0.55, 14, 1, true]} />
                      <meshStandardMaterial color="#e2e8f0" metalness={0.85} roughness={0.2} side={THREE.DoubleSide} />
                    </mesh>
                  </group>
                ) : (
                  <group>
                    <mesh geometry={SHARED_UNIT_BOX} scale={[eq.size.x, eq.size.y, eq.size.z]}>
                      <meshStandardMaterial color="#1e293b" metalness={0.88} roughness={0.28} />
                    </mesh>
                    <mesh position={[0, eq.size.y / 2 + 0.03, 0]} geometry={SHARED_UNIT_BOX} scale={[eq.size.x * 0.85, 0.05, eq.size.z * 0.85]}>
                      <meshBasicMaterial color="#38bdf8" />
                    </mesh>
                  </group>
                )}
              </group>
            ))}
          </group>
        );
      })}

      {/* Elevated Glazed Skybridges */}
      {quality.streetFurnitureEnabled &&
        cityData.skybridges.map((sb) => (
          <group key={sb.id} position={sb.position} rotation={[0, sb.rotationY, 0]}>
            <mesh geometry={SHARED_UNIT_BOX} scale={[sb.size.x, sb.size.y, sb.size.z]} castShadow={quality.shadows}>
              <meshStandardMaterial
                color="#0f172a"
                metalness={0.9}
                roughness={0.15}
                transparent
                opacity={0.86}
                envMapIntensity={envScale}
              />
            </mesh>
            <mesh position={[0, -sb.size.y / 2 - 0.12, 0]} geometry={SHARED_UNIT_BOX} scale={[sb.size.x, 0.22, sb.size.z + 0.4]}>
              <meshStandardMaterial color="#090d16" metalness={0.92} roughness={0.25} />
            </mesh>
            <mesh position={[0, -sb.size.y / 2 - 0.26, 0]} geometry={SHARED_UNIT_BOX} scale={[sb.size.x * 0.92, 0.06, 0.35]}>
              <meshBasicMaterial color={gridIsOut ? '#1e293b' : sb.accentColor} />
            </mesh>
            <mesh position={[0, sb.size.y / 2 + 0.08, 0]} geometry={SHARED_UNIT_BOX} scale={[sb.size.x * 0.92, 0.06, sb.size.z + 0.1]}>
              <meshBasicMaterial color={gridIsOut ? '#1e293b' : sb.accentColor} />
            </mesh>
          </group>
        ))}

      {/* Detailed Streetscape Props (Transit Shelters, Cyber Kiosks, Benches, Bollards, Steam Grates) */}
      {quality.streetFurnitureEnabled &&
        cityData.streetProps.map((prop) => (
          <group key={prop.id} position={prop.position} rotation={[0, prop.rotationY, 0]}>
            {prop.type === 'TRANSIT_SHELTER' && (
              <group>
                <mesh position={[0, 1.35, -0.8]} geometry={SHARED_UNIT_BOX} scale={[3.8, 2.7, 0.14]} castShadow={quality.shadows}>
                  <meshStandardMaterial color="#0f172a" metalness={0.88} roughness={0.18} />
                </mesh>
                <mesh position={[0, 2.75, 0]} geometry={SHARED_UNIT_BOX} scale={[4.2, 0.16, 1.9]} castShadow={quality.shadows}>
                  <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.2} />
                </mesh>
                <mesh position={[0, 2.66, 0.85]} geometry={SHARED_UNIT_BOX} scale={[4.0, 0.05, 0.12]}>
                  <meshBasicMaterial color={prop.accentColor} />
                </mesh>
                <mesh position={[0, 0.48, -0.35]} geometry={SHARED_UNIT_BOX} scale={[2.4, 0.12, 0.55]}>
                  <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.3} />
                </mesh>
              </group>
            )}
            {prop.type === 'CYBER_KIOSK' && (
              <group>
                <mesh position={[0, 1.25, 0]} geometry={SHARED_UNIT_BOX} scale={[0.85, 2.5, 0.36]} castShadow={quality.shadows}>
                  <meshStandardMaterial color="#0b0f19" metalness={0.92} roughness={0.18} />
                </mesh>
                <mesh position={[0, 1.4, 0.19]} geometry={SHARED_UNIT_BOX} scale={[0.68, 1.35, 0.02]}>
                  <meshBasicMaterial color={prop.accentColor} />
                </mesh>
                <mesh position={[0, 2.62, 0]} geometry={SHARED_UNIT_BOX} scale={[0.92, 0.08, 0.44]}>
                  <meshBasicMaterial color="#f59e0b" />
                </mesh>
              </group>
            )}
            {prop.type === 'BENCH' && (
              <group>
                <mesh
                  position={[0, 0.42, 0]}
                  geometry={SHARED_UNIT_BOX}
                  material={parapetMat}
                  scale={[2.2, 0.12, 0.65]}
                />
                <mesh
                  position={[0, 0.72, -0.26]}
                  geometry={SHARED_UNIT_BOX}
                  material={streetArmMat}
                  scale={[2.2, 0.48, 0.1]}
                />
                <mesh
                  position={[0, 0.12, 0]}
                  geometry={SHARED_UNIT_BOX}
                  material={streetLightsActive ? getDistrictBasicMat(prop.accentColor) : bulbOffMat}
                  scale={[1.8, 0.04, 0.4]}
                />
              </group>
            )}
            {prop.type === 'BOLLARD_CLUSTER' && (
              <group>
                {([-1.2, 0, 1.2] as const).map((bx, bIdx) => (
                  <group key={bIdx} position={[bx, 0, 0]}>
                    <mesh
                      position={[0, 0.5, 0]}
                      geometry={SHARED_UNIT_CYLINDER}
                      material={streetArmMat}
                      scale={[0.24, 1.0, 0.24]}
                    />
                    <mesh
                      position={[0, 0.88, 0]}
                      geometry={SHARED_UNIT_CYLINDER}
                      material={streetLightsActive ? getDistrictBasicMat(prop.accentColor) : bulbOffMat}
                      scale={[0.25, 0.08, 0.25]}
                    />
                  </group>
                ))}
              </group>
            )}
            {prop.type === 'STEAM_GRATE' && (
              <group>
                <mesh
                  rotation={[-Math.PI / 2, 0, 0]}
                  geometry={SHARED_STEAM_PLANE}
                  material={streetPoleMat}
                />
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
        ))}

      {/* Street Luminaires — Turn ON at Night & OFF during Day */}
      {cityData.streetlights.map((sl, idx) => (
        <group key={idx} position={sl.position} rotation={[0, sl.rotationY, 0]}>
          <mesh
            position={[0, 3.1, 0]}
            geometry={SHARED_UNIT_CYLINDER}
            material={streetPoleMat}
            scale={[0.16, 6.2, 0.16]}
          />
          <mesh
            position={[0.9, 6.2, 0]}
            geometry={SHARED_UNIT_BOX}
            material={streetArmMat}
            scale={[1.8, 0.12, 0.24]}
          />
          <mesh
            position={[1.4, 6.12, 0]}
            geometry={SHARED_UNIT_BOX}
            material={streetLightsActive ? bulbOnMat : bulbOffMat}
            scale={[0.7, 0.05, 0.2]}
          />
          {streetLightsActive && quality.maxLights >= 8 && idx % lightStep === 0 && (
            <pointLight
              position={[1.4, 5.8, 0]}
              color="#fef3c7"
              distance={isUltra ? 30 : 24}
              decay={2}
              intensity={isUltra ? 2.8 : 2.2}
            />
          )}
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

      {/* Wayfinding Signage across Central & Outer Sectors */}
      <StreetSign position={[0, 4.25, -12]} rotationY={Math.PI} label={landmarkNames.get('central_plaza') ?? 'Central Plaza Hub'} direction="S" />
      <StreetSign position={[0, 4.25, -62]} rotationY={Math.PI} label={landmarkNames.get('north_crossway') ?? 'North Crossing Avenue'} direction="N" accent="#38bdf8" />
      <StreetSign position={[28, 4.25, 28]} rotationY={Math.PI / 2} label={landmarkNames.get('apex_tower') ?? 'Apex Monolith Tower'} direction="E" accent="#f59e0b" />
      <StreetSign position={[62, 4.25, 62]} rotationY={-Math.PI / 2} label={landmarkNames.get('park_sanctuary') ?? 'Central Park Sanctuary'} direction="E" accent="#10b981" />
      <StreetSign position={[0, 4.25, 62]} rotationY={0} label={landmarkNames.get('south_crossway') ?? 'South Crossing Avenue'} direction="S" accent="#38bdf8" />
      <StreetSign position={[-62, 4.25, -12]} rotationY={Math.PI / 2} label="Neural Quantum Sector" direction="W" accent="#4a8ad6" />
      <StreetSign position={[-62, 4.25, 62]} rotationY={Math.PI / 2} label="Solaris Foundry Sector" direction="W" accent="#f59e0b" />
      <StreetSign position={[120, 4.25, -12]} rotationY={-Math.PI / 2} label="Aerostrata Spires" direction="E" accent="#38bdf8" />

      {/* Overhead Avenue Holographic Wayfinding Gantry Arches across Central & Outer Corridors */}
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
            [0, 225, 0, '#38bdf8'],
            [-225, 0, Math.PI / 2, '#10b981'],
            [225, 0, Math.PI / 2, '#f59e0b'],
          ] as const
        ).map(([gx, gz, rot, accent], idx) => (
          <group key={`ave-arch-${idx}`} position={[gx, 0, gz]} rotation={[0, rot, 0]}>
            {([-8.2, 8.2] as const).map((px, pIdx) => (
              <mesh key={pIdx} position={[px, 4.6, 0]} geometry={SHARED_UNIT_BOX} scale={[0.48, 9.2, 0.55]}>
                <meshStandardMaterial color="#0f172a" metalness={0.92} roughness={0.2} />
              </mesh>
            ))}
            <mesh position={[0, 9.1, 0]} geometry={SHARED_UNIT_BOX} scale={[17.4, 0.55, 0.68]}>
              <meshStandardMaterial color="#0b1120" metalness={0.92} roughness={0.18} />
            </mesh>
            <mesh position={[0, 8.75, 0]} geometry={SHARED_UNIT_BOX} scale={[15.8, 0.1, 0.72]}>
              <meshBasicMaterial color={gridIsOut ? '#1e293b' : accent} />
            </mesh>
            {/* Lane Guidance Indicators */}
            {([-3.4, 3.4] as const).map((lx, lIdx) => (
              <mesh key={lIdx} position={[lx, 8.45, 0]} geometry={SHARED_UNIT_BOX} scale={[1.8, 0.28, 0.14]}>
                <meshBasicMaterial color={lIdx === 0 ? '#10b981' : '#38bdf8'} />
              </mesh>
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
