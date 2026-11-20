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
 * Evaluates the smooth aerodynamic centerline roof/deck height, underbody floor,
 * and planform half-width of the VX-01 hypercar at any longitudinal coordinate z.
 * +Z = front nose, -Z = rear tail.
 */
function sampleBodyStation(z: number) {
  const zMin = -2.3;
  const zMax = 2.38;
  const s = clamp((z - zMin) / (zMax - zMin), 0, 1);

  // Smooth aerodynamic underbody floor rising cleanly into front chin and rear Venturi diffuser
  let yBot = 0.19;
  if (z > 1.72) {
    yBot += smoothstep(1.72, zMax, z) * 0.095;
  }
  if (z < -1.55) {
    yBot += smoothstep(-1.55, zMin, z) * 0.165;
  }

  // Centerline deck height (sleek low nose -> curved hood -> cockpit tub -> mid-engine spine -> Kammback tail)
  let yTopCenter: number;
  if (z >= 0.85) {
    const u = clamp((z - 0.85) / (zMax - 0.85), 0, 1);
    yTopCenter = 0.76 - Math.pow(u, 1.55) * 0.37;
  } else if (z >= -0.45) {
    const u = (z + 0.45) / 1.3;
    yTopCenter = 0.78 - Math.sin(u * Math.PI) * 0.045;
  } else {
    const u = clamp((-0.45 - z) / (-0.45 - zMin), 0, 1);
    yTopCenter = 0.78 + Math.sin(u * Math.PI * 0.62) * 0.055 - Math.pow(u, 2.15) * 0.115;
  }

  // Planform half-width: bullet nose -> wide front arches -> Coke-bottle waist -> muscular rear haunches -> tapered tail
  const noseTaper = 1 - Math.pow(smoothstep(1.62, zMax, z), 1.65) * 0.54;
  const tailTaper = 1 - Math.pow(smoothstep(-1.72, zMin, z), 1.75) * 0.12;
  const waistPinch = -gaussian(z, 0.12, 0.56) * 0.095;
  const frontFlare = gaussian(z, 1.43, 0.46) * 0.065;
  const rearFlare = gaussian(z, -1.38, 0.56) * 0.11;

  const halfWidth = (0.985 + waistPinch + frontFlare + rearFlare) * noseTaper * tailTaper;

  // Soft vertical taper at extreme nose/tail tips so end caps round seamlessly
  const tipRound = smoothstep(0, 0.045, s) * smoothstep(1, 0.945, s);

  return { yBot, yTopCenter, halfWidth, tipRound };
}

/**
 * Generates a single continuous, compound-curved, smooth-shaded hypercar monocoque body
 * using parametric longitudinal lofting with integrated sculpted wheel-arch cutouts,
 * muscular front & rear fender haunches, Coke-bottle side intakes, and seamless normals.
 */
