// Rendering geometry that runs without a GPU: the "one step behind" glide
// of port ADR-003 must show exactly the grid state at step boundaries.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { slidingPath, writeRibbon, smooth, catmullRom, FLOATS_PER_VERTEX } from '../src/render/geometry.js';
import { createWorld, step, bodyCells } from '../src/engine/worms.js';
import { looksSoftware } from '../src/render/renderer.js';
import { SPECIES, speciesOf } from '../src/render/species.js';

const centre = ([x, y]) => [x + 0.5, y + 0.5];
function ends(sp, f) {
  const out = new Float32Array(4096);
  const n = writeRibbon(out, 0, sp, { f, samplesPerCell: 5, width: 0.4, sway: 0, time: 0, phase: 0, smooth: 0 });
  const first = [out[0], out[1]];
  const last = [out[(n - 1) * FLOATS_PER_VERTEX], out[(n - 1) * FLOATS_PER_VERTEX + 1]];
  return { first, last, n };
}
const close = (a, b) => Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;

test('glide: f=0 shows the previous body, f=1 the new one (full-length worm)', () => {
  const w = createWorld({ cols: 30, rows: 12, number: 1, length: 8 });
  for (let i = 0; i < 40; i++) step(w);
  const prev = bodyCells(w, 0);
  step(w);
  const curr = bodyCells(w, 0);
  const sp = slidingPath(prev, curr);
  assert.equal(sp.path.length, 9);
  const a = ends(sp, 0);
  assert.ok(close(a.first, centre(prev[0])) && close(a.last, centre(prev[7])));
  const b = ends(sp, 1);
  assert.ok(close(b.first, centre(curr[0])) && close(b.last, centre(curr[7])));
});

test('glide: a growing worm keeps its tail and extends its head', () => {
  const w = createWorld({ cols: 30, rows: 12, number: 1, length: 8 });
  for (let i = 0; i < 3; i++) step(w);
  const prev = bodyCells(w, 0);
  step(w);
  const curr = bodyCells(w, 0);
  const sp = slidingPath(prev, curr);
  assert.ok(sp.grow);
  assert.ok(close(ends(sp, 0).first, centre(curr[0])));
  assert.ok(close(ends(sp, 1).last, centre(curr.at(-1))));
});

test('glide: unrelated states (live edits) snap to the current body', () => {
  const sp = slidingPath([[1, 1], [2, 2]], [[9, 9], [9, 8], [9, 7]]);
  assert.ok(sp.snap);
  assert.ok(close(ends(sp, 0.7).last, centre([9, 7])));
});

test('smoothing relaxes a staircase but pins both ends', () => {
  const stair = [[0, 0], [1, 0], [2, 1], [3, 1], [4, 2]];
  const s = smooth(stair, 3);
  assert.deepEqual(s[0], stair[0]);
  assert.deepEqual(s.at(-1), stair.at(-1));
  assert.notDeepEqual(s[2], stair[2]);
});

test('Catmull-Rom passes through its control points', () => {
  const P = [[0, 0], [1, 0], [2, 1], [3, 3]];
  for (let i = 0; i < P.length - 1; i++) {
    const [x, y] = catmullRom(P, i);
    assert.ok(Math.abs(x - P[i][0]) < 1e-12 && Math.abs(y - P[i][1]) < 1e-12);
  }
});

test('species: worm n is flavor n % 8, as worms.c picks its character', () => {
  assert.deepEqual(SPECIES.map((s) => s.ch).join(''), 'O*#$%0@~');
  assert.equal(speciesOf(9).ch, '*');
});

test('software renderers are recognised', () => {
  assert.ok(looksSoftware('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)'));
  assert.ok(looksSoftware('llvmpipe (LLVM 15.0.7, 256 bits)'));
  assert.ok(!looksSoftware('ANGLE (NVIDIA, NVIDIA GeForce RTX 4060 Laptop GPU Direct3D11 vs_5_0 ps_5_0, D3D11)'));
});
