import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { ChunkInfo, ChunkLOD, ChunkManager } from '../world/ChunkManager';
import {
  BiomePropDef,
  PocketParkDef,
  ProceduralChunkGenerator,
  StreamedBuildingDef,
  StreamedChunkData,
  StreetFurnitureDef,
} from './ProceduralChunkGenerator';
import { PlanterBushDef } from './VegetationGenerator';
import { ProceduralTree } from './ProceduralTree';
import { RoadGenerator } from './RoadGenerator';
import { KinematicCollisionSolver } from '../player/KinematicCollision';
import { FacadeStyleVariant, ProceduralTextures } from '../core/ProceduralTextures';
import { WeatherSystem } from '../world/WeatherSystem';
import { TimeSystem } from '../world/TimeSystem';
import { QualityManager, QualitySettings } from '../rendering/QualityManager';

const SHARED_UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const SHARED_UNIT_CYLINDER = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
const SHARED_TAPER_POLE = new THREE.CylinderGeometry(0.08, 0.15, 1, 8);
const SHARED_OCT_PLINTH = new THREE.CylinderGeometry(0.28, 0.38, 1, 8);
const SHARED_BOLLARD_CAP = new THREE.CylinderGeometry(0.08, 0.14, 1, 8);
const SHARED_BEACON_SPHERE = new THREE.SphereGeometry(0.65, 8, 8);
const SHARED_DOME_CAP = new THREE.SphereGeometry(0.5, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.5);
const STREAMED_GLASS_MAT = new THREE.MeshStandardMaterial({
  color: '#0f2238',
  metalness: 0.92,
  roughness: 0.08,
  transparent: true,
  opacity: 0.48,
});
const STREAMED_TIMBER_MAT = new THREE.MeshStandardMaterial({ color: '#6b4226', metalness: 0.08, roughness: 0.72 });
const STREAMED_CONCRETE_MAT = new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.22, roughness: 0.78 });
const STREAMED_CHROME_MAT = new THREE.MeshStandardMaterial({ color: '#94a3b8', metalness: 0.94, roughness: 0.18 });
const CLADDING_NORMAL_SCALE = new THREE.Vector2(0.55, 0.55);

const chunkStdMatCache = new Map<string, THREE.MeshStandardMaterial>();
function getChunkStdMat(color: string, metalness: number = 0.85, roughness: number = 0.25): THREE.MeshStandardMaterial {
  const key = `${color}|${metalness}|${roughness}`;
  let m = chunkStdMatCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, metalness, roughness });
    chunkStdMatCache.set(key, m);
  }
  return m;
}

const chunkEmissiveMatCache = new Map<string, THREE.MeshStandardMaterial>();
function getChunkEmissiveMat(
  color: string,
  emissive: string,
  emissiveIntensity: number
): THREE.MeshStandardMaterial {
  const key = `${color}|${emissive}|${emissiveIntensity}`;
  let m = chunkEmissiveMatCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      emissive,
      emissiveIntensity,
      metalness: 0.9,
      roughness: 0.18,
    });
    chunkEmissiveMatCache.set(key, m);
  }
  return m;
}

const chunkBasicMatCache = new Map<string, THREE.MeshBasicMaterial>();
function getChunkBasicMat(color: string): THREE.MeshBasicMaterial {
  let m = chunkBasicMatCache.get(color);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color });
    chunkBasicMatCache.set(color, m);
  }
  return m;
}

const chunkBloomMatCache = new Map<string, THREE.MeshBasicMaterial>();
function getChunkBloomMat(color: string, boost: number = 2.0): THREE.MeshBasicMaterial {
  const key = `${color}|${boost.toFixed(2)}`;
  let m = chunkBloomMatCache.get(key);
  if (!m) {
    const hdrColor = new THREE.Color(color).multiplyScalar(boost);
    m = new THREE.MeshBasicMaterial({ color: hdrColor, toneMapped: false });
    chunkBloomMatCache.set(key, m);
  }
  return m;
}

