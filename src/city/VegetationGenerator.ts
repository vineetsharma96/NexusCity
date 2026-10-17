import * as THREE from 'three';
import { SeedRandom } from '../core/SeedRandom';
import { DistrictInfo } from './DistrictGenerator';

export type TreeSpecies = 'GINKGO' | 'SAKURA' | 'EMERALD' | 'WILLOW' | 'CYBER_NEON';

export interface BranchDef {
  start: THREE.Vector3;
  end: THREE.Vector3;
  radius: number;
}

export interface LeafClusterDef {
  offset: THREE.Vector3;
  scale: THREE.Vector3;
  color: string;
}

export interface TreeDef {
  id: string;
  position: THREE.Vector3;
  scale: number;
  trunkHeight: number;
  trunkRadius: number;
  branches: BranchDef[];
  leafClusters: LeafClusterDef[];
  planterSize: THREE.Vector3;
  hasPlanter: boolean;
  species: TreeSpecies;
  emissiveColor?: string;
  emissiveIntensity?: number;
}

export interface PlanterBushDef {
  id: string;
  position: THREE.Vector3;
  size: THREE.Vector3;
  color: string;
  hasFlowers: boolean;
  flowerColor?: string;
}

const SPECIES_PALETTES: Record<TreeSpecies, { colors: string[]; emissive: string }> = {
  GINKGO: { colors: ['#f59e0b', '#fbbf24', '#d97706'], emissive: '#b45309' },
  SAKURA: { colors: ['#fb7185', '#f43f5e', '#fda4af'], emissive: '#e11d48' },
  EMERALD: { colors: ['#10b981', '#059669', '#34d399'], emissive: '#047857' },
  WILLOW: { colors: ['#2dd4bf', '#14b8a6', '#0d9488'], emissive: '#0f766e' },
  CYBER_NEON: { colors: ['#38bdf8', '#0284c7', '#7dd3fc'], emissive: '#0284c7' },
};

export class VegetationGenerator {
  private static createTree(
    id: string,
    pos: THREE.Vector3,
    species: TreeSpecies,
    rng: SeedRandom,
    hasPlanter: boolean = true
  ): TreeDef {
    const trunkHeight = rng.range(4.4, 6.2);
    const trunkRadius = rng.range(0.22, 0.32);
    const palette = SPECIES_PALETTES[species];
    const branches: BranchDef[] = [];
    const leafClusters: LeafClusterDef[] = [];

    const branchCount = 3;
    for (let b = 0; b < branchCount; b++) {
      const angle = (b / branchCount) * Math.PI * 2 + rng.range(-0.3, 0.3);
      const reach = rng.range(1.4, 2.2);
      const startY = trunkHeight * rng.range(0.55, 0.72);
      const endY = trunkHeight + rng.range(0.4, 1.4);
      const end = new THREE.Vector3(Math.cos(angle) * reach, endY, Math.sin(angle) * reach);

      branches.push({
        start: new THREE.Vector3(0, startY, 0),
        end,
        radius: trunkRadius * 0.55,
      });

      leafClusters.push({
        offset: end.clone().add(new THREE.Vector3(0, 0.35, 0)),
        scale: new THREE.Vector3(rng.range(1.6, 2.3), rng.range(1.3, 1.9), rng.range(1.6, 2.3)),
        color: rng.pick(palette.colors),
      });
    }

    leafClusters.push({
      offset: new THREE.Vector3(0, trunkHeight + 1.1, 0),
      scale: new THREE.Vector3(2.4, 1.9, 2.4),
      color: rng.pick(palette.colors),
    });

    return {
      id,
      position: pos,
      scale: 1,
      trunkHeight,
      trunkRadius,
      branches,
      leafClusters,
      planterSize: new THREE.Vector3(2.4, 0.38, 2.4),
      hasPlanter,
      species,
      emissiveColor: palette.emissive,
      emissiveIntensity: 0.16,
    };
  }

  public static generateTrees(seed: number = 847291): TreeDef[] {
    const rng = new SeedRandom(seed ^ 0x5f3759df);
    const trees: TreeDef[] = [];
    const speciesOrder: TreeSpecies[] = ['GINKGO', 'EMERALD', 'SAKURA', 'WILLOW', 'CYBER_NEON'];

    const coords: [number, number][] = [
      [-10.5, -24],
      [10.5, -24],
      [-10.5, -48],
      [10.5, -48],
      [-10.5, 24],
      [10.5, 24],
      [-10.5, 48],
      [10.5, 48],
      [-24, -10.5],
      [-48, -10.5],
      [24, -10.5],
      [48, -10.5],
      [-24, 10.5],
      [-48, 10.5],
      [24, 10.5],
    ];

    coords.forEach(([x, z], idx) => {
      const species = speciesOrder[idx % speciesOrder.length];
      trees.push(this.createTree(`core-tree-${idx}`, new THREE.Vector3(x, 0.14, z), species, rng, true));
    });

    return trees;
  }

  public static generateChunkTrees(
    cx: number,
    cz: number,
    district: DistrictInfo,
    globalSeed: number = 847291
  ): { trees: TreeDef[]; bushes: PlanterBushDef[] } {
    const rng = new SeedRandom((globalSeed ^ (cx * 31337) ^ (cz * 7919)) >>> 0);
    const trees: TreeDef[] = [];
    const bushes: PlanterBushDef[] = [];

    if (district.foliageDensity < 0.15) return { trees, bushes };

    const centerX = (cx + 0.5) * 120;
    const centerZ = (cz + 0.5) * 120;
    const speciesPool: TreeSpecies[] =
      district.type === 'GREEN_DISTRICT'
        ? ['EMERALD', 'SAKURA', 'WILLOW', 'GINKGO']
        : district.type === 'NEURAL_DISTRICT'
        ? ['CYBER_NEON', 'GINKGO']
        : ['GINKGO', 'EMERALD'];

    const offsets: [number, number][] = [
      [-10.2, -26],
      [10.2, -26],
      [-10.2, 26],
      [10.2, 26],
    ];

    offsets.forEach(([ox, oz], idx) => {
      if (rng.next() <= district.foliageDensity + 0.25) {
        const sp = rng.pick(speciesPool);
        trees.push(
          this.createTree(
            `chunk-tree-${cx}-${cz}-${idx}`,
            new THREE.Vector3(centerX + ox, 0.12, centerZ + oz),
            sp,
            rng,
            true
          )
        );
      }
    });

    if (district.foliageDensity >= 0.4) {
      bushes.push({
        id: `chunk-bush-${cx}-${cz}-0`,
        position: new THREE.Vector3(centerX - 10.2, 0.28, centerZ - 14),
        size: new THREE.Vector3(1.8, 0.7, 1.8),
        color: '#065f46',
        hasFlowers: true,
        flowerColor: district.accentColor,
      });
      bushes.push({
        id: `chunk-bush-${cx}-${cz}-1`,
        position: new THREE.Vector3(centerX + 10.2, 0.28, centerZ + 14),
        size: new THREE.Vector3(1.8, 0.7, 1.8),
        color: '#065f46',
        hasFlowers: true,
        flowerColor: district.accentColor,
      });
    }

    return { trees, bushes };
  }
}
