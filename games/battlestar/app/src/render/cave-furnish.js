// What people built or left under the island, and in the rainforest, in
// style A (ADR-013): a working mine (timber sets, rails, a loaded ore cart,
// rickety ladders), the supply room (picks, shovels, hard hats, dynamite),
// the catacombs (carved wall niches, sarcophagi, treasure, spears, swords,
// coats of mail, golden statues), the Sepulcher (a jewelled tomb strapped
// in silver), the goddess's throne and fern nests, stone doors, hewn
// stairs, cave columns — and in the forest a fire pit, fallen logs,
// stumps and fowl. Built with the modelling toolkit (model.js); repeated
// geometry is cached and shared (the stage does not dispose it).
// Conventions: things stand on y = 0 and face +z (toward the camera).

import * as THREE from 'three';
import { mat, glowMat } from './materials.js';
import { mesh } from './geo.js';
import { rbox as rbox0, roundedBoxGeo, cushionGeo, latheGeo, tubeGeo, weldNormals } from './model.js';
import { merge } from './flora.js';
import { buildHuman, poseOf, applyPose } from './humans.js';

// rounded boxes here default to two steps per edge (the eye cannot tell at
// these sizes and a CPU rasteriser can); `seg: 1` for small carved details
const rbox = (w, h, d, r, m, o = {}) => rbox0(w, h, d, r, m, { seg: 2, ...o });

const cache = new Map();
function G(key, make) {
  if (!cache.has(key)) { const g = make(); g.userData.shared = true; cache.set(key, g); }
  return cache.get(key);
}
const noise = (x, y, z, s = 1) => Math.sin(x * 1.7 * s + y * 0.3 + 1.3) * Math.cos(z * 1.3 * s - x * 0.7) * 0.5
  + Math.sin(x * 4.1 * s - z * 3.3 * s + y * 2.2) * 0.25 + Math.sin(y * 5.3 * s + z * 1.9) * 0.12;

// ---------------------------------------------------------------- materials (style A)

// Wood grain runs along a part's local y and z (see the wood family), so
// long wooden parts are built along z (or y) and rotated into place, and
// bake() keeps wooden meshes separate so each keeps its own grain.
export const CM = {
  timber: () => mat('wood', { c1: 0x5e4a34, c2: 0x3a2c1e, p: [2.6, 0, 0, 0] }),
  timberDark: () => mat('wood', { c1: 0x4a3a2a, c2: 0x2e241a, p: [2.8, 0, 0, 0] }),
  planks: () => mat('wood', { c1: 0x5e4a32, c2: 0x3e3020, p: [2.2, 0, 0, 0] }),
  iron: () => mat('metal', { c1: 0x5c5c60, c2: 0x3a2618, p: [0.5, 0.65, 0, 0] }),
  steel: () => mat('metal', { c1: 0xb8c0c8, c2: 0x5a5a5a, p: [0.28, 0.2, 0, 0] }),
  rope: () => mat('fabric', { c1: 0x9a7a4a, c2: 0x5a4424, p: [2.6, 0.05, 0, 1] }),
  // dressed stone: smooth, faintly mottled
  limestone: () => mat('plaster', { c1: 0x8e8672, p: [0, 0, 0, 0], seed: 3 }),
  marble: () => mat('plaster', { c1: 0xa49c8a, p: [0, 0, 0, 0], seed: 5 }),
  basalt: () => mat('stone', { c1: 0x3e3834, c2: 0x161412, c3: 0x2a3a2a, p: [0.9, 0.4, 0.08, 0] }),
  gold: () => mat('gold', { c1: 0xffc24a, c2: 0xffffff, p: [0.9, 0.3, 0, 0] }),
  goldBright: () => mat('gold', { c1: 0xffd060, c2: 0xffffff, p: [1.4, 0.12, 0, 0] }),
  silver: () => mat('metal', { c1: 0xe6eaee, c2: 0xa0a8b0, p: [0.12, 0.02, 0, 0] }),
  velvet: () => mat('fabric', { c1: 0x6e1222, c2: 0x3e0814, p: [1.1, 0.9, 0, 0.6] }),
  pottery: () => mat('matte', { c1: 0x9a4e2c, c2: 0xb86a40, p: [0.65, 0.5, 0, 0] }),
  potteryDark: () => mat('matte', { c1: 0x3a2a22, c2: 0x5a3a2a, p: [0.55, 0.6, 0, 0] }),
  mail: () => mat('grate', { c1: 0x8a9098, c2: 0x3a3e44, c3: 0x000000, p: [0.035, 0, 0, 0] }),
  leaf: () => mat('fabric', { c1: 0x4a6a2a, c2: 0x2a3a18, p: [0.8, 0.15, 0, 1] }),
  dryLeaf: () => mat('fabric', { c1: 0x7a6a3a, c2: 0x4e4226, p: [0.8, 0.1, 0, 1] }),
  red: () => mat('matte', { c1: 0xa8281c, c2: 0xc03424, p: [0.55, 0.4, 0, 0] }),
  charcoal: () => mat('bark', { c1: 0x1c1814, c2: 0x080605, p: [5, 3, 0, 0] }),
  ash: () => mat('stone', { c1: 0x6a6660, c2: 0x2a2826, p: [0.8, 0, 0, 0] }),
  bark: () => mat('bark', { c1: 0x4a3a28, c2: 0x2a2014, p: [4, 3, 0, 0] }),
  endGrain: () => mat('wood', { c1: 0xa08058, c2: 0x6a4e30, p: [7, 0, 0, 0] }),
  moss: () => mat('fabric', { c1: 0x3a6a24, c2: 0x24481a, p: [1.4, 0.1, 0, 1] }),
};
export const isWood = (m) => /^bs-(wood|bark)/.test(m.customProgramCacheKey ? m.customProgramCacheKey() : '');
/** A wooden beam of length len along x (built along z so the grain runs with it). */
function beamX(len, h, d, r, material, o = {}) {
  const b = rbox(d, h, len, r, material, { pos: o.pos, center: o.center });
  b.rotation.set(o.rot?.[0] ?? 0, Math.PI / 2 + (o.rot?.[1] ?? 0), o.rot?.[2] ?? 0, 'YXZ');
  return b;
}

// ---------------------------------------------------------------- rock shapes

/** A lumpy rock (displaced icosahedron), radius ~1, seeded. */
export function rockGeo(seed = 1, detail = 1, rough = 0.28, angular = false) {
  return G(`rock-${seed % 12}-${detail}-${rough}-${angular}`, () => {
    const g = new THREE.IcosahedronGeometry(1, detail);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i); const y = p.getY(i); const z = p.getZ(i);
      const k = 1 + rough * noise(x * 1.3 + seed, y * 1.3, z * 1.3 - seed, 1) + rough * 0.4 * noise(x * 3 - seed, y * 3, z * 3, 1.3);
      p.setXYZ(i, x * k, y * k * 0.85, z * k);
    }
    if (angular) { g.computeVertexNormals(); return g; }
    return weldNormals(g);
  });
}

/** A stalagmite (up, blunt and rippled) or stalactite (down, a drip point). Cached by seed. */
export function spire(h, r, seed = 1, down = false) {
  return G(`spire-${seed % 5}-${down}`, () => {
    const pts = [[0, 0]];
    const n = 18;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const taper = down ? (1 - t) ** 1.4 : Math.sqrt(Math.max(0, 1 - t ** 2.2));
      const ripple = 1 + 0.12 * Math.sin(t * 17 + seed) + 0.06 * Math.sin(t * 41 + seed * 2);
      const rr = (down ? 1 : 1 - 0.55 * t) * taper * ripple + (down ? 0.015 : 0);
      pts.push([i === n ? 0.001 : Math.max(0.001, rr), t]);
    }
    const g = latheGeo(pts, 12);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i); const y = p.getY(i); const z = p.getZ(i);
      const k = 1 + 0.2 * noise(x * 4 + seed, y * 3, z * 4, 1);
      p.setX(i, x * k + 0.12 * y * y); p.setZ(i, z * k);
    }
    if (down) g.rotateX(Math.PI);
    return weldNormals(g);
  });
}

// ---------------------------------------------------------------- the mine