const LowDetailChunks: React.FC<{
  chunks: ChunkInfo[];
  facadeTex: THREE.CanvasTexture;
  emissiveTex: THREE.CanvasTexture;
  emissiveIntensity: number;
}> = React.memo(({ chunks, facadeTex, emissiveTex, emissiveIntensity }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const buildings = useMemo(
    () => chunks.flatMap((c) => ProceduralChunkGenerator.getChunkData(c.cx, c.cz).buildings),
    [chunks]
  );

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    const white = new THREE.Color('#ffffff');
    buildings.forEach((b, idx) => {
      dummy.position.set(b.position.x, b.size.y / 2, b.position.z);
      dummy.scale.copy(b.size);
      dummy.updateMatrix();
      mesh.setMatrixAt(idx, dummy.matrix);
      mesh.setColorAt(idx, col.set(b.color).lerp(white, 0.65));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [buildings]);

  if (buildings.length === 0) return null;
  return (
    <instancedMesh ref={meshRef} args={[SHARED_UNIT_BOX, undefined, buildings.length]}>
      <meshStandardMaterial
        map={facadeTex}
        emissive="#ffffff"
        emissiveMap={emissiveTex}
        emissiveIntensity={emissiveIntensity}
        color="#ffffff"
        roughness={0.55}
        metalness={0.55}
      />
    </instancedMesh>
  );
});

const StreamedBuilding: React.FC<{
  building: StreamedBuildingDef;
  lod: ChunkLOD;
  facadeTextures: Record<FacadeStyleVariant, THREE.CanvasTexture>;
  facadeEmissiveTextures: Record<FacadeStyleVariant, THREE.CanvasTexture>;
  facadeEmissiveIntensity: number;
  nightBucket: number;
  claddingNormal?: THREE.CanvasTexture;
  shadows: boolean;
  envScale: number;
}> = React.memo(
  ({
    building,
    lod,
    facadeTextures,
    facadeEmissiveTextures,
    facadeEmissiveIntensity,
    nightBucket,
    claddingNormal,
    shadows,
    envScale,
  }) => {
    const { position, size, accentColor, emissiveColor, facadeVariant, tiers, antenna } = building;
    const facadeTex = facadeTextures[facadeVariant] || facadeTextures.CURTAIN_GLASS;
    const emissiveTex = facadeEmissiveTextures[facadeVariant] || facadeEmissiveTextures.CURTAIN_GLASS;
    const isHigh = lod === 'HIGH';
    const topTier = tiers[tiers.length - 1];
    const podiumMat = getChunkStdMat('#0b1120', 0.88, 0.26);
    const canopyMat = getChunkStdMat('#0f172a', 0.9, 0.2);
    const colMat = getChunkStdMat('#0b1120', 0.92, 0.22);
    const finMat = getChunkStdMat('#111c33', 0.9, 0.22);
    const mastMat = getChunkStdMat('#475569', 0.9, 0.2);
    const neonBoost = Number((0.95 + nightBucket * 1.25).toFixed(2));
    const storefrontIntensity = Number((0.26 + nightBucket * 1.1).toFixed(2));
    const crownIntensity = Number((0.3 + nightBucket * 1.35).toFixed(2));
    const storefrontMatA = getChunkEmissiveMat('#09111f', accentColor, storefrontIntensity);
    const storefrontMatB = getChunkEmissiveMat('#09111f', emissiveColor, storefrontIntensity);
    const crownMat = getChunkEmissiveMat('#0b1326', accentColor, crownIntensity);
    const accentBasicMat = getChunkBloomMat(accentColor, neonBoost);
    const emissiveBasicMat = getChunkBloomMat(emissiveColor, neonBoost);

    return (
      <group position={[position.x, 0, position.z]}>
        {/* Wrap-Around Street-Level Podium & 4-Sided Illuminated Storefront (staggered height for zero Z-fighting) */}
        <mesh
          position={[0, 2.4, 0]}
          geometry={SHARED_UNIT_BOX}
          material={podiumMat}
          scale={[size.x + 0.7, 4.8, size.z + 0.7]}
          receiveShadow={shadows}
        />
        <mesh
          position={[0, 2.1, 0]}
          geometry={SHARED_UNIT_BOX}
          material={storefrontMatA}
          scale={[size.x * 0.74, 3.8, size.z + 0.85]}
        />
        <mesh
          position={[0, 2.08, 0]}
          geometry={SHARED_UNIT_BOX}
          material={storefrontMatB}
          scale={[size.x + 0.85, 3.72, size.z * 0.74]}
        />
        {/* Cantilevered Podium Canopy */}
        <mesh
          position={[0, 4.7, 0]}
          geometry={SHARED_UNIT_BOX}
          material={canopyMat}
          scale={[size.x + 1.8, 0.25, size.z + 1.8]}
        />

        {/* Stepped Architectural Tiers */}
        {tiers.map((tier, idx) => {
          const tw = tier.size.x;
          const th = tier.size.y;
          const td = tier.size.z;
          return (
            <group key={idx} position={[tier.offset.x, tier.offset.y, tier.offset.z]}>
              <mesh
                geometry={SHARED_UNIT_BOX}
                scale={[tw, th, td]}
                castShadow={shadows && isHigh}
                receiveShadow={shadows}
              >
                <meshStandardMaterial
                  map={facadeTex}
                  emissive="#ffffff"
                  emissiveMap={emissiveTex}
                  emissiveIntensity={facadeEmissiveIntensity}
                  normalMap={isHigh ? claddingNormal : undefined}
                  normalScale={CLADDING_NORMAL_SCALE}
                  roughness={0.3}
                  metalness={0.84}
                  envMapIntensity={envScale}
                />
              </mesh>

              {/* 4 Corner Structural Exoskeleton Columns & Staggered Center Brise-Soleil Fins on High LOD */}
              {isHigh && (
                <>
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
                      position={[(cx * tw) / 2, 0, (cz * td) / 2]}
                      geometry={SHARED_UNIT_BOX}
                      material={colMat}
                      scale={[0.7, th, 0.7]}
                    />
                  ))}
                  <mesh geometry={SHARED_UNIT_BOX} material={finMat} scale={[0.3, th * 0.94, td + 0.32]} />
                  <mesh geometry={SHARED_UNIT_BOX} material={finMat} scale={[tw + 0.32, th * 0.92, 0.3]} />
                </>
              )}

              {/* Tier Cornice Light Band */}
              <mesh
                position={[0, th / 2 - 0.25, 0]}
                geometry={SHARED_UNIT_BOX}
                material={idx % 2 === 0 ? accentBasicMat : emissiveBasicMat}
                scale={[tw + 0.22, 0.42, td + 0.22]}
              />
            </group>
          );
        })}

      {/* Sculpted Rooftop Lantern Crown */}
      {topTier && (
        <mesh
          position={[0, size.y + 1.4, 0]}
          geometry={SHARED_UNIT_BOX}
          material={crownMat}
          scale={[topTier.size.x * 0.68, 2.6, topTier.size.z * 0.68]}
        />
      )}

      {/* Rooftop Spire & Aviation Beacon */}
      {antenna && (
        <group position={[0, size.y + 2.6, 0]}>
          <mesh
            position={[0, antenna.height / 2, 0]}
            geometry={SHARED_UNIT_CYLINDER}
            material={mastMat}
            scale={[0.45, antenna.height, 0.45]}
          />
          <mesh
            position={[0, antenna.height + 0.4, 0]}
            geometry={SHARED_BEACON_SPHERE}
            material={getChunkBloomMat(antenna.beaconColor, Number((1.2 + nightBucket * 1.6).toFixed(2)))}
          />
        </group>
      )}
    </group>
  );
});

