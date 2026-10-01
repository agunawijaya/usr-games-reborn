// The 90-degree mirror is hunt's signature (port-ideas.md "What NOT to
// Change" #1). Every heading x mirror, the flip after each deflection,
// multi-bounce paths, and the Coach's predicted path against the real engine.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as H from '../src/engine/hunt.js';
import * as K from '../src/engine/constants.js';
import { trajectory, liveTerrain, REFLECT } from '../src/engine/trajectory.js';
import { openArena, put, at, WIDTH } from './lib/arena.js';

const { LEFTS, RIGHT, ABOVE, BELOW, WALL4, WALL5 } = K;
const NAME = { [LEFTS]: 'west', [RIGHT]: 'east', [ABOVE]: 'north', [BELOW]: 'south' };
const OPP = { [LEFTS]: RIGHT, [RIGHT]: LEFTS, [ABOVE]: BELOW, [BELOW]: ABOVE };

// shots.c:228-269, written out as the rule a player learns.
const EXPECT = {
  '/': { [RIGHT]: ABOVE, [ABOVE]: RIGHT, [LEFTS]: BELOW, [BELOW]: LEFTS },
  '\\': { [RIGHT]: BELOW, [BELOW]: RIGHT, [LEFTS]: ABOVE, [ABOVE]: LEFTS },
};

// Records every bullet's per-step path, including the step it explodes in.
function traced(g, steps = 40) {
  const cells = [];
  const bounces = [];
  let boom = null;
  for (let s = 0; s < steps && !boom; s++) {
    const ev = H.step(g);
    for (const t of g.trails) cells.push(...t.path.slice(1));
    for (const e of ev) {
      if (e.t === 'bounce') bounces.push(e);
      if (e.t === 'boom') boom = e;
    }
    if (!g.bullets.length && !boom) break;
  }
  return { cells, bounces, boom };
}

for (const mirror of ['/', '\\']) {
  for (const heading of [RIGHT, LEFTS, ABOVE, BELOW]) {
    test(`a shot heading ${NAME[heading]} into '${mirror}' turns ${NAME[EXPECT[mirror][heading]]} and the mirror flips`, () => {
      const my = 11;
      const mx = 25;
      const g = openArena([[my, mx, mirror]]);
      // stand 3 cells before the mirror, facing it
      const sy = my - 3 * K.DY[heading];
      const sx = mx - 3 * K.DX[heading];
      const pp = put(g, 'shooter', sy, sx, heading);
      H.key(g, pp, 'f');
      const ev = H.step(g);
      const bounce = ev.find((e) => e.t === 'bounce');
      assert.ok(bounce, 'the shot reached the mirror in its first step (5 cells)');
      assert.equal(bounce.from, heading);
      assert.equal(bounce.to, EXPECT[mirror][heading]);
      assert.deepEqual([bounce.x, bounce.y], [mx, my]);
      // 90 degrees: the outgoing axis is perpendicular to the incoming one
      assert.equal(Math.abs(K.DX[bounce.from] * K.DX[bounce.to] + K.DY[bounce.from] * K.DY[bounce.to]), 0);
      // after the bounce the shot keeps going: 3 cells in, 2 cells out
      const b = g.bullets[0];
      assert.equal(b.face, EXPECT[mirror][heading]);
      assert.deepEqual([b.x, b.y], [mx + 2 * K.DX[b.face], my + 2 * K.DY[b.face]]);
      // the deflecting wall changes orientation (man page: "Diagonal walls
      // deflect shots and change orientation")
      assert.equal(at(g, my, mx), mirror === '/' ? '\\' : '/');
    });
  }
}

test('the reflection table is a true mirror: reversing the exit retraces the entry', () => {
  for (const m of [WALL4, WALL5]) {
    for (const d of [LEFTS, RIGHT, ABOVE, BELOW]) {
      const out = REFLECT[m][d];
      assert.equal(REFLECT[m][OPP[out]], OPP[d]);
      assert.notEqual(out, d);
      assert.notEqual(out, OPP[d]);
    }
  }
});

