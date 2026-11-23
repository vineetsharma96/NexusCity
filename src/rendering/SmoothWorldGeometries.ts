import * as THREE from 'three';

/**
 * Shared Smooth Architectural & Organic Procedural Geometries
 *
 * Replaces razor-sharp raw cubes and faceted low-poly foliage across the world
 * with smooth chamfered/beveled prisms, rounded structural blocks, organic
 * multi-lobed foliage canopies, and compound-curved transit/hovercraft hulls —
 * all GPU-instanceable so FPS stays high while every surface catches smooth specular light.
 */

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Generates a unit-sized ([-0.5..0.5]^3) smooth rounded/beveled box by inflating
 * a subdivided cube onto a superellipsoid-chamfered shell with clean planar face UVs
 * and smooth welded vertex normals. Ideal for podiums, canopies, benches, kiosks,
 * curbs, and architectural trims.
 */
export function createSmoothBeveledBoxGeometry(
  bevelRadius: number = 0.065,
  segments: number = 3,
): THREE.BufferGeometry {
  const r = clamp(bevelRadius, 0.015, 0.22);
  const inner = 0.5 - r;
  const geo = new THREE.BoxGeometry(1, 1, 1, segments, segments, segments);
  const pos = geo.getAttribute('position');
  const norm = geo.getAttribute('normal');

  const p = new THREE.Vector3();
  const c = new THREE.Vector3();
  const d = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    p.set(pos.getX(i), pos.getY(i), pos.getZ(i));
    c.set(
      clamp(p.x, -inner, inner),
      clamp(p.y, -inner, inner),
      clamp(p.z, -inner, inner),
    );
    d.subVectors(p, c);
    const len = d.length();
    if (len > 1e-5) {
      d.divideScalar(len);
      p.copy(c).addScaledVector(d, r);
      pos.setXYZ(i, p.x, p.y, p.z);
      norm.setXYZ(i, d.x, d.y, d.z);
    }
  }

  pos.needsUpdate = true;
  norm.needsUpdate = true;
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

/**
 * Generates a smooth chamfered architectural tower prism ([-0.5..0.5]^3) with
 * softly rounded vertical corners and top/bottom cornice fillets, while keeping
 * distortion-free vertical curtain-wall UVs so skyscraper windows render razor-sharp
 * and catch smooth grazing specular highlights along every tower corner.
 */
export function createSmoothBuildingPrismGeometry(
  cornerBevel: number = 0.032,
  cornerSegments: number = 2,
): THREE.BufferGeometry {
  const r = clamp(cornerBevel, 0.01, 0.12);
  const half = 0.5;
  const inner = half - r;

  // Build 2D rounded-square perimeter cross-section in XZ (CCW from top)
  const ringPts: { x: number; z: number; nx: number; nz: number; u: number }[] = [];
  const corners: [number, number, number][] = [
    [inner, inner, 0], // +X, +Z corner: angle 0 -> PI/2
    [-inner, inner, Math.PI * 0.5], // -X, +Z
    [-inner, -inner, Math.PI], // -X, -Z
    [inner, -inner, Math.PI * 1.5], // +X, -Z
  ];

  // Collect ring points around the 4 sides + rounded corners
  const rawPts: { x: number; z: number; nx: number; nz: number }[] = [];
  for (let c = 0; c < 4; c++) {
    const [cx, cz, startAng] = corners[c];
    for (let s = 0; s <= cornerSegments; s++) {
      const ang = startAng + (s / cornerSegments) * (Math.PI * 0.5);
      const nx = Math.cos(ang);
      const nz = Math.sin(ang);
      rawPts.push({
        x: cx + nx * r,
        z: cz + nz * r,
        nx,
        nz,
      });
    }
  }
  // Close perimeter seam for seamless UVs
  rawPts.push({ ...rawPts[0] });

  // Compute cumulative perimeter U coordinate (maps 0..4 around the 4 tower faces -> 1 full texture per face!)
  let totalPerim = 0;
  const cumLen = [0];
  for (let i = 1; i < rawPts.length; i++) {
    totalPerim += Math.hypot(rawPts[i].x - rawPts[i - 1].x, rawPts[i].z - rawPts[i - 1].z);
    cumLen.push(totalPerim);
  }
  for (let i = 0; i < rawPts.length; i++) {
    ringPts.push({
      ...rawPts[i],
      u: (cumLen[i] / totalPerim) * 4.0,
    });
  }

  const ringCount = ringPts.length;
  // 4 vertical rings for smooth top/bottom micro-chamfer + clean flat mid-facade
  const yBevel = 0.014;
  const yProfile: [number, number, number][] = [
    // [y, insetScale, v]
    [-0.5, 1.0 - yBevel, 0.0],
    [-0.5 + yBevel, 1.0, 0.015],
    [0.5 - yBevel, 1.0, 0.985],
    [0.5, 1.0 - yBevel, 1.0],
  ];

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let row = 0; row < yProfile.length; row++) {
    const [y, scaleXZ, v] = yProfile[row];
    const ny = row === 0 ? -0.45 : row === yProfile.length - 1 ? 0.45 : 0;
    const nScale = Math.sqrt(Math.max(0.01, 1 - ny * ny));
    for (let i = 0; i < ringCount; i++) {
      const pt = ringPts[i];
      positions.push(pt.x * scaleXZ, y, pt.z * scaleXZ);
      normals.push(pt.nx * nScale, ny, pt.nz * nScale);
      uvs.push(pt.u, v);
    }
  }

  for (let row = 0; row < yProfile.length - 1; row++) {
    const baseA = row * ringCount;
    const baseB = (row + 1) * ringCount;
    for (let i = 0; i < ringCount - 1; i++) {
      const a = baseA + i;
      const b = baseA + i + 1;
      const c = baseB + i + 1;
      const d = baseB + i;
      // Outward CCW winding
      indices.push(a, d, b, b, d, c);
    }
  }

  // Flat top roof cap & bottom cap
  const addCap = (y: number, scaleXZ: number, normalY: number) => {
    const centerIdx = positions.length / 3;
    positions.push(0, y, 0);
    normals.push(0, normalY, 0);
    uvs.push(0.5, 0.5);
    const startIdx = positions.length / 3;
    for (let i = 0; i < ringCount; i++) {
      const pt = ringPts[i];
      positions.push(pt.x * scaleXZ, y, pt.z * scaleXZ);
      normals.push(0, normalY, 0);
      uvs.push(pt.x + 0.5, pt.z + 0.5);
    }
    for (let i = 0; i < ringCount - 1; i++) {
      if (normalY > 0) {
        indices.push(centerIdx, startIdx + i + 1, startIdx + i);
      } else {
        indices.push(centerIdx, startIdx + i, startIdx + i + 1);
      }
    }
  };

  addCap(0.5, 1.0 - yBevel, 1);
  addCap(-0.5, 1.0 - yBevel, -1);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