const StreamedPocketPark: React.FC<{ park: PocketParkDef; vegetationEnabled: boolean }> = React.memo(
  ({ park, vegetationEnabled }) => (
    <group position={[park.position.x, 0, park.position.z]} name={park.id}>
      <mesh
        position={[0, 0.11, 0]}
        geometry={SHARED_UNIT_BOX}
        material={getChunkStdMat('#052e16', 0.08, 0.82)}
        scale={[park.size.x, park.size.y, park.size.z]}
      />
      {/* Recessed neon curb edge strip (top sits at 0.16, cleanly below lawn top 0.22 so only outer curb glows) */}
      <mesh
        position={[0, 0.14, 0]}
        geometry={SHARED_UNIT_BOX}
        material={getChunkBasicMat(park.fountainColor)}
        scale={[park.size.x + 0.14, 0.04, park.size.z + 0.14]}
      />
      {park.hasPond && (
        <group position={[0, 0.245, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[park.pondRadius - 0.08, park.pondRadius + 0.45, 24]} />
            <meshStandardMaterial
              color="#0f172a"
              roughness={0.3}
              metalness={0.82}
              polygonOffset
              polygonOffsetFactor={-1}
              polygonOffsetUnits={-1}
            />
          </mesh>
          <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[park.pondRadius, 24]} />
            <meshStandardMaterial
              color="#042f2e"
              emissive={park.fountainColor}
              emissiveIntensity={0.28}
              roughness={0.08}
              metalness={0.92}
              polygonOffset
              polygonOffsetFactor={-2}
              polygonOffsetUnits={-2}
            />
          </mesh>
          {/* Tiered Fluted Fountain Spire & Illuminated Halo */}
          <mesh
            position={[0, 0.25, 0]}
            geometry={SHARED_UNIT_CYLINDER}
            material={STREAMED_CONCRETE_MAT}
            scale={[1.65, 0.45, 1.65]}
          />
          <mesh
            position={[0, 1.15, 0]}
            geometry={SHARED_UNIT_CYLINDER}
            material={getChunkStdMat('#0f172a', 0.9, 0.2)}
            scale={[0.88, 1.9, 0.88]}
          />
          <mesh
            position={[0, 1.65, 0]}
            geometry={SHARED_UNIT_CYLINDER}
            material={STREAMED_CHROME_MAT}
            scale={[1.18, 0.14, 1.18]}
          />
          <mesh
            position={[0, 2.38, 0]}
            geometry={SHARED_BEACON_SPHERE}
            material={getChunkBloomMat(park.fountainColor, 1.8)}
            scale={[0.58, 0.58, 0.58]}
          />
        </group>
      )}
      {park.benches.map((b, idx) => (
        <group
          key={idx}
          position={[b.position.x - park.position.x, 0.22, b.position.z - park.position.z]}
          rotation={[0, b.rotationY, 0]}
        >
          <mesh position={[-0.82, 0.22, 0]} geometry={SHARED_UNIT_BOX} material={getChunkStdMat('#0f172a', 0.88, 0.24)} scale={[0.08, 0.44, 0.54]} />
          <mesh position={[0.82, 0.22, 0]} geometry={SHARED_UNIT_BOX} material={getChunkStdMat('#0f172a', 0.88, 0.24)} scale={[0.08, 0.44, 0.54]} />
          <mesh position={[0, 0.44, 0.08]} geometry={SHARED_UNIT_BOX} material={STREAMED_TIMBER_MAT} scale={[2.0, 0.07, 0.24]} />
          <mesh position={[0, 0.44, -0.14]} geometry={SHARED_UNIT_BOX} material={STREAMED_TIMBER_MAT} scale={[2.0, 0.07, 0.2]} />
          <mesh position={[0, 0.72, -0.26]} rotation={[-0.16, 0, 0]} geometry={SHARED_UNIT_BOX} material={STREAMED_TIMBER_MAT} scale={[2.0, 0.22, 0.06]} />
        </group>
      ))}
      {vegetationEnabled &&
        park.trees.map((t) => (
          <group key={t.id} position={[-park.position.x, 0, -park.position.z]}>
            <ProceduralTree tree={t} />
          </group>
        ))}
    </group>
  )
);

const StreamedBush: React.FC<{ bush: PlanterBushDef }> = React.memo(({ bush }) => (
  <group position={bush.position}>
    {/* Low Architectural Curb Planter Base */}
    <mesh
      position={[0, -bush.size.y * 0.34, 0]}
      geometry={SHARED_UNIT_BOX}
      material={STREAMED_CONCRETE_MAT}
      scale={[bush.size.x * 1.12, bush.size.y * 0.34, bush.size.z * 1.12]}
    />
    <mesh
      position={[0, -bush.size.y * 0.16, 0]}
      geometry={SHARED_UNIT_BOX}
      material={STREAMED_CHROME_MAT}
      scale={[bush.size.x * 1.15, 0.05, bush.size.z * 1.15]}
    />
    {/* Layered Hedge Crown */}
    <mesh
      position={[0, bush.size.y * 0.08, 0]}
      geometry={SHARED_UNIT_BOX}
      material={getChunkStdMat(bush.color, 0.1, 0.78)}
      scale={[bush.size.x, bush.size.y * 0.78, bush.size.z]}
    />
    <mesh
      position={[0, bush.size.y * 0.42, 0]}
      geometry={SHARED_UNIT_BOX}
      material={getChunkStdMat(bush.color, 0.08, 0.72)}
      scale={[bush.size.x * 0.76, bush.size.y * 0.34, bush.size.z * 0.76]}
    />
    {bush.hasFlowers && bush.flowerColor && (
      <mesh
        position={[0, bush.size.y * 0.62, 0]}
        geometry={SHARED_UNIT_BOX}
        material={getChunkBasicMat(bush.flowerColor)}
        scale={[bush.size.x * 0.62, 0.08, bush.size.z * 0.62]}
      />
    )}
  </group>
));

