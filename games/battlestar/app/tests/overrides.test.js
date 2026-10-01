// Override panel (ADR-006): all flags off = the original, byte for byte.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Battlestar, C, DEFAULT_OVERRIDES } from '../src/engine/battlestar.js';
import { runScript } from '../src/engine/run.js';
import { scriptedWalkthrough } from '../src/engine/autoplay.js';

const here = dirname(fileURLToPath(import.meta.url));
const cases = JSON.parse(readFileSync(join(here, 'golden/cases.json'), 'utf8'));
const ALL_OFF = Object.fromEntries(Object.keys(DEFAULT_OVERRIDES).map((k) => [k, false]));

test('seeded regression: every golden script is identical with no override object and with all flags off', () => {
  for (const c of cases) {
    const base = runScript(c.input, { seed: c.seed, username: c.username || '' });
    const off = runScript(c.input, { seed: c.seed, username: c.username || '', overrides: ALL_OFF });
    assert.equal(off.transcript, base.transcript, c.name);
    const s1 = base.game.snapshot();
    const s2 = off.game.snapshot();
    assert.deepEqual(s2, s1, c.name);
    assert.equal(off.game.cheated, false);
  }
});

test('infinite fuel and torpedoes: nothing is spent', () => {
  const { input } = scriptedWalkthrough(5);
  const cut = input.indexOf('land') + 1;
  const g = runScript(input.slice(0, cut), { seed: 5, overrides: { infiniteFuel: true, infiniteTorps: true } }).game;
  assert.equal(g.fuel, 250);
  assert.equal(g.torps, 10);
  assert.equal(g.cheated, true);
});

test('invulnerable: no injuries from the Cylon, the fall or the ship explosion', () => {
  const r = runScript(['right', ...Array(40).fill('back'), 'score'], { seed: 1, overrides: { invulnerable: true } });
  assert.doesNotMatch(r.transcript, /sucked out into the/);
  assert.match(r.transcript, /the score is marked as cheated/);
  const j = runScript(['su', '3', '', '', '', '', '', '', '', 'jump', 'i'], { seed: 1, username: 'riggle', overrides: { invulnerable: true } });
  assert.match(j.transcript, /You are in perfect health\./);
  const b = runScript(['su', '19', '', '', '', '', '', '', '', 'take warhead', 'drop warhead', 'look'], { seed: 1, username: 'riggle', overrides: { invulnerable: true } });
  assert.match(b.transcript, /Invulnerability averts it\./);
  assert.match(b.transcript, /Invulnerability averts it\.\n\n\tYou're in the armory\./, 'play goes on');
  assert.equal(b.game.endKind, 'quit', 'only the end of the script (EOF) ends it');
});

test('no fatigue: you never collapse; no hunger: never "stuffed"', () => {
  const r = runScript(['su', '80', '400', '', '', '', '', '', '', 'ahead', 'back', 'ahead'], { seed: 1, username: 'riggle', overrides: { noFatigue: true } });
  assert.doesNotMatch(r.transcript, /You drop from exhaustion/);
  const e = runScript(['su', '109', '', '', '', '', '', '', '', 'take knife', 'take papayas', 'eat papayas', 'take papayas', 'eat papayas'], { seed: 1, username: 'riggle', overrides: { noHunger: true } });
  assert.doesNotMatch(e.transcript, /You're stuffed/);
});

test('teleport and day/night actions work at the main prompt and mark the game', () => {
  const g = new Battlestar({ seed: 1 });
  g.start();
  let r = g.override('teleport', 126);
  assert.equal(g.position, 126);
  assert.match(r.output, /\[Override\] Teleported to room 126\./);
  assert.match(r.output, /You are at the thermal pools\./);
  r = g.override('daynight');
  assert.equal(g.isNight, true);
  assert.equal(g.here(C.BATHGOD, 126), false);
  assert.equal(g.cheated, true);
  const s = g.snapshot();
  assert.equal(s.cheated, true, 'the mark survives a save');
});

test('overrides are refused inside a fight or su prompt', () => {
  const g = new Battlestar({ seed: 1, username: 'riggle' });
  g.start();
  g.send('su');
  assert.equal(g.override('teleport', 50), null);
});
