// The two walkthroughs of docs/walkthrough.md stay true: both routes win on
// a spread of seeds, the full-score route reaches the top title on every
// scale, and seed 7 (the one the document prints) plays exactly as printed.
// The real binary replays seed 7 of both in tests/golden/walkthrough-*.out.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { playRoute, TARGET } from '../src/engine/routes.js';

const SEEDS = [1, 2, 3, 5, 7, 11, 13, 17, 23, 42];

test('the fastest route wins', () => {
  for (const s of SEEDS) {
    const r = playRoute(s, 'fastest');
    assert.ok(r.won, `seed ${s}: ${r.endKind || r.stuck}`);
    assert.ok(r.input.length < 140, `seed ${s}: ${r.input.length} commands`);
  }
});

test('the full-score route wins with every scale at its top title', () => {
  for (const s of SEEDS) {
    const r = playRoute(s, 'full');
    const { pleasure, power, ego } = r.g;
    assert.ok(r.won, `seed ${s}: ${r.endKind || r.stuck}`);
    assert.ok(pleasure >= TARGET.pleasure && power >= TARGET.power && ego >= TARGET.ego, `seed ${s}: ${pleasure}/${power}/${ego}`);
  }
});

test('seed 7 plays exactly as the document and the golden case record it', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const cases = JSON.parse(readFileSync(join(here, 'golden/cases.json'), 'utf8'));
  for (const name of ['fastest', 'full']) {
    const c = cases.find((x) => x.name === `walkthrough-${name}-seed7`);
    assert.ok(c, `golden case for ${name}`);
    assert.deepEqual(playRoute(7, name).input, c.input, `${name}: the route changed; regenerate the golden case and the document`);
  }
});
