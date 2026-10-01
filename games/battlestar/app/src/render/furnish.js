// Furniture and fittings built with the modelling toolkit (model.js), in two
// candidate art styles for the owner to choose between:
//   'a'  realistic-warm: real proportions, turned legs, tufted velvet,
//        a linen duvet with folds, profiled mouldings, woods and metals
//   'b'  stylised-clean: the same anatomy, simplified — big radii, smooth
//        cloth, flat lacquer colours, a small cohesive palette
// Every piece is a function returning a THREE.Group, front toward +z,
// standing on y = 0.

import * as THREE from 'three';
import { mat, glowMat } from './materials.js';
import { mesh } from './geo.js';
import { rbox, cushionGeo, drapeGeo, tuftedGeo, latheGeo, profileRun, PROFILES, blobGeo } from './model.js';

export const ART_STYLES = ['a', 'b'];
const CORNERS = [[-1, -1], [1, -1], [-1, 1], [1, 1]];

/** Materials per style. */
export function palette(style) {
  if (style === 'b') {
    return {
      style,
      wall: mat('matte', { c1: 0xe4c3a0, c2: 0xf1dfc8, p: [0.93, 3.2, 0, 0] }),
      ceil: mat('matte', { c1: 0xf7eee2, p: [0.95, 0, 0, 0] }),
      floor: mat('matte', { c1: 0xbf9a74, p: [0.97, 0, 0, 0] }),
      trim: mat('matte', { c1: 0xfbf5ec, p: [0.55, 0, 0, 0] }),
      wood: mat('matte', { c1: 0xb96f3c, c2: 0xc98150, p: [0.5, 1.1, 0, 0] }),
      woodDark: mat('matte', { c1: 0x7e4626, p: [0.55, 0, 0, 0] }),
      gold: mat('matte', { c1: 0xe8b64a, p: [0.32, 0, 0.75, 0] }),
      linen: mat('matte', { c1: 0xf1e6d2, c2: 0xfaf4ea, p: [0.9, 0.9, 0, 0], side: THREE.DoubleSide }),
      sheet: mat('matte', { c1: 0xfbf8f3, p: [0.9, 0, 0, 0] }),
      velvet: mat('matte', { c1: 0x2c8a84, c2: 0x3aa198, p: [0.8, 1.2, 0, 0] }),
      velvetDS: mat('matte', { c1: 0x2c8a84, c2: 0x3aa198, p: [0.8, 1.2, 0, 0], side: THREE.DoubleSide }),
      accent: mat('matte', { c1: 0xd7705a, c2: 0xe3846c, p: [0.8, 1.5, 0, 0] }),
      ceramic: mat('matte', { c1: 0xf4efe6, p: [0.4, 0, 0, 0] }),
      shade: glowMat(0xfff0d2, 0.85, { side: THREE.DoubleSide }),
      bezel: mat('matte', { c1: 0x2b3440, p: [0.45, 0, 0.3, 0] }),
      rug: mat('matte', { c1: 0xeadfca, p: [0.98, 0, 0, 0] }),
    };
  }
  return {
    style,
    wall: null, // keeps the mahogany boiserie
    ceil: null,
    floor: null,
    trim: mat('plaster', { c1: 0xeee3cc, c2: 0xeee3cc, p: [0, 0, 0, 0] }),
    wood: mat('wood', { c1: 0x6e3016, c2: 0x2c1006, p: [2.2, 0, 0, 0] }),
    woodDark: mat('wood', { c1: 0x3a180a, c2: 0x160804, p: [2.6, 0, 0, 0] }),
    gold: mat('gold', { c1: 0xe2b457, c2: 0xffffff, p: [0.4, 0.22, 0, 0] }),
    linen: mat('fabric', { c1: 0xf0e7d6, c2: 0xdccfb6, p: [0.9, 0.15, 0, 1], side: THREE.DoubleSide }),
    sheet: mat('fabric', { c1: 0xfbf8f2, c2: 0xe8e2d6, p: [1.4, 0.1, 0, 1] }),
    velvet: mat('fabric', { c1: 0x6e1222, c2: 0x3e0814, p: [1.1, 0.9, 0, 0.6] }),
    velvetDS: mat('fabric', { c1: 0x6e1222, c2: 0x3e0814, p: [1.1, 0.9, 0, 0.6], side: THREE.DoubleSide }),
    accent: mat('fabric', { c1: 0x6e1222, c2: 0x3e0814, p: [1.1, 0.9, 0, 0.6] }),
    ceramic: mat('matte', { c1: 0xefe4cf, c2: 0xf6eee0, p: [0.3, 0.4, 0, 0] }),
    shade: glowMat(0xf2d4a0, 0.9, { side: THREE.DoubleSide }),
    bezel: mat('metal', { c1: 0x30343a, c2: 0x121417, p: [0.28, 0.1, 0, 0] }),
    platinum: mat('metal', { c1: 0xe6e9ee, c2: 0xa3a9b1, p: [0.14, 0.03, 0, 0] }),
    rug: mat('carpet', { c1: 0x5c4232, c2: 0x2c1e16, c3: 0xffffff, p: [95, 0.9, 0, 0] }),
  };
}

// ---------------------------------------------------------------- small parts

/** A turned leg (A) or a rounded capsule foot (B), height h. */
export function leg(P, h, fat = 1) {
  if (P.style === 'b') {
    const g = new THREE.CapsuleGeometry(0.035 * fat, Math.max(0.01, h - 0.07 * fat), 6, 16);
    g.translate(0, h / 2, 0);
    return mesh(g, P.woodDark);
  }
  const k = fat;
  return mesh(latheGeo([[0, 0], [0.03 * k, 0], [0.036 * k, h * 0.08], [0.032 * k, h * 0.2], [0.042 * k, h * 0.34], [0.03 * k, h * 0.5],
    [0.026 * k, h * 0.72], [0.034 * k, h * 0.84], [0.04 * k, h * 0.92], [0.042 * k, h]], 20), P.woodDark);
}

