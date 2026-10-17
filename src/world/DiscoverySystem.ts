import * as THREE from 'three';
import { SaveSystem } from '../core/SaveSystem';
import { AudioManager } from '../audio/AudioManager';
import { WeatherSystem, WeatherType } from './WeatherSystem';
import { TimeSystem } from './TimeSystem';
import { NavigationSystem } from '../map/NavigationSystem';

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
    // Discovery, navigation and wayfinding must refer to the same locations.
    const landmarks = NavigationSystem.getInstance().landmarks;
    this.triggers.forEach((trigger) => {
      const landmark = landmarks.find((entry) => entry.id === trigger.id);
      if (landmark) trigger.position.copy(landmark.position);
    });
  }

  public update(playerPos: THREE.Vector3): void {
    // Throttle checks to once every 2.5 meters of movement
    if (this.lastCheckPos.distanceToSquared(playerPos) < 6.25) {
      return;
    }
    this.lastCheckPos.copy(playerPos);

    const weather = WeatherSystem.getInstance().getState().currentWeather;
    const time = TimeSystem.getInstance().getState();

    for (let i = 0; i < this.triggers.length; i++) {
      const trig = this.triggers[i];
      const dist = playerPos.distanceTo(trig.position);

      if (dist <= trig.radius) {
        this.recordDiscovery(trig.id, trig.name, trig.subtitle, trig.district, {
          weather,
          timePhase: time.phase,
        });
      }
    }
  }

  /** Records a world discovery through the same save, audio, and notification path. */
  public recordDiscovery(
    id: string,
    name: string,
    subtitle: string,
    district: string,
    context?: { weather: WeatherType; timePhase: string }
  ): boolean {
    const saveSystem = SaveSystem.getInstance();
    const weather = context?.weather ?? WeatherSystem.getInstance().getState().currentWeather;
    const time = TimeSystem.getInstance().getState();
    const isNew = saveSystem.recordLandmarkDiscovery(id, name, 'LANDMARK', {
      weather,
      timePhase: context?.timePhase ?? time.phase,
    });

    if (isNew && typeof window !== 'undefined') {
      AudioManager.getInstance().playDiscovery();
      window.dispatchEvent(
        new CustomEvent('nexus:notification', {
          detail: {
            title: `LOCATION DISCOVERED // ${name.toUpperCase()}`,
            message: `${subtitle} • ${district.toUpperCase()} logged into Operative Codex.`,
            type: 'discovery',
            duration: 4500,
          },
        })
      );
    }
    return isNew;
  }
}
