// The island's characters, modelled and clothed on the humans.js skeleton
// (ADR-013): the elf, the woodsman, the Dark Lord, the man in the white
// suit and his dwarf, the swarthy woman, the native girl and the one-eyed
// old-timer, each with modelled gear and a life of their own (breathing,
// weight shifts, glances and slow, eased gestures — nothing twitches).
// Presence is implied, never explicit (ADR-009): the goddesses are made of
// light, steam and water.

import * as THREE from 'three';
import { C } from '../engine/battlestar.js';
import { mat, glowMat } from './materials.js';
import { mesh } from './geo.js';
import { particles, glowSprite } from './fx.js';
import { latheGeo, tubeGeo, rbox, cushionGeo, weldNormals } from './model.js';
import { buildHuman, poseOf, applyPose, people } from './humans.js';

const P = Math.PI;
const TAU = P * 2;
const ease = (u) => u * u * (3 - 2 * u);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const SIL_VERT = /* glsl */ `
#include <fog_pars_vertex>
varying vec3 vN; varying vec3 vV;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  #ifdef USE_INSTANCING
  mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  #endif
  vN = normalize(normalMatrix * normal); vV = -mv.xyz;
  gl_Position = projectionMatrix * mv;
  vec4 mvPosition = mv;
  #include <fog_vertex>
}`;
const SIL_FRAG = /* glsl */ `
#include <fog_pars_fragment>
uniform vec3 uRim; uniform vec3 uBase; uniform float uRimPow; uniform float uOpacity;
varying vec3 vN; varying vec3 vV;
void main() {
  float rim = pow(1.0 - max(dot(normalize(vN), normalize(vV)), 0.0), uRimPow);
  float top = 0.5 + 0.5 * normalize(vN).y;
  vec3 col = uBase * (0.6 + 0.4 * top) + uRim * rim;
  gl_FragColor = vec4(col, uOpacity);
  #include <fog_fragment>
}`;

const silCache = new Map();
export function silhouetteMat(rim = 0x9fc8ff, base = 0x0b0c10, pow = 2.5, opacity = 1) {
  const k = `${rim}|${base}|${pow}|${opacity}`;
  if (silCache.has(k)) return silCache.get(k);
  const m = new THREE.ShaderMaterial({
    vertexShader: SIL_VERT, fragmentShader: SIL_FRAG, fog: true, transparent: opacity < 1,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uRim: { value: new THREE.Color(rim) }, uBase: { value: new THREE.Color(base) }, uRimPow: { value: pow }, uOpacity: { value: opacity },
    }]),
  });
  silCache.set(k, m);
  return m;
}

/**
 * A posable figure ~1.75 m tall standing on y = 0, built by humans.js. With a
 * single `material` every part uses it; `skirt` gives a knee-length dress,
 * `cape` a cloak.
 */
export function figure(material, { scale = 1, skirt = false, cape = false, bulky = 1 } = {}) {
  const outer = new THREE.Group();
  const b = buildHuman({ sex: skirt ? 'f' : 'm', material, outfit: skirt ? 'girls' : 'crew', hairStyle: skirt ? 'long' : 'short', height: 1.76 * scale, extras: cape ? ['cape'] : [] });
  b.scale.x *= bulky;
  b.scale.z *= bulky;
  outer.add(b);
  outer.userData.rig = b.userData.rig;
  outer.userData.body = b;
  return outer;
}

/** Applies a named static pose (humans.js POSE). */
export function pose(fig, name) {
  fig.userData.pose = name;
  applyPose(fig, poseOf(name));
}

/** Gentle procedural motion on top of the figure's pose. */
export function animate(fig, t, kind, speed = 1, phase = 0) {
  const p = poseOf(fig.userData.pose);
  const s = t * speed + phase;
  if (kind === 'sway') life(p, s, { shift: 0.6 });
  else if (kind === 'menace') {
    life(p, s, { shift: 0.4 });
    p.spineX += 0.08 * Math.sin(s * 0.9);
  }
  applyPose(fig, p);
}

// ---------------------------------------------------------------- life

/** A slow, smooth wander in [-1, 1]: a few incommensurate sines. */
const wander = (s, k = 1) => 0.55 * Math.sin(s * 0.21 * k + 1.3) + 0.3 * Math.sin(s * 0.47 * k + 4.1) + 0.15 * Math.sin(s * 0.83 * k);