/** A knob (drawer pull) facing +z. */
export function knob(P) {
  const g = P.style === 'b'
    ? new THREE.SphereGeometry(0.02, 16, 12)
    : latheGeo([[0, 0], [0.011, 0], [0.008, 0.01], [0.017, 0.022], [0.015, 0.03], [0, 0.032]], 16);
  if (P.style !== 'b') g.rotateX(Math.PI / 2);
  return mesh(g, P.gold);
}

/** A rectangular inlay outline (thin metal strips) of w × h on a face. */
export function inlay(P, w, h, t = 0.006) {
  const g = new THREE.Group();
  const m = P.gold;
  g.add(rbox(w, t, t, t / 2.2, m, { pos: [0, h / 2, 0], center: true }), rbox(w, t, t, t / 2.2, m, { pos: [0, -h / 2, 0], center: true }));
  g.add(rbox(t, h, t, t / 2.2, m, { pos: [-w / 2, 0, 0], center: true }), rbox(t, h, t, t / 2.2, m, { pos: [w / 2, 0, 0], center: true }));
  return g;
}

// ---------------------------------------------------------------- the bed

/** A king bed, head toward -z. Returns { group, length }. */
export function bed(P, seed = 1) {
  const g = new THREE.Group();
  const B = P.style === 'b';
  const W = 2.1;
  const L = 2.3;
  const legH = B ? 0.1 : 0.13;
  const baseH = B ? 0.3 : 0.26;
  for (const [sx, sz] of CORNERS) {
    const l = leg(P, legH, B ? 1.3 : 1.2);
    l.position.set(sx * (W / 2 - (B ? 0.18 : 0.1)), 0, sz * (L / 2 - (B ? 0.18 : 0.1)));
    g.add(l);
  }
  // base with rails
  g.add(rbox(W, baseH, L, B ? 0.1 : 0.025, P.wood, { pos: [0, legH, 0] }));
  if (!B) g.add(rbox(W + 0.006, 0.012, L + 0.006, 0.005, P.gold, { pos: [0, legH + baseH * 0.72, 0] }));
  // mattress
  const mBase = legH + baseH;
  const mh = 0.24;
  g.add(mesh(cushionGeo(W - 0.1, mh, L - 0.08, { r: B ? 0.1 : 0.07, puff: 0.06, under: 0, pinch: 0 }), P.sheet, { pos: [0, mBase + mh / 2, 0.02] }));
  const top = mBase + mh + 0.012;
  // duvet from the turn-down line to the foot, hanging over the sides and foot
  const dd = (L - 0.08) * 0.74;
  const duvetZ = 0.02 + (L - 0.08) / 2 - dd / 2;
  g.add(mesh(drapeGeo(B
    ? { w: W - 0.1, d: dd, top, drop: 0.3, r: 0.12, folds: 0, foldAmp: 0, wrinkle: 0, puff: 0.08, flare: 0.05, seed }
    : { w: W - 0.1, d: dd, top, drop: 0.32, r: 0.06, folds: 2.6, foldAmp: 0.035, wrinkle: 0.007, puff: 0.06, seed }), P.linen, { pos: [0, 0, duvetZ] }));
  // the turned-down fold of the duvet, showing the sheet
  const headEdge = duvetZ - dd / 2;
  g.add(mesh(cushionGeo(W - 0.04, B ? 0.08 : 0.06, 0.34, { r: B ? 0.04 : 0.03, puff: 0.35, under: 0.1, pinch: 0 }), P.sheet, { pos: [0, top + (B ? 0.05 : 0.04), headEdge + 0.15] }));
  // pillows: two sleeping pillows leaning on the headboard, two accent cushions
  const pil = cushionGeo(0.78, 0.17, 0.5, { r: B ? 0.08 : 0.06, puff: B ? 0.75 : 0.55, under: 0.5, pinch: B ? 0.05 : 0.18 });
  for (const s of [-1, 1]) g.add(mesh(pil, P.sheet, { pos: [s * 0.45, top + 0.15, -L / 2 + 0.34], rot: [-0.5, s * 0.05, s * 0.02] }));
  const acc = cushionGeo(0.46, 0.13, 0.36, { r: B ? 0.07 : 0.05, puff: B ? 0.7 : 0.5, under: 0.5, pinch: B ? 0.05 : 0.2 });
  for (const s of [-1, 1]) g.add(mesh(acc, s < 0 ? P.velvet : P.accent, { pos: [s * 0.28, top + 0.19, -L / 2 + 0.64], rot: [-0.8, -s * 0.16, s * 0.06] }));
  // headboard
  const hbW = W + 0.16;
  const hbH = B ? 1.15 : 1.32;
  const hbZ = -L / 2 - 0.07;
  if (B) {
    g.add(rbox(hbW, hbH, 0.16, 0.08, P.wood, { pos: [0, 0, hbZ - 0.02] }));
    g.add(rbox(hbW - 0.2, hbH - 0.48, 0.1, 0.05, P.accent, { pos: [0, 0.5, hbZ + 0.08] }));
  } else {
    g.add(rbox(hbW, hbH, 0.1, 0.03, P.wood, { pos: [0, 0, hbZ] }));
    g.add(rbox(hbW + 0.06, 0.06, 0.15, 0.025, P.woodDark, { pos: [0, hbH - 0.03, hbZ] }));
    g.add(rbox(hbW + 0.07, 0.01, 0.155, 0.004, P.gold, { pos: [0, hbH - 0.045, hbZ] }));
    const pw = W - 0.14;
    const ph = 0.74;
    const py = 0.93;
    const tg = tuftedGeo(pw, ph, { cols: 7, rows: 3, depth: 0.075, edge: 0.05 });
    g.add(mesh(tg, P.velvet, { pos: [0, py, hbZ + 0.05] }));
    const btn = new THREE.SphereGeometry(0.014, 10, 8);
    for (const [bx, by, bz] of tg.userData.buttons) g.add(mesh(btn, P.gold, { pos: [bx, py + by, hbZ + 0.05 + bz + 0.006], shadow: false }));
    // moulded frame around the upholstery
    const fm = P.woodDark;
    g.add(rbox(pw + 0.1, 0.05, 0.06, 0.02, fm, { pos: [0, py + ph / 2 + 0.025, hbZ + 0.07], center: true }));
    g.add(rbox(pw + 0.1, 0.05, 0.06, 0.02, fm, { pos: [0, py - ph / 2 - 0.025, hbZ + 0.07], center: true }));
    for (const s of [-1, 1]) g.add(rbox(0.05, ph + 0.1, 0.06, 0.02, fm, { pos: [s * (pw / 2 + 0.025), py, hbZ + 0.07], center: true }));
    // finials
    const fin = latheGeo([[0, 0], [0.03, 0], [0.04, 0.03], [0.025, 0.06], [0.035, 0.09], [0.018, 0.12], [0, 0.13]], 18);
    for (const s of [-1, 1]) g.add(mesh(fin, P.gold, { pos: [s * (hbW / 2 - 0.02), hbH, hbZ] }));
  }
  // a runner (A: velvet with a gold figure; B: a smooth teal throw) across the foot
  g.add(mesh(drapeGeo(B
    ? { w: W - 0.04, d: 0.6, top: top + 0.1, drop: 0.3, r: 0.14, folds: 0, foldAmp: 0, wrinkle: 0, puff: 0.01, flare: 0.04, foot: false, seed: seed + 3 }
    : { w: W - 0.04, d: 0.55, top: top + 0.085, drop: 0.36, r: 0.08, folds: 3.4, foldAmp: 0.02, wrinkle: 0.004, puff: 0.006, foot: false, seed: seed + 3 }), P.velvetDS, { pos: [0, 0, L / 2 - 0.5] }));
  return { group: g, length: L + 0.14, width: hbW };
}

