import * as THREE from 'three';
import { SeedRandom } from '../core/SeedRandom';
import { DistrictGenerator, DistrictInfo } from './DistrictGenerator';
import { CollisionBox } from '../player/KinematicCollision';
import { VegetationGenerator, TreeDef, PlanterBushDef, TreeSpecies } from './VegetationGenerator';
import { FacadeStyleVariant } from '../core/ProceduralTextures';

export interface StreamedBuildingDef {
  id: string;
  position: THREE.Vector3;
  size: THREE.Vector3;
  color: string;
  accentColor: string;
  emissiveColor: string;
  facadeVariant: FacadeStyleVariant;
  tiers: { offset: THREE.Vector3; size: THREE.Vector3 }[];
  antenna?: { height: number; beaconColor: string };
  collisionBox: CollisionBox;
}

export type FurnitureType =
  | 'STREETLIGHT'
  | 'BENCH'
  | 'BUS_STOP'
  | 'TRASH_RECEPTACLE'
  | 'BOLLARD'
  | 'CYBER_KIOSK';

export interface StreetFurnitureDef {
  id: string;
  type: FurnitureType;
  position: THREE.Vector3;
  rotationY: number;
  accentColor?: string;
  emissiveColor?: string;
}

export type BiomePropType =
  | 'INDUSTRIAL_PIPE'
  | 'STORAGE_TANK'
  | 'STEAM_VENT'
  | 'CONDUIT_LINE'
  | 'SERVER_NODE'
  | 'PLANTER_VASE'
  | 'HISTORIC_PILLAR'
  | 'AERO_MAST'
  | 'CITY_TOTEM';

export interface BiomePropDef {
  id: string;
  type: BiomePropType;
  position: THREE.Vector3;
  rotationY: number;
  size: THREE.Vector3;
  color: string;
  emissiveColor?: string;
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
  furniture: StreetFurnitureDef[];
  biomeProps: BiomePropDef[];
  collisionBoxes: CollisionBox[];
}

export class ProceduralChunkGenerator {
  public static readonly CHUNK_SIZE = 120;
  private static cache = new Map<string, StreamedChunkData>();

