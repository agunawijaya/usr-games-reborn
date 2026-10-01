// The battlestar's fittings in the modelled style (ADR-013): workstations,
// lockers, crates, racks, launch tubes, catwalks, workbench, sick-bay beds,
// incinerator, galley, banquet, wardrobe, doors and blast damage — built with
// the modelling toolkit so nothing is a bare box. Industrial pieces use the
// ship's panel/metal shaders; the luxury decks reuse furnish.js (style A).
// Every piece faces +z and stands on y = 0 unless noted.

import * as THREE from 'three';
import { mat, glowMat } from './materials.js';
import { mesh, rng } from './geo.js';
import { rbox, roundedBoxGeo, cushionGeo, drapeGeo, latheGeo, tubeGeo } from './model.js';
import { leg, knob } from './furnish.js';
import { heldProp } from './humans.js';
import { rod } from './stairs.js';

// ---------------------------------------------------------------- materials

const cache = new Map();
const once = (k, f) => { if (!cache.has(k)) cache.set(k, f()); return cache.get(k); };
export const SM = {
  hull: () => once('hull', () => mat('panel', { c1: 0x4d5866, c2: 0x12161b, c3: 0xffa45a, p: [1.25, 0.07, 0, 0], q: [0.45, 0, 0, 0], seed: 21 })),
  dark: () => once('dark', () => mat('metal', { c1: 0x2a2f36, c2: 0x0e1013, p: [0.42, 0.25, 0, 0] })),
  steel: () => once('steel', () => mat('metal', { c1: 0xc9cfd6, c2: 0x6a7078, p: [0.22, 0.18, 0, 0] })),
  gunmetal: () => once('gun', () => mat('metal', { c1: 0x4a5058, c2: 0x1a1d21, p: [0.35, 0.3, 0, 0] })),
  rubber: () => once('rubber', () => mat('matte', { c1: 0x16171a, p: [0.8, 0, 0, 0] })),
  paint: (c) => once(`paint${c}`, () => mat('matte', { c1: c, c2: new THREE.Color(c).multiplyScalar(1.08).getHex(), p: [0.55, 1.5, 0.15, 0] })),
  olive: () => once('olive', () => mat('panel', { c1: 0x58663a, c2: 0x1a2010, c3: 0xffffff, p: [0.6, 0, 0, 0.08], q: [0.35, 0, 0, 0], seed: 6 })),
  hazard: () => once('hazard', () => mat('glow', { c1: 0xffb020, p: [0.35, 0, 0, 0] })),
  screen: (c) => once(`scr${c}`, () => glowMat(c, 1.2)),
  sheet: () => once('sheet', () => mat('fabric', { c1: 0xe6ecec, c2: 0xc8d2d2, p: [1.4, 0.1, 0, 1], side: THREE.DoubleSide })),
  blanket: () => once('blanket', () => mat('fabric', { c1: 0x5a6e80, c2: 0x3a4a5a, p: [1.0, 0.15, 0, 1], side: THREE.DoubleSide })),
  chrome: () => once('chrome', () => mat('metal', { c1: 0xe8ecf0, c2: 0x9aa2aa, p: [0.1, 0.02, 0, 0] })),
  wood: () => once('wood', () => mat('wood', { c1: 0x6e3016, c2: 0x2c1006, p: [2.2, 0, 0, 0] })),
  woodDark: () => once('woodD', () => mat('wood', { c1: 0x3a180a, c2: 0x160804, p: [2.6, 0, 0, 0] })),
  gold: () => once('gold', () => mat('gold', { c1: 0xe2b457, c2: 0xffffff, p: [0.4, 0.22, 0, 0] })),
  ivory: () => once('ivory', () => mat('matte', { c1: 0xf0e6d2, c2: 0xf8f1e4, p: [0.28, 1.2, 0, 0] })),
  linen: () => once('linen', () => mat('fabric', { c1: 0xf2ecde, c2: 0xdcd2bc, c3: 0xc9b184, p: [0.9, 0.18, 0.3, 1], side: THREE.DoubleSide })),
  velvet: () => once('velvet', () => mat('fabric', { c1: 0x6e1222, c2: 0x3e0814, p: [1.1, 0.9, 0, 0.6] })),
};
const LUX = () => ({ style: 'a', wood: SM.wood(), woodDark: SM.woodDark(), gold: SM.gold() });

// ---------------------------------------------------------------- workstations

/** A bridge workstation: pedestal, sloped desk with keys, two bezelled screens. */
export function workstation(color = 0x5ad8ff, seed = 1, holo = null) {
  const g = new THREE.Group();
  const r = rng(seed);
  // pedestal with a kick recess and a sloped front
  g.add(rbox(1.5, 0.08, 0.62, 0.02, SM.rubber(), { pos: [0, 0, 0.02] }));
  g.add(rbox(1.46, 0.8, 0.58, 0.05, SM.gunmetal(), { pos: [0, 0.07, -0.02] }));
  g.add(rbox(1.3, 0.5, 0.02, 0.01, SM.dark(), { pos: [0, 0.2, 0.275] }));
  for (let i = 0; i < 6; i++) g.add(rbox(0.16, 0.02, 0.005, 0.004, SM.dark(), { pos: [-0.5 + i * 0.2, 0.62, 0.28] }));
  // the desk, tilted toward the operator
  const desk = new THREE.Group();
  desk.position.set(0, 0.9, 0.05);
  desk.rotation.x = 0.22;
  desk.add(rbox(1.56, 0.06, 0.7, 0.025, SM.dark(), { center: true }));
  desk.add(rbox(1.52, 0.012, 0.66, 0.004, SM.steel(), { pos: [0, 0.031, 0], center: true }));
  // keyboard: a grid of keys
  const keys = new THREE.InstancedMesh(roundedBoxGeo(0.034, 0.012, 0.03, 0.005, 1, 1), SM.rubber(), 72);
  const m4 = new THREE.Matrix4();
  for (let k = 0; k < 72; k++) { m4.makeTranslation(-0.4 + (k % 18) * 0.047, 0.045, 0.12 + Math.floor(k / 18) * 0.04); keys.setMatrixAt(k, m4); }
  desk.add(keys);
  // status lights and a trackball
  for (let i = 0; i < 10; i++) desk.add(mesh(roundedBoxGeo(0.03, 0.01, 0.02, 0.004, 2, 1), glowMat([0xff4040, 0x40ff80, 0xffc040, 0x40c0ff][i % 4], 2.6), { pos: [-0.62 + i * 0.05, 0.04, -0.2], shadow: false }));
  desk.add(mesh(new THREE.SphereGeometry(0.03, 16, 12), SM.chrome(), { pos: [0.55, 0.04, 0.14] }));
  g.add(desk);
  // two screens on an arm, bezelled; the display is the room's holo shader if given
  for (const s of [-1, 1]) {
    const scr = new THREE.Group();
    scr.position.set(s * 0.38, 1.38, -0.18);
    scr.rotation.set(-0.12, -s * 0.18, 0);
    scr.add(rbox(0.7, 0.44, 0.05, 0.02, SM.dark(), { center: true }));
    const disp = holo ? holo(0.64, 0.38, color, r.range(0, 10)) : mesh(new THREE.PlaneGeometry(0.64, 0.38), SM.screen(color));
    disp.position.z = 0.027;
    scr.add(disp);
    if (disp.userData.tick) g.userData.tick = g.userData.tick ? ((a, b) => (t) => { a(t); b(t); })(g.userData.tick, disp.userData.tick) : disp.userData.tick;
    g.add(scr);
  }
  g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 10), SM.steel(), { pos: [0, 1.15, -0.2] }));
  g.add(rbox(0.85, 0.035, 0.05, 0.012, SM.steel(), { pos: [0, 1.33, -0.2], center: true }));
  return g;
}

/** A swivel chair: five-star base on casters, gas column, cushioned seat and back. */
export function swivelChair(seat = 0x2a3440) {
  const g = new THREE.Group();
  const cm = mat('fabric', { c1: seat, c2: new THREE.Color(seat).multiplyScalar(0.7).getHex(), p: [1.2, 0.2, 0, 0.6] });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const arm = rbox(0.3, 0.035, 0.05, 0.015, SM.dark(), { pos: [Math.cos(a) * 0.15, 0.06, Math.sin(a) * 0.15], rot: [0, -a, 0], center: true });
    g.add(arm);
    g.add(mesh(new THREE.SphereGeometry(0.028, 10, 8), SM.rubber(), { pos: [Math.cos(a) * 0.3, 0.028, Math.sin(a) * 0.3] }));
  }
  g.add(mesh(latheGeo([[0, 0], [0.03, 0], [0.028, 0.3], [0.04, 0.34], [0, 0.35]], 14), SM.chrome(), { pos: [0, 0.06, 0] }));
  g.add(mesh(cushionGeo(0.48, 0.09, 0.46, { r: 0.04, puff: 0.3 }), cm, { pos: [0, 0.46, 0] }));
  g.add(mesh(cushionGeo(0.44, 0.5, 0.08, { r: 0.04, puff: 0.1 }), cm, { pos: [0, 0.8, -0.24], rot: [-0.12, 0, 0] }));
  return g;
}

