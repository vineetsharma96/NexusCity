import * as THREE from 'three';
import { TrafficLightSystem } from './TrafficLightSystem';
import { TrafficCarArchetype } from './TrafficCarGeometry';

export type TrafficAxis = 'NS' | 'EW';
export type TurnKind = 'STRAIGHT' | 'LEFT' | 'RIGHT';

export interface ActiveTurnState {
  kind: 'LEFT' | 'RIGHT';
  p0x: number;
  p0z: number;
  p1x: number;
  p1z: number;
  p2x: number;
  p2z: number;
  u: number;
  destAxis: TrafficAxis;
  destAvenue: number;
  destDir: 1 | -1;
  destLaneIndex: 0 | 1;
}

export interface TrafficCarAgent {
  id: number;
  archetype: TrafficCarArchetype;
  archetypeIndex: number;
  axis: TrafficAxis;
  avenueCoord: number;
  dir: 1 | -1;
  laneIndex: 0 | 1; // 0 = inner lane, 1 = outer lane
  coord: number; // position along current axis when driving straight
  x: number;
  z: number;
  yaw: number;
  roll: number;
  pitch: number;
  speed: number;
  maxSpeed: number;
  isBraking: boolean;
  bodyColor: string;
  trimColor: string;
  length: number;
  activeTurn: ActiveTurnState | null;
  plannedIntersection: number | null;
  plannedManeuver: TurnKind;
  decisionSeed: number;
}

export const CENTRAL_GRID_AVENUES = [-165, -75, 0, 75, 165] as const;

const ARCHETYPE_ORDER: readonly TrafficCarArchetype[] = ['SEDAN', 'SUV', 'COUPE', 'VAN'];

const ARCHETYPE_PALETTES: Record<TrafficCarArchetype, readonly string[]> = {
  SEDAN: ['#cbd5e1', '#1e3a5f', '#334155', '#134e4a', '#78716c', '#1e293b'],
  SUV: ['#e2e8f0', '#3f4c5e', '#14532d', '#7c2d12', '#1f2937', '#475569'],
  COUPE: ['#be123c', '#d97706', '#1d4ed8', '#0284c7', '#f1f5f9', '#b91c1c'],
  VAN: ['#f8fafc', '#0f766e', '#334155', '#d97706', '#475569'],
};

const ARCHETYPE_LENGTHS: Record<TrafficCarArchetype, number> = {
  SEDAN: 4.58,
  SUV: 4.82,
  COUPE: 4.42,
  VAN: 5.15,
};

const ARCHETYPE_BASE_SPEEDS: Record<TrafficCarArchetype, number> = {
  SEDAN: 14.5,
  SUV: 13.0,
  COUPE: 16.5,
  VAN: 11.2,
};

/**
 * Returns the asphalt width of a city avenue (22m for Grand Boulevards at 0, 18m for secondary/ring avenues).
 */
export function getAvenueWidth(avenueCoord: number): number {
  return avenueCoord === 0 ? 22 : 18;
}

/**
 * Returns the true right-hand-drive signed lateral offset from road centerline.
 * In Three.js (+X East, +Z South, +Y Up):
 *   Forward F = (fx, fz) -> Right vector R = (-fz, fx).
 *   NS dir=+1 (South +Z): x = ave - absLane
 *   NS dir=-1 (North -Z): x = ave + absLane
 *   EW dir=+1 (East  +X): z = ave + absLane
 *   EW dir=-1 (West  -X): z = ave - absLane
 */
export function getRightHandLaneOffset(
  axis: TrafficAxis,
  dir: 1 | -1,
  avenueCoord: number,
  laneIndex: 0 | 1,
): number {
  const absLane = avenueCoord === 0 ? (laneIndex === 0 ? 3.2 : 6.4) : laneIndex === 0 ? 2.6 : 5.4;
  if (axis === 'NS') {
    return dir === 1 ? -absLane : absLane;
  }
  return dir === 1 ? absLane : -absLane;
}

export function getForwardVector(axis: TrafficAxis, dir: 1 | -1): [number, number] {
  return axis === 'NS' ? [0, dir] : [dir, 0];
}

export function getHeadingYaw(axis: TrafficAxis, dir: 1 | -1): number {
  if (axis === 'NS') return dir === 1 ? 0 : Math.PI;
  return dir === 1 ? Math.PI / 2 : -Math.PI / 2;
}