// ---------------------------------------------------------------- case furniture

/** A bedside table with two drawers. */
export function nightstand(P) {
  const g = new THREE.Group();
  const B = P.style === 'b';
  const w = 0.58;
  const h = B ? 0.5 : 0.54;
  const d = 0.44;
  const legH = B ? 0.12 : 0.1;
  for (const [sx, sz] of CORNERS) {
    const l = leg(P, legH, B ? 0.9 : 0.8);
    l.position.set(sx * (w / 2 - 0.06), 0, sz * (d / 2 - 0.06));
    g.add(l);
  }
  g.add(rbox(w, h, d, B ? 0.09 : 0.015, P.wood, { pos: [0, legH, 0] }));
  if (!B) g.add(rbox(w + 0.04, 0.035, d + 0.04, 0.012, P.woodDark, { pos: [0, legH + h, 0] }));
  for (let k = 0; k < 2; k++) {
    const y = legH + h * (0.28 + k * 0.46);
    if (B) {
      g.add(rbox(w - 0.12, 0.015, 0.012, 0.006, P.woodDark, { pos: [0, y + h * 0.22, d / 2], center: true }));
    } else {
      g.add(rbox(w - 0.06, h * 0.4, 0.02, 0.008, P.wood, { pos: [0, y, d / 2], center: true }));
      const il = inlay(P, w - 0.12, h * 0.4 - 0.05, 0.005);
      il.position.set(0, y, d / 2 + 0.011);
      g.add(il);
    }
    const kb = knob(P);
    kb.position.set(0, y, d / 2 + (B ? 0.015 : 0.01));
    g.add(kb);
  }
  return g;
}

