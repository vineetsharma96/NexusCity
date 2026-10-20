import * as THREE from 'three';
import { SeedRandom } from '../core/SeedRandom';
import { KinematicCollisionSolver, CollisionBox } from '../player/KinematicCollision';
import { FacadeStyleVariant } from '../core/ProceduralTextures';

export type BuildingArchetype =
  | 'HELIX_CITADEL'
  | 'DIAG_MONOLITH'
  | 'TERRACED_ARCOLOGY'
  | 'CANTILEVER_TOWER'
  | 'CORPORATE_SPIRE';

export type BuildingCrownType =
  | 'PYRAMID_LANTERN'
  | 'TWIN_FIN_CREST'
  | 'HALO_RING_CROWN'
  | 'SLANTED_BLADE';

export interface BuildingTier {
  offset: THREE.Vector3;
  size: THREE.Vector3;
}

export interface SkyLobbyFloor {
  y: number;
  width: number;
  depth: number;
  height: number;
}

export interface RooftopProp {
  type: 'ANTENNA' | 'HVAC' | 'COOLING_TOWER' | 'DISH' | 'HELIPAD' | 'SOLAR_ARRAY';
  position: THREE.Vector3;
  size: THREE.Vector3;
}

export interface LightStrip {
  position: THREE.Vector3;
  size: THREE.Vector3;
  color: string;
}

export interface BuildingDef {
  id: string;
  name: string;
  archetype: BuildingArchetype;
  facadeVariant: FacadeStyleVariant;
  crownType: BuildingCrownType;
  position: THREE.Vector3;
  totalSize: THREE.Vector3;
  tiers: BuildingTier[];
  skyLobbyFloors: SkyLobbyFloor[];
  rooftopEquipment: RooftopProp[];
  lightStrips: LightStrip[];
  storefrontColor: string;
  secondaryAccentColor: string;
  collisionBounds: CollisionBox[];
}

export interface StreetLightDef {
  position: THREE.Vector3;
  rotationY: number;
}

export interface RoadSegmentDef {
  position: THREE.Vector3;
  size: THREE.Vector3;
  rotationY: number;
}

export interface SkybridgeDef {
  id: string;
  position: THREE.Vector3;
  size: THREE.Vector3;
  rotationY: number;
  accentColor: string;
}

export interface CentralStreetPropDef {
  id: string;
  type: 'TRANSIT_SHELTER' | 'CYBER_KIOSK' | 'BENCH' | 'BOLLARD_CLUSTER' | 'STEAM_GRATE';
  position: THREE.Vector3;
  rotationY: number;
  accentColor: string;
}

export interface CityData {
  buildings: BuildingDef[];
  streetlights: StreetLightDef[];
  avenues: RoadSegmentDef[];
  sidewalks: { position: THREE.Vector3; size: THREE.Vector3 }[];
  skybridges: SkybridgeDef[];
  streetProps: CentralStreetPropDef[];
}

const ARCHETYPES: BuildingArchetype[] = [
  'HELIX_CITADEL',
  'DIAG_MONOLITH',
  'TERRACED_ARCOLOGY',
  'CANTILEVER_TOWER',
  'CORPORATE_SPIRE',
];

const FACADE_VARIANTS: FacadeStyleVariant[] = [
  'CURTAIN_GLASS',
  'DIAGRID_HEX',
  'BRUTALIST_RIBBED',
  'ARCOLOGY_TERRACE',
];

const CROWN_TYPES: BuildingCrownType[] = [
  'PYRAMID_LANTERN',
  'TWIN_FIN_CREST',
  'HALO_RING_CROWN',
  'SLANTED_BLADE',
];