/** A mine timber set: two posts, a cap beam, wedges and lagging boards over the top. */
export function timberSet(width, height, seed = 1) {
  const g = new THREE.Group();
  const t = CM.timber();
  const dark = CM.timberDark();
  const post = 0.22;
  const lean = 0.06;
  for (const s of [-1, 1]) {
    const p = rbox(post, height, post, 0.03, t, { pos: [s * width / 2, 0, 0] });
    p.rotation.z = -s * lean;
    p.rotation.y = 0.05 * Math.sin(seed + s);
    g.add(p);
    // foot block and a wedge under the cap
    g.add(rbox(0.34, 0.12, 0.34, 0.03, dark, { pos: [s * width / 2, 0, 0] }));
    g.add(rbox(0.12, 0.16, 0.26, 0.02, dark, { pos: [s * (width / 2 - 0.2), height - 0.2, 0], rot: [0, 0, s * 0.3] }));
  }
  g.add(beamX(width + 0.5, 0.26, 0.26, 0.035, t, { pos: [0, height, 0], rot: [0, 0, 0.02 * Math.sin(seed)] }));
  // lagging: boards laid across the caps, some cracked, one sagging
  for (let i = 0; i < 5; i++) {
    const b = rbox(0.18, 0.04, 1.6, 0.012, dark, { pos: [(i - 2) * (width / 5), height + 0.26, 0] });
    b.rotation.x = 0.03 * Math.sin(seed * 3 + i);
    g.add(b);
  }
  // iron spikes and a hanging hook
  const iron = CM.iron();
  for (const s of [-1, 1]) g.add(mesh(G('spike', () => new THREE.CylinderGeometry(0.014, 0.014, 0.08, 6)), iron, { pos: [s * (width / 2 - 0.05), height + 0.1, 0.14], rot: [Math.PI / 2, 0, 0], shadow: false }));
  const hook = mesh(G('hook', () => new THREE.TorusGeometry(0.05, 0.008, 6, 14, Math.PI * 1.4)), iron, { pos: [0.3, height - 0.08, 0.14], rot: [0, 0, 2.2], shadow: false });
  g.add(hook);
  return g;
}

/** A narrow-gauge track of length `len` along -z from z = 0. */
export function railTrack(len, gauge = 0.6) {
  const g = new THREE.Group();
  const sleeper = CM.timberDark();
  const n = Math.floor(len / 0.6);
  const sg = G('sleeper', () => { const b = roundedBoxGeo(0.16, 0.08, gauge + 0.4, 0.02, 2, 1); b.rotateY(Math.PI / 2); return b; });
  const im = new THREE.InstancedMesh(sg, sleeper, n);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  for (let i = 0; i < n; i++) {
    q.setFromEuler(new THREE.Euler(0, 0.04 * Math.sin(i * 2.3), 0));
    m4.compose(new THREE.Vector3(0, 0.04, -i * 0.6 - 0.3), q, new THREE.Vector3(1, 1, 1));
    im.setMatrixAt(i, m4);
  }
  im.receiveShadow = true;
  g.add(im);
  for (const s of [-1, 1]) {
    // a flat-bottomed rail: foot, web, head
    const rail = new THREE.Group();
    rail.add(rbox(0.06, 0.012, len, 0.004, CM.iron(), { pos: [0, 0, 0], center: true }));
    rail.add(rbox(0.014, 0.05, len, 0.004, CM.iron(), { pos: [0, 0.03, 0], center: true }));
    rail.add(rbox(0.035, 0.018, len, 0.006, CM.steel(), { pos: [0, 0.062, 0], center: true }));
    rail.position.set(s * gauge / 2, 0.086, -len / 2);
    g.add(rail);
  }
  return g;
}

/** A mine cart: a tapered plank hopper strapped with iron on four flanged wheels, optionally heaped with ore. */
export function mineCart({ ore = true, seed = 1 } = {}) {
  const g = new THREE.Group();
  const iron = CM.iron();
  const wood = mat('wood', { c1: 0x5a4632, c2: 0x3a2c1e, p: [3, 0, 0, 0], side: THREE.DoubleSide });
  // hopper sides: planks (built along z, so the grain runs with them), flared outward
  const L = 1.1; const W = 0.72; const H = 0.56;
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const pl = rbox(0.035, H / 3 - 0.01, L + 0.04 * i, 0.01, wood, { pos: [s * (W / 2 + i * 0.03), 0.42 + i * H / 3, 0] });
      pl.rotation.z = -s * 0.1;
      g.add(pl);
    }
    for (let i = 0; i < 3; i++) {
      const pl = rbox(0.035, H / 3 - 0.01, W + 0.04 * i, 0.01, wood, { pos: [0, 0.42 + i * H / 3, s * (L / 2 + i * 0.03)] });
      pl.rotation.set(s * 0.1, Math.PI / 2, 0, 'YXZ');
      g.add(pl);
    }
    // iron corner straps and a top rim
    for (const t of [-1, 1]) g.add(rbox(0.05, H + 0.06, 0.05, 0.01, iron, { pos: [s * (W / 2 + 0.06), 0.4, t * (L / 2 + 0.06)], rot: [t * 0.1, 0, -s * 0.1] }));
    g.add(rbox(0.03, 0.05, L + 0.24, 0.01, iron, { pos: [s * (W / 2 + 0.1), 0.95, 0] }));
    g.add(rbox(W + 0.24, 0.05, 0.03, 0.01, iron, { pos: [0, 0.95, s * (L / 2 + 0.1)] }));
  }
  g.add(rbox(W, 0.04, L, 0.01, wood, { pos: [0, 0.4, 0] }));
  // chassis, axles, flanged wheels
  for (const s of [-1, 1]) g.add(rbox(0.08, 0.1, L + 0.2, 0.015, iron, { pos: [s * 0.22, 0.3, 0] }));
  const wheel = G('wheel', () => { const w = latheGeo([[0, -0.03], [0.14, -0.03], [0.14, -0.018], [0.165, -0.018], [0.165, 0.018], [0.14, 0.018], [0.14, 0.03], [0, 0.03]], 20); w.rotateZ(Math.PI / 2); return w; });
  const axle = G('axle', () => { const a = new THREE.CylinderGeometry(0.022, 0.022, 0.72, 8); a.rotateZ(Math.PI / 2); return a; });
  for (const z of [-0.34, 0.34]) {
    g.add(mesh(axle, iron, { pos: [0, 0.17, z] }));
    for (const x of [-0.3, 0.3]) g.add(mesh(wheel, iron, { pos: [x, 0.17, z] }));
  }
  g.add(mesh(G('coupler', () => new THREE.TorusGeometry(0.05, 0.012, 6, 12)), iron, { pos: [0, 0.3, L / 2 + 0.18], rot: [0, Math.PI / 2, 0] }));
  if (ore) {
    // "a cartload of very high grade gold and silver ore"
    const rockM = mat('stone', { c1: 0x5a524a, c2: 0x2a2622, p: [0.9, 0, 0, 1], q: [1.0, 0.8, 0.35, 0] });
    const n = 30;
    const im = new THREE.InstancedMesh(rockGeo(3, 0, 0.35, true), rockM, n);
    const m4 = new THREE.Matrix4();
    let s = seed * 7.31;
    const rnd = () => { s = (s * 16807 + 11) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2;
      const rr = Math.sqrt(rnd());
      const x = Math.cos(a) * rr * 0.36;
      const z = Math.sin(a) * rr * 0.55;
      const y = 0.9 + (1 - rr) * 0.2 + rnd() * 0.05;
      const sc = 0.07 + rnd() * 0.07;
      m4.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd() * 3, rnd() * 3, 0)), new THREE.Vector3(sc, sc, sc));
      im.setMatrixAt(i, m4);
    }
    g.add(im);
    for (let i = 0; i < 11; i++) g.add(mesh(G('nugget', () => new THREE.IcosahedronGeometry(0.035, 0)), i % 3 ? CM.goldBright() : CM.silver(), { pos: [Math.sin(i * 2.4) * 0.26, 1.03 + (i % 3) * 0.02, Math.cos(i * 1.7) * 0.4], shadow: false }));
  }
  // built with its length along z; the track runs along z
  return g;
}

