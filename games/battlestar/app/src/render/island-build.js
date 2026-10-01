// Island construction kit (style A, ADR-013): what the island's buildings
// are made of — weatherboard and board-and-batten walls with real openings,
// plank decks with gaps, framed windows with louvred shutters, panelled
// doors, railings with turned balusters, steps, layered thatch with a ragged
// fringe, gable, hipped and gambrel roofs, carved bargeboards. Parts are
// merged into one geometry per material and piece, so a village stays cheap.
// Scene convention (geo.js): -Z ahead, +X right, Y up; metres. Walls face +z.

import * as THREE from 'three';
import { mat, glowMat } from './materials.js';
import { mesh } from './geo.js';
import { roundedBoxGeo, latheGeo, weldNormals } from './model.js';
import { merge } from './flora.js';

// ---------------------------------------------------------------- materials

export const IM = {
  thatch: () => mat('bark', { c1: 0xbfa46e, c2: 0x76603c, p: [260, 2.4, 0.08, 0], side: THREE.DoubleSide }),
  thatchOld: () => mat('bark', { c1: 0xa08c66, c2: 0x584832, p: [260, 2.4, 0.1, 0], side: THREE.DoubleSide }),
  bamboo: () => mat('bark', { c1: 0xc8ab6e, c2: 0x8e7242, p: [3, 5, 0.9, 0] }),
  pole: () => mat('bark', { c1: 0x8a6e4a, c2: 0x54402a, p: [6, 3, 0.15, 0] }),
  reed: () => mat('bark', { c1: 0xc4a46a, c2: 0x7a5c3a, p: [150, 1.3, 0.55, 0] }),
  weave: () => mat('fabric', { c1: 0xc4a46a, c2: 0x7e6238, p: [0.09, 0, 0, 1] }),
  weaveDark: () => mat('fabric', { c1: 0x9a7a4a, c2: 0x5a4226, p: [0.1, 0, 0, 1] }),
  plank: () => mat('wood', { c1: 0xa8865e, c2: 0x80623e, p: [6.5, 0, 0, 0] }),
  plankGrey: () => mat('wood', { c1: 0xa89e8e, c2: 0x80786a, p: [7, 0, 0, 0] }),
  timber: () => mat('wood', { c1: 0x6e4c2e, c2: 0x3e2a18, p: [4.5, 0, 0, 0] }),
  teak: () => mat('wood', { c1: 0xa0703e, c2: 0x62401e, p: [5, 0, 0, 0] }),
  barnRed: () => mat('wood', { c1: 0x9a4430, c2: 0x7a3020, p: [6, 0, 0, 0] }),
  barnOld: () => mat('wood', { c1: 0x8a7a68, c2: 0x665648, p: [6.5, 0, 0, 0] }),
  sage: () => mat('matte', { c1: 0x93b09c, c2: 0xa8c4b0, p: [0.62, 3, 0, 0] }),
  walk: () => mat('stone', { c1: 0x9a9284, c2: 0x625c52, c3: 0x5a6a3a, p: [2.5, 0.1, 0.3, 0] }),
  white: () => mat('matte', { c1: 0xe8e3d6, c2: 0xf7f4ec, p: [0.55, 3.5, 0, 0] }),
  trim: () => mat('matte', { c1: 0xfaf8f2, p: [0.4, 0, 0, 0] }),
  green: () => mat('wood', { c1: 0x3a5e4c, c2: 0x2e4c3e, p: [5, 0, 0, 0] }),
  redTile: () => mat('tile', { c1: 0x9a3422, c2: 0x842a1c, c3: 0xae4430, p: [0.26, 0.03, 0.55, 0] }),
  shingle: () => mat('tile', { c1: 0x5e544a, c2: 0x4a423a, c3: 0x6e6254, p: [0.3, 0.035, 0.6, 0] }),
  stone: () => mat('stone', { c1: 0xc4bcaa, c2: 0x8e8676, c3: 0x5a6a3a, p: [1.6, 0.1, 0.15, 0] }),
  coral: () => mat('stone', { c1: 0xd8d0bc, c2: 0xa89c86, c3: 0x6a7a4a, p: [2.2, 0.05, 0.1, 0] }),
  iron: () => mat('matte', { c1: 0xf4f2ec, p: [0.32, 0, 0.3, 0] }),
  blackIron: () => mat('metal', { c1: 0x2a2826, c2: 0x141312, p: [0.45, 0.2, 0, 0] }),
  bronze: () => mat('gold', { c1: 0xb0803e, c2: 0xffe0a0, p: [0.2, 0.25, 0, 0] }),
  brass: () => mat('gold', { c1: 0xd8b060, c2: 0xffffff, p: [0.2, 0.15, 0, 0] }),
  redVelvet: () => mat('fabric', { c1: 0x9a1a26, c2: 0x5a0a12, p: [1.1, 0.9, 0, 0.6] }),
  rope: () => mat('bark', { c1: 0xc8b488, c2: 0x8a7650, p: [30, 40, 0.4, 0] }),
  dark: () => mat('matte', { c1: 0x17120d, p: [0.95, 0, 0, 0] }),
};