export function createSculptedHypercarBodyGeometry(): THREE.BufferGeometry {
  const NZ = 68;
  const NU = 48;
  const zMin = -2.3;
  const zMax = 2.38;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  // Blended cosine + linear longitudinal distribution for high curvature fidelity at nose, arches, and tail
  const zStations: number[] = [];
  for (let iz = 0; iz <= NZ; iz++) {
    const t = iz / NZ;
    const sCos = 0.5 - 0.5 * Math.cos(t * Math.PI);
    const s = t * 0.55 + sCos * 0.45;
    zStations.push(zMin + (zMax - zMin) * s);
  }

  for (let iz = 0; iz <= NZ; iz++) {
    const z = zStations[iz];
    const { yBot, yTopCenter, halfWidth, tipRound } = sampleBodyStation(z);
    const yMidBase = (yBot + yTopCenter) * 0.5;
    const halfHBase = Math.max(0.035, (yTopCenter - yBot) * 0.5);

    const frontArchWeight = gaussian(z, 1.43, 0.44);
    const rearArchWeight = gaussian(z, -1.4, 0.5);
    const cabinZone = smoothstep(0.95, 0.52, z) * smoothstep(-0.75, -0.35, z);

    for (let iu = 0; iu < NU; iu++) {
      const theta = (iu / NU) * Math.PI * 2;
      const sinT = Math.sin(theta);
      const cosT = Math.cos(theta);
      const absSin = Math.abs(sinT);
      const signX = sinT >= 0 ? 1 : -1;

      // Superellipse cross-section: planted rocker sill + sleek curved automotive shoulders
      const xShape = signX * Math.pow(absSin, cosT < 0 ? 0.78 : 0.92);
      const yShape = (cosT >= 0 ? 1 : -1) * Math.pow(Math.abs(cosT), cosT >= 0 ? 0.88 : 0.72);

      // Subtle upper tumblehome
      const tumblehome = cosT > 0 ? 1 - Math.pow(cosT, 1.65) * 0.12 : 1 - Math.pow(-cosT, 2.2) * 0.08;

      let x = xShape * halfWidth * tumblehome;
      let y = yMidBase + yShape * halfHBase;

      // Sculpted outer shoulder & muscular fender haunch crests (leaves central hood & engine bay sleekly recessed)
      const shoulderMask = smoothstep(0.22, 0.74, absSin) * smoothstep(-0.12, 0.55, cosT);
      const haunchHeight = (frontArchWeight * 0.245 + rearArchWeight * 0.195) * shoulderMask * tipRound;
      y += haunchHeight;

      // Cabin beltline raised gently at doors while centerline recesses smoothly to cradle the glass canopy
      if (cabinZone > 0.001 && cosT > 0.1) {
        const doorShoulder = smoothstep(0.45, 0.88, absSin) * cosT;
        y += cabinZone * doorShoulder * 0.055;
        const centerRecess = smoothstep(0.55, 0.1, absSin) * smoothstep(0.4, 0.95, cosT);
        y -= cabinZone * centerRecess * 0.065;
      }

      // Mid-engine sculpted side air-intake scallop on lower door flanks (catches flowing reflections)
      const intakeZoneZ = smoothstep(0.62, 0.08, z) * smoothstep(-1.02, -0.45, z);
      const intakeMaskY = smoothstep(-0.55, -0.05, cosT) * smoothstep(0.58, 0.08, cosT);
      if (intakeZoneZ > 0.001 && intakeMaskY > 0.001 && absSin > 0.48) {
        x *= 1 - intakeZoneZ * intakeMaskY * 0.15;
      }

      // Sculpted central aero valley along front hood
      if (z > 0.95 && z < 2.08 && cosT > 0.55) {
        const hoodMaskZ = smoothstep(0.95, 1.25, z) * smoothstep(2.08, 1.78, z);
        const centerMask = smoothstep(0.38, 0.05, absSin);
        y -= hoodMaskZ * centerMask * 0.04;
      }

      // Integrated sculpted circular wheel-arch cutouts & flared fender lips
      // Keeps wheel wells deeply recessed (|x| <= 0.65) below cavityRadius while fender crowns arch cleanly OVER the tires
      const axles: [number, number][] = [
        [1.43, 0.455],
        [-1.43, 0.445],
      ];
      for (const [zAxle, cavityRadius] of axles) {
        const dz = z - zAxle;
        if (Math.abs(dz) < cavityRadius + 0.24 && absSin > 0.24) {
          const dy = y - 0.37; // wheel hub Y = 0.37
          const distFromHub = Math.hypot(dz, dy);

          if (distFromHub < cavityRadius && dy < cavityRadius * 0.96) {
            const cavity = smoothstep(cavityRadius, cavityRadius * 0.72, distFromHub);
            const targetMaxX = 0.65;
            const curAbsX = Math.abs(x);
            if (curAbsX > targetMaxX) {
              x = signX * THREE.MathUtils.lerp(curAbsX, targetMaxX, cavity);
            }
          }

          // Subtle muscular lip flare tracing the circular arch perimeter
          const rimBand = gaussian(distFromHub, cavityRadius + 0.042, 0.06) * smoothstep(-0.14, 0.22, dy);
          x += signX * rimBand * 0.052 * absSin;
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
      const a = rowA + iu;
      const b = rowB + iu;
      const c = rowB + iuNext;
      const d = rowA + iuNext;
      indices.push(a, b, c, a, c, d);
    }
  }

  // Smooth rounded rear tail cap (-Z)
  const rearCenterIdx = positions.length / 3;
  const rearSt = sampleBodyStation(zMin);
  positions.push(0, (rearSt.yBot + rearSt.yTopCenter) * 0.52, zMin - 0.045);
  uvs.push(0.5, 0);
  for (let iu = 0; iu < NU; iu++) {
    const iuNext = (iu + 1) % NU;
    indices.push(rearCenterIdx, iu, iuNext);
  }

  // Smooth rounded front nose tip cap (+Z)
  const frontCenterIdx = positions.length / 3;
  const frontSt = sampleBodyStation(zMax);
  positions.push(0, (frontSt.yBot + frontSt.yTopCenter) * 0.5, zMax + 0.05);
  uvs.push(0.5, 1);
  const lastRow = NZ * NU;
  for (let iu = 0; iu < NU; iu++) {
    const iuNext = (iu + 1) % NU;
    indices.push(frontCenterIdx, lastRow + iuNext, lastRow + iu);
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
 * Generates a silky-smooth compound-curved teardrop panoramic glass canopy dome
 * seated flush inside the sculpted monocoque beltline.
 */
export function createTeardropCanopyGeometry(): THREE.BufferGeometry {
  const NZ = 36;
  const NU = 34;
  const zBack = -1.42;
  const zFront = 0.98;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let iz = 0; iz <= NZ; iz++) {
    const t = iz / NZ;
    const z = THREE.MathUtils.lerp(zBack, zFront, t);

    // Teardrop height arch peaking cleanly above the cockpit and flowing back into the engine deck
    const archEnvelope = Math.sin(Math.pow(t, 0.85) * Math.PI);
    const yBase = THREE.MathUtils.lerp(0.75, 0.7, t);
    const domeHeight = Math.pow(Math.max(0, archEnvelope), 0.78) * 0.44;

    const widthProfile = Math.sin(Math.pow(t, 0.7) * Math.PI);
    const halfW = 0.09 + Math.pow(Math.max(0, widthProfile), 0.64) * 0.63;

    for (let iu = 0; iu <= NU; iu++) {
      const u = iu / NU;
      const phi = (u - 0.5) * Math.PI;
      const sinP = Math.sin(phi);
      const cosP = Math.cos(phi);

      const x = sinP * halfW;
      const y = yBase + Math.pow(Math.max(0, cosP), 0.82) * domeHeight;

      positions.push(x, y, z);
      uvs.push(u, t);
    }
  }

  const stride = NU + 1;
  for (let iz = 0; iz < NZ; iz++) {
    for (let iu = 0; iu < NU; iu++) {
      const a = iz * stride + iu;
      const b = (iz + 1) * stride + iu;
      const c = (iz + 1) * stride + iu + 1;
      const d = iz * stride + iu + 1;
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
 * Generates a curved crescent carbon front aero splitter with smooth rounded bevels.
 */
export function createFrontSplitterGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-1.0, 1.88);
  shape.quadraticCurveTo(-1.04, 2.24, -0.62, 2.42);
  shape.quadraticCurveTo(0, 2.52, 0.62, 2.42);
  shape.quadraticCurveTo(1.04, 2.24, 1.0, 1.88);
  shape.quadraticCurveTo(0.55, 2.02, 0, 2.04);
  shape.quadraticCurveTo(-0.55, 2.02, -1.0, 1.88);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.032,
    bevelEnabled: true,
    bevelThickness: 0.014,
    bevelSize: 0.016,
    bevelSegments: 4,
    curveSegments: 24,
  });
  geo.rotateX(Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates a curved carbon aerodynamic front dive-plane canard winglet.
 */
export function createCanardWingletGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0.16, -0.05);
  shape.quadraticCurveTo(0.14, 0.07, -0.04, 0.09);
  shape.quadraticCurveTo(-0.16, 0.08, -0.14, -0.04);
  shape.quadraticCurveTo(0.0, -0.07, 0.16, -0.05);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.024,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: 3,
    curveSegments: 14,
  });
  geo.translate(0, 0, -0.012);
  geo.rotateY(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates a sleek contoured carbon side-skirt aero blade hugging the Coke-bottle rocker sill.
 */
export function createSideSkirtGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-0.88, 0.0);
  shape.quadraticCurveTo(-0.72, 0.075, 0.0, 0.06);
  shape.quadraticCurveTo(0.72, 0.075, 0.88, 0.0);
  shape.lineTo(0.84, -0.05);
  shape.quadraticCurveTo(0, -0.038, -0.84, -0.05);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.15,
    bevelEnabled: true,
    bevelThickness: 0.018,
    bevelSize: 0.018,
    bevelSegments: 4,
    curveSegments: 18,
  });
  geo.center();
  geo.rotateY(Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates a true cambered GT airfoil wing blade extruded smoothly across the full car width.
 */
export function createAirfoilWingGeometry(span = 2.02): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0.19, 0.012);
  shape.bezierCurveTo(0.14, 0.048, -0.06, 0.042, -0.2, 0.024);
  shape.lineTo(-0.205, 0.008);
  shape.bezierCurveTo(-0.07, -0.012, 0.12, -0.024, 0.19, 0.012);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: span,
    bevelEnabled: true,
    bevelThickness: 0.018,
    bevelSize: 0.01,
    bevelSegments: 4,
    curveSegments: 20,
  });
  geo.translate(0, 0, -span / 2);
  geo.rotateY(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates a sculpted aerodynamic wing endplate with curved leading/trailing contour.
 */
export function createWingEndplateGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0.24, -0.07);
  shape.quadraticCurveTo(0.26, 0.09, 0.08, 0.12);
  shape.quadraticCurveTo(-0.16, 0.14, -0.24, 0.07);
  shape.quadraticCurveTo(-0.26, -0.06, -0.14, -0.11);
  shape.quadraticCurveTo(0.06, -0.12, 0.24, -0.07);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.022,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: 3,
    curveSegments: 16,
  });
  geo.translate(0, 0, -0.011);
  geo.rotateY(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates a curved swan-neck GT wing pylon supporting the airfoil from above.
 */
export function createSwanNeckPylonGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0.11, -0.26);
  shape.bezierCurveTo(0.14, -0.06, 0.09, 0.08, 0.12, 0.15);
  shape.quadraticCurveTo(0.06, 0.2, -0.03, 0.17);
  shape.bezierCurveTo(0.0, 0.06, -0.05, -0.08, -0.02, -0.26);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.032,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: 3,
    curveSegments: 16,
  });
  geo.translate(0, 0, -0.016);
  geo.rotateY(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates a sculpted curved rear Venturi diffuser shroud.
 */
export function createRearDiffuserGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-0.88, -0.075);
  shape.quadraticCurveTo(0, -0.105, 0.88, -0.075);
  shape.quadraticCurveTo(0.92, 0.04, 0.82, 0.08);
  shape.quadraticCurveTo(0, 0.105, -0.82, 0.08);
  shape.quadraticCurveTo(-0.92, 0.04, -0.88, -0.075);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.34,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 4,
    curveSegments: 20,
  });
  geo.center();
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates a curved aerodynamic Venturi diffuser vertical strake fin.
 */
