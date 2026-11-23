import * as THREE from 'three';

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
 * Evaluates the slender single-seat Formula-X central fuselage (survival cell, elevated needle nosecone,
 * overhead ram-air roll-hoop airbox, and tapered turbine tail).
 * +Z = front needle nose (+2.72m), -Z = rear turbine shroud (-2.52m). Total length = 5.24m.
 * Central half-width stays <= 0.45m so all 4 wide racing tires sit cleanly outboard on exposed wishbones!
 */
function sampleFormulaFuselageStation(z: number) {
  const zMin = -2.52;
  const zMax = 2.72;
  const s = clamp((z - zMin) / (zMax - zMin), 0, 1);

  // Elevated Formula nosecone curves cleanly UP over the front wing so daylight passes underneath
  let yBot = 0.165;
  if (z > 0.72) {
    yBot += Math.pow(smoothstep(0.72, zMax, z), 1.25) * 0.245;
  }
  if (z < -1.55) {
    yBot += Math.pow(smoothstep(-1.55, zMin, z), 1.35) * 0.175;
  }

  // Iconic Formula-X centerline silhouette:
  // Sleek low drooping nosecone -> raised front bulkhead -> recessed cockpit rim ->
  // tall sculpted overhead ram-air roll-hoop airbox (~1.24m) -> sweeping spine into turbine tail
  let yTop: number;
  if (z >= 0.85) {
    const u = clamp((z - 0.85) / (zMax - 0.85), 0, 1);
    yTop = 0.76 - Math.pow(u, 1.32) * 0.28;
  } else if (z >= -0.25) {
    // Cockpit rim dips gently to cradle the fighter canopy, rising smoothly toward the roll hoop
    const u = (z + 0.25) / 1.1;
    const hoopRise = smoothstep(0.28, -0.25, z) * 0.44;
    yTop = 0.76 - Math.sin(u * Math.PI) * 0.055 + hoopRise;
  } else {
    // Tall sculpted roll-hoop airbox (~1.24m at z=-0.38) sweeping down to the rear turbine shroud (~0.62m)
    const u = clamp((-0.25 - z) / (-0.25 - zMin), 0, 1);
    const airboxPeak = gaussian(z, -0.4, 0.34) * 0.14;
    yTop = 1.16 - Math.pow(u, 1.28) * 0.54 + airboxPeak;
  }

  // Slender Formula survival cell planform:
  // Pointed nose (0.14m half-width) -> slim front bulkhead (0.34m) -> cockpit cell (0.44m) ->
  // tight Coca-Cola engine spine tapering to 0.22m turbine shroud
  const noseTaper = 1 - Math.pow(smoothstep(0.95, zMax, z), 1.35) * 0.68;
  const tailTaper = 1 - Math.pow(smoothstep(-0.7, zMin, z), 1.4) * 0.46;
  const cockpitSwell = gaussian(z, 0.12, 0.78) * 0.095;
  const halfWidth = (0.355 + cockpitSwell) * noseTaper * tailTaper;

  // Smooth rounded tip closure factor
  const tipRound = smoothstep(0, 0.04, s) * smoothstep(1, 0.955, s);

  return { yBot, yTop, halfWidth, tipRound };
}

/**
 * Generates the single continuous, compound-curved Formula-X central fuselage monocoque
 * (84 x 48 welded parametric loft = 4,032+ vertices, zero boxes/cubes).
 * Features an elevated aerodynamic nosecone, sculpted suspension mounting blisters,
 * recessed cockpit cradle, tall overhead ram-air airbox hump, and tapered turbine tail.
 */
