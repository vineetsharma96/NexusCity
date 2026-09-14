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
  scale?: number;
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
        furniture: [],
        biomeProps: [],
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

    // Register tree trunk colliders
    trees.forEach((t) => {
      const r = Math.max(0.4, t.trunkRadius * 1.25);
      collisionBoxes.push({
        min: new THREE.Vector3(t.position.x - r, 0, t.position.z - r),
        max: new THREE.Vector3(t.position.x + r, t.trunkHeight, t.position.z + r),
      });
    });

    parks.forEach((p) => {
      p.trees.forEach((t) => {
        const r = Math.max(0.4, t.trunkRadius * 1.25);
        collisionBoxes.push({
          min: new THREE.Vector3(t.position.x - r, 0, t.position.z - r),
          max: new THREE.Vector3(t.position.x + r, t.trunkHeight, t.position.z + r),
        });
      });
    });

    // 4. Generate Street Furniture (Streetlights, Benches, Bus Stops, Bollards, Kiosks, Trash Bins)
    const furniture: StreetFurnitureDef[] = [];

    // 4.1 Streetlights along North-South and East-West sidewalks
    const slDistZ = 32;
    const slOffsetX = roadWidth / 2 + 1.2;
    // West curb lights facing East
    furniture.push({
      id: `fur-sl-${key}-w1`,
      type: 'STREETLIGHT',
      position: new THREE.Vector3(centerX - slOffsetX, 0, centerZ - slDistZ),
      rotationY: Math.PI / 2,
      accentColor: district.accentColor,
      emissiveColor: district.primaryLightColor,
    });
    furniture.push({
      id: `fur-sl-${key}-w2`,
      type: 'STREETLIGHT',
      position: new THREE.Vector3(centerX - slOffsetX, 0, centerZ + slDistZ),
      rotationY: Math.PI / 2,
      accentColor: district.accentColor,
      emissiveColor: district.primaryLightColor,
    });
    // East curb lights facing West
    furniture.push({
      id: `fur-sl-${key}-e1`,
      type: 'STREETLIGHT',
      position: new THREE.Vector3(centerX + slOffsetX, 0, centerZ - slDistZ),
      rotationY: -Math.PI / 2,
      accentColor: district.accentColor,
      emissiveColor: district.primaryLightColor,
    });
    furniture.push({
      id: `fur-sl-${key}-e2`,
      type: 'STREETLIGHT',
      position: new THREE.Vector3(centerX + slOffsetX, 0, centerZ + slDistZ),
      rotationY: -Math.PI / 2,
      accentColor: district.accentColor,
      emissiveColor: district.primaryLightColor,
    });

    // East-West Street streetlights
    const slDistX = 32;
    const slOffsetZ = 12 / 2 + 1.2;
    furniture.push({
      id: `fur-sl-${key}-n1`,
      type: 'STREETLIGHT',
      position: new THREE.Vector3(centerX - slDistX, 0, centerZ - slOffsetZ),
      rotationY: 0,
      accentColor: district.accentColor,
      emissiveColor: district.primaryLightColor,
    });
    furniture.push({
      id: `fur-sl-${key}-n2`,
      type: 'STREETLIGHT',
      position: new THREE.Vector3(centerX + slDistX, 0, centerZ - slOffsetZ),
      rotationY: 0,
      accentColor: district.accentColor,
      emissiveColor: district.primaryLightColor,
    });

    // 4.2 Sidewalk Benches
    const benchPositions = [
      { pos: new THREE.Vector3(centerX - 9.8, 0.12, centerZ - 18), rot: Math.PI / 2 },
      { pos: new THREE.Vector3(centerX + 9.8, 0.12, centerZ + 18), rot: -Math.PI / 2 },
    ];
    benchPositions.forEach((bp, bIdx) => {
      furniture.push({
        id: `fur-bench-${key}-${bIdx}`,
        type: 'BENCH',
        position: bp.pos,
        rotationY: bp.rot,
        accentColor: district.accentColor,
        emissiveColor: district.primaryLightColor,
      });
      // Bench collider
      collisionBoxes.push({
        min: new THREE.Vector3(bp.pos.x - 1.1, 0, bp.pos.z - 0.5),
        max: new THREE.Vector3(bp.pos.x + 1.1, 0.9, bp.pos.z + 0.5),
      });
    });

    // 4.3 Transit Bus Stop Shelter (regular interval, placed along curb)
    if ((Math.abs(cx) * 3 + Math.abs(cz)) % 2 === 0) {
      const busPos = new THREE.Vector3(centerX + 9.6, 0.12, centerZ - 20);
      furniture.push({
        id: `fur-bus-${key}`,
        type: 'BUS_STOP',
        position: busPos,
        rotationY: Math.PI,
        accentColor: district.accentColor,
        emissiveColor: district.primaryLightColor,
      });
      collisionBoxes.push({
        min: new THREE.Vector3(busPos.x - 2.2, 0, busPos.z - 1.1),
        max: new THREE.Vector3(busPos.x + 2.2, 3.2, busPos.z + 1.1),
      });
    }

    // 4.4 Trash / Recycling Receptacles near cross corners
    furniture.push({
      id: `fur-trash-${key}-1`,
      type: 'TRASH_RECEPTACLE',
      position: new THREE.Vector3(centerX - 8.8, 0.12, centerZ - 10),
      rotationY: 0,
      accentColor: district.accentColor,
      emissiveColor: '#38bdf8',
    });
    furniture.push({
      id: `fur-trash-${key}-2`,
      type: 'TRASH_RECEPTACLE',
      position: new THREE.Vector3(centerX + 8.8, 0.12, centerZ + 10),
      rotationY: Math.PI,
      accentColor: district.accentColor,
      emissiveColor: '#10b981',
    });

    // 4.5 Security Curb Bollards around the intersection corners
    const bollardCorners = [
      { x: centerX - 8.2, z: centerZ - 7.2 },
      { x: centerX + 8.2, z: centerZ - 7.2 },
      { x: centerX - 8.2, z: centerZ + 7.2 },
      { x: centerX + 8.2, z: centerZ + 7.2 },
    ];
    bollardCorners.forEach((bc, bIdx) => {
      furniture.push({
        id: `fur-bollard-${key}-${bIdx}`,
        type: 'BOLLARD',
        position: new THREE.Vector3(bc.x, 0.12, bc.z),
        rotationY: 0,
        accentColor: district.accentColor,
        emissiveColor: district.primaryLightColor,
      });
    });

    // 4.6 Holographic Cyber Kiosk / Info Terminal
    if (district.type !== 'INDUSTRIAL_DISTRICT' && rng.next() > 0.3) {
      const kioskPos = new THREE.Vector3(centerX - 9.6, 0.12, centerZ + 20);
      furniture.push({
        id: `fur-kiosk-${key}`,
        type: 'CYBER_KIOSK',
        position: kioskPos,
        rotationY: Math.PI / 2,
        accentColor: district.accentColor,
        emissiveColor: district.primaryLightColor,
      });
      collisionBoxes.push({
        min: new THREE.Vector3(kioskPos.x - 0.7, 0, kioskPos.z - 0.5),
        max: new THREE.Vector3(kioskPos.x + 0.7, 2.5, kioskPos.z + 0.5),
      });
    }

    // 5. Generate District-Specific Biome Props
    const biomeProps: BiomePropDef[] = [];

    switch (district.type) {
      case 'INDUSTRIAL_DISTRICT': {
        // Large Heavy Silo / Storage Tank in alley
        const tankPos = new THREE.Vector3(centerX - 24, 0, centerZ - 24);
        const tankSize = new THREE.Vector3(6.5, 9.0, 6.5);
        biomeProps.push({
          id: `biome-tank-${key}`,
          type: 'STORAGE_TANK',
          position: tankPos,
          rotationY: rng.range(0, Math.PI),
          size: tankSize,
          color: '#334155',
          emissiveColor: '#f59e0b',
        });
        collisionBoxes.push({
          min: new THREE.Vector3(tankPos.x - tankSize.x / 2, 0, tankPos.z - tankSize.z / 2),
          max: new THREE.Vector3(tankPos.x + tankSize.x / 2, tankSize.y, tankPos.z + tankSize.z / 2),
        });

        // Overhead industrial pipe conduit across avenue
        biomeProps.push({
          id: `biome-pipe-${key}`,
          type: 'INDUSTRIAL_PIPE',
          position: new THREE.Vector3(centerX, 6.8, centerZ - 26),
          rotationY: 0,
          size: new THREE.Vector3(28, 0.7, 0.7),
          color: '#475569',
          emissiveColor: '#f59e0b',
        });

        // Sidewalk steam exhaust vent
        biomeProps.push({
          id: `biome-vent-${key}`,
          type: 'STEAM_VENT',
          position: new THREE.Vector3(centerX + 8.6, 0.08, centerZ + 14),
          rotationY: 0,
          size: new THREE.Vector3(2.0, 0.15, 2.0),
          color: '#1e293b',
          emissiveColor: '#f97316',
        });
        break;
      }

      case 'NEURAL_DISTRICT': {
        // Glowing data conduit strip along sidewalk curb
        biomeProps.push({
          id: `biome-conduit-${key}`,
          type: 'CONDUIT_LINE',
          position: new THREE.Vector3(centerX - 7.6, 0.09, centerZ),
          rotationY: 0,
          size: new THREE.Vector3(0.35, 0.12, 60),
          color: '#1e1b4b',
          emissiveColor: '#a855f7',
        });

        // Quantum Server Node Pillar
        const serverPos = new THREE.Vector3(centerX + 10.2, 0, centerZ - 12);
        const serverSize = new THREE.Vector3(1.6, 4.2, 1.6);
        biomeProps.push({
          id: `biome-server-${key}`,
          type: 'SERVER_NODE',
          position: serverPos,
          rotationY: -Math.PI / 4,
          size: serverSize,
          color: '#0f172a',
          emissiveColor: '#8b5cf6',
        });
        collisionBoxes.push({
          min: new THREE.Vector3(serverPos.x - serverSize.x / 2, 0, serverPos.z - serverSize.z / 2),
          max: new THREE.Vector3(serverPos.x + serverSize.x / 2, serverSize.y, serverPos.z + serverSize.z / 2),
        });
        break;
      }

      case 'GREEN_DISTRICT': {
        // High-LOD Planter Vases & Floral Beds along sidewalks
        const vase1 = new THREE.Vector3(centerX - 9.6, 0.12, centerZ - 14);
        const vase2 = new THREE.Vector3(centerX + 9.6, 0.12, centerZ + 14);
        [vase1, vase2].forEach((vPos, vIdx) => {
          biomeProps.push({
            id: `biome-vase-${key}-${vIdx}`,
            type: 'PLANTER_VASE',
            position: vPos,
            rotationY: 0,
            size: new THREE.Vector3(2.4, 0.9, 2.4),
            color: '#064e3b',
            emissiveColor: '#10b981',
          });
          collisionBoxes.push({
            min: new THREE.Vector3(vPos.x - 1.2, 0, vPos.z - 1.2),
            max: new THREE.Vector3(vPos.x + 1.2, 1.0, vPos.z + 1.2),
          });
        });
        break;
      }

      case 'OLD_CITY': {
        // Historic masonry pillars / arches along walkways
        const pillarPos = new THREE.Vector3(centerX + 10.0, 0, centerZ + 16);
        const pillarSize = new THREE.Vector3(1.4, 4.4, 1.4);
        biomeProps.push({
          id: `biome-pillar-${key}`,
          type: 'HISTORIC_PILLAR',
          position: pillarPos,
          rotationY: 0,
          size: pillarSize,
          color: '#334155',
          emissiveColor: '#fb923c',
        });
        collisionBoxes.push({
          min: new THREE.Vector3(pillarPos.x - pillarSize.x / 2, 0, pillarPos.z - pillarSize.z / 2),
          max: new THREE.Vector3(pillarPos.x + pillarSize.x / 2, pillarSize.y, pillarPos.z + pillarSize.z / 2),
        });
        break;
      }

      case 'SKY_DISTRICT': {
        // Aero-sensor weather mast
        const mastPos = new THREE.Vector3(centerX - 9.8, 0, centerZ - 18);
        const mastSize = new THREE.Vector3(0.8, 7.5, 0.8);
        biomeProps.push({
          id: `biome-mast-${key}`,
          type: 'AERO_MAST',
          position: mastPos,
          rotationY: 0,
          size: mastSize,
          color: '#0284c7',
          emissiveColor: '#38bdf8',
        });
        collisionBoxes.push({
          min: new THREE.Vector3(mastPos.x - 0.5, 0, mastPos.z - 0.5),
          max: new THREE.Vector3(mastPos.x + 0.5, mastSize.y, mastPos.z + 0.5),
        });
        break;
      }

      case 'CENTRAL_CITY':
      default: {
        // Smart city communication totem
        const totemPos = new THREE.Vector3(centerX + 9.8, 0, centerZ + 22);
        const totemSize = new THREE.Vector3(0.9, 4.0, 0.9);
        biomeProps.push({
          id: `biome-totem-${key}`,
          type: 'CITY_TOTEM',
          position: totemPos,
          rotationY: 0,
          size: totemSize,
          color: '#0e7490',
          emissiveColor: '#00f0ff',
        });
        collisionBoxes.push({
          min: new THREE.Vector3(totemPos.x - 0.5, 0, totemPos.z - 0.5),
          max: new THREE.Vector3(totemPos.x + 0.5, totemSize.y, totemPos.z + 0.5),
        });
        break;
      }
    }

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