/** A ladder of height h from y = 0 up, rungs every 0.3 m; rickety = uneven rungs and lashings. */
export function ladder(h, { width = 0.5, rickety = true, seed = 1 } = {}) {
  const g = new THREE.Group();
  const wood = CM.timber();
  for (const s of [-1, 1]) {
    const rail = rbox(0.06, h, 0.07, 0.018, wood, { pos: [s * width / 2, 0, 0] });
    rail.rotation.z = rickety ? s * 0.012 : 0;
    g.add(rail);
  }
  const rung = G('rung', () => { const c = new THREE.CylinderGeometry(0.022, 0.022, 1, 8); c.rotateZ(Math.PI / 2); return c; });
  const lash = G('lash', () => new THREE.TorusGeometry(0.04, 0.012, 6, 12));
  const rope = CM.rope();
  const n = Math.floor((h - 0.25) / 0.3);
  for (let i = 0; i < n; i++) {
    const y = 0.25 + i * 0.3;
    const tilt = rickety ? 0.06 * Math.sin(seed * 3.1 + i * 2.7) : 0;
    const r = mesh(rung, wood, { pos: [0, y + tilt * 0.3, 0.005], scale: [width + 0.06, 1, 1], rot: [0, 0, tilt] });
    g.add(r);
    if (rickety && (i + seed) % 3 === 0) {
      for (const s of [-1, 1]) g.add(mesh(lash, rope, { pos: [s * width / 2, y, 0], rot: [0, Math.PI / 2, 0], scale: [1, 1, 1.3], shadow: false }));
    }
  }
  return g;
}

/** A square timber collar round a shaft of half-width a. */
export function shaftCollar(a, w = 0.26) {
  const g = new THREE.Group();
  const t = CM.timberDark();
  for (const s of [-1, 1]) {
    // two sills across, two between them; spiked at the corners
    g.add(beamX(a * 2 + w * 2 + 0.3, 0.22, w, 0.03, t, { pos: [0, 0, s * (a + w / 2)] }));
    g.add(rbox(w, 0.2, a * 2, 0.03, t, { pos: [s * (a + w / 2), 0, 0] }));
    for (const q of [-1, 1]) g.add(mesh(G('spikeHead', () => new THREE.CylinderGeometry(0.025, 0.025, 0.015, 8)), CM.iron(), { pos: [s * (a + w / 2), 0.225, q * (a + w / 2)], shadow: false }));
  }
  return g;
}

// ---------------------------------------------------------------- the supply room

export function pickaxe() {
  const g = new THREE.Group();
  g.add(mesh(G('pickHandle', () => latheGeo([[0, 0], [0.018, 0], [0.02, 0.1], [0.018, 0.7], [0.022, 0.86], [0, 0.88]], 10)), CM.timber()));
  const head = tubeGeo([[-0.3, 0.8, -0.02], [-0.12, 0.86, 0], [0, 0.87, 0], [0.12, 0.86, 0], [0.3, 0.8, -0.02]], 0.022, 16);
  g.add(mesh(head, CM.iron()));
  for (const s of [-1, 1]) g.add(mesh(G('pickTip', () => new THREE.ConeGeometry(0.022, 0.07, 8)), CM.steel(), { pos: [s * 0.33, 0.78, -0.02], rot: [0, 0, s * 2.0] }));
  return g;
}

export function shovel() {
  const g = new THREE.Group();
  g.add(mesh(G('shovelHandle', () => latheGeo([[0, 0], [0.02, 0], [0.02, 0.95], [0, 0.96]], 10)), CM.timber(), { pos: [0, 0.3, 0] }));
  g.add(mesh(G('dgrip', () => new THREE.TorusGeometry(0.06, 0.012, 6, 16, Math.PI)), CM.timber(), { pos: [0, 1.28, 0] }));
  const blade = G('blade', () => {
    const s = new THREE.Shape();
    s.moveTo(-0.13, 0.3); s.lineTo(0.13, 0.3); s.lineTo(0.13, 0.06); s.quadraticCurveTo(0.1, -0.03, 0, -0.06); s.quadraticCurveTo(-0.1, -0.03, -0.13, 0.06); s.lineTo(-0.13, 0.3);
    const e = new THREE.ExtrudeGeometry(s, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1 });
    const p = e.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) + 0.04 * (p.getX(i) / 0.13) ** 2); // dished
    e.computeVertexNormals();
    return e;
  });
  g.add(mesh(blade, CM.steel(), { pos: [0, 0.06, 0] }));
  return g;
}

export function hardHat() {
  const g = new THREE.Group();
  g.add(mesh(G('hat', () => latheGeo([[0, 0.16], [0.08, 0.155], [0.13, 0.12], [0.145, 0.06], [0.15, 0.02], [0.2, 0.012], [0.21, 0], [0.18, -0.006], [0, -0.006]], 24)), mat('matte', { c1: 0xc89a2a, c2: 0xd8aa3a, p: [0.45, 0.3, 0, 0] })));
  g.add(mesh(G('hatLamp', () => latheGeo([[0, 0], [0.03, 0], [0.035, 0.03], [0, 0.035]], 12)), CM.iron(), { pos: [0, 0.1, 0.13], rot: [Math.PI / 2, 0, 0] }));
  return g;
}

/** A wooden box of dynamite, lid ajar, the sticks showing. */
export function dynamiteBox(open = false) {
  const g = new THREE.Group();
  const wood = CM.planks();
  for (let i = 0; i < 3; i++) g.add(beamX(0.6, 0.1, 0.4, 0.012, wood, { pos: [0, i * 0.1, 0] }));
  g.add(rbox(0.3, 0.07, 0.01, 0.003, CM.red(), { pos: [0, 0.14, 0.2], center: true }));
  for (const s of [-1, 1]) g.add(mesh(G('boxRope', () => new THREE.TorusGeometry(0.05, 0.01, 6, 12, Math.PI)), CM.rope(), { pos: [s * 0.3, 0.2, 0], rot: [0, Math.PI / 2, Math.PI] }));
  if (open) {
    const stick = G('stick', () => { const c = new THREE.CylinderGeometry(0.028, 0.028, 0.34, 10); c.rotateZ(Math.PI / 2); return c; });
    for (let i = 0; i < 7; i++) g.add(mesh(stick, CM.red(), { pos: [0, 0.31, -0.13 + i * 0.043], shadow: false }));
    const lid = rbox(0.6, 0.03, 0.4, 0.01, wood, { pos: [0, 0.3, -0.25], rot: [-1.1, 0, 0] });
    g.add(lid);
  } else {
    g.add(rbox(0.6, 0.03, 0.4, 0.01, wood, { pos: [0, 0.3, 0] }));
  }
  return g;
}

/** A plank tool rack on the wall with picks and shovels hanging. */
export function toolRack(len = 2.4, seed = 1) {
  const g = new THREE.Group();
  const t = CM.timberDark();
  g.add(beamX(len, 0.14, 0.05, 0.02, t, { pos: [0, 1.55, 0] }));
  g.add(beamX(len, 0.1, 0.05, 0.02, t, { pos: [0, 0.35, 0] }));
  for (const s of [-1, 1]) g.add(rbox(0.12, 1.5, 0.06, 0.02, t, { pos: [s * (len / 2 - 0.1), 0.2, -0.01] }));
  const n = Math.floor(len / 0.34);
  for (let i = 0; i < n; i++) {
    const x = -len / 2 + 0.25 + i * (len - 0.5) / Math.max(1, n - 1);
    const tool = i % 2 ? shovel() : pickaxe();
    tool.position.set(x, 0.38, 0.06);
    tool.rotation.z = 0.08 * Math.sin(seed + i * 1.9);
    g.add(tool);
    g.add(mesh(G('peg', () => { const c = new THREE.CylinderGeometry(0.015, 0.015, 0.1, 6); c.rotateX(Math.PI / 2); return c; }), CM.timber(), { pos: [x, 1.5, 0.06], shadow: false }));
  }
  return g;
}

// ---------------------------------------------------------------- tombs and treasure

