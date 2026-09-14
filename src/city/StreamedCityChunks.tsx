import React, { useEffect, useState, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ChunkManager, ChunkInfo, ChunkLOD } from '../world/ChunkManager';
import { ProceduralChunkGenerator, StreamedChunkData, StreamedBuildingDef } from './ProceduralChunkGenerator';
import { ProceduralTree } from './ProceduralTree';
import { KinematicCollisionSolver } from '../player/KinematicCollision';
import { ProceduralTextures } from '../core/ProceduralTextures';
import { WeatherSystem } from '../world/WeatherSystem';

// Shared static unit geometries to eliminate redundant GPU buffer allocations
const SHARED_UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const SHARED_UNIT_CYLINDER = new THREE.CylinderGeometry(0.5, 0.5, 1, 6);
const SHARED_BEACON_SPHERE = new THREE.SphereGeometry(0.7, 8, 8);
const SHARED_SMALL_SPHERE = new THREE.SphereGeometry(0.2, 6, 6);

// Sub-component for individual building rendering by LOD
const StreamedBuilding: React.FC<{
  building: StreamedBuildingDef;
  lod: ChunkLOD;
  claddingNormal: THREE.CanvasTexture;
}> = React.memo(({ building, lod, claddingNormal }) => {
  const { position, size, color, accentColor, emissiveColor, tiers, antenna } = building;

  if (lod === 'LOW') {
    // Low LOD: Single massing volume with atmospheric styling using shared unit box
    return (
      <mesh
        position={[position.x, size.y / 2, position.z]}
        geometry={SHARED_UNIT_BOX}
        scale={[size.x, size.y, size.z]}
      >
        <meshStandardMaterial
          color={color}
          roughness={0.8}
          metalness={0.3}
        />
      </mesh>
    );
  }

  // High and Medium LOD: Tiered architecture
  return (
    <group position={[position.x, 0, position.z]}>
      {tiers.map((tier, idx) => (
        <group key={idx} position={[tier.offset.x, tier.offset.y, tier.offset.z]}>
          {/* Main Tier Body */}
          <mesh
            geometry={SHARED_UNIT_BOX}
            scale={[tier.size.x, tier.size.y, tier.size.z]}
            castShadow={lod === 'HIGH'}
            receiveShadow
          >
            <meshStandardMaterial
              color={color}
              normalMap={lod === 'HIGH' ? claddingNormal : undefined}
              normalScale={new THREE.Vector2(0.5, 0.5)}
              roughness={0.4}
              metalness={0.7}
            />
          </mesh>

          {/* High LOD: Cyber Accent Band & Emissive Window Bands */}
          {lod === 'HIGH' && (
            <>
              {/* Perimeter glowing neon trim */}
              <mesh
                position={[0, tier.size.y / 2 - 0.2, 0]}
                geometry={SHARED_UNIT_BOX}
                scale={[tier.size.x + 0.15, 0.4, tier.size.z + 0.15]}
              >
                <meshStandardMaterial
                  color={accentColor}
                  emissive={accentColor}
                  emissiveIntensity={1.2}
                  roughness={0.2}
                />
              </mesh>

              {/* Mid-tower horizontal data stripe */}
              <mesh
                position={[0, 0, 0]}
                geometry={SHARED_UNIT_BOX}
                scale={[tier.size.x + 0.08, 0.6, tier.size.z + 0.08]}
              >
                <meshStandardMaterial
                  color={emissiveColor}
                  emissive={emissiveColor}
                  emissiveIntensity={0.8}
                  roughness={0.3}
                />
              </mesh>
            </>
          )}

          {/* Medium LOD: Simplified trim */}
          {lod === 'MEDIUM' && (
            <mesh
              position={[0, tier.size.y / 2 - 0.3, 0]}
              geometry={SHARED_UNIT_BOX}
              scale={[tier.size.x + 0.1, 0.6, tier.size.z + 0.1]}
            >
              <meshStandardMaterial
                color={accentColor}
                emissive={accentColor}
                emissiveIntensity={0.6}
              />
            </mesh>
          )}
        </group>
      ))}

      {/* Rooftop Antenna Spire */}
      {antenna && (
        <group position={[0, size.y, 0]}>
          <mesh
            position={[0, antenna.height / 2, 0]}
            geometry={SHARED_UNIT_CYLINDER}
            scale={[0.6, antenna.height, 0.6]}
          >
            <meshStandardMaterial color="#475569" metalness={0.9} roughness={0.2} />
          </mesh>
          {/* Pulsing Beacon Light on Top */}
          <mesh position={[0, antenna.height + 0.5, 0]} geometry={SHARED_BEACON_SPHERE}>
            <meshBasicMaterial color={antenna.beaconColor} />
          </mesh>
        </group>
      )}
    </group>
  );
});

