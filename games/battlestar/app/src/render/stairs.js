// Staircases as architecture, not a ramp of boxes: flights with nosed
// treads and risers, a carpet runner held by brass rods, closed stringers,
// turned balusters under a handrail that follows the pitch, newel posts,
// landings on columns, and real openings in the floor and ceiling — so a
// flight that leads up actually goes through the ceiling.
//
// Coordinates: a flight rises toward -z from its foot at (0, 0, 0); x is
// across the flight. Built with the modelling toolkit (model.js).

import * as THREE from 'three';
import { mesh } from './geo.js';
import { mat, glowMat } from './materials.js';
import { rbox, latheGeo, tubeGeo } from './model.js';

const BALUSTER = [[0, 0], [0.034, 0], [0.034, 0.05], [0.026, 0.07], [0.02, 0.12], [0.03, 0.2], [0.036, 0.3], [0.022, 0.42],
  [0.016, 0.52], [0.022, 0.6], [0.018, 0.7], [0.026, 0.74], [0.026, 0.8], [0, 0.8]];
const NEWEL = [[0, 0], [0.09, 0], [0.09, 0.1], [0.075, 0.13], [0.07, 0.8], [0.085, 0.84], [0.085, 0.9], [0.06, 0.93], [0.07, 1.0],
  [0.05, 1.06], [0.02, 1.1], [0, 1.11]];
const COLUMN = (h) => [[0, 0], [0.2, 0], [0.2, 0.06], [0.17, 0.1], [0.15, 0.16], [0.14, h * 0.5], [0.13, h - 0.2], [0.15, h - 0.14],
  [0.18, h - 0.08], [0.2, h - 0.04], [0.2, h], [0, h]];

/**
 * A balustrade: balusters from a base line to a handrail `height` above it.
 * `base(t)` gives [x, y, z] along the run for t in [0, 1]; n balusters.
 */
export function balustrade(M, base, n, { height = 0.9, newels = [true, true], rail = 0.034, newelDrop = 0 } = {}) {
  const g = new THREE.Group();
  const bal = latheGeo(BALUSTER, 14);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const [x, y, z] = base(t);
    const b = mesh(bal, M.ivory, { pos: [x, y, z] });
    b.scale.y = (height - 0.06) / 0.8;
    g.add(b);
  }
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const [x, y, z] = base(i / 12);
    pts.push([x, y + height, z]);
  }
  g.add(mesh(tubeGeo(pts, rail, 40), M.rail));
  // a lower string rail the balusters stand on
  const low = pts.map(([x, y, z]) => [x, y - height + 0.03, z]);
  g.add(mesh(tubeGeo(low, 0.028, 40), M.ivory));
  const newel = latheGeo(NEWEL, 20);
  newels.forEach((on, k) => {
    if (!on) return;
    const [x, y0, z] = base(k);
    const y = y0 - newelDrop; // newels stand on the floor or tread, not on the string line
    const p = mesh(newel, M.ivory, { pos: [x, y, z] });
    p.scale.y = (height + 0.12 + newelDrop) / 1.0;
    g.add(p);
    g.add(mesh(new THREE.SphereGeometry(0.05, 16, 12), M.gold, { pos: [x, y + (height + 0.12 + newelDrop) * 1.08 + 0.03, z] }));
  });
  return g;
}

/**
 * One straight flight. Options: rails ('left'/'right' sides get a
 * balustrade), under ('spandrel' closes the triangle below to the floor,
 * 'soffit' a sloped ceiling under the flight, 'none').
 */
