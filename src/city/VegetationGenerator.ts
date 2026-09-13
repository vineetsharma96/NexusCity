import * as THREE from 'three';
import { SeedRandom } from '../core/SeedRandom';
import { DistrictInfo } from './DistrictGenerator';

export interface LeafClusterDef {
  offset: THREE.Vector3;
  scale: THREE.Vector3;
  color: string;
}

export interface BranchDef {
  start: THREE.Vector3;
  end: THREE.Vector3;
  radius: number;
}

export type TreeSpecies = 'EMERALD' | 'GINKGO' | 'SAKURA' | 'WILLOW' | 'CYBER_NEON';

export interface TreeDef {
  id: string;
  position: THREE.Vector3;
  scale: number;
  trunkHeight: number;
  trunkRadius: number;
  branches: BranchDef[];
  leafClusters: LeafClusterDef[];
  planterSize: THREE.Vector3;
  hasPlanter?: boolean;
  species?: TreeSpecies;
  emissiveColor?: string;
  emissiveIntensity?: number;
}

export interface PlanterBushDef {
  id: string;
  position: THREE.Vector3;
  size: THREE.Vector3;
  color: string;
  flowerColor?: string;
  hasFlowers: boolean;
}

export class VegetationGenerator {
  /**
   * Generates procedural trees and planters for Central Plaza and surrounding avenues.
   */
  public static generateTrees(seed: number = 847291): TreeDef[] {
    const rng = new SeedRandom(seed + 999);
    const trees: TreeDef[] = [];

    // Tree placement coordinates: along sidewalk avenue margins and plaza corners
    const treePositions: { pos: THREE.Vector3; species: TreeSpecies }[] = [
      // Central Plaza Corners (Golden Cyber Ginkgos)
      { pos: new THREE.Vector3(12, 0.18, 12), species: 'GINKGO' },
      { pos: new THREE.Vector3(-12, 0.18, 12), species: 'GINKGO' },
      { pos: new THREE.Vector3(12, 0.18, -12), species: 'GINKGO' },
      { pos: new THREE.Vector3(-12, 0.18, -12), species: 'GINKGO' },

      // East Sidewalk Avenues (Emerald Jade & Cyber Neon)
      { pos: new THREE.Vector3(17, 0.18, 40), species: 'EMERALD' },
      { pos: new THREE.Vector3(17, 0.18, 95), species: 'CYBER_NEON' },
      { pos: new THREE.Vector3(17, 0.18, -40), species: 'EMERALD' },
      { pos: new THREE.Vector3(17, 0.18, -95), species: 'CYBER_NEON' },

      // West Sidewalk Avenues
      { pos: new THREE.Vector3(-17, 0.18, 40), species: 'EMERALD' },
      { pos: new THREE.Vector3(-17, 0.18, 95), species: 'CYBER_NEON' },
      { pos: new THREE.Vector3(-17, 0.18, -40), species: 'EMERALD' },
      { pos: new THREE.Vector3(-17, 0.18, -95), species: 'CYBER_NEON' },

      // Cross-Street Sidewalks (Sakura & Willow)
      { pos: new THREE.Vector3(45, 0.18, 10), species: 'SAKURA' },
      { pos: new THREE.Vector3(-45, 0.18, 10), species: 'SAKURA' },
      { pos: new THREE.Vector3(45, 0.18, -10), species: 'WILLOW' },
      { pos: new THREE.Vector3(-45, 0.18, -10), species: 'WILLOW' },

      // Extended Boulevard Avenues
      { pos: new THREE.Vector3(17, 0.18, 140), species: 'GINKGO' },
      { pos: new THREE.Vector3(-17, 0.18, 140), species: 'GINKGO' },
      { pos: new THREE.Vector3(17, 0.18, -140), species: 'EMERALD' },
      { pos: new THREE.Vector3(-17, 0.18, -140), species: 'EMERALD' },
      { pos: new THREE.Vector3(80, 0.18, 10), species: 'SAKURA' },
      { pos: new THREE.Vector3(-80, 0.18, 10), species: 'CYBER_NEON' },
    ];

    treePositions.forEach((entry, idx) => {
      trees.push(this.buildTree(`central-tree-${idx}`, entry.pos, entry.species, rng, true));
    });

    return trees;
  }