// ---------------------------------------------------------------- storage

/** A bank of n lockers, one door ajar (with rifles inside if `weapons`). */
export function lockers(n = 3, seed = 1, { weapons = false } = {}) {
  const g = new THREE.Group();
  const w = 0.42;
  const r = rng(seed);
  g.add(rbox(n * w + 0.04, 0.1, 0.52, 0.02, SM.dark(), { pos: [0, 0, 0] }));
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * w;
    g.add(rbox(w - 0.01, 1.95, 0.5, 0.012, SM.paint(0x5a6878), { pos: [x, 0.1, 0] }));
    const open = i === Math.floor(r() * n);
    const door = new THREE.Group();
    door.position.set(x - w / 2 + 0.01, 0.12, 0.25);
    door.rotation.y = open ? -1.2 : 0;
    const d = rbox(w - 0.03, 1.9, 0.02, 0.008, SM.paint(0x6a7a8a), { pos: [(w - 0.03) / 2, 0, 0.01] });
    door.add(d);
    for (let k = 0; k < 5; k++) door.add(rbox(w - 0.14, 0.012, 0.012, 0.004, SM.dark(), { pos: [(w - 0.03) / 2, 1.55 + k * 0.045, 0.024], center: true }));
    door.add(rbox(0.02, 0.12, 0.03, 0.008, SM.chrome(), { pos: [w - 0.08, 0.95, 0.03], center: true }));
    door.add(rbox(0.07, 0.04, 0.005, 0.003, glowMat(0xd8e0e8, 0.6), { pos: [(w - 0.03) / 2, 1.78, 0.025], center: true, shadow: false }));
    g.add(door);
    if (open && weapons) {
      // one rifle left in the rack, a gap where the others stood
      const rf = heldProp('rifle');
      rf.rotation.set(-Math.PI / 2 + 0.1, 0, 0);
      rf.position.set(x + 0.08, 0.72, 0.0);
      g.add(rf);
      g.add(rbox(w - 0.06, 0.03, 0.4, 0.008, SM.dark(), { pos: [x, 1.45, 0] }));
      for (let k = 0; k < 3; k++) g.add(rbox(0.1, 0.06, 0.08, 0.01, SM.olive(), { pos: [x - 0.12 + k * 0.12, 1.48, 0.05] }));
    } else if (open) {
      // a uniform jacket on a hook inside
      g.add(mesh(cushionGeo(0.3, 0.7, 0.12, { r: 0.05, puff: 0.2 }), mat('fabric', { c1: 0x3c5a78, c2: 0x2a4056, p: [1.3, 0.2, 0, 0.6] }), { pos: [x, 1.35, 0.02] }));
    }
  }
  return g;
}

/** A military crate with bevelled edges, corner guards and ribs. */
export function crate(w = 1.2, h = 0.8, d = 0.8) {
  const g = new THREE.Group();
  g.add(rbox(w, h, d, 0.03, SM.olive(), {}));
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    g.add(rbox(0.1, h + 0.01, 0.1, 0.02, SM.gunmetal(), { pos: [sx * (w / 2 - 0.045), -0.005, sz * (d / 2 - 0.045)] }));
  }
  for (const y of [h * 0.3, h * 0.7]) g.add(rbox(w + 0.01, 0.05, d + 0.01, 0.015, SM.gunmetal(), { pos: [0, y - 0.025, 0] }));
  g.add(rbox(w * 0.4, 0.07, 0.01, 0.004, SM.hazard(), { pos: [0, h * 0.5 - 0.035, d / 2 + 0.006], shadow: false }));
  for (const s of [-1, 1]) g.add(mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 14, Math.PI), SM.dark(), { pos: [s * (w / 2 + 0.005), h * 0.6, 0], rot: [0, Math.PI / 2, 0] }));
  return g;
}

/** A weapons rack: a steel frame holding rifles upright (or ammunition cases). */
export function weaponRack(kind = 'rifles', seed = 1, L = 3.0) {
  const g = new THREE.Group();
  const frame = SM.paint(0x5c636c);
  g.add(rbox(0.5, 0.12, L, 0.02, frame, {}));
  g.add(rbox(0.5, 0.06, L, 0.02, frame, { pos: [0, 1.9, 0] }));
  for (const z of [-L / 2 + 0.05, L / 2 - 0.05]) g.add(rbox(0.5, 2.0, 0.08, 0.02, frame, { pos: [0, 0, z] }));
  g.add(rbox(0.03, 1.8, L - 0.1, 0.01, SM.paint(0x8a929a), { pos: [-0.2, 0.1, 0] }));
  g.add(mesh(tubeGeo([[0.22, 1.2, -L / 2], [0.22, 1.2, L / 2]], 0.02, 4), SM.steel()));
  if (kind === 'rifles') {
    const n = Math.round(L / 0.27);
    for (let i = 0; i < n; i++) {
      const rf = heldProp('rifle');
      rf.rotation.order = 'YXZ'; // stand it up, then turn its side to the room
      rf.rotation.set(-Math.PI / 2 + 0.12, Math.PI / 2, 0);
      rf.position.set(0.12, 0.72, -L / 2 + 0.2 + i * ((L - 0.4) / (n - 1)));
      g.add(rf);
    }
  } else {
    const r = rng(seed);
    for (let tier = 0; tier < 3; tier++) {
      g.add(rbox(0.5, 0.04, L - 0.2, 0.01, SM.gunmetal(), { pos: [0, 0.12 + tier * 0.6, 0] }));
      const n = Math.floor((L - 0.3) / 0.55);
      for (let i = 0; i < n; i++) {
        const c = crate(0.42, 0.3, 0.45);
        c.position.set(0, 0.16 + tier * 0.6, -(n - 1) * 0.275 + i * 0.55 + r.range(-0.03, 0.03));
        c.rotation.y = Math.PI / 2;
        g.add(c);
      }
    }
  }
  return g;
}

// ---------------------------------------------------------------- flight deck

/** A launch tube's hatch in the wall: a thick ring with bolts, stripes and an iris. */
export function launchHatch(open = false) {
  const g = new THREE.Group();
  g.add(mesh(latheGeo([[1.35, -0.15], [1.95, -0.15], [2.05, -0.05], [2.05, 0.1], [1.9, 0.18], [1.5, 0.2], [1.35, 0.12]], 64), SM.gunmetal(), { rot: [Math.PI / 2, 0, 0] }));
  const bolt = new THREE.CylinderGeometry(0.045, 0.045, 0.06, 10);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    g.add(mesh(bolt, SM.steel(), { pos: [Math.cos(a) * 1.75, Math.sin(a) * 1.75, 0.2], rot: [Math.PI / 2, 0, 0], shadow: false }));
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.add(mesh(new THREE.RingGeometry(1.38, 1.46, 8, 1, a, Math.PI / 12), SM.hazard(), { pos: [0, 0, 0.13], shadow: false }));
  }
  if (open) {
    g.add(mesh(new THREE.CircleGeometry(1.36, 48), glowMat(0xffa040, 0.45), { pos: [0, 0, -0.1], shadow: false }));
  } else {
    // iris blades
    for (let i = 0; i < 8; i++) {
      const s = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(1.36, -0.1), new THREE.Vector2(1.3, 0.62)]);
      const bl = mesh(new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 1 }), SM.paint(0x3a4450), { pos: [0, 0, -0.06], rot: [0, 0, (i / 8) * Math.PI * 2] });
      g.add(bl);
    }
    g.add(mesh(new THREE.CircleGeometry(0.12, 24), glowMat(0xff3020, 1.8), { pos: [0, 0, 0.0], shadow: false }));
  }
  return g;
}

