// The game's objects as modelled props (globals.c objdes/objsht), in the
// realistic-warm style (ADR-013): turned profiles, extruded outlines,
// rounded solids and cloth — no bare boxes. Each returns
// { object, light?, update? }; sizes are real-world metres; objects lie on
// y = 0 around their own origin. Light colours matter: kits/index.js keeps
// 0xffa050 (a lantern), 0xffcf70 / 0x9ad8ff (artifacts) in the dark.

import * as THREE from 'three';
import { C } from '../engine/battlestar.js';
import { mat, glowMat } from './materials.js';
import { mesh } from './geo.js';
import { particles, glowSprite } from './fx.js';
import { makeViper } from './craft.js';
import { roundedBoxGeo, rbox, cushionGeo, latheGeo, tubeGeo, blobGeo, weldNormals } from './model.js';

// ---------------------------------------------------------------- materials

const M = {
  steel: () => mat('metal', { c1: 0xc4cbd2, c2: 0x5a6068, p: [0.2, 0.15, 0, 0] }),
  darkSteel: () => mat('metal', { c1: 0x4e555c, c2: 0x23262a, p: [0.38, 0.3, 0, 0] }),
  rust: () => mat('metal', { c1: 0x8a6a52, c2: 0x5a2c12, p: [0.62, 0.9, 0, 0] }),
  brass: () => mat('gold', { c1: 0xc8964a, c2: 0xfff0c0, p: [0.2, 0.3, 0, 0] }),
  gold: () => mat('gold', { c1: 0xf0b848, c2: 0xffffff, p: [0.9, 0.05, 0, 0] }),
  leather: () => mat('fabric', { c1: 0x4a2a16, c2: 0x2a160a, p: [2.2, 0.15, 0, 1] }),
  darkLeather: () => mat('fabric', { c1: 0x2a1a10, c2: 0x140c06, p: [2.2, 0.2, 0, 1] }),
  wood: () => mat('wood', { c1: 0x7a4e2a, c2: 0x3e2410, p: [3, 0, 0, 0] }),
  oldWood: () => mat('wood', { c1: 0x8a6a48, c2: 0x4a3420, p: [2.2, 0, 0, 0] }),
  blood: () => mat('matte', { c1: 0x4a0606, p: [0.25, 0, 0.1, 0] }),
  glass: () => {
    const k = 'glass';
    if (!GLASS.has(k)) GLASS.set(k, new THREE.MeshStandardMaterial({ color: 0xe8f4ff, roughness: 0.04, metalness: 0.0, transparent: true, opacity: 0.28, depthWrite: false }));
    return GLASS.get(k);
  },
  olive: () => mat('matte', { c1: 0x4a5634, c2: 0x3a4428, p: [0.55, 0.3, 0.2, 0] }),
};
const GLASS = new Map();

// ---------------------------------------------------------------- geometry helpers

const GEO = new Map();
function cached(key, make) {
  if (!GEO.has(key)) { const g = make(); g.userData.shared = true; GEO.set(key, g); }
  return GEO.get(key);
}

/** Extrudes an outline [[x, y], ...] by `depth` (centred), with a soft bevel. */
function extrude(points, depth, bevel = 0.002, curve = 8) {
  const s = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: curve });
  g.translate(0, 0, -depth / 2);
  g.computeVertexNormals();
  return g;
}

/** A blade outline along +x from the guard (x = 0): straight edges tapering to a point. */
function bladeGeo(len, w, tip = 0.18, clip = false) {
  return cached(`blade|${len}|${w}|${tip}|${clip}`, () => {
    const t = len * tip;
    const pts = clip
      ? [[0, -w / 2], [len - t, -w / 2], [len, w * 0.15], [len - t * 0.6, w / 2 * 0.9], [0, w / 2]]
      : [[0, -w / 2], [len - t, -w * 0.42], [len, 0], [len - t, w * 0.42], [0, w / 2]];
    const g = extrude(pts, Math.max(0.004, w * 0.09), Math.max(0.0015, w * 0.05));
    g.rotateX(-Math.PI / 2); // lying flat: the blade's faces up
    return g;
  });
}

/** A turned grip with ridges, along +x from 0 to -len (toward the pommel). */
function gripGeo(len, r, ridges = 6) {
  return cached(`grip|${len}|${r}|${ridges}`, () => {
    const pts = [[0, 0]];
    for (let i = 0; i <= ridges * 2; i++) pts.push([r * (i % 2 ? 1.12 : 1), (i / (ridges * 2)) * len]);
    pts.push([0, len]);
    const g = latheGeo(pts, 14);
    g.rotateZ(Math.PI / 2); // along -x
    return g;
  });
}

function sphere(r, m, pos, scale, seg = 16) { return mesh(new THREE.SphereGeometry(r, seg, Math.max(8, seg * 0.7)), m, { pos, scale }); }

/** A sword lying flat: blade along +x, guard at x = 0, grip and pommel toward -x. */
function sword({ len = 0.8, w = 0.045, grip = 0.2, guard = 0.2, bladeM = M.steel(), guardM = M.darkSteel(), gripM = M.leather(), pommelM, fuller = true, curvedGuard = false }) {
  const g = new THREE.Group();
  const lift = 0.018; // it rests on the guard and the pommel
  g.add(mesh(bladeGeo(len, w), bladeM, { pos: [0.02, lift, 0] }));
  if (fuller) g.add(rbox(len * 0.6, 0.002, w * 0.22, 0.0008, mat('metal', { c1: 0x8a929a, c2: 0x3a3e44, p: [0.3, 0.2, 0, 0] }), { pos: [0.03 + len * 0.3, lift + Math.max(0.004, w * 0.09) / 2 + 0.0005, 0], center: true, shadow: false }));
  // crossguard: a rounded bar, optionally curved toward the blade
  if (curvedGuard) {
    g.add(mesh(tubeGeo([[0.0, lift, -guard / 2], [0.025, lift, -guard / 4], [0.02, lift, 0], [0.025, lift, guard / 4], [0.0, lift, guard / 2]], 0.011, 24), guardM));
  } else {
    g.add(rbox(0.028, 0.026, guard, 0.01, guardM, { pos: [0, lift, 0], center: true }));
  }
  g.add(mesh(gripGeo(grip, 0.016), gripM, { pos: [0, lift, 0] }));
  const pm = pommelM || guardM;
  g.add(mesh(latheGeo([[0, 0], [0.02, 0], [0.028, 0.012], [0.025, 0.03], [0.012, 0.042], [0, 0.044]], 16), pm, { pos: [-grip, lift, 0], rot: [0, 0, Math.PI / 2] }));
  return g;
}

// ---------------------------------------------------------------- the covered bodies

// The form under the sheet, head toward -x: [x, z, half-length, half-width, height].
const FORM = [
  [-0.84, 0, 0.12, 0.1, 0.19], // head
  [-0.5, 0, 0.2, 0.23, 0.21], // chest and shoulders
  [-0.18, 0, 0.18, 0.19, 0.17], // waist
  [0.08, 0, 0.14, 0.2, 0.16], // hips
  [0.42, -0.09, 0.3, 0.075, 0.12], [0.42, 0.09, 0.3, 0.075, 0.12], // legs
  [0.83, -0.1, 0.05, 0.055, 0.2], [0.83, 0.1, 0.05, 0.055, 0.2], // feet, toes up
];

/** Height of the sheet over the form at (x, z): a smooth union of bells with long skirts. */
function formHeight(x, z, forms = FORM) {
  let s = 0;
  for (const [cx, cz, ax, az, h, ang = 0] of forms) {
    const c = Math.cos(ang);
    const n = Math.sin(ang);
    const dx = (x - cx) * c + (z - cz) * n;
    const dz = -(x - cx) * n + (z - cz) * c;
    const e2 = (dx / ax) ** 2 + (dz / az) ** 2;
    s += (h * Math.exp(-0.75 * e2 * e2)) ** 6;
  }
  return s ** (1 / 6);
}

/**
 * A cloth L × W laid over `forms` (smooth bells, see formHeight): it follows
 * them, falls to the floor and lies there in loose ripples with an uneven
 * hem. Returns { geo, hem } (hem: the boundary points, for a border trim).
 */
function clothGeo(key, forms, L, W, seed, low) {
  return cached(`cloth|${key}|${seed}|${low}`, () => {
    const nx = Math.round((low ? 20 : 40) * L);
    const nz = Math.round((low ? 20 : 40) * W);
    const pos = [];
    const idx = [];
    const ph = seed * 1.3;
    for (let j = 0; j <= nz; j++) {
      for (let i = 0; i <= nx; i++) {
        const u = i / nx;
        const v = j / nz;
        let x = -L / 2 + u * L;
        let z = -W / 2 + v * W;
        const H = formHeight(x, z, forms);
        // on the floor the cloth lies in loose ripples; over the form small creases
        const flat = 1 - Math.min(1, H / 0.05);
        let y = H + 0.004;
        y += flat * 0.012 * Math.max(0, Math.sin(x * 9 + z * 4 + ph) + 0.6 * Math.sin(z * 13 - x * 5 + ph * 2));
        y += (1 - flat) * 0.004 * Math.sin(x * 31 + Math.sin(z * 11 + ph) * 2) * Math.sin(z * 19 - x * 7);
        // a sagging, uneven hem
        const edge = Math.min(u, 1 - u, v, 1 - v);
        if (edge < 0.08) {
          const k = 1 - edge / 0.08;
          x += Math.sin(v * 23 + ph) * 0.02 * k;
          z += Math.sin(u * 29 + ph) * 0.02 * k;
          y = Math.max(0.002, y - 0.006 * k);
        }
        pos.push(x, y, z);
      }
    }
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const a = j * (nx + 1) + i;
        const b = a + nx + 1;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    const at = (i, j) => { const k = (j * (nx + 1) + i) * 3; return [pos[k], pos[k + 1], pos[k + 2]]; };
    const hem = [];
    for (let i = 0; i < nx; i += 2) hem.push(at(i, 0));
    for (let j = 0; j < nz; j += 2) hem.push(at(nx, j));
    for (let i = nx; i > 0; i -= 2) hem.push(at(i, nz));
    for (let j = nz; j > 0; j -= 2) hem.push(at(0, j));
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    g.userData.hem = hem;
    return g;
  });
}

/**
 * A body under a sheet, never a corpse: one cloth over a lying form — head,
 * chest, legs and upturned feet read through it — falling to the floor.
 */
const shroudGeo = (seed, low) => clothGeo('shroud', FORM, 2.15, 0.92, seed, low);

function shroud(color = 0xd8d0c4, seed = 1, low = false) {
  const g = new THREE.Group();
  const sheet = mat('fabric', { c1: color, c2: new THREE.Color(color).multiplyScalar(0.8).getHex(), p: [1.4, 0.1, 0, 1], side: THREE.DoubleSide });
  g.add(mesh(shroudGeo(seed, low), sheet));
  return g;
}

/** A small bouquet laid on the chest of a covered body. */
function bouquet(colors) {
  const g = new THREE.Group();
  const stem = mat('matte', { c1: 0x3a6a2a, p: [0.6, 0, 0, 0] });
  const leafM = mat('matte', { c1: 0x2f5a24, c2: 0x4a7a34, p: [0.6, 0.3, 0, 0], side: THREE.DoubleSide });
  const leafG = cached('bqleaf', () => { const q = extrude([[0, 0], [0.03, -0.012], [0.07, 0], [0.03, 0.012]], 0.001, 0); q.rotateX(-Math.PI / 2); return q; });
  for (let i = 0; i < 7; i++) g.add(mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.22, 5), stem, { pos: [0.1, 0.004, (i - 3) * 0.006], rot: [0, (i - 3) * 0.05, Math.PI / 2], shadow: false }));
  for (let i = 0; i < 4; i++) g.add(mesh(leafG, leafM, { pos: [0.06 + i * 0.03, 0.008, 0], rot: [0, (i % 2 ? 1 : -1) * (0.6 + i * 0.1), 0], shadow: false }));
  for (let i = 0; i < colors.length; i++) {
    const c = colors[i];
    const a = (i / colors.length) * Math.PI * 2;
    const x = 0.0 + Math.cos(a) * 0.03 * (i % 2 ? 1 : 0.4);
    const z = Math.sin(a) * 0.04 * (i % 2 ? 1 : 0.4);
    g.add(mesh(blossom(c), mat('matte', { c1: c, p: [0.5, 0, 0, 0], side: THREE.DoubleSide }), { pos: [x, 0.02 + (i % 3) * 0.006, z], rot: [0.2 * Math.sin(i), i, 0.2], shadow: false }));
    g.add(sphere(0.008, mat('matte', { c1: 0xffd040, p: [0.5, 0, 0, 0] }), [x, 0.026 + (i % 3) * 0.006, z], null, 6));
  }
  return g;
}