const StreamedFurniture: React.FC<{ furniture: StreetFurnitureDef; streetLightsOn: boolean; nightBucket: number }> = React.memo(
  ({ furniture, streetLightsOn, nightBucket }) => {
    const { type, position, rotationY, emissiveColor = '#f59e0b', accentColor = '#38bdf8' } = furniture;
    const neonBoost = Number((0.95 + nightBucket * 1.25).toFixed(2));
    const emissiveMat = getChunkBloomMat(emissiveColor, neonBoost);
    const accentMat = getChunkBloomMat(accentColor, neonBoost);
    const slateMat = getChunkStdMat('#1e293b', 0.85, 0.25);
    const darkNavyMat = getChunkStdMat('#0f172a', 0.9, 0.2);
    const obsidianMat = getChunkStdMat('#0b0f19', 0.92, 0.18);
    const bulbOffMat = getChunkStdMat('#1e293b', 0.65, 0.42);
    const streetLightBulbMat = streetLightsOn ? getChunkBloomMat('#fde68a', 2.6) : bulbOffMat;

    if (type === 'STREETLIGHT') {
      return (
        <group position={position} rotation={[0, rotationY, 0]}>
          <mesh position={[0, 0.26, 0]} geometry={SHARED_OCT_PLINTH} material={darkNavyMat} scale={[0.95, 0.52, 0.95]} />
          <mesh position={[0, 0.58, 0]} geometry={SHARED_UNIT_CYLINDER} material={STREAMED_CHROME_MAT} scale={[0.38, 0.1, 0.38]} />
          <mesh position={[0, 3.35, 0]} geometry={SHARED_TAPER_POLE} material={slateMat} scale={[0.95, 5.55, 0.95]} />
          <mesh position={[-0.16, 2.25, 0]} geometry={SHARED_UNIT_BOX} material={darkNavyMat} scale={[0.22, 0.5, 0.24]} />
          <mesh position={[0.38, 5.7, 0]} rotation={[0, 0, -0.68]} geometry={SHARED_UNIT_BOX} material={STREAMED_CHROME_MAT} scale={[0.06, 0.95, 0.07]} />
          <mesh position={[0.88, 6.1, 0]} geometry={SHARED_UNIT_BOX} material={darkNavyMat} scale={[1.8, 0.12, 0.18]} />
          <mesh position={[1.48, 6.06, 0]} geometry={SHARED_UNIT_BOX} material={slateMat} scale={[0.88, 0.14, 0.4]} />
          <mesh position={[1.48, 5.96, 0]} geometry={SHARED_UNIT_BOX} material={streetLightBulbMat} scale={[0.74, 0.05, 0.3]} />
        </group>
      );
    }
    if (type === 'BUS_STOP') {
      return (
        <group position={position} rotation={[0, rotationY, 0]}>
          <mesh position={[0, 0.06, 0]} geometry={SHARED_UNIT_BOX} material={STREAMED_CONCRETE_MAT} scale={[4.0, 0.12, 1.85]} />
          {([-1.65, -0.55, 0.55, 1.65] as const).map((mx, idx) => (
            <mesh key={idx} position={[mx, 1.35, -0.74]} geometry={SHARED_UNIT_BOX} material={darkNavyMat} scale={[0.11, 2.5, 0.12]} />
          ))}
          <mesh position={[0, 1.35, -0.74]} geometry={SHARED_UNIT_BOX} material={STREAMED_GLASS_MAT} scale={[3.22, 2.24, 0.05]} />
          <mesh position={[-1.65, 1.35, -0.08]} geometry={SHARED_UNIT_BOX} material={STREAMED_GLASS_MAT} scale={[0.05, 2.24, 1.32]} />
          <mesh position={[0, 2.65, 0.02]} geometry={SHARED_UNIT_BOX} material={slateMat} scale={[4.1, 0.17, 1.9]} />
          <mesh position={[0, 2.55, 0.88]} geometry={SHARED_UNIT_BOX} material={streetLightsOn ? accentMat : bulbOffMat} scale={[3.8, 0.05, 0.1]} />
          <mesh position={[-0.3, 0.45, -0.32]} geometry={SHARED_UNIT_BOX} material={STREAMED_TIMBER_MAT} scale={[2.15, 0.08, 0.44]} />
          <mesh position={[1.65, 1.32, 0.1]} geometry={SHARED_UNIT_BOX} material={obsidianMat} scale={[0.22, 2.38, 0.72]} />
          <mesh position={[1.77, 1.44, 0.1]} geometry={SHARED_UNIT_BOX} material={streetLightsOn ? accentMat : bulbOffMat} scale={[0.03, 1.4, 0.5]} />
        </group>
      );
    }
    if (type === 'CYBER_KIOSK') {
      return (
        <group position={position} rotation={[0, rotationY, 0]}>
          <mesh position={[0, 0.13, 0]} geometry={SHARED_UNIT_BOX} material={STREAMED_CONCRETE_MAT} scale={[1.08, 0.26, 0.62]} />
          <mesh position={[0, 1.35, 0]} geometry={SHARED_UNIT_BOX} material={obsidianMat} scale={[0.88, 2.22, 0.38]} />
          <mesh position={[-0.45, 1.35, 0.03]} geometry={SHARED_UNIT_BOX} material={STREAMED_CHROME_MAT} scale={[0.05, 2.16, 0.4]} />
          <mesh position={[0.45, 1.35, 0.03]} geometry={SHARED_UNIT_BOX} material={STREAMED_CHROME_MAT} scale={[0.05, 2.16, 0.4]} />
          <mesh position={[0, 1.54, 0.2]} geometry={SHARED_UNIT_BOX} material={accentMat} scale={[0.68, 1.2, 0.03]} />
          <mesh position={[0, 0.82, 0.26]} rotation={[0.42, 0, 0]} geometry={SHARED_UNIT_BOX} material={slateMat} scale={[0.72, 0.07, 0.26]} />
          <mesh position={[0, 2.46, 0.12]} geometry={SHARED_UNIT_BOX} material={darkNavyMat} scale={[0.98, 0.11, 0.64]} />
          <mesh position={[0, 2.55, 0.05]} geometry={SHARED_UNIT_BOX} material={emissiveMat} scale={[0.88, 0.07, 0.44]} />
        </group>
      );
    }
    if (type === 'BOLLARD') {
      return (
        <group position={position} rotation={[0, rotationY, 0]}>
          {([-1.05, 0, 1.05] as const).map((bx, idx) => (
            <group key={idx} position={[bx, 0, 0]}>
              <mesh position={[0, 0.05, 0]} geometry={SHARED_UNIT_CYLINDER} material={STREAMED_CHROME_MAT} scale={[0.32, 0.1, 0.32]} />
              <mesh position={[0, 0.48, 0]} geometry={SHARED_UNIT_CYLINDER} material={darkNavyMat} scale={[0.22, 0.84, 0.22]} />
              <mesh position={[0, 0.7, 0]} geometry={SHARED_UNIT_CYLINDER} material={STREAMED_CHROME_MAT} scale={[0.24, 0.05, 0.24]} />
              <mesh position={[0, 0.85, 0]} geometry={SHARED_UNIT_CYLINDER} material={streetLightsOn ? accentMat : bulbOffMat} scale={[0.24, 0.08, 0.24]} />
              <mesh position={[0, 0.94, 0]} geometry={SHARED_BOLLARD_CAP} material={slateMat} scale={[0.88, 0.09, 0.88]} />
            </group>
          ))}
        </group>
      );
    }
    if (type === 'TRASH_RECEPTACLE') {
      return (
        <group position={position} rotation={[0, rotationY, 0]}>
          {/* Base Plinth & Dual-Stream Recycling Bin */}
          <mesh position={[0, 0.06, 0]} geometry={SHARED_UNIT_BOX} material={STREAMED_CONCRETE_MAT} scale={[0.68, 0.12, 0.58]} />
          <mesh position={[0, 0.58, 0]} geometry={SHARED_UNIT_BOX} material={obsidianMat} scale={[0.56, 0.94, 0.48]} />
          {/* Side Ribs & Deposit Chute Slot */}
          <mesh position={[0, 0.58, 0]} geometry={SHARED_UNIT_BOX} material={STREAMED_CHROME_MAT} scale={[0.6, 0.12, 0.5]} />
          <mesh position={[0, 0.92, 0.24]} geometry={SHARED_UNIT_BOX} material={darkNavyMat} scale={[0.38, 0.18, 0.06]} />
          {/* Sloped Rain Hood & Illuminated Status Trim */}
          <mesh position={[0, 1.12, 0]} geometry={SHARED_UNIT_BOX} material={slateMat} scale={[0.62, 0.14, 0.54]} />
          <mesh position={[0, 1.04, 0]} geometry={SHARED_UNIT_BOX} material={streetLightsOn ? emissiveMat : bulbOffMat} scale={[0.58, 0.05, 0.52]} />
        </group>
      );
    }
    return (
      <group position={position} rotation={[0, rotationY, 0]}>
        <mesh position={[-0.82, 0.22, 0]} geometry={SHARED_UNIT_BOX} material={darkNavyMat} scale={[0.08, 0.44, 0.56]} />
        <mesh position={[0.82, 0.22, 0]} geometry={SHARED_UNIT_BOX} material={darkNavyMat} scale={[0.08, 0.44, 0.56]} />
        <mesh position={[0, 0.44, 0.12]} geometry={SHARED_UNIT_BOX} material={STREAMED_TIMBER_MAT} scale={[2.0, 0.06, 0.2]} />
        <mesh position={[0, 0.44, -0.12]} geometry={SHARED_UNIT_BOX} material={STREAMED_TIMBER_MAT} scale={[2.0, 0.06, 0.2]} />
        <mesh position={[0, 0.72, -0.26]} rotation={[-0.18, 0, 0]} geometry={SHARED_UNIT_BOX} material={STREAMED_TIMBER_MAT} scale={[2.0, 0.22, 0.06]} />
        <mesh position={[0, 0.16, 0]} geometry={SHARED_UNIT_BOX} material={streetLightsOn ? emissiveMat : bulbOffMat} scale={[1.6, 0.04, 0.34]} />
      </group>
    );
  }
);

