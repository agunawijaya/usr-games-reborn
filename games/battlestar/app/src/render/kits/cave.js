// Biome 5 — under the island: the sea cave and its flooded passages, the
// cathedral room, the catacombs and the Sepulcher, the supply room, the
// flooded mine with its gold veins and crystals, the volcanic steam caves,
// the goddess's throne room, the abyss and the pit.
// Geometry: a noise-displaced "cave tube" along the facing with branch
// tunnels toward the real exits; shafts are vertical tubes, and a shaft
// meets a room through a real opening cut in its floor or ceiling. What
// people built or left down here is modelled in style A (ADR-013) in
// cave-furnish.js. Unlit rooms (CANTSEE) are handled by the shared
// darkness rule in kits/index.js: black unless a light is present.

import * as THREE from 'three';
import { mat, glowMat } from '../materials.js';
import { rng, mesh, scatter } from '../geo.js';
import { particles, glowSprite, lightShafts } from '../fx.js';
import { makeWater } from '../water.js';
import { groundCover } from '../flora.js';
import { rbox as rbox0 } from '../model.js';
import * as F from '../cave-furnish.js';

// rounded boxes at two steps per edge (cheap on a CPU rasteriser)
const rbox = (w, h, d, r, m, o = {}) => rbox0(w, h, d, r, m, { seg: 2, ...o });

const ROCK = {
  lava: () => mat('stone', { c1: 0x4e463e, c2: 0x1a1714, c3: 0x2a4a2a, p: [0.8, 0.8, 0.25, 0], side: THREE.DoubleSide }),
  wet: () => mat('stone', { c1: 0x5e5850, c2: 0x2a2724, c3: 0x2e5a3a, p: [0.9, 1.0, 0.6, 0], side: THREE.DoubleSide }),
  granite: () => mat('stone', { c1: 0x7e766c, c2: 0x46403a, c3: 0x5a5a4a, p: [0.95, 0.3, 0.05, 0], side: THREE.DoubleSide }),
  pit: () => mat('stone', { c1: 0x847c70, c2: 0x3e3a34, c3: 0x4a6a34, p: [0.85, 0.25, 0.45, 0], side: THREE.DoubleSide }),
  gold: () => mat('stone', { c1: 0x4a4038, c2: 0x221c18, c3: 0x3a3a2a, p: [0.9, 0.7, 0.1, 1.0], q: [1.0, 0.72, 0.25, 0], side: THREE.DoubleSide }),
  hot: () => mat('stone', { c1: 0x6a4230, c2: 0x2a1810, c3: 0x5a3a1a, p: [0.9, 0.4, 0.1, 0.6], q: [1.0, 0.35, 0.1, 0], side: THREE.DoubleSide }),
  crystal: () => mat('stone', { c1: 0x3a3a48, c2: 0x16161e, c3: 0x3a3a5a, p: [1.1, 0.6, 0.0, 1.0], q: [0.5, 0.7, 1.0, 0], side: THREE.DoubleSide }),
  dry: () => mat('stone', { c1: 0x5e564c, c2: 0x2a2521, c3: 0x3a3a2a, p: [0.9, 0.12, 0.08, 0], side: THREE.DoubleSide }),
  tiles: () => mat('tile', { c1: 0x2a6a8a, c2: 0xc8962a, c3: 0x8a2a4a, p: [0.45, 0.04, 0.9, 0], q: [0.9, 0, 0, 0], side: THREE.DoubleSide }),
};

/** A noise-displaced vertical rock face (plane facing +Z) of w x h. */
function rockFace(w, h, seed, amp = 1) {
  const g = new THREE.PlaneGeometry(w, h, Math.ceil(w * 1.5), Math.ceil(h * 1.2));
  const p = g.attributes.position;
  const k = seed * 1.37;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i);
    const v = p.getY(i);
    p.setZ(i, amp * (Math.sin(u * 0.31 + k) * Math.cos(v * 0.27 - k) * 1.2 + Math.sin(u * 0.9 + v * 0.7 + k) * 0.45 + Math.sin(u * 2.3 - v * 1.9) * 0.15));
  }
  g.computeVertexNormals();
  return g;
}

/**
 * A deformed tube along -Z with a flattened floor (or `round`, for shafts).
 * profile(t) -> [rx, ry]. `cut(x, y, z)` (local coordinates) drops the
 * triangles whose centre it returns true for: openings into shafts and
 * side passages.
 */
function caveTube({ length, profile, rough = 0.35, seg = 40, radial = 28, material, seed = 1, start = 6, cut, round = false, shift }) {
  const pos = [];
  const uv = [];
  const idx = [];
  const n3 = (x, y, z) => Math.sin(x * 1.3 + seed) * Math.cos(y * 1.1 + z * 0.9) + 0.5 * Math.sin(x * 3.1 - z * 2.7 + y * 1.9 + seed * 2)
    + 0.3 * Math.sin(x * 6.3 + z * 5.1 - seed) * Math.cos(y * 5.9 - z * 3.7);
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const z = start - t * length;
    const [rx, ry] = profile(t);
    const [ox, oy] = shift ? shift(t) : [0, 0];
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      let x = Math.cos(a) * rx;
      let y = Math.sin(a) * ry;
      const d = 1 + n3(x, y, z) * rough * 0.25;
      x *= d;
      y *= d;
      if (round) { pos.push(x + ox, y + oy, z); } else {
        if (y < -ry * 0.55) y = -ry * 0.55 + (y + ry * 0.55) * 0.08; // flat-ish floor
        pos.push(x, y + ry * 0.55, z);
      }
      uv.push(j / radial, t);
    }
  }
  const P = (k) => [pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]];
  const keep = (a, b, c) => {
    if (!cut) return true;
    const A = P(a); const B = P(b); const C = P(c);
    return !cut((A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3, (A[2] + B[2] + C[2]) / 3);
  };
  for (let i = 0; i < seg; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j;
    const b = a + radial + 1;
    if (keep(a, a + 1, b)) idx.push(a, a + 1, b);
    if (keep(b, a + 1, b + 1)) idx.push(b, a + 1, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, material);
  m.receiveShadow = true;
  m.userData.ring = { seg, radial, length, start };
  return m;
}

/** |x| of a (horizontal) tube's wall on one side at height y, near z: read off its own vertices. */
function wallXAt(tube, z, y, side) {
  const p = tube.geometry.attributes.position;
  const { seg, radial, length, start } = tube.userData.ring;
  const i = Math.max(0, Math.min(seg, Math.round(((start - z) / length) * seg)));
  let best = Infinity;
  let bx = 0;
  for (let j = 0; j <= radial; j++) {
    const k = i * (radial + 1) + j;
    const x = p.getX(k);
    if (x * side <= 0) continue;
    const d = Math.abs(p.getY(k) - y);
    if (d < best) { best = d; bx = Math.abs(x); }
  }
  return bx;
}

/** Radius of a vertical shaft's wall at height y in the direction ang (world, from its axis). */
function shaftRAt(shaft, y, ang) {
  const p = shaft.geometry.attributes.position;
  const { seg, radial, length } = shaft.userData.ring;
  const i = Math.max(0, Math.min(seg, Math.round(((y - shaft.position.y) / length) * seg)));
  let best = Infinity;
  let br = 0;
  for (let j = 0; j <= radial; j++) {
    const k = i * (radial + 1) + j;
    const x = p.getX(k); const yl = p.getY(k);
    const d = Math.abs(Math.atan2(Math.sin(Math.atan2(yl, x) - ang), Math.cos(Math.atan2(yl, x) - ang)));
    if (d < best) { best = d; br = Math.hypot(x, yl); }
  }
  return br;
}

/** A vertical round shaft around (cx, cz) from y0 up to y1; rAt(y) its radius; cut in world coordinates. */
function vShaft({ cx = 0, cz = 0, y0, y1, rAt, material, seed = 1, cut, radial = 32, rough = 0.4, lean }) {
  const H = y1 - y0;
  const m = caveTube({ length: H, start: 0, seg: Math.max(10, Math.ceil(H / 0.45)), radial, material, seed, rough, round: true,
    profile: (t) => { const r = rAt(y0 + t * H); return [r, r]; },
    shift: lean ? (t) => lean(y0 + t * H) : undefined,
    cut: cut ? (x, y, z) => cut(x + cx, y0 - z, y + cz) : undefined });
  // the tube runs along local -z; tipped up it runs along +y
  m.rotation.x = Math.PI / 2;
  m.position.set(cx, y0, cz);
  return m;
}

/** Lowest ceiling point of a tube within r of (x, z) (for fitting a shaft to an opening). */
function ceilingAt(tube, x, z, r, above = 1.5) {
  const p = tube.geometry.attributes.position;
  let lo = Infinity;
  for (let i = 0; i < p.count; i++) {
    const dx = p.getX(i) - x; const dz = p.getZ(i) - z;
    if (dx * dx + dz * dz < r * r && p.getY(i) > above) lo = Math.min(lo, p.getY(i));
  }
  return lo === Infinity ? 3 : lo;
}

/** A rough flat floor disc (for shafts), radius r. */
function floorDisc(r, material, seed) {
  const g = new THREE.CircleGeometry(r, 40, 0, Math.PI * 2);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i); const z = p.getZ(i);
    p.setY(i, 0.04 * Math.sin(x * 2.1 + seed) * Math.cos(z * 1.7) + 0.02 * Math.sin(x * 5.3 - z * 4.1));
  }
  g.computeVertexNormals();
  return mesh(g, material, { shadow: false });
}

