import * as THREE from 'three';

export type TrafficCarArchetype = 'SEDAN' | 'SUV' | 'COUPE' | 'VAN';

export interface TrafficCarModelSet {
  archetype: TrafficCarArchetype;
  bodyGeo: THREE.BufferGeometry;
  glassGeo: THREE.BufferGeometry;
  wheelsGeo: THREE.BufferGeometry;
  headlightGeo: THREE.BufferGeometry;
  taillightGeo: THREE.BufferGeometry;
  length: number;
  width: number;
  height: number;
  wheelRadius: number;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function gaussian(x: number, center: number, sigma: number): number {
  const d = (x - center) / sigma;
  return Math.exp(-0.5 * d * d);
}

/**
 * Merges multiple indexed or non-indexed BufferGeometries (matching position + normal + uv) into a single
 * GPU-friendly BufferGeometry so each vehicle archetype renders in minimal instanced draw calls.
 */
function mergeGeometriesSimple(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let totalVerts = 0;
  let totalIndices = 0;

  for (const g of geos) {
    const pos = g.getAttribute('position');
    totalVerts += pos.count;
    const idx = g.getIndex();
    totalIndices += idx ? idx.count : pos.count;
  }

  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const indices = new Uint32Array(totalIndices);

  let vOffset = 0;
  let iOffset = 0;

  for (const g of geos) {
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    const pos = g.getAttribute('position');
    const norm = g.getAttribute('normal');
    const idx = g.getIndex();

    for (let i = 0; i < pos.count; i++) {
      const dst = (vOffset + i) * 3;
      positions[dst] = pos.getX(i);
      positions[dst + 1] = pos.getY(i);
      positions[dst + 2] = pos.getZ(i);
      normals[dst] = norm.getX(i);
      normals[dst + 1] = norm.getY(i);
      normals[dst + 2] = norm.getZ(i);
    }

    if (idx) {
      for (let i = 0; i < idx.count; i++) {
        indices[iOffset + i] = idx.getX(i) + vOffset;
      }
      iOffset += idx.count;
    } else {
      for (let i = 0; i < pos.count; i++) {
        indices[iOffset + i] = vOffset + i;
      }
      iOffset += pos.count;
    }

    vOffset += pos.count;
    g.dispose();
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  merged.setIndex(new THREE.BufferAttribute(indices, 1));
  merged.computeBoundingSphere();
  return merged;
}

interface BodyProfileSpec {
  zMin: number;
  zMax: number;
  frontAxleZ: number;
  rearAxleZ: number;
  wheelRadius: number;
  wheelTrackHalf: number;
  wheelWidth: number;
  baseHalfWidth: number;
  floorY: number;
  sampleTopCenter: (z: number) => number;
  sampleHalfWidth: (z: number) => number;
  sampleTumblehome: (z: number, cosT: number) => number;
  upperPinchExp: number;
  shoulderCrease: number;
  canopyZBack: number;
  canopyZFront: number;
  canopyHeightBoost: number;
  canopyWidthScale: number;
  canopyRoofFlatness: number;
}

/**
 * Generates a continuous, smooth compound-curved welded monocoque body loft
 * with sculpted wheel arches (zero BoxGeometry primitives) for any traffic vehicle archetype.
 */
function buildSculptedBodyLoft(spec: BodyProfileSpec): THREE.BufferGeometry {
  const NZ = 36;
  const NU = 28;
  const { zMin, zMax, floorY, frontAxleZ, rearAxleZ, wheelRadius } = spec;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let iz = 0; iz <= NZ; iz++) {
    const t = iz / NZ;
    const sCos = 0.5 - 0.5 * Math.cos(t * Math.PI);
    const s = t * 0.62 + sCos * 0.38;
    const z = zMin + (zMax - zMin) * s;

    // Gentle bumper ground clearance uplift at nose and tail
    let yBot = floorY;
    if (z > frontAxleZ + 0.32) {
      yBot += smoothstep(frontAxleZ + 0.32, zMax, z) * 0.12;
    }
    if (z < rearAxleZ - 0.32) {
      yBot += smoothstep(rearAxleZ - 0.32, zMin, z) * 0.14;
    }

    const yTop = spec.sampleTopCenter(z);
    const halfW = spec.sampleHalfWidth(z);
    const yMid = (yBot + yTop) * 0.5;
    const halfH = Math.max(0.04, (yTop - yBot) * 0.5);
    const tipRound = smoothstep(0, 0.06, s) * smoothstep(1, 0.94, s);

    for (let iu = 0; iu < NU; iu++) {
      const theta = (iu / NU) * Math.PI * 2;
      const sinT = Math.sin(theta);
      const cosT = Math.cos(theta);
      const absSin = Math.abs(sinT);
      const signX = sinT >= 0 ? 1 : -1;

      const xShape = signX * Math.pow(absSin, cosT < 0 ? 0.72 : 0.86);
      const yShape = (cosT >= 0 ? 1 : -1) * Math.pow(Math.abs(cosT), cosT >= 0 ? spec.upperPinchExp : 0.66);
      const tumble = spec.sampleTumblehome(z, cosT);

      let x = xShape * halfW * tumble;
      let y = yMid + yShape * halfH;

      // Subtle sculpted beltline shoulder crease along the flanks
      if (absSin > 0.55 && cosT > -0.15 && cosT < 0.55) {
        const belt = gaussian(cosT, 0.18, 0.24) * smoothstep(0.55, 0.92, absSin) * tipRound;
        x += signX * belt * spec.shoulderCrease;
      }

      // Integrated circular wheel-arch cavities & subtle fender brows
      const axles = [frontAxleZ, rearAxleZ];
      const cavityR = wheelRadius + 0.075;
      for (const zAxle of axles) {
        const dz = z - zAxle;
        if (Math.abs(dz) < cavityR + 0.2 && absSin > 0.32) {
          const dy = y - wheelRadius;
          const dist = Math.hypot(dz, dy);
          if (dist < cavityR && dy < cavityR * 0.94) {
            const cavity = smoothstep(cavityR, cavityR * 0.72, dist);
            const targetMaxX = spec.wheelTrackHalf - spec.wheelWidth * 0.55;
            const curAbsX = Math.abs(x);
            if (curAbsX > targetMaxX) {
              x = signX * THREE.MathUtils.lerp(curAbsX, targetMaxX, cavity);
            }
          }
          const brow = gaussian(dist, cavityR + 0.04, 0.055) * smoothstep(-0.1, 0.22, dy);
          x += signX * brow * 0.042 * absSin;
        }
      }

      positions.push(x, y, z);
      uvs.push(iu / NU, iz / NZ);
    }
  }

  for (let iz = 0; iz < NZ; iz++) {
    const rowA = iz * NU;
    const rowB = (iz + 1) * NU;
    for (let iu = 0; iu < NU; iu++) {
      const iuNext = (iu + 1) % NU;
      indices.push(rowA + iu, rowB + iu, rowB + iuNext, rowA + iu, rowB + iuNext, rowA + iuNext);
    }
  }

  // Smooth rear bumper cap (-Z)
  const rearIdx = positions.length / 3;
  const rTop = spec.sampleTopCenter(zMin);
  positions.push(0, (floorY + 0.14 + rTop) * 0.5, zMin - 0.045);
  uvs.push(0.5, 0);
  for (let iu = 0; iu < NU; iu++) {
    indices.push(rearIdx, iu, (iu + 1) % NU);
  }

  // Smooth front bumper nose cap (+Z)
  const frontIdx = positions.length / 3;
  const fTop = spec.sampleTopCenter(zMax);
  positions.push(0, (floorY + 0.12 + fTop) * 0.5, zMax + 0.045);
  uvs.push(0.5, 1);
  const lastRow = NZ * NU;
  for (let iu = 0; iu < NU; iu++) {
    indices.push(frontIdx, lastRow + ((iu + 1) % NU), lastRow + iu);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

/**
 * Generates a flush wrap-around panoramic glass greenhouse shell seated cleanly over the beltline.
 */
function buildSculptedGreenhouse(spec: BodyProfileSpec): THREE.BufferGeometry {
  const NZ = 22;
  const NU = 22;
  const { canopyZBack, canopyZFront, canopyHeightBoost, canopyWidthScale, canopyRoofFlatness } = spec;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let iz = 0; iz <= NZ; iz++) {
    const t = iz / NZ;
    const z = canopyZBack + (canopyZFront - canopyZBack) * t;
    const baseY = spec.sampleTopCenter(z) - 0.06;
    const bodyHalfW = spec.sampleHalfWidth(z);

    // Smooth arch envelope: flat roof crown for SUV/VAN, sleek teardrop curve for SEDAN/COUPE
    const archRaw = Math.sin(Math.pow(t, 0.92) * Math.PI);
    const arch = Math.pow(Math.max(0, archRaw), canopyRoofFlatness);
    const crownY = baseY + arch * canopyHeightBoost;
    const halfW = bodyHalfW * canopyWidthScale * Math.pow(Math.max(0.01, Math.sin(t * Math.PI)), 0.34);

    for (let iu = 0; iu <= NU; iu++) {
      const v = iu / NU;
      const phi = (v - 0.5) * Math.PI;
      const sinP = Math.sin(phi);
      const cosP = Math.cos(phi);

      const x = sinP * halfW;
      const y = baseY + Math.pow(Math.max(0, cosP), 0.68) * (crownY - baseY);
      positions.push(x, y, z);
      uvs.push(v, t);
    }
  }

  const row = NU + 1;
  for (let iz = 0; iz < NZ; iz++) {
    for (let iu = 0; iu < NU; iu++) {
      const a = iz * row + iu;
      const b = (iz + 1) * row + iu;
      const c = (iz + 1) * row + (iu + 1);
      const d = iz * row + (iu + 1);
      indices.push(a, b, c, a, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

/**
 * Generates a single merged 4-wheel assembly of rounded-shoulder LatheGeometry tires
 * seated cleanly on the ground at y = 0.
 */
function buildFourWheelAssembly(spec: BodyProfileSpec): THREE.BufferGeometry {
  const r = spec.wheelRadius;
  const hw = spec.wheelWidth * 0.5;
  const rRim = r * 0.56;
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0.04, -hw * 0.72),
    new THREE.Vector2(rRim, -hw * 0.8),
    new THREE.Vector2(r * 0.92, -hw),
    new THREE.Vector2(r, -hw * 0.65),
    new THREE.Vector2(r, hw * 0.65),
    new THREE.Vector2(r * 0.92, hw),
    new THREE.Vector2(rRim, hw * 0.8),
    new THREE.Vector2(0.04, hw * 0.72),
  ];

  const baseWheel = new THREE.LatheGeometry(pts, 20);
  baseWheel.rotateZ(Math.PI / 2);

  const mounts: [number, number][] = [
    [spec.wheelTrackHalf, spec.frontAxleZ],
    [-spec.wheelTrackHalf, spec.frontAxleZ],
    [spec.wheelTrackHalf, spec.rearAxleZ],
    [-spec.wheelTrackHalf, spec.rearAxleZ],
  ];

  const clones = mounts.map(([x, z]) => {
    const c = baseWheel.clone();
    c.translate(x, r, z);
    return c;
  });
  baseWheel.dispose();
  return mergeGeometriesSimple(clones);
}

/**
 * Builds curved tubular LED headlight blades following the nose contour (+Z).
 */
function buildCurvedLightPair(
  zNose: number,
  yHeight: number,
  innerX: number,
  outerX: number,
  sweepZ: number,
  radius: number,
  isFullBar = false,
): THREE.BufferGeometry {
  if (isFullBar) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-outerX, yHeight, zNose - sweepZ),
      new THREE.Vector3(-outerX * 0.55, yHeight + 0.015, zNose),
      new THREE.Vector3(0, yHeight + 0.02, zNose + 0.03),
      new THREE.Vector3(outerX * 0.55, yHeight + 0.015, zNose),
      new THREE.Vector3(outerX, yHeight, zNose - sweepZ),
    ]);
    return new THREE.TubeGeometry(curve, 20, radius, 8, false);
  }