export function flight(M, { width = 1.6, steps = 13, rise = 0.173, going = 0.3, rails = ['left', 'right'], under = 'spandrel', runner = true, newelBottom = true, newelTop = true }) {
  const g = new THREE.Group();
  const H = steps * rise;
  const L = steps * going;
  const nose = 0.03;
  const tread = 0.045;
  for (let i = 0; i < steps; i++) {
    const top = (i + 1) * rise;
    g.add(rbox(width, tread, going + nose, 0.012, M.tread, { pos: [0, top - tread, -(i + 0.5) * going + nose / 2] }));
    g.add(rbox(width - 0.02, rise - tread, 0.022, 0.004, M.riser, { pos: [0, i * rise, -i * going - 0.011] }));
    if (runner) {
      const rw = width * 0.7;
      g.add(rbox(rw, 0.012, going, 0.005, M.runner, { pos: [0, top, -(i + 0.5) * going + nose * 0.6], shadow: false }));
      g.add(rbox(rw, rise - 0.006, 0.012, 0.004, M.runner, { pos: [0, i * rise + 0.004, -i * going + 0.007], shadow: false }));
      const rod = mesh(new THREE.CylinderGeometry(0.008, 0.008, rw + 0.08, 10), M.gold, { pos: [0, i * rise + 0.012, -i * going + 0.024], rot: [0, 0, Math.PI / 2], shadow: false });
      g.add(rod);
    }
  }
  // stringers: sloped boards along both sides, just above the nosing line
  const slope = Math.atan2(H, L);
  const len = Math.hypot(H, L);
  for (const s of [-1, 1]) {
    const st = rbox(0.06, 0.34, len + 0.2, 0.02, M.stringer, { center: true });
    st.rotation.x = slope;
    st.position.set(s * (width / 2 + 0.03), H / 2 - 0.04, -L / 2);
    g.add(st);
  }
  // below the flight
  if (under === 'spandrel') {
    const sh = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(L - going, 0), new THREE.Vector2(L - going, H - rise), new THREE.Vector2(0, 0.001)]);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: width + 0.1, bevelEnabled: false });
    geo.translate(0, 0, -(width + 0.1) / 2);
    geo.rotateY(Math.PI / 2);
    g.add(mesh(geo, M.panel));
  } else if (under === 'soffit') {
    const so = rbox(width + 0.1, 0.22, len, 0.03, M.soffit, { center: true });
    so.rotation.x = slope;
    so.position.set(0, H / 2 - 0.2, -L / 2);
    g.add(so);
  }
  // balustrades that follow the pitch (the base line runs along the nosings)
  for (const side of rails) {
    const x = (side === 'left' ? -1 : 1) * (width / 2 + 0.03);
    g.add(balustrade(M, (t) => [x, 0.1 + t * H, -t * L], steps * 2, { newels: [newelBottom, newelTop], newelDrop: 0.1 }));
  }
  g.userData.size = { H, L };
  return g;
}

/**
 * The parlor's stair core (a switchback): the first flight rises along +x
 * half toward -z to a landing on columns; the second rises back toward +z
 * over the left half and through the ceiling; beneath it a flight goes down
 * through the floor. Returns the group, the holes to cut in the floor and
 * the ceiling, and suggested lights.
 * x0: centre of the core; zFoot: z of the first step; H: room height; slab: floor thickness.
 * down: false leaves out the flight going down (the lounge, 24); upperRoom:
 * false leaves out the room above (when the core is seen from the floor
 * above, as in the dining hall's entrance, 23).
 */
