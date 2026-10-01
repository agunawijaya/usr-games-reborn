// Island furniture and small things (style A, ADR-013): potted plants and
// ferns, rattan and rocking chairs, white wrought-iron garden furniture with
// velvet cushions, gas lamps and bug lights, park benches, tableware, and
// the furnishings of the island's rooms (appliances, dressers, desks,
// bars, stalls, tools). Built from model.js shapes; parts that share a
// material are merged.

import * as THREE from 'three';
import { mat, glowMat } from './materials.js';
import { mesh } from './geo.js';
import { latheGeo, cushionGeo, tubeGeo, roundedBoxGeo, weldNormals, drapeGeo, rbox } from './model.js';
import { palette, leg, knob } from './furnish.js';
import { merge } from './flora.js';
import { IM, cached, bake, beamGeo, assemble, postGeo } from './island-build.js';

// ---------------------------------------------------------------- plants

/** A leaf blade along +z from the origin (uv.x across, uv.y along), arching and drooping. */
export function bladeGeo(len, width, droop, segs = 8, twist = 0, arch = 0.12) {
  const g = new THREE.PlaneGeometry(width, len, 1, segs);
  g.translate(0, len / 2, 0);
  g.rotateX(-Math.PI / 2);
  g.rotateY(Math.PI);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i);
    const t = z / len;
    const x = p.getX(i);
    const y = p.getY(i) - droop * t * t * len + Math.sin(t * Math.PI) * len * arch;
    p.setX(i, x * Math.cos(twist * t));
    p.setY(i, y + x * Math.sin(twist * t));
  }
  g.computeVertexNormals();
  return g;
}

const LEAF = {
  fern: (night) => mat('leaf', { c1: night ? 0x163418 : 0x2e6a26, c2: night ? 0x1e401f : 0x4a8a30, c3: 0x8ac060, p: [0.95, 1.0, 0.06, 0], side: THREE.DoubleSide, alphaTest: 0.5, sway: 0.4 }),
  palm: (night) => mat('leaf', { c1: night ? 0x1a3a1c : 0x3a7a2c, c2: night ? 0x22461f : 0x5a943a, c3: 0x9ab860, p: [0.9, 1.0, 0.05, 0], side: THREE.DoubleSide, alphaTest: 0.5, sway: 0.3 }),
  broad: (night) => mat('leaf', { c1: night ? 0x163016 : 0x2a5e22, c2: night ? 0x1e3a1c : 0x3e7a2a, c3: 0x7aa050, p: [1.0, 0.0, 0.05, 0], side: THREE.DoubleSide, alphaTest: 0.5, sway: 0.2 }),
};

/** Fronds for a potted plant, merged: fern (arching fronds), palm (tall stems), broad (big leaves). */
function frondsGeo(kind, seed) {
  return cached(`fronds|${kind}|${seed}`, () => {
    const parts = [];
    let s = seed * 97 + 13;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    if (kind === 'fern') {
      for (let i = 0; i < 16; i++) {
        const b = bladeGeo(0.55 + rnd() * 0.3, 0.2, 0.9 + rnd() * 0.5, 8, 0.2);
        b.rotateX(-0.9 - rnd() * 0.5);
        b.rotateY((i / 16) * Math.PI * 2 + rnd() * 0.3);
        parts.push(b);
      }
    } else if (kind === 'palm') {
      for (let i = 0; i < 9; i++) {
        const b = bladeGeo(0.9 + rnd() * 0.4, 0.34, 0.5, 10, 0.4, 0.18);
        b.rotateX(-1.25 + rnd() * 0.35);
        b.rotateY((i / 9) * Math.PI * 2 + rnd() * 0.4);
        b.translate(0, 0.25 + rnd() * 0.35, 0);
        parts.push(b);
      }
    } else {
      for (let i = 0; i < 7; i++) {
        const b = bladeGeo(0.5 + rnd() * 0.2, 0.3, 0.4, 6, 0.3, 0.2);
        b.rotateX(-0.8 - rnd() * 0.4);
        b.rotateY((i / 7) * Math.PI * 2 + rnd() * 0.5);
        b.translate(0, 0.1 + rnd() * 0.2, 0);
        parts.push(b);
      }
    }
    return merge(parts);
  });
}

const POTS = {
  terracotta: () => mat('stone', { c1: 0xb0603e, c2: 0x8a4428, c3: 0x6a5a3a, p: [3, 0.05, 0.08, 0] }),
  glazed: () => mat('matte', { c1: 0x2e5a6a, c2: 0x3e7888, p: [0.2, 0.6, 0.1, 0] }),
  white: () => mat('matte', { c1: 0xefe8da, c2: 0xf6f2ea, p: [0.35, 0.6, 0, 0] }),
};
/** A plant in a pot: kind fern | palm | broad; pot terracotta | glazed | white; size scales it. */
export function pottedPlant({ kind = 'fern', pot = 'terracotta', size = 1, night = false, seed = 1 } = {}) {
  const g = new THREE.Group();
  const potGeo = cached('pot', () => weldNormals(latheGeo([[0, 0], [0.14, 0], [0.15, 0.02], [0.2, 0.3], [0.23, 0.32], [0.23, 0.37], [0.2, 0.37], [0.19, 0.33], [0, 0.33]], 20)));
  g.add(mesh(potGeo, POTS[pot]()));
  g.add(mesh(cached('soil', () => new THREE.CircleGeometry(0.19, 16).rotateX(-Math.PI / 2)), mat('stone', { c1: 0x3a2a1a, c2: 0x241810, p: [6, 0, 0, 0] }), { pos: [0, 0.325, 0], shadow: false }));
  const f = mesh(frondsGeo(kind, seed % 5), LEAF[kind](night), { pos: [0, 0.33, 0] });
  g.add(f);
  g.scale.setScalar(size);
  return g;
}

// ---------------------------------------------------------------- outdoor furniture

/** Thin ironwork: a tube along points with few sides. */
const scroll = (pts, r, radial = 5) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), Math.max(8, pts.length * 4), r, radial, false);

/** A white wrought-iron garden chair with a red velvet seat cushion, facing +z. */
export function wroughtChair({ cushion = IM.redVelvet(), low = false } = {}) {
  const g = new THREE.Group();
  const parts = [];
  const r = 0.011;
  for (const s of [-1, 1]) {
    // back leg sweeps up into the back upright; front leg curls at the foot
    parts.push(scroll([[s * 0.2, 0, -0.24], [s * 0.2, 0.2, -0.2], [s * 0.2, 0.44, -0.18], [s * 0.19, 0.7, -0.24], [s * 0.18, 0.92, -0.28]], r));
    parts.push(scroll([[s * 0.21, 0.02, 0.27], [s * 0.2, 0.05, 0.22], [s * 0.2, 0.25, 0.2], [s * 0.2, 0.44, 0.2]], r));
    // arm with a scroll end
    parts.push(scroll([[s * 0.19, 0.66, -0.22], [s * 0.21, 0.66, 0.0], [s * 0.21, 0.62, 0.18], [s * 0.21, 0.54, 0.22], [s * 0.21, 0.5, 0.17], [s * 0.21, 0.54, 0.13]], r * 0.9));
    parts.push(scroll([[s * 0.2, 0.25, -0.2], [s * 0.2, 0.22, 0.0], [s * 0.2, 0.25, 0.2]], r * 0.8));
  }
  // seat ring and back scrolls
  parts.push(scroll([[-0.2, 0.44, -0.18], [0, 0.45, -0.2], [0.2, 0.44, -0.18], [0.22, 0.44, 0.0], [0.2, 0.44, 0.2], [0, 0.44, 0.22], [-0.2, 0.44, 0.2], [-0.22, 0.44, 0], [-0.2, 0.44, -0.18]], r));
  parts.push(scroll([[-0.18, 0.92, -0.28], [0, 0.96, -0.3], [0.18, 0.92, -0.28]], r));
  if (!low) {
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * 0.11;
      const c = [];
      for (let k = 0; k <= 16; k++) {
        const t = k / 16;
        c.push([x + Math.sin(t * Math.PI * 3) * 0.035, 0.46 + t * 0.44, -0.19 - t * 0.09 + Math.cos(t * Math.PI * 3) * 0.01]);
      }
      parts.push(scroll(c, r * 0.7));
    }
  }
  g.add(mesh(merge(parts), IM.iron()));
  g.add(mesh(cached('seatCushion', () => cushionGeo(0.42, 0.07, 0.4, { r: 0.03, puff: 0.5, seg: 2, mid: 5 })), cushion, { pos: [0, 0.48, 0.01] }));
  g.add(mesh(cached('backCushion', () => cushionGeo(0.36, 0.05, 0.3, { r: 0.025, puff: 0.5, seg: 2, mid: 5 })), cushion, { pos: [0, 0.72, -0.24], rot: [Math.PI / 2 - 0.3, 0, 0] }));
  return g;
}

/** A small round white wrought-iron table with a pierced top. */
export function wroughtTable({ radius = 0.38, low = false } = {}) {
  const g = new THREE.Group();
  const parts = [];
  parts.push(latheGeo([[0, 0], [radius, 0], [radius + 0.01, 0.012], [radius, 0.024], [0, 0.024]], 36).translate(0, 0.72, 0));
  parts.push(latheGeo([[0, 0], [0.03, 0], [0.024, 0.1], [0.018, 0.5], [0.03, 0.6], [0.02, 0.7], [0, 0.72]], 12));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    parts.push(scroll([[0, 0.14, 0], [c * 0.12, 0.1, s * 0.12], [c * 0.26, 0.04, s * 0.26], [c * 0.3, 0.01, s * 0.3], [c * 0.27, 0.035, s * 0.27]], 0.012));
    if (!low) parts.push(scroll([[0, 0.62, 0], [c * 0.14, 0.64, s * 0.14], [c * (radius - 0.04), 0.71, s * (radius - 0.04)]], 0.009));
  }
  g.add(mesh(merge(parts), IM.iron()));
  return g;
}

/** A rocking chair of bentwood and cane, facing +z. */
export function rockingChair() {
  const g = new THREE.Group();
  const wood = IM.teak();
  const parts = [];
  for (const s of [-1, 1]) {
    const rock = [];
    for (let k = 0; k <= 12; k++) {
      const t = k / 12;
      const z = -0.42 + t * 0.9;
      rock.push([s * 0.24, 0.02 + 0.5 * (z - 0.05) * (z - 0.05), z]);
    }
    parts.push(tubeGeo(rock, 0.018, 24));
    parts.push(tubeGeo([[s * 0.24, 0.05, -0.2], [s * 0.23, 0.42, -0.2], [s * 0.22, 0.8, -0.32], [s * 0.2, 1.08, -0.4]], 0.018, 16));
    parts.push(tubeGeo([[s * 0.24, 0.06, 0.24], [s * 0.24, 0.42, 0.22], [s * 0.25, 0.64, 0.22]], 0.018, 10));
    parts.push(tubeGeo([[s * 0.23, 0.64, -0.26], [s * 0.26, 0.66, 0.02], [s * 0.26, 0.64, 0.3]], 0.016, 12));
  }
  parts.push(tubeGeo([[-0.2, 1.08, -0.4], [0, 1.12, -0.42], [0.2, 1.08, -0.4]], 0.018, 10));
  parts.push(bake(beamGeo(0.48, 0.03, 0.05), [0, 0.42, 0.22]));
  parts.push(bake(beamGeo(0.48, 0.03, 0.05), [0, 0.42, -0.2]));
  g.add(mesh(merge(parts), wood));
  const cane = mat('fabric', { c1: 0xd8c08a, c2: 0x9a7e4e, p: [0.6, 0, 0, 1] });
  g.add(mesh(cached('caneSeat', () => roundedBoxGeo(0.46, 0.02, 0.42, 0.008, 1, 1)), cane, { pos: [0, 0.43, 0.01] }));
  g.add(mesh(cached('caneBack', () => roundedBoxGeo(0.4, 0.5, 0.02, 0.008, 1, 1)), cane, { pos: [0, 0.8, -0.31], rot: [-0.3, 0, 0] }));
  g.add(mesh(cached('rockCushion', () => cushionGeo(0.42, 0.06, 0.4, { r: 0.03, puff: 0.5, seg: 2, mid: 5 })), mat('fabric', { c1: 0x3e6a8a, c2: 0x2a4a66, c3: 0xe8e0c8, p: [1.0, 0.2, 0.6, 1] }), { pos: [0, 0.45, 0.02] }));
  return g;
}