export function createDiffuserFinGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0.15, -0.07);
  shape.quadraticCurveTo(0.12, 0.06, -0.12, 0.085);
  shape.quadraticCurveTo(-0.17, 0.02, -0.14, -0.075);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.02,
    bevelEnabled: true,
    bevelThickness: 0.006,
    bevelSize: 0.006,
    bevelSegments: 2,
    curveSegments: 12,
  });
  geo.translate(0, 0, -0.01);
  geo.rotateY(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates a curved aerodynamic flying buttress flowing seamlessly from the canopy C-pillar to the rear fender haunch.
 */
export function createFlyingButtressGeometry(side: 1 | -1): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(side * 0.48, 1.07, -0.56),
    new THREE.Vector3(side * 0.62, 1.01, -1.04),
    new THREE.Vector3(side * 0.78, 0.94, -1.52),
    new THREE.Vector3(side * 0.84, 0.85, -1.94),
  ]);
  return new THREE.TubeGeometry(curve, 24, 0.056, 12, false);
}

/**
 * Generates a smooth swept A-pillar frame tube hugging the teardrop canopy windshield edge.
 */
export function createAPillarGeometry(side: 1 | -1): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(side * 0.68, 0.75, 0.88),
    new THREE.Vector3(side * 0.63, 0.97, 0.44),
    new THREE.Vector3(side * 0.56, 1.12, -0.05),
    new THREE.Vector3(side * 0.49, 1.08, -0.56),
  ]);
  return new THREE.TubeGeometry(curve, 20, 0.03, 10, false);
}

