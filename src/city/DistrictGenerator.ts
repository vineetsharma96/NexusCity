export type DistrictType =
  | 'CENTRAL_CITY'
  | 'NEURAL_DISTRICT'
  | 'GREEN_DISTRICT'
  | 'INDUSTRIAL_DISTRICT'
  | 'OLD_CITY'
  | 'SKY_DISTRICT';

export interface DistrictInfo {
  type: DistrictType;
  name: string;
  subtitle: string;
  description: string;
  primaryLightColor: string;
  secondaryLightColor: string;
  accentColor: string;
  fogColor: string;
  fogDensity: number;
  foliageDensity: number;
  buildingHeightRange: [number, number];
}

export const DISTRICTS: Record<DistrictType, DistrictInfo> = {
  CENTRAL_CITY: {
    type: 'CENTRAL_CITY',
    name: 'CENTRAL CIVIC CORE',
    subtitle: 'METROPOLITAN FINANCIAL & TRANSIT AXIS',
    description: 'High-density titanium spires, civic plazas, and multi-channel holographic matrices.',
    primaryLightColor: '#38bdf8',
    secondaryLightColor: '#f59e0b',
    accentColor: '#38bdf8',
    fogColor: '#070b14',
    fogDensity: 1.0,
    foliageDensity: 0.45,
    buildingHeightRange: [45, 130],
  },
  NEURAL_DISTRICT: {
    type: 'NEURAL_DISTRICT',
    name: 'NEURAL QUANTUM SECTOR',
    subtitle: 'AI COMPUTE & OPTICAL TELEMETRY GRID',
    description: 'Ultra-clean monolithic server citadels, fiber conduits, and cobalt-cyan light bands.',
    primaryLightColor: '#4a8ad6',
    secondaryLightColor: '#38bdf8',
    accentColor: '#4a8ad6',
    fogColor: '#070d18',
    fogDensity: 0.95,
    foliageDensity: 0.2,
    buildingHeightRange: [65, 155],
  },
  GREEN_DISTRICT: {
    type: 'GREEN_DISTRICT',
    name: 'BIOSPHERE ARBORETUM',
    subtitle: 'ECOLOGICAL SANCTUARY & BOTANICAL TERRACES',
    description: 'Bioluminescent water basins, terraced sky-gardens, and lush botanical reserves.',
    primaryLightColor: '#10b981',
    secondaryLightColor: '#38bdf8',
    accentColor: '#10b981',
    fogColor: '#04120e',
    fogDensity: 1.08,
    foliageDensity: 0.95,
    buildingHeightRange: [28, 76],
  },
  INDUSTRIAL_DISTRICT: {
    type: 'INDUSTRIAL_DISTRICT',
    name: 'SOLARIS FOUNDRY SECTOR',
    subtitle: 'HEAVY MANUFACTURING & ENERGY SUBSTATIONS',
    description: 'Thermal reactor silos, overhead pipeline gantries, and warm sodium-amber illumination.',
    primaryLightColor: '#f59e0b',
    secondaryLightColor: '#ef4444',
    accentColor: '#f59e0b',
    fogColor: '#120b05',
    fogDensity: 0.85,
    foliageDensity: 0.1,
    buildingHeightRange: [30, 82],
  },
  OLD_CITY: {
    type: 'OLD_CITY',
    name: 'HERITAGE QUARTER',
    subtitle: 'FOUNDATION MASONRY & LOW-RISE ARCADES',
    description: 'Preserved mid-century stone colonnades retrofitted with warm brass and optic conduits.',
    primaryLightColor: '#fb923c',
    secondaryLightColor: '#fcd34d',
    accentColor: '#fb923c',
    fogColor: '#100c08',
    fogDensity: 0.95,
    foliageDensity: 0.5,
    buildingHeightRange: [22, 58],
  },
  SKY_DISTRICT: {
    type: 'SKY_DISTRICT',
    name: 'AEROSTRATA SPIRES',
    subtitle: 'HIGH-ALTITUDE AVIATION & SKYBRIDGE TOWERS',
    description: 'Slender aerodynamic needles, atmospheric sensor masts, and upper-level transit decks.',
    primaryLightColor: '#38bdf8',
    secondaryLightColor: '#e0f2fe',
    accentColor: '#7dd3fc',
    fogColor: '#060d1a',
    fogDensity: 1.15,
    foliageDensity: 0.3,
    buildingHeightRange: [80, 175],
  },
};

export class DistrictGenerator {
  public static getDistrictAt(x: number, z: number): DistrictInfo {
    const dist = Math.hypot(x, z);
    if (dist < 165) return DISTRICTS.CENTRAL_CITY;

    const angle = Math.atan2(z, x);
    if (angle >= -Math.PI && angle < -Math.PI / 3) return DISTRICTS.NEURAL_DISTRICT;
    if (angle >= -Math.PI / 3 && angle < Math.PI / 6) return DISTRICTS.SKY_DISTRICT;
    if (angle >= Math.PI / 6 && angle < (2 * Math.PI) / 3) return DISTRICTS.GREEN_DISTRICT;
    if (dist > 420 && angle >= (2 * Math.PI) / 3) return DISTRICTS.OLD_CITY;
    return DISTRICTS.INDUSTRIAL_DISTRICT;
  }

  public static getAllDistricts(): DistrictInfo[] {
    return Object.values(DISTRICTS);
  }
}