const GLASS = new Map();
/** A pane of window glass: a reflective sheet over the room behind (see windowUnit). */
export function glassMat(night, warm = 0xffc070) {
  const k = `${night}|${warm}`;
  if (!GLASS.has(k)) {
    GLASS.set(k, new THREE.MeshStandardMaterial({ color: night ? 0x8a7a60 : 0x6a8090, roughness: 0.04, metalness: 0.7, transparent: true, opacity: night ? 0.12 : 0.42, depthWrite: false }));
  }
  return GLASS.get(k);
}

// ---------------------------------------------------------------- geometry utils

const CACHE = new Map();
export function cached(key, make) {
  if (!CACHE.has(key)) CACHE.set(key, make());
  return CACHE.get(key);
}

const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
/** A transformed copy of a geometry, for merging. */
export function bake(geo, pos = [0, 0, 0], rot = [0, 0, 0], scale = 1) {
  const g = geo.clone();
  _e.set(rot[0], rot[1], rot[2]);
  _q.setFromEuler(_e);
  const s = Array.isArray(scale) ? scale : [scale, scale, scale];
  _m4.compose(_v.set(pos[0], pos[1], pos[2]), _q, _s.set(s[0], s[1], s[2]));
  g.applyMatrix4(_m4);
  return g;
}

/**
 * A box with chamfered edges (44 triangles, flat-shaded facets), centred on
 * the origin: the cheap bevel for boards, beams and trim.
 */