export function stairCore(M, { H = 4.5, slab = 0.35, zFoot = 1.6, x0 = 0, flightW = 1.6, gap = 0.1, down = true, upperRoom = true }) {
  const g = new THREE.Group();
  const rise = 0.173;
  const going = 0.3;
  const half = flightW + gap / 2;
  const n1 = Math.round((H + slab) / 2 / rise);
  const hLanding = n1 * rise;
  const n2 = Math.round((H + slab - hLanding) / rise);
  const L1 = n1 * going;
  const zLand = zFoot - L1;
  const landD = 1.6;
  const zBack = zLand - landD;
  const xR = x0 + gap / 2 + flightW / 2;
  const xL = x0 - gap / 2 - flightW / 2;
  // 1st flight (right), closed underneath
  const f1 = flight(M, { width: flightW, steps: n1, rise, going, rails: ['left', 'right'], under: 'spandrel' });
  f1.position.set(xR, 0, zFoot);
  g.add(f1);
  // landing across both halves, on a panelled base (right) and columns (left)
  const lw = flightW * 2 + gap + 0.12;
  g.add(rbox(lw, 0.3, landD, 0.02, M.tread, { pos: [x0, hLanding - 0.3, zLand - landD / 2] }));
  g.add(rbox(lw - 0.3, 0.012, landD - 0.3, 0.004, M.runner, { pos: [x0, hLanding, zLand - landD / 2], shadow: false }));
  g.add(rbox(flightW + 0.1, hLanding - 0.3, landD, 0.01, M.panel, { pos: [xR, 0, zLand - landD / 2] }));
  const col = latheGeo(COLUMN(hLanding - 0.3), 24);
  for (const z of [zLand - 0.12, zBack + 0.12]) g.add(mesh(col, M.ivory, { pos: [x0 - half + 0.14, 0, z] }));
  g.add(balustrade(M, (t) => [x0 - half + t * (lw - 0.06), hLanding, zBack + 0.05], 14, { newels: [true, true] }));
  g.add(balustrade(M, (t) => [x0 - half + 0.03, hLanding, zBack + 0.05 + t * (landD - 0.1)], 4, { newels: [false, false] }));
  g.add(balustrade(M, (t) => [x0 + half - 0.03, hLanding, zBack + 0.05 + t * (landD - 0.1)], 4, { newels: [false, false] }));
  // 2nd flight (left) from the landing back toward +z, through the ceiling
  const f2 = flight(M, { width: flightW, steps: n2, rise, going, rails: ['left', 'right'], under: 'soffit', newelBottom: false, newelTop: false });
  f2.rotation.y = Math.PI;
  f2.position.set(xL, hLanding, zLand);
  g.add(f2);
  const zTop2 = zLand + n2 * going;
  // down flight (left) from the floor toward -z, beneath the 2nd flight
  if (down) {
    const fd = flight(M, { width: flightW, steps: n1, rise, going, rails: [], under: 'none', runner: true });
    fd.rotation.y = Math.PI;
    fd.position.set(xL, -hLanding, zFoot - L1);
    g.add(fd);
    // lower landing and the shaft below the floor
    g.add(rbox(lw, 0.3, landD, 0.02, M.tread, { pos: [x0, -hLanding - 0.3, zLand - landD / 2] }));
    const shaftH = H + slab;
    const shaft = (w, h, d, pos) => g.add(rbox(w, h, d, 0.005, M.shaft, { pos, shadow: false }));
    shaft(0.1, shaftH, zFoot - zBack + 0.2, [x0 - half - 0.05, -shaftH, (zFoot + zBack) / 2]);
    shaft(0.1, shaftH, zFoot - zBack + 0.2, [x0 + 0.05, -shaftH, (zFoot + zBack) / 2 + 0.0]);
    shaft(lw + 0.2, shaftH, 0.1, [x0, -shaftH, zBack - 0.05]);
    // a floor-level balustrade guards the down opening's far and outer edges
    g.add(balustrade(M, (t) => [x0 - half + 0.03, 0, zLand + 0.05 + t * (zFoot - zLand - 0.1)], 12, { newels: [true, true] }));
    // slab edges (the cut floor and ceiling thickness)
    const edge = (w, d, y, pos) => g.add(rbox(w, slab, d, 0.01, M.edge, { pos: [pos[0], y, pos[1]], shadow: false }));
    edge(flightW + gap / 2 + 0.02, 0.06, -slab, [x0 - half / 2, zLand - 0.03]);
    edge(0.06, zFoot - zLand, -slab, [x0 - half - 0.03, (zFoot + zLand) / 2]);
  }
  // ceiling opening lining, and the room above
  const up = new THREE.Group();
  up.position.y = H;
  const lineW = 0.06;
  up.add(rbox(lw, slab, lineW, 0.01, M.edge, { pos: [x0, 0, zBack - lineW / 2] }));
  up.add(rbox(lineW, slab, zTop2 - zBack, 0.01, M.edge, { pos: [x0 - half - lineW / 2, 0, (zTop2 + zBack) / 2] }));
  up.add(rbox(lineW, slab, zLand - zBack, 0.01, M.edge, { pos: [x0 + half + lineW / 2, 0, (zLand + zBack) / 2] }));
  up.add(rbox(half, slab, lineW, 0.01, M.edge, { pos: [x0 + half / 2, 0, zLand + lineW / 2] }));
  up.add(rbox(lineW, slab, zTop2 - zLand, 0.01, M.edge, { pos: [x0 + lineW / 2, 0, (zTop2 + zLand) / 2] }));
  // the landing above: a balustrade round the well
  up.add(balustrade(M, (t) => [x0 + half + 0.03, slab, zBack + t * (zLand - zBack)], 6, { newels: [true, true] }));
  up.add(balustrade(M, (t) => [x0 + 0.03 + t * half, slab, zLand + 0.03], 6, { newels: [false, true] }));
  up.add(balustrade(M, (t) => [x0 + 0.03, slab, zLand + t * (zTop2 - zLand)], 12, { newels: [false, false] }));
  // upper room: walls and a lit ceiling seen through the well
  if (upperRoom) {
    const uw = lw + 4;
    const ud = zTop2 - zBack + 3;
    const uz = (zTop2 + zBack) / 2 + 0.5;
    const uh = 3.6;
    up.add(rbox(uw, 0.1, ud, 0.005, M.upperCeil, { pos: [x0, slab + uh, uz], shadow: false }));
    up.add(rbox(uw, uh, 0.1, 0.005, M.upperWall, { pos: [x0, slab, uz - ud / 2], shadow: false }));
    for (const s of [-1, 1]) up.add(rbox(0.1, uh, ud, 0.005, M.upperWall, { pos: [x0 + s * uw / 2, slab, uz], shadow: false }));
  }
  g.add(up);
  const holeCeil = [[x0 - half, zBack], [x0 + half, zBack], [x0 + half, zLand], [x0, zLand], [x0, zTop2], [x0 - half, zTop2]];
  const holeFloor = [[x0 - half, zLand], [x0, zLand], [x0, zFoot], [x0 - half, zFoot]];
  return {
    group: g,
    floorHoles: down ? [holeFloor] : [],
    ceilHoles: [holeCeil],
    lights: {
      above: [x0 - 0.6, H + slab + 2.6, (zLand + zBack) / 2],
      below: [x0 - half / 2, -hLanding + 2.1, zLand - 0.8],
    },
    bounds: { x0: x0 - half, x1: x0 + half, z0: zBack, z1: zFoot },
    levels: { landing: hLanding, top: H + slab },
  };
}

