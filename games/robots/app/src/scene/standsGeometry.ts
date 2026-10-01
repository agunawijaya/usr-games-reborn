// Builds the stands as one BufferGeometry with material groups:
//   0 treads   — the tops of the rows (seats painted on)
//   1 risers   — the faces between rows
//   2 facade   — the outside of the stadium (lit ports)
//   3 section  — the flat cuts where the tall stand ends
//   4 boards   — the front wall facing the arena (LED advertising)
// Each row is a solid band from BASE up to its top, so the stepped mass
// reads as concrete, and the cut ends show a clean section.

import { BufferGeometry, Float32BufferAttribute } from 'three';
import {
  at, backStations, BACK_ROWS, BASE, FRONT_ROWS, ringStations, ROW_DEPTH, rowInner, rowTop, SEAT_PITCH, WALL_H,
  type Station,
} from './stadiumLayout';

type V3 = [number, number, number];
type Buf = { p: number[]; n: number[]; uv: number[] };

const newBuf = (): Buf => ({ p: [], n: [], uv: [] });

// A quad a-b-c-d (in order round its edge) with a known outward normal;
// the winding is fixed to face that normal.
function quad(buf: Buf, a: V3, b: V3, c: V3, d: V3, n: V3, uvs: [number, number][]) {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const cr = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
  const flip = cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] < 0;
  const vs = flip ? [a, d, c, b] : [a, b, c, d];
  const us = flip ? [uvs[0], uvs[3], uvs[2], uvs[1]] : uvs;
  for (const k of [0, 1, 2, 0, 2, 3]) {
    buf.p.push(...vs[k]);
    buf.n.push(...n);
    buf.uv.push(...us[k]);
  }
}

function band(bufs: Buf[], path: Station[], row: number, open: boolean) {
  const a = rowInner(row), b = a + ROW_DEPTH, top = rowTop(row);
  const lo = row === 0 ? BASE : rowTop(row - 1) - 0.01; // inner face: only the riser shows
  let s = 0; // arc length along the inner edge, for texture u
  for (let k = 0; k + 1 < path.length; k++) {
    const p = path[k], q = path[k + 1];
    const [ix0, iz0] = at(p, a), [ix1, iz1] = at(q, a);
    const [ox0, oz0] = at(p, b), [ox1, oz1] = at(q, b);
    const len = Math.hypot(ix1 - ix0, iz1 - iz0);
    const oLen = Math.hypot(ox1 - ox0, oz1 - oz0);
    const u0 = s, u1 = s + len;
    // tread (top)
    quad(bufs[0], [ix0, top, iz0], [ix1, top, iz1], [ox1, top, oz1], [ox0, top, oz0], [0, 1, 0],
      [[u0 / SEAT_PITCH, 0], [u1 / SEAT_PITCH, 0], [u1 / SEAT_PITCH, 1], [u0 / SEAT_PITCH, 1]]);
    // inner face: the riser, or for row 0 the LED wall down to the walkway
    const nIn: V3 = [-(p.nx + q.nx) / 2, 0, -(p.nz + q.nz) / 2];
    if (row === 0) {
      quad(bufs[4], [ix0, 0, iz0], [ix1, 0, iz1], [ix1, top, iz1], [ix0, top, iz0], nIn,
        [[u0 / 24, 0], [u1 / 24, 0], [u1 / 24, 1], [u0 / 24, 1]]);
    } else {
      quad(bufs[1], [ix0, lo, iz0], [ix1, lo, iz1], [ix1, top, iz1], [ix0, top, iz0], nIn,
        [[u0, 0], [u1, 0], [u1, 1], [u0, 1]]);
    }
    // outer face: the facade (hidden where a taller row stands behind)
    const nOut: V3 = [-nIn[0], 0, -nIn[2]];
    const so = (s * b) / Math.max(a, 1e-3);
    quad(bufs[2], [ox0, BASE, oz0], [ox1, BASE, oz1], [ox1, top, oz1], [ox0, top, oz0], nOut,
      [[so / 8, 0], [(so + oLen) / 8, 0], [(so + oLen) / 8, (top - BASE) / 3.2], [so / 8, (top - BASE) / 3.2]]);
    s += len;
  }
  if (open) {
    // flat cuts at both ends, facing along the path outward
    for (const [st, nb] of [[path[0], path[1]], [path[path.length - 1], path[path.length - 2]]] as const) {
      const [ix, iz] = at(st, a), [ox, oz] = at(st, b);
      const tx = st.x - nb.x, tz = st.z - nb.z, tl = Math.hypot(tx, tz) || 1;
      quad(bufs[3], [ix, BASE, iz], [ox, BASE, oz], [ox, top, oz], [ix, top, iz], [tx / tl, 0, tz / tl],
        [[0, 0], [ROW_DEPTH, 0], [ROW_DEPTH, top - BASE], [0, top - BASE]]);
    }
  }
}

