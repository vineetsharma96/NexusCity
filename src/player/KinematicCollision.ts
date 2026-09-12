import * as THREE from 'three';

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
  private static ramps: CollisionRamp[] = [];

  public static clear(): void {
    this.boxes = [];
    this.ramps = [];
  }

  public static addBox(center: THREE.Vector3, size: THREE.Vector3): void {
    const half = size.clone().multiplyScalar(0.5);
    this.boxes.push({
      min: center.clone().sub(half),
      max: center.clone().add(half),
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

    // Check bounds: interior space (-80m) vs exterior city (-98 .. +98)
    if (playerMinY < -50) {
      resolved.x = THREE.MathUtils.clamp(resolved.x, -10.2, 10.2);
      resolved.z = THREE.MathUtils.clamp(resolved.z, -8.2, 8.2);
    } else {
      const worldLimit = 95;
      resolved.x = THREE.MathUtils.clamp(resolved.x, -worldLimit, worldLimit);
      resolved.z = THREE.MathUtils.clamp(resolved.z, -worldLimit, worldLimit);
    }

    for (const box of this.boxes) {
      // Check vertical overlap
      if (playerMaxY <= box.min.y || playerMinY >= box.max.y) {
        continue;
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
    }

    return resolved;
  }

  /**
   * Evaluates ground height under player at given (x, z).
   */
  public static getGroundHeightAt(x: number, z: number, currentY: number): { height: number; onRamp: boolean } {
    let groundHeight = currentY < -50 ? -80.0 : 0.0; // Interior floor at -80m vs plaza at 0m
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

    // Check elevated platforms
    for (const box of this.boxes) {
      if (x >= box.min.x && x <= box.max.x && z >= box.min.z && z <= box.max.z) {
        // Only step onto platform if player's feet are within step/jump reach
        if (currentY >= box.max.y - 0.6) {
          if (box.max.y > groundHeight) {
            groundHeight = box.max.y;
            onRamp = false;
          }
        }
      }
    }

    return { height: groundHeight, onRamp };
  }
}
