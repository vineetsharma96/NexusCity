import React, { useMemo, useState, useEffect } from 'react';
import * as THREE from 'three';
import { CityGenerator, CityData } from './CityGenerator';
import { RoadGenerator } from './RoadGenerator';
import { VegetationGenerator, TreeDef } from './VegetationGenerator';
import { FallingLeaves } from './FallingLeaves';
import { CyberVideoBillboard } from './CyberVideoBillboard';
import { ProceduralTextures } from '../core/ProceduralTextures';
import { TimeSystem, TimeLightingState } from '../world/TimeSystem';
import { WeatherSystem, WeatherState } from '../world/WeatherSystem';

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

  useEffect(() => {
    const unsubTime = TimeSystem.getInstance().subscribe(setTimeState);
    const unsubWeather = WeatherSystem.getInstance().subscribe(setWeatherState);
    return () => {
      unsubTime();
      unsubWeather();
    };
  }, []);

  // Dynamic surface wetness calculations
  const roadRoughness = THREE.MathUtils.lerp(0.35, 0.08, weatherState.wetnessFactor);
  const roadMetalness = THREE.MathUtils.lerp(0.65, 0.88, weatherState.wetnessFactor);
  const sidewalkRoughness = THREE.MathUtils.lerp(0.6, 0.18, weatherState.wetnessFactor);
  const sidewalkMetalness = THREE.MathUtils.lerp(0.3, 0.6, weatherState.wetnessFactor);

  // Procedural textures
  const asphaltTex = useMemo(() => RoadGenerator.getAsphaltTexture(), []);
  const sidewalkTex = useMemo(() => RoadGenerator.getSidewalkTexture(), []);
  const facadeTex = useMemo(() => ProceduralTextures.getBuildingFacadeTexture(0.65), []);
  const plazaTex = useMemo(() => ProceduralTextures.getPlazaGridTexture(), []);

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
          roughness={sidewalkRoughness * 0.8}
          metalness={sidewalkMetalness}
        />
      </mesh>

      {/* 3. Road Avenues */}
      {cityData.avenues.map((ave, idx) => (
        <mesh
          key={`ave-${idx}`}
          position={ave.position}
          rotation={[0, ave.rotationY, 0]}
          receiveShadow
        >
          <boxGeometry args={[ave.size.x, ave.size.y, ave.size.z]} />
          <meshStandardMaterial
            map={asphaltTex}
            roughness={roadRoughness}
            metalness={roadMetalness}
          />
        </mesh>
      ))}

      {/* 4. Raised Sidewalk Slabs */}
      {cityData.sidewalks.map((sw, idx) => (
        <mesh key={`sw-${idx}`} position={sw.position} receiveShadow castShadow>
          <boxGeometry args={[sw.size.x, sw.size.y, sw.size.z]} />
          <meshStandardMaterial
            map={sidewalkTex}
            roughness={sidewalkRoughness}
            metalness={sidewalkMetalness}
          />
        </mesh>
      ))}

      {/* 5. Procedural Buildings */}
      {cityData.buildings.map((bldg) => (
        <group key={bldg.id} position={bldg.position}>
          {/* Tiers / Main Building Volumes */}
          {bldg.tiers.map((tier, tIdx) => (
            <mesh
              key={`tier-${tIdx}`}
              position={tier.offset}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[tier.size.x, tier.size.y, tier.size.z]} />
              <meshStandardMaterial
                map={facadeTex}
                roughness={0.35}
                metalness={0.8}
              />
            </mesh>
          ))}

          {/* Storefront Arcade at Street Level */}
          <mesh position={[0, 2.2, bldg.totalSize.z / 2 + 0.05]} castShadow>
            <boxGeometry args={[bldg.totalSize.x * 0.7, 4.4, 0.4]} />
            <meshStandardMaterial
              color="#091428"
              emissive={bldg.storefrontColor}
              emissiveIntensity={0.25}
              metalness={0.9}
              roughness={0.2}
            />
          </mesh>
          {/* Glowing Storefront Sign Header */}
          <mesh position={[0, 4.2, bldg.totalSize.z / 2 + 0.3]}>
            <boxGeometry args={[bldg.totalSize.x * 0.5, 0.6, 0.1]} />
            <meshBasicMaterial color={bldg.storefrontColor} />
          </mesh>

          {/* Vertical Neon Architectural Light Strips */}
          {bldg.lightStrips.map((strip, sIdx) => (
            <mesh key={`strip-${sIdx}`} position={strip.position}>
              <boxGeometry args={[strip.size.x, strip.size.y, strip.size.z]} />
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
          <mesh position={[1.4, 6.4, 0]}>
            <boxGeometry args={[0.8, 0.15, 0.3]} />
            <meshStandardMaterial color="#0f172a" metalness={0.9} />
          </mesh>
          {/* Glowing Emissive Light Diffuser */}
          <mesh position={[1.4, 6.32, 0]}>
            <boxGeometry args={[0.65, 0.04, 0.22]} />
            <meshBasicMaterial color={timeState.nightFactor > 0.3 ? '#00f0ff' : '#083344'} />
          </mesh>
          {/* Localized point light on every 3rd street lamp for high-performance ambient illumination */}
          {idx % 3 === 0 && (
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

      {/* 7. Procedural Trees & Street Planters */}
      {trees.map((tree) => (
        <group key={tree.id} position={tree.position}>
          {/* Sidewalk Planter Curb */}
          <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
            <boxGeometry args={[tree.planterSize.x, tree.planterSize.y, tree.planterSize.z]} />
            <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.2} />
          </mesh>
          {/* Mulch / Soil Bed */}
          <mesh position={[0, 0.38, 0]}>
            <boxGeometry args={[tree.planterSize.x - 0.3, 0.05, tree.planterSize.z - 0.3]} />
            <meshStandardMaterial color="#1a1410" roughness={0.9} />
          </mesh>
          {/* Decorative Corner Planter Neon Trim */}
          <mesh position={[0, 0.41, tree.planterSize.z / 2]}>
            <boxGeometry args={[tree.planterSize.x, 0.04, 0.04]} />
            <meshBasicMaterial color="#00ffaa" />
          </mesh>

          {/* Tree Trunk */}
          <mesh position={[0, tree.trunkHeight / 2, 0]} castShadow receiveShadow>
            <cylinderGeometry
              args={[tree.trunkRadius * 0.7, tree.trunkRadius, tree.trunkHeight, 8]}
            />
            <meshStandardMaterial color="#2d2218" roughness={0.8} metalness={0.1} />
          </mesh>

          {/* Organic Branches */}
          {tree.branches.map((b, bIdx) => {
            const mid = b.start.clone().add(b.end).multiplyScalar(0.5);
            const len = b.start.distanceTo(b.end);
            const dir = b.end.clone().sub(b.start).normalize();
            const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);

            return (
              <mesh
                key={`b-${bIdx}`}
                position={mid}
                quaternion={quat}
                castShadow
              >
                <cylinderGeometry args={[b.radius * 0.7, b.radius, len, 6]} />
                <meshStandardMaterial color="#2d2218" roughness={0.8} />
              </mesh>
            );
          })}

          {/* Faceted Volumetric Leaf Canopy Clusters */}
          {tree.leafClusters.map((lc, lcIdx) => (
            <mesh
              key={`lc-${lcIdx}`}
              position={lc.offset}
              scale={lc.scale}
              castShadow
              receiveShadow
            >
              <dodecahedronGeometry args={[1, 1]} />
              <meshStandardMaterial
                color={lc.color}
                roughness={0.5}
                metalness={0.05}
                flatShading
              />
            </mesh>
          ))}
        </group>
      ))}

      {/* 8. Dynamic Wind-Driven Falling Leaves Particle System */}
      <FallingLeaves trees={trees} count={800} />

      {/* 9. Giant Skyscraper Dynamic Cyber-Video Billboards */}
      {/* Central Plaza North Facade Billboard (Channel 1: Nexus 24 Live News with ticker & globe) */}
      <CyberVideoBillboard
        position={[0, 22, -26]}
        rotationY={0}
        width={22}
        height={13}
        channel={1}
      />

      {/* Apex Tower East Avenue Facade Billboard (Channel 2: Cyber-Corp Commercial Adverts) */}
      <CyberVideoBillboard
        position={[24, 28, 0]}
        rotationY={-Math.PI / 2}
        width={18}
        height={11}
        channel={2}
      />

      {/* Neon Lounge West Avenue Facade Billboard (Channel 3: Metropolis Grid Surveillance & Matrix) */}
      <CyberVideoBillboard
        position={[-24, 26, 0]}
        rotationY={Math.PI / 2}
        width={18}
        height={11}
        channel={3}
      />
    </group>
  );
};
