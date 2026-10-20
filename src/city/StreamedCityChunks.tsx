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
import { QualityManager, QualitySettings } from '../rendering/QualityManager';

const SHARED_UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const SHARED_UNIT_CYLINDER = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
const SHARED_BEACON_SPHERE = new THREE.SphereGeometry(0.65, 8, 8);
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

const LowDetailChunks: React.FC<{ chunks: ChunkInfo[]; facadeTex: THREE.CanvasTexture }> = React.memo(
  ({ chunks, facadeTex }) => {
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
        <meshStandardMaterial map={facadeTex} color="#ffffff" roughness={0.62} metalness={0.55} />
      </instancedMesh>
    );
  }
);

const StreamedBuilding: React.FC<{
  building: StreamedBuildingDef;
  lod: ChunkLOD;
  facadeTextures: Record<FacadeStyleVariant, THREE.CanvasTexture>;
  claddingNormal?: THREE.CanvasTexture;
  shadows: boolean;
  envScale: number;
}> = React.memo(({ building, lod, facadeTextures, claddingNormal, shadows, envScale }) => {
  const { position, size, accentColor, emissiveColor, facadeVariant, tiers, antenna } = building;
  const facadeTex = facadeTextures[facadeVariant] || facadeTextures.CURTAIN_GLASS;
  const isHigh = lod === 'HIGH';
  const topTier = tiers[tiers.length - 1];
  const podiumMat = getChunkStdMat('#0b1120', 0.88, 0.26);
  const canopyMat = getChunkStdMat('#0f172a', 0.9, 0.2);
  const colMat = getChunkStdMat('#0b1120', 0.92, 0.22);
  const finMat = getChunkStdMat('#111c33', 0.9, 0.22);
  const mastMat = getChunkStdMat('#475569', 0.9, 0.2);
  const storefrontMatA = getChunkEmissiveMat('#09111f', accentColor, 0.32);
  const storefrontMatB = getChunkEmissiveMat('#09111f', emissiveColor, 0.28);
  const crownMat = getChunkEmissiveMat('#0b1326', accentColor, 0.35);
  const accentBasicMat = getChunkBasicMat(accentColor);
  const emissiveBasicMat = getChunkBasicMat(emissiveColor);

  return (
    <group position={[position.x, 0, position.z]}>
      {/* Wrap-Around Street-Level Podium & 4-Sided Illuminated Storefront */}
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
        position={[0, 2.1, 0]}
        geometry={SHARED_UNIT_BOX}
        material={storefrontMatB}
        scale={[size.x + 0.85, 3.8, size.z * 0.74]}
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
                normalMap={isHigh ? claddingNormal : undefined}
                normalScale={CLADDING_NORMAL_SCALE}
                roughness={0.3}
                metalness={0.84}
                envMapIntensity={envScale}
              />
            </mesh>

            {/* 4 Corner Structural Exoskeleton Columns & Center Brise-Soleil Fins on High LOD */}
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
                <mesh geometry={SHARED_UNIT_BOX} material={finMat} scale={[tw + 0.32, th * 0.94, 0.3]} />
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
            material={getChunkBasicMat(antenna.beaconColor)}
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
      <mesh
        position={[0, 0.24, 0]}
        geometry={SHARED_UNIT_BOX}
        material={getChunkBasicMat(park.fountainColor)}
        scale={[park.size.x + 0.15, 0.04, park.size.z + 0.15]}
      />
      {park.hasPond && (
        <group position={[0, 0.24, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[park.pondRadius, 24]} />
            <meshStandardMaterial
              color="#042f2e"
              emissive={park.fountainColor}
              emissiveIntensity={0.22}
              roughness={0.08}
              metalness={0.92}
            />
          </mesh>
          <mesh
            position={[0, 1.1, 0]}
            geometry={SHARED_UNIT_CYLINDER}
            material={getChunkStdMat('#0f172a', 0.9, 0.2)}
            scale={[0.9, 2.2, 0.9]}
          />
          <mesh
            position={[0, 2.4, 0]}
            geometry={SHARED_BEACON_SPHERE}
            material={getChunkBasicMat(park.fountainColor)}
            scale={[0.6, 0.6, 0.6]}
          />
        </group>
      )}
      {park.benches.map((b, idx) => (
        <group
          key={idx}
          position={[b.position.x - park.position.x, 0.25, b.position.z - park.position.z]}
          rotation={[0, b.rotationY, 0]}
        >
          <mesh
            position={[0, 0.25, 0]}
            geometry={SHARED_UNIT_BOX}
            material={getChunkStdMat('#1e293b', 0.8, 0.3)}
            scale={[2.0, 0.45, 0.6]}
          />
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
    <mesh
      geometry={SHARED_UNIT_BOX}
      material={getChunkStdMat(bush.color, 0.1, 0.75)}
      scale={[bush.size.x, bush.size.y, bush.size.z]}
    />
    {bush.hasFlowers && bush.flowerColor && (
      <mesh
        position={[0, bush.size.y * 0.55, 0]}
        geometry={SHARED_UNIT_BOX}
        material={getChunkBasicMat(bush.flowerColor)}
        scale={[bush.size.x * 0.75, 0.08, bush.size.z * 0.75]}
      />
    )}
  </group>
));

const StreamedFurniture: React.FC<{ furniture: StreetFurnitureDef }> = React.memo(({ furniture }) => {
  const { type, position, rotationY, emissiveColor = '#f59e0b', accentColor = '#38bdf8' } = furniture;
  const emissiveMat = getChunkBasicMat(emissiveColor);
  const accentMat = getChunkBasicMat(accentColor);
  const slateMat = getChunkStdMat('#1e293b', 0.85, 0.25);
  const darkNavyMat = getChunkStdMat('#0f172a', 0.9, 0.2);

  if (type === 'STREETLIGHT') {
    return (
      <group position={position} rotation={[0, rotationY, 0]}>
        <mesh position={[0, 3.1, 0]} geometry={SHARED_UNIT_CYLINDER} material={slateMat} scale={[0.14, 6.0, 0.14]} />
        <mesh position={[0.6, 6.05, 0]} geometry={SHARED_UNIT_BOX} material={darkNavyMat} scale={[1.3, 0.1, 0.2]} />
        <mesh position={[1.05, 5.98, 0]} geometry={SHARED_UNIT_BOX} material={emissiveMat} scale={[0.65, 0.06, 0.2]} />
      </group>
    );
  }
  if (type === 'BUS_STOP') {
    return (
      <group position={position} rotation={[0, rotationY, 0]}>
        <mesh position={[0, 1.3, -0.7]} geometry={SHARED_UNIT_BOX} material={darkNavyMat} scale={[3.4, 2.5, 0.14]} />
        <mesh position={[0, 2.6, 0]} geometry={SHARED_UNIT_BOX} material={slateMat} scale={[3.8, 0.16, 1.7]} />
        <mesh position={[0, 2.52, 0.75]} geometry={SHARED_UNIT_BOX} material={accentMat} scale={[3.6, 0.05, 0.1]} />
        <mesh
          position={[0, 0.45, -0.32]}
          geometry={SHARED_UNIT_BOX}
          material={getChunkStdMat('#334155', 0.8, 0.3)}
          scale={[2.2, 0.12, 0.5]}
        />
      </group>
    );
  }
  if (type === 'CYBER_KIOSK') {
    return (
      <group position={position} rotation={[0, rotationY, 0]}>
        <mesh
          position={[0, 1.2, 0]}
          geometry={SHARED_UNIT_BOX}
          material={getChunkStdMat('#0b0f19', 0.92, 0.18)}
          scale={[0.82, 2.4, 0.34]}
        />
        <mesh position={[0, 1.35, 0.18]} geometry={SHARED_UNIT_BOX} material={accentMat} scale={[0.64, 1.25, 0.02]} />
        <mesh position={[0, 2.48, 0]} geometry={SHARED_UNIT_BOX} material={emissiveMat} scale={[0.9, 0.08, 0.42]} />
      </group>
    );
  }
  if (type === 'BOLLARD') {
    return (
      <group position={position} rotation={[0, rotationY, 0]}>
        {([-1.0, 0, 1.0] as const).map((bx, idx) => (
          <group key={idx} position={[bx, 0, 0]}>
            <mesh position={[0, 0.48, 0]} geometry={SHARED_UNIT_CYLINDER} material={darkNavyMat} scale={[0.22, 0.96, 0.22]} />
            <mesh position={[0, 0.85, 0]} geometry={SHARED_UNIT_CYLINDER} material={accentMat} scale={[0.24, 0.08, 0.24]} />
          </group>
        ))}
      </group>
    );
  }
  if (type === 'TRASH_RECEPTACLE') {
    return (
      <group position={position} rotation={[0, rotationY, 0]}>
        <mesh
          position={[0, 0.55, 0]}
          geometry={SHARED_UNIT_BOX}
          material={getChunkStdMat('#111827', 0.88, 0.24)}
          scale={[0.52, 1.1, 0.48]}
        />
        <mesh position={[0, 1.02, 0]} geometry={SHARED_UNIT_BOX} material={emissiveMat} scale={[0.56, 0.06, 0.52]} />
      </group>
    );
  }
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0.42, 0]} geometry={SHARED_UNIT_BOX} material={slateMat} scale={[1.9, 0.14, 0.6]} />
      <mesh position={[0, 0.7, -0.25]} geometry={SHARED_UNIT_BOX} material={darkNavyMat} scale={[1.9, 0.42, 0.1]} />
      <mesh position={[0, 0.15, 0]} geometry={SHARED_UNIT_BOX} material={emissiveMat} scale={[1.6, 0.04, 0.4]} />
    </group>
  );
});

const StreamedBiomeProp: React.FC<{ prop: BiomePropDef }> = React.memo(({ prop }) => {
  const isCylindrical =
    prop.type === 'STORAGE_TANK' || prop.type === 'HISTORIC_PILLAR' || prop.type === 'AERO_MAST';
  const emissiveMat = prop.emissiveColor ? getChunkBasicMat(prop.emissiveColor) : null;
  return (
    <group position={prop.position} rotation={[0, prop.rotationY, 0]}>
      {/* Base Plinth */}
      <mesh
        position={[0, 0.14, 0]}
        geometry={SHARED_UNIT_BOX}
        material={getChunkStdMat('#0b1120', 0.9, 0.25)}
        scale={[prop.size.x * 1.18, 0.28, prop.size.z * 1.18]}
      />
      {/* Primary Structure */}
      <mesh
        position={[0, prop.size.y / 2, 0]}
        geometry={isCylindrical ? SHARED_UNIT_CYLINDER : SHARED_UNIT_BOX}
        material={getChunkStdMat(prop.color, 0.86, 0.24)}
        scale={[prop.size.x, prop.size.y, prop.size.z]}
      />
      {/* Secondary Collar & Emissive Beacon */}
      {emissiveMat && (
        <>
          <mesh
            position={[0, prop.size.y * 0.55, 0]}
            geometry={SHARED_UNIT_BOX}
            material={emissiveMat}
            scale={[prop.size.x + 0.14, 0.16, prop.size.z + 0.14]}
          />
          <mesh
            position={[0, prop.size.y - 0.25, 0]}
            geometry={SHARED_UNIT_BOX}
            material={emissiveMat}
            scale={[prop.size.x + 0.1, 0.22, prop.size.z + 0.1]}
          />
        </>
      )}
    </group>
  );
});

const StreamedChunkView: React.FC<{
  chunkInfo: ChunkInfo;
  wetnessFactor: number;
  quality: QualitySettings;
  asphaltTex: THREE.CanvasTexture;
  facadeTextures: Record<FacadeStyleVariant, THREE.CanvasTexture>;
  asphaltNormal: THREE.CanvasTexture;
  claddingNormal: THREE.CanvasTexture;
}> = React.memo(
  ({ chunkInfo, wetnessFactor, quality, asphaltTex, facadeTextures, asphaltNormal, claddingNormal }) => {
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
          data.furniture.map((f) => <StreamedFurniture key={f.id} furniture={f} />)}
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
  const [weatherState, setWeatherState] = useState(() => WeatherSystem.getInstance().getState());
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
  const asphaltNormal = useMemo(() => ProceduralTextures.getAsphaltNormalMap(), []);
  const claddingNormal = useMemo(() => ProceduralTextures.getBuildingCladdingNormalMap(), []);
  const prevSigRef = useRef('');

  useEffect(() => {
    const uWea = WeatherSystem.getInstance().subscribe(setWeatherState);
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
      uQual();
      uChunks();
      ChunkManager.getInstance()
        .getActiveChunks()
        .forEach((c) => KinematicCollisionSolver.removeChunkBoxes(c.key));
    };
  }, []);

  const lowChunks = useMemo(() => activeChunks.filter((c) => c.lod === 'LOW'), [activeChunks]);
  const detailedChunks = useMemo(() => activeChunks.filter((c) => c.lod !== 'LOW'), [activeChunks]);

  return (
    <group name="StreamedCityChunksLayer">
      <LowDetailChunks chunks={lowChunks} facadeTex={facadeTextures.CURTAIN_GLASS} />
      {detailedChunks.map((chunk) => (
        <StreamedChunkView
          key={chunk.key}
          chunkInfo={chunk}
          wetnessFactor={weatherState.wetnessFactor}
          quality={quality}
          asphaltTex={asphaltTex}
          facadeTextures={facadeTextures}
          asphaltNormal={asphaltNormal}
          claddingNormal={claddingNormal}
        />
      ))}
    </group>
  );
};