/** A catwalk of length len along x at height y: grating, stringers, railing and posts to the floor. */
export function catwalk(len, y, depth = 2.2, { gap = null } = {}) {
  // gap: [x0, x1] where a stair arrives (no railing, no column)
  const inGap = (x) => gap && x > gap[0] - 0.05 && x < gap[1] + 0.05;
  const g = new THREE.Group();
  const grate = mat('grate', { c1: 0x4a5058, c2: 0x101215, c3: 0xff6a30, p: [0.4, 0.0, 0, 0] });
  g.add(rbox(len, 0.06, depth, 0.01, grate, { pos: [0, y, 0] }));
  for (const s of [-1, 1]) g.add(rbox(len, 0.24, 0.06, 0.015, SM.dark(), { pos: [0, y - 0.18, s * depth / 2] }));
  const runs = gap ? [[-len / 2, gap[0]], [gap[1], len / 2]] : [[-len / 2, len / 2]];
  for (const [a, b] of runs) {
    if (b - a < 0.2) continue;
    const posts = Math.max(1, Math.round((b - a) / 1.5));
    for (let i = 0; i <= posts; i++) {
      const x = a + (i / posts) * (b - a);
      g.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.05, 10), SM.steel(), { pos: [x, y + 0.53, depth / 2] }));
    }
    g.add(rod([a, y + 1.05, depth / 2], [b, y + 1.05, depth / 2], 0.03, SM.steel()));
    g.add(rod([a, y + 0.55, depth / 2], [b, y + 0.55, depth / 2], 0.02, SM.steel()));
  }
  // I-beam columns down to the deck
  const n = Math.max(2, Math.round(len / 5));
  const ibeam = new THREE.Shape([[-0.12, -0.15], [0.12, -0.15], [0.12, -0.12], [0.02, -0.12], [0.02, 0.12], [0.12, 0.12], [0.12, 0.15], [-0.12, 0.15], [-0.12, 0.12], [-0.02, 0.12], [-0.02, -0.12], [-0.12, -0.12]].map(([a, b]) => new THREE.Vector2(a, b)));
  const col = new THREE.ExtrudeGeometry(ibeam, { depth: y - 0.2, bevelEnabled: false });
  col.rotateX(-Math.PI / 2);
  for (let i = 0; i <= n; i++) {
    const x = -len / 2 + 1 + (i / n) * (len - 2);
    if (!inGap(x)) g.add(mesh(col, SM.gunmetal(), { pos: [x, 0, depth / 2 - 0.1] }));
  }
  return g;
}

/** Landing gear for a parked fighter: a hydraulic strut and a wheel. */
export function landingStrut(h = 1.2) {
  const g = new THREE.Group();
  g.add(mesh(latheGeo([[0.07, 0.22], [0.07, h * 0.62], [0.05, h * 0.64], [0.05, h], [0, h]], 14), SM.steel()));
  g.add(mesh(latheGeo([[0, 0.3], [0.1, 0.3], [0.1, h * 0.55], [0.07, h * 0.6], [0, h * 0.6]], 14), SM.gunmetal()));
  const wheel = new THREE.TorusGeometry(0.16, 0.07, 10, 24);
  g.add(mesh(wheel, SM.rubber(), { pos: [0, 0.23, 0], rot: [0, Math.PI / 2, 0] }));
  g.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.1, 16), SM.steel(), { pos: [0, 0.23, 0], rot: [0, 0, Math.PI / 2] }));
  return g;
}

/** A rotating alarm beacon housing (the dome is returned for animation). */
export function beacon() {
  const g = new THREE.Group();
  g.add(mesh(latheGeo([[0, 0], [0.13, 0], [0.14, 0.03], [0.11, 0.08], [0, 0.08]], 20), SM.dark()));
  const dome = mesh(latheGeo([[0.09, 0], [0.095, 0.05], [0.07, 0.12], [0, 0.14]], 20), glowMat(0xff2010, 2.2), { pos: [0, 0.08, 0] });
  g.add(dome);
  const cage = new THREE.Group();
  for (let i = 0; i < 4; i++) cage.add(mesh(tubeGeo([[0.1, 0.08, 0], [0.105, 0.16, 0], [0, 0.23, 0]], 0.006, 8), SM.steel(), { rot: [0, (i / 4) * Math.PI * 2, 0] }));
  g.add(cage);
  g.userData.dome = dome;
  return g;
}

/** A vertical steam pipe with flanges and a valve wheel, height h. */
export function ventPipe(h) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, h, 16), SM.gunmetal(), { pos: [0, h / 2, 0] }));
  for (const y of [0.3, h * 0.5, h - 0.3]) g.add(mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.05, 16), SM.dark(), { pos: [0, y, 0] }));
  g.add(mesh(new THREE.TorusGeometry(0.14, 0.015, 6, 20), mat('metal', { c1: 0xc83a2a, c2: 0x6a1a10, p: [0.4, 0.3, 0, 0] }), { pos: [0, 1.1, 0.16] }));
  return g;
}

/** A ceiling light fitting of length len (emissive diffuser in a rounded housing). */
export function lightFitting(len, color = 0xfff0d8, k = 1.5) {
  const g = new THREE.Group();
  g.add(rbox(len + 0.1, 0.09, 0.42, 0.035, SM.dark(), { pos: [0, -0.09, 0] }));
  g.add(rbox(len, 0.02, 0.32, 0.01, glowMat(color, k), { pos: [0, -0.1, 0], shadow: false }));
  return g;
}

/** A workbench with drawers, a vice, a toolbox and scattered tools. */
export function workbench(seed = 1) {
  const g = new THREE.Group();
  const r = rng(seed);
  g.add(rbox(3, 0.06, 1.1, 0.02, SM.woodDark(), { pos: [0, 0.9, 0] }));
  g.add(rbox(3.04, 0.03, 1.14, 0.01, SM.steel(), { pos: [0, 0.87, 0] }));
  for (const x of [-1.3, 1.3]) {
    for (const z of [-0.45, 0.45]) g.add(rbox(0.07, 0.87, 0.07, 0.015, SM.gunmetal(), { pos: [x, 0, z] }));
  }
  g.add(rbox(0.9, 0.6, 1.0, 0.02, SM.paint(0x7a2a22), { pos: [0.9, 0.2, 0] }));
  for (let i = 0; i < 3; i++) {
    g.add(rbox(0.86, 0.17, 0.02, 0.006, SM.paint(0x8a3228), { pos: [0.9, 0.24 + i * 0.19, 0.51] }));
    g.add(rbox(0.3, 0.02, 0.03, 0.008, SM.chrome(), { pos: [0.9, 0.34 + i * 0.19, 0.53], center: true }));
  }
  // vice
  const v = new THREE.Group();
  v.add(rbox(0.18, 0.12, 0.3, 0.02, SM.paint(0x2a4a6a), {}));
  v.add(rbox(0.18, 0.1, 0.06, 0.015, SM.paint(0x2a4a6a), { pos: [0, 0.12, 0.08] }));
  v.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 8), SM.chrome(), { pos: [0, 0.08, 0.26], rot: [0, 0, Math.PI / 2] }));
  v.position.set(-1.2, 0.93, 0.35);
  g.add(v);
  // toolbox with a handle
  const tb = new THREE.Group();
  tb.add(rbox(0.46, 0.2, 0.22, 0.02, SM.paint(0xc83a2a), {}));
  tb.add(mesh(tubeGeo([[-0.12, 0.2, 0], [-0.1, 0.29, 0], [0.1, 0.29, 0], [0.12, 0.2, 0]], 0.012, 12), SM.dark()));
  tb.position.set(0.3, 0.93, -0.25);
  g.add(tb);
  // wrenches and a hammer
  for (let i = 0; i < 4; i++) {
    const w = new THREE.Group();
    w.add(rbox(0.2, 0.01, 0.025, 0.005, SM.chrome(), { center: true }));
    w.add(mesh(new THREE.TorusGeometry(0.03, 0.01, 6, 14, Math.PI * 1.5), SM.chrome(), { pos: [0.11, 0, 0], rot: [Math.PI / 2, 0, 0] }));
    w.position.set(r.range(-0.8, -0.2), 0.94, r.range(-0.3, 0.3));
    w.rotation.y = r.range(0, 3);
    g.add(w);
  }
  const hm = new THREE.Group();
  hm.add(mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 8), SM.woodDark(), { rot: [0, 0, Math.PI / 2] }));
  hm.add(rbox(0.04, 0.04, 0.12, 0.01, SM.gunmetal(), { pos: [0.15, 0, 0], center: true }));
  hm.position.set(-0.4, 0.95, 0.35);
  hm.rotation.y = 0.5;
  g.add(hm);
  return g;
}

// ---------------------------------------------------------------- sick bay