export function chamferBoxGeo(w, h, d, c) {
  const hx = w / 2;
  const hy = h / 2;
  const hz = d / 2;
  const P = (sx, sy, sz, axis) => [sx * (axis === 0 ? hx : hx - c), sy * (axis === 1 ? hy : hy - c), sz * (axis === 2 ? hz : hz - c)];
  const pos = [];
  const quad = (a, b, cc, e) => { tri(a, b, cc); tri(a, cc, e); };
  const tri = (a, b, cc) => {
    // wind outward: the normal must point away from the centre
    const ux = b[0] - a[0]; const uy = b[1] - a[1]; const uz = b[2] - a[2];
    const vx = cc[0] - a[0]; const vy = cc[1] - a[1]; const vz = cc[2] - a[2];
    const nx = uy * vz - uz * vy; const ny = uz * vx - ux * vz; const nz = ux * vy - uy * vx;
    const out = nx * (a[0] + b[0] + cc[0]) + ny * (a[1] + b[1] + cc[1]) + nz * (a[2] + b[2] + cc[2]) > 0;
    if (out) pos.push(...a, ...b, ...cc); else pos.push(...a, ...cc, ...b);
  };
  const S = [-1, 1];
  // the six faces
  for (const s of S) {
    quad(P(s, -1, -1, 0), P(s, 1, -1, 0), P(s, 1, 1, 0), P(s, -1, 1, 0));
    quad(P(-1, s, -1, 1), P(1, s, -1, 1), P(1, s, 1, 1), P(-1, s, 1, 1));
    quad(P(-1, -1, s, 2), P(1, -1, s, 2), P(1, 1, s, 2), P(-1, 1, s, 2));
  }
  // the twelve chamfers
  for (const a of S) for (const b of S) {
    quad(P(-1, a, b, 1), P(1, a, b, 1), P(1, a, b, 2), P(-1, a, b, 2));
    quad(P(a, -1, b, 0), P(a, 1, b, 0), P(a, 1, b, 2), P(a, -1, b, 2));
    quad(P(a, b, -1, 0), P(a, b, 1, 0), P(a, b, 1, 1), P(a, b, -1, 1));
  }
  // the eight corners
  for (const x of S) for (const y of S) for (const z of S) tri(P(x, y, z, 0), P(x, y, z, 1), P(x, y, z, 2));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/** A bevelled beam, centred on the origin (a chamfer; seg > 1: rounded edges). */
export function beamGeo(w, h, d, r = 0.015, seg = 1) {
  const rr = Math.max(0.002, Math.min(r, w / 2.2, h / 2.2, d / 2.2));
  return seg > 1 ? roundedBoxGeo(w, h, d, rr, seg, 1) : chamferBoxGeo(w, h, d, rr);
}

/** A plain box (12 triangles) for small hidden-edge parts: louvres, slats, spindles. */
export const slatGeo = (w, h, d) => new THREE.BoxGeometry(w, h, d);

/** Merges parts [[geo, pos, rot, scale], ...] into one mesh. */
export function assemble(parts, material, o = {}) {
  return mesh(merge(parts.map(([g, p, r, s]) => bake(g, p, r, s))), material, o);
}

/** A post of height h standing on y = 0, square w with chamfered edges, grain running up it. */
export function postGeo(h, w = 0.14, r = 0.02) {
  // built lying along x (the wood shader's grain axis), then stood up
  return bake(beamGeo(h, w, w, r), [0, h / 2, 0], [0, 0, Math.PI / 2]);
}

const rand = (seed) => {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
};

// ---------------------------------------------------------------- walls, decks, openings

function cut(segs, lo, hi) {
  return segs.flatMap(([a, b]) => (hi <= a || lo >= b) ? [[a, b]] : [[a, lo], [hi, b]].filter(([c, d]) => d - c > 0.03));
}

/**
 * A board wall w × h in the local XY plane, facing +z, base at y = 0,
 * centred on x, with rectangular holes [{x0, x1, y0, y1}]. Horizontal
 * weatherboards overlap and tilt; vertical boards get battens on the joints
 * (their grain runs up the boards). `top(x)` optionally limits the height
 * (gable ends). Returns an Object3D.
 */
export function boardWall(w, h, material, { holes = [], board = 0.2, depth = 0.035, vertical = false, seed = 1, top = null, battens = true, gap = 0.006 } = {}) {
  const rnd = rand(seed);
  const parts = [];
  if (!vertical) {
    const rows = Math.ceil(h / board);
    for (let i = 0; i < rows; i++) {
      const y0 = i * board;
      const y1 = Math.min(h, y0 + board + 0.025);
      let segs = [[-w / 2, w / 2]];
      if (top) {
        // gable: the row spans where the roof line is above it
        const span = top(y1);
        segs = [[-span, span]];
      }
      for (const o of holes) if (!(y1 <= o.y0 || y0 >= o.y1)) segs = cut(segs, o.x0, o.x1);
      for (const [a, b] of segs) {
        if (b - a < 0.04) continue;
        parts.push(bake(beamGeo(b - a, y1 - y0, depth, 0.008), [(a + b) / 2, (y0 + y1) / 2, depth / 2 + (rnd() - 0.5) * 0.004], [-0.07, 0, 0]));
      }
    }
    return mesh(merge(parts), material);
  }
  // vertical boards, built along x (grain) then turned upright: geometry (u, v) = (y, -x)
  const cols = Math.ceil(w / board);
  for (let i = 0; i < cols; i++) {
    const x0 = -w / 2 + i * board;
    const x1 = Math.min(w / 2, x0 + board - gap);
    const xc = (x0 + x1) / 2;
    let segs = [[0, top ? top(Math.abs(xc)) : h]];
    for (const o of holes) if (!(x1 <= o.x0 || x0 >= o.x1)) segs = cut(segs, o.y0, o.y1);
    for (const [a, b] of segs) {
      const len = b - a + (rnd() - 0.5) * 0.02;
      parts.push(bake(beamGeo(len, x1 - x0, depth, 0.006), [(a + b) / 2, -xc, depth / 2]));
      if (battens && i > 0) parts.push(bake(beamGeo(len, 0.055, 0.022, 0.006), [(a + b) / 2, -x0, depth + 0.011]));
    }
  }
  const g = new THREE.Group();
  g.add(mesh(merge(parts), material, { rot: [0, 0, Math.PI / 2] }));
  return g;
}

/** A plank deck w (across x) × d (from z = 0 toward +z), top at y = 0, with gaps and a little unevenness. */
export function deckGeo(w, d, { plank = 0.15, gap = 0.012, thick = 0.045, seed = 1 } = {}) {
  const rnd = rand(seed);
  const parts = [];
  const n = Math.max(1, Math.floor(d / (plank + gap)));
  for (let i = 0; i < n; i++) {
    const z = (i + 0.5) * (plank + gap);
    parts.push(bake(beamGeo(w + (rnd() - 0.5) * 0.05, thick, plank, 0.008), [(rnd() - 0.5) * 0.03, -thick / 2 + (rnd() - 0.5) * 0.006, z], [0, (rnd() - 0.5) * 0.01, (rnd() - 0.5) * 0.008]));
  }
  return merge(parts);
}

/** Dark (day) or lamp-lit (night) room depth behind an opening: an open box seen from inside. */
export function insideBox(w, h, d, night, warm = 0xffb060) {
  const mats = night
    ? [glowMat(warm, 0.3, { side: THREE.BackSide }), glowMat(warm, 0.3, { side: THREE.BackSide }), glowMat(warm, 0.18, { side: THREE.BackSide }),
      glowMat(warm, 0.45, { side: THREE.BackSide }), glowMat(warm, 0.8, { side: THREE.BackSide }), glowMat(warm, 0.62, { side: THREE.BackSide })]
    : new Array(6).fill(mat('matte', { c1: 0x3a2e22, c2: 0x2a2018, p: [0.95, 2, 0, 0], side: THREE.BackSide }));
  return mesh(new THREE.BoxGeometry(w, h, d), mats, { pos: [0, h / 2, -d / 2], shadow: false });
}

/**
 * A framed window: casing, sill, glass (lamplit at night), glazing bars
 * and, optionally, open louvred shutters. XY plane facing +z, centred.
 * open: 0 closed .. 1 folded back flat against the wall.
 */
export function windowUnit({ w = 1.0, h = 1.4, night = false, shutters = true, open = 0.9, bars = [1, 1], frame = IM.trim(), shutterM = IM.green(), warm = 0xffc070, head = false, low = false } = {}) {
  const g = new THREE.Group();
  const t = 0.1;
  const parts = [
    [beamGeo(w + 2 * t, t, 0.06), [0, h / 2 + t / 2, 0.035]],
    [beamGeo(w + 2 * t + 0.1, 0.06, 0.16), [0, -h / 2 - 0.03, 0.07]],
    [beamGeo(t, h, 0.06), [-w / 2 - t / 2, 0, 0.035]],
    [beamGeo(t, h, 0.06), [w / 2 + t / 2, 0, 0.035]],
  ];
  if (head) {
    // a little cornice over the window
    parts.push([beamGeo(w + 2 * t + 0.16, 0.05, 0.14), [0, h / 2 + t + 0.03, 0.07]]);
    parts.push([beamGeo(w + 2 * t + 0.06, 0.08, 0.09), [0, h / 2 + t + 0.1, 0.05]]);
    parts.push([beamGeo(w + 2 * t + 0.22, 0.04, 0.17), [0, h / 2 + t + 0.16, 0.08]]);
  }
  const [bc, br] = bars;
  for (let i = 1; i <= bc; i++) parts.push([beamGeo(0.03, h, 0.035), [-w / 2 + (i * w) / (bc + 1), 0, 0.02]]);
  for (let i = 1; i <= br; i++) parts.push([beamGeo(w, 0.03, 0.035), [0, -h / 2 + (i * h) / (br + 1), 0.02]]);
  g.add(assemble(parts, frame));
  // the room behind: a shallow reveal box (lamplit at night), curtains, then a pane of glass
  const inner = mat('matte', { c1: 0xe8e2d4, p: [0.7, 0, 0, 0], side: THREE.BackSide });
  const back = night ? glowMat(warm, 0.42, { side: THREE.BackSide }) : mat('matte', { c1: 0x1e1812, c2: 0x2a2219, p: [0.9, 2, 0, 0], side: THREE.BackSide });
  g.add(mesh(cached(`reveal|${w}|${h}`, () => new THREE.BoxGeometry(w, h, 0.16)), [inner, inner, inner, inner, inner, back], { pos: [0, 0, -0.08], shadow: false }));
  if (!low) {
    const cw = w * 0.26;
    const cg = cached(`curtain|${cw}|${h}`, () => {
      const c = new THREE.PlaneGeometry(cw, h - 0.04, 10, 1);
      const p = c.attributes.position;
      for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin((p.getX(i) / cw + 0.5) * Math.PI * 5) * 0.018);
      c.computeVertexNormals();
      return c;
    });
    const cm = mat('fabric', { c1: night ? 0xf0d8a8 : 0xe8dcc4, c2: 0xc8b898, p: [1.2, 0.1, 0, 1], side: THREE.DoubleSide });
    for (const s of [-1, 1]) g.add(mesh(cg, cm, { pos: [s * (w / 2 - cw / 2), 0, -0.07], shadow: false }));
  }
  g.add(mesh(cached(`pane|${w}|${h}`, () => new THREE.PlaneGeometry(w, h)), glassMat(night, warm), { pos: [0, 0, 0.004], shadow: false }));
  if (shutters) {
    const sw = w / 2 + 0.04;
    const key = `shutter|${sw}|${h}|${low}`;
    const leafGeo = cached(key, () => {
      const p = [bake(beamGeo(0.06, h, 0.035), [-sw / 2 + 0.03, 0, 0]), bake(beamGeo(0.06, h, 0.035), [sw / 2 - 0.03, 0, 0]),
        bake(beamGeo(sw, 0.07, 0.035), [0, h / 2 - 0.035, 0]), bake(beamGeo(sw, 0.07, 0.035), [0, -h / 2 + 0.035, 0]), bake(beamGeo(sw, 0.06, 0.03), [0, 0, 0])];
      if (!low) for (let y = -h / 2 + 0.1; y < h / 2 - 0.08; y += 0.065) if (Math.abs(y) > 0.05) p.push(bake(slatGeo(sw - 0.1, 0.05, 0.012), [0, y, 0], [-0.6, 0, 0]));
      else p.push(bake(beamGeo(sw - 0.1, h - 0.14, 0.012, 0.004), [0, 0, -0.005]));
      return merge(p);
    });
    for (const s of [-1, 1]) {
      const hinge = new THREE.Group();
      hinge.position.set(s * (w / 2 + t), 0, 0.075);
      hinge.rotation.y = s * open * Math.PI * 0.97;
      hinge.add(mesh(leafGeo, shutterM, { pos: [-s * sw / 2, 0, 0] }));
      g.add(hinge);
    }
  }
  return g;
}