/** A rock dome closing a tube's end (rx, ry at the end, floor at 0). */
function endCap(rx, ry, z, material, seed) {
  const g = new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i) * rx * 1.18; let y = p.getY(i) * ry * 1.18; const zz = p.getZ(i) * 2.2;
    const k = 1 + 0.12 * Math.sin(x * 1.3 + seed) * Math.cos(y * 1.7 - zz) + 0.05 * Math.sin(x * 4 + y * 3);
    x *= k; y *= k;
    if (y + ry * 0.55 < 0) y = -ry * 0.55 + (y + ry * 0.55) * 0.05;
    p.setXYZ(i, x, y + ry * 0.55, zz);
  }
  g.computeVertexNormals();
  return mesh(g, material, { pos: [0, 0, z + 0.4], shadow: false });
}

const PLACES = {
  'sea-cave': { len: 26, r: [3.2, 3.0], rock: 'wet', water: 0.1, entrance: true, drips: true, boulders: true },
  'low-passage': { len: 24, r: [2.2, 1.6], rock: 'wet', water: 0.35, surge: true, seaweed: true },
  squeeze: { len: 16, r: [1.0, 1.8], rock: 'lava', seaweed: true },
  cathedral: { len: 30, r: [9, 16], rock: 'wet', vault: true, drips: true },
  'round-tunnel': { len: 26, r: [1.6, 1.6], rock: 'lava', smooth: true, water: 0.08, climb: true },
  // "at the bottom of a tall narrow shaft … A staircase hewn from solid rock and black lava leads up."
  anteroom: { len: 10, r: [3, 6], rock: 'lava', vroom: { r: 2.6, top: 34, dry: true }, spiral: true, puddles: true },
  'blind-pool': { len: 18, r: [5, 3.2], rock: 'wet', pool: true, shrimp: true, drips: true },
  'sloping-passage': { len: 22, r: [3.6, 3.4], rock: 'wet', algae: true, shaft: true, minerals: true },
  // "A stone staircase leads down."
  'tiled-room': { len: 14, r: [5, 4], rock: 'tiles', tiles: true, stairsDown: true },
  'mussel-end': { len: 9, r: [2.2, 2.2], rock: 'wet', mussels: true },
  crawl: { len: 16, r: [1.5, 0.75], rock: 'granite' },
  'crawl-granite': { len: 16, r: [1.4, 0.8], rock: 'granite' },
  'supply-room': { len: 10, r: [4, 3], rock: 'granite', supplies: true },
  // "Below is a wet, seaweed covered floor. Above is a way out."
  'catacomb-entrance': { len: 12, r: [2.4, 3.4], rock: 'wet', seaweed: true, wayOut: true },
  catacombs: { len: 22, r: [4, 3.4], rock: 'granite', tombs: true },
  sepulcher: { len: 12, r: [5, 4.5], rock: 'granite', sepulcher: true },
  // "the top of a flooded shaft … A ladder goes down into water here."
  'shaft-top': { len: 12, r: [2.4, 2.8], rock: 'granite', shaftDown: true },
  // "a narrow platform … either up or down this rickety wooden ladder"
  ladder: { len: 6, r: [2, 5], rock: 'lava', vroom: { r: 2.5, bottom: -16, top: 18, noFloor: true, dry: true }, platform: true },
  'mine-flooded': { len: 22, r: [3, 2.8], rock: 'gold', water: 0.18, timbers: true, ladderUp: true },
  'mine-blocked': { len: 10, r: [2.6, 2.6], rock: 'gold', rubble: true, timbers: true, rails: true },
  'mine-crystals': { len: 16, r: [2.8, 3.6], rock: 'crystal', water: 0.9, crystals: 30 },
  'mine-vein': { len: 14, r: [3.2, 3.2], rock: 'gold', crystals: 18, timbers: true, rails: true, cart: true },
  'steam-cave': { len: 22, r: [3.4, 3.6], rock: 'hot', steam: true },
  'steam-door': { len: 14, r: [3, 3.4], rock: 'hot', steam: true, sign: true, stoneDoor: true },
  throne: { len: 18, r: [7, 5.5], rock: 'hot', throne: true, nests: true },
  abyss: { len: 26, r: [3.4, 4], rock: 'hot', abyss: true, steam: true },
  'abyss-shelf': { len: 22, r: [5, 4.5], rock: 'hot', abyss: true, steam: true },
  'crystal-tunnel': { len: 22, r: [3.2, 3.4], rock: 'crystal', crystals: 40 },
  'hot-tunnel': { len: 20, r: [2.6, 2.8], rock: 'hot', steam: true },
  // "I can see daylight far up at the mouth of the pit."
  pit: { len: 8, r: [4, 3], rock: 'pit', vroom: { r: 4.4, top: 40, narrow: 2.4, lean: 15 }, pit: true },
};