const StreamedBiomeProp: React.FC<{ prop: BiomePropDef }> = React.memo(({ prop }) => {
  const baseMat = getChunkStdMat('#0b1120', 0.9, 0.25);
  const bodyMat = getChunkStdMat(prop.color, 0.86, 0.24);
  const emissiveMat = prop.emissiveColor ? getChunkBloomMat(prop.emissiveColor, 1.75) : null;
  const { x: sx, y: sy, z: sz } = prop.size;

  if (prop.type === 'STORAGE_TANK') {
    return (
      <group position={prop.position} rotation={[0, prop.rotationY, 0]}>
        <mesh position={[0, 0.16, 0]} geometry={SHARED_UNIT_BOX} material={STREAMED_CONCRETE_MAT} scale={[sx * 1.2, 0.32, sz * 1.2]} />
        <mesh position={[0, sy * 0.46, 0]} geometry={SHARED_UNIT_CYLINDER} material={bodyMat} scale={[sx, sy * 0.82, sz]} />
        <mesh position={[0, sy * 0.86, 0]} geometry={SHARED_DOME_CAP} material={STREAMED_CHROME_MAT} scale={[sx * 0.98, sy * 0.28, sz * 0.98]} />
        {/* Inspection Catwalk Collar & Vertical Riser Pipe */}
        <mesh position={[0, sy * 0.56, 0]} geometry={SHARED_UNIT_CYLINDER} material={baseMat} scale={[sx * 1.14, 0.14, sz * 1.14]} />
        <mesh position={[sx * 0.54, sy * 0.46, 0]} geometry={SHARED_UNIT_CYLINDER} material={STREAMED_CHROME_MAT} scale={[0.16, sy * 0.78, 0.16]} />
        {emissiveMat && (
          <mesh position={[0, sy * 0.66, 0]} geometry={SHARED_UNIT_CYLINDER} material={emissiveMat} scale={[sx * 1.06, 0.12, sz * 1.06]} />
        )}
      </group>
    );
  }

  if (prop.type === 'SERVER_NODE') {
    return (
      <group position={prop.position} rotation={[0, prop.rotationY, 0]}>
        <mesh position={[0, 0.14, 0]} geometry={SHARED_UNIT_BOX} material={STREAMED_CONCRETE_MAT} scale={[sx * 1.18, 0.28, sz * 1.18]} />
        <mesh position={[0, sy * 0.5, 0]} geometry={SHARED_UNIT_BOX} material={bodyMat} scale={[sx, sy * 0.88, sz]} />
        {/* Blade Rack Louver Fins */}
        <mesh position={[0, sy * 0.32, 0]} geometry={SHARED_UNIT_BOX} material={baseMat} scale={[sx * 1.06, 0.14, sz * 1.06]} />
        <mesh position={[0, sy * 0.62, 0]} geometry={SHARED_UNIT_BOX} material={baseMat} scale={[sx * 1.06, 0.14, sz * 1.06]} />
        {/* Top Heat-Sink Hood */}
        <mesh position={[0, sy * 0.96, 0]} geometry={SHARED_UNIT_BOX} material={STREAMED_CHROME_MAT} scale={[sx * 0.92, 0.16, sz * 0.92]} />
        {emissiveMat && (
          <>
            <mesh position={[0, sy * 0.5, sz * 0.52]} geometry={SHARED_UNIT_BOX} material={emissiveMat} scale={[sx * 0.16, sy * 0.72, 0.05]} />
            <mesh position={[0, sy * 0.84, 0]} geometry={SHARED_UNIT_BOX} material={emissiveMat} scale={[sx * 1.04, 0.09, sz * 1.04]} />
          </>
        )}
      </group>
    );
  }

  if (prop.type === 'HISTORIC_PILLAR') {
    return (
      <group position={prop.position} rotation={[0, prop.rotationY, 0]}>
        <mesh position={[0, 0.2, 0]} geometry={SHARED_UNIT_BOX} material={STREAMED_CONCRETE_MAT} scale={[sx * 1.35, 0.4, sz * 1.35]} />
        <mesh position={[0, 0.48, 0]} geometry={SHARED_UNIT_BOX} material={STREAMED_CHROME_MAT} scale={[sx * 1.12, 0.16, sz * 1.12]} />
        <mesh position={[0, sy * 0.52, 0]} geometry={SHARED_UNIT_CYLINDER} material={bodyMat} scale={[sx * 0.82, sy * 0.84, sz * 0.82]} />
        <mesh position={[0, sy * 0.94, 0]} geometry={SHARED_UNIT_BOX} material={STREAMED_CONCRETE_MAT} scale={[sx * 1.24, 0.24, sz * 1.24]} />
        {emissiveMat && (
          <mesh position={[0, sy * 0.84, 0]} geometry={SHARED_UNIT_CYLINDER} material={emissiveMat} scale={[sx * 0.92, 0.1, sz * 0.92]} />
        )}
      </group>
    );
  }

  if (prop.type === 'AERO_MAST') {
    return (
      <group position={prop.position} rotation={[0, prop.rotationY, 0]}>
        <mesh position={[0, 0.18, 0]} geometry={SHARED_UNIT_BOX} material={STREAMED_CONCRETE_MAT} scale={[sx * 1.4, 0.36, sz * 1.4]} />
        <mesh position={[0, sy * 0.5, 0]} geometry={SHARED_TAPER_POLE} material={bodyMat} scale={[sx * 1.8, sy, sz * 1.8]} />
        {/* Telemetry Cross-Arms */}
        <mesh position={[0, sy * 0.74, 0]} geometry={SHARED_UNIT_BOX} material={STREAMED_CHROME_MAT} scale={[sx * 3.4, 0.1, 0.12]} />
        <mesh position={[0, sy * 0.55, 0]} geometry={SHARED_UNIT_BOX} material={STREAMED_CHROME_MAT} scale={[0.12, 0.1, sz * 2.8]} />
        {emissiveMat && (
          <mesh position={[0, sy + 0.24, 0]} geometry={SHARED_BEACON_SPHERE} material={emissiveMat} scale={[0.42, 0.42, 0.42]} />
        )}
      </group>
    );
  }

  if (prop.type === 'PLANTER_VASE') {
    return (
      <group position={prop.position} rotation={[0, prop.rotationY, 0]}>
        <mesh position={[0, 0.16, 0]} geometry={SHARED_UNIT_BOX} material={STREAMED_CONCRETE_MAT} scale={[sx * 1.15, 0.32, sz * 1.15]} />
        <mesh position={[0, sy * 0.52, 0]} geometry={SHARED_UNIT_CYLINDER} material={bodyMat} scale={[sx, sy * 0.58, sz]} />
        <mesh position={[0, sy * 0.82, 0]} geometry={SHARED_UNIT_CYLINDER} material={STREAMED_CHROME_MAT} scale={[sx * 1.12, 0.1, sz * 1.12]} />
        {/* Ornamental Foliage Crown */}
        <mesh position={[0, sy * 1.05, 0]} geometry={SHARED_DOME_CAP} material={getChunkStdMat('#065f46', 0.1, 0.75)} scale={[sx * 0.96, sy * 0.72, sz * 0.96]} />
        {emissiveMat && (
          <mesh position={[0, sy * 0.62, 0]} geometry={SHARED_UNIT_CYLINDER} material={emissiveMat} scale={[sx * 1.05, 0.08, sz * 1.05]} />
        )}
      </group>
    );
  }

  return (
    <group position={prop.position} rotation={[0, prop.rotationY, 0]}>
      {/* Stepped Base Plinth */}
      <mesh position={[0, 0.14, 0]} geometry={SHARED_UNIT_BOX} material={baseMat} scale={[sx * 1.18, 0.28, sz * 1.18]} />
      {/* Primary Structure with Framing Collar */}
      <mesh position={[0, sy * 0.5, 0]} geometry={SHARED_UNIT_BOX} material={bodyMat} scale={[sx, sy, sz]} />
      <mesh position={[0, sy * 0.28, 0]} geometry={SHARED_UNIT_BOX} material={STREAMED_CHROME_MAT} scale={[sx * 1.08, 0.12, sz * 1.08]} />
      <mesh position={[0, sy * 0.96, 0]} geometry={SHARED_UNIT_BOX} material={baseMat} scale={[sx * 1.1, 0.16, sz * 1.1]} />
      {/* Secondary Collar & HDR Accent Beacon */}
      {emissiveMat && (
        <>
          <mesh position={[0, sy * 0.56, 0]} geometry={SHARED_UNIT_BOX} material={emissiveMat} scale={[sx + 0.12, 0.12, sz + 0.12]} />
          <mesh position={[0, sy - 0.18, 0]} geometry={SHARED_UNIT_BOX} material={emissiveMat} scale={[sx + 0.08, 0.14, sz + 0.08]} />
        </>
      )}
    </group>
  );
});