/** A stone sarcophagus w × l, lid moulded; grand = diamonds, opals and silver straps. */
export function sarcophagus({ w = 1.1, l = 2.3, h = 0.9, grand = false } = {}) {
  const g = new THREE.Group();
  const stone = grand ? CM.marble() : CM.limestone();
  // plinth, chest with panels, lid with a raised moulded top
  g.add(rbox(w + 0.24, 0.16, l + 0.24, 0.03, stone, {}));
  g.add(rbox(w + 0.14, 0.06, l + 0.14, 0.02, stone, { pos: [0, 0.16, 0] }));
  g.add(rbox(w, h - 0.22, l, 0.02, stone, { pos: [0, 0.22, 0] }));
  // carved panels (sunken frames) along the sides
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const z = (i - 1) * l / 3;
      g.add(rbox(0.012, h - 0.46, l / 3 - 0.18, 0.006, stone, { pos: [s * (w / 2 + 0.004), 0.34, z], seg: 1 }));
      g.add(rbox(0.018, 0.05, l / 3 - 0.3, 0.008, stone, { pos: [s * (w / 2 + 0.008), 0.34 + (h - 0.46) / 2 - 0.025, z], seg: 1 }));
    }
  }
  g.add(rbox(w + 0.12, 0.08, l + 0.12, 0.02, stone, { pos: [0, h, 0] }));
  g.add(rbox(w - 0.1, 0.12, l - 0.1, 0.05, stone, { pos: [0, h + 0.08, 0] }));
  if (grand) {
    // "secured with straps of a very hard, untarnished silver"
    const silver = CM.silver();
    for (const z of [-l * 0.3, 0, l * 0.3]) {
      g.add(rbox(w + 0.16, 0.035, 0.1, 0.01, silver, { pos: [0, h + 0.2, z], seg: 1 }));
      for (const s of [-1, 1]) g.add(rbox(0.035, h, 0.1, 0.01, silver, { pos: [s * (w / 2 + 0.05), 0.22, z], seg: 1 }));
    }
    // "encrusted with diamonds and opals"
    const dia = gemMat(0xf4f8ff, 0x3a3e48);
    const opal = [gemMat(0xa8dce8, 0x1a3a44), gemMat(0xe8c0dc, 0x3a1a34), gemMat(0xc8ecd0, 0x1a3a24)];
    const gem = G('gem', () => new THREE.OctahedronGeometry(0.03, 0));
    for (let i = 0; i < 40; i++) {
      const on = i % 2;
      const z = -l / 2 + 0.15 + (i % 20) * (l - 0.3) / 19;
      const x = (i < 20 ? -1 : 1) * (w / 2 - 0.12);
      g.add(mesh(gem, on ? dia : opal[i % 3], { pos: [x, h + 0.2, z], scale: [1, 0.6, 1], shadow: false }));
    }
    for (let i = 0; i < 12; i++) g.add(mesh(gem, i % 2 ? dia : opal[i % 3], { pos: [(i % 2 ? -1 : 1) * (w / 2 + 0.02), 0.34 + (i % 3) * 0.14, -l / 2 + 0.3 + Math.floor(i / 2) * 0.35], rot: [0, 0, Math.PI / 2], shadow: false }));
  }
  return g;
}

const gems = new Map();
/** A cut stone that catches the light (a faint inner fire so it reads in the dark). */
function gemMat(color, fire) {
  if (!gems.has(color)) gems.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.06, metalness: 0.6, emissive: fire, emissiveIntensity: 0.9, flatShading: true }));
  return gems.get(color);
}

/** An arched burial niche in a wall: frame of carved stone, the recess dark. Faces +z. */
export function wallNiche(w = 1.4, h = 1.1, seed = 1) {
  const g = new THREE.Group();
  const stone = CM.limestone();
  g.add(rbox(w, 0.14, 0.4, 0.03, stone, {}));
  for (const s of [-1, 1]) g.add(rbox(0.16, h, 0.36, 0.03, stone, { pos: [s * (w / 2 - 0.08), 0.14, 0] }));
  const arch = mesh(G(`arch-${w}`, () => new THREE.TorusGeometry(w / 2 - 0.08, 0.08, 8, 24, Math.PI)), stone, { pos: [0, h + 0.14, 0], scale: [1, 0.6, 2.2] });
  g.add(arch);
  // keystone
  g.add(rbox(0.14, 0.2, 0.3, 0.02, stone, { pos: [0, h + 0.14 + (w / 2 - 0.08) * 0.6 - 0.12, 0.02] }));
  // the recess
  g.add(mesh(new THREE.PlaneGeometry(w - 0.3, h + (w / 2) * 0.55), glowMat(0x050403, 1), { pos: [0, 0.14 + (h + (w / 2) * 0.55) / 2, -0.12], shadow: false }));
  return g;
}

/** A heap of coins (instanced), radius r. */
export function coinHeap(r = 0.4, n = 120, seed = 1) {
  const coin = G('coin', () => new THREE.CylinderGeometry(0.024, 0.024, 0.005, 7));
  const im = new THREE.InstancedMesh(coin, CM.goldBright(), n);
  const m4 = new THREE.Matrix4();
  let s = seed * 9.7 + 3;
  const rnd = () => { s = (s * 16807 + 7) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2;
    const d = Math.sqrt(rnd()) * r;
    const y = (1 - (d / r) ** 1.6) * r * 0.55 + 0.003;
    m4.compose(new THREE.Vector3(Math.cos(a) * d, y, Math.sin(a) * d), new THREE.Quaternion().setFromEuler(new THREE.Euler((rnd() - 0.5) * 1.2, rnd() * 3, (rnd() - 0.5) * 1.2)), new THREE.Vector3(1, 1, 1));
    im.setMatrixAt(i, m4);
  }
  const g = new THREE.Group();
  // a mound under the coins so the heap reads solid
  g.add(mesh(G(`mound-${r}`, () => latheGeo([[0, 0], [r, 0], [r * 0.7, r * 0.2], [r * 0.3, r * 0.45], [0, r * 0.53]], 18)), CM.gold(), { shadow: false }));
  g.add(im);
  return g;
}

/** An amphora or urn (kind 0..2), optionally overflowing with coins. */
export function vase(kind = 0, coins = false) {
  const g = new THREE.Group();
  const prof = [
    [[0, 0], [0.12, 0], [0.14, 0.04], [0.24, 0.2], [0.26, 0.34], [0.2, 0.5], [0.1, 0.6], [0.09, 0.68], [0.13, 0.72], [0.12, 0.74], [0, 0.74]],
    [[0, 0], [0.08, 0], [0.1, 0.03], [0.2, 0.14], [0.22, 0.28], [0.14, 0.4], [0.12, 0.44], [0.16, 0.47], [0, 0.47]],
    [[0, 0], [0.05, 0], [0.07, 0.05], [0.16, 0.22], [0.17, 0.4], [0.11, 0.55], [0.05, 0.66], [0.05, 0.8], [0.08, 0.83], [0, 0.83]],
  ][kind % 3];
  g.add(mesh(G(`vase-${kind % 3}`, () => latheGeo(prof, 28)), kind % 3 === 1 ? CM.gold() : kind % 3 === 2 ? CM.potteryDark() : CM.pottery()));
  if (kind % 3 === 0) for (const s of [-1, 1]) g.add(mesh(G('handle', () => new THREE.TorusGeometry(0.08, 0.016, 6, 14, Math.PI)), CM.pottery(), { pos: [s * 0.17, 0.58, 0], rot: [0, 0, s > 0 ? -Math.PI / 2 : Math.PI / 2] }));
  if (coins) {
    const top = prof[prof.length - 2][1];
    const heap = coinHeap(0.14, 40, kind + 3);
    heap.position.y = top - 0.02;
    g.add(heap);
    const spill = coinHeap(0.22, 50, kind + 9);
    spill.position.set(0.25, 0, 0.12);
    spill.scale.y = 0.5;
    g.add(spill);
  }
  return g;
}