export function createSolarisFormulaFuselageGeometry(): THREE.BufferGeometry {
  const NZ = 84;
  const NU = 48;
  const zMin = -2.52;
  const zMax = 2.72;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const zStations: number[] = [];
  for (let iz = 0; iz <= NZ; iz++) {
    const t = iz / NZ;
    const sCos = 0.5 - 0.5 * Math.cos(t * Math.PI);
    const s = t * 0.58 + sCos * 0.42;
    zStations.push(zMin + (zMax - zMin) * s);
  }

  for (let iz = 0; iz <= NZ; iz++) {
    const z = zStations[iz];
    const { yBot, yTop, halfWidth, tipRound } = sampleFormulaFuselageStation(z);
    const yMid = (yBot + yTop) * 0.5;
    const halfH = Math.max(0.03, (yTop - yBot) * 0.5);

    const isEngineSpine = smoothstep(-0.15, -0.55, z);
    const cockpitZone = smoothstep(0.92, 0.55, z) * smoothstep(-0.42, -0.1, z);

    for (let iu = 0; iu < NU; iu++) {
      const theta = (iu / NU) * Math.PI * 2;
      const sinT = Math.sin(theta);
      const cosT = Math.cos(theta);
      const absSin = Math.abs(sinT);
      const signX = sinT >= 0 ? 1 : -1;

      // Sculpted teardrop / airfoil cross-section: flat-bottomed survival cell + narrow razor-smooth top spine
      const upperPinch = cosT > 0 ? 1 - Math.pow(cosT, 1.35) * (0.24 + isEngineSpine * 0.36) : 1 - Math.pow(-cosT, 2.0) * 0.1;
      const xShape = signX * Math.pow(absSin, cosT < 0 ? 0.78 : 0.92);
      const yShape = (cosT >= 0 ? 1 : -1) * Math.pow(Math.abs(cosT), cosT >= 0 ? 0.92 : 0.68);

      let x = xShape * halfWidth * upperPinch;
      let y = yMid + yShape * halfH;

      // Sculpted upper cockpit coaming lips cradling the narrow fighter canopy
      if (cockpitZone > 0.001 && cosT > 0.12) {
        const rimShoulder = smoothstep(0.35, 0.85, absSin) * cosT;
        y += cockpitZone * rimShoulder * 0.048 * tipRound;
        const centerBay = smoothstep(0.45, 0.05, absSin) * smoothstep(0.35, 0.95, cosT);
        y -= cockpitZone * centerBay * 0.055 * tipRound;
      }

      // Subtle front suspension aero-blister fairing on the upper nose flanks
      if (z > 1.1 && z < 1.95 && absSin > 0.45 && cosT > -0.15 && cosT < 0.65) {
        const blister = gaussian(z, 1.52, 0.24) * gaussian(cosT, 0.24, 0.28) * smoothstep(0.45, 0.85, absSin);
        x += signX * blister * 0.036;
      }

      // Smooth teardrop engine-cover undercut flanking the tall roll-hoop spine
      if (isEngineSpine > 0.01 && cosT > 0.18 && cosT < 0.88 && absSin > 0.16) {
        const cove = isEngineSpine * gaussian(cosT, 0.56, 0.24) * smoothstep(0.16, 0.72, absSin);
        x *= 1 - cove * 0.26;
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
      const a = rowA + iu;
      const b = rowB + iu;
      const c = rowB + iuNext;
      const d = rowA + iuNext;
      indices.push(a, b, c, a, c, d);
    }
  }

  // Smooth rear turbine tail cap (-Z)
  const rearIdx = positions.length / 3;
  const rSt = sampleFormulaFuselageStation(zMin);
  positions.push(0, (rSt.yBot + rSt.yTop) * 0.5, zMin - 0.04);
  uvs.push(0.5, 0);
  for (let iu = 0; iu < NU; iu++) {
    const iuNext = (iu + 1) % NU;
    indices.push(rearIdx, iu, iuNext);
  }

  // Smooth aerodynamic bullet nosecone tip (+Z)
  const frontIdx = positions.length / 3;
  const fSt = sampleFormulaFuselageStation(zMax);
  positions.push(0, (fSt.yBot + fSt.yTop) * 0.48, zMax + 0.075);
  uvs.push(0.5, 1);
  const lastRow = NZ * NU;
  for (let iu = 0; iu < NU; iu++) {
    const iuNext = (iu + 1) % NU;
    indices.push(frontIdx, lastRow + iuNext, lastRow + iu);
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
 * Generates one sculpted Formula-X aerodynamic sidepod fairing (left: side=+1, right: side=-1)
 * with a wide forward undercut cooling intake and a dramatic Coca-Cola bottle taper toward the rear axle.
 * Spans z ∈ [-1.42, +0.62], leaving huge visual separation from both front (+1.52) and rear (-1.52) wheels.
 */
export function createSolarisSidepodGeometry(side: 1 | -1): THREE.BufferGeometry {
  const NZ = 44;
  const NU = 32;
  const zMin = -1.42;
  const zMax = 0.62;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let iz = 0; iz <= NZ; iz++) {
    const t = iz / NZ;
    const z = zMin + (zMax - zMin) * t;

    // Classic Formula-X Coca-Cola sidepod envelope:
    // Tight inner merge at rear (-1.42) -> sweeping wide mid-radiator shoulder -> sculpted forward inlet (+0.48)
    const frontRound = smoothstep(1.0, 0.86, t);
    const cokeTaper = smoothstep(0.0, 0.56, t);
    const outerReach = 0.41 + (0.57 * Math.pow(cokeTaper, 0.78) + gaussian(t, 0.78, 0.16) * 0.07) * frontRound;
    const innerEdge = 0.28 + (1 - cokeTaper) * 0.06;

    const halfW = Math.max(0.035, (outerReach - innerEdge) * 0.5);
    const centerX = (outerReach + innerEdge) * 0.5;

    // Dramatic aerodynamic undercut rising cleanly from the floor at the front inlet, dropping smoothly down at the rear
    const yBot = 0.2 + smoothstep(0.55, 0.98, t) * 0.11 + (1 - cokeTaper) * 0.04;
    const yTop = 0.36 + (0.37 * Math.pow(cokeTaper, 0.65) + gaussian(t, 0.74, 0.18) * 0.05) * smoothstep(1.0, 0.9, t);
    const halfH = Math.max(0.03, (yTop - yBot) * 0.5);
    const centerY = (yBot + yTop) * 0.5;

    for (let iu = 0; iu < NU; iu++) {
      const theta = (iu / NU) * Math.PI * 2;
      const sinT = Math.sin(theta);
      const cosT = Math.cos(theta);

      // Asymmetric sculpted profile: flat inner root, smoothly domed top shoulder, scooped lower undercut
      const localX = Math.sign(sinT) * Math.pow(Math.abs(sinT), 0.82) * halfW;
      const localY = Math.sign(cosT) * Math.pow(Math.abs(cosT), cosT >= 0 ? 0.85 : 0.72) * halfH;

      // Sculpted forward-outer undercut channel curving inward on the lower flank
      const undercut = cosT < 0 && sinT > 0 ? Math.abs(cosT) * sinT * 0.18 * smoothstep(0.25, 0.88, t) : 0;

      const px = side * (centerX + localX - undercut * halfW);
      const py = centerY + localY;
      // Subtle sculpted cooling gully across the upper sidepod deck
      const topChannel = cosT > 0.45 && Math.abs(sinT) < 0.45 ? -0.025 * smoothstep(0.2, 0.72, t) * (1 - Math.abs(sinT) / 0.45) : 0;

      positions.push(px, py + topChannel, z);
      uvs.push(iu / NU, t);
    }
  }

  for (let iz = 0; iz < NZ; iz++) {
    const rowA = iz * NU;
    const rowB = (iz + 1) * NU;
    for (let iu = 0; iu < NU; iu++) {
      const iuNext = (iu + 1) % NU;
      const a = rowA + iu;
      const b = rowB + iu;
      const c = rowB + iuNext;
      const d = rowA + iuNext;
      if (side > 0) {
        indices.push(a, b, c, a, c, d);
      } else {
        indices.push(a, c, b, a, d, c);
      }
    }
  }

  // Smooth rear closure cap
  const rearIdx = positions.length / 3;
  positions.push(side * 0.36, 0.31, zMin - 0.03);
  uvs.push(0.5, 0);
  for (let iu = 0; iu < NU; iu++) {
    const iuNext = (iu + 1) % NU;
    if (side > 0) indices.push(rearIdx, iu, iuNext);
    else indices.push(rearIdx, iuNext, iu);
  }

  // Sculpted forward inlet lip cap (recessed slightly inward)
  const frontIdx = positions.length / 3;
  positions.push(side * 0.62, 0.5, zMax - 0.06);
  uvs.push(0.5, 1);
  const lastRow = NZ * NU;
  for (let iu = 0; iu < NU; iu++) {
    const iuNext = (iu + 1) % NU;
    if (side > 0) indices.push(frontIdx, lastRow + iuNext, lastRow + iu);
    else indices.push(frontIdx, lastRow + iu, lastRow + iuNext);
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
 * Generates the dark recessed forward cooling intake scoop nested cleanly inside the sidepod front aperture.
 */
export function createSolarisSidepodIntakeGeometry(side: 1 | -1): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-0.18, -0.09);
  shape.bezierCurveTo(-0.22, 0.06, -0.1, 0.14, 0.16, 0.12);
  shape.bezierCurveTo(0.24, 0.08, 0.22, -0.08, 0.08, -0.11);
  shape.bezierCurveTo(-0.04, -0.13, -0.14, -0.12, -0.18, -0.09);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.12,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 1,
    bevelSize: 0.015,
    bevelThickness: 0.018,
  });
  geo.translate(0, 0, -0.06);
  if (side < 0) {
    geo.scale(-1, 1, 1);
    const idx = geo.getIndex();
    if (idx) {
      for (let i = 0; i < idx.count; i += 3) {
        const tmp = idx.getX(i + 1);
        idx.setX(i + 1, idx.getX(i + 2));
        idx.setX(i + 2, tmp);
      }
      idx.needsUpdate = true;
    } else {
      const pos = geo.getAttribute('position');
      for (let i = 0; i < pos.count; i += 3) {
        const x1 = pos.getX(i + 1), y1 = pos.getY(i + 1), z1 = pos.getZ(i + 1);
        pos.setXYZ(i + 1, pos.getX(i + 2), pos.getY(i + 2), pos.getZ(i + 2));
        pos.setXYZ(i + 2, x1, y1, z1);
      }
      pos.needsUpdate = true;
    }
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates a narrow, jet-fighter single-seat teardrop panoramic canopy bubble
 * nestled tightly inside the Formula-X survival cell (width <= 0.68m).
 */
export function createSolarisCanopyGeometry(): THREE.BufferGeometry {
  const NZ = 40;
  const NU = 36;
  const zBack = -0.52;
  const zFront = 0.98;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let iz = 0; iz <= NZ; iz++) {
    const t = iz / NZ;
    const z = zBack + (zFront - zBack) * t;

    const archProfile = Math.sin(Math.pow(t, 0.84) * Math.PI);
    // Low-slung, narrow fighter canopy dome peaking near z = +0.18 at y = 1.10m
    const crownY = 0.72 + Math.pow(archProfile, 0.86) * 0.385;
    const baseY = 0.66 + smoothstep(0.65, 1.0, t) * 0.04;
    const halfW = 0.345 * Math.pow(Math.sin(Math.pow(t, 0.82) * Math.PI), 0.56);

    for (let iu = 0; iu <= NU; iu++) {
      const v = iu / NU;
      const phi = (v - 0.5) * Math.PI;
      const sinP = Math.sin(phi);
      const cosP = Math.cos(phi);

      const x = sinP * halfW;
      const y = baseY + Math.pow(Math.max(0, cosP), 0.76) * (crownY - baseY);

      positions.push(x, y, z);
      uvs.push(v, t);
    }
  }

  const rowLen = NU + 1;
  for (let iz = 0; iz < NZ; iz++) {
    for (let iu = 0; iu < NU; iu++) {
      const a = iz * rowLen + iu;
      const b = (iz + 1) * rowLen + iu;
      const c = (iz + 1) * rowLen + (iu + 1);
      const d = iz * rowLen + (iu + 1);
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
 * Generates the iconic sculpted titanium Formula-X Halo Arch wrapping smoothly around
 * the single-seat fighter canopy brow plus its forward central pylon strut.
 */
export function createSolarisHaloArchGeometry(): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.34, 0.82, -0.34),
    new THREE.Vector3(-0.37, 0.99, 0.14),
    new THREE.Vector3(-0.24, 1.02, 0.62),
    new THREE.Vector3(0.0, 1.01, 0.84),
    new THREE.Vector3(0.24, 1.02, 0.62),
    new THREE.Vector3(0.37, 0.99, 0.14),
    new THREE.Vector3(0.34, 0.82, -0.34),
  ]);
  const geo = new THREE.TubeGeometry(curve, 48, 0.028, 12, false);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates the central curved titanium Halo nose-pillar linking the Halo brow down to the front cowl.
 */
export function createSolarisHaloPillarGeometry(): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 1.0, 0.83),
    new THREE.Vector3(0, 0.88, 0.94),
    new THREE.Vector3(0, 0.74, 1.02),
  ]);
  const geo = new THREE.TubeGeometry(curve, 16, 0.022, 10, false);
  geo.scale(0.68, 1, 1.45);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates the sculpted curved Formula-X multi-element front wing main plane spanning
 * across the front axle (2.28m wide) with an iconic gull-wing central spoon dip and cambered airfoil section.
 */