/**
 * Generates a sleek contoured dorsal roof intake scoop & rear engine spine hugging the canopy centerline.
 */
export function createRoofSpineGeometry(): THREE.BufferGeometry {
  // Side profile in (z, y) extruded cleanly across X with smooth rounded bevels
  const shape = new THREE.Shape();
  shape.moveTo(0.24, 1.11);
  shape.bezierCurveTo(0.05, 1.2, -0.25, 1.21, -0.52, 1.15);
  shape.bezierCurveTo(-0.88, 1.06, -1.18, 0.93, -1.48, 0.84);
  shape.lineTo(-1.46, 0.78);
  shape.bezierCurveTo(-1.05, 0.88, -0.55, 1.05, 0.2, 1.06);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.24,
    bevelEnabled: true,
    bevelThickness: 0.045,
    bevelSize: 0.025,
    bevelSegments: 4,
    curveSegments: 22,
  });
  geo.translate(0, 0, -0.12);
  geo.rotateY(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates curved wraparound front laser headlight light-blade tubes conforming to the sculpted nose.
 */
export function createFrontHeadlightGeometry(side: 1 | -1): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(side * 0.42, 0.47, 2.27),
    new THREE.Vector3(side * 0.65, 0.51, 2.2),
    new THREE.Vector3(side * 0.85, 0.58, 2.02),
    new THREE.Vector3(side * 0.94, 0.65, 1.82),
  ]);
  return new THREE.TubeGeometry(curve, 18, 0.024, 8, false);
}