// Sub-component for individual chunk
const StreamedChunkView: React.FC<{
  chunkInfo: ChunkInfo;
  wetnessFactor: number;
  asphaltNormal: THREE.CanvasTexture;
  claddingNormal: THREE.CanvasTexture;
}> = React.memo(({ chunkInfo, wetnessFactor, asphaltNormal, claddingNormal }) => {
  const data: StreamedChunkData = useMemo(() => {
    return ProceduralChunkGenerator.getChunkData(chunkInfo.cx, chunkInfo.cz);
  }, [chunkInfo.cx, chunkInfo.cz]);

  // Sync kinematic colliders when chunk is in HIGH LOD
  useEffect(() => {
    if (chunkInfo.lod === 'HIGH' && data.collisionBoxes.length > 0) {
      KinematicCollisionSolver.setChunkBoxes(data.key, data.collisionBoxes);
    } else {
      KinematicCollisionSolver.removeChunkBoxes(data.key);
    }

    return () => {
      KinematicCollisionSolver.removeChunkBoxes(data.key);
    };
  }, [chunkInfo.lod, data.key, data.collisionBoxes]);

  // If central core or completely empty, don't render
  if (data.buildings.length === 0 && data.roads.length === 0) {
    return null;
  }

  const roadRoughness = THREE.MathUtils.lerp(0.65, 0.12, wetnessFactor);
  const roadMetalness = THREE.MathUtils.lerp(0.4, 0.85, wetnessFactor);
  const sidewalkRoughness = THREE.MathUtils.lerp(0.7, 0.22, wetnessFactor);
  const sidewalkMetalness = THREE.MathUtils.lerp(0.2, 0.55, wetnessFactor);

  return (
    <group name={`Chunk_${data.key}_LOD_${chunkInfo.lod}`}>
      {/* 1. Roads (HIGH and MEDIUM LOD) with PBR normal and wetness response */}
      {chunkInfo.lod !== 'LOW' &&
        data.roads.map((road, rIdx) => (
          <mesh
            key={`r-${rIdx}`}
            position={road.position}
            rotation={[0, road.rotationY, 0]}
            geometry={SHARED_UNIT_BOX}
            scale={[road.size.x, road.size.y, road.size.z]}
            receiveShadow
          >
            <meshStandardMaterial
              color="#0a0f1d"
              normalMap={chunkInfo.lod === 'HIGH' ? asphaltNormal : undefined}
              normalScale={new THREE.Vector2(0.6, 0.6)}
              roughness={roadRoughness}
              metalness={roadMetalness}
              envMapIntensity={wetnessFactor > 0.1 ? 1.4 : 0.8}
            />
          </mesh>
        ))}

      {/* 2. Sidewalk Pads (HIGH LOD only) */}
      {chunkInfo.lod === 'HIGH' &&
        data.sidewalks.map((sw, sIdx) => (
          <mesh
            key={`sw-${sIdx}`}
            position={sw.position}
            geometry={SHARED_UNIT_BOX}
            scale={[sw.size.x, sw.size.y, sw.size.z]}
            receiveShadow
          >
            <meshStandardMaterial
              color="#131b2e"
              normalMap={asphaltNormal}
              normalScale={new THREE.Vector2(0.3, 0.3)}
              roughness={sidewalkRoughness}
              metalness={sidewalkMetalness}
            />
          </mesh>
        ))}

      {/* 3. Buildings */}
      {data.buildings.map((bldg) => (
        <StreamedBuilding
          key={bldg.id}
          building={bldg}
          lod={chunkInfo.lod}
          claddingNormal={claddingNormal}
        />
      ))}

      {/* 4. High-LOD Pocket Parks */}
      {chunkInfo.lod === 'HIGH' &&
        data.parks.map((park) => (
          <group key={park.id} position={park.position}>
            {/* Lawn Base */}
            <mesh
              receiveShadow
              position={[0, 0.06, 0]}
              geometry={SHARED_UNIT_BOX}
              scale={[park.size.x, 0.12, park.size.z]}
            >
              <meshStandardMaterial color="#062e1a" roughness={0.8} />
            </mesh>
            {/* Perimeter Retaining Walls */}
            <mesh
              position={[0, 0.5, -park.size.z / 2]}
              geometry={SHARED_UNIT_BOX}
              scale={[park.size.x, 1.0, 0.8]}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.3} />
            </mesh>
            <mesh
              position={[0, 0.5, park.size.z / 2]}
              geometry={SHARED_UNIT_BOX}
              scale={[park.size.x, 1.0, 0.8]}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.3} />
            </mesh>
            {/* Water Basin / Fountain */}
            {park.hasPond && (
              <group position={[0, 0.1, 0]}>
                <mesh position={[0, 0.18, 0]} receiveShadow>
                  <cylinderGeometry args={[park.pondRadius + 0.3, park.pondRadius + 0.5, 0.36, 20]} />
                  <meshStandardMaterial color="#0f172a" metalness={0.8} roughness={0.3} />
                </mesh>
                <mesh position={[0, 0.3, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                  <circleGeometry args={[park.pondRadius, 20]} />
                  <meshStandardMaterial color="#022c22" roughness={0.06} metalness={0.9} />
                </mesh>
                <mesh position={[0, 0.45, 0]} geometry={SHARED_SMALL_SPHERE} scale={[2.0, 2.0, 2.0]}>
                  <meshBasicMaterial color={park.fountainColor} />
                </mesh>
              </group>
            )}
            {/* Park Benches */}
            {park.benches.map((bench, bIdx) => (
              <group
                key={`p-bench-${bIdx}`}
                position={[bench.position.x - park.position.x, 0.2, bench.position.z - park.position.z]}
                rotation={[0, bench.rotationY, 0]}
              >
                <mesh
                  castShadow
                  position={[0, 0.38, 0]}
                  geometry={SHARED_UNIT_BOX}
                  scale={[2.0, 0.08, 0.6]}
                >
                  <meshStandardMaterial color="#78350f" roughness={0.6} />
                </mesh>
                <mesh
                  position={[0, 0.32, 0]}
                  geometry={SHARED_UNIT_BOX}
                  scale={[1.9, 0.04, 0.04]}
                >
                  <meshBasicMaterial color={park.fountainColor} />
                </mesh>
              </group>
            ))}
            {/* Park Trees */}
            {park.trees.map((t) => (
              <ProceduralTree key={t.id} tree={t} />
            ))}
            {/* Park Bushes */}
            {park.bushes.map((b) => (
              <group key={b.id} position={[b.position.x - park.position.x, b.position.y, b.position.z - park.position.z]}>
                <mesh
                  castShadow
                  receiveShadow
                  geometry={SHARED_UNIT_BOX}
                  scale={[b.size.x, b.size.y, b.size.z]}
                >
                  <meshStandardMaterial color={b.color} roughness={0.7} />
                </mesh>
                {b.hasFlowers && b.flowerColor && (
                  <mesh position={[0, b.size.y / 2 + 0.05, 0]} geometry={SHARED_SMALL_SPHERE}>
                    <meshBasicMaterial color={b.flowerColor} />
                  </mesh>
                )}
              </group>
            ))}
          </group>
        ))}

      {/* 5. Sidewalk Trees & Avenue Planters (HIGH LOD only) */}
      {chunkInfo.lod === 'HIGH' &&
        data.trees.map((tree) => (
          <ProceduralTree key={tree.id} tree={tree} />
        ))}

      {/* 6. Sidewalk Bushes & Hedges (HIGH LOD only) */}
      {chunkInfo.lod === 'HIGH' &&
        data.bushes.map((bush) => (
          <group key={bush.id} position={bush.position}>
            <mesh
              castShadow
              receiveShadow
              geometry={SHARED_UNIT_BOX}
              scale={[bush.size.x, bush.size.y, bush.size.z]}
            >
              <meshStandardMaterial color={bush.color} roughness={0.7} />
            </mesh>
            {bush.hasFlowers && bush.flowerColor && (
              <mesh position={[0, bush.size.y / 2 + 0.05, 0]} geometry={SHARED_SMALL_SPHERE}>
                <meshBasicMaterial color={bush.flowerColor} />
              </mesh>
            )}
          </group>
        ))}
    </group>
  );
});

