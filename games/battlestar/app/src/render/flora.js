// Procedural plants, all instanced: coconut palms, broadleaf trees (mango,
// breadfruit, rainforest giants), papaya, ferns, grass, bushes, pineapple,
// sugar cane, kiwi vines, conifers, sedges and flowers. Leaves are quads whose
// outline is cut in the shader from their UVs (leaf family), so no textures.

import * as THREE from 'three';
import { mat } from './materials.js';

// ---------------------------------------------------------------- geometry utils

export function merge(geos) {
  let count = 0;
  let icount = 0;
  for (const g of geos) { count += g.attributes.position.count; icount += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(count * 3);
  const nrm = new Float32Array(count * 3);
  const uv = new Float32Array(count * 2);
  const idx = new Uint32Array(icount);
  let o = 0;
  let io = 0;
  for (const g of geos) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3);
    if (g.attributes.normal) nrm.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    if (g.index) for (let i = 0; i < g.index.count; i++) idx[io++] = g.index.array[i] + o;
    else for (let i = 0; i < n; i++) idx[io++] = i + o;
    o += n;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

const cache = new Map();
function cached(key, make) {
  if (!cache.has(key)) {
    const g = make();
    g.userData.shared = true;
    cache.set(key, g);
  }
  return cache.get(key);
}

/** A tapered tube along a curve (trunks, stalks). */
function trunkAlong(curve, r0, r1, segs = 16, radial = 8) {
  const pos = [];
  const nrm = [];
  const uv = [];
  const idx = [];
  const frames = curve.computeFrenetFrames(segs, false);
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const c = curve.getPointAt(t);
    const r = r0 + (r1 - r0) * t;
    const N = frames.normals[i];
    const B = frames.binormals[i];
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const nx = Math.cos(a) * N.x + Math.sin(a) * B.x;
      const ny = Math.cos(a) * N.y + Math.sin(a) * B.y;
      const nz = Math.cos(a) * N.z + Math.sin(a) * B.z;
      pos.push(c.x + nx * r, c.y + ny * r, c.z + nz * r);
      nrm.push(nx, ny, nz);
      uv.push(j / radial, t);
    }
  }
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      const b = a + radial + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** A leaf blade: a bent strip along +Z from the origin (uv.x across, uv.y along). */
function blade(len, width, droop, segs = 10, twist = 0) {
  const g = new THREE.PlaneGeometry(width, len, 1, segs);
  g.translate(0, len / 2, 0);
  g.rotateX(-Math.PI / 2); // lies along -Z... flip so it points +Z
  g.rotateY(Math.PI);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i);
    const t = z / len;
    p.setY(i, p.getY(i) - droop * t * t * len + Math.sin(t * Math.PI) * len * 0.12);
    const x = p.getX(i);
    p.setX(i, x * Math.cos(twist * t));
    p.setY(i, p.getY(i) + x * Math.sin(twist * t));
  }
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------- palms

function palmParts(variant) {
  return cached(`palm-${variant}`, () => {
    const h = [7.5, 8.5, 6.5][variant];
    const lean = [0.6, 2.2, 1.2][variant];
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0), new THREE.Vector3(lean * 0.2, h * 0.35, 0),
      new THREE.Vector3(lean * 0.65, h * 0.7, 0), new THREE.Vector3(lean, h, 0),
    ]);
    const g = trunkAlong(curve, 0.2, 0.13, 18, 9);
    g.userData.top = new THREE.Vector3(lean, h, 0);
    return g;
  });
}

function palmCrown() {
  return cached('palm-crown', () => {
    const parts = [];
    for (let i = 0; i < 12; i++) {
      const b = blade(3.4 + (i % 3) * 0.3, 1.1, 0.55 + (i % 2) * 0.2, 12, 0.3);
      b.rotateX(-0.35 - (i % 3) * 0.12);
      b.rotateY((i / 12) * Math.PI * 2 + (i % 2) * 0.2);
      parts.push(b);
    }
    return merge(parts);
  });
}