/**
 * Idle life on a pose: breathing, a weight shift every few seconds (the
 * loaded leg straight, the other knee eased), and glances. Seated or
 * kneeling poses skip the weight shift.
 */
function life(p, s, { breathe = 1, shift = 1, look = 1, lookSide = 0.5 } = {}) {
  const br = Math.sin(s * 1.35);
  p.chestX -= 0.014 * br * breathe;
  p.neckX += 0.008 * br * breathe;
  p.shL[2] -= 0.01 * br * breathe;
  p.shR[2] += 0.01 * br * breathe;
  if (shift) {
    const w = Math.sin(s * 0.29 + Math.sin(s * 0.11)); // weight: -1 on the left leg, +1 on the right
    const e = Math.sign(w) * ease(Math.min(1, Math.abs(w) * 1.4));
    p.hipDx += 0.02 * e * shift;
    p.hipZ -= 0.03 * e * shift;
    p.chestZ += 0.02 * e * shift;
    p.knL += Math.max(0, e) * 0.12 * shift;
    p.knR += Math.max(0, -e) * 0.12 * shift;
    p.thL[0] -= Math.max(0, e) * 0.05 * shift;
    p.thR[0] -= Math.max(0, -e) * 0.05 * shift;
    p.hipY -= Math.abs(e) * 0.01 * shift;
  }
  p.neckY += lookSide * wander(s) * look;
  p.headX += 0.05 * wander(s + 17, 0.7) * look;
}

/** A named pose with life applied through `fn` each frame, eased toward the result (no pops). */
function performer(fig, base, fn) {
  const cur = poseOf(base);
  let last = null;
  return (t) => {
    const p = poseOf(base);
    fn(p, t);
    const dt = last === null ? 1 : clamp(t - last, 0, 0.1);
    last = t;
    const k = dt >= 1 ? 1 : 1 - Math.exp(-dt / 0.1);
    for (const key of Object.keys(p)) {
      if (Array.isArray(p[key])) cur[key] = cur[key].map((v, i) => v + (p[key][i] - v) * k);
      else cur[key] += (p[key] - cur[key]) * k;
    }
    applyPose(fig, cur);
  };
}

/** A clothed character on the humans.js body (see OUTFITS there). */
function character(outfit, o = {}) {
  const outer = new THREE.Group();
  const b = buildHuman({ outfit, ...o });
  if (o.bulky) { b.scale.x *= o.bulky; b.scale.z *= o.bulky; }
  outer.add(b);
  outer.userData.rig = b.userData.rig;
  outer.userData.body = b;
  return outer;
}

/** Attaches `obj` to a joint: side 0 = left, 1 = right; at 'wr' (the hand) or 'el' (the forearm). */
function attach(fig, side, joint, obj, pos = [0, 0, 0], rot = [0, 0, 0]) {
  const j = fig.userData.rig.arms[side][joint];
  obj.position.set(...pos);
  obj.rotation.set(...rot);
  j.add(obj);
  return obj;
}

/**
 * Turns a held object (already attached) so that, in the figure's own frame
 * and its current pose, its +y runs along `yDir` and its +z leans toward
 * `zHint`. Held things then follow the hand as the pose moves.
 */
function orient(fig, obj, yDir, zHint = [0, 0, 1]) {
  fig.updateMatrixWorld(true);
  const figQ = fig.getWorldQuaternion(new THREE.Quaternion());
  const parQ = obj.parent.getWorldQuaternion(new THREE.Quaternion());
  const y = new THREE.Vector3(...yDir).normalize();
  const x = new THREE.Vector3().crossVectors(y, new THREE.Vector3(...zHint)).normalize();
  const z = new THREE.Vector3().crossVectors(x, y);
  const want = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)).premultiply(figQ);
  obj.quaternion.copy(parQ.invert().multiply(want));
}

/** The palm of a hand (arm side 0/1), in the figure's frame. */
function palm(fig, side) {
  fig.updateMatrixWorld(true);
  const v = new THREE.Vector3(0, -0.07, 0.01);
  fig.userData.rig.arms[side].wr.localToWorld(v);
  return fig.worldToLocal(v);
}