  const leftCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(innerX, yHeight, zNose),
    new THREE.Vector3((innerX + outerX) * 0.52, yHeight + 0.02, zNose - sweepZ * 0.4),
    new THREE.Vector3(outerX, yHeight + 0.035, zNose - sweepZ),
  ]);
  const rightCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-innerX, yHeight, zNose),
    new THREE.Vector3(-(innerX + outerX) * 0.52, yHeight + 0.02, zNose - sweepZ * 0.4),
    new THREE.Vector3(-outerX, yHeight + 0.035, zNose - sweepZ),
  ]);
  return mergeGeometriesSimple([
    new THREE.TubeGeometry(leftCurve, 10, radius, 8, false),
    new THREE.TubeGeometry(rightCurve, 10, radius, 8, false),
  ]);
}

const ARCHETYPE_SPECS: Record<TrafficCarArchetype, BodyProfileSpec> = {
  // 1. Executive Fastback Saloon (4.58m long, sleek 3-box silhouette)
  SEDAN: {
    zMin: -2.28,
    zMax: 2.3,
    frontAxleZ: 1.38,
    rearAxleZ: -1.36,
    wheelRadius: 0.35,
    wheelTrackHalf: 0.87,
    wheelWidth: 0.24,
    baseHalfWidth: 0.94,
    floorY: 0.21,
    sampleTopCenter: (z) => {
      if (z >= 0.88) {
        const u = clamp((z - 0.88) / (2.3 - 0.88), 0, 1);
        return 0.88 - Math.pow(u, 1.55) * 0.32;
      }
      if (z <= -1.25) {
        const u = clamp((-1.25 - z) / (2.28 - 1.25), 0, 1);
        return 0.94 - Math.pow(u, 1.45) * 0.16;
      }
      return 0.92 + gaussian(z, -0.18, 0.85) * 0.05;
    },
    sampleHalfWidth: (z) => {
      const nose = 1 - Math.pow(smoothstep(1.45, 2.3, z), 1.65) * 0.36;
      const tail = 1 - Math.pow(smoothstep(-1.45, -2.28, z), 1.65) * 0.26;
      return 0.94 * nose * tail;
    },
    sampleTumblehome: (_z, cosT) => (cosT > 0 ? 1 - Math.pow(cosT, 1.6) * 0.16 : 1 - Math.pow(-cosT, 2.2) * 0.06),
    upperPinchExp: 0.88,
    shoulderCrease: 0.032,
    canopyZBack: -1.42,
    canopyZFront: 1.06,
    canopyHeightBoost: 0.56,
    canopyWidthScale: 0.82,
    canopyRoofFlatness: 0.55,
  },

  // 2. Tall Sculpted Aero Crossover SUV (4.82m long, high ride height & commanding greenhouse)
  SUV: {
    zMin: -2.4,
    zMax: 2.42,
    frontAxleZ: 1.44,
    rearAxleZ: -1.42,
    wheelRadius: 0.41,
    wheelTrackHalf: 0.94,
    wheelWidth: 0.28,
    baseHalfWidth: 1.02,
    floorY: 0.28,
    sampleTopCenter: (z) => {
      if (z >= 0.95) {
        const u = clamp((z - 0.95) / (2.42 - 0.95), 0, 1);
        return 1.12 - Math.pow(u, 1.65) * 0.28;
      }
      if (z <= -1.95) {
        const u = clamp((-1.95 - z) / (2.4 - 1.95), 0, 1);
        return 1.16 - Math.pow(u, 1.4) * 0.16;
      }
      return 1.14 + gaussian(z, -0.35, 1.2) * 0.04;
    },
    sampleHalfWidth: (z) => {
      const nose = 1 - Math.pow(smoothstep(1.55, 2.42, z), 1.7) * 0.28;
      const tail = 1 - Math.pow(smoothstep(-1.75, -2.4, z), 1.8) * 0.18;
      return 1.02 * nose * tail;
    },
    sampleTumblehome: (_z, cosT) => (cosT > 0 ? 1 - Math.pow(cosT, 1.8) * 0.1 : 1 - Math.pow(-cosT, 2.2) * 0.08),
    upperPinchExp: 0.82,
    shoulderCrease: 0.042,
    canopyZBack: -2.06,
    canopyZFront: 1.12,
    canopyHeightBoost: 0.64,
    canopyWidthScale: 0.86,
    canopyRoofFlatness: 0.34,
  },

  // 3. Low-Slung Sport GT Fastback Coupe (4.42m long, pinched waist, wide rear hips)
  COUPE: {
    zMin: -2.2,
    zMax: 2.22,
    frontAxleZ: 1.34,
    rearAxleZ: -1.32,
    wheelRadius: 0.34,
    wheelTrackHalf: 0.91,
    wheelWidth: 0.27,
    baseHalfWidth: 0.98,
    floorY: 0.17,
    sampleTopCenter: (z) => {
      if (z >= 0.78) {
        const u = clamp((z - 0.78) / (2.22 - 0.78), 0, 1);
        return 0.76 - Math.pow(u, 1.38) * 0.34;
      }
      const ducktail = gaussian(z, -2.02, 0.22) * 0.07;
      return 0.78 - smoothstep(-0.6, -2.2, z) * 0.08 + ducktail;
    },
    sampleHalfWidth: (z) => {
      const nose = 1 - Math.pow(smoothstep(1.38, 2.22, z), 1.5) * 0.44;
      const tail = 1 - Math.pow(smoothstep(-1.42, -2.2, z), 1.55) * 0.26;
      const waist = -gaussian(z, 0.1, 0.58) * 0.1;
      const rearHaunch = gaussian(z, -1.28, 0.48) * 0.09;
      return (0.98 + waist + rearHaunch) * nose * tail;
    },
    sampleTumblehome: (_z, cosT) => (cosT > 0 ? 1 - Math.pow(cosT, 1.45) * 0.2 : 1 - Math.pow(-cosT, 2.2) * 0.05),
    upperPinchExp: 0.92,
    shoulderCrease: 0.036,
    canopyZBack: -1.52,
    canopyZFront: 0.98,
    canopyHeightBoost: 0.48,
    canopyWidthScale: 0.76,
    canopyRoofFlatness: 0.74,
  },

  // 4. Rounded Autonomous Urban Transit Pod / Aero-Van (5.15m long, tall capsule monovolume)
  VAN: {
    zMin: -2.56,
    zMax: 2.58,
    frontAxleZ: 1.58,
    rearAxleZ: -1.56,
    wheelRadius: 0.39,
    wheelTrackHalf: 0.95,
    wheelWidth: 0.26,
    baseHalfWidth: 1.04,
    floorY: 0.24,
    sampleTopCenter: (z) => {
      const noseSlope = smoothstep(1.55, 2.58, z);
      const tailSlope = smoothstep(-1.85, -2.56, z);
      return 1.38 - Math.pow(noseSlope, 1.45) * 0.56 - Math.pow(tailSlope, 1.55) * 0.34;
    },
    sampleHalfWidth: (z) => {
      const nose = 1 - Math.pow(smoothstep(1.78, 2.58, z), 1.75) * 0.3;
      const tail = 1 - Math.pow(smoothstep(-1.88, -2.56, z), 1.75) * 0.22;
      return 1.04 * nose * tail;
    },
    sampleTumblehome: (_z, cosT) => (cosT > 0 ? 1 - Math.pow(cosT, 1.9) * 0.09 : 1 - Math.pow(-cosT, 2.2) * 0.06),
    upperPinchExp: 0.76,
    shoulderCrease: 0.025,
    canopyZBack: -2.18,
    canopyZFront: 2.02,
    canopyHeightBoost: 0.72,
    canopyWidthScale: 0.9,
    canopyRoofFlatness: 0.26,
  },
};

