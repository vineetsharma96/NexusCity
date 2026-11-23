import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { ChunkInfo, ChunkManager } from '../world/ChunkManager';
import { ProceduralChunkGenerator } from './ProceduralChunkGenerator';
import { RoadGenerator } from './RoadGenerator';
import { KinematicCollisionSolver } from '../player/KinematicCollision';
import { FacadeStyleVariant, ProceduralTextures } from '../core/ProceduralTextures';
import { WeatherSystem } from '../world/WeatherSystem';
import { TimeSystem } from '../world/TimeSystem';
import { QualityManager, QualitySettings } from '../rendering/QualityManager';
import { LivingCityEventSystem } from '../world/LivingCityEventSystem';
import { InstanceBatchBuilder, TreeBucketKeys } from '../rendering/StaticInstanceBatcher';
import { InstanceBucketSpec, InstancedBatchLayer } from '../rendering/InstancedBatchView';
import {
  createSmoothBeveledBoxGeometry,
  createSmoothBuildingPrismGeometry,
  createSmoothFoliageCrownGeometry,
} from '../rendering/SmoothWorldGeometries';

// Shared unit geometries (zero per-chunk geometry allocation; smooth beveled & chamfered primitives)
const SHARED_UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const SHARED_BEVELED_BOX = createSmoothBeveledBoxGeometry(0.055, 2);
const SHARED_BUILDING_PRISM = createSmoothBuildingPrismGeometry(0.032, 2);
const SHARED_ROAD_PLANE = (() => {
  const g = new THREE.PlaneGeometry(1, 1);
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0.5, 0);
  return g;
})();
const SHARED_UNIT_CYLINDER = new THREE.CylinderGeometry(0.5, 0.5, 1, 14);
const SHARED_TAPER_POLE = new THREE.CylinderGeometry(0.08, 0.15, 1, 14);
const SHARED_OCT_PLINTH = new THREE.CylinderGeometry(0.28, 0.38, 1, 16);
const SHARED_BOLLARD_CAP = new THREE.CylinderGeometry(0.08, 0.14, 1, 14);
const SHARED_BEACON_SPHERE = new THREE.SphereGeometry(0.65, 14, 10);
const SHARED_DOME_CAP = new THREE.SphereGeometry(0.5, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5);
const SHARED_MOUND_GEO = new THREE.CylinderGeometry(1.6, 2.0, 0.14, 14);
const SHARED_ROOT_FLARE_GEO = new THREE.CylinderGeometry(0.9, 1.48, 0.55, 12);
const SHARED_TRUNK_GEO = new THREE.CylinderGeometry(0.7, 1.0, 1.0, 12);
const SHARED_BRANCH_GEO = new THREE.CylinderGeometry(0.7, 1.0, 1.0, 10);
const SHARED_CROWN_GEO = createSmoothFoliageCrownGeometry();

const CLADDING_NORMAL_SCALE = new THREE.Vector2(0.6, 0.6);
const SIDEWALK_NORMAL_SCALE = new THREE.Vector2(0.4, 0.4);

// Static shared materials (never re-created per chunk or per frame)
const MAT_PODIUM = new THREE.MeshStandardMaterial({ color: '#0b1120', metalness: 0.88, roughness: 0.26 });
const MAT_NAVY = new THREE.MeshStandardMaterial({ color: '#0f172a', metalness: 0.9, roughness: 0.2 });
const MAT_SLATE = new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.85, roughness: 0.25 });
const MAT_FIN = new THREE.MeshStandardMaterial({ color: '#111c33', metalness: 0.9, roughness: 0.22 });
const MAT_CONCRETE = new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.22, roughness: 0.78 });
const MAT_CHROME = new THREE.MeshStandardMaterial({ color: '#94a3b8', metalness: 0.94, roughness: 0.18 });
const MAT_TIMBER = new THREE.MeshStandardMaterial({ color: '#6b4226', metalness: 0.08, roughness: 0.72 });
const MAT_GLASS = new THREE.MeshStandardMaterial({
  color: '#0f2238',
  metalness: 0.92,
  roughness: 0.08,
  transparent: true,
  opacity: 0.48,
});
const MAT_COLORED_STD = new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 0.35, roughness: 0.62 });
const MAT_COLORED_METAL = new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 0.86, roughness: 0.24 });
const MAT_PLANTER_PLINTH = new THREE.MeshStandardMaterial({ color: '#0b0f19', metalness: 0.78, roughness: 0.32 });
const MAT_PLANTER_COPING = new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.88, roughness: 0.24 });
const MAT_SOIL_BED = new THREE.MeshStandardMaterial({ color: '#1b140d', metalness: 0.05, roughness: 0.94 });
const MAT_MOUND = new THREE.MeshStandardMaterial({ color: '#062e1a', roughness: 0.85 });
const MAT_ROOT = new THREE.MeshStandardMaterial({ color: '#1f1710', roughness: 0.88 });
const MAT_TRUNK = new THREE.MeshStandardMaterial({ color: '#271e16', roughness: 0.82 });
const MAT_FOLIAGE = new THREE.MeshStandardMaterial({
  color: '#ffffff',
  emissive: '#064e3b',
  emissiveIntensity: 0.14,
  roughness: 0.58,
  metalness: 0.04,
});
const MAT_DOME_FOLIAGE = new THREE.MeshStandardMaterial({ color: '#065f46', metalness: 0.1, roughness: 0.75 });
const MAT_TRIM_BASIC = new THREE.MeshBasicMaterial({ color: '#ffffff' });

const TREE_BUCKET_KEYS: TreeBucketKeys = {
  planterPlinth: 'tree_planter_plinth',
  planterCoping: 'tree_planter_coping',
  soilBed: 'tree_soil',
  planterTrim: 'tree_trim',
  mound: 'tree_mound',
  rootFlare: 'tree_root',
  trunk: 'tree_trunk',
  branch: 'tree_branch',
  foliage: 'tree_foliage',
};

const LowDetailChunks: React.FC<{
  chunks: ChunkInfo[];
  material: THREE.MeshStandardMaterial;
}> = React.memo(({ chunks, material }) => {
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
    for (let idx = 0; idx < buildings.length; idx++) {
      const b = buildings[idx];
      dummy.position.set(b.position.x, b.size.y / 2, b.position.z);
      dummy.scale.copy(b.size);
      dummy.updateMatrix();
      mesh.setMatrixAt(idx, dummy.matrix);
      mesh.setColorAt(idx, col.set(b.color).lerp(white, 0.65));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [buildings]);

  if (buildings.length === 0) return null;
  return (
    <instancedMesh
      key={`low_${buildings.length}`}
      ref={meshRef}
      args={[SHARED_UNIT_BOX, material, buildings.length]}
      dispose={null}
      frustumCulled={false}
    />
  );
});