export function createSolarisFrontWingMainGeometry(): THREE.BufferGeometry {
  const NX = 44;
  const NU = 24;
  const halfSpan = 1.14;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let ix = 0; ix <= NX; ix++) {
    const uSpan = (ix / NX) * 2 - 1; // -1..+1
    const absU = Math.abs(uSpan);
    const x = uSpan * halfSpan;

    // Swept arrow planform (forward at nose center, sweeping gracefully back toward front tires)
    const zLead = 2.74 - Math.pow(absU, 1.35) * 0.24;
    const chord = 0.44 - Math.pow(absU, 1.6) * 0.07;
    // Gull-wing vertical camber: lowest under the elevated nosecone, sweeping gently up outward
    const yCenter = 0.165 + smoothstep(0.18, 0.95, absU) * 0.055;
    const thickness = 0.034 * (1 - absU * 0.18);

    for (let iu = 0; iu < NU; iu++) {
      const a = (iu / NU) * Math.PI * 2;
      const c = 0.5 - 0.5 * Math.cos(a); // 0 leading -> 1 trailing
      const s = Math.sin(a);
      const camber = Math.sin(c * Math.PI) * 0.022;
      const profile = Math.pow(Math.max(0, 1 - c), 0.62) * Math.sqrt(Math.max(0.002, c));
      const yLocal = camber + s * thickness * profile * 2.1;
      const zLocal = zLead - c * chord;

      positions.push(x, yCenter + yLocal, zLocal);
      uvs.push(ix / NX, iu / NU);
    }
  }

  for (let ix = 0; ix < NX; ix++) {
    const rowA = ix * NU;
    const rowB = (ix + 1) * NU;
    for (let iu = 0; iu < NU; iu++) {
      const iuNext = (iu + 1) % NU;
      indices.push(rowA + iu, rowB + iu, rowB + iuNext, rowA + iu, rowB + iuNext, rowA + iuNext);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates the upper secondary sculpted front-wing aero flap flanking the nosecone
 * (left or right half, creating a layered F1/Formula-X cascade wing!).
 */
export function createSolarisFrontWingFlapGeometry(side: 1 | -1): THREE.BufferGeometry {
  const NX = 24;
  const NU = 18;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let ix = 0; ix <= NX; ix++) {
    const t = ix / NX; // 0 inner -> 1 outer
    const absX = 0.22 + t * 0.89;
    const x = side * absX;
    const zLead = 2.42 - Math.pow(t, 1.25) * 0.14;
    const chord = 0.24 + Math.sin(t * Math.PI) * 0.06;
    const yBase = 0.25 + smoothstep(0.0, 0.85, t) * 0.065;
    const tilt = 0.26 + t * 0.14;

    for (let iu = 0; iu < NU; iu++) {
      const a = (iu / NU) * Math.PI * 2;
      const c = 0.5 - 0.5 * Math.cos(a);
      const s = Math.sin(a);
      const thickness = 0.022 * Math.sin(Math.pow(c, 0.72) * Math.PI);
      const zLocal = zLead - c * chord;
      const yLocal = yBase + c * chord * Math.sin(tilt) + s * thickness;

      positions.push(x, yLocal, zLocal);
      uvs.push(t, iu / NU);
    }
  }

  for (let ix = 0; ix < NX; ix++) {
    const rowA = ix * NU;
    const rowB = (ix + 1) * NU;
    for (let iu = 0; iu < NU; iu++) {
      const iuNext = (iu + 1) % NU;
      if (side > 0) {
        indices.push(rowA + iu, rowB + iu, rowB + iuNext, rowA + iu, rowB + iuNext, rowA + iuNext);
      } else {
        indices.push(rowA + iu, rowB + iuNext, rowB + iu, rowA + iu, rowA + iuNext, rowB + iuNext);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates a gracefully curved Formula-X front wing endplate with outward aero vortex curl.
 */
export function createSolarisFrontEndplateGeometry(side: 1 | -1): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(2.04, 0.17);
  shape.bezierCurveTo(2.22, 0.15, 2.48, 0.18, 2.58, 0.24);
  shape.bezierCurveTo(2.55, 0.34, 2.38, 0.43, 2.12, 0.45);
  shape.bezierCurveTo(2.02, 0.43, 1.98, 0.28, 2.04, 0.17);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.024,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 1,
    bevelSize: 0.008,
    bevelThickness: 0.008,
  });
  geo.rotateY(Math.PI / 2);
  geo.translate(side * 1.135 - 0.012, 0, 0);
  // Subtle outward aero flare at the top edge
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const flare = smoothstep(0.24, 0.45, y) * 0.045;
    pos.setX(i, pos.getX(i) + side * flare);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates a sleek airfoil nose-to-front-wing mounting pylon strut (left/right).
 */
export function createSolarisNosePylonGeometry(side: 1 | -1): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(2.26, 0.17);
  shape.bezierCurveTo(2.34, 0.26, 2.38, 0.36, 2.36, 0.44);
  shape.lineTo(2.54, 0.43);
  shape.bezierCurveTo(2.57, 0.34, 2.55, 0.23, 2.48, 0.17);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.022,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: 0.006,
    bevelThickness: 0.006,
  });
  geo.rotateY(Math.PI / 2);
  geo.translate(side * 0.115 - 0.011, 0, 0);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates a sculpted curved carbon ground-effect underfloor plank tucked ONLY under the
 * central cell & sidepods (z ∈ [-1.92, +0.76]), with rolled-up curved vortex floor edges.
 */
export function createSolarisVenturiFloorGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-0.34, 0.78);
  shape.bezierCurveTo(-0.56, 0.72, -0.96, 0.56, -1.02, 0.28);
  shape.bezierCurveTo(-1.03, -0.35, -0.96, -0.82, -0.86, -1.04);
  shape.bezierCurveTo(-0.74, -1.16, -0.58, -1.48, -0.54, -1.94);
  shape.lineTo(0.54, -1.94);
  shape.bezierCurveTo(0.58, -1.48, 0.74, -1.16, 0.86, -1.04);
  shape.bezierCurveTo(0.96, -0.82, 1.03, -0.35, 1.02, 0.28);
  shape.bezierCurveTo(0.96, 0.56, 0.56, 0.72, 0.34, 0.78);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.028,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: 0.014,
    bevelThickness: 0.008,
  });
  geo.rotateX(Math.PI / 2);
  geo.translate(0, 0.175, 0);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates a sleek airfoil double-wishbone suspension arm or pushrod strut between two 3D points.
 */
