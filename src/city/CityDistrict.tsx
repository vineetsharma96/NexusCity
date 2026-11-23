import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { CityGenerator, CityData } from './CityGenerator';
import { RoadGenerator } from './RoadGenerator';
import { VegetationGenerator, TreeDef } from './VegetationGenerator';
import { CyberVideoBillboard } from './CyberVideoBillboard';
import { FacadeStyleVariant, ProceduralTextures } from '../core/ProceduralTextures';
import { TimeSystem } from '../world/TimeSystem';
import { WeatherSystem } from '../world/WeatherSystem';
import { QualityManager, QualitySettings } from '../rendering/QualityManager';
import { StreetSign } from './StreetSign';
import { NavigationSystem } from '../map/NavigationSystem';
import { LivingCityEventSystem } from '../world/LivingCityEventSystem';
import { KinematicCollisionSolver } from '../player/KinematicCollision';
import { InstanceBatchBuilder, TreeBucketKeys } from '../rendering/StaticInstanceBatcher';
import { InstanceBucketSpec, InstancedBatchLayer } from '../rendering/InstancedBatchView';
import {
  createSmoothBeveledBoxGeometry,
  createSmoothBuildingPrismGeometry,
  createSmoothFoliageCrownGeometry,
} from '../rendering/SmoothWorldGeometries';

// Shared static unit geometries (smooth beveled prisms, high-segment cylinders, organic foliage)
const SHARED_UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const SHARED_BEVELED_BOX = createSmoothBeveledBoxGeometry(0.055, 2);
const SHARED_BUILDING_PRISM = createSmoothBuildingPrismGeometry(0.032, 2);
const SHARED_ROAD_PLANE = (() => {
  const g = new THREE.PlaneGeometry(1, 1);
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0.5, 0);
  return g;
})();
const SHARED_UNIT_CYLINDER = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
const SHARED_TAPER_POLE = new THREE.CylinderGeometry(0.08, 0.15, 1, 14);
const SHARED_OCT_PLINTH = new THREE.CylinderGeometry(0.28, 0.38, 1, 16);
const SHARED_BOLLARD_CAP = new THREE.CylinderGeometry(0.08, 0.14, 1, 14);
const SHARED_MAST_TAPER = new THREE.CylinderGeometry(0.07, 0.28, 1, 14);
const SHARED_BEACON_SPHERE = new THREE.SphereGeometry(1, 14, 10);
const SHARED_CROWN_TORUS = new THREE.TorusGeometry(1, 0.08, 12, 32);
const SHARED_DISH_CONE = new THREE.ConeGeometry(1.0, 0.55, 20, 1, true);
const SHARED_FLAT_RING = new THREE.RingGeometry(0.84, 1.0, 28);
const SHARED_STEAM_PLANE = new THREE.PlaneGeometry(1.8, 1.1);
const SHARED_STEAM_CONE = new THREE.ConeGeometry(0.85, 2.4, 14, 1, true);
const SHARED_DRONE_SPHERE = new THREE.SphereGeometry(0.14, 12, 10);
const SHARED_DRONE_CONE = new THREE.ConeGeometry(2.2, 8.2, 16, 1, true);
const SHARED_MOUND_GEO = new THREE.CylinderGeometry(1.6, 2.0, 0.14, 14);
const SHARED_ROOT_FLARE_GEO = new THREE.CylinderGeometry(0.9, 1.48, 0.55, 12);
const SHARED_TRUNK_GEO = new THREE.CylinderGeometry(0.7, 1.0, 1.0, 12);
const SHARED_BRANCH_GEO = new THREE.CylinderGeometry(0.7, 1.0, 1.0, 10);
const SHARED_CROWN_GEO = createSmoothFoliageCrownGeometry();

const PLAZA_NORMAL_SCALE = new THREE.Vector2(0.36, 0.36);
const AVE_NORMAL_SCALE = new THREE.Vector2(0.38, 0.38);
const AVE_ULTRA_NORMAL_SCALE = new THREE.Vector2(0.52, 0.52);
const SW_NORMAL_SCALE = new THREE.Vector2(0.42, 0.42);
const BLDG_NORMAL_SCALE = new THREE.Vector2(0.62, 0.62);
const BLDG_ULTRA_NORMAL_SCALE = new THREE.Vector2(0.85, 0.85);

// Shared static PBR materials (never re-created per building or per render)
const MAT_PODIUM = new THREE.MeshStandardMaterial({ color: '#0b1120', metalness: 0.88, roughness: 0.26 });
const MAT_CANOPY = new THREE.MeshStandardMaterial({ color: '#0f172a', metalness: 0.92, roughness: 0.2 });
const MAT_PIER = new THREE.MeshStandardMaterial({ color: '#111827', metalness: 0.9, roughness: 0.22 });
const MAT_FIN = new THREE.MeshStandardMaterial({ color: '#111c33', metalness: 0.9, roughness: 0.22 });
const MAT_PARAPET = new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.9, roughness: 0.18 });
const MAT_POLE = new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.88, roughness: 0.24 });
const MAT_MAST = new THREE.MeshStandardMaterial({ color: '#475569', metalness: 0.92, roughness: 0.18 });
const MAT_DISH = new THREE.MeshStandardMaterial({
  color: '#e2e8f0',
  metalness: 0.85,
  roughness: 0.2,
  side: THREE.DoubleSide,
});
const MAT_SOLAR = new THREE.MeshStandardMaterial({ color: '#0c2340', metalness: 0.92, roughness: 0.14 });
const MAT_TIMBER = new THREE.MeshStandardMaterial({ color: '#6b4226', metalness: 0.08, roughness: 0.72 });
const MAT_CONCRETE = new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.22, roughness: 0.78 });
const MAT_CHROME = new THREE.MeshStandardMaterial({ color: '#94a3b8', metalness: 0.94, roughness: 0.18 });
const MAT_GLASS = new THREE.MeshStandardMaterial({
  color: '#0f2238',
  metalness: 0.92,
  roughness: 0.08,
  transparent: true,
  opacity: 0.48,
});
const MAT_BRIDGE_GLASS = new THREE.MeshStandardMaterial({
  color: '#0f172a',
  metalness: 0.9,
  roughness: 0.14,
  transparent: true,
  opacity: 0.82,
});
const MAT_STEAM_PLUME = new THREE.MeshBasicMaterial({
  color: '#ffffff',
  transparent: true,
  opacity: 0.09,
  depthWrite: false,
  side: THREE.DoubleSide,
});
const MAT_BASIC_COLORED = new THREE.MeshBasicMaterial({ color: '#ffffff' });
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

const DRONE_COUNT = 12;
const DRONE_ROTOR_OFFSETS: readonly [number, number][] = [
  [-0.75, 0.65],
  [0.75, 0.65],
  [-0.75, -0.65],
  [0.75, -0.65],
];

const OVERHEAD_GANTRIES: readonly [number, number, number, string][] = [
  [0, -48, 0, '#38bdf8'],
  [0, 48, 0, '#f59e0b'],
  [-48, 0, Math.PI / 2, '#10b981'],
  [48, 0, Math.PI / 2, '#38bdf8'],
  [0, -135, 0, '#38bdf8'],
  [0, 135, 0, '#f43f5e'],
  [-135, 0, Math.PI / 2, '#f59e0b'],
  [135, 0, Math.PI / 2, '#10b981'],
  [0, -225, 0, '#4a8ad6'],
  [0, 195, 0, '#10b981'],
  [-225, 0, Math.PI / 2, '#10b981'],
  [225, 0, Math.PI / 2, '#f59e0b'],
];

const PLAZA_PYLONS: readonly [number, number][] = [
  [-13.4, -13.4],
  [13.4, -13.4],
  [-13.4, 13.4],
  [13.4, 13.4],
];

interface CityDistrictProps {
  seed?: number;
}

