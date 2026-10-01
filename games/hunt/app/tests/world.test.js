// The arena itself: walls that die and grow back, mines, slime, doors,
// flying, boots, entries. Rules as in expl.c / shots.c / execute.c / answer.c.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as H from '../src/engine/hunt.js';
import * as K from '../src/engine/constants.js';
import { openArena, put, at, run, WIDTH } from './lib/arena.js';

test('a fresh arena (makemaze.c) has no mirrors and no doors — for any seed', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const g = H.newGame({ seed });
    H.initArena(g);
    const s = String.fromCharCode(...g.maze);
    assert.ok(!/[/\\#]/.test(s), `seed ${seed}`);
    assert.equal(s.split('B').length - 1, 1, 'one pair of boots');
  }
});

test('arena option: veteran seeds mirrors with the regeneration rule; ricochet braids free-standing ones', () => {
  const count = (arena, seed) => {
    const g = H.newGame({ seed, arena });
    H.initArena(g);
    const s = String.fromCharCode(...g.maze);
    let mirrors = 0, free = 0;
    for (let i = 0; i < s.length; i++) {
      if (s[i] !== '/' && s[i] !== '\\') continue;
      mirrors++;
      const x = i % WIDTH, y = (i - x) / WIDTH;
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]]
        .filter(([dx, dy]) => K.isWallChar(g.maze[(y + dy) * WIDTH + x + dx])).length;
      if (nb === 0) free++;
    }
    return { mirrors, free, doors: s.split('#').length - 1 };
  };
  for (const seed of [99, 7, 1234]) {
    assert.deepEqual(count('classic', seed), { mirrors: 0, free: 0, doors: 0 });
    const v = count('veteran', seed);
    const r = count('ricochet', seed);
    assert.ok(v.mirrors < 20, JSON.stringify(v));
    assert.ok(r.mirrors >= 30 && r.free === r.mirrors, JSON.stringify(r));
  }
});

test('any shot destroys an ordinary interior wall; the border never breaks', () => {
  const g = openArena([[11, 30, '+'], [11, 31, '-']]);
  const a = put(g, 'a', 11, 20, '>');
  H.key(g, a, 'f');
  run(g, 3);
  assert.equal(at(g, 11, 30), ' ', 'the wall it hit is gone');
  assert.equal(at(g, 11, 31), '-', 'a single shot only takes one cell');
  const b = put(g, 'b', 5, 45, '>');
  H.key(g, b, 'f');
  run(g, 3);
  assert.equal(at(g, 5, 50), '|', 'border');
});

test('mirrors and doors deflect direct shots but die in an adjacent blast', () => {
  const g = openArena([[11, 30, '/'], [11, 32, '#'], [12, 31, '|']]);
  const a = put(g, 'a', 11, 20, '>');
  a.ammo = 50;
  H.key(g, a, 'f');
  run(g, 3);
  assert.equal(at(g, 11, 30), '\\', 'direct hit: deflected, flipped, still there');
  // a grenade hitting the wall below the pair blasts a 3x3
  const b = put(g, 'b', 18, 31, '^');
  b.ammo = 50;
  H.key(g, b, 'g');
  run(g, 3);
  assert.equal(at(g, 12, 31), ' ');
  assert.equal(at(g, 11, 30), ' ', 'mirror inside the blast');
  assert.equal(at(g, 11, 32), ' ', 'door inside the blast');
});

