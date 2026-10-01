// Where would a shot go? A side-effect-free replay of move_normal_shot()'s
// geometry (shots.c:185-365) for the Coach panel and the Sharpshooter bot.
//
// It follows the same cell-by-cell walk as a real shot, including the rule
// that a diagonal wall flips (/ <-> \) every time it deflects something, so
// a path that meets the same mirror twice turns the other way the second
// time. Things it cannot know are reported instead of guessed: a door sends
// the shot in a random direction (shots.c:271-287), and a player in the way
// may duck (5%) or catch it (10% when facing it).

import * as K from './constants.js';

const { WIDTH, HEIGHT, LEFTS, RIGHT, ABOVE, BELOW, WALL1, WALL2, WALL3, WALL4, WALL5, DOOR, isPlayer } = K;

// shots.c:228-269 — the whole 90-degree reflection table.
export const REFLECT = {
  [WALL4]: { [LEFTS]: BELOW, [RIGHT]: ABOVE, [ABOVE]: RIGHT, [BELOW]: LEFTS },
  [WALL5]: { [LEFTS]: ABOVE, [RIGHT]: BELOW, [ABOVE]: LEFTS, [BELOW]: RIGHT },
};
export const FLIP = { [WALL4]: WALL5, [WALL5]: WALL4 };

// terrain(y, x) -> the char a shot would meet there (use the true maze with
// bullets lifted, or a player's remembered map).
export function trajectory(terrain, x0, y0, face, { maxCells = 240, maxBounces = 24, ignore = null } = {}) {
  const flipped = new Map(); // cell -> current mirror char after flips
  const cells = [];
  const bounces = [];
  let x = x0;
  let y = y0;
  let f = face;
  for (let n = 0; n < maxCells; n++) {
    x += K.DX[f];
    y += K.DY[f];
    if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) return { cells, bounces, end: { kind: 'wall', x, y } };
    const i = y * WIDTH + x;
    let c = flipped.has(i) ? flipped.get(i) : terrain(y, x);
    cells.push([x, y]);
    if (c === WALL4 || c === WALL5) {
      const to = REFLECT[c][f];
      bounces.push({ x, y, from: f, to, mirror: c });
      flipped.set(i, FLIP[c]);
      f = to;
      if (bounces.length > maxBounces) return { cells, bounces, end: { kind: 'range', x, y } };
      continue;
    }
    if (c === DOOR) return { cells, bounces, end: { kind: 'door', x, y } };
    if (c === WALL1 || c === WALL2 || c === WALL3) return { cells, bounces, end: { kind: 'wall', x, y } };
    if (isPlayer(c) && !(ignore && ignore(y, x))) return { cells, bounces, end: { kind: 'player', x, y } };
  }
  return { cells, bounces, end: { kind: 'range', x, y } };
}

// The true terrain for a trajectory: the maze with every bullet lifted off
// (a bullet's b_over is what lies under it).
export function liveTerrain(g) {
  const under = new Map();
  for (const b of g.bullets) under.set(b.y * WIDTH + b.x, b.over);
  return (y, x) => {
    const i = y * WIDTH + x;
    return under.has(i) ? under.get(i) : g.maze[i];
  };
}
