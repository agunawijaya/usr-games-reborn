// Test helpers: hand-made arenas with players standing where a test wants.
import * as H from '../../src/engine/hunt.js';
import * as K from '../../src/engine/constants.js';

export const { WIDTH, HEIGHT } = K;
export const FACE = { '<': K.LEFTS, '>': K.RIGHT, '^': K.ABOVE, v: K.BELOW };

// rows: optional overrides as [y, x, char]; everything else open floor.
export function openArena(cells = [], seed = 1) {
  const g = H.newGame({ seed });
  const rows = [];
  for (let y = 0; y < HEIGHT; y++) {
    let r = '';
    for (let x = 0; x < WIDTH; x++) {
      if ((y === 0 || y === HEIGHT - 1) && (x === 0 || x === WIDTH - 1)) r += '+';
      else if (y === 0 || y === HEIGHT - 1) r += '-';
      else if (x === 0 || x === WIDTH - 1) r += '|';
      else r += ' ';
    }
    rows.push(r.split(''));
  }
  for (const [y, x, c] of cells) rows[y][x] = c;
  H.loadMaze(g, rows.map((r) => r.join('')));
  return g;
}

// Join a player and put them at (y, x) facing f; clears the two mines the
// entry dropped so tests are not disturbed by them.
export function put(g, name, y, x, f, team = ' ') {
  const pp = H.connect(g, name, team);
  for (let i = 0; i < g.maze.length; i++) {
    if (g.maze[i] === K.MINE || g.maze[i] === K.GMINE) g.maze[i] = g.orig[i];
  }
  g.maze[pp.y * WIDTH + pp.x] = pp.over;
  pp.over = g.maze[y * WIDTH + x];
  pp.y = y;
  pp.x = x;
  pp.face = FACE[f] ?? f;
  g.maze[y * WIDTH + x] = pp.face;
  return pp;
}

export const at = (g, y, x) => String.fromCharCode(g.maze[y * WIDTH + x]);
export const run = (g, n = 1) => { for (let i = 0; i < n; i++) H.step(g); };
export const events = (g, n, t) => {
  const out = [];
  for (let i = 0; i < n; i++) out.push(...H.step(g).filter((e) => !t || e.t === t));
  return out;
};