/**
 * Generates a smooth, organic multi-lobed botanical foliage canopy (zero flat-shaded faceting)
 * by gently sculpting a subdivided sphere with harmonic foliage billows and smooth normals.
 */
export function createSmoothFoliageCrownGeometry(): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(1.0, 2);
  const pos = geo.getAttribute('position');
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
    const dir = v.clone().normalize();
    // Organic multi-lobe botanical canopy contour (subtle dome fullness + soft billowing)
    const lobe1 = Math.sin(dir.x * 3.1 + dir.z * 2.4) * 0.085;
    const lobe2 = Math.cos(dir.y * 2.8 - dir.x * 2.2) * 0.07;
    const lobe3 = Math.sin(dir.z * 3.7 + dir.y * 1.9) * 0.055;
    const bottomFlatten = dir.y < -0.25 ? (dir.y + 0.25) * 0.22 : 0;
    const radius = 1.0 + lobe1 + lobe2 + lobe3 + bottomFlatten;
    pos.setXYZ(i, dir.x * radius, dir.y * radius * 0.88, dir.z * radius);
  }

  pos.needsUpdate = true;
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

/**
 * Generates a sleek, compound-curved sculpted monocoque hull & canopy for the
 * city-wide rideable hover-coupes (replacing boxy stacked rectangular prisms).
 */