/** A table lamp, switched on. Returns { group, lightY }. */
export function tableLamp(P) {
  const g = new THREE.Group();
  if (P.style === 'b') {
    g.add(mesh(new THREE.SphereGeometry(0.12, 28, 20), P.ceramic, { pos: [0, 0.12, 0] }));
    g.add(mesh(latheGeo([[0, 0], [0.02, 0], [0.02, 0.12], [0, 0.12]], 12), P.gold, { pos: [0, 0.22, 0] }));
    const dome = new THREE.SphereGeometry(0.2, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    g.add(mesh(dome, P.shade, { pos: [0, 0.3, 0], shadow: false }));
    return { group: g, lightY: 0.36 };
  }
  g.add(mesh(latheGeo([[0, 0], [0.075, 0], [0.078, 0.012], [0.05, 0.03], [0.08, 0.1], [0.098, 0.18], [0.08, 0.25], [0.035, 0.29], [0.02, 0.31], [0.02, 0.4], [0, 0.4]], 32), P.ceramic));
  g.add(mesh(latheGeo([[0, 0], [0.03, 0], [0.034, 0.012], [0.02, 0.03], [0, 0.03]], 20), P.gold, { pos: [0, 0.28, 0] }));
  g.add(mesh(latheGeo([[0, 0], [0.084, 0], [0.086, 0.01], [0, 0.012]], 24), P.gold));
  // tapered drum shade with a rolled rim
  g.add(mesh(latheGeo([[0.2, 0], [0.205, 0.01], [0.2, 0.02], [0.13, 0.25], [0.135, 0.26], [0.13, 0.27]], 40), P.shade, { pos: [0, 0.36, 0], shadow: false }));
  return { group: g, lightY: 0.46 };
}

/** An upholstered armchair. */
export function armchair(P) {
  const g = new THREE.Group();
  const B = P.style === 'b';
  const W = 0.82;
  const D = 0.8;
  const legH = B ? 0.1 : 0.13;
  for (const [sx, sz] of CORNERS) {
    const l = leg(P, legH, 0.9);
    l.position.set(sx * (W / 2 - 0.08), 0, sz * (D / 2 - 0.08));
    g.add(l);
  }
  const up = P.velvet;
  g.add(rbox(W, 0.26, D, B ? 0.12 : 0.05, up, { pos: [0, legH, 0] }));
  g.add(mesh(cushionGeo(W - 0.26, 0.13, D - 0.2, { r: B ? 0.06 : 0.04, puff: 0.4, under: 0.2 }), up, { pos: [0, legH + 0.33, 0.06] }));
  // back
  if (B) {
    g.add(rbox(W, 0.62, 0.2, 0.1, up, { pos: [0, legH + 0.2, -D / 2 + 0.1] }));
  } else {
    g.add(rbox(W, 0.78, 0.14, 0.05, up, { pos: [0, legH + 0.2, -D / 2 + 0.07] }));
    const tg = tuftedGeo(W - 0.26, 0.48, { cols: 4, rows: 2, depth: 0.06, edge: 0.04, res: 60 });
    g.add(mesh(tg, up, { pos: [0, legH + 0.66, -D / 2 + 0.14], rot: [-0.12, 0, 0] }));
    const btn = new THREE.SphereGeometry(0.012, 8, 6);
    for (const [bx, by, bz] of tg.userData.buttons) {
      const b = mesh(btn, P.gold, { shadow: false });
      b.position.set(bx, by, bz + 0.005).applyEuler(new THREE.Euler(-0.12, 0, 0));
      b.position.add(new THREE.Vector3(0, legH + 0.66, -D / 2 + 0.14));
      g.add(b);
    }
  }
  // arms
  for (const s of [-1, 1]) {
    g.add(rbox(0.14, B ? 0.34 : 0.3, D - 0.04, B ? 0.07 : 0.05, up, { pos: [s * (W / 2 - 0.07), legH + 0.24, 0.02] }));
    if (!B) g.add(mesh(cushionGeo(0.17, 0.07, D - 0.02, { r: 0.03, puff: 0.5 }), up, { pos: [s * (W / 2 - 0.07), legH + 0.56, 0.02] }));
  }
  return g;
}

/** A long sideboard ("great wooden furniture inlaid with platinum and gold"). */
export function sideboard(P) {
  const g = new THREE.Group();
  const B = P.style === 'b';
  const w = 1.9;
  const h = B ? 0.66 : 0.72;
  const d = 0.5;
  const legH = B ? 0.12 : 0.1;
  for (const x of [-1, 1]) {
    for (const z of [-1, 1]) {
      const l = leg(P, legH, 1);
      l.position.set(x * (w / 2 - 0.08), 0, z * (d / 2 - 0.07));
      g.add(l);
    }
  }
  g.add(rbox(w, h, d, B ? 0.1 : 0.015, P.wood, { pos: [0, legH, 0] }));
  if (!B) {
    g.add(rbox(w + 0.05, 0.04, d + 0.05, 0.014, P.woodDark, { pos: [0, legH + h, 0] }));
    g.add(rbox(w + 0.055, 0.008, d + 0.055, 0.003, P.platinum, { pos: [0, legH + h + 0.016, 0] }));
  }
  for (let k = 0; k < 3; k++) {
    const x = (k - 1) * (w / 3);
    if (B) {
      if (k > 0) g.add(rbox(0.012, h - 0.16, 0.012, 0.005, P.woodDark, { pos: [x - w / 6, legH + h / 2, d / 2], center: true }));
      const kb = knob(P);
      kb.position.set(x + 0.2, legH + h * 0.6, d / 2 + 0.015);
      g.add(kb);
    } else {
      g.add(rbox(w / 3 - 0.05, h - 0.1, 0.022, 0.008, P.wood, { pos: [x, legH + h / 2, d / 2], center: true }));
      g.add(rbox(w / 3 - 0.2, h - 0.26, 0.03, 0.02, P.wood, { pos: [x, legH + h / 2, d / 2 + 0.01], center: true }));
      const il = inlay(P, w / 3 - 0.13, h - 0.19, 0.005);
      il.position.set(x, legH + h / 2, d / 2 + 0.012);
      g.add(il);
      const kb = knob(P);
      kb.position.set(x + (w / 3) * 0.32, legH + h * 0.55, d / 2 + 0.012);
      g.add(kb);
    }
  }
  // on top: a vase and a decanter
  const vase = B
    ? mesh(new THREE.CapsuleGeometry(0.08, 0.14, 6, 20), P.accent, { pos: [-0.5, legH + h + 0.15, 0] })
    : mesh(latheGeo([[0, 0], [0.06, 0], [0.065, 0.02], [0.11, 0.1], [0.12, 0.17], [0.07, 0.27], [0.05, 0.3], [0.065, 0.33], [0, 0.33]], 32), P.ceramic, { pos: [-0.5, legH + h + 0.04, 0] });
  g.add(vase);
  const dec = B
    ? mesh(new THREE.SphereGeometry(0.08, 24, 16), P.gold, { pos: [0.45, legH + h + 0.08, 0.05] })
    : mesh(latheGeo([[0, 0], [0.07, 0], [0.08, 0.06], [0.07, 0.14], [0.022, 0.2], [0.022, 0.27], [0.032, 0.29], [0.02, 0.3], [0, 0.3]], 32), P.gold, { pos: [0.45, legH + h + 0.04, 0.05] });
  g.add(dec);
  return g;
}

/** A rug: A a dark fur pelt with an organic outline, B a smooth oval. */
export function rug(P, seed = 1) {
  // (A has none: the stateroom's whole floor is already "a soft animal fur")
  if (P.style === 'b') return mesh(blobGeo(1.5, 1.0, { t: 0.02, wobble: 0, seed }), P.rug, { shadow: false });
  return null;
}

// ---------------------------------------------------------------- the room's fittings

/**
 * Skirting, a chair rail (A) and a cornice (A) or cove (B) along the inner
 * faces of a W × D × H room, broken at the doorways.
 */
export function roomTrim(P, { W, D, H, openings, doorW = 1.8, thick = 0.25 }) {
  const g = new THREE.Group();
  const B = P.style === 'b';
  const inset = thick / 2;
  const walls = [
    { key: 'ahead', along: 'x', at: -D / 2 + inset, from: -W / 2 + inset, to: W / 2 - inset, rot: Math.PI },
    { key: 'back', along: 'x', at: D / 2 - inset, from: -W / 2 + inset, to: W / 2 - inset, rot: 0 },
    { key: 'left', along: 'z', at: -W / 2 + inset, from: -D / 2 + inset, to: D / 2 - inset, rot: -Math.PI / 2 },
    { key: 'right', along: 'z', at: W / 2 - inset, from: -D / 2 + inset, to: D / 2 - inset, rot: Math.PI / 2 },
  ];
  const skirtM = B ? P.trim : P.woodDark;
  const runs = (wl, withGap) => {
    const o = openings[wl.key];
    if (!o || !withGap) return [[wl.from, wl.to]];
    const c = wl.along === 'x' ? o.x : o.z;
    return [[wl.from, c - doorW / 2 - 0.12], [c + doorW / 2 + 0.12, wl.to]].filter(([a, b]) => b - a > 0.05);
  };
  const place = (m, wl, a, b, y) => {
    const c = (a + b) / 2;
    m.rotation.y = wl.rot;
    if (wl.along === 'x') m.position.set(c, y, wl.at); else m.position.set(wl.at, y, c);
    g.add(m);
  };
  for (const wl of walls) {
    for (const [a, b] of runs(wl, true)) {
      place(profileRun(B ? PROFILES.roundSkirting : PROFILES.skirting, b - a, skirtM), wl, a, b, 0);
      if (!B) place(profileRun(PROFILES.rail, b - a, P.woodDark), wl, a, b, 0.95);
    }
    for (const [a, b] of runs(wl, false)) {
      place(profileRun(B ? PROFILES.cove : PROFILES.cornice, b - a + 0.25, P.trim, { shadow: false }), wl, a, b, H);
    }
    // architraves around a doorway
    const o = openings[wl.key];
    if (o && wl.key !== 'back') {
      const fr = new THREE.Group();
      const prof = B ? PROFILES.roundSkirting : PROFILES.architrave;
      const doorH = 2.6;
      const top = profileRun(prof, doorW + 0.24, B ? P.trim : P.woodDark);
      top.position.set(0, doorH, 0);
      fr.add(top);
      for (const s of [-1, 1]) {
        const v = profileRun(prof, doorH, B ? P.trim : P.woodDark);
        v.rotation.z = -s * Math.PI / 2;
        v.position.set(s * (doorW / 2 + 0.01), doorH / 2, 0);
        fr.add(v);
      }
      const c = wl.along === 'x' ? o.x : o.z;
      place(fr, wl, c, c, 0);
    }
  }
  return g;
}

/**
 * A frame for a window plane of w × h (added as the window's child: local
 * XY plane, the room toward +z).
 */
export function windowFrame(P, w, h) {
  const g = new THREE.Group();
  g.rotation.y = Math.PI; // profile runs project toward -z; the room is +z
  const B = P.style === 'b';
  if (B) {
    const t = 0.16;
    const m = P.trim;
    g.add(rbox(w + t * 2, t, 0.12, 0.06, m, { pos: [0, h / 2 + t / 2, 0], center: true }));
    g.add(rbox(w + t * 2, t, 0.2, 0.06, m, { pos: [0, -h / 2 - t / 2, -0.04], center: true }));
    for (const s of [-1, 1]) g.add(rbox(t, h, 0.12, 0.06, m, { pos: [s * (w / 2 + t / 2), 0, 0], center: true }));
    return g;
  }
  const m = P.woodDark;
  // each run's profile grows away from the opening
  const top = profileRun(PROFILES.architrave, w + 0.2, m);
  top.position.set(0, h / 2, 0);
  const bot = profileRun(PROFILES.architrave, w + 0.2, m);
  bot.position.set(0, -h / 2, 0);
  bot.rotation.z = Math.PI;
  g.add(top, bot);
  for (const s of [-1, 1]) {
    const v = profileRun(PROFILES.architrave, h + 0.2, m);
    v.rotation.z = -s * Math.PI / 2;
    v.position.set(s * (w / 2), 0, 0);
    g.add(v);
  }
  // sill with a gold edge
  g.add(rbox(w + 0.3, 0.05, 0.2, 0.015, P.woodDark, { pos: [0, -h / 2 - 0.12, -0.08], center: true }));
  g.add(rbox(w + 0.31, 0.008, 0.205, 0.003, P.gold, { pos: [0, -h / 2 - 0.1, -0.08], center: true }));
  // two mullions
  for (const s of [-1, 1]) g.add(rbox(0.04, h, 0.04, 0.012, m, { pos: [s * w / 6, 0, -0.02], center: true }));
  return g;
}

/** A bezel for a wall console of w (along the wall) × h, projecting toward +x of its parent. */
export function consoleBezel(P, len, h) {
  const g = new THREE.Group();
  const B = P.style === 'b';
  const t = B ? 0.1 : 0.06;
  const r = B ? 0.045 : 0.012;
  const m = P.bezel;
  g.add(rbox(0.06, t, len + 2 * t, r, m, { pos: [0, h / 2 + t / 2, 0], center: true }));
  g.add(rbox(0.06, t, len + 2 * t, r, m, { pos: [0, -h / 2 - t / 2, 0], center: true }));
  for (const s of [-1, 1]) g.add(rbox(0.06, h, t, r, m, { pos: [0, 0, s * (len / 2 + t / 2)], center: true }));
  if (!B) {
    g.add(rbox(0.004, 0.006, len + 2 * t, 0.002, P.platinum, { pos: [0.03, h / 2 + 0.008, 0], center: true }));
    g.add(rbox(0.004, 0.006, len + 2 * t, 0.002, P.platinum, { pos: [0.03, -h / 2 - 0.008, 0], center: true }));
  }
  return g;
}

/** Everything a stateroom holds, laid out for a W × D room with the bed on side `bedSide` (±1). */
export function stateroomSet(P, { W, D, bedSide, seed = 1 }) {
  const g = new THREE.Group();
  const { group: b, length: bl, width: bw } = bed(P, seed);
  const bedX = bedSide * W * 0.24;
  // headboard clear of the wall's inner face
  const bedZ = -D / 2 + 0.125 + 2.3 / 2 + 0.2;
  b.position.set(bedX, 0, bedZ);
  g.add(b);
  const lamps = [];
  for (const s of [-1, 1]) {
    const ns = nightstand(P);
    ns.position.set(bedX + s * (bw / 2 + 0.36), 0, -D / 2 + 0.125 + 0.3);
    g.add(ns);
    const { group: lamp, lightY } = tableLamp(P);
    lamp.position.set(ns.position.x, P.style === 'b' ? 0.62 : 0.675, ns.position.z - 0.02);
    g.add(lamp);
    lamps.push([lamp.position.x, lamp.position.y + lightY, lamp.position.z]);
  }
  const sb = sideboard(P);
  sb.position.set(-W / 2 + 0.125 + 0.27, 0, D * 0.05);
  sb.rotation.y = Math.PI / 2;
  g.add(sb);
  const ch = armchair(P);
  ch.position.set(W * 0.27, 0, D * 0.06);
  ch.rotation.y = -0.65;
  g.add(ch);
  const rg = rug(P, seed);
  if (rg) {
    rg.position.set(bedX * 0.35, 0.002, bedZ + bl / 2 + 0.2);
    g.add(rg);
  }
  return { group: g, lamps, bed: [bedX, 0, bedZ] };
}

// ---------------------------------------------------------------- the parlor (room 16)

// banisters named by the text: ivory (16), ebony (23), red coral (24)
const BANISTERS = {
  ivory: { bal: [0xf0e6d2, 0xf8f1e4, 0.28], rail: [0xefe4cf, 0.22] },
  ebony: { bal: [0x1c130d, 0x2e2016, 0.16], rail: [0x160f0a, 0.12] },
  coral: { bal: [0xb8402e, 0xd8634c, 0.42], rail: [0xc44a36, 0.36] },
};

/** Materials for staircases in style A; `banister` picks the balusters' and rail's finish. */
export function stairMats(P, banister = 'ivory') {
  const B = BANISTERS[banister] || BANISTERS.ivory;
  return {
    ivory: mat('matte', { c1: B.bal[0], c2: B.bal[1], p: [B.bal[2], 1.2, 0, 0] }),
    rail: mat('matte', { c1: B.rail[0], p: [B.rail[1], 0, 0, 0] }),
    gold: P.gold,
    tread: P.woodDark,
    riser: P.wood,
    runner: mat('fabric', { c1: 0x5e0e1c, c2: 0x3a0612, c3: 0xc9a050, p: [1.2, 0.8, 0, 0.6] }),
    stringer: mat('matte', { c1: 0xefe4cf, p: [0.3, 0, 0, 0] }),
    panel: mat('paneling', { c1: 0x6a3319, c2: 0x33160a, c3: 0xdfe3ea, p: [0.8, 0.9, 0.1, 0] }),
    soffit: mat('paneling', { c1: 0x5e2a14, c2: 0x2c1208, c3: 0xdfc890, p: [0.75, 0.6, 0.08, 0] }),
    shaft: mat('paneling', { c1: 0x3a1a0c, c2: 0x1a0a04, c3: 0xa08050, p: [1.1, 1.2, 0.1, 0] }),
    edge: mat('matte', { c1: 0xefe4cf, p: [0.4, 0, 0, 0] }),
    upperWall: mat('paneling', { c1: 0x6a3319, c2: 0x33160a, c3: 0xdfe3ea, p: [1.1, 1.25, 0.12, 0.95] }),
    upperCeil: mat('plaster', { c1: 0xe6d6bc, c2: 0x5a2c16, c3: 0xd8a840, p: [0, 0, 0, 0] }),
    floor: mat('carpet', { c1: 0x4a0c14, c2: 0x2a060c, c3: 0xd8a840, p: [80, 0.45, 0, 0] }),
    lamp: glowMat(0xffe2b8, 1.5),
  };
}

function tubeLine(pts, r) {
  const c = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  return new THREE.TubeGeometry(c, 20, r, 8, false);
}

/** A crystal chandelier hanging `drop` metres from the ceiling point (0, 0, 0). */
export function chandelier(P, { drop = 1.1, arms = 8, radius = 0.6 } = {}) {
  const g = new THREE.Group();
  const flame = glowMat(0xffd49a, 3.2);
  const crystal = glowMat(0xfff6e8, 1.6);
  const candle = mat('matte', { c1: 0xfaf4e6, p: [0.5, 0, 0, 0] });
  g.add(mesh(latheGeo([[0, 0], [0.16, 0], [0.16, -0.02], [0.1, -0.05], [0.03, -0.07], [0, -0.07]], 24), P.gold, { shadow: false }));
  g.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, drop - 0.55, 8), P.gold, { pos: [0, -(drop - 0.55) / 2 - 0.05, 0], shadow: false }));
  const body = new THREE.Group();
  body.position.y = -drop + 0.5;
  g.add(body);
  body.add(mesh(latheGeo([[0, -0.5], [0.05, -0.5], [0.08, -0.45], [0.05, -0.38], [0.11, -0.3], [0.14, -0.22], [0.08, -0.14], [0.05, 0.0], [0.07, 0.08], [0.02, 0.14], [0, 0.16]], 24), P.gold, { shadow: false }));
  for (let tier = 0; tier < 2; tier++) {
    const n = tier ? Math.round(arms * 0.75) : arms;
    const rad = tier ? radius * 0.62 : radius;
    const y0 = tier ? -0.12 : -0.32;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + tier * 0.3;
      const cx = Math.cos(a);
      const cz = Math.sin(a);
      // an S-curved arm from the body out to a candle cup
      const pts = [[cx * 0.08, y0, cz * 0.08], [cx * rad * 0.45, y0 - 0.1, cz * rad * 0.45], [cx * rad * 0.85, y0 - 0.02, cz * rad * 0.85], [cx * rad, y0 + 0.08, cz * rad]];
      body.add(mesh(tubeLine(pts, 0.011), P.gold, { shadow: false }));
      body.add(mesh(latheGeo([[0, 0], [0.035, 0], [0.045, 0.025], [0.02, 0.035], [0, 0.035]], 14), P.gold, { pos: [cx * rad, y0 + 0.08, cz * rad], shadow: false }));
      body.add(mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.11, 10), candle, { pos: [cx * rad, y0 + 0.17, cz * rad], shadow: false }));
      body.add(mesh(new THREE.SphereGeometry(0.014, 8, 8), flame, { pos: [cx * rad, y0 + 0.24, cz * rad], scale: [0.8, 1.6, 0.8], shadow: false }));
      // crystal drops under the arm
      for (const k of [0.5, 0.8]) {
        body.add(mesh(new THREE.OctahedronGeometry(0.018, 0), crystal, { pos: [cx * rad * k, y0 - 0.14 - (1 - k) * 0.06, cz * rad * k], scale: [0.7, 1.4, 0.7], shadow: false }));
      }
    }
  }
  // a skirt of drops below the body
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    body.add(mesh(new THREE.OctahedronGeometry(0.02, 0), crystal, { pos: [Math.cos(a) * 0.16, -0.5 - (i % 2) * 0.05, Math.sin(a) * 0.16], scale: [0.7, 1.5, 0.7], shadow: false }));
  }
  return g;
}