export function createTrafficCarModelSet(archetype: TrafficCarArchetype): TrafficCarModelSet {
  const spec = ARCHETYPE_SPECS[archetype];
  const bodyGeo = buildSculptedBodyLoft(spec);
  const glassGeo = buildSculptedGreenhouse(spec);
  const wheelsGeo = buildFourWheelAssembly(spec);

  const isFullHead = archetype === 'VAN';
  const isFullTail = archetype === 'SEDAN' || archetype === 'VAN';

  const headY =
    archetype === 'SUV' ? 0.88 : archetype === 'VAN' ? 0.92 : archetype === 'COUPE' ? 0.52 : 0.66;
  const tailY =
    archetype === 'SUV' ? 1.02 : archetype === 'VAN' ? 1.12 : archetype === 'COUPE' ? 0.68 : 0.82;

  const headlightGeo = buildCurvedLightPair(
    spec.zMax - 0.02,
    headY,
    spec.baseHalfWidth * 0.34,
    spec.baseHalfWidth * 0.78,
    0.26,
    archetype === 'VAN' ? 0.048 : 0.042,
    isFullHead,
  );
  const taillightGeo = buildCurvedLightPair(
    spec.zMin + 0.02,
    tailY,
    spec.baseHalfWidth * 0.32,
    spec.baseHalfWidth * 0.82,
    -0.18,
    archetype === 'COUPE' ? 0.04 : 0.046,
    isFullTail,
  );

  bodyGeo.computeBoundingBox();
  glassGeo.computeBoundingBox();
  const maxHeight = Math.max(bodyGeo.boundingBox?.max.y ?? 1.2, glassGeo.boundingBox?.max.y ?? 1.2);

  return {
    archetype,
    bodyGeo,
    glassGeo,
    wheelsGeo,
    headlightGeo,
    taillightGeo,
    length: spec.zMax - spec.zMin,
    width: spec.baseHalfWidth * 2,
    height: maxHeight,
    wheelRadius: spec.wheelRadius,
  };
}