test('a shot that meets the same mirror twice turns the other way the second time', () => {
  // A=(11,25)'\\' B=(5,25)'\\' C=(5,20)'/' D=(11,20)'\\'; shooter east of A.
  const g = openArena([[11, 25, '\\'], [5, 25, '\\'], [5, 20, '/'], [11, 20, '\\']]);
  const pp = put(g, 'shooter', 11, 40, '<');
  H.key(g, pp, 'f');
  const { bounces, boom } = traced(g);
  const hitsA = bounces.filter((b) => b.x === 25 && b.y === 11);
  assert.equal(hitsA.length, 2);
  assert.equal(hitsA[0].mirror, WALL5);          // first lap: '\\'
  assert.equal(hitsA[0].to, ABOVE);
  assert.equal(hitsA[1].mirror, WALL4);          // it flipped to '/'
  assert.equal(hitsA[1].from, RIGHT);
  assert.equal(hitsA[1].to, ABOVE);              // unflipped '\\' would send it south
  assert.deepEqual(bounces.map((b) => b.n), bounces.map((_, i) => i + 1), 'bounce counter');
  assert.ok(boom, 'the shot ends in the border wall');
  assert.equal(boom.x, 50);
});

test('the Coach trajectory equals the engine path, bounce for bounce (4-mirror loop)', () => {
  const cells = [[5, 10, '\\'], [15, 10, '\\'], [15, 30, '/'], [5, 30, '/']];
  const g = openArena(cells);
  const pp = put(g, 'shooter', 5, 2, '>');
  const predicted = trajectory(liveTerrain(g), pp.x, pp.y, pp.face);
  H.key(g, pp, 'f');
  const real = traced(g);
  assert.deepEqual(real.cells, predicted.cells);
  assert.equal(real.bounces.length, 4);
  assert.deepEqual(real.bounces.map((b) => [b.x, b.y, b.to]), predicted.bounces.map((b) => [b.x, b.y, b.to]));
  assert.equal(predicted.end.kind, 'wall');
});

test('random mirror fields: the predicted multi-bounce path always matches the engine', () => {
  let rnd = 12345;
  const r = (n) => { rnd = (Math.imul(rnd, 1103515245) + 12345) >>> 0; return (rnd >>> 8) % n; };
  let checked = 0;
  let maxBounces = 0;
  for (let trial = 0; trial < 400; trial++) {
    const cells = [];
    const nm = 5 + r(60);
    for (let k = 0; k < nm; k++) cells.push([1 + r(21), 1 + r(49), r(2) ? '/' : '\\']);
    const g = openArena(cells, 1 + trial);
    let sy;
    let sx;
    do { sy = 1 + r(21); sx = 1 + r(49); } while (g.maze[sy * WIDTH + sx] !== K.SPACE);
    const face = [LEFTS, RIGHT, ABOVE, BELOW][r(4)];
    const pp = put(g, 'shooter', sy, sx, face);
    const predicted = trajectory(liveTerrain(g), pp.x, pp.y, pp.face, { maxCells: 400, maxBounces: 400 });
    if (predicted.end.kind !== 'wall') continue; // back into the shooter: dodge/catch are random
    H.key(g, pp, 'f');
    const real = traced(g, 120);
    assert.deepEqual(real.cells, predicted.cells, `trial ${trial}`);
    assert.equal(real.bounces.length, predicted.bounces.length);
    maxBounces = Math.max(maxBounces, real.bounces.length);
    checked++;
  }
  assert.ok(checked > 250, `checked ${checked}`);
  assert.ok(maxBounces >= 6, `longest path had ${maxBounces} bounces`);
});

test('every projectile kind reflects the same way (grenade, satchel, bomb, slime)', () => {
  for (const [keyc, ammo] of [['g', 9], ['F', 25], ['G', 49], ['o', 5]]) {
    const g = openArena([[11, 25, '/']]);
    const pp = put(g, 'shooter', 11, 22, '>');
    pp.ammo = ammo;
    H.key(g, pp, keyc);
    const ev = H.step(g);
    const bounce = ev.find((e) => e.t === 'bounce');
    assert.ok(bounce, keyc);
    assert.equal(bounce.to, ABOVE, keyc);
  }
});

