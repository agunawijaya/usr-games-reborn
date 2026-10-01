// From grid cells to smooth bodies (port ADR-003, "render one step behind").
//
// Between two engine steps a worm is drawn as a window sliding along the
// path of cells from its previous tail to its new head. At f = 0 the window
// covers exactly the previous body, at f = 1 exactly the new one, so the
// grid state is always what you see at step boundaries. A Catmull-Rom
// spline through the cell centres makes the glide organic.
//
// Pure functions: no DOM, no GL, so node:test can check them.

/**
 * Build the sliding path for one worm.
 * prev, curr: body cells [x, y] from tail to head, before and after a step.
 * Returns { path, from, to }: the window [from + f, to + f] (in cells along
 * `path`) is the body at step fraction f.
 */
export function slidingPath(prev, curr) {
  const m = curr.length;
  if (m === 0) return { path: [], from: 0, to: -1 };
  if (prev.length === m && m >= 2 && sameCells(prev.slice(1), curr.slice(0, m - 1))) {
    // full-length worm: the tail advanced by one cell, the head by one cell
    return { path: [prev[0], ...curr], from: 0, to: m - 1 };
  }
  if (prev.length === m - 1 && sameCells(prev, curr.slice(0, m - 1))) {
    // growing worm (the original's warm-up): the tail stays, the head extends
    return { path: curr, from: 0, to: m - 2, grow: true };
  }
  // anything else (first frame, live -l/-n edits): show the current body
  return { path: curr, from: 0, to: m - 1, snap: true };
}

function sameCells(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i][0] !== b[i][0] || a[i][1] !== b[i][1]) return false;
  return true;
}

/**
 * Relax the staircase of a grid walk (diagonal, straight, diagonal...) into
 * a curve: a few passes of [1 2 1]/4 on interior points, ends pinned so the
 * head and tail stay on their cells.
 */
export function smooth(P, passes) {
  let a = P;
  for (let k = 0; k < passes; k++) {
    const b = a.map((p) => [p[0], p[1]]);
    for (let i = 1; i < a.length - 1; i++) {
      b[i][0] = (a[i - 1][0] + 2 * a[i][0] + a[i + 1][0]) / 4;
      b[i][1] = (a[i - 1][1] + 2 * a[i][1] + a[i + 1][1]) / 4;
    }
    a = b;
  }
  return a;
}

/** Uniform Catmull-Rom position and derivative at parameter u along points P. */
export function catmullRom(P, u) {
  const n = P.length;
  if (n === 1) return [P[0][0], P[0][1], 1, 0];
  const i = Math.min(Math.max(Math.floor(u), 0), n - 2);
  const t = u - i;
  const p0 = P[Math.max(i - 1, 0)];
  const p1 = P[i];
  const p2 = P[i + 1];
  const p3 = P[Math.min(i + 2, n - 1)];
  const t2 = t * t;
  const t3 = t2 * t;
  const pos = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  const der = (a, b, c, d) => 0.5 * ((-a + c) + 2 * (2 * a - 5 * b + 4 * c - d) * t + 3 * (-a + 3 * b - 3 * c + d) * t2);
  return [
    pos(p0[0], p1[0], p2[0], p3[0]), pos(p0[1], p1[1], p2[1], p3[1]),
    der(p0[0], p1[0], p2[0], p3[0]), der(p0[1], p1[1], p2[1], p3[1]),
  ];
}

export const FLOATS_PER_VERTEX = 8; // center.xy, normal.xy, side, halfWidth, s, arcFromHead

/**
 * Write a ribbon (triangle strip, two vertices per sample) into `out`,
 * starting at float offset `o`. Positions are in grid units (cell centres at
 * x + 0.5, y + 0.5). Returns the number of vertices written.
 *
 * opts: { f, samplesPerCell, width, sway, time, phase }
 */