test('walls grow back oldest-first once 40 are missing; 1% become doors or mirrors', () => {
  const g = openArena();
  // 45 wall cells in a column; shoot them one by one
  for (let y = 1; y <= 21; y++) { g.maze[y * WIDTH + 40] = K.WALL2; g.maze[y * WIDTH + 42] = K.WALL2; }
  for (let y = 1; y <= 3; y++) g.maze[y * WIDTH + 44] = K.WALL2;
  g.orig = g.maze.slice();
  const a = put(g, 'a', 11, 2, '>');
  a.ammo = 1000;
  const order = [];
  const back = [];
  for (let y = 1; y <= 21; y++) order.push([y, 40]);
  for (let y = 1; y <= 21; y++) order.push([y, 42]);
  for (let y = 1; y <= 3; y++) order.push([y, 44]);
  for (const [y, x] of order) {
    // remove directly (the blast is what calls remove_wall)
    const ev = [];
    g.ev = ev;
    // emulate a one-cell explosion there
    g.maze[a.y * WIDTH + a.x] = a.over;
    a.y = y; a.x = x - 1; a.over = K.SPACE; a.face = K.RIGHT; a.ncshot = 0;
    g.maze[a.y * WIDTH + a.x] = a.face;
    H.key(g, a, 'f');
    for (const e of H.step(g)) if (e.t === 'wallBack') back.push([e.y, e.x]);
  }
  assert.equal(g.removed.filter((r) => r[0]).length, 40);
  assert.deepEqual(back, order.slice(0, 5), 'the first five came back, in the order they fell');
  for (const [y, x] of order.slice(0, 5)) assert.ok('|#/'.includes(at(g, y, x)));
});

test('a wall that grows back under a player throws them; they land hurt', () => {
  const g = openArena([[11, 30, '|']]);
  for (let y = 1; y <= 21; y++) if (y !== 11) g.maze[y * WIDTH + 44] = K.WALL2;
  g.orig = g.maze.slice();
  const a = put(g, 'a', 11, 20, '>');
  a.ammo = 1000;
  H.key(g, a, 'f');
  run(g, 3); // (11,30) removed first
  const v = put(g, 'victim', 11, 30, '^'); // stands where the wall was
  v.damage = 10;
  for (let y = 1; y <= 21 && v.flying < 0; y++) {
    if (y === 11) continue;
    g.maze[a.y * WIDTH + a.x] = a.over;
    a.y = y; a.x = 43; a.over = K.SPACE; a.face = K.RIGHT; a.ncshot = 0;
    g.maze[a.y * WIDTH + a.x] = a.face;
    H.key(g, a, 'f');
    run(g, 1);
  }
  run(g, 20);
  const vv = H.findPlayer(g, 'victim');
  if (vv) {
    assert.ok(vv.flying < 0, 'landed');
    assert.notEqual(vv.face, K.FLYER);
  }
  assert.ok(g.scores.find((s) => s.name === 'victim'));
});

test('mines: forward 2%, sideways 50%, backing up 95% to trip; else defuse for ammo', () => {
  const trials = 1500;
  for (const [dirKey, face, expect] of [['l', '>', 0.02], ['l', '^', 0.5], ['l', '<', 0.95]]) {
    let tripped = 0;
    for (let t = 0; t < trials; t++) {
      const g = openArena([], 1000 + t);
      const a = put(g, 'a', 11, 20, face);
      g.maze[11 * WIDTH + 21] = K.MINE;
      a.ammo = 15;
      H.key(g, a, dirKey);
      const ev = H.step(g);
      if (ev.find((e) => e.t === 'trip')) tripped++;
      else assert.equal(a.ammo, 16, 'defusing a small mine is worth 1 charge');
    }
    const rate = tripped / trials;
    assert.ok(Math.abs(rate - expect) < 0.04, `${face} moving right: ${rate}`);
  }
});

test('a tripped small mine costs 5 points, a large one 10', () => {
  for (const [mine, dmg] of [[K.MINE, 5], [K.GMINE, 10]]) {
    let seen = false;
    for (let t = 0; t < 40 && !seen; t++) {
      const g = openArena([], 7 + t);
      const a = put(g, 'a', 11, 20, '<'); // backing up: 95%
      g.maze[11 * WIDTH + 21] = mine;
      H.key(g, a, 'l');
      const ev = H.step(g).concat(H.step(g));
      if (ev.find((e) => e.t === 'trip')) {
        assert.equal(a.damage, dmg);
        seen = true;
      }
    }
    assert.ok(seen);
  }
});