/**
 * Generates a curved front nose intake light bar hugging the sculpted front chin.
 */
export function createFrontAccentLightGeometry(): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.62, 0.3, 2.34),
    new THREE.Vector3(-0.32, 0.295, 2.41),
    new THREE.Vector3(0, 0.295, 2.43),
    new THREE.Vector3(0.32, 0.295, 2.41),
    new THREE.Vector3(0.62, 0.3, 2.34),
  ]);
  return new THREE.TubeGeometry(curve, 22, 0.013, 8, false);
}

/**
 * Generates a continuous curved full-width rear taillight blade conforming to the Kammback tail.
 */
export function createRearTaillightBladeGeometry(): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.88, 0.63, -2.23),
    new THREE.Vector3(-0.55, 0.65, -2.31),
    new THREE.Vector3(0.0, 0.66, -2.34),
    new THREE.Vector3(0.55, 0.65, -2.31),
    new THREE.Vector3(0.88, 0.63, -2.23),
  ]);
  return new THREE.TubeGeometry(curve, 28, 0.026, 8, false);
}

/**
 * Generates a curved reverse light lens pod conforming to the rear tail fascia.
 */
export function createReverseLightGeometry(side: 1 | -1): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(side * 0.44, 0.52, -2.32),
    new THREE.Vector3(side * 0.62, 0.52, -2.3),
    new THREE.Vector3(side * 0.78, 0.53, -2.25),
  ]);
  return new THREE.TubeGeometry(curve, 12, 0.022, 8, false);
}