const StreamedChunkView: React.FC<{
  chunkInfo: ChunkInfo;
  wetnessFactor: number;
  streetLightsOn: boolean;
  nightBucket: number;
  facadeEmissiveIntensity: number;
  quality: QualitySettings;
  asphaltTex: THREE.CanvasTexture;
  facadeTextures: Record<FacadeStyleVariant, THREE.CanvasTexture>;
  facadeEmissiveTextures: Record<FacadeStyleVariant, THREE.CanvasTexture>;
  asphaltNormal: THREE.CanvasTexture;
  claddingNormal: THREE.CanvasTexture;
}> = React.memo(
  ({
    chunkInfo,
    wetnessFactor,
    streetLightsOn,
    nightBucket,
    facadeEmissiveIntensity,
    quality,
    asphaltTex,
    facadeTextures,
    facadeEmissiveTextures,
    asphaltNormal,
    claddingNormal,
  }) => {
    const data: StreamedChunkData = useMemo(
      () => ProceduralChunkGenerator.getChunkData(chunkInfo.cx, chunkInfo.cz),
      [chunkInfo.cx, chunkInfo.cz]
    );

    useEffect(() => {
      if ((chunkInfo.lod === 'HIGH' || chunkInfo.lod === 'MEDIUM') && data.collisionBoxes.length > 0) {
        KinematicCollisionSolver.setChunkBoxes(data.key, data.collisionBoxes);
      } else {
        KinematicCollisionSolver.removeChunkBoxes(data.key);
      }
      return () => KinematicCollisionSolver.removeChunkBoxes(data.key);
    }, [chunkInfo.lod, data.key, data.collisionBoxes]);

    if (data.buildings.length === 0 && data.roads.length === 0 && data.parks.length === 0) return null;

    const envScale =
      quality.reflectionQuality === 'HIGH'
        ? 1.45
        : quality.reflectionQuality === 'MEDIUM'
        ? 0.9
        : quality.reflectionQuality === 'LOW'
        ? 0.35
        : 0;
    const effectiveWetness = quality.wetReflectionsEnabled ? wetnessFactor : 0;
    const roadRough = THREE.MathUtils.lerp(0.45, 0.08, effectiveWetness);
    const roadMetal = THREE.MathUtils.lerp(0.55, 0.88, effectiveWetness);
    const showDetails = chunkInfo.lod === 'HIGH' || chunkInfo.lod === 'MEDIUM' || quality.name === 'ULTRA';

    return (
      <group name={`Chunk_${data.key}`}>
        {data.roads.map((r, idx) => (
          <mesh
            key={idx}
            position={r.position}
            rotation={[0, r.rotationY, 0]}
            geometry={SHARED_UNIT_BOX}
            scale={[r.size.x, r.size.y, r.size.z]}
            receiveShadow={quality.shadows}
          >
            <meshStandardMaterial
              map={asphaltTex}
              normalMap={showDetails && quality.normalMapsEnabled ? asphaltNormal : undefined}
              roughness={roadRough}
              metalness={roadMetal}
              envMapIntensity={envScale}
            />
          </mesh>
        ))}
        {data.junctions.map((j, idx) => (
          <mesh
            key={`junc-${idx}`}
            position={j.position}
            geometry={SHARED_UNIT_BOX}
            scale={[j.size.x, j.size.y, j.size.z]}
            receiveShadow={quality.shadows}
          >
            <meshStandardMaterial
              color="#090d16"
              normalMap={showDetails && quality.normalMapsEnabled ? asphaltNormal : undefined}
              roughness={roadRough}
              metalness={roadMetal}
              envMapIntensity={envScale * 0.7}
              polygonOffset
              polygonOffsetFactor={-1}
              polygonOffsetUnits={-1}
            />
          </mesh>
        ))}
        {data.sidewalks.map((sw, idx) => (
          <mesh
            key={idx}
            position={sw.position}
            geometry={SHARED_UNIT_BOX}
            scale={[sw.size.x, sw.size.y, sw.size.z]}
            receiveShadow={quality.shadows}
          >
            <meshStandardMaterial color="#111827" roughness={0.5} metalness={0.35} envMapIntensity={envScale * 0.4} />
          </mesh>
        ))}
        {data.parks.map((park) => (
          <StreamedPocketPark key={park.id} park={park} vegetationEnabled={quality.vegetationEnabled} />
        ))}
        {data.buildings.map((b) => (
          <StreamedBuilding
            key={b.id}
            building={b}
            lod={chunkInfo.lod}
            facadeTextures={facadeTextures}
            facadeEmissiveTextures={facadeEmissiveTextures}
            facadeEmissiveIntensity={facadeEmissiveIntensity}
            nightBucket={nightBucket}
            claddingNormal={quality.normalMapsEnabled ? claddingNormal : undefined}
            shadows={quality.shadows}
            envScale={envScale}
          />
        ))}
        {showDetails &&
          quality.vegetationEnabled &&
          data.trees.map((t) => <ProceduralTree key={t.id} tree={t} />)}
        {showDetails &&
          quality.vegetationEnabled &&
          data.bushes.map((bush) => <StreamedBush key={bush.id} bush={bush} />)}
        {showDetails &&
          quality.streetFurnitureEnabled &&
          data.furniture.map((f) => (
            <StreamedFurniture
              key={f.id}
              furniture={f}
              streetLightsOn={streetLightsOn && quality.nightLightsEnabled}
              nightBucket={nightBucket}
            />
          ))}
        {quality.streetFurnitureEnabled &&
          data.biomeProps.map((bp) => <StreamedBiomeProp key={bp.id} prop={bp} />)}
      </group>
    );
  }
);

