import * as THREE from 'three';

export interface CollisionBox {
  min: THREE.Vector3;
  max: THREE.Vector3;
}

export class KinematicCollisionSolver {
  public static readonly WORLD_HALF_EXTENT = 1380;
  public static boxes: CollisionBox[] = [];
  private static chunkBoxes = new Map<string, CollisionBox[]>();

  public static clear(): void {
    this.boxes = [];
    this.chunkBoxes.clear();
  }

  public static addBox(center: THREE.Vector3, size: THREE.Vector3): CollisionBox {
    const half = size.clone().multiplyScalar(0.5);
    const box: CollisionBox = {
      min: center.clone().sub(half),
      max: center.clone().add(half),
    };
    this.boxes.push(box);
    return box;
  }

  public static removeBox(center: THREE.Vector3, epsilon: number = 0.05): void {
    this.boxes = this.boxes.filter((b) => {
      const midX = (b.min.x + b.max.x) * 0.5;
      const midY = (b.min.y + b.max.y) * 0.5;
      const midZ = (b.min.z + b.max.z) * 0.5;
      return Math.hypot(midX - center.x, midY - center.y, midZ - center.z) > epsilon;
    });
  }

  public static setChunkBoxes(chunkKey: string, boxes: CollisionBox[]): void {
    this.chunkBoxes.set(chunkKey, boxes);
  }

  public static removeChunkBoxes(chunkKey: string): void {
    this.chunkBoxes.delete(chunkKey);
  }

  public static getAllBoxes(): CollisionBox[] {
    const all = [...this.boxes];
    for (const chunkList of this.chunkBoxes.values()) {
      for (let i = 0; i < chunkList.length; i++) {
        all.push(chunkList[i]);
      }
    }
    return all;
  }

  private static resolveStep(pos: THREE.Vector3, radius: number, height: number, allBoxes: CollisionBox[]): THREE.Vector3 {
    const resolved = pos.clone();
    const playerMinY = resolved.y + 0.25;
    const playerMaxY = resolved.y + height;

    for (const box of allBoxes) {
      if (playerMaxY <= box.min.y || playerMinY >= box.max.y) continue;

      const closestX = Math.max(box.min.x, Math.min(resolved.x, box.max.x));
      const closestZ = Math.max(box.min.z, Math.min(resolved.z, box.max.z));
      const dx = resolved.x - closestX;
      const dz = resolved.z - closestZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < radius * radius) {
        const dist = Math.sqrt(distSq);
        if (dist > 0.0001) {
          const overlap = radius - dist;
          resolved.x += (dx / dist) * overlap;
          resolved.z += (dz / dist) * overlap;
        } else {
          const dLeft = Math.abs(resolved.x - box.min.x);
          const dRight = Math.abs(box.max.x - resolved.x);
          const dFront = Math.abs(resolved.z - box.min.z);
          const dBack = Math.abs(box.max.z - resolved.z);
          const minD = Math.min(dLeft, dRight, dFront, dBack);

          if (minD === dLeft) resolved.x = box.min.x - radius;
          else if (minD === dRight) resolved.x = box.max.x + radius;
          else if (minD === dFront) resolved.z = box.min.z - radius;
          else resolved.z = box.max.z + radius;
        }
      }
    }

