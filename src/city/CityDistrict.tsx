import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { CityGenerator, CityData } from './CityGenerator';
import { RoadGenerator } from './RoadGenerator';
import { VegetationGenerator, TreeDef } from './VegetationGenerator';
import { ProceduralTree } from './ProceduralTree';
import { CyberVideoBillboard } from './CyberVideoBillboard';
import { ProceduralTextures } from '../core/ProceduralTextures';
import { TimeSystem, TimeLightingState } from '../world/TimeSystem';
import { WeatherSystem, WeatherState } from '../world/WeatherSystem';
import { QualityManager, QualitySettings } from '../rendering/QualityManager';
import { StreetSign } from './StreetSign';
import { NavigationSystem } from '../map/NavigationSystem';
import { LivingCityEventState, LivingCityEventSystem } from '../world/LivingCityEventSystem';

const SHARED_UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);

interface CityDistrictProps {
  seed?: number;
}

export const CityDistrict: React.FC<CityDistrictProps> = ({ seed = 847291 }) => {
  const cityData: CityData = useMemo(() => CityGenerator.generateDistrict(seed), [seed]);
  const trees: TreeDef[] = useMemo(() => VegetationGenerator.generateTrees(seed), [seed]);
  const astrolabeRef = useRef<THREE.Group>(null);

  const [timeState, setTimeState] = useState<TimeLightingState>(() => TimeSystem.getInstance().getState());
  const [weatherState, setWeatherState] = useState<WeatherState>(() => WeatherSystem.getInstance().getState());
  const [cityEvent, setCityEvent] = useState<LivingCityEventState>(() => LivingCityEventSystem.getInstance().getState());
  const [quality, setQuality] = useState<QualitySettings>(() => QualityManager.current);

  useEffect(() => {
    let lastNight = -1;
    let lastWet = -1;
    const uTime = TimeSystem.getInstance().subscribe((s) => {
      if (Math.abs(s.nightFactor - lastNight) < 0.03) return;
      lastNight = s.nightFactor;
      setTimeState(s);
    });
    const uWea = WeatherSystem.getInstance().subscribe((s) => {
      if (Math.abs(s.wetnessFactor - lastWet) < 0.02) return;
      lastWet = s.wetnessFactor;
      setWeatherState(s);
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

  useFrame((_, delta) => {
    if (astrolabeRef.current) {
      astrolabeRef.current.rotation.y += delta * 0.45;
      astrolabeRef.current.children.forEach((child, idx) => {
        if (idx > 0) {
          child.rotation.x += delta * (0.3 + idx * 0.15);
        }
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
  const effectiveWetness = quality.wetReflectionsEnabled ? weatherState.wetnessFactor : 0;
  const roadRoughness = THREE.MathUtils.lerp(isUltra ? 0.28 : 0.38, 0.06, effectiveWetness);
  const roadMetalness = THREE.MathUtils.lerp(0.68, 0.92, effectiveWetness);
  const sidewalkRoughness = THREE.MathUtils.lerp(0.52, 0.16, effectiveWetness);
  const sidewalkMetalness = THREE.MathUtils.lerp(0.36, 0.68, effectiveWetness);
  const gridIsOut = cityEvent.type === 'POWER_OUTAGE' && cityEvent.phase === 'ACTIVE';

  const asphaltTex = useMemo(() => RoadGenerator.getAsphaltTexture(), []);
  const sidewalkTex = useMemo(() => RoadGenerator.getSidewalkTexture(), []);
  const facadeTex = useMemo(() => ProceduralTextures.getBuildingFacadeTexture(0.64), []);
  const plazaTex = useMemo(() => ProceduralTextures.getPlazaGridTexture(), []);
  const asphaltNormal = useMemo(() => ProceduralTextures.getAsphaltNormalMap(), []);
  const puddleRoughness = useMemo(() => ProceduralTextures.getWetPuddleRoughnessMap(), []);
  const claddingNormal = useMemo(() => ProceduralTextures.getBuildingCladdingNormalMap(), []);
  const landmarkNames = useMemo(
    () => new Map(NavigationSystem.getInstance().landmarks.map((l) => [l.id, l.name])),
    []
  );

  const lightStep = quality.maxLights >= 30 ? 3 : quality.maxLights >= 18 ? 5 : 8;

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
          normalScale={new THREE.Vector2(0.4, 0.4)}
          roughness={sidewalkRoughness * 0.75}
          metalness={sidewalkMetalness}
          envMapIntensity={envScale}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </mesh>

      {/* Secondary Avenue Junction Pads at z = -75 and z = +75 so N-S and E-W lane lines do not Z-fight */}
      {([-75, 75] as const).map((jz) => (
        <mesh key={`junc-${jz}`} position={[0, 0.036, jz]} receiveShadow={quality.shadows}>
          <boxGeometry args={[14.2, 0.018, 12.2]} />
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
            <mesh position={[0, 2.4, 0]} castShadow={quality.shadows}>
              <boxGeometry args={[0.42, 4.8, 0.42]} />
              <meshStandardMaterial color="#0b0f19" metalness={0.9} roughness={0.2} />
            </mesh>
            <mesh position={[0, 2.5, 0]}>
              <boxGeometry args={[0.46, 3.8, 0.12]} />
              <meshBasicMaterial color={idx % 2 === 0 ? '#f59e0b' : '#38bdf8'} />
            </mesh>
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
            normalScale={new THREE.Vector2(isUltra ? 0.85 : 0.65, isUltra ? 0.85 : 0.65)}
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
              normalScale={new THREE.Vector2(0.32, 0.32)}
              roughness={sidewalkRoughness}
              metalness={sidewalkMetalness}
              envMapIntensity={envScale * 0.5}
            />
          </mesh>
          <mesh position={[0, sw.size.y / 2 + 0.01, 0]} geometry={SHARED_UNIT_BOX} scale={[sw.size.x + 0.08, 0.03, sw.size.z + 0.08]}>
            <meshBasicMaterial color={idx % 2 === 0 ? '#38bdf8' : '#f59e0b'} />
          </mesh>
        </group>
      ))}

      {/* Architectural Monoliths */}
      {cityData.buildings.map((bldg) => (
        <group key={bldg.id} position={bldg.position}>
          {bldg.tiers.map((tier, tIdx) => (
            <group key={tIdx} position={tier.offset}>
              <mesh
                geometry={SHARED_UNIT_BOX}
                scale={[tier.size.x, tier.size.y, tier.size.z]}
                castShadow={quality.shadows}
                receiveShadow={quality.shadows}
              >
                <meshStandardMaterial
                  map={facadeTex}
                  normalMap={quality.normalMapsEnabled ? claddingNormal : undefined}
                  normalScale={new THREE.Vector2(isUltra ? 0.75 : 0.55, isUltra ? 0.75 : 0.55)}
                  roughness={isUltra ? 0.24 : 0.32}
                  metalness={0.86}
                  envMapIntensity={envScale}
                />
              </mesh>
              {/* Structural Corner Exoskeleton Columns */}
              {(
                [
                  [-1, -1],
                  [1, -1],
                  [-1, 1],
                  [1, 1],
                ] as const
              ).map(([cx, cz], cIdx) => (
                <mesh
                  key={cIdx}
                  position={[(cx * tier.size.x) / 2, 0, (cz * tier.size.z) / 2]}
                  geometry={SHARED_UNIT_BOX}
                  scale={[0.65, tier.size.y, 0.65]}
                >
                  <meshStandardMaterial color="#0b1120" metalness={0.92} roughness={0.22} />
                </mesh>
              ))}
            </group>
          ))}

          {/* Street-Level Illuminated Lobby & Cantilevered Canopy */}
          <mesh
            position={[0, 2.4, bldg.totalSize.z / 2 + 0.06]}
            geometry={SHARED_UNIT_BOX}
            scale={[bldg.totalSize.x * 0.72, 4.8, 0.42]}
          >
            <meshStandardMaterial
              color="#09111f"
              emissive={bldg.storefrontColor}
              emissiveIntensity={gridIsOut ? 0.04 : 0.32}
              metalness={0.9}
              roughness={0.16}
            />
          </mesh>
          <mesh
            position={[0, 4.95, bldg.totalSize.z / 2 + 0.85]}
            geometry={SHARED_UNIT_BOX}
            scale={[bldg.totalSize.x * 0.78, 0.24, 1.8]}
          >
            <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.2} />
          </mesh>

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

          {bldg.rooftopEquipment.map((eq, eIdx) => (
            <group key={eIdx} position={eq.position}>
              {eq.type === 'ANTENNA' ? (
                <>
                  <mesh>
                    <cylinderGeometry args={[0.08, 0.28, eq.size.y, 8]} />
                    <meshStandardMaterial color="#334155" metalness={0.9} />
                  </mesh>
                  <mesh position={[0, eq.size.y / 2, 0]}>
                    <sphereGeometry args={[0.32, 8, 8]} />
                    <meshBasicMaterial color="#f59e0b" />
                  </mesh>
                </>
              ) : eq.type === 'HELIPAD' ? (
                <group>
                  <mesh geometry={SHARED_UNIT_BOX} scale={[eq.size.x, eq.size.y, eq.size.z]}>
                    <meshStandardMaterial color="#0f172a" metalness={0.8} roughness={0.3} />
                  </mesh>
                  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, eq.size.y / 2 + 0.02, 0]}>
                    <ringGeometry args={[eq.size.x * 0.32, eq.size.x * 0.38, 24]} />
                    <meshBasicMaterial color="#38bdf8" />
                  </mesh>
                </group>
              ) : (
                <mesh geometry={SHARED_UNIT_BOX} scale={[eq.size.x, eq.size.y, eq.size.z]}>
                  <meshStandardMaterial color="#1e293b" metalness={0.85} roughness={0.3} />
                </mesh>
              )}
            </group>
          ))}
        </group>
      ))}

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
                <mesh position={[0, 0.42, 0]} geometry={SHARED_UNIT_BOX} scale={[2.2, 0.12, 0.65]} castShadow={quality.shadows}>
                  <meshStandardMaterial color="#1e293b" metalness={0.75} roughness={0.35} />
                </mesh>
                <mesh position={[0, 0.72, -0.26]} geometry={SHARED_UNIT_BOX} scale={[2.2, 0.48, 0.1]}>
                  <meshStandardMaterial color="#0f172a" metalness={0.85} roughness={0.25} />
                </mesh>
                <mesh position={[0, 0.12, 0]} geometry={SHARED_UNIT_BOX} scale={[1.8, 0.04, 0.4]}>
                  <meshBasicMaterial color={prop.accentColor} />
                </mesh>
              </group>
            )}
            {prop.type === 'BOLLARD_CLUSTER' && (
              <group>
                {([-1.2, 0, 1.2] as const).map((bx, bIdx) => (
                  <group key={bIdx} position={[bx, 0, 0]}>
                    <mesh position={[0, 0.5, 0]}>
                      <cylinderGeometry args={[0.11, 0.13, 1.0, 8]} />
                      <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.2} />
                    </mesh>
                    <mesh position={[0, 0.88, 0]}>
                      <cylinderGeometry args={[0.12, 0.12, 0.08, 8]} />
                      <meshBasicMaterial color={prop.accentColor} />
                    </mesh>
                  </group>
                ))}
              </group>
            )}
            {prop.type === 'STEAM_GRATE' && (
              <group>
                <mesh rotation={[-Math.PI / 2, 0, 0]}>
                  <planeGeometry args={[1.8, 1.1]} />
                  <meshStandardMaterial color="#1e293b" metalness={0.92} roughness={0.25} />
                </mesh>
                <mesh position={[0, 1.2, 0]}>
                  <coneGeometry args={[0.85, 2.4, 8, 1, true]} />
                  <meshBasicMaterial color={prop.accentColor} transparent opacity={0.09} depthWrite={false} side={THREE.DoubleSide} />
                </mesh>
              </group>
            )}
          </group>
        ))}

      {/* Street Luminaires */}
      {cityData.streetlights.map((sl, idx) => (
        <group key={idx} position={sl.position} rotation={[0, sl.rotationY, 0]}>
          <mesh position={[0, 3.2, 0]}>
            <cylinderGeometry args={[0.07, 0.1, 6.2, 8]} />
            <meshStandardMaterial color="#1e293b" metalness={0.88} />
          </mesh>
          <mesh position={[0.9, 6.2, 0]} geometry={SHARED_UNIT_BOX} scale={[1.8, 0.12, 0.24]}>
            <meshStandardMaterial color="#0f172a" metalness={0.9} />
          </mesh>
          <mesh position={[1.4, 6.12, 0]} geometry={SHARED_UNIT_BOX} scale={[0.7, 0.04, 0.2]}>
            <meshBasicMaterial color={gridIsOut ? '#1e293b' : timeState.nightFactor > 0.3 ? '#fef3c7' : '#38bdf8'} />
          </mesh>
          {quality.maxLights >= 8 && quality.nightLightsEnabled && idx % lightStep === 0 && (
            <pointLight
              position={[1.4, 5.8, 0]}
              color="#fef3c7"
              distance={isUltra ? 30 : 24}
              decay={2}
              intensity={gridIsOut ? 0.04 : 0.25 + timeState.nightFactor * (isUltra ? 3.0 : 2.5)}
            />
          )}
        </group>
      ))}

      {/* Avenue Trees */}
      {quality.vegetationEnabled &&
        trees.map((tree) => <ProceduralTree key={tree.id} tree={tree} registerGlobalCollider />)}

      {/* Broadcast Matrices */}
      {quality.billboardsEnabled && (
        <>
          <CyberVideoBillboard position={[0, 18, -28]} rotationY={0} width={22} height={13} channel={1} />
          <CyberVideoBillboard position={[22, 18, 0]} rotationY={-Math.PI / 2} width={20} height={12} channel={2} />
          <CyberVideoBillboard position={[-22, 18, 0]} rotationY={Math.PI / 2} width={20} height={12} channel={3} />
          <CyberVideoBillboard position={[0, 18, 32]} rotationY={Math.PI} width={22} height={13} channel={1} />
        </>
      )}

      {/* Wayfinding Signage */}
      <StreetSign position={[0, 4.25, -12]} rotationY={Math.PI} label={landmarkNames.get('central_plaza') ?? 'Central Plaza Hub'} direction="S" />
      <StreetSign position={[0, 4.25, -62]} rotationY={Math.PI} label={landmarkNames.get('north_crossway') ?? 'North Crossing Avenue'} direction="N" accent="#38bdf8" />
      <StreetSign position={[28, 4.25, 28]} rotationY={Math.PI / 2} label={landmarkNames.get('apex_tower') ?? 'Apex Monolith Tower'} direction="E" accent="#f59e0b" />
      <StreetSign position={[62, 4.25, 62]} rotationY={-Math.PI / 2} label={landmarkNames.get('park_sanctuary') ?? 'Central Park Sanctuary'} direction="E" accent="#10b981" />
    </group>
  );
};