/** A tufted three-seat sofa (Chesterfield-like), length `len`, facing +z. */
export function sofa(P, len = 2.2) {
  const g = new THREE.Group();
  const D = 0.9;
  const legH = 0.11;
  const up = P.velvet;
  for (const [sx, sz] of CORNERS) {
    const l = leg(P, legH, 1.1);
    l.position.set(sx * (len / 2 - 0.1), 0, sz * (D / 2 - 0.1));
    g.add(l);
  }
  g.add(rbox(len, 0.28, D, 0.05, up, { pos: [0, legH, 0] }));
  const seats = 3;
  const sw = (len - 0.34) / seats;
  for (let i = 0; i < seats; i++) {
    g.add(mesh(cushionGeo(sw - 0.02, 0.13, D - 0.24, { r: 0.04, puff: 0.35, under: 0.2 }), up, { pos: [-(len - 0.34) / 2 + sw * (i + 0.5), legH + 0.34, 0.07] }));
  }
  g.add(rbox(len, 0.52, 0.18, 0.06, up, { pos: [0, legH + 0.24, -D / 2 + 0.09] }));
  const tg = tuftedGeo(len - 0.36, 0.4, { cols: 9, rows: 2, depth: 0.06, edge: 0.04, res: 110 });
  g.add(mesh(tg, up, { pos: [0, legH + 0.62, -D / 2 + 0.18], rot: [-0.1, 0, 0] }));
  const btn = new THREE.SphereGeometry(0.012, 8, 6);
  for (const [bx, by, bz] of tg.userData.buttons) {
    const b = mesh(btn, P.gold, { shadow: false });
    b.position.set(bx, by, bz + 0.005).applyEuler(new THREE.Euler(-0.1, 0, 0)).add(new THREE.Vector3(0, legH + 0.62, -D / 2 + 0.18));
    g.add(b);
  }
  // rolled arms
  for (const s of [-1, 1]) {
    g.add(rbox(0.17, 0.36, D - 0.02, 0.06, up, { pos: [s * (len / 2 - 0.085), legH + 0.2, 0.01] }));
    g.add(mesh(new THREE.CapsuleGeometry(0.1, D - 0.22, 8, 16), up, { pos: [s * (len / 2 - 0.085), legH + 0.6, 0.02], rot: [Math.PI / 2, 0, 0] }));
  }
  // two scatter cushions
  for (const s of [-1, 1]) g.add(mesh(cushionGeo(0.42, 0.12, 0.42, { r: 0.05, puff: 0.5, pinch: 0.2 }), P.sheet, { pos: [s * (len / 2 - 0.42), legH + 0.62, -D / 2 + 0.34], rot: [-1.1, s * 0.25, s * 0.1] }));
  return g;
}