/** A long spear "with many blades", leaning. */
export function manyBladedSpear() {
  const g = new THREE.Group();
  g.add(mesh(G('spearShaft', () => latheGeo([[0, 0], [0.02, 0], [0.018, 2.2], [0.012, 2.3], [0, 2.3]], 8)), CM.timberDark()));
  const blade = G('spearBlade', () => {
    const s = new THREE.Shape();
    s.moveTo(0, 0); s.quadraticCurveTo(0.06, 0.12, 0, 0.36); s.quadraticCurveTo(-0.06, 0.12, 0, 0);
    return new THREE.ExtrudeGeometry(s, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1 });
  });
  g.add(mesh(blade, CM.steel(), { pos: [0, 2.28, 0] }));
  for (const [y, a] of [[2.1, 1.1], [2.05, -1.1], [1.9, 0.9], [1.86, -0.9]]) g.add(mesh(blade, CM.steel(), { pos: [0, y, 0], rot: [0, 0, a], scale: 0.6 }));
  g.add(mesh(G('ferrule', () => new THREE.CylinderGeometry(0.026, 0.022, 0.08, 10)), CM.gold(), { pos: [0, 2.2, 0] }));
  return g;
}

/** A sword lying or leaning: blade, guard, grip, pommel. */
export function sword(fine = true) {
  const g = new THREE.Group();
  g.add(rbox(0.05, 0.9, 0.008, 0.003, CM.steel(), { pos: [0, 0.18, 0] }));
  g.add(mesh(G('swordTip', () => new THREE.ConeGeometry(0.025, 0.1, 4)), CM.steel(), { pos: [0, 1.13, 0], scale: [1, 1, 0.16] }));
  g.add(rbox(0.26, 0.03, 0.04, 0.012, fine ? CM.gold() : CM.iron(), { pos: [0, 0.15, 0] }));
  g.add(mesh(G('grip', () => latheGeo([[0, 0], [0.018, 0], [0.02, 0.06], [0.018, 0.13], [0, 0.13]], 10)), fine ? CM.velvet() : CM.timberDark(), { pos: [0, 0.02, 0] }));
  g.add(mesh(G('pommel', () => new THREE.SphereGeometry(0.03, 12, 8)), fine ? CM.gold() : CM.iron(), { pos: [0, 0.0, 0] }));
  return g;
}

/** A coat of mail on a wooden stand (a cross-shaped dummy). */
export function mailStand() {
  const g = new THREE.Group();
  const t = CM.timberDark();
  g.add(rbox(0.5, 0.05, 0.5, 0.02, t, {}));
  g.add(rbox(0.05, 1.5, 0.05, 0.01, t, { pos: [0, 0.05, 0] }));
  g.add(rbox(0.6, 0.05, 0.05, 0.01, t, { pos: [0, 1.4, 0] }));
  const coat = G('mailCoat', () => {
    const l = latheGeo([[0.02, 1.52], [0.16, 1.48], [0.2, 1.38], [0.19, 1.2], [0.17, 1.02], [0.2, 0.86], [0.24, 0.76], [0.25, 0.74]], 24);
    l.scale(1, 1, 0.7);
    return weldNormals(l);
  });
  const mailM = mat('grate', { c1: 0x9aa0a8, c2: 0x2a2e34, c3: 0x000000, p: [0.03, 0, 0, 0], side: THREE.DoubleSide });
  g.add(mesh(coat, mailM, {}));
  for (const s of [-1, 1]) {
    const sl = mesh(G('mailSleeve', () => { const c = new THREE.CylinderGeometry(0.07, 0.09, 0.32, 14, 1, true); c.translate(0, -0.16, 0); return c; }), mailM, { pos: [s * 0.2, 1.44, 0], rot: [0, 0, s * 0.6] });
    g.add(sl);
  }
  return g;
}

// ---------------------------------------------------------------- the throne room

/**
 * "A throne of gold and silver which pulls out into a bed of enormous size."
 * Faces +z. The seat's front edge is at z = 0.42 and its cushion top at
 * ~1.07, so a figure sitting with its hips at (0, 0.6 + 0.58, 0.02) fits.
 */
export function throne() {
  const g = new THREE.Group();
  // satin, not mirror: a held lantern would otherwise flare in the backrest
  const gold = mat('gold', { c1: 0xffc24a, c2: 0xffffff, p: [0.9, 0.35, 0, 0] });
  const silver = CM.silver();
  // a stepped silver dais
  g.add(rbox0(3.6, 0.16, 3.0, 0.04, silver, { pos: [0, 0, 0.05] }));
  g.add(rbox0(3.1, 0.16, 2.5, 0.04, silver, { pos: [0, 0.16, -0.1] }));
  // the seat: a deep silver base (the bed rolls out of it), a velvet cushion
  g.add(rbox0(2.4, 0.46, 1.2, 0.06, silver, { pos: [0, 0.32, -0.18] }));
  g.add(rbox0(2.46, 0.05, 1.26, 0.02, gold, { pos: [0, 0.76, -0.18] }));
  g.add(mesh(cushionGeo(2.1, 0.18, 1.05, { r: 0.07, puff: 0.35, under: 0.2 }), CM.velvet(), { pos: [0, 0.92, -0.15] }));
  // the pull-out bed's front: a gold panel with two silver pulls
  g.add(rbox0(2.2, 0.3, 0.04, 0.015, gold, { pos: [0, 0.38, 0.43] }));
  for (const s of [-1, 1]) g.add(mesh(G('bedHandle', () => new THREE.TorusGeometry(0.07, 0.014, 6, 14, Math.PI)), silver, { pos: [s * 0.6, 0.56, 0.46], rot: [0, 0, Math.PI] }));
  // backrest: a tall gold panel, an arched crest with a silver sunburst
  const back = new THREE.Group();
  back.add(rbox0(2.4, 2.35, 0.22, 0.05, gold, {}));
  back.add(mesh(G('crestArch', () => new THREE.TorusGeometry(1.14, 0.1, 12, 40, Math.PI)), gold, { pos: [0, 2.3, 0] }));
  back.add(mesh(G('crestFill', () => new THREE.CircleGeometry(1.1, 40, 0, Math.PI)), gold, { pos: [0, 2.3, 0.1] }));
  back.add(mesh(G('crestBack', () => new THREE.CircleGeometry(1.1, 40, 0, Math.PI)), gold, { pos: [0, 2.3, -0.1], rot: [0, Math.PI, 0] }));
  for (let i = 0; i < 13; i++) {
    const a = (i / 12) * Math.PI;
    back.add(rbox0(0.045, 0.66, 0.03, 0.01, silver, { pos: [Math.cos(a) * 0.55, 2.3 + Math.sin(a) * 0.55, 0.12], rot: [0, 0, a - Math.PI / 2], center: true }));
  }
  back.add(mesh(G('sun', () => new THREE.SphereGeometry(0.2, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2)), silver, { pos: [0, 2.3, 0.1], rot: [Math.PI / 2, 0, 0] }));
  // a velvet panel inside a silver frame
  back.add(mesh(cushionGeo(1.9, 0.08, 1.7, { r: 0.05, puff: 0.5 }), CM.velvet(), { pos: [0, 1.2, 0.12], rot: [Math.PI / 2, 0, 0] }));
  for (const s of [-1, 1]) back.add(rbox0(0.07, 1.84, 0.06, 0.02, silver, { pos: [s * 1.0, 0.28, 0.13] }));
  back.add(rbox0(2.07, 0.07, 0.06, 0.02, silver, { pos: [0, 2.1, 0.13] }));
  back.position.set(0, 0.78, -0.9);
  back.rotation.x = -0.12;
  g.add(back);
  // a thick velvet back cushion leaning on it
  g.add(mesh(cushionGeo(1.9, 0.34, 1.2, { r: 0.1, puff: 0.3, under: 0.3 }), CM.velvet(), { pos: [0, 1.5, -0.56], rot: [Math.PI / 2 - 0.16, 0, 0] }));
  // armrests with scrolled ends, silver finials on the arms and the crest
  const fin = G('finial', () => latheGeo([[0, 0], [0.09, 0], [0.11, 0.05], [0.07, 0.12], [0.1, 0.2], [0.05, 0.28], [0.02, 0.34], [0, 0.35]], 18));
  for (const s of [-1, 1]) {
    g.add(rbox0(0.22, 0.56, 1.2, 0.06, gold, { pos: [s * 1.26, 0.8, -0.2] }));
    g.add(mesh(G('scroll', () => new THREE.TorusGeometry(0.15, 0.065, 10, 24, Math.PI * 1.5)), gold, { pos: [s * 1.26, 1.28, 0.36], rot: [0, Math.PI / 2, 0.9] }));
    g.add(mesh(fin, silver, { pos: [s * 1.26, 1.36, -0.72] }));
    g.add(mesh(fin, silver, { pos: [s * 1.26, 2.96, -1.2], scale: 1.3 }));
    g.add(rbox0(0.3, 2.3, 0.3, 0.05, gold, { pos: [s * 1.26, 0.78, -0.95], rot: [-0.12, 0, 0] }));
  }
  // a gold footstool with a velvet top for the feet
  g.add(rbox0(1.0, 0.26, 0.44, 0.05, gold, { pos: [0, 0.32, 0.74] }));
  g.add(mesh(cushionGeo(0.92, 0.06, 0.38, { r: 0.03, puff: 0.4 }), CM.velvet(), { pos: [0, 0.62, 0.74] }));
  return g;
}