/** A park bench: cast-iron scroll ends and teak slats, 1.6 m, facing +z. */
export function parkBench({ len = 1.6 } = {}) {
  const g = new THREE.Group();
  const parts = [];
  for (const s of [-1, 1]) {
    const x = s * (len / 2 - 0.12);
    parts.push(scroll([[x, 0, 0.22], [x, 0.06, 0.2], [x, 0.3, 0.18], [x, 0.42, 0.2], [x, 0.58, 0.22], [x, 0.66, 0.18], [x, 0.6, 0.12], [x, 0.56, 0.16]], 0.02));
    parts.push(scroll([[x, 0, -0.26], [x, 0.2, -0.22], [x, 0.42, -0.2], [x, 0.66, -0.26], [x, 0.86, -0.32], [x, 0.9, -0.28]], 0.02));
    parts.push(scroll([[x, 0.4, 0.2], [x, 0.38, 0], [x, 0.4, -0.2]], 0.018));
    parts.push(scroll([[x, 0.62, -0.23], [x, 0.63, 0], [x, 0.62, 0.2]], 0.017));
  }
  g.add(mesh(merge(parts), IM.blackIron()));
  const slats = [];
  for (let i = 0; i < 5; i++) slats.push([beamGeo(len, 0.028, 0.07, 0.01), [0, 0.43, 0.17 - i * 0.085]]);
  for (let i = 0; i < 3; i++) slats.push([beamGeo(len, 0.07, 0.024, 0.01), [0, 0.54 + i * 0.12, -0.23 - i * 0.03], [-0.25, 0, 0]]);
  g.add(assemble(slats, IM.teak()));
  return g;
}

/** A gas lamp on a cast-iron post (lit at night). */
export function gasLamp({ night = false, h = 2.4 } = {}) {
  const g = new THREE.Group();
  const iron = IM.blackIron();
  g.add(mesh(cached('lampPost', () => weldNormals(latheGeo([[0, 0], [0.13, 0], [0.13, 0.05], [0.09, 0.1], [0.07, 0.3], [0.05, 0.36], [0.045, 1.9], [0.06, 1.95], [0.05, 2.0], [0.1, 2.05], [0.1, 2.08], [0, 2.08]], 16))), iron, { scale: [1, h / 2.4, 1] }));
  const top = h * (2.08 / 2.4);
  const cage = [];
  for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) cage.push(bake(beamGeo(0.014, 0.4, 0.014, 0.004), [x * 0.1, top + 0.22, z * 0.1], [0, 0, x * 0.1]));
  cage.push(latheGeo([[0, 0], [0.2, 0], [0.12, 0.1], [0.04, 0.16], [0.03, 0.22], [0, 0.24]], 4).rotateY(Math.PI / 4).translate(0, top + 0.42, 0));
  g.add(mesh(merge(cage), iron));
  const glass = night ? glowMat(0xffd9a0, 1.8) : mat('matte', { c1: 0xdde6e8, p: [0.08, 0, 0.2, 0], transparent: true, opacity: 0.55 });
  g.add(mesh(cached('lampGlass', () => new THREE.CylinderGeometry(0.12, 0.085, 0.36, 4, 1).rotateY(Math.PI / 4)), glass, { pos: [0, top + 0.21, 0], shadow: false }));
  if (night) g.add(mesh(cached('mantle', () => new THREE.SphereGeometry(0.035, 10, 8)), glowMat(0xfff0d0, 3), { pos: [0, top + 0.2, 0], shadow: false }));
  g.userData.lightY = top + 0.2;
  return g;
}

/** The porch's small yellow bug light: a wall bracket with a caged bulb. */
export function bugLight({ night = false } = {}) {
  const g = new THREE.Group();
  const brass = IM.brass();
  g.add(mesh(cached('bugBack', () => latheGeo([[0, 0], [0.07, 0], [0.075, 0.02], [0.05, 0.03], [0, 0.03]], 16).rotateX(Math.PI / 2)), brass));
  g.add(mesh(cached('bugArm', () => tubeGeo([[0, 0, 0.02], [0, 0.02, 0.1], [0, 0.0, 0.14]], 0.01, 8)), brass));
  const bulb = night ? glowMat(0xffd23a, 3.2) : mat('matte', { c1: 0xe8c850, p: [0.15, 0, 0, 0], transparent: true, opacity: 0.85 });
  g.add(mesh(cached('bugBulb', () => new THREE.SphereGeometry(0.05, 14, 10)), bulb, { pos: [0, -0.06, 0.14], scale: [1, 1.2, 1], shadow: false }));
  g.add(mesh(cached('bugCage', () => {
    const p = [];
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; p.push(tubeGeo([[Math.cos(a) * 0.055, -0.01, Math.sin(a) * 0.055], [Math.cos(a) * 0.065, -0.07, Math.sin(a) * 0.065], [0, -0.13, 0]], 0.004, 6)); }
    return merge(p).translate(0, 0, 0.14);
  }), brass));
  return g;
}

/**
 * The doormat: coir weave with a coiled snake worked into it — the
 * "Don't Tread on Me" of the text, shown by its emblem.
 */
export function doorMat() {
  const g = new THREE.Group();
  g.add(mesh(cached('matGeo', () => roundedBoxGeo(0.86, 0.018, 0.54, 0.008, 1, 1).translate(0, 0.009, 0)), mat('fabric', { c1: 0xb08a50, c2: 0x7a5a30, p: [0.5, 0, 0, 1] }), { shadow: false }));
  g.add(mesh(cached('matBorder', () => {
    const p = [];
    for (const [w, d, x, z] of [[0.86, 0.04, 0, 0.25], [0.86, 0.04, 0, -0.25], [0.04, 0.54, 0.41, 0], [0.04, 0.54, -0.41, 0]]) p.push(bake(roundedBoxGeo(w, 0.006, d, 0.002, 1, 1), [x, 0.021, z]));
    // the coiled snake: a flat spiral with a raised head
    const c = [];
    for (let k = 0; k <= 60; k++) { const t = k / 60; const a = t * Math.PI * 5; const rr = 0.03 + t * 0.12; c.push([Math.cos(a) * rr, 0.024, Math.sin(a) * rr * 0.8]); }
    c.push([0.16, 0.03, -0.02], [0.2, 0.034, -0.06]);
    p.push(tubeGeo(c, 0.009, 90));
    return merge(p);
  }), mat('fabric', { c1: 0x3a2a14, c2: 0x241808, p: [0.5, 0, 0, 1] }), { shadow: false }));
  return g;
}

// ---------------------------------------------------------------- tableware and food

const GLASS = () => new THREE.MeshStandardMaterial({ color: 0xe8f4f8, roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.35, depthWrite: false });
const glassM = () => cached('glassMat', GLASS);
export const TW = {
  plateGeo: () => cached('plate', () => latheGeo([[0, 0], [0.09, 0], [0.12, 0.012], [0.13, 0.018], [0.125, 0.02], [0.1, 0.012], [0, 0.008]], 24)),
  platterGeo: () => cached('platter', () => latheGeo([[0, 0], [0.18, 0], [0.24, 0.02], [0.25, 0.028], [0.24, 0.03], [0.17, 0.012], [0, 0.01]], 28)),
  bowlGeo: () => cached('bowl', () => weldNormals(latheGeo([[0, 0], [0.06, 0], [0.12, 0.05], [0.15, 0.09], [0.148, 0.095], [0.11, 0.055], [0, 0.03]], 24))),
  cocktailGeo: () => cached('cocktail', () => latheGeo([[0, 0], [0.04, 0], [0.04, 0.005], [0.006, 0.012], [0.005, 0.1], [0.07, 0.16], [0.068, 0.162], [0.004, 0.105], [0, 0.105]], 16)),
  tumblerGeo: () => cached('tumbler', () => latheGeo([[0, 0], [0.035, 0], [0.04, 0.11], [0.037, 0.11], [0.032, 0.012], [0, 0.012]], 14)),
  bottleGeo: () => cached('bottle', () => weldNormals(latheGeo([[0, 0], [0.036, 0], [0.038, 0.01], [0.038, 0.19], [0.03, 0.23], [0.013, 0.26], [0.013, 0.31], [0.016, 0.315], [0, 0.32]], 9))),
  wineBottleGeo: () => cached('wbottle', () => weldNormals(latheGeo([[0, 0], [0.037, 0], [0.038, 0.2], [0.03, 0.24], [0.014, 0.27], [0.013, 0.32], [0, 0.32]], 9))),
  glass: glassM,
};

/** Loaded party table (lawn buffet): cloth hung on all sides, platters, drinks, cartons. */
export function buffetTable(r, { w = 2.4, d = 1.0, night = false, low = false, seed = 1, bare = false } = {}) {
  const g = new THREE.Group();
  const H = 0.76;
  // trestles under the cloth are hidden; the cloth is two drapes (open ends overlapped)
  const cloth = mat('fabric', { c1: 0xf6f2ea, c2: 0xe4ddd0, p: [1.4, 0.05, 0, 1], side: THREE.DoubleSide });
  const a = drapeGeo({ w, d, top: H, drop: 0.6, r: 0.03, folds: 5, foldAmp: 0.018, wrinkle: 0.002, puff: 0.004, flare: 0.08, foot: true, seed, res: low ? 40 : 64 });
  g.add(mesh(a, cloth));
  const b = mesh(a, cloth, { rot: [0, Math.PI, 0], scale: [0.996, 0.998, 1] });
  b.position.y = -0.002;
  g.add(b);
  if (bare) {
    // after the party: a few glasses left standing or tipped over on the damp cloth
    const glasses = [];
    for (let i = 0; i < 4; i++) glasses.push(bake(i % 2 ? TW.cocktailGeo() : TW.tumblerGeo(), [r.range(-w / 2 + 0.2, w / 2 - 0.2), H + (i === 3 ? 0.035 : 0.002), r.range(-0.3, 0.3)], i === 3 ? [0, r.range(0, 3), Math.PI / 2] : [0, 0, 0]));
    g.add(mesh(merge(glasses), glassM(), { shadow: false }));
    return g;
  }
  const ceramic = mat('matte', { c1: 0xf8f4ec, p: [0.25, 0, 0, 0] });
  const plates = [];
  const glasses = [];
  const food = new Map();
  const add = (c, geo) => { if (!food.has(c)) food.set(c, []); food.get(c).push(geo); };
  const n = Math.round(w / 0.55);
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + 0.3 + (i * (w - 0.6)) / Math.max(1, n - 1);
    plates.push(bake(TW.platterGeo(), [x, H + 0.002, r.range(-0.12, 0.12)]));
    // canapés on the platter
    const c = r.pick([0xe8b040, 0xc84a3a, 0x8ab04a, 0xf0d8a0, 0xd87a3a]);
    for (let k = 0; k < (low ? 5 : 9); k++) {
      const a2 = (k / 9) * Math.PI * 2 + r.range(-0.2, 0.2);
      const rr = k === 0 ? 0 : r.range(0.08, 0.17);
      add(c, bake(cached('canape', () => roundedBoxGeo(0.05, 0.022, 0.05, 0.008, 1, 1)), [x + Math.cos(a2) * rr, H + 0.03, Math.sin(a2) * rr], [0, r.range(0, 3), 0]));
    }
  }
  // cocktails and tumblers along the front
  for (let i = 0; i < (low ? 5 : 10); i++) {
    const x = r.range(-w / 2 + 0.15, w / 2 - 0.15);
    const z = r.range(0.28, 0.4);
    glasses.push(bake(i % 2 ? TW.cocktailGeo() : TW.tumblerGeo(), [x, H + 0.002, z]));
    add(r.pick([0xff7a3a, 0xffd23a, 0xff4a8a, 0x8ad8ff]), bake(cached('drink', () => new THREE.CylinderGeometry(0.03, 0.03, 0.06, 10)), [x, H + (i % 2 ? 0.14 : 0.04), z], [0, 0, 0], i % 2 ? [1.6, 0.4, 1.6] : [1, 1, 1]));
  }
  // a punch bowl, a fruit bowl and the cartons of Di-Gel
  plates.push(bake(TW.bowlGeo(), [w * 0.3, H, -0.25], [0, 0, 0], 1.6));
  add(0xd8406a, bake(cached('punch', () => new THREE.CircleGeometry(0.2, 20).rotateX(-Math.PI / 2)), [w * 0.3, H + 0.12, -0.25]));
  plates.push(bake(TW.bowlGeo(), [-w * 0.28, H, -0.25], [0, 0, 0], 1.3));
  for (let k = 0; k < 7; k++) add(r.pick([0xffc830, 0xff8a2a, 0x9ac040, 0xd8402a]), bake(cached('fruit', () => new THREE.SphereGeometry(0.05, 10, 8)), [-w * 0.28 + r.range(-0.1, 0.1), H + 0.1 + r.range(0, 0.06), -0.25 + r.range(-0.1, 0.1)]));
  for (let k = 0; k < 3; k++) {
    const x = r.range(-0.3, 0.3);
    add(0x3a6ac8, bake(cached('carton', () => roundedBoxGeo(0.09, 0.14, 0.05, 0.006, 1, 1)), [x, H + 0.07, -0.34 + k * 0.02], [0, r.range(-0.4, 0.4), 0]));
    add(0xf4f4f0, bake(cached('cartonBand', () => roundedBoxGeo(0.092, 0.035, 0.052, 0.004, 1, 1)), [x, H + 0.1, -0.34 + k * 0.02], [0, 0, 0]));
  }
  g.add(mesh(merge(plates), ceramic));
  g.add(mesh(merge(glasses), glassM(), { shadow: false }));
  for (const [c, list] of food) g.add(mesh(merge(list), mat('matte', { c1: c, c2: c, p: [0.55, 0, 0, 0] })));
  if (night) {
    // hurricane candles
    for (const x of [-w / 3, w / 3]) {
      g.add(mesh(cached('hurricane', () => latheGeo([[0, 0], [0.05, 0], [0.07, 0.08], [0.06, 0.2], [0.055, 0.22], [0, 0.22]], 16)), glassM(), { pos: [x, H, 0.05], shadow: false }));
      g.add(mesh(cached('flameGeo', () => new THREE.SphereGeometry(0.015, 8, 6)), glowMat(0xffc070, 3), { pos: [x, H + 0.1, 0.05], scale: [1, 1.8, 1], shadow: false }));
    }
  }
  return g;
}

