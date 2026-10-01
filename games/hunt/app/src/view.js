// What the human player knows, per cell — the bridge between the engine's
// per-player screen memory (draw.c) and the 3D view. Pure, no DOM.
//
// Rules taken from the source (docs/notes.md §2.8):
//   * lit now      = the cells look() checks this step (lookCells)
//   * remembered   = anything on the player's screen memory (mem/scr), plus
//                    floor they have seen this life
//   * everyone sees what huntd draws with showexpl(): explosions, oozing
//                    slime, fired shots, flying players — the renderer draws
//                    those unmasked; everything else is masked by `lit`.

import * as K from './engine/constants.js';
import { lookCells } from './engine/hunt.js';

const { WIDTH, HEIGHT } = K;
const N = WIDTH * HEIGHT;

export const T_FLOOR = 0;
export const T_WALL = 1;
export const T_BORDER = 2;
export const T_MIRROR_SLASH = 3;  // '/'
export const T_MIRROR_BACK = 4;   // '\'
export const T_DOOR = 5;

const isBorder = (y, x) => y === 0 || x === 0 || y === HEIGHT - 1 || x === WIDTH - 1;

export function terrainOf(c, y, x) {
  switch (c) {
    case K.WALL1: case K.WALL2: case K.WALL3: return isBorder(y, x) ? T_BORDER : T_WALL;
    case K.WALL4: return T_MIRROR_SLASH;
    case K.WALL5: return T_MIRROR_BACK;
    case K.DOOR: return T_DOOR;
    default: return T_FLOOR;
  }
}

// The true terrain: the maze with players and shots lifted off.
export function trueTerrain(g, out = new Uint8Array(N)) {
  const under = new Map();
  for (const b of g.bullets) under.set(b.y * WIDTH + b.x, b.over);
  for (let i = 0; i < g.np; i++) {
    const p = g.slots[i];
    under.set(p.y * WIDTH + p.x, p.over);
  }
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const i = y * WIDTH + x;
      const c = under.has(i) ? under.get(i) : g.maze[i];
      out[i] = terrainOf(c, y, x);
    }
  }
  return out;
}

export function createViewState() {
  return { seen: new Uint8Array(N), lit: new Uint8Array(N), terrain: new Uint8Array(N), known: new Uint8Array(N), lifeId: null };
}

// Cells whose memory holds an explosion glyph right now (so a '-' or '/'
// drawn by a blast is not mistaken for a wall or a mirror).
function blastCells(g) {
  const s = new Map();
  for (const list of g.expl) for (const [y, x, c] of list) s.set(y * WIDTH + x, c);
  return s;
}

// Update the view of player `pp` (or of the whole maze when `all`).
// Returns the view state: lit[i] 0/1, known[i] 0/1, terrain[i] T_*.
export function updateView(g, pp, vs, { all = false } = {}) {
  const truth = trueTerrain(g);
  if (all || !pp) {
    vs.lit.fill(1);
    vs.known.fill(1);
    vs.terrain.set(truth);
    return vs;
  }
  if (vs.lifeId !== pp.id) {
    vs.lifeId = pp.id; // a new life starts with a blank memory (stplayer)
    vs.seen.fill(0);
  }
  vs.lit.fill(0);
  lookCells(g, pp, (y, x) => {
    if (y < 0 || x < 0 || y >= HEIGHT || x >= WIDTH) return;
    const i = y * WIDTH + x;
    vs.lit[i] = 1;
    vs.seen[i] = 1;
  });
  const blasts = blastCells(g);
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const i = y * WIDTH + x;
      if (vs.lit[i]) {
        vs.terrain[i] = truth[i];
        vs.known[i] = 1;
        continue;
      }
      let c = pp.mem[i];
      if (blasts.has(i) && blasts.get(i) === c) c = isBorder(y, x) ? g.maze[i] : K.SPACE;
      const t = terrainOf(c, y, x);
      vs.terrain[i] = t;
      vs.known[i] = t !== T_FLOOR || vs.seen[i] ? 1 : 0;
    }
  }
  return vs;
}

// Other players as the viewer's screen shows them outside line of sight:
// the last place they were seen (they vanish from memory when they move,
// draw.c:332-336) or where a scan / a gunshot revealed them.
export function ghosts(g, pp, vs) {
  const out = [];
  if (!pp) return out;
  for (let i = 0; i < N; i++) {
    if (vs.lit[i]) continue;
    const c = pp.scr[i];
    const y = Math.floor(i / WIDTH);
    const x = i - y * WIDTH;
    if (x === pp.x && y === pp.y) continue;
    if (c === K.LEFTS || c === K.RIGHT || c === K.ABOVE || c === K.BELOW) out.push({ x, y, face: c, team: null });
    else if (c >= 48 && c <= 57 && pp.mem[i] !== c) out.push({ x, y, face: pp.mem[i], team: c });
  }
  return out;
}

// Mines and boots the viewer can see or remembers (or all, with the flag).
export function items(g, pp, vs, reveal = false) {
  const out = [];
  const under = new Map();
  for (const b of g.bullets) under.set(b.y * WIDTH + b.x, b.over);
  for (let i = 0; i < N; i++) {
    const truth = under.has(i) ? under.get(i) : g.maze[i];
    let c = null;
    let state = 0;
    if (reveal && (truth === K.MINE || truth === K.GMINE || truth === K.BOOT || truth === K.BOOT_PAIR)) { c = truth; state = vs.lit[i] ? 2 : 3; }
    else if (vs.lit[i]) { c = truth; state = 2; }
    else if (pp) { c = pp.mem[i]; state = 1; }
    if (c === K.MINE || c === K.GMINE || c === K.BOOT || c === K.BOOT_PAIR) {
      const y = Math.floor(i / WIDTH);
      out.push({ x: i - y * WIDTH, y, c, state }); // 1 remembered, 2 seen, 3 revealed
    }
  }
  return out;
}
