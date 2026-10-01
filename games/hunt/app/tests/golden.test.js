// Golden traces: the JavaScript engine against the real huntd code.
//
// tests/golden/<name>.jsonl.gz was produced by scripts/oracle/capture.mjs, which
// compiles the upstream daemon (and otto.c) around scripts/oracle/harness.c
// and pipes tests/golden/scenarios/<name>.hunt into it. Here the same script
// runs through src/engine and every record must match field for field: the
// RNG seed after every step, the maze, every player, every bullet in list
// order, the explosion lists, the wall-regeneration ring, the scoreboard
// (float32 kills/score), the messages, the deaths and otto's keystrokes.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { replay } from './lib/replay.js';

const dir = join(dirname(fileURLToPath(import.meta.url)), 'golden');
const scenarios = readdirSync(join(dir, 'scenarios')).filter((f) => f.endsWith('.hunt')).sort();

function diff(a, b, path = '') {
  if (typeof a === 'number' && typeof b === 'number') {
    // C prints float32 with %.9g: equal after rounding to float32.
    return Math.fround(a) === Math.fround(b) ? null : `${path}: C ${a} vs JS ${b}`;
  }
  if (Array.isArray(a) || (a && typeof a === 'object')) {
    if (!b || typeof b !== 'object') return `${path}: C ${JSON.stringify(a)} vs JS ${JSON.stringify(b)}`;
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      const d = diff(a[k], b[k], `${path}.${k}`);
      if (d) return d;
    }
    return null;
  }
  return a === b ? null : `${path}: C ${JSON.stringify(a)} vs JS ${JSON.stringify(b)}`;
}

for (const file of scenarios) {
  const name = file.replace(/\.hunt$/, '');
  test(`golden: ${name} matches the C daemon step for step`, () => {
    const script = readFileSync(join(dir, 'scenarios', file), 'utf8');
    const want = gunzipSync(readFileSync(join(dir, `${name}.jsonl.gz`))).toString('utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
    const got = replay(script).records;
    assert.equal(got.length, want.length, 'record count');
    for (let i = 0; i < want.length; i++) {
      const d = diff(want[i], JSON.parse(JSON.stringify(got[i])), `record ${i} (step ${want[i].step})`);
      if (d) assert.fail(d);
    }
  });
}