export const CityDistrict: React.FC<CityDistrictProps> = ({ seed = 847291 }) => {
  const cityData: CityData = useMemo(() => CityGenerator.generateDistrict(seed), [seed]);
  const trees: TreeDef[] = useMemo(() => VegetationGenerator.generateTrees(seed), [seed]);
  const astrolabeRef = useRef<THREE.Group>(null);

  // Instanced refs for the 12 autonomous aerial recon drones (4 draw calls total instead of 84)
  const droneBodyRef = useRef<THREE.InstancedMesh>(null);
  const droneRotorRef = useRef<THREE.InstancedMesh>(null);
  const droneEyeRef = useRef<THREE.InstancedMesh>(null);
  const droneConeRef = useRef<THREE.InstancedMesh>(null);
  const droneDummy = useMemo(() => new THREE.Object3D(), []);
  const droneChildDummy = useMemo(() => new THREE.Object3D(), []);
  const droneMatScratch = useMemo(() => new THREE.Matrix4(), []);

  const [quality, setQuality] = useState<QualitySettings>(() => QualityManager.current);

  useEffect(() => {
    return QualityManager.subscribe(setQuality);
  }, []);

  // Register global collision boxes for all avenue trees cleanly (replaces 45 individual ProceduralTree effects)
  useEffect(() => {
    if (!quality.vegetationEnabled) return;
    const entries = trees.map((tree) => {
      const halfR = Math.max(0.35, tree.trunkRadius * 1.2);
      return {
        center: tree.position.clone().add(new THREE.Vector3(0, tree.trunkHeight / 2, 0)),
        size: new THREE.Vector3(halfR * 2, tree.trunkHeight, halfR * 2),
      };
    });
    entries.forEach(({ center, size }) => KinematicCollisionSolver.addBox(center, size));
    return () => {
      entries.forEach(({ center }) => KinematicCollisionSolver.removeBox(center));
    };
  }, [trees, quality.vegetationEnabled]);

  const isUltra = quality.name === 'ULTRA';
  const showFineMolding = quality.LODQuality !== 'LOW';

  const asphaltTexLongNs = useMemo(() => RoadGenerator.getAsphaltTexture(76), []);
  const asphaltTexLongEw = useMemo(() => RoadGenerator.getAsphaltTexture(124), []);
  const asphaltTexMed = useMemo(() => RoadGenerator.getAsphaltTexture(16), []);
  const asphaltTexShort = useMemo(() => RoadGenerator.getAsphaltTexture(4), []);
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
  const facadeRoughnessMaps = useMemo<Record<FacadeStyleVariant, THREE.CanvasTexture>>(
    () => ({
      CURTAIN_GLASS: ProceduralTextures.getBuildingRoughnessMap('CURTAIN_GLASS'),
      DIAGRID_HEX: ProceduralTextures.getBuildingRoughnessMap('DIAGRID_HEX'),
      BRUTALIST_RIBBED: ProceduralTextures.getBuildingRoughnessMap('BRUTALIST_RIBBED'),
      ARCOLOGY_TERRACE: ProceduralTextures.getBuildingRoughnessMap('ARCOLOGY_TERRACE'),
    }),
    []
  );
  const plazaTex = useMemo(() => ProceduralTextures.getPlazaGridTexture(), []);
  const asphaltNormal = useMemo(() => ProceduralTextures.getAsphaltNormalMap(), []);
  const sidewalkNormal = useMemo(() => ProceduralTextures.getSidewalkNormalMap(), []);
  const puddleRoughness = useMemo(() => ProceduralTextures.getWetPuddleRoughnessMap(), []);
  const claddingNormal = useMemo(() => ProceduralTextures.getBuildingCladdingNormalMap(), []);
  const landmarkNames = useMemo(
    () => new Map(NavigationSystem.getInstance().landmarks.map((l) => [l.id, l.name])),
    []
  );

  // All dynamic shared materials mutated smoothly in useFrame (ZERO React re-renders on time/weather ticks)
  const dynamicMats = useMemo(() => {
    const groundMat = new THREE.MeshStandardMaterial({ color: '#05080f', roughness: 0.56, metalness: 0.38 });
    const plazaMat = new THREE.MeshStandardMaterial({
      map: plazaTex,
      normalMap: sidewalkNormal,
      normalScale: PLAZA_NORMAL_SCALE,
      roughness: 0.39,
      metalness: 0.36,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -4,
    });
    const makeAvenueMat = (map: THREE.CanvasTexture, isEw: boolean) =>
      new THREE.MeshStandardMaterial({
        map,
        normalMap: asphaltNormal,
        normalScale: AVE_NORMAL_SCALE,
        roughness: 0.38,
        metalness: 0.68,
        polygonOffset: isEw,
        polygonOffsetFactor: isEw ? -1 : 0,
        polygonOffsetUnits: isEw ? -2 : 0,
      });
    const avenueNsLongMat = makeAvenueMat(asphaltTexLongNs, false);
    const avenueEwLongMat = makeAvenueMat(asphaltTexLongEw, true);
    const avenueNsMedMat = makeAvenueMat(asphaltTexMed, false);
    const avenueEwMedMat = makeAvenueMat(asphaltTexMed, true);
    const avenueNsShortMat = makeAvenueMat(asphaltTexShort, false);
    const avenueEwShortMat = makeAvenueMat(asphaltTexShort, true);
    const allAvenueMats = [
      avenueNsLongMat,
      avenueEwLongMat,
      avenueNsMedMat,
      avenueEwMedMat,
      avenueNsShortMat,
      avenueEwShortMat,
    ];
    const junctionMat = new THREE.MeshStandardMaterial({
      color: '#090d16',
      normalMap: asphaltNormal,
      roughness: 0.38,
      metalness: 0.68,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -4,
    });
    const sidewalkMat = new THREE.MeshStandardMaterial({
      map: sidewalkTex,
      normalMap: sidewalkNormal,
      normalScale: SW_NORMAL_SCALE,
      roughness: 0.52,
      metalness: 0.32,
    });
    const meridianMat = new THREE.MeshStandardMaterial({
      color: '#042f2e',
      emissive: '#38bdf8',
      emissiveIntensity: 0.32,
      roughness: 0.05,
      metalness: 0.95,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -6,
    });

    const facadeMats: Record<FacadeStyleVariant, THREE.MeshStandardMaterial> = {
      CURTAIN_GLASS: new THREE.MeshStandardMaterial({
        map: facadeTextures.CURTAIN_GLASS,
        emissive: '#ffffff',
        emissiveMap: facadeEmissiveTextures.CURTAIN_GLASS,
        emissiveIntensity: 0.3,
        normalMap: claddingNormal,
        normalScale: BLDG_NORMAL_SCALE,
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
        normalScale: BLDG_NORMAL_SCALE,
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
        normalScale: BLDG_NORMAL_SCALE,
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
        normalScale: BLDG_NORMAL_SCALE,
        roughnessMap: facadeRoughnessMaps.ARCOLOGY_TERRACE,
        roughness: 0.92,
        metalness: 0.64,
      }),
    };

    const hdrNeonMat = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false });
    const hdrNightMat = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false });
    const hdrCurbMat = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false });
    const hdrStreetBulbMat = new THREE.MeshBasicMaterial({ color: '#fde68a', toneMapped: false });
    const hdrBeaconMat = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false });
    const lobbyGlowMat = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false });
    const astrolabeCyanMat = new THREE.MeshBasicMaterial({ color: '#38bdf8', toneMapped: false });
    const astrolabeAmberMat = new THREE.MeshBasicMaterial({ color: '#f59e0b', toneMapped: false });

    return {
      groundMat,
      plazaMat,
      avenueNsLongMat,
      avenueEwLongMat,
      avenueNsMedMat,
      avenueEwMedMat,
      avenueNsShortMat,
      avenueEwShortMat,
      allAvenueMats,
      junctionMat,
      sidewalkMat,
      meridianMat,
      facadeMats,
      hdrNeonMat,
      hdrNightMat,
      hdrCurbMat,
      hdrStreetBulbMat,
      hdrBeaconMat,
      lobbyGlowMat,
      astrolabeCyanMat,
      astrolabeAmberMat,
    };
  }, [
    asphaltTexLongNs,
    asphaltTexLongEw,
    asphaltTexMed,
    asphaltTexShort,
    sidewalkTex,
    plazaTex,
    asphaltNormal,
    sidewalkNormal,
    claddingNormal,
    facadeTextures,
    facadeEmissiveTextures,
    facadeRoughnessMaps,
  ]);

  useEffect(() => {
    return () => {
      dynamicMats.groundMat.dispose();
      dynamicMats.plazaMat.dispose();
      dynamicMats.allAvenueMats.forEach((m) => m.dispose());
      dynamicMats.junctionMat.dispose();
      dynamicMats.sidewalkMat.dispose();
      dynamicMats.meridianMat.dispose();
      Object.values(dynamicMats.facadeMats).forEach((m) => m.dispose());
      dynamicMats.hdrNeonMat.dispose();
      dynamicMats.hdrNightMat.dispose();
      dynamicMats.hdrCurbMat.dispose();
      dynamicMats.hdrStreetBulbMat.dispose();
      dynamicMats.hdrBeaconMat.dispose();
      dynamicMats.lobbyGlowMat.dispose();
      dynamicMats.astrolabeCyanMat.dispose();
      dynamicMats.astrolabeAmberMat.dispose();
    };
  }, [dynamicMats]);

  // Sync quality-dependent maps and normal scales when quality preset changes
  useEffect(() => {
    const envScale =
      quality.reflectionQuality === 'HIGH'
        ? 1.55
        : quality.reflectionQuality === 'MEDIUM'
        ? 0.95
        : quality.reflectionQuality === 'LOW'
        ? 0.4
        : 0.0;
    const useNormals = quality.normalMapsEnabled;

    const setNormal = (m: THREE.MeshStandardMaterial, map: THREE.Texture, scale?: THREE.Vector2) => {
      if ((m.normalMap !== null) !== useNormals) {
        m.normalMap = useNormals ? map : null;
        m.needsUpdate = true;
      }
      if (scale) m.normalScale.copy(scale);
    };

    setNormal(dynamicMats.plazaMat, sidewalkNormal, PLAZA_NORMAL_SCALE);
    const aveNormalScale = isUltra ? AVE_ULTRA_NORMAL_SCALE : AVE_NORMAL_SCALE;
    dynamicMats.allAvenueMats.forEach((m) => setNormal(m, asphaltNormal, aveNormalScale));
    setNormal(dynamicMats.junctionMat, asphaltNormal);
    setNormal(dynamicMats.sidewalkMat, sidewalkNormal, SW_NORMAL_SCALE);

    dynamicMats.plazaMat.envMapIntensity = envScale;
    dynamicMats.sidewalkMat.envMapIntensity = envScale * 0.55;
    dynamicMats.junctionMat.envMapIntensity = envScale * 0.7;
    dynamicMats.meridianMat.envMapIntensity = envScale * 1.4;
    MAT_BRIDGE_GLASS.envMapIntensity = envScale;

    Object.values(dynamicMats.facadeMats).forEach((fm) => {
      setNormal(fm, claddingNormal, isUltra ? BLDG_ULTRA_NORMAL_SCALE : BLDG_NORMAL_SCALE);
      fm.roughness = isUltra ? 0.86 : 0.94;
      fm.envMapIntensity = envScale;
    });
  }, [quality.normalMapsEnabled, quality.reflectionQuality, isUltra, dynamicMats, asphaltNormal, sidewalkNormal, claddingNormal]);

  // Central avenue intersections (excluding (0,0) plaza and (75,75) park)
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

  // Build unified instanced batches for ALL static central district geometry (~4,200 draw calls -> ~38 draw calls!)
  const batchedBuckets = useMemo(() => {
    const builder = new InstanceBatchBuilder();

    // 1. Central Junctions, Arterial Avenues & Sidewalks
    for (let i = 0; i < centralJunctions.length; i++) {
      const [jx, jz, jw, jd] = centralJunctions[i];
      builder.addWorld('junction', jx, 0.072, jz, jw, 0.02, jd);
    }

    for (let i = 0; i < cityData.avenues.length; i++) {
      const ave = cityData.avenues[i];
      const isEw = Math.abs(ave.rotationY) > 0.1;
      const len = ave.size.z;
      const bucketKey = isEw
        ? len >= 600
          ? 'avenue_ew_long'
          : len >= 120
          ? 'avenue_ew_med'
          : 'avenue_ew_short'
        : len >= 600
        ? 'avenue_ns_long'
        : len >= 120
        ? 'avenue_ns_med'
        : 'avenue_ns_short';
      builder.addWorld(bucketKey, ave.position.x, ave.position.y, ave.position.z, ave.size.x, ave.size.y, ave.size.z, 0, ave.rotationY, 0);
    }

    for (let i = 0; i < cityData.sidewalks.length; i++) {
      const sw = cityData.sidewalks[i];
      builder.addWorld('sidewalk', sw.position.x, sw.position.y, sw.position.z, sw.size.x, sw.size.y, sw.size.z);
      builder.addWorld(
        'box_hdr_curb',
        sw.position.x,
        sw.position.y + sw.size.y / 2 - 0.055,
        sw.position.z,
        sw.size.x + 0.08,
        0.045,
        sw.size.z + 0.08,
        0,
        0,
        0,
        i % 2 === 0 ? '#38bdf8' : '#f59e0b'
      );
    }

    // 2. 4 Corner Plaza Architectural Obelisk Light Pylons
    for (let idx = 0; idx < PLAZA_PYLONS.length; idx++) {
      const [px, pz] = PLAZA_PYLONS[idx];
      const pylonAccent = idx % 2 === 0 ? '#f59e0b' : '#38bdf8';
      builder.addWorld('box_concrete', px, 0.24, pz, 1.1, 0.48, 1.1);
      builder.addWorld('box_chrome', px, 0.56, pz, 0.84, 0.16, 0.84);
      builder.addWorld('box_podium', px, 2.85, pz, 0.48, 4.45, 0.48);
      builder.addWorld('box_fin', px - 0.32, 2.65, pz, 0.1, 4.1, 0.56);
      builder.addWorld('box_fin', px + 0.32, 2.65, pz, 0.1, 4.1, 0.56);
      builder.addWorld('box_hdr_night', px, 2.85, pz, 0.54, 3.85, 0.14, 0, 0, 0, pylonAccent);
      builder.addWorld('box_hdr_night', px, 2.85, pz, 0.14, 3.85, 0.54, 0, 0, 0, pylonAccent);
      builder.addWorld('box_parapet', px, 5.2, pz, 0.78, 0.22, 0.78);
      builder.addWorld('cyl_hdr_night', px, 5.42, pz, 0.22, 0.24, 0.22, 0, 0, 0, pylonAccent);
    }

    // 3. Detailed Multi-Tier Architectural Monoliths
    for (let bIdx = 0; bIdx < cityData.buildings.length; bIdx++) {
      const bldg = cityData.buildings[bIdx];
      const bx = bldg.position.x;
      const by = bldg.position.y;
      const bz = bldg.position.z;
      const sx = bldg.totalSize.x;
      const sz = bldg.totalSize.z;
      const totalH = bldg.totalSize.y;
      const topTier = bldg.tiers[bldg.tiers.length - 1];
      const topW = topTier.size.x;
      const topD = topTier.size.z;
      const facadeBucket = `facade_${bldg.facadeVariant || 'CURTAIN_GLASS'}`;

      // Street-level podium, lobbies, marquee canopies, light bars
      builder.addWorld('box_podium', bx, by + 2.8, bz, sx + 0.9, 5.6, sz + 0.9);
      builder.addWorld('box_lobby', bx, by + 2.5, bz, sx * 0.78, 4.6, sz + 1.05, 0, 0, 0, bldg.storefrontColor);
      builder.addWorld('box_lobby', bx, by + 2.48, bz, sx + 1.05, 4.52, sz * 0.78, 0, 0, 0, bldg.secondaryAccentColor);
      builder.addWorld('box_canopy', bx, by + 5.36, bz, sx + 2.4, 0.3, sz * 0.84);
      builder.addWorld('box_canopy', bx, by + 5.32, bz, sx * 0.84, 0.24, sz + 2.4);
      builder.addWorld('box_hdr_neon', bx, by + 5.16, bz, sx + 2.5, 0.07, sz * 0.8, 0, 0, 0, bldg.storefrontColor);
      builder.addWorld('box_hdr_neon', bx, by + 5.1, bz, sx * 0.8, 0.06, sz + 2.5, 0, 0, 0, bldg.secondaryAccentColor);

      if (showFineMolding) {
        for (const frac of [-0.32, 0.32]) {
          builder.addWorld('box_pier', bx + sx * frac, by + 2.7, bz + sz / 2 + 0.55, 0.55, 5.4, 0.55);
          builder.addWorld('box_pier', bx + sx * frac, by + 2.7, bz - sz / 2 - 0.55, 0.55, 5.4, 0.55);
          builder.addWorld('box_pier', bx + sx / 2 + 0.55, by + 2.7, bz + sz * frac, 0.55, 5.4, 0.55);
          builder.addWorld('box_pier', bx - sx / 2 - 0.55, by + 2.7, bz + sz * frac, 0.55, 5.4, 0.55);
        }
      }

      // Stepped architectural tiers
      for (let tIdx = 0; tIdx < bldg.tiers.length; tIdx++) {
        const tier = bldg.tiers[tIdx];
        const tw = tier.size.x;
        const th = tier.size.y;
        const td = tier.size.z;
        const tx = bx + tier.offset.x;
        const ty = by + tier.offset.y;
        const tz = bz + tier.offset.z;

        builder.addWorld(facadeBucket, tx, ty, tz, tw, th, td);

        // 4 heavy corner megacolumns
        builder.addWorld('box_podium', tx - tw / 2, ty, tz - td / 2, 0.85, th + 0.2, 0.85);
        builder.addWorld('box_podium', tx + tw / 2, ty, tz - td / 2, 0.85, th + 0.2, 0.85);
        builder.addWorld('box_podium', tx - tw / 2, ty, tz + td / 2, 0.85, th + 0.2, 0.85);
        builder.addWorld('box_podium', tx + tw / 2, ty, tz + td / 2, 0.85, th + 0.2, 0.85);

        if (showFineMolding) {
          for (const frac of [-0.26, 0, 0.26]) {
            builder.addWorld('box_fin', tx + tw * frac, ty, tz, 0.32, th * 0.96, td + 0.42);
            builder.addWorld('box_fin', tx, ty, tz + td * frac, tw + 0.42, th * 0.94, 0.32);
          }
          for (const yFrac of [-0.25, 0.25]) {
            builder.addWorld('box_canopy', tx, ty + th * yFrac, tz, tw + 0.52, 0.55, td + 0.52);
          }
        }

        builder.addWorld('box_parapet', tx, ty + th / 2 + 0.45, tz, tw + 0.24, 0.85, td + 0.24);
      }

      // Sky-lobby mezzanines
      for (let slIdx = 0; slIdx < bldg.skyLobbyFloors.length; slIdx++) {
        const sl = bldg.skyLobbyFloors[slIdx];
        builder.addWorld(
          'box_lobby',
          bx,
          by + sl.y,
          bz,
          sl.width,
          sl.height,
          sl.depth,
          0,
          0,
          0,
          slIdx % 2 === 0 ? bldg.storefrontColor : bldg.secondaryAccentColor
        );
      }

      // Sculpted skyscraper crown
      const cy = by + totalH;
      if (bldg.crownType === 'PYRAMID_LANTERN') {
        builder.addWorld('box_lobby', bx, cy + 1.8, bz, topW * 0.72, 3.4, topD * 0.72, 0, 0, 0, bldg.storefrontColor);
        builder.addWorld('box_lobby', bx, cy + 4.2, bz, topW * 0.44, 2.2, topD * 0.44, 0, 0, 0, bldg.secondaryAccentColor);
      } else if (bldg.crownType === 'TWIN_FIN_CREST') {
        builder.addWorld('box_canopy', bx - topW / 2, cy + 2.6, bz, 0.65, 5.2, topD * 0.86);
        builder.addWorld('box_canopy', bx + topW / 2, cy + 2.6, bz, 0.65, 5.2, topD * 0.86);
        builder.addWorld('box_hdr_neon', bx, cy + 4.4, bz, topW, 0.35, topD * 0.5, 0, 0, 0, bldg.storefrontColor);
      } else if (bldg.crownType === 'HALO_RING_CROWN') {
        const r = Math.min(topW, topD) * 0.42;
        builder.addWorld('crown_torus_hdr', bx, cy + 2.8, bz, r, r, r, Math.PI / 2, 0, 0, bldg.storefrontColor);
        builder.addWorld('cyl_canopy', bx, cy + 1.4, bz, 2.2, 2.8, 2.2);
      } else if (bldg.crownType === 'SLANTED_BLADE') {
        builder.addWorld('box_podium', bx, cy + 2.2, bz, topW * 0.82, 4.2, topD * 0.82);
        builder.addWorld('box_hdr_neon', bx, cy + 4.4, bz, topW * 0.86, 0.32, topD * 0.86, 0, 0, 0, bldg.secondaryAccentColor);
      }

      // Vertical & horizontal neon light strips
      for (let sIdx = 0; sIdx < bldg.lightStrips.length; sIdx++) {
        const strip = bldg.lightStrips[sIdx];
        builder.addWorld(
          'box_hdr_neon',
          bx + strip.position.x,
          by + strip.position.y,
          bz + strip.position.z,
          strip.size.x,
          strip.size.y,
          strip.size.z,
          0,
          0,
          0,
          strip.color
        );
      }

      // Rooftop mechanical & communications complex
      for (let eIdx = 0; eIdx < bldg.rooftopEquipment.length; eIdx++) {
        const eq = bldg.rooftopEquipment[eIdx];
        const ex = bx + eq.position.x;
        const ey = by + eq.position.y;
        const ez = bz + eq.position.z;

        if (eq.type === 'ANTENNA') {
          builder.addWorld('cyl_parapet', ex, ey - eq.size.y * 0.25, ez, 0.75, eq.size.y * 0.5, 0.75);
          builder.addWorld('mast_taper', ex, ey, ez, 1, eq.size.y, 1);
          builder.addWorld('box_parapet', ex, ey + eq.size.y * 0.15, ez, 2.2, 0.08, 0.08);
          builder.addWorld('beacon_hdr', ex, ey + eq.size.y / 2, ez, 0.34, 0.34, 0.34, 0, 0, 0, '#f59e0b');
          builder.addWorld('beacon_hdr', ex, ey + eq.size.y * 0.18, ez, 0.22, 0.22, 0.22, 0, 0, 0, '#f43f5e');
        } else if (eq.type === 'HELIPAD') {
          builder.addWorld('box_canopy', ex, ey, ez, eq.size.x, eq.size.y, eq.size.z);
          builder.addWorld('box_parapet', ex, ey - eq.size.y * 0.45, ez, eq.size.x + 0.5, 0.18, eq.size.z + 0.5);
          builder.addWorld('flat_ring_basic', ex, ey + eq.size.y / 2 + 0.02, ez, eq.size.x * 0.4, eq.size.x * 0.4, 1, -Math.PI / 2, 0, 0, '#38bdf8');
          builder.addWorld('box_basic', ex - eq.size.x * 0.12, ey + eq.size.y / 2 + 0.025, ez, 0.24, 0.03, eq.size.z * 0.36, 0, 0, 0, '#f59e0b');
          builder.addWorld('box_basic', ex + eq.size.x * 0.12, ey + eq.size.y / 2 + 0.025, ez, 0.24, 0.03, eq.size.z * 0.36, 0, 0, 0, '#f59e0b');
          builder.addWorld('box_basic', ex, ey + eq.size.y / 2 + 0.025, ez, eq.size.x * 0.26, 0.03, 0.24, 0, 0, 0, '#f59e0b');
        } else if (eq.type === 'COOLING_TOWER') {
          builder.addWorld('box_podium', ex, ey - eq.size.y * 0.46, ez, eq.size.x * 1.12, 0.28, eq.size.z * 1.12);
          builder.addWorld('cyl_pole', ex, ey, ez, eq.size.x, eq.size.y, eq.size.z);
          builder.addWorld('box_canopy', ex, ey, ez, eq.size.x * 1.06, eq.size.y * 0.88, 0.18);
          builder.addWorld('box_canopy', ex, ey, ez, 0.18, eq.size.y * 0.88, eq.size.z * 1.06);
          builder.addWorld('cyl_chrome', ex, ey + eq.size.y * 0.48, ez, eq.size.x * 0.82, 0.26, eq.size.z * 0.82);
          builder.addWorld('flat_ring_basic', ex, ey + eq.size.y / 2 + 0.05, ez, eq.size.x * 0.44, eq.size.x * 0.44, 1, -Math.PI / 2, 0, 0, '#38bdf8');
        } else if (eq.type === 'DISH') {
          builder.addWorld('box_podium', ex, ey - 0.58, ez, 0.95, 0.22, 0.95);
          builder.addWorld('cyl_pole', ex, ey - 0.15, ez, 0.32, 0.95, 0.32);
          builder.addWorld('dish_cone', ex, ey + 0.35, ez, 1, 1, 1, 0.55, 0.4, 0);
          builder.addWorld('cyl_chrome', ex + 0.18, ey + 0.65, ez + 0.26, 0.08, 0.65, 0.08, 0.55, 0.4, 0);
        } else if (eq.type === 'SOLAR_ARRAY') {
          builder.addWorld('box_canopy', ex - eq.size.x * 0.32, ey - eq.size.y * 0.15, ez, 0.14, eq.size.y * 0.85, eq.size.z * 0.8);
          builder.addWorld('box_canopy', ex + eq.size.x * 0.32, ey - eq.size.y * 0.15, ez, 0.14, eq.size.y * 0.85, eq.size.z * 0.8);
          builder.addWorld('box_chrome', ex, ey + eq.size.y * 0.2, ez, eq.size.x, 0.1, eq.size.z, 0.36, 0, 0);
          builder.addWorld('box_solar', ex, ey + eq.size.y * 0.2 + 0.05, ez + 0.02, eq.size.x * 0.92, 0.04, eq.size.z * 0.92, 0.36, 0, 0);
          builder.addWorld('box_basic', ex, ey + eq.size.y * 0.2 + 0.075, ez + 0.03, eq.size.x * 0.9, 0.018, 0.06, 0.36, 0, 0, '#38bdf8');
        } else {
          builder.addWorld('box_podium', ex, ey - eq.size.y * 0.44, ez, eq.size.x * 1.08, 0.22, eq.size.z * 1.08);
          builder.addWorld('box_pole', ex, ey, ez, eq.size.x, eq.size.y, eq.size.z);
          builder.addWorld('box_canopy', ex, ey, ez, eq.size.x + 0.08, eq.size.y * 0.42, eq.size.z * 0.82);
          builder.addWorld('cyl_chrome', ex - eq.size.x * 0.24, ey + eq.size.y / 2 + 0.14, ez, eq.size.x * 0.34, 0.24, eq.size.x * 0.34);
          builder.addWorld('cyl_chrome', ex + eq.size.x * 0.24, ey + eq.size.y / 2 + 0.14, ez, eq.size.x * 0.34, 0.24, eq.size.x * 0.34);
          builder.addWorld('box_basic', ex, ey + eq.size.y / 2 + 0.04, ez + eq.size.z * 0.36, eq.size.x * 0.82, 0.05, 0.1, 0, 0, 0, '#38bdf8');
        }
      }
    }

    // 4. Elevated Glazed Skybridges & Composite Streetscape Props
    if (quality.streetFurnitureEnabled) {
      for (let i = 0; i < cityData.skybridges.length; i++) {
        const sb = cityData.skybridges[i];
        const x = sb.position.x;
        const y = sb.position.y;
        const z = sb.position.z;
        const rot = sb.rotationY;
        builder.addLocal('box_bridge_glass', x, y, z, rot, 0, 0, 0, sb.size.x, sb.size.y, sb.size.z);
        builder.addLocal('box_podium', x, y, z, rot, 0, -sb.size.y / 2 - 0.16, 0, sb.size.x, 0.32, sb.size.z + 0.45);
        builder.addLocal('box_canopy', x, y, z, rot, 0, -sb.size.y / 2 - 0.4, 0, sb.size.x * 0.94, 0.22, sb.size.z * 0.55);
        builder.addLocal('box_parapet', x, y, z, rot, 0, sb.size.y / 2 + 0.12, 0, sb.size.x, 0.2, sb.size.z + 0.32);
        for (const frac of [-0.36, -0.18, 0, 0.18, 0.36]) {
          builder.addLocal('box_fin', x, y, z, rot, sb.size.x * frac, 0, 0, 0.38, sb.size.y + 0.55, sb.size.z + 0.52);
        }
        builder.addLocal('box_hdr_neon', x, y, z, rot, 0, -sb.size.y / 2 - 0.32, 0, sb.size.x * 0.94, 0.07, sb.size.z + 0.48, 0, 0, 0, sb.accentColor);
        builder.addLocal('box_hdr_neon', x, y, z, rot, 0, sb.size.y / 2 + 0.24, 0, sb.size.x * 0.94, 0.06, sb.size.z + 0.18, 0, 0, 0, sb.accentColor);
      }

      for (let i = 0; i < cityData.streetProps.length; i++) {
        const prop = cityData.streetProps[i];
        const px = prop.position.x;
        const py = prop.position.y;
        const pz = prop.position.z;
        const rot = prop.rotationY;

        if (prop.type === 'TRANSIT_SHELTER') {
          builder.addLocal('box_concrete', px, py, pz, rot, 0, 0.06, 0, 4.4, 0.12, 2.0);
          for (const mx of [-1.85, -0.62, 0.62, 1.85]) {
            builder.addLocal('box_canopy', px, py, pz, rot, mx, 1.42, -0.82, 0.12, 2.65, 0.14);
          }
          builder.addLocal('box_glass', px, py, pz, rot, 0, 1.42, -0.82, 3.62, 2.38, 0.05);
          builder.addLocal('box_glass', px, py, pz, rot, -1.85, 1.42, -0.1, 0.05, 2.38, 1.42);
          builder.addLocal('box_canopy', px, py, pz, rot, -1.85, 1.42, 0.62, 0.1, 2.65, 0.1);
          builder.addLocal('box_parapet', px, py, pz, rot, 0, 2.78, 0.04, 4.5, 0.18, 2.05);
          builder.addLocal('box_canopy', px, py, pz, rot, 0, 2.9, 0.04, 4.2, 0.08, 1.6);
          builder.addLocal('box_hdr_night', px, py, pz, rot, 0, 2.68, 0.98, 4.2, 0.055, 0.1, 0, 0, 0, prop.accentColor);
          builder.addLocal('box_timber', px, py, pz, rot, -0.35, 0.46, -0.34, 2.35, 0.08, 0.48);
          builder.addLocal('box_canopy', px, py, pz, rot, -1.25, 0.25, -0.34, 0.1, 0.42, 0.46);
          builder.addLocal('box_canopy', px, py, pz, rot, 0.55, 0.25, -0.34, 0.1, 0.42, 0.46);
          builder.addLocal('box_podium', px, py, pz, rot, 1.85, 1.38, 0.12, 0.24, 2.52, 0.78);
          builder.addLocal('box_hdr_night', px, py, pz, rot, 1.98, 1.5, 0.12, 0.03, 1.55, 0.56, 0, 0, 0, prop.accentColor);
        } else if (prop.type === 'CYBER_KIOSK') {
          builder.addLocal('box_concrete', px, py, pz, rot, 0, 0.14, 0, 1.15, 0.28, 0.68);
          builder.addLocal('box_podium', px, py, pz, rot, 0, 1.42, 0, 0.92, 2.32, 0.42);
          builder.addLocal('box_chrome', px, py, pz, rot, -0.47, 1.42, 0.04, 0.06, 2.25, 0.44);
          builder.addLocal('box_chrome', px, py, pz, rot, 0.47, 1.42, 0.04, 0.06, 2.25, 0.44);
          builder.addLocal('box_hdr_neon', px, py, pz, rot, 0, 1.62, 0.22, 0.72, 1.25, 0.03, 0, 0, 0, prop.accentColor);
          builder.addLocal('box_parapet', px, py, pz, rot, 0, 0.88, 0.28, 0.76, 0.08, 0.3, 0.42, 0, 0);
          builder.addLocal('box_canopy', px, py, pz, rot, 0, 2.56, 0.14, 1.04, 0.12, 0.72);
          builder.addLocal('box_hdr_neon', px, py, pz, rot, 0, 2.66, 0.06, 0.92, 0.07, 0.48, 0, 0, 0, '#f59e0b');
          builder.addLocal('cyl_chrome', px, py, pz, rot, 0.32, 2.95, -0.08, 0.03, 0.56, 0.03);
        } else if (prop.type === 'BENCH') {
          for (const lx of [-0.92, 0, 0.92]) {
            builder.addLocal('box_canopy', px, py, pz, rot, lx, 0.23, 0, 0.08, 0.46, 0.58);
            if (lx !== 0) {
              builder.addLocal('box_chrome', px, py, pz, rot, lx, 0.56, -0.02, 0.07, 0.06, 0.56);
            }
          }
          for (const sz of [-0.18, 0, 0.18]) {
            builder.addLocal('box_timber', px, py, pz, rot, 0, 0.45, sz, 2.24, 0.06, 0.14);
          }
          builder.addLocal('box_canopy', px, py, pz, rot, -0.92, 0.68, -0.28, 0.07, 0.52, 0.07, -0.18, 0, 0);
          builder.addLocal('box_canopy', px, py, pz, rot, 0.92, 0.68, -0.28, 0.07, 0.52, 0.07, -0.18, 0, 0);
          builder.addLocal('box_timber', px, py, pz, rot, 0, 0.68, -0.26, 2.22, 0.14, 0.06, -0.18, 0, 0);
          builder.addLocal('box_timber', px, py, pz, rot, 0, 0.86, -0.3, 2.22, 0.14, 0.06, -0.18, 0, 0);
          builder.addLocal('box_hdr_night', px, py, pz, rot, 0, 0.16, 0, 1.76, 0.04, 0.34, 0, 0, 0, prop.accentColor);
        } else if (prop.type === 'BOLLARD_CLUSTER') {
          for (const bx of [-1.25, 0, 1.25]) {
            builder.addLocal('cyl_chrome', px, py, pz, rot, bx, 0.05, 0, 0.34, 0.1, 0.34);
            builder.addLocal('cyl_canopy', px, py, pz, rot, bx, 0.52, 0, 0.24, 0.88, 0.24);
            builder.addLocal('cyl_chrome', px, py, pz, rot, bx, 0.72, 0, 0.26, 0.06, 0.26);
            builder.addLocal('cyl_hdr_night', px, py, pz, rot, bx, 0.88, 0, 0.25, 0.09, 0.25, 0, 0, 0, prop.accentColor);
            builder.addLocal('bollard_cap', px, py, pz, rot, bx, 0.99, 0, 0.92, 0.1, 0.92);
          }
        } else if (prop.type === 'STEAM_GRATE') {
          builder.addLocal('steam_plane', px, py, pz, rot, 0, 0, 0, 1, 1, 1, -Math.PI / 2, 0, 0);
          for (const gx of [-0.68, -0.34, 0, 0.34, 0.68]) {
            builder.addLocal('box_chrome', px, py, pz, rot, gx, 0.02, 0, 0.08, 0.04, 1.02);
          }
          builder.addLocal('steam_cone', px, py, pz, rot, 0, 1.2, 0, 1, 1, 1, 0, 0, 0, prop.accentColor);
        }
      }

      // Wide-span overhead avenue wayfinding truss gantries
      for (let idx = 0; idx < OVERHEAD_GANTRIES.length; idx++) {
        const [gx, gz, rot, accent] = OVERHEAD_GANTRIES[idx];
        for (const px of [-12.2, 12.2]) {
          builder.addLocal('box_concrete', gx, 0, gz, rot, px, 0.4, 0, 0.98, 0.8, 1.05);
          builder.addLocal('box_canopy', gx, 0, gz, rot, px, 4.9, 0, 0.52, 8.6, 0.58);
          builder.addLocal('box_chrome', gx, 0, gz, rot, px + (px < 0 ? 0.65 : -0.65), 8.2, 0, 0.16, 1.65, 0.24, 0, 0, px < 0 ? -0.68 : 0.68);
        }
        builder.addLocal('box_podium', gx, 0, gz, rot, 0, 8.95, 0, 25.2, 0.44, 0.66);
        builder.addLocal('box_parapet', gx, 0, gz, rot, 0, 9.65, 0, 25.2, 0.26, 0.48);
        builder.addLocal('box_hdr_neon', gx, 0, gz, rot, 0, 8.68, 0, 23.4, 0.1, 0.7, 0, 0, 0, accent);
        const lanes = [-6.8, -3.2, 3.2, 6.8];
        for (let lIdx = 0; lIdx < lanes.length; lIdx++) {
          const lx = lanes[lIdx];
          builder.addLocal('box_podium', gx, 0, gz, rot, lx, 8.35, 0, 2.0, 0.42, 0.22);
          builder.addLocal('box_hdr_neon', gx, 0, gz, rot, lx, 8.35, 0, 1.76, 0.22, 0.26, 0, 0, 0, lIdx < 2 ? '#10b981' : '#38bdf8');
        }
      }
    }

    // 5. Detailed Architectural Street Luminaires
    for (let i = 0; i < cityData.streetlights.length; i++) {
      const sl = cityData.streetlights[i];
      const x = sl.position.x;
      const y = sl.position.y;
      const z = sl.position.z;
      const rot = sl.rotationY;
      builder.addLocal('plinth_canopy', x, y, z, rot, 0, 0.28, 0, 1, 0.56, 1);
      builder.addLocal('cyl_chrome', x, y, z, rot, 0, 0.62, 0, 0.42, 0.12, 0.42);
      builder.addLocal('pole_slate', x, y, z, rot, 0, 3.45, 0, 1, 5.7, 1);
      builder.addLocal('box_canopy', x, y, z, rot, -0.18, 2.35, 0, 0.24, 0.55, 0.28);
      builder.addLocal('box_chrome', x, y, z, rot, 0.42, 5.82, 0, 0.07, 1.05, 0.08, 0, 0, -0.68);
      builder.addLocal('box_canopy', x, y, z, rot, 0.98, 6.26, 0, 2.0, 0.13, 0.2);
      builder.addLocal('box_parapet', x, y, z, rot, 1.65, 6.22, 0, 0.96, 0.16, 0.44);
      builder.addLocal('box_chrome', x, y, z, rot, 1.65, 6.33, 0, 0.64, 0.05, 0.26);
      builder.addLocal('box_street_bulb', x, y, z, rot, 1.65, 6.12, 0, 0.82, 0.05, 0.34);
    }

    // 6. Avenue Trees (batched into 9 shared tree draw calls instead of ~720 draw calls + 45 useFrame hooks)
    if (quality.vegetationEnabled) {
      for (let i = 0; i < trees.length; i++) {
        builder.addTree(trees[i], TREE_BUCKET_KEYS);
      }
    }

    return builder.build();
  }, [cityData, centralJunctions, trees, showFineMolding, quality.streetFurnitureEnabled, quality.vegetationEnabled]);

  const bucketSpecs = useMemo<InstanceBucketSpec[]>(
    () => [
      { key: 'avenue_ns_long', geometry: SHARED_ROAD_PLANE, material: dynamicMats.avenueNsLongMat, receiveShadow: quality.shadows, renderOrder: 1 },
      { key: 'avenue_ns_med', geometry: SHARED_ROAD_PLANE, material: dynamicMats.avenueNsMedMat, receiveShadow: quality.shadows, renderOrder: 1 },
      { key: 'avenue_ns_short', geometry: SHARED_ROAD_PLANE, material: dynamicMats.avenueNsShortMat, receiveShadow: quality.shadows, renderOrder: 1 },
      { key: 'avenue_ew_long', geometry: SHARED_ROAD_PLANE, material: dynamicMats.avenueEwLongMat, receiveShadow: quality.shadows, renderOrder: 2 },
      { key: 'avenue_ew_med', geometry: SHARED_ROAD_PLANE, material: dynamicMats.avenueEwMedMat, receiveShadow: quality.shadows, renderOrder: 2 },
      { key: 'avenue_ew_short', geometry: SHARED_ROAD_PLANE, material: dynamicMats.avenueEwShortMat, receiveShadow: quality.shadows, renderOrder: 2 },
      { key: 'junction', geometry: SHARED_ROAD_PLANE, material: dynamicMats.junctionMat, receiveShadow: quality.shadows, renderOrder: 3 },
      { key: 'sidewalk', geometry: SHARED_BEVELED_BOX, material: dynamicMats.sidewalkMat, receiveShadow: quality.shadows },

      // Primary Building Curtain-Wall Hulls (smooth chamfered architectural prisms, 4 draw calls total)
      {
        key: 'facade_CURTAIN_GLASS',
        geometry: SHARED_BUILDING_PRISM,
        material: dynamicMats.facadeMats.CURTAIN_GLASS,
        castShadow: quality.shadows,
        receiveShadow: quality.shadows,
      },
      {
        key: 'facade_DIAGRID_HEX',
        geometry: SHARED_BUILDING_PRISM,
        material: dynamicMats.facadeMats.DIAGRID_HEX,
        castShadow: quality.shadows,
        receiveShadow: quality.shadows,
      },
      {
        key: 'facade_BRUTALIST_RIBBED',
        geometry: SHARED_BUILDING_PRISM,
        material: dynamicMats.facadeMats.BRUTALIST_RIBBED,
        castShadow: quality.shadows,
        receiveShadow: quality.shadows,
      },
      {
        key: 'facade_ARCOLOGY_TERRACE',
        geometry: SHARED_BUILDING_PRISM,
        material: dynamicMats.facadeMats.ARCOLOGY_TERRACE,
        castShadow: quality.shadows,
        receiveShadow: quality.shadows,
      },

      // Architectural structural trims & street furniture (smooth beveled boxes)
      { key: 'box_podium', geometry: SHARED_BEVELED_BOX, material: MAT_PODIUM, castShadow: quality.shadows, receiveShadow: quality.shadows },
      { key: 'box_canopy', geometry: SHARED_BEVELED_BOX, material: MAT_CANOPY },
      { key: 'box_pier', geometry: SHARED_BEVELED_BOX, material: MAT_PIER },
      { key: 'box_fin', geometry: SHARED_BEVELED_BOX, material: MAT_FIN },
      { key: 'box_parapet', geometry: SHARED_BEVELED_BOX, material: MAT_PARAPET },
      { key: 'box_pole', geometry: SHARED_BEVELED_BOX, material: MAT_POLE },
      { key: 'box_concrete', geometry: SHARED_BEVELED_BOX, material: MAT_CONCRETE, receiveShadow: quality.shadows },
      { key: 'box_chrome', geometry: SHARED_BEVELED_BOX, material: MAT_CHROME },
      { key: 'box_timber', geometry: SHARED_BEVELED_BOX, material: MAT_TIMBER },
      { key: 'box_solar', geometry: SHARED_BEVELED_BOX, material: MAT_SOLAR },
      { key: 'box_glass', geometry: SHARED_BEVELED_BOX, material: MAT_GLASS },
      { key: 'box_bridge_glass', geometry: SHARED_BEVELED_BOX, material: MAT_BRIDGE_GLASS },
      { key: 'box_basic', geometry: SHARED_UNIT_BOX, material: MAT_BASIC_COLORED },

      // HDR Glowing Strips, Lobbies, Curbs, Bulbs, Crowns & Beacons
      { key: 'box_lobby', geometry: SHARED_UNIT_BOX, material: dynamicMats.lobbyGlowMat },
      { key: 'box_hdr_neon', geometry: SHARED_UNIT_BOX, material: dynamicMats.hdrNeonMat },
      { key: 'box_hdr_night', geometry: SHARED_UNIT_BOX, material: dynamicMats.hdrNightMat },
      { key: 'box_hdr_curb', geometry: SHARED_UNIT_BOX, material: dynamicMats.hdrCurbMat },
      { key: 'box_street_bulb', geometry: SHARED_UNIT_BOX, material: dynamicMats.hdrStreetBulbMat },
      { key: 'beacon_hdr', geometry: SHARED_BEACON_SPHERE, material: dynamicMats.hdrBeaconMat },
      { key: 'crown_torus_hdr', geometry: SHARED_CROWN_TORUS, material: dynamicMats.hdrNeonMat },

      // Cylinders, masts, dishes, steam grates & rings
      { key: 'cyl_canopy', geometry: SHARED_UNIT_CYLINDER, material: MAT_CANOPY },
      { key: 'cyl_parapet', geometry: SHARED_UNIT_CYLINDER, material: MAT_PARAPET },
      { key: 'cyl_pole', geometry: SHARED_UNIT_CYLINDER, material: MAT_POLE },
      { key: 'cyl_chrome', geometry: SHARED_UNIT_CYLINDER, material: MAT_CHROME },
      { key: 'cyl_hdr_night', geometry: SHARED_UNIT_CYLINDER, material: dynamicMats.hdrNightMat },
      { key: 'pole_slate', geometry: SHARED_TAPER_POLE, material: MAT_POLE },
      { key: 'plinth_canopy', geometry: SHARED_OCT_PLINTH, material: MAT_CANOPY },
      { key: 'bollard_cap', geometry: SHARED_BOLLARD_CAP, material: MAT_PARAPET },
      { key: 'mast_taper', geometry: SHARED_MAST_TAPER, material: MAT_MAST },
      { key: 'dish_cone', geometry: SHARED_DISH_CONE, material: MAT_DISH },
      { key: 'flat_ring_basic', geometry: SHARED_FLAT_RING, material: MAT_BASIC_COLORED },
      { key: 'steam_plane', geometry: SHARED_STEAM_PLANE, material: MAT_CANOPY },
      { key: 'steam_cone', geometry: SHARED_STEAM_CONE, material: MAT_STEAM_PLUME },

      // Batched Avenue Trees (beveled planters + smooth organic crowns)
      { key: 'tree_planter_plinth', geometry: SHARED_BEVELED_BOX, material: MAT_PLANTER_PLINTH, receiveShadow: quality.shadows },
      { key: 'tree_planter_coping', geometry: SHARED_BEVELED_BOX, material: MAT_PLANTER_COPING },
      { key: 'tree_soil', geometry: SHARED_UNIT_BOX, material: MAT_SOIL_BED },
      { key: 'tree_trim', geometry: SHARED_UNIT_BOX, material: MAT_BASIC_COLORED },
      { key: 'tree_mound', geometry: SHARED_MOUND_GEO, material: MAT_MOUND },
      { key: 'tree_root', geometry: SHARED_ROOT_FLARE_GEO, material: MAT_ROOT },
      { key: 'tree_trunk', geometry: SHARED_TRUNK_GEO, material: MAT_TRUNK, castShadow: quality.shadows },
      { key: 'tree_branch', geometry: SHARED_BRANCH_GEO, material: MAT_TRUNK },
      { key: 'tree_foliage', geometry: SHARED_CROWN_GEO, material: MAT_FOLIAGE, castShadow: quality.shadows },
    ],
    [dynamicMats, quality.shadows]
  );

  // Initialize static drone rotor & scan cone colors once
  useEffect(() => {
    if (!quality.trafficEnabled) return;
    const col = new THREE.Color();
    for (let dIdx = 0; dIdx < DRONE_COUNT; dIdx++) {
      const droneAccent = dIdx % 3 === 0 ? '#10b981' : dIdx % 2 === 0 ? '#38bdf8' : '#f59e0b';
      col.set(droneAccent);
      droneConeRef.current?.setColorAt(dIdx, col);
      for (let rIdx = 0; rIdx < 4; rIdx++) {
        droneRotorRef.current?.setColorAt(dIdx * 4 + rIdx, col);
      }
    }
    if (droneConeRef.current?.instanceColor) droneConeRef.current.instanceColor.needsUpdate = true;
    if (droneRotorRef.current?.instanceColor) droneRotorRef.current.instanceColor.needsUpdate = true;
  }, [quality.trafficEnabled]);

  const lastMatSyncRef = useRef(-1);
  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();

    // 1. Animate Plaza Astrolabe
    if (astrolabeRef.current) {
      astrolabeRef.current.rotation.y += delta * 0.45;
      astrolabeRef.current.children.forEach((child, idx) => {
        if (idx > 0) {
          child.rotation.x += delta * (0.3 + idx * 0.15);
        }
      });
    }

    // 2. Animate Instanced Aerial Recon Drones (4 draw calls instead of 84)
    if (droneBodyRef.current && droneRotorRef.current && droneEyeRef.current && droneConeRef.current) {
      for (let idx = 0; idx < DRONE_COUNT; idx++) {
        const radius = 34 + idx * 18;
        const speed = (idx % 2 === 0 ? 1 : -1) * (0.18 + (idx % 4) * 0.04);
        const angle = t * speed + idx * 1.05;
        const nextAngle = angle + speed * 0.1;
        const y = 19 + (idx % 5) * 4 + Math.sin(t * 1.8 + idx) * 0.8;

        droneDummy.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
        droneDummy.scale.set(1, 1, 1);
        droneDummy.lookAt(Math.cos(nextAngle) * radius, y, Math.sin(nextAngle) * radius);
        droneDummy.updateMatrix();

        // Body
        droneChildDummy.position.set(0, 0, 0);
        droneChildDummy.rotation.set(0, 0, 0);
        droneChildDummy.scale.set(0.95, 0.34, 1.35);
        droneChildDummy.updateMatrix();
        droneMatScratch.multiplyMatrices(droneDummy.matrix, droneChildDummy.matrix);
        droneBodyRef.current.setMatrixAt(idx, droneMatScratch);

        // 4 Rotors
        for (let rIdx = 0; rIdx < 4; rIdx++) {
          const [rx, rz] = DRONE_ROTOR_OFFSETS[rIdx];
          droneChildDummy.position.set(rx, 0.02, rz);
          droneChildDummy.rotation.set(0, 0, 0);
          droneChildDummy.scale.set(0.48, 0.1, 0.48);
          droneChildDummy.updateMatrix();
          droneMatScratch.multiplyMatrices(droneDummy.matrix, droneChildDummy.matrix);
          droneRotorRef.current.setMatrixAt(idx * 4 + rIdx, droneMatScratch);
        }

        // Optical Eye
        droneChildDummy.position.set(0, -0.04, 0.7);
        droneChildDummy.rotation.set(0, 0, 0);
        droneChildDummy.scale.set(1, 1, 1);
        droneChildDummy.updateMatrix();
        droneMatScratch.multiplyMatrices(droneDummy.matrix, droneChildDummy.matrix);
        droneEyeRef.current.setMatrixAt(idx, droneMatScratch);

        // Volumetric Scan Cone
        droneChildDummy.position.set(0, -4.2, 0.4);
        droneChildDummy.rotation.set(0.15, 0, 0);
        droneChildDummy.scale.set(1, 1, 1);
        droneChildDummy.updateMatrix();
        droneMatScratch.multiplyMatrices(droneDummy.matrix, droneChildDummy.matrix);
        droneConeRef.current.setMatrixAt(idx, droneMatScratch);
      }
      droneBodyRef.current.instanceMatrix.needsUpdate = true;
      droneRotorRef.current.instanceMatrix.needsUpdate = true;
      droneEyeRef.current.instanceMatrix.needsUpdate = true;
      droneConeRef.current.instanceMatrix.needsUpdate = true;
    }

    // 3. Throttled (12Hz) zero-React-rerender material updates for diurnal lighting, wetness & outages
    if (t - lastMatSyncRef.current < 0.08) return;
    lastMatSyncRef.current = t;

    const timeState = TimeSystem.getInstance().getState();
    const weatherState = WeatherSystem.getInstance().getState();
    const eventState = LivingCityEventSystem.getInstance().getState();
    const q = QualityManager.current;
    const ultra = q.name === 'ULTRA';
    const gridIsOut = eventState.type === 'POWER_OUTAGE' && eventState.phase === 'ACTIVE';
    const nf = timeState.nightFactor;
    const lightsActive = !gridIsOut && timeState.streetLightsOn && q.nightLightsEnabled;
    const effectiveWetness = q.wetReflectionsEnabled ? weatherState.wetnessFactor : 0;

    const envScale =
      q.reflectionQuality === 'HIGH'
        ? 1.55
        : q.reflectionQuality === 'MEDIUM'
        ? 0.95
        : q.reflectionQuality === 'LOW'
        ? 0.4
        : 0.0;

    const roadRough = THREE.MathUtils.lerp(ultra ? 0.28 : 0.38, 0.06, effectiveWetness);
    const roadMetal = THREE.MathUtils.lerp(0.68, 0.92, effectiveWetness);
    const swRough = THREE.MathUtils.lerp(0.52, 0.16, effectiveWetness);
    const swMetal = THREE.MathUtils.lerp(0.36, 0.68, effectiveWetness);

    dynamicMats.groundMat.roughness = roadRough + 0.18;
    dynamicMats.plazaMat.roughness = swRough * 0.75;
    dynamicMats.plazaMat.metalness = swMetal;
    const wantPuddle =
      q.wetReflectionsEnabled && q.reflectionQuality !== 'OFF' && (effectiveWetness > 0.05 || ultra);
    const aveEnv = effectiveWetness > 0.05 ? envScale : envScale * 0.65;
    for (let i = 0; i < dynamicMats.allAvenueMats.length; i++) {
      const m = dynamicMats.allAvenueMats[i];
      m.roughness = roadRough;
      m.metalness = roadMetal;
      m.envMapIntensity = aveEnv;
      if ((m.roughnessMap !== null) !== wantPuddle) {
        m.roughnessMap = wantPuddle ? puddleRoughness : null;
        m.needsUpdate = true;
      }
    }
    dynamicMats.junctionMat.roughness = roadRough;
    dynamicMats.junctionMat.metalness = roadMetal;
    dynamicMats.sidewalkMat.roughness = swRough;
    dynamicMats.sidewalkMat.metalness = swMetal;
    dynamicMats.meridianMat.emissiveIntensity = gridIsOut ? 0.02 : 0.22 + nf * 0.3;

    const facadeEmissive = gridIsOut ? 0.03 : 0.1 + nf * 1.75;
    dynamicMats.facadeMats.CURTAIN_GLASS.emissiveIntensity = facadeEmissive;
    dynamicMats.facadeMats.DIAGRID_HEX.emissiveIntensity = facadeEmissive;
    dynamicMats.facadeMats.BRUTALIST_RIBBED.emissiveIntensity = facadeEmissive;
    dynamicMats.facadeMats.ARCOLOGY_TERRACE.emissiveIntensity = facadeEmissive;

    const neonBoost = gridIsOut ? 0.42 : 0.95 + nf * 1.35;
    const beaconBoost = gridIsOut ? 0.5 : 1.2 + nf * 1.65;
    const lobbyGain = gridIsOut ? 0.14 : 0.38 + nf * 0.95;

    dynamicMats.hdrNeonMat.color.setScalar(neonBoost);
    dynamicMats.hdrBeaconMat.color.setScalar(beaconBoost);
    dynamicMats.lobbyGlowMat.color.setScalar(lobbyGain);
    dynamicMats.astrolabeCyanMat.color.set('#38bdf8').multiplyScalar(neonBoost);
    dynamicMats.astrolabeAmberMat.color.set('#f59e0b').multiplyScalar(neonBoost);

    if (lightsActive) {
      dynamicMats.hdrNightMat.color.setScalar(neonBoost);
      dynamicMats.hdrCurbMat.color.setScalar(Math.min(1.9, neonBoost * 0.85));
      dynamicMats.hdrStreetBulbMat.color.set('#fde68a').multiplyScalar(2.65);
    } else {
      dynamicMats.hdrNightMat.color.set('#1e293b');
      dynamicMats.hdrCurbMat.color.setScalar(0.85);
      dynamicMats.hdrStreetBulbMat.color.set('#1e293b');
    }
  });

  return (
    <group name="CityDistrictCentral">
      {/* Ground Substrate (pushed well below road planes to eliminate grazing depth-precision Z-fighting) */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.14, 0]}
        receiveShadow={quality.shadows}
        material={dynamicMats.groundMat}
        renderOrder={0}
      >
        <planeGeometry args={[2800, 2800]} />
      </mesh>

      {/* Central Intersection & Civic Plaza Pad (single-sided top deck, zero bottom-face Z-fighting) */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.082, 0]}
        receiveShadow={quality.shadows}
        material={dynamicMats.plazaMat}
        renderOrder={3}
      >
        <planeGeometry args={[25.6, 25.6]} />
      </mesh>

      {/* Central Plaza Sunken Reflective Meridian Ring & Overhead Astrolabe */}
      <group name="CentralPlazaPavilion">
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.100, 0]} material={dynamicMats.meridianMat} renderOrder={4}>
          <ringGeometry args={[6.25, 9.35, 48]} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.106, 0]} renderOrder={5}>
          <ringGeometry args={[5.95, 6.20, 48]} />
          <meshBasicMaterial color="#f59e0b" polygonOffset polygonOffsetFactor={-4} polygonOffsetUnits={-8} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.106, 0]} renderOrder={5}>
          <ringGeometry args={[9.40, 9.65, 48]} />
          <meshBasicMaterial color="#38bdf8" polygonOffset polygonOffsetFactor={-4} polygonOffsetUnits={-8} />
        </mesh>

        {/* Suspended Kinetic Meridian Astrolabe */}
        <group ref={astrolabeRef} position={[0, 13.5, 0]}>
          <mesh>
            <octahedronGeometry args={[1.1, 0]} />
            <meshBasicMaterial color="#f59e0b" wireframe toneMapped={false} />
          </mesh>
          <mesh material={dynamicMats.astrolabeCyanMat}>
            <torusGeometry args={[2.6, 0.05, 8, 48]} />
          </mesh>
          <mesh rotation={[Math.PI / 3, 0, 0]} material={dynamicMats.astrolabeAmberMat}>
            <torusGeometry args={[3.4, 0.04, 8, 48]} />
          </mesh>
        </group>
      </group>

      {/* Unified Batched Central Architecture, Roads, Sidewalks, Skybridges, Props, Streetlights, Gantries & Trees */}
      <InstancedBatchLayer buckets={batchedBuckets} specs={bucketSpecs} name="CityDistrictStaticBatched" />

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

      {/* Wayfinding Signage across Central & Outer Sectors (mounted on clear raised sidewalks) */}
      <StreetSign position={[-13.6, 4.25, -14.2]} rotationY={Math.PI} label={landmarkNames.get('central_plaza') ?? 'Central Plaza Hub'} direction="S" />
      <StreetSign position={[-13.6, 4.25, -62]} rotationY={Math.PI} label={landmarkNames.get('north_crossway') ?? 'North Crossing Avenue'} direction="N" accent="#38bdf8" />
      <StreetSign position={[28, 4.25, 28]} rotationY={Math.PI / 2} label={landmarkNames.get('apex_tower') ?? 'Apex Monolith Tower'} direction="E" accent="#f59e0b" />
      <StreetSign position={[62, 4.25, 62]} rotationY={-Math.PI / 2} label={landmarkNames.get('park_sanctuary') ?? 'Central Park Sanctuary'} direction="E" accent="#10b981" />
      <StreetSign position={[13.6, 4.25, 62]} rotationY={0} label={landmarkNames.get('south_crossway') ?? 'South Crossing Avenue'} direction="S" accent="#38bdf8" />
      <StreetSign position={[-62, 4.25, -14.2]} rotationY={Math.PI / 2} label="Neural Quantum Sector" direction="W" accent="#4a8ad6" />
      <StreetSign position={[-62, 4.25, 62]} rotationY={Math.PI / 2} label="Solaris Foundry Sector" direction="W" accent="#f59e0b" />
      <StreetSign position={[120, 4.25, -14.2]} rotationY={-Math.PI / 2} label="Aerostrata Spires" direction="E" accent="#38bdf8" />

      {/* Instanced Autonomous Aerial Recon Drones (4 draw calls total instead of 84) */}
      {quality.trafficEnabled && (
        <group name="AerialReconDrones">
          <instancedMesh
            ref={droneBodyRef}
            args={[SHARED_BEVELED_BOX, MAT_CANOPY, DRONE_COUNT]}
            dispose={null}
            frustumCulled={false}
          />
          <instancedMesh
            ref={droneRotorRef}
            args={[SHARED_UNIT_CYLINDER, MAT_BASIC_COLORED, DRONE_COUNT * 4]}
            dispose={null}
            frustumCulled={false}
          />
          <instancedMesh
            ref={droneEyeRef}
            args={[SHARED_DRONE_SPHERE, undefined, DRONE_COUNT]}
            frustumCulled={false}
          >
            <meshBasicMaterial color="#f43f5e" />
          </instancedMesh>
          <instancedMesh
            ref={droneConeRef}
            args={[SHARED_DRONE_CONE, undefined, DRONE_COUNT]}
            frustumCulled={false}
          >
            <meshBasicMaterial color="#ffffff" transparent opacity={0.075} depthWrite={false} side={THREE.DoubleSide} />
          </instancedMesh>
        </group>
      )}
    </group>
  );
};