// ---------------------------------------------------------------- the battlestar's steel stairs

/** Materials for the ship's steel stairs and the decks they join; `worn` adds rust and dust. */
export function steelMats({ worn = false } = {}) {
  return {
    tread: mat('grate', { c1: worn ? 0x5e544a : 0x535b64, c2: 0x0e1012, c3: 0xff6a30, p: [0.1, 0, 0, 0] }),
    stringer: mat('metal', { c1: 0x3a4047, c2: worn ? 0x5a3a22 : 0x15181b, p: [0.4, worn ? 0.75 : 0.3, 0, 0] }),
    rail: mat('metal', { c1: 0xb6bcc4, c2: worn ? 0x6a4a2a : 0x5a6068, p: [0.26, worn ? 0.6 : 0.2, 0, 0] }),
    hazard: mat('glow', { c1: 0xffb020, p: [worn ? 0.12 : 0.3, 0, 0, 0] }),
    edge: mat('metal', { c1: 0x2e3339, c2: 0x0e1012, p: [0.45, 0.4, 0, 0] }),
    shaft: mat('panel', { c1: 0x2c323a, c2: 0x0b0d10, c3: 0xffa45a, p: [1.25, 0.07, 0, 0], q: [0.7, 0, 0, 0], seed: 17 }),
    upperWall: mat('panel', { c1: 0x4d5866, c2: 0x12161b, c3: 0xffa45a, p: [1.25, 0.07, 0, 0], q: [0.55, 0, 0, 0], seed: 18 }),
    upperCeil: mat('panel', { c1: 0x2c323a, c2: 0x0b0d10, c3: 0xffe0b0, p: [1.6, 0, 0, 0], q: [0.3, 0, 0, 0], seed: 19 }),
    floor: mat('grate', { c1: 0x4a5058, c2: 0x101215, c3: 0xff6a30, p: [0.4, 0.0, 0, 0] }),
    lamp: glowMat(0xfff0d8, 1.6),
  };
}