function nutCluster() {
  return cached('palm-nuts', () => {
    const parts = [];
    for (let i = 0; i < 5; i++) {
      const s = new THREE.SphereGeometry(0.13, 8, 6);
      s.translate(Math.cos(i * 1.3) * 0.22, -0.25 - (i % 2) * 0.12, Math.sin(i * 1.3) * 0.22);
      parts.push(s);
    }
    return merge(parts);
  });
}

const barkPalm = () => mat('bark', { c1: 0x8a7458, c2: 0x5a4a38, p: [3, 14, 0.8, 0] });
const frondM = (night) => mat('leaf', { c1: night ? 0x1f3a22 : 0x3f7a2c, c2: night ? 0x2a4a2a : 0x6a9a3a, c3: 0x9ab860, p: [0.9, 1.0, 0.04, 0], side: THREE.DoubleSide, alphaTest: 0.5, sway: 1.0 });
const nutM = () => mat('cloth', { c1: 0x6a8a2a, c2: 0x4a3a1a, p: [4, 0, 0, 0] });

/** Coconut palms at placements [{x, y, z, s, rot, lean}]. */
export function palms(places, r, { night = false, nuts = true } = {}) {
  const g = new THREE.Group();
  const byVar = [[], [], []];
  places.forEach((p) => byVar[p.variant ?? r.int(0, 2)].push(p));
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  byVar.forEach((list, v) => {
    if (!list.length) return;
    const trunk = palmParts(v);
    const top = trunk.userData.top;
    const tm = new THREE.InstancedMesh(trunk, barkPalm(), list.length);
    const cm = new THREE.InstancedMesh(palmCrown(), frondM(night), list.length);
    const nm = nuts ? new THREE.InstancedMesh(nutCluster(), nutM(), list.length) : null;
    list.forEach((p, i) => {
      e.set(p.tiltX ?? r.range(-0.08, 0.08), p.rot ?? r.range(0, Math.PI * 2), p.tiltZ ?? r.range(-0.08, 0.08));
      q.setFromEuler(e);
      const s = p.s ?? r.range(0.8, 1.2);
      m4.compose(new THREE.Vector3(p.x, p.y, p.z), q, new THREE.Vector3(s, s, s));
      tm.setMatrixAt(i, m4);
      const tpos = top.clone().applyQuaternion(q).multiplyScalar(s).add(new THREE.Vector3(p.x, p.y, p.z));
      const q2 = q.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r.range(0, 6), 0)));
      m4.compose(tpos, q2, new THREE.Vector3(s, s, s));
      cm.setMatrixAt(i, m4);
      if (nm) nm.setMatrixAt(i, m4);
    });
    tm.castShadow = cm.castShadow = true;
    g.add(tm, cm);
    if (nm) g.add(nm);
  });
  return g;
}

// ---------------------------------------------------------------- broadleaf trees

function leafCard(size) {
  return cached(`leafcard-${size}`, () => {
    const g = new THREE.PlaneGeometry(size * 0.55, size, 1, 2);
    g.translate(0, size / 2, 0);
    return g;
  });
}

/**
 * Broadleaf trees: trunks + crowns of many leaf cards.
 * kind: 'mango' | 'breadfruit' | 'rain' (tall rainforest giant) | 'papaya' | 'bush'
 */
