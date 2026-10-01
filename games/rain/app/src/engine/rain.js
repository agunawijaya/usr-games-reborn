// The rain engine: a line-by-line port of the original main loop
// (rain.c:100-151) onto a persistent character screen, plus the event
// stream the renderer turns into ripples.
//
// Copyright (c) 1980, 1993 The Regents of the University of California.
// rain 11/3/1980 EPS/CITHEP — Eric P. Scott. Upstream:
// https://github.com/vattam/BSDGames/tree/master/rain
//
// A drop lives six frames. Each frame (rain.c:118-145):
//   age 0  "."            the new drop                 (rain.c:118-120)
//   age 1  "o"                                         (rain.c:121)
//   age 2  "O"                                         (rain.c:124)
//   age 3  a small ring:   -  / |.| / -                (rain.c:127-129)
//   age 4  a large ring:   -  / "/ \" / "| O |" / "\ /" / -   (rain.c:132-136)
//   age 5  erased with spaces (the same diamond)       (rain.c:139-143)
// and its slot in the 5-entry circular buffer takes the new drop
// (rain.c:144-145). The screen is persistent, exactly like curses: an
// erase can also blank parts of a neighbour, and that is reproduced.

import { createRandom, next } from './random.js';

export const STAGES = ['.', 'o', 'O', 'ring1', 'ring2', 'erase'];
export const MIN_COLS = 5;
export const MIN_LINES = 5;

// "-d delay" parsing, with the original's checks and messages (rain.c:82-98).
// Returns { delay } in milliseconds or { error }.
export function parseDelay(arg) {
  const s = String(arg);
  // strtoul(optarg, &ep, 0): decimal, 0x hex or 0 octal; the whole string
  // strtoul also takes a minus sign and negates in unsigned arithmetic:
  // "-5" becomes ULONG_MAX - 4, which then fails the range check below.
  const m = /^\s*([+-]?)(0[xX][0-9a-fA-F]+|0[0-7]+|[0-9]+)$/.exec(s);
  // ("08" stops at the 8, leaving junk: an error, as in C)
  if (!m || /^0[0-7]*[89]/.test(m[2])) return { error: `Invalid delay \`${s}'` };
  const digits = m[2];
  let val;
  if (/^0[xX]/.test(digits)) val = parseInt(digits, 16);
  else if (/^0[0-7]+$/.test(digits)) val = parseInt(digits, 8);
  else val = parseInt(digits, 10);
  if (m[1] === '-' && val !== 0) val = Infinity;
  if (val >= 1000) return { error: `Invalid delay \`${s}' (1-999)` };
  return { delay: val };
}

export function createRain({ COLS = 80, LINES = 24, seed = 1, delay = 120 } = {}) {
  if (COLS < MIN_COLS || LINES < MIN_LINES) {
    throw new Error(`terminal too small: ${COLS}x${LINES} (need ${MIN_COLS}x${MIN_LINES})`);
  }
  const st = {
    COLS,
    LINES,
    cols: COLS - 4, // rain.c:101
    lines: LINES - 4, // rain.c:102
    delay,
    seed,
    rng: createRandom(seed),
    xpos: [0, 0, 0, 0, 0],
    ypos: [0, 0, 0, 0, 0],
    j: 0,
    frame: 0,
    bytes: 0, // what the last frame would have sent to the terminal
    screen: Array.from({ length: LINES }, () => ' '.repeat(COLS)),
  };
  // five random starting positions, filled from the top (rain.c:109-112):
  // these "phantom" drops enter the animation already part-way through
  for (let j = 4; j >= 0; --j) {
    st.xpos[j] = (next(st.rng) % st.cols) + 2;
    st.ypos[j] = (next(st.rng) % st.lines) + 2;
  }
  return st;
}

// curses mvaddstr onto the persistent screen (clipped like curses would).
// Also tallies what curses would send down the line for it: a cursor
// address (ESC [ row ; col H, ~7 bytes) plus the span of changed cells —
// curses only transmits what changed. Used to pace -d 0 (ADR-003).
const CUP_BYTES = 7;
function put(st, y, x, s) {
  if (y < 0 || y >= st.LINES) return;
  const row = st.screen[y];
  let out = row;
  let first = -1;
  let last = -1;
  for (let i = 0; i < s.length; i++) {
    const c = x + i;
    if (c < 0 || c >= st.COLS) continue;
    if (row[c] !== s[i]) {
      if (first < 0) first = i;
      last = i;
    }
    out = out.slice(0, c) + s[i] + out.slice(c + 1);
  }
  st.screen[y] = out;
  if (first >= 0) st.bytes += CUP_BYTES + (last - first + 1);
}

// Milliseconds the last frame took on the wire at 9600 baud (960 bytes/s):
// the pace of `rain` with no -d, which waited for tcdrain() (rain.c:150).
export const BAUD_BYTES_PER_S = 960;
export function frameMs(st) {
  return st.delay > 0 ? st.delay : Math.max(1, Math.round((st.bytes / BAUD_BYTES_PER_S) * 1000));
}

const dec = (j) => (j === 0 ? 4 : j - 1);

// One frame of the original loop. Mutates st and returns this frame's
// events, one per drop, in drawing order:
//   { age, x, y, slot, phantom }
// `phantom` marks the five random start positions that never had an age 0.
export function step(st) {
  const ev = [];
  st.bytes = 0;
  const x = (next(st.rng) % st.cols) + 2; // rain.c:118
  const y = (next(st.rng) % st.lines) + 2; // rain.c:119
  put(st, y, x, '.');
  ev.push({ age: 0, x, y, slot: -1 });
  let j = st.j;
  put(st, st.ypos[j], st.xpos[j], 'o');
  ev.push({ age: 1, x: st.xpos[j], y: st.ypos[j], slot: j });
  j = dec(j);
  put(st, st.ypos[j], st.xpos[j], 'O');
  ev.push({ age: 2, x: st.xpos[j], y: st.ypos[j], slot: j });
  j = dec(j);
  {
    const px = st.xpos[j];
    const py = st.ypos[j];
    put(st, py - 1, px, '-');
    put(st, py, px - 1, '|.|');
    put(st, py + 1, px, '-');
    ev.push({ age: 3, x: px, y: py, slot: j });
  }
  j = dec(j);
  {
    const px = st.xpos[j];
    const py = st.ypos[j];
    put(st, py - 2, px, '-');
    put(st, py - 1, px - 1, '/ \\');
    put(st, py, px - 2, '| O |');
    put(st, py + 1, px - 1, '\\ /');
    put(st, py + 2, px, '-');
    ev.push({ age: 4, x: px, y: py, slot: j });
  }
  j = dec(j);
  {
    const px = st.xpos[j];
    const py = st.ypos[j];
    put(st, py - 2, px, ' ');
    put(st, py - 1, px - 1, '   ');
    put(st, py, px - 2, '     ');
    put(st, py + 1, px - 1, '   ');
    put(st, py + 2, px, ' ');
    ev.push({ age: 5, x: px, y: py, slot: j });
  }
  st.xpos[j] = x; // rain.c:144-145
  st.ypos[j] = y;
  st.j = j;
  // the five start positions are phantoms until they have been replaced
  if (st.frame < 5) {
    for (const e of ev) if (e.age > 0 && e.age > st.frame) e.phantom = true;
  }
  st.frame++;
  return ev;
}

// The screen as text, one line per row, trailing blanks trimmed — the same
// form tmux capture-pane produces for the original.
export function screenText(st) {
  return st.screen.map((r) => r.replace(/\s+$/, '')).join('\n');
}

export const cloneRain = (st) => JSON.parse(JSON.stringify(st));