// ---------------------------------------------------------------- gear (modelled, style A)

const G = new Map();
const geo = (key, make) => { if (!G.has(key)) { const g = make(); g.userData.shared = true; G.set(key, g); } return G.get(key); };
const woodM = () => mat('wood', { c1: 0x6a4428, c2: 0x2e1a0c, p: [3, 0, 0, 0] });
const steelM = () => mat('metal', { c1: 0xc4cbd2, c2: 0x5a6068, p: [0.2, 0.15, 0, 0] });
const ironM = () => mat('metal', { c1: 0x4e555c, c2: 0x23262a, p: [0.38, 0.3, 0, 0] });
const leatherM = () => mat('fabric', { c1: 0x4a2a16, c2: 0x2a160a, p: [2.2, 0.15, 0, 1] });

function blade2d(points, t) {
  const s = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: true, bevelThickness: t * 0.3, bevelSize: t * 0.3, bevelSegments: 1 });
  g.translate(0, 0, -t / 2);
  g.computeVertexNormals();
  return g;
}

/** Built along +y, gripped at the origin. */
function halberd() {
  const g = new THREE.Group();
  g.add(mesh(geo('hb-shaft', () => weldNormals(latheGeo([[0, -0.72], [0.02, -0.7], [0.019, 0.9], [0.021, 1.2], [0, 1.22]], 10))), woodM()));
  g.add(mesh(geo('hb-grip', () => latheGeo([[0.023, -0.12], [0.024, 0.12]], 10)), leatherM()));
  const head = new THREE.Group();
  head.position.y = 1.2;
  head.add(mesh(geo('hb-axe', () => blade2d([[0.02, -0.02], [0.2, -0.12], [0.26, -0.02], [0.24, 0.1], [0.2, 0.16], [0.02, 0.1]], 0.008)), steelM()));
  head.add(mesh(geo('hb-hook', () => blade2d([[-0.02, -0.01], [-0.14, 0.02], [-0.16, 0.08], [-0.1, 0.04], [-0.02, 0.06]], 0.008)), steelM()));
  head.add(mesh(geo('hb-spike', () => { const q = new THREE.ConeGeometry(0.02, 0.32, 4); q.scale(1, 1, 0.4); q.translate(0, 0.2, 0); return q; }), steelM()));
  head.add(rbox(0.05, 0.14, 0.05, 0.012, ironM(), { center: true }));
  g.add(head);
  return g;
}

function mallet() {
  const g = new THREE.Group();
  g.add(mesh(geo('ml-handle', () => weldNormals(latheGeo([[0, -0.12], [0.026, -0.1], [0.022, 0.2], [0.02, 0.6], [0.028, 0.66], [0, 0.68]], 12))), woodM()));
  const head = new THREE.Group();
  head.position.y = 0.72;
  head.rotation.z = P / 2;
  head.add(mesh(geo('ml-head', () => weldNormals(latheGeo([[0, -0.17], [0.095, -0.17], [0.112, -0.15], [0.118, 0], [0.112, 0.15], [0.095, 0.17], [0, 0.17]], 22))), mat('wood', { c1: 0x8a6a48, c2: 0x4a3420, p: [2.2, 0, 0, 0] })));
  for (const y of [-0.12, 0.12]) head.add(mesh(geo('ml-band', () => { const q = new THREE.TorusGeometry(0.116, 0.009, 6, 26); q.rotateX(P / 2); return q; }), ironM(), { pos: [0, y, 0] }));
  g.add(head);
  return g;
}

