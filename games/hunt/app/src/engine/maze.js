// makemaze.c — a perfect maze carved from odd cells, then walls remapped
// into - | + by their neighbours. Isolated pillars would become / or \
// (remap, case 0), but a perfect maze never isolates a pillar, so a fresh
// hunt arena has no diagonal walls and no doors; they appear only when
// destroyed walls regenerate (expl.c:218-225). See docs/notes.md.

import {
  WIDTH, HEIGHT, DOOR, SPACE, WALL1, WALL2, WALL3, WALL4, WALL5,
  NORTH, SOUTH, EAST, WEST,
} from './constants.js';
import { randNum } from './rng.js';

const MNORTH = 0x1;
const MSOUTH = 0x2;
const MEAST = 0x4;
const MWEST = 0x8;

// makemaze.c:48-65. `braid` (percent, port extension for the Ricochet
// arena, ADR 006): after digging, knock out that share of the inner wall
// segments between rooms, so the maze gets loops; remap() then turns every
// pillar left standing alone into a slash or backslash by its own case-0 rule.
export function makemaze(g, { braid = 0 } = {}) {
  const M = g.maze;
  M.fill(DOOR);
  const x = randNum(g, Math.trunc(WIDTH / 2)) * 2 + 1;
  const y = randNum(g, Math.trunc(HEIGHT / 2)) * 2 + 1;
  digMaze(g, x, y);
  if (braid > 0) {
    for (let yy = 1; yy < HEIGHT - 1; yy++) {
      for (let xx = 1; xx < WIDTH - 1; xx++) {
        const between = ((xx & 1) + (yy & 1)) === 1; // a segment between two rooms
        if (between && M[yy * WIDTH + xx] !== SPACE && randNum(g, 100) < braid) M[yy * WIDTH + xx] = SPACE;
      }
    }
  }
  remap(g);
}

// makemaze.c:139-185 — recursive backtracker; the direction order is an
// inside-out shuffle drawn from the daemon's generator.
function digMaze(g, x0, y0) {
  // Explicit stack instead of C recursion (same visiting order).
  const M = g.maze;
  const stack = [];
  const enter = (x, y) => {
    M[y * WIDTH + x] = SPACE;
    const order = [MNORTH, 0, 0, 0];
    for (let i = 1; i < 4; i++) {
      const j = randNum(g, i + 1);
      order[i] = order[j];
      order[j] = 0x1 << i;
    }
    stack.push({ x, y, order, i: 0 });
  };
  enter(x0, y0);
  while (stack.length) {
    const f = stack[stack.length - 1];
    if (f.i >= 4) { stack.pop(); continue; }
    const d = f.order[f.i++];
    let tx = 0;
    let ty = 0;
    switch (d) {
      case MNORTH: tx = f.x; ty = f.y - 2; break;
      case MSOUTH: tx = f.x; ty = f.y + 2; break;
      case MEAST: tx = f.x + 2; ty = f.y; break;
      case MWEST: tx = f.x - 2; ty = f.y; break;
    }
    if (tx < 0 || ty < 0 || tx >= WIDTH || ty >= HEIGHT) continue;
    if (M[ty * WIDTH + tx] === SPACE) continue;
    M[((f.y + ty) >> 1) * WIDTH + ((f.x + tx) >> 1)] = SPACE;
    enter(tx, ty);
  }
}

// makemaze.c:187-233. With both RANDOM and REFLECT compiled in, an isolated
// wall becomes DOOR and is then overwritten by / or \ (one rand_num(2)).
function remap(g) {
  const M = g.maze;
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const i = y * WIDTH + x;
      if (M[i] === SPACE) continue;
      let stat = 0;
      if (y - 1 >= 0 && M[i - WIDTH] !== SPACE) stat |= NORTH;
      if (y + 1 < HEIGHT && M[i + WIDTH] !== SPACE) stat |= SOUTH;
      if (x + 1 < WIDTH && M[i + 1] !== SPACE) stat |= EAST;
      if (x - 1 >= 0 && M[i - 1] !== SPACE) stat |= WEST;
      switch (stat) {
        case WEST | EAST: case EAST: case WEST:
          M[i] = WALL1; break;
        case NORTH | SOUTH: case NORTH: case SOUTH:
          M[i] = WALL2; break;
        case 0:
          M[i] = DOOR;
          M[i] = randNum(g, 2) ? WALL4 : WALL5;
          break;
        default:
          M[i] = WALL3; break;
      }
    }
  }
  for (let i = 0; i < M.length; i++) g.orig[i] = M[i];
}
