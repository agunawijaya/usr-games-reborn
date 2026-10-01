// Grid geometry: distance, bearing, arcs of fire.
//
// Ported from sail/misc.c:51-177 (range, closestenemy, angle, gunsbear,
// portside). Ed Wang's angle() is formalised here; see ADR 004 for the two
// deliberate fixes in gunsbear() (target-stern sign error, port bow arc).

import { DR, DC } from './constants.js';

// "Octile-ish" distance: longer axis + half the shorter (integer).
// sail/misc.c:51
export function distance(x, y) {
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  return ax >= ay ? ax + Math.trunc(ay / 2) : ay + Math.trunc(ax / 2);
}

// Compass octant (1 = N, clockwise) of the vector (dr, dc), where dr > 0
// points NORTH (row decreasing) and dc > 0 points EAST.
//
// Formalisation of sail/misc.c:110-135: pick the quadrant, then step one
// octant for every tan(22.6 deg) boundary crossed, using the ratio 2.4
// (1/2.4 = 0.4167 ~ tan 22.5 deg = 0.4142). The original's "doesn't work
// perfectly" edge cases are preserved exactly and pinned by tests:
//   - the zero vector (0,0) returns 7 (west),
//   - exact-axis vectors fall into the quadrant listed first
//     ((dr>0, dc=0) -> N, (dr=0, dc>0) -> E, (dr<0, dc=0) -> S, (0,<0) -> W).
export function angle(dr, dc) {
  let i;
  if (dc >= 0 && dr > 0) i = 0;
  else if (dr <= 0 && dc > 0) i = 2;
  else if (dc <= 0 && dr < 0) i = 4;
  else i = 6;
  dr = Math.abs(dr);
  dc = Math.abs(dc);
  if ((i === 0 || i === 4) && dc * 2.4 > dr) {
    i++;
    if (dc > dr * 2.4) i++;
  } else if ((i === 2 || i === 6) && dr * 2.4 > dc) {
    i++;
    if (dr > dc * 2.4) i++;
  }
  return (i % 8) + 1;
}

export function sternRow(sp) { return sp.row + DR[sp.dir]; }
export function sternCol(sp) { return sp.col + DC[sp.dir]; }

// Range between two ships (each occupies bow + stern squares).
// Returns -1 if `to` has left the board (dir 0). sail/misc.c:56-81
export function range(from, to) {
  if (!to.dir) return -1;
  const bb = distance(to.row - from.row, to.col - from.col);
  if (bb >= 5) return bb;
  const s1r = from.row + DR[from.dir];
  const s1c = from.col + DC[from.dir];
  const s2r = to.row + DR[to.dir];
  const s2c = to.col + DC[to.dir];
  const bs = distance(to.row - s1r, to.col - s1c);
  const sb = distance(from.row - s2r, from.col - s2c);
  const ss = distance(s2r - s1r, s2c - s1c);
  return Math.min(bb, bs, sb, ss);
}

// Relative bearing of `to` from `from` (1 = dead ahead ... 5 = dead astern).
export function relativeBearing(from, to) {
  let ang = angle(from.row - to.row, to.col - from.col) - from.dir + 1;
  if (ang < 1) ang += 8;
  return ang;
}

// Which broadside of `from` bears on `to`: 'r' (starboard), 'l' (port) or 0.
// Checks the target's bow, then its stern. sail/misc.c:138-157.
// FIXES (ADR 004): the original stepped to the target's stern with the wrong
// row sign (+DR instead of -DR) and gave the port battery only bearings 6-7
// while starboard got 2-4. Both arcs are now 3 octants (2-4 / 6-8).
export function gunsbear(from, to) {
  let Dr = from.row - to.row;
  let Dc = to.col - from.col;
  for (let i = 2; i; i--) {
    let ang = angle(Dr, Dc) - from.dir + 1;
    if (ang < 1) ang += 8;
    if (ang >= 2 && ang <= 4) return 'r';
    if (ang >= 6 && ang <= 8) return 'l';
    Dr -= DR[to.dir];
    Dc += DC[to.dir];
  }
  return 0;
}

// quick == 0: true if `from` is shooting at `on`'s starboard side.
// quick != 0: raw compass angle from `from` to `on` (bow; stern when -1).
// sail/misc.c:160-177 (the -1 stern step carries the same sign fix).
export function portside(from, on, quick) {
  let Dr = from.row - on.row;
  let Dc = on.col - from.col;
  if (quick === -1) {
    Dr -= DR[on.dir];
    Dc += DC[on.dir];
  }
  let ang = angle(Dr, Dc);
  if (quick !== 0) return ang;
  // FIX (ADR 004): C's `%` on a negative operand returned -3..0 here, which
  // reported the port side as starboard for some headings. Use a true modulo.
  ang = ((((ang + 4 - on.dir - 1) % 8) + 8) % 8) + 1;
  return ang < 5;
}
