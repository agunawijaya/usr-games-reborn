// Talon's Shadow — finding a way round the fences. The field is cut into 20-pixel cells; a cell
// too close to a fence is closed, and a breadth-first search through the open ones gives a route
// of cell centres. Rivals follow it, always heading for the farthest point of it they can see.
// Pure; a layout's closed cells are worked out once.

import { clearance, crossesFence, FIELD } from './fences.mjs';

const CELL = 20;
const COLS = Math.ceil(FIELD.width / CELL);
const ROWS = Math.ceil(FIELD.height / CELL);
/** A cell whose centre is closer than this to a fence is closed. */
const KEEP_AWAY = 14;
const NEIGHBOURS = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

const closedCache = new WeakMap();

/** @param {import('./fences.mjs').Rect[]} fences */
function closedCells(fences) {
  let closed = closedCache.get(fences);
  if (!closed) {
    closed = new Uint8Array(COLS * ROWS);
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const x = col * CELL + CELL / 2;
        const y = row * CELL + CELL / 2;
        closed[row * COLS + col] = clearance(x, y, fences) < KEEP_AWAY ? 1 : 0;
      }
    }
    closedCache.set(fences, closed);
  }
  return closed;
}

const cellOf = (p) => [
  Math.min(COLS - 1, Math.max(0, Math.floor(p.x / CELL))),
  Math.min(ROWS - 1, Math.max(0, Math.floor(p.y / CELL))),
];

/** The open cell nearest to (col, row), searching outwards a few rings. */
function nearestOpen(col, row, closed) {
  for (let ring = 0; ring < 4; ring++) {
    for (let dr = -ring; dr <= ring; dr++) {
      for (let dc = -ring; dc <= ring; dc++) {
        const c = col + dc;
        const r = row + dr;
        if (c >= 0 && r >= 0 && c < COLS && r < ROWS && !closed[r * COLS + c]) return [c, r];
      }
    }
  }
  return [col, row];
}

/**
 * A route of points from `from` to `to` round the fences, ending at `to` itself; empty when
 * there is none. Diagonal steps never cut a closed corner.
 */
export function routeTo(from, to, fences) {
  if (!fences.length) return [{ x: to.x, y: to.y }];
  const closed = closedCells(fences);
  const [startCol, startRow] = nearestOpen(...cellOf(from), closed);
  const [goalCol, goalRow] = nearestOpen(...cellOf(to), closed);
  const start = startRow * COLS + startCol;
  const goal = goalRow * COLS + goalCol;
  const cameFrom = new Int32Array(COLS * ROWS).fill(-1);
  cameFrom[start] = start;
  const queue = [start];
  for (let head = 0; head < queue.length && cameFrom[goal] < 0; head++) {
    const cell = queue[head];
    const col = cell % COLS;
    const row = (cell - col) / COLS;
    for (const [dc, dr] of NEIGHBOURS) {
      const c = col + dc;
      const r = row + dr;
      if (c < 0 || r < 0 || c >= COLS || r >= ROWS) continue;
      const next = r * COLS + c;
      if (closed[next] || cameFrom[next] >= 0) continue;
      if (dc && dr && (closed[row * COLS + c] || closed[r * COLS + col])) continue;
      cameFrom[next] = cell;
      queue.push(next);
    }
  }
  if (cameFrom[goal] < 0) return [];
  const route = [{ x: to.x, y: to.y }];
  for (let cell = cameFrom[goal]; cell !== start; cell = cameFrom[cell]) {
    const col = cell % COLS;
    route.push({ x: col * CELL + CELL / 2, y: (cell - col) / COLS * CELL + CELL / 2 });
  }
  return route.reverse();
}

/** The farthest point of the route that can be reached in a straight line from `head`. */
export function farthestInSight(head, route, fences, margin = 8) {
  for (let i = route.length - 1; i > 0; i--) {
    if (!crossesFence(head.x, head.y, route[i].x, route[i].y, margin, fences)) return route[i];
  }
  return route[0];
}