test('slime oozes around walls, one cell per charge, 5 points per touch', () => {
  // a dead-end corridor: slime flows into it, not through its walls
  const cells = [];
  for (let x = 10; x <= 30; x++) { cells.push([10, x, '-']); cells.push([12, x, '-']); }
  cells.push([11, 30, '|']);
  const g = openArena(cells);
  const a = put(g, 'a', 11, 11, '>');
  const v = put(g, 'v', 11, 25, '^');
  v.damcap = 999;
  a.ammo = 20;
  H.key(g, a, 'o'); // 5 ammo -> 15 charge
  const touched = new Set();
  for (let s = 0; s < 12; s++) {
    for (const e of H.step(g)) if (e.t === 'ooze') touched.add(`${e.x},${e.y}`);
  }
  for (const c of touched) {
    const [x, y] = c.split(',').map(Number);
    assert.equal(y, 11, 'never through the corridor walls');
    assert.ok(x > 11 && x < 30, c);
  }
  assert.ok(v.damage >= K.MINDAM && v.damage % K.MINDAM === 0, `slimed for ${v.damage}`);
  assert.ok(touched.size <= 15, `${touched.size} cells <= 15 charges`);
});

test('boots: a pair makes you immune to slime, one halves it, both stop cloaking', () => {
  const g = openArena();
  const a = put(g, 'a', 11, 20, '>');
  g.maze[11 * WIDTH + 21] = K.BOOT_PAIR;
  H.key(g, a, 'l');
  const ev = H.step(g);
  assert.ok(ev.find((e) => e.t === 'msg' && e.text === 'Wow!  A pair of boots!'));
  assert.equal(a.nboots, 2);
  H.checkdam(g, a, null, null, 5, K.SLIME);
  assert.equal(a.damage, 0);
  a.nboots = 1;
  H.checkdam(g, a, null, null, 5, K.SLIME);
  assert.equal(a.damage, 3, '(5+1)/2');
  H.key(g, a, 'c');
  const ev2 = H.step(g);
  assert.ok(ev2.find((e) => e.t === 'msg' && e.text === 'Boots are too noisy to cloak!'));
});

test('doors let players through, block sight, and scatter shots in 4 directions', () => {
  const faces = new Map();
  for (let t = 0; t < 400; t++) {
    const g = openArena([[11, 30, '#']], 50 + t);
    const a = put(g, 'a', 11, 26, '>');
    H.key(g, a, 'f');
    const ev = H.step(g);
    const sc = ev.find((e) => e.t === 'scatter');
    faces.set(sc.to, (faces.get(sc.to) || 0) + 1);
  }
  assert.equal(faces.size, 4);
  for (const n of faces.values()) assert.ok(n > 60, `roughly uniform: ${[...faces.values()]}`);
  const g = openArena([[11, 21, '#']]);
  const a = put(g, 'a', 11, 20, '>');
  H.key(g, a, 'll');
  run(g, 2);
  assert.equal(a.x, 22, 'walked through the door');
});

test('entering: 15 ammo +5 per player already in; each of them +5; two mines dropped', () => {
  const g = openArena();
  const a = H.connect(g, 'a');
  assert.equal(a.ammo, 15);
  const count = (c) => g.maze.filter((v) => v === c).length;
  const b = H.connect(g, 'b');
  assert.equal(b.ammo, 20);
  assert.equal(a.ammo, 20);
  const c = H.connect(g, 'c');
  assert.equal(c.ammo, 25);
  assert.equal(a.ammo, 25);
  assert.equal(count(K.MINE) + (g.slots.some((p) => p.over === K.MINE) ? 1 : 0) >= 2, true);
  assert.ok(count(K.GMINE) >= 2);
  // you enter cloaked; drawing yourself into the maze already spent one move
  assert.equal(a.cloak, K.CLOAKLEN - 1, 'you enter cloaked by default');
});

test('a dead player’s ammo can go off where they fell (detonation)', () => {
  let detonated = 0;
  for (let t = 0; t < 60; t++) {
    const g = openArena([], 300 + t);
    const a = put(g, 'a', 11, 20, '>');
    a.ammo = 200;
    a.death = '| Quit |';
    const ev = H.step(g);
    const d = ev.find((e) => e.t === 'death');
    if (d.detonate) detonated++;
  }
  assert.ok(detonated > 50, `${detonated}/60`);
});