/** A hospital bed: tube frame on casters, mattress, pillow, a blanket and side rails. */
export function hospitalBed(seed = 1, { blanket = true } = {}) {
  const g = new THREE.Group();
  const W = 0.95;
  const L = 2.05;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.55, 10), SM.chrome(), { pos: [sx * (W / 2 - 0.03), 0.35, sz * (L / 2 - 0.05)] }));
    g.add(mesh(new THREE.SphereGeometry(0.045, 10, 8), SM.rubber(), { pos: [sx * (W / 2 - 0.03), 0.045, sz * (L / 2 - 0.05)] }));
  }
  g.add(rbox(W, 0.06, L, 0.02, SM.steel(), { pos: [0, 0.58, 0] }));
  g.add(mesh(cushionGeo(W - 0.06, 0.16, L - 0.1, { r: 0.05, puff: 0.04, under: 0 }), SM.sheet(), { pos: [0, 0.72, 0] }));
  g.add(mesh(cushionGeo(0.6, 0.12, 0.38, { r: 0.05, puff: 0.5 }), SM.sheet(), { pos: [0, 0.86, -L / 2 + 0.28], rot: [-0.3, 0, 0] }));
  if (blanket) g.add(mesh(drapeGeo({ w: W - 0.04, d: L * 0.62, top: 0.9, drop: 0.24, r: 0.05, folds: 2.4, foldAmp: 0.02, wrinkle: 0.004, puff: 0.02, seed, res: 36 }), SM.blanket(), { pos: [0, 0, L / 2 - L * 0.31 - 0.04] }));
  else g.add(mesh(cushionGeo(W - 0.1, 0.08, 0.4, { r: 0.03, puff: 0.3 }), SM.blanket(), { pos: [0, 0.88, L / 2 - 0.3] }));
  // head and foot boards, side rails
  for (const s of [-1, 1]) {
    g.add(mesh(tubeGeo([[-W / 2, 0.6, s * L / 2], [-W / 2, s < 0 ? 1.15 : 0.95, s * L / 2], [W / 2, s < 0 ? 1.15 : 0.95, s * L / 2], [W / 2, 0.6, s * L / 2]], 0.02, 20), SM.chrome()));
    g.add(mesh(tubeGeo([[s * (W / 2 + 0.02), 0.95, -L * 0.3], [s * (W / 2 + 0.02), 0.95, L * 0.1]], 0.015, 4), SM.chrome()));
  }
  return g;
}

/** An IV stand with a bag and a monitor on a pole. */
export function ivStand() {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    g.add(rbox(0.26, 0.02, 0.03, 0.01, SM.chrome(), { pos: [Math.cos(a) * 0.12, 0.04, Math.sin(a) * 0.12], rot: [0, -a, 0], center: true }));
  }
  g.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.9, 8), SM.chrome(), { pos: [0, 0.95, 0] }));
  g.add(mesh(tubeGeo([[-0.15, 1.9, 0], [0, 1.85, 0], [0.15, 1.9, 0]], 0.008, 8), SM.chrome()));
  g.add(mesh(cushionGeo(0.1, 0.16, 0.03, { r: 0.012, puff: 0.3 }), mat('matte', { c1: 0xd8f0f0, p: [0.15, 0, 0, 0], transparent: true, opacity: 0.75 }), { pos: [0.12, 1.72, 0] }));
  const mon = new THREE.Group();
  mon.add(rbox(0.3, 0.22, 0.06, 0.02, SM.dark(), { center: true }));
  mon.add(mesh(new THREE.PlaneGeometry(0.25, 0.16), glowMat(0x40ff90, 0.9), { pos: [0, 0, 0.031] }));
  mon.position.set(0, 1.3, 0.05);
  g.add(mon);
  return g;
}

/** The sick bay's incinerator: a heavy furnace front with a glowing grate. */
export function incinerator() {
  const g = new THREE.Group();
  g.add(rbox(2.6, 2.4, 0.5, 0.05, SM.dark(), {}));
  g.add(rbox(1.7, 1.2, 0.1, 0.06, SM.gunmetal(), { pos: [0, 0.45, 0.26] }));
  const mouth = mesh(new THREE.PlaneGeometry(1.4, 0.9), glowMat(0xff5a10, 5).clone(), { pos: [0, 1.05, 0.32], shadow: false });
  g.add(mouth);
  for (let i = 0; i < 7; i++) g.add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.92, 8), SM.dark(), { pos: [-0.6 + i * 0.2, 1.05, 0.34] }));
  for (let i = 0; i < 16; i++) {
    const x = -1.2 + (i % 8) * 0.34;
    g.add(mesh(new THREE.SphereGeometry(0.025, 8, 6), SM.steel(), { pos: [x, i < 8 ? 2.25 : 0.15, 0.26], shadow: false }));
  }
  g.add(mesh(tubeGeo([[1.0, 1.9, 0.3], [1.0, 2.6, 0.3], [0.9, 3.2, 0]], 0.18, 16), SM.gunmetal()));
  g.userData.mouth = mouth;
  return g;
}

// ---------------------------------------------------------------- galley

/** A run of galley counters of length len: cabinets, steel top, a range with burners and pots. */
export function galley(len, seed = 1) {
  const g = new THREE.Group();
  const r = rng(seed);
  g.add(rbox(len, 0.1, 0.72, 0.02, SM.rubber(), { pos: [0, 0, 0.02] }));
  const n = Math.max(3, Math.round(len / 0.6));
  for (let i = 0; i < n; i++) {
    const x = -len / 2 + (i + 0.5) * (len / n);
    g.add(rbox(len / n - 0.01, 0.78, 0.7, 0.012, SM.steel(), { pos: [x, 0.1, 0] }));
    g.add(rbox(len / n - 0.08, 0.6, 0.02, 0.01, SM.chrome(), { pos: [x, 0.17, 0.35] }));
    g.add(rbox(0.25, 0.02, 0.03, 0.008, SM.dark(), { pos: [x, 0.72, 0.37], center: true }));
  }
  g.add(rbox(len + 0.04, 0.05, 0.78, 0.015, SM.chrome(), { pos: [0, 0.88, 0] }));
  // a range with four burners, two pots and a pan
  const rx = len / 2 - 0.8;
  for (let i = 0; i < 4; i++) {
    const bx = rx + (i % 2 ? 0.25 : -0.25);
    const bz = i < 2 ? -0.15 : 0.15;
    g.add(mesh(new THREE.TorusGeometry(0.09, 0.012, 6, 20), SM.dark(), { pos: [bx, 0.94, bz], rot: [Math.PI / 2, 0, 0] }));
    g.add(mesh(new THREE.CircleGeometry(0.07, 20), glowMat(0xff4010, i === 1 ? 1.2 : 0.05), { pos: [bx, 0.935, bz], rot: [-Math.PI / 2, 0, 0], shadow: false }));
  }
  const pot = latheGeo([[0, 0], [0.13, 0], [0.14, 0.01], [0.14, 0.18], [0.15, 0.19], [0.13, 0.19], [0, 0.19]], 24);
  g.add(mesh(pot, SM.chrome(), { pos: [rx - 0.25, 0.94, -0.15] }));
  g.add(mesh(latheGeo([[0, 0.19], [0.14, 0.19], [0.13, 0.21], [0.04, 0.23], [0.03, 0.26], [0, 0.26]], 24), SM.chrome(), { pos: [rx - 0.25, 0.94, -0.15] }));
  g.add(mesh(latheGeo([[0, 0], [0.16, 0], [0.18, 0.05], [0.17, 0.055], [0, 0.055]], 24), SM.dark(), { pos: [rx + 0.25, 0.94, 0.15] }));
  g.add(rbox(0.35, 0.03, 0.03, 0.01, SM.dark(), { pos: [rx + 0.55, 0.97, 0.15], center: true }));
  // a cutting board with fruit
  g.add(rbox(0.5, 0.03, 0.35, 0.01, SM.wood(), { pos: [-len / 2 + 1, 0.905, 0] }));
  const fruitC = [0xff8a2a, 0xffd23a, 0x6aa02a, 0xc81a2a];
  for (let i = 0; i < 6; i++) g.add(mesh(new THREE.SphereGeometry(0.045, 12, 10), mat('matte', { c1: fruitC[i % 4], p: [0.45, 0, 0, 0] }), { pos: [-len / 2 + 1 + r.range(-0.18, 0.18), 0.975, r.range(-0.12, 0.12)] }));
  // hanging utensils on a rail
  g.add(mesh(tubeGeo([[-len / 2 + 0.3, 1.6, -0.33], [len / 2 - 0.3, 1.6, -0.33]], 0.012, 4), SM.chrome()));
  for (let i = 0; i < 7; i++) {
    const x = -len / 2 + 0.6 + i * (len - 1.2) / 6;
    g.add(mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.28, 6), SM.chrome(), { pos: [x, 1.45, -0.32] }));
    g.add(mesh(latheGeo([[0, 0], [0.04, 0.01], [0.045, 0.03], [0, 0.035]], 12), SM.chrome(), { pos: [x, 1.28, -0.32], rot: [Math.PI, 0, 0] }));
  }
  return g;
}

// ---------------------------------------------------------------- luxury decks

/**
 * A long banquet table (length L along z) with a cloth, candelabras and a
 * place setting (plate, cereal bowl, goblet, cutlery) at each seat [side, z].
 */