/** A small lamp beside a garden path: a turned post with a frosted globe (lit at night). */
export function pathLamp({ night = false } = {}) {
  const g = new THREE.Group();
  g.add(mesh(cached('pathPost', () => weldNormals(latheGeo([[0, 0], [0.07, 0], [0.07, 0.04], [0.035, 0.08], [0.028, 0.5], [0.045, 0.54], [0.03, 0.58], [0, 0.58]], 10))), IM.blackIron()));
  g.add(mesh(cached('pathGlobe', () => new THREE.SphereGeometry(0.075, 14, 10)), night ? glowMat(0xffe2b0, 2.4) : mat('matte', { c1: 0xf4f0e6, p: [0.2, 0, 0, 0] }), { pos: [0, 0.64, 0], shadow: false }));
  return g;
}

// ---------------------------------------------------------------- the island's rooms

/** Style A with the island's woods and cloths: teak and koa, tropical cottons (bungalow, bedroom) or the parlor's green velvet. */
export function islandPalette(kind = 'bungalow') {
  const A = palette('a');
  const brass = mat('gold', { c1: 0xd0a95a, c2: 0xffffff, p: [0.3, 0.2, 0, 0] });
  if (kind === 'parlor') {
    return { ...A, gold: brass,
      velvet: mat('fabric', { c1: 0x2e5e44, c2: 0x1e4230, p: [1.1, 0.9, 0, 0.6] }),
      velvetDS: mat('fabric', { c1: 0x2e5e44, c2: 0x1e4230, p: [1.1, 0.9, 0, 0.6], side: THREE.DoubleSide }) };
  }
  const cloth = kind === 'bedroom'
    ? { c1: 0x46729c, c2: 0x34587e, p: [0.8, 0.15, 0, 1] }
    : { c1: 0x3a8078, c2: 0x2c665e, p: [0.9, 0.25, 0, 1] };
  return { ...A, gold: brass,
    wood: mat('wood', { c1: 0x9a6634, c2: 0x5a3414, p: [2.6, 0, 0, 0] }),
    woodDark: mat('wood', { c1: 0x5e3a1c, c2: 0x2e1a0a, p: [3, 0, 0, 0] }),
    velvet: mat('fabric', cloth),
    velvetDS: mat('fabric', { ...cloth, side: THREE.DoubleSide }),
    accent: mat('fabric', { c1: 0xd8704a, c2: 0xb8563a, p: [0.9, 0.2, 0, 1] }) };
}

const MIRROR = () => cached('mirrorMat', () => new THREE.MeshStandardMaterial({ color: 0xdfe6ec, roughness: 0.03, metalness: 1 }));
const ENAMEL = () => mat('matte', { c1: 0xf2efe6, c2: 0xfaf8f2, p: [0.22, 1.6, 0.05, 0] });
const CHROME = () => mat('metal', { c1: 0xe8ecf0, c2: 0x9aa0a8, p: [0.08, 0.02, 0, 0] });

/** A ceiling fan with cane blades hanging from (0, 0, 0); userData.spin is the part that turns. */
export function ceilingFan(P, { drop = 0.5, night = false } = {}) {
  const g = new THREE.Group();
  g.add(mesh(cached('fanCanopy', () => latheGeo([[0, 0], [0.1, 0], [0.09, -0.05], [0.03, -0.08], [0, -0.08]], 16)), P.gold, { shadow: false }));
  g.add(mesh(cached(`fanRod|${drop}`, () => new THREE.CylinderGeometry(0.012, 0.012, drop, 8).translate(0, -drop / 2, 0)), P.gold, { shadow: false }));
  const spin = new THREE.Group();
  spin.position.y = -drop;
  spin.add(mesh(cached('fanMotor', () => weldNormals(latheGeo([[0, 0.04], [0.11, 0.03], [0.13, -0.03], [0.1, -0.09], [0.04, -0.12], [0, -0.12]], 20))), P.woodDark, { shadow: false }));
  const blade = cached('fanBlade', () => {
    const b = roundedBoxGeo(0.6, 0.01, 0.15, 0.004, 1, 4);
    const p = b.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i) / 0.3; p.setZ(i, p.getZ(i) * (0.75 + 0.35 * Math.sin((x * 0.5 + 0.5) * Math.PI))); }
    b.computeVertexNormals();
    return b.translate(0.45, -0.03, 0);
  });
  const cane = mat('fabric', { c1: 0xd6bc86, c2: 0x9a7c48, p: [0.5, 0, 0, 1] });
  const irons = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    spin.add(mesh(blade, cane, { rot: [0.12, a, 0], shadow: false }));
    irons.push(bake(beamGeo(0.2, 0.012, 0.03, 0.004), [Math.cos(a) * 0.17, -0.03, -Math.sin(a) * 0.17], [0, a, 0]));
  }
  spin.add(mesh(merge(irons), P.gold, { shadow: false }));
  spin.add(mesh(cached('fanBowl', () => new THREE.SphereGeometry(0.09, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), night ? glowMat(0xffe0b0, 1.4) : mat('matte', { c1: 0xf4ecd8, p: [0.2, 0, 0, 0] }), { pos: [0, -0.1, 0], shadow: false }));
  g.add(spin);
  g.userData.spin = spin;
  return g;
}

/** A vase of fresh flowers (hibiscus, plumeria, anthurium). */
export function flowerVase(r, { h = 0.3, colors = [0xff3a5a, 0xfff4e0, 0xff9a3a, 0xe8205a] } = {}) {
  const g = new THREE.Group();
  g.add(mesh(cached('fvase', () => weldNormals(latheGeo([[0, 0], [0.06, 0], [0.08, 0.04], [0.1, 0.14], [0.06, 0.24], [0.045, 0.28], [0.06, 0.3], [0, 0.3]], 24))), mat('matte', { c1: 0x2e6a8a, c2: 0x5a9ab8, p: [0.12, 1.4, 0.05, 0] }), { scale: [1, h / 0.3, 1] }));
  const stems = [];
  const blooms = new Map();
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + r.range(-0.2, 0.2);
    const t = r.range(0.08, 0.2);
    const top = [Math.cos(a) * t, h + r.range(0.12, 0.3), Math.sin(a) * t];
    stems.push(tubeGeo([[0, h - 0.05, 0], [top[0] * 0.4, h + 0.05, top[2] * 0.4], top], 0.004, 6));
    const c = colors[i % colors.length];
    if (!blooms.has(c)) blooms.set(c, []);
    const petals = cached('bloomGeo', () => {
      const p = [];
      for (let k = 0; k < 5; k++) { const s = new THREE.SphereGeometry(0.028, 6, 4); s.scale(1.4, 0.35, 0.8); s.translate(0.03, 0, 0); s.rotateY((k / 5) * Math.PI * 2); p.push(s); }
      return merge(p);
    });
    blooms.get(c).push(bake(petals, top, [r.range(-0.6, 0.6), r.range(0, 6), r.range(-0.6, 0.6)], r.range(0.8, 1.3)));
  }
  g.add(mesh(merge(stems), mat('matte', { c1: 0x3a6a2a, p: [0.6, 0, 0, 0] }), { shadow: false }));
  for (const [c, list] of blooms) g.add(mesh(merge(list), mat('fabric', { c1: c, c2: c, p: [2, 0.4, 0, 1] }), { shadow: false }));
  const leaves = [];
  for (let i = 0; i < 6; i++) { const b = bladeGeo(0.3, 0.09, 0.4, 5, 0.2); b.rotateX(-0.7); b.rotateY((i / 6) * Math.PI * 2); b.translate(0, h - 0.02, 0); leaves.push(b); }
  g.add(mesh(merge(leaves), LEAF.broad(false), { shadow: false }));
  return g;
}