/**
 * A door in its frame: casing and a panelled leaf hinged on the left,
 * opening inward (open 0..1), with an inside box behind it (dark by day,
 * lamplit at night). Base at y = 0, facing +z.
 */
export function doorUnit({ w = 0.95, h = 2.1, open = 0, frame = IM.trim(), leafM = null, night = false, warm = 0xffb060, glassTop = false, depth = 1.6, inside = true } = {}) {
  const g = new THREE.Group();
  const t = 0.11;
  g.add(assemble([
    [beamGeo(w + 2 * t + 0.08, t, 0.08), [0, h + t / 2, 0.045]],
    [beamGeo(w + 2 * t + 0.16, 0.05, 0.12), [0, h + t + 0.025, 0.06]],
    [postGeo(h, t, 0.015), [-w / 2 - t / 2, 0, 0.045]],
    [postGeo(h, t, 0.015), [w / 2 + t / 2, 0, 0.045]],
    [beamGeo(w + 2 * t, 0.04, 0.2), [0, 0.02, 0.06]],
  ], frame));
  const lm = leafM || mat('wood', { c1: 0x6e3c1e, c2: 0x4e2a14, p: [6, 0, 0, 0] });
  const lw = w - 0.02;
  const leaf = [[postGeo(h - 0.02, 0.045, 0.006), [lw / 2, 0.01, 0], [0, 0, 0], [lw / 0.045, 1, 1]]];
  const panels = glassTop ? [[h * 0.27, h * 0.34]] : [[h * 0.27, h * 0.34], [h * 0.71, h * 0.4]];
  for (const [py, ph] of panels) {
    leaf.push([beamGeo(lw * 0.34, ph, 0.02, 0.012), [lw * 0.29, py, 0.028]]);
    leaf.push([beamGeo(lw * 0.34, ph, 0.02, 0.012), [lw * 0.71, py, 0.028]]);
  }
  const hinge = new THREE.Group();
  hinge.position.set(-w / 2, 0, -0.03);
  hinge.rotation.y = open * Math.PI * 0.5;
  hinge.add(assemble(leaf, lm));
  if (glassTop) hinge.add(mesh(new THREE.PlaneGeometry(lw * 0.7, h * 0.3), glassMat(night, warm), { pos: [lw / 2, h * 0.72, 0.024], shadow: false }));
  hinge.add(mesh(latheGeo([[0, 0], [0.022, 0], [0.018, 0.02], [0.03, 0.04], [0.02, 0.06], [0, 0.062]], 12), IM.brass(), { pos: [lw - 0.08, h * 0.47, 0.02], rot: [Math.PI / 2, 0, 0], shadow: false }));
  g.add(hinge);
  if (inside) g.add(insideBox(w + 1.2, h + 0.4, depth, night, warm));
  return g;
}

