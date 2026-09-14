import * as THREE from 'three';
import { InteriorType } from './InteriorManager';

export interface InteriorDestination {
  buildingId: string;
  interiorId: InteriorType;
  name: string;
  district: string;
  category: string;
  entrancePosition: THREE.Vector3;
  entranceRotationY: number;
  interactionPosition: THREE.Vector3;
  exitPosition: THREE.Vector3;
  interiorSpawnPoint: THREE.Vector3;
  interiorChunkId: string;
  description: string;
  accentColor: string;
  icon: string;
}

// Interior room origin at y = -80.0m
export const INTERIOR_BASE_Y = -80.0;

export const INTERIOR_DESTINATIONS: Record<string, InteriorDestination> = {
  nexus_labs: {
    buildingId: 'bldg-nexus-labs',
    interiorId: 'LAB',
    name: 'Nexus Advanced Labs',
    district: 'Central Metropolis',
    category: 'RESEARCH',
    entrancePosition: new THREE.Vector3(21.0, 0.18, 32.0),
    entranceRotationY: -Math.PI / 2, // Facing West toward Central Avenue
    interactionPosition: new THREE.Vector3(19.2, 0.18, 32.0),
    exitPosition: new THREE.Vector3(19.0, 0.18, 32.0),
    interiorSpawnPoint: new THREE.Vector3(0, INTERIOR_BASE_Y + 0.2, 5.5),
    interiorChunkId: 'chunk_int_lab',
    description: 'Quantum stabilizer core, supercomputer mainframes, and holographic diagnostics.',
    accentColor: '#00f0ff',
    icon: '🧪',
  },
  cyber_lounge: {
    buildingId: 'bldg-cyber-lounge',
    interiorId: 'LOUNGE',
    name: 'Neon Velocity Lounge',
    district: 'West Night District',
    category: 'ENTERTAINMENT',
    entrancePosition: new THREE.Vector3(-21.0, 0.18, 32.0),
    entranceRotationY: Math.PI / 2, // Facing East toward Central Avenue
    interactionPosition: new THREE.Vector3(-19.2, 0.18, 32.0),
    exitPosition: new THREE.Vector3(-19.0, 0.18, 32.0),
    interiorSpawnPoint: new THREE.Vector3(0, INTERIOR_BASE_Y + 0.2, 5.5),
    interiorChunkId: 'chunk_int_lounge',
    description: 'Curved synth-bar counter, neon cocktails, VIP booths, and high-energy music.',
    accentColor: '#ec4899',
    icon: '🍸',
  },
  ripperdoc_clinic: {
    buildingId: 'bldg-ripperdoc-clinic',
    interiorId: 'CLINIC',
    name: 'Krom-Doc Augmentation Clinic',
    district: 'Medical Alley',
    category: 'CYBERWARE',
    entrancePosition: new THREE.Vector3(-21.0, 0.18, -32.0),
    entranceRotationY: Math.PI / 2, // Facing East toward Central Avenue
    interactionPosition: new THREE.Vector3(-19.2, 0.18, -32.0),
    exitPosition: new THREE.Vector3(-19.0, 0.18, -32.0),
    interiorSpawnPoint: new THREE.Vector3(0, INTERIOR_BASE_Y + 0.2, 5.5),
    interiorChunkId: 'chunk_int_clinic',
    description: 'Cybernetic operating table, neural diagnostics, prosthetic limb display cases.',
    accentColor: '#06b6d4',
    icon: '💉',
  },
  netrunner_den: {
    buildingId: 'bldg-netrunner-den',
    interiorId: 'NETRUNNER_DEN',
    name: 'Black-Ice Hacker Safehouse',
    district: 'Neural Undergrid',
    category: 'UNDERGROUND',
    entrancePosition: new THREE.Vector3(21.0, 0.18, -32.0),
    entranceRotationY: -Math.PI / 2, // Facing West toward Central Avenue
    interactionPosition: new THREE.Vector3(19.2, 0.18, -32.0),
    exitPosition: new THREE.Vector3(19.0, 0.18, -32.0),
    interiorSpawnPoint: new THREE.Vector3(0, INTERIOR_BASE_Y + 0.2, 5.5),
    interiorChunkId: 'chunk_int_netrunner',
    description: 'Matrix terminal racks, cooling tubes, green phosphor monitors, floor cable conduits.',
    accentColor: '#10b981',
    icon: '💻',
  },
  ramen_diner: {
    buildingId: 'bldg-ramen-diner',
    interiorId: 'RAMEN_DINER',
    name: 'Tokyo-Neo Synth-Ramen',
    district: 'East Food Bazaar',
    category: 'DINING',
    entrancePosition: new THREE.Vector3(36.0, 0.18, 18.0),
    entranceRotationY: Math.PI, // Facing North toward East-West Blvd
    interactionPosition: new THREE.Vector3(36.0, 0.18, 16.2),
    exitPosition: new THREE.Vector3(36.0, 0.18, 16.0),
    interiorSpawnPoint: new THREE.Vector3(0, INTERIOR_BASE_Y + 0.2, 5.5),
    interiorChunkId: 'chunk_int_ramen',
    description: 'L-shaped wooden noodle counter, steaming synthetic broth vats, red paper lanterns.',
    accentColor: '#f59e0b',
    icon: '🍜',
  },
  drone_hangar: {
    buildingId: 'bldg-drone-hangar',
    interiorId: 'DRONE_HANGAR',
    name: 'Aero-Cargo Drone Bay',
    district: 'Industrial Harbor',
    category: 'INDUSTRIAL',
    entrancePosition: new THREE.Vector3(36.0, 0.18, -18.0),
    entranceRotationY: 0, // Facing South toward East-West Blvd
    interactionPosition: new THREE.Vector3(36.0, 0.18, -16.2),
    exitPosition: new THREE.Vector3(36.0, 0.18, -16.0),
    interiorSpawnPoint: new THREE.Vector3(0, INTERIOR_BASE_Y + 0.2, 5.5),
    interiorChunkId: 'chunk_int_hangar',
    description: 'Hydraulic drone repair hoist, cargo crates, overhead gantry rails, welding tool racks.',
    accentColor: '#f97316',
    icon: '🛸',
  },
  sky_penthouse: {
    buildingId: 'bldg-sky-penthouse',
    interiorId: 'PENTHOUSE',
    name: 'Apex Sky Suite Penthouse',
    district: 'Sky Spire Towers',
    category: 'RESIDENTIAL',
    entrancePosition: new THREE.Vector3(-36.0, 0.18, 18.0),
    entranceRotationY: Math.PI, // Facing North toward East-West Blvd
    interactionPosition: new THREE.Vector3(-36.0, 0.18, 16.2),
    exitPosition: new THREE.Vector3(-36.0, 0.18, 16.0),
    interiorSpawnPoint: new THREE.Vector3(0, INTERIOR_BASE_Y + 0.2, 5.5),
    interiorChunkId: 'chunk_int_penthouse',
    description: 'Floor-to-ceiling panoramic glass, minimalist luxury sofa, glass coffee table, skyline vistas.',
    accentColor: '#38bdf8',
    icon: '🏙️',
  },
  server_vault: {
    buildingId: 'bldg-server-vault',
    interiorId: 'SERVER_VAULT',
    name: 'Megacorp Secure Data Vault',
    district: 'Corporate Core',
    category: 'SECURITY',
    entrancePosition: new THREE.Vector3(-36.0, 0.18, -18.0),
    entranceRotationY: 0, // Facing South toward East-West Blvd
    interactionPosition: new THREE.Vector3(-36.0, 0.18, -16.2),
    exitPosition: new THREE.Vector3(-36.0, 0.18, -16.0),
    interiorSpawnPoint: new THREE.Vector3(0, INTERIOR_BASE_Y + 0.2, 5.5),
    interiorChunkId: 'chunk_int_vault',
    description: 'Hexagonal optical storage pillar, rotating crimson security beams, chilled floor vents.',
    accentColor: '#3b82f6',
    icon: '🔒',
  },
  biosphere_greenhouse: {
    buildingId: 'bldg-biosphere-greenhouse',
    interiorId: 'GREENHOUSE',
    name: 'Biosphere Hydroponic Flora Lab',
    district: 'Biosphere District',
    category: 'SANCTUARY',
    entrancePosition: new THREE.Vector3(48.0, 0.18, 48.0),
    entranceRotationY: -Math.PI / 2, // Facing West into Sanctuary Promenade
    interactionPosition: new THREE.Vector3(46.2, 0.18, 48.0),
    exitPosition: new THREE.Vector3(46.0, 0.18, 48.0),
    interiorSpawnPoint: new THREE.Vector3(0, INTERIOR_BASE_Y + 0.2, 5.5),
    interiorChunkId: 'chunk_int_greenhouse',
    description: 'Tiered vertical hydroponics, violet UV photosynthesis lamps, bubbling nutrient feeds.',
    accentColor: '#22c55e',
    icon: '🌿',
  },
  metro_station: {
    buildingId: 'bldg-metro-station',
    interiorId: 'METRO_STATION',
    name: 'Hyperloop Metro Transit Hub',
    district: 'Subterranean Rail',
    category: 'TRANSIT',
    entrancePosition: new THREE.Vector3(10.0, 0.18, -14.0),
    entranceRotationY: 0, // Facing South into Central Plaza
    interactionPosition: new THREE.Vector3(10.0, 0.18, -12.2),
    exitPosition: new THREE.Vector3(10.0, 0.18, -12.0),
    interiorSpawnPoint: new THREE.Vector3(0, INTERIOR_BASE_Y + 0.2, 5.5),
    interiorChunkId: 'chunk_int_metro',
    description: 'Subterranean high-speed train platform, warning tiles, illuminated transit arrival timetable.',
    accentColor: '#fbbf24',
    icon: '🚇',
  },
  cyber_arcade: {
    buildingId: 'bldg-cyber-arcade',
    interiorId: 'ARCADE',
    name: 'Cyber-Strike 2099 Retro Arcade',
    district: 'South Entertainment Grid',
    category: 'ENTERTAINMENT',
    entrancePosition: new THREE.Vector3(-10.0, 0.18, 14.0),
    entranceRotationY: Math.PI, // Facing North into Central Plaza
    interactionPosition: new THREE.Vector3(-10.0, 0.18, 12.2),
    exitPosition: new THREE.Vector3(-10.0, 0.18, 12.0),
    interiorSpawnPoint: new THREE.Vector3(0, INTERIOR_BASE_Y + 0.2, 5.5),
    interiorChunkId: 'chunk_int_arcade',
    description: 'Rows of CRT pixel-art arcade cabinets, rhythm dance floor, neon prize counter.',
    accentColor: '#d946ef',
    icon: '🕹️',
  },
};

