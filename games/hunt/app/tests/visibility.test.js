// What a player can see (draw.c look/see/check/drawplayer). The engine keeps
// each player's screen memory exactly like huntd's p_maze; lookCells() is the
// per-player visibility mask the renderer lights up.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as H from '../src/engine/hunt.js';
import * as K from '../src/engine/constants.js';
import { openArena, put, run, WIDTH } from './lib/arena.js';

const visible = (g, pp) => {
  const s = new Set();
  H.lookCells(g, pp, (y, x) => s.add(`${x},${y}`));
  return s;
};

test('you see the 3x3 around you, a 3-wide strip ahead and to both sides — never behind', () => {
  // a crossroads: corridors in all four directions from (25, 11)
  const g = openArena([[11, 40, '|'], [11, 10, '|'], [4, 25, '-'], [18, 25, '-']]);
  const pp = put(g, 'p', 11, 25, '>');
  const v = visible(g, pp);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) assert.ok(v.has(`${25 + dx},${11 + dy}`), '3x3');
  for (let x = 27; x <= 40; x++) for (const y of [10, 11, 12]) assert.ok(v.has(`${x},${y}`), `ahead ${x},${y}`);
  assert.ok(!v.has('41,11'), 'the strip stops at the first wall (inclusive)');
  for (let y = 4; y <= 9; y++) assert.ok(v.has(`25,${y}`), `north side ${y}`);
  for (let y = 13; y <= 18; y++) assert.ok(v.has(`25,${y}`), `south side ${y}`);
  for (let x = 10; x <= 23; x++) assert.ok(!v.has(`${x},11`), `behind ${x}`);
});

test('walls, mirrors and doors block sight; players, shots and mines do not', () => {
  for (const blocker of ['|', '/', '\\', '#', '+', '-']) {
    const g = openArena([[11, 30, blocker]]);
    const pp = put(g, 'p', 11, 25, '>');
    const v = visible(g, pp);
    assert.ok(v.has('30,11'), `${blocker} itself is seen`);
    assert.ok(!v.has('31,11'), `${blocker} blocks`);
  }
  for (const see of [';', 'g', ':', 'o', '$']) {
    const g = openArena([[11, 30, see]]);
    const pp = put(g, 'p', 11, 25, '>');
    assert.ok(visible(g, pp).has('40,11'), `${see} is see-through`);
  }
  const g = openArena();
  const pp = put(g, 'p', 11, 25, '>');
  put(g, 'q', 11, 30, '^');
  assert.ok(visible(g, pp).has('40,11'), 'players are see-through');
});

test('what you saw stays on your map after you look away (memory)', () => {
  const g = openArena([[11, 40, '+']]);
  const pp = put(g, 'p', 11, 25, '>');
  run(g, 1);
  assert.equal(pp.mem[11 * WIDTH + 40], K.WALL3);
  H.key(g, pp, 'H'); // turn to face west: east is now behind
  run(g, 1);
  assert.ok(!visible(g, pp).has('40,11'));
  assert.equal(pp.mem[11 * WIDTH + 40], K.WALL3, 'remembered');
});

test('an enemy you saw vanishes from your map the moment they move', () => {
  const g = openArena();
  const pp = put(g, 'p', 11, 25, '>');
  const e = put(g, 'e', 11, 35, '^');
  run(g, 1);
  assert.equal(pp.scr[11 * WIDTH + 35], K.ABOVE, 'seen');
  H.key(g, pp, 'H'); // look away
  run(g, 1);
  assert.equal(pp.scr[11 * WIDTH + 35], K.ABOVE, 'still remembered');
  H.key(g, e, 'k'); // e steps north, out of p's memory position
  run(g, 1);
  assert.equal(pp.scr[11 * WIDTH + 35], K.SPACE, 'drawplayer() erased it for everyone');
  assert.notEqual(pp.scr[10 * WIDTH + 35], K.ABOVE, 'but p does not learn where e went');
});

test('your own glyph reads < > ^ v; others read { } i ! ; teammates read their team digit', () => {
  const g = openArena();
  const me = put(g, 'me', 11, 25, '>', '3');
  put(g, 'foe', 11, 28, '<', '4');
  put(g, 'pal', 11, 31, 'v', '3');
  run(g, 1);
  const row = (x) => String.fromCharCode(me.scr[11 * WIDTH + x]);
  assert.equal(row(25), '>');
  assert.equal(row(28), '{');
  assert.equal(row(31), '3');
});

test('scanning shows every uncloaked mover anywhere; cloaked movers stay hidden', () => {
  const g = openArena();
  const s = put(g, 'scanner', 2, 2, '^');
  const walker = put(g, 'walker', 20, 45, '^');
  const ghost = put(g, 'ghost', 20, 30, '^');
  s.ammo = 10;
  walker.cloak = -1;
  ghost.cloak = 50;
  H.key(g, s, 's');
  run(g, 1);
  assert.ok(s.scan > 0);
  const scan0 = s.scan;
  H.key(g, walker, 'h');
  H.key(g, ghost, 'h');
  run(g, 1);
  assert.equal(s.scr[20 * WIDTH + 44], K.ABOVE, 'walker shows up on the scanner');
  assert.equal(s.scr[20 * WIDTH + 29], K.SPACE, 'ghost does not');
  assert.equal(scan0 - s.scan, 2, 'every other player’s move costs the scanner one unit');
  assert.equal(ghost.cloak, 49, 'every own move costs the cloaked one unit');
});

test('cloak and scan cost one charge; turning one on turns the other off', () => {
  const g = openArena();
  const p = put(g, 'p', 11, 25, '>');
  p.ammo = 5;
  p.cloak = -1;
  p.scan = -1;
  H.key(g, p, 's');
  run(g, 1);
  assert.equal(p.ammo, 4);
  assert.ok(p.scan > 0);
  H.key(g, p, 'c');
  run(g, 1);
  assert.equal(p.ammo, 3);
  assert.equal(p.scan, -1);
  assert.equal(p.cloak, K.CLOAKLEN - 1);
});
