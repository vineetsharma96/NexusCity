import * as THREE from 'three';
import { AudioManager } from '../audio/AudioManager';
import { SaveSystem } from '../core/SaveSystem';
import { NavigationSystem } from '../map/NavigationSystem';

export interface DiscoveryTrigger {
  id: string;
  name: string;
  category: 'LANDMARK' | 'SANCTUARY' | 'SKYBRIDGE' | 'PLAZA';
  position: THREE.Vector3;
  radius: number;
  loreSnippet: string;
}

export class DiscoverySystem {
  private static instance: DiscoverySystem;

  public readonly triggers: DiscoveryTrigger[] = NavigationSystem.getInstance().landmarks.map((landmark) => ({
    id: landmark.id,
    name: landmark.name,
    category:
      landmark.id === 'park_sanctuary'
        ? 'SANCTUARY'
        : landmark.id === 'twin_spires'
        ? 'SKYBRIDGE'
        : landmark.category === 'PLAZA'
        ? 'PLAZA'
        : 'LANDMARK',
    position: landmark.position.clone(),
    radius: landmark.id === 'park_sanctuary' ? 32 : landmark.category === 'PLAZA' ? 22 : 24,
    loreSnippet: landmark.description,
  }));

  private constructor() {}

  public static getInstance(): DiscoverySystem {
    if (!DiscoverySystem.instance) {
      DiscoverySystem.instance = new DiscoverySystem();
    }
    return DiscoverySystem.instance;
  }

  public update(playerPos: THREE.Vector3): void {
    const save = SaveSystem.getInstance();
    for (const trig of this.triggers) {
      const dist = Math.hypot(playerPos.x - trig.position.x, playerPos.z - trig.position.z);
      if (dist <= trig.radius) {
        const isNew = save.discoverLandmark(trig.id, trig.name, trig.category);
        if (isNew) {
          AudioManager.getInstance().playDiscoveryChime();
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('nexus:notification', {
                detail: {
                  title: `LOCATION LOGGED // ${trig.name.toUpperCase()}`,
                  message: trig.loreSnippet,
                  type: 'discovery',
                  duration: 4200,
                },
              })
            );
          }
        }
      }
    }
  }
}