const BALUSTER = [[0, 0], [0.03, 0], [0.03, 0.05], [0.02, 0.09], [0.026, 0.2], [0.033, 0.33], [0.02, 0.48], [0.017, 0.6], [0.026, 0.65], [0.026, 0.72], [0, 0.72]];
/** A railing of length len along x, centred, base y = 0: posts, rails, balusters (turned, or square when low). */
export function railingGeo(len, { h = 0.9, spacing = 0.13, post = 0.1, turned = true, gap = null } = {}) {
  const parts = [];
  const nPost = Math.max(2, Math.round(len / 2.2) + 1);
  for (let i = 0; i < nPost; i++) parts.push(bake(postGeo(h + 0.1, post, 0.015), [-len / 2 + (i * len) / (nPost - 1), 0, 0]));
  const k = (h - 0.16) / 0.72;
  const bal = turned ? cached('baluster', () => weldNormals(latheGeo(BALUSTER, 8))) : null;
  const spans = gap ? [[-len / 2, gap[0]], [gap[1], len / 2]] : [[-len / 2, len / 2]];
  for (const [a, b] of spans) {
    if (b - a < 0.2) continue;
    parts.push(bake(beamGeo(b - a, 0.06, 0.11, 0.02), [(a + b) / 2, h, 0]));
    parts.push(bake(beamGeo(b - a, 0.05, 0.07, 0.012), [(a + b) / 2, 0.11, 0]));
    for (let x = a + spacing; x < b - spacing * 0.5; x += spacing) {
      parts.push(turned ? bake(bal, [x, 0.135, 0], [0, 0, 0], [1, k, 1]) : bake(postGeo(h - 0.17, 0.035, 0.006), [x, 0.135, 0]));
    }
  }
  return merge(parts);
}