/** A straight cylinder between two points (rails, posts, braces). */
export function rod(a, b, r, material, seg = 10) {
  const A = new THREE.Vector3(...a);
  const B = new THREE.Vector3(...b);
  const len = A.distanceTo(B);
  const m = mesh(new THREE.CylinderGeometry(r, r, len, seg), material);
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  return m;
}

/**
 * An industrial guard railing along a floor polyline [[x, y, z], ...]:
 * posts, a top rail and a knee rail of steel tube, and a kick plate.
 */
export function railing(M, pts, { height = 1.0, spacing = 1.2, kick = true } = {}) {
  const g = new THREE.Group();
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0, z0] = pts[i];
    const [x1, y1, z1] = pts[i + 1];
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.round(len / spacing));
    for (let k = i ? 1 : 0; k <= n; k++) {
      const t = k / n;
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t;
      const z = z0 + (z1 - z0) * t;
      g.add(rod([x, y, z], [x, y + height, z], 0.022, M.rail));
      g.add(mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.02, 12), M.rail, { pos: [x, y + 0.01, z], shadow: false }));
    }
    g.add(rod([x0, y0 + height, z0], [x1, y1 + height, z1], 0.026, M.rail));
    g.add(rod([x0, y0 + height * 0.5, z0], [x1, y1 + height * 0.5, z1], 0.018, M.rail));
    if (kick) {
      const kp = rbox(len, 0.1, 0.012, 0.004, M.edge, { center: true, shadow: false });
      kp.position.set((x0 + x1) / 2, (y0 + y1) / 2 + 0.06, (z0 + z1) / 2);
      kp.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
      g.add(kp);
    }
    if (i) g.add(mesh(new THREE.SphereGeometry(0.03, 10, 8), M.rail, { pos: [x0, y0 + height, z0], shadow: false }));
  }
  return g;
}

/**
 * A steel ship's stair (open risers, grating treads with hazard nosings,
 * channel stringers, tube handrails on posts), rising toward -z from its
 * foot at (0, 0, 0).
 */
export function steelFlight(M, { width = 1.1, steps, rise = 0.21, going = 0.165, rails = ['left', 'right'], railH = 0.95 }) {
  const g = new THREE.Group();
  const H = steps * rise;
  const L = steps * going;
  const nose = 0.05;
  for (let i = 0; i < steps; i++) {
    const top = (i + 1) * rise;
    const z0 = -i * going + nose; // front edge
    g.add(rbox(width, 0.035, going + nose, 0.008, M.tread, { pos: [0, top - 0.035, z0 - (going + nose) / 2] }));
    g.add(rbox(width - 0.04, 0.008, 0.035, 0.003, M.hazard, { pos: [0, top - 0.003, z0 - 0.02], shadow: false }));
    g.add(rbox(width, 0.045, 0.025, 0.006, M.stringer, { pos: [0, top - 0.08, z0 - 0.013] }));
  }
  const slope = Math.atan2(H, L);
  const len = Math.hypot(H, L);
  for (const s of [-1, 1]) {
    const st = rbox(0.05, 0.26, len + 0.25, 0.012, M.stringer, { center: true });
    st.rotation.x = slope;
    st.position.set(s * (width / 2 + 0.025), H / 2 - 0.05, -L / 2);
    g.add(st);
  }
  for (const side of rails) {
    const x = (side === 'left' ? -1 : 1) * (width / 2 + 0.05);
    const at = (t) => [x, rise + t * (H - rise), nose - t * (steps - 1) * going];
    const n = Math.max(2, Math.round(steps / 5));
    for (let k = 0; k <= n; k++) {
      const [px, py, pz] = at(k / n);
      g.add(rod([px, py - 0.03, pz], [px, py + railH, pz], 0.02, M.rail));
    }
    const [bx, by, bz] = at(0);
    const [tx, ty, tz] = at(1);
    g.add(rod([bx, by + railH, bz], [tx, ty + railH, tz], 0.024, M.rail));
    g.add(rod([bx, by + railH * 0.5, bz], [tx, ty + railH * 0.5, tz], 0.017, M.rail));
    // the top rail turns level where the flight lands
    g.add(rod([tx, ty + railH, tz], [tx, ty + railH, tz - 0.35], 0.024, M.rail));
    g.add(mesh(new THREE.SphereGeometry(0.03, 10, 8), M.rail, { pos: [tx, ty + railH, tz], shadow: false }));
  }
  g.userData.size = { H, L };
  return g;
}

