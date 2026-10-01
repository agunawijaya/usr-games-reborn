// The stadium round the arena, as numbers (no Three.js): the ring the
// stands follow, the rows, and every seat. Stadium.tsx builds the meshes
// from this; Crowd.tsx seats the crowd; Trash.tsx knows where the throwers
// sit. Kept pure so it can be tested.
//
// The ring is a rounded rectangle just outside the arena's lip and a moat.
// Rows step up and out from it. The camera looks from the +x/+z corner, so
// the stands on the two sides facing it (+x, +z) are cut low — four rows —
// and the stands on the far sides (−x, −z) rise the full fourteen rows.
// The tall stand ends in two flat cuts, at the far-left and far-right
// corners of the screen (a cutaway, as in a stadium-management game).

import { GRID_HEIGHT, GRID_WIDTH } from '../game/state';

export const RIM = 1.3; // the arena's lip
export const GAP = 1.5; // walkway between the lip and the first row
export const R0 = 4; // corner radius of the ring at row 0
export const ROW_DEPTH = 0.85;
export const ROW_RISE = 0.42;
export const WALL_H = 0.9; // the front wall (LED boards) — top of row 0
export const FRONT_ROWS = 4;
export const BACK_ROWS = 14;
export const BASE = -3.2; // underside of the stands
export const SEAT_PITCH = 0.56;

/** Half-extents of the arena including its lip. */
export const AX = GRID_WIDTH / 2 + RIM, AZ = GRID_HEIGHT / 2 + RIM;
/** Centres of the ring's corner arcs. */
export const CX = AX + GAP - R0, CZ = AZ + GAP - R0;

export type Station = {
  /** point on the ring at offset 0 (the inner edge of row 0) */
  x: number; z: number;
  /** outward normal */
  nx: number; nz: number;
  /** true where the full back stand stands */
  back: boolean;
};

const CORNER_STEPS = 18;

function arc(cx: number, cz: number, a0: number, a1: number, back: boolean, out: Station[], skipFirst: boolean) {
  for (let i = skipFirst ? 1 : 0; i <= CORNER_STEPS; i++) {
    const a = a0 + ((a1 - a0) * i) / CORNER_STEPS;
    const nx = Math.cos(a), nz = Math.sin(a);
    out.push({ x: cx + R0 * nx, z: cz + R0 * nz, nx, nz, back });
  }
}

/** The whole ring, closed (the last station repeats the first). Order:
 *  corner +x+z, side +z, corner −x+z, side −x, corner −x−z, side −z,
 *  corner +x−z, side +x. */
export function ringStations(): Station[] {
  const s: Station[] = [];
  const h = Math.PI / 2;
  arc(CX, CZ, 0, h, false, s, false);
  arc(-CX, CZ, h, 2 * h, false, s, false); // the +z side is the straight run between
  arc(-CX, -CZ, 2 * h, 3 * h, true, s, false); // the −x side runs in between
  arc(CX, -CZ, 3 * h, 4 * h, false, s, false);
  s.push({ ...s[0] });
  return s;
}

/** The back stand's path: from the far-left cut (start of the −x side),
 *  round the −x−z corner, to the far-right cut (end of the −z side). */
export function backStations(): Station[] {
  const s: Station[] = [];
  const h = Math.PI / 2;
  s.push({ x: -CX - R0, z: CZ, nx: -1, nz: 0, back: true });
  arc(-CX, -CZ, 2 * h, 3 * h, true, s, false);
  s.push({ x: CX, z: -CZ - R0, nx: 0, nz: -1, back: true });
  return s;
}

export const rowInner = (i: number): number => i * ROW_DEPTH;
export const rowTop = (i: number): number => WALL_H + i * ROW_RISE;

export const at = (st: Station, d: number): [number, number] => [st.x + st.nx * d, st.z + st.nz * d];

export type Seat = {
  x: number; z: number; y: number;
  /** facing: yaw so that local +z looks at the arena */
  yaw: number;
  row: number;
  /** 0..1 round the stadium (for the Mexican wave) */
  around: number;
  /** stable per-seat random 0..1 */
  seed: number;
};

function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Every occupied seat. `density` 1 = all but aisles and a few empties. */
export function seats(density = 1): Seat[] {
  const out: Seat[] = [];
  let id = 0;
  const place = (path: Station[], row: number) => {
    const d = rowInner(row) + ROW_DEPTH * 0.55;
    const y = rowTop(row);
    let carry = SEAT_PITCH * 0.5, n = 0;
    for (let k = 0; k + 1 < path.length; k++) {
      const [x0, z0] = at(path[k], d), [x1, z1] = at(path[k + 1], d);
      const len = Math.hypot(x1 - x0, z1 - z0);
      let u = carry;
      while (u < len) {
        const t = u / len;
        const x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
        const nx = path[k].nx + (path[k + 1].nx - path[k].nx) * t, nz = path[k].nz + (path[k + 1].nz - path[k].nz) * t;
        const seatNo = n++;
        const seed = hash(++id + row * 1000);
        // aisles: two seats every sixteen; a few empty seats; lower density drops more
        const aisle = seatNo % 16 >= 14;
        if (!aisle && hash(id * 3.3) < 0.9 * density) {
          const ang = Math.atan2(z, x);
          out.push({ x, z, y, yaw: Math.atan2(-nx, -nz), row, around: (ang / (2 * Math.PI) + 1) % 1, seed });
        }
        u += SEAT_PITCH;
      }
      carry = u - len;
    }
  };
  const ring = ringStations(), back = backStations();
  for (let r = 0; r < FRONT_ROWS; r++) place(ring, r);
  for (let r = FRONT_ROWS; r < BACK_ROWS; r++) place(back, r);
  return out;
}

/** Throwers when you lose: a small share of the crowd, each at its own
 *  moment within THROW_SPAN seconds. The crowd shader uses the same rule
 *  to swing their arms (keep the constants in step). */
export const THROW_SHARE = 0.09;
export const THROW_SPAN = 6;
export const isThrower = (seed: number): boolean => ((seed * 7.13) % 1) < THROW_SHARE;
export const throwDelay = (seed: number): number => ((seed * 3.71) % 1) * THROW_SPAN;