function normalizeAngleDelta(delta: number): number {
  let d = delta;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * Checks whether driving from intersection (ix, iz) along (axis, dir) stays on valid city pavement
 * and strictly avoids both car-free Park Sanctuaries ((75, 75) and (0, 240)).
 */
export function isOutgoingRoadSegmentValid(
  ix: number,
  iz: number,
  axis: TrafficAxis,
  dir: 1 | -1,
): boolean {
  const nextCoord = (axis === 'NS' ? iz : ix) + dir * 75;
  const fixedCoord = axis === 'NS' ? ix : iz;

  // Keep central-district traffic cleanly inside the Central Ring [-165..165]
  if (Math.abs(ix) <= 165 && Math.abs(iz) <= 165) {
    if (axis === 'NS') {
      const nextZ = getNextGridCoord(iz, dir);
      if (nextZ === null) return false;
      // Exclude (75, 75) East Park Sanctuary
      if (ix === 75 && nextZ === 75) return false;
      // Exclude entering (0, 240) North Park Sanctuary from (0, 165)
      if (ix === 0 && iz === 165 && dir === 1) return false;
      return true;
    } else {
      const nextX = getNextGridCoord(ix, dir);
      if (nextX === null) return false;
      // Exclude (75, 75) East Park Sanctuary
      if (iz === 75 && nextX === 75) return false;
      return true;
    }
  }

  // Fallback for outer corridors
  if (fixedCoord === 0 && axis === 'NS' && nextCoord > 190 && nextCoord < 290) return false;
  return Math.abs(nextCoord) <= 420;
}

function getNextGridCoord(current: number, dir: 1 | -1): number | null {
  const idx = CENTRAL_GRID_AVENUES.indexOf(current as (typeof CENTRAL_GRID_AVENUES)[number]);
  if (idx === -1) return null;
  const nextIdx = idx + dir;
  if (nextIdx < 0 || nextIdx >= CENTRAL_GRID_AVENUES.length) return null;
  return CENTRAL_GRID_AVENUES[nextIdx];
}

/**
 * Finds the next upcoming intersection coordinate along the vehicle's current straight road.
 */
export function findNextIntersectionCoord(
  coord: number,
  dir: 1 | -1,
  minLead = 0.5,
): number | null {
  if (dir === 1) {
    for (let i = 0; i < CENTRAL_GRID_AVENUES.length; i++) {
      const c = CENTRAL_GRID_AVENUES[i];
      if (c > coord + minLead) return c;
    }
    return null;
  } else {
    for (let i = CENTRAL_GRID_AVENUES.length - 1; i >= 0; i--) {
      const c = CENTRAL_GRID_AVENUES[i];
      if (c < coord - minLead) return c;
    }
    return null;
  }
}

/**
 * Computes the destination axis and direction for a STRAIGHT, LEFT, or RIGHT maneuver.
 * Verified in Three.js (+X East, +Z South, +Y Up):
 *   Left turn from F=(fx, fz):  F_left  = (fz, -fx)
 *   Right turn from F=(fx, fz): F_right = (-fz, fx)
 */
export function resolveTurnDirection(
  axis: TrafficAxis,
  dir: 1 | -1,
  maneuver: TurnKind,
): { destAxis: TrafficAxis; destDir: 1 | -1 } {
  if (maneuver === 'STRAIGHT') return { destAxis: axis, destDir: dir };
  const [fx, fz] = getForwardVector(axis, dir);
  const [nx, nz] = maneuver === 'LEFT' ? [fz, -fx] : [-fz, fx];
  if (nx !== 0) return { destAxis: 'EW', destDir: nx > 0 ? 1 : -1 };
  return { destAxis: 'NS', destDir: nz > 0 ? 1 : -1 };
}

/**
 * Builds a C¹-continuous Quadratic Bezier curve through intersection (ix, iz) connecting
 * the vehicle's current right-hand lane smoothly into the destination road's right-hand lane.
 */
export function buildIntersectionTurnBezier(
  ix: number,
  iz: number,
  inAxis: TrafficAxis,
  inDir: 1 | -1,
  inLane: 0 | 1,
  maneuver: 'LEFT' | 'RIGHT',
): ActiveTurnState {
  const { destAxis, destDir } = resolveTurnDirection(inAxis, inDir, maneuver);
  const inAvenue = inAxis === 'NS' ? ix : iz;
  const destAvenue = destAxis === 'NS' ? ix : iz;
  const inRoadW = getAvenueWidth(inAvenue);
  const destRoadW = getAvenueWidth(destAvenue);

  // Inner lane prefers left turns, outer lane prefers right turns; preserve lane cleanly on exit
  const destLane: 0 | 1 = inLane;
  const inLaneOff = getRightHandLaneOffset(inAxis, inDir, inAvenue, inLane);
  const destLaneOff = getRightHandLaneOffset(destAxis, destDir, destAvenue, destLane);

  const entryDist = destRoadW * 0.5 + 1.6;
  const exitDist = inRoadW * 0.5 + 1.6;

  let p0x: number;
  let p0z: number;
  let p2x: number;
  let p2z: number;
  let p1x: number;
  let p1z: number;

  if (inAxis === 'NS') {
    p0x = ix + inLaneOff;
    p0z = iz - inDir * entryDist;
    p2x = ix + destDir * exitDist;
    p2z = iz + destLaneOff;
    // Exact intersection of entry NS lane line (x = p0x) and exit EW lane line (z = p2z)
    p1x = p0x;
    p1z = p2z;
  } else {
    p0x = ix - inDir * entryDist;
    p0z = iz + inLaneOff;
    p2x = ix + destLaneOff;
    p2z = iz + destDir * exitDist;
    // Exact intersection of entry EW lane line (z = p0z) and exit NS lane line (x = p2x)
    p1x = p2x;
    p1z = p0z;
  }

  return {
    kind: maneuver,
    p0x,
    p0z,
    p1x,
    p1z,
    p2x,
    p2z,
    u: 0,
    destAxis,
    destAvenue,
    destDir,
    destLaneIndex: destLane,
  };
}

function evalBezierPointAndTangent(turn: ActiveTurnState, u: number) {
  const inv = 1 - u;
  const x = inv * inv * turn.p0x + 2 * inv * u * turn.p1x + u * u * turn.p2x;
  const z = inv * inv * turn.p0z + 2 * inv * u * turn.p1z + u * u * turn.p2z;
  const tx = 2 * inv * (turn.p1x - turn.p0x) + 2 * u * (turn.p2x - turn.p1x);
  const tz = 2 * inv * (turn.p1z - turn.p0z) + 2 * u * (turn.p2z - turn.p1z);
  const tangentLen = Math.hypot(tx, tz);
  return { x, z, tx, tz, tangentLen };
}

function chooseManeuverAtIntersection(
  agent: TrafficCarAgent,
  ix: number,
  iz: number,
): TurnKind {
  const candidates: TurnKind[] = [];
  const check = (m: TurnKind) => {
    const { destAxis, destDir } = resolveTurnDirection(agent.axis, agent.dir, m);
    return isOutgoingRoadSegmentValid(ix, iz, destAxis, destDir);
  };

  const canStraight = check('STRAIGHT');
  const canLeft = check('LEFT');
  const canRight = check('RIGHT');

  // Lane-realistic maneuver weights (outer lane turns right more often, inner lane turns left more often)
  if (canStraight) {
    candidates.push('STRAIGHT', 'STRAIGHT');
  }
  if (canRight) {
    candidates.push('RIGHT');
    if (agent.laneIndex === 1) candidates.push('RIGHT');
  }
  if (canLeft) {
    candidates.push('LEFT');
    if (agent.laneIndex === 0) candidates.push('LEFT');
  }

  if (candidates.length === 0) {
    return 'STRAIGHT';
  }

  // Deterministic LCG advance per agent so turns vary naturally every intersection
  agent.decisionSeed = (agent.decisionSeed * 1664525 + 1013904223) >>> 0;
  return candidates[agent.decisionSeed % candidates.length];
}

/**
 * Generates an evenly distributed fleet of diverse NPC cars across the valid Central District road network.
 */
export function createInitialTrafficFleet(count = 88): TrafficCarAgent[] {
  // Build all valid straight road segments between adjacent intersections in Central District
  interface RoadSegment {
    axis: TrafficAxis;
    avenue: number;
    dir: 1 | -1;
    startCoord: number;
    endCoord: number;
  }

  const segments: RoadSegment[] = [];
  for (const ave of CENTRAL_GRID_AVENUES) {
    for (let i = 0; i < CENTRAL_GRID_AVENUES.length - 1; i++) {
      const a = CENTRAL_GRID_AVENUES[i];
      const b = CENTRAL_GRID_AVENUES[i + 1];
      // NS segment at x = ave, z in [a, b]
      if (!(ave === 75 && (a === 75 || b === 75))) {
        segments.push({ axis: 'NS', avenue: ave, dir: 1, startCoord: a, endCoord: b });
        segments.push({ axis: 'NS', avenue: ave, dir: -1, startCoord: b, endCoord: a });
      }
      // EW segment at z = ave, x in [a, b]
      if (!(ave === 75 && (a === 75 || b === 75))) {
        segments.push({ axis: 'EW', avenue: ave, dir: 1, startCoord: a, endCoord: b });
        segments.push({ axis: 'EW', avenue: ave, dir: -1, startCoord: b, endCoord: a });
      }
    }
  }

  const perArchetypeCounter: Record<TrafficCarArchetype, number> = {
    SEDAN: 0,
    SUV: 0,
    COUPE: 0,
    VAN: 0,
  };

  const agents: TrafficCarAgent[] = [];
  for (let i = 0; i < count; i++) {
    const seg = segments[i % segments.length];
    const archetype = ARCHETYPE_ORDER[i % ARCHETYPE_ORDER.length];
    const archetypeIndex = perArchetypeCounter[archetype]++;
    const palette = ARCHETYPE_PALETTES[archetype];
    const bodyColor = palette[(i * 3 + archetypeIndex) % palette.length];
    const trimColor = archetype === 'COUPE' ? '#fef08a' : archetype === 'VAN' ? '#bae6fd' : '#f8fafc';

    // Bias spawn position safely inside the middle of the road segment (clear of intersection boxes & parked player cars)
    const laneIndex: 0 | 1 = (Math.floor(i / segments.length) + i) % 2 === 0 ? 0 : 1;
    const tFrac = 0.28 + ((i * 37) % 100) / 100 * 0.44;
    const coord = THREE.MathUtils.lerp(seg.startCoord, seg.endCoord, tFrac);
    const laneOff = getRightHandLaneOffset(seg.axis, seg.dir, seg.avenue, laneIndex);
    const x = seg.axis === 'NS' ? seg.avenue + laneOff : coord;
    const z = seg.axis === 'NS' ? coord : seg.avenue + laneOff;
    const yaw = getHeadingYaw(seg.axis, seg.dir);
    const baseSpeed = ARCHETYPE_BASE_SPEEDS[archetype];
    const maxSpeed = baseSpeed + ((i % 4) - 1.5) * 1.1;

    agents.push({
      id: i,
      archetype,
      archetypeIndex,
      axis: seg.axis,
      avenueCoord: seg.avenue,
      dir: seg.dir,
      laneIndex,
      coord,
      x,
      z,
      yaw,
      roll: 0,
      pitch: 0,
      speed: maxSpeed * 0.75,
      maxSpeed,
      isBraking: false,
      bodyColor,
      trimColor,
      length: ARCHETYPE_LENGTHS[archetype],
      activeTurn: null,
      plannedIntersection: null,
      plannedManeuver: 'STRAIGHT',
      decisionSeed: (i + 1) * 2654435761,
    });
  }

  return agents;
}

export interface TrafficStepOptions {
  dt: number;
  lights: TrafficLightSystem;
  speedScale?: number;
  roadGripScale?: number;
  aeroAirScale?: number;
  playerPos?: { x: number; z: number } | null;
  activeCount?: number;
}

/**
 * Advances all active NPC traffic cars for one simulation step:
 * - Multi-intersection traffic-light obeying (stop behind crosswalk stop bar on RED/YELLOW)
 * - Same-lane car following & red-light queuing (zero stacking)
 * - Yielding cleanly to the player on foot or in an experimental car
 * - Smooth C¹ Quadratic Bezier 90° left/right turning with continuous yaw & cornering body roll
 */
export function stepTrafficFleet(agents: TrafficCarAgent[], options: TrafficStepOptions): void {
  const dt = Math.min(Math.max(options.dt, 0.001), 0.05);
  const lights = options.lights;
  const speedScale = options.speedScale ?? 1.0;
  const roadGripScale = options.roadGripScale ?? 1.0;
  const aeroAirScale = options.aeroAirScale ?? 1.0;
  const playerPos = options.playerPos ?? null;
  const activeCount = Math.min(agents.length, options.activeCount ?? agents.length);
  const weatherCap = (0.78 + 0.22 * roadGripScale) * aeroAirScale;

  for (let i = 0; i < activeCount; i++) {
    const car = agents[i];
    const prevSpeed = car.speed;

    // 1. Check for closest vehicle ahead in path (car-following + red-light queuing)
    const fx = Math.sin(car.yaw);
    const fz = Math.cos(car.yaw);
    let minGapAhead = Infinity;
    let leadSpeed = car.maxSpeed;

    for (let j = 0; j < activeCount; j++) {
      if (i === j) continue;
      const other = agents[j];
      const dx = other.x - car.x;
      const dz = other.z - car.z;
      const distSq = dx * dx + dz * dz;
      if (distSq > 361) continue; // > 19m away

      const forwardProj = dx * fx + dz * fz;
      if (forwardProj <= 0.4) continue;
      const lateralOffset = Math.abs(dx * fz - dz * fx);
      if (lateralOffset > 2.05) continue;

      const bumperGap = forwardProj - (car.length + other.length) * 0.5;
      if (bumperGap < minGapAhead) {
        minGapAhead = bumperGap;
        leadSpeed = other.speed;
      }
    }

    // 2. Yield smoothly if the player (on foot or driving) is directly ahead in lane
    if (playerPos) {
      const pdx = playerPos.x - car.x;
      const pdz = playerPos.z - car.z;
      if (pdx * pdx + pdz * pdz < 256) {
        const forwardProj = pdx * fx + pdz * fz;
        const lateralOffset = Math.abs(pdx * fz - pdz * fx);
        if (forwardProj > 0.5 && lateralOffset < 2.55) {
          const playerGap = forwardProj - car.length * 0.5 - 2.4;
          if (playerGap < minGapAhead) {
            minGapAhead = playerGap;
            leadSpeed = 0;
          }
        }
      }
    }

    // 3. Evaluate either active smooth Bezier turn OR straight-road traffic-light & turn-entry logic
    let targetSpeed = car.maxSpeed * speedScale * weatherCap;
    let mustStop = false;

    if (car.activeTurn) {
      // Smoothly modulate cornering speed during left/right arcs
      const cornerCap = car.activeTurn.kind === 'RIGHT' ? 7.6 : 9.4;
      targetSpeed = Math.min(targetSpeed, cornerCap * speedScale * weatherCap);
    } else {
      const nextInt = findNextIntersectionCoord(car.coord, car.dir, 0.25);
      if (nextInt !== null) {
        const ix = car.axis === 'NS' ? car.avenueCoord : nextInt;
        const iz = car.axis === 'NS' ? nextInt : car.avenueCoord;
        const crossRoadWidth = getAvenueWidth(nextInt);

        // Lock in a valid upcoming maneuver once approaching this intersection
        if (car.plannedIntersection !== nextInt) {
          car.plannedIntersection = nextInt;
          car.plannedManeuver = chooseManeuverAtIntersection(car, ix, iz);
        }

        // Traffic light check at this upcoming intersection
        const stopCtrl = lights.evaluateStopControl(
          car.axis,
          car.coord,
          car.dir,
          nextInt,
          crossRoadWidth,
          car.avenueCoord,
        );

        if (stopCtrl.shouldStop) {
          if (stopCtrl.distToStop <= 1.2) {
            targetSpeed = 0;
            mustStop = true;
          } else {
            // Smooth kinematic stopping profile: v = sqrt(2 * a * d)
            const stopCap = Math.sqrt(Math.max(0, 2 * 6.5 * roadGripScale * (stopCtrl.distToStop - 0.6)));
            targetSpeed = Math.min(targetSpeed, stopCap);
          }
        }

        // Slow gently ahead of a planned left or right turn
        const entryDist = crossRoadWidth * 0.5 + 1.6;
        const distToTurnEntry = (nextInt - car.dir * entryDist - car.coord) * car.dir;
        if (car.plannedManeuver !== 'STRAIGHT' && distToTurnEntry < 18 && distToTurnEntry > -1) {
          const cornerSpeed = car.plannedManeuver === 'RIGHT' ? 7.6 : 9.4;
          const blend = THREE.MathUtils.clamp(distToTurnEntry / 18, 0, 1);
          targetSpeed = Math.min(targetSpeed, THREE.MathUtils.lerp(cornerSpeed, targetSpeed, blend));
        }

        // Enter smooth Bezier turn precisely at the intersection apron edge
        if (car.plannedManeuver !== 'STRAIGHT' && distToTurnEntry <= 0.25 && !stopCtrl.shouldStop) {
          car.activeTurn = buildIntersectionTurnBezier(
            ix,
            iz,
            car.axis,
            car.dir,
            car.laneIndex,
            car.plannedManeuver,
          );
          car.plannedIntersection = null;
          car.plannedManeuver = 'STRAIGHT';
        }
      }
    }

    // 4. Apply car-following & obstacle braking envelope
    if (minGapAhead < 14.0) {
      if (minGapAhead <= 3.1 || (leadSpeed < 0.25 && minGapAhead <= 3.6)) {
        targetSpeed = 0;
        mustStop = true;
      } else {
        const stopCap = Math.sqrt(Math.max(0, 2 * 6.0 * roadGripScale * (minGapAhead - 3.1)));
        const followFrac = THREE.MathUtils.clamp((minGapAhead - 3.1) / 10.9, 0, 1);
        const matchSpeed = leadSpeed + followFrac * (car.maxSpeed - leadSpeed);
        targetSpeed = Math.min(targetSpeed, leadSpeed < 0.5 ? stopCap : Math.min(matchSpeed, leadSpeed + stopCap));
      }
    }

    // 5. Realistic acceleration vs braking integration
    const accelRate = (targetSpeed < car.speed ? 13.5 : 5.4) * roadGripScale;
    const maxStep = accelRate * dt;
    if (car.speed < targetSpeed) {
      car.speed = Math.min(targetSpeed, car.speed + maxStep);
    } else {
      car.speed = Math.max(targetSpeed, car.speed - maxStep);
    }
    if (mustStop && car.speed < 0.08) {
      car.speed = 0;
    }

    const decelRate = (prevSpeed - car.speed) / dt;
    car.isBraking = mustStop || car.speed < 0.25 || decelRate > 1.4;

    // Subtle braking nose-dive / launch squat pitch
    const targetPitch = THREE.MathUtils.clamp((prevSpeed - car.speed) / dt * 0.0045, -0.028, 0.032);
    car.pitch = THREE.MathUtils.lerp(car.pitch, targetPitch, 1 - Math.exp(-9 * dt));

    // 6. Advance position & heading smoothly
    if (car.activeTurn) {
      const turn = car.activeTurn;
      const sample = evalBezierPointAndTangent(turn, turn.u);
      const du = (car.speed * dt) / Math.max(0.5, sample.tangentLen);
      turn.u = Math.min(1, turn.u + du);

      const nextSample = evalBezierPointAndTangent(turn, turn.u);
      car.x = nextSample.x;
      car.z = nextSample.z;

      const targetYaw = Math.atan2(nextSample.tx, nextSample.tz);
      const yawDelta = normalizeAngleDelta(targetYaw - car.yaw);
      const yawRate = yawDelta / dt;
      car.yaw += yawDelta * Math.min(1, dt * 16);

      // Subtle authentic suspension body roll leaning away from turn direction
      const targetRoll = THREE.MathUtils.clamp(-yawRate * car.speed * 0.0055, -0.065, 0.065);
      car.roll = THREE.MathUtils.lerp(car.roll, targetRoll, 1 - Math.exp(-10 * dt));

      // Complete turn seamlessly onto the destination road's right-hand lane
      if (turn.u >= 1) {
        car.axis = turn.destAxis;
        car.avenueCoord = turn.destAvenue;
        car.dir = turn.destDir;
        car.laneIndex = turn.destLaneIndex;
        car.coord = car.axis === 'NS' ? car.z : car.x;
        car.yaw = getHeadingYaw(car.axis, car.dir);
        car.activeTurn = null;
        car.plannedIntersection = null;
        car.plannedManeuver = 'STRAIGHT';
      }
    } else {
      car.coord += car.speed * car.dir * dt;
      const laneOff = getRightHandLaneOffset(car.axis, car.dir, car.avenueCoord, car.laneIndex);
      const targetX = car.axis === 'NS' ? car.avenueCoord + laneOff : car.coord;
      const targetZ = car.axis === 'NS' ? car.coord : car.avenueCoord + laneOff;
      car.x = THREE.MathUtils.lerp(car.x, targetX, Math.min(1, dt * 14));
      car.z = THREE.MathUtils.lerp(car.z, targetZ, Math.min(1, dt * 14));

      const targetYaw = getHeadingYaw(car.axis, car.dir);
      car.yaw += normalizeAngleDelta(targetYaw - car.yaw) * Math.min(1, dt * 14);
      car.roll = THREE.MathUtils.lerp(car.roll, 0, 1 - Math.exp(-8 * dt));

      // Safety fallback if a car ever approaches the outer central perimeter without a turn
      if (Math.abs(car.coord) > 170) {
        car.dir = car.coord > 0 ? -1 : 1;
        car.coord = THREE.MathUtils.clamp(car.coord, -166, 166);
        car.yaw = getHeadingYaw(car.axis, car.dir);
        car.plannedIntersection = null;
      }
    }
  }
}
