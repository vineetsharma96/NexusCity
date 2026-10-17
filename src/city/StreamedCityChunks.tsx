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
import { ProceduralTextures } from '../core/ProceduralTextures';
import { WeatherSystem } from '../world/WeatherSystem';
import { QualityManager, QualitySettings } from '../rendering/QualityManager';

const SHARED_UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const SHARED_UNIT_CYLINDER = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
const SHARED_BEACON_SPHERE = new THREE.SphereGeometry(0.65, 8, 8);

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
      buildings.forEach((b, idx) => {
        dummy.position.set(b.position.x, b.size.y / 2, b.position.z);
        dummy.scale.copy(b.size);
        dummy.updateMatrix();
        mesh.setMatrixAt(idx, dummy.matrix);
        mesh.setColorAt(idx, col.set(b.color).lerp(new THREE.Color('#ffffff'), 0.65));
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
  facadeTex: THREE.CanvasTexture;
  claddingNormal?: THREE.CanvasTexture;
  shadows: boolean;
  envScale: number;
}> = React.memo(({ building, lod, facadeTex, claddingNormal, shadows, envScale }) => {
  const { position, size, accentColor, emissiveColor, tiers, antenna } = building;
  return (
    <group position={[position.x, 0, position.z]}>
      {tiers.map((tier, idx) => (
        <group key={idx} position={[tier.offset.x, tier.offset.y, tier.offset.z]}>
          <mesh
            geometry={SHARED_UNIT_BOX}
            scale={[tier.size.x, tier.size.y, tier.size.z]}
            castShadow={shadows && lod === 'HIGH'}
            receiveShadow={shadows}
          >
            <meshStandardMaterial
              map={facadeTex}
              normalMap={lod === 'HIGH' ? claddingNormal : undefined}
              normalScale={new THREE.Vector2(0.5, 0.5)}
              roughness={0.32}
              metalness={0.82}
              envMapIntensity={envScale}
            />
          </mesh>
          <mesh
            position={[0, tier.size.y / 2 - 0.25, 0]}
            geometry={SHARED_UNIT_BOX}
            scale={[tier.size.x + 0.14, 0.45, tier.size.z + 0.14]}
          >
            <meshBasicMaterial color={lod === 'HIGH' ? accentColor : emissiveColor} />
          </mesh>
        </group>
      ))}
      {/* Ground-level illuminated storefront podium */}
      <mesh
        position={[0, 2.0, size.z / 2 + 0.05]}
        geometry={SHARED_UNIT_BOX}
        scale={[size.x * 0.68, 4.0, 0.32]}
      >
        <meshStandardMaterial
          color="#09111f"
          emissive={accentColor}
          emissiveIntensity={0.28}
          metalness={0.9}
          roughness={0.2}
        />
      </mesh>
      {antenna && (
        <group position={[0, size.y, 0]}>
          <mesh position={[0, antenna.height / 2, 0]} geometry={SHARED_UNIT_CYLINDER} scale={[0.5, antenna.height, 0.5]}>
            <meshStandardMaterial color="#475569" metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh position={[0, antenna.height + 0.4, 0]} geometry={SHARED_BEACON_SPHERE}>
            <meshBasicMaterial color={antenna.beaconColor} />
          </mesh>
        </group>
      )}
    </group>
  );
});

const StreamedPocketPark: React.FC<{ park: PocketParkDef; vegetationEnabled: boolean }> = React.memo(
  ({ park, vegetationEnabled }) => (
    <group position={[park.position.x, 0, park.position.z]} name={park.id}>
      <mesh position={[0, 0.11, 0]} geometry={SHARED_UNIT_BOX} scale={[park.size.x, park.size.y, park.size.z]}>
        <meshStandardMaterial color="#052e16" roughness={0.82} metalness={0.08} />
      </mesh>
      <mesh position={[0, 0.24, 0]} geometry={SHARED_UNIT_BOX} scale={[park.size.x + 0.15, 0.04, park.size.z + 0.15]}>
        <meshBasicMaterial color={park.fountainColor} />
      </mesh>
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
          <mesh position={[0, 1.1, 0]} geometry={SHARED_UNIT_CYLINDER} scale={[0.9, 2.2, 0.9]}>
            <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh position={[0, 2.4, 0]} geometry={SHARED_BEACON_SPHERE} scale={[0.6, 0.6, 0.6]}>
            <meshBasicMaterial color={park.fountainColor} />
          </mesh>
        </group>
      )}
      {park.benches.map((b, idx) => (
        <group
          key={idx}
          position={[b.position.x - park.position.x, 0.25, b.position.z - park.position.z]}
          rotation={[0, b.rotationY, 0]}
        >
          <mesh position={[0, 0.25, 0]} geometry={SHARED_UNIT_BOX} scale={[2.0, 0.45, 0.6]}>
            <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.3} />
          </mesh>
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
    <mesh geometry={SHARED_UNIT_BOX} scale={[bush.size.x, bush.size.y, bush.size.z]}>
      <meshStandardMaterial color={bush.color} roughness={0.75} />
    </mesh>
    {bush.hasFlowers && bush.flowerColor && (
      <mesh position={[0, bush.size.y * 0.55, 0]} geometry={SHARED_UNIT_BOX} scale={[bush.size.x * 0.75, 0.08, bush.size.z * 0.75]}>
        <meshBasicMaterial color={bush.flowerColor} />
      </mesh>
    )}
  </group>
));

const StreamedFurniture: React.FC<{ furniture: StreetFurnitureDef }> = React.memo(({ furniture }) => {
  const { type, position, rotationY, emissiveColor = '#f59e0b', accentColor = '#38bdf8' } = furniture;
  if (type === 'STREETLIGHT') {
    return (
      <group position={position} rotation={[0, rotationY, 0]}>
        <mesh position={[0, 3.1, 0]} geometry={SHARED_UNIT_CYLINDER} scale={[0.14, 6.0, 0.14]}>
          <meshStandardMaterial color="#1e293b" metalness={0.85} />
        </mesh>
        <mesh position={[0.6, 6.05, 0]} geometry={SHARED_UNIT_BOX} scale={[1.3, 0.1, 0.2]}>
          <meshStandardMaterial color="#0f172a" metalness={0.9} />
        </mesh>
        <mesh position={[1.05, 5.98, 0]} geometry={SHARED_UNIT_BOX} scale={[0.65, 0.06, 0.2]}>
          <meshBasicMaterial color={emissiveColor} />
        </mesh>
      </group>
    );
  }
  if (type === 'BUS_STOP') {
    return (
      <group position={position} rotation={[0, rotationY, 0]}>
        <mesh position={[0, 1.3, -0.7]} geometry={SHARED_UNIT_BOX} scale={[3.4, 2.5, 0.14]}>
          <meshStandardMaterial color="#0f172a" metalness={0.88} roughness={0.2} />
        </mesh>
        <mesh position={[0, 2.6, 0]} geometry={SHARED_UNIT_BOX} scale={[3.8, 0.16, 1.7]}>
          <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.2} />
        </mesh>
        <mesh position={[0, 2.52, 0.75]} geometry={SHARED_UNIT_BOX} scale={[3.6, 0.05, 0.1]}>
          <meshBasicMaterial color={accentColor} />
        </mesh>
      </group>
    );
  }
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0.42, 0]} geometry={SHARED_UNIT_BOX} scale={[1.9, 0.14, 0.6]}>
        <meshStandardMaterial color="#1e293b" metalness={0.75} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.7, -0.25]} geometry={SHARED_UNIT_BOX} scale={[1.9, 0.42, 0.1]}>
        <meshStandardMaterial color="#0f172a" metalness={0.85} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0.15, 0]} geometry={SHARED_UNIT_BOX} scale={[1.6, 0.04, 0.4]}>
        <meshBasicMaterial color={emissiveColor} />
      </mesh>
    </group>
  );
});

