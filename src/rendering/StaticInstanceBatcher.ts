import * as THREE from 'three';
import type { TreeDef } from '../city/VegetationGenerator';

export interface BuiltInstanceBucket {
  matrices: Float32Array;
  colors: Float32Array | null;
  count: number;
}

export interface TreeBucketKeys {
  planterPlinth: string;
  planterCoping: string;
  soilBed: string;
  planterTrim: string;
  mound: string;
  rootFlare: string;
  trunk: string;
  branch: string;
  foliage: string;
}

const _parentMat = new THREE.Matrix4();
const _localMat = new THREE.Matrix4();
const _finalMat = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _scale = new THREE.Vector3();
const _color = new THREE.Color();
const _upAxis = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();
const _start = new THREE.Vector3();
const _end = new THREE.Vector3();
const _mid = new THREE.Vector3();

interface MutableBucket {
  matrices: number[];
  colors: number[] | null;
  count: number;
}

/**
 * High-performance static geometry batch collector that merges thousands of
 * architectural sub-meshes, streetlights, props, and trees into a small fixed
 * set of GPU InstancedMesh buckets (cutting 4,000-10,000+ draw calls to < 60).
 */
export class InstanceBatchBuilder {
  private readonly buckets = new Map<string, MutableBucket>();

  private getBucket(key: string, hasColor: boolean): MutableBucket {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = {
        matrices: [],
        colors: hasColor ? [] : null,
        count: 0,
      };
      this.buckets.set(key, bucket);
    } else if (hasColor && !bucket.colors) {
      // Backfill white for any earlier instances in this bucket
      bucket.colors = [];
      for (let i = 0; i < bucket.count; i++) {
        bucket.colors.push(1, 1, 1);
      }
    }
    return bucket;
  }

  private pushMatrix(key: string, mat: THREE.Matrix4, colorHex?: string): void {
    const hasColor = colorHex !== undefined;
    const bucket = this.getBucket(key, hasColor);
    const e = mat.elements;
    bucket.matrices.push(
      e[0], e[1], e[2], e[3],
      e[4], e[5], e[6], e[7],
      e[8], e[9], e[10], e[11],
      e[12], e[13], e[14], e[15]
    );
    if (bucket.colors) {
      if (colorHex !== undefined) {
        _color.set(colorHex);
        bucket.colors.push(_color.r, _color.g, _color.b);
      } else {
        bucket.colors.push(1, 1, 1);
      }
    }
    bucket.count += 1;
  }

  public addWorld(
    key: string,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    rx: number = 0,
    ry: number = 0,
    rz: number = 0,
    colorHex?: string
  ): void {
    _pos.set(x, y, z);
    _euler.set(rx, ry, rz, 'XYZ');
    _quat.setFromEuler(_euler);
    _scale.set(sx, sy, sz);
    _finalMat.compose(_pos, _quat, _scale);
    this.pushMatrix(key, _finalMat, colorHex);
  }

  public addLocal(
    key: string,
    px: number,
    py: number,
    pz: number,
    parentRotY: number,
    lx: number,
    ly: number,
    lz: number,
    sx: number,
    sy: number,
    sz: number,
    lrx: number = 0,
    lry: number = 0,
    lrz: number = 0,
    colorHex?: string
  ): void {
    if (parentRotY === 0) {
      this.addWorld(key, px + lx, py + ly, pz + lz, sx, sy, sz, lrx, lry, lrz, colorHex);
      return;
    }

    _pos.set(px, py, pz);
    _euler.set(0, parentRotY, 0, 'XYZ');
    _quat.setFromEuler(_euler);
    _scale.set(1, 1, 1);
    _parentMat.compose(_pos, _quat, _scale);

    _pos.set(lx, ly, lz);
    _euler.set(lrx, lry, lrz, 'XYZ');
    _quat.setFromEuler(_euler);
    _scale.set(sx, sy, sz);
    _localMat.compose(_pos, _quat, _scale);

    _finalMat.multiplyMatrices(_parentMat, _localMat);
    this.pushMatrix(key, _finalMat, colorHex);
  }

  public addSegment(
    key: string,
    x1: number,
    y1: number,
    z1: number,
    x2: number,
    y2: number,
    z2: number,
    radius: number,
    colorHex?: string
  ): void {
    _start.set(x1, y1, z1);
    _end.set(x2, y2, z2);
    _dir.subVectors(_end, _start);
    const len = _dir.length();
    if (len < 1e-4) return;
    _dir.multiplyScalar(1 / len);
    _mid.addVectors(_start, _end).multiplyScalar(0.5);
    _quat.setFromUnitVectors(_upAxis, _dir);
    _scale.set(radius, len, radius);
    _finalMat.compose(_mid, _quat, _scale);
    this.pushMatrix(key, _finalMat, colorHex);
  }

  public addTree(tree: TreeDef, keys: TreeBucketKeys): void {
    const tx = tree.position.x;
    const ty = tree.position.y;
    const tz = tree.position.z;
    const px = tree.planterSize.x;
    const py = tree.planterSize.y;
    const pz = tree.planterSize.z;

    if (tree.hasPlanter) {
      this.addWorld(keys.planterPlinth, tx, ty + py * 0.2, tz, px + 0.18, py * 0.4, pz + 0.18);
      this.addWorld(keys.planterPlinth, tx, ty + py * 0.62, tz, px, py * 0.56, pz);
      this.addWorld(keys.planterCoping, tx, ty + py * 0.94, tz, px + 0.1, 0.07, pz + 0.1);
      this.addWorld(keys.soilBed, tx, ty + py * 0.96, tz, px * 0.84, 0.05, pz * 0.84);
      this.addWorld(
        keys.planterTrim,
        tx,
        ty + py * 0.74,
        tz,
        px + 0.03,
        0.032,
        pz + 0.03,
        0,
        0,
        0,
        tree.emissiveColor || '#f59e0b'
      );
    } else {
      this.addWorld(keys.mound, tx, ty + 0.07, tz, 1, 1, 1);
    }

    this.addWorld(
      keys.rootFlare,
      tx,
      ty + (tree.hasPlanter ? py + 0.18 : 0.25),
      tz,
      tree.trunkRadius * 1.08,
      1.0,
      tree.trunkRadius * 1.08
    );

    this.addWorld(
      keys.trunk,
      tx,
      ty + tree.trunkHeight * 0.5,
      tz,
      tree.trunkRadius,
      tree.trunkHeight,
      tree.trunkRadius
    );

    for (let i = 0; i < tree.branches.length; i++) {
      const b = tree.branches[i];
      this.addSegment(
        keys.branch,
        tx + b.start.x,
        ty + b.start.y,
        tz + b.start.z,
        tx + b.end.x,
        ty + b.end.y,
        tz + b.end.z,
        b.radius
      );
    }

    for (let i = 0; i < tree.leafClusters.length; i++) {
      const lc = tree.leafClusters[i];
      this.addWorld(
        keys.foliage,
        tx + lc.offset.x,
        ty + lc.offset.y,
        tz + lc.offset.z,
        lc.scale.x,
        lc.scale.y,
        lc.scale.z,
        0,
        0,
        0,
        lc.color
      );
    }
  }

  public build(): Map<string, BuiltInstanceBucket> {
    const result = new Map<string, BuiltInstanceBucket>();
    for (const [key, b] of this.buckets.entries()) {
      if (b.count === 0) continue;
      result.set(key, {
        matrices: new Float32Array(b.matrices),
        colors: b.colors ? new Float32Array(b.colors) : null,
        count: b.count,
      });
    }
    return result;
  }

  public getBucketCount(): number {
    let n = 0;
    for (const b of this.buckets.values()) {
      if (b.count > 0) n++;
    }
    return n;
  }

  public getTotalInstanceCount(): number {
    let total = 0;
    for (const b of this.buckets.values()) {
      total += b.count;
    }
    return total;
  }
}

/**
 * Caps internal bloom pyramid resolution on high-DPI tablets and 1440p/4K screens
 * to cut fragment bandwidth 3x-4x while keeping mip 4 large enough (>= 20px) so
 * distant lights remain smoothly circular without square/cube artifacts.
 */
export function computeCappedBloomResolution(
  rtWidth: number,
  rtHeight: number,
  maxLongEdge: number = 1152
): { width: number; height: number } {
  const safeW = Math.max(2, Math.round(rtWidth));
  const safeH = Math.max(2, Math.round(rtHeight));
  const longEdge = Math.max(safeW, safeH);
  if (longEdge <= maxLongEdge) {
    return { width: safeW, height: safeH };
  }
  const scale = maxLongEdge / longEdge;
  return {
    width: Math.max(2, Math.round(safeW * scale)),
    height: Math.max(2, Math.round(safeH * scale)),
  };
}