/** A framed picture w × h facing +z: a gilt or dark frame round a painted seascape (or a mottled landscape). */
export function framedPicture(P, w, h, { kind = 'sea', frame = null } = {}) {
  const g = new THREE.Group();
  const f = frame || P.gold;
  const t = 0.06;
  g.add(assemble([
    [beamGeo(w + 2 * t, t, 0.04, 0.012), [0, h / 2 + t / 2, 0.02]], [beamGeo(w + 2 * t, t, 0.04, 0.012), [0, -h / 2 - t / 2, 0.02]],
    [beamGeo(t, h, 0.04, 0.012), [-w / 2 - t / 2, 0, 0.02]], [beamGeo(t, h, 0.04, 0.012), [w / 2 + t / 2, 0, 0.02]],
  ], f, { shadow: false }));
  if (kind === 'sea') {
    g.add(mesh(new THREE.PlaneGeometry(w, h * 0.45), mat('cloth', { c1: 0x2a7a9a, c2: 0x1a4a6a, p: [6, 0, 0, 0] }), { pos: [0, -h * 0.275, 0.01], shadow: false }));
    g.add(mesh(new THREE.PlaneGeometry(w, h * 0.55), mat('cloth', { c1: 0xf0b890, c2: 0xe89070, p: [3, 0, 0, 0] }), { pos: [0, h * 0.225, 0.01], shadow: false }));
    g.add(mesh(cached('pSun', () => new THREE.CircleGeometry(1, 20)), mat('matte', { c1: 0xfff0c0, p: [0.9, 0, 0, 0] }), { pos: [w * 0.18, h * 0.05, 0.012], scale: [h * 0.08, h * 0.08, 1], shadow: false }));
    const palm = [tubeGeo([[-w * 0.3, -h * 0.5, 0.014], [-w * 0.27, -h * 0.1, 0.014], [-w * 0.2, h * 0.3, 0.014]], h * 0.012, 8)];
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; palm.push(tubeGeo([[-w * 0.2, h * 0.3, 0.015], [-w * 0.2 + Math.cos(a) * w * 0.08, h * 0.3 + Math.sin(a) * h * 0.06 + h * 0.03, 0.015], [-w * 0.2 + Math.cos(a) * w * 0.15, h * 0.3 + Math.sin(a) * h * 0.04 - h * 0.04, 0.015]], h * 0.008, 6)); }
    g.add(mesh(merge(palm), mat('matte', { c1: 0x2a2018, p: [0.8, 0, 0, 0] }), { shadow: false }));
  } else {
    g.add(mesh(new THREE.PlaneGeometry(w, h), mat('cloth', { c1: 0xd8e4e8, c2: 0xb8ccd8, p: [2, 0, 0, 0] }), { pos: [0, 0, 0.008], shadow: false }));
    const hill = (pts, c, z) => {
      const s = new THREE.Shape();
      s.moveTo(-w / 2, -h / 2);
      for (const [x, y] of pts) s.lineTo(x * w, y * h);
      s.lineTo(w / 2, -h / 2);
      g.add(mesh(new THREE.ShapeGeometry(s), mat('cloth', { c1: c, c2: c, p: [4, 0, 0, 0] }), { pos: [0, 0, z], shadow: false }));
    };
    hill([[-0.5, -0.05], [-0.25, 0.28], [-0.05, 0.1], [0.15, 0.22], [0.5, 0.0]], 0x7a8aa0, 0.01);
    hill([[-0.5, -0.2], [-0.2, -0.05], [0.1, -0.18], [0.3, -0.08], [0.5, -0.15]], 0x5a7a3a, 0.012);
    hill([[-0.5, -0.35], [-0.1, -0.25], [0.2, -0.36], [0.5, -0.28]], 0x3a5a2a, 0.014);
  }
  return g;
}

/** A low table with turned legs, a tray and a bowl of fruit. */
export function coffeeTable(P, r, { w = 1.1, d = 0.6, h = 0.44 } = {}) {
  const g = new THREE.Group();
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const l = leg(P, h - 0.04, 1.1);
    l.position.set(sx * (w / 2 - 0.07), 0, sz * (d / 2 - 0.07));
    g.add(l);
  }
  g.add(rbox(w, 0.045, d, 0.015, P.wood, { pos: [0, h - 0.045, 0] }));
  g.add(rbox(w - 0.1, 0.07, d - 0.1, 0.01, P.wood, { pos: [0, h - 0.11, 0] }));
  g.add(mesh(TW.bowlGeo(), P.ceramic, { pos: [0.2, h, 0.02], scale: 1.3 }));
  const fruit = new Map();
  for (let k = 0; k < 6; k++) {
    const c = r.pick([0xffc830, 0xff8a2a, 0x9ac040, 0xd8402a]);
    if (!fruit.has(c)) fruit.set(c, []);
    fruit.get(c).push(bake(cached('fruit', () => new THREE.SphereGeometry(0.05, 10, 8)), [0.2 + r.range(-0.08, 0.08), h + 0.09 + r.range(0, 0.04), r.range(-0.08, 0.1)]));
  }
  for (const [c, list] of fruit) g.add(mesh(merge(list), mat('matte', { c1: c, p: [0.45, 0, 0, 0] })));
  g.add(rbox(0.36, 0.012, 0.22, 0.004, P.gold, { pos: [-0.28, h, 0] }));
  return g;
}

/** A console table (the entry's) with a vase of fresh flowers. */
export function consoleTable(P, r, { w = 1.1 } = {}) {
  const g = new THREE.Group();
  const h = 0.8;
  const d = 0.36;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const l = leg(P, h - 0.04, 0.9);
    l.position.set(sx * (w / 2 - 0.06), 0, sz * (d / 2 - 0.05));
    g.add(l);
  }
  g.add(rbox(w, 0.04, d, 0.012, P.wood, { pos: [0, h - 0.04, 0] }));
  g.add(rbox(w - 0.08, 0.1, d - 0.06, 0.01, P.wood, { pos: [0, h - 0.14, 0] }));
  const kb = knob(P);
  kb.position.set(0, h - 0.09, d / 2 - 0.02);
  g.add(kb);
  const v = flowerVase(r, { h: 0.3 });
  v.position.set(-0.15, h, 0);
  g.add(v);
  return g;
}

/** A chest of drawers with a tilting mirror (the bedroom's dresser). */
export function dresser(P) {
  const g = new THREE.Group();
  const w = 1.3;
  const h = 0.86;
  const d = 0.52;
  const lh = 0.1;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const l = leg(P, lh, 1);
    l.position.set(sx * (w / 2 - 0.07), 0, sz * (d / 2 - 0.07));
    g.add(l);
  }
  g.add(rbox(w, h - lh, d, 0.015, P.wood, { pos: [0, lh, 0] }));
  g.add(rbox(w + 0.04, 0.035, d + 0.04, 0.012, P.woodDark, { pos: [0, h, 0] }));
  const rows = [[0.26, 2], [0.26, 2], [0.2, 2]];
  let y = lh + 0.06;
  for (const [rh, n] of rows) {
    for (let k = 0; k < n; k++) {
      const dw = (w - 0.1) / n;
      const x = -w / 2 + 0.05 + dw * (k + 0.5);
      g.add(rbox(dw - 0.03, rh - 0.03, 0.02, 0.008, P.wood, { pos: [x, y + rh / 2, d / 2 + 0.005], center: true }));
      for (const s of [-1, 1]) {
        const kb = knob(P);
        kb.position.set(x + s * dw * 0.25, y + rh / 2, d / 2 + 0.016);
        g.add(kb);
      }
    }
    y += rh;
  }
  // the mirror on turned uprights
  for (const s of [-1, 1]) g.add(mesh(cached('mirPost', () => weldNormals(latheGeo([[0, 0], [0.03, 0], [0.024, 0.1], [0.02, 0.5], [0.028, 0.56], [0.02, 0.62], [0, 0.64]], 10))), P.woodDark, { pos: [s * 0.46, h + 0.035, -d / 2 + 0.1] }));
  const mg = new THREE.Group();
  mg.position.set(0, h + 0.5, -d / 2 + 0.1);
  mg.rotation.x = -0.08;
  mg.add(mesh(cached('mirrorFrame', () => {
    const s = new THREE.Shape();
    s.absellipse(0, 0, 0.42, 0.34, 0, Math.PI * 2);
    const hole = new THREE.Path();
    hole.absellipse(0, 0, 0.37, 0.29, 0, Math.PI * 2, true);
    s.holes.push(hole);
    return new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2, curveSegments: 24 });
  }), P.woodDark));
  mg.add(mesh(cached('mirrorGlass', () => { const c = new THREE.CircleGeometry(1, 32); c.scale(0.37, 0.29, 1); return c; }), MIRROR(), { pos: [0, 0, 0.02], shadow: false }));
  g.add(mg);
  // a brush and a little jewellery box
  g.add(rbox(0.18, 0.08, 0.12, 0.01, P.accent, { pos: [0.4, h + 0.035, 0.08] }));
  g.add(mesh(cached('perfume', () => weldNormals(latheGeo([[0, 0], [0.035, 0], [0.04, 0.05], [0.02, 0.08], [0.01, 0.1], [0.018, 0.12], [0, 0.13]], 14))), glassM(), { pos: [-0.35, h + 0.035, 0.05], shadow: false }));
  return g;
}

// kitchen

/** The small gas stove: white enamel, four burners, oven, knobs, a clock on the backsplash. */
export function gasStove({ night = false } = {}) {
  const g = new THREE.Group();
  const w = 0.92;
  const h = 0.92;
  const d = 0.66;
  const en = ENAMEL();
  const iron = IM.blackIron();
  const chrome = CHROME();
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(mesh(cached('stoveFoot', () => latheGeo([[0, 0], [0.03, 0], [0.025, 0.06], [0, 0.06]], 10)), chrome, { pos: [sx * (w / 2 - 0.06), 0, sz * (d / 2 - 0.06)] }));
  g.add(rbox(w, h - 0.06, d, 0.035, en, { pos: [0, 0.06, 0] }));
  g.add(rbox(w - 0.04, 0.02, d - 0.06, 0.008, mat('matte', { c1: 0x1a1a1a, p: [0.4, 0, 0.2, 0] }), { pos: [0, h, 0.01] }));
  const grate = [];
  for (const [x, z] of [[-0.22, -0.13], [0.22, -0.13], [-0.22, 0.15], [0.22, 0.15]]) {
    grate.push(bake(cached('burnerRing', () => new THREE.TorusGeometry(0.1, 0.008, 5, 20).rotateX(Math.PI / 2)), [x, h + 0.04, z]));
    for (let k = 0; k < 4; k++) grate.push(bake(beamGeo(0.2, 0.012, 0.014, 0.003), [x, h + 0.045, z], [0, (k * Math.PI) / 4, 0]));
    grate.push(bake(cached('burnerCap', () => latheGeo([[0, 0], [0.045, 0], [0.04, 0.018], [0, 0.022]], 14)), [x, h + 0.02, z]));
  }
  g.add(mesh(merge(grate), iron));
  // backsplash with knobs and a clock
  g.add(rbox(w, 0.24, 0.07, 0.02, en, { pos: [0, h, -d / 2 + 0.035] }));
  const knobs = [];
  for (let k = 0; k < 6; k++) knobs.push(bake(cached('stoveKnob', () => latheGeo([[0, 0], [0.024, 0], [0.022, 0.025], [0.012, 0.035], [0, 0.036]], 12).rotateX(Math.PI / 2)), [-0.36 + k * 0.144 + (k > 2 ? 0.0 : 0), h + 0.09, -d / 2 + 0.07], [0, 0, k === 4 ? 1.2 : 0]));
  g.add(mesh(merge(knobs), chrome));
  g.add(mesh(cached('clock', () => new THREE.CircleGeometry(0.05, 20)), night ? glowMat(0xf0f4e0, 0.6) : mat('matte', { c1: 0xf8f6ec, p: [0.3, 0, 0, 0] }), { pos: [0, h + 0.17, -d / 2 + 0.072], shadow: false }));
  // oven door with window and handle; drawer
  g.add(rbox(w - 0.14, 0.44, 0.03, 0.02, en, { pos: [0, 0.34, d / 2 + 0.01], center: true }));
  g.add(mesh(cached('ovenWin', () => roundedBoxGeo(0.4, 0.2, 0.01, 0.02, 2, 1)), mat('matte', { c1: 0x1a1612, p: [0.1, 0, 0.3, 0] }), { pos: [0, 0.38, d / 2 + 0.027], shadow: false }));
  g.add(mesh(cached('ovenHandle', () => tubeGeo([[-0.3, 0, 0], [-0.28, 0, 0.04], [0.28, 0, 0.04], [0.3, 0, 0]], 0.012, 12)), chrome, { pos: [0, 0.6, d / 2 + 0.02] }));
  g.add(rbox(w - 0.14, 0.1, 0.03, 0.015, en, { pos: [0, 0.12, d / 2 + 0.01], center: true }));
  return g;
}

