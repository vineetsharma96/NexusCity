import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const directory = await mkdtemp(resolve('.core-tests-'));
after(() => rm(directory, { recursive: true, force: true }));
const bundle = join(directory, 'core.mjs');
await build({
  stdin: {
    contents: `export { SeedRandom } from './src/core/SeedRandom';`,
    resolveDir: resolve('.'), loader: 'ts',
  },
  outfile: bundle, bundle: true, platform: 'node', format: 'esm', external: ['three'],
});
const { SeedRandom } = await import(pathToFileURL(bundle).href);

test('SeedRandom - Initialization', () => {
  const rng1 = new SeedRandom();
  assert.equal(rng1.initialSeed, 847291);

  const rng2 = new SeedRandom(12345);
  assert.equal(rng2.initialSeed, 12345);

  const rng3 = new SeedRandom(123.45);
  assert.equal(rng3.initialSeed, 123);
});

test('SeedRandom - Deterministic Output', () => {
  const rng1 = new SeedRandom(1337);
  const vals1 = [rng1.next(), rng1.next(), rng1.next()];

  const rng2 = new SeedRandom(1337);
  const vals2 = [rng2.next(), rng2.next(), rng2.next()];

  assert.deepEqual(vals1, vals2);
});

test('SeedRandom - Reset', () => {
  const rng = new SeedRandom(999);
  const val1 = rng.next();
  const val2 = rng.next();

  rng.reset();

  const val3 = rng.next();
  const val4 = rng.next();

  assert.equal(val1, val3);
  assert.equal(val2, val4);
});

test('SeedRandom - Range, Int, Bool', () => {
  const rng = new SeedRandom(42);

  // Range
  const r = rng.range(5, 10);
  assert.ok(r >= 5 && r <= 10);

  // Int
  const i = rng.int(1, 100);
  assert.ok(Number.isInteger(i));
  assert.ok(i >= 1 && i <= 100);

  // Bool
  const b1 = rng.bool(1.0); // always true
  assert.equal(b1, true);
  const b2 = rng.bool(0.0); // always false
  assert.equal(b2, false);
});

test('SeedRandom - Pick and Shuffle', () => {
  const rng1 = new SeedRandom(123);
  const rng2 = new SeedRandom(123);

  const items = ['a', 'b', 'c', 'd', 'e'];

  const picked1 = rng1.pick(items);
  const picked2 = rng2.pick(items);

  assert.equal(picked1, picked2);
  assert.ok(items.includes(picked1));

  const arrayToShuffle1 = [...items];
  const arrayToShuffle2 = [...items];

  rng1.shuffle(arrayToShuffle1);
  rng2.shuffle(arrayToShuffle2);

  assert.deepEqual(arrayToShuffle1, arrayToShuffle2);

  // They should still contain exactly the same elements
  assert.deepEqual([...arrayToShuffle1].sort(), [...items].sort());
});