export function createSolarisSuspensionLinkGeometry(
  start: [number, number, number],
  end: [number, number, number],
  radius = 0.018,
  flattenY = 0.52,
): THREE.BufferGeometry {
  const p0 = new THREE.Vector3(...start);
  const p2 = new THREE.Vector3(...end);
  const p1 = p0.clone().lerp(p2, 0.5);
  p1.y += 0.012;

  const curve = new THREE.CatmullRomCurve3([p0, p1, p2]);
  const geo = new THREE.TubeGeometry(curve, 14, radius, 10, false);
  // Subtle aerodynamic ovalization along Y around the link centerline
  const pos = geo.getAttribute('position');
  const tmp = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    tmp.fromBufferAttribute(pos, i);
    const t = clamp(
      tmp.clone().sub(p0).dot(p2.clone().sub(p0)) / Math.max(0.0001, p0.distanceToSquared(p2)),
      0,
      1,
    );
    const center = curve.getPoint(t);
    tmp.y = center.y + (tmp.y - center.y) * flattenY;
    pos.setXYZ(i, tmp.x, tmp.y, tmp.z);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates a sleek, floating carbon aero wheel-fender eyebrow hovering over the upper-inner arc
 * of an exposed Formula-X tire (gives futuristic aero flow while keeping the massive slicks exposed!).
 */
export function createSolarisWheelFairingGeometry(
  wheelRadius: number,
  wheelWidth: number,
  side: 1 | -1,
): THREE.BufferGeometry {
  const NA = 24;
  const NW = 12;
  const arcStart = -Math.PI * 0.44; // behind top
  const arcEnd = Math.PI * 0.34; // ahead of top
  const innerR = wheelRadius + 0.036;
  const thickness = 0.022;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let ia = 0; ia <= NA; ia++) {
    const ta = ia / NA;
    const ang = arcStart + (arcEnd - arcStart) * ta;
    const edgeTaper = Math.sin(ta * Math.PI);
    const rOuter = innerR + thickness * (0.35 + 0.65 * Math.pow(edgeTaper, 0.5));
    const spanW = wheelWidth * (0.48 + 0.38 * Math.pow(edgeTaper, 0.45));
    // Biased slightly toward the inner half of the tire so the outer tire shoulder & wheel cover stay boldly visible
    const xInner = -side * (wheelWidth * 0.48);
    const xOuter = xInner + side * spanW;

    for (let iw = 0; iw <= NW; iw++) {
      const tw = iw / NW;
      const x = THREE.MathUtils.lerp(xInner, xOuter, tw);
      const crown = Math.sin(tw * Math.PI) * 0.018;
      const r = rOuter + crown;
      const y = Math.cos(ang) * r;
      const z = Math.sin(ang) * r;
      positions.push(x, y, z);
      uvs.push(tw, ta);
    }
  }

  const row = NW + 1;
  for (let ia = 0; ia < NA; ia++) {
    for (let iw = 0; iw < NW; iw++) {
      const a = ia * row + iw;
      const b = (ia + 1) * row + iw;
      const c = (ia + 1) * row + (iw + 1);
      const d = ia * row + (iw + 1);
      if (side > 0) {
        indices.push(a, c, b, a, d, c);
      } else {
        indices.push(a, b, c, a, c, d);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates the sculpted dorsal shark-fin stabilizer sweeping smoothly from the tall roll-hoop airbox
 * back to the central rear wing pylon.
 */
export function createSolarisDorsalFinGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-0.48, 1.18);
  shape.bezierCurveTo(-0.92, 1.24, -1.58, 1.18, -2.18, 1.12);
  shape.bezierCurveTo(-2.22, 0.96, -2.12, 0.78, -1.96, 0.66);
  shape.bezierCurveTo(-1.42, 0.76, -0.82, 0.88, -0.48, 1.02);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.026,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 1,
    bevelSize: 0.008,
    bevelThickness: 0.008,
  });
  geo.rotateY(Math.PI / 2);
  geo.translate(-0.013, 0, 0);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates the glowing solar-amber aerodynamic telemetry strip tracing the top crest of the dorsal shark fin.
 */
export function createSolarisDorsalGlowGeometry(): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 1.22, -0.52),
    new THREE.Vector3(0, 1.23, -1.08),
    new THREE.Vector3(0, 1.19, -1.65),
    new THREE.Vector3(0, 1.14, -2.16),
  ]);
  return new THREE.TubeGeometry(curve, 28, 0.011, 8, false);
}