/** A palm leaf: a curved midrib with drooping leaflets both sides (1 unit long, along +z). */
function palmFrondGeo() {
  return G('palmFrond', () => {
    const pos = [];
    const nrm = [];
    const uv = [];
    const spine = (t) => [0, 0.25 * Math.sin(t * Math.PI * 0.8) - 0.1 * t * t, t];
    const n = 28;
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const [x0, y0, z0] = spine(t);
      const L = 0.34 * Math.sin(Math.min(1, t * 1.25) * Math.PI * 0.9) + 0.04;
      for (const s of [-1, 1]) {
        const tip = [x0 + s * L, y0 - L * 0.55, z0 + L * 0.35];
        pos.push(x0, y0, z0 - 0.012, x0, y0, z0 + 0.012, ...tip);
        for (let k = 0; k < 3; k++) nrm.push(0, 1, 0);
        uv.push(0, 0, 1, 0, 0.5, 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const rib = tubeGeo(Array.from({ length: 8 }, (_, i) => spine(i / 7)), 0.008, 16);
    return merge([g, rib]);
  });
}

/**
 * A cozy nest of ferns and palm leaves: a low mound of dry fronds, fresh
 * fern fronds laid round it tips-out like thatch (the outer ring raised
 * into a rim), and palm leaves thrown across. Baked and cached by seed.
 */
export function nest(r = 1.0, seed = 1) {
  return kit(`nest-${seed % 3}`, () => {
    const g = new THREE.Group();
    g.add(mesh(G('nestBed', () => cushionGeo(1.5, 0.22, 1.25, { r: 0.1, puff: 0.7, under: 0, pinch: 0.35, mid: 8 })), mat('fabric', { c1: 0x4a4a26, c2: 0x2e3018, p: [0.8, 0.1, 0, 1] }), { pos: [0, 0.11, 0] }));
    const frond = G('frond', () => {
      const s = new THREE.Shape();
      s.moveTo(-0.02, 0); s.quadraticCurveTo(0.17, 0.35, 0.05, 0.8); s.lineTo(0, 1.0); s.lineTo(-0.05, 0.8); s.quadraticCurveTo(-0.17, 0.35, 0.02, 0);
      const e = new THREE.ShapeGeometry(s, 6);
      const p = e.attributes.position;
      // arched along its length, the tip drooping, the leaflets cupped
      for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setZ(i, 0.12 * Math.sin(y * Math.PI) - 0.12 * y * y + 0.25 * Math.abs(p.getX(i))); }
      e.computeVertexNormals();
      return e;
    });
    const fresh = mat('fabric', { c1: 0x4a7a30, c2: 0x2e5020, p: [0.5, 0.25, 0, 1], side: THREE.DoubleSide });
    const older = mat('fabric', { c1: 0x6e7c3a, c2: 0x46521f, p: [0.5, 0.2, 0, 1], side: THREE.DoubleSide });
    const palm = mat('fabric', { c1: 0x8a7e48, c2: 0x5e5230, p: [0.5, 0.2, 0, 1], side: THREE.DoubleSide });
    let k = 0;
    const lay = (x, y, z, dir, tilt, sc, m) => {
      const f = mesh(frond, m, { shadow: false });
      f.position.set(x, y, z);
      // the frond's length (+y) points along dir, tipped down (tilt < 0) or up
      f.rotation.set(-Math.PI / 2 + tilt, -dir - Math.PI / 2, 0, 'YXZ');
      f.scale.setScalar(sc);
      g.add(f);
      k++;
    };
    // outer skirt first, then rings toward the crown, each overlapping the one below
    const rings = [[18, 0.62, 0.05, 0.12, 0.85], [14, 0.4, 0.14, -0.18, 0.8], [11, 0.18, 0.22, -0.3, 0.72], [7, 0.02, 0.28, -0.36, 0.6]];
    rings.forEach(([n, rad, y, tilt, sc], ri) => {
      for (let i = 0; i < n; i++) {
        const a = ((i + ri * 0.5) / n) * Math.PI * 2 + 0.25 * Math.sin(seed * 3 + i + ri);
        lay(Math.cos(a) * rad, y, Math.sin(a) * rad * 0.85, a, tilt, sc * (0.9 + 0.2 * Math.sin(i * 2.3 + seed + ri)), (i + ri) % 3 ? fresh : older);
      }
    });
    // palm leaves laid across
    for (let i = 0; i < 3; i++) {
      const a = seed + i * 2.1;
      const f = mesh(palmFrondGeo(), palm, { shadow: false });
      f.position.set(-Math.cos(a) * 0.75, 0.2, -Math.sin(a) * 0.6);
      f.rotation.y = Math.PI / 2 - a;
      f.scale.set(1.1, 0.5, 1.7);
      g.add(f);
    }
    return g;
  }, { scale: r, rotY: seed * 1.3 });
}

// ---------------------------------------------------------------- doors, stairs, statues

/** A carved stone door in a stone frame; open = swung on its pivot. Faces +z. */
export function stoneDoor({ open = false, w = 1.5, h = 2.4 } = {}) {
  const g = new THREE.Group();
  const frame = mat('stone', { c1: 0x6a6258, c2: 0x3a3630, c3: 0x4a4a32, p: [0.8, 0.1, 0.3, 0] });
  const slab = mat('plaster', { c1: 0x7a7266, p: [0, 0, 0, 0], seed: 9 });
  for (const s of [-1, 1]) g.add(rbox(0.5, h + 0.2, 0.7, 0.06, frame, { pos: [s * (w / 2 + 0.25), 0, 0] }));
  g.add(rbox(w + 1.3, 0.55, 0.8, 0.07, frame, { pos: [0, h + 0.1, 0] }));
  g.add(rbox(w + 0.4, 0.12, 0.8, 0.03, frame, { pos: [0, 0, 0] }));
  const door = new THREE.Group();
  door.add(rbox(w, h, 0.26, 0.05, slab, { pos: [w / 2, 0.1, 0] }));
  // carved relief: a sunken border and a circle of runes-like knots
  door.add(rbox(w - 0.3, h - 0.4, 0.02, 0.01, slab, { pos: [w / 2, 0.3, 0.13] }));
  door.add(mesh(G('knot', () => new THREE.TorusKnotGeometry(0.28, 0.035, 80, 8, 2, 5)), slab, { pos: [w / 2, h * 0.62, 0.17], scale: [1, 1, 0.4] }));
  door.add(mesh(G('ring', () => new THREE.TorusGeometry(0.1, 0.022, 8, 18)), CM.iron(), { pos: [w * 0.85, h * 0.45, 0.2] }));
  door.position.x = -w / 2;
  door.rotation.y = open ? -1.1 : 0;
  g.add(door);
  // the dark beyond
  g.add(mesh(new THREE.PlaneGeometry(w, h), glowMat(0x020201, 1), { pos: [0, h / 2 + 0.1, -0.3], shadow: false }));
  return g;
}

/** Stairs hewn from solid rock: n uneven steps rising toward -z. */
export function hewnStairs(n, { rise = 0.24, going = 0.42, width = 1.6, material, seed = 1 } = {}) {
  const g = new THREE.Group();
  const m = material || CM.basalt();
  for (let i = 0; i < n; i++) {
    const wob = Math.sin(seed * 2.1 + i * 1.7);
    const st = rbox(width + 0.1 * wob, rise * (i + 1), going + 0.05, 0.06, m, { pos: [0.05 * wob, 0, -i * going - going / 2] });
    g.add(st);
  }
  return g;
}

// ---------------------------------------------------------------- the forest

/** A fallen log: a noisy trunk with broken ends showing rings, moss on top, branch stubs. */
export function log(len = 4, r = 0.32, seed = 1) {
  const g = new THREE.Group();
  const trunk = G(`log-${seed % 6}`, () => {
    const c = new THREE.CylinderGeometry(1, 1.08, 1, 18, 10, true);
    const p = c.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i); const y = p.getY(i); const z = p.getZ(i);
      const k = 1 + 0.08 * noise(x * 3 + seed, y * 6, z * 3, 1) + 0.04 * Math.sin(Math.atan2(z, x) * 7 + y * 3);
      p.setXYZ(i, x * k, y, z * k);
    }
    c.computeVertexNormals();
    return c;
  });
  const t = mesh(trunk, CM.bark(), { scale: [r, len, r] });
  g.add(t);
  // broken, ragged ends with the pale end grain
  const endG = G('logEnd', () => { const c = new THREE.CircleGeometry(1, 18); return c; });
  for (const s of [-1, 1]) {
    const e = mesh(endG, CM.endGrain(), { pos: [0, s * len / 2, 0], rot: [s * -Math.PI / 2, 0, 0], scale: [r * 0.98, r * 0.98, 1] });
    g.add(e);
  }
  // moss along the top
  const moss = G('mossPatch', () => { const c = new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2.4); c.scale(1, 0.25, 1); return c; });
  for (let i = 0; i < 5; i++) g.add(mesh(moss, CM.moss(), { pos: [0.02 * i, (i / 4 - 0.5) * len * 0.8, r * 0.9], rot: [Math.PI / 2, 0, 0], scale: [r * 0.8, r * 0.9, r * 0.6], shadow: false }));
  // two branch stubs
  const stub = G('stub', () => latheGeo([[0.05, 0], [0.045, 0.2], [0.03, 0.34], [0, 0.36]], 8));
  g.add(mesh(stub, CM.bark(), { pos: [r * 0.8, len * 0.15, 0.05], rot: [0, 0, -1.2] }));
  g.add(mesh(stub, CM.bark(), { pos: [-r * 0.6, -len * 0.25, r * 0.5], rot: [0.9, 0, 0.8], scale: 0.8 }));
  g.rotation.z = Math.PI / 2;
  return g;
}