/** A rounded 1950s refrigerator with a chrome handle and badge. */
export function fridge() {
  const g = new THREE.Group();
  const w = 0.76;
  const h = 1.62;
  const d = 0.7;
  const en = ENAMEL();
  g.add(mesh(cached('fridgeBody', () => roundedBoxGeo(w, h, d, 0.12, 4, 2).translate(0, h / 2 + 0.06, 0)), en));
  g.add(mesh(cached('fridgeKick', () => roundedBoxGeo(w - 0.1, 0.07, d - 0.1, 0.02, 1, 1).translate(0, 0.035, 0)), mat('matte', { c1: 0x2a2a2a, p: [0.6, 0, 0, 0] })));
  g.add(mesh(cached('fridgeSeam', () => roundedBoxGeo(w - 0.12, 0.008, 0.012, 0.003, 1, 1)), mat('matte', { c1: 0xb8b4aa, p: [0.4, 0, 0, 0] }), { pos: [0, 1.28, d / 2 - 0.004] }));
  g.add(mesh(cached('fridgeSeamV', () => roundedBoxGeo(0.008, h - 0.3, 0.012, 0.003, 1, 1)), mat('matte', { c1: 0xb8b4aa, p: [0.4, 0, 0, 0] }), { pos: [-w / 2 + 0.07, 0.75, d / 2 - 0.004] }));
  g.add(mesh(cached('fridgeHandle', () => tubeGeo([[0, -0.2, 0], [0, -0.18, 0.05], [0, 0.18, 0.05], [0, 0.2, 0]], 0.016, 14)), CHROME(), { pos: [w / 2 - 0.1, 1.05, d / 2 - 0.02] }));
  g.add(mesh(cached('badge', () => roundedBoxGeo(0.16, 0.04, 0.01, 0.005, 1, 1)), CHROME(), { pos: [0, 1.52, d / 2 + 0.002] }));
  return g;
}

/**
 * A run of base cabinets len long (along x) with a tiled top; sink: an
 * enamel basin with a swan-neck tap at x = sink. Front toward +z.
 */
export function counterRun(P, len, { sink = null } = {}) {
  const g = new THREE.Group();
  const h = 0.88;
  const d = 0.62;
  const paint = mat('matte', { c1: 0xe8dcb8, c2: 0xf0e6c8, p: [0.45, 1.0, 0, 0] });
  g.add(mesh(cached(`plinth|${len}`, () => roundedBoxGeo(len, 0.1, d - 0.08, 0.01, 1, 1).translate(0, 0.05, -0.04)), mat('matte', { c1: 0x3a2e24, p: [0.7, 0, 0, 0] })));
  g.add(rbox(len, h - 0.1, d - 0.02, 0.012, paint, { pos: [0, 0.1, -0.01] }));
  const n = Math.max(1, Math.round(len / 0.6));
  const dw = len / n;
  for (let k = 0; k < n; k++) {
    const x = -len / 2 + dw * (k + 0.5);
    g.add(rbox(dw - 0.04, 0.54, 0.022, 0.01, paint, { pos: [x, 0.16 + 0.27, d / 2 - 0.01], center: true }));
    g.add(rbox(dw - 0.14, 0.4, 0.012, 0.02, paint, { pos: [x, 0.16 + 0.27, d / 2 + 0.006], center: true }));
    g.add(rbox(dw - 0.04, 0.14, 0.022, 0.01, paint, { pos: [x, 0.8, d / 2 - 0.01], center: true }));
    const kb = knob(P);
    kb.position.set(x, 0.8, d / 2 + 0.005);
    g.add(kb);
    const kb2 = knob(P);
    kb2.position.set(x + (k % 2 ? -1 : 1) * (dw / 2 - 0.08), 0.52, d / 2 + 0.005);
    g.add(kb2);
  }
  const top = mat('tile', { c1: 0xf0ece0, c2: 0xe0dac8, c3: 0x5a8a9a, p: [0.1, 0.06, 0.25, 0] });
  if (sink === null) g.add(rbox(len + 0.04, 0.04, d + 0.02, 0.01, top, { pos: [0, h, 0] }));
  else {
    const sw = 0.6;
    const a = sink - sw / 2 + len / 2;
    const b = len / 2 - (sink + sw / 2);
    if (a > 0.02) g.add(rbox(a + 0.02, 0.04, d + 0.02, 0.01, top, { pos: [-len / 2 + a / 2, h, 0] }));
    if (b > 0.02) g.add(rbox(b + 0.02, 0.04, d + 0.02, 0.01, top, { pos: [len / 2 - b / 2, h, 0] }));
    const basin = cached('sinkBasin', () => {
      const s = new THREE.Shape();
      s.moveTo(-0.3, -0.29); s.lineTo(0.3, -0.29); s.lineTo(0.3, 0.29); s.lineTo(-0.3, 0.29); s.closePath();
      const hole = new THREE.Path();
      hole.moveTo(-0.24, -0.2); hole.lineTo(-0.24, 0.22); hole.lineTo(0.24, 0.22); hole.lineTo(0.24, -0.2); hole.closePath();
      s.holes.push(hole);
      return new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2 }).rotateX(-Math.PI / 2);
    });
    g.add(mesh(basin, ENAMEL(), { pos: [sink, h - 0.02, 0] }));
    g.add(mesh(cached('sinkIn', () => new THREE.BoxGeometry(0.48, 0.2, 0.42)), mat('matte', { c1: 0xe8e6e0, p: [0.2, 0, 0, 0], side: THREE.BackSide }), { pos: [sink, h - 0.08, -0.01], shadow: false }));
    g.add(mesh(cached('tap', () => merge([latheGeo([[0, 0], [0.03, 0], [0.02, 0.05], [0.015, 0.2], [0, 0.2]], 10), tubeGeo([[0, 0.2, 0], [0, 0.3, 0.04], [0, 0.26, 0.14], [0, 0.2, 0.16]], 0.013, 12)])), CHROME(), { pos: [sink, h + 0.02, -d / 2 + 0.08] }));
  }
  return g;
}

/** An open wall shelf with plates on edge, jars and mugs. */
export function crockeryShelf(P, r, { w = 1.4 } = {}) {
  const g = new THREE.Group();
  g.add(rbox(w, 0.03, 0.24, 0.008, P.wood, { pos: [0, 0, 0] }));
  g.add(rbox(w, 0.03, 0.24, 0.008, P.wood, { pos: [0, 0.38, 0] }));
  for (const s of [-1, 1]) g.add(mesh(cached('bracket', () => tubeGeo([[0, -0.22, -0.11], [0, -0.05, -0.02], [0, 0, 0.1]], 0.012, 8)), IM.blackIron(), { pos: [s * (w / 2 - 0.15), 0, 0] }));
  const plates = [];
  for (let k = 0; k < 6; k++) plates.push(bake(TW.plateGeo(), [-w / 2 + 0.15 + k * 0.08, 0.14, -0.04], [Math.PI / 2 - 0.15, 0, 0]));
  const jars = [];
  for (let k = 0; k < 4; k++) jars.push(bake(cached('jar', () => latheGeo([[0, 0], [0.05, 0], [0.055, 0.12], [0.04, 0.14], [0.045, 0.16], [0, 0.16]], 14)), [0.15 + k * 0.13, 0.03, 0]));
  g.add(mesh(merge(plates), mat('matte', { c1: 0xf4f0e6, c2: 0x5a8aa8, p: [0.25, 0, 0, 0] })));
  g.add(mesh(merge(jars), glassM(), { shadow: false }));
  const fill = [];
  for (let k = 0; k < 4; k++) fill.push(bake(cached('jarFill', () => new THREE.CylinderGeometry(0.045, 0.045, 0.08, 12)), [0.15 + k * 0.13, 0.07, 0]));
  g.add(mesh(merge(fill), mat('matte', { c1: 0xc89a5a, c2: 0x8a5a2a, p: [0.7, 0, 0, 0] }), { shadow: false }));
  const mugs = [];
  for (let k = 0; k < 4; k++) mugs.push(bake(cached('mug', () => merge([latheGeo([[0, 0], [0.04, 0], [0.042, 0.09], [0.038, 0.09], [0.036, 0.01], [0, 0.01]], 14), new THREE.TorusGeometry(0.025, 0.007, 5, 10).translate(0.045, 0.05, 0)])), [-0.2 + k * 0.12, 0.41, 0], [0, r.range(-0.5, 0.5), 0]));
  g.add(mesh(merge(mugs), mat('matte', { c1: 0xd87a4a, c2: 0xe89a6a, p: [0.3, 0, 0, 0] })));
  return g;
}

/** A kitchen chair: turned legs, a saddle seat, a spindle back. Faces +z. */
export function spindleChair(P) {
  const g = new THREE.Group();
  const sh = 0.46;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const l = leg(P, sh - 0.03, 0.8);
    l.position.set(sx * 0.19, 0, sz * 0.18);
    l.rotation.set(sz * 0.05, 0, -sx * 0.05);
    g.add(l);
  }
  g.add(mesh(cached('chairSeat', () => cushionGeo(0.44, 0.04, 0.42, { r: 0.015, puff: -0.3, under: 0, seg: 2, mid: 4 })), P.wood, { pos: [0, sh, 0] }));
  const back = [];
  for (let k = 0; k < 5; k++) back.push(bake(cached('backSpindle', () => weldNormals(latheGeo([[0, 0], [0.012, 0], [0.009, 0.1], [0.013, 0.2], [0.009, 0.3], [0.012, 0.42], [0, 0.42]], 6))), [-0.14 + k * 0.07, sh + 0.02, -0.19], [-0.12, 0, 0]));
  back.push(bake(cached('crest', () => tubeGeo([[-0.2, 0, 0.02], [0, 0, -0.03], [0.2, 0, 0.02]], 0.022, 10)), [0, sh + 0.46, -0.24]));
  for (const s of [-1, 1]) back.push(bake(postGeo(0.46, 0.035, 0.008), [s * 0.2, sh, -0.19], [-0.12, 0, 0]));
  g.add(mesh(merge(back), P.wood));
  return g;
}

/** A small square kitchen table with a checked cloth. */
export function kitchenTable(P, r) {
  const g = new THREE.Group();
  const h = 0.75;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const l = leg(P, h - 0.03, 1.1);
    l.position.set(sx * 0.36, 0, sz * 0.36);
    g.add(l);
  }
  g.add(rbox(0.9, 0.03, 0.9, 0.01, P.wood, { pos: [0, h - 0.03, 0] }));
  const cloth = mat('fabric', { c1: 0xf0e6d8, c2: 0xa82a2a, p: [0.18, 0, 0, 1], side: THREE.DoubleSide });
  const dg = drapeGeo({ w: 0.9, d: 0.9, top: h, drop: 0.22, r: 0.02, folds: 5, foldAmp: 0.012, wrinkle: 0.002, puff: 0.002, flare: 0.05, foot: true, seed: 3, res: 40 });
  g.add(mesh(dg, cloth));
  g.add(mesh(dg, cloth, { rot: [0, Math.PI, 0], scale: [0.996, 0.998, 1], pos: [0, -0.002, 0] }));
  g.add(mesh(TW.bowlGeo(), mat('matte', { c1: 0xf4f0e6, c2: 0x5a8aa8, p: [0.25, 0, 0, 0] }), { pos: [0.1, h + 0.004, 0] }));
  g.add(mesh(TW.plateGeo(), mat('matte', { c1: 0xf4f0e6, p: [0.25, 0, 0, 0] }), { pos: [-0.2, h + 0.004, 0.2] }));
  return g;
}

// the drawing room and the study

/** The large oaken pedestal desk with a tooled leather top. Faces +z (the chair side is -z). */
export function oakDesk(P) {
  const g = new THREE.Group();
  const oak = mat('wood', { c1: 0xb08652, c2: 0x6a4624, p: [3, 0, 0, 0] });
  const w = 1.7;
  const d = 0.85;
  const h = 0.78;
  for (const s of [-1, 1]) {
    const x = s * (w / 2 - 0.25);
    g.add(rbox(0.48, h - 0.06, d - 0.04, 0.012, oak, { pos: [x, 0.04, 0] }));
    g.add(rbox(0.52, 0.05, d, 0.012, P.woodDark, { pos: [x, 0, 0] }));
    for (let k = 0; k < 3; k++) {
      const y = 0.16 + k * 0.2;
      g.add(rbox(0.42, 0.17, 0.02, 0.008, oak, { pos: [x, y + 0.085, -d / 2 + 0.01], center: true }));
      const kb = knob(P);
      kb.position.set(x, y + 0.085, -d / 2 - 0.004);
      kb.rotation.y = Math.PI;
      g.add(kb);
    }
  }
  g.add(rbox(w - 1.0, 0.5, 0.03, 0.01, oak, { pos: [0, 0.22, d / 2 - 0.05] }));
  g.add(rbox(w + 0.06, 0.05, d + 0.06, 0.015, oak, { pos: [0, h - 0.02, 0] }));
  g.add(rbox(w - 0.2, 0.004, d - 0.2, 0.002, mat('fabric', { c1: 0x2a4a2e, c2: 0x1a3020, c3: 0xc8a050, p: [1.4, 0.3, 0.1, 1] }), { pos: [0, h + 0.03, 0] }));
  return g;
}