  /**
   * Generates procedural trees and greenery for an individual streamed world chunk based on district.
   */
  public static generateChunkTrees(
    cx: number,
    cz: number,
    district: DistrictInfo,
    seed: number = 847291
  ): { trees: TreeDef[]; bushes: PlanterBushDef[] } {
    const chunkSeed = (seed ^ (cx * 4492711) ^ (cz * 8831093)) >>> 0;
    const rng = new SeedRandom(chunkSeed);

    const trees: TreeDef[] = [];
    const bushes: PlanterBushDef[] = [];

    const chunkSize = 120;
    const centerX = (cx + 0.5) * chunkSize;
    const centerZ = (cz + 0.5) * chunkSize;

    // Density factor determines how many trees and vegetation elements appear
    const density = district.foliageDensity;
    if (density <= 0.05) {
      return { trees, bushes };
    }

    if (district.type === 'GREEN_DISTRICT') {
      // Lush Biosphere: Multiple botanical tree groves, pocket park gardens, and hedges
      const numTrees = rng.int(8, 14);
      const speciesList: TreeSpecies[] = ['SAKURA', 'WILLOW', 'EMERALD', 'GINKGO', 'CYBER_NEON'];

      for (let i = 0; i < numTrees; i++) {
        // Distribute around chunk perimeter sidewalks and park gardens
        const angle = (i / numTrees) * Math.PI * 2 + rng.range(-0.3, 0.3);
        const radius = rng.range(16, 46);
        const posX = centerX + Math.cos(angle) * radius;
        const posZ = centerZ + Math.sin(angle) * radius;
        const species = rng.pick(speciesList);

        trees.push(
          this.buildTree(
            `stream-tree-${cx}_${cz}-${i}`,
            new THREE.Vector3(posX, 0.18, posZ),
            species,
            rng,
            rng.next() > 0.35 // mix of planted planters and natural turf beds
          )
        );
      }

      // Ornamental flower and hedge bushes
      const numBushes = rng.int(6, 12);
      for (let j = 0; j < numBushes; j++) {
        const angle = (j / numBushes) * Math.PI * 2 + rng.range(-0.4, 0.4);
        const radius = rng.range(12, 42);
        bushes.push({
          id: `stream-bush-${cx}_${cz}-${j}`,
          position: new THREE.Vector3(centerX + Math.cos(angle) * radius, 0.2, centerZ + Math.sin(angle) * radius),
          size: new THREE.Vector3(rng.range(1.8, 3.2), rng.range(0.8, 1.4), rng.range(1.8, 3.2)),
          color: rng.pick(['#059669', '#10b981', '#047857', '#065f46']),
          hasFlowers: rng.next() > 0.3,
          flowerColor: rng.pick(['#f43f5e', '#38bdf8', '#fbbf24', '#e879f9']),
        });
      }
    } else {
      // Urban Avenue Sidewalk Planters (Central, Old City, Neural)
      const numTrees = Math.round(density * rng.int(4, 7));
      const species: TreeSpecies =
        district.type === 'NEURAL_DISTRICT'
          ? 'CYBER_NEON'
          : district.type === 'OLD_CITY'
          ? 'WILLOW'
          : 'EMERALD';

      for (let i = 0; i < numTrees; i++) {
        // Place along sidewalks flanking avenues
        const isEast = i % 2 === 0;
        const sideOffset = isEast ? 12 : -12;
        const zOffset = ((i % 4) - 1.5) * 26;

        trees.push(
          this.buildTree(
            `stream-tree-${cx}_${cz}-${i}`,
            new THREE.Vector3(centerX + sideOffset, 0.18, centerZ + zOffset),
            species,
            rng,
            true
          )
        );
      }

      // Low street hedge planters
      const numBushes = Math.round(density * rng.int(3, 6));
      for (let j = 0; j < numBushes; j++) {
        const isEast = j % 2 === 0;
        const sideOffset = isEast ? -12 : 12;
        const zOffset = (j - 1.5) * 22;

        bushes.push({
          id: `stream-bush-${cx}_${cz}-${j}`,
          position: new THREE.Vector3(centerX + sideOffset, 0.2, centerZ + zOffset),
          size: new THREE.Vector3(2.4, 0.75, 1.4),
          color: '#047857',
          hasFlowers: rng.next() > 0.5,
          flowerColor: district.accentColor,
        });
      }
    }

    return { trees, bushes };
  }

