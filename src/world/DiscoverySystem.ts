import * as THREE from 'three';
import { SaveSystem } from '../core/SaveSystem';
import { AudioManager } from '../audio/AudioManager';

export interface LandmarkDiscoveryTrigger {
  id: string;
  name: string;
  subtitle: string;
  district: string;
  position: THREE.Vector3;
  radius: number;
}

export class DiscoverySystem {
  private static instance: DiscoverySystem;
  private triggers: LandmarkDiscoveryTrigger[] = [];
  private lastCheckPos: THREE.Vector3 = new THREE.Vector3(9999, 9999, 9999);

  private constructor() {
    this.initTriggers();
  }

  public static getInstance(): DiscoverySystem {
    if (!DiscoverySystem.instance) {
      DiscoverySystem.instance = new DiscoverySystem();
    }
    return DiscoverySystem.instance;
  }

  private initTriggers(): void {
    // 1. Major exterior city landmarks
    this.triggers.push(
      {
        id: 'central_plaza',
        name: 'Central Plaza Hub',
        subtitle: 'COMMERCIAL METROPOLITAN CORE',
        district: 'Central Plaza',
        position: new THREE.Vector3(0, 0, 0),
        radius: 35,
      },
      {
        id: 'twin_spires',
        name: 'Twin Spire Skybridge',
        subtitle: 'HIGH-ALTITUDE SKYWAY ARTERY',
        district: 'Sky District',
        position: new THREE.Vector3(-60, 40, 60),
        radius: 40,
      },
      {
        id: 'apex_tower',
        name: 'Apex Monolith Tower',
        subtitle: 'CORPORATE HEADQUARTERS & SKYSCRAPER SPIRE',
        district: 'Corporate Core',
        position: new THREE.Vector3(-60, 0, -60),
        radius: 45,
      },
      {
        id: 'park_sanctuary',
        name: 'Central Park Sanctuary',
        subtitle: 'BIOLUMINESCENT FLORA & POND OASIS',
        district: 'Green Sanctuary',
        position: new THREE.Vector3(75, 0, 75),
        radius: 50,
      },
      {
        id: 'north_crossway',
        name: 'North Crossing Avenue',
        subtitle: 'NORTH METROPOLITAN TRANSIT INTERSECTION',
        district: 'Downtown North',
        position: new THREE.Vector3(0, 0, -120),
        radius: 35,
      },
      {
        id: 'south_crossway',
        name: 'South Crossing Avenue',
        subtitle: 'SOUTH HIGH-SPEED TRAFFIC ARTERY',
        district: 'Industrial South',
        position: new THREE.Vector3(0, 0, 120),
        radius: 35,
      }
    );
  }

  public update(playerPos: THREE.Vector3): void {
    // Throttle checks to once every 2.5 meters of movement
    if (this.lastCheckPos.distanceToSquared(playerPos) < 6.25) {
      return;
    }
    this.lastCheckPos.copy(playerPos);

    const saveSystem = SaveSystem.getInstance();

    for (let i = 0; i < this.triggers.length; i++) {
      const trig = this.triggers[i];
      const dist = playerPos.distanceTo(trig.position);

      if (dist <= trig.radius) {
        const isNew = saveSystem.recordLandmarkDiscovery(trig.id, trig.name, 'LANDMARK');
        if (isNew) {
          // Play ascending procedural discovery arpeggio chime
          AudioManager.getInstance().playDiscovery();

          // Dispatch celebratory notification event
          window.dispatchEvent(
            new CustomEvent('nexus:notification', {
              detail: {
                title: `LOCATION DISCOVERED // ${trig.name.toUpperCase()}`,
                message: `${trig.subtitle} • Logged into Operative Codex.`,
                type: 'discovery',
                duration: 4500,
              },
            })
          );
        }
      }
    }
  }
}
