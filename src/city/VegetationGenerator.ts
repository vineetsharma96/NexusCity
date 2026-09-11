import * as THREE from 'three';
import { SeedRandom } from '../core/SeedRandom';

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

export interface TreeDef {
  id: string;
  position: THREE.Vector3;
  scale: number;
  trunkHeight: number;
  trunkRadius: number;
  branches: BranchDef[];
  leafClusters: LeafClusterDef[];
  planterSize: THREE.Vector3;
}

export class VegetationGenerator {
  /**
   * Generates procedural trees and planters for sidewalks and plazas.
   */
  public static generateTrees(seed: number = 847291): TreeDef[] {
    const rng = new SeedRandom(seed + 999);
    const trees: TreeDef[] = [];

    // Tree placement coordinates: along sidewalk avenue margins and plaza corners
    const treePositions: THREE.Vector3[] = [
      // Central Plaza Corners
      new THREE.Vector3(12, 0.18, 12),
      new THREE.Vector3(-12, 0.18, 12),
      new THREE.Vector3(12, 0.18, -12),
      new THREE.Vector3(-12, 0.18, -12),

      // East Sidewalk Avenues
      new THREE.Vector3(17, 0.18, 40),
      new THREE.Vector3(17, 0.18, 95),
      new THREE.Vector3(17, 0.18, -40),
      new THREE.Vector3(17, 0.18, -95),

      // West Sidewalk Avenues
      new THREE.Vector3(-17, 0.18, 40),
      new THREE.Vector3(-17, 0.18, 95),
      new THREE.Vector3(-17, 0.18, -40),
      new THREE.Vector3(-17, 0.18, -95),

      // Cross-Street Sidewalks
      new THREE.Vector3(45, 0.18, 10),
      new THREE.Vector3(-45, 0.18, 10),
      new THREE.Vector3(45, 0.18, -10),
      new THREE.Vector3(-45, 0.18, -10),
    ];

    const leafPalette = [
      ['#10b981', '#059669', '#34d399'], // Emerald Spring
      ['#059669', '#047857', '#10b981'], // Deep Jade
      ['#f59e0b', '#d97706', '#fbbf24'], // Cyber Golden Ginkgo
      ['#14b8a6', '#0d9488', '#2dd4bf'], // Teal Neon Foliage
    ];

    treePositions.forEach((pos, idx) => {
      const treeScale = rng.range(0.85, 1.25);
      const trunkHeight = rng.range(4.5, 6.5) * treeScale;
      const trunkRadius = rng.range(0.25, 0.35);

      const colors = rng.pick(leafPalette);
      const branches: BranchDef[] = [];
      const leafClusters: LeafClusterDef[] = [];

      // 1. Primary Branches Forking Out
      const numBranches = rng.int(3, 5);
      for (let b = 0; b < numBranches; b++) {
        const angle = (b / numBranches) * Math.PI * 2 + rng.range(-0.3, 0.3);
        const branchY = trunkHeight * rng.range(0.55, 0.85);
        const branchLen = rng.range(1.6, 2.6);

        const endX = Math.cos(angle) * branchLen;
        const endZ = Math.sin(angle) * branchLen;
        const endY = branchY + rng.range(0.8, 1.8);

        branches.push({
          start: new THREE.Vector3(0, branchY, 0),
          end: new THREE.Vector3(endX, endY, endZ),
          radius: trunkRadius * 0.55,
        });

        // 2. Leaf Canopy Cloud per Branch Tip
        const clusterRadius = rng.range(1.5, 2.4);
        leafClusters.push({
          offset: new THREE.Vector3(endX, endY + clusterRadius * 0.4, endZ),
          scale: new THREE.Vector3(clusterRadius, clusterRadius * 0.85, clusterRadius),
          color: rng.pick(colors),
        });
      }

      // 3. Central Crown Canopy Cluster
      const crownRadius = rng.range(2.0, 2.8);
      leafClusters.push({
        offset: new THREE.Vector3(0, trunkHeight + crownRadius * 0.6, 0),
        scale: new THREE.Vector3(crownRadius, crownRadius * 1.1, crownRadius),
        color: rng.pick(colors),
      });

      trees.push({
        id: `tree-${idx}`,
        position: pos,
        scale: treeScale,
        trunkHeight,
        trunkRadius,
        branches,
        leafClusters,
        planterSize: new THREE.Vector3(3.2, 0.4, 3.2),
      });
    });

    return trees;
  }
}