/** The Dark Lord's blade: a ridged hilt, an emitter guard and a violet blade of light. */
function laserSword() {
  const g = new THREE.Group();
  const dark = mat('metal', { c1: 0x3a3a42, c2: 0x101014, p: [0.25, 0.2, 0, 0] });
  const chrome = mat('metal', { c1: 0xd8dce2, c2: 0x6a7078, p: [0.1, 0.05, 0, 0] });
  g.add(mesh(geo('ls-hilt', () => { const pts = [[0, -0.15], [0.024, -0.15], [0.026, -0.13]]; for (let i = 0; i <= 10; i++) pts.push([i % 2 ? 0.024 : 0.021, -0.12 + i * 0.02]); pts.push([0.026, 0.1], [0, 0.1]); return weldNormals(latheGeo(pts, 16)); }), dark));
  g.add(mesh(geo('ls-guard', () => weldNormals(latheGeo([[0.02, 0.1], [0.034, 0.1], [0.036, 0.125], [0.03, 0.14], [0.018, 0.145]], 16))), chrome));
  g.add(mesh(geo('ls-pommel', () => latheGeo([[0, -0.19], [0.02, -0.185], [0.026, -0.16], [0.024, -0.15]], 14)), chrome));
  g.add(mesh(geo('ls-core', () => { const q = new THREE.CapsuleGeometry(0.012, 0.96, 4, 10); q.translate(0, 0.64, 0); return q; }), glowMat(0xf0e4ff, 3)));
  g.add(mesh(geo('ls-halo', () => { const q = new THREE.CapsuleGeometry(0.026, 0.96, 4, 12); q.translate(0, 0.64, 0); return q; }), glowMat(0xb46cff, 2.2, { transparent: true, opacity: 0.35, additive: true }), { shadow: false }));
  for (const y of [0.3, 0.64, 0.98]) { const s = glowSprite(0xb46cff, 0.55, 0.55); s.position.y = y; g.add(s); }
  return g;
}

/** A round wooden shield with an iron rim and boss, facing +z. */
function roundShield() {
  const g = new THREE.Group();
  const face = mat('wood', { c1: 0x5a3a1e, c2: 0x2a1a0c, p: [2.5, 0, 0, 0] });
  g.add(mesh(geo('sh-face', () => { const q = latheGeo([[0.29, 0], [0.28, 0.015], [0.2, 0.035], [0, 0.045]], 28); q.rotateX(P / 2); return weldNormals(q); }), face));
  g.add(mesh(geo('sh-back', () => { const q = new THREE.CircleGeometry(0.29, 28); q.rotateY(P); return q; }), face));
  g.add(mesh(geo('sh-rim', () => new THREE.TorusGeometry(0.29, 0.014, 8, 36)), ironM()));
  g.add(mesh(geo('sh-boss', () => { const q = latheGeo([[0.07, 0], [0.065, 0.02], [0.04, 0.045], [0, 0.055]], 18); q.rotateX(P / 2); return q; }), ironM(), { pos: [0, 0, 0.035] }));
  // a painted leaf across the face
  g.add(mesh(geo('sh-leaf', () => { const s = new THREE.Shape(); s.moveTo(0, -0.22); s.quadraticCurveTo(0.12, 0, 0, 0.22); s.quadraticCurveTo(-0.12, 0, 0, -0.22); const q = new THREE.ShapeGeometry(s, 12); return q; }), mat('matte', { c1: 0x3a6a2a, p: [0.7, 0, 0, 0] }), { pos: [0, 0, 0.041], shadow: false }));
  return g;
}

function ropeCoil() {
  const pts = [];
  for (let i = 0; i <= 4 * 20; i++) { const a = (i / 20) * TAU; const r = 0.1 - (i / 80) * 0.012; pts.push([Math.cos(a) * r, (i / 80) * 0.07 - 0.035, Math.sin(a) * r]); }
  return mesh(geo('rope-coil', () => tubeGeo(pts, 0.012, 160)), mat('fabric', { c1: 0xb8985a, c2: 0x8a6a36, p: [3.5, 0.1, 0, 1] }));
}

function tumbler() {
  const g = new THREE.Group();
  g.add(mesh(geo('tumbler', () => latheGeo([[0, 0], [0.034, 0], [0.036, 0.004], [0.04, 0.09], [0.037, 0.09], [0.032, 0.012], [0, 0.012]], 18)), new THREE.MeshStandardMaterial({ color: 0xe8f0f4, roughness: 0.05, transparent: true, opacity: 0.4 }), { shadow: false }));
  return g;
}

/**
 * A bed of ferns and palm leaves (~2.3 m long along z, head end at -z): a
 * springy mattress of green with a raised bolster, fronds laid over it.
 */
