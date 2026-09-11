import * as THREE from 'three';

export type DistrictType =
  | 'CENTRAL_CITY'
  | 'NEURAL_DISTRICT'
  | 'SKY_DISTRICT'
  | 'INDUSTRIAL_DISTRICT'
  | 'OLD_CITY'
  | 'GREEN_DISTRICT'
  | 'UNKNOWN_DISTRICT';

export interface DistrictInfo {
  type: DistrictType;
  name: string;
  subtitle: string;
  description: string;
  accentColor: string;
  primaryLightColor: string;
  buildingHeightRange: [number, number];
  foliageDensity: number;
}

export const DISTRICT_PROFILES: Record<DistrictType, DistrictInfo> = {
  CENTRAL_CITY: {
    type: 'CENTRAL_CITY',
    name: 'CENTRAL METROPOLIS',
    subtitle: 'SECTOR 0 // CORE BOULEVARDS',
    description: 'Dense iconic skyscrapers, commercial avenues, and quantum power grids.',
    accentColor: '#00f0ff',
    primaryLightColor: '#00f0ff',
    buildingHeightRange: [45, 110],
    foliageDensity: 0.5,
  },
  NEURAL_DISTRICT: {
    type: 'NEURAL_DISTRICT',
    name: 'NEURAL DISTRICT',
    subtitle: 'SECTOR 1 // QUANTUM & AI LABS',
    description: 'Autonomous research facilities, data storage monoliths, and holographic research hubs.',
    accentColor: '#a855f7',
    primaryLightColor: '#8b5cf6',
    buildingHeightRange: [50, 130],
    foliageDensity: 0.3,
  },
  SKY_DISTRICT: {
    type: 'SKY_DISTRICT',
    name: 'SKY DISTRICT',
    subtitle: 'SECTOR 2 // AERIAL SPIRES',
    description: 'Ultra-tall needle spires reaching into the clouds with high-altitude skybridges.',
    accentColor: '#38bdf8',
    primaryLightColor: '#7dd3fc',
    buildingHeightRange: [120, 220],
    foliageDensity: 0.2,
  },
  INDUSTRIAL_DISTRICT: {
    type: 'INDUSTRIAL_DISTRICT',
    name: 'INDUSTRIAL REACTOR ZONE',
    subtitle: 'SECTOR 3 // HEAVY INFRASTRUCTURE',
    description: 'Factories, energy conduits, storage silos, and heavy machinery with hazard warning lights.',
    accentColor: '#ffaa00',
    primaryLightColor: '#f59e0b',
    buildingHeightRange: [25, 65],
    foliageDensity: 0.1,
  },
  OLD_CITY: {
    type: 'OLD_CITY',
    name: 'OLD METRO HISTORIC SECTOR',
    subtitle: 'SECTOR 4 // FOUNDATION QUARTERS',
    description: 'Lower architectural masonry buildings, narrow alleys, and historic warm lanterns.',
    accentColor: '#fb923c',
    primaryLightColor: '#fed7aa',
    buildingHeightRange: [16, 40],
    foliageDensity: 0.4,
  },
  GREEN_DISTRICT: {
    type: 'GREEN_DISTRICT',
    name: 'BIOSPHERE GREEN DISTRICT',
    subtitle: 'SECTOR 5 // URBAN ARBORETUM',
    description: 'Expansive public gardens, lush tree groves, water plazas, and pedestrian parkways.',
    accentColor: '#10b981',
    primaryLightColor: '#34d399',
    buildingHeightRange: [20, 55],
    foliageDensity: 1.0,
  },
  UNKNOWN_DISTRICT: {
    type: 'UNKNOWN_DISTRICT',
    name: 'UNKNOWN SECTOR // CLASSIFIED',
    subtitle: 'SECTOR 6 // ANOMALY ZONE',
    description: 'Dark obsidian monolithic structures, strange energy signatures, and discoverables.',
    accentColor: '#ff0055',
    primaryLightColor: '#f43f5e',
    buildingHeightRange: [40, 160],
    foliageDensity: 0.05,
  },
};

export class DistrictGenerator {
  /**
   * Deterministically resolves the active district based on world coordinates (x, z).
   */
  public static getDistrictAt(x: number, z: number): DistrictInfo {
    const distFromOrigin = Math.sqrt(x * x + z * z);

    // Central City within 130m of origin
    if (distFromOrigin < 130) {
      return DISTRICT_PROFILES.CENTRAL_CITY;
    }

    // Directional sectors in outer ring:
    // North (z < -130): Sky District
    if (z < -130 && Math.abs(x) < 180) {
      return DISTRICT_PROFILES.SKY_DISTRICT;
    }

    // East (x > 130): Neural District
    if (x > 130 && z >= -130 && z <= 130) {
      return DISTRICT_PROFILES.NEURAL_DISTRICT;
    }

    // West (x < -130): Industrial District
    if (x < -130 && z >= -130 && z <= 130) {
      return DISTRICT_PROFILES.INDUSTRIAL_DISTRICT;
    }

    // South-East (x > 100 && z > 130): Green District
    if (x > 80 && z > 130) {
      return DISTRICT_PROFILES.GREEN_DISTRICT;
    }

    // South-West (x < -80 && z > 130): Old City
    if (x < -80 && z > 130) {
      return DISTRICT_PROFILES.OLD_CITY;
    }

    // Far North-West / Outer fringes: Unknown District
    return DISTRICT_PROFILES.UNKNOWN_DISTRICT;
  }
}
