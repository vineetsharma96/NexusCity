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
  private static readonly WORLD_LIMIT = 1380;
  private static boxes: CollisionBox[] = [];
  private static chunkBoxes: Map<string, CollisionBox[]> = new Map();
  private static ramps: CollisionRamp[] = [];
  private static allBoxesCache: CollisionBox[] | null = null;

  public static clear(): void {
    this.boxes = [];
    this.chunkBoxes.clear();
    this.ramps = [];
    this.allBoxesCache = null;
  }

  public static setChunkBoxes(chunkKey: string, boxes: CollisionBox[]): void {
    this.chunkBoxes.set(chunkKey, boxes);
    this.allBoxesCache = null;
  }

  public static removeChunkBoxes(chunkKey: string): void {
    this.chunkBoxes.delete(chunkKey);
    this.allBoxesCache = null;
  }

  public static addBox(center: THREE.Vector3, size: THREE.Vector3): void {
    const half = size.clone().multiplyScalar(0.5);
    this.boxes.push({
      min: center.clone().sub(half),
      max: center.clone().add(half),
    });
    this.allBoxesCache = null;
  }

  public static removeBox(center: THREE.Vector3, tolerance: number = 0.5): void {
    this.boxes = this.boxes.filter((b) => {
      const boxCenter = b.min.clone().add(b.max).multiplyScalar(0.5);
      return boxCenter.distanceTo(center) > tolerance;
    });
    this.allBoxesCache = null;
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
    if (this.allBoxesCache) return this.allBoxesCache;
    const all = [...this.boxes];
    for (const cBoxes of this.chunkBoxes.values()) {
      all.push(...cBoxes);
    }
    this.allBoxesCache = all;
    return all;
  }

  public static isPositionClear(position: THREE.Vector3, radius: number, height: number): boolean {
    const minY = position.y;
    const maxY = position.y + height;
    return this.getAllBoxes().every((box) =>
      maxY <= box.min.y || minY >= box.max.y ||
      position.x + radius <= box.min.x || position.x - radius >= box.max.x ||
      position.z + radius <= box.min.z || position.z - radius >= box.max.z
    );
  }

  public static findSafePosition(origin: THREE.Vector3, radius: number, height: number): THREE.Vector3 {
    const boundedOrigin = origin.clone();
    boundedOrigin.x = THREE.MathUtils.clamp(boundedOrigin.x, -this.WORLD_LIMIT + radius, this.WORLD_LIMIT - radius);
    boundedOrigin.z = THREE.MathUtils.clamp(boundedOrigin.z, -this.WORLD_LIMIT + radius, this.WORLD_LIMIT - radius);
    const offsets = [
      new THREE.Vector3(0, 0, 0), new THREE.Vector3(2.2, 0, 0), new THREE.Vector3(-2.2, 0, 0),
      new THREE.Vector3(0, 0, 2.2), new THREE.Vector3(0, 0, -2.2), new THREE.Vector3(1.6, 0, 1.6),
      new THREE.Vector3(-1.6, 0, 1.6), new THREE.Vector3(1.6, 0, -1.6), new THREE.Vector3(-1.6, 0, -1.6),
    ];
    // Saved positions and travel destinations can be inside a newly streamed building.
    // Search beyond the immediate footstep offsets before falling back to wall resolution.
    for (let distance = 4.4; distance <= 35.2; distance += 4.4) {
      for (let direction = 0; direction < 16; direction++) {
        const angle = direction * Math.PI / 8;
        offsets.push(new THREE.Vector3(Math.cos(angle) * distance, 0, Math.sin(angle) * distance));
      }
    }
    for (const offset of offsets) {
      const candidate = boundedOrigin.clone().add(offset);
      if (Math.abs(candidate.x) + radius > this.WORLD_LIMIT || Math.abs(candidate.z) + radius > this.WORLD_LIMIT) continue;
      const ground = this.getGroundHeightAt(candidate.x, candidate.z, candidate.y);
      candidate.y = ground.height;
      if (this.isPositionClear(candidate, radius, height)) return candidate;
    }
    const resolved = this.resolveHorizontal(boundedOrigin, radius, height);
    return resolved.setY(this.getGroundHeightAt(resolved.x, resolved.z, resolved.y).height);
  }

  /**
   * Resolves horizontal displacement with wall sliding and returns valid position.
   */
  public static resolveHorizontal(
    currentPos: THREE.Vector3,
    radius: number,
    playerHeight: number,
    previousPos?: THREE.Vector3
  ): THREE.Vector3 {
    if (previousPos) {
      const distance = Math.hypot(currentPos.x - previousPos.x, currentPos.z - previousPos.z);
      const steps = Math.max(1, Math.ceil(distance / Math.max(0.1, radius * 0.5)));
      if (steps > 1) {
        let position = previousPos.clone().setY(currentPos.y);
        const stepX = (currentPos.x - previousPos.x) / steps;
        const stepZ = (currentPos.z - previousPos.z) / steps;
        for (let step = 0; step < steps; step++) {
          position.x += stepX;
          position.z += stepZ;
          position = this.resolveHorizontal(position, radius, playerHeight);
        }
        return position;
      }
    }
    const resolved = currentPos.clone();
    const playerMinY = resolved.y;
    const playerMaxY = resolved.y + playerHeight;

    // 24x24 chunks at 120m = 2880m expanse (-1440m to +1440m). Bound player safely within active world substrate.
    const worldLimit = this.WORLD_LIMIT - radius;
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
        if (rampH > groundHeight && currentY >= rampH - 0.6) {
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