export function writeRibbon(out, o, sp, opts) {
  const { path, from, to, grow, snap } = sp;
  if (path.length === 0) return 0;
  const f = snap ? 0 : opts.f;
  const u0 = grow ? from : from + f;
  const u1 = to + f;
  const bodyLen = Math.max(u1 - u0, 0.001);
  // at least a stub for a worm that has only just appeared
  const n = Math.max(2, Math.ceil(bodyLen * opts.samplesPerCell) + 1);
  const P = smooth(path.map(([x, y]) => [x + 0.5, y + 0.5]), opts.smooth ?? 2);
  let v = 0;
  for (let j = 0; j < n; j++) {
    const u = u0 + (bodyLen * j) / (n - 1);
    const [px, py, dx, dy] = catmullRom(P, u);
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const s = j / (n - 1);                 // 0 at the tail, 1 at the head
    const arc = (1 - s) * bodyLen;         // cells behind the head
    // body profile: rounded head, bulb behind it, long tapering tail
    const head = Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(0, 0.45 - arc) / 0.45, 2)));
    const tailArc = s * bodyLen;
    const tail = Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(0, 0.6 - tailArc) / 0.6, 2)));
    const taper = 0.45 + 0.55 * Math.pow(Math.min(1, s * 1.6), 0.7);
    const bulb = 1 + 0.12 * Math.exp(-Math.pow((arc - 0.9) / 0.6, 2));
    const wave = 1 + 0.07 * Math.sin(arc * 1.1 - opts.time * 2.4 + opts.phase);  // peristalsis
    const scallop = 1 + 0.07 * Math.cos(arc * (opts.rings ?? 1) * 2 * Math.PI);    // bulging segments
    const hw = opts.width * taper * bulb * wave * scallop * head * tail;
    // gentle lateral sway, strongest mid-body, none at the head
    // long, slow, irregular: two incommensurate waves so it never reads as a spring
    const sw = Math.sin(arc * 0.55 - opts.time * 1.3 + opts.phase) * 0.7 + Math.sin(arc * 1.37 - opts.time * 2.1 + opts.phase * 2.3) * 0.3;
    const sway = opts.sway * 0.6 * sw * Math.min(1, arc / 2.0) * (0.3 + 0.7 * s);
    const cx = px + nx * sway;
    const cy = py + ny * sway;
    for (const side of [-1, 1]) {
      out[o++] = cx; out[o++] = cy; out[o++] = nx; out[o++] = ny;
      out[o++] = side; out[o++] = hw; out[o++] = s; out[o++] = arc;
      v++;
    }
  }
  return v;
}

/**
 * A luminescent trail (-t): the cells a worm's tail left, oldest first, as
 * a thin smooth strip. `points` are { x, y, t } (grid cell, time left).
 * Each vertex stores its age fraction in the `s` slot (0 new .. 1 gone).
 * Returns the number of vertices written.
 */
export function writeTrail(out, o, points, opts) {
  const { now, fade, width, samplesPerCell } = opts;
  const live = points.filter((p) => now - p.t < fade);
  if (live.length < 2) return 0;
  const P = smooth(live.map((p) => [p.x + 0.5, p.y + 0.5]), 3);
  const n = Math.max(2, Math.ceil((P.length - 1) * samplesPerCell) + 1);
  let v = 0;
  for (let j = 0; j < n; j++) {
    const u = ((P.length - 1) * j) / (n - 1);
    const [px, py, dx, dy] = catmullRom(P, u);
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const k = Math.min(Math.floor(u), live.length - 1);
    const kt = live[k].t + (live[Math.min(k + 1, live.length - 1)].t - live[k].t) * (u - k);
    const age = Math.min(1, (now - kt) / fade);
    for (const side of [-1, 1]) {
      out[o++] = px; out[o++] = py; out[o++] = nx; out[o++] = ny;
      out[o++] = side; out[o++] = width * (1 - 0.6 * age); out[o++] = age; out[o++] = 0;
      v++;
    }
  }
  return v;
}