/** Steps: n treads rising toward -z from y = 0 at z = 0, width w. */
export function stepsGeo(w, n, { rise = 0.17, going = 0.3, nose = 0.035 } = {}) {
  const parts = [];
  for (let i = 0; i < n; i++) parts.push(bake(beamGeo(w, rise * (i + 1), going + nose, 0.012), [0, rise * (i + 1) / 2, -(i + 0.5) * going + nose / 2]));
  return merge(parts);
}

// ---------------------------------------------------------------- roofs

/**
 * Thatch: a roof of revolution with eave radius R and apex H above the eave
 * line, laid in `courses` (each course's butt edge hangs over the next), a
 * thick eave and a ragged fringe. square: a pyramid hip (then scale x/z of
 * the mesh for a rectangle). Eave line at y = 0.
 */
export function thatchGeo(R, H, { square = false, courses = 3, eave = 0.3, fringe = 0.16, seed = 1, seg = 64, thick = 0.32 } = {}) {
  return cached(`thatch|${R}|${H}|${square}|${courses}|${eave}|${fringe}|${seed}|${seg}`, () => {
    const yAt = (r) => H * (1 - r / R);
    const pts = [];
    const kind = []; // 1: the eave's butt edge, 2 + k: course k's butt edge
    const add = (r, y, k = 0) => { pts.push([r, y]); kind.push(k); };
    // underside (seen from below the eaves), parallel to the top
    add(0, H - thick * 1.4);
    add(R * 0.5, yAt(R * 0.5) - thick);
    add(R - 0.3, -eave + 0.04, 1);
    // the eave's butt edge
    add(R - 0.06, -eave, 1);
    add(R + 0.02, -eave * 0.45, 1);
    add(R + 0.05, 0.03);
    // courses, bottom to top: each butt edge hangs over the course below
    for (let k = courses - 1; k >= 1; k--) {
      const rk = (R * k) / courses;
      const yk = yAt(rk);
      add(rk + 0.02, yk - 0.04);
      add(rk + 0.11, yk - 0.15, 2 + k);
      add(rk + 0.09, yk - 0.03, 2 + k);
      add(rk + 0.02, yk + 0.05);
    }
    add(0.16, yAt(0.16));
    add(0.05, H + 0.02);
    add(0, H + 0.04);
    const g = latheGeo(pts, seg);
    const p = g.attributes.position;
    const P = pts.length;
    const h = (a) => { const x = Math.sin(a * 91.7 + seed * 13.1) * 43758.5453; return x - Math.floor(x); };
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i);
      let z = p.getZ(i);
      const y = p.getY(i);
      if (square) {
        const a = Math.atan2(z, x);
        const k = 1 / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)));
        x *= k; z *= k;
      }
      // butt edges hang unevenly: the eave most, each course a little
      const col = Math.floor(i / P) % seg;
      const kd = kind[i % P];
      const dy = kd === 1 ? -fringe * (0.15 + 0.85 * h(col)) : kd >= 2 ? -fringe * 0.45 * h(col * 1.7 + kd * 5.3) : 0;
      p.setXYZ(i, x, y + dy, z);
    }
    g.computeVertexNormals();
    return g;
  });
}

/**
 * A lean-to thatch slab w (along x) × d (down the slope, from z = 0 at the
 * top to z = d at the eave), top surface at y = 0, thickness t, ragged eave.
 * Tilt it with rotation.x.
 */