/** The walkway (moat) floor between the arena lip and the front wall, as
 *  a ring of quads from the arena rectangle out to the row-0 line. */
function walkway(buf: Buf, ax: number, az: number) {
  const ring = ringStations();
  for (let k = 0; k + 1 < ring.length; k++) {
    const p = ring[k], q = ring[k + 1];
    // project each ring point back onto the arena rectangle along its normal
    const clampRect = (st: Station): [number, number] => {
      const [x, z] = at(st, 0);
      return [Math.max(-ax, Math.min(ax, x)), Math.max(-az, Math.min(az, z))];
    };
    const [a0x, a0z] = clampRect(p), [a1x, a1z] = clampRect(q);
    const [b0x, b0z] = at(p, 0), [b1x, b1z] = at(q, 0);
    quad(buf, [a0x, 0.03, a0z], [a1x, 0.03, a1z], [b1x, 0.03, b1z], [b0x, 0.03, b0z], [0, 1, 0],
      [[a0x, a0z], [a1x, a1z], [b1x, b1z], [b0x, b0z]]);
  }
}

export function buildStands(ax: number, az: number): { stands: BufferGeometry; walk: BufferGeometry } {
  const bufs = [newBuf(), newBuf(), newBuf(), newBuf(), newBuf()];
  const ring = ringStations(), back = backStations();
  for (let r = 0; r < FRONT_ROWS; r++) band(bufs, ring, r, false);
  for (let r = FRONT_ROWS; r < BACK_ROWS; r++) band(bufs, back, r, true);
  const g = new BufferGeometry();
  const P: number[] = [], N: number[] = [], U: number[] = [];
  let start = 0;
  bufs.forEach((b, i) => {
    P.push(...b.p); N.push(...b.n); U.push(...b.uv);
    const count = b.p.length / 3;
    g.addGroup(start, count, i);
    start += count;
  });
  g.setAttribute('position', new Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new Float32BufferAttribute(N, 3));
  g.setAttribute('uv', new Float32BufferAttribute(U, 2));
  const wb = newBuf();
  walkway(wb, ax, az);
  const w = new BufferGeometry();
  w.setAttribute('position', new Float32BufferAttribute(wb.p, 3));
  w.setAttribute('normal', new Float32BufferAttribute(wb.n, 3));
  w.setAttribute('uv', new Float32BufferAttribute(wb.uv, 2));
  return { stands: g, walk: w };
}

/** The stadium's underside: from the outer edge of the front rows at BASE,
 *  tapering down and in, closed at the bottom. */
export function buildUnderside(): BufferGeometry {
  const buf = newBuf();
  const ring = ringStations();
  const outer = rowInner(FRONT_ROWS); // outer edge of the front rows
  const depth = 5, inset = 9;
  for (let k = 0; k + 1 < ring.length; k++) {
    const p = ring[k], q = ring[k + 1];
    const [t0x, t0z] = at(p, outer), [t1x, t1z] = at(q, outer);
    const [b0x, b0z] = at(p, outer - inset), [b1x, b1z] = at(q, outer - inset);
    const nx = (p.nx + q.nx) / 2, nz = (p.nz + q.nz) / 2, l = Math.hypot(nx, nz, inset / depth) || 1;
    quad(buf, [t0x, BASE, t0z], [t1x, BASE, t1z], [b1x, BASE - depth, b1z], [b0x, BASE - depth, b0z], [nx / l, -(inset / depth) / l * 0.6, nz / l],
      [[k / 4, 0], [(k + 1) / 4, 0], [(k + 1) / 4, 1], [k / 4, 1]]);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(buf.p, 3));
  g.setAttribute('normal', new Float32BufferAttribute(buf.n, 3));
  g.setAttribute('uv', new Float32BufferAttribute(buf.uv, 2));
  return g;
}

export { WALL_H };