export function banquetTable(L, seats, seed = 1) {
  const g = new THREE.Group();
  const W = 1.5;
  const top = 0.76;
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const l = leg(LUX(), top - 0.05, 1.8);
      l.position.set(s * (W / 2 - 0.15), 0, -L / 2 + 0.3 + i * (L - 0.6) / 2);
      g.add(l);
    }
  }
  g.add(rbox(W, 0.05, L, 0.015, SM.wood(), { pos: [0, top - 0.05, 0] }));
  g.add(mesh(drapeGeo({ w: W, d: L, top: top + 0.004, drop: 0.32, r: 0.02, folds: 2.2, foldAmp: 0.015, wrinkle: 0.002, puff: 0, flare: 0.04, foot: true, seed, res: 30 }), SM.linen(), { pos: [0, 0, 0] }));
  // candelabras down the middle
  const cand = latheGeo([[0, 0], [0.09, 0], [0.09, 0.02], [0.03, 0.05], [0.02, 0.2], [0.035, 0.24], [0.015, 0.3], [0.02, 0.36], [0, 0.37]], 20);
  const flame = glowMat(0xffd49a, 3);
  for (let i = 0; i < 3; i++) {
    const z = -L / 2 + L * (i + 1) / 4;
    g.add(mesh(cand, SM.gold(), { pos: [0, top, z] }));
    for (const a of [-1, 0, 1]) {
      const x = a * 0.13;
      if (a) g.add(mesh(tubeGeo([[0, top + 0.26, z], [x * 0.7, top + 0.27, z], [x, top + 0.34, z]], 0.008, 8), SM.gold()));
      g.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.12, 8), SM.ivory(), { pos: [x, top + 0.42, z] }));
      g.add(mesh(new THREE.SphereGeometry(0.012, 8, 8), flame, { pos: [x, top + 0.49, z], scale: [0.8, 1.7, 0.8], shadow: false }));
    }
  }
  // place settings: plate, goblet, cutlery
  const plate = latheGeo([[0, 0], [0.12, 0], [0.13, 0.012], [0.12, 0.016], [0.08, 0.008], [0, 0.008]], 28);
  const goblet = latheGeo([[0, 0], [0.035, 0], [0.036, 0.004], [0.006, 0.01], [0.006, 0.08], [0.03, 0.1], [0.04, 0.15], [0.036, 0.16], [0, 0.11]], 18);
  const bowl = latheGeo([[0, 0], [0.035, 0], [0.04, 0.005], [0.075, 0.05], [0.07, 0.052], [0.035, 0.012], [0, 0.012]], 24);
  const cereal = new THREE.CircleGeometry(0.066, 20);
  cereal.rotateX(-Math.PI / 2);
  for (const [s, z] of seats) {
    g.add(mesh(plate, SM.ivory(), { pos: [s * (W / 2 - 0.3), top + 0.005, z], shadow: false }));
    g.add(mesh(bowl, SM.ivory(), { pos: [s * (W / 2 - 0.3), top + 0.013, z], shadow: false }));
    g.add(mesh(cereal, mat('matte', { c1: 0xd8a860, c2: 0xe8c890, p: [0.8, 0, 0, 0] }), { pos: [s * (W / 2 - 0.3), top + 0.05, z], shadow: false }));
    g.add(mesh(goblet, SM.gold(), { pos: [s * (W / 2 - 0.46), top + 0.005, z - 0.18], shadow: false }));
    for (const c of [-1, 1]) g.add(rbox(0.012, 0.004, 0.19, 0.002, SM.chrome(), { pos: [s * (W / 2 - 0.3) + c * 0.17, top + 0.006, z], shadow: false }));
  }
  return g;
}

/** A dining chair with a padded seat and a carved back, facing +z. */
export function diningChair() {
  const g = new THREE.Group();
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const l = leg(LUX(), 0.44, 0.9);
    l.position.set(sx * 0.2, 0, sz * 0.19);
    g.add(l);
  }
  g.add(rbox(0.5, 0.05, 0.48, 0.02, SM.woodDark(), { pos: [0, 0.42, 0] }));
  g.add(mesh(cushionGeo(0.46, 0.07, 0.44, { r: 0.03, puff: 0.3, seg: 3, mid: 6 }), SM.velvet(), { pos: [0, 0.505, 0.01] }));
  for (const s of [-1, 1]) g.add(rbox(0.045, 0.62, 0.045, 0.015, SM.woodDark(), { pos: [s * 0.21, 0.45, -0.22] }));
  g.add(rbox(0.46, 0.08, 0.04, 0.015, SM.woodDark(), { pos: [0, 1.0, -0.22] }));
  g.add(mesh(cushionGeo(0.34, 0.36, 0.05, { r: 0.02, puff: 0.2, seg: 3, mid: 6 }), SM.velvet(), { pos: [0, 0.78, -0.21] }));
  return g;
}

/** A walk-in wardrobe side: a rail of hanging robes and gowns, a shelf above, shoes below; length L along z. */
export function wardrobe(L, seed = 1) {
  // garments hang across the rail, as on a real one: from the aisle you see
  // their sides, shoulder to hem, packed close
  const g = new THREE.Group();
  const r = rng(seed);
  g.add(mesh(tubeGeo([[0, 2.05, -L / 2], [0, 2.05, L / 2]], 0.018, 4), SM.gold()));
  g.add(rbox(0.62, 0.04, L, 0.01, SM.wood(), { pos: [0, 2.25, 0] }));
  for (const z of [-L / 2 + 0.05, L / 2 - 0.05]) g.add(rbox(0.05, 0.25, 0.05, 0.01, SM.gold(), { pos: [0, 2.03, z] }));
  const kinds = [
    { c: 0x3a1048, len: 1.5 }, { c: 0xa8802a, len: 1.45, gold: true }, { c: 0x1c1c24, len: 1.0 }, { c: 0xd8ccb4, len: 1.1, fur: true },
    { c: 0x5a0c14, len: 1.5 }, { c: 0x1e4a38, len: 1.05 }, { c: 0x1a2448, len: 1.4 }, { c: 0x6a4a30, len: 1.15, fur: true },
  ];
  const n = Math.max(3, Math.round(L / 0.15));
  for (let k = 0; k < n; k++) {
    const z = -L / 2 + 0.12 + k * ((L - 0.24) / (n - 1)) + r.range(-0.02, 0.02);
    const kd = kinds[(k * 5 + Math.floor(r() * 3)) % kinds.length];
    const len = kd.len * r.range(0.92, 1.05);
    // the hanger: hook over the rail, shoulders across it
    g.add(mesh(tubeGeo([[0, 2.07, z], [0.03, 2.1, z], [0.0, 2.02, z], [0, 1.98, z], [-0.2, 1.93, z], [0.2, 1.93, z], [0, 1.98, z]], 0.005, 20), SM.gold()));
    const m = kd.fur
      ? mat('carpet', { c1: kd.c, c2: new THREE.Color(kd.c).multiplyScalar(0.75).getHex(), c3: 0xffffff, p: [60, 0.5, 0, 0] })
      : mat('fabric', { c1: kd.c, c2: new THREE.Color(kd.c).multiplyScalar(0.6).getHex(), c3: 0xf0c860, p: [1.2, 0.7, kd.gold ? 0.7 : 0, 0.6], side: THREE.DoubleSide });
    g.add(mesh(garmentGeo(len, kd.fur ? 0.05 : r.range(0.02, 0.1), (seed * 13 + k) % 17, kd.fur ? 0.5 : 0.3), m, { pos: [0, 1.95, z], rot: [r.range(-0.04, 0.04), r.range(-0.1, 0.1), 0] }));
  }
  // shoes paired on the floor beneath
  for (let k = 0; k < Math.round(L / 0.5); k++) {
    const z = -L / 2 + 0.3 + k * 0.5;
    for (const s of [-1, 1]) g.add(mesh(cushionGeo(0.09, 0.07, 0.26, { r: 0.03, puff: 0.2 }), SM.woodDark(), { pos: [0.12 + s * 0.06, 0.0, z], rot: [0, Math.PI / 2, 0] }));
  }
  return g;
}

/**
 * A garment hanging from its shoulders at y = 0: a lathe (width across x)
 * flattened front to back (z), with folds that deepen toward the hem.
 */
function garmentGeo(len, flare, seed, thick = 0.3) {
  const prof = [[0.015, 0], [0.12, -0.02], [0.2, -0.07], [0.205, -0.16], [0.19, -0.4], [0.185, -Math.min(0.62, len * 0.5)], [0.2 + flare, -len], [0, -len]];
  const g = latheGeo(prof, 40);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const t = Math.min(1, -y / len);
    const a = Math.atan2(z, x);
    const k = 1 + (0.02 + 0.1 * t * t) * Math.sin(a * 7 + seed * 1.7 + t * 1.5);
    p.setXYZ(i, x * k, y, z * k * thick);
  }
  g.computeVertexNormals();
  return g;
}