export function thatchSlabGeo(w, d, { t = 0.26, fringe = 0.12, seed = 1 } = {}) {
  return cached(`slab|${w}|${d}|${t}|${fringe}|${seed}`, () => {
    const nx = Math.max(4, Math.round(w / 0.14));
    const prof = [[0, 0], [0, d], [-0.1, d + 0.04], [-t, d - 0.02], [-t, 0.05]]; // [y, z]
    const pos = [];
    const idx = [];
    const h = (i) => { const x = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453; return x - Math.floor(x); };
    for (let i = 0; i <= nx; i++) {
      const x = -w / 2 + (w * i) / nx;
      const j = h(i);
      for (let k = 0; k < prof.length; k++) {
        const [y, z] = prof[k];
        const drop = k >= 1 && k <= 3 ? fringe * (0.2 + 0.8 * j) * (k === 1 ? 0.3 : 1) : 0;
        pos.push(x, y - drop, z + (k === 2 ? j * 0.05 : 0));
      }
    }
    const P = prof.length;
    for (let i = 0; i < nx; i++) {
      for (let k = 0; k < P; k++) {
        const a = i * P + k;
        const b = i * P + ((k + 1) % P);
        const c = (i + 1) * P + k;
        const e = (i + 1) * P + ((k + 1) % P);
        idx.push(a, c, b, b, c, e);
      }
    }
    // end caps
    for (const i of [0, nx]) {
      const base = i * P;
      for (let k = 1; k < P - 1; k++) i === 0 ? idx.push(base, base + k, base + k + 1) : idx.push(base, base + k + 1, base + k);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  });
}

/**
 * A gable roof over W (x) × L (z) with the ridge along z at height H above
 * the eave line (y = 0 at the wall line), two slabs of thickness t with
 * overhangs, optionally sagging in the middle (an old roof).
 */
export function gableRoofGeo(W, L, H, { overhang = 0.45, t = 0.12, sag = 0, ridge = true } = {}) {
  return cached(`gable|${W}|${L}|${H}|${overhang}|${t}|${sag}`, () => {
    const run = W / 2;
    const pitch = Math.atan2(H, run);
    const slope = Math.hypot(run, H) + overhang / Math.cos(pitch);
    const Lt = L + overhang * 2;
    const parts = [];
    for (const s of [-1, 1]) {
      // slab centred on its slope line; top face on the roof line
      const cx = s * (slope / 2) * Math.cos(pitch);
      const cy = H - (slope / 2) * Math.sin(pitch);
      const g = roundedBoxGeo(slope, t, Lt, 0.02, 1, sag ? 10 : 1);
      parts.push(bake(g, [cx - s * Math.sin(pitch) * t / 2, cy - Math.cos(pitch) * t / 2, 0], [0, 0, -s * pitch]));
    }
    if (ridge) parts.push(bake(roundedBoxGeo(0.2, 0.14, Lt + 0.04, 0.06, 2, 1), [0, H + 0.02, 0]));
    const g = merge(parts);
    if (sag) {
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const z = p.getZ(i) / (Lt / 2);
        const up = Math.max(0, p.getY(i)) / H;
        p.setY(i, p.getY(i) - sag * (1 - z * z) * (0.35 + 0.65 * up));
      }
      g.computeVertexNormals();
    }
    return g;
  });
}

