// worms engine — faithful JavaScript port of the BSD worms(6) main loop.
//
// Original: worms.c, NetBSD 1.16 (2004), BSDGames.
//   Copyright (c) 1980, 1993 The Regents of the University of California.
//   All rights reserved.
//   Eric P. Scott, Caltech High Energy Physics, October 1980.
// Upstream: https://github.com/vattam/BSDGames/blob/master/worms/worms.c
//
// DOM-free and GL-free, so `node --test` exercises it. The world keeps
// exactly the state the C program kept (ring-buffer bodies, a ref-count
// grid, the terminal's character grid) plus a small per-step event log
// for renderers.

import { createRandom } from './random.js';

// Orientation n moves by (XINC[n], YINC[n]); y grows downwards.
// 0 = up-right, then clockwise: 1 right, 2 down-right, 3 down, 4 down-left,
// 5 left, 6 up-left, 7 up.                                   (worms.c:170-174)
export const XINC = Object.freeze([1, 1, 1, 0, -1, -1, -1, 0]);
export const YINC = Object.freeze([-1, 0, 1, 1, 1, 0, -1, -1]);

// Species characters, one per worm, cycling.                  (worms.c:167-169)
export const FLAVOR = Object.freeze(['O', '*', '#', '$', '%', '0', '@', '~']);

// Boundary tables: for each current orientation, the allowed next ones.
// A table is chosen from where the head *is* before it moves.   (worms.c:72-164)
const t = (...rows) => Object.freeze(rows.map((r) => Object.freeze(r)));
export const TABLES = Object.freeze({
  normal: t([7, 0, 1], [0, 1, 2], [1, 2, 3], [2, 3, 4], [3, 4, 5], [4, 5, 6], [5, 6, 7], [6, 7, 0]),
  upper: t([1], [1, 2], [], [], [], [4, 5], [5], [1, 5]),
  left: t([], [], [], [2, 3], [3], [3, 7], [7], [7, 0]),
  right: t([7], [3, 7], [3], [3, 4], [], [], [], [6, 7]),
  lower: t([], [0, 1], [1], [1, 5], [5], [5, 6], [], []),
  upleft: t([], [], [], [], [], [3], [1, 3], [1]),
  upright: t([3, 5], [3], [], [], [], [], [], [5]),
  lowleft: t([7, 0, 1], [], [], [1], [1, 7], [7], [], []),
  lowright: t([], [7], [5, 7], [5], [], [], [], []),
});

/** The table for a head at (x, y), exactly as the nested ternary of worms.c:323. */
export function tableFor(x, y, last, bottom) {
  if (!x) return !y ? TABLES.upleft : y === bottom ? TABLES.lowleft : TABLES.left;
  if (x === last) return !y ? TABLES.upright : y === bottom ? TABLES.lowright : TABLES.right;
  return !y ? TABLES.upper : y === bottom ? TABLES.lower : TABLES.normal;
}

const SPACE = 32;
const DOT = 46;
const FIELD = 'WORM';
const FIELD_CODES = new Set([...FIELD].map((c) => c.charCodeAt(0)));

/**
 * Create a world as `worms` does at start-up on a COLS x LINES terminal.
 * opts: { cols, rows, length, number, field, trail, seed }
 */
export function createWorld({ cols, rows, length = 16, number = 3, field = false, trail = false, seed = 1 }) {
  if (cols < 2 || rows < 2) throw new RangeError('worms needs at least a 2x2 screen');
  const w = {
    cols,
    rows,
    last: cols - 1,
    bottom: rows - 1,
    length,
    trail: trail ? DOT : SPACE,
    field: !!field,
    random: createRandom(seed),
    seed,
    ref: new Uint16Array(cols * rows),
    screen: new Uint8Array(cols * rows).fill(SPACE),
    worms: [],
    steps: 0,
    // events of the most recent step, for renderers
    erased: [],   // cell indices whose ref count dropped to zero
    erasedBy: [], // ...and the worm whose tail left each of them
    placed: [],   // cell indices that received a head this step
    ate: [],      // field cells ("WORM" letters) a head landed on
    ateBy: [],
  };
  for (let n = 0; n < number; n++) w.worms.push(newWorm(length));
  if (field) fillField(w);
  return w;
}

function newWorm(length) {
  // worms.c:259-271: orientation = head = 0, every position -1
  return { orientation: 0, head: 0, xpos: new Int16Array(length).fill(-1), ypos: new Int16Array(length).fill(-1) };
}

/**
 * The -f field: "WORM" typed across the whole screen, row after row,
 * starting at the top-left, continuing where the previous row stopped.
 * (worms.c:279-290). Only free cells are written when called live.
 */
export function fillField(w) {
  const n = w.cols * w.rows;
  for (let i = 0; i < n; i++) {
    if (w.ref[i] === 0) w.screen[i] = FIELD.charCodeAt(i % 4);
  }
  w.field = true;
}

