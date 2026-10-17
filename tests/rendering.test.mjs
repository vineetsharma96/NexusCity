import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function graphics(saved = null, overrides = {}, legacy = null) {
  globalThis.window = { innerWidth: 1280 };
  const writes = new Map();
  globalThis.localStorage = {
    getItem: (key) => {
      const data = key === 'nexus_city_graphics_settings_v3' ? saved : legacy;
      return data === null ? null : JSON.stringify(data);
    },
    setItem: (key, value) => writes.set(key, value),
  };
  const capabilities = {
    isMobile: false, isVirGL: false, isConstrained: false,
    supportsHalfFloatRenderTarget: true, recommendedDpr: 1.5,
    recommendedPreset: 'HIGH', ...overrides,
  };
  const bundle = await build({
    stdin: { resolveDir: process.cwd(), contents: `export { QualityManager, QUALITY_PROFILES } from './src/rendering/QualityManager'; export { PerformanceMonitor } from './src/rendering/PerformanceMonitor';` },
    bundle: true, platform: 'node', format: 'esm', write: false,
    plugins: [{ name: 'graphics-capability-fixture', setup(plugin) {
      plugin.onResolve({ filter: /WebGLCapabilities$/ }, () => ({ path: 'capabilities', namespace: 'fixture' }));
      plugin.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `export const WebGLCapabilities = { detect: () => (${JSON.stringify(capabilities)}) };` }));
    } }],
  });
  const exports = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}#${Math.random()}`);
  return { ...exports, writes };
}

test('invalid saved graphics preset recovers to AUTO', async () => {
  const { QualityManager } = await graphics({ preset: 'REMOVED_PROFILE' });
  assert.equal(QualityManager.preset, 'AUTO');
  assert.ok(QualityManager.current.drawDistance > 0);
});

test('malformed custom graphics cannot break renderer dimensions', async () => {
  const { QualityManager } = await graphics({ preset: 'CUSTOM', customSettings: { dpr: null, drawDistance: 999999, shadows: 'yes', maxLights: -10 } });
  assert.deepEqual(QualityManager.current.dpr, [0.9, 1.1]);
  assert.equal(QualityManager.current.drawDistance, 2000);
  assert.equal(QualityManager.current.shadows, true);
  assert.ok(QualityManager.current.maxLights >= 0);
});

test('capability guards preserve manual profiles and chunk budgets while disabling unsupported targets', async () => {
  const { QualityManager } = await graphics({ preset: 'ULTRA' }, {
    isMobile: true, isConstrained: true, recommendedDpr: 0.75,
    supportsHalfFloatRenderTarget: false,
  });
  assert.equal(QualityManager.preset, 'ULTRA');
  assert.equal(QualityManager.current.maxActiveChunks, 120);
  assert.deepEqual(QualityManager.current.dpr, [0.75, 0.75]);
  assert.equal(QualityManager.current.postProcessing, false);
  assert.equal(QualityManager.current.bloom, false);
  assert.equal(QualityManager.throttleDown(), false);
  QualityManager.updateCustomSettings({ maxActiveChunks: 20.9 });
  assert.equal(QualityManager.current.maxActiveChunks, 20);
  assert.deepEqual(QualityManager.current.dpr, [0.75, 0.75]);
});

test('desktop GPUs also disable postprocessing when half-float targets are unsupported', async () => {
  const { QualityManager } = await graphics({ preset: 'HIGH' }, { supportsHalfFloatRenderTarget: false });
  assert.equal(QualityManager.current.postProcessing, false);
  assert.equal(QualityManager.current.bloom, false);
  assert.equal(QualityManager.current.maxActiveChunks, 75);
});