/** A tall metallic door studded with gems (the presidential suite), in a moulded frame. */
export function magnesiumDoor() {
  const g = new THREE.Group();
  const m = mat('metal', { c1: 0xe8ecf0, c2: 0xa0a8b0, p: [0.12, 0.08, 0, 0] });
  for (const s of [-1, 1]) {
    // hinged at the jamb; the right leaf stands ajar ("The door is ajar")
    const leaf = new THREE.Group();
    leaf.position.x = s * 0.9;
    leaf.rotation.y = s > 0 ? -0.55 : 0;
    leaf.add(rbox(0.88, 2.7, 0.1, 0.02, m, { pos: [-s * 0.45, 0, 0] }));
    for (const [y, h] of [[0.25, 1.1], [1.5, 1.0]]) leaf.add(rbox(0.66, h, 0.05, 0.03, m, { pos: [-s * 0.45, y, 0.06] }));
    leaf.add(rbox(0.04, 0.5, 0.06, 0.015, SM.gold(), { pos: [-s * 0.82, 1.1, 0.1] }));
    g.add(leaf);
  }
  g.add(rbox(2.1, 0.16, 0.34, 0.04, SM.gold(), { pos: [0, 2.62, 0] }));
  for (const s of [-1, 1]) g.add(rbox(0.14, 2.78, 0.34, 0.04, SM.gold(), { pos: [s * 0.98, 0, 0] }));
  const gem = new THREE.OctahedronGeometry(0.03, 0);
  const gm = glowMat(0xffd0f0, 3);
  for (let i = 0; i < 40; i++) {
    const s = i % 2 ? 1 : -1;
    g.add(mesh(gem, gm, { pos: [s * 0.98, 0.2 + (Math.floor(i / 2) / 20) * 2.5, 0.185], shadow: false }));
  }
  return g;
}

/** A door barred with three heavy bolts (the arch to the dining room). */
export function boltedDoor() {
  const g = new THREE.Group();
  g.add(rbox(2.2, 2.6, 0.18, 0.03, SM.woodDark(), {}));
  for (const [y, h] of [[0.2, 1.0], [1.35, 1.0]]) for (const s of [-1, 1]) g.add(rbox(0.9, h, 0.04, 0.03, SM.woodDark(), { pos: [s * 0.5, y, 0.1] }));
  for (let i = 0; i < 3; i++) {
    const y = 0.55 + i * 0.8;
    g.add(rbox(2.6, 0.12, 0.12, 0.03, SM.gunmetal(), { pos: [0, y - 0.06, 0.18] }));
    for (const s of [-1, 1]) g.add(rbox(0.14, 0.26, 0.2, 0.03, SM.dark(), { pos: [s * 1.25, y - 0.13, 0.12] }));
  }
  return g;
}

// ---------------------------------------------------------------- doors, damage

/** An industrial bulkhead frame around a doorway w × h (rounded, bolted, hazard-striped), facing +z. */
export function bulkheadFrame(w = 1.6, h = 2.4, luxury = false) {
  const g = new THREE.Group();
  const t = luxury ? 0.12 : 0.2;
  const outer = new THREE.Shape();
  const ow = w + 2 * t;
  const oh = h + t;
  const rr = 0.18;
  outer.moveTo(-ow / 2, 0);
  outer.lineTo(ow / 2, 0);
  outer.lineTo(ow / 2, oh - rr);
  outer.quadraticCurveTo(ow / 2, oh, ow / 2 - rr, oh);
  outer.lineTo(-ow / 2 + rr, oh);
  outer.quadraticCurveTo(-ow / 2, oh, -ow / 2, oh - rr);
  outer.lineTo(-ow / 2, 0);
  const hole = new THREE.Path();
  const ir = 0.12;
  hole.moveTo(-w / 2, 0.001);
  hole.lineTo(-w / 2, h - ir);
  hole.quadraticCurveTo(-w / 2, h, -w / 2 + ir, h);
  hole.lineTo(w / 2 - ir, h);
  hole.quadraticCurveTo(w / 2, h, w / 2, h - ir);
  hole.lineTo(w / 2, 0.001);
  hole.lineTo(-w / 2, 0.001);
  outer.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(outer, { depth: 0.18, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.025, bevelSegments: 3, curveSegments: 10 });
  geo.translate(0, 0, -0.05);
  g.add(mesh(geo, luxury ? SM.gold() : SM.gunmetal()));
  if (!luxury) {
    const bolt = new THREE.CylinderGeometry(0.022, 0.022, 0.03, 8);
    for (let i = 0; i < 6; i++) {
      for (const s of [-1, 1]) g.add(mesh(bolt, SM.steel(), { pos: [s * (w / 2 + t / 2), 0.3 + i * (h - 0.4) / 5, 0.16], rot: [Math.PI / 2, 0, 0], shadow: false }));
    }
    // hazard chevrons on the threshold and a door status light
    for (let i = 0; i < 8; i++) g.add(rbox(0.12, 0.012, 0.18, 0.004, i % 2 ? SM.hazard() : SM.dark(), { pos: [-w / 2 + 0.1 + i * (w - 0.2) / 7, 0, 0.08], rot: [0, 0.5, 0], shadow: false }));
    g.add(mesh(latheGeo([[0, 0], [0.05, 0], [0.045, 0.03], [0, 0.04]], 12), glowMat(0x40ff80, 2), { pos: [w / 2 + t / 2, h + 0.05, 0.14], rot: [Math.PI / 2, 0, 0], shadow: false }));
  }
  return g;
}

/** A torn gash in a wall panel with glowing, curled edges (blast damage), in the XY plane. */
export function blastGash(w, h, seed = 1) {
  const r = rng(seed);
  const pts = [];
  const n = 18;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 0.75 + r.range(0, 0.45);
    pts.push(new THREE.Vector2(Math.cos(a) * w / 2 * k, Math.sin(a) * h / 2 * k));
  }
  const g = new THREE.Group();
  // the dark cavity, with a dull glow deep inside
  g.add(mesh(new THREE.ShapeGeometry(new THREE.Shape(pts)), glowMat(0x060302, 1), { shadow: false }));
  g.add(mesh(new THREE.ShapeGeometry(new THREE.Shape(pts.map((q) => q.clone().multiplyScalar(0.45)))), glowMat(0x3a0e04, 1), { pos: [0, 0, 0.002], shadow: false }));
  // torn petals of wall plate bent out into the room
  const tri = [];
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const m = a.clone().add(b).multiplyScalar(0.5);
    const out = m.clone().multiplyScalar(1 + r.range(0.12, 0.4));
    const f = r.range(0.04, 0.2);
    tri.push(a.x, a.y, 0.01, b.x, b.y, 0.01, out.x, out.y, f);
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.Float32BufferAttribute(tri, 3));
  pg.computeVertexNormals();
  g.add(mesh(pg, mat('metal', { c1: 0x3a3430, c2: 0x0a0806, p: [0.5, 0.7, 0, 0], side: THREE.DoubleSide })));
  // a hot rim, and severed cables hanging out
  const ring = new THREE.Shape(pts.map((q) => q.clone().multiplyScalar(1.03)));
  ring.holes.push(new THREE.Path(pts));
  g.add(mesh(new THREE.ShapeGeometry(ring), glowMat(0xff6a20, 1.1), { pos: [0, 0, 0.012], shadow: false }));
  for (let i = 0; i < 2; i++) {
    const x0 = r.range(-w / 4, w / 4);
    g.add(mesh(tubeGeo([[x0, 0, -0.05], [x0 * 1.2, -h * 0.2, 0.15], [x0 * 1.4 + 0.05, -h * 0.55, 0.22]], 0.012, 12), SM.rubber()));
  }
  return g;
}

/** A twisted structural girder (I-section) of length len, bent in the middle. */
export function brokenGirder(len, seed = 1) {
  const r = rng(seed);
  const ib = new THREE.Shape([[-0.1, -0.14], [0.1, -0.14], [0.1, -0.11], [0.02, -0.11], [0.02, 0.11], [0.1, 0.11], [0.1, 0.14], [-0.1, 0.14], [-0.1, 0.11], [-0.02, 0.11], [-0.02, -0.11], [-0.1, -0.11]].map(([a, b]) => new THREE.Vector2(a, b)));
  const bend = r.range(0.2, 0.7);
  const path = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, -len / 2), new THREE.Vector3(r.range(-0.2, 0.2), bend * 0.3, 0), new THREE.Vector3(r.range(-0.3, 0.3), bend, len / 2)]);
  const geo = new THREE.ExtrudeGeometry(ib, { steps: 12, bevelEnabled: false, extrudePath: path });
  return mesh(geo, mat('panel', { c1: 0x4d5866, c2: 0x12161b, c3: 0xff7a3a, p: [1.25, 0.07, 0, 0.75], q: [0.8, 0, 0, 0], seed: 2 }));
}

/** A jagged hole outline (for a torn floor or ceiling), as a polygon in room coordinates. */
export function jaggedHole(cx, cz, rx, rz, seed = 1) {
  const r = rng(seed);
  const pts = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const k = 0.8 + r.range(0, 0.35);
    pts.push([cx + Math.cos(a) * rx * k, cz + Math.sin(a) * rz * k]);
  }
  return pts;
}