/** An old candlestick telephone with its receiver on the hook. */
export function candlestickPhone() {
  const g = new THREE.Group();
  const black = mat('matte', { c1: 0x121110, p: [0.18, 0, 0.2, 0] });
  const brass = IM.brass();
  g.add(mesh(cached('phoneBase', () => weldNormals(latheGeo([[0, 0], [0.065, 0], [0.066, 0.015], [0.05, 0.03], [0.018, 0.05], [0.014, 0.28], [0.02, 0.29], [0, 0.29]], 18))), black));
  g.add(mesh(cached('phoneMouth', () => weldNormals(latheGeo([[0, 0], [0.012, 0], [0.02, 0.03], [0.034, 0.06], [0.03, 0.065], [0, 0.066]], 14).rotateX(Math.PI / 2 - 0.3))), black, { pos: [0, 0.3, 0.01] }));
  g.add(mesh(cached('hook', () => tubeGeo([[0, 0.24, 0], [0.04, 0.24, 0], [0.06, 0.26, 0]], 0.004, 6)), brass));
  g.add(mesh(cached('receiver', () => weldNormals(latheGeo([[0, 0], [0.02, 0], [0.015, 0.03], [0.012, 0.09], [0.025, 0.1], [0.028, 0.12], [0, 0.125]], 14))), black, { pos: [0.065, 0.16, 0] }));
  g.add(mesh(cached('cord', () => tubeGeo([[0.065, 0.16, 0], [0.09, 0.08, 0.03], [0.07, 0.01, 0.1], [0, 0.005, 0.12], [-0.12, 0.005, 0.08]], 0.004, 16)), mat('fabric', { c1: 0x3a2a1a, c2: 0x1a120a, p: [3, 0, 0, 1] })));
  return g;
}

/** A banker's desk lamp: brass stem, green glass shade (glowing when lit). */
export function bankerLamp({ lit = false } = {}) {
  const g = new THREE.Group();
  g.add(mesh(cached('bankBase', () => weldNormals(latheGeo([[0, 0], [0.08, 0], [0.075, 0.02], [0.02, 0.03], [0.012, 0.3], [0, 0.3]], 16))), IM.brass()));
  const shade = cached('bankShade', () => {
    const c = new THREE.CylinderGeometry(0.06, 0.1, 0.34, 20, 1, true, 0, Math.PI);
    c.rotateZ(Math.PI / 2);
    return c;
  });
  g.add(mesh(shade, lit ? glowMat(0x2a9a5a, 1.1, { side: THREE.DoubleSide }) : mat('matte', { c1: 0x1e6a3e, p: [0.1, 0, 0.3, 0], side: THREE.DoubleSide }), { pos: [0, 0.34, 0], rot: [0, 0, 0], shadow: false }));
  if (lit) g.add(mesh(cached('bankBulb', () => new THREE.SphereGeometry(0.03, 10, 8)), glowMat(0xfff0c8, 3), { pos: [0, 0.3, 0.0], shadow: false }));
  return g;
}

/** A bookcase w × h with rows of books (merged by colour). Faces +z. */
export function bookcase(P, r, { w = 1.2, h = 2.1, d = 0.36 } = {}) {
  const g = new THREE.Group();
  const shelves = 5;
  const parts = [
    [beamGeo(0.04, h, d, 0.008), [-w / 2 + 0.02, h / 2, 0]], [beamGeo(0.04, h, d, 0.008), [w / 2 - 0.02, h / 2, 0]],
    [beamGeo(w, 0.04, d, 0.008), [0, h - 0.02, 0]], [beamGeo(w + 0.08, 0.08, d + 0.05, 0.02), [0, h + 0.02, 0.01]], [beamGeo(w, 0.1, d, 0.008), [0, 0.05, 0]],
    [beamGeo(w, h, 0.02, 0.004), [0, h / 2, -d / 2 + 0.01]],
  ];
  for (let k = 1; k < shelves; k++) parts.push([beamGeo(w - 0.06, 0.03, d - 0.02, 0.006), [0, 0.1 + (k * (h - 0.14)) / shelves, 0]]);
  g.add(assemble(parts, P.woodDark));
  const cols = [0x6a1a1a, 0x1a3a5a, 0x2a4a2a, 0x7a5a2a, 0x4a2a4a, 0xa87a3a];
  const byC = new Map();
  for (let k = 0; k < shelves; k++) {
    const y0 = 0.1 + (k * (h - 0.14)) / shelves + 0.015;
    let x = -w / 2 + 0.07;
    while (x < w / 2 - 0.12) {
      const bw = r.range(0.025, 0.055);
      const bh = r.range(0.2, 0.3);
      const c = r.pick(cols);
      if (!byC.has(c)) byC.set(c, []);
      const lean = x > w / 2 - 0.25 && r.chance(0.5) ? 0.25 : 0;
      byC.get(c).push(bake(cached('book', () => roundedBoxGeo(1, 1, 1, 0.08, 1, 1)), [x + bw / 2, y0 + bh / 2, 0.01 - r.range(0, 0.03)], [0, 0, -lean], [bw, bh, d - 0.1]));
      x += bw + 0.004;
      if (r.chance(0.06)) x += 0.1;
    }
  }
  for (const [c, list] of byC) g.add(mesh(merge(list), mat('fabric', { c1: c, c2: c, c3: 0xc8a050, p: [1.5, 0.1, 0.1, 1] }), { shadow: false }));
  return g;
}

/** A study chair (buttoned leather), facing +z. */
export function studyChair(P) {
  const g = new THREE.Group();
  const leather = mat('fabric', { c1: 0x6a2a14, c2: 0x3a140a, p: [0.6, 0.6, 0, 0.3] });
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const l = leg(P, 0.4, 0.9);
    l.position.set(sx * 0.24, 0, sz * 0.22);
    g.add(l);
  }
  g.add(mesh(cached('scSeat', () => cushionGeo(0.56, 0.1, 0.52, { r: 0.04, puff: 0.3, seg: 2, mid: 5 })), leather, { pos: [0, 0.45, 0] }));
  g.add(mesh(cached('scBack', () => roundedBoxGeo(0.56, 0.5, 0.1, 0.05, 2, 1)), leather, { pos: [0, 0.78, -0.24], rot: [-0.12, 0, 0] }));
  for (const s of [-1, 1]) g.add(mesh(cached('scArm', () => roundedBoxGeo(0.08, 0.26, 0.5, 0.04, 2, 1)), leather, { pos: [s * 0.3, 0.6, 0] }));
  return g;
}

// the clubhouse

/**
 * The bar counter, len long along x, the customers' side toward +z:
 * panelled front, a thick rounded top, a brass foot rail.
 */
export function barCounter(P, len) {
  const g = new THREE.Group();
  const h = 1.08;
  const d = 0.62;
  const front = mat('paneling', { c1: 0x6a3a1a, c2: 0x3a1c0a, c3: 0xd0a050, p: [0.7, 0.8, 0.07, 0] });
  g.add(rbox(len, h - 0.06, d - 0.1, 0.02, front, { pos: [0, 0, -0.05] }));
  g.add(mesh(cached(`barTop|${len}`, () => roundedBoxGeo(len + 0.1, 0.07, d + 0.06, 0.03, 3, 1).translate(0, h - 0.035, 0.03)), mat('wood', { c1: 0x4a200c, c2: 0x200a04, p: [2.4, 0, 0, 0] })));
  const rail = [tubeGeo([[-len / 2, 0.2, d / 2 + 0.12], [len / 2, 0.2, d / 2 + 0.12]], 0.025, 8)];
  for (let x = -len / 2 + 0.3; x < len / 2; x += 1.2) rail.push(tubeGeo([[x, 0.2, d / 2 + 0.12], [x, 0.14, d / 2 + 0.06], [x, 0.14, d / 2 - 0.05]], 0.012, 6));
  g.add(mesh(merge(rail), P.gold));
  return g;
}

/** The back bar: shelves of bottles (lit from below at night), a long mirror, beer taps. Faces +z. */
export function backBar(P, r, len, { night = false } = {}) {
  const g = new THREE.Group();
  const wood = mat('wood', { c1: 0x5a2e14, c2: 0x2a1206, p: [2.6, 0, 0, 0] });
  g.add(rbox(len, 0.9, 0.5, 0.015, wood, { pos: [0, 0, 0] }));
  g.add(rbox(len + 0.04, 0.04, 0.54, 0.012, wood, { pos: [0, 0.9, 0] }));
  g.add(mesh(new THREE.PlaneGeometry(len - 0.2, 0.9), MIRROR(), { pos: [0, 1.5, -0.22], shadow: false }));
  const shelves = [];
  for (const y of [1.08, 1.5, 1.92]) shelves.push(bake(beamGeo(len, 0.03, 0.24, 0.006), [0, y, -0.12]));
  for (const s of [-1, 1]) shelves.push(bake(beamGeo(0.08, 1.4, 0.3, 0.01), [s * (len / 2 - 0.04), 1.6, -0.1]));
  shelves.push(bake(beamGeo(len + 0.1, 0.14, 0.32, 0.02), [0, 2.34, -0.1]));
  g.add(mesh(merge(shelves), wood));
  const cols = [0x3a7a3a, 0x8a3a1a, 0xd8c070, 0x2a3a6a, 0xa8a8a0];
  const byC = new Map();
  for (const y of [0.92, 1.1, 1.52, 1.94]) {
    for (let x = -len / 2 + 0.2; x < len / 2 - 0.15; x += r.range(0.1, 0.19)) {
      const c = r.pick(cols);
      if (!byC.has(c)) byC.set(c, []);
      byC.get(c).push(bake(r.chance(0.5) ? TW.bottleGeo() : TW.wineBottleGeo(), [x, y, y < 1 ? 0.12 : -0.12], [0, 0, 0], r.range(0.85, 1.1)));
    }
  }
  for (const [c, list] of byC) g.add(mesh(merge(list), new THREE.MeshStandardMaterial({ color: c, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.82 }), { shadow: false }));
  if (night) for (const y of [1.1, 1.52, 1.94]) g.add(mesh(new THREE.PlaneGeometry(len - 0.2, 0.012), glowMat(0xffb060, 2.4), { pos: [0, y - 0.03, -0.0], rot: [-Math.PI / 2, 0, 0], shadow: false }));
  const taps = [];
  for (let k = 0; k < 4; k++) taps.push(bake(cached('tap2', () => merge([latheGeo([[0, 0], [0.02, 0], [0.018, 0.1], [0, 0.1]], 10), latheGeo([[0, 0], [0.012, 0], [0.016, 0.14], [0, 0.15]], 8).translate(0, 0.1, 0)])), [-0.3 + k * 0.2, 1.08, 0.9]));
  g.add(mesh(merge(taps), CHROME()));
  return g;
}

/** A bar stool: chrome pedestal, a buttoned red seat 0.76 high. */
export function barStool() {
  const g = new THREE.Group();
  g.add(mesh(cached('stoolPed', () => weldNormals(latheGeo([[0, 0], [0.22, 0], [0.22, 0.02], [0.05, 0.05], [0.035, 0.1], [0.03, 0.66], [0.06, 0.7], [0, 0.7]], 18))), CHROME()));
  g.add(mesh(cached('stoolRing', () => new THREE.TorusGeometry(0.17, 0.012, 6, 20).rotateX(Math.PI / 2)), CHROME(), { pos: [0, 0.28, 0] }));
  g.add(mesh(cached('stoolSeat', () => weldNormals(latheGeo([[0, 0], [0.18, 0], [0.2, 0.02], [0.2, 0.05], [0.17, 0.08], [0, 0.085]], 20))), mat('fabric', { c1: 0xb01a22, c2: 0x6a0a10, p: [0.6, 0.7, 0, 0.3] }), { pos: [0, 0.69, 0] }));
  return g;
}

