/**
 * World Road Clearance Utility
 *
 * Single source of truth describing every paved road corridor in both the Central District
 * and outer streamed procedural chunks. Used by world generators and automated tests to
 * guarantee zero buildings, trees, streetlights, terminals, lifts, transit stops, repair bays,
 * steam vents, or street props ever overlap any driving roadway.
 */

export const CENTRAL_CORE_LIMIT = 175;
export const CHUNK_SIZE = 120;

export const GRAND_BOULEVARD_HALF_WIDTH = 11.0; // 22m wide (x = 0, z = 0)
export const SECONDARY_AVENUE_HALF_WIDTH = 9.0; // 18m wide (±75, ±165)
export const CHUNK_NS_ROAD_HALF_WIDTH = 10.0; // 20m wide
export const CHUNK_EW_ROAD_HALF_WIDTH = 9.0; // 18m wide

function isInsideParkSanctuary(x: number, z: number): boolean {
  // East Central Park Sanctuary (75, 75), bounds [39..111] x [39..111]
  if (x >= 39 && x <= 111 && z >= 39 && z <= 111) return true;
  // North Grand Park Sanctuary (0, 240), bounds [-39..39] x [204..276]
  if (x >= -39 && x <= 39 && z >= 204 && z <= 276) return true;
  return false;
}

/**
 * Returns true if the world coordinate (x, z) with footprint radius `margin`
 * overlaps any paved asphalt roadway (Central Grand Boulevards, Central Secondary/Ring Avenues,
 * or Outer Streamed Chunk Arterial Roads).
 */
export function isPointOnAnyRoad(x: number, z: number, margin: number = 0.6): boolean {
  // Parks are car-free pedestrian sanctuaries; roads are split around them
  if (isInsideParkSanctuary(x, z)) {
    return false;
  }

  // 1. Primary World Grand Boulevards (x = 0 and z = 0, 22m wide)
  // x = 0 Grand Boulevard is split around the (0, 240) Park Sanctuary (z in [204..276])
  if (Math.abs(x) < GRAND_BOULEVARD_HALF_WIDTH + margin && (z < 204 - margin || z > 276 + margin)) {
    return true;
  }
  // z = 0 Grand Boulevard runs continuously East-West
  if (Math.abs(z) < GRAND_BOULEVARD_HALF_WIDTH + margin) {
    return true;
  }

  // 2. Central District Secondary & Ring Avenues (±75 and ±165, 18m wide, spanning [-174..174])
  const inCentralX = Math.abs(x) <= 174 + margin;
  const inCentralZ = Math.abs(z) <= 174 + margin;

  if (inCentralX && inCentralZ) {
    // z = -75, z = -165, z = +165 run full Central width
    if (
      Math.abs(z + 75) < SECONDARY_AVENUE_HALF_WIDTH + margin ||
      Math.abs(z + 165) < SECONDARY_AVENUE_HALF_WIDTH + margin ||
      Math.abs(z - 165) < SECONDARY_AVENUE_HALF_WIDTH + margin
    ) {
      return true;
    }
    // z = +75 is split around (75, 75) Park Sanctuary (x in [39..111])
    if (Math.abs(z - 75) < SECONDARY_AVENUE_HALF_WIDTH + margin && (x < 39 + margin || x > 111 - margin)) {
      return true;
    }

    // x = -75, x = -165, x = +165 run full Central height
    if (
      Math.abs(x + 75) < SECONDARY_AVENUE_HALF_WIDTH + margin ||
      Math.abs(x + 165) < SECONDARY_AVENUE_HALF_WIDTH + margin ||
      Math.abs(x - 165) < SECONDARY_AVENUE_HALF_WIDTH + margin
    ) {
      return true;
    }
    // x = +75 is split around (75, 75) Park Sanctuary (z in [39..111])
    if (Math.abs(x - 75) < SECONDARY_AVENUE_HALF_WIDTH + margin && (z < 39 + margin || z > 111 - margin)) {
      return true;
    }
  }

  // 3. Outer Streamed Chunk Roads (outside Central Core [-175..175])
  const cx = Math.floor(x / CHUNK_SIZE);
  const cz = Math.floor(z / CHUNK_SIZE);
  const isCentralEmptyChunk = (cx === -1 || cx === 0) && (cz === -1 || cz === 0);
  if (!isCentralEmptyChunk) {
    const centerX = (cx + 0.5) * CHUNK_SIZE;
    const centerZ = (cz + 0.5) * CHUNK_SIZE;

    // NS road at x = centerX, clipped outside [-175..175] when |centerX| < 175
    const nsValidZ = Math.abs(centerX) >= CENTRAL_CORE_LIMIT || Math.abs(z) >= CENTRAL_CORE_LIMIT - margin;
    if (nsValidZ && Math.abs(x - centerX) < CHUNK_NS_ROAD_HALF_WIDTH + margin) {
      return true;
    }

    // EW road at z = centerZ, clipped outside [-175..175] when |centerZ| < 175
    const ewValidX = Math.abs(centerZ) >= CENTRAL_CORE_LIMIT || Math.abs(x) >= CENTRAL_CORE_LIMIT - margin;
    if (ewValidX && Math.abs(z - centerZ) < CHUNK_EW_ROAD_HALF_WIDTH + margin) {
      return true;
    }
  }

  return false;
}
