import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { Vector3 } from 'three';

const directory = await mkdtemp(resolve('.player-tests-'));
after(() => rm(directory, { recursive: true, force: true }));
const bundle = join(directory, 'player.mjs');
await build({
  stdin: {
    contents: `export { InputManager } from './src/player/InputManager';
      export { KinematicController } from './src/player/KinematicController';
      export { KinematicCollisionSolver } from './src/player/KinematicCollision';
      export { TouchController } from './src/player/TouchController';
      export { ChunkManager } from './src/world/ChunkManager';
      export { QualityManager } from './src/rendering/QualityManager';`,
    resolveDir: resolve('.'), loader: 'ts',
  },
  outfile: bundle, bundle: true, platform: 'node', format: 'esm', external: ['three'],
});
const { InputManager, KinematicController, KinematicCollisionSolver, TouchController, ChunkManager, QualityManager } = await import(pathToFileURL(bundle).href);

class Element extends EventTarget {
  constructor(tagName = 'CANVAS') { super(); this.tagName = tagName; this.isContentEditable = false; }
  requestPointerLock() { document.pointerLockElement = this; return Promise.resolve(); }
}
globalThis.HTMLElement = Element;
globalThis.window = Object.assign(new EventTarget(), { innerWidth: 1280 });
globalThis.document = Object.assign(new EventTarget(), {
  pointerLockElement: null, hidden: false,
  exitPointerLock() { this.pointerLockElement = null; },
});
globalThis.localStorage = { getItem: () => null, setItem: () => {} };
const canvas = new Element();
InputManager.init(canvas);
after(() => InputManager.dispose());

function key(type, code, target = window) {
  const event = new Event(type, { cancelable: true });
  Object.defineProperties(event, { code: { value: code }, repeat: { value: false } });
  target.dispatchEvent(event);
}
function reset() {
  InputManager.setUIBlocking(false);
  InputManager.reset();
  KinematicCollisionSolver.clear();
}

test('blur releases movement and Shift aliases do not cancel each other', () => {
  reset();
  key('keydown', 'KeyW'); key('keydown', 'ShiftLeft'); key('keydown', 'ShiftRight'); key('keyup', 'ShiftLeft');
  assert.equal(InputManager.getState().sprint, true);
  window.dispatchEvent(new Event('blur'));
  assert.equal(InputManager.getState().moveZ, 0);
  assert.equal(InputManager.getState().sprint, false);
});

test('editable focus and modal blocking stop movement without disabling map dismissal', () => {
  reset(); key('keydown', 'KeyW');
  const focus = new Event('focusin');
  Object.defineProperty(focus, 'target', { value: new Element('INPUT') });
  document.dispatchEvent(focus);
  assert.equal(InputManager.getState().moveZ, 0);
  const typing = new Event('keydown');
  Object.defineProperties(typing, { code: { value: 'KeyW' }, target: { value: new Element('INPUT') } });
  window.dispatchEvent(typing);
  assert.equal(InputManager.getState().moveZ, 0);
  InputManager.setUIBlocking(true);
  key('keydown', 'KeyW'); InputManager.setVirtualMovement(1, 1);
  assert.equal(InputManager.getState().moveX, 0);
  assert.equal(InputManager.getState().moveZ, 0);
  const previousMap = InputManager.getState().map;
  key('keydown', 'KeyM');
  assert.equal(InputManager.getState().map, !previousMap);
  InputManager.setUIBlocking(false);
  assert.equal(InputManager.getState().moveZ, 0);
});

test('a blocked player stops walking animation and horizontal velocity', () => {
  reset();
  KinematicCollisionSolver.addBox(new Vector3(1, 1, 0), new Vector3(1, 2, 6));
  const player = new KinematicController(); player.position.set(0.05, 0, 0);
  InputManager.setVirtualMovement(1, 0);
  const state = player.update(0.05, 0);
  assert.equal(state.gait, 'IDLE');
  assert.ok(state.speed < 1e-8);
});

test('input subscribers receive independent snapshots and virtual map release preserves toggle', () => {
  reset(); const snapshots = [];
  const unsubscribe = InputManager.subscribe((state) => snapshots.push(state));
  key('keydown', 'KeyW'); key('keyup', 'KeyW');
  assert.notEqual(snapshots[0], snapshots[1]);
  assert.equal(snapshots[1].forward, true);
  assert.equal(snapshots[2].forward, false);
  unsubscribe();
  InputManager.setVirtualAction('map', true);
  const open = InputManager.getState().map;
  InputManager.setVirtualAction('map', false);
  assert.equal(InputManager.getState().map, open);
});

test('swept collision stops a fast capsule at a thin wall', () => {
  reset();
  KinematicCollisionSolver.addBox(new Vector3(0, 1, 0), new Vector3(0.1, 2, 6));
  const resolved = KinematicCollisionSolver.resolveHorizontal(new Vector3(3, 0, 0), 0.45, 1.8, new Vector3(-3, 0, 0));
  assert.ok(resolved.x <= -0.5 + 1e-8, `crossed thin wall at ${resolved.x}`);
});

test('saved positions recover from a large building and stay inside the world boundary', () => {
  reset();
  KinematicCollisionSolver.addBox(new Vector3(0, 5, 0), new Vector3(20, 10, 20));
  const safe = KinematicCollisionSolver.findSafePosition(new Vector3(0, 0, 0), 0.45, 1.8);
  assert.equal(KinematicCollisionSolver.isPositionClear(safe, 0.45, 1.8), true);
  const bounded = KinematicCollisionSolver.findSafePosition(new Vector3(9000, 0, 9000), 0.45, 1.8);
  assert.ok(bounded.x <= 1379.55 && bounded.z <= 1379.55);
});