/** A tree stump with root flare and a sawn or broken top. */
export function stump(r = 0.35, seed = 1) {
  const g = new THREE.Group();
  const s = G(`stump-${seed % 4}`, () => {
    const l = latheGeo([[0, 0], [1.6, 0], [1.25, 0.08], [1.05, 0.25], [1.0, 0.6], [0.98, 0.9], [0, 0.9]], 16);
    const p = l.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i); const y = p.getY(i); const z = p.getZ(i);
      const a = Math.atan2(z, x);
      const k = 1 + (y < 0.3 ? 0.35 * Math.max(0, Math.sin(a * 5 + seed)) * (0.3 - y) / 0.3 : 0) + 0.05 * noise(x * 4, y * 4, z * 4 + seed, 1);
      p.setXYZ(i, x * k, y + (y > 0.85 ? 0.08 * Math.sin(a * 3 + seed) : 0), z * k);
    }
    return weldNormals(l);
  });
  g.add(mesh(s, CM.bark(), { scale: [r, r * 1.3, r] }));
  g.add(mesh(G('stumpTop', () => new THREE.CircleGeometry(0.97, 16)), CM.endGrain(), { pos: [0, r * 1.3 * 0.9 + 0.005, 0], rot: [-Math.PI / 2, 0, 0], scale: [r, r, 1] }));
  return g;
}

/**
 * The campers' fire pit (room 146): a ring of stones, an ash bed with
 * charred ends of wood, dry sticks and a bundle of grass nearby. `lit`
 * adds a small fire (at night).
 */
export function firePit({ lit = false, quality = 'high', seed = 1, particlesFn, glowFn } = {}) {
  const g = new THREE.Group();
  const stoneM = mat('stone', { c1: 0x7a746a, c2: 0x3a3632, c3: 0x5a5a4a, p: [0.9, 0, 0.1, 0] });
  const soot = mat('stone', { c1: 0x2a2826, c2: 0x0e0d0c, p: [0.9, 0, 0, 0] });
  const n = 11;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const s = 0.14 + 0.05 * Math.abs(Math.sin(i * 2.3 + seed));
    g.add(mesh(rockGeo(i + seed, 1, 0.22), i % 3 ? stoneM : soot, { pos: [Math.cos(a) * 0.62, s * 0.55, Math.sin(a) * 0.62], scale: [s * 1.3, s, s], rot: [0, a, 0] }));
  }
  g.add(mesh(G('ashBed', () => blobLike(0.55, 0.04)), CM.ash(), { pos: [0, 0.01, 0], shadow: false }));
  // charred log ends crossing in the middle
  const charG = G('charLog', () => { const c = new THREE.CylinderGeometry(0.06, 0.07, 0.7, 8); c.rotateZ(Math.PI / 2); return c; });
  for (let i = 0; i < 4; i++) g.add(mesh(charG, CM.charcoal(), { pos: [0, 0.06 + i * 0.02, 0], rot: [0, i * 0.8 + 0.3, 0.12] }));
  // dry sticks and a bundle of grass nearby
  const stick = G('dryStick', () => { const c = new THREE.CylinderGeometry(0.018, 0.022, 0.9, 6); c.rotateZ(Math.PI / 2); return c; });
  for (let i = 0; i < 7; i++) g.add(mesh(stick, CM.bark(), { pos: [1.15 + (i % 2) * 0.05, 0.03 + Math.floor(i / 2) * 0.035, -0.2 + i * 0.07], rot: [0, 0.2 + 0.1 * Math.sin(i), 0] }));
  // a sheaf of dry grass, tied at the waist, splayed at both ends
  const grass = G('grassBundle', () => {
    const l = latheGeo([[0, -0.32], [0.1, -0.33], [0.13, -0.26], [0.075, -0.06], [0.065, 0], [0.075, 0.06], [0.14, 0.24], [0.11, 0.33], [0, 0.34]], 16);
    const p = l.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); const a = Math.atan2(p.getZ(i), p.getX(i)); const k = 1 + 0.25 * Math.abs(y) * Math.sin(a * 9 + y * 20); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
    l.rotateZ(Math.PI / 2);
    return weldNormals(l);
  });
  g.add(mesh(grass, mat('fabric', { c1: 0xb8a060, c2: 0x8a7440, p: [3, 0, 0, 1] }), { pos: [1.1, 0.1, 0.55], rot: [0, 0.6, 0] }));
  g.add(mesh(G('tie', () => new THREE.TorusGeometry(0.07, 0.012, 6, 14)), CM.rope(), { pos: [1.1, 0.1, 0.55], rot: [0, 0.6 + Math.PI / 2, 0] }));
  if (lit && particlesFn) {
    const fire = particlesFn('embers', 60, { quality, seed, pos: [0, 0.2, 0], spread: [0.35, 0.08, 0.35], vel: [0, 1.1, 0], size: 18, life: 1.0, color: 0xffd080, color2: 0xff3a08 });
    const smoke = particlesFn('smoke', 18, { quality, seed: seed + 2, pos: [0, 1.4, 0], spread: [0.5, 0.4, 0.5], vel: [0.08, 0.9, 0], size: 260, alpha: 0.2 });
    g.add(fire, smoke);
    const glow = glowFn(0xff7a20, 2.2, 0.9);
    glow.position.y = 0.35;
    g.add(glow);
    g.userData.tick = (t) => { fire.userData.tick(t); smoke.userData.tick(t); };
  }
  return g;
}

function blobLike(r, t) {
  const s = new THREE.Shape();
  for (let i = 0; i <= 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    const k = r * (1 + 0.1 * Math.sin(a * 5 + 1));
    if (i === 0) s.moveTo(Math.cos(a) * k, Math.sin(a) * k); else s.lineTo(Math.cos(a) * k, Math.sin(a) * k);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: true, bevelThickness: t, bevelSize: t * 2, bevelSegments: 2 });
  g.rotateX(-Math.PI / 2);
  return g;
}

