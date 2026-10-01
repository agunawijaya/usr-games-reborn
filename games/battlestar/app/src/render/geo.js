// Geometry helpers shared by the kits: seeded randomness, room shells with
// doorway openings where the room really has exits, simple furniture.
// Scene convention: -Z is "ahead" (the facing), +X is "right", Y is up.

import * as THREE from 'three';

/** mulberry32: small, fast, seeded. */
export function rng(seed) {
  let a = seed >>> 0 || 1;
  const f = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.range = (lo, hi) => lo + (hi - lo) * f();
  f.int = (lo, hi) => Math.floor(lo + (hi - lo + 1) * f());
  f.pick = (arr) => arr[Math.floor(f() * arr.length)];
  f.chance = (p) => f() < p;
  return f;
}

export function mesh(geo, material, { pos, rot, scale, shadow = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, material);
  if (pos) m.position.set(...pos);
  if (rot) m.rotation.set(...rot);
  if (scale) typeof scale === 'number' ? m.scale.setScalar(scale) : m.scale.set(...scale);
  m.castShadow = shadow;
  m.receiveShadow = receive;
  return m;
}

export const box = (w, h, d, m, o) => mesh(new THREE.BoxGeometry(w, h, d), m, o);
export const cyl = (rt, rb, h, m, o, seg = 16) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m, o);

/**
 * A wall segment along an axis with an optional door gap.
 * axis 'x': wall spans x in [-len/2, len/2] at the given z; 'z': spans z at the given x.
 */
function wallWithGap(len, h, thick, material, { door = false, doorW = 1.6, doorH = 2.3, offset = 0 } = {}) {
  const g = new THREE.Group();
  if (!door) {
    g.add(box(len, h, thick, material, { pos: [0, h / 2, 0] }));
    return g;
  }
  const leftLen = len / 2 + offset - doorW / 2;
  const rightLen = len / 2 - offset - doorW / 2;
  if (leftLen > 0.01) g.add(box(leftLen, h, thick, material, { pos: [-len / 2 + leftLen / 2, h / 2, 0] }));
  if (rightLen > 0.01) g.add(box(rightLen, h, thick, material, { pos: [len / 2 - rightLen / 2, h / 2, 0] }));
  if (h > doorH) g.add(box(doorW, h - doorH, thick, material, { pos: [offset, doorH + (h - doorH) / 2, 0] }));
  return g;
}

/**
 * A floor (dir -1, facing up) or ceiling (dir 1, facing down) of w × d with
 * polygonal holes given in room coordinates [[x, z], ...] (stairwells).
 */
function slabGeo(w, d, holes, dir) {
  if (!holes.length) {
    const g = new THREE.PlaneGeometry(w, d, 1, 1);
    g.rotateX(dir * Math.PI / 2);
    return g;
  }
  // shape space: (x, sy) maps to (x, -sy) for a floor, (x, sy) for a ceiling
  const sz = (z) => (dir < 0 ? -z : z);
  const s = new THREE.Shape([new THREE.Vector2(-w / 2, -d / 2), new THREE.Vector2(w / 2, -d / 2), new THREE.Vector2(w / 2, d / 2), new THREE.Vector2(-w / 2, d / 2)]);
  for (const h of holes) s.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, sz(z)))));
  const g = new THREE.ShapeGeometry(s);
  g.rotateX(dir * Math.PI / 2);
  return g;
}

/**
 * Room shell: floor, ceiling and four walls with openings for the exits
 * ahead/left/right/back. Returns { group, openings } where openings gives
 * the world-space centre of each doorway for set dressing.
 */