export class CityGenerator {
  public static generateDistrict(seed: number = 847291): CityData {
    const rng = new SeedRandom(seed);
    KinematicCollisionSolver.clear();

    const buildings: BuildingDef[] = [];
    const streetlights: StreetLightDef[] = [];
    const avenues: RoadSegmentDef[] = [];
    const sidewalks: { position: THREE.Vector3; size: THREE.Vector3 }[] = [];
    const skybridges: SkybridgeDef[] = [];
    const streetProps: CentralStreetPropDef[] = [];

    // Primary Arterial Avenues (oriented along travel direction so lane textures never squash or Z-fight)
    avenues.push({
      position: new THREE.Vector3(0, 0.02, 0),
      size: new THREE.Vector3(14, 0.04, 360),
      rotationY: 0,
    });
    avenues.push({
      position: new THREE.Vector3(0, 0.018, 0),
      size: new THREE.Vector3(14, 0.04, 360),
      rotationY: Math.PI / 2,
    });
    avenues.push({
      position: new THREE.Vector3(0, 0.018, -75),
      size: new THREE.Vector3(12, 0.04, 360),
      rotationY: Math.PI / 2,
    });
    avenues.push({
      position: new THREE.Vector3(0, 0.018, 75),
      size: new THREE.Vector3(12, 0.04, 360),
      rotationY: Math.PI / 2,
    });

    const blockCenters: { x: number; z: number; w: number; d: number; name: string; minH: number; maxH: number }[] = [
      { x: -38, z: -38, w: 42, d: 42, name: 'Helix Data Citadel', minH: 68, maxH: 105 },
      { x: 38, z: -38, w: 42, d: 42, name: 'Twin Spire Skybridge', minH: 74, maxH: 115 },
      { x: -38, z: 38, w: 42, d: 42, name: 'Cyber-Synth Lounge', minH: 48, maxH: 82 },
      { x: 38, z: 38, w: 42, d: 42, name: 'Apex Monolith Tower', minH: 92, maxH: 132 },

      { x: -38, z: -115, w: 44, d: 48, name: 'North-West Arcology', minH: 52, maxH: 95 },
      { x: 38, z: -115, w: 44, d: 48, name: 'North-East Exchange', minH: 58, maxH: 98 },
      { x: -38, z: 115, w: 44, d: 48, name: 'South-West Terminal', minH: 45, maxH: 85 },
      { x: 38, z: 115, w: 44, d: 48, name: 'South-East Foundry', minH: 60, maxH: 102 },

      { x: -95, z: -38, w: 44, d: 42, name: 'West Neural Annex', minH: 50, maxH: 88 },
      { x: 95, z: -38, w: 44, d: 42, name: 'East Orbital Tower', minH: 62, maxH: 108 },
      { x: -95, z: 38, w: 44, d: 42, name: 'West Transit Hub', minH: 42, maxH: 76 },
      // Note: (75, 75) is dedicated to Central Park Sanctuary (bounds 39..111 in X and Z), so we keep it clear!
      { x: 136, z: 38, w: 36, d: 40, name: 'East Sanctuary Overlook', minH: 54, maxH: 92 },
    ];

    const neonPalette = ['#38bdf8', '#f59e0b', '#10b981', '#f43f5e', '#4a8ad6'];

    blockCenters.forEach((blk, idx) => {
      sidewalks.push({
        position: new THREE.Vector3(blk.x, 0.1, blk.z),
        size: new THREE.Vector3(blk.w + 8, 0.2, blk.d + 8),
      });

      const baseW = blk.w * rng.range(0.76, 0.9);
      const baseD = blk.d * rng.range(0.76, 0.9);
      const totalH = rng.range(blk.minH, blk.maxH);

      // Ensure no collision overlap with Park Sanctuary [39..111, 39..111]
      const minX = blk.x - baseW / 2;
      const maxX = blk.x + baseW / 2;
      const minZ = blk.z - baseD / 2;
      const maxZ = blk.z + baseD / 2;
      if (!(maxX <= 39 || minX >= 111 || maxZ <= 39 || minZ >= 111)) {
        return;
      }

      const archetype = ARCHETYPES[idx % ARCHETYPES.length];
      const facadeVariant = FACADE_VARIANTS[idx % FACADE_VARIANTS.length];
      const crownType = CROWN_TYPES[idx % CROWN_TYPES.length];
      const stripColor = neonPalette[idx % neonPalette.length];
      const secondaryColor = neonPalette[(idx + 2) % neonPalette.length];

      const tiers: BuildingTier[] = [];
      const skyLobbyFloors: SkyLobbyFloor[] = [];

      const h1 = totalH * rng.range(0.45, 0.58);
      tiers.push({
        offset: new THREE.Vector3(0, h1 / 2, 0),
        size: new THREE.Vector3(baseW, h1, baseD),
      });

      const w2 = baseW * rng.range(0.74, 0.84);
      const d2 = baseD * rng.range(0.74, 0.84);
      const h2 = (totalH - h1) * 0.62;
      tiers.push({
        offset: new THREE.Vector3(0, h1 + h2 / 2, 0),
        size: new THREE.Vector3(w2, h2, d2),
      });
      skyLobbyFloors.push({
        y: h1,
        width: w2 * 0.92,
        depth: d2 * 0.92,
        height: 3.2,
      });

      const w3 = w2 * rng.range(0.68, 0.78);
      const d3 = d2 * rng.range(0.68, 0.78);
      const h3 = totalH - h1 - h2;
      tiers.push({
        offset: new THREE.Vector3(0, h1 + h2 + h3 / 2, 0),
        size: new THREE.Vector3(w3, h3, d3),
      });
      skyLobbyFloors.push({
        y: h1 + h2,
        width: w3 * 0.92,
        depth: d3 * 0.92,
        height: 2.8,
      });

      const rooftopEquipment: RooftopProp[] = [
        {
          type: 'ANTENNA',
          position: new THREE.Vector3(0, totalH + 7, 0),
          size: new THREE.Vector3(0.45, 14, 0.45),
        },
        {
          type: idx % 2 === 0 ? 'COOLING_TOWER' : 'HVAC',
          position: new THREE.Vector3(w3 * 0.24, totalH + 1.2, d3 * 0.24),
          size: new THREE.Vector3(2.8, 2.4, 2.8),
        },
        {
          type: idx % 3 === 0 ? 'HELIPAD' : 'SOLAR_ARRAY',
          position: new THREE.Vector3(-w3 * 0.2, totalH + 0.25, -d3 * 0.2),
          size: new THREE.Vector3(w3 * 0.44, 0.35, d3 * 0.44),
        },
        {
          type: 'DISH',
          position: new THREE.Vector3(-w3 * 0.24, totalH + 1.4, d3 * 0.24),
          size: new THREE.Vector3(1.6, 2.2, 1.6),
        },
      ];

      const lightStrips: LightStrip[] = [
        // Tier 1 vertical center & intermediate facade light fins
        {
          position: new THREE.Vector3(baseW / 2 + 0.08, h1 / 2, 0),
          size: new THREE.Vector3(0.14, h1 * 0.9, 0.38),
          color: stripColor,
        },
        {
          position: new THREE.Vector3(-baseW / 2 - 0.08, h1 / 2, 0),
          size: new THREE.Vector3(0.14, h1 * 0.9, 0.38),
          color: stripColor,
        },
        {
          position: new THREE.Vector3(0, h1 / 2, baseD / 2 + 0.08),
          size: new THREE.Vector3(0.38, h1 * 0.9, 0.14),
          color: stripColor,
        },
        {
          position: new THREE.Vector3(0, h1 / 2, -baseD / 2 - 0.08),
          size: new THREE.Vector3(0.38, h1 * 0.9, 0.14),
          color: stripColor,
        },
        // Tier 2 vertical corner neon trace strips
        {
          position: new THREE.Vector3(w2 / 2 + 0.06, h1 + h2 / 2, d2 / 2 + 0.06),
          size: new THREE.Vector3(0.18, h2 * 0.92, 0.18),
          color: secondaryColor,
        },
        {
          position: new THREE.Vector3(-w2 / 2 - 0.06, h1 + h2 / 2, d2 / 2 + 0.06),
          size: new THREE.Vector3(0.18, h2 * 0.92, 0.18),
          color: secondaryColor,
        },
        {
          position: new THREE.Vector3(w2 / 2 + 0.06, h1 + h2 / 2, -d2 / 2 - 0.06),
          size: new THREE.Vector3(0.18, h2 * 0.92, 0.18),
          color: secondaryColor,
        },
        {
          position: new THREE.Vector3(-w2 / 2 - 0.06, h1 + h2 / 2, -d2 / 2 - 0.06),
          size: new THREE.Vector3(0.18, h2 * 0.92, 0.18),
          color: secondaryColor,
        },
        // Horizontal tier cornice & spandrel light bands
        {
          position: new THREE.Vector3(0, h1, 0),
          size: new THREE.Vector3(baseW + 0.35, 0.42, baseD + 0.35),
          color: stripColor,
        },
        {
          position: new THREE.Vector3(0, h1 + h2, 0),
          size: new THREE.Vector3(w2 + 0.3, 0.36, d2 + 0.3),
          color: secondaryColor,
        },
        {
          position: new THREE.Vector3(0, totalH, 0),
          size: new THREE.Vector3(w3 + 0.32, 0.45, d3 + 0.32),
          color: stripColor,
        },
      ];

      const bldgPos = new THREE.Vector3(blk.x, 0, blk.z);
      const bldgSize = new THREE.Vector3(baseW, totalH, baseD);
      const box = KinematicCollisionSolver.addBox(
        new THREE.Vector3(blk.x, totalH / 2, blk.z),
        bldgSize
      );

      buildings.push({
        id: `bldg_${idx}`,
        name: blk.name,
        archetype,
        facadeVariant,
        crownType,
        position: bldgPos,
        totalSize: bldgSize,
        tiers,
        skyLobbyFloors,
        rooftopEquipment,
        lightStrips,
        storefrontColor: stripColor,
        secondaryAccentColor: secondaryColor,
        collisionBounds: [box],
      });
    });

    // Elevated Glazed Skybridges connecting high-rise monoliths across avenues
    skybridges.push(
      {
        id: 'skybridge_north_core',
        position: new THREE.Vector3(0, 32, -38),
        size: new THREE.Vector3(46, 3.8, 5.2),
        rotationY: 0,
        accentColor: '#38bdf8',
      },
      {
        id: 'skybridge_west_core',
        position: new THREE.Vector3(-38, 28, 0),
        size: new THREE.Vector3(46, 3.6, 5.0),
        rotationY: Math.PI / 2,
        accentColor: '#f59e0b',
      },
      {
        id: 'skybridge_far_north',
        position: new THREE.Vector3(0, 36, -115),
        size: new THREE.Vector3(46, 3.8, 5.0),
        rotationY: 0,
        accentColor: '#10b981',
      }
    );

    // Streetscape Furniture & Sidewalk Props along Central Avenues
    const propCoords: {
      type: CentralStreetPropDef['type'];
      pos: [number, number, number];
      rot: number;
      accent: string;
    }[] = [
      { type: 'TRANSIT_SHELTER', pos: [-11.5, 0.2, -28], rot: Math.PI / 2, accent: '#38bdf8' },
      { type: 'TRANSIT_SHELTER', pos: [11.5, 0.2, 28], rot: -Math.PI / 2, accent: '#f59e0b' },
      { type: 'TRANSIT_SHELTER', pos: [-28, 0.2, -11.5], rot: 0, accent: '#10b981' },
      { type: 'CYBER_KIOSK', pos: [-12.5, 0.2, -16], rot: Math.PI / 4, accent: '#38bdf8' },
      { type: 'CYBER_KIOSK', pos: [12.5, 0.2, -16], rot: -Math.PI / 4, accent: '#f59e0b' },
      { type: 'CYBER_KIOSK', pos: [-12.5, 0.2, 16], rot: (3 * Math.PI) / 4, accent: '#f43f5e' },
      { type: 'BENCH', pos: [-11.2, 0.2, -36], rot: Math.PI / 2, accent: '#f59e0b' },
      { type: 'BENCH', pos: [11.2, 0.2, -36], rot: -Math.PI / 2, accent: '#38bdf8' },
      { type: 'BENCH', pos: [-11.2, 0.2, 36], rot: Math.PI / 2, accent: '#10b981' },
      { type: 'BOLLARD_CLUSTER', pos: [-9.5, 0.2, -14], rot: 0, accent: '#f59e0b' },
      { type: 'BOLLARD_CLUSTER', pos: [9.5, 0.2, -14], rot: 0, accent: '#f59e0b' },
      { type: 'BOLLARD_CLUSTER', pos: [-9.5, 0.2, 14], rot: 0, accent: '#38bdf8' },
      { type: 'BOLLARD_CLUSTER', pos: [9.5, 0.2, 14], rot: 0, accent: '#38bdf8' },
      { type: 'STEAM_GRATE', pos: [-5.2, 0.03, -22], rot: 0, accent: '#38bdf8' },
      { type: 'STEAM_GRATE', pos: [5.2, 0.03, 22], rot: 0, accent: '#f59e0b' },
    ];

    propCoords.forEach((p, idx) => {
      streetProps.push({
        id: `central_prop_${idx}`,
        type: p.type,
        position: new THREE.Vector3(...p.pos),
        rotationY: p.rot,
        accentColor: p.accent,
      });
    });

    for (let z = -150; z <= 150; z += 30) {
      if (Math.abs(z) < 12 || Math.abs(Math.abs(z) - 75) < 10) continue;
      streetlights.push({ position: new THREE.Vector3(-8.5, 0, z), rotationY: 0 });
      streetlights.push({ position: new THREE.Vector3(8.5, 0, z), rotationY: Math.PI });
    }

    for (let x = -150; x <= 150; x += 30) {
      if (Math.abs(x) < 12) continue;
      streetlights.push({ position: new THREE.Vector3(x, 0, -8.5), rotationY: -Math.PI / 2 });
      streetlights.push({ position: new THREE.Vector3(x, 0, 8.5), rotationY: Math.PI / 2 });
    }

    return { buildings, streetlights, avenues, sidewalks, skybridges, streetProps };
  }
}