/** A round pedestal side table with a lamp or a small urn on it. */
export function sideTable(P, { lamp = false } = {}) {
  const g = new THREE.Group();
  g.add(mesh(latheGeo([[0, 0], [0.22, 0], [0.22, 0.03], [0.16, 0.06], [0.06, 0.1], [0.045, 0.2], [0.06, 0.34], [0.04, 0.46], [0.05, 0.54], [0.08, 0.57], [0, 0.57]], 28), P.woodDark));
  g.add(mesh(latheGeo([[0, 0], [0.3, 0], [0.31, 0.01], [0.31, 0.03], [0.29, 0.045], [0, 0.045]], 40), P.wood, { pos: [0, 0.57, 0] }));
  g.add(mesh(latheGeo([[0.303, 0], [0.308, 0.004], [0.303, 0.008]], 40), P.gold, { pos: [0, 0.587, 0], shadow: false }));
  if (lamp) {
    const { group: l } = tableLamp(P);
    l.position.y = 0.615;
    g.add(l);
  } else {
    g.add(mesh(latheGeo([[0, 0], [0.05, 0], [0.06, 0.02], [0.09, 0.08], [0.1, 0.13], [0.06, 0.2], [0.04, 0.23], [0.055, 0.25], [0, 0.25]], 28), P.gold, { pos: [0, 0.615, 0] }));
  }
  return g;
}

