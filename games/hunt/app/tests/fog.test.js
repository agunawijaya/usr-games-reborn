// The Fog: Off setting (src/view.js, src/classic.js): the whole maze is
// known and drawn as it is, while the player's own line of sight (and so
// their beam) stays exactly the cells look() checks.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as H from '../src/engine/hunt.js';
import * as K from '../src/engine/constants.js';
import { createViewState, updateView, items, T_WALL } from '../src/view.js';
import { classicLines } from '../src/classic.js';
import { openArena, put, run, WIDTH } from './lib/arena.js';

test('fog off: every cell is known as it is, and lit is still only the line of sight', () => {
  const g = openArena([[11, 10, '|']]); // behind the player: never seen
  const me = put(g, 'me', 11, 25, '>');
  run(g, 1);
  const vs = updateView(g, me, createViewState(), { fogLifted: true });
  const sight = new Set();
  H.lookCells(g, me, (y, x) => sight.add(y * WIDTH + x));
  for (let i = 0; i < WIDTH * K.HEIGHT; i++) {
    assert.equal(vs.known[i], 1);
    assert.equal(vs.lit[i], sight.has(i) ? 1 : 0);
  }
  assert.equal(vs.terrain[11 * WIDTH + 10], T_WALL, 'the wall behind you is on the map');
});

test('fog off: a mine behind you counts as seen, not as revealed by Override', () => {
  const g = openArena();
  const me = put(g, 'me', 11, 25, '>');
  g.maze[11 * WIDTH + 10] = K.GMINE;
  run(g, 1);
  const vs = updateView(g, me, createViewState(), { fogLifted: true });
  const mines = items(g, me, vs, false, true).filter((i) => i.c === K.GMINE);
  assert.deepEqual(mines.map((i) => [i.x, i.state]), [[10, 2]]);
});

test('fog off: the terminal shows a rival behind you; with the fog on it does not', () => {
  const g = openArena();
  const me = put(g, 'me', 11, 25, '>');
  put(g, 'foe', 11, 5, '^');
  run(g, 1);
  assert.equal(classicLines(g, me, {})[11][5], ' ');
  const whole = classicLines(g, me, { wholeMaze: true });
  assert.equal(whole[11][5], 'i', 'a rival facing up, as every screen draws one');
  assert.equal(whole[11][25], '>', 'your own glyph, as your screen draws it');
});