export function shell({ w, d, h, exits, wall, floor, ceil, doorW = 1.6, doorH = 2.4, thick = 0.25, ceilH, noCeil = false, openFar = false, floorHoles = [], ceilHoles = [] }) {
  const group = new THREE.Group();
  const ch = ceilH ?? h;
  group.add(mesh(slabGeo(w, d, floorHoles, -1), floor, { shadow: false }));
  if (!noCeil && ceil) group.add(mesh(slabGeo(w, d, ceilHoles, 1), ceil, { pos: [0, ch, 0], shadow: false }));
  const openings = {};
  if (openFar) {
    // only a lintel: the far side opens onto a view
    group.add(box(w, 0.8, thick, wall, { pos: [0, h - 0.4, -d / 2] }));
  } else {
    const far = wallWithGap(w, h, thick, wall, { door: !!exits.ahead, doorW, doorH });
    far.position.z = -d / 2;
    group.add(far);
  }
  if (exits.ahead) openings.ahead = new THREE.Vector3(0, doorH / 2, -d / 2);
  const near = wallWithGap(w, h, thick, wall, { door: !!exits.back, doorW, doorH });
  near.position.z = d / 2;
  group.add(near);
  if (exits.back) openings.back = new THREE.Vector3(0, doorH / 2, d / 2);
  const offs = -d * 0.12;
  const left = wallWithGap(d, h, thick, wall, { door: !!exits.left, doorW, doorH, offset: -offs });
  left.rotation.y = Math.PI / 2;
  left.position.x = -w / 2;
  group.add(left);
  if (exits.left) openings.left = new THREE.Vector3(-w / 2, doorH / 2, offs);
  const right = wallWithGap(d, h, thick, wall, { door: !!exits.right, doorW, doorH, offset: offs });
  right.rotation.y = -Math.PI / 2;
  right.position.x = w / 2;
  group.add(right);
  if (exits.right) openings.right = new THREE.Vector3(w / 2, doorH / 2, offs);
  return { group, openings };
}

/** A straight flight of stairs rising along -Z from (0,0,0), `steps` treads. */
export function stairs({ width = 1.6, rise = 3, run = 4, steps = 12, material, rail }) {
  const g = new THREE.Group();
  const sh = rise / steps;
  const sd = run / steps;
  for (let i = 0; i < steps; i++) {
    g.add(box(width, sh, sd, material, { pos: [0, sh * (i + 0.5), -sd * (i + 0.5)] }));
  }
  if (rail) {
    for (const s of [-1, 1]) {
      const len = Math.hypot(rise, run);
      const r = box(0.08, 0.08, len, rail, { pos: [s * width / 2, rise / 2 + 0.9, -run / 2] });
      r.rotation.x = Math.atan2(rise, run);
      g.add(r);
      for (let i = 0; i <= steps; i += 3) {
        g.add(box(0.05, 0.9, 0.05, rail, { pos: [s * width / 2, sh * i + 0.45, -sd * i] }));
      }
    }
  }
  return g;
}

/** Distributes n points in a loose arc in front of the camera (for props). */
export function propSpots(n, r, { radius = 1.6, z = -1.8, spread = 1.1, y = 0 } = {}) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (n === 1 ? 0 : (i / (n - 1) - 0.5) * spread) + r.range(-0.12, 0.12);
    const rr = radius * r.range(0.8, 1.2);
    out.push(new THREE.Vector3(Math.sin(a) * rr, y, z - Math.cos(a) * rr * 0.6));
  }
  return out;
}

/** Cheap instanced scatter helper. */
export function scatter(geo, material, count, place, { shadow = false } = {}) {
  const im = new THREE.InstancedMesh(geo, material, count);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const e = new THREE.Euler();
  for (let i = 0; i < count; i++) {
    const t = place(i);
    p.set(...t.pos);
    e.set(...(t.rot || [0, 0, 0]));
    q.setFromEuler(e);
    typeof t.scale === 'number' ? s.setScalar(t.scale) : s.set(...(t.scale || [1, 1, 1]));
    m4.compose(p, q, s);
    im.setMatrixAt(i, m4);
  }
  im.castShadow = shadow;
  im.receiveShadow = true;
  return im;
}
