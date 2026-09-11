import * as THREE from 'three';
import { SeedRandom } from '../core/SeedRandom';

export type BuildingArchetype = 'MONOLITH' | 'STEPPED' | 'CANTILEVER' | 'TWIN_TOWER';

export interface BuildingTier {
  offset: THREE.Vector3;
  size: THREE.Vector3;
}

export interface BuildingLightStrip {
  position: THREE.Vector3;
  size: THREE.Vector3;
  color: string;
}

export interface BuildingRooftopEquipment {
  position: THREE.Vector3;
  size: THREE.Vector3;
  type: 'HVAC' | 'ANTENNA' | 'ELEVATOR_CORE' | 'DISH';
}

export interface BuildingDef {
  id: string;
  archetype: BuildingArchetype;
  position: THREE.Vector3;
  totalSize: THREE.Vector3;
  tiers: BuildingTier[];
  lightStrips: BuildingLightStrip[];
  rooftopEquipment: BuildingRooftopEquipment[];
  storefrontColor: string;
  collisionBounds: THREE.Box3[];
}

export class BuildingGenerator {
  /**
   * Generates a procedurally parameterized building within the given lot boundary.
   */
  public static generateBuilding(
    id: string,
    lotCenter: THREE.Vector3,
    lotWidth: number,
    lotDepth: number,
    rng: SeedRandom
  ): BuildingDef {
    // Determine archetype
    const archetypes: BuildingArchetype[] = ['MONOLITH', 'STEPPED', 'CANTILEVER', 'TWIN_TOWER'];
    const archetype = rng.pick(archetypes);

    // Setback lot margins (building uses 75% - 90% of lot footprint)
    const margin = rng.range(2.0, 4.0);
    const baseW = Math.max(12, lotWidth - margin * 2);
    const baseD = Math.max(12, lotDepth - margin * 2);

    // Height variation (35m to 115m)
    const height = rng.range(38, 115);

    const tiers: BuildingTier[] = [];
    const lightStrips: BuildingLightStrip[] = [];
    const rooftopEquipment: BuildingRooftopEquipment[] = [];
    const collisionBounds: THREE.Box3[] = [];

    const accentColors = ['#00f0ff', '#00ffaa', '#ffaa00', '#ff0077'];
    const neonColor = rng.pick(accentColors);

    if (archetype === 'MONOLITH') {
      // Single continuous skyscraper with crowned roof
      const mainH = height;
      tiers.push({
        offset: new THREE.Vector3(0, mainH / 2, 0),
        size: new THREE.Vector3(baseW, mainH, baseD),
      });

      // Rooftop mechanical penthouse
      const pentW = baseW * 0.6;
      const pentD = baseD * 0.6;
      const pentH = rng.range(6, 12);
      tiers.push({
        offset: new THREE.Vector3(0, mainH + pentH / 2, 0),
        size: new THREE.Vector3(pentW, pentH, pentD),
      });

      // Corner light strips
      lightStrips.push({
        position: new THREE.Vector3(baseW / 2 + 0.05, mainH / 2, baseD / 2 + 0.05),
        size: new THREE.Vector3(0.18, mainH, 0.18),
        color: neonColor,
      });
      lightStrips.push({
        position: new THREE.Vector3(-baseW / 2 - 0.05, mainH / 2, -baseD / 2 - 0.05),
        size: new THREE.Vector3(0.18, mainH, 0.18),
        color: neonColor,
      });

      // Antenna mast
      rooftopEquipment.push({
        position: new THREE.Vector3(0, mainH + pentH + 8, 0),
        size: new THREE.Vector3(0.4, 16, 0.4),
        type: 'ANTENNA',
      });

      // Collision box for whole monolith
      collisionBounds.push(
        new THREE.Box3(
          new THREE.Vector3(lotCenter.x - baseW / 2, 0, lotCenter.z - baseD / 2),
          new THREE.Vector3(lotCenter.x + baseW / 2, mainH, lotCenter.z + baseD / 2)
        )
      );
    } else if (archetype === 'STEPPED') {
      // 3-tiered ziggurat skyscraper
      const numTiers = rng.int(2, 4);
      let currentY = 0;
      let currentW = baseW;
      let currentD = baseD;
      const tierH = height / numTiers;

      for (let i = 0; i < numTiers; i++) {
        tiers.push({
          offset: new THREE.Vector3(0, currentY + tierH / 2, 0),
          size: new THREE.Vector3(currentW, tierH, currentD),
        });

        // Parapet edge neon strip
        lightStrips.push({
          position: new THREE.Vector3(0, currentY + tierH, currentD / 2 + 0.05),
          size: new THREE.Vector3(currentW, 0.25, 0.1),
          color: neonColor,
        });

        collisionBounds.push(
          new THREE.Box3(
            new THREE.Vector3(lotCenter.x - currentW / 2, currentY, lotCenter.z - currentD / 2),
            new THREE.Vector3(lotCenter.x + currentW / 2, currentY + tierH, lotCenter.z + currentD / 2)
          )
        );

        currentY += tierH;
        currentW *= 0.78;
        currentD *= 0.78;
      }

      // Top HVAC equipment
      rooftopEquipment.push({
        position: new THREE.Vector3(0, currentY + 1.5, 0),
        size: new THREE.Vector3(currentW * 0.6, 3, currentD * 0.6),
        type: 'HVAC',
      });
    } else if (archetype === 'CANTILEVER') {
      // Slender base with expanding cantilever upper volume
      const baseH = height * 0.35;
      const upperH = height * 0.65;
      const slenderW = baseW * 0.7;
      const slenderD = baseD * 0.7;

      tiers.push({
        offset: new THREE.Vector3(0, baseH / 2, 0),
        size: new THREE.Vector3(slenderW, baseH, slenderD),
      });

      tiers.push({
        offset: new THREE.Vector3(0, baseH + upperH / 2, 0),
        size: new THREE.Vector3(baseW, upperH, baseD),
      });

      // Cantilever glowing underbelly
      lightStrips.push({
        position: new THREE.Vector3(0, baseH - 0.1, 0),
        size: new THREE.Vector3(baseW, 0.2, baseD),
        color: neonColor,
      });

      collisionBounds.push(
        new THREE.Box3(
          new THREE.Vector3(lotCenter.x - baseW / 2, 0, lotCenter.z - baseD / 2),
          new THREE.Vector3(lotCenter.x + baseW / 2, height, lotCenter.z + baseD / 2)
        )
      );
    } else {
      // TWIN_TOWER: Two parallel spires joined by a skybridge
      const towerW = baseW * 0.42;
      const towerD = baseD * 0.85;
      const gap = baseW * 0.16;
      const leftCenterX = -gap / 2 - towerW / 2;
      const rightCenterX = gap / 2 + towerW / 2;

      // Left Spire
      tiers.push({
        offset: new THREE.Vector3(leftCenterX, height / 2, 0),
        size: new THREE.Vector3(towerW, height, towerD),
      });
      // Right Spire
      tiers.push({
        offset: new THREE.Vector3(rightCenterX, height * 0.9 / 2, 0),
        size: new THREE.Vector3(towerW, height * 0.9, towerD),
      });

      // Skybridge linking towers at 60% height
      const bridgeY = height * 0.6;
      const bridgeH = 4.5;
      tiers.push({
        offset: new THREE.Vector3(0, bridgeY, 0),
        size: new THREE.Vector3(baseW, bridgeH, towerD * 0.4),
      });

      // Skybridge glowing underside
      lightStrips.push({
        position: new THREE.Vector3(0, bridgeY - bridgeH / 2, 0),
        size: new THREE.Vector3(baseW, 0.2, towerD * 0.4),
        color: neonColor,
      });

      collisionBounds.push(
        new THREE.Box3(
          new THREE.Vector3(lotCenter.x + leftCenterX - towerW / 2, 0, lotCenter.z - towerD / 2),
          new THREE.Vector3(lotCenter.x + leftCenterX + towerW / 2, height, lotCenter.z + towerD / 2)
        )
      );
      collisionBounds.push(
        new THREE.Box3(
          new THREE.Vector3(lotCenter.x + rightCenterX - towerW / 2, 0, lotCenter.z - towerD / 2),
          new THREE.Vector3(lotCenter.x + rightCenterX + towerW / 2, height * 0.9, lotCenter.z + towerD / 2)
        )
      );
    }

    return {
      id,
      archetype,
      position: lotCenter,
      totalSize: new THREE.Vector3(baseW, height, baseD),
      tiers,
      lightStrips,
      rooftopEquipment,
      storefrontColor: rng.pick(['#00f0ff', '#ffaa00', '#00ffaa']),
      collisionBounds,
    };
  }
}