/**
 * Generates a curved teardrop aerodynamic side mirror stalk.
 */
export function createMirrorStalkGeometry(side: 1 | -1): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(side * 0.76, 0.74, 0.66),
    new THREE.Vector3(side * 0.89, 0.78, 0.64),
    new THREE.Vector3(side * 0.98, 0.83, 0.6),
  ]);
  return new THREE.TubeGeometry(curve, 12, 0.016, 8, false);
}

/**
 * Generates a curved mid-engine titanium cooling louver slat.
 */
export function createEngineLouverGeometry(): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.44, 0, 0.02),
    new THREE.Vector3(-0.22, 0.018, 0.0),
    new THREE.Vector3(0, 0.024, -0.01),
    new THREE.Vector3(0.22, 0.018, 0.0),
    new THREE.Vector3(0.44, 0, 0.02),
  ]);
  const geo = new THREE.TubeGeometry(curve, 18, 0.018, 8, false);
  geo.scale(1, 0.5, 1.8);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates a smooth rounded-shoulder performance tire using LatheGeometry
 * (eliminates flat cylindrical edges for realistic curved tire sidewalls & tread crown).
 */
export function createSculptedTireGeometry(radius: number, width: number): THREE.BufferGeometry {
  const halfW = width * 0.5;
  const innerR = radius * 0.66;
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(innerR, -halfW * 0.96),
    new THREE.Vector2(innerR + 0.025, -halfW),
    new THREE.Vector2(radius * 0.87, -halfW * 1.03),
    new THREE.Vector2(radius * 0.965, -halfW * 0.93),
    new THREE.Vector2(radius * 0.996, -halfW * 0.65),
    new THREE.Vector2(radius, 0),
    new THREE.Vector2(radius * 0.996, halfW * 0.65),
    new THREE.Vector2(radius * 0.965, halfW * 0.93),
    new THREE.Vector2(radius * 0.87, halfW * 1.03),
    new THREE.Vector2(innerR + 0.025, halfW),
    new THREE.Vector2(innerR, halfW * 0.96),
  ];
  const geo = new THREE.LatheGeometry(pts, 32);
  geo.rotateZ(Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates a sculpted concave forged-alloy wheel rim barrel via LatheGeometry.
 */
export function createForgedRimBarrelGeometry(radius: number, width: number): THREE.BufferGeometry {
  const halfW = width * 0.49;
  const rimR = radius * 0.675;
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(rimR * 0.92, -halfW),
    new THREE.Vector2(rimR, -halfW),
    new THREE.Vector2(rimR, -halfW * 0.72),
    new THREE.Vector2(rimR * 0.88, -halfW * 0.2),
    new THREE.Vector2(rimR * 0.88, halfW * 0.25),
    new THREE.Vector2(rimR, halfW * 0.78),
    new THREE.Vector2(rimR * 1.02, halfW),
    new THREE.Vector2(rimR * 0.93, halfW * 1.02),
  ];
  const geo = new THREE.LatheGeometry(pts, 28);
  geo.rotateZ(Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates a sculpted tapered alloy wheel spoke with beveled edges.
 */
export function createAlloySpokeGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-0.024, 0.02);
  shape.lineTo(0.024, 0.02);
  shape.lineTo(0.015, 0.215);
  shape.lineTo(-0.015, 0.215);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.022,
    bevelEnabled: true,
    bevelThickness: 0.006,
    bevelSize: 0.005,
    bevelSegments: 2,
  });
  geo.translate(0, -0.02, -0.011);
  geo.rotateY(Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates a curved 6-piston brake caliper hugging the brake rotor perimeter.
 */
export function createBrakeCaliperGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const rIn = 0.145;
  const rOut = 0.212;
  const aStart = -0.52;
  const aEnd = 0.52;
  shape.absarc(0, 0, rOut, aStart, aEnd, false);
  shape.absarc(0, 0, rIn, aEnd, aStart, true);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.072,
    bevelEnabled: true,
    bevelThickness: 0.009,
    bevelSize: 0.008,
    bevelSegments: 3,
    curveSegments: 12,
  });
  geo.translate(0, 0, -0.036);
  geo.rotateY(Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates a smooth contoured racing bucket seat backrest/cushion profile.
 */
export function createBucketSeatGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0.22, -0.04);
  shape.quadraticCurveTo(0.24, 0.06, 0.04, 0.06);
  shape.quadraticCurveTo(-0.08, 0.07, -0.14, 0.26);
  shape.quadraticCurveTo(-0.2, 0.48, -0.18, 0.56);
  shape.quadraticCurveTo(-0.25, 0.58, -0.27, 0.48);
  shape.quadraticCurveTo(-0.24, 0.16, -0.16, -0.04);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.34,
    bevelEnabled: true,
    bevelThickness: 0.032,
    bevelSize: 0.028,
    bevelSegments: 4,
    curveSegments: 16,
  });
  geo.translate(0, 0, -0.17);
  geo.rotateY(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates a curved titanium exhaust bell nozzle via LatheGeometry.
 */
export function createExhaustNozzleGeometry(): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0.068, 0),
    new THREE.Vector2(0.085, 0.01),
    new THREE.Vector2(0.098, 0.08),
    new THREE.Vector2(0.104, 0.16),
    new THREE.Vector2(0.088, 0.175),
    new THREE.Vector2(0.076, 0.155),
    new THREE.Vector2(0.068, 0.04),
  ];
  const geo = new THREE.LatheGeometry(pts, 20);
  geo.rotateX(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates a curved kinetic core light conduit running along the mid-engine deck.
 */
export function createKineticRailGeometry(side: 1 | -1): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(side * 0.22, 0.85, -0.82),
    new THREE.Vector3(side * 0.24, 0.84, -1.24),
    new THREE.Vector3(side * 0.21, 0.79, -1.68),
    new THREE.Vector3(side * 0.18, 0.74, -2.02),
  ]);
  return new THREE.TubeGeometry(curve, 18, 0.02, 8, false);
}

/**
 * Generates a smooth curved side-sill cyan light pipe hugging the Coke-bottle rocker skirt.
 */
export function createSideSillLightGeometry(side: 1 | -1): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(side * 1.0, 0.22, 0.84),
    new THREE.Vector3(side * 0.93, 0.22, 0.14),
    new THREE.Vector3(side * 0.98, 0.23, -0.55),
    new THREE.Vector3(side * 1.01, 0.24, -0.84),
  ]);
  return new THREE.TubeGeometry(curve, 20, 0.013, 8, false);
}

/**
 * Generates a smooth contoured steering yoke rim for the visible cockpit.
 */
export function createSteeringYokeGeometry(): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(-0.14, 0.08, 0),
      new THREE.Vector3(-0.15, -0.02, 0),
      new THREE.Vector3(-0.08, -0.055, 0),
      new THREE.Vector3(0.08, -0.055, 0),
      new THREE.Vector3(0.15, -0.02, 0),
      new THREE.Vector3(0.14, 0.08, 0),
    ],
    false
  );
  return new THREE.TubeGeometry(curve, 20, 0.019, 8, false);
}