/**
 * Validation & Assertion utilities
 */
export function validateInteriorDestination(destId: string): { valid: boolean; error?: string; destination?: InteriorDestination } {
  const dest = INTERIOR_DESTINATIONS[destId];
  if (!dest) {
    return { valid: false, error: `Destination ID '${destId}' is not registered in INTERIOR_DESTINATIONS.` };
  }
  if (!dest.interiorSpawnPoint || typeof dest.interiorSpawnPoint.x !== 'number') {
    return { valid: false, error: `Destination '${destId}' is missing a valid interiorSpawnPoint.` };
  }
  if (!dest.exitPosition || typeof dest.exitPosition.x !== 'number') {
    return { valid: false, error: `Destination '${destId}' is missing a valid exitPosition.` };
  }
  if (!dest.interactionPosition || typeof dest.interactionPosition.x !== 'number') {
    return { valid: false, error: `Destination '${destId}' is missing a valid interactionPosition.` };
  }
  if (!dest.interiorChunkId) {
    return { valid: false, error: `Destination '${destId}' is missing interiorChunkId identifier.` };
  }
  return { valid: true, destination: dest };
}

export function getDestinationByInteriorType(type: InteriorType): InteriorDestination | undefined {
  return Object.values(INTERIOR_DESTINATIONS).find((d) => d.interiorId === type);
}

