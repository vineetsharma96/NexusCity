import * as THREE from 'three';
import { SeedRandom } from '../core/SeedRandom';
import { DistrictGenerator, DistrictInfo } from './DistrictGenerator';
import { CollisionBox } from '../player/KinematicCollision';
import { VegetationGenerator, TreeDef, PlanterBushDef, TreeSpecies } from './VegetationGenerator';

export interface StreamedBuildingDef {
  id: string;
  position: THREE.Vector3;
  size: THREE.Vector3;
  color: string;
  accentColor: string;
  emissiveColor: string;
  tiers: { offset: THREE.Vector3; size: THREE.Vector3 }[];
  antenna?: { height: number; beaconColor: string };
  collisionBox: CollisionBox;
}

export interface PocketParkDef {
  id: string;
  position: THREE.Vector3;
  size: THREE.Vector3;
  hasPond: boolean;
  pondRadius: number;
  fountainColor: string;
  benches: { position: THREE.Vector3; rotationY: number }[];
  trees: TreeDef[];
  bushes: PlanterBushDef[];
}

export interface StreamedChunkData {
  key: string;
  cx: number;
  cz: number;
  center: THREE.Vector3;
  district: DistrictInfo;
  roads: { position: THREE.Vector3; size: THREE.Vector3; rotationY: number }[];
  sidewalks: { position: THREE.Vector3; size: THREE.Vector3 }[];
  buildings: StreamedBuildingDef[];
  trees: TreeDef[];
  bushes: PlanterBushDef[];
  parks: PocketParkDef[];
  collisionBoxes: CollisionBox[];
}

export class ProceduralChunkGenerator {
  public static readonly CHUNK_SIZE = 120; // meters per chunk
  private static cache: Map<string, StreamedChunkData> = new Map();