function blossom(color, r = 0.035) {
  return cached(`blossom|${color}|${r}`, () => {
    const parts = [];
    for (let i = 0; i < 5; i++) {
      const p = new THREE.SphereGeometry(r * 0.55, 8, 6);
      p.scale(1, 0.35, 0.6);
      p.translate(r * 0.55, 0, 0);
      p.rotateY((i / 5) * Math.PI * 2);
      parts.push(p);
    }
    const g = mergeGeos(parts);
    g.userData.color = color;
    return g;
  });
}

/** An ostrich plume: a soft, tufted mass swept along a curling quill, with loose strands at the tip. */
function plumeGeo() {
  return cached('plume', () => {
    const spine = [[0, 0, 0], [0, 0.11, -0.05], [0.015, 0.18, -0.17], [0.03, 0.16, -0.3], [0.045, 0.08, -0.4], [0.05, 0.0, -0.43]];
    const quill = new THREE.CatmullRomCurve3(spine.map((p) => new THREE.Vector3(...p)));
    const seg = 60;
    const radial = 16;
    const q = new THREE.TubeGeometry(quill, seg, 1, radial, false);
    const p = q.attributes.position;
    const c = new THREE.Vector3();
    const v = new THREE.Vector3();
    for (let i = 0; i <= seg; i++) {
      const u = i / seg;
      quill.getPointAt(u, c);
      const r = 0.048 * (0.2 + 0.8 * Math.sin(Math.PI * Math.min(1, u * 1.08)) ** 0.6);
      for (let j = 0; j <= radial; j++) {
        const k = i * (radial + 1) + j;
        v.set(p.getX(k), p.getY(k), p.getZ(k)).sub(c);
        const a = (j / radial) * Math.PI * 2;
        const fluff = 1 + 0.28 * Math.sin(a * 5 + u * 40) * Math.sin(u * 23 + a * 2) + 0.12 * Math.sin(u * 71 + a * 9);
        v.multiplyScalar(r * fluff);
        v.y -= r * 0.35; // the barbs hang: the mass sags below the quill
        p.setXYZ(k, c.x + v.x * 1.25, c.y + v.y, c.z + v.z);
      }
    }
    q.computeVertexNormals();
    const parts = [q];
    for (let i = 0; i < 7; i++) {
      const e = quill.getPointAt(0.8 + i * 0.025);
      const s = i % 2 ? 1 : -1;
      parts.push(tubeGeo([[e.x, e.y, e.z], [e.x + s * 0.03, e.y - 0.04, e.z - 0.02], [e.x + s * 0.04, e.y - 0.09 - i * 0.005, e.z - 0.02]], 0.007, 8));
    }
    return mergeGeos(parts);
  });
}

function mergeGeos(list) {
  // simple merge of non-indexed copies (positions + normals)
  const pos = [];
  const nor = [];
  for (const g0 of list) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    if (!g.attributes.normal) g.computeVertexNormals();
    pos.push(...g.attributes.position.array);
    nor.push(...g.attributes.normal.array);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return out;
}

// ---------------------------------------------------------------- fruit

function fruit(kind, seed = 1) {
  const g = new THREE.Group();
  const rnd = (i) => Math.sin(seed * 12.9 + i * 78.2) * 0.5 + 0.5;
  if (kind === C.PAPAYAS) {
    const skin = mat('matte', { c1: 0xe8902a, c2: 0x7aa02a, p: [0.45, 0.16, 0, 0] });
    const geo = cached('papaya', () => { const q = latheGeo([[0, 0], [0.05, 0.01], [0.075, 0.05], [0.08, 0.11], [0.068, 0.17], [0.045, 0.21], [0.02, 0.225], [0, 0.23]], 22); q.rotateZ(-Math.PI / 2); return weldNormals(q); });
    for (let i = 0; i < 3; i++) g.add(mesh(geo, skin, { pos: [-0.1 + i * 0.03, 0.075, -0.13 + i * 0.13], rot: [0, rnd(i) * 1.2 - 0.6, 0] }));
  } else if (kind === C.PINEAPPLE) {
    const body = mat('tile', { c1: 0xc88a2a, c2: 0x9a6a1c, c3: 0xd8a040, p: [0.028, 0.14, 0.6, 0] });
    g.add(mesh(latheGeo([[0, 0], [0.06, 0.005], [0.09, 0.04], [0.1, 0.1], [0.095, 0.16], [0.07, 0.2], [0.03, 0.215], [0, 0.22]], 20), body));
    const leafM = mat('matte', { c1: 0x3a6a2a, c2: 0x5a8a3a, p: [0.6, 0.2, 0, 0] });
    const blade = cached('pineleaf', () => { const q = extrude([[0, -0.012], [0.16, -0.003], [0.2, 0], [0.16, 0.003], [0, 0.012]], 0.004, 0.001); return q; });
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const tilt = 0.9 + (i % 3) * 0.25;
      g.add(mesh(blade, leafM, { pos: [0, 0.2, 0], rot: [0, a, Math.PI / 2 - tilt * (0.5 + 0.2 * (i % 2))], scale: [0.8 + 0.4 * (i % 3) / 2, 1, 1] }));
    }
  } else if (kind === C.KIWI) {
    const fuzz = mat('fabric', { c1: 0x7a5a34, c2: 0x5a4024, p: [2.5, 0.3, 0, 1] });
    const egg = cached('kiwi', () => { const q = new THREE.SphereGeometry(0.03, 16, 12); q.scale(1, 0.85, 1.3); return q; });
    for (let i = 0; i < 4; i++) g.add(mesh(egg, fuzz, { pos: [-0.06 + i * 0.04, 0.026, (i % 2) * 0.05 - 0.02], rot: [0, i * 0.7, 0] }));
    // one cut open: green flesh, a pale core and a ring of seeds
    const cut = new THREE.Group();
    cut.add(mesh(cached('kiwihalf', () => { const q = new THREE.SphereGeometry(0.03, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2); q.scale(1, 1.3, 0.85); return q; }), fuzz, { rot: [Math.PI / 2, 0, 0] }));
    cut.add(mesh(new THREE.CircleGeometry(0.029, 20), mat('matte', { c1: 0x7ab83a, c2: 0x9ad04a, p: [0.35, 0, 0, 0] }), { pos: [0, 0, 0.001], shadow: false }));
    cut.add(mesh(new THREE.CircleGeometry(0.008, 12), mat('matte', { c1: 0xeef0c8, p: [0.4, 0, 0, 0] }), { pos: [0, 0, 0.0015], shadow: false }));
    for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; cut.add(sphere(0.0022, mat('matte', { c1: 0x101008, p: [0.3, 0, 0, 0] }), [Math.cos(a) * 0.013, Math.sin(a) * 0.017, 0.002], null, 6)); }
    cut.position.set(0.1, 0.03, 0.02);
    cut.rotation.set(-Math.PI / 2 + 0.3, 0, 0.4);
    g.add(cut);
  } else if (kind === C.COCONUTS) {
    const husk = mat('fabric', { c1: 0x5a3a1e, c2: 0x3a2412, p: [1.6, 0.1, 0, 1] });
    const nut = cached('coconut', () => { const q = new THREE.SphereGeometry(0.11, 20, 16); q.scale(1, 0.92, 1.08); return q; });
    for (let i = 0; i < 2; i++) {
      const c = mesh(nut, husk, { pos: [-0.14 + i * 0.25, 0.1, i * 0.08], rot: [rnd(i) * 3, rnd(i + 4) * 3, 0] });
      for (let k = 0; k < 3; k++) c.add(sphere(0.012, mat('matte', { c1: 0x1e120a, p: [0.6, 0, 0, 0] }), [Math.cos(k * 2.1) * 0.03, 0.095, Math.sin(k * 2.1) * 0.03 + 0.02], null, 8));
      g.add(c);
    }
    // one split open, white flesh inside
    const half = new THREE.Group();
    half.add(mesh(cached('cocohalf', () => new THREE.SphereGeometry(0.1, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), mat('fabric', { c1: 0x5a3a1e, c2: 0x3a2412, p: [1.6, 0.1, 0, 1], side: THREE.DoubleSide })));
    half.add(mesh(new THREE.RingGeometry(0.08, 0.1, 24), mat('matte', { c1: 0xf4efe2, p: [0.5, 0, 0, 0] }), { rot: [-Math.PI / 2, 0, 0], pos: [0, 0.001, 0], shadow: false }));
    half.add(mesh(new THREE.CircleGeometry(0.08, 24), mat('matte', { c1: 0xe8e4d8, c2: 0xf8f6ee, p: [0.2, 0, 0, 0] }), { rot: [-Math.PI / 2, 0, 0], pos: [0, -0.02, 0], shadow: false }));
    half.position.set(0.05, 0.1, -0.2);
    g.add(half);
  } else if (kind === C.MANGO) {
    const skin = mat('matte', { c1: 0xd8482a, c2: 0xf0b83a, p: [0.4, 0.14, 0, 0] });
    const geo = cached('mango', () => { const q = latheGeo([[0, 0], [0.04, 0.008], [0.06, 0.04], [0.062, 0.08], [0.05, 0.115], [0.025, 0.135], [0, 0.14]], 22); q.scale(1, 1, 0.78); q.rotateZ(-Math.PI / 2 + 0.2); return weldNormals(q); });
    g.add(mesh(geo, skin, { pos: [-0.06, 0.055, 0] }));
    g.add(mesh(new THREE.CylinderGeometry(0.004, 0.005, 0.02, 6), mat('wood', { c1: 0x4a3020, c2: 0x2a1a10, p: [3, 0, 0, 0] }), { pos: [0.08, 0.075, 0], rot: [0, 0, -1.2] }));
  }
  return g;
}

// ---------------------------------------------------------------- pieces of jewellery

function chainLoop(r = 0.12, m = M.gold(), seg = 26) {
  const pts = [];
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    pts.push([Math.cos(a) * r * (1 + 0.15 * Math.sin(a * 3)), 0.004 + 0.003 * Math.sin(a * 5), Math.sin(a) * r * 0.8]);
  }
  return mesh(tubeGeo(pts, 0.0028, 90, false), m, { shadow: false });
}

function gem(r, color, cut = 8) {
  // a brilliant: crown and pavilion as two cones with few facets
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.02, metalness: 0.1, emissive: color, emissiveIntensity: 0.35, flatShading: true });
  g.add(mesh(new THREE.ConeGeometry(r, r * 0.45, cut), m, { pos: [0, r * 0.22, 0] }));
  g.add(mesh(new THREE.ConeGeometry(r, r * 0.9, cut), m, { pos: [0, -r * 0.45, 0], rot: [Math.PI, 0, 0] }));
  return g;
}

/** A scorched patch: a disc with a ragged edge, lying flat. */
function charGeo() {
  return cached('char', () => {
    const q = new THREE.CircleGeometry(1.6, 48);
    const p = q.attributes.position;
    for (let k = 1; k < p.count; k++) { const a = Math.atan2(p.getY(k), p.getX(k)); const s = 1 + 0.18 * Math.sin(a * 5) + 0.1 * Math.sin(a * 11); p.setXY(k, p.getX(k) * s, p.getY(k) * s); }
    q.rotateX(-Math.PI / 2);
    return q;
  });
}

// ---------------------------------------------------------------- the horse and the car

/** A lathe from a to b (2-D points in the x-y plane), profile [[r, t]] with t = 0 at a, 1 at b. */
function limb(a, b, profile, m, sz = 1) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const geo = cached(`limb|${len.toFixed(3)}|${JSON.stringify(profile)}`, () => weldNormals(latheGeo(profile.map(([r, t]) => [r, t * len]), 18)));
  return mesh(geo, m, { pos: [a[0], a[1], 0], rot: [0, 0, Math.atan2(-(b[0] - a[0]), b[1] - a[1])], scale: [1, 1, sz] });
}

const FOREARM = [[0, -0.04], [0.085, 0], [0.09, 0.15], [0.07, 0.6], [0.055, 0.95], [0, 1.02]];
const GASKIN = [[0, -0.05], [0.12, 0], [0.105, 0.35], [0.068, 0.85], [0.055, 0.97], [0, 1.02]];
const CANNON = [[0, -0.02], [0.046, 0], [0.038, 0.4], [0.041, 0.9], [0, 1.0]];
const PASTERN = [[0, -0.02], [0.044, 0.05], [0.04, 0.9], [0, 1.0]];