  /**
   * Builds an individual TreeDef with organic branches and foliage canopy.
   */
  private static buildTree(
    id: string,
    pos: THREE.Vector3,
    species: TreeSpecies,
    rng: SeedRandom,
    hasPlanter: boolean = true
  ): TreeDef {
    const treeScale = rng.range(0.85, 1.3);
    const trunkHeight = rng.range(4.6, 6.8) * treeScale;
    const trunkRadius = rng.range(0.24, 0.36);

    let leafColors: string[];
    let emissiveColor: string | undefined;
    let emissiveIntensity: number | undefined;

    switch (species) {
      case 'SAKURA':
        leafColors = ['#fb7185', '#f43f5e', '#fda4af'];
        emissiveColor = '#f43f5e';
        emissiveIntensity = 0.25;
        break;
      case 'GINKGO':
        leafColors = ['#f59e0b', '#d97706', '#fbbf24'];
        emissiveColor = '#d97706';
        emissiveIntensity = 0.15;
        break;
      case 'CYBER_NEON':
        leafColors = ['#14b8a6', '#06b6d4', '#2dd4bf'];
        emissiveColor = '#00f0ff';
        emissiveIntensity = 0.35;
        break;
      case 'WILLOW':
        leafColors = ['#10b981', '#059669', '#047857'];
        emissiveColor = '#10b981';
        emissiveIntensity = 0.1;
        break;
      case 'EMERALD':
      default:
        leafColors = ['#10b981', '#059669', '#34d399'];
        break;
    }

    const branches: BranchDef[] = [];
    const leafClusters: LeafClusterDef[] = [];

    // 1. Primary Branches Forking Out
    const numBranches = species === 'WILLOW' ? rng.int(5, 7) : rng.int(3, 5);
    for (let b = 0; b < numBranches; b++) {
      const angle = (b / numBranches) * Math.PI * 2 + rng.range(-0.3, 0.3);
      const branchY = trunkHeight * rng.range(0.55, 0.85);
      const branchLen = rng.range(1.6, 2.8);

      const endX = Math.cos(angle) * branchLen;
      const endZ = Math.sin(angle) * branchLen;
      const endY = branchY + (species === 'WILLOW' ? rng.range(-0.4, 0.6) : rng.range(0.8, 1.8));

      branches.push({
        start: new THREE.Vector3(0, branchY, 0),
        end: new THREE.Vector3(endX, endY, endZ),
        radius: trunkRadius * 0.55,
      });

      // 2. Leaf Canopy Cloud per Branch Tip
      const clusterRadius = rng.range(1.5, 2.5);
      leafClusters.push({
        offset: new THREE.Vector3(endX, endY + clusterRadius * 0.4, endZ),
        scale: new THREE.Vector3(clusterRadius, clusterRadius * (species === 'WILLOW' ? 1.4 : 0.85), clusterRadius),
        color: rng.pick(leafColors),
      });
    }

    // 3. Central Crown Canopy Cluster
    const crownRadius = rng.range(2.0, 3.0);
    leafClusters.push({
      offset: new THREE.Vector3(0, trunkHeight + crownRadius * 0.6, 0),
      scale: new THREE.Vector3(crownRadius, crownRadius * 1.05, crownRadius),
      color: rng.pick(leafColors),
    });

    return {
      id,
      position: pos,
      scale: treeScale,
      trunkHeight,
      trunkRadius,
      branches,
      leafClusters,
      planterSize: new THREE.Vector3(3.2, 0.4, 3.2),
      hasPlanter,
      species,
      emissiveColor,
      emissiveIntensity,
    };
  }
}