/** Thin boards lining the cut edges of a slab opening (polygon [[x, z], ...]) from y0 to y0 + h. */
export function lining(poly, y0, h, material, t = 0.05) {
  const g = new THREE.Group();
  for (let i = 0; i < poly.length; i++) {
    const [x0, z0] = poly[i];
    const [x1, z1] = poly[(i + 1) % poly.length];
    const len = Math.hypot(x1 - x0, z1 - z0);
    const b = rbox(len + t, h, t, 0.01, material, { center: true, shadow: false });
    b.position.set((x0 + x1) / 2, y0 + h / 2, (z0 + z1) / 2);
    b.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
    g.add(b);
  }
  return g;
}

/**
 * The room glimpsed through an opening: walls round the opening's bounding
 * box (plus a margin), a ceiling with a light fitting (above) or a floor
 * (below). box = [x0, x1, z0, z1]; y = the base; h = its height.
 */
export function stub(M, box, { y, h = 3.2, margin = 1.6, below = false } = {}) {
  const g = new THREE.Group();
  const [x0, x1, z0, z1] = box;
  const X0 = x0 - margin;
  const X1 = x1 + margin;
  const Z0 = z0 - margin;
  const Z1 = z1 + margin;
  const w = X1 - X0;
  const d = Z1 - Z0;
  const cx = (X0 + X1) / 2;
  const cz = (Z0 + Z1) / 2;
  const wall = below ? M.shaft : M.upperWall;
  g.add(rbox(w, h, 0.1, 0.005, wall, { pos: [cx, y, Z0], shadow: false }));
  g.add(rbox(w, h, 0.1, 0.005, wall, { pos: [cx, y, Z1], shadow: false }));
  g.add(rbox(0.1, h, d, 0.005, wall, { pos: [X0, y, cz], shadow: false }));
  g.add(rbox(0.1, h, d, 0.005, wall, { pos: [X1, y, cz], shadow: false }));
  if (below) {
    g.add(rbox(w, 0.1, d, 0.005, M.floor, { pos: [cx, y - 0.1, cz], shadow: false }));
    // its light fitting stays under the solid slab, out of sight from above
    g.add(rbox(Math.min(2.4, w * 0.6), 0.03, 0.3, 0.01, M.lamp, { pos: [cx, y + h - 0.05, Z0 + 0.35], shadow: false }));
  } else {
    g.add(rbox(w, 0.1, d, 0.005, M.upperCeil, { pos: [cx, y + h, cz], shadow: false }));
    g.add(rbox(Math.min(2.4, w * 0.6), 0.03, 0.3, 0.01, M.lamp, { pos: [cx, y + h - 0.03, cz], shadow: false }));
  }
  return g;
}