/** A hipped roof over W × D (eaves at y = 0) with its ridge along x at height H: a closed slab. */
export function hipRoofGeo(W, D, H, { t = 0.14 } = {}) {
  return cached(`hip|${W}|${D}|${H}|${t}`, () => {
    const hw = W / 2;
    const hd = D / 2;
    const rl = Math.max(0, hw - hd);
    const v = [[-hw, 0, hd], [hw, 0, hd], [hw, 0, -hd], [-hw, 0, -hd], [-rl, H, 0], [rl, H, 0]];
    const faces = [[0, 1, 5, 4], [1, 2, 5], [2, 3, 4, 5], [3, 0, 4]];
    const pos = [];
    const tri = (a, b, c, dy = 0) => { for (const q of [a, b, c]) pos.push(q[0], q[1] + dy, q[2]); };
    for (const f of faces) {
      const q = f.map((i) => v[i]);
      tri(q[0], q[1], q[2]);
      if (q.length === 4) tri(q[0], q[2], q[3]);
      tri(q[2], q[1], q[0], -t);
      if (q.length === 4) tri(q[3], q[2], q[0], -t);
    }
    for (let i = 0; i < 4; i++) {
      const a = v[i];
      const b = v[(i + 1) % 4];
      tri(a, [a[0], a[1] - t, a[2]], b);
      tri(b, [a[0], a[1] - t, a[2]], [b[0], b[1] - t, b[2]]);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    return g;
  });
}

/** The gambrel (barn) roof: a profile across x extruded along z, knee at h1, ridge at h2, length L, centred. */
export function gambrelGeo(W, h1, h2, L, { overhang = 0.4, t = 0.14 } = {}) {
  return cached(`gambrel|${W}|${h1}|${h2}|${L}|${overhang}`, () => {
    const hw = W / 2 + overhang;
    const knee = W * 0.3;
    const drop = overhang * (h1 / (W / 2 - knee));
    const s = new THREE.Shape();
    s.moveTo(-hw, -drop);
    s.lineTo(-knee, h1);
    s.lineTo(0, h2);
    s.lineTo(knee, h1);
    s.lineTo(hw, -drop);
    s.lineTo(hw - t * 0.8, -drop - t * 0.5);
    s.lineTo(knee - t * 0.3, h1 - t);
    s.lineTo(0, h2 - t);
    s.lineTo(-knee + t * 0.3, h1 - t);
    s.lineTo(-hw + t * 0.8, -drop - t * 0.5);
    s.closePath();
    const Lt = L + overhang * 2;
    const g = new THREE.ExtrudeGeometry(s, { depth: Lt, bevelEnabled: false });
    g.translate(0, 0, -Lt / 2);
    g.computeVertexNormals();
    return g;
  });
}

/** The outline height of a gambrel end wall at |x|. */
export function gambrelTop(W, h1, h2) {
  const knee = W * 0.3;
  return (ax) => (ax <= knee ? h2 - (h2 - h1) * (ax / knee) : h1 * (1 - (ax - knee) / (W / 2 - knee)) + 0.001);
}

/**
 * A carved bargeboard of length len (along x from 0), depth w below its top
 * edge, with a scalloped lower edge and pierced quatrefoils (the cottage's
 * "carved" boards). XY plane, facing +z, thickness 0.05.
 */
export function bargeboardGeo(len, { w = 0.34, every = 0.5, pierce = true } = {}) {
  return cached(`barge|${len}|${w}|${every}|${pierce}`, () => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(len, 0);
    s.lineTo(len, -w * 0.55);
    const n = Math.max(1, Math.round(len / every));
    const step = len / n;
    for (let i = n; i > 0; i--) {
      const x1 = i * step;
      const x0 = x1 - step;
      // a scallop: down to a point between two arcs
      s.quadraticCurveTo(x1 - step * 0.25, -w * 1.02, (x0 + x1) / 2, -w * 0.72);
      s.quadraticCurveTo(x0 + step * 0.25, -w * 1.02, x0, -w * 0.55);
    }
    s.lineTo(0, 0);
    if (pierce) {
      for (let i = 0; i < n; i++) {
        const cx = (i + 0.5) * step;
        const cy = -w * 0.38;
        const hole = new THREE.Path();
        const m = 28;
        for (let k = 0; k <= m; k++) {
          const a = -(k / m) * Math.PI * 2;
          const r = w * (0.13 + 0.07 * Math.abs(Math.cos(2 * a)));
          k ? hole.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r) : hole.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        }
        s.holes.push(hole);
      }
    }
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 1, curveSegments: 6 });
    g.computeVertexNormals();
    return g;
  });
}

/** A turned finial / pendant (lathe), height h, base at y = 0. */
export function finialGeo(h = 0.9, r = 0.09) {
  return cached(`finial|${h}|${r}`, () => weldNormals(latheGeo([[0, 0], [r, 0], [r, h * 0.08], [r * 0.6, h * 0.14], [r * 1.1, h * 0.3], [r * 0.9, h * 0.42],
    [r * 0.45, h * 0.5], [r * 0.5, h * 0.62], [r * 0.95, h * 0.72], [r * 0.4, h * 0.86], [r * 0.18, h * 0.95], [0, h]], 16)));
}

/** A bamboo pole (lathe with node rings) of length len along +y, radius r. */
export function bambooGeo(len, r = 0.05, { nodes = 0.35, seg = 8 } = {}) {
  return cached(`bamboo|${len}|${r}|${nodes}|${seg}`, () => {
    const pts = [[0, 0], [r, 0]];
    for (let y = nodes; y < len - 0.05; y += nodes) pts.push([r, y - 0.03], [r * 1.14, y], [r, y + 0.03]);
    pts.push([r, len], [0, len]);
    return latheGeo(pts, seg);
  });
}
