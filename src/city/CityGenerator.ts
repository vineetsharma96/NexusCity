import * as THREE from 'three';
import { SeedRandom } from '../core/SeedRandom';
import { BuildingGenerator, BuildingDef } from './BuildingGenerator';
import { KinematicCollisionSolver } from '../player/KinematicCollision';

export interface StreetLightDef {
  position: THREE.Vector3;
  rotationY: number;
}

export interface CityData {
  buildings: BuildingDef[];
  streetlights: StreetLightDef[];
  avenues: { position: THREE.Vector3; size: THREE.Vector3; rotationY: number }[];
  sidewalks: { position: THREE.Vector3; size: THREE.Vector3 }[];
}

export class CityGenerator {
  public static generateDistrict(seed: number = 847291): CityData {
    const rng = new SeedRandom(seed);
    const buildings: BuildingDef[] = [];
    const streetlights: StreetLightDef[] = [];
    const avenues: { position: THREE.Vector3; size: THREE.Vector3; rotationY: number }[] = [];
    const sidewalks: { position: THREE.Vector3; size: THREE.Vector3 }[] = [];

    // Clear prior collision data
    KinematicCollisionSolver.clear();

    // 1. Road Avenues (North-South Main Blvd & East-West Cross Blvd)
    // Main North-South Boulevard (20m wide, 300m long)
    avenues.push({
      position: new THREE.Vector3(0, 0.02, 0),
      size: new THREE.Vector3(20, 0.05, 300),
      rotationY: 0,
    });
    // Secondary East-West Cross Boulevard (16m wide, 300m long)
    avenues.push({
      position: new THREE.Vector3(0, 0.025, 0),
      size: new THREE.Vector3(16, 0.05, 300),
      rotationY: Math.PI / 2,
    });
    // North Cross Street (14m wide)
    avenues.push({
      position: new THREE.Vector3(0, 0.025, -75),
      size: new THREE.Vector3(14, 0.05, 300),
      rotationY: Math.PI / 2,
    });
    // South Cross Street (14m wide)
    avenues.push({
      position: new THREE.Vector3(0, 0.025, 75),
      size: new THREE.Vector3(14, 0.05, 300),
      rotationY: Math.PI / 2,
    });

    // 2. City Blocks Partitioning (8 Macro Blocks)
    // Blocks are bounded by roads: x = [-140..-14], [14..140], z = [-140..-82], [-68..-10], [10..68], [82..140]
    const blockXSpans = [
      { min: -130, max: -15 }, // West side
      { min: 15, max: 130 },   // East side
    ];

    const blockZSpans = [
      { min: -130, max: -82 },
      { min: -68, max: -12 },
      { min: 12, max: 68 },
      { min: 82, max: 130 },
    ];

    let bldgCounter = 0;

    blockXSpans.forEach((xSpan, colIdx) => {
      blockZSpans.forEach((zSpan, rowIdx) => {
        const blockW = xSpan.max - xSpan.min;
        const blockD = zSpan.max - zSpan.min;
        const blockCenterX = (xSpan.min + xSpan.max) / 2;
        const blockCenterZ = (zSpan.min + zSpan.max) / 2;

        // Sidewalk slab for this block (raised 0.18m)
        sidewalks.push({
          position: new THREE.Vector3(blockCenterX, 0.09, blockCenterZ),
          size: new THREE.Vector3(blockW, 0.18, blockD),
        });

        // Streetlights along the avenue edge of the sidewalk
        const streetSideX = colIdx === 0 ? xSpan.max - 1.2 : xSpan.min + 1.2;
        const rotY = colIdx === 0 ? -Math.PI / 2 : Math.PI / 2;

        streetlights.push({
          position: new THREE.Vector3(streetSideX, 0.18, zSpan.min + 8),
          rotationY: rotY,
        });
        streetlights.push({
          position: new THREE.Vector3(streetSideX, 0.18, (zSpan.min + zSpan.max) / 2),
          rotationY: rotY,
        });
        streetlights.push({
          position: new THREE.Vector3(streetSideX, 0.18, zSpan.max - 8),
          rotationY: rotY,
        });

        // Subdivide block into 2 building lots
        const lotW = (blockW - 8) / 2;
        const lotD = blockD - 6;

        // Lot 1 (Inner, closer to avenue)
        const lot1CenterX = colIdx === 0 ? xSpan.max - lotW / 2 - 3 : xSpan.min + lotW / 2 + 3;
        const bldg1 = BuildingGenerator.generateBuilding(
          `bldg-${++bldgCounter}`,
          new THREE.Vector3(lot1CenterX, 0, blockCenterZ),
          lotW,
          lotD,
          rng
        );
        buildings.push(bldg1);

        // Lot 2 (Outer)
        const lot2CenterX = colIdx === 0 ? xSpan.min + lotW / 2 + 3 : xSpan.max - lotW / 2 - 3;
        const bldg2 = BuildingGenerator.generateBuilding(
          `bldg-${++bldgCounter}`,
          new THREE.Vector3(lot2CenterX, 0, blockCenterZ),
          lotW,
          lotD,
          rng
        );
        buildings.push(bldg2);
      });
    });

    // 3. Register All Building Footprints in KinematicCollisionSolver
    buildings.forEach((bldg) => {
      bldg.collisionBounds.forEach((box) => {
        const center = new THREE.Vector3();
        const size = new THREE.Vector3();
        box.getCenter(center);
        box.getSize(size);
        KinematicCollisionSolver.addBox(center, size);
      });
    });

    return {
      buildings,
      streetlights,
      avenues,
      sidewalks,
    };
  }
}