/** A brass stanchion; rope() hangs the 2-inch nylon rope between two of them. */
export function stanchion() {
  return mesh(cached('stanchion', () => weldNormals(latheGeo([[0, 0], [0.18, 0], [0.18, 0.03], [0.1, 0.06], [0.03, 0.08], [0.022, 0.9], [0.035, 0.93], [0.045, 0.97], [0.03, 1.01], [0, 1.02]], 18))), IM.brass());
}
export function rope(a, b, { sag = 0.25, r = 0.026 } = {}) {
  const pts = [];
  for (let k = 0; k <= 12; k++) {
    const t = k / 12;
    pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * sag, a[2] + (b[2] - a[2]) * t]);
  }
  return mesh(tubeGeo(pts, r, 24), mat('fabric', { c1: 0xf4f0e6, c2: 0xd8d0c0, p: [0.9, 0.1, 0, 1] }), { shadow: false });
}

/** A round restaurant table with a hanging cloth (folds at the hem), a candle and settings. */
export function bistroTable(r, { night = false, R = 0.5, h = 0.75 } = {}) {
  const g = new THREE.Group();
  const cloth = cached(`roundCloth|${R}|${h}`, () => {
    const pts = [[0, h + 0.005], [R, h + 0.005], [R + 0.03, h - 0.02], [R + 0.05, h - 0.12]];
    for (let k = 1; k <= 5; k++) pts.push([R + 0.05 + k * 0.02, h - 0.12 - k * (h - 0.16) / 5]);
    const c = new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), 64);
    const p = c.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      const k = Math.max(0, Math.min(1, (h - 0.04 - y) / (h - 0.1)));
      const a = Math.atan2(p.getZ(i), p.getX(i));
      const f = 1 + k * 0.07 * Math.sin(a * 9);
      p.setX(i, p.getX(i) * f);
      p.setZ(i, p.getZ(i) * f);
    }
    c.computeVertexNormals();
    return c;
  });
  g.add(mesh(cloth, mat('fabric', { c1: 0xf6f2ea, c2: 0xe2dccf, p: [1.4, 0.05, 0, 1], side: THREE.DoubleSide })));
  const settings = [];
  const glasses = [];
  for (let k = 0; k < 2; k++) {
    const a = k * Math.PI + 0.3;
    settings.push(bake(TW.plateGeo(), [Math.cos(a) * R * 0.6, h + 0.008, Math.sin(a) * R * 0.6]));
    glasses.push(bake(TW.cocktailGeo(), [Math.cos(a + 0.5) * R * 0.55, h + 0.008, Math.sin(a + 0.5) * R * 0.55]));
  }
  g.add(mesh(merge(settings), mat('matte', { c1: 0xf8f4ec, p: [0.25, 0, 0, 0] })));
  g.add(mesh(merge(glasses), glassM(), { shadow: false }));
  g.add(mesh(cached('candleGlass', () => latheGeo([[0, 0], [0.04, 0], [0.045, 0.1], [0.04, 0.1], [0.035, 0.005], [0, 0.005]], 14)), glassM(), { pos: [0, h + 0.008, 0], shadow: false }));
  g.add(mesh(cached('candleFlame', () => new THREE.SphereGeometry(0.012, 8, 6)), night ? glowMat(0xffc070, 3) : mat('matte', { c1: 0xf4ecd8, p: [0.4, 0, 0, 0] }), { pos: [0, h + 0.06, 0], scale: [1, night ? 1.8 : 1, 1], shadow: false }));
  return g;
}

/** A bentwood bistro chair, facing +z. */
export function bistroChair() {
  const g = new THREE.Group();
  const wood = mat('wood', { c1: 0x3a1e0c, c2: 0x1a0c04, p: [4, 0, 0, 0] });
  const parts = [];
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) parts.push(tubeGeo([[sx * 0.2, 0, sz * 0.2], [sx * 0.17, 0.44, sz * 0.16]], 0.014, 4));
  parts.push(new THREE.TorusGeometry(0.15, 0.01, 5, 20).rotateX(Math.PI / 2).translate(0, 0.2, 0));
  parts.push(tubeGeo([[-0.17, 0.44, -0.16], [-0.18, 0.7, -0.22], [-0.12, 0.86, -0.25], [0, 0.88, -0.26], [0.12, 0.86, -0.25], [0.18, 0.7, -0.22], [0.17, 0.44, -0.16]], 0.013, 24));
  parts.push(tubeGeo([[-0.14, 0.62, -0.2], [0, 0.66, -0.23], [0.14, 0.62, -0.2]], 0.01, 10));
  g.add(mesh(merge(parts), wood));
  g.add(mesh(cached('bistroSeat', () => weldNormals(latheGeo([[0, 0], [0.2, 0], [0.21, 0.02], [0.2, 0.035], [0, 0.035]], 20))), mat('fabric', { c1: 0xd6bc86, c2: 0x9a7c48, p: [0.5, 0, 0, 1] }), { pos: [0, 0.44, 0] }));
  return g;
}

/** The dance floor w × d: parquet by day; at night a lit disco floor of flickering tiles. */
export function danceFloor(w, d, { night = false } = {}) {
  const m = night
    ? mat('tile', { c1: 0xff3aa0, c2: 0x3ac8ff, c3: 0xffd23a, p: [0.6, 0.03, 1, 0], q: [1.3, 0, 0, 0] })
    : mat('tile', { c1: 0x8a5a30, c2: 0x6a4222, c3: 0xa06a3a, p: [0.3, 0.012, 0.8, 0] });
  const g = new THREE.Group();
  g.add(mesh(cached(`dance|${w}|${d}`, () => roundedBoxGeo(w, 0.06, d, 0.02, 1, 1).translate(0, 0.03, 0)), m, { shadow: false }));
  g.add(mesh(cached(`danceEdge|${w}|${d}`, () => {
    const p = [];
    for (const s of [-1, 1]) { p.push(bake(beamGeo(w + 0.1, 0.07, 0.05, 0.01), [0, 0.035, s * (d / 2 + 0.025)])); p.push(bake(beamGeo(0.05, 0.07, d, 0.01), [s * (w / 2 + 0.025), 0.035, 0])); }
    return merge(p);
  }), IM.brass(), { shadow: false }));
  return g;
}

/** The band's stage w wide (along x), front toward +z: drums, amps, speaker stacks, mic stands. */
export function bandStage(r, w, { night = false } = {}) {
  const g = new THREE.Group();
  const sh = 0.45;
  const d = 3.2;
  g.add(rbox(w, sh, d, 0.02, mat('wood', { c1: 0x2a1a10, c2: 0x140a06, p: [3, 0, 0, 0] }), { pos: [0, 0, 0] }));
  g.add(mesh(cached(`skirt|${w}`, () => {
    const c = new THREE.PlaneGeometry(w, sh, 60, 1);
    const p = c.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 18) * 0.02);
    c.computeVertexNormals();
    return c;
  }), mat('fabric', { c1: 0x5a0a14, c2: 0x2a0408, p: [1.1, 0.9, 0, 0.6], side: THREE.DoubleSide }), { pos: [0, sh / 2, d / 2 + 0.03] }));
  const shell = mat('matte', { c1: 0xb01a2a, c2: 0xd02a3a, p: [0.25, 1, 0.3, 0] });
  const chrome = CHROME();
  const skin = mat('matte', { c1: 0xf0ece0, p: [0.5, 0, 0, 0] });
  const kit = new THREE.Group();
  kit.add(mesh(cached('bassDrum', () => new THREE.CylinderGeometry(0.28, 0.28, 0.36, 24).rotateX(Math.PI / 2)), shell, { pos: [0, 0.28, 0] }));
  kit.add(mesh(cached('bassHead', () => new THREE.CircleGeometry(0.27, 24)), skin, { pos: [0, 0.28, 0.182], shadow: false }));
  for (const [x, y, z, rr, hh] of [[-0.42, 0.6, 0.2, 0.18, 0.14], [0.2, 0.72, -0.05, 0.13, 0.12], [-0.15, 0.74, -0.05, 0.12, 0.11], [0.5, 0.5, 0.15, 0.2, 0.3]]) {
    kit.add(mesh(cached(`tom|${rr}|${hh}`, () => new THREE.CylinderGeometry(rr, rr, hh, 20)), shell, { pos: [x, y, z] }));
    kit.add(mesh(cached(`tomHead|${rr}`, () => new THREE.CircleGeometry(rr - 0.005, 20).rotateX(-Math.PI / 2)), skin, { pos: [x, y + hh / 2 + 0.002, z], shadow: false }));
  }
  const brass = mat('gold', { c1: 0xc8a040, c2: 0xffffff, p: [0.5, 0.15, 0, 0] });
  for (const [x, z, y] of [[-0.7, 0.1, 1.05], [0.75, -0.2, 1.15], [-0.5, 0.5, 0.95]]) {
    kit.add(mesh(cached('cymbal', () => latheGeo([[0, 0.03], [0.04, 0.025], [0.06, 0.015], [0.22, 0], [0.22, -0.004], [0, 0.01]], 24)), brass, { pos: [x, y, z], rot: [0.2, 0, 0.15] }));
    kit.add(mesh(cached(`cymStand|${y}`, () => merge([new THREE.CylinderGeometry(0.01, 0.012, y, 6).translate(0, y / 2, 0), new THREE.ConeGeometry(0.2, 0.25, 3, 1, true).translate(0, 0.12, 0)])), chrome, { pos: [x, 0, z] }));
  }
  kit.position.set(0, sh, -0.6);
  g.add(kit);
  const amp = cached('amp', () => roundedBoxGeo(0.7, 0.62, 0.34, 0.03, 2, 1).translate(0, 0.31, 0));
  const grille = mat('fabric', { c1: 0x2a2a2a, c2: 0x141414, p: [2.2, 0, 0, 1] });
  for (const [x, stack] of [[-w / 2 + 0.6, 2], [w / 2 - 0.6, 2], [-1.4, 1], [1.5, 1]]) {
    for (let k = 0; k < stack; k++) {
      g.add(mesh(amp, mat('matte', { c1: 0x1a1a1a, p: [0.6, 0, 0, 0] }), { pos: [x, sh + k * 0.63, -d / 2 + 0.5] }));
      g.add(mesh(cached('ampGrille', () => new THREE.PlaneGeometry(0.62, 0.46)), grille, { pos: [x, sh + k * 0.63 + 0.28, -d / 2 + 0.672], shadow: false }));
    }
  }
  for (const x of [-1.2, 0, 1.3]) {
    g.add(mesh(cached('micStand', () => merge([latheGeo([[0, 0], [0.14, 0], [0.13, 0.02], [0.01, 0.04], [0, 0.04]], 12), new THREE.CylinderGeometry(0.008, 0.008, 1.5, 6).translate(0, 0.75, 0), tubeGeo([[0, 1.5, 0], [0, 1.55, 0.1], [0, 1.52, 0.2]], 0.007, 6), new THREE.SphereGeometry(0.025, 10, 8).translate(0, 1.52, 0.22)])), chrome, { pos: [x, sh, 0.9] }));
  }
  // lighting truss with coloured cans
  const truss = [tubeGeo([[-w / 2, 3.6, 0.9], [w / 2, 3.6, 0.9]], 0.04, 4), tubeGeo([[-w / 2, 3.6, 1.1], [w / 2, 3.6, 1.1]], 0.04, 4)];
  for (const s of [-1, 1]) truss.push(new THREE.CylinderGeometry(0.05, 0.05, 3.6, 6).translate(s * (w / 2 - 0.05), 1.8, 1.0));
  g.add(mesh(merge(truss), mat('metal', { c1: 0x3a3a3e, c2: 0x1a1a1c, p: [0.4, 0.2, 0, 0] })));
  const lampCols = [0xff3aa0, 0x3ac8ff, 0xffd23a, 0x9a4aff, 0xff5a2a];
  for (let k = 0; k < 5; k++) {
    const x = -w / 2 + 0.8 + (k * (w - 1.6)) / 4;
    g.add(mesh(cached('can', () => new THREE.CylinderGeometry(0.1, 0.12, 0.28, 12).rotateX(0.7)), mat('metal', { c1: 0x222226, c2: 0x111113, p: [0.5, 0, 0, 0] }), { pos: [x, 3.45, 1.0] }));
    g.add(mesh(cached('canLens', () => new THREE.CircleGeometry(0.1, 12)), night ? glowMat(lampCols[k], 3) : mat('matte', { c1: 0x444444, p: [0.1, 0, 0.5, 0] }), { pos: [x, 3.36, 1.1], rot: [-0.9, 0, 0], shadow: false }));
  }
  return g;
}

