import * as THREE from 'three';
import { InteriorManager } from '../src/world/InteriorManager';
import { INTERIOR_DESTINATIONS } from '../src/world/InteriorDestinations';
import { KinematicCollisionSolver } from '../src/player/KinematicCollision';
import { InteractionSystem } from '../src/interaction/InteractionSystem';

async function runInteriorLifecycleTests() {
  console.log('--- STARTING NEXUS CITY INTERIOR SYSTEM LIFECYCLE TESTS ---');
  const mgr = InteriorManager.getInstance();
  const solver = KinematicCollisionSolver;
  const interact = InteractionSystem.getInstance();

  // Test 1: Initial state
  let state = mgr.getState();
  if (state.worldMode !== 'WORLD_ACTIVE') {
    throw new Error(`Expected WORLD_ACTIVE, got ${state.worldMode}`);
  }
  if (state.current !== 'NONE') {
    throw new Error(`Expected NONE, got ${state.current}`);
  }
  console.log('✔ Test 1 passed: Initial worldMode is WORLD_ACTIVE');

  // Test 2: Enter and exit all 11 destinations sequentially
  let passedCount = 0;
  for (const [key, dest] of Object.entries(INTERIOR_DESTINATIONS)) {
    const exteriorPos = new THREE.Vector3(12.5, 0.2, -45.8);
    let teleportedPos: THREE.Vector3 | null = null;

    // 1. Initiate entrance transition
    const entered = mgr.enterDestination(key, exteriorPos, (pos) => {
      teleportedPos = pos;
    });

    if (!entered) {
      throw new Error(`Failed to enter destination ${key}`);
    }

    state = mgr.getState();
    if (state.worldMode !== 'INTERIOR_TRANSITION_IN') {
      throw new Error(`Destination ${key}: expected INTERIOR_TRANSITION_IN, got ${state.worldMode}`);
    }
    if (!state.isTransitioning) {
      throw new Error(`Destination ${key}: isTransitioning should be true during transition in`);
    }

    // Wait for full entrance transition to complete (300ms switch + 200ms fade = 500ms)
    await new Promise((resolve) => setTimeout(resolve, 550));

    state = mgr.getState();
    if (state.worldMode !== 'INTERIOR_ACTIVE') {
      throw new Error(`Destination ${key}: expected INTERIOR_ACTIVE, got ${state.worldMode}`);
    }
    if (state.current !== dest.interiorId) {
      throw new Error(`Destination ${key}: expected ${dest.interiorId}, got ${state.current}`);
    }
    if (state.isTransitioning) {
      throw new Error(`Destination ${key}: isTransitioning should be false after completion`);
    }
    if (!teleportedPos) {
      throw new Error(`Destination ${key}: onTeleport callback did not fire`);
    }

    // Check spawn point precision
    const spawnDist = (teleportedPos as THREE.Vector3).distanceTo(dest.interiorSpawnPoint);
    if (spawnDist > 0.01) {
      throw new Error(`Spawn point mismatch for ${key}: dist=${spawnDist}`);
    }

    // Update interaction system with interior player position
    interact.updatePlayerPosition(teleportedPos);

    // 2. Initiate exit transition
    let exitTeleportPos: THREE.Vector3 | null = null;
    mgr.exit((pos) => {
      exitTeleportPos = pos;
    });

    state = mgr.getState();
    if (state.worldMode !== 'INTERIOR_TRANSITION_OUT') {
      throw new Error(`Destination ${key}: expected INTERIOR_TRANSITION_OUT, got ${state.worldMode}`);
    }
    if (!state.isTransitioning) {
      throw new Error(`Destination ${key}: isTransitioning should be true during exit`);
    }

    // Wait for full exit transition to complete (300ms restore + 200ms fade = 500ms)
    await new Promise((resolve) => setTimeout(resolve, 550));

    state = mgr.getState();
    if (state.worldMode !== 'WORLD_ACTIVE') {
      throw new Error(`Destination ${key}: expected WORLD_ACTIVE after exit, got ${state.worldMode}`);
    }
    if (state.current !== 'NONE') {
      throw new Error(`Destination ${key}: interior should be NONE after exit, got ${state.current}`);
    }
    if (state.isTransitioning) {
      throw new Error(`Destination ${key}: isTransitioning should be false after exit completion`);
    }
    if (!exitTeleportPos) {
      throw new Error(`Destination ${key}: exit teleport callback did not fire`);
    }

    passedCount++;
    console.log(`  [${passedCount}/11] Destination ${key} (${dest.name}): Entry -> Active -> Exit -> Street OK`);
  }

  console.log(`✔ Test 2 passed: All ${passedCount} interior facilities verified successfully!`);
  console.log('--- ALL INTERIOR LIFECYCLE TESTS SUCCEEDED ---');
}

runInteriorLifecycleTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