export const StreamedCityChunks: React.FC = () => {
  const [activeChunks, setActiveChunks] = useState<ChunkInfo[]>(() => {
    return ChunkManager.getInstance()
      .getActiveChunks()
      .filter((c) => Math.abs(c.cx) > 1 || Math.abs(c.cz) > 1);
  });

  const [weatherState, setWeatherState] = useState(() =>
    WeatherSystem.getInstance().getState()
  );

  const asphaltNormal = useMemo(() => ProceduralTextures.getAsphaltNormalMap(), []);
  const claddingNormal = useMemo(() => ProceduralTextures.getBuildingCladdingNormalMap(), []);

  const prevKeysRef = useRef<string>('');

  useEffect(() => {
    const unsubWeather = WeatherSystem.getInstance().subscribe(setWeatherState);
    const unsubChunks = ChunkManager.getInstance().subscribe((state) => {
      // Filter out central 3x3 core (handled by CityDistrict) and unloaded chunks
      const active = state.chunks.filter(
        (c) => c.lod !== 'UNLOADED' && (Math.abs(c.cx) > 1 || Math.abs(c.cz) > 1)
      );

      // Create a stable fingerprint: keys + lod
      const fingerprint = active.map((c) => `${c.key}:${c.lod}`).sort().join('|');
      if (fingerprint !== prevKeysRef.current) {
        prevKeysRef.current = fingerprint;
        setActiveChunks(active);
      }
    });

    return () => {
      unsubWeather();
      unsubChunks();
      // Clean up all chunk collision boxes when unmounted
      const allActive = ChunkManager.getInstance().getActiveChunks();
      for (const c of allActive) {
        KinematicCollisionSolver.removeChunkBoxes(c.key);
      }
    };
  }, []);

  return (
    <group name="StreamedCityChunksLayer">
      {activeChunks.map((chunk) => (
        <StreamedChunkView
          key={chunk.key}
          chunkInfo={chunk}
          wetnessFactor={weatherState.wetnessFactor}
          asphaltNormal={asphaltNormal}
          claddingNormal={claddingNormal}
        />
      ))}
    </group>
  );
};