/** Broken edges round a hole in a slab: bent plates and dangling cables. */
export function holeEdge(pts, y, down = 1, seed = 1) {
  const r = rng(seed);
  const g = new THREE.Group();
  const m = mat('panel', { c1: 0x4d5866, c2: 0x12161b, c3: 0xff7a3a, p: [1.25, 0.07, 0, 0.75], q: [0.8, 0, 0, 0], seed: 3 });
  for (let i = 0; i < pts.length; i++) {
    const [x0, z0] = pts[i];
    const [x1, z1] = pts[(i + 1) % pts.length];
    const len = Math.hypot(x1 - x0, z1 - z0);
    const plate = rbox(len * 1.05, 0.04, 0.35, 0.01, m, { center: true });
    plate.position.set((x0 + x1) / 2, y - down * 0.1, (z0 + z1) / 2);
    plate.rotation.set(down * r.range(0.3, 0.8), -Math.atan2(z1 - z0, x1 - x0), r.range(-0.2, 0.2));
    g.add(plate);
    if (r.chance(0.4)) g.add(mesh(tubeGeo([[x0, y, z0], [x0 + r.range(-0.1, 0.1), y - down * 0.4, z0 + r.range(-0.1, 0.1)], [x0 + r.range(-0.2, 0.2), y - down * r.range(0.6, 1.1), z0]], 0.012, 10), SM.rubber()));
  }
  return g;
}

/** Scattered clothes on the floor (a ransacked cabin): small crumpled cloth shapes. */
export function strewnClothes(n, area, seed = 1) {
  const r = rng(seed);
  const g = new THREE.Group();
  const cols = [0xe8d8f0, 0x5a1a6a, 0xc8a040, 0x2a4a7a, 0xf0e6d8, 0x6a0c18];
  for (let i = 0; i < n; i++) {
    const c = cols[i % cols.length];
    const geo = crumpleGeo(r.range(0.2, 0.42), r.range(0.14, 0.3), seed * 31 + i);
    g.add(mesh(geo, mat('fabric', { c1: c, c2: new THREE.Color(c).multiplyScalar(0.6).getHex(), p: [1.2, 0.5, 0, 0.6] }), { pos: [r.range(-area[0], area[0]), 0, r.range(-area[1], area[1])], rot: [0, r.range(0, 6), 0], shadow: false }));
  }
  return g;
}