function horse(seed = 1) {
  // "A gorgeous white stallion": barrel, chest, rump and muscle masses as
  // smooth solids; jointed legs (forearm, knee, cannon, fetlock, pastern,
  // hoof); an arched neck, a long head, and a mane and tail of strands.
  const g = new THREE.Group();
  const coat = mat('fabric', { c1: 0xf4f1ea, c2: 0xd8d2c6, p: [3, 0.45, 0, 0.5] });
  const hoofM = mat('matte', { c1: 0x3a3430, p: [0.35, 0, 0, 0] });
  const hair = mat('fabric', { c1: 0xeee8dc, c2: 0xc8c0b0, p: [4, 0.5, 0, 1] });
  const dark = new THREE.MeshStandardMaterial({ color: 0x0e0a08, roughness: 0.15 });
  const barrel = cached('horse-barrel', () => { const q = latheGeo([[0, -0.72], [0.22, -0.7], [0.32, -0.55], [0.36, -0.3], [0.37, 0], [0.36, 0.3], [0.33, 0.5], [0.25, 0.64], [0, 0.68]], 28); q.rotateZ(-Math.PI / 2); return weldNormals(q); });
  g.add(mesh(barrel, coat, { pos: [0, 1.18, 0], scale: [1, 1, 0.82] }));
  g.add(sphere(0.2, coat, [0.42, 1.44, 0], [1.4, 0.8, 0.7], 20)); // withers
  g.add(sphere(0.3, coat, [0.58, 1.16, 0], [0.85, 1.1, 0.82], 22)); // chest
  g.add(sphere(0.33, coat, [-0.56, 1.3, 0], [1.05, 0.95, 0.88], 22)); // rump
  for (const s of [-1, 1]) {
    g.add(mesh(new THREE.SphereGeometry(0.2, 18, 14), coat, { pos: [0.5, 1.1, s * 0.15], rot: [0, 0, -0.35], scale: [0.9, 1.6, 0.5] })); // shoulder
    g.add(mesh(new THREE.SphereGeometry(0.24, 18, 14), coat, { pos: [-0.56, 1.06, s * 0.16], rot: [0, 0, 0.2], scale: [1, 1.5, 0.55] })); // thigh
  }
  // legs: each a group pivoting at its top
  const legs = [];
  const leg = (x, y, z, hind) => {
    const l = new THREE.Group();
    l.position.set(x, y, z);
    const knee = hind ? [-0.2, -0.42] : [0.01, -0.44];
    const fet = hind ? [-0.17, -0.8] : [0, -0.8];
    const cor = hind ? [-0.1, -0.9] : [0.07, -0.89];
    l.add(limb([0, 0], knee, hind ? GASKIN : FOREARM, coat, 0.85));
    l.add(sphere(hind ? 0.06 : 0.056, coat, [knee[0], knee[1], 0], [1, 1.1, 0.85], 14));
    if (hind) l.add(sphere(0.035, coat, [knee[0] - 0.05, knee[1] + 0.02, 0], null, 10)); // point of hock
    l.add(limb(knee, fet, CANNON, coat, 0.8));
    l.add(sphere(0.05, coat, [fet[0], fet[1], 0], [1.1, 1, 0.9], 12));
    l.add(limb(fet, cor, PASTERN, coat, 0.9));
    l.add(mesh(cached('hoof', () => weldNormals(latheGeo([[0, 0], [0.062, 0], [0.058, 0.05], [0.046, 0.085], [0, 0.09]], 16))), hoofM, { pos: [cor[0] + 0.01, -y, 0], rot: [0, 0, -0.12] }));
    g.add(l);
    legs.push(l);
  };
  for (const s of [-1, 1]) { leg(0.56, 0.98, s * 0.15, false); leg(-0.5, 0.98, s * 0.16, true); }
  // neck, pivoting at its base; the head at the poll
  const neck = new THREE.Group();
  neck.position.set(0.62, 1.35, 0);
  const poll = [0.36, 0.58];
  neck.add(limb([0, 0], poll, [[0, -0.1], [0.25, -0.05], [0.23, 0.2], [0.17, 0.6], [0.13, 0.9], [0.12, 1.0], [0, 1.05]], coat, 0.62));
  neck.add(mesh(new THREE.SphereGeometry(0.16, 16, 12), coat, { pos: [0.1, 0.36, 0], rot: [0, 0, -0.55], scale: [0.5, 1.6, 0.5] })); // crest
  const head = new THREE.Group();
  head.position.set(poll[0], poll[1], 0);
  head.rotation.z = Math.atan2(-0.42, -0.4);
  head.scale.setScalar(1.15);
  const H = 0.6;
  head.add(mesh(cached('horse-head', () => weldNormals(latheGeo([[0, -0.06], [0.1, -0.02], [0.13, 0.12], [0.12, 0.3], [0.09, 0.55], [0.075, 0.8], [0.072, 0.93], [0.05, 1.0], [0, 1.02]].map(([r, t]) => [r, t * H]), 20))), coat, { scale: [1, 1, 0.62] }));
  head.add(sphere(0.12, coat, [0.05, 0.14, 0], [1, 1.1, 0.58], 16)); // jowl
  for (const s of [-1, 1]) {
    head.add(mesh(new THREE.ConeGeometry(0.035, 0.13, 10), coat, { pos: [-0.04, 0.0, s * 0.05], rot: [s * 0.25, 0, 2.2], scale: [1, 1, 0.6] })); // ears
    head.add(sphere(0.016, dark, [-0.035, 0.2, s * 0.074], [1, 1.2, 0.8], 10)); // eyes
    head.add(sphere(0.016, dark, [-0.01, 0.57, s * 0.036], [1.3, 0.8, 0.8], 8)); // nostrils
  }
  for (let i = 0; i < 5; i++) head.add(mesh(tubeGeo([[-0.06, 0.02, (i - 2) * 0.012], [-0.1, 0.08, (i - 2) * 0.016], [-0.1, 0.16, (i - 2) * 0.02]], 0.012, 8), hair, { shadow: false })); // forelock
  neck.add(head);
  // mane: strands from the crest falling to the right
  const tilt = Math.atan2(poll[0], poll[1]); // the neck leans forward by this much
  for (let i = 0; i < 12; i++) {
    const t = 0.1 + (i / 11) * 0.85;
    const r = 0.23 - 0.11 * t;
    // the crest: behind the neck's axis, perpendicular to it
    const p0 = [poll[0] * t - Math.cos(tilt) * r * 0.9, poll[1] * t + Math.sin(tilt) * r * 0.9, 0.02];
    const k = 0.1 + 0.05 * (i % 3);
    neck.add(mesh(tubeGeo([p0, [p0[0] + 0.01, p0[1] - k * 0.3, 0.1], [p0[0] + 0.03, p0[1] - k, 0.15 + 0.02 * (i % 2)]], 0.02, 10), hair, { shadow: false }));
  }
  g.add(neck);
  // tail
  const tail = new THREE.Group();
  tail.position.set(-0.9, 1.45, 0);
  tail.add(limb([0, 0], [-0.12, -0.14], [[0, 0], [0.05, 0.05], [0.04, 0.9], [0, 1]], coat));
  for (let i = 0; i < 9; i++) {
    const z = (i - 4) * 0.018;
    tail.add(mesh(tubeGeo([[-0.1, -0.1, z * 0.5], [-0.16, -0.3, z], [-0.17, -0.65, z * 1.6], [-0.13 - 0.02 * (i % 3), -0.98 + 0.04 * (i % 2), z * 2]], 0.022, 14), hair, { shadow: false }));
  }
  g.add(tail);
  const update = (t) => {
    const s = t + seed * 3.7;
    tail.rotation.x = 0.18 * Math.sin(s * 1.1) * Math.max(0, Math.sin(s * 0.23)); // swishes now and then
    tail.rotation.z = 0.05 * Math.sin(s * 0.7);
    neck.rotation.z = 0.04 * Math.sin(s * 0.35);
    head.rotation.x = 0.06 * Math.sin(s * 0.27 + 1);
    legs[3].rotation.z = 0.05 * Math.max(0, Math.sin(s * 0.13)); // rests a hind hoof on its toe
  };
  return { object: g, update };
}

