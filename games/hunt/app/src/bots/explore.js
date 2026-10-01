// Navigation for the extension bots (Novice, Sharpshooter). Classic Otto
// keeps otto.c's wall-follower (it was written for perfect mazes and
// circles in braided ones — docs/notes.md §5).
//
// Fair by construction: the map is the bot's own screen memory (mem).
// Unknown cells are assumed open (explore optimistically), remembered
// walls and mirrors block, doors are passable (execute.c:224-229),
// remembered mines are avoided. The bot faces the way it travels before
// stepping, because it only sees ahead and to the sides, and because
// backing onto a mine trips it 95% of the time (execute.c:238-247).

import * as K from '../engine/constants.js';
import { lookCells } from '../engine/hunt.js';

const { WIDTH, HEIGHT } = K;
const N = WIDTH * HEIGHT;
const DIRS = [
  { f: K.LEFTS, dx: -1, dy: 0, move: 'h', face: 'H' },
  { f: K.RIGHT, dx: 1, dy: 0, move: 'l', face: 'L' },
  { f: K.ABOVE, dx: 0, dy: -1, move: 'k', face: 'K' },
  { f: K.BELOW, dx: 0, dy: 1, move: 'j', face: 'J' },
];

function passable(c) {
  switch (c) {
    case K.WALL1: case K.WALL2: case K.WALL3: case K.WALL4: case K.WALL5:
    case K.MINE: case K.GMINE:
      return false;
    default:
      return true; // space, door, shots, slime (it moves on), players (they move)
  }
}

// Remember when each cell was last in sight.
export function noteSight(g, pp, b) {
  if (!b.seen || b.seen.length !== N) b.seen = new Array(N).fill(-1);
  lookCells(g, pp, (y, x) => {
    if (y >= 0 && x >= 0 && y < HEIGHT && x < WIDTH) b.seen[y * WIDTH + x] = g.step;
  });
}

// Breadth-first search from the bot to the best goal. `goal(i)` returns a
// score (higher = better, <= 0 = not a goal); the path's first step wins.
export function route(g, pp, goal, maxDist = 200) {
  const mem = pp.mem;
  const prev = new Int16Array(N).fill(-1);
  const dist = new Int16Array(N).fill(-1);
  const start = pp.y * WIDTH + pp.x;
  const q = [start];
  dist[start] = 0;
  let best = -1;
  let bestScore = 0;
  for (let h = 0; h < q.length; h++) {
    const i = q[h];
    const d = dist[i];
    if (d > maxDist) break;
    if (i !== start) {
      const s = goal(i, d);
      if (s > bestScore) { bestScore = s; best = i; }
    }
    const y = Math.floor(i / WIDTH);
    const x = i - y * WIDTH;
    for (const D of DIRS) {
      const nx = x + D.dx;
      const ny = y + D.dy;
      if (nx < 1 || ny < 1 || nx >= WIDTH - 1 || ny >= HEIGHT - 1) continue;
      const j = ny * WIDTH + nx;
      if (dist[j] >= 0 || !passable(mem[j])) continue;
      dist[j] = d + 1;
      prev[j] = i;
      q.push(j);
    }
  }
  if (best < 0) return null;
  let i = best;
  while (prev[i] !== start && prev[i] >= 0) i = prev[i];
  const ny = Math.floor(i / WIDTH);
  const nx = i - ny * WIDTH;
  const D = DIRS.find((dd) => dd.dx === nx - pp.x && dd.dy === ny - pp.y);
  return D ? { dir: D, target: best, dist: dist[best] } : null;
}

// One step of exploration toward the stalest part of the map. The bot
// commits to a goal until it has seen it (or cannot reach it), so turning
// to look around does not flip it between two targets.
export function exploreStep(g, pp, b, rand) {
  const seen = b.seen;
  const stale = (i) => (seen[i] < 0 ? 400 : g.step - seen[i]) >= 25;
  if (b.goal != null && stale(b.goal)) {
    const r = route(g, pp, (i) => (i === b.goal ? 1 : 0));
    if (r) return stepToward(pp, r.dir);
  }
  const bias = rand % 997;
  const r = route(g, pp, (i, d) => {
    const age = seen[i] < 0 ? 400 : g.step - seen[i];
    if (age < 25) return 0;
    return age / (6 + d) + ((i * 31 + bias) % 7) * 0.01;
  });
  if (!r) { b.goal = null; return null; }
  b.goal = r.target;
  return stepToward(pp, r.dir);
}

// Move one cell in direction D, turning to face it first.
export function stepToward(pp, D) {
  return (pp.face !== D.f ? D.face : '') + D.move;
}

export { DIRS, passable };