export const StreamedCityChunks: React.FC = () => {
  const [activeChunks, setActiveChunks] = useState<ChunkInfo[]>(() =>
    ChunkManager.getInstance()
      .getActiveChunks()
      .filter((c) => !((c.cx === -1 || c.cx === 0) && (c.cz === -1 || c.cz === 0)))
  );
  const [wetnessBucket, setWetnessBucket] = useState<number>(
    () => Math.round(WeatherSystem.getInstance().getState().wetnessFactor * 10) / 10
  );
  const [streetLightsOn, setStreetLightsOn] = useState<boolean>(
    () => TimeSystem.getInstance().getState().streetLightsOn
  );
  const [nightBucket, setNightBucket] = useState<number>(
    () => Math.round(TimeSystem.getInstance().getState().nightFactor * 5) / 5
  );
  const [quality, setQuality] = useState<QualitySettings>(() => QualityManager.current);

  const asphaltTex = useMemo(() => RoadGenerator.getAsphaltTexture(), []);
  const facadeTextures = useMemo<Record<FacadeStyleVariant, THREE.CanvasTexture>>(
    () => ({
      CURTAIN_GLASS: ProceduralTextures.getBuildingFacadeTexture(0.58, 'CURTAIN_GLASS'),
      DIAGRID_HEX: ProceduralTextures.getBuildingFacadeTexture(0.6, 'DIAGRID_HEX'),
      BRUTALIST_RIBBED: ProceduralTextures.getBuildingFacadeTexture(0.54, 'BRUTALIST_RIBBED'),
      ARCOLOGY_TERRACE: ProceduralTextures.getBuildingFacadeTexture(0.62, 'ARCOLOGY_TERRACE'),
    }),
    []
  );
  const facadeEmissiveTextures = useMemo<Record<FacadeStyleVariant, THREE.CanvasTexture>>(
    () => ({
      CURTAIN_GLASS: ProceduralTextures.getBuildingEmissiveTexture(0.58, 'CURTAIN_GLASS'),
      DIAGRID_HEX: ProceduralTextures.getBuildingEmissiveTexture(0.6, 'DIAGRID_HEX'),
      BRUTALIST_RIBBED: ProceduralTextures.getBuildingEmissiveTexture(0.54, 'BRUTALIST_RIBBED'),
      ARCOLOGY_TERRACE: ProceduralTextures.getBuildingEmissiveTexture(0.62, 'ARCOLOGY_TERRACE'),
    }),
    []
  );
  const asphaltNormal = useMemo(() => ProceduralTextures.getAsphaltNormalMap(), []);
  const claddingNormal = useMemo(() => ProceduralTextures.getBuildingCladdingNormalMap(), []);
  const prevSigRef = useRef('');

  useEffect(() => {
    let lastWetBucket = Math.round(WeatherSystem.getInstance().getState().wetnessFactor * 10) / 10;
    let lastLightsOn = TimeSystem.getInstance().getState().streetLightsOn;
    let lastNightBucket = Math.round(TimeSystem.getInstance().getState().nightFactor * 5) / 5;
    const uWea = WeatherSystem.getInstance().subscribe((s) => {
      const bucket = Math.round(s.wetnessFactor * 10) / 10;
      if (bucket !== lastWetBucket) {
        lastWetBucket = bucket;
        setWetnessBucket(bucket);
      }
    });
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
    const uQual = QualityManager.subscribe(setQuality);
    const uChunks = ChunkManager.getInstance().subscribe((s) => {
      const filtered = s.chunks.filter(
        (c) => c.lod !== 'UNLOADED' && !((c.cx === -1 || c.cx === 0) && (c.cz === -1 || c.cz === 0))
      );
      const sig = filtered.map((c) => `${c.key}:${c.lod}`).sort().join('|');
      if (sig !== prevSigRef.current) {
        prevSigRef.current = sig;
        setActiveChunks(filtered);
      }
    });
    return () => {
      uWea();
      uTime();
      uQual();
      uChunks();
      ChunkManager.getInstance()
        .getActiveChunks()
        .forEach((c) => KinematicCollisionSolver.removeChunkBoxes(c.key));
    };
  }, []);

  const lowChunks = useMemo(() => activeChunks.filter((c) => c.lod === 'LOW'), [activeChunks]);
  const detailedChunks = useMemo(() => activeChunks.filter((c) => c.lod !== 'LOW'), [activeChunks]);
  const facadeEmissiveIntensity = 0.1 + nightBucket * 1.72;

  return (
    <group name="StreamedCityChunksLayer">
      <LowDetailChunks
        chunks={lowChunks}
        facadeTex={facadeTextures.CURTAIN_GLASS}
        emissiveTex={facadeEmissiveTextures.CURTAIN_GLASS}
        emissiveIntensity={facadeEmissiveIntensity}
      />
      {detailedChunks.map((chunk) => (
        <StreamedChunkView
          key={chunk.key}
          chunkInfo={chunk}
          wetnessFactor={wetnessBucket}
          streetLightsOn={streetLightsOn}
          nightBucket={nightBucket}
          facadeEmissiveIntensity={facadeEmissiveIntensity}
          quality={quality}
          asphaltTex={asphaltTex}
          facadeTextures={facadeTextures}
          facadeEmissiveTextures={facadeEmissiveTextures}
          asphaltNormal={asphaltNormal}
          claddingNormal={claddingNormal}
        />
      ))}
    </group>
  );
};
