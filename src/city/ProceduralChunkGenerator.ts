import * as THREE from 'three';
import { SeedRandom } from '../core/SeedRandom';
import { DistrictGenerator, DistrictInfo } from './DistrictGenerator';
import { CollisionBox } from '../player/KinematicCollision';

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

export interface StreamedChunkData {
  key: string;
  cx: number;
  cz: number;
  center: THREE.Vector3;
  district: DistrictInfo;
  roads: { position: THREE.Vector3; size: THREE.Vector3; rotationY: number }[];
  sidewalks: { position: THREE.Vector3; size: THREE.Vector3 }[];
  buildings: StreamedBuildingDef[];
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
        collisionBoxes,
      };
      this.cache.set(key, emptyChunk);
      return emptyChunk;
    }

    // 1. Generate Connecting Road Infrastructure
    // North-South local avenue if aligned with avenues
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
    const subSize = (half - roadWidth / 2) - 4; // Width of building plot

    const quadrantOffsets = [
      { qx: -half / 2 - roadWidth / 4, qz: -half / 2 - roadWidth / 4 }, // NW
      { qx: half / 2 + roadWidth / 4, qz: -half / 2 - roadWidth / 4 },  // NE
      { qx: -half / 2 - roadWidth / 4, qz: half / 2 + roadWidth / 4 },  // SW
      { qx: half / 2 + roadWidth / 4, qz: half / 2 + roadWidth / 4 },   // SE
    ];

    quadrantOffsets.forEach((q, qIdx) => {
      const lotCenterX = centerX + q.qx;
      const lotCenterZ = centerZ + q.qz;

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

    const chunkData: StreamedChunkData = {
      key,
      cx,
      cz,
      center,
      district,
      roads,
      sidewalks,
      buildings,
      collisionBoxes,
    };

    this.cache.set(key, chunkData);
    return chunkData;
  }
}