export const StreamedCityChunks: React.FC = () => {
  const [activeChunks, setActiveChunks] = useState<ChunkInfo[]>(() =>
    ChunkManager.getInstance()
      .getActiveChunks()
      .filter((c) => !((c.cx === -1 || c.cx === 0) && (c.cz === -1 || c.cz === 0)))
  );
  const [quality, setQuality] = useState<QualitySettings>(() => QualityManager.current);

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
  const facadeRoughnessMaps = useMemo<Record<FacadeStyleVariant, THREE.CanvasTexture>>(
    () => ({
      CURTAIN_GLASS: ProceduralTextures.getBuildingRoughnessMap('CURTAIN_GLASS'),
      DIAGRID_HEX: ProceduralTextures.getBuildingRoughnessMap('DIAGRID_HEX'),
      BRUTALIST_RIBBED: ProceduralTextures.getBuildingRoughnessMap('BRUTALIST_RIBBED'),
      ARCOLOGY_TERRACE: ProceduralTextures.getBuildingRoughnessMap('ARCOLOGY_TERRACE'),
    }),
    []
  );
  const sidewalkTex = useMemo(() => RoadGenerator.getSidewalkTexture(), []);
  const asphaltNormal = useMemo(() => ProceduralTextures.getAsphaltNormalMap(), []);
  const sidewalkNormal = useMemo(() => ProceduralTextures.getSidewalkNormalMap(), []);
  const claddingNormal = useMemo(() => ProceduralTextures.getBuildingCladdingNormalMap(), []);
  const prevSigRef = useRef('');

  // Dynamic shared materials updated in-place inside useFrame (zero React re-renders on time/weather ticks)
  const dynamicMats = useMemo(() => {
    const chunkAsphaltTex = RoadGenerator.getAsphaltTexture(8);
    const roadNsMat = new THREE.MeshStandardMaterial({
      map: chunkAsphaltTex,
      normalMap: asphaltNormal,
      roughness: 0.45,
      metalness: 0.55,
      envMapIntensity: 0.9,
    });
    const roadEwMat = new THREE.MeshStandardMaterial({
      map: chunkAsphaltTex,
      normalMap: asphaltNormal,
      roughness: 0.45,
      metalness: 0.55,
      envMapIntensity: 0.9,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -2,
    });
    const junctionMat = new THREE.MeshStandardMaterial({
      color: '#090d16',
      normalMap: asphaltNormal,
      roughness: 0.45,
      metalness: 0.55,
      envMapIntensity: 0.65,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -4,
    });
    const sidewalkMat = new THREE.MeshStandardMaterial({
      map: sidewalkTex,
      normalMap: sidewalkNormal,
      normalScale: SIDEWALK_NORMAL_SCALE,
      roughness: 0.5,
      metalness: 0.3,
      envMapIntensity: 0.45,
    });
    const lowDetailMat = new THREE.MeshStandardMaterial({
      map: facadeTextures.CURTAIN_GLASS,
      emissive: '#ffffff',
      emissiveMap: facadeEmissiveTextures.CURTAIN_GLASS,
      emissiveIntensity: 0.3,
      color: '#ffffff',
      roughness: 0.55,
      metalness: 0.55,
    });
    const facadeMats: Record<FacadeStyleVariant, THREE.MeshStandardMaterial> = {
      CURTAIN_GLASS: new THREE.MeshStandardMaterial({
        map: facadeTextures.CURTAIN_GLASS,
        emissive: '#ffffff',
        emissiveMap: facadeEmissiveTextures.CURTAIN_GLASS,
        emissiveIntensity: 0.3,
        normalMap: claddingNormal,
        normalScale: CLADDING_NORMAL_SCALE,
        roughnessMap: facadeRoughnessMaps.CURTAIN_GLASS,
        roughness: 0.92,
        metalness: 0.72,
      }),
      DIAGRID_HEX: new THREE.MeshStandardMaterial({
        map: facadeTextures.DIAGRID_HEX,
        emissive: '#ffffff',
        emissiveMap: facadeEmissiveTextures.DIAGRID_HEX,
        emissiveIntensity: 0.3,
        normalMap: claddingNormal,
        normalScale: CLADDING_NORMAL_SCALE,
        roughnessMap: facadeRoughnessMaps.DIAGRID_HEX,
        roughness: 0.92,
        metalness: 0.74,
      }),
      BRUTALIST_RIBBED: new THREE.MeshStandardMaterial({
        map: facadeTextures.BRUTALIST_RIBBED,
        emissive: '#ffffff',
        emissiveMap: facadeEmissiveTextures.BRUTALIST_RIBBED,
        emissiveIntensity: 0.3,
        normalMap: claddingNormal,
        normalScale: CLADDING_NORMAL_SCALE,
        roughnessMap: facadeRoughnessMaps.BRUTALIST_RIBBED,
        roughness: 0.96,
        metalness: 0.48,
      }),
      ARCOLOGY_TERRACE: new THREE.MeshStandardMaterial({
        map: facadeTextures.ARCOLOGY_TERRACE,
        emissive: '#ffffff',
        emissiveMap: facadeEmissiveTextures.ARCOLOGY_TERRACE,
        emissiveIntensity: 0.3,
        normalMap: claddingNormal,
        normalScale: CLADDING_NORMAL_SCALE,
        roughnessMap: facadeRoughnessMaps.ARCOLOGY_TERRACE,
        roughness: 0.92,
        metalness: 0.64,
      }),
    };
    const hdrAlwaysMat = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false });
    const hdrNightMat = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false });
    const hdrStreetBulbMat = new THREE.MeshBasicMaterial({ color: '#fde68a', toneMapped: false });
    const hdrBeaconMat = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false });
    const storefrontGlowMat = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false });

    return {
      roadNsMat,
      roadEwMat,
      junctionMat,
      sidewalkMat,
      lowDetailMat,
      facadeMats,
      hdrAlwaysMat,
      hdrNightMat,
      hdrStreetBulbMat,
      hdrBeaconMat,
      storefrontGlowMat,
    };
  }, [asphaltNormal, sidewalkTex, sidewalkNormal, claddingNormal, facadeTextures, facadeEmissiveTextures, facadeRoughnessMaps]);

  useEffect(() => {
    return () => {
      dynamicMats.roadNsMat.dispose();
      dynamicMats.roadEwMat.dispose();
      dynamicMats.junctionMat.dispose();
      dynamicMats.sidewalkMat.dispose();
      dynamicMats.lowDetailMat.dispose();
      Object.values(dynamicMats.facadeMats).forEach((m) => m.dispose());
      dynamicMats.hdrAlwaysMat.dispose();
      dynamicMats.hdrNightMat.dispose();
      dynamicMats.hdrStreetBulbMat.dispose();
      dynamicMats.hdrBeaconMat.dispose();
      dynamicMats.storefrontGlowMat.dispose();
    };
  }, [dynamicMats]);

  // Sync normal maps & reflection env scale only when quality settings change
  useEffect(() => {
    const envScale =
      quality.reflectionQuality === 'HIGH'
        ? 1.45
        : quality.reflectionQuality === 'MEDIUM'
        ? 0.9
        : quality.reflectionQuality === 'LOW'
        ? 0.35
        : 0;
    const useNormals = quality.normalMapsEnabled;
    if ((dynamicMats.roadNsMat.normalMap !== null) !== useNormals) {
      dynamicMats.roadNsMat.normalMap = useNormals ? asphaltNormal : null;
      dynamicMats.roadNsMat.needsUpdate = true;
    }
    if ((dynamicMats.roadEwMat.normalMap !== null) !== useNormals) {
      dynamicMats.roadEwMat.normalMap = useNormals ? asphaltNormal : null;
      dynamicMats.roadEwMat.needsUpdate = true;
    }
    if ((dynamicMats.junctionMat.normalMap !== null) !== useNormals) {
      dynamicMats.junctionMat.normalMap = useNormals ? asphaltNormal : null;
      dynamicMats.junctionMat.needsUpdate = true;
    }
    if ((dynamicMats.sidewalkMat.normalMap !== null) !== useNormals) {
      dynamicMats.sidewalkMat.normalMap = useNormals ? sidewalkNormal : null;
      dynamicMats.sidewalkMat.needsUpdate = true;
    }
    dynamicMats.roadNsMat.envMapIntensity = envScale;
    dynamicMats.roadEwMat.envMapIntensity = envScale;
    dynamicMats.junctionMat.envMapIntensity = envScale * 0.7;
    dynamicMats.sidewalkMat.envMapIntensity = envScale * 0.45;

    Object.values(dynamicMats.facadeMats).forEach((fm) => {
      fm.envMapIntensity = envScale;
      if ((fm.normalMap !== null) !== useNormals) {
        fm.normalMap = useNormals ? claddingNormal : null;
        fm.needsUpdate = true;
      }
    });
  }, [quality.normalMapsEnabled, quality.reflectionQuality, dynamicMats, asphaltNormal, sidewalkNormal, claddingNormal]);

  useEffect(() => {
    const uQual = QualityManager.subscribe(setQuality);
    const uChunks = ChunkManager.getInstance().subscribe((s) => {
      const filtered = s.chunks.filter(
        (c) => c.lod !== 'UNLOADED' && !((c.cx === -1 || c.cx === 0) && (c.cz === -1 || c.cz === 0))
      );
      const sig = filtered
        .map((c) => `${c.key}:${c.lod}`)
        .sort()
        .join('|');
      if (sig !== prevSigRef.current) {
        prevSigRef.current = sig;
        setActiveChunks(filtered);
      }
    });
    return () => {
      uQual();
      uChunks();
      ChunkManager.getInstance()
        .getActiveChunks()
        .forEach((c) => KinematicCollisionSolver.removeChunkBoxes(c.key));
    };
  }, []);

  const lowChunks = useMemo(() => activeChunks.filter((c) => c.lod === 'LOW'), [activeChunks]);
  const detailedChunks = useMemo(() => activeChunks.filter((c) => c.lod !== 'LOW'), [activeChunks]);

  // Keep KinematicCollisionSolver chunk boxes strictly in sync with active HIGH/MEDIUM chunks
  const registeredKeysRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const nextKeys = new Set<string>();
    for (let i = 0; i < detailedChunks.length; i++) {
      const chunk = detailedChunks[i];
      const data = ProceduralChunkGenerator.getChunkData(chunk.cx, chunk.cz);
      nextKeys.add(data.key);
      if (data.collisionBoxes.length > 0 && !registeredKeysRef.current.has(data.key)) {
        KinematicCollisionSolver.setChunkBoxes(data.key, data.collisionBoxes);
      }
    }
    for (const oldKey of registeredKeysRef.current) {
      if (!nextKeys.has(oldKey)) {
        KinematicCollisionSolver.removeChunkBoxes(oldKey);
      }
    }
    registeredKeysRef.current = nextKeys;
  }, [detailedChunks]);

  useEffect(() => {
    return () => {
      for (const oldKey of registeredKeysRef.current) {
        KinematicCollisionSolver.removeChunkBoxes(oldKey);
      }
      registeredKeysRef.current.clear();
    };
  }, []);

  // Build unified instanced geometry batches across ALL active HIGH & MEDIUM chunks (~28 draw calls total!)
  const batchedBuckets = useMemo(() => {
    const builder = new InstanceBatchBuilder();
    const vegOn = quality.vegetationEnabled;
    const furnOn = quality.streetFurnitureEnabled;

    for (let ci = 0; ci < detailedChunks.length; ci++) {
      const chunkInfo = detailedChunks[ci];
      const data = ProceduralChunkGenerator.getChunkData(chunkInfo.cx, chunkInfo.cz);
      if (data.buildings.length === 0 && data.roads.length === 0 && data.parks.length === 0) continue;

      const isHigh = chunkInfo.lod === 'HIGH';

      // Roads, Junctions, Sidewalks
      for (let i = 0; i < data.roads.length; i++) {
        const r = data.roads[i];
        const isEw = Math.abs(r.rotationY) > 0.1;
        builder.addWorld(isEw ? 'road_ew' : 'road_ns', r.position.x, r.position.y, r.position.z, r.size.x, r.size.y, r.size.z, 0, r.rotationY, 0);
      }
      for (let i = 0; i < data.junctions.length; i++) {
        const j = data.junctions[i];
        builder.addWorld('junction', j.position.x, j.position.y, j.position.z, j.size.x, j.size.y, j.size.z);
      }
      for (let i = 0; i < data.sidewalks.length; i++) {
        const sw = data.sidewalks[i];
        builder.addWorld('sidewalk', sw.position.x, sw.position.y, sw.position.z, sw.size.x, sw.size.y, sw.size.z);
      }

      // Pocket Parks
      for (let i = 0; i < data.parks.length; i++) {
        const park = data.parks[i];
        const px = park.position.x;
        const pz = park.position.z;
        builder.addWorld('box_colored_std', px, 0.11, pz, park.size.x, park.size.y, park.size.z, 0, 0, 0, '#052e16');
        builder.addWorld('box_hdr_always', px, 0.14, pz, park.size.x + 0.14, 0.04, park.size.z + 0.14, 0, 0, 0, park.fountainColor);

        if (park.hasPond) {
          const pondDiam = (park.pondRadius + 0.45) * 2;
          const waterDiam = park.pondRadius * 2;
          builder.addWorld('cyl_navy', px, 0.245, pz, pondDiam, 0.03, pondDiam);
          builder.addWorld('cyl_hdr_always', px, 0.27, pz, waterDiam, 0.02, waterDiam, 0, 0, 0, park.fountainColor);
          builder.addWorld('cyl_concrete', px, 0.495, pz, 1.65, 0.45, 1.65);
          builder.addWorld('cyl_navy', px, 1.395, pz, 0.88, 1.9, 0.88);
          builder.addWorld('cyl_chrome', px, 1.895, pz, 1.18, 0.14, 1.18);
          builder.addWorld('beacon_hdr', px, 2.625, pz, 0.58, 0.58, 0.58, 0, 0, 0, park.fountainColor);
        }

        if (isHigh) {
          for (let bIdx = 0; bIdx < park.benches.length; bIdx++) {
            const b = park.benches[bIdx];
            const bx = b.position.x;
            const bz = b.position.z;
            const rot = b.rotationY;
            builder.addLocal('box_navy', bx, 0.22, bz, rot, -0.82, 0.22, 0, 0.08, 0.44, 0.54);
            builder.addLocal('box_navy', bx, 0.22, bz, rot, 0.82, 0.22, 0, 0.08, 0.44, 0.54);
            builder.addLocal('box_timber', bx, 0.22, bz, rot, 0, 0.44, 0.08, 2.0, 0.07, 0.24);
            builder.addLocal('box_timber', bx, 0.22, bz, rot, 0, 0.44, -0.14, 2.0, 0.07, 0.2);
            builder.addLocal('box_timber', bx, 0.22, bz, rot, 0, 0.72, -0.26, 2.0, 0.22, 0.06, -0.16, 0, 0);
          }
          if (vegOn) {
            for (let tIdx = 0; tIdx < park.trees.length; tIdx++) {
              builder.addTree(park.trees[tIdx], TREE_BUCKET_KEYS);
            }
          }
        }
      }

      // Buildings (full detail on HIGH, clean silhouette + tiers + crowns + cornices on MEDIUM)
      for (let i = 0; i < data.buildings.length; i++) {
        const b = data.buildings[i];
        const bx = b.position.x;
        const bz = b.position.z;
        const sx = b.size.x;
        const sy = b.size.y;
        const sz = b.size.z;
        const topTier = b.tiers[b.tiers.length - 1];
        const facadeBucket = `${isHigh ? 'facade_high_' : 'facade_med_'}${b.facadeVariant || 'CURTAIN_GLASS'}`;

        // Street-level podium, storefronts, canopy
        builder.addWorld('box_podium', bx, 2.4, bz, sx + 0.7, 4.8, sz + 0.7);
        builder.addWorld('box_storefront', bx, 2.1, bz, sx * 0.74, 3.8, sz + 0.85, 0, 0, 0, b.accentColor);
        builder.addWorld('box_storefront', bx, 2.08, bz, sx + 0.85, 3.72, sz * 0.74, 0, 0, 0, b.emissiveColor);
        builder.addWorld('box_navy', bx, 4.7, bz, sx + 1.8, 0.25, sz + 1.8);

        for (let tIdx = 0; tIdx < b.tiers.length; tIdx++) {
          const tier = b.tiers[tIdx];
          const tw = tier.size.x;
          const th = tier.size.y;
          const td = tier.size.z;
          const tx = bx + tier.offset.x;
          const ty = tier.offset.y;
          const tz = bz + tier.offset.z;

          builder.addWorld(facadeBucket, tx, ty, tz, tw, th, td);

          if (isHigh) {
            builder.addWorld('box_podium', tx - tw / 2, ty, tz - td / 2, 0.7, th, 0.7);
            builder.addWorld('box_podium', tx + tw / 2, ty, tz - td / 2, 0.7, th, 0.7);
            builder.addWorld('box_podium', tx - tw / 2, ty, tz + td / 2, 0.7, th, 0.7);
            builder.addWorld('box_podium', tx + tw / 2, ty, tz + td / 2, 0.7, th, 0.7);
            builder.addWorld('box_fin', tx, ty, tz, 0.3, th * 0.94, td + 0.32);
            builder.addWorld('box_fin', tx, ty, tz, tw + 0.32, th * 0.92, 0.3);
          }

          builder.addWorld(
            'box_hdr_always',
            tx,
            ty + th / 2 - 0.25,
            tz,
            tw + 0.22,
            0.42,
            td + 0.22,
            0,
            0,
            0,
            tIdx % 2 === 0 ? b.accentColor : b.emissiveColor
          );
        }

        if (topTier) {
          builder.addWorld(
            'box_storefront',
            bx,
            sy + 1.4,
            bz,
            topTier.size.x * 0.68,
            2.6,
            topTier.size.z * 0.68,
            0,
            0,
            0,
            b.accentColor
          );
        }

        if (b.antenna) {
          builder.addWorld('cyl_slate', bx, sy + 2.6 + b.antenna.height / 2, bz, 0.45, b.antenna.height, 0.45);
          builder.addWorld('beacon_hdr', bx, sy + 2.6 + b.antenna.height + 0.4, bz, 1, 1, 1, 0, 0, 0, b.antenna.beaconColor);
        }
      }

      // Street-level trees, bushes, and furniture on HIGH LOD chunks near the player
      if (isHigh && vegOn) {
        for (let i = 0; i < data.trees.length; i++) {
          builder.addTree(data.trees[i], TREE_BUCKET_KEYS);
        }
        for (let i = 0; i < data.bushes.length; i++) {
          const bush = data.bushes[i];
          const bx = bush.position.x;
          const by = bush.position.y;
          const bz = bush.position.z;
          const sx = bush.size.x;
          const sy = bush.size.y;
          const sz = bush.size.z;
          builder.addWorld('box_concrete', bx, by - sy * 0.34, bz, sx * 1.12, sy * 0.34, sz * 1.12);
          builder.addWorld('box_chrome', bx, by - sy * 0.16, bz, sx * 1.15, 0.05, sz * 1.15);
          builder.addWorld('box_colored_std', bx, by + sy * 0.08, bz, sx, sy * 0.78, sz, 0, 0, 0, bush.color);
          builder.addWorld('box_colored_std', bx, by + sy * 0.42, bz, sx * 0.76, sy * 0.34, sz * 0.76, 0, 0, 0, bush.color);
          if (bush.hasFlowers && bush.flowerColor) {
            builder.addWorld('tree_trim', bx, by + sy * 0.62, bz, sx * 0.62, 0.08, sz * 0.62, 0, 0, 0, bush.flowerColor);
          }
        }
      }

      if (isHigh && furnOn) {
        for (let i = 0; i < data.furniture.length; i++) {
          const f = data.furniture[i];
          const fx = f.position.x;
          const fy = f.position.y;
          const fz = f.position.z;
          const rot = f.rotationY;
          const emissiveColor = f.emissiveColor || '#f59e0b';
          const accentColor = f.accentColor || '#38bdf8';

          if (f.type === 'STREETLIGHT') {
            builder.addLocal('plinth_navy', fx, fy, fz, rot, 0, 0.26, 0, 0.95, 0.52, 0.95);
            builder.addLocal('cyl_chrome', fx, fy, fz, rot, 0, 0.58, 0, 0.38, 0.1, 0.38);
            builder.addLocal('pole_slate', fx, fy, fz, rot, 0, 3.35, 0, 0.95, 5.55, 0.95);
            builder.addLocal('box_navy', fx, fy, fz, rot, -0.16, 2.25, 0, 0.22, 0.5, 0.24);
            builder.addLocal('box_chrome', fx, fy, fz, rot, 0.38, 5.7, 0, 0.06, 0.95, 0.07, 0, 0, -0.68);
            builder.addLocal('box_navy', fx, fy, fz, rot, 0.88, 6.1, 0, 1.8, 0.12, 0.18);
            builder.addLocal('box_slate', fx, fy, fz, rot, 1.48, 6.06, 0, 0.88, 0.14, 0.4);
            builder.addLocal('box_street_bulb', fx, fy, fz, rot, 1.48, 5.96, 0, 0.74, 0.05, 0.3);
          } else if (f.type === 'BUS_STOP') {
            builder.addLocal('box_concrete', fx, fy, fz, rot, 0, 0.06, 0, 4.0, 0.12, 1.85);
            for (const mx of [-1.65, -0.55, 0.55, 1.65]) {
              builder.addLocal('box_navy', fx, fy, fz, rot, mx, 1.35, -0.74, 0.11, 2.5, 0.12);
            }
            builder.addLocal('box_glass', fx, fy, fz, rot, 0, 1.35, -0.74, 3.22, 2.24, 0.05);
            builder.addLocal('box_glass', fx, fy, fz, rot, -1.65, 1.35, -0.08, 0.05, 2.24, 1.32);
            builder.addLocal('box_slate', fx, fy, fz, rot, 0, 2.65, 0.02, 4.1, 0.17, 1.9);
            builder.addLocal('box_hdr_night', fx, fy, fz, rot, 0, 2.55, 0.88, 3.8, 0.05, 0.1, 0, 0, 0, accentColor);
            builder.addLocal('box_timber', fx, fy, fz, rot, -0.3, 0.45, -0.32, 2.15, 0.08, 0.44);
            builder.addLocal('box_podium', fx, fy, fz, rot, 1.65, 1.32, 0.1, 0.22, 2.38, 0.72);
            builder.addLocal('box_hdr_night', fx, fy, fz, rot, 1.77, 1.44, 0.1, 0.03, 1.4, 0.5, 0, 0, 0, accentColor);
          } else if (f.type === 'CYBER_KIOSK') {
            builder.addLocal('box_concrete', fx, fy, fz, rot, 0, 0.13, 0, 1.08, 0.26, 0.62);
            builder.addLocal('box_podium', fx, fy, fz, rot, 0, 1.35, 0, 0.88, 2.22, 0.38);
            builder.addLocal('box_chrome', fx, fy, fz, rot, -0.45, 1.35, 0.03, 0.05, 2.16, 0.4);
            builder.addLocal('box_chrome', fx, fy, fz, rot, 0.45, 1.35, 0.03, 0.05, 2.16, 0.4);
            builder.addLocal('box_hdr_always', fx, fy, fz, rot, 0, 1.54, 0.2, 0.68, 1.2, 0.03, 0, 0, 0, accentColor);
            builder.addLocal('box_slate', fx, fy, fz, rot, 0, 0.82, 0.26, 0.72, 0.07, 0.26, 0.42, 0, 0);
            builder.addLocal('box_navy', fx, fy, fz, rot, 0, 2.46, 0.12, 0.98, 0.11, 0.64);
            builder.addLocal('box_hdr_always', fx, fy, fz, rot, 0, 2.55, 0.05, 0.88, 0.07, 0.44, 0, 0, 0, emissiveColor);
          } else if (f.type === 'BOLLARD') {
            for (const bx of [-1.05, 0, 1.05]) {
              builder.addLocal('cyl_chrome', fx, fy, fz, rot, bx, 0.05, 0, 0.32, 0.1, 0.32);
              builder.addLocal('cyl_navy', fx, fy, fz, rot, bx, 0.48, 0, 0.22, 0.84, 0.22);
              builder.addLocal('cyl_chrome', fx, fy, fz, rot, bx, 0.7, 0, 0.24, 0.05, 0.24);
              builder.addLocal('cyl_hdr_night', fx, fy, fz, rot, bx, 0.85, 0, 0.24, 0.08, 0.24, 0, 0, 0, accentColor);
              builder.addLocal('bollard_cap', fx, fy, fz, rot, bx, 0.94, 0, 0.88, 0.09, 0.88);
            }
          } else if (f.type === 'TRASH_RECEPTACLE') {
            builder.addLocal('box_concrete', fx, fy, fz, rot, 0, 0.06, 0, 0.68, 0.12, 0.58);
            builder.addLocal('box_podium', fx, fy, fz, rot, 0, 0.58, 0, 0.56, 0.94, 0.48);
            builder.addLocal('box_chrome', fx, fy, fz, rot, 0, 0.58, 0, 0.6, 0.12, 0.5);
            builder.addLocal('box_navy', fx, fy, fz, rot, 0, 0.92, 0.24, 0.38, 0.18, 0.06);
            builder.addLocal('box_slate', fx, fy, fz, rot, 0, 1.12, 0, 0.62, 0.14, 0.54);
            builder.addLocal('box_hdr_night', fx, fy, fz, rot, 0, 1.04, 0, 0.58, 0.05, 0.52, 0, 0, 0, emissiveColor);
          } else {
            builder.addLocal('box_navy', fx, fy, fz, rot, -0.82, 0.22, 0, 0.08, 0.44, 0.56);
            builder.addLocal('box_navy', fx, fy, fz, rot, 0.82, 0.22, 0, 0.08, 0.44, 0.56);
            builder.addLocal('box_timber', fx, fy, fz, rot, 0, 0.44, 0.12, 2.0, 0.06, 0.2);
            builder.addLocal('box_timber', fx, fy, fz, rot, 0, 0.44, -0.12, 2.0, 0.06, 0.2);
            builder.addLocal('box_timber', fx, fy, fz, rot, 0, 0.72, -0.26, 2.0, 0.22, 0.06, -0.18, 0, 0);
            builder.addLocal('box_hdr_night', fx, fy, fz, rot, 0, 0.16, 0, 1.6, 0.04, 0.34, 0, 0, 0, emissiveColor);
          }
        }
      }

      // Biome Props (on HIGH + MEDIUM when streetFurnitureEnabled)
      if (furnOn) {
        for (let i = 0; i < data.biomeProps.length; i++) {
          const prop = data.biomeProps[i];
          const px = prop.position.x;
          const py = prop.position.y;
          const pz = prop.position.z;
          const rot = prop.rotationY;
          const { x: sx, y: sy, z: sz } = prop.size;
          const em = prop.emissiveColor;

          if (prop.type === 'STORAGE_TANK') {
            builder.addLocal('box_concrete', px, py, pz, rot, 0, 0.16, 0, sx * 1.2, 0.32, sz * 1.2);
            builder.addLocal('cyl_colored_metal', px, py, pz, rot, 0, sy * 0.46, 0, sx, sy * 0.82, sz, 0, 0, 0, prop.color);
            builder.addLocal('dome_chrome', px, py, pz, rot, 0, sy * 0.86, 0, sx * 0.98, sy * 0.28, sz * 0.98);
            builder.addLocal('cyl_navy', px, py, pz, rot, 0, sy * 0.56, 0, sx * 1.14, 0.14, sz * 1.14);
            builder.addLocal('cyl_chrome', px, py, pz, rot, sx * 0.54, sy * 0.46, 0, 0.16, sy * 0.78, 0.16);
            if (em) builder.addLocal('cyl_hdr_always', px, py, pz, rot, 0, sy * 0.66, 0, sx * 1.06, 0.12, sz * 1.06, 0, 0, 0, em);
          } else if (prop.type === 'SERVER_NODE') {
            builder.addLocal('box_concrete', px, py, pz, rot, 0, 0.14, 0, sx * 1.18, 0.28, sz * 1.18);
            builder.addLocal('box_colored_metal', px, py, pz, rot, 0, sy * 0.5, 0, sx, sy * 0.88, sz, 0, 0, 0, prop.color);
            builder.addLocal('box_podium', px, py, pz, rot, 0, sy * 0.32, 0, sx * 1.06, 0.14, sz * 1.06);
            builder.addLocal('box_podium', px, py, pz, rot, 0, sy * 0.62, 0, sx * 1.06, 0.14, sz * 1.06);
            builder.addLocal('box_chrome', px, py, pz, rot, 0, sy * 0.96, 0, sx * 0.92, 0.16, sz * 0.92);
            if (em) {
              builder.addLocal('box_hdr_always', px, py, pz, rot, 0, sy * 0.5, sz * 0.52, sx * 0.16, sy * 0.72, 0.05, 0, 0, 0, em);
              builder.addLocal('box_hdr_always', px, py, pz, rot, 0, sy * 0.84, 0, sx * 1.04, 0.09, sz * 1.04, 0, 0, 0, em);
            }
          } else if (prop.type === 'HISTORIC_PILLAR') {
            builder.addLocal('box_concrete', px, py, pz, rot, 0, 0.2, 0, sx * 1.35, 0.4, sz * 1.35);
            builder.addLocal('box_chrome', px, py, pz, rot, 0, 0.48, 0, sx * 1.12, 0.16, sz * 1.12);
            builder.addLocal('cyl_colored_metal', px, py, pz, rot, 0, sy * 0.52, 0, sx * 0.82, sy * 0.84, sz * 0.82, 0, 0, 0, prop.color);
            builder.addLocal('box_concrete', px, py, pz, rot, 0, sy * 0.94, 0, sx * 1.24, 0.24, sz * 1.24);
            if (em) builder.addLocal('cyl_hdr_always', px, py, pz, rot, 0, sy * 0.84, 0, sx * 0.92, 0.1, sz * 0.92, 0, 0, 0, em);
          } else if (prop.type === 'AERO_MAST') {
            builder.addLocal('box_concrete', px, py, pz, rot, 0, 0.18, 0, sx * 1.4, 0.36, sz * 1.4);
            builder.addLocal('pole_slate', px, py, pz, rot, 0, sy * 0.5, 0, sx * 1.8, sy, sz * 1.8);
            builder.addLocal('box_chrome', px, py, pz, rot, 0, sy * 0.74, 0, sx * 3.4, 0.1, 0.12);
            builder.addLocal('box_chrome', px, py, pz, rot, 0, sy * 0.55, 0, 0.12, 0.1, sz * 2.8);
            if (em) builder.addLocal('beacon_hdr', px, py, pz, rot, 0, sy + 0.24, 0, 0.42, 0.42, 0.42, 0, 0, 0, em);
          } else if (prop.type === 'PLANTER_VASE') {
            builder.addLocal('box_concrete', px, py, pz, rot, 0, 0.16, 0, sx * 1.15, 0.32, sz * 1.15);
            builder.addLocal('cyl_colored_metal', px, py, pz, rot, 0, sy * 0.52, 0, sx, sy * 0.58, sz, 0, 0, 0, prop.color);
            builder.addLocal('cyl_chrome', px, py, pz, rot, 0, sy * 0.82, 0, sx * 1.12, 0.1, sz * 1.12);
            builder.addLocal('dome_foliage', px, py, pz, rot, 0, sy * 1.05, 0, sx * 0.96, sy * 0.72, sz * 0.96);
            if (em) builder.addLocal('cyl_hdr_always', px, py, pz, rot, 0, sy * 0.62, 0, sx * 1.05, 0.08, sz * 1.05, 0, 0, 0, em);
          } else {
            builder.addLocal('box_podium', px, py, pz, rot, 0, 0.14, 0, sx * 1.18, 0.28, sz * 1.18);
            builder.addLocal('box_colored_metal', px, py, pz, rot, 0, sy * 0.5, 0, sx, sy, sz, 0, 0, 0, prop.color);
            builder.addLocal('box_chrome', px, py, pz, rot, 0, sy * 0.28, 0, sx * 1.08, 0.12, sz * 1.08);
            builder.addLocal('box_podium', px, py, pz, rot, 0, sy * 0.96, 0, sx * 1.1, 0.16, sz * 1.1);
            if (em) {
              builder.addLocal('box_hdr_always', px, py, pz, rot, 0, sy * 0.56, 0, sx + 0.12, 0.12, sz + 0.12, 0, 0, 0, em);
              builder.addLocal('box_hdr_always', px, py, pz, rot, 0, sy - 0.18, 0, sx + 0.08, 0.14, sz + 0.08, 0, 0, 0, em);
            }
          }
        }
      }
    }

    return builder.build();
  }, [detailedChunks, quality.vegetationEnabled, quality.streetFurnitureEnabled]);

  const bucketSpecs = useMemo<InstanceBucketSpec[]>(
    () => [
      { key: 'road_ns', geometry: SHARED_ROAD_PLANE, material: dynamicMats.roadNsMat, receiveShadow: quality.shadows, renderOrder: 1 },
      { key: 'road_ew', geometry: SHARED_ROAD_PLANE, material: dynamicMats.roadEwMat, receiveShadow: quality.shadows, renderOrder: 2 },
      { key: 'junction', geometry: SHARED_ROAD_PLANE, material: dynamicMats.junctionMat, receiveShadow: quality.shadows, renderOrder: 3 },
      { key: 'sidewalk', geometry: SHARED_BEVELED_BOX, material: dynamicMats.sidewalkMat, receiveShadow: quality.shadows },

      // Primary HIGH-LOD building hulls (smooth chamfered architectural prisms)
      {
        key: 'facade_high_CURTAIN_GLASS',
        geometry: SHARED_BUILDING_PRISM,
        material: dynamicMats.facadeMats.CURTAIN_GLASS,
        castShadow: quality.shadows,
        receiveShadow: quality.shadows,
      },
      {
        key: 'facade_high_DIAGRID_HEX',
        geometry: SHARED_BUILDING_PRISM,
        material: dynamicMats.facadeMats.DIAGRID_HEX,
        castShadow: quality.shadows,
        receiveShadow: quality.shadows,
      },
      {
        key: 'facade_high_BRUTALIST_RIBBED',
        geometry: SHARED_BUILDING_PRISM,
        material: dynamicMats.facadeMats.BRUTALIST_RIBBED,
        castShadow: quality.shadows,
        receiveShadow: quality.shadows,
      },
      {
        key: 'facade_high_ARCOLOGY_TERRACE',
        geometry: SHARED_BUILDING_PRISM,
        material: dynamicMats.facadeMats.ARCOLOGY_TERRACE,
        castShadow: quality.shadows,
        receiveShadow: quality.shadows,
      },

      // MEDIUM-LOD building hulls (smooth chamfered prisms, no shadow casting for fast shadow pass)
      {
        key: 'facade_med_CURTAIN_GLASS',
        geometry: SHARED_BUILDING_PRISM,
        material: dynamicMats.facadeMats.CURTAIN_GLASS,
        receiveShadow: quality.shadows,
      },
      {
        key: 'facade_med_DIAGRID_HEX',
        geometry: SHARED_BUILDING_PRISM,
        material: dynamicMats.facadeMats.DIAGRID_HEX,
        receiveShadow: quality.shadows,
      },
      {
        key: 'facade_med_BRUTALIST_RIBBED',
        geometry: SHARED_BUILDING_PRISM,
        material: dynamicMats.facadeMats.BRUTALIST_RIBBED,
        receiveShadow: quality.shadows,
      },
      {
        key: 'facade_med_ARCOLOGY_TERRACE',
        geometry: SHARED_BUILDING_PRISM,
        material: dynamicMats.facadeMats.ARCOLOGY_TERRACE,
        receiveShadow: quality.shadows,
      },

      // Shared structural box materials (smooth beveled boxes)
      { key: 'box_podium', geometry: SHARED_BEVELED_BOX, material: MAT_PODIUM, receiveShadow: quality.shadows },
      { key: 'box_navy', geometry: SHARED_BEVELED_BOX, material: MAT_NAVY },
      { key: 'box_slate', geometry: SHARED_BEVELED_BOX, material: MAT_SLATE },
      { key: 'box_fin', geometry: SHARED_BEVELED_BOX, material: MAT_FIN },
      { key: 'box_concrete', geometry: SHARED_BEVELED_BOX, material: MAT_CONCRETE, receiveShadow: quality.shadows },
      { key: 'box_chrome', geometry: SHARED_BEVELED_BOX, material: MAT_CHROME },
      { key: 'box_timber', geometry: SHARED_BEVELED_BOX, material: MAT_TIMBER },
      { key: 'box_glass', geometry: SHARED_BEVELED_BOX, material: MAT_GLASS },
      { key: 'box_colored_std', geometry: SHARED_BEVELED_BOX, material: MAT_COLORED_STD },
      { key: 'box_colored_metal', geometry: SHARED_BEVELED_BOX, material: MAT_COLORED_METAL },

      // Shared HDR / emissive strips, storefronts, streetlights, beacons
      { key: 'box_storefront', geometry: SHARED_UNIT_BOX, material: dynamicMats.storefrontGlowMat },
      { key: 'box_hdr_always', geometry: SHARED_UNIT_BOX, material: dynamicMats.hdrAlwaysMat },
      { key: 'box_hdr_night', geometry: SHARED_UNIT_BOX, material: dynamicMats.hdrNightMat },
      { key: 'box_street_bulb', geometry: SHARED_UNIT_BOX, material: dynamicMats.hdrStreetBulbMat },
      { key: 'beacon_hdr', geometry: SHARED_BEACON_SPHERE, material: dynamicMats.hdrBeaconMat },

      // Shared cylindrical & specialized prop geometries
      { key: 'cyl_navy', geometry: SHARED_UNIT_CYLINDER, material: MAT_NAVY },
      { key: 'cyl_slate', geometry: SHARED_UNIT_CYLINDER, material: MAT_SLATE },
      { key: 'cyl_chrome', geometry: SHARED_UNIT_CYLINDER, material: MAT_CHROME },
      { key: 'cyl_concrete', geometry: SHARED_UNIT_CYLINDER, material: MAT_CONCRETE },
      { key: 'cyl_colored_metal', geometry: SHARED_UNIT_CYLINDER, material: MAT_COLORED_METAL },
      { key: 'cyl_hdr_always', geometry: SHARED_UNIT_CYLINDER, material: dynamicMats.hdrAlwaysMat },
      { key: 'cyl_hdr_night', geometry: SHARED_UNIT_CYLINDER, material: dynamicMats.hdrNightMat },
      { key: 'pole_slate', geometry: SHARED_TAPER_POLE, material: MAT_SLATE },
      { key: 'plinth_navy', geometry: SHARED_OCT_PLINTH, material: MAT_NAVY },
      { key: 'bollard_cap', geometry: SHARED_BOLLARD_CAP, material: MAT_SLATE },
      { key: 'dome_chrome', geometry: SHARED_DOME_CAP, material: MAT_CHROME },
      { key: 'dome_foliage', geometry: SHARED_DOME_CAP, material: MAT_DOME_FOLIAGE },

      // Batched trees across all streamed chunks (beveled planters + smooth organic crowns)
      { key: 'tree_planter_plinth', geometry: SHARED_BEVELED_BOX, material: MAT_PLANTER_PLINTH, receiveShadow: quality.shadows },
      { key: 'tree_planter_coping', geometry: SHARED_BEVELED_BOX, material: MAT_PLANTER_COPING },
      { key: 'tree_soil', geometry: SHARED_UNIT_BOX, material: MAT_SOIL_BED },
      { key: 'tree_trim', geometry: SHARED_UNIT_BOX, material: MAT_TRIM_BASIC },
      { key: 'tree_mound', geometry: SHARED_MOUND_GEO, material: MAT_MOUND },
      { key: 'tree_root', geometry: SHARED_ROOT_FLARE_GEO, material: MAT_ROOT },
      { key: 'tree_trunk', geometry: SHARED_TRUNK_GEO, material: MAT_TRUNK },
      { key: 'tree_branch', geometry: SHARED_BRANCH_GEO, material: MAT_TRUNK },
      { key: 'tree_foliage', geometry: SHARED_CROWN_GEO, material: MAT_FOLIAGE },
    ],
    [dynamicMats, quality.shadows]
  );

  // Smooth zero-allocation material parameter updates (no React re-renders!)
  const lastUpdateRef = useRef(-1);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (t - lastUpdateRef.current < 0.08) return;
    lastUpdateRef.current = t;

    const timeState = TimeSystem.getInstance().getState();
    const weatherState = WeatherSystem.getInstance().getState();
    const eventState = LivingCityEventSystem.getInstance().getState();
    const gridIsOut = eventState.type === 'POWER_OUTAGE' && eventState.phase === 'ACTIVE';
    const nf = timeState.nightFactor;
    const lightsOn = !gridIsOut && timeState.streetLightsOn && QualityManager.current.nightLightsEnabled;

    const effectiveWetness = QualityManager.current.wetReflectionsEnabled ? weatherState.wetnessFactor : 0;
    const roadRough = THREE.MathUtils.lerp(0.45, 0.08, effectiveWetness);
    const roadMetal = THREE.MathUtils.lerp(0.55, 0.88, effectiveWetness);
    dynamicMats.roadNsMat.roughness = roadRough;
    dynamicMats.roadNsMat.metalness = roadMetal;
    dynamicMats.roadEwMat.roughness = roadRough;
    dynamicMats.roadEwMat.metalness = roadMetal;
    dynamicMats.junctionMat.roughness = roadRough;
    dynamicMats.junctionMat.metalness = roadMetal;

    const facadeEmissive = gridIsOut ? 0.03 : 0.1 + nf * 1.72;
    dynamicMats.lowDetailMat.emissiveIntensity = facadeEmissive;
    dynamicMats.facadeMats.CURTAIN_GLASS.emissiveIntensity = facadeEmissive;
    dynamicMats.facadeMats.DIAGRID_HEX.emissiveIntensity = facadeEmissive;
    dynamicMats.facadeMats.BRUTALIST_RIBBED.emissiveIntensity = facadeEmissive;
    dynamicMats.facadeMats.ARCOLOGY_TERRACE.emissiveIntensity = facadeEmissive;

    const neonBoost = gridIsOut ? 0.35 : 0.95 + nf * 1.25;
    const beaconBoost = gridIsOut ? 0.4 : 1.2 + nf * 1.6;
    const storefrontGain = gridIsOut ? 0.18 : 0.42 + nf * 0.88;
    dynamicMats.hdrAlwaysMat.color.setScalar(neonBoost);
    dynamicMats.hdrBeaconMat.color.setScalar(beaconBoost);
    dynamicMats.storefrontGlowMat.color.setScalar(storefrontGain);

    if (lightsOn) {
      dynamicMats.hdrNightMat.color.setScalar(neonBoost);
      dynamicMats.hdrStreetBulbMat.color.set('#fde68a').multiplyScalar(2.6);
    } else {
      dynamicMats.hdrNightMat.color.set('#1e293b');
      dynamicMats.hdrStreetBulbMat.color.set('#1e293b');
    }
  });

  return (
    <group name="StreamedCityChunksLayer">
      <LowDetailChunks chunks={lowChunks} material={dynamicMats.lowDetailMat} />
      <InstancedBatchLayer buckets={batchedBuckets} specs={bucketSpecs} name="DetailedStreamedChunksBatched" />
    </group>
  );
};