export function broadleaf(places, r, { kind = 'mango', night = false, quality = 'high', leafColor, leafColor2, fruitless = false } = {}) {
  const g = new THREE.Group();
  const spec = {
    mango: { h: [3, 4.5], crown: [2.6, 2.0], leaves: 260, leaf: 0.32, c1: 0x2a5a1c, c2: 0x3a7a28, trunkR: 0.22 },
    breadfruit: { h: [4, 6], crown: [3.2, 2.6], leaves: 180, leaf: 0.7, c1: 0x2f6a24, c2: 0x4a8a30, trunkR: 0.28 },
    rain: { h: [9, 16], crown: [6.5, 3.6], leaves: 700, leaf: 0.75, c1: 0x173f16, c2: 0x2a6022, trunkR: 0.5 },
    canopy: { h: [0, 0], crown: [7, 1.4], leaves: 260, leaf: 0.9, c1: 0x143a14, c2: 0x245a1e, trunkR: 0 },
    papaya: { h: [2.6, 3.2], crown: [1.2, 0.7], leaves: 18, leaf: 1.0, c1: 0x3a7a2a, c2: 0x5a9a3a, trunkR: 0.1 },
    bush: { h: [0, 0], crown: [1.4, 1.0], leaves: 90, leaf: 0.28, c1: 0x24521c, c2: 0x3a6a26, trunkR: 0 },
    conifer: { h: [6, 10], crown: [1.6, 4], leaves: 0, leaf: 0, c1: 0x173a22, c2: 0x21502e, trunkR: 0.25 },
  }[kind];
  // Low: opaque lumpy crowns instead of leaf cards. Layers of alpha-tested
  // leaves are what a CPU rasteriser chokes on (4 fps -> playable).
  const clumps = quality === 'low' && kind !== 'papaya' && kind !== 'conifer';
  const nLeaves = clumps ? 0 : spec.leaves;
  const blobs = [];
  const trunks = [];
  const leaves = [];
  const fruit = [];
  for (const p of places) {
    const s = p.s ?? r.range(0.8, 1.25);
    const h = r.range(spec.h[0], spec.h[1]) * s;
    if (spec.trunkR) trunks.push({ ...p, h, s });
    const cx = p.x;
    const cy = p.y + h;
    const cz = p.z;
    if (kind === 'conifer') continue;
    if (clumps) {
      const k = { rain: 5, canopy: 4, mango: 3, breadfruit: 3, bush: 2 }[kind] || 3;
      for (let i = 0; i < k; i++) {
        const th = r() * Math.PI * 2;
        const rr = i === 0 ? 0 : r.range(0.35, 0.6);
        blobs.push({ x: cx + Math.cos(th) * spec.crown[0] * s * rr, y: cy + r.range(-0.2, 0.25) * spec.crown[1] * s, z: cz + Math.sin(th) * spec.crown[0] * s * rr,
          sx: spec.crown[0] * s * r.range(0.5, 0.7), sy: spec.crown[1] * s * r.range(0.55, 0.75), ry: th });
      }
    }
    for (let i = 0; i < nLeaves; i++) {
      // points in an ellipsoid shell, biased outward
      const u = r();
      const v = r();
      const th = u * Math.PI * 2;
      const ph = Math.acos(2 * v - 1) * (kind === 'papaya' ? 0.45 : 1);
      const rr = Math.cbrt(r.range(0.55, 1));
      const x = Math.sin(ph) * Math.cos(th) * spec.crown[0] * s * rr;
      const y = Math.cos(ph) * spec.crown[1] * s * rr * (kind === 'papaya' ? 0.6 : 1);
      const z = Math.sin(ph) * Math.sin(th) * spec.crown[0] * s * rr;
      leaves.push({ x: cx + x, y: cy + y, z: cz + z, ry: th, rx: r.range(-1.2, 1.2), s: r.range(0.7, 1.3) });
      if (!fruitless && (kind === 'mango' || kind === 'breadfruit' || kind === 'papaya') && i % (kind === 'papaya' ? 2 : 18) === 0) {
        fruit.push({ x: cx + x * (kind === 'papaya' ? 0.2 : 0.95), y: cy + y * 0.9 - (kind === 'papaya' ? 0.5 : 0), z: cz + z * (kind === 'papaya' ? 0.2 : 0.95) });
      }
    }
  }
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  if (trunks.length) {
    const tg = cached(`trunk-${kind}`, () => {
      const c = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.15, 0.4, 0.05), new THREE.Vector3(-0.1, 0.75, 0), new THREE.Vector3(0.05, 1, 0)]);
      return trunkAlong(c, spec.trunkR * 1.4, spec.trunkR * 0.55, 10, 8);
    });
    const tm = new THREE.InstancedMesh(tg, mat('bark', { c1: kind === 'rain' ? 0x5a5040 : 0x5a4432, c2: 0x2a2018, p: [4, 3, 0, 0] }), trunks.length);
    trunks.forEach((t, i) => {
      e.set(0, r.range(0, 6), 0);
      q.setFromEuler(e);
      m4.compose(new THREE.Vector3(t.x, t.y, t.z), q, new THREE.Vector3(t.s, t.h, t.s));
      tm.setMatrixAt(i, m4);
    });
    tm.castShadow = true;
    g.add(tm);
    if (kind === 'conifer') {
      const cone = cached('conifer-tiers', () => {
        const parts = [];
        for (let k = 0; k < 5; k++) { const c = new THREE.ConeGeometry(1.8 - k * 0.3, 2.2, 10, 1); c.translate(0, 2.2 + k * 1.3, 0); parts.push(c); }
        return merge(parts);
      });
      const cm = new THREE.InstancedMesh(cone, mat('stone', { c1: 0x1a4226, c2: 0x0e2616, c3: 0x2a5a30, p: [2.4, 0, 0.4, 0], sway: 0.25 }), trunks.length);
      trunks.forEach((t, i) => { m4.compose(new THREE.Vector3(t.x, t.y, t.z), new THREE.Quaternion(), new THREE.Vector3(t.s, t.h / 8, t.s)); cm.setMatrixAt(i, m4); });
      cm.castShadow = true;
      g.add(cm);
    }
  }
  if (leaves.length) {
    const lm = new THREE.InstancedMesh(leafCard(spec.leaf), mat('leaf', {
      c1: leafColor ?? (night ? 0x0f2414 : spec.c1), c2: leafColor2 ?? (night ? 0x183a1c : spec.c2), c3: 0x8ab860,
      p: [kind === 'breadfruit' ? 0.95 : 0.8, kind === 'breadfruit' ? 1 : 0.1, 0.05, 0], side: THREE.DoubleSide, alphaTest: 0.5, sway: 0.6,
    }), leaves.length);
    leaves.forEach((l, i) => {
      e.set(l.rx, l.ry, r.range(-0.5, 0.5));
      q.setFromEuler(e);
      m4.compose(new THREE.Vector3(l.x, l.y, l.z), q, new THREE.Vector3(l.s, l.s, l.s));
      lm.setMatrixAt(i, m4);
    });
    lm.castShadow = true;
    g.add(lm);
  }
  if (blobs.length) {
    const geo = cached('crown-blob', () => {
      const b = new THREE.IcosahedronGeometry(1, 1);
      const pa = b.attributes.position;
      for (let i = 0; i < pa.count; i++) {
        const k = 1 + 0.18 * Math.sin(pa.getX(i) * 5.1 + pa.getZ(i) * 3.7) * Math.cos(pa.getY(i) * 4.3);
        pa.setXYZ(i, pa.getX(i) * k, pa.getY(i) * k, pa.getZ(i) * k);
      }
      b.computeVertexNormals();
      return b;
    });
    const bm = new THREE.InstancedMesh(geo, mat('stone', {
      c1: leafColor2 ?? (night ? 0x183a1c : spec.c2), c2: leafColor ?? (night ? 0x0f2414 : spec.c1), c3: 0x3a6a2a, p: [3.2, 0.2, 0.3, 0], sway: 0.2,
    }), blobs.length);
    blobs.forEach((b, i) => {
      e.set(0, b.ry, 0);
      q.setFromEuler(e);
      m4.compose(new THREE.Vector3(b.x, b.y, b.z), q, new THREE.Vector3(b.sx, b.sy, b.sx));
      bm.setMatrixAt(i, m4);
    });
    g.add(bm);
  }
  if (fruit.length) {
    const fcol = { mango: 0xff7a2a, breadfruit: 0x9ab83a, papaya: 0xff9a30 }[kind];
    const fm = new THREE.InstancedMesh(cached('fruit', () => new THREE.SphereGeometry(0.11, 8, 6)), mat('cloth', { c1: fcol, c2: 0x6a8a2a, p: [5, 0, 0, 0] }), fruit.length);
    fruit.forEach((f, i) => { m4.compose(new THREE.Vector3(f.x, f.y, f.z), q.identity(), new THREE.Vector3(1, kind === 'papaya' ? 1.6 : 1.2, 1)); fm.setMatrixAt(i, m4); });
    g.add(fm);
  }
  return g;
}