/**
 * Generates the towering, wide curved Formula-X rear wing main plane (2.22m span)
 * with authentic spoon-shaped central downforce dip and smooth NACA airfoil cross-section.
 */
export function createSolarisRearWingMainGeometry(): THREE.BufferGeometry {
  const NX = 40;
  const NU = 24;
  const halfSpan = 1.11;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let ix = 0; ix <= NX; ix++) {
    const uSpan = (ix / NX) * 2 - 1;
    const absU = Math.abs(uSpan);
    const x = uSpan * halfSpan;

    // Spoon-wing central drop for maximum downforce with sleek upward sweep toward endplates
    const yBase = 1.02 + smoothstep(0.15, 0.92, absU) * 0.09;
    const zLead = -2.08 - Math.pow(absU, 1.6) * 0.09;
    const chord = 0.34 - Math.pow(absU, 1.7) * 0.04;
    const thickness = 0.036;

    for (let iu = 0; iu < NU; iu++) {
      const a = (iu / NU) * Math.PI * 2;
      const c = 0.5 - 0.5 * Math.cos(a);
      const s = Math.sin(a);
      // Inverted airfoil camber (downforce!)
      const camber = -Math.sin(c * Math.PI) * 0.032 + c * 0.055;
      const profile = Math.pow(Math.max(0, 1 - c), 0.6) * Math.sqrt(Math.max(0.002, c));
      const yLocal = camber + s * thickness * profile * 2.0;
      const zLocal = zLead - c * chord;

      positions.push(x, yBase + yLocal, zLocal);
      uvs.push(ix / NX, iu / NU);
    }
  }

  for (let ix = 0; ix < NX; ix++) {
    const rowA = ix * NU;
    const rowB = (ix + 1) * NU;
    for (let iu = 0; iu < NU; iu++) {
      const iuNext = (iu + 1) % NU;
      indices.push(rowA + iu, rowB + iu, rowB + iuNext, rowA + iu, rowB + iuNext, rowA + iuNext);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates the upper active DRS / Airbrake rear wing flap centered around its local hinge axis (0,0,0),
 * so it can flatten dynamically on boost/high-speed and pitch steeply upright when braking!
 */
export function createSolarisAirbrakeFlapGeometry(spanScale = 1): THREE.BufferGeometry {
  const NX = 32;
  const NU = 20;
  const halfSpan = 1.07 * Math.abs(spanScale);
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let ix = 0; ix <= NX; ix++) {
    const uSpan = (ix / NX) * 2 - 1;
    const absU = Math.abs(uSpan);
    const x = uSpan * halfSpan;
    const ySpanLift = smoothstep(0.15, 0.92, absU) * 0.065;
    const chord = 0.22 - absU * 0.025;

    for (let iu = 0; iu < NU; iu++) {
      const a = (iu / NU) * Math.PI * 2;
      const c = 0.5 - 0.5 * Math.cos(a);
      const s = Math.sin(a);
      const thickness = 0.022 * Math.sin(Math.pow(c, 0.72) * Math.PI);
      const zLocal = 0.08 - c * chord;
      const yLocal = ySpanLift + c * 0.085 + s * thickness;

      positions.push(x, yLocal, zLocal);
      uvs.push(ix / NX, iu / NU);
    }
  }

  for (let ix = 0; ix < NX; ix++) {
    const rowA = ix * NU;
    const rowB = (ix + 1) * NU;
    for (let iu = 0; iu < NU; iu++) {
      const iuNext = (iu + 1) % NU;
      indices.push(rowA + iu, rowB + iu, rowB + iuNext, rowA + iu, rowB + iuNext, rowA + iuNext);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates a tall, gracefully sculpted Formula-X rear wing endplate sweeping down toward the rear axle.
 */
export function createSolarisRearEndplateGeometry(side: 1 | -1): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-2.54, 0.64);
  shape.bezierCurveTo(-2.58, 0.86, -2.56, 1.16, -2.46, 1.3);
  shape.bezierCurveTo(-2.28, 1.32, -2.06, 1.24, -1.96, 1.06);
  shape.bezierCurveTo(-1.98, 0.84, -2.14, 0.66, -2.32, 0.6);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.028,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 1,
    bevelSize: 0.008,
    bevelThickness: 0.008,
  });
  geo.rotateY(Math.PI / 2);
  geo.translate(side * 1.115 - 0.014, 0, 0);
  // Subtle sculpted inward taper at the lower half
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const pinch = smoothstep(1.0, 0.62, y) * 0.085;
    pos.setX(i, pos.getX(i) - side * pinch);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates the sculpted multi-tunnel Formula rear Venturi diffuser under the turbine tail.
 */
export function createSolarisRearDiffuserGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-0.62, 0.16);
  shape.bezierCurveTo(-0.56, 0.34, -0.34, 0.4, 0, 0.4);
  shape.bezierCurveTo(0.34, 0.4, 0.56, 0.34, 0.62, 0.16);
  shape.lineTo(0.54, 0.16);
  shape.bezierCurveTo(0.42, 0.3, 0.24, 0.34, 0, 0.34);
  shape.bezierCurveTo(-0.24, 0.34, -0.42, 0.3, -0.54, 0.16);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.52,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: 0.012,
    bevelThickness: 0.012,
  });
  geo.translate(0, 0, -2.52);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates a curved vertical Formula diffuser strake fin.
 */
export function createSolarisDiffuserVaneGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-2.52, 0.33);
  shape.bezierCurveTo(-2.34, 0.26, -2.14, 0.19, -1.96, 0.17);
  shape.lineTo(-1.96, 0.22);
  shape.bezierCurveTo(-2.14, 0.26, -2.34, 0.34, -2.5, 0.38);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.018,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.004,
    bevelThickness: 0.004,
  });
  geo.rotateY(Math.PI / 2);
  geo.translate(-0.009, 0, 0);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates the iconic Formula-X nose-tip V-chevron laser DRL light blade.
 */
export function createSolarisNoseChevronLightGeometry(): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.18, 0.56, 2.34),
    new THREE.Vector3(-0.09, 0.52, 2.58),
    new THREE.Vector3(0.0, 0.49, 2.71),
    new THREE.Vector3(0.09, 0.52, 2.58),
    new THREE.Vector3(0.18, 0.56, 2.34),
  ]);
  return new THREE.TubeGeometry(curve, 28, 0.014, 8, false);
}

/**
 * Generates a curved laser headlight blade mounted on the leading edge of each front aero wheel shroud
 * or forward nose flank.
 */
export function createSolarisHeadlightBladeGeometry(side: 1 | -1): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(side * 0.28, 0.59, 1.98),
    new THREE.Vector3(side * 0.23, 0.56, 2.24),
    new THREE.Vector3(side * 0.16, 0.52, 2.48),
  ]);
  return new THREE.TubeGeometry(curve, 20, 0.017, 8, false);
}

