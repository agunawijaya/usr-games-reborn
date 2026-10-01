// The per-viewer model the renderer draws (src/view.js) and the fixed-step
// clock (src/clock.js).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as H from '../src/engine/hunt.js';
import * as K from '../src/engine/constants.js';
import { createViewState, updateView, ghosts, items, trueTerrain, T_WALL, T_BORDER, T_MIRROR_SLASH, T_DOOR, T_FLOOR } from '../src/view.js';
import { createClock, advance } from '../src/clock.js';
import { openArena, put, run, WIDTH } from './lib/arena.js';

test('lit = exactly the cells look() checks; known = seen this life or on the screen', () => {
  const g = openArena([[11, 40, '|'], [4, 25, '/'], [18, 25, '#']]);
  const me = put(g, 'me', 11, 25, '>');
  run(g, 1);
  const vs = updateView(g, me, createViewState());
  const lit = new Set();
  H.lookCells(g, me, (y, x) => lit.add(y * WIDTH + x));
  for (let i = 0; i < WIDTH * K.HEIGHT; i++) assert.equal(vs.lit[i], lit.has(i) ? 1 : 0);
  assert.equal(vs.terrain[11 * WIDTH + 40], T_WALL);
  assert.equal(vs.terrain[4 * WIDTH + 25], T_MIRROR_SLASH);
  assert.equal(vs.terrain[18 * WIDTH + 25], T_DOOR);
  assert.equal(vs.terrain[0], T_BORDER, 'the border is known from the start (stplayer)');
  assert.equal(vs.known[11 * WIDTH + 10], 0, 'behind: never seen');
});

test('remembered terrain is what the screen shows, not the truth', () => {
  const g = openArena([[11, 40, '|']]);
  const me = put(g, 'me', 11, 25, '>');
  run(g, 1);
  H.key(g, me, 'H'); // look away
  run(g, 1);
  g.maze[11 * WIDTH + 40] = K.SPACE; // the wall vanishes out of sight (no blast drawn)
  const vs = updateView(g, me, createViewState());
  assert.equal(vs.terrain[11 * WIDTH + 40], T_WALL, 'still a wall on your map');
  assert.equal(trueTerrain(g)[11 * WIDTH + 40], T_FLOOR);
});

test('an explosion glyph in memory is not mistaken for a wall or a mirror', () => {
  const g = openArena([[11, 30, '+']]);
  const me = put(g, 'me', 11, 20, '>');
  const far = put(g, 'far', 2, 2, '^');
  H.key(g, me, 'g');
  me.ammo = 20;
  for (let i = 0; i < 3; i++) H.step(g);
  // the blast drew '-', '|', '/', '\\' on every screen for EXPLEN steps
  const hasGlyph = far.mem.some((c, i) => (c === K.WALL1 || c === K.WALL4) && Math.floor(i / WIDTH) > 0 && Math.floor(i / WIDTH) < 22 && i % WIDTH > 0 && i % WIDTH < 50);
  assert.ok(hasGlyph, 'the blast is on the far player’s screen');
  const vs = updateView(g, far, createViewState());
  for (let y = 9; y <= 13; y++) for (let x = 28; x <= 32; x++) {
    assert.equal(vs.terrain[y * WIDTH + x], T_FLOOR, `(${x},${y}) is floor, not a remembered blast glyph`);
  }
});

test('ghosts: an opponent you saw stays on your map until they move; a teammate reads as a digit', () => {
  const g = openArena();
  const me = put(g, 'me', 11, 25, '>');
  put(g, 'foe', 11, 32, '^');
  run(g, 1);
  H.key(g, me, 'H');
  run(g, 1);
  const vs = updateView(g, me, createViewState());
  const gh = ghosts(g, me, vs);
  assert.deepEqual(gh.map((o) => [o.x, o.y]), [[32, 11]]);
});

test('items: mines you see or remember; Reveal mines shows all of them', () => {
  const g = openArena();
  const me = put(g, 'me', 11, 25, '>');
  g.maze[11 * WIDTH + 30] = K.MINE;   // ahead: seen
  g.maze[11 * WIDTH + 10] = K.GMINE;  // behind: unseen
  run(g, 1);
  const vs = updateView(g, me, createViewState());
  const seen = items(g, me, vs, false).filter((i) => i.c === K.MINE || i.c === K.GMINE);
  assert.deepEqual(seen.map((i) => [i.x, i.state]), [[30, 2]]);
  const all = items(g, me, vs, true).filter((i) => i.c === K.MINE || i.c === K.GMINE);
  assert.equal(all.length, 2);
  assert.ok(all.find((i) => i.x === 10 && i.state === 3));
});

test('a new life starts with a blank memory', () => {
  const g = openArena();
  const me = put(g, 'me', 11, 25, '>');
  run(g, 1);
  const vs = createViewState();
  updateView(g, me, vs);
  const seenBefore = vs.seen.reduce((a, b) => a + b, 0);
  assert.ok(seenBefore > 0);
  me.death = '| Quit |';
  H.step(g);
  const again = H.connect(g, 'me');
  updateView(g, again, vs);
  const lit = vs.lit.reduce((a, b) => a + b, 0);
  assert.equal(vs.seen.reduce((a, b) => a + b, 0), lit, 'only what the new life sees');
});

test('clock: steps at the chosen rate, never more than 4 per frame, slow motion quarters it', () => {
  const c = createClock(10);
  assert.equal(advance(c, 0.05), 0);
  assert.equal(advance(c, 0.06), 1);
  assert.ok(c.alpha >= 0 && c.alpha < 1);
  assert.equal(advance(c, 0.2), 2);
  assert.equal(advance(c, 3), 2, 'a 3 s stall is capped (0.25 s max)');
  c.slow = 0.25;
  c.acc = 0;
  assert.equal(advance(c, 0.3), 0);
  assert.equal(advance(c, 0.15), 1);
  c.paused = true;
  assert.equal(advance(c, 1), 0);
});