  /**
   * Generates or retrieves cached chunk data deterministically for coordinates (cx, cz).
   */
  public static getChunkData(cx: number, cz: number, globalSeed: number = 847291): StreamedChunkData {
    const key = `${cx}_${cz}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    // Deterministic seed formula: combine globalSeed and spatial coordinates
    const chunkSeed = (globalSeed ^ (cx * 73856093) ^ (cz * 19349663)) >>> 0;
    const rng = new SeedRandom(chunkSeed);

    const size = this.CHUNK_SIZE;
    const centerX = (cx + 0.5) * size;
    const centerZ = (cz + 0.5) * size;
    const center = new THREE.Vector3(centerX, 0, centerZ);
    const district = DistrictGenerator.getDistrictAt(centerX, centerZ);

    const roads: { position: THREE.Vector3; size: THREE.Vector3; rotationY: number }[] = [];
    const sidewalks: { position: THREE.Vector3; size: THREE.Vector3 }[] = [];
    const buildings: StreamedBuildingDef[] = [];
    const parks: PocketParkDef[] = [];
    const collisionBoxes: CollisionBox[] = [];

    // Skip the central core (cx, cz in [-1..1]) as it is handcrafted in CityDistrict.tsx & InteriorDestinations
    if (Math.abs(cx) <= 1 && Math.abs(cz) <= 1) {
      const emptyChunk: StreamedChunkData = {
        key,
        cx,
        cz,
        center,
        district,
        roads,
        sidewalks,
        buildings,
        trees: [],
        bushes: [],
        parks,
        collisionBoxes,
      };
      this.cache.set(key, emptyChunk);
      return emptyChunk;
    }

    // 1. Generate Connecting Road Infrastructure
    const roadWidth = 14;
    roads.push({
      position: new THREE.Vector3(centerX, 0.02, centerZ),
      size: new THREE.Vector3(roadWidth, 0.05, size),
      rotationY: 0,
    });

    // Cross East-West street
    roads.push({
      position: new THREE.Vector3(centerX, 0.025, centerZ),
      size: new THREE.Vector3(size, 0.05, 12),
      rotationY: 0,
    });

    // 2. Generate 4 Quadrant Macro-Lots within Chunk
    const half = size / 2;
    const subSize = half - roadWidth / 2 - 4; // Width of building plot

    const quadrantOffsets = [
      { qx: -half / 2 - roadWidth / 4, qz: -half / 2 - roadWidth / 4 }, // NW
      { qx: half / 2 + roadWidth / 4, qz: -half / 2 - roadWidth / 4 },  // NE
      { qx: -half / 2 - roadWidth / 4, qz: half / 2 + roadWidth / 4 },  // SW
      { qx: half / 2 + roadWidth / 4, qz: half / 2 + roadWidth / 4 },   // SE
    ];

    quadrantOffsets.forEach((q, qIdx) => {
      const lotCenterX = centerX + q.qx;
      const lotCenterZ = centerZ + q.qz;

      // Determine if this quadrant is a Pocket Park / Botanical Reserve:
      // High probability in GREEN_DISTRICT (50%), modest chance in OLD_CITY/CENTRAL (20%)
      const isGreenDistrict = district.type === 'GREEN_DISTRICT';
      const isParkQuadrant =
        (isGreenDistrict && (rng.next() < 0.65 || qIdx === 0)) ||
        (!isGreenDistrict && district.foliageDensity >= 0.4 && rng.next() < 0.22);

      if (isParkQuadrant) {
        // Generate Pocket Park
        const parkId = `stream-park-${key}-${qIdx}`;
        const parkSize = new THREE.Vector3(subSize + 2, 0.22, subSize + 2);
        const parkPos = new THREE.Vector3(lotCenterX, 0.1, lotCenterZ);

        // Retaining perimeter wall colliders
        const wallH = 1.0;
        const halfS = (subSize + 2) / 2;
        collisionBoxes.push({
          min: new THREE.Vector3(lotCenterX - halfS, 0, lotCenterZ - halfS),
          max: new THREE.Vector3(lotCenterX + halfS, wallH, lotCenterZ - halfS + 0.8),
        });
        collisionBoxes.push({
          min: new THREE.Vector3(lotCenterX - halfS, 0, lotCenterZ + halfS - 0.8),
          max: new THREE.Vector3(lotCenterX + halfS, wallH, lotCenterZ + halfS),
        });

        // Park trees
        const parkTrees: TreeDef[] = [];
        const numParkTrees = rng.int(3, 5);
        const treeSpeciesList: TreeSpecies[] = isGreenDistrict
          ? ['SAKURA', 'WILLOW', 'GINKGO', 'CYBER_NEON']
          : ['GINKGO', 'EMERALD', 'WILLOW'];

        for (let pt = 0; pt < numParkTrees; pt++) {
          const ptAngle = (pt / numParkTrees) * Math.PI * 2 + rng.range(-0.2, 0.2);
          const ptDist = rng.range(8, subSize * 0.38);
          const ptx = lotCenterX + Math.cos(ptAngle) * ptDist;
          const ptz = lotCenterZ + Math.sin(ptAngle) * ptDist;
          const species: TreeSpecies = rng.pick(treeSpeciesList);

          parkTrees.push({
            id: `${parkId}-tree-${pt}`,
            position: new THREE.Vector3(ptx, 0.18, ptz),
            scale: rng.range(0.9, 1.3),
            trunkHeight: rng.range(4.8, 6.5),
            trunkRadius: rng.range(0.25, 0.35),
            branches: [
              {
                start: new THREE.Vector3(0, 3.2, 0),
                end: new THREE.Vector3(1.8, 4.6, 0.8),
                radius: 0.16,
              },
              {
                start: new THREE.Vector3(0, 3.5, 0),
                end: new THREE.Vector3(-1.6, 4.8, -0.9),
                radius: 0.16,
              },
              {
                start: new THREE.Vector3(0, 3.8, 0),
                end: new THREE.Vector3(0.5, 5.2, -1.6),
                radius: 0.16,
              },
            ],
            leafClusters: [
              {
                offset: new THREE.Vector3(1.8, 5.0, 0.8),
                scale: new THREE.Vector3(2.2, 1.8, 2.2),
                color: species === 'SAKURA' ? '#fb7185' : species === 'GINKGO' ? '#f59e0b' : '#10b981',
              },
              {
                offset: new THREE.Vector3(-1.6, 5.2, -0.9),
                scale: new THREE.Vector3(2.0, 1.6, 2.0),
                color: species === 'SAKURA' ? '#f43f5e' : species === 'GINKGO' ? '#fbbf24' : '#059669',
              },
              {
                offset: new THREE.Vector3(0, 6.0, 0),
                scale: new THREE.Vector3(2.6, 2.2, 2.6),
                color: species === 'SAKURA' ? '#fda4af' : species === 'GINKGO' ? '#d97706' : '#34d399',
              },
            ],
            planterSize: new THREE.Vector3(2.8, 0.4, 2.8),
            hasPlanter: false,
            species,
            emissiveColor: species === 'SAKURA' ? '#f43f5e' : species === 'CYBER_NEON' ? '#00f0ff' : '#059669',
            emissiveIntensity: 0.2,
          });
        }

        // Park bushes
        const parkBushes: PlanterBushDef[] = [];
        for (let pb = 0; pb < 4; pb++) {
          const pbAngle = (pb / 4) * Math.PI * 2 + Math.PI / 4;
          const pbx = lotCenterX + Math.cos(pbAngle) * (subSize * 0.32);
          const pbz = lotCenterZ + Math.sin(pbAngle) * (subSize * 0.32);
          parkBushes.push({
            id: `${parkId}-bush-${pb}`,
            position: new THREE.Vector3(pbx, 0.2, pbz),
            size: new THREE.Vector3(2.2, 0.9, 2.2),
            color: '#059669',
            hasFlowers: true,
            flowerColor: district.accentColor,
          });
        }

        // Benches
        const benches = [
          { position: new THREE.Vector3(lotCenterX - 6, 0.2, lotCenterZ), rotationY: Math.PI / 2 },
          { position: new THREE.Vector3(lotCenterX + 6, 0.2, lotCenterZ), rotationY: -Math.PI / 2 },
        ];

        parks.push({
          id: parkId,
          position: parkPos,
          size: parkSize,
          hasPond: true,
          pondRadius: rng.range(5.5, 8.5),
          fountainColor: district.primaryLightColor,
          benches,
          trees: parkTrees,
          bushes: parkBushes,
        });

        return;
      }

      // Sidewalk pad for this quadrant
      sidewalks.push({
        position: new THREE.Vector3(lotCenterX, 0.09, lotCenterZ),
        size: new THREE.Vector3(subSize + 3, 0.18, subSize + 3),
      });

      // Height range based on district
      const hRange = district.buildingHeightRange;
      const totalH = rng.range(hRange[0], hRange[1]);
      const bldgW = rng.range(subSize * 0.65, subSize * 0.9);
      const bldgD = rng.range(subSize * 0.65, subSize * 0.9);

      // Procedural tiers (1 to 3 setbacks)
      const tiers: { offset: THREE.Vector3; size: THREE.Vector3 }[] = [];
      const numTiers = totalH > 60 ? (totalH > 110 ? 3 : 2) : 1;
      let currentBaseY = 0;

      for (let t = 0; t < numTiers; t++) {
        const tierH = totalH / numTiers;
        const taper = 1.0 - t * 0.18;
        const tw = bldgW * taper;
        const td = bldgD * taper;

        tiers.push({
          offset: new THREE.Vector3(0, currentBaseY + tierH / 2, 0),
          size: new THREE.Vector3(tw, tierH, td),
        });

        currentBaseY += tierH;
      }

      // Palette selection by district
      const baseColors = ['#080f1e', '#0c162c', '#0f172a', '#1e293b', '#131b2e'];
      const baseColor = baseColors[Math.floor(rng.next() * baseColors.length)];

      const bldgId = `stream-${key}-${qIdx}`;
      const bldgPos = new THREE.Vector3(lotCenterX, 0, lotCenterZ);
      const bldgSize = new THREE.Vector3(bldgW, totalH, bldgD);

      const collisionBox: CollisionBox = {
        min: new THREE.Vector3(lotCenterX - bldgW / 2, 0, lotCenterZ - bldgD / 2),
        max: new THREE.Vector3(lotCenterX + bldgW / 2, totalH, lotCenterZ + bldgD / 2),
      };
      collisionBoxes.push(collisionBox);

      // Antenna beacon for tall spires
      let antenna: { height: number; beaconColor: string } | undefined;
      if (totalH > 75 && rng.next() > 0.4) {
        antenna = {
          height: rng.range(8, 22),
          beaconColor: district.primaryLightColor,
        };
      }

      buildings.push({
        id: bldgId,
        position: bldgPos,
        size: bldgSize,
        color: baseColor,
        accentColor: district.accentColor,
        emissiveColor: district.primaryLightColor,
        tiers,
        antenna,
        collisionBox,
      });
    });

    // 3. Generate Sidewalk Trees & Vegetation
    const { trees, bushes } = VegetationGenerator.generateChunkTrees(cx, cz, district, globalSeed);

    const chunkData: StreamedChunkData = {
      key,
      cx,
      cz,
      center,
      district,
      roads,
      sidewalks,
      buildings,
      trees,
      bushes,
      parks,
      collisionBoxes,
    };

    this.cache.set(key, chunkData);
    return chunkData;
  }
}