// ---------------------------------------------------------------- ground cover

/** Generic instanced rosette/blade plants. */
function rosette(key, n, len, width, droop, twist = 0.2) {
  return cached(key, () => {
    const parts = [];
    for (let i = 0; i < n; i++) {
      const b = blade(len * (0.8 + (i % 3) * 0.15), width, droop, 6, twist);
      b.rotateX(-0.9 - (i % 2) * 0.3);
      b.rotateY((i / n) * Math.PI * 2);
      parts.push(b);
    }
    return merge(parts);
  });
}

export function groundCover(kind, places, r, { night = false } = {}) {
  const defs = {
    fern: { geo: () => rosette('fern', 9, 1.1, 0.5, 0.7, 0.1), m: () => mat('leaf', { c1: night ? 0x143218 : 0x2e6a26, c2: night ? 0x1c3e1e : 0x4a8a30, c3: 0x8ac060, p: [0.95, 1.0, 0.06, 0], side: THREE.DoubleSide, alphaTest: 0.5, sway: 0.8 }) },
    grass: { geo: () => rosette('grass', 7, 0.55, 0.07, 0.25, 0.5), m: () => mat('leaf', { c1: night ? 0x1a3018 : 0x5a8a30, c2: night ? 0x223a1c : 0x8aa840, c3: 0xb0c870, p: [0.9, 0, 0.05, 0], side: THREE.DoubleSide, alphaTest: 0.4, sway: 1.4 }) },
    pineapple: { geo: () => rosette('pineapple', 14, 0.8, 0.1, 0.2, 0.1), m: () => mat('leaf', { c1: 0x4a6a3a, c2: 0x6a8a4a, c3: 0xa05a4a, p: [0.9, 0, 0.02, 0], side: THREE.DoubleSide, alphaTest: 0.4, sway: 0.3 }) },
    sedge: { geo: () => rosette('sedge', 10, 1.3, 0.05, 0.1, 0.6), m: () => mat('leaf', { c1: 0x6a7a3a, c2: 0x8a8a4a, c3: 0xa0a060, p: [0.9, 0, 0.04, 0], side: THREE.DoubleSide, alphaTest: 0.4, sway: 1.1 }) },
    cane: { geo: () => cached('cane', () => { const parts = []; for (let i = 0; i < 5; i++) { const c = new THREE.CylinderGeometry(0.025, 0.03, 3.2, 5); c.translate((i - 2) * 0.12, 1.6, (i % 2) * 0.1); parts.push(c); const b = blade(1.2, 0.08, 0.6, 5, 0.3); b.rotateX(-0.6); b.rotateY(i * 1.3); b.translate((i - 2) * 0.12, 2.6 + (i % 3) * 0.3, 0); parts.push(b); } return merge(parts); }), m: () => mat('leaf', { c1: 0x7a9a4a, c2: 0x9ab85a, c3: 0xc0c080, p: [1.0, 0, 0.04, 0], side: THREE.DoubleSide, alphaTest: 0.3, sway: 0.6 }) },
  };
  const d = defs[kind];
  const im = new THREE.InstancedMesh(d.geo(), d.m(), places.length);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  places.forEach((p, i) => {
    q.setFromEuler(new THREE.Euler(0, r.range(0, 6.28), 0));
    const s = p.s ?? r.range(0.7, 1.3);
    m4.compose(new THREE.Vector3(p.x, p.y, p.z), q, new THREE.Vector3(s, s, s));
    im.setMatrixAt(i, m4);
  });
  im.castShadow = kind !== 'grass';
  im.receiveShadow = true;
  if (kind === 'pineapple') {
    const g = new THREE.Group();
    g.add(im);
    const fm = new THREE.InstancedMesh(cached('pinefruit', () => new THREE.SphereGeometry(0.12, 8, 6)), mat('tile', { c1: 0xc08a2a, c2: 0x9a6a1a, c3: 0xd8a030, p: [0.05, 0.08, 0.5, 0] }), places.length);
    places.forEach((p, i) => { m4.compose(new THREE.Vector3(p.x, p.y + 0.35, p.z), q.identity(), new THREE.Vector3(1, 1.5, 1)); fm.setMatrixAt(i, m4); });
    g.add(fm);
    return g;
  }
  return im;
}