/**
 * Automatic Portal Accessibility & Collision Validator
 */
export function validateAllPortals(): { passed: number; failed: number; reports: string[] } {
  let passed = 0;
  let failed = 0;
  const reports: string[] = [];

  Object.entries(INTERIOR_DESTINATIONS).forEach(([id, dest]) => {
    const val = validateInteriorDestination(id);
    if (!val.valid) {
      failed++;
      reports.push(`[PortalValidator] ✗ '${id}' FAILED: ${val.error}`);
      return;
    }

    // Check interaction point is above ground
    if (dest.interactionPosition.y < 0.1) {
      failed++;
      reports.push(`[PortalValidator] ✗ '${id}' FAILED: Interaction point below sidewalk (${dest.interactionPosition.y})`);
      return;
    }

    // Check exit point is above ground
    if (dest.exitPosition.y < 0.1) {
      failed++;
      reports.push(`[PortalValidator] ✗ '${id}' FAILED: Exit point below sidewalk (${dest.exitPosition.y})`);
      return;
    }

    // Check interior spawn is deep below city
    if (dest.interiorSpawnPoint.y > -50) {
      failed++;
      reports.push(`[PortalValidator] ✗ '${id}' FAILED: Interior spawn point (${dest.interiorSpawnPoint.y}) not in interior coordinate space`);
      return;
    }

    passed++;
    reports.push(`[PortalValidator] ✓ '${id}' [${dest.name}] OK (entrance=${dest.entrancePosition.x},${dest.entrancePosition.z} rot=${(dest.entranceRotationY * 180 / Math.PI).toFixed(0)}°)`);
  });

  return { passed, failed, reports };
}