/** A crumpled piece of cloth on the floor: an irregular disc heaped in folds, rx by rz. */
export function crumpleGeo(rx, rz, seed = 1) {
  const r = rng(seed);
  const rings = 8;
  const segs = 30;
  const l0 = r.range(0, 6);
  const l1 = r.range(0, 6);
  const l2 = r.range(0, 6);
  const hgt = r.range(0.035, 0.09);
  const pos = [0, hgt + 0.006, 0];
  const idx = [];
  for (let i = 1; i <= rings; i++) {
    const t = i / rings;
    for (let j = 0; j < segs; j++) {
      const a = (j / segs) * Math.PI * 2;
      const edge = 1 + 0.22 * Math.sin(3 * a + l0) + 0.12 * Math.sin(5 * a + l1);
      const fold = 0.5 + 0.5 * Math.sin(a * 4 + l2 + t * 5);
      pos.push(Math.cos(a) * rx * t * edge, 0.006 + hgt * (1 - t * t) * (0.45 + 0.55 * fold), Math.sin(a) * rz * t * edge);
    }
  }
  for (let j = 0; j < segs; j++) idx.push(0, 1 + ((j + 1) % segs), 1 + j);
  for (let i = 1; i < rings; i++) {
    const a0 = 1 + (i - 1) * segs;
    const b0 = 1 + i * segs;
    for (let j = 0; j < segs; j++) {
      const j1 = (j + 1) % segs;
      idx.push(a0 + j, a0 + j1, b0 + j, a0 + j1, b0 + j1, b0 + j);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** A mop bucket with a wringer and a mop (the maid's utility room). */
export function mopBucket() {
  const g = new THREE.Group();
  g.add(mesh(latheGeo([[0, 0.02], [0.2, 0.02], [0.23, 0.36], [0.24, 0.38], [0.22, 0.38], [0.2, 0.06], [0, 0.06]], 24), SM.paint(0xe0b020)));
  for (let i = 0; i < 4; i++) g.add(mesh(new THREE.SphereGeometry(0.03, 8, 6), SM.rubber(), { pos: [Math.cos(i * 1.57 + 0.78) * 0.18, 0.02, Math.sin(i * 1.57 + 0.78) * 0.18] }));
  g.add(mesh(tubeGeo([[-0.22, 0.36, 0], [-0.18, 0.55, 0], [0.18, 0.55, 0], [0.22, 0.36, 0]], 0.01, 16), SM.chrome()));
  g.add(mesh(new THREE.CylinderGeometry(0.014, 0.014, 1.3, 8), SM.woodDark(), { pos: [0.08, 0.95, 0.05], rot: [0.12, 0, -0.1] }));
  g.add(mesh(latheGeo([[0, 0], [0.09, 0.02], [0.08, 0.12], [0, 0.14]], 14), mat('fabric', { c1: 0xd8d0c0, c2: 0xa8a090, p: [3, 0, 0, 1] }), { pos: [0.02, 0.2, 0.02] }));
  return g;
}

// ---------------------------------------------------------------- more rooms

/** Steel utility shelving with bottles and tins (the maid's room). */
export function utilityShelf(seed = 1) {
  const g = new THREE.Group();
  const r = rng(seed);
  for (const x of [-0.58, 0.58]) for (const z of [-0.18, 0.18]) g.add(rbox(0.035, 1.9, 0.035, 0.008, SM.steel(), { pos: [x, 0, z] }));
  for (let k = 0; k < 4; k++) {
    const y = 0.15 + k * 0.52;
    g.add(rbox(1.2, 0.025, 0.42, 0.006, SM.steel(), { pos: [0, y, 0] }));
    for (let i = 0; i < 5; i++) {
      if (r.chance(0.25)) continue;
      const x = -0.46 + i * 0.23 + r.range(-0.03, 0.03);
      const c = r.pick([0x3a8a4a, 0xe8e0c8, 0x2a5a9a, 0xd8b030, 0xc83a2a]);
      const h = r.range(0.16, 0.3);
      const bottle = latheGeo([[0, 0], [0.045, 0], [0.05, 0.01], [0.05, h * 0.7], [0.022, h * 0.85], [0.018, h], [0, h]], 16);
      g.add(mesh(bottle, SM.paint(c), { pos: [x, y + 0.0125, r.range(-0.08, 0.08)] }));
    }
  }
  return g;
}

/** A small finned rocket on a cradle (the workbench's "turbo sprocket rockets"). */
export function sprocketRocket() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  body.add(mesh(latheGeo([[0, 0], [0.05, 0], [0.065, 0.04], [0.065, 0.5], [0.05, 0.6], [0.02, 0.68], [0, 0.7]], 18), SM.paint(0xd8d2c4)));
  body.add(mesh(latheGeo([[0.066, 0.44], [0.067, 0.47], [0.066, 0.5]], 18), SM.paint(0xc83a2a)));
  for (let i = 0; i < 3; i++) {
    const fin = rbox(0.008, 0.16, 0.11, 0.003, SM.paint(0xc83a2a), { pos: [0, 0.02, 0.1], center: false });
    const holder = new THREE.Group();
    holder.add(fin);
    holder.rotation.y = (i / 3) * Math.PI * 2;
    body.add(holder);
  }
  body.rotation.z = -Math.PI / 2;
  body.position.set(-0.35, 0.14, 0);
  g.add(body);
  for (const x of [-0.2, 0.2]) g.add(rbox(0.06, 0.08, 0.2, 0.01, SM.gunmetal(), { pos: [x, 0, 0] }));
  return g;
}

/** An upholstered tufted ottoman on short turned legs. */
export function ottoman(w = 1.1, d = 0.6) {
  const g = new THREE.Group();
  const P = LUX();
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const l = leg(P, 0.12, 1.2);
    l.position.set(sx * (w / 2 - 0.06), 0, sz * (d / 2 - 0.06));
    g.add(l);
  }
  g.add(mesh(cushionGeo(w, 0.3, d, { r: 0.06, puff: 0.12 }), SM.velvet(), { pos: [0, 0.12, 0] }));
  return g;
}

/** A tall mirror in a gilt frame, leaning against a wall (front +z). */
export function mirror(w = 0.9, h = 2.0) {
  const g = new THREE.Group();
  g.add(rbox(w + 0.14, h + 0.14, 0.05, 0.02, SM.gold(), { pos: [0, 0, 0] }));
  g.add(mesh(new THREE.PlaneGeometry(w, h), mat('metal', { c1: 0xe8ecf0, c2: 0xc8ccd0, p: [0.02, 0.0, 0, 0] }), { pos: [0, h / 2 + 0.07, 0.026], shadow: false }));
  g.rotation.x = -0.08;
  return g;
}

/** A single wooden door with raised panels, a lock plate and a hasp (closed), in the XY plane. */
export function lockedDoor(w = 1.1, h = 2.3) {
  const g = new THREE.Group();
  const wood = mat('wood', { c1: 0x7a5030, c2: 0x3a2412, p: [2, 0, 0, 0] });
  g.add(rbox(w, h, 0.06, 0.01, wood, {}));
  for (const [y, ph] of [[h * 0.62, h * 0.45], [h * 0.22, h * 0.3]]) g.add(rbox(w - 0.2, ph, 0.03, 0.02, wood, { pos: [0, y, 0.03], center: true }));
  for (const s of [-1, 1]) g.add(rbox(w + 0.2, 0.1, 0.05, 0.015, SM.woodDark(), { pos: [0, s > 0 ? h : -0.001, 0.0], center: false }));
  for (const s of [-1, 1]) g.add(rbox(0.1, h + 0.1, 0.05, 0.015, SM.woodDark(), { pos: [s * (w / 2 + 0.05), 0, 0] }));
  g.add(rbox(0.08, 0.2, 0.012, 0.004, SM.chrome(), { pos: [w / 2 - 0.12, h * 0.46, 0.035] }));
  g.add(mesh(new THREE.SphereGeometry(0.03, 12, 10), SM.chrome(), { pos: [w / 2 - 0.12, h * 0.5, 0.06] }));
  // a padlocked hasp
  g.add(rbox(0.22, 0.05, 0.015, 0.005, SM.gunmetal(), { pos: [w / 2 - 0.05, h * 0.58, 0.04], center: true }));
  g.add(rbox(0.07, 0.08, 0.03, 0.012, SM.gold(), { pos: [w / 2 + 0.03, h * 0.54, 0.055], center: true }));
  g.add(mesh(new THREE.TorusGeometry(0.025, 0.006, 6, 14, Math.PI), SM.chrome(), { pos: [w / 2 + 0.03, h * 0.58, 0.055] }));
  return g;
}

/** An archway of two columns and a moulded semicircular arch round an opening of width w (front +z). */
export function archway(w = 1.8, h = 2.6) {
  const g = new THREE.Group();
  const P = LUX();
  const col = latheGeo([[0, 0], [0.2, 0], [0.2, 0.08], [0.16, 0.14], [0.14, 0.2], [0.12, h * 0.5], [0.115, h - 0.25], [0.14, h - 0.18], [0.18, h - 0.1], [0.2, h - 0.05], [0.2, h], [0, h]], 24);
  for (const s of [-1, 1]) g.add(mesh(col, SM.ivory(), { pos: [s * (w / 2 + 0.22), 0, 0.2] }));
  const R = w / 2 + 0.22;
  // the arch: a semicircle of a moulded profile, with a keystone
  const shape = new THREE.Shape([new THREE.Vector2(-0.16, -0.12), new THREE.Vector2(0.16, -0.12), new THREE.Vector2(0.2, 0), new THREE.Vector2(0.16, 0.12), new THREE.Vector2(-0.16, 0.12), new THREE.Vector2(-0.2, 0)]);
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const a = Math.PI - (i / 24) * Math.PI;
    pts.push(new THREE.Vector3(Math.cos(a) * R, h + Math.sin(a) * R, 0.2));
  }
  const arch = new THREE.ExtrudeGeometry(shape, { steps: 48, bevelEnabled: false, extrudePath: new THREE.CatmullRomCurve3(pts) });
  g.add(mesh(arch, SM.ivory()));
  g.add(rbox(0.26, 0.34, 0.34, 0.03, P.gold, { pos: [0, h + R - 0.14, 0.2] }));
  return g;
}

/** Two panelled leaves of a double door swung open by `open` radians (lux doorways), front +z. */
export function swingLeaves(w = 1.8, h = 2.5, open = 1.25) {
  const g = new THREE.Group();
  const lw = w / 2 - 0.01;
  for (const s of [-1, 1]) {
    const leaf = new THREE.Group();
    leaf.position.set(s * w / 2, 0, -0.05);
    leaf.rotation.y = -s * open; // swung away from the room
    leaf.add(rbox(lw, h - 0.02, 0.05, 0.008, SM.wood(), { pos: [-s * lw / 2, 0, 0] }));
    for (const [y, ph] of [[h * 0.66, h * 0.44], [h * 0.22, h * 0.28]]) leaf.add(rbox(lw - 0.16, ph, 0.025, 0.015, SM.wood(), { pos: [-s * lw / 2, y, 0.025], center: true }));
    const k = knob(LUX());
    k.position.set(-s * (lw - 0.07), h * 0.47, 0.03);
    leaf.add(k);
    g.add(leaf);
  }
  return g;
}

/** Two sliding leaves of a ship's door, part open, sliding across the XY plane. */
export function slideLeaves(w = 1.6, h = 2.4, gap = 0.9) {
  const g = new THREE.Group();
  const lw = w / 2 + 0.05;
  const m = mat('panel', { c1: 0x59636f, c2: 0x15191e, c3: 0xffb060, p: [0.5, 0, 0, 0], q: [0.4, 0, 0, 0], seed: 10 });
  for (const s of [-1, 1]) {
    const leaf = new THREE.Group();
    leaf.position.set(s * (gap / 2 + lw / 2), 0, -0.08);
    leaf.add(rbox(lw, h, 0.07, 0.015, m, {}));
    leaf.add(rbox(0.05, h * 0.5, 0.02, 0.01, SM.dark(), { pos: [-s * (lw / 2 - 0.08), h * 0.25, 0.04] }));
    leaf.add(rbox(lw - 0.12, 0.06, 0.012, 0.004, SM.hazard(), { pos: [0, h * 0.18, 0.04], shadow: false }));
    g.add(leaf);
  }
  return g;
}

/** Conduits along a wall (length len along x): two pipes and a cable tray on brackets, front +z. */
export function conduits(len, y = 2.55) {
  const g = new THREE.Group();
  const n = Math.max(2, Math.round(len / 1.6));
  for (let i = 0; i <= n; i++) {
    const x = -len / 2 + (i / n) * len;
    g.add(rbox(0.04, 0.36, 0.2, 0.01, SM.dark(), { pos: [x, y - 0.1, 0.1] }));
  }
  g.add(rod([-len / 2, y, 0.12], [len / 2, y, 0.12], 0.05, SM.gunmetal()));
  g.add(rod([-len / 2, y + 0.16, 0.08], [len / 2, y + 0.16, 0.08], 0.035, mat('metal', { c1: 0xb05a2a, c2: 0x3a2010, p: [0.35, 0.4, 0, 0] })));
  g.add(rbox(len, 0.04, 0.22, 0.01, SM.steel(), { pos: [0, y - 0.12, 0.12] }));
  return g;
}

/** A heap of wreckage: bent plates, chunks and girders, radius rad (climbable if `ramp`). */
export function wreckage(rad, seed = 1, { girders = 3, plates = 8, ramp = false } = {}) {
  const r = rng(seed);
  const g = new THREE.Group();
  const scorched = mat('panel', { c1: 0x4d5866, c2: 0x12161b, c3: 0xff7a3a, p: [1.25, 0.07, 0, 0.75], q: [0.8, 0, 0, 0], seed: 4 });
  for (let i = 0; i < plates; i++) {
    const a = r.range(0, Math.PI * 2);
    const d = r.range(0, rad);
    const p = rbox(r.range(0.6, 1.4), r.range(0.04, 0.1), r.range(0.4, 0.9), 0.015, scorched, { center: true });
    p.position.set(Math.cos(a) * d, ramp ? (1 - d / rad) * 1.2 + 0.1 : r.range(0.05, 0.4), Math.sin(a) * d);
    p.rotation.set(r.range(-0.7, 0.7), r.range(0, 3), r.range(-0.7, 0.7));
    g.add(p);
  }
  for (let i = 0; i < girders; i++) {
    const b = brokenGirder(r.range(1.8, 3.6), seed * 7 + i);
    const a = r.range(0, Math.PI * 2);
    b.position.set(Math.cos(a) * rad * 0.5, ramp ? 0.9 : 0.2, Math.sin(a) * rad * 0.5);
    b.rotation.set(ramp ? r.range(-0.9, -0.5) : r.range(-0.3, 0.3), r.range(0, 3), r.range(-0.3, 0.3));
    g.add(b);
  }
  const chunk = new THREE.DodecahedronGeometry(0.2, 0);
  for (let i = 0; i < plates * 1.5; i++) {
    const a = r.range(0, Math.PI * 2);
    const d = r.range(0, rad * 1.1);
    g.add(mesh(chunk, mat('stone', { c1: 0x5a5854, c2: 0x2a2826, p: [3, 0, 0, 0] }), { pos: [Math.cos(a) * d, 0.1, Math.sin(a) * d], scale: [r.range(0.4, 1.3), r.range(0.3, 0.8), r.range(0.4, 1.2)], rot: [r.range(0, 3), r.range(0, 3), 0] }));
  }
  return g;
}