/**
 * Generates a vertical sweeping solar-amber/crimson LED taillight blade running down the
 * trailing edge of each towering rear wing endplate (classic endurance/Formula prototype look!).
 */
export function createSolarisRearEndplateLightGeometry(side: 1 | -1): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(side * 1.07, 0.68, -2.53),
    new THREE.Vector3(side * 1.11, 0.92, -2.56),
    new THREE.Vector3(side * 1.12, 1.14, -2.54),
    new THREE.Vector3(side * 1.11, 1.28, -2.48),
  ]);
  return new THREE.TubeGeometry(curve, 24, 0.016, 8, false);
}

/**
 * Generates a glowing curved solar-amber sidepod intake accent ribbon.
 */
export function createSolarisSidepodLightGeometry(side: 1 | -1): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(side * 0.97, 0.42, 0.48),
    new THREE.Vector3(side * 0.95, 0.34, 0.06),
    new THREE.Vector3(side * 0.82, 0.28, -0.52),
    new THREE.Vector3(side * 0.56, 0.26, -1.16),
  ]);
  return new THREE.TubeGeometry(curve, 24, 0.012, 8, false);
}

/**
 * Generates a smooth curved reverse-light lens tucked inside the rear diffuser tunnel.
 */
export function createSolarisReverseArcGeometry(side: 1 | -1): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(side * 0.28, 0.31, -2.52),
    new THREE.Vector3(side * 0.42, 0.28, -2.5),
  ]);
  return new THREE.TubeGeometry(curve, 12, 0.016, 8, false);
}