test('software GPU LOW recommendation and v2 saved settings both survive restoration', async () => {
  const fallback = await graphics(null, { recommendedPreset: 'LOW' });
  assert.equal(fallback.QualityManager.current.drawDistance, fallback.QUALITY_PROFILES.LOW.drawDistance);
  const migrated = await graphics(null, {}, { preset: 'LITE' });
  assert.equal(migrated.QualityManager.preset, 'LITE');
  migrated.QualityManager.setPreset('LOW');
  assert.equal(JSON.parse(migrated.writes.get('nexus_city_graphics_settings_v3')).preset, 'LOW');
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

test('CUSTOM preset and granular graphics toggles can be switched on or off independently', async () => {
  const { QualityManager } = await graphics();
  QualityManager.setPreset('CUSTOM');
  assert.equal(QualityManager.preset, 'CUSTOM');
  assert.equal(QualityManager.current.name, 'CUSTOM');

  QualityManager.setAllGraphicsToggles(false);
  assert.equal(QualityManager.current.shadows, false);
  assert.equal(QualityManager.current.bloom, false);
  assert.equal(QualityManager.current.rainParticlesEnabled, false);
  assert.equal(QualityManager.current.vegetationEnabled, false);
  assert.equal(QualityManager.current.trafficEnabled, false);
  assert.equal(QualityManager.current.npcsEnabled, false);
  assert.equal(QualityManager.current.reflectionQuality, 'OFF');

  QualityManager.updateCustomSettings({
    vegetationEnabled: true,
    rainParticlesEnabled: true,
    sharpeningEnabled: true,
  });
  assert.equal(QualityManager.current.vegetationEnabled, true);
  assert.equal(QualityManager.current.rainParticlesEnabled, true);
  assert.equal(QualityManager.current.sharpeningEnabled, true);
  assert.equal(QualityManager.current.trafficEnabled, false);

  QualityManager.setAllGraphicsToggles(true);
  assert.equal(QualityManager.current.shadows, true);
  assert.equal(QualityManager.current.trafficEnabled, true);
  assert.equal(QualityManager.current.npcsEnabled, true);
  assert.equal(QualityManager.current.reflectionQuality, 'HIGH');
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

test('GPU framebuffer probe uses complete texture filters and cleans allocations on failure', async () => {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const bundle = await build({
    stdin: { resolveDir: process.cwd(), contents: `export { WebGLCapabilities } from './src/rendering/WebGLCapabilities';` },
    bundle: true, platform: 'node', format: 'esm', write: false,
  });
  try {
    for (const failProbe of [false, true]) {
      const filters = new Map();
      let deletedTextures = 0; let deletedFramebuffers = 0;
      let boundTexture; let boundFramebuffer;
      const gl = {
        VENDOR: 'vendor', RENDERER: 'renderer', MAX_TEXTURE_SIZE: 'maxTexture',
        MAX_RENDERBUFFER_SIZE: 'maxRenderbuffer', MAX_VIEWPORT_DIMS: 'viewport',
        MAX_VERTEX_TEXTURE_IMAGE_UNITS: 'vertexTextures', TEXTURE_2D: 'texture',
        TEXTURE_MIN_FILTER: 'min', TEXTURE_MAG_FILTER: 'mag', NEAREST: 'nearest',
        TEXTURE_WRAP_S: 'wrapS', TEXTURE_WRAP_T: 'wrapT', CLAMP_TO_EDGE: 'clamp',
        FRAMEBUFFER: 'framebuffer', FRAMEBUFFER_COMPLETE: 'complete',
        getParameter: (key) => ({ vendor: 'Intel', renderer: 'Intel HD', maxTexture: 16384, maxRenderbuffer: 16384, viewport: [16384, 16384], vertexTextures: 16 })[key],
        getExtension: (name) => name === 'EXT_color_buffer_float' ? {} : null,
        getSupportedExtensions: () => ['EXT_color_buffer_float'],
        createFramebuffer: () => ({}), createTexture: () => ({}),
        bindTexture: (_, texture) => { boundTexture = texture; },
        bindFramebuffer: (_, framebuffer) => { boundFramebuffer = framebuffer; },
        texParameteri: (_, key, value) => filters.set(key, value),
        texImage2D: () => { if (failProbe) throw new Error('Rejected allocation'); },
        framebufferTexture2D() {},
        checkFramebufferStatus: () => filters.get('min') === 'nearest' && filters.get('mag') === 'nearest' ? 'complete' : 'incomplete',
        deleteTexture: () => { deletedTextures++; },
        deleteFramebuffer: () => { deletedFramebuffers++; },
      };
      globalThis.window = { innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1 };
      globalThis.document = { createElement: () => ({ getContext: () => gl }) };
      const { WebGLCapabilities } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}#${Math.random()}`);
      const capabilities = WebGLCapabilities.detect();
      assert.equal(capabilities.supportsHalfFloatRenderTarget, !failProbe);
      assert.equal(deletedTextures, 1);
      assert.equal(deletedFramebuffers, 1);
      assert.equal(boundTexture, null);
      assert.equal(boundFramebuffer, null);
    }
  } finally {
    globalThis.window = previousWindow;
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});