/** One pass of the main loop body: every worm moves one cell. (worms.c:303-340) */
export function step(w) {
  const { cols, last, bottom, ref, screen, random } = w;
  const erased = [];
  const erasedBy = [];
  const placed = [];
  const ate = [];
  const ateBy = [];
  const length = w.length;
  const isField = (i) => ref[i] === 0 && FIELD_CODES.has(screen[i]);
  for (let n = 0; n < w.worms.length; n++) {
    const worm = w.worms[n];
    const ch = FLAVOR[n % FLAVOR.length].charCodeAt(0);
    let h = worm.head;
    let x = worm.xpos[h];
    let y;
    if (x < 0) {
      // first move: appear at the bottom-left corner          (worms.c:304-309)
      y = worm.ypos[h] = bottom;
      x = worm.xpos[h] = 0;
      if (isField(y * cols + x)) { ate.push(y * cols + x); ateBy.push(n); }
      screen[y * cols + x] = ch;
      ref[y * cols + x]++;
      placed.push(y * cols + x);
    } else {
      y = worm.ypos[h];
    }
    if (++h === length) h = 0;
    worm.head = h;
    if (worm.xpos[h] >= 0) {
      // the tail cell leaves; erase it only if nobody else is there
      const i = worm.ypos[h] * cols + worm.xpos[h];
      if (--ref[i] === 0) {
        screen[i] = w.trail;
        erased.push(i);
        erasedBy.push(n);
      }
    }
    const op = tableFor(x, y, last, bottom)[worm.orientation];
    switch (op.length) {
      case 0:
        // worms.c:325-328 calls abort(); unreachable with these tables
        throw new Error(`worms: impossible orientation ${worm.orientation} at (${x},${y})`);
      case 1:
        worm.orientation = op[0];
        break;
      default:
        worm.orientation = op[random() % op.length];
    }
    y += YINC[worm.orientation];
    x += XINC[worm.orientation];
    const i = y * cols + x;
    if (isField(i)) { ate.push(i); ateBy.push(n); }
    screen[i] = ch;
    worm.ypos[h] = y;
    worm.xpos[h] = x;
    ref[i]++;
    placed.push(i);
  }
  w.erased = erased;
  w.erasedBy = erasedBy;
  w.placed = placed;
  w.ate = ate;
  w.ateBy = ateBy;
  w.steps++;
  return w;
}

// ---------------------------------------------------------------------------
// Live flag changes (port ADR-003). Each is built from the original's own
// cell operations: a cell is released with --ref and erased at zero.
// ---------------------------------------------------------------------------

function release(w, x, y) {
  if (x < 0) return;
  const i = y * w.cols + x;
  if (w.ref[i] > 0 && --w.ref[i] === 0) {
    w.screen[i] = w.trail;
    w.erased.push(i);
    w.erasedBy.push(-1);
  }
}

/** Change the number of worms (-n). New worms enter from (0, bottom). */
export function setNumber(w, number) {
  if (number < 1) throw new RangeError('invalid number of worms.');
  while (w.worms.length > number) {
    const worm = w.worms.pop();
    for (let k = 0; k < worm.xpos.length; k++) release(w, worm.xpos[k], worm.ypos[k]);
  }
  while (w.worms.length < number) w.worms.push(newWorm(w.length));
}

/** Change the body length (-l). Shrinking drops the oldest cells; growing adds empty slots. */
export function setLength(w, length) {
  if (length < 2 || length > 1024) throw new RangeError('invalid length (2 - 1024).');
  for (const worm of w.worms) {
    // body cells ordered from the tail (oldest) to the head
    const old = worm.xpos.length;
    const cells = [];
    for (let k = 1; k <= old; k++) {
      const idx = (worm.head + k) % old;
      cells.push([worm.xpos[idx], worm.ypos[idx]]);
    }
    if (length < old) {
      for (const [x, y] of cells.slice(0, old - length)) release(w, x, y);
    }
    const keep = cells.slice(Math.max(0, old - length));
    const xpos = new Int16Array(length).fill(-1);
    const ypos = new Int16Array(length).fill(-1);
    // head at index length-1, older cells before it, empty (-1) slots first
    const offset = length - keep.length;
    keep.forEach(([x, y], k) => { xpos[offset + k] = x; ypos[offset + k] = y; });
    worm.xpos = xpos;
    worm.ypos = ypos;
    worm.head = length - 1;
  }
  w.length = length;
}

/** Toggle the -t trail. Turning it off clears the dots already left behind. */
export function setTrail(w, on) {
  w.trail = on ? DOT : SPACE;
  if (!on) {
    for (let i = 0; i < w.screen.length; i++) if (w.screen[i] === DOT && w.ref[i] === 0) w.screen[i] = SPACE;
  }
}

/** Toggle the -f field. */
export function setField(w, on) {
  if (on) {
    fillField(w);
  } else {
    const codes = new Set([...FIELD].map((c) => c.charCodeAt(0)));
    for (let i = 0; i < w.screen.length; i++) if (w.ref[i] === 0 && codes.has(w.screen[i])) w.screen[i] = SPACE;
    w.field = false;
  }
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

/** The terminal as text, one string per row (what the classic view draws). */
export function screenLines(w) {
  const lines = [];
  for (let y = 0; y < w.rows; y++) {
    let s = '';
    for (let x = 0; x < w.cols; x++) s += String.fromCharCode(w.screen[y * w.cols + x]);
    lines.push(s);
  }
  return lines;
}

/** Body cells of worm n from tail to head, skipping unused (-1) slots. */
export function bodyCells(w, n) {
  const worm = w.worms[n];
  const len = worm.xpos.length;
  const out = [];
  for (let k = 1; k <= len; k++) {
    const idx = (worm.head + k) % len;
    if (worm.xpos[idx] >= 0) out.push([worm.xpos[idx], worm.ypos[idx]]);
  }
  return out;
}

/**
 * Milliseconds per step. -d N is exact; without -d the port emulates a
 * 9600-baud terminal, where each step costs about 12 bytes per worm
 * (port ADR-003).
 */
export function stepInterval(delay, number) {
  if (delay > 0) return delay;
  return Math.max(33, number * 12.5);
}