test('walking off a raised platform falls toward the destination floor', () => {
  reset();
  KinematicCollisionSolver.addBox(new Vector3(0, 0.5, 0), new Vector3(2, 1, 2));
  const player = new KinematicController();
  player.position.set(0.95, 1, 0); player.velocity.set(6.8, 0, 0);
  InputManager.setVirtualMovement(1, 0);
  player.update(0.05, 0);
  assert.equal(player.isGrounded, false);
  const firstHeight = player.position.y;
  player.update(0.05, 0);
  assert.ok(player.position.y < firstHeight);
});

test('holding jump through a landing does not trigger repeated jumps', () => {
  reset();
  const player = new KinematicController(); player.position.set(0, 0, 0);
  InputManager.setVirtualAction('jump', true);
  let airborne = false;
  for (let frame = 0; frame < 180; frame++) {
    player.update(1 / 60, 0);
    if (player.position.y > 0.1) airborne = true;
  }
  assert.equal(airborne, true);
  assert.equal(player.isGrounded, true);
  assert.equal(player.position.y, 0);
});

test('a jump stops at the underside of a low ceiling', () => {
  reset();
  KinematicCollisionSolver.addBox(new Vector3(0, 2.4, 0), new Vector3(8, 0.2, 8));
  const player = new KinematicController(); player.position.set(0, 0, 0);
  InputManager.setVirtualAction('jump', true);
  for (let frame = 0; frame < 12; frame++) {
    player.update(1 / 60, 0);
    assert.ok(player.position.y <= 0.5 + 1e-8);
    assert.ok(Math.abs(player.position.x) < 1e-8);
  }
});

test('pinch release rebases the remaining look finger', () => {
  reset(); const touch = TouchController.getInstance(); touch.reset();
  const primary = { identifier: 1, clientX: 800, clientY: 300 };
  const secondary = { identifier: 2, clientX: 1000, clientY: 300 };
  touch.handleTouchStart({ changedTouches: [primary], touches: [primary] });
  touch.handleTouchStart({ changedTouches: [secondary], touches: [primary, secondary] });
  const moved = { ...primary, clientX: 900 };
  touch.handleTouchMove({ changedTouches: [moved], touches: [moved, secondary] });
  touch.handleTouchEnd({ changedTouches: [secondary], touches: [moved] });
  touch.handleTouchMove({ changedTouches: [{ ...moved, clientX: 901 }], touches: [{ ...moved, clientX: 901 }] });
  assert.ok(InputManager.consumeLookDelta().dx < 2);
  touch.reset();
});

test('graphics changes refresh chunk LOD while standing still', () => {
  reset();
  QualityManager.setPreset('LOW');
  const chunks = new ChunkManager(); const position = new Vector3(0, 0, 0);
  chunks.updatePlayerPosition(position);
  const lowCount = chunks.getActiveChunks().length;
  QualityManager.setPreset('HIGH');
  chunks.updatePlayerPosition(position);
  assert.ok(chunks.getActiveChunks().length > lowCount);
});

test('published chunk snapshots retain their LOD and provide new memoized view props', () => {
  reset(); QualityManager.setPreset('LOW');
  const manager = new ChunkManager(); const position = new Vector3(0, 0, 0);
  manager.updatePlayerPosition(position);
  const previous = manager.getState();
  const active = manager.getActiveChunks();
  const previousLods = new Map(previous.chunks.map((chunk) => [chunk.key, chunk.lod]));
  QualityManager.setPreset('HIGH');
  manager.updatePlayerPosition(position);
  const current = manager.getState();
  assert.ok(current.chunks.some((chunk) => chunk.lod !== previousLods.get(chunk.key)));
  for (const chunk of previous.chunks) assert.equal(chunk.lod, previousLods.get(chunk.key));
  for (const chunk of current.chunks) {
    assert.notEqual(chunk, previous.chunks.find((old) => old.key === chunk.key));
  }
  for (const chunk of manager.getActiveChunks()) {
    const old = active.find((candidate) => candidate.key === chunk.key);
    if (old) {
      assert.notEqual(chunk, old);
      assert.equal(old.lod, previousLods.get(old.key));
    }
  }
});

test('chunk count budget changes apply while stationary and keep the nearest chunks', () => {
  reset(); QualityManager.setPreset('HIGH');
  QualityManager.updateCustomSettings({ maxActiveChunks: 75 });
  const manager = new ChunkManager(); const position = new Vector3(0, 0, 0);
  manager.updatePlayerPosition(position);
  assert.equal(manager.getActiveChunks().length, 75);
  QualityManager.updateCustomSettings({ maxActiveChunks: 20.9 });
  manager.updatePlayerPosition(position);
  const active = manager.getActiveChunks();
  assert.equal(active.length, 20);
  const furthestActive = Math.max(...active.map((chunk) => chunk.distanceToPlayer));
  const nearestUnloaded = Math.min(...manager.getState().chunks.filter((chunk) => chunk.lod === 'UNLOADED').map((chunk) => chunk.distanceToPlayer));
  assert.ok(furthestActive <= nearestUnloaded);
});