/**
 * A straight flight up through the ceiling (dir 'up') or down through a
 * hatch in the floor (dir 'down'), placed along a wall where it blocks no
 * doorway and nothing in `avoid` ([[x0, x1, z0, z1], ...]). Returns
 * { group, floorHoles, ceilHoles, light, footprint, side }, or null if
 * nothing fits (with `force`, the first candidate that clears `avoid`,
 * even if it crowds a doorway). kind 'steel' (ship's stair, M from steelMats) or 'grand'
 * (style A flight, M from stairMats plus shaft/upper/floor/lamp).
 */
export function stairway(M, { kind = 'steel', dir = 'up', W, D, H, slab = 0.35, drop = 4, width, openings = {}, openFar = false, avoid = [], order, force = false }) {
  const steel = kind === 'steel';
  const w = width ?? (steel ? 1.1 : 1.7);
  const total = dir === 'up' ? H + slab : drop;
  const steps = Math.round(total / (steel ? 0.21 : 0.173));
  const rise = total / steps;
  const going = steel ? 0.165 : 0.3;
  const L = steps * going;
  // the opening only needs to be as long as the headroom demands (2.05 m)
  const sHole = Math.min(L, (2.05 + slab) / (rise / going) + 0.2);
  const m = 0.13; // clearance from the wall
  const cands = {
    left: { top: [-W / 2 + m + w / 2, -D / 2 + 0.02], dir: [0, 1] },
    right: { top: [W / 2 - m - w / 2, -D / 2 + 0.02], dir: [0, 1] },
    farLeft: { top: [-W / 2 + 0.02, -D / 2 + m + w / 2], dir: [1, 0] },
    farRight: { top: [W / 2 - 0.02, -D / 2 + m + w / 2], dir: [-1, 0] },
    centre: { top: [0, -D / 2 + 0.02], dir: [0, 1] },
  };
  // doorways, with room to walk through them
  const doors = [];
  const o = openings;
  if (o.ahead) doors.push([o.ahead.x - 1.1, o.ahead.x + 1.1, -D / 2, -D / 2 + 1.6]);
  if (o.back) doors.push([o.back.x - 1.1, o.back.x + 1.1, D / 2 - 1.6, D / 2]);
  if (o.left) doors.push([-W / 2, -W / 2 + 1.6, o.left.z - 1.1, o.left.z + 1.1]);
  if (o.right) doors.push([W / 2 - 1.6, W / 2, o.right.z - 1.1, o.right.z + 1.1]);
  const hit = (a, b) => a[0] < b[1] && a[1] > b[0] && a[2] < b[3] && a[3] > b[2];
  // an axis-aligned rectangle from p to q, widened by `half` across the run
  const rect = (p, q, half) => {
    const alongX = Math.abs(q[0] - p[0]) > Math.abs(q[1] - p[1]);
    return [Math.min(p[0], q[0]) - (alongX ? 0 : half), Math.max(p[0], q[0]) + (alongX ? 0 : half),
      Math.min(p[1], q[1]) - (alongX ? half : 0), Math.max(p[1], q[1]) + (alongX ? half : 0)];
  };
  const names = order || ['left', 'right', 'farLeft', 'farRight'];
  let pick = null;
  for (const pass of force ? [0, 1] : [0]) for (const name of names) {
    if (pick) break;
    const c = cands[name];
    if (openFar && name.startsWith('far')) continue;
    const [tx, tz] = c.top;
    const [dx, dz] = c.dir;
    // the floor it takes: the whole flight (up) or the hatch (down), plus room to step on
    const a = dir === 'up' ? [tx, tz] : [tx + dx * (L - sHole), tz + dz * (L - sHole)];
    const b = [tx + dx * (L + 0.7), tz + dz * (L + 0.7)];
    const fp = rect(a, b, w / 2 + 0.1);
    if (fp[0] < -W / 2 - 0.01 || fp[1] > W / 2 + 0.01 || fp[2] < -D / 2 - 0.01 || fp[3] > D / 2 + 0.01) continue;
    if ((!pass && doors.some((d) => hit(fp, d))) || avoid.some((d) => hit(fp, d))) continue;
    pick = { ...c, name, footprint: fp };
  }
  if (!pick) return null;
  const [tx, tz] = pick.top;
  const [dx, dz] = pick.dir;
  const g = new THREE.Group();
  // turn the local "rises toward -z" so it rises toward -dir (up) or +dir (down)
  const rotUp = Math.atan2(dx, dz);
  const inner = pick.name === 'right' || pick.name === 'farLeft' ? 'left' : 'right';
  const rails = steel ? ['left', 'right'] : [inner];
  const f = steel
    ? steelFlight(M, { width: w, steps, rise, going, rails })
    : flight(M, { width: w, steps, rise, going, rails, under: dir === 'up' ? 'spandrel' : 'none', newelTop: false });
  let hole;
  if (dir === 'up') {
    f.rotation.y = rotUp;
    f.position.set(tx + dx * L, 0, tz + dz * L);
    hole = rect([tx, tz], [tx + dx * sHole, tz + dz * sHole], w / 2 + 0.1);
  } else {
    f.rotation.y = rotUp + Math.PI;
    f.position.set(tx, -drop, tz);
    hole = rect([tx + dx * (L - sHole), tz + dz * (L - sHole)], [tx + dx * L, tz + dz * L], w / 2 + 0.1);
  }
  g.add(f);
  const [hx0, hx1, hz0, hz1] = hole;
  const poly = [[hx0, hz0], [hx1, hz0], [hx1, hz1], [hx0, hz1]];
  // guard the opening at the other level: every edge except a wall and the
  // edge where the flight meets the slab
  const meet = dir === 'up' ? [tx, tz] : [tx + dx * L, tz + dz * L];
  const guardY = dir === 'up' ? H + slab : 0;
  const onWall = ([p, q]) => (Math.abs(p[0] - q[0]) < 1e-6 && Math.abs(Math.abs(p[0]) - W / 2) < 0.3) || (Math.abs(p[1] - q[1]) < 1e-6 && Math.abs(Math.abs(p[1]) - D / 2) < 0.3);
  const atMeet = ([p, q]) => Math.abs(((p[0] + q[0]) / 2 - meet[0]) * dx + ((p[1] + q[1]) / 2 - meet[1]) * dz) < 0.2;
  for (let i = 0; i < 4; i++) {
    const e = [poly[i], poly[(i + 1) % 4]];
    if (onWall(e) || atMeet(e)) continue;
    const [p, q] = e;
    if (steel) g.add(railing(M, [[p[0], guardY, p[1]], [q[0], guardY, q[1]]], { spacing: 1.0 }));
    else g.add(balustrade(M, (t) => [p[0] + (q[0] - p[0]) * t, guardY, p[1] + (q[1] - p[1]) * t], Math.max(3, Math.round(Math.hypot(q[0] - p[0], q[1] - p[1]) / 0.13)), { newels: [true, true] }));
  }
  // the cut slab's edges, and the room beyond the opening
  g.add(lining(poly, dir === 'up' ? H : -slab, slab, M.edge));
  let light;
  if (dir === 'up') {
    g.add(stub(M, hole, { y: H + slab, h: 3.0, margin: 1.4 }));
    light = [(hx0 + hx1) / 2, H + slab + 2.4, (hz0 + hz1) / 2];
  } else {
    const deep = [Math.min(hx0, tx - w / 2), Math.max(hx1, tx + w / 2), Math.min(hz0, tz), Math.max(hz1, tz)];
    g.add(stub(M, deep, { y: -drop, h: drop - slab, margin: 0.6, below: true }));
    light = [(hx0 + hx1) / 2, -0.5, (hz0 + hz1) / 2]; // just inside the hatch: lights the treads, not the deck
  }
  return { group: g, floorHoles: dir === 'down' ? [poly] : [], ceilHoles: dir === 'up' ? [poly] : [], light, footprint: pick.footprint, side: pick.name };
}
