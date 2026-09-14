import React, { useMemo, useState, useEffect } from 'react';
import * as THREE from 'three';
import { CityGenerator, CityData } from './CityGenerator';
import { RoadGenerator } from './RoadGenerator';
import { VegetationGenerator, TreeDef } from './VegetationGenerator';
import { ProceduralTree } from './ProceduralTree';
import { FallingLeaves } from './FallingLeaves';
import { CyberVideoBillboard } from './CyberVideoBillboard';
import { ProceduralTextures } from '../core/ProceduralTextures';
import { TimeSystem, TimeLightingState } from '../world/TimeSystem';
import { WeatherSystem, WeatherState } from '../world/WeatherSystem';
import { QualityManager, QualitySettings } from '../rendering/QualityManager';

// Shared static geometries to eliminate redundant GPU vertex buffer uploads
const SHARED_UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const SHARED_UNIT_CYLINDER = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
const SHARED_BEACON_SPHERE = new THREE.SphereGeometry(0.3, 8, 8);

interface CityDistrictProps {
  seed?: number;
}

export const CityDistrict: React.FC<CityDistrictProps> = ({ seed = 847291 }) => {
  // Generate deterministic city and vegetation data
  const cityData: CityData = useMemo(() => CityGenerator.generateDistrict(seed), [seed]);
  const trees: TreeDef[] = useMemo(() => VegetationGenerator.generateTrees(seed), [seed]);

  // Lighting & time state
  const [timeState, setTimeState] = useState<TimeLightingState>(() =>
    TimeSystem.getInstance().getState()
  );
  const [weatherState, setWeatherState] = useState<WeatherState>(() =>
    WeatherSystem.getInstance().getState()
  );
  const [quality, setQuality] = useState<QualitySettings>(() => QualityManager.current);

  useEffect(() => {
    const unsubTime = TimeSystem.getInstance().subscribe(setTimeState);
    const unsubWeather = WeatherSystem.getInstance().subscribe(setWeatherState);
    const unsubQuality = QualityManager.subscribe(setQuality);
    return () => {
      unsubTime();
      unsubWeather();
      unsubQuality();
    };
  }, []);

  // Dynamic surface wetness and reflection scaling based on Quality profile
  const envReflectionScale =
    quality.reflectionQuality === 'HIGH' ? 1.4 :
    quality.reflectionQuality === 'MEDIUM' ? 0.9 :
    quality.reflectionQuality === 'LOW' ? 0.4 : 0.0;

  const roadRoughness = THREE.MathUtils.lerp(0.35, 0.08, weatherState.wetnessFactor);
  const roadMetalness = THREE.MathUtils.lerp(0.65, 0.88, weatherState.wetnessFactor);
  const sidewalkRoughness = THREE.MathUtils.lerp(0.6, 0.18, weatherState.wetnessFactor);
  const sidewalkMetalness = THREE.MathUtils.lerp(0.3, 0.6, weatherState.wetnessFactor);

  // Procedural textures
  const asphaltTex = useMemo(() => RoadGenerator.getAsphaltTexture(), []);
  const sidewalkTex = useMemo(() => RoadGenerator.getSidewalkTexture(), []);
  const facadeTex = useMemo(() => ProceduralTextures.getBuildingFacadeTexture(0.65), []);
  const plazaTex = useMemo(() => ProceduralTextures.getPlazaGridTexture(), []);
  const asphaltNormal = useMemo(() => ProceduralTextures.getAsphaltNormalMap(), []);
  const puddleRoughness = useMemo(() => ProceduralTextures.getWetPuddleRoughnessMap(), []);
  const claddingNormal = useMemo(() => ProceduralTextures.getBuildingCladdingNormalMap(), []);

  return (
    <group name="CityDistrictCentral">
      {/* 1. Base Ground Substrate (2400x2400m for 3km Metropolis) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[2400, 2400]} />
        <meshStandardMaterial color="#060912" roughness={roadRoughness + 0.2} metalness={0.4} />
      </mesh>

      {/* 2. Central Intersection Plaza Hub */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} receiveShadow>
        <planeGeometry args={[28, 28]} />
        <meshStandardMaterial
          map={plazaTex}
          normalMap={asphaltNormal}
          normalScale={new THREE.Vector2(0.4, 0.4)}
          roughness={sidewalkRoughness * 0.8}
          metalness={sidewalkMetalness}
        />
      </mesh>

      {/* 3. Road Avenues with Dynamic Wetness & Normal Mapping */}
      {cityData.avenues.map((ave, idx) => (
        <mesh
          key={`ave-${idx}`}
          position={ave.position}
          rotation={[0, ave.rotationY, 0]}
          geometry={SHARED_UNIT_BOX}
          scale={[ave.size.x, ave.size.y, ave.size.z]}
          receiveShadow
        >
          <meshStandardMaterial
            map={asphaltTex}
            normalMap={asphaltNormal}
            normalScale={new THREE.Vector2(0.7, 0.7)}
            roughnessMap={quality.reflectionQuality !== 'OFF' && weatherState.wetnessFactor > 0.05 ? puddleRoughness : undefined}
            roughness={roadRoughness}
            metalness={roadMetalness}
            envMapIntensity={weatherState.wetnessFactor > 0.05 ? envReflectionScale : envReflectionScale * 0.5}
          />
        </mesh>
      ))}

      {/* 4. Raised Sidewalk Slabs */}
      {cityData.sidewalks.map((sw, idx) => (
        <mesh
          key={`sw-${idx}`}
          position={sw.position}
          geometry={SHARED_UNIT_BOX}
          scale={[sw.size.x, sw.size.y, sw.size.z]}
          receiveShadow
          castShadow
        >
          <meshStandardMaterial
            map={sidewalkTex}
            normalMap={asphaltNormal}
            normalScale={new THREE.Vector2(0.3, 0.3)}
            roughness={sidewalkRoughness}
            metalness={sidewalkMetalness}
          />
        </mesh>
      ))}

      {/* 5. Procedural Buildings with Cladding Normals */}
      {cityData.buildings.map((bldg) => (
        <group key={bldg.id} position={bldg.position}>
          {/* Tiers / Main Building Volumes */}
          {bldg.tiers.map((tier, tIdx) => (
            <mesh
              key={`tier-${tIdx}`}
              position={tier.offset}
              geometry={SHARED_UNIT_BOX}
              scale={[tier.size.x, tier.size.y, tier.size.z]}
              castShadow={quality.shadows}
              receiveShadow
            >
              <meshStandardMaterial
                map={facadeTex}
                normalMap={claddingNormal}
                normalScale={new THREE.Vector2(0.6, 0.6)}
                roughness={0.35}
                metalness={0.8}
              />
            </mesh>
          ))}

          {/* Storefront Arcade at Street Level */}
          <mesh
            position={[0, 2.2, bldg.totalSize.z / 2 + 0.05]}
            geometry={SHARED_UNIT_BOX}
            scale={[bldg.totalSize.x * 0.7, 4.4, 0.4]}
            castShadow={quality.shadows}
          >
            <meshStandardMaterial
              color="#091428"
              emissive={bldg.storefrontColor}
              emissiveIntensity={0.25}
              metalness={0.9}
              roughness={0.2}
            />
          </mesh>
          {/* Glowing Storefront Sign Header */}
          <mesh
            position={[0, 4.2, bldg.totalSize.z / 2 + 0.3]}
            geometry={SHARED_UNIT_BOX}
            scale={[bldg.totalSize.x * 0.5, 0.6, 0.1]}
          >
            <meshBasicMaterial color={bldg.storefrontColor} />
          </mesh>

          {/* Vertical Neon Architectural Light Strips */}
          {bldg.lightStrips.map((strip, sIdx) => (
            <mesh
              key={`strip-${sIdx}`}
              position={strip.position}
              geometry={SHARED_UNIT_BOX}
              scale={[strip.size.x, strip.size.y, strip.size.z]}
            >
              <meshBasicMaterial color={strip.color} />
            </mesh>
          ))}

          {/* Rooftop Equipment & Antennas */}
          {bldg.rooftopEquipment.map((eq, eIdx) => (
            <group key={`eq-${eIdx}`} position={eq.position}>
              {eq.type === 'ANTENNA' ? (
                <>
                  <mesh castShadow>
                    <cylinderGeometry args={[0.08, 0.3, eq.size.y, 8]} />
                    <meshStandardMaterial color="#334155" metalness={0.9} />
                  </mesh>
                  {/* Blinking Warning Beacon on tip */}
                  <mesh position={[0, eq.size.y / 2, 0]}>
                    <sphereGeometry args={[0.3, 8, 8]} />
                    <meshBasicMaterial color="#ff0055" />
                  </mesh>
                </>
              ) : eq.type === 'COOLING_TOWER' ? (
                <group>
                  {/* Wooden/Metal Cylindrical Water Tank */}
                  <mesh position={[0, 0.5, 0]} castShadow>
                    <cylinderGeometry args={[eq.size.x * 0.45, eq.size.x * 0.45, eq.size.y * 0.7, 12]} />
                    <meshStandardMaterial color="#451a03" roughness={0.7} />
                  </mesh>
                  {/* Conical Roof Cap */}
                  <mesh position={[0, 0.5 + eq.size.y * 0.35 + 0.3, 0]}>
                    <coneGeometry args={[eq.size.x * 0.5, 0.7, 12]} />
                    <meshStandardMaterial color="#1e293b" metalness={0.8} />
                  </mesh>
                  {/* Stilt Legs */}
                  {[-0.8, 0.8].map((lx) =>
                    [-0.8, 0.8].map((lz) => (
                      <mesh key={`leg-${lx}-${lz}`} position={[lx, -eq.size.y * 0.25, lz]}>
                        <cylinderGeometry args={[0.06, 0.06, eq.size.y * 0.4, 6]} />
                        <meshStandardMaterial color="#1e293b" metalness={0.9} />
                      </mesh>
                    ))
                  )}
                </group>
              ) : eq.type === 'DISH' ? (
                <group rotation={[0.4, 0.6, 0]}>
                  {/* Parabolic Communications Dish */}
                  <mesh castShadow>
                    <cylinderGeometry args={[eq.size.x * 0.5, 0.1, 0.4, 16]} />
                    <meshStandardMaterial color="#e2e8f0" metalness={0.9} roughness={0.2} />
                  </mesh>
                  {/* Feed Horn Arm */}
                  <mesh position={[0, 0.6, 0]}>
                    <cylinderGeometry args={[0.04, 0.04, 0.8, 6]} />
                    <meshStandardMaterial color="#0f172a" metalness={0.9} />
                  </mesh>
                </group>
              ) : (
                /* HVAC Compressor Unit with Fan Grill */
                <group>
                  <mesh castShadow receiveShadow>
                    <boxGeometry args={[eq.size.x, eq.size.y, eq.size.z]} />
                    <meshStandardMaterial color="#1e293b" metalness={0.85} roughness={0.3} />
                  </mesh>
                  {/* Circular Ventilation Fan Grill on top */}
                  <mesh position={[0, eq.size.y / 2 + 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                    <circleGeometry args={[Math.min(eq.size.x, eq.size.z) * 0.35, 12]} />
                    <meshBasicMaterial color="#00f0ff" wireframe />
                  </mesh>
                </group>
              )}
            </group>
          ))}
        </group>
      ))}

      {/* 6. Street Lights Along Sidewalks */}
      {cityData.streetlights.map((sl, idx) => (
        <group key={`sl-${idx}`} position={sl.position} rotation={[0, sl.rotationY, 0]}>
          {/* Lamp Post Base */}
          <mesh position={[0, 0.3, 0]} castShadow>
            <cylinderGeometry args={[0.2, 0.25, 0.6, 8]} />
            <meshStandardMaterial color="#0b1322" metalness={0.9} />
          </mesh>
          {/* Vertical Pole */}
          <mesh position={[0, 3.2, 0]} castShadow>
            <cylinderGeometry args={[0.08, 0.1, 5.8, 8]} />
            <meshStandardMaterial color="#1e293b" metalness={0.85} />
          </mesh>
          {/* Curved Arm Overhang */}
          <mesh position={[0.8, 6.0, 0]} rotation={[0, 0, -Math.PI / 4]} castShadow>
            <cylinderGeometry args={[0.06, 0.08, 1.8, 8]} />
            <meshStandardMaterial color="#1e293b" metalness={0.85} />
          </mesh>
          {/* Luminaire Head */}
          <mesh position={[1.4, 6.4, 0]} geometry={SHARED_UNIT_BOX} scale={[0.8, 0.15, 0.3]}>
            <meshStandardMaterial color="#0f172a" metalness={0.9} />
          </mesh>
          {/* Glowing Emissive Light Diffuser */}
          <mesh position={[1.4, 6.32, 0]} geometry={SHARED_UNIT_BOX} scale={[0.65, 0.04, 0.22]}>
            <meshBasicMaterial color={timeState.nightFactor > 0.3 ? '#00f0ff' : '#083344'} />
          </mesh>
          {/* Localized point light on street lamps adhering to quality maxLights budget */}
          {quality.maxLights >= 16 && quality.nightLightsEnabled && idx % 4 === 0 && (
            <pointLight
              position={[1.4, 5.8, 0]}
              color="#00f0ff"
              distance={24}
              decay={2}
              intensity={0.2 + timeState.nightFactor * 2.8}
            />
          )}
        </group>
      ))}

      {/* 7. Procedural Trees & Street Planters with Dynamic Wind Sway */}
      {trees.map((tree) => (
        <ProceduralTree key={tree.id} tree={tree} registerGlobalCollider={true} />
      ))}

      {/* 8. Dynamic Wind-Driven Falling Leaves Particle System */}
      <FallingLeaves trees={trees} count={800} />

      {/* 9. Giant Skyscraper Dynamic Cyber-Video Billboards */}
      {/* Central Plaza North Facade Billboard (Channel 1: Nexus 24 Live News with ticker & globe) */}
      <CyberVideoBillboard
        position={[0, 18, -28]}
        rotationY={0}
        width={22}
        height={13}
        channel={1}
      />

      {/* Apex Tower East Avenue Facade Billboard (Channel 2: Cyber-Corp Commercial Adverts) */}
      <CyberVideoBillboard
        position={[22, 18, 0]}
        rotationY={-Math.PI / 2}
        width={20}
        height={12}
        channel={2}
      />

      {/* Neon Lounge West Avenue Facade Billboard (Channel 3: Metropolis Grid Surveillance & Matrix) */}
      <CyberVideoBillboard
        position={[-22, 18, 0]}
        rotationY={Math.PI / 2}
        width={20}
        height={12}
        channel={3}
      />

      {/* South Plaza Facade Billboard (Channel 1: Live News Ticker) */}
      <CyberVideoBillboard
        position={[0, 18, 32]}
        rotationY={Math.PI}
        width={22}
        height={13}
        channel={1}
      />
    </group>
  );
};