  public static getChunkData(cx: number, cz: number, globalSeed: number = 847291): StreamedChunkData {
    const key = `${cx}_${cz}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

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

    if (Math.abs(cx) <= 1 && Math.abs(cz) <= 1) {
      const empty: StreamedChunkData = {
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
        furniture: [],
        biomeProps: [],
        collisionBoxes,
      };
      this.cache.set(key, empty);
      return empty;
    }

    const roadWidth = 14;
    roads.push({
      position: new THREE.Vector3(centerX, 0.02, centerZ),
      size: new THREE.Vector3(roadWidth, 0.04, size),
      rotationY: 0,
    });
    roads.push({
      position: new THREE.Vector3(centerX, 0.018, centerZ),
      size: new THREE.Vector3(12, 0.04, size),
      rotationY: Math.PI / 2,
    });

    const half = size / 2;
    const subSize = half - roadWidth / 2 - 4;
    const quadrantOffsets = [
      { qx: -half / 2 - roadWidth / 4, qz: -half / 2 - roadWidth / 4 },
      { qx: half / 2 + roadWidth / 4, qz: -half / 2 - roadWidth / 4 },
      { qx: -half / 2 - roadWidth / 4, qz: half / 2 + roadWidth / 4 },
      { qx: half / 2 + roadWidth / 4, qz: half / 2 + roadWidth / 4 },
    ];

    quadrantOffsets.forEach((q, qIdx) => {
      const lotCenterX = centerX + q.qx;
      const lotCenterZ = centerZ + q.qz;
      const isGreen = district.type === 'GREEN_DISTRICT';
      const isPark =
        (isGreen && (rng.next() < 0.65 || qIdx === 0)) ||
        (!isGreen && district.foliageDensity >= 0.4 && rng.next() < 0.2);

      if (isPark) {
        const parkId = `stream-park-${key}-${qIdx}`;
        const halfS = (subSize + 2) / 2;
        collisionBoxes.push({
          min: new THREE.Vector3(lotCenterX - halfS, 0, lotCenterZ - halfS),
          max: new THREE.Vector3(lotCenterX + halfS, 1.0, lotCenterZ - halfS + 0.8),
        });
        collisionBoxes.push({
          min: new THREE.Vector3(lotCenterX - halfS, 0, lotCenterZ + halfS - 0.8),
          max: new THREE.Vector3(lotCenterX + halfS, 1.0, lotCenterZ + halfS),
        });

        const parkTrees: TreeDef[] = [];
        const speciesPool: TreeSpecies[] = isGreen ? ['SAKURA', 'WILLOW', 'GINKGO'] : ['GINKGO', 'EMERALD'];
        for (let pt = 0; pt < 3; pt++) {
          const angle = (pt / 3) * Math.PI * 2 + rng.range(-0.2, 0.2);
          const dist = rng.range(8, subSize * 0.36);
          const sp = rng.pick(speciesPool);
          parkTrees.push({
            id: `${parkId}-tree-${pt}`,
            position: new THREE.Vector3(lotCenterX + Math.cos(angle) * dist, 0.18, lotCenterZ + Math.sin(angle) * dist),
            scale: 1,
            trunkHeight: 5.2,
            trunkRadius: 0.28,
            branches: [
              { start: new THREE.Vector3(0, 3.2, 0), end: new THREE.Vector3(1.6, 4.6, 0.7), radius: 0.15 },
              { start: new THREE.Vector3(0, 3.5, 0), end: new THREE.Vector3(-1.5, 4.8, -0.8), radius: 0.15 },
            ],
            leafClusters: [
              {
                offset: new THREE.Vector3(1.6, 5.0, 0.7),
                scale: new THREE.Vector3(2.1, 1.7, 2.1),
                color: sp === 'SAKURA' ? '#fb7185' : sp === 'GINKGO' ? '#f59e0b' : '#10b981',
              },
              {
                offset: new THREE.Vector3(0, 5.8, 0),
                scale: new THREE.Vector3(2.5, 2.0, 2.5),
                color: sp === 'SAKURA' ? '#fda4af' : sp === 'GINKGO' ? '#fbbf24' : '#34d399',
              },
            ],
            planterSize: new THREE.Vector3(2.4, 0.36, 2.4),
            hasPlanter: false,
            species: sp,
            emissiveColor: district.primaryLightColor,
            emissiveIntensity: 0.18,
          });
        }

        parks.push({
          id: parkId,
          position: new THREE.Vector3(lotCenterX, 0.1, lotCenterZ),
          size: new THREE.Vector3(subSize + 2, 0.22, subSize + 2),
          hasPond: true,
          pondRadius: rng.range(5.5, 8.0),
          fountainColor: district.primaryLightColor,
          benches: [
            { position: new THREE.Vector3(lotCenterX - 6, 0.2, lotCenterZ), rotationY: Math.PI / 2 },
            { position: new THREE.Vector3(lotCenterX + 6, 0.2, lotCenterZ), rotationY: -Math.PI / 2 },
          ],
          trees: parkTrees,
          bushes: [],
        });
        return;
      }

      sidewalks.push({
        position: new THREE.Vector3(lotCenterX, 0.09, lotCenterZ),
        size: new THREE.Vector3(subSize + 3, 0.18, subSize + 3),
      });

      const [minH, maxH] = district.buildingHeightRange;
      const totalH = rng.range(minH, maxH);
      const bldgW = rng.range(subSize * 0.66, subSize * 0.88);
      const bldgD = rng.range(subSize * 0.66, subSize * 0.88);

      const numTiers = totalH > 65 ? (totalH > 110 ? 3 : 2) : 1;
      const tiers: { offset: THREE.Vector3; size: THREE.Vector3 }[] = [];
      let baseY = 0;
      for (let t = 0; t < numTiers; t++) {
        const tierH = totalH / numTiers;
        const taper = 1 - t * 0.18;
        tiers.push({
          offset: new THREE.Vector3(0, baseY + tierH / 2, 0),
          size: new THREE.Vector3(bldgW * taper, tierH, bldgD * taper),
        });
        baseY += tierH;
      }

      const palette = ['#080d18', '#0b1120', '#0f172a', '#151e30'];
      const collisionBox: CollisionBox = {
        min: new THREE.Vector3(lotCenterX - bldgW / 2, 0, lotCenterZ - bldgD / 2),
        max: new THREE.Vector3(lotCenterX + bldgW / 2, totalH, lotCenterZ + bldgD / 2),
      };
      collisionBoxes.push(collisionBox);

      const facadeVariant: FacadeStyleVariant =
        district.type === 'GREEN_DISTRICT'
          ? 'ARCOLOGY_TERRACE'
          : district.type === 'INDUSTRIAL_DISTRICT' || district.type === 'OLD_CITY'
          ? 'BRUTALIST_RIBBED'
          : qIdx % 2 === 0
          ? 'DIAGRID_HEX'
          : 'CURTAIN_GLASS';

      buildings.push({
        id: `stream-${key}-${qIdx}`,
        position: new THREE.Vector3(lotCenterX, 0, lotCenterZ),
        size: new THREE.Vector3(bldgW, totalH, bldgD),
        color: rng.pick(palette),
        accentColor: district.accentColor,
        emissiveColor: district.primaryLightColor,
        facadeVariant,
        tiers,
        antenna:
          totalH > 68 && rng.next() > 0.35
            ? { height: rng.range(9, 20), beaconColor: district.primaryLightColor }
            : undefined,
        collisionBox,
      });
    });

    const { trees, bushes } = VegetationGenerator.generateChunkTrees(cx, cz, district, globalSeed);
    trees.forEach((t) => {
      const r = Math.max(0.4, t.trunkRadius * 1.25);
      collisionBoxes.push({
        min: new THREE.Vector3(t.position.x - r, 0, t.position.z - r),
        max: new THREE.Vector3(t.position.x + r, t.trunkHeight, t.position.z + r),
      });
    });

    const furniture: StreetFurnitureDef[] = [
      {
        id: `fur-sl-${key}-w`,
        type: 'STREETLIGHT',
        position: new THREE.Vector3(centerX - 8.2, 0, centerZ - 30),
        rotationY: Math.PI / 2,
        accentColor: district.accentColor,
        emissiveColor: district.primaryLightColor,
      },
      {
        id: `fur-sl-${key}-e`,
        type: 'STREETLIGHT',
        position: new THREE.Vector3(centerX + 8.2, 0, centerZ + 30),
        rotationY: -Math.PI / 2,
        accentColor: district.accentColor,
        emissiveColor: district.primaryLightColor,
      },
      {
        id: `fur-bench-${key}`,
        type: 'BENCH',
        position: new THREE.Vector3(centerX - 9.8, 0.12, centerZ - 18),
        rotationY: Math.PI / 2,
        accentColor: district.accentColor,
        emissiveColor: district.primaryLightColor,
      },
    ];

    if ((Math.abs(cx) + Math.abs(cz)) % 2 === 0) {
      furniture.push({
        id: `fur-bus-${key}`,
        type: 'BUS_STOP',
        position: new THREE.Vector3(centerX + 9.6, 0.12, centerZ - 20),
        rotationY: Math.PI,
        accentColor: district.accentColor,
        emissiveColor: district.primaryLightColor,
      });
    }

    const biomeProps: BiomePropDef[] = [
      {
        id: `biome-prop-${key}`,
        type:
          district.type === 'INDUSTRIAL_DISTRICT'
            ? 'STORAGE_TANK'
            : district.type === 'NEURAL_DISTRICT'
            ? 'SERVER_NODE'
            : district.type === 'GREEN_DISTRICT'
            ? 'PLANTER_VASE'
            : district.type === 'OLD_CITY'
            ? 'HISTORIC_PILLAR'
            : district.type === 'SKY_DISTRICT'
            ? 'AERO_MAST'
            : 'CITY_TOTEM',
        position: new THREE.Vector3(centerX + 10.0, 0, centerZ + 18),
        rotationY: 0,
        size: new THREE.Vector3(1.6, 4.2, 1.6),
        color: '#1e293b',
        emissiveColor: district.primaryLightColor,
      },
    ];

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
      furniture,
      biomeProps,
      collisionBoxes,
    };

    this.cache.set(key, chunkData);
    return chunkData;
  }
}