// the stables and the garage

/**
 * One horse stall w wide (along x) × d deep (toward -z from the aisle at z = 0):
 * plank partitions with iron bars above, a front with a sliding door and a
 * yoke for the horse's head, a hay rack and a bucket.
 */
export function stallGeo(w, d, { door = true } = {}) {
  return cached(`stall|${w}|${d}|${door}`, () => {
    const boards = [];
    const across = [];
    const bars = [];
    const lowH = 1.25;
    const topH = 2.1;
    // the partition on the stall's left (x = -w/2), running back from the aisle
    for (let y = 0.1; y < lowH; y += 0.2) boards.push(bake(beamGeo(d, 0.19, 0.05, 0.008), [-w / 2, y + 0.095, -d / 2], [0, Math.PI / 2, 0]));
    boards.push(bake(postGeo(topH + 0.1, 0.14, 0.02), [-w / 2, 0, -0.07]));
    boards.push(bake(postGeo(topH + 0.1, 0.14, 0.02), [-w / 2, 0, -d + 0.07]));
    boards.push(bake(beamGeo(d, 0.12, 0.12, 0.02), [-w / 2, topH + 0.04, -d / 2], [0, Math.PI / 2, 0]));
    boards.push(bake(beamGeo(d, 0.08, 0.09, 0.015), [-w / 2, lowH + 0.04, -d / 2], [0, Math.PI / 2, 0]));
    for (let z = -0.25; z > -d + 0.2; z -= 0.12) bars.push(bake(new THREE.CylinderGeometry(0.012, 0.012, topH - lowH - 0.04, 5), [-w / 2, (lowH + topH) / 2, z]));
    if (door) {
      // front: a sliding door (planks below, bars above) with a yoke cut-out for the head
      for (let y = 0.15; y < lowH; y += 0.2) across.push(bake(beamGeo(w * 0.55, 0.19, 0.05, 0.008), [-w * 0.2, y + 0.095, 0]));
      across.push(bake(beamGeo(w * 0.55 + 0.1, 0.1, 0.07, 0.012), [-w * 0.2, lowH + 0.04, 0.01]));
      across.push(bake(beamGeo(w, 0.1, 0.08, 0.012), [0, topH + 0.02, 0]));
      for (let x = -w / 2 + 0.12; x < w * 0.07; x += 0.12) if (Math.abs(x + w * 0.2) > 0.18) bars.push(bake(new THREE.CylinderGeometry(0.012, 0.012, topH - lowH - 0.06, 5), [x, (lowH + topH) / 2, 0]));
      bars.push(bake(beamGeo(w + 0.05, 0.03, 0.03, 0.006), [0, topH - 0.06, 0.05]));
    }
    return { boards: merge(boards), across: across.length ? merge(across) : null, bars: merge(bars) };
  });
}

/** A bale of hay with two twine bands. */
export function hayBaleGeo() {
  return cached('bale', () => {
    const b = roundedBoxGeo(0.9, 0.42, 0.46, 0.05, 2, 3);
    const p = b.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + Math.sin(p.getX(i) * 23 + p.getZ(i) * 17) * 0.006);
    b.computeVertexNormals();
    return b.translate(0, 0.21, 0);
  });
}
export const HAY = () => mat('bark', { c1: 0xd8b86a, c2: 0x9a7a3a, p: [260, 6, 0, 0] });

/** A hurricane lantern hanging from a hook (glowing at night). */
export function lantern({ night = false } = {}) {
  const g = new THREE.Group();
  g.add(mesh(cached('lanternFrame', () => merge([
    latheGeo([[0, 0], [0.08, 0], [0.085, 0.04], [0.06, 0.06], [0, 0.06]], 12),
    latheGeo([[0, 0.26], [0.06, 0.26], [0.075, 0.28], [0.04, 0.33], [0.015, 0.36], [0, 0.37]], 12),
    tubeGeo([[-0.06, 0.37, 0], [0, 0.45, 0], [0.06, 0.37, 0]], 0.004, 8),
  ])), IM.blackIron()));
  g.add(mesh(cached('lanternGlass', () => weldNormals(latheGeo([[0.05, 0.06], [0.075, 0.12], [0.078, 0.18], [0.06, 0.24], [0.045, 0.27]], 14))), night ? glowMat(0xffb060, 1.8) : glassM(), { shadow: false }));
  return g;
}

/** Garden and stable tools, leaning: kind rake | shovel | hoe | fork | spade. Stands on y = 0, leaning back. */
export function toolGeo(kind) {
  return cached(`tool|${kind}`, () => {
    const handle = new THREE.CylinderGeometry(0.016, 0.018, 1.35, 6).translate(0, 0.675 + 0.28, 0);
    const parts = [handle];
    if (kind === 'rake') {
      parts.push(bake(beamGeo(0.45, 0.03, 0.03, 0.006), [0, 0.28, 0]));
      for (let k = 0; k < 10; k++) parts.push(new THREE.CylinderGeometry(0.004, 0.004, 0.08, 4).translate(-0.2 + k * 0.045, 0.24, 0.0));
    } else if (kind === 'fork') {
      for (let k = 0; k < 4; k++) parts.push(tubeGeo([[-0.09 + k * 0.06, 0.28, 0], [-0.1 + k * 0.066, 0.12, 0.02], [-0.11 + k * 0.073, 0.0, 0.05]], 0.006, 6));
      parts.push(bake(beamGeo(0.2, 0.03, 0.02, 0.005), [0, 0.28, 0]));
    } else if (kind === 'hoe') {
      parts.push(bake(beamGeo(0.18, 0.1, 0.006, 0.002), [0, 0.28, 0.06], [0.9, 0, 0]));
    } else {
      const blade = latheGeo([[0, 0], [0.12, 0.05], [0.13, 0.2], [0.03, 0.28], [0, 0.28]], 8);
      blade.scale(1, 1, 0.12);
      parts.push(blade.translate(0, kind === 'spade' ? 0.0 : 0.0, 0));
    }
    return merge(parts);
  });
}

/** A steel oil drum (lathe with rolling hoops). */
export function oilDrumGeo() {
  return cached('drum2', () => weldNormals(latheGeo([[0, 0], [0.29, 0], [0.3, 0.02], [0.3, 0.28], [0.31, 0.3], [0.3, 0.32], [0.3, 0.56], [0.31, 0.58], [0.3, 0.6], [0.3, 0.86], [0.29, 0.88], [0, 0.88]], 24)));
}

/** A workbench with a vice, a hammer, a wrench and greasy rags; front toward +z. */
export function workbench(r, { w = 2.2 } = {}) {
  const g = new THREE.Group();
  const wood = IM.barnOld();
  const parts = [];
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) parts.push(bake(postGeo(0.86, 0.09, 0.012), [sx * (w / 2 - 0.08), 0, sz * 0.28]));
  for (let k = 0; k < 4; k++) parts.push(bake(beamGeo(w, 0.05, 0.17, 0.008), [0, 0.885, -0.28 + k * 0.18]));
  parts.push(bake(beamGeo(w - 0.1, 0.03, 0.6, 0.006), [0, 0.2, 0]));
  parts.push(bake(beamGeo(w, 0.6, 0.03, 0.006), [0, 1.2, -0.34]));
  g.add(mesh(merge(parts), wood));
  const iron = IM.blackIron();
  g.add(mesh(cached('vice', () => merge([bake(beamGeo(0.2, 0.1, 0.12, 0.01), [0, 0.05, 0]), bake(beamGeo(0.2, 0.1, 0.04, 0.01), [0, 0.05, 0.1]), new THREE.CylinderGeometry(0.01, 0.01, 0.3, 6).rotateX(Math.PI / 2).translate(0, 0.04, 0.22)])), mat('metal', { c1: 0x3a5a7a, c2: 0x1a2a3a, p: [0.4, 0.4, 0, 0] }), { pos: [w / 2 - 0.3, 0.91, 0.18] }));
  g.add(mesh(cached('hammer', () => merge([new THREE.CylinderGeometry(0.012, 0.014, 0.3, 6).rotateZ(Math.PI / 2), bake(beamGeo(0.03, 0.1, 0.03, 0.005), [0.15, 0, 0])])), iron, { pos: [-0.3, 0.925, 0.1], rot: [0, 0.4, 0] }));
  g.add(mesh(cached('wrench', () => merge([bake(beamGeo(0.25, 0.01, 0.025, 0.003), [0, 0, 0]), new THREE.TorusGeometry(0.025, 0.008, 4, 10, 4.5).rotateX(Math.PI / 2).translate(0.14, 0, 0)])), mat('metal', { c1: 0xa8acb0, c2: 0x5a5e62, p: [0.3, 0.4, 0, 0] }), { pos: [0.1, 0.915, 0.05], rot: [0, -0.3, 0] }));
  // greasy rags: small crumpled cloths over the edge
  const rag = mat('cloth', { c1: 0x6a6258, c2: 0x2a2418, p: [9, 0, 0, 0], side: THREE.DoubleSide });
  for (const [x, s] of [[-0.8, 1], [0.5, 2]]) {
    const dg = drapeGeo({ w: 0.25, d: 0.22, top: 0.91, drop: 0.14, r: 0.02, folds: 7, foldAmp: 0.02, wrinkle: 0.01, puff: 0.01, flare: 0.1, foot: true, seed: s, res: 24 });
    g.add(mesh(dg, rag, { pos: [x, 0, 0.21], rot: [0, 0, 0] }));
  }
  // cans on the shelf
  const cans = [];
  for (let k = 0; k < 5; k++) cans.push(bake(cached('paintCan', () => latheGeo([[0, 0], [0.08, 0], [0.085, 0.01], [0.085, 0.17], [0.08, 0.18], [0, 0.18]], 14)), [-w / 2 + 0.3 + k * 0.3, 0.215, r.range(-0.1, 0.1)]));
  g.add(mesh(merge(cans), mat('metal', { c1: 0x9a8a6a, c2: 0x5a3a2a, p: [0.5, 0.7, 0, 0] })));
  return g;
}

/** A wheelbarrow with a spoked wheel, facing +z (handles toward -z). */
export function wheelbarrow() {
  const g = new THREE.Group();
  const tray = cached('barrowTray', () => {
    const t = new THREE.CylinderGeometry(0.4, 0.28, 0.3, 4, 1, true, Math.PI / 4);
    t.scale(1, 1, 1.4);
    return t;
  });
  g.add(mesh(tray, mat('metal', { c1: 0x4a6a4a, c2: 0x3a2a1a, p: [0.5, 0.8, 0, 0], side: THREE.DoubleSide }), { pos: [0, 0.55, 0] }));
  g.add(mesh(cached('barrowFrame', () => merge([
    tubeGeo([[-0.25, 0.4, -1.0], [-0.22, 0.42, 0], [-0.08, 0.25, 0.5]], 0.02, 10), tubeGeo([[0.25, 0.4, -1.0], [0.22, 0.42, 0], [0.08, 0.25, 0.5]], 0.02, 10),
    tubeGeo([[-0.22, 0.4, -0.3], [-0.22, 0.0, -0.35]], 0.015, 4), tubeGeo([[0.22, 0.4, -0.3], [0.22, 0.0, -0.35]], 0.015, 4),
  ])), IM.barnOld()));
  g.add(mesh(cached('barrowWheel', () => new THREE.TorusGeometry(0.19, 0.04, 8, 20).rotateY(Math.PI / 2)), mat('matte', { c1: 0x1a1a1a, p: [0.8, 0, 0, 0] }), { pos: [0, 0.23, 0.5] }));
  return g;
}