function runeSign(text, stone = false) {
  const c = document.createElement('canvas');
  c.width = stone ? 1024 : 512;
  c.height = stone ? 200 : 160;
  const ctx = c.getContext('2d');
  ctx.fillStyle = stone ? '#8a8272' : '#6a4a2a';
  ctx.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 40; i++) {
    ctx.strokeStyle = stone ? `rgba(60,56,48,${0.06 + (i % 5) * 0.02})` : `rgba(40,24,10,${0.15 + (i % 5) * 0.05})`;
    ctx.beginPath(); ctx.moveTo(0, i * 5 + (i % 3)); ctx.lineTo(c.width, i * 5 + 2); ctx.stroke();
  }
  ctx.font = stone ? 'italic 600 62px "Cormorant Garamond", Georgia, serif' : 'italic 600 54px "Cormorant Garamond", Georgia, serif';
  ctx.textAlign = 'center';
  if (stone) {
    // incised: a light lower edge under a dark cut
    ctx.fillStyle = 'rgba(220,210,190,0.55)';
    ctx.fillText(text, 513, 124);
    ctx.fillStyle = '#2a2620';
    ctx.fillText(text, 512, 121);
  } else {
    ctx.fillStyle = '#1e1208';
    ctx.fillText(text, 256, 100);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildCave(spec, ctx) {
  const r = rng(spec.seed);
  const P = PLACES[spec.place] || PLACES['steam-cave'];
  const group = new THREE.Group();
  const ticks = [];
  const points = [];
  const night = spec.night;
  const rockMat = ROCK[P.rock]();
  const len = P.len;
  const [RX, RY] = P.r;
  const ex = spec.exits;
  const V = P.vroom;
  const low = ctx.quality === 'low';
  const lantern = !!(spec.light.lanternHeld || spec.light.lantern);
  // cross-section of the main tube at z (matches its profile below)
  const ext = ex.ahead ? 14 : 0;
  const sectionAt = (z) => {
    const tt = (6 - z) / len;
    const bulge = Math.sin(Math.min(1, Math.max(0, tt)) * Math.PI);
    const k = tt > 1 ? Math.max(0.35, 1 - (tt - 1) * 1.5) : 0.55 + 0.45 * bulge;
    return [RX * k + 0.6, RY * k + 0.4];
  };

  // ---- openings: side passages, and shafts through the floor or ceiling
  const sideZ = -len * 0.35;
  const holes = [];
  if (P.shaftDown) holes.push({ floor: true, rect: [0, -0.9, 1.22, 1.22] });
  if (P.ladderUp) holes.push({ ceil: true, x: -1.2, z: -0.4, r: 0.9 });
  if (P.wayOut) holes.push({ ceil: true, x: 0.6, z: -1.2, r: 1.05 });
  if (P.stairsDown) holes.push({ floor: true, rect: [1.5, -1.5, 0.78, 1.8] });
  const inHole = (h, x, z) => (h.rect ? Math.abs(x - h.rect[0]) < h.rect[2] && Math.abs(z - h.rect[1]) < h.rect[3] : (x - h.x) ** 2 + (z - h.z) ** 2 < h.r * h.r);
  const sides = ['left', 'right'].filter((s) => ex[s]);
  const mainCut = (x, y, z) => {
    for (const h of holes) if (inHole(h, x, z) && (h.floor ? y < 0.8 : y > 1.6)) return true;
    // side passages open the wall
    for (const s of sides) if ((s === 'left' ? x < 0 : x > 0) && y > 0.3 && ((z - sideZ) / 1.28) ** 2 + ((y - 0.99) / 1.46) ** 2 < 1 && Math.abs(x) > sectionAt(z)[0] * 0.45) return true;
    return false;
  };

  let main = null;
  if (!V && !P.abyss) {
    const L = len + ext;
    main = caveTube({
      length: L, seed: spec.seed % 97, material: rockMat, rough: P.smooth ? 0.08 : P.tiles ? 0.05 : 0.4,
      seg: Math.ceil(L / (holes.length ? 0.3 : 0.45)), radial: holes.length ? 48 : 36, cut: mainCut,
      profile: (t) => sectionAt(6 - t * L),
    });
    group.add(main);
    if (!ex.ahead) {
      const [ex0, ey0] = sectionAt(6 - len);
      group.add(endCap(ex0, ey0, 6 - len, rockMat, spec.seed % 13));
    }
    // branches toward left/right exits; the stub inside the room is cut away
    for (const side of sides) {
      const sg = side === 'left' ? -1 : 1;
      const [sx] = sectionAt(sideZ);
      const b = caveTube({ length: 14, seed: spec.seed % 53 + (side === 'left' ? 1 : 2), material: rockMat, rough: 0.35, start: 0, profile: () => [1.6, 1.8],
        // local -z runs out through the wall; drop what is still inside the room
        cut: (x, y, z) => sx * 0.3 - z < wallXAt(main, sideZ + sg * x, y, sg) * 0.97 });
      b.rotation.y = -sg * Math.PI / 2;
      b.position.set(sg * sx * 0.3, 0, sideZ);
      group.add(b);
    }
  }

  // ---- vertical rooms: the anteroom's shaft, the ladder shaft, the pit
  if (V) {
    const R = V.r;
    const top = V.top;
    const bottom = V.bottom ?? -0.3;
    const rAt = (y) => (V.narrow ? R + (V.narrow - R) * Math.min(1, Math.max(0, y / top)) ** 1.5 : R * (1 - 0.06 * Math.max(0, y) / top));
    const lean = V.lean ? (y) => [0, -V.lean * Math.max(0, y / top) ** 1.3] : undefined;
    const dirs = { ahead: [0, -1], left: [-1, 0], right: [1, 0] };
    const outs = Object.keys(dirs).filter((d) => ex[d]);
    const shaftCut = (x, y, z) => {
      if (y < 0.3) return false;
      const a = Math.atan2(z, x);
      return outs.some((d) => { const [dx, dz] = dirs[d]; const da = Math.abs(Math.atan2(Math.sin(a - Math.atan2(dz, dx)), Math.cos(a - Math.atan2(dz, dx)))); return ((da * R) / 1.28) ** 2 + ((y - 0.99) / 1.46) ** 2 < 1; });
    };
    const shaft = vShaft({ y0: bottom, y1: top, rAt, lean, material: V.dry ? ROCK.dry() : rockMat, seed: spec.seed % 89, rough: P.spiral ? 0.25 : 0.4, cut: shaftCut, radial: 44 });
    group.add(shaft);
    if (!V.noFloor) group.add(floorDisc(R + 0.6, P.pit ? mat('stone', { c1: 0x5a544c, c2: 0x2a2624, c3: 0x3a4a2a, p: [0.9, 0.5, 0.3, 0] }) : mat('stone', { c1: 0x3a3632, c2: 0x161412, p: [0.9, 0.6, 0, 0] }), spec.seed % 7));
    for (const d of outs) {
      const [dx, dz] = dirs[d];
      const th = Math.atan2(-dx, -dz);
      const b = caveTube({ length: 14, seed: spec.seed % 53 + outs.indexOf(d), material: rockMat, rough: 0.35, start: 0, profile: () => [1.6, 1.8],
        cut: (x, y, z) => {
          const wx = x * Math.cos(th) + z * Math.sin(th);
          const wz = -x * Math.sin(th) + z * Math.cos(th);
          return Math.hypot(wx, wz) < shaftRAt(shaft, y, Math.atan2(wz, wx)) * 0.97;
        } });
      b.rotation.y = th;
      group.add(b);
    }
  }
  const floorY = 0;

  // ---- water, drips, weed
  if (P.water !== undefined) {
    const w = makeWater({ size: 60, res: 40, level: floorY + P.water, quality: ctx.quality, depthAt: () => 1.5, calm: P.surge ? 0.35 : 0.05, scale: 0.25, foam: P.surge ? 1 : 0.2,
      deep: 0x020a0c, shallow: 0x0e2a2e, offset: [0, 0, -20],
      // lantern light glinting on black water
      glow: lantern ? 0.45 : 0, glowCol: 0xffa050, glowNear: 0.6 });
    group.add(w);
    ticks.push(w.userData.tick);
    // underground the water mirrors lantern-lit rock: a dim warm sheen at grazing angles
    const lit = !spec.light.cantsee || lantern;
    w.userData.setSky({ sun: new THREE.Vector3(0.1, 0.22, -1), sunCol: lit ? 0xc08040 : 0x000000, top: 0x050403, horizon: lit ? 0x24160c : 0x000000, night: true });
  }
  if (P.drips || P.shrimp) {
    const d = particles('drips', 50, { quality: ctx.quality, seed: 3, pos: [0, RY * 1.4, -len * 0.4], spread: [RX * 1.5, 0.3, len * 0.8] });
    group.add(d);
    ticks.push(d.userData.tick);
  }
  if (P.seaweed || P.algae) {
    const kelp = [];
    for (let i = 0; i < 60; i++) kelp.push({ x: r.range(-RX * 0.8, RX * 0.8), y: floorY, z: r.range(-len * 0.8, 2) });
    group.add(groundCover('sedge', kelp, r, { night: true }));
  }
  if (P.boulders) {
    // wet boulders at the tide line, and a bleached drift log the sea pushed in
    const bm = mat('stone', { c1: 0x5a544c, c2: 0x24201c, c3: 0x2e5a3a, p: [0.9, 1.0, 0.7, 0] });
    for (let i = 0; i < 9; i++) {
      const s = r.range(0.25, 0.75);
      const x = (i % 2 ? 1 : -1) * r.range(1.8, RX * 0.95);
      group.add(mesh(F.rockGeo(i + spec.seed, 1, 0.3), bm, { pos: [x, s * 0.3, r.range(-len * 0.7, -1.5)], scale: [s * 1.2, s, s], rot: [0, r.range(0, 3), 0] }));
    }
    const drift = F.log(3.2, 0.2, 5);
    drift.position.set(-1.6, 0.16, -3.5);
    drift.rotation.y = 0.5;
    group.add(drift);
  }
  if (P.vault) {
    // "cannot pierce the engulfing darkness overhead": flowstone columns, stalactites and stalagmites
    const cm = mat('stone', { c1: 0x5a524a, c2: 0x221e1a, c3: 0x2a3a2a, p: [0.9, 0.9, 0.2, 0], q: [0.9, 0.85, 0.7, 0] });
    for (let i = 0; i < 8; i++) {
      const x = (i % 2 ? 1 : -1) * r.range(5, 7.5);
      group.add(mesh(F.flowstoneColumn(30, r.range(0.9, 1.4), i), cm, { pos: [x, -0.3, -2 - i * 3.2], rot: [0, r.range(0, 6), 0], shadow: false }));
    }
    for (let i = 0; i < 14; i++) {
      const h = r.range(0.4, 2.2);
      const sm = mesh(F.spire(1, 1, i % 5), cm, { pos: [r.range(-6.5, 6.5), -0.05, r.range(-len * 0.8, -1)], shadow: false });
      sm.scale.set(h * 0.3, h, h * 0.3);
      sm.rotation.y = r.range(0, 6);
      group.add(sm);
    }
    for (let i = 0; i < 18; i++) {
      const h = r.range(1, 4);
      const st = mesh(F.spire(1, 1, i % 5, true), cm, { pos: [r.range(-7, 7), r.range(14, 20), r.range(-len * 0.8, 0)], shadow: false });
      st.scale.set(h * 0.15, h, h * 0.15);
      group.add(st);
    }
  }
  if (P.puddles || P.pool) {
    for (let i = 0; i < (P.pool ? 1 : 6); i++) {
      const pr = P.pool ? 3.5 : r.range(0.3, 0.8);
      const a = r.range(0, Math.PI * 2);
      const pp = P.pool ? [0, -8] : V ? [Math.cos(a) * r.range(0.3, 1.8), Math.sin(a) * r.range(0.3, 1.8)] : [r.range(-2, 2), r.range(-8, -1)];
      group.add(mesh(new THREE.CircleGeometry(pr, 24), new THREE.MeshStandardMaterial({ color: 0x0a1a1e, roughness: 0.02, metalness: 0.5 }), { pos: [pp[0], floorY + 0.05, pp[1]], rot: [-Math.PI / 2, 0, 0], scale: [1, 0.7, 1], shadow: false }));
    }
    if (P.shrimp) {
      const s = particles('glitter', 60, { quality: ctx.quality, seed: 9, pos: [0, floorY + 0.1, -8], spread: [5, 0.1, 5], size: 3, color: 0xffffff, color2: 0xd8f0ff, swirl: 1.5, vel: [0, 0, 0] });
      group.add(s);
      ticks.push(s.userData.tick);
    }
  }
  if (P.shaft) {
    const shafts = lightShafts(night ? 0x8aa0d8 : 0xfff2d0, { count: 3, len: 14, width: 0.9, spread: 1.2, alpha: night ? 0.02 : 0.07, seed: 4 });
    shafts.position.set(0, floorY, -len * 0.45);
    group.add(shafts);
    ticks.push(shafts.userData.tick);
  }
  if (P.minerals || P.crystals) {
    const n = P.crystals || 20;
    const gold = P.rock === 'gold';
    // solid, faceted stones seated in the rock; a faint inner glow and little
    // environment reflection, so they fade into the dark with the rock around
    // them instead of hanging in the dark like flakes
    const cm = new THREE.MeshStandardMaterial({ color: gold ? 0xa88440 : 0x8898b4, roughness: 0.12, metalness: gold ? 0.6 : 0.05, emissive: gold ? 0x3a2808 : 0x18223a, emissiveIntensity: 0.06, flatShading: true, envMapIntensity: 0.12 });
    // "blooming crystals of diamonds and topaz burst from the walls": clusters rooted in the rock
    const spots = [];
    if (main) {
      const pa = main.geometry.attributes.position;
      const idx = main.geometry.index.array;
      for (let tries = 0; spots.length < n && tries < n * 40; tries++) {
        const v = idx[Math.floor(r.range(0, idx.length))];
        const x = pa.getX(v); const y = pa.getY(v); const z = pa.getZ(v);
        // in the lower half of the walls, within the lantern's reach: not right
        // beside the camera, not far down the tunnel where only they would show
        if (y < 0.25 || y > sectionAt(z)[1] * 1.1 || z > -1.5 || z < 6 - len * 0.75) continue;
        const [, sy] = sectionAt(z);
        const inward = new THREE.Vector3(-x, sy * 0.55 - y, 0).normalize();
        spots.push({ p: new THREE.Vector3(x, y, z), n: inward });
      }
    } else {
      for (let i = 0; i < n; i++) {
        const a = r.range(0, Math.PI * 2);
        spots.push({ p: new THREE.Vector3(Math.cos(a) * RX * 0.9, RY * 0.55 + Math.sin(a) * RY * 0.9, r.range(-len * 0.8, 1)), n: new THREE.Vector3(-Math.cos(a), -Math.sin(a), 0) });
      }
    }
    const per = 4;
    const im = new THREE.InstancedMesh(F.crystalGeo(), cm, spots.length * per);
    const m4 = new THREE.Matrix4();
    const up = new THREE.Vector3(0, 1, 0);
    let k = 0;
    for (const sp of spots) {
      for (let j = 0; j < per; j++) {
        const d = sp.n.clone().add(new THREE.Vector3(r.range(-0.6, 0.6), r.range(-0.6, 0.6), r.range(-0.6, 0.6))).normalize();
        const q = new THREE.Quaternion().setFromUnitVectors(up, d);
        const L = r.range(0.18, 0.55) * (j === 0 ? 1.5 : 1);
        const w = L * r.range(1.1, 1.8);
        m4.compose(sp.p.clone().addScaledVector(sp.n, -0.06).add(new THREE.Vector3(r.range(-0.08, 0.08), r.range(-0.08, 0.08), r.range(-0.08, 0.08))), q, new THREE.Vector3(w, L, w));
        im.setMatrixAt(k++, m4);
      }
    }
    group.add(im);
    const sp = particles('glitter', 40, { quality: ctx.quality, seed: 7, pos: [0, RY * 0.6, -len * 0.4], spread: [RX * 1.6, RY, len * 0.7], size: 3 });
    group.add(sp);
    ticks.push(sp.userData.tick);
  }
  if (P.mussels) {
    group.add(scatter(new THREE.SphereGeometry(0.08, 6, 4), mat('metal', { c1: 0x101824, c2: 0x05080c, p: [0.2, 0, 0, 0] }), 220, () => {
      const a = r.range(0, Math.PI * 2);
      return { pos: [Math.cos(a) * RX * 0.92, RY * 0.55 + Math.sin(a) * RY * 0.92, r.range(-len * 0.8, 0)], scale: [1, 0.5, 1.6], rot: [0, a, 0] };
    }));
  }

  // ---- the anteroom: stairs hewn round the shaft wall, climbing out of sight
  if (P.spiral) {
    const R = V.r;
    const rise = 0.23;
    const dA = 0.25;
    const depth = 1.1;
    const shape = new THREE.Shape();
    const r0 = R - depth;
    const r1 = R + 0.5;
    const a1 = dA * 1.12;
    shape.moveTo(r0, 0);
    for (let k = 0; k <= 6; k++) shape.lineTo(Math.cos((a1 * k) / 6) * r1, Math.sin((a1 * k) / 6) * r1);
    shape.lineTo(Math.cos(a1) * r0, Math.sin(a1) * r0);
    shape.lineTo(r0, 0);
    const sg = new THREE.ExtrudeGeometry(shape, { depth: 0.26, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.035, bevelSegments: 2, curveSegments: 4 });
    sg.rotateX(Math.PI / 2);
    sg.translate(0, 0.26, 0);
    sg.computeVertexNormals();
    const n = Math.ceil((V.top - 4) / rise);
    const im = new THREE.InstancedMesh(sg, mat('stone', { c1: 0x4a4440, c2: 0x161412, c3: 0x2a2a24, p: [0.9, 0.3, 0.1, 0] }), n);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const a0 = -Math.PI / 2 - 0.5; // starts across the shaft from the viewer and climbs round the wall
    for (let i = 0; i < n; i++) {
      const topY = (i + 1) * rise;
      const k = 1 - 0.06 * topY / V.top;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -(a0 + i * dA));
      // the lowest steps are solid blocks down to the floor
      const sy = topY < 0.8 ? topY / 0.26 : 1;
      m4.compose(new THREE.Vector3(0, topY < 0.8 ? 0 : topY - 0.26, 0), q, new THREE.Vector3(k, sy, k));
      im.setMatrixAt(i, m4);
    }
    im.castShadow = false;
    im.receiveShadow = true;
    group.add(im);
  }

  // ---- the tiled room: a stone stair going down through a well in the floor
  if (P.stairsDown) {
    const [hx, hz, ax, az] = holes.find((h) => h.rect).rect;
    const st = F.CM.limestone();
    const wellM = mat('plaster', { c1: 0x6e6658, p: [0, 0, 0, 0], seed: 4, side: THREE.DoubleSide });
    const depth = 4.2;
    const well = new THREE.Group();
    // the well's side walls run on past the far end, where the stair turns into a dark passage
    for (const s of [-1, 1]) well.add(mesh(new THREE.PlaneGeometry(az * 2 + 2.2, depth), wellM, { pos: [hx + s * ax, -depth / 2, hz - 1], rot: [0, -s * Math.PI / 2, 0], shadow: false }));
    well.add(mesh(new THREE.PlaneGeometry(ax * 2 + 0.1, depth), wellM, { pos: [hx, -depth / 2, hz + az], rot: [0, Math.PI, 0], shadow: false }));
    well.add(mesh(new THREE.PlaneGeometry(ax * 2 + 0.1, 1.7), wellM, { pos: [hx, -0.85, hz - az], shadow: false }));
    well.add(rbox(ax * 2 + 0.1, 0.22, 0.3, 0.03, st, { pos: [hx, -1.9, hz - az] }));
    well.add(mesh(new THREE.PlaneGeometry(ax * 2, 2.6), glowMat(0x020201, 1), { pos: [hx, -depth + 1.3, hz - az - 2], shadow: false }));
    well.add(mesh(new THREE.PlaneGeometry(ax * 2, 2.4), wellM, { pos: [hx, -depth + 0.02, hz - az - 1], rot: [-Math.PI / 2, 0, 0], shadow: false }));
    // steps descending away from the room (toward -z), each nosed and worn
    const n = 11;
    const going = (az * 2 - 0.2) / n;
    const rise = (depth - 0.2) / (n + 1);
    for (let i = 0; i < n; i++) {
      const topY = -(i + 1) * rise;
      well.add(rbox(ax * 2 - 0.02, rise + 0.06, going + 0.05, 0.025, st, { pos: [hx, topY - rise - 0.06, hz + az - 0.1 - (i + 0.5) * going] }));
    }
    // a carved kerb round three sides of the opening, a turned post at each corner
    for (const s of [-1, 1]) well.add(rbox(0.26, 0.18, az * 2 + 0.5, 0.05, st, { pos: [hx + s * (ax + 0.12), 0, hz] }));
    well.add(rbox(ax * 2 + 0.5, 0.18, 0.26, 0.05, st, { pos: [hx, 0, hz - az - 0.12] }));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      well.add(rbox(0.3, 0.42, 0.3, 0.04, st, { pos: [hx + sx * (ax + 0.12), 0, hz + sz * (az + 0.12)] }));
      well.add(rbox(0.36, 0.06, 0.36, 0.025, st, { pos: [hx + sx * (ax + 0.12), 0.42, hz + sz * (az + 0.12)] }));
    }
    group.add(F.bake(well));
  }

  // ---- the supply room
  if (P.supplies) {
    const [sx] = sectionAt(-0.5);
    const wall = sx * 0.72;
    const rack = F.kit('toolRack', () => F.toolRack(2.6, 2));
    rack.position.set(-wall, 0, -0.6);
    rack.rotation.y = Math.PI / 2;
    group.add(rack);
    const rack2 = F.kit('toolRack2', () => F.toolRack(1.8, 5));
    rack2.position.set(-wall + 0.25, 0, -3.1);
    rack2.rotation.y = Math.PI / 2 + 0.35;
    group.add(rack2);
    // a plank shelf of hard hats over the dynamite
    const shelf = F.kit('hatShelf', () => {
      const g = new THREE.Group();
      const t = F.CM.timberDark();
      g.add(rbox(2.2, 0.05, 0.4, 0.015, t, { pos: [0, 1.3, 0] }));
      for (const s of [-1, 1]) g.add(rbox(0.06, 1.35, 0.06, 0.015, t, { pos: [s * 1.0, 0, -0.15] }));
      for (let i = 0; i < 4; i++) { const h = F.hardHat(); h.position.set(-0.8 + i * 0.52, 1.35, 0.02 * (i % 2)); h.rotation.y = i * 0.7; g.add(h); }
      return g;
    });
    shelf.position.set(wall, 0, -0.8);
    shelf.rotation.y = -Math.PI / 2;
    group.add(shelf);
    const boxes = [[wall - 0.3, 0, -0.4, 0.1, false], [wall - 0.3, 0, -1.1, -0.05, false], [wall - 0.32, 0.3, -0.75, 0.2, false], [wall - 0.9, 0, -2.2, 0.5, true], [wall - 0.4, 0, -2.6, -0.2, false]];
    for (const [x, y, z, ry, open] of boxes) {
      const b = F.kit(open ? 'dynOpen' : 'dyn', () => F.dynamiteBox(open));
      b.position.set(x, y, z);
      b.rotation.y = ry - Math.PI / 2;
      group.add(b);
    }
    // "a cartload of very high grade gold and silver ore", on a stub of track
    const track = F.kit('track5', () => F.railTrack(5));
    track.position.set(0.4, 0, 2.2);
    group.add(track);
    const cart = F.kit('oreCart', () => F.mineCart({ ore: true, seed: 3 }));
    cart.position.set(0.4, 0.09, -1.6);
    cart.rotation.y = Math.PI / 2;
    group.add(cart);
    // a pick and a shovel left leaning on the cart
    const pk = F.kit('pick', F.pickaxe);
    pk.position.set(1.05, 0, -1.1);
    pk.rotation.set(0.3, 0.4, 0.15);
    group.add(pk);
    for (let i = 0; i < 3; i++) {
      const t = F.kit(i % 2 ? 'shovel' : 'pick', i % 2 ? F.shovel : F.pickaxe);
      t.position.set(wall + 0.15, 0, -1.9 - i * 0.28);
      t.rotation.set(0, -Math.PI / 2, 0.28);
      group.add(t);
    }
    const hat = F.kit('hat', F.hardHat);
    hat.position.set(-0.9, 0, 0.6);
    hat.rotation.set(0, 1, 0.25);
    group.add(hat);
  }

  // ---- the catacombs and the Sepulcher
  if (P.tombs) {
    const [mx] = sectionAt(-4);
    const skipZ = (s, z) => (s < 0 ? ex.left : ex.right) && Math.abs(z - sideZ) < 2.3;
    const statueGold = mat('gold', { c1: 0xe8b040, c2: 0xffffff, p: [0.6, 0.35, 0, 0] });
    let k = 0;
    for (const s of [-1, 1]) {
      for (const z of low ? [1.2, -4.2, -10.5] : [1.2, -3.1, -7.6, -12]) {
        if (skipZ(s, z)) continue;
        const [sx] = sectionAt(z);
        const x = s * (sx * 0.8 - 0.75);
        const t = F.kit('sarc', () => F.sarcophagus({ w: 1.0, l: 2.2, h: 0.85 }));
        t.position.set(x, 0, z);
        group.add(t);
        // a carved niche in the wall above each tomb
        const nch = F.kit('niche', () => F.wallNiche(1.5, 0.9));
        nch.position.set(s * (sx * 0.84), 1.2, z);
        nch.rotation.y = -s * Math.PI / 2;
        group.add(nch);
        // treasure between the tombs
        const tz = z - 2.1;
        if (!skipZ(s, tz) && tz > -14) {
          const heap = F.kit(`coins${k % 2}`, () => F.coinHeap(0.6, 140, k % 2 + 1));
          heap.position.set(s * (sx * 0.8 - 0.6), 0, tz);
          group.add(heap);
          const v = F.kit(`vase${k % 3}c`, () => F.vase(k % 3, k % 3 === 0));
          v.position.set(s * (sx * 0.8 - 0.3), 0, tz - 0.55);
          group.add(v);
          const v2 = F.kit(`vase${(k + 1) % 3}`, () => F.vase((k + 1) % 3));
          v2.position.set(s * (sx * 0.8 - 0.1), 0, tz + 0.5);
          group.add(v2);
        }
        // "long spears with many blades" leaning on the wall
        if (k % 2 === 0) {
          for (let j = 0; j < 2; j++) {
            const sp = F.kit('spear', F.manyBladedSpear);
            sp.position.set(s * (sx * 0.86 - 0.1), 0, z - 1.0 + j * 0.25);
            sp.rotation.set(0, 0, s * (0.22 + j * 0.06));
            group.add(sp);
          }
        }
        // "fine swords" laid on the lids
        if (k % 2 === 1) {
          const sw = F.kit('sword', () => F.sword(true));
          sw.position.set(x, 1.09, z + 0.5);
          sw.rotation.set(-Math.PI / 2, 0, 0.3);
          group.add(sw);
        }
        k++;
      }
    }
    // "coats of mail" on stands, "golden statues" at the far end
    const ms = F.kit('mail', F.mailStand);
    ms.position.set(-(mx * 0.8 - 1.9), 0, -5.2);
    ms.rotation.y = 0.5;
    group.add(ms);
    const ms2 = F.kit('mail', F.mailStand);
    ms2.position.set(mx * 0.8 - 1.9, 0, -9.6);
    ms2.rotation.y = -0.6;
    group.add(ms2);
    for (const s of [-1, 1]) {
      const plinth = F.kit('plinth', () => {
        const g = new THREE.Group();
        const st = F.CM.limestone();
        g.add(rbox(0.9, 0.12, 0.9, 0.03, st, {}));
        g.add(rbox(0.74, 0.6, 0.74, 0.03, st, { pos: [0, 0.12, 0] }));
        g.add(rbox(0.86, 0.1, 0.86, 0.03, st, { pos: [0, 0.72, 0] }));
        return g;
      });
      const zS = -13.4;
      plinth.position.set(s * 1.6, 0, zS);
      group.add(plinth);
      const st = F.kit(`statue${s}`, () => F.statue(statueGold, s < 0
        ? { sex: 'f', pose: 'raise', height: 1.75, seed: 0.4, tweak: { shL: [-2.9, 0, -0.25], shR: [-0.2, 0, 0.3], elR: -1.2, headX: -0.1 } }
        : { sex: 'm', pose: 'guard', height: 1.85, seed: 0.7 }));
      st.position.set(s * 1.6, 0.82, zS);
      st.rotation.y = -s * 0.35;
      group.add(st);
    }
  }
  if (P.sepulcher) {
    // "A single tomb … Encrusted with diamonds and opals, and secured with straps of a very hard, untarnished silver"
    const zT = -1.6;
    const tomb = F.kit('grandTomb', () => {
      const g = F.sarcophagus({ w: 1.25, l: 2.5, h: 1.0, grand: true });
      // a stone effigy lies on the lid, hands folded
      const eff = F.statue(F.CM.marble(), {
        sex: 'f', outfit: 'ambassadors', pose: 'lie', height: 1.7, seed: 0.2,
        tweak: { shL: [-0.12, 0, -0.06], elL: -0.35, shR: [-0.12, 0, 0.06], elR: -0.35, headZ: 0, neckX: 0, thL: [0, 0], thR: [0, 0], knL: 0, knR: 0, anL: 0.5, anR: 0.5 },
      });
      eff.position.set(0, 1.13, 0.86);
      g.add(eff);
      // a stone pillow under her head
      g.add(rbox(0.46, 0.1, 0.3, 0.04, F.CM.marble(), { pos: [0, 1.12, -0.95] }));
      return g;
    });
    tomb.position.set(0, 0, zT);
    tomb.rotation.y = Math.PI / 2;
    group.add(tomb);
    // "Vases overflowing with gold coins" at the corners
    for (const [x, z, kind] of [[-2.2, zT + 1.1, 0], [2.2, zT + 1.0, 2], [-2.1, zT - 1.2, 1], [2.3, zT - 1.1, 0]]) {
      const v = F.kit(`vase${kind}c`, () => F.vase(kind, true));
      v.position.set(x, 0, z);
      v.rotation.y = x * 0.7;
      group.add(v);
    }
    // the jewels catch the lantern
    const sp = particles('glitter', 16, { quality: ctx.quality, seed: 21, pos: [0, 1.05, zT], spread: [1.4, 0.2, 0.6], size: 2.5, color: 0xffffff, color2: 0xd8ecff, alpha: 0.5 });
    group.add(sp);
    ticks.push(sp.userData.tick);
    // "A line of verse on the wall reads, 'Three he made and gave them to his daughters.'"
    const tex = runeSign('Three he made and gave them to his daughters.', true);
    const ey0 = sectionAt(6 - len)[1];
    const zW = 6 - len + 0.35;
    const tab = new THREE.Group();
    tab.add(rbox(3.7, 0.9, 0.2, 0.05, F.CM.limestone(), { center: true }));
    tab.add(mesh(new THREE.PlaneGeometry(3.4, 0.66), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }), { pos: [0, 0, 0.105], shadow: false }));
    tab.position.set(0, Math.min(2.3, ey0 * 0.9), zW);
    group.add(tab);
  }

  // ---- the tiled room's mosaic ceiling
  if (P.tiles) {
    const ceil = mesh(new THREE.PlaneGeometry(RX * 2.2, len * 1.1), mat('tile', { c1: 0xffc24a, c2: 0x2a8a6a, c3: 0x8a2aa0, p: [0.18, 0.06, 1, 0], q: [1.5, 0, 0, 0] }), { pos: [0, RY * 1.45, -len * 0.45], rot: [Math.PI / 2, 0, 0], shadow: false });
    group.add(ceil);
  }

  // ---- the top of the flooded shaft (261): a real hole, a timber collar, water a metre down
  if (P.shaftDown) {
    const zc = holes[0].rect[1];
    group.add(vShaft({ cx: 0, cz: zc, y0: -9, y1: -0.16, rAt: () => 1.85, material: rockMat, seed: 5, radial: 36, rough: 0.2 }));
    const collar = F.kit('collar12', () => F.shaftCollar(1.22, 0.42));
    collar.position.set(0, -0.04, zc);
    group.add(collar);
    const lad = F.kit('ladder61', () => F.ladder(5.4, { seed: 2 }));
    lad.position.set(0, -4.2, zc - 0.98);
    lad.rotation.x = -0.05;
    group.add(lad);
    const w = makeWater({ size: 4.4, res: 18, level: -0.85, quality: ctx.quality, depthAt: () => 4, calm: 0.25, scale: 0.4, deep: 0x03080a, shallow: 0x10262a, offset: [0, 0, zc],
      glow: lantern ? 0.9 : 0, glowCol: 0xffa050, glowNear: 1.0 });
    // it mirrors the lantern-lit timbers and rock above it
    w.userData.setSky({ sun: new THREE.Vector3(0, 0.6, 0.8), sunCol: lantern ? 0xc07a38 : 0x2a1a10, top: 0x0a0806, horizon: lantern ? 0x4a2e16 : 0x0a0806, night: true });
    group.add(w);
    // "dark water rises and falls to the rhythm of the sea"
    const baseY = w.position.y;
    ticks.push((t) => { w.userData.tick(t); w.position.y = baseY + Math.sin(t * 0.45) * 0.12; });
  }

  // ---- the ladder platform (262): planks across the shaft, a hatch, the ladder through it
  if (P.platform) {
    const R = V.r;
    const edge = -0.35;
    const plat = F.kit('platform', () => {
      const g = new THREE.Group();
      const pl = F.CM.planks();
      const t = F.CM.timberDark();
      // two beams wedged across the shaft from wall to wall, planks laid over them toward us
      for (const bz of [edge + 0.12, 1.1]) {
        const half = Math.sqrt(R * R - bz * bz) + 0.25;
        const beam = rbox(0.2, 0.26, half * 2, 0.03, t, { pos: [0, -0.27, bz] });
        beam.rotation.y = Math.PI / 2;
        g.add(beam);
      }
      for (let x = -R + 0.12; x < R - 0.05; x += 0.19) {
        const far = Math.sqrt(Math.max(0, (R + 0.15) ** 2 - x * x));
        if (far < -edge + 0.1) continue;
        const z0 = edge + 0.03 * Math.sin(x * 11);
        const pk = rbox(0.17, 0.05, far - z0, 0.012, pl, { pos: [x, 0.005 * Math.sin(x * 17), (far + z0) / 2], seg: 1 });
        pk.rotation.y = 0.012 * Math.sin(x * 7);
        g.add(pk);
      }
      // a coil of rope left on the planks
      const coil = new THREE.Group();
      for (let i = 0; i < 4; i++) coil.add(mesh(new THREE.TorusGeometry(0.2 - i * 0.012, 0.018, 6, 24), F.CM.rope(), { pos: [0, 0.02 + i * 0.03, 0], rot: [Math.PI / 2, 0, i * 0.4] }));
      coil.position.set(-1.1, 0.03, 0.2);
      g.add(coil);
      return g;
    });
    group.add(plat);
    const lad = F.kit('ladder62', () => F.ladder(24, { seed: 5 }));
    lad.position.set(0, -10, -R + 0.5);
    lad.rotation.x = -0.01;
    group.add(lad);
    // far below, black water
    const w = makeWater({ size: 5.4, res: 12, level: -9, quality: ctx.quality, depthAt: () => 4, calm: 0.15, scale: 0.3, deep: 0x010304, shallow: 0x060e10,
      glow: lantern ? 0.5 : 0, glowCol: 0xffa050, glowNear: 0.5 });
    w.userData.setSky({ sun: new THREE.Vector3(0.1, 0.8, 0.3), sunCol: 0x6a4020, top: 0x020304, horizon: 0x05070a, night: true });
    group.add(w);
    ticks.push(w.userData.tick);
    const d = particles('drips', 24, { quality: ctx.quality, seed: 4, pos: [0, 8, 0], spread: [R, 0.3, R] });
    group.add(d);
    ticks.push(d.userData.tick);
  }

  // ---- a ladder up through the mine's ceiling (263)
  if (P.ladderUp) {
    const h = holes[0];
    const cy = ceilingAt(main, h.x, h.z, h.r + 0.6);
    group.add(vShaft({ cx: h.x, cz: h.z, y0: cy - 0.35, y1: cy + 9, rAt: () => h.r + 0.12, material: rockMat, seed: 3, radial: 24 }));
    const collar = F.kit('collar09', () => F.shaftCollar(0.9));
    collar.position.set(h.x, cy - 0.3, h.z);
    group.add(collar);
    const lad = F.kit('ladder63', () => F.ladder(cy + 6, { seed: 1 }));
    lad.position.set(h.x, -0.2, h.z - 0.35);
    lad.rotation.x = -0.1;
    group.add(lad);
  }

  // ---- the way out above the catacombs' entrance (257)
  if (P.wayOut) {
    const h = holes[0];
    const cy = ceilingAt(main, h.x, h.z, h.r + 0.6);
    group.add(vShaft({ cx: h.x, cz: h.z, y0: cy - 0.35, y1: cy + 8, rAt: (y) => h.r + 0.15 - 0.03 * (y - cy), material: rockMat, seed: 9, radial: 24 }));
    const sky = glowSprite(night ? 0x8aa0d8 : 0xfff4e0, night ? 2.5 : 5, night ? 0.5 : 1.2);
    sky.position.set(h.x, cy + 7.5, h.z);
    group.add(sky);
    const shafts = lightShafts(night ? 0x8aa0d8 : 0xfff2d0, { count: 3, len: cy + 2, width: 0.9, spread: 0.5, alpha: night ? 0.015 : 0.06, seed: 4 });
    shafts.position.set(h.x, floorY, h.z + 2);
    group.add(shafts);
    ticks.push(shafts.userData.tick);
    // a scramble of fallen rock under the opening
    const bm = mat('stone', { c1: 0x5e5850, c2: 0x2a2724, c3: 0x2e5a3a, p: [1.2, 0.8, 0.7, 0] });
    const pile = [[0, 0.5, 0, 1.0], [0.7, 0.35, 0.5, 0.7], [-0.6, 0.4, -0.3, 0.8], [0.2, 1.2, -0.3, 0.6], [-0.2, 1.8, -0.5, 0.45], [0.5, 2.2, -0.6, 0.35]];
    pile.forEach(([x, y, z, s], i) => group.add(mesh(F.rockGeo(i + 3, 1, 0.3), bm, { pos: [h.x + x, y, h.z + z], scale: [s * 1.2, s, s], rot: [0, i, 0] })));
    points.push({ pos: [h.x, cy - 1, h.z], color: night ? 0x6a7ab0 : 0xfff0d8, intensity: night ? 4 : 30, distance: 0 });
  }

  // ---- the mine: timber sets, rails, a cart, rubble
  if (P.timbers) {
    let i = 0;
    for (let z = -0.3; z > 6 - len - ext * 0.6 + 1; z -= 4.2) {
      if (P.ladderUp && Math.abs(z - holes[0].z) < 0.9) continue;
      if (P.rubble && z < -1.5) break;
      const [sx, sy] = sectionAt(z);
      const hw = sx * 0.66;
      const hh = sy * 0.55 + sy * Math.sqrt(1 - 0.66 * 0.66) * 0.86;
      const ts = F.kit(`timber${Math.round(hw * 5)}-${Math.round(hh * 5)}`, () => F.timberSet(hw * 2, hh - 0.52, i));
      ts.position.set(0, 0, z);
      group.add(ts);
      i++;
    }
  }
  if (P.rails) {
    const tl = P.rubble ? 7.6 : len + ext * 0.6;
    const track = F.kit(`track${Math.round(tl)}`, () => F.railTrack(tl));
    track.position.set(0.3, 0, 5);
    group.add(track);
  }
  if (P.cart) {
    const cart = F.kit('emptyCart', () => F.mineCart({ ore: false }));
    cart.position.set(0.3, 0.09, -2.5);
    cart.rotation.y = Math.PI / 2 + 0.02;
    group.add(cart);
  }
  if (P.rubble) {
    // "blocked by broken rocks": a collapse filling the tunnel, a broken timber set in it
    const zr = -2.4;
    const [sx, sy] = sectionAt(zr);
    const bm = mat('stone', { c1: 0x5a524a, c2: 0x2a2622, c3: 0x3a3a2a, p: [0.9, 0.2, 0.05, 0.5], q: [1.0, 0.75, 0.3, 0] });
    // a slope of broken rock: big blocks at the back reaching the roof, smaller pieces spilling forward
    const nR = 70;
    const imR = new THREE.InstancedMesh(F.rockGeo(5, 0, 0.45, true), bm, nR);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < nR; i++) {
      const depth = r.range(0, 1);
      const zz = zr - 2.2 + depth * 3.6;
      const hMax = sy * 1.45 * (1 - depth) ** 1.2 + 0.2;
      const y = r.range(0, hMax);
      const wAt = sx * Math.sqrt(Math.max(0.05, 1 - ((y - sy * 0.55) / (sy * 1.1)) ** 2));
      const x = r.range(-wAt, wAt) * 0.92;
      const sc = r.range(0.18, 0.55) * (1.2 - depth * 0.7);
      m4.compose(new THREE.Vector3(x, y, zz), new THREE.Quaternion().setFromEuler(new THREE.Euler(r.range(0, 3), r.range(0, 3), r.range(0, 3))), new THREE.Vector3(sc * r.range(0.8, 1.5), sc * r.range(0.5, 0.9), sc));
      imR.setMatrixAt(i, m4);
    }
    group.add(imR);
    group.add(scatter(F.rockGeo(7, 0, 0.4, true), bm, 30, () => ({ pos: [r.range(-sx * 0.7, sx * 0.7), 0.04, zr + r.range(1.2, 3)], scale: r.range(0.05, 0.14), rot: [r.range(0, 3), r.range(0, 3), 0] })));
    // the timber set that failed: a post knocked flat, the cap beam fallen askew, loose lagging
    const broken = new THREE.Group();
    const tm = F.CM.timber();
    broken.add(rbox(0.22, sy * 1.1, 0.22, 0.03, tm, { pos: [-sx * 0.55, 0.12, 0.2], rot: [0.1, 0, -1.25] }));
    broken.add(rbox(sx * 1.5, 0.26, 0.26, 0.035, tm, { pos: [0.2, 0.9, -0.3], rot: [0.15, 0.35, 0.42] }));
    broken.add(rbox(0.22, sy * 1.05, 0.22, 0.03, tm, { pos: [sx * 0.62, 0, 0.6], rot: [0, 0, 0.12] }));
    for (let i = 0; i < 5; i++) broken.add(rbox(0.18, 0.04, 1.5, 0.012, F.CM.timberDark(), { pos: [r.range(-sx * 0.6, sx * 0.6), 0.02 + i * 0.03, r.range(0.4, 1.6)], rot: [0, r.range(-0.8, 0.8), r.range(-0.1, 0.1)] }));
    broken.position.set(0, 0, zr + 0.8);
    group.add(F.bake(broken));
  }
  if (P.steam && !P.abyss) {
    const st = particles('steam', 70, { quality: ctx.quality, seed: 13, pos: [0, 0.3, -len * 0.4], spread: [RX * 1.8, 0.4, len * 0.8], size: 220, alpha: spec.light.cantsee ? 0.05 : 0.12, color: 0xc8a890, color2: 0x8a7060 });
    group.add(st);
    ticks.push(st.userData.tick);
  }
  if (P.sign) {
    // "A wooden sign in the dust reads in old elven runes, "GSRF KDIRE NLVEMP!""
    const tex = runeSign('GSRF KDIRE NLVEMP!');
    const sign = new THREE.Group();
    sign.add(rbox(1.46, 0.05, 0.5, 0.02, F.CM.planks(), { pos: [0, 0, 0] }));
    sign.add(mesh(new THREE.PlaneGeometry(1.4, 0.44), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }), { pos: [0, 0.052, 0], rot: [-Math.PI / 2, 0, 0], shadow: false }));
    // its broken stake
    sign.add(rbox(0.07, 0.05, 0.9, 0.02, F.CM.timberDark(), { pos: [0.1, -0.01, 0.6], rot: [0, 0.2, 0] }));
    sign.position.set(-0.5, 0.04, 0.9);
    sign.rotation.set(0.12, -0.35, 0.04);
    group.add(sign);
  }
  if (P.stoneDoor) {
    const openDoor = spec.around.back.exit === 189 || spec.around.ahead.exit === 189 || spec.around.left.exit === 189 || spec.around.right.exit === 189;
    const [sx] = sectionAt(-2.4);
    const d = F.kit(openDoor ? 'stoneDoorOpen' : 'stoneDoor', () => F.stoneDoor({ open: openDoor }));
    d.position.set(sx * 0.86, 0, -2.4);
    d.rotation.y = -Math.PI / 2 + 0.12;
    group.add(d);
  }
  if (P.throne) {
    // the goddess's chamber: a throne of gold and silver, nests of ferns and palm leaves
    const zT = -len * 0.45;
    const th = F.kit('throne', F.throne);
    th.position.set(0, 0, zT);
    group.add(th);
    const halo = glowSprite(0xffd890, 6, 0.1);
    halo.position.set(0, 2.4, zT - 0.6);
    group.add(halo);
    // "Beds of ferns and palm leaves make several cozy nests along the walls."
    [[-1, -1.2, 1.25], [1, -2.4, 1.15], [-1, -5.2, 1.1], [1, -6.0, 1.3], [-1, -10.2, 1.0], [1, -10.8, 1.0]].forEach(([s, z, sc], i) => {
      const [sx] = sectionAt(z);
      const n = F.nest(sc, i);
      n.position.set(s * (sx * 0.72 - 1.0), 0, z);
      group.add(n);
    });
    points.push({ pos: [0, 3, -len * 0.55], color: 0xffc070, intensity: 60, distance: 0, flicker: 0.15 });
  }
  if (P.abyss) {
    // a narrow trail along the edge of a void full of rising steam, lit from below
    // a sheer wall on the left, an overhang, and far across the void a second wall lit from below
    const wall = rockFace(len + 16, 30, spec.seed % 91, 1.1);
    group.add(mesh(wall, rockMat, { pos: [-RX * 1.5, 6, -len / 2 + 2], rot: [0, Math.PI / 2, 0] }));
    const across = rockFace(len + 60, 80, spec.seed % 37 + 3, 3);
    group.add(mesh(across, rockMat, { pos: [RX * 11, -14, -len / 2], rot: [0, -Math.PI / 2, 0] }));
    const ledgeM = mat('stone', { c1: 0x3a2a22, c2: 0x1a120c, c3: 0x3a2a1a, p: [0.8, 0.3, 0, 0.3], q: [1, 0.3, 0.05, 0] });
    group.add(mesh(F.ledgeGeo(RX * 1.35, len + 10, spec.seed % 11), ledgeM, { pos: [-RX * 0.55, 0, -len / 2 + 4] }));
    // loose rock along the lip, a few stumps of stalagmite
    for (let i = 0; i < 12; i++) {
      const s = r.range(0.12, 0.45);
      group.add(mesh(F.rockGeo(i + 20, 1, 0.3), ledgeM, { pos: [r.range(-RX * 0.9, RX * 0.05), s * 0.3, r.range(-len * 0.8, 2)], scale: [s * 1.2, s, s], rot: [0, r.range(0, 3), 0] }));
    }
    for (let i = 0; i < 4; i++) {
      const h = r.range(0.5, 1.4);
      const sm = mesh(F.spire(1, 1, i), ledgeM, { pos: [-RX * r.range(0.9, 1.25), -0.05, -3 - i * 4.5], shadow: false });
      sm.scale.set(h * 0.35, h, h * 0.35);
      group.add(sm);
    }
    // heat haze rising out of the dark: layered dim glows, deeper ones redder
    for (let i = 0; i < 6; i++) {
      const hz = glowSprite(i % 2 ? 0xff5a18 : 0xd86a2a, 14 + i * 5, 0.22 + 0.06 * (i % 3));
      hz.position.set(RX * (2.2 + (i % 3) * 0.9), -7 - i * 4, -len * (0.15 + 0.13 * i));
      group.add(hz);
    }
    const glowBelow = glowSprite(0xff6a20, 60, 0.18);
    glowBelow.position.set(RX * 5, -60, -len * 0.5);
    group.add(glowBelow);
    points.push({ pos: [RX * 5, -30, -len * 0.4], color: 0xff6a20, intensity: 400, distance: 0, flicker: 0.4 });
  }
  if (P.pit) {
    // "I can see daylight far up at the mouth of the pit" / "a single star can be seen"
    const mz = -V.lean;
    const sky = mesh(new THREE.CircleGeometry(V.narrow + 0.8, 32), glowMat(night ? 0x0c1630 : 0xdcecff, night ? 1 : 1.5), { pos: [0, V.top + 0.3, mz], rot: [Math.PI / 2, 0, 0], shadow: false });
    group.add(sky);
    const mouth = glowSprite(night ? 0x8aa0ff : 0xfff4e0, night ? 1.2 : 12, night ? 1.2 : 0.8);
    mouth.position.set(night ? 0.6 : 0, V.top - (night ? 0.2 : 2), mz + (night ? 0.4 : 0));
    group.add(mouth);
    const shafts = lightShafts(night ? 0x6a7ab0 : 0xfff2d0, { count: 3, len: 36, width: 1.4, spread: 0.7, alpha: night ? 0.008 : 0.045, seed: 12 });
    shafts.position.set(0, 0, 1.2);
    shafts.rotation.x = -Math.atan(V.lean / V.top);
    group.add(shafts);
    ticks.push(shafts.userData.tick);
    // a cool draft: dust turning in the light
    const motes = particles('glitter', 30, { quality: ctx.quality, seed: 31, pos: [0, 4, -1], spread: [2.5, 3.5, 2.5], size: 2, color: 0xfff4e0, color2: 0xc8d8ff, alpha: night ? 0.1 : 0.45, vel: [0, -0.05, 0], swirl: 0.6 });
    group.add(motes);
    ticks.push(motes.userData.tick);
    // what fell in: rocks, dead leaves, a snapped branch
    const bm = mat('stone', { c1: 0x6a6258, c2: 0x2a2622, c3: 0x3a4a2a, p: [0.9, 0.3, 0.5, 0] });
    for (let i = 0; i < 12; i++) {
      const s = r.range(0.15, 0.55);
      const a = r.range(0, Math.PI * 2);
      const d = r.range(1.2, V.r - 0.3);
      group.add(mesh(F.rockGeo(i + 40, 1, 0.3), bm, { pos: [Math.cos(a) * d, s * 0.3, Math.sin(a) * d], scale: [s * 1.2, s, s], rot: [0, a, 0] }));
    }
    const lv = [];
    for (let i = 0; i < 30; i++) { const a = r.range(0, Math.PI * 2); const d = r.range(0, V.r - 0.4); lv.push({ x: Math.cos(a) * d, y: 0, z: Math.sin(a) * d }); }
    group.add(groundCover('sedge', lv, r, { night }));
    const br = F.log(2.4, 0.07, 3);
    br.position.set(-1.2, 0.08, -0.8);
    br.rotation.y = 0.8;
    group.add(br);
    points.push({ pos: [0, 14, -4.5], color: night ? 0x6a7ab0 : 0xfff0d8, intensity: night ? 8 : 160, distance: 0 });
    points.push({ pos: [0, 32, mz * 0.8], color: night ? 0x3a4a80 : 0xc8dcff, intensity: night ? 6 : 260, distance: 0 });
  }
  if (P.entrance) {
    // the sea cave: the bright mouth behind you, the roar of the ocean
    const mouth = glowSprite(night ? 0x6a8ab0 : 0xd8f0ff, 10, 0.6);
    mouth.position.set(0, 2.2, 7);
    group.add(mouth);
    points.push({ pos: [0, 2, 5], color: night ? 0x6a7ab0 : 0xd8f0ff, intensity: night ? 10 : 90, distance: 0 });
  }
  // ambient cave light when the room is not in darkness (CANTSEE is handled in index.js)
  const baseLight = P.rock === 'hot' ? 0xff8a50 : P.rock === 'crystal' ? 0x9ab0ff : 0xc8b8a0;
  points.push({ pos: [0, V ? 3 : RY * 0.9, V ? 0 : -len * 0.25], color: baseLight, intensity: 0.35 * Math.max(RX, len / 3) ** 2, distance: 0, flicker: P.steam ? 0.1 : 0 });
  const camY = P.pit ? 1.6 : Math.min(1.55, RY * 0.9);
  let camera = {
    pos: [P.abyss ? -RX * 0.5 : 0, camY, 3.5],
    look: P.abyss ? [RX * 1.5, -2, -len * 0.6] : P.shaftDown ? [0, -1.2, -3.2] : [0, camY * 0.9, -len],
    fov: P.vault ? 70 : 64,
  };
  if (P.spiral) camera = { pos: [0, 1.6, 0.55], look: [0, 5.3, -2.6], fov: 74 };
  if (P.platform) camera = { pos: [0.5, 1.62, 1.15], look: [-0.1, -0.2, -2.4], fov: 74 };
  if (P.pit) camera = { pos: [0, 1.6, 2.4], look: [0, 7.2, -4.2], fov: 74 };
  if (P.ladderUp) camera.look = [0, camY * 1.15, -len];
  if (P.wayOut) camera.look = [0.3, 2.4, -len];
  if (P.stairsDown) camera.look = [0.9, -0.2, -len];
  if (P.sepulcher) camera.look = [0, 1.2, -len];
  const seatZ = -len * 0.45 + 0.02;
  return {
    group,
    ticks,
    camera,
    lights: { hemi: { sky: baseLight, ground: 0x0a0806, intensity: 0.12 }, key: null, points },
    fog: { color: P.rock === 'hot' ? 0x1a0c06 : 0x040506, density: P.vault ? 0.035 : P.pit ? 0.02 : 0.05 },
    background: 0x000000,
    sky: null,
    env: P.rock === 'hot' ? 'cave-warm' : 'cave',
    envIntensity: 0.6,
    grade: { exposure: 1.15, saturation: P.rock === 'hot' ? 1.1 : 0.9, contrast: 1.08, tint: P.rock === 'hot' ? [1.08, 0.96, 0.88] : [0.96, 1.0, 1.04], vignette: 0.55, bloom: 0.6, threshold: 1.1 },
    propAnchor: V ? { x: 0.2, y: 0, z: -0.4, spread: 0.7, radius: 0.9 } : { x: 0, y: 0, z: -1.6, spread: 1.0, radius: 1.3 },
    // the goddess sits on the throne's seat (0.6 up, her hips over the front of the cushion)
    peopleSpots: P.throne ? [[0, 0.6, seatZ], [-2, 0, -5]] : V ? [[0.7, 0, -1.0], [-0.8, 0, -0.5]] : [[0, 0, -5], [-1.4, 0, -6]],
    seated: !!P.throne,
    largeSpots: V ? [[0, 0, -1.2], [1, 0, -1]] : [[0, 0, -6], [1.5, 0, -8]],
  };
}