/** A closed pair of panelled doors with architrave and gold knobs, w × h, facing +z. */
export function panelDoors(P, w = 1.5, h = 2.5) {
  const g = new THREE.Group();
  const leafW = w / 2 - 0.01;
  for (const s of [-1, 1]) {
    const x = s * (leafW / 2 + 0.005);
    g.add(rbox(leafW, h, 0.06, 0.008, P.wood, { pos: [x, 0, 0] }));
    for (const [py, ph] of [[h * 0.68, h * 0.4], [h * 0.24, h * 0.3]]) {
      g.add(rbox(leafW - 0.18, ph, 0.03, 0.02, P.wood, { pos: [x, py, 0.03], center: true }));
      const il = inlay(P, leafW - 0.24, ph - 0.06, 0.005);
      il.position.set(x, py, 0.047);
      g.add(il);
    }
    const kb = knob(P);
    kb.position.set(s * 0.06, h * 0.47, 0.035);
    g.add(kb);
  }
  // architrave: runs project toward -z by default, so turn them to face the room (+z)
  const top = profileRun(PROFILES.architrave, w + 0.24, P.woodDark);
  top.rotation.y = Math.PI;
  top.position.set(0, h, -0.01);
  g.add(top);
  for (const s of [-1, 1]) {
    const v = profileRun(PROFILES.architrave, h, P.woodDark);
    v.rotation.set(0, Math.PI, s * Math.PI / 2);
    v.position.set(s * (w / 2 + 0.01), h / 2, -0.01);
    g.add(v);
  }
  g.add(rbox(0.16, 0.06, 0.01, 0.004, P.gold, { pos: [0, h * 0.8, 0.065], center: true }));
  return g;
}