function fernBed(seed = 1) {
  const g = new THREE.Group();
  const leaf = mat('leaf', { c1: 0x2e6a26, c2: 0x4a8a30, c3: 0x8ac060, p: [0.95, 1.0, 0.06, 0], side: THREE.DoubleSide, alphaTest: 0.5 });
  const moss = mat('matte', { c1: 0x243a18, c2: 0x3a5a24, p: [0.9, 0.35, 0, 0] });
  g.add(mesh(geo('fern-bed', () => cushionGeo(1.1, 0.22, 2.3, { r: 0.1, puff: 0.35, under: 0 })), moss, { pos: [0, 0.11, 0.1] }));
  g.add(mesh(geo('fern-bolster', () => cushionGeo(1.0, 0.26, 0.5, { r: 0.12, puff: 0.5, under: 0 })), moss, { pos: [0, 0.3, -0.5], rot: [0.35, 0, 0] }));
  const frond = geo('fern-frond', () => { const q = new THREE.PlaneGeometry(0.18, 0.95, 1, 6); q.translate(0, 0.475, 0); const p = q.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setZ(i, 0.2 * (y / 0.95) ** 2); } q.computeVertexNormals(); return q; });
  for (let i = 0; i < 22; i++) {
    const k = i % 11;
    const side = i < 11 ? -1 : 1;
    const z = -0.95 + k * 0.21 + 0.04 * Math.sin(seed + i);
    const y = z < -0.45 ? 0.42 : 0.27;
    const m = mesh(frond, leaf, { pos: [side * 0.08, y, z], shadow: false });
    m.rotation.order = 'YXZ'; // tip it down to lie flat, then swing it out to the side
    m.rotation.set(P / 2 - 0.3, side * (P / 2 - 0.35 * Math.sin(i * 1.7)), 0);
    g.add(m);
  }
  return g;
}

/** A tall wooden bar stool (seat top 0.64 m) in style A. */
function barStool() {
  const g = new THREE.Group();
  const wood = mat('wood', { c1: 0x6e3016, c2: 0x2c1006, p: [2.2, 0, 0, 0] });
  const seat = mat('fabric', { c1: 0x6e1222, c2: 0x3e0814, p: [1.1, 0.9, 0, 0.6] });
  g.add(mesh(geo('stool-seat', () => weldNormals(latheGeo([[0, 0.585], [0.2, 0.585], [0.205, 0.6], [0.2, 0.625], [0.17, 0.64], [0, 0.645]], 26))), seat));
  g.add(mesh(geo('stool-rim', () => latheGeo([[0.19, 0.555], [0.2, 0.56], [0.2, 0.585], [0.19, 0.59]], 26)), wood));
  const leg = geo('stool-leg', () => weldNormals(latheGeo([[0.02, 0], [0.022, 0.05], [0.017, 0.2], [0.021, 0.3], [0.016, 0.45], [0.02, 0.56]], 10)));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + P / 4;
    g.add(mesh(leg, wood, { pos: [Math.cos(a) * 0.15, 0, Math.sin(a) * 0.15], rot: [Math.sin(a) * 0.08, 0, -Math.cos(a) * 0.08] }));
  }
  g.add(mesh(geo('stool-ring', () => { const q = new THREE.TorusGeometry(0.155, 0.011, 6, 28); q.rotateX(P / 2); return q; }), mat('metal', { c1: 0xc8964a, c2: 0x6a4a20, p: [0.25, 0.3, 0, 0] }), { pos: [0, 0.25, 0] }));
  return g;
}

// ---------------------------------------------------------------- the characters

/**
 * Builds a character for an object id (or a feature role).
 * Returns { object, update(t), light? }.
 */
