import { DistrictType } from '../city/DistrictGenerator';

export interface TransitStop {
  id: string;
  name: string;
  district: DistrictType;
  position: [number, number, number];
  dwellSeconds: number;
}

const STOPS: TransitStop[] = [
  { id: 'central-transit-node', name: 'Central Plaza Station', district: 'CENTRAL_CITY', position: [-7, 0.2, 10], dwellSeconds: 4 },
  { id: 'north-crossing-node', name: 'North Crossing Hub', district: 'CENTRAL_CITY', position: [-7, 0.2, -58], dwellSeconds: 3 },
  { id: 'neural-sector-node', name: 'Neural Quantum Station', district: 'NEURAL_DISTRICT', position: [-165, 0.2, -148], dwellSeconds: 4 },
  { id: 'aerostrata-sector-node', name: 'Aerostrata Spire Station', district: 'SKY_DISTRICT', position: [165, 0.2, -148], dwellSeconds: 4 },
  { id: 'east-sanctuary-node', name: 'Sanctuary West Gate', district: 'CENTRAL_CITY', position: [38, 0.2, 10], dwellSeconds: 4 },
  { id: 'arboretum-sector-node', name: 'Biosphere Arboretum Gate', district: 'GREEN_DISTRICT', position: [165, 0.2, 148], dwellSeconds: 4 },
  { id: 'solaris-foundry-node', name: 'Solaris Foundry Platform', district: 'INDUSTRIAL_DISTRICT', position: [-165, 0.2, 148], dwellSeconds: 4 },
  { id: 'south-arcade-node', name: 'Synth Lounge Platform', district: 'CENTRAL_CITY', position: [-38, 0.2, 10], dwellSeconds: 3 },
];

export class TransitScheduleSystem {
  private static instance: TransitScheduleSystem;

  public static getInstance(): TransitScheduleSystem {
    if (!TransitScheduleSystem.instance) {
      TransitScheduleSystem.instance = new TransitScheduleSystem();
    }
    return TransitScheduleSystem.instance;
  }

  public getStops(): TransitStop[] {
    return STOPS;
  }

  public getNextStop(elapsedSeconds: number): { stop: TransitStop; arrivalInSeconds: number } {
    const cycle = 44;
    const slot = ((elapsedSeconds % cycle) + cycle) % cycle;
    const leg = cycle / STOPS.length;
    const idx = Math.floor(slot / leg) % STOPS.length;
    return {
      stop: STOPS[idx],
      arrivalInSeconds: Math.max(1, Math.ceil((idx + 1) * leg - slot)),
    };
  }
}
