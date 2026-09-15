import * as THREE from 'three';

export type SurfaceType = 'ROAD' | 'CONCRETE' | 'GRASS' | 'METAL';

export interface GroundInfo {
  height: number;
  onRamp: boolean;
  surface: SurfaceType;
}

export interface CollisionBox {
  min: THREE.Vector3;
  max: THREE.Vector3;
}

export interface CollisionRamp {
  // Ramp defined by bounding box and incline direction
  box: CollisionBox;
  slopeNormal: THREE.Vector3;
  baseY: number;
  topY: number;
  startAxis: 'x' | 'z';
  startCoord: number;
  endCoord: number;
}

export class KinematicCollisionSolver {
  private static boxes: CollisionBox[] = [];
  private static chunkBoxes: Map<string, CollisionBox[]> = new Map();
  private static ramps: CollisionRamp[] = [];

  public static clear(): void {
    this.boxes = [];
    this.chunkBoxes.clear();
    this.ramps = [];
  }

  public static setChunkBoxes(chunkKey: string, boxes: CollisionBox[]): void {
    this.chunkBoxes.set(chunkKey, boxes);
  }

  public static removeChunkBoxes(chunkKey: string): void {
    this.chunkBoxes.delete(chunkKey);
  }

  public static addBox(center: THREE.Vector3, size: THREE.Vector3): void {
    const half = size.clone().multiplyScalar(0.5);
    this.boxes.push({
      min: center.clone().sub(half),
      max: center.clone().add(half),
    });
  }

  public static removeBox(center: THREE.Vector3, tolerance: number = 0.5): void {
    this.boxes = this.boxes.filter((b) => {
      const boxCenter = b.min.clone().add(b.max).multiplyScalar(0.5);
      return boxCenter.distanceTo(center) > tolerance;
    });
  }

  public static addRamp(
    center: THREE.Vector3,
    size: THREE.Vector3,
    startAxis: 'x' | 'z',
    startCoord: number,
    endCoord: number,
    baseY: number,
    topY: number
  ): void {
    const half = size.clone().multiplyScalar(0.5);
    this.ramps.push({
      box: {
        min: center.clone().sub(half),
        max: center.clone().add(half),
      },
      slopeNormal: new THREE.Vector3(0, 1, 0),
      baseY,
      topY,
      startAxis,
      startCoord,
      endCoord,
    });
  }

  public static getBoxes(): CollisionBox[] {
    return this.boxes;
  }

  public static getAllBoxes(): CollisionBox[] {
    const all = [...this.boxes];
    for (const cBoxes of this.chunkBoxes.values()) {
      all.push(...cBoxes);
    }
    return all;
  }

  /**
   * Resolves horizontal displacement with wall sliding and returns valid position.
   */
  public static resolveHorizontal(
    currentPos: THREE.Vector3,
    radius: number,
    playerHeight: number
  ): THREE.Vector3 {
    const resolved = currentPos.clone();
    const playerMinY = resolved.y;
    const playerMaxY = resolved.y + playerHeight;

    // 24x24 chunks at 120m = 2880m expanse (-1440m to +1440m). Bound player safely within active world substrate.
    const worldLimit = 1380;
    resolved.x = THREE.MathUtils.clamp(resolved.x, -worldLimit, worldLimit);
    resolved.z = THREE.MathUtils.clamp(resolved.z, -worldLimit, worldLimit);

    const checkHorizontalBox = (box: CollisionBox) => {
      // Check vertical overlap
      if (playerMaxY <= box.min.y || playerMinY >= box.max.y) {
        return;
      }

      // Check expanded horizontal AABB overlap with player radius
      if (
        resolved.x + radius > box.min.x &&
        resolved.x - radius < box.max.x &&
        resolved.z + radius > box.min.z &&
        resolved.z - radius < box.max.z
      ) {
        // Calculate penetration depths along each axis
        const dxLeft = (resolved.x + radius) - box.min.x;
        const dxRight = box.max.x - (resolved.x - radius);
        const dzBack = (resolved.z + radius) - box.min.z;
        const dzFront = box.max.z - (resolved.z - radius);

        const minOverlap = Math.min(dxLeft, dxRight, dzBack, dzFront);

        // Slide along closest normal
        if (minOverlap === dxLeft) {
          resolved.x = box.min.x - radius;
        } else if (minOverlap === dxRight) {
          resolved.x = box.max.x + radius;
        } else if (minOverlap === dzBack) {
          resolved.z = box.min.z - radius;
        } else {
          resolved.z = box.max.z + radius;
        }
      }
    };

    for (const box of this.boxes) {
      checkHorizontalBox(box);
    }
    for (const cBoxes of this.chunkBoxes.values()) {
      for (const box of cBoxes) {
        checkHorizontalBox(box);
      }
    }

    return resolved;
  }

  /**
   * Evaluates ground height under player at given (x, z).
   */
  public static getGroundHeightAt(x: number, z: number, currentY: number): GroundInfo {
    let groundHeight = 0.0; // World surface baseline at 0.0m
    let onRamp = false;

    // Check ramps first
    for (const ramp of this.ramps) {
      const b = ramp.box;
      if (x >= b.min.x && x <= b.max.x && z >= b.min.z && z <= b.max.z) {
        // Interpolate height along ramp axis
        const coord = ramp.startAxis === 'x' ? x : z;
        const t = THREE.MathUtils.clamp(
          (coord - ramp.startCoord) / (ramp.endCoord - ramp.startCoord),
          0,
          1
        );
        const rampH = ramp.baseY + t * (ramp.topY - ramp.baseY);
        if (rampH > groundHeight) {
          groundHeight = rampH;
          onRamp = true;
        }
      }
    }

    const checkPlatformBox = (box: CollisionBox) => {
      if (x >= box.min.x && x <= box.max.x && z >= box.min.z && z <= box.max.z) {
        // Only step onto platform if player's feet are within step/jump reach
        if (currentY >= box.max.y - 0.6) {
          if (box.max.y > groundHeight) {
            groundHeight = box.max.y;
            onRamp = false;
          }
        }
      }
    };

    // Check elevated platforms in static boxes
    for (const box of this.boxes) {
      checkPlatformBox(box);
    }
    // Check platforms in streamed chunk boxes
    for (const cBoxes of this.chunkBoxes.values()) {
      for (const box of cBoxes) {
        checkPlatformBox(box);
      }
    }

    // Determine surface type
    let surface: SurfaceType = 'CONCRETE';
    if (onRamp || groundHeight > 1.8) {
      surface = 'METAL';
    } else if (x >= 45 && x <= 105 && z >= 45 && z <= 105) {
      // Park Sanctuary grounds
      surface = 'GRASS';
    } else {
      // Check if on road surface
      const isCentralAvenue = Math.abs(x) <= 8.5;
      const isCrossStreet = Math.abs(z) <= 7.5 || Math.abs(z - 75) <= 7.0 || Math.abs(z + 75) <= 7.0;
      if (isCentralAvenue || isCrossStreet) {
        surface = 'ROAD';
      } else {
        surface = 'CONCRETE';
      }
    }

    return { height: groundHeight, onRamp, surface };
  }
}