const StreamedBiomeProp: React.FC<{ prop: BiomePropDef }> = React.memo(({ prop }) => {
  const isCylindrical = prop.type === 'STORAGE_TANK' || prop.type === 'HISTORIC_PILLAR' || prop.type === 'AERO_MAST';
  return (
    <group position={prop.position} rotation={[0, prop.rotationY, 0]}>
      <mesh
        position={[0, prop.size.y / 2, 0]}
        geometry={isCylindrical ? SHARED_UNIT_CYLINDER : SHARED_UNIT_BOX}
        scale={[prop.size.x, prop.size.y, prop.size.z]}
      >
        <meshStandardMaterial color={prop.color} metalness={0.86} roughness={0.24} />
      </mesh>
      {prop.emissiveColor && (
        <mesh
          position={[0, prop.size.y - 0.25, 0]}
          geometry={SHARED_UNIT_BOX}
          scale={[prop.size.x + 0.1, 0.22, prop.size.z + 0.1]}
        >
          <meshBasicMaterial color={prop.emissiveColor} />
        </mesh>
      )}
    </group>
  );
});

const StreamedChunkView: React.FC<{
  chunkInfo: ChunkInfo;
  wetnessFactor: number;
  quality: QualitySettings;
  asphaltTex: THREE.CanvasTexture;
  facadeTex: THREE.CanvasTexture;
  asphaltNormal: THREE.CanvasTexture;
  claddingNormal: THREE.CanvasTexture;
}> = React.memo(
  ({ chunkInfo, wetnessFactor, quality, asphaltTex, facadeTex, asphaltNormal, claddingNormal }) => {
    const data: StreamedChunkData = useMemo(
      () => ProceduralChunkGenerator.getChunkData(chunkInfo.cx, chunkInfo.cz),
      [chunkInfo.cx, chunkInfo.cz]
    );

    useEffect(() => {
      if (chunkInfo.lod === 'HIGH' && data.collisionBoxes.length > 0) {
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
    const showDetails = chunkInfo.lod === 'HIGH' || quality.name === 'ULTRA';

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
            facadeTex={facadeTex}
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
      .filter((c) => Math.abs(c.cx) > 1 || Math.abs(c.cz) > 1)
  );
  const [weatherState, setWeatherState] = useState(() => WeatherSystem.getInstance().getState());
  const [quality, setQuality] = useState<QualitySettings>(() => QualityManager.current);

  const asphaltTex = useMemo(() => RoadGenerator.getAsphaltTexture(), []);
  const facadeTex = useMemo(() => ProceduralTextures.getBuildingFacadeTexture(0.58), []);
  const asphaltNormal = useMemo(() => ProceduralTextures.getAsphaltNormalMap(), []);
  const claddingNormal = useMemo(() => ProceduralTextures.getBuildingCladdingNormalMap(), []);
  const prevSigRef = useRef('');

  useEffect(() => {
    const uWea = WeatherSystem.getInstance().subscribe(setWeatherState);
    const uQual = QualityManager.subscribe(setQuality);
    const uChunks = ChunkManager.getInstance().subscribe((s) => {
      const filtered = s.chunks.filter((c) => c.lod !== 'UNLOADED' && (Math.abs(c.cx) > 1 || Math.abs(c.cz) > 1));
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
      <LowDetailChunks chunks={lowChunks} facadeTex={facadeTex} />
      {detailedChunks.map((chunk) => (
        <StreamedChunkView
          key={chunk.key}
          chunkInfo={chunk}
          wetnessFactor={weatherState.wetnessFactor}
          quality={quality}
          asphaltTex={asphaltTex}
          facadeTex={facadeTex}
          asphaltNormal={asphaltNormal}
          claddingNormal={claddingNormal}
        />
      ))}
    </group>
  );
};