/** A wild, chicken-like fowl: body, tail fan, head with comb and beak, legs. Faces +z. */
export function fowl(seed = 1) {
  const g = new THREE.Group();
  const hue = [0x8a4a2a, 0x6a4a3a, 0xa86a3a, 0x3a3230][seed % 4];
  const feather = mat('fabric', { c1: hue, c2: new THREE.Color(hue).multiplyScalar(0.6).getHex(), p: [4, 0.2, 0, 1] });
  const body = G('fowlBody', () => { const s = new THREE.SphereGeometry(0.16, 16, 12); s.scale(0.85, 0.8, 1.15); return s; });
  g.add(mesh(body, feather, { pos: [0, 0.3, 0] }));
  const tail = G('fowlTail', () => {
    const s = new THREE.Shape();
    s.moveTo(0, 0); s.quadraticCurveTo(0.12, 0.12, 0.06, 0.3); s.lineTo(-0.06, 0.3); s.quadraticCurveTo(-0.12, 0.12, 0, 0);
    return new THREE.ShapeGeometry(s, 6);
  });
  g.add(mesh(tail, mat('fabric', { c1: 0x1a2a2a, c2: 0x0a1414, p: [4, 0.8, 0, 1], side: THREE.DoubleSide }), { pos: [0, 0.34, -0.16], rot: [-0.6, 0, 0] }));
  const neck = new THREE.Group();
  neck.position.set(0, 0.4, 0.14);
  neck.add(mesh(G('fowlNeck', () => new THREE.CapsuleGeometry(0.05, 0.1, 4, 8)), feather, { pos: [0, 0.05, 0], rot: [0.4, 0, 0] }));
  neck.add(mesh(G('fowlHead', () => new THREE.SphereGeometry(0.055, 12, 10)), feather, { pos: [0, 0.14, 0.04] }));
  neck.add(mesh(G('beak', () => { const c = new THREE.ConeGeometry(0.016, 0.05, 6); c.rotateX(Math.PI / 2); return c; }), mat('matte', { c1: 0xd8a040, p: [0.5, 0, 0, 0] }), { pos: [0, 0.13, 0.1] }));
  neck.add(mesh(G('comb', () => { const s = new THREE.SphereGeometry(0.035, 8, 6); s.scale(0.35, 1, 1.2); return s; }), mat('matte', { c1: 0xc02a1a, p: [0.5, 0, 0, 0] }), { pos: [0, 0.2, 0.03] }));
  g.add(neck);
  const legG = G('fowlLeg', () => latheGeo([[0, 0], [0.01, 0], [0.008, 0.16], [0, 0.17]], 6));
  const legM = mat('matte', { c1: 0xc89a40, p: [0.5, 0, 0, 0] });
  for (const s of [-1, 1]) g.add(mesh(legG, legM, { pos: [s * 0.05, 0.02, 0.02] }));
  g.userData.neck = neck;
  return g;
}

// ---------------------------------------------------------------- baking and kits

/**
 * Merges every plain mesh under `root` into one mesh per material (a few
 * draw calls instead of dozens). Instanced meshes, points, shader sprites
 * and transparent meshes are kept as they are. Returns a new group placed
 * where root was.
 */
export function bake(root) {
  const pos = root.position.clone();
  const quat = root.quaternion.clone();
  const scl = root.scale.clone();
  root.position.set(0, 0, 0); root.quaternion.identity(); root.scale.set(1, 1, 1);
  root.updateMatrixWorld(true);
  const buckets = new Map();
  const keep = [];
  const walk = (o) => {
    for (const c of o.children) {
      const plain = c.isMesh && !c.isInstancedMesh && !c.material.isShaderMaterial && !c.userData.keep && !c.material.transparent && !isWood(c.material);
      if (plain) {
        const g = c.geometry.clone().applyMatrix4(c.matrixWorld);
        if (!g.attributes.normal) g.computeVertexNormals();
        let b = buckets.get(c.material);
        if (!b) buckets.set(c.material, (b = { geos: [], shadow: false }));
        b.geos.push(g);
        b.shadow = b.shadow || c.castShadow;
        walk(c);
      } else if (c.isMesh || c.isPoints || c.isLine || c.isLight) {
        keep.push(c);
      } else walk(c);
    }
  };
  walk(root);
  const out = new THREE.Group();
  for (const [m, b] of buckets) {
    const g = merge(b.geos);
    for (const x of b.geos) x.dispose();
    out.add(mesh(g, m, { shadow: b.shadow }));
  }
  for (const k of keep) {
    const m = k.matrixWorld.clone();
    k.removeFromParent();
    m.decompose(k.position, k.quaternion, k.scale);
    out.add(k);
  }
  out.userData = root.userData;
  out.position.copy(pos); out.quaternion.copy(quat); out.scale.copy(scl);
  return out;
}

const kits = new Map();
/** A baked, cached piece: built once per key, then cloned (the clones share geometry). */
export function kit(key, build, { scale, rotY } = {}) {
  if (!kits.has(key)) {
    const b = bake(build());
    b.traverse((o) => { if (o.geometry) o.geometry.userData.shared = true; });
    kits.set(key, b);
  }
  const c = kits.get(key).clone();
  if (scale) typeof scale === 'number' ? c.scale.setScalar(scale) : c.scale.set(...scale);
  if (rotY) c.rotation.y = rotY;
  return c;
}

/** A statue: a human figure cast in one material, posed, baked. */
export function statue(material, { sex = 'f', outfit = 'ambassadors', pose = 'stand', height = 1.8, seed = 0.3, tweak } = {}) {
  const fig = new THREE.Group();
  const body = buildHuman({ sex, outfit, material, seed, height, hairStyle: sex === 'f' ? 'long' : 'short' });
  fig.add(body);
  fig.userData.rig = body.userData.rig;
  fig.userData.body = body;
  const p = poseOf(pose);
  if (tweak) Object.assign(p, tweak);
  applyPose(fig, p);
  const b = bake(fig);
  b.userData = {};
  return b;
}

/** A flowstone column where a stalactite has met its stalagmite: flared ends, rippled waist. */
export function flowstoneColumn(h, r, seed = 1) {
  return G(`column-${seed % 3}-${h}-${r}`, () => {
    const pts = [];
    const n = 36;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const flare = Math.exp(-t * 7) * 1.4 + Math.exp(-(1 - t) * 6) * 1.6;
      const rr = r * (0.42 + flare + 0.06 * Math.sin(t * 40 + seed) + 0.1 * Math.sin(t * 9 + seed * 2));
      pts.push([rr, t * h]);
    }
    const g = latheGeo(pts, 22);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i); const y = p.getY(i); const z = p.getZ(i);
      const a = Math.atan2(z, x);
      // vertical drapery ribs and lumps
      const k = 1 + 0.12 * Math.sin(a * 7 + y * 0.15 + seed) + 0.1 * noise(x * 0.8, y * 0.3, z * 0.8 + seed, 1);
      p.setX(i, x * k); p.setZ(i, z * k);
    }
    return weldNormals(g);
  });
}

/** A broken rock shelf w wide (x), len long (z, centred), top at y = 0, the +x edge ragged. */
export function ledgeGeo(w, len, seed = 1) {
  const g = roundedBoxGeo(w, 1.2, len, 0.35, 3, 26);
  g.translate(0, -0.6, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i); const y = p.getY(i); const z = p.getZ(i);
    const edge = Math.max(0, x / (w / 2));
    const nx = noise(z * 0.9 + seed, y, x, 1) * 0.5 + noise(z * 2.3, y * 2, seed, 1.3) * 0.25;
    p.setXYZ(i, x + edge * nx * 0.9, y + (y > -0.05 ? 0.05 * noise(x * 2, 0, z * 2 + seed, 1) : 0.4 * noise(x, y, z * 0.5, 1)), z);
  }
  return weldNormals(g);
}

/** A crystal: a hexagonal prism with a pointed termination (1 unit long along +y). */
export function crystalGeo() {
  return G('crystal', () => {
    const g = latheGeo([[0, -0.1], [0.16, -0.1], [0.17, 0.62], [0.12, 0.8], [0, 1.0]], 6);
    g.computeVertexNormals();
    return g;
  });
}