/** A pedestal with a tall vase. */
export function vasePedestal(P) {
  const g = new THREE.Group();
  g.add(mesh(latheGeo([[0, 0], [0.22, 0], [0.22, 0.06], [0.17, 0.1], [0.13, 0.16], [0.12, 0.8], [0.15, 0.86], [0.2, 0.9], [0.2, 0.95], [0, 0.95]], 28), mat('matte', { c1: 0xefe4cf, c2: 0xf8f1e4, p: [0.3, 1, 0, 0] })));
  g.add(mesh(latheGeo([[0, 0], [0.07, 0], [0.09, 0.03], [0.17, 0.18], [0.19, 0.3], [0.13, 0.46], [0.08, 0.54], [0.08, 0.6], [0.11, 0.64], [0, 0.64]], 36), P.ceramic, { pos: [0, 0.95, 0] }));
  g.add(mesh(latheGeo([[0.19, 0], [0.195, 0.01], [0.19, 0.02]], 36), P.gold, { pos: [0, 1.24, 0], shadow: false }));
  return g;
}

/**
 * The parlor around its stair core: seating on both sides, closed doors to
 * the other staterooms, vases, and two chandeliers. Returns their light points.
 */
export function parlorSet(P, { W, D, H }) {
  const g = new THREE.Group();
  const inset = 0.125;
  for (const s of [-1, 1]) {
    const so = sofa(P, 2.2);
    so.position.set(s * (W / 2 - inset - 0.47), 0, 1.7);
    so.rotation.y = -s * Math.PI / 2;
    g.add(so);
    const t = sideTable(P, { lamp: true });
    t.position.set(s * (W / 2 - inset - 0.4), 0, 3.25);
    g.add(t);
    const ch = armchair(P);
    ch.position.set(s * (W / 2 - 2.2), 0, 3.0);
    ch.rotation.y = s * 2.3;
    g.add(ch);
    const d = panelDoors(P, 1.4, 2.45);
    d.position.set(s * (W / 2 - inset), 0, -4.3);
    d.rotation.y = -s * Math.PI / 2;
    g.add(d);
    const v = vasePedestal(P);
    v.position.set(s * (W / 2 - 0.6), 0, -D / 2 + 0.6);
    g.add(v);
  }
  const lights = [];
  for (const s of [-1, 1]) {
    const c = chandelier(P, { drop: 1.15 });
    c.position.set(s * 3.6, H, -0.6);
    g.add(c);
    lights.push([s * 3.6, H - 1.0, -0.6]);
  }
  return { group: g, lights };
}