export function createSmoothHoverCoupeGeometry(): {
  hullGeo: THREE.BufferGeometry;
  canopyGeo: THREE.BufferGeometry;
} {
  const segZ = 24;
  const segR = 20;
  const halfLen = 1.85;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let iz = 0; iz <= segZ; iz++) {
    const t = iz / segZ; // 0 = rear (-Z), 1 = nose (+Z)
    const z = -halfLen + t * halfLen * 2;

    // Aerodynamic teardrop planform width
    const noseTaper = 1 - 0.52 * Math.pow(smoothstep(0.62, 1.0, t), 1.6);
    const tailTaper = 1 - 0.18 * Math.pow(1 - smoothstep(0.0, 0.28, t), 1.5);
    const haunch = 0.08 * Math.exp(-Math.pow((t - 0.28) / 0.16, 2));
    const halfW = 0.94 * noseTaper * tailTaper + haunch;

    // Sculpted lower belly & upper deck curve
    const yBot = -0.18 + 0.14 * Math.pow(smoothstep(0.75, 1.0, t), 1.8) + 0.08 * (1 - smoothstep(0.0, 0.18, t));
    const deckH =
      0.24 +
      0.16 * Math.exp(-Math.pow((t - 0.44) / 0.26, 2)) -
      0.16 * Math.pow(smoothstep(0.68, 1.0, t), 1.4);

    const midY = (yBot + deckH) * 0.5;
    const halfH = Math.max(0.04, (deckH - yBot) * 0.5);

    for (let ir = 0; ir <= segR; ir++) {
      const a = (ir / segR) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      // Smooth superellipse cross-section
      const sx = Math.sign(ca) * Math.pow(Math.abs(ca), 0.72);
      const sy = Math.sign(sa) * Math.pow(Math.abs(sa), 0.78);
      const x = sx * halfW;
      const y = midY + sy * halfH;
      positions.push(x, y, z);
      uvs.push(ir / segR, t);
    }
  }

  const stride = segR + 1;
  for (let iz = 0; iz < segZ; iz++) {
    for (let ir = 0; ir < segR; ir++) {
      const a = iz * stride + ir;
      const b = a + 1;
      const c = (iz + 1) * stride + ir + 1;
      const d = (iz + 1) * stride + ir;
      indices.push(a, d, b, b, d, c);
    }
  }

  // Close rear (-Z) and front (+Z) end caps cleanly
  const rearCenterIdx = positions.length / 3;
  positions.push(0, 0.04, -halfLen - 0.04);
  uvs.push(0.5, 0);
  for (let ir = 0; ir < segR; ir++) {
    indices.push(rearCenterIdx, ir, ir + 1);
  }
  const frontCenterIdx = positions.length / 3;
  positions.push(0, 0.02, halfLen + 0.06);
  uvs.push(0.5, 1);
  const frontRingStart = segZ * stride;
  for (let ir = 0; ir < segR; ir++) {
    indices.push(frontCenterIdx, frontRingStart + ir + 1, frontRingStart + ir);
  }

  const hullGeo = new THREE.BufferGeometry();
  hullGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  hullGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  hullGeo.setIndex(indices);
  hullGeo.computeVertexNormals();
  hullGeo.computeBoundingBox();
  hullGeo.computeBoundingSphere();

  // Streamlined teardrop panoramic glass canopy (SphereGeometry.scale preserves exact analytical pole normals)
  const canopyGeo = new THREE.SphereGeometry(0.66, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.52);
  canopyGeo.scale(1.02, 0.56, 1.65);
  canopyGeo.translate(0, 0.19, -0.08);
  canopyGeo.computeBoundingBox();
  canopyGeo.computeBoundingSphere();

  return { hullGeo, canopyGeo };
}

/**
 * Generates a sleek, smooth bullet-train-inspired monocoque hull and curved panoramic
 * greenhouse for the Autonomous Mag-Shuttle (replacing boxy stacked cubes).
 */
export function createSmoothMagShuttleGeometry(): {
  hullGeo: THREE.BufferGeometry;
  cabinGeo: THREE.BufferGeometry;
} {
  const segZ = 24;
  const segR = 20;
  const halfLen = 2.6;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let iz = 0; iz <= segZ; iz++) {
    const t = iz / segZ;
    const z = -halfLen + t * halfLen * 2;
    const endTaper =
      1 -
      0.34 * Math.pow(smoothstep(0.76, 1.0, t), 1.8) -
      0.34 * Math.pow(1 - smoothstep(0.0, 0.24, t), 1.8);
    const halfW = 1.08 * endTaper;
    const halfH = 0.44 * (0.78 + 0.22 * endTaper);

    for (let ir = 0; ir <= segR; ir++) {
      const a = (ir / segR) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const sx = Math.sign(ca) * Math.pow(Math.abs(ca), 0.6);
      const sy = Math.sign(sa) * Math.pow(Math.abs(sa), 0.62);
      positions.push(sx * halfW, 0.04 + sy * halfH, z);
      uvs.push(ir / segR, t);
    }
  }

  const stride = segR + 1;
  for (let iz = 0; iz < segZ; iz++) {
    for (let ir = 0; ir < segR; ir++) {
      const a = iz * stride + ir;
      const b = a + 1;
      const c = (iz + 1) * stride + ir + 1;
      const d = (iz + 1) * stride + ir;
      indices.push(a, d, b, b, d, c);
    }
  }

  // Close rear (-Z) and front (+Z) aerodynamic bullet noses
  const rearCenterIdx = positions.length / 3;
  positions.push(0, 0.04, -halfLen - 0.14);
  uvs.push(0.5, 0);
  for (let ir = 0; ir < segR; ir++) {
    indices.push(rearCenterIdx, ir, ir + 1);
  }
  const frontCenterIdx = positions.length / 3;
  positions.push(0, 0.04, halfLen + 0.14);
  uvs.push(0.5, 1);
  const frontRingStart = segZ * stride;
  for (let ir = 0; ir < segR; ir++) {
    indices.push(frontCenterIdx, frontRingStart + ir + 1, frontRingStart + ir);
  }

  const hullGeo = new THREE.BufferGeometry();
  hullGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  hullGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  hullGeo.setIndex(indices);
  hullGeo.computeVertexNormals();
  hullGeo.computeBoundingBox();
  hullGeo.computeBoundingSphere();

  const cabinGeo = createSmoothBeveledBoxGeometry(0.14, 3);
  cabinGeo.scale(1.88, 0.42, 3.65);
  cabinGeo.translate(0, 0.5, 0);
  cabinGeo.computeBoundingBox();
  cabinGeo.computeBoundingSphere();

  return { hullGeo, cabinGeo };
}