/** Kiwi vines on posts and wires, in rows. */
export function kiwiRows(x0, z0, rows, len, r, { night = false } = {}) {
  const g = new THREE.Group();
  const wood = mat('wood', { c1: 0x6a5238, c2: 0x3a2a1a, p: [6, 0, 0, 0] });
  const leaves = [];
  for (let i = 0; i < rows; i++) {
    const x = x0 + i * 3;
    for (let k = 0; k <= len; k += 3) {
      const post = new THREE.Mesh(cached('kpost', () => new THREE.CylinderGeometry(0.05, 0.06, 1.9, 6)), wood);
      post.position.set(x, 0.95, z0 - k);
      g.add(post);
    }
    const wire = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, len), mat('metal', { c1: 0x8a8a8a, c2: 0x4a4a4a, p: [0.4, 0, 0, 0] }));
    wire.position.set(x, 1.75, z0 - len / 2);
    g.add(wire);
    for (let k = 0; k < len * 6; k++) leaves.push({ x: x + r.range(-0.5, 0.5), y: 1.3 + r.range(0, 0.7), z: z0 - r.range(0, len) });
  }
  const lm = new THREE.InstancedMesh(leafCard(0.3), mat('leaf', { c1: night ? 0x15301a : 0x3a6a26, c2: 0x5a8a36, c3: 0x8aa860, p: [0.95, 0, 0.05, 0], side: THREE.DoubleSide, alphaTest: 0.5, sway: 0.5 }), leaves.length);
  const m4 = new THREE.Matrix4();
  leaves.forEach((l, i) => { m4.compose(new THREE.Vector3(l.x, l.y, l.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(r.range(-1, 1), r.range(0, 6), 0)), new THREE.Vector3(1, 1, 1)); lm.setMatrixAt(i, m4); });
  g.add(lm);
  return g;
}

