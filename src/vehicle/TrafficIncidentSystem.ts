import * as THREE from 'three';

export interface TrafficIncident {
  id: string;
  position: THREE.Vector3;
  axis: 'x' | 'z';
  laneCenter: number;
  radius: number;
  blocked: boolean;
  damageSeed: number;
}

/** Deterministic incident data shared by traffic visuals and vehicle systems. */
export class TrafficIncidentSystem {
  private static instance: TrafficIncidentSystem;
  private readonly incidents: TrafficIncident[] = [
    { id: 'central-west-pileup', position: new THREE.Vector3(-22, 0.35, 4.5), axis: 'x', laneCenter: 4.5, radius: 10, blocked: true, damageSeed: 0.35 },
    { id: 'north-service-impact', position: new THREE.Vector3(-4.5, 0.35, 28), axis: 'z', laneCenter: -4.5, radius: 8, blocked: true, damageSeed: 0.7 },
  ];

  public static getInstance(): TrafficIncidentSystem {
    if (!TrafficIncidentSystem.instance) TrafficIncidentSystem.instance = new TrafficIncidentSystem();
    return TrafficIncidentSystem.instance;
  }

  public getIncidents(): readonly TrafficIncident[] { return this.incidents; }

  public isLaneBlocked(axis: 'x' | 'z', laneCenter: number, coordinate: number): boolean {
    return this.incidents.some((incident) => incident.blocked && incident.axis === axis &&
      Math.abs(incident.laneCenter - laneCenter) < 1.8 && Math.abs(coordinate - (axis === 'x' ? incident.position.x : incident.position.z)) < incident.radius);
  }
}