function car() {
  // "An underpowered Plymouth Volare' with a red and white striped golf cart
  // roof": a boxy late-70s sedan whose roof is gone (open cabin, bench seats,
  // windscreen) under a striped canopy on chrome posts. No badges.
  const g = new THREE.Group();
  const paint = mat('metal', { c1: 0xe8e2d2, c2: 0x9a927e, p: [0.3, 0.3, 0, 0] });
  const chrome = mat('metal', { c1: 0xeef2f6, c2: 0x8a9098, p: [0.08, 0.05, 0, 0] });
  const vinyl = mat('fabric', { c1: 0x8a5a36, c2: 0x5a3a22, p: [2, 0.4, 0, 0.5] });
  const glassM = new THREE.MeshStandardMaterial({ color: 0x2a3a48, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.45 });
  const tyre = mat('matte', { c1: 0x1a1a1a, p: [0.85, 0, 0, 0] });
  const black = mat('matte', { c1: 0x0c0c0c, p: [0.9, 0, 0, 0] });
  const L = 4.7;
  const W = 1.8;
  g.add(rbox(L, 0.34, W, 0.1, paint, { pos: [0, 0.32, 0] })); // lower body
  g.add(rbox(1.5, 0.28, W - 0.02, 0.09, paint, { pos: [1.58, 0.62, 0] })); // bonnet
  g.add(rbox(1.15, 0.26, W - 0.02, 0.09, paint, { pos: [-1.76, 0.62, 0] })); // boot
  for (const s of [-1, 1]) g.add(rbox(2.1, 0.32, 0.09, 0.04, paint, { pos: [-0.14, 0.62, s * (W / 2 - 0.05)] })); // door tops
  g.add(rbox(0.09, 0.3, W - 0.2, 0.04, paint, { pos: [-1.18, 0.62, 0] })); // behind the rear seat
  // chrome belt trim and bumpers
  for (const s of [-1, 1]) g.add(mesh(tubeGeo([[-L / 2 + 0.05, 0.62, s * (W / 2 + 0.005)], [L / 2 - 0.05, 0.62, s * (W / 2 + 0.005)]], 0.012, 4), chrome, { shadow: false }));
  for (const x of [-L / 2 - 0.02, L / 2 + 0.02]) g.add(rbox(0.12, 0.16, W + 0.04, 0.05, chrome, { pos: [x, 0.3, 0] }));
  // grille and square quad headlamps; tail lamps
  g.add(rbox(0.04, 0.2, 0.9, 0.02, mat('tile', { c1: 0x2a2c30, c2: 0xc8ccd2, p: [0.03, 0.12, 0, 0] }), { pos: [L / 2 + 0.005, 0.44, 0] }));
  for (const s of [-1, 1]) for (const k of [0, 1]) {
    g.add(rbox(0.04, 0.14, 0.14, 0.02, chrome, { pos: [L / 2, 0.47, s * (0.52 + k * 0.17)] }));
    g.add(mesh(new THREE.CircleGeometry(0.055, 16), glowMat(0xfff4d0, 0.5), { pos: [L / 2 + 0.021, 0.54, s * (0.52 + k * 0.17)], rot: [0, Math.PI / 2, 0], shadow: false }));
  }
  for (const s of [-1, 1]) g.add(rbox(0.03, 0.14, 0.4, 0.015, glowMat(0xc81818, 0.7), { pos: [-L / 2 - 0.005, 0.46, s * 0.62] }));
  // wheels in dark arches (the tyre's face stands just proud of the body)
  const wheel = cached('carwheel', () => { const q = latheGeo([[0.19, -0.11], [0.3, -0.105], [0.33, -0.06], [0.335, 0], [0.33, 0.06], [0.3, 0.105], [0.19, 0.11]], 26); q.rotateX(Math.PI / 2); return q; });
  const hub = cached('carhub', () => latheGeo([[0, 0.02], [0.2, 0.0], [0.19, 0.02], [0.12, 0.035], [0.05, 0.045], [0, 0.05]], 20));
  for (const x of [-1.42, 1.42]) for (const s of [-1, 1]) {
    g.add(mesh(new THREE.CircleGeometry(0.4, 24), black, { pos: [x, 0.34, s * (W / 2 + 0.003)], rot: [0, s > 0 ? 0 : Math.PI, 0], shadow: false }));
    g.add(mesh(wheel, tyre, { pos: [x, 0.335, s * (W / 2 - 0.09)] }));
    g.add(mesh(hub, chrome, { pos: [x, 0.335, s * (W / 2 + 0.01)], rot: [s * Math.PI / 2, 0, 0] }));
  }
  // cabin: floor, bench seats, dashboard, steering wheel, windscreen
  g.add(rbox(2.1, 0.02, W - 0.2, 0.01, black, { pos: [-0.14, 0.49, 0] }));
  for (const x of [0.25, -0.75]) {
    g.add(mesh(cushionGeo(0.55, 0.14, W - 0.26, { r: 0.05, puff: 0.3 }), vinyl, { pos: [x, 0.58, 0] }));
    g.add(mesh(cushionGeo(0.14, 0.5, W - 0.26, { r: 0.05, puff: 0.2 }), vinyl, { pos: [x - 0.3, 0.86, 0], rot: [0, 0, 0.12] }));
  }
  g.add(rbox(0.3, 0.22, W - 0.18, 0.06, mat('fabric', { c1: 0x3a2a1e, c2: 0x20160e, p: [2, 0.2, 0, 1] }), { pos: [0.95, 0.68, 0] }));
  g.add(mesh(new THREE.TorusGeometry(0.19, 0.016, 8, 28), black, { pos: [0.72, 0.96, -0.4], rot: [0, Math.PI / 2, 0.45] }));
  g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8), black, { pos: [0.83, 0.86, -0.4], rot: [0, 0, 0.9] }));
  const ws = new THREE.Group();
  ws.add(rbox(0.012, 0.5, W - 0.12, 0.006, glassM, { center: true }));
  ws.add(mesh(tubeGeo([[0, -0.25, -(W / 2 - 0.06)], [0, 0.25, -(W / 2 - 0.06)], [0, 0.25, W / 2 - 0.06], [0, -0.25, W / 2 - 0.06]], 0.018, 24), chrome));
  ws.position.set(1.05, 1.0, 0);
  ws.rotation.z = 0.5;
  g.add(ws);
  // the canopy: four posts, a striped roof with a scalloped valance
  const red = mat('fabric', { c1: 0xc82020, c2: 0x8a1414, p: [1.2, 0.2, 0, 0.6], side: THREE.DoubleSide });
  const white = mat('fabric', { c1: 0xf2eee2, c2: 0xc8c4b8, p: [1.2, 0.2, 0, 0.6], side: THREE.DoubleSide });
  for (const [x, z] of [[-1.15, -0.8], [-1.15, 0.8], [0.9, -0.8], [0.9, 0.8]]) g.add(mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.02, 10), chrome, { pos: [x, 1.25, z] }));
  const RL = 2.5;
  const n = 10;
  for (let i = 0; i < n; i++) {
    const z = -0.95 + (i + 0.5) * (1.9 / n);
    const bow = 0.06 * (1 - (z / 0.95) ** 2);
    g.add(rbox(RL, 0.035, 1.9 / n + 0.002, 0.012, i % 2 ? red : white, { pos: [-0.12, 1.76 + bow, z] }));
  }
  const scallop = cached('scallop', () => new THREE.CircleGeometry(0.06, 12, Math.PI, Math.PI));
  for (let i = 0; i < 20; i++) {
    const x = -0.12 - RL / 2 + (i + 0.5) * (RL / 20);
    for (const s of [-1, 1]) g.add(mesh(scallop, i % 2 ? red : white, { pos: [x, 1.765, s * 0.955], rot: [0, s > 0 ? 0 : Math.PI, 0], scale: [1, 1.1, 1], shadow: false }));
  }
  for (let i = 0; i < 16; i++) {
    const z = -0.95 + (i + 0.5) * (1.9 / 16);
    for (const s of [-1, 1]) g.add(mesh(scallop, i % 2 ? red : white, { pos: [-0.12 + s * (RL / 2 + 0.005), 1.765, z], rot: [0, s * Math.PI / 2, 0], scale: [1, 1.1, 1], shadow: false }));
  }
  return g;
}

// ---------------------------------------------------------------- the props