/**
 * Generates a smooth, sculpted aerial sky-cruiser fuselage for high-altitude background traffic
 * (replacing the old blocky aerial hover-boxes).
 */
export function createSkyCruiserGeometry(): {
  fuselageGeo: THREE.BufferGeometry;
  canopyGeo: THREE.BufferGeometry;
  wingGeo: THREE.BufferGeometry;
  thrusterGeo: THREE.BufferGeometry;
} {
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0.01, -2.5),
    new THREE.Vector2(0.32, -2.1),
    new THREE.Vector2(0.56, -0.9),
    new THREE.Vector2(0.62, 0.3),
    new THREE.Vector2(0.46, 1.55),
    new THREE.Vector2(0.18, 2.35),
    new THREE.Vector2(0.01, 2.6),
  ];
  const fuselageGeo = new THREE.LatheGeometry(pts, 18);
  fuselageGeo.rotateX(Math.PI / 2);
  fuselageGeo.scale(1.32, 0.56, 1.0);
  fuselageGeo.computeVertexNormals();

  const canopyGeo = new THREE.SphereGeometry(0.46, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55);
  canopyGeo.scale(1.05, 0.62, 2.1);
  canopyGeo.translate(0, 0.18, 0.25);
  canopyGeo.computeVertexNormals();

  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0.65);
  wingShape.bezierCurveTo(0.85, 0.35, 1.55, -0.35, 1.85, -1.15);
  wingShape.lineTo(1.55, -1.35);
  wingShape.bezierCurveTo(0.8, -0.85, 0.3, -0.75, 0, -0.82);
  wingShape.bezierCurveTo(-0.3, -0.75, -0.8, -0.85, -1.55, -1.35);
  wingShape.lineTo(-1.85, -1.15);
  wingShape.bezierCurveTo(-1.55, -0.35, -0.85, 0.35, 0, 0.65);
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, {
    depth: 0.08,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.02,
    bevelThickness: 0.02,
  });
  wingGeo.rotateX(Math.PI / 2);
  wingGeo.translate(0, 0.04, -0.35);
  wingGeo.computeVertexNormals();

  const thrusterGeo = buildCurvedLightPair(-2.35, -0.02, 0.22, 0.68, -0.1, 0.08, false);
  return { fuselageGeo, canopyGeo, wingGeo, thrusterGeo };
}