/** Flowers as small bright blooms scattered on bushes or lawns. */
export function flowers(places, r, colors = [0xff4a7a, 0xffd23a, 0xffffff, 0xff7a2a]) {
  const g = new THREE.Group();
  const byColor = new Map();
  places.forEach((p) => {
    const c = colors[r.int(0, colors.length - 1)];
    if (!byColor.has(c)) byColor.set(c, []);
    byColor.get(c).push(p);
  });
  const m4 = new THREE.Matrix4();
  for (const [c, list] of byColor) {
    const im = new THREE.InstancedMesh(cached('bloom', () => new THREE.IcosahedronGeometry(0.06, 0)), mat('glow', { c1: c, p: [0.25, 0, 0, 0] }), list.length);
    list.forEach((p, i) => { m4.makeTranslation(p.x, p.y, p.z); im.setMatrixAt(i, m4); });
    g.add(im);
  }
  return g;
}

/**
 * Scatter helper: count points in a sector/area, avoiding paths, water and
 * the camera. area(r) returns [x, z]; accept(x, z, y) filters.
 */
export function scatterPoints(count, r, area, groundAt, accept) {
  const out = [];
  let tries = 0;
  while (out.length < count && tries++ < count * 12) {
    const [x, z] = area(r);
    const y = groundAt(x, z);
    if (accept && !accept(x, z, y)) continue;
    out.push({ x, y, z });
  }
  return out;
}