/** Returns { object, light, update } for object id `o`. */
export function prop(o, { night = false, quality = 'high', seed = 1 } = {}) {
  const low = quality === 'low';
  let object = new THREE.Group();
  let light = null;
  let update = null;
  switch (o) {
    case C.KNIFE: {
      // a hunting knife: clip point, brass bolster, wooden scales with rivets
      object.add(mesh(bladeGeo(0.15, 0.03, 0.3, true), M.steel(), { pos: [0.02, 0.012, 0] }));
      object.add(rbox(0.018, 0.024, 0.036, 0.006, M.brass(), { pos: [0.012, 0.012, 0], center: true }));
      object.add(rbox(0.11, 0.022, 0.03, 0.009, M.wood(), { pos: [-0.052, 0.012, 0], center: true }));
      for (const x of [-0.03, -0.075]) object.add(sphere(0.004, M.brass(), [x, 0.024, 0], null, 8));
      object.position.x = -0.03;
      break;
    }
    case C.SWORD: {
      // "an exquisitely crafted sword and scabbard"
      object.add(sword({ len: 0.78, w: 0.04, grip: 0.18, guard: 0.2, guardM: M.gold(), gripM: M.darkLeather(), pommelM: M.gold(), curvedGuard: true }));
      const scab = new THREE.Group();
      scab.add(mesh(cached('scabbard', () => { const q = extrude([[0, -0.028], [0.72, -0.02], [0.78, 0], [0.72, 0.02], [0, 0.028]], 0.022, 0.006); q.rotateX(-Math.PI / 2); return q; }), M.darkLeather()));
      scab.add(rbox(0.07, 0.026, 0.064, 0.008, M.gold(), { pos: [0.02, 0, 0], center: true }));
      scab.add(mesh(latheGeo([[0, 0], [0.018, 0], [0.012, 0.06], [0, 0.07]], 12), M.gold(), { pos: [0.76, 0, 0], rot: [0, 0, -Math.PI / 2] }));
      scab.position.set(-0.02, 0.016, 0.1);
      object.add(scab);
      object.position.x = -0.3;
      break;
    }
    case C.TWO_HANDED: {
      object.add(sword({ len: 1.2, w: 0.058, grip: 0.36, guard: 0.34, gripM: M.leather(), guardM: M.darkSteel() }));
      object.position.x = -0.4;
      break;
    }
    case C.CLEAVER: {
      // "a bloody meat cleaver": a broad rectangular blade, a riveted handle, a dark stain
      object.add(mesh(cached('cleaver', () => { const q = extrude([[0, -0.03], [0.18, -0.045], [0.19, 0.05], [0.02, 0.05], [0, 0.03]], 0.004, 0.0015); q.rotateX(-Math.PI / 2); return q; }), M.steel(), { pos: [0.03, 0.02, 0] }));
      object.add(sphere(0.012, M.darkSteel(), [0.2, 0.02, -0.03], [1, 0.3, 1], 10)); // hanging hole
      object.add(mesh(cached('cleaverhandle', () => { const q = latheGeo([[0, 0], [0.016, 0], [0.018, 0.04], [0.016, 0.1], [0.02, 0.12], [0, 0.125]], 12); q.rotateZ(Math.PI / 2); return q; }), M.wood(), { pos: [0.035, 0.02, 0.01] }));
      object.add(mesh(cached('bloodstain', () => blobGeo(0.04, 0.022, { t: 0.0015, wobble: 0.3, lobes: 4, seed: 3, seg: 40 })), M.blood(), { pos: [0.13, 0.0235, 0.005], shadow: false }));
      object.position.x = -0.05;
      break;
    }
    case C.BROAD: {
      object.add(sword({ len: 0.9, w: 0.06, grip: 0.2, guard: 0.26, bladeM: M.rust(), guardM: M.rust(), gripM: M.leather(), fuller: false }));
      object.position.x = -0.3;
      break;
    }
    case C.MAIL: {
      // "an ancient coat of finely woven mail", laid out flat: a knee-length
      // shirt of rings with short sleeves, a round neck and a leather edging
      const mail = mat('tile', { c1: 0x8e969e, c2: 0x6a7178, c3: 0xa4acb4, p: [0.012, 0.18, 0.4, 0] });
      const edge = M.leather();
      object.add(mesh(cushionGeo(0.5, 0.036, 0.72, { r: 0.018, puff: 0.35, under: 0, pinch: 0.04 }), mail, { pos: [0, 0.018, 0.02] }));
      for (const s of [-1, 1]) {
        const arm = new THREE.Group();
        arm.position.set(s * 0.22, 0.018, -0.24);
        arm.rotation.y = -s * 0.65;
        arm.add(mesh(cushionGeo(0.3, 0.03, 0.17, { r: 0.015, puff: 0.35, under: 0 }), mail, { pos: [s * 0.14, 0, 0] }));
        arm.add(rbox(0.018, 0.034, 0.17, 0.008, edge, { pos: [s * 0.29, 0, 0], center: true }));
        object.add(arm);
      }
      object.add(mesh(new THREE.TorusGeometry(0.075, 0.012, 8, 24), edge, { pos: [0, 0.036, -0.3], rot: [Math.PI / 2, 0, 0], scale: [1, 0.75, 1] }));
      object.add(mesh(new THREE.CircleGeometry(0.07, 20), mat('matte', { c1: 0x1a1a1c, p: [0.9, 0, 0, 0] }), { pos: [0, 0.0375, -0.3], rot: [-Math.PI / 2, 0, 0], scale: [1, 0.75, 1], shadow: false }));
      object.add(rbox(0.5, 0.034, 0.02, 0.008, edge, { pos: [0, 0.018, 0.38], center: true })); // hem
      break;
    }
    case C.HELM: {
      // "an old dented helmet with an ostrich plume": a round iron cap with a
      // riveted brow band and a crest socket; the plume curls up and droops back
      const iron = mat('metal', { c1: 0x8a8f95, c2: 0x4a3a2a, p: [0.32, 0.65, 0, 0] });
      const dome = cached('helmdome', () => {
        const q = latheGeo([[0.125, 0], [0.13, 0.03], [0.127, 0.07], [0.113, 0.115], [0.088, 0.148], [0.05, 0.168], [0, 0.173]], 28);
        q.scale(1, 1, 1.18);
        const p = q.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i); const y = p.getY(i); const z = p.getZ(i);
          const d1 = Math.hypot(x - 0.09, y - 0.13, z - 0.05);
          const d2 = Math.hypot(x + 0.05, y - 0.1, z + 0.11);
          const k = 1 - 0.08 * Math.exp(-(d1 * d1) / 0.0016) - 0.06 * Math.exp(-(d2 * d2) / 0.0012);
          p.setXYZ(i, x * k, y * (0.97 + 0.03 * k), z * k);
        }
        return weldNormals(q);
      });
      const h = new THREE.Group();
      h.add(mesh(dome, iron));
      h.add(mesh(new THREE.TorusGeometry(0.131, 0.011, 8, 36), iron, { pos: [0, 0.028, 0], rot: [Math.PI / 2, 0, 0], scale: [1, 1.18, 1] }));
      for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; h.add(sphere(0.006, M.brass(), [Math.cos(a) * 0.141, 0.028, Math.sin(a) * 0.141 * 1.18], null, 8)); }
      h.add(mesh(latheGeo([[0, 0], [0.02, 0], [0.016, 0.03], [0.02, 0.05], [0.014, 0.06], [0, 0.062]], 14), M.brass(), { pos: [0, 0.163, 0] }));
      h.add(mesh(plumeGeo(), mat('fabric', { c1: 0xf6f0e6, c2: 0xd2c8b8, p: [3, 0.5, 0, 1] }), { pos: [0, 0.215, 0] }));
      h.rotation.z = 0.1; // dropped, resting on one side of its rim
      h.position.y = 0.012;
      object.add(h);
      break;
    }
    case C.SHIELD: {
      // "a shield of some native tribe": an oval of hide stretched over a wooden
      // hoop, painted in bands, with a boss; lying face up
      const hide = mat('fabric', { c1: 0xb8864a, c2: 0x8a5a2a, p: [0.9, 0.05, 0, 1] });
      const face = cached('shieldface', () => { const q = latheGeo([[0.35, 0], [0.34, 0.012], [0.3, 0.03], [0.18, 0.045], [0, 0.05]], 30); q.rotateX(Math.PI / 2); q.scale(0.72, 1.05, 1); return weldNormals(q); });
      const sh = new THREE.Group();
      sh.add(mesh(face, hide));
      sh.add(mesh(new THREE.TorusGeometry(0.35, 0.016, 8, 40), M.wood(), { scale: [0.72, 1.05, 1] }));
      const paint = mat('matte', { c1: 0x1a1410, p: [0.7, 0, 0, 0] });
      const ochre = mat('matte', { c1: 0xa83a18, p: [0.7, 0, 0, 0] });
      for (let i = -2; i <= 2; i++) sh.add(rbox(0.06, 0.42 - Math.abs(i) * 0.08, 0.004, 0.002, i % 2 ? ochre : paint, { pos: [i * 0.07, 0, 0.046 - Math.abs(i) * 0.004], center: true, shadow: false }));
      sh.add(mesh(latheGeo([[0, 0], [0.06, 0], [0.05, 0.03], [0.02, 0.05], [0, 0.052]], 18), M.brass(), { rot: [Math.PI / 2, 0, 0], pos: [0, 0, 0.045] }));
      sh.rotation.set(-Math.PI / 2, 0, 0.3);
      sh.position.y = 0.018;
      object.add(sh);
      break;
    }
    case C.MAID: case C.DEADWOOD: case C.DEADGOD: case C.DEADTIME: case C.DEADNATIVE: {
      // the maid, the woodsman, the goddess, the old-timer and the native girl: each
      // covered by a sheet, never shown; the island's dead get flowers on the chest
      object.add(shroud(o === C.DEADGOD ? 0xf4ead8 : 0xcfc6b8, seed, low));
      if (o === C.DEADGOD || o === C.DEADNATIVE) {
        const b = bouquet(o === C.DEADGOD ? [0xffffff, 0xf2a0c0, 0xffffff, 0xffe070, 0xf6d0e0] : [0xe86a8a, 0xffe070, 0xff9a40, 0xffffff, 0xe86a8a]);
        b.position.set(-0.36, formHeight(-0.36, 0), 0);
        b.rotation.z = -0.05;
        object.add(b);
      }
      break;
    }
    case C.VIPER: {
      object = makeViper();
      object.scale.setScalar(0.55);
      object.position.y = 1.1;
      break;
    }
    case C.LAMPON: {
      // "a kerosene lantern is burning luridly": a hurricane lantern
      const tin = mat('metal', { c1: 0x6a2a1e, c2: 0x2a1410, p: [0.45, 0.6, 0, 0] });
      object.add(mesh(latheGeo([[0, 0], [0.085, 0], [0.09, 0.015], [0.085, 0.06], [0.07, 0.075], [0.05, 0.08], [0, 0.082]], 22), tin));
      object.add(mesh(latheGeo([[0.045, 0.08], [0.06, 0.1], [0.07, 0.15], [0.065, 0.2], [0.045, 0.23], [0.03, 0.24]], 22), M.glass(), { shadow: false }));
      const flame = mesh(cached('flame', () => { const q = new THREE.SphereGeometry(0.018, 12, 10); q.scale(1, 2.2, 1); return q; }), glowMat(0xffc060, 6), { pos: [0, 0.14, 0], shadow: false });
      object.add(flame);
      object.add(mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.03, 10), M.brass(), { pos: [0, 0.1, 0] }));
      object.add(mesh(latheGeo([[0.05, 0], [0.06, 0.012], [0.04, 0.04], [0.015, 0.06], [0.015, 0.075], [0, 0.078]], 20), tin, { pos: [0, 0.235, 0] }));
      for (const s of [-1, 1]) object.add(mesh(tubeGeo([[s * 0.07, 0.07, 0], [s * 0.078, 0.16, 0], [s * 0.05, 0.25, 0]], 0.004, 12), tin));
      object.add(mesh(new THREE.TorusGeometry(0.075, 0.004, 6, 24, Math.PI), tin, { pos: [0, 0.3, 0] }));
      const g = glowSprite(0xffa040, 1.6, 0.7);
      g.position.y = 0.15;
      object.add(g);
      light = { color: 0xffa050, intensity: 7, distance: 9, flicker: 0.35, offset: [0, 0.2, 0] };
      update = (t) => { flame.scale.set(1, 1 + 0.12 * Math.sin(t * 13 + Math.sin(t * 7)), 1); };
      break;
    }
    case C.SHOES: {
      // "an old pair of shoes has been discarded here": lace-up leather shoes
      // shaped on a last (narrow heel, wide ball, low toe), a padded collar,
      // laces, a sole with a heel block; one upright, one fallen on its side
      const upper = mat('fabric', { c1: 0x5e3c22, c2: 0x3a2412, p: [1.8, 0.35, 0, 1] });
      const soleM = mat('matte', { c1: 0x2a1e16, p: [0.8, 0, 0, 0] });
      const dark = mat('matte', { c1: 0x120a06, p: [0.95, 0, 0, 0] });
      const lace = mat('fabric', { c1: 0xb8a888, c2: 0x8a7a60, p: [4, 0, 0, 1] });
      const width = (t) => 0.78 + 0.25 * Math.sin(Math.PI * t * 0.95);
      const height = (t) => (t < 0.35 ? 1 : 1 - 0.52 * ((t - 0.35) / 0.65) ** 0.8);
      const shoeGeo = cached('shoe', () => {
        const q = roundedBoxGeo(0.1, 0.1, 0.27, 0.035, 3, 6);
        const p = q.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const t = (p.getZ(i) + 0.135) / 0.27;
          p.setX(i, p.getX(i) * width(t));
          p.setY(i, (p.getY(i) + 0.05) * height(t) + 0.012 * t ** 3 + 0.016);
        }
        return weldNormals(q);
      });
      const soleGeo = cached('shoesole', () => {
        const pts = [];
        for (let i = 0; i <= 24; i++) { const t = i / 24; pts.push([0.056 * width(t), -0.14 + t * 0.285]); }
        for (let i = 24; i >= 0; i--) { const t = i / 24; pts.push([-0.056 * width(t), -0.14 + t * 0.285]); }
        const g = extrude(pts, 0.014, 0.003);
        g.rotateX(Math.PI / 2);
        g.translate(0, 0.01, 0);
        return g;
      });
      const shoe = () => {
        const sh = new THREE.Group();
        sh.add(mesh(shoeGeo, upper));
        sh.add(mesh(soleGeo, soleM));
        sh.add(rbox(0.07, 0.022, 0.07, 0.008, soleM, { pos: [0, 0, -0.1] }));
        // the opening and its padded collar
        sh.add(mesh(new THREE.CircleGeometry(0.036, 18), dark, { pos: [0, 0.1165, -0.07], rot: [-Math.PI / 2, 0, 0], scale: [0.95, 1.55, 1], shadow: false }));
        sh.add(mesh(new THREE.TorusGeometry(0.037, 0.009, 8, 22), upper, { pos: [0, 0.114, -0.07], rot: [-Math.PI / 2, 0, 0], scale: [0.95, 1.55, 1] }));
        // laces across the vamp, which slopes toward the toe
        for (let k = 0; k < 4; k++) {
          const t = 0.42 + k * 0.07;
          const z = -0.135 + t * 0.27;
          const y = 0.1 * height(t) + 0.016 + 0.004;
          const w = 0.03 * width(t);
          sh.add(mesh(tubeGeo([[-w, y - 0.004, z - 0.012], [0, y + 0.002, z], [w, y - 0.004, z + 0.012]], 0.0028, 6), lace, { shadow: false }));
        }
        return sh;
      };
      const a = shoe();
      a.position.set(-0.07, 0, 0.02);
      a.rotation.y = 0.25;
      object.add(a);
      const b = shoe();
      b.rotation.set(0, -0.5, -1.35); // fallen over, sole toward the other shoe
      b.position.set(0.12, 0.055, -0.03);
      object.add(b);
      break;
    }
    case C.PAJAMAS: {
      // silk pyjamas, folded: the jacket on top of the trousers, with piping
      const silk = mat('fabric', { c1: 0xe8d8f2, c2: 0xc0a8d0, p: [1.6, 0.6, 0, 0.4] });
      object.add(mesh(cushionGeo(0.34, 0.045, 0.28, { r: 0.02, puff: 0.35, under: 0 }), silk, { pos: [0, 0.023, 0] }));
      object.add(mesh(cushionGeo(0.3, 0.035, 0.24, { r: 0.018, puff: 0.3, under: 0 }), silk, { pos: [0.01, 0.06, 0.005], rot: [0, 0.06, 0] }));
      object.add(mesh(tubeGeo([[-0.14, 0.078, -0.11], [0.15, 0.078, -0.1]], 0.004, 8), mat('fabric', { c1: 0x6a3a8a, p: [1, 0.5, 0, 0] }), { shadow: false }));
      for (let i = 0; i < 3; i++) object.add(sphere(0.007, mat('matte', { c1: 0xf8f4ea, p: [0.2, 0, 0, 0] }), [0.02, 0.079, -0.06 + i * 0.05], [1, 0.4, 1], 8));
      break;
    }
    case C.ROBE: {
      // "a kingly robe of royal purple and spun gold is draped here": velvet
      // dropped in a heap of folds, a gold border along its hem, an ermine collar
      const velvet = mat('fabric', { c1: 0x4a1464, c2: 0x2a0a3a, c3: 0xb89040, p: [1.1, 0.9, 0.12, 0.6], side: THREE.DoubleSide });
      const ermine = mat('fabric', { c1: 0xf4f0e8, c2: 0xd8d2c8, p: [3, 0.3, 0, 1] });
      const forms = [
        [0, 0, 0.24, 0.2, 0.11, 0.3],
        [0.1, 0.07, 0.26, 0.08, 0.09, 0.9],
        [-0.1, -0.02, 0.28, 0.08, 0.085, -0.4],
        [0.03, -0.14, 0.2, 0.07, 0.06, 1.6],
        [-0.18, 0.14, 0.14, 0.13, 0.05, 0],
        [0.22, -0.05, 0.1, 0.15, 0.045, 0.2],
      ];
      const cloth = clothGeo('robe', forms, 0.95, 0.8, seed, low);
      object.add(mesh(cloth, velvet));
      object.add(mesh(tubeGeo(cloth.userData.hem.map(([x, y, z]) => [x, y + 0.004, z]), 0.009, cloth.userData.hem.length * 2, true), M.gold(), { shadow: false }));
      object.add(mesh(tubeGeo([[-0.14, 0.11, -0.08], [-0.04, 0.13, -0.12], [0.08, 0.125, -0.1], [0.15, 0.1, -0.03]], 0.024, 20), ermine));
      for (let i = 0; i < 5; i++) object.add(sphere(0.007, mat('matte', { c1: 0x141010, p: [0.6, 0, 0, 0] }), [-0.11 + i * 0.055, 0.13 + 0.01 * Math.sin(i), -0.1 - 0.02 * Math.cos(i) + 0.022], [1, 1.6, 1], 6));
      break;
    }
    case C.AMULET: case C.MEDALION: case C.TALISMAN: {
      const gold = M.gold();
      const piece = new THREE.Group();
      if (o === C.AMULET) {
        // a strange golden amulet: a ring of filigree around a red stone
        piece.add(mesh(new THREE.TorusGeometry(0.05, 0.01, 10, 32), gold));
        for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; piece.add(sphere(0.007, gold, [Math.cos(a) * 0.063, Math.sin(a) * 0.063, 0], null, 8)); }
        const st = gem(0.026, 0xc8182a, 8);
        st.rotation.x = Math.PI / 2;
        piece.add(st);
        for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + 0.78; piece.add(mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.03, 5), gold, { pos: [Math.cos(a) * 0.035, Math.sin(a) * 0.035, 0], rot: [0, 0, a + Math.PI / 2] })); }
      } else if (o === C.MEDALION) {
        // a medallion of solid gold: a raised rim, rings and a boss
        piece.add(mesh(latheGeo([[0, -0.006], [0.072, -0.006], [0.072, 0.006], [0.068, 0.013], [0.06, 0.01], [0.05, 0.006], [0.035, 0.012], [0.03, 0.009], [0, 0.008]], 40), gold, { rot: [Math.PI / 2, 0, 0] }));
        piece.add(mesh(latheGeo([[0, 0.006], [0.022, 0.006], [0.02, 0.012], [0.012, 0.024], [0, 0.028]], 24), gold, { rot: [Math.PI / 2, 0, 0] }));
        for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; piece.add(mesh(new THREE.ConeGeometry(0.006, 0.02, 4), gold, { pos: [Math.cos(a) * 0.042, Math.sin(a) * 0.042, 0.012], rot: [0, 0, a - Math.PI / 2] })); }
      } else {
        // a talisman: a pale blue crystal held in gold claws
        const cr = new THREE.MeshStandardMaterial({ color: 0xa8e0ff, roughness: 0.02, metalness: 0.05, emissive: 0x3a90d0, emissiveIntensity: 0.6, flatShading: true, transparent: true, opacity: 0.9 });
        piece.add(mesh(new THREE.OctahedronGeometry(0.045, 0), cr, { scale: [0.7, 1.4, 0.7] }));
        for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2; piece.add(mesh(tubeGeo([[0, -0.07, 0], [Math.cos(a) * 0.03, -0.05, Math.sin(a) * 0.03], [Math.cos(a) * 0.034, -0.01, Math.sin(a) * 0.034]], 0.004, 8), gold)); }
        piece.add(mesh(new THREE.TorusGeometry(0.012, 0.004, 6, 16), gold, { pos: [0, 0.075, 0] }));
      }
      piece.position.y = 0.075;
      piece.rotation.x = -0.35;
      object.add(piece);
      object.add(chainLoop(0.14, gold));
      object.children[1].position.set(0, 0, 0.13);
      const g = glowSprite(o === C.TALISMAN ? 0x9ad8ff : 0xffd070, 0.7, 0.8);
      g.position.y = 0.08;
      object.add(g);
      light = { color: o === C.TALISMAN ? 0x9ad8ff : 0xffcf70, intensity: 2.5, distance: 4, flicker: 0.2, offset: [0, 0.2, 0] };
      update = (t) => { piece.rotation.y = t * 0.7; piece.position.y = 0.075 + 0.006 * Math.sin(t * 1.6); };
      break;
    }
    case C.MALLET: {
      // "a heavy wooden mallet": a barrel head with iron bands, a tapered handle
      const head = cached('malletHead', () => { const q = latheGeo([[0, -0.16], [0.09, -0.16], [0.105, -0.14], [0.11, 0], [0.105, 0.14], [0.09, 0.16], [0, 0.16]], 22); return weldNormals(q); });
      object.add(mesh(head, M.oldWood(), { pos: [0.4, 0.11, 0], rot: [Math.PI / 2, 0, 0] }));
      for (const z of [-0.12, 0.12]) object.add(mesh(new THREE.TorusGeometry(0.108, 0.008, 6, 26), M.darkSteel(), { pos: [0.4, 0.11, z] }));
      object.add(mesh(cached('malletHandle', () => { const q = latheGeo([[0, 0], [0.024, 0], [0.02, 0.2], [0.018, 0.55], [0.026, 0.6], [0, 0.62]], 14); q.rotateZ(Math.PI / 2); return q; }), M.wood(), { pos: [0.34, 0.06, 0], rot: [0, 0, -0.08] }));
      object.position.x = -0.1;
      break;
    }
    case C.LASER: {
      // "a laser pistol": original design — a sculpted body, finned emitter, glowing cell
      const shell = mat('metal', { c1: 0x3a4048, c2: 0x15181c, p: [0.3, 0.2, 0, 0] });
      const trim = mat('metal', { c1: 0xb8c0c8, c2: 0x5a6068, p: [0.15, 0.1, 0, 0] });
      const p = new THREE.Group();
      p.add(rbox(0.2, 0.055, 0.042, 0.018, shell, { pos: [0.05, 0.07, 0], center: true }));
      p.add(mesh(cached('laserEmitter', () => { const q = latheGeo([[0, 0], [0.016, 0], [0.018, 0.02], [0.013, 0.03], [0.016, 0.04], [0.012, 0.06], [0.014, 0.07], [0.008, 0.08], [0, 0.08]], 16); q.rotateZ(-Math.PI / 2); return q; }), trim, { pos: [0.15, 0.075, 0] }));
      for (let i = 0; i < 3; i++) p.add(rbox(0.006, 0.05, 0.05, 0.002, trim, { pos: [0.1 + i * 0.016, 0.075, 0], center: true }));
      p.add(rbox(0.045, 0.1, 0.034, 0.014, mat('fabric', { c1: 0x24262a, c2: 0x101113, p: [3, 0.1, 0, 1] }), { pos: [-0.02, 0.025, 0], rot: [0, 0, -0.3], center: true }));
      p.add(mesh(new THREE.TorusGeometry(0.018, 0.004, 6, 14, Math.PI), shell, { pos: [0.02, 0.035, 0], rot: [0, 0, Math.PI] }));
      p.add(rbox(0.06, 0.012, 0.018, 0.005, glowMat(0xff3a3a, 2.4), { pos: [0.04, 0.1, 0], center: true, shadow: false }));
      p.add(sphere(0.006, glowMat(0xff6a4a, 4), [0.232, 0.075, 0], null, 8));
      p.rotation.x = Math.PI / 2; // lying on its side
      p.position.y = 0.02;
      object.add(p);
      break;
    }
    case C.GRENADE: {
      // a segmented hand grenade on its side: fuse head, spoon lever along the body, pin ring
      const body = mat('tile', { c1: 0x4a5634, c2: 0x3a4428, c3: 0x56603c, p: [0.022, 0.16, 0.4, 0] });
      object.add(mesh(cached('grenade', () => { const q = latheGeo([[0, 0], [0.025, 0.004], [0.042, 0.03], [0.046, 0.06], [0.04, 0.09], [0.024, 0.105], [0, 0.108]], 20); q.rotateZ(-Math.PI / 2); return q; }), body, { pos: [-0.05, 0.046, 0] }));
      const fuse = new THREE.Group();
      fuse.add(mesh(new THREE.CylinderGeometry(0.013, 0.015, 0.026, 12), M.darkSteel(), { pos: [0, 0.012, 0] }));
      // the lever: out of the fuse head, then back along the top of the body
      fuse.add(mesh(tubeGeo([[-0.012, 0.018, 0], [-0.03, 0.01, 0], [-0.05, -0.03, 0], [-0.052, -0.07, 0], [-0.046, -0.1, 0]], 0.0045, 16), M.darkSteel()));
      fuse.add(mesh(new THREE.TorusGeometry(0.014, 0.0022, 6, 16), M.steel(), { pos: [0.01, 0.018, 0.02], rot: [0.4, 0.3, 0] }));
      fuse.position.set(0.055, 0.046, 0);
      fuse.rotation.z = -Math.PI / 2;
      object.add(fuse);
      break;
    }
    case C.CHAIN: {
      // "a length of heavy chain": oval links, each turned a quarter to the last,
      // spaced by their inner length along a lazy curve; the standing links lean
      const link = cached('chainlink', () => { const q = new THREE.TorusGeometry(0.028, 0.008, 8, 18); q.scale(1.45, 1, 1); return q; });
      const curve = new THREE.CatmullRomCurve3([[-0.45, 0, 0.05], [-0.2, 0, -0.1], [0.05, 0, 0.08], [0.3, 0, 0.12], [0.42, 0, -0.08], [0.3, 0, -0.2]].map((p) => new THREE.Vector3(...p)));
      const n = Math.floor(curve.getLength() / 0.062);
      const iron = M.darkSteel();
      for (let i = 0; i < n; i++) {
        const u = (i + 0.5) / n;
        const p = curve.getPointAt(u);
        const d = curve.getTangentAt(u);
        const flat = i % 2 === 0;
        const lean = flat ? 0 : 0.5 * Math.sin(i * 1.7);
        const m = mesh(link, iron, { pos: [p.x, flat ? 0.008 : 0.034 * Math.cos(lean), p.z] });
        m.rotation.order = 'YXZ';
        m.rotation.set(flat ? Math.PI / 2 : lean, Math.atan2(-d.z, d.x), 0);
        object.add(m);
      }
      break;
    }
    case C.ROPE: {
      // "a stout rope": a coil with a loose end
      const hemp = mat('fabric', { c1: 0xb8985a, c2: 0x8a6a36, p: [3.5, 0.1, 0, 1] });
      const pts = [];
      const turns = 5;
      for (let i = 0; i <= turns * 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        const r = 0.17 - (i / (turns * 24)) * 0.03;
        pts.push([Math.cos(a) * r, 0.02 + (i / (turns * 24)) * 0.1 + 0.01 * Math.sin(a * 3), Math.sin(a) * r]);
      }
      pts.push([0.2, 0.05, 0.15], [0.35, 0.02, 0.2], [0.5, 0.018, 0.12]);
      object.add(mesh(tubeGeo(pts, 0.018, low ? 120 : 260), hemp));
      break;
    }
    case C.LEVIS: {
      // a pair of jeans folded in three: waistband with loops, a copper button and
      // a leather patch; a back pocket; orange twin stitching along the seams
      const denim = mat('fabric', { c1: 0x2e4c7a, c2: 0x1c2e4c, p: [1.8, 0.1, 0, 1] });
      const stitch = mat('matte', { c1: 0xd88a30, p: [0.7, 0, 0, 0] });
      object.add(mesh(cushionGeo(0.34, 0.04, 0.4, { r: 0.018, puff: 0.3, under: 0 }), denim, { pos: [0, 0.02, 0] }));
      object.add(mesh(cushionGeo(0.33, 0.035, 0.26, { r: 0.016, puff: 0.35, under: 0 }), denim, { pos: [0, 0.056, -0.06] }));
      object.add(rbox(0.33, 0.014, 0.045, 0.006, denim, { pos: [0, 0.074, -0.17] })); // waistband
      for (const x of [-0.14, -0.05, 0.05, 0.14]) object.add(rbox(0.012, 0.018, 0.05, 0.004, denim, { pos: [x, 0.074, -0.17] }));
      object.add(mesh(latheGeo([[0, 0], [0.009, 0], [0.01, 0.003], [0.006, 0.006], [0, 0.0065]], 14), mat('metal', { c1: 0xb87333, c2: 0x5a3010, p: [0.3, 0.3, 0, 0] }), { pos: [-0.1, 0.088, -0.17] }));
      object.add(rbox(0.06, 0.003, 0.03, 0.002, mat('fabric', { c1: 0x9a6a36, c2: 0x6a4420, p: [2, 0.2, 0, 1] }), { pos: [0.11, 0.088, -0.17] }));
      // a back pocket with plain twin stitching
      object.add(rbox(0.12, 0.004, 0.13, 0.004, denim, { pos: [0.06, 0.0745, -0.02] }));
      for (const d of [0.006, 0.012]) object.add(mesh(tubeGeo([[0.06 - 0.06 + d, 0.08, -0.085 + d], [0.06 - 0.06 + d, 0.08, 0.045 - d], [0.06 + 0.06 - d, 0.08, 0.045 - d], [0.06 + 0.06 - d, 0.08, -0.085 + d]], 0.0014, 24), stitch, { shadow: false }));
      for (const z of [-0.004, 0.004]) object.add(mesh(tubeGeo([[-0.17, 0.042, 0.13 + z], [0.17, 0.042, 0.13 + z]], 0.0014, 4), stitch, { shadow: false }));
      object.rotation.y = 0.3;
      break;
    }
    case C.MACE: {
      // "a bloody mace": a flanged head on a wrapped haft
      object.add(mesh(cached('maceHaft', () => { const q = latheGeo([[0, 0], [0.02, 0], [0.018, 0.12], [0.02, 0.45], [0.028, 0.5], [0, 0.52]], 12); q.rotateZ(Math.PI / 2); return q; }), M.wood(), { pos: [0.52, 0.035, 0] }));
      object.add(mesh(gripGeo(0.13, 0.021, 5), M.leather(), { pos: [0.52, 0.035, 0] }));
      const head = new THREE.Group();
      head.add(sphere(0.05, M.darkSteel(), null, null, 16));
      for (let i = 0; i < 7; i++) head.add(mesh(cached('flange', () => extrude([[0, -0.05], [0.05, -0.03], [0.065, 0], [0.05, 0.03], [0, 0.05]], 0.012, 0.003)), M.darkSteel(), { rot: [0, (i / 7) * Math.PI * 2, 0] }));
      head.add(mesh(new THREE.ConeGeometry(0.02, 0.06, 10), M.darkSteel(), { pos: [0, 0.07, 0] }));
      head.position.set(-0.04, 0.07, 0);
      head.rotation.z = Math.PI / 2;
      object.add(head);
      object.add(sphere(0.03, M.blood(), [-0.02, 0.1, 0.02], [1, 0.3, 1.2], 10));
      object.position.x = -0.2;
      break;
    }
    case C.SHOVEL: {
      object.add(mesh(cached('shovelHandle', () => { const q = latheGeo([[0, 0], [0.018, 0], [0.02, 0.1], [0.018, 0.85], [0.022, 0.9], [0, 0.92]], 12); q.rotateZ(Math.PI / 2); return q; }), M.wood(), { pos: [0.92, 0.03, 0] }));
      object.add(mesh(new THREE.TorusGeometry(0.05, 0.012, 8, 20, Math.PI), M.wood(), { pos: [-0.05, 0.03, 0], rot: [Math.PI / 2, 0, Math.PI / 2] }));
      object.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.1, 8), M.wood(), { pos: [-0.1, 0.03, 0], rot: [Math.PI / 2, 0, 0] }));
      object.add(mesh(cached('spade', () => { const q = extrude([[0, -0.1], [0.2, -0.105], [0.27, -0.06], [0.3, 0], [0.27, 0.06], [0.2, 0.105], [0, 0.1], [-0.05, 0.03], [-0.05, -0.03]], 0.004, 0.0015); q.rotateX(-Math.PI / 2); return q; }), M.darkSteel(), { pos: [0.96, 0.02, 0], rot: [0, 0, 0.05] }));
      object.add(mesh(new THREE.CylinderGeometry(0.024, 0.02, 0.08, 10), M.darkSteel(), { pos: [0.93, 0.03, 0], rot: [0, 0, Math.PI / 2] }));
      object.position.x = -0.55;
      break;
    }
    case C.HALBERD: {
      // "a long, sharp halberd is propped up here": axe blade, spike and hook
      object.add(mesh(cached('halberdShaft', () => { const q = latheGeo([[0, 0], [0.02, 0], [0.018, 1.8], [0.022, 1.85], [0, 1.86]], 10); q.rotateZ(-Math.PI / 2); return q; }), M.wood(), { pos: [0, 0.03, 0] }));
      const head = new THREE.Group();
      head.add(mesh(cached('halberdAxe', () => { const q = extrude([[0, 0.02], [0.02, 0.2], [0.12, 0.26], [0.22, 0.22], [0.2, 0.1], [0.16, 0.02]], 0.008, 0.002); q.rotateX(-Math.PI / 2); return q; }), M.steel()));
      head.add(mesh(cached('halberdHook', () => { const q = extrude([[0.05, -0.02], [0.02, -0.14], [0.06, -0.12], [0.1, -0.02]], 0.008, 0.002); q.rotateX(-Math.PI / 2); return q; }), M.steel()));
      head.add(mesh(new THREE.ConeGeometry(0.02, 0.3, 4), M.steel(), { pos: [0.24, 0, 0.0], rot: [0, 0, -Math.PI / 2], scale: [1, 1, 0.4] }));
      head.add(rbox(0.12, 0.03, 0.03, 0.008, M.darkSteel(), { pos: [0.05, 0, 0], center: true }));
      head.position.set(1.78, 0.03, 0);
      object.add(head);
      object.position.x = -0.95;
      break;
    }
    case C.COMPASS: {
      // a brass pocket compass, open: case, glass, card with a needle, lid
      object.add(mesh(latheGeo([[0, 0], [0.045, 0], [0.05, 0.006], [0.05, 0.016], [0.046, 0.02], [0.04, 0.02], [0.04, 0.012], [0, 0.012]], 30), M.brass()));
      object.add(mesh(new THREE.CircleGeometry(0.039, 30), mat('matte', { c1: 0xf0e8d0, p: [0.6, 0, 0, 0] }), { pos: [0, 0.0125, 0], rot: [-Math.PI / 2, 0, 0], shadow: false }));
      for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; object.add(rbox(0.001, 0.0005, i % 4 ? 0.004 : 0.008, 0.0002, mat('matte', { c1: 0x201810, p: [0.5, 0, 0, 0] }), { pos: [Math.cos(a) * 0.034, 0.0132, Math.sin(a) * 0.034], rot: [0, -a + Math.PI / 2, 0], center: true, shadow: false })); }
      const needle = new THREE.Group();
      needle.add(mesh(new THREE.ConeGeometry(0.004, 0.03, 4), glowMat(0xd82a1a, 1.2), { pos: [0, 0, -0.015], rot: [-Math.PI / 2, 0, 0], scale: [1, 1, 0.3] }));
      needle.add(mesh(new THREE.ConeGeometry(0.004, 0.03, 4), mat('matte', { c1: 0xe8e8e8, p: [0.4, 0, 0, 0] }), { pos: [0, 0, 0.015], rot: [Math.PI / 2, 0, 0], scale: [1, 1, 0.3] }));
      needle.position.y = 0.015;
      object.add(needle);
      object.add(mesh(new THREE.CircleGeometry(0.04, 30), M.glass(), { pos: [0, 0.019, 0], rot: [-Math.PI / 2, 0, 0], shadow: false }));
      object.add(mesh(latheGeo([[0, 0], [0.047, 0], [0.05, 0.004], [0.046, 0.01], [0, 0.012]], 30), M.brass(), { pos: [0, 0.06, -0.05], rot: [-1.9, 0, 0] }));
      update = (t) => { needle.rotation.y = 0.15 * Math.sin(t * 0.8) + 0.05 * Math.sin(t * 2.3); };
      break;
    }
    case C.CRASH: {
      // the wreck of a small craft: a charred scar, a torn fuselage section half
      // dug in with its nose crumpled, a broken wing, bent panels, struts, smoke
      const hullDS = mat('panel', { c1: 0x9a968e, c2: 0x1a1a1a, c3: 0xff6020, p: [0.6, 0, 0, 0.9], q: [0.6, 0, 0, 0], seed: 4, side: THREE.DoubleSide });
      const hull = mat('panel', { c1: 0x9a968e, c2: 0x1a1a1a, c3: 0xff6020, p: [0.6, 0, 0, 0.9], q: [0.6, 0, 0, 0], seed: 4 });
      const burnt = mat('metal', { c1: 0x2a2624, c2: 0x0e0c0a, p: [0.7, 0.8, 0, 0] });
      object.add(mesh(charGeo(), mat('stone', { c1: 0x080605, c2: 0x1c1612, p: [2, 0, 0, 0] }), { pos: [0, 0.008, 0], scale: [1.7, 1, 1.5], shadow: false }));
      const fus = new THREE.Group();
      fus.add(mesh(cached('wreckFuselage', () => {
        const q = new THREE.CylinderGeometry(0.55, 0.62, 2.2, 28, 12, true);
        const p = q.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i); const y = p.getY(i); const z = p.getZ(i);
          const a = Math.atan2(z, x);
          const tear = 0.55 + 0.5 * (0.5 + 0.5 * Math.sin(a * 7) * Math.sin(a * 3 + 1));
          const k = 1 + 0.07 * Math.sin(a * 5 + y * 3) * Math.cos(y * 4);
          p.setXYZ(i, x * k, Math.min(y, tear), z * k);
        }
        q.computeVertexNormals();
        return q;
      }), hullDS));
      fus.add(mesh(cached('wreckNose', () => { const q = weldNormals(latheGeo([[0, -0.95], [0.12, -0.9], [0.3, -0.75], [0.48, -0.45], [0.6, -0.1], [0.62, 0]], 24)); const p = q.attributes.position; for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) * (1 + 0.1 * Math.sin(p.getY(i) * 9))); q.computeVertexNormals(); return q; }), hull, { pos: [0, -1.1, 0] }));
      for (let i = 0; i < 4; i++) fus.add(mesh(new THREE.TorusGeometry(0.585, 0.02, 6, 28), burnt, { pos: [0, -0.9 + i * 0.45, 0], rot: [Math.PI / 2, 0, 0], scale: [1, 1, 1] }));
      fus.position.set(0.4, 0.38, -0.2);
      fus.rotation.set(0.1, 0.45, Math.PI / 2 - 0.14);
      object.add(fus);
      // a wing torn off, one edge dug in
      object.add(mesh(cached('wreckwing', () => { const q = extrude([[0, 0], [1.2, 0.1], [1.45, 0.35], [1.0, 0.45], [0.55, 0.38], [0.2, 0.5], [0.05, 0.3]], 0.05, 0.012); q.rotateX(-Math.PI / 2); return q; }), hull, { pos: [-1.5, 0.2, 1.0], rot: [0.28, 0.9, 0.22] }));
      // bent panels scattered flat, a few leaning
      for (let i = 0; i < (low ? 4 : 8); i++) {
        const s = 0.3 + (i % 3) * 0.2;
        const pnl = mesh(roundedBoxGeo(s * 1.3, 0.03, s, 0.012, 2, 4), hull, { pos: [Math.sin(i * 2.1) * 2.4, 0.03 + (i % 3 === 2 ? 0.12 : 0), Math.cos(i * 1.7) * 1.8 + 0.2], rot: [i % 3 === 2 ? 0.5 : 0.08 * Math.sin(i), i * 1.3, 0.1 * Math.cos(i)] });
        const p = pnl.geometry.attributes.position;
        for (let k = 0; k < p.count; k++) { const x = p.getX(k); const z = p.getZ(k); p.setY(k, p.getY(k) + 0.05 * Math.sin(x * 5 + i) * Math.cos(z * 4) + 0.04 * (x / s) ** 2); }
        pnl.geometry.computeVertexNormals();
        object.add(pnl);
      }
      for (let i = 0; i < 3; i++) object.add(mesh(tubeGeo([[0, 0, 0], [0.4, 0.05 + i * 0.03, 0.1], [0.7, 0.2, -0.1 * i], [0.9, 0.06, 0.2]], 0.035, 16), burnt, { pos: [0.6 - i * 1.4, 0.03, 1.3 - i * 0.9], rot: [0, i * 1.9, 0] }));
      const smoke = particles('smoke', low ? 30 : 60, { quality, seed, spread: [1.6, 0.3, 1.6], vel: [0.25, 1.1, 0], size: 260, pos: [0.2, 0.6, -0.2] });
      object.add(smoke);
      const embers = particles('embers', low ? 20 : 40, { quality, seed: seed + 1, spread: [2.5, 0.2, 2.5] });
      object.add(embers);
      light = { color: 0xff6a20, intensity: 4, distance: 8, flicker: 0.6, offset: [0, 0.5, 0] };
      update = (t) => { smoke.userData.tick(t); embers.userData.tick(t); };
      break;
    }
    case C.COINS: {
      // a few gold coins: milled rims and raised faces, a small stack and a scatter
      const coin = cached('coin', () => latheGeo([[0, -0.002], [0.017, -0.002], [0.017, 0.002], [0.016, 0.004], [0.015, 0.0045], [0.012, 0.0035], [0, 0.0035]], 24));
      const g = M.gold();
      for (let i = 0; i < 5; i++) object.add(mesh(coin, g, { pos: [0.02 + Math.sin(i * 3) * 0.002, 0.002 + i * 0.0062, 0.01], rot: [0, i, 0] }));
      for (let i = 0; i < 7; i++) object.add(mesh(coin, g, { pos: [Math.sin(i * 2.4) * 0.09, 0.003, Math.cos(i * 1.9) * 0.08], rot: [Math.sin(i) * 0.15, i, 0] }));
      break;
    }
    case C.MATCHES: {
      // a match book, flap open: cardboard cover, a row of red-headed matches
      const cover = mat('matte', { c1: 0xb82418, p: [0.8, 0, 0, 0] });
      object.add(rbox(0.048, 0.004, 0.036, 0.0015, cover, { pos: [0, 0, 0] }));
      object.add(rbox(0.048, 0.003, 0.012, 0.001, mat('matte', { c1: 0xf0e8d8, p: [0.8, 0, 0, 0] }), { pos: [0, 0.004, 0.012] }));
      for (let i = 0; i < 8; i++) {
        object.add(rbox(0.004, 0.001, 0.03, 0.0005, mat('matte', { c1: 0xe8dcc0, p: [0.9, 0, 0, 0] }), { pos: [-0.018 + i * 0.005, 0.006, -0.002] }));
        object.add(sphere(0.0025, mat('matte', { c1: 0x9a1a10, p: [0.6, 0, 0, 0] }), [-0.018 + i * 0.005, 0.007, -0.017], [1, 0.8, 1.4], 6));
      }
      object.add(rbox(0.048, 0.003, 0.036, 0.0015, cover, { pos: [0, 0.016, -0.03], rot: [-0.9, 0, 0] }));
      object.scale.setScalar(1.3);
      break;
    }
    case C.PAPAYAS: case C.PINEAPPLE: case C.KIWI: case C.COCONUTS: case C.MANGO: object = fruit(o, seed); break;
    case C.RING: {
      const r = new THREE.Group();
      r.add(mesh(new THREE.TorusGeometry(0.011, 0.0022, 8, 24), M.gold()));
      r.add(mesh(latheGeo([[0, 0], [0.004, 0], [0.005, 0.004], [0.0045, 0.006], [0, 0.006]], 8), M.gold(), { pos: [0, 0.011, 0] }));
      const d = gem(0.0055, 0xf0faff, 10);
      d.position.y = 0.0185;
      r.add(d);
      r.rotation.x = 1.3;
      r.position.y = 0.012;
      object.add(r);
      const sp = glowSprite(0xdff6ff, 0.12, 0.9);
      sp.position.y = 0.02;
      object.add(sp);
      update = (t) => { sp.material.uniforms.uI.value = 0.5 + 0.5 * Math.max(0, Math.sin(t * 3.1)) ** 8; };
      object.scale.setScalar(1.8);
      break;
    }
    case C.POTION: {
      // "a colorful pink potion in a small crystal vial"
      const liquid = new THREE.MeshStandardMaterial({ color: 0xff8ac8, roughness: 0.1, emissive: 0xff4aa0, emissiveIntensity: 0.9, transparent: true, opacity: 0.85 });
      object.add(mesh(latheGeo([[0, 0.004], [0.028, 0.006], [0.036, 0.03], [0.034, 0.06], [0.014, 0.08], [0, 0.08]], 20), liquid, { shadow: false }));
      object.add(mesh(latheGeo([[0, 0], [0.03, 0], [0.04, 0.03], [0.038, 0.065], [0.016, 0.085], [0.012, 0.11], [0.015, 0.115]], 24), M.glass(), { shadow: false }));
      object.add(mesh(latheGeo([[0, 0.1], [0.011, 0.1], [0.013, 0.13], [0, 0.133]], 12), mat('fabric', { c1: 0xa87a4a, c2: 0x7a5a30, p: [3, 0, 0, 1] })));
      light = { color: 0xff5ab0, intensity: 1.2, distance: 2.5, offset: [0, 0.1, 0] };
      break;
    }
    case C.BRACELET: {
      // a gold bangle twisted from two strands, with beads
      const g = M.gold();
      const a = [];
      const b = [];
      for (let i = 0; i < 48; i++) {
        const t = (i / 48) * Math.PI * 2;
        const w = t * 6;
        a.push([Math.cos(t) * (0.04 + 0.003 * Math.cos(w)), 0.008 + 0.003 * Math.sin(w), Math.sin(t) * (0.04 + 0.003 * Math.cos(w))]);
        b.push([Math.cos(t) * (0.04 - 0.003 * Math.cos(w)), 0.008 - 0.003 * Math.sin(w), Math.sin(t) * (0.04 - 0.003 * Math.cos(w))]);
      }
      object.add(mesh(tubeGeo(a, 0.003, 96, true), g), mesh(tubeGeo(b, 0.003, 96, true), g));
      for (let i = 0; i < 6; i++) { const t = (i / 6) * Math.PI * 2; object.add(sphere(0.005, g, [Math.cos(t) * 0.04, 0.008, Math.sin(t) * 0.04], null, 8)); }
      object.rotation.z = 0.15;
      break;
    }
    case C.TIMER: break; // the old-timer is a person
    case 51: { // asteroid field (space): rough rocks, not faceted blobs
      const rock = mat('stone', { c1: 0x5a524a, c2: 0x2a2622, p: [0.4, 0, 0, 0] });
      for (let i = 0; i < (low ? 8 : 14); i++) {
        const geo = new THREE.IcosahedronGeometry(1 + (i % 4), 3);
        const p = geo.attributes.position;
        for (let k = 0; k < p.count; k++) {
          const v = new THREE.Vector3(p.getX(k), p.getY(k), p.getZ(k));
          const n = Math.sin(v.x * 1.7 + i) * Math.cos(v.y * 1.3 - i) * 0.18 + Math.sin(v.z * 3.1 + v.x) * 0.06;
          v.multiplyScalar(1 + n);
          v.y *= 0.8;
          p.setXYZ(k, v.x, v.y, v.z);
        }
        geo.computeVertexNormals();
        object.add(mesh(geo, rock, { pos: [Math.sin(i * 2.3) * 40, Math.cos(i * 1.7) * 18, -30 - (i * 13) % 70], rot: [i, i * 2, i * 3] }));
      }
      update = (t) => object.children.forEach((c, i) => { c.rotation.x = t * 0.1 * (i % 3 + 1); c.rotation.y = t * 0.07; });
      break;
    }
    case 53: { // charred ground: a scorched patch with an irregular edge and cinders
      object.add(mesh(charGeo(), mat('stone', { c1: 0x080605, c2: 0x1c1612, p: [2, 0, 0, 0] }), { pos: [0, 0.01, 0], shadow: false }));
      const cinder = mat('stone', { c1: 0x121010, c2: 0x2a2420, p: [6, 0, 0, 0] });
      for (let i = 0; i < (low ? 6 : 14); i++) {
        const a = i * 2.4;
        const r = 0.2 + (i % 5) * 0.25;
        object.add(sphere(0.03 + (i % 3) * 0.02, cinder, [Math.cos(a) * r, 0.012, Math.sin(a) * r], [1.3, 0.45, 1], 8));
      }
      break;
    }
    case C.BOMB: {
      // "a thermonuclear warhead": a re-entry body with bands, fins and a trefoil
      const body = mat('metal', { c1: 0x6a7058, c2: 0x2a2c22, p: [0.42, 0.35, 0, 0] });
      const wh = new THREE.Group();
      wh.add(mesh(cached('warhead', () => { const q = latheGeo([[0, -0.62], [0.2, -0.6], [0.24, -0.5], [0.24, 0.3], [0.2, 0.5], [0.12, 0.7], [0.05, 0.8], [0, 0.82]], 28); return weldNormals(q); }), body));
      for (const y of [-0.45, 0.0, 0.3]) wh.add(mesh(new THREE.TorusGeometry(0.242, 0.01, 6, 30), M.darkSteel(), { pos: [0, y, 0], rot: [Math.PI / 2, 0, 0] }));
      for (let i = 0; i < 4; i++) wh.add(mesh(cached('warfin', () => extrude([[0, 0], [0.18, -0.05], [0.18, -0.25], [0, -0.3]], 0.015, 0.004)), M.darkSteel(), { pos: [0, -0.3, 0], rot: [0, (i / 4) * Math.PI * 2, 0] }));
      const yellow = mat('matte', { c1: 0xe8c020, p: [0.5, 0, 0, 0] });
      const black = mat('matte', { c1: 0x141414, p: [0.5, 0, 0, 0] });
      wh.add(mesh(new THREE.CylinderGeometry(0.2435, 0.2435, 0.12, 30, 1, true), yellow, { pos: [0, 0.15, 0] }));
      // trefoil on the yellow band
      const tre = new THREE.Group();
      for (let i = 0; i < 3; i++) tre.add(mesh(new THREE.CircleGeometry(0.05, 12, (i / 3) * Math.PI * 2 + 0.52, Math.PI / 3), black, { shadow: false }));
      tre.add(mesh(new THREE.CircleGeometry(0.012, 12), black, { shadow: false }));
      tre.position.set(0, 0.15, 0.246);
      wh.add(tre);
      wh.rotation.z = -Math.PI / 2;
      wh.position.y = 0.25;
      object.add(wh);
      // a cradle
      for (const x of [-0.35, 0.3]) object.add(mesh(cached('cradle', () => extrude([[-0.28, 0], [0.28, 0], [0.28, 0.1], [0.22, 0.1], [0.15, 0.2], [-0.15, 0.2], [-0.22, 0.1], [-0.28, 0.1]], 0.06, 0.01)), M.darkSteel(), { pos: [x, 0, 0], rot: [0, Math.PI / 2, 0] }));
      break;
    }
    case C.HORSE: { const h = horse(seed); object = h.object; update = h.update; object.rotation.y = 0.6; break; }
    case C.CAR: object = car(); break;
    case C.POT: {
      // "a pot of pearls and jewels": a brass pot heaped with pearls and cut stones
      object.add(mesh(latheGeo([[0, 0], [0.12, 0], [0.16, 0.05], [0.18, 0.14], [0.16, 0.22], [0.13, 0.25], [0.15, 0.27], [0.14, 0.28], [0, 0.28]], 28), M.brass()));
      const pearl = new THREE.MeshStandardMaterial({ color: 0xf6f0e6, roughness: 0.18, metalness: 0.1 });
      const heap = new THREE.Group();
      for (let i = 0; i < (low ? 20 : 40); i++) {
        const a = i * 2.4;
        const r = 0.12 * Math.sqrt((i + 0.5) / 40);
        heap.add(sphere(0.014, pearl, [Math.cos(a) * r, 0.28 + (1 - r / 0.13) * 0.05, Math.sin(a) * r], null, 10));
      }
      const colors = [0xd01a3a, 0x1a6ad0, 0x1ab05a, 0xa03ad8, 0xffd040];
      for (let i = 0; i < 9; i++) { const a = i * 2.1; const g = gem(0.018, colors[i % 5], 8); g.position.set(Math.cos(a) * 0.07, 0.32, Math.sin(a) * 0.07); g.rotation.set(i, i * 2, 0); heap.add(g); }
      for (let i = 0; i < 3; i++) heap.add(sphere(0.014, pearl, [0.19 + i * 0.03, 0.014, 0.05 - i * 0.04], null, 10)); // spilled
      object.add(heap);
      light = { color: 0xffe0a0, intensity: 1.5, distance: 3, offset: [0, 0.4, 0] };
      break;
    }
    case C.BAR: {
      // "a bar of solid gold": a cast ingot, tapering on all four sides, with
      // rounded edges and a stamped panel
      const ingot = cached('ingot', () => {
        const q = roundedBoxGeo(0.25, 0.065, 0.1, 0.01, 3, 2);
        const p = q.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const k = (p.getY(i) / 0.0325 + 1) / 2; // 0 at the base, 1 on top
          p.setX(i, p.getX(i) * (1 - 0.1 * k));
          p.setZ(i, p.getZ(i) * (1 - 0.22 * k));
          p.setY(i, p.getY(i) + 0.0325);
        }
        return weldNormals(q);
      });
      const gold = mat('gold', { c1: 0xffc84a, c2: 0xffffff, p: [0.6, 0.02, 0, 0] });
      object.add(mesh(ingot, gold));
      object.add(rbox(0.1, 0.0025, 0.04, 0.001, mat('gold', { c1: 0xd8a040, c2: 0xffffff, p: [0.1, 0.25, 0, 0] }), { pos: [0, 0.064, 0], shadow: false }));
      object.rotation.y = 0.4;
      break;
    }
    case C.BLOCK: {
      // "a 10 kilogram diamond block": a large brilliant, facets catching light
      const d = new THREE.MeshStandardMaterial({ color: 0xeef8ff, roughness: 0.0, metalness: 0.15, transparent: true, opacity: 0.8, emissive: 0x3a5a7a, emissiveIntensity: 0.5, flatShading: true });
      const g = new THREE.Group();
      g.add(mesh(latheGeo([[0, 0], [0.16, 0.11], [0.18, 0.13], [0.12, 0.2], [0, 0.2]], 10), d));
      g.position.y = 0.0;
      g.rotation.set(0.35, 0.3, 0);
      object.add(g);
      const sp = particles('glitter', low ? 8 : 18, { quality, seed, spread: [0.5, 0.5, 0.5], size: 4 });
      sp.position.y = 0.15;
      object.add(sp);
      update = (t) => sp.userData.tick(t);
      break;
    }
    default: {
      object.add(rbox(0.2, 0.2, 0.2, 0.03, M.steel(), {}));
    }
  }
  object.traverse((m) => { if (m.isMesh && !m.material.transparent && m.castShadow !== false) { m.castShadow = true; m.receiveShadow = true; } });
  return { object, light, update };
}

/** Objects that are big enough to be placed deliberately rather than scattered. */
export const LARGE = new Set([C.VIPER, C.CAR, C.HORSE, C.CRASH, C.BOMB, 51, 53]);