export function person(kind, { night = false, quality = 'high', seed = 1, seated = false } = {}) {
  const rimCool = night ? 0x6f8fd0 : 0xbfd8ff;
  const object = new THREE.Group();
  let update = () => {};
  let light = null;
  const ph = seed * 7.31; // each character keeps its own rhythm
  switch (kind) {
    case C.ELF: {
      // "A woodland Elf armed with a shield and deadly halberd lunges toward you!"
      const f = character('elf', { sex: 'm', height: 1.74, skin: 0xe8cdb0, hair: 0xd8c078, hairStyle: 'long', seed: 0.3 });
      const hb = attach(f, 1, 'wr', halberd(), [0, -0.07, 0.01]);
      const sh = attach(f, 0, 'el', roundShield(), [-0.075, -0.14, 0.02]);
      object.add(f);
      const act = performer(f, 'halberd', (p, t) => {
        const s = t + ph;
        life(p, s, { shift: 0, lookSide: 0.15 });
        // a thrust every few seconds: gather, drive forward, hold, recover
        const u = (s / 3.4) % 1;
        const drive = u < 0.25 ? -0.35 * ease(u / 0.25) : u < 0.4 ? -0.35 + 1.35 * ease((u - 0.25) / 0.15) : u < 0.62 ? 1 : 1 - ease((u - 0.62) / 0.38);
        p.hipY -= 0.05 * Math.max(0, drive);
        p.spineX += 0.12 * drive;
        p.thL[0] -= 0.25 * Math.max(0, drive);
        p.knL += 0.2 * Math.max(0, drive);
        p.thR[0] += 0.15 * Math.max(0, drive);
        p.shR[0] -= 0.35 * drive;
        p.elR += 0.5 * drive;
        p.chestX += 0.06 * drive; // the thrust comes from the hips and the arm; the feet stay planted
      });
      act(0);
      orient(f, hb, [-0.12, -0.12, 1], [0, 1, 0]);
      orient(f, sh, [0, 1, 0], [-0.35, 0, 1]);
      update = act;
      break;
    }
    case C.WOODSMAN: {
      // "a fierce woodsman here brandishing a heavy mallet"
      const f = character('woodsman', { sex: 'm', height: 1.9, skin: 0xd8a080, hair: 0x3a2414, hairStyle: 'short', bulky: 1.16, seed: 0.1 });
      const ml = attach(f, 0, 'wr', mallet(), [0, -0.065, 0.0]);
      object.add(f);
      update = performer(f, 'brandish', (p, t) => {
        const s = t + ph;
        life(p, s, { shift: 0.5, lookSide: 0.25 });
        // shakes the mallet: a slow heave up and back, then a short menacing drop
        const u = (s / 2.8) % 1;
        const heave = u < 0.55 ? ease(u / 0.55) : 1 - ease((u - 0.55) / 0.45);
        p.shL[0] -= 0.18 * heave;
        p.shR[0] -= 0.18 * heave;
        p.elL += 0.12 * heave;
        p.elR += 0.12 * heave;
        p.chestX -= 0.06 * heave;
        p.spineX -= 0.04 * heave;
      });
      update(0);
      // the handle runs from the lower hand through the upper one; the head rides above
      orient(f, ml, palm(f, 1).sub(palm(f, 0)).toArray(), [0, 0, 1]);
      break;
    }
    case C.DARK: {
      // "Out from the shadows a figure leaps! His black cape swirls around, and he
      // holds a laser sword at your chest." An original design: a hooded, armoured
      // figure whose face is only darkness and two violet points.
      const f = character('darklord', { sex: 'm', height: 1.96, seed: 0.5, hairStyle: 'none' });
      const sw = attach(f, 1, 'wr', laserSword(), [0, -0.07, 0.01]);
      object.add(f);
      const cape = f.userData.rig.cape;
      light = { color: 0xa060ff, intensity: 6, distance: 7 };
      const act = performer(f, 'sword', (p, t) => {
        const s = t + ph;
        life(p, s, { shift: 0.35, lookSide: 0.12, breathe: 1.4 });
        // the blade's point circles slowly at your chest
        p.shR[0] += 0.05 * Math.sin(s * 0.9);
        p.shR[1] += 0.06 * Math.sin(s * 0.6 + 1);
        p.wrR += 0.05 * Math.sin(s * 1.1);
      });
      act(0);
      orient(f, sw, [-0.2, 0.22, 1], [0, 1, 0]);
      update = (t) => {
        act(t);
        const s = t + ph;
        if (cape) {
          cape.rotation.x = 0.1 + 0.06 * Math.sin(s * 0.7) + 0.03 * Math.sin(s * 1.9);
          cape.rotation.z = 0.04 * Math.sin(s * 0.5);
        }
      };
      break;
    }
    case C.MAN: {
      // "An unctuous man in a white suit and a dwarf are standing here."
      const man = character('suit', { sex: 'm', height: 1.8, skin: 0xe8c0a0, hair: 0x16110e, hairStyle: 'short', seed: 0.2 });
      object.add(man);
      const dwarf = character('dwarf', { sex: 'm', height: 1.3, legScale: 0.8, bulky: 1.25, skin: 0xe0a888, hair: 0x8a4a22, hairStyle: 'short', seed: 0.7 });
      dwarf.position.set(0.75, 0, 0.15);
      dwarf.rotation.y = -0.3;
      object.add(dwarf);
      const a = performer(man, 'clasp', (p, t) => {
        const s = t + ph;
        life(p, s, { shift: 0.5, lookSide: 0.3 });
        // small ingratiating bows, hands rubbing together
        const bow = Math.max(0, Math.sin(s * 0.45)) ** 3;
        p.spineX += 0.12 * bow;
        p.chestX += 0.06 * bow;
        p.neckX += 0.1 * bow;
        p.wrL += 0.12 * Math.sin(s * 2.2) * (1 - bow);
        p.wrR -= 0.12 * Math.sin(s * 2.2) * (1 - bow);
      });
      const b = performer(dwarf, 'armsCross', (p, t) => {
        const s = t + ph + 11;
        life(p, s, { shift: 0.8, lookSide: 0.45 });
      });
      update = (t) => { a(t); b(t); };
      break;
    }
    case C.GIRL:
    case C.GIRLTALK: {
      // "A swarthy woman with stern features pulls you aside from the crowd" and,
      // at midnight in the gardens, gives you a rope
      const f = character('swarthy', { sex: 'f', height: 1.68, skin: 0xa8704a, hair: 0x16110e, hairStyle: 'long', seed: 0.4 });
      object.add(f);
      const talk = kind === C.GIRLTALK;
      const rope = talk ? attach(f, 1, 'wr', ropeCoil(), [0.0, -0.1, 0.02]) : null;
      update = performer(f, talk ? 'offer' : 'beckon', (p, t) => {
        const s = t + ph;
        life(p, s, { shift: 0.7, lookSide: talk ? 0.2 : 0.45 });
        if (!talk) {
          // a curl of the fingers, twice, then a wait; she glances about
          const u = (s / 4.2) % 1;
          const c = u < 0.4 ? Math.sin((u / 0.4) * TAU * 2) : 0;
          p.elR += 0.35 * Math.max(0, c);
          p.wrR += 0.35 * Math.max(0, c);
        } else {
          // anxious: she keeps looking over her shoulder
          p.neckY += 0.45 * Math.max(0, Math.sin(s * 0.37)) ** 4;
        }
      });
      update(0);
      if (rope) orient(f, rope, [0, 1, 0], [0, 0, 1]);
      break;
    }
    case C.NATIVE: {
      // "A native girl is sitting here." — on the ground, knees drawn up
      const f = character('nativegirl', { sex: 'f', height: 1.62, skin: 0x8a5a3e, hair: 0x120d0a, hairStyle: 'long', seed: 0.6 });
      object.add(f);
      update = performer(f, 'sitGround', (p, t) => {
        const s = t + ph;
        life(p, s, { shift: 0, lookSide: 0.35 });
        p.chestZ += 0.03 * Math.sin(s * 0.3);
        p.headZ += 0.06 * wander(s + 5, 0.6);
      });
      break;
    }
    case C.TIMER: {
      // "An old-timer with one eye missing and no money for a drink sits at the bar."
      const f = character('oldtimer', { sex: 'm', height: 1.72, skin: 0xd8a888, hair: 0x9a9690, hairStyle: 'short', seed: 0.8 });
      object.add(barStool());
      object.add(f);
      const glass = attach(f, 1, 'wr', tumbler(), [-0.01, -0.09, 0.03]);
      update = performer(f, 'stool', (p, t) => {
        const s = t + ph;
        life(p, s, { shift: 0, lookSide: 0.2 });
        // turns the empty glass, looks into it, now and then up at you
        p.wrR += 0.2 * Math.sin(s * 0.5);
        const up = Math.max(0, Math.sin(s * 0.17)) ** 6;
        p.neckX += 0.25 * (1 - up) - 0.15 * up;
        p.chestX += 0.03 * Math.max(0, Math.sin(s * 0.23)) ** 8; // a sigh
      });
      update(0);
      orient(f, glass, [0, 1, 0], [0, 0, 1]);
      break;
    }
    case C.BATHGOD: {
      // Implied presence: a luminous shape, shoulders above the water, half-hidden
      // by steam, a crown of flowers; she steeps and sings softly.
      const lum = silhouetteMat(0xfff0d0, 0x3a2a20, 1.4);
      const f = character('goddess', { sex: 'f', height: 1.66, material: lum, hairStyle: 'long', seed: 0.9 });
      f.position.y = -0.95;
      object.add(f);
      const crown = new THREE.Group();
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * TAU;
        const b = mesh(geo('crown-bloom', () => new THREE.SphereGeometry(0.018, 8, 6)), glowMat([0xffd0e0, 0xfff0b0, 0xffffff][i % 3], 1.4), { pos: [Math.sin(a) * 0.1, 0.17, Math.cos(a) * 0.105], shadow: false });
        crown.add(b);
      }
      f.userData.rig.head.add(crown);
      const halo = glowSprite(0xffe2b0, 3.2, 0.55);
      halo.position.y = 0.4;
      object.add(halo);
      const steam = particles('steam', 70, { quality, seed, spread: [1.6, 0.2, 1.6], size: 140, alpha: 0.28 });
      steam.position.y = -0.2;
      object.add(steam);
      light = { color: 0xffd9a0, intensity: 3, distance: 6 };
      const act = performer(f, 'bathe', (p, t) => {
        const s = t + ph;
        life(p, s, { shift: 0, lookSide: 0.25 });
        p.headZ += 0.08 * Math.sin(s * 0.6); // swaying to her song
        p.chestZ += 0.03 * Math.sin(s * 0.6 + 0.6);
      });
      update = (t) => { steam.userData.tick(t); f.position.y = -0.95 + Math.sin(t * 0.6) * 0.03; act(t); };
      break;
    }
    case C.NORMGOD: {
      // Reclining on ferns, or seated on her throne in the chamber: a gowned figure
      // of warm light, a circlet, glittering motes. She studies you intently.
      const lum = silhouetteMat(0xffe6b8, 0x2a1d14, 1.5);
      const f = character('goddess', { sex: 'f', height: 1.7, material: lum, hairStyle: 'long', seed: 0.9 });
      if (!seated) f.position.z = 0.95; // her hips on the middle of the bed, her shoulders on the bolster
      object.add(f);
      if (!seated) object.add(fernBed(seed)); // "reclining on a bed of ferns"
      f.userData.rig.head.add(mesh(geo('circlet', () => { const q = new THREE.TorusGeometry(0.098, 0.006, 6, 32); q.rotateX(P / 2 - 0.2); return q; }), glowMat(0xfff0c0, 1.6), { pos: [0, 0.15, 0], shadow: false }));
      const halo = glowSprite(0xffd890, 3.2, seated ? 0.14 : 0.45);
      halo.position.y = seated ? 1.3 : 0.9;
      object.add(halo);
      const motes = particles('glitter', 40, { quality, seed, spread: [2.4, 1.6, 1.2], size: 5, alpha: 0.7 });
      motes.position.y = 0.9;
      object.add(motes);
      // lit from in front, so she reads as a figure against the throne, not a flare
      light = { color: 0xffd9a0, intensity: seated ? 9 : 30, distance: 0 };
      const act = performer(f, seated ? 'throne' : 'ferns', (p, t) => {
        const s = t + ph;
        life(p, s, { shift: 0, lookSide: 0.12, look: 0.6 });
      });
      update = (t) => { motes.userData.tick(t); act(t); };
      break;
    }
    default: {
      const f = figure(silhouetteMat(rimCool, 0x08090c, 2.4));
      pose(f, 'stand');
      object.add(f);
    }
  }
  update(0); // posed from the start, not only from the first frame
  return { object, update, light };
}

/**
 * Background people named in descriptions (technicians, guards, dancers...),
 * modelled and clothed (humans.js). With opts.world they take work stations
 * and some walk between them; otherwise the caller places them.
 */
export function crowd(role, count, r, opts = {}) {
  return people(role, count, r, opts);
}