    const limit = this.WORLD_HALF_EXTENT - radius;
    resolved.x = THREE.MathUtils.clamp(resolved.x, -limit, limit);
    resolved.z = THREE.MathUtils.clamp(resolved.z, -limit, limit);
    return resolved;
  }

  public static resolveHorizontal(
    pos: THREE.Vector3,
    radius: number,
    height: number = 1.8,
    previousPos?: THREE.Vector3
  ): THREE.Vector3 {
    const allBoxes = this.getAllBoxes();
    if (!previousPos) {
      return this.resolveStep(pos, radius, height, allBoxes);
    }

    const deltaX = pos.x - previousPos.x;
    const deltaZ = pos.z - previousPos.z;
    const distance = Math.hypot(deltaX, deltaZ);
    const maxStep = Math.max(0.05, radius * 0.45);
    const steps = Math.max(1, Math.ceil(distance / maxStep));
    const current = previousPos.clone();
    current.y = pos.y;

    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const candidate = new THREE.Vector3(previousPos.x + deltaX * t, pos.y, previousPos.z + deltaZ * t);
      const next = this.resolveStep(candidate, radius, height, allBoxes);
      current.copy(next);
      if (Math.hypot(next.x - candidate.x, next.z - candidate.z) > 1e-4) {
        return this.resolveStep(current, radius, height, allBoxes);
      }
    }
    return current;
  }

  public static isPositionClear(pos: THREE.Vector3, radius: number = 0.45, height: number = 1.8): boolean {
    const resolved = this.resolveHorizontal(pos, radius, height);
    return Math.hypot(resolved.x - pos.x, resolved.z - pos.z) < 1e-4;
  }

  public static findSafePosition(pos: THREE.Vector3, radius: number = 0.45, height: number = 1.8): THREE.Vector3 {
    const limit = this.WORLD_HALF_EXTENT - radius;
    const start = new THREE.Vector3(
      THREE.MathUtils.clamp(pos.x, -limit, limit),
      Math.max(0, pos.y),
      THREE.MathUtils.clamp(pos.z, -limit, limit)
    );
    const resolvedStart = this.resolveHorizontal(start, radius, height);
    if (this.isPositionClear(resolvedStart, radius, height)) {
      const ground = this.getGroundHeightAt(resolvedStart.x, resolvedStart.z, resolvedStart.y);
      resolvedStart.y = Math.max(ground.height, resolvedStart.y);
      return resolvedStart;
    }

    for (let ring = 2; ring <= 48; ring += 2) {
      for (let step = 0; step < 16; step++) {
        const angle = (step / 16) * Math.PI * 2;
        const candidate = new THREE.Vector3(
          THREE.MathUtils.clamp(start.x + Math.cos(angle) * ring, -limit, limit),
          start.y,
          THREE.MathUtils.clamp(start.z + Math.sin(angle) * ring, -limit, limit)
        );
        if (this.isPositionClear(candidate, radius, height)) {
          const ground = this.getGroundHeightAt(candidate.x, candidate.z, candidate.y);
          candidate.y = Math.max(ground.height, candidate.y);
          return candidate;
        }
      }
    }
    return new THREE.Vector3(0, 0.2, 10);
  }

  public static getCeilingHeightAt(x: number, z: number, currentY: number, radius: number, height: number): number {
    let ceiling = Infinity;
    const topY = currentY + height;
    const allBoxes = this.getAllBoxes();

    for (const box of allBoxes) {
      if (box.min.y < topY - 0.15) continue;
      const closestX = Math.max(box.min.x, Math.min(x, box.max.x));
      const closestZ = Math.max(box.min.z, Math.min(z, box.max.z));
      const dx = x - closestX;
      const dz = z - closestZ;
      if (dx * dx + dz * dz < radius * radius) {
        ceiling = Math.min(ceiling, box.min.y);
      }
    }
    return ceiling;
  }

  public static getGroundHeightAt(
    x: number,
    z: number,
    currentY: number = 0
  ): { height: number; surface: 'ASPHALT' | 'SIDEWALK' | 'PARK' } {
    let height = 0.0;
    let surface: 'ASPHALT' | 'SIDEWALK' | 'PARK' = 'ASPHALT';

    if (x >= 40 && x <= 110 && z >= 40 && z <= 110) {
      height = 0.2;
      surface = 'PARK';
    } else if (Math.abs(x) > 7.2 && Math.abs(z) > 7.2 && Math.abs(Math.abs(z) - 75) > 6.2) {
      height = 0.2;
      surface = 'SIDEWALK';
    }

    const allBoxes = this.getAllBoxes();
    for (const box of allBoxes) {
      if (x >= box.min.x && x <= box.max.x && z >= box.min.z && z <= box.max.z) {
        if (box.max.y <= currentY + 0.55 && box.max.y > height) {
          height = box.max.y;
          surface = 'SIDEWALK';
        }
      }
    }

    return { height, surface };
  }
}
