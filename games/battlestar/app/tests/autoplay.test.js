// Following the hints wins. Two modes:
//  - hinted: dogfights flown in real time by the autopilot (as a player would
//    with the hint panel open);
//  - scripted: dogfights left with `q`, i.e. exactly what a pipe can do to the
//    real binary (five of these scripts are replayed on it in golden.test.js).

import test from 'node:test';
import assert from 'node:assert/strict';
import { hintedGame, scriptedWalkthrough } from '../src/engine/autoplay.js';
import { nextHint } from '../src/engine/planner.js';
import { Battlestar } from '../src/engine/battlestar.js';

const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1);

test('hinted autoplay wins for 40 seeds', () => {
  const lost = [];
  for (const seed of SEEDS) {
    const r = hintedGame(seed);
    if (!r.won) lost.push(`${seed}: ${r.stuck?.why || r.endKind}`);
  }
  assert.deepEqual(lost, []);
});

test('scripted autoplay (dogfights quit) wins for 40 seeds', () => {
  const lost = [];
  for (const seed of SEEDS) {
    const r = scriptedWalkthrough(seed);
    if (!r.won) lost.push(`${seed}: ${r.stuck?.why || r.endKind}`);
  }
  assert.deepEqual(lost, []);
});

test('every hint names a goal and gives a reason', () => {
  const g = new Battlestar({ seed: 3, flightMode: 'stdin' });
  let r = g.start();
  const goals = new Set();
  for (let i = 0; i < 400 && !r.ended; i++) {
    const h = g.flightSim ? { cmd: 'q', goal: 'Dogfight', why: 'x' } : nextHint(g, r.request);
    assert.ok(h.goal && h.why, JSON.stringify(h));
    goals.add(h.goal);
    r = g.send(h.cmd);
  }
  for (const want of ['Escape the Battlestar', 'Fly to the island', 'Meet the goddess', 'Win the goddess',
    'Arm yourself', 'The Dark Lord', 'Claim the talisman', 'The gifts', 'Finale']) {
    assert.ok(goals.has(want), `saw goal "${want}" (${[...goals].join(', ')})`);
  }
  assert.equal(r.endKind, 'won');
});

test('a lost cause is reported, not looped: missing the goddess on day 1', () => {
  const g = new Battlestar({ seed: 1, username: 'riggle', flightMode: 'stdin' });
  g.start();
  g.send('take amulet');
  for (const l of ['su', '80', '100', '', '', '', '', '', '']) g.send(l);
  g.send('ahead'); // dusk: the bathing goddess is gone for good
  const h = nextHint(g);
  assert.equal(h.cmd, null);
  assert.match(h.why, /can no longer be won/);
});