/**
 * Generates a wide, rounded-shoulder Formula slick racing tire via LatheGeometry.
 */
export function createSolarisTireGeometry(radius: number, width: number): THREE.BufferGeometry {
  const hw = width * 0.5;
  const rRim = radius * 0.58;
  const rShoulder = radius * 0.955;

  const pts: THREE.Vector2[] = [
    new THREE.Vector2(rRim, -hw * 0.84),
    new THREE.Vector2(rRim + 0.035, -hw * 0.96),
    new THREE.Vector2(rShoulder - 0.022, -hw),
    new THREE.Vector2(radius - 0.006, -hw * 0.86),
    new THREE.Vector2(radius, -hw * 0.55),
    new THREE.Vector2(radius + 0.002, 0),
    new THREE.Vector2(radius, hw * 0.55),
    new THREE.Vector2(radius - 0.006, hw * 0.86),
    new THREE.Vector2(rShoulder - 0.022, hw),
    new THREE.Vector2(rRim + 0.035, hw * 0.96),
    new THREE.Vector2(rRim, hw * 0.84),
  ];

  const geo = new THREE.LatheGeometry(pts, 40);
  geo.rotateZ(Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates a deeply dished carbon-titanium racing wheel barrel via LatheGeometry.
 */
export function createSolarisRimBarrelGeometry(radius: number, width: number): THREE.BufferGeometry {
  const hw = width * 0.5;
  const rRim = radius * 0.59;
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(rRim * 0.78, -hw * 0.74),
    new THREE.Vector2(rRim, -hw * 0.78),
    new THREE.Vector2(rRim, hw * 0.78),
    new THREE.Vector2(rRim * 0.82, hw * 0.72),
    new THREE.Vector2(rRim * 0.68, hw * 0.24),
    new THREE.Vector2(rRim * 0.68, -hw * 0.24),
  ];
  const geo = new THREE.LatheGeometry(pts, 36);
  geo.rotateZ(Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates a curved directional aero-turbofan wheel vane (10 per wheel for an unmistakable Formula-X turbofan wheel!).
 */
export function createSolarisTurbineSpokeGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-0.015, 0.052);
  shape.bezierCurveTo(-0.032, 0.115, -0.02, 0.178, 0.018, 0.222);
  shape.lineTo(0.036, 0.214);
  shape.bezierCurveTo(0.008, 0.168, 0.004, 0.112, 0.014, 0.052);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.024,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.004,
    bevelThickness: 0.004,
  });
  geo.rotateY(Math.PI / 2);
  geo.translate(-0.012, 0, 0);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates a curved monoblock racing brake caliper wrapping cleanly around the carbon-ceramic disc.
 */
export function createSolarisBrakeCaliperGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const rIn = 0.135;
  const rOut = 0.212;
  shape.absarc(0, 0, rOut, -0.62, 0.62, false);
  shape.absarc(0, 0, rIn, 0.56, -0.56, true);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.072,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: 0.008,
    bevelThickness: 0.008,
  });
  geo.rotateY(Math.PI / 2);
  geo.translate(-0.036, 0, 0);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates the large central jet-turbine titanium afterburner exhaust nozzle via LatheGeometry.
 */
export function createSolarisTurbineExhaustGeometry(): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0.11, -0.18),
    new THREE.Vector2(0.135, -0.04),
    new THREE.Vector2(0.125, 0.09),
    new THREE.Vector2(0.095, 0.09),
    new THREE.Vector2(0.105, -0.05),
    new THREE.Vector2(0.082, -0.18),
  ];
  const geo = new THREE.LatheGeometry(pts, 28);
  geo.rotateX(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates the sculpted Formula-X carbon single-seat cockpit tub & headrest.
 */
export function createSolarisSeatGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-0.32, 0.0);
  shape.bezierCurveTo(-0.34, 0.16, -0.22, 0.34, -0.04, 0.44);
  shape.bezierCurveTo(0.05, 0.47, 0.1, 0.42, 0.06, 0.34);
  shape.bezierCurveTo(-0.06, 0.26, -0.14, 0.14, -0.12, 0.08);
  shape.bezierCurveTo(0.05, 0.07, 0.24, 0.09, 0.36, 0.13);
  shape.lineTo(0.38, 0.05);
  shape.bezierCurveTo(0.16, -0.02, -0.14, -0.04, -0.32, 0.0);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.38,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 1,
    bevelSize: 0.02,
    bevelThickness: 0.022,
  });
  geo.rotateY(Math.PI / 2);
  geo.translate(-0.19, 0, 0);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates a Formula-1 butterfly carbon steering yoke with curved grip handles.
 */
export function createSolarisSteeringYokeGeometry(): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(-0.14, 0.06, 0),
      new THREE.Vector3(-0.15, -0.04, 0),
      new THREE.Vector3(-0.08, -0.07, 0),
      new THREE.Vector3(0.08, -0.07, 0),
      new THREE.Vector3(0.15, -0.04, 0),
      new THREE.Vector3(0.14, 0.06, 0),
      new THREE.Vector3(0.07, 0.075, 0),
      new THREE.Vector3(-0.07, 0.075, 0),
    ],
    true,
  );
  return new THREE.TubeGeometry(curve, 32, 0.015, 10, true);
}
