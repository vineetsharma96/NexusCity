import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function graphics(saved = null) {
  globalThis.window = { innerWidth: 1280 };
  globalThis.localStorage = { getItem: () => saved === null ? null : JSON.stringify(saved), setItem() {} };
  const bundle = await build({
    stdin: { resolveDir: process.cwd(), contents: `export { QualityManager, QUALITY_PROFILES } from './src/rendering/QualityManager'; export { PerformanceMonitor } from './src/rendering/PerformanceMonitor';` },
    bundle: true, platform: 'node', format: 'esm', write: false,
  });
  return import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}#${Math.random()}`);
}

test('invalid saved graphics preset recovers to AUTO', async () => {
  const { QualityManager } = await graphics({ preset: 'REMOVED_PROFILE' });
  assert.equal(QualityManager.preset, 'AUTO');
  assert.ok(QualityManager.current.drawDistance > 0);
});

test('malformed custom graphics cannot break renderer dimensions', async () => {
  const { QualityManager } = await graphics({ preset: 'CUSTOM', customSettings: { dpr: null, drawDistance: 999999, shadows: 'yes', maxLights: -10 } });
  assert.deepEqual(QualityManager.current.dpr, [1, 1.75]);
  assert.equal(QualityManager.current.drawDistance, 2600);
  assert.equal(QualityManager.current.shadows, true);
  assert.ok(QualityManager.current.maxLights >= 0);
});

test('toggling a setting preserves the active AUTO graphics budget', async () => {
  const { QualityManager } = await graphics();
  const before = QualityManager.current;
  QualityManager.updateCustomSettings({ nightLightsEnabled: false });
  const after = QualityManager.current;
  assert.equal(after.name, 'CUSTOM');
  assert.equal(after.drawDistance, before.drawDistance);
  assert.equal(after.postProcessing, before.postProcessing);
  assert.deepEqual(after.dpr, before.dpr);
  assert.equal(after.nightLightsEnabled, false);
});

test('performance samples notify with new immutable snapshots', async () => {
  const original = globalThis.performance;
  let time = 0;
  globalThis.performance = { now: () => time };
  try {
    const { PerformanceMonitor } = await graphics();
    const monitor = PerformanceMonitor.getInstance();
    const snapshots = [];
    const unsubscribe = monitor.subscribe((snapshot) => snapshots.push(snapshot));
    time = 1000;
    monitor.update();
    assert.notEqual(snapshots[0], snapshots[1]);
    assert.equal(snapshots[0].fps, 60);
    assert.equal(snapshots[1].fps, 1);
    time = 1500;
    monitor.update();
    assert.equal(snapshots[1].fps, 1);
    assert.equal(snapshots[2].fps, 2);
    unsubscribe();
  } finally { globalThis.performance = original; }
});
