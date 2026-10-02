// The people on deck: gun crews at the upper-deck guns, hands running fore and aft along the
// gangways, officers on the quarterdeck. One instanced mesh per ship, every figure animated in
// the vertex shader (strides, swinging arms, the lean back as their guns fire), so the cost is one
// draw call a ship and no work on the CPU each frame. How many stand on deck follows the engine's
// crew count; no one is ever shown falling: casualties only thin the crowd (all-ages content).

import * as THREE from 'three';

const lerp = (a, b, t) => a + (b - a) * t;

/** Figures on a full-strength deck, by class (1 first rate … 6 brig). */
const FULL_CREW = { 1: 48, 2: 40, 3: 30, 4: 24, 5: 18, 6: 14 };
const ROLE = { stand: 0, run: 1, gun: 2 };

/** One figure, 1.75 m tall, facing +z: torso, head, two legs and two arms, each part tagged. */
function figureGeometry() {
  const parts = [];
  const box = (w, h, d, x, y, part, tint) => {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(x, y, 0);
    const n = g.attributes.position.count;
    g.setAttribute('part', new THREE.Float32BufferAttribute(new Array(n).fill(part), 1));
    g.setAttribute('tint', new THREE.Float32BufferAttribute(new Array(n).fill(tint), 1));
    parts.push(g);
  };
  box(0.42, 0.62, 0.26, 0, 1.17, 0, 0); // torso, shirt
  box(0.24, 0.26, 0.24, 0, 1.62, 1, 2); // head, skin
  box(0.15, 0.82, 0.17, -0.11, 0.41, 2, 1); // left leg, trousers
  box(0.15, 0.82, 0.17, 0.11, 0.41, 3, 1); // right leg
  box(0.11, 0.62, 0.12, -0.28, 1.15, 4, 0); // left arm, sleeve
  box(0.11, 0.62, 0.12, 0.28, 1.15, 5, 0); // right arm
  const merged = new THREE.BufferGeometry();
  const attrs = ['position', 'normal', 'part', 'tint'];
  for (const name of attrs) {
    const size = parts[0].attributes[name].itemSize;
    const all = [];
    for (const g of parts) all.push(...g.attributes[name].array);
    merged.setAttribute(name, new THREE.Float32BufferAttribute(all, size));
  }
  let offset = 0;
  const index = [];
  for (const g of parts) {
    for (const i of g.index.array) index.push(i + offset);
    offset += g.attributes.position.count;
  }
  merged.setIndex(index);
  return merged;
}

const SHIRTS = ['#e9e4d6', '#d8d2c0', '#3b4f73', '#e9e4d6', '#8a2f25', '#cfc8b2', '#2f3a52'];
const PANTS = ['#e3ddca', '#cfc6ae', '#3a3f4a', '#d9d2bd'];
const SKIN = ['#f1c7a5', '#d9a17a', '#a8704a', '#7a4b2c', '#e8b68f', '#5d3a22'];
const COAT = '#1d2a4a';

function crewMaterial(uniforms) {
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute float part;
attribute float tint;
attribute vec3 aFrom;
attribute vec3 aTo;
attribute vec4 aJob;   // role, phase, speed (m/s), side (+1 starboard, -1 port)
attribute vec3 aShirt;
attribute vec3 aPants;
attribute vec3 aSkin;
uniform float uTime;
uniform float uCalm;   // 1: nobody runs (struck, or reduced motion)
uniform float uStill;  // 1: not even a sway (reduced motion)
uniform vec2 uFire;    // when the port and starboard guns last fired
varying vec3 vCrewColor;
vec3 rotX(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(p.x, p.y * c - p.z * s, p.y * s + p.z * c); }
vec3 rotY(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(p.x * c + p.z * s, p.y, -p.x * s + p.z * c); }
// Where a figure stands this frame, which way it faces, and how its limbs swing.
void crewPose(out vec3 at, out float yaw, out float gait, out float lean) {
  float role = aJob.x;
  gait = 0.0;
  lean = 0.0;
  at = aFrom;
  yaw = aJob.y * 6.2831;
  if (role > 0.5 && role < 1.5 && uCalm < 0.5) {
    float len = max(0.5, distance(aFrom.xz, aTo.xz));
    float s = fract(aJob.y + uTime * aJob.z / (2.0 * len));
    float t = s < 0.5 ? s * 2.0 : 2.0 - s * 2.0;
    at = mix(aFrom, aTo, t);
    vec2 d = s < 0.5 ? aTo.xz - aFrom.xz : aFrom.xz - aTo.xz;
    yaw = atan(d.x, d.y);
    gait = uTime * aJob.z * 3.2 + aJob.y * 40.0;
  } else if (role > 1.5) {
    // gun crews face their gun; when it fires they recoil from it and lean on the tackle
    yaw = aJob.w > 0.0 ? 1.5708 : -1.5708;
    float since = uTime - (aJob.w > 0.0 ? uFire.y : uFire.x);
    lean = since >= 0.0 ? exp(-since * 1.6) * 0.45 : 0.0;
    lean += (1.0 - uStill) * 0.06 * sin(uTime * 1.3 + aJob.y * 30.0);
  } else {
    lean = (1.0 - uStill) * 0.03 * sin(uTime * 0.9 + aJob.y * 17.0);
  }
}
vec3 crewTransform(vec3 p, bool isNormal) {
  vec3 at; float yaw; float gait; float lean;
  crewPose(at, yaw, gait, lean);
  float swing = sin(gait);
  if (part > 1.5 && part < 2.5) { vec3 hip = vec3(0.0, 0.82, 0.0); p = isNormal ? rotX(p, swing * 0.7) : rotX(p - hip, swing * 0.7) + hip; }
  if (part > 2.5 && part < 3.5) { vec3 hip = vec3(0.0, 0.82, 0.0); p = isNormal ? rotX(p, -swing * 0.7) : rotX(p - hip, -swing * 0.7) + hip; }
  if (part > 3.5 && part < 4.5) { vec3 sh = vec3(0.0, 1.45, 0.0); p = isNormal ? rotX(p, -swing * 0.6 - lean * 1.6) : rotX(p - sh, -swing * 0.6 - lean * 1.6) + sh; }
  if (part > 4.5) { vec3 sh = vec3(0.0, 1.45, 0.0); p = isNormal ? rotX(p, swing * 0.6 - lean * 1.6) : rotX(p - sh, swing * 0.6 - lean * 1.6) + sh; }
  // the whole body leans back from the hips; a runner bobs with each stride
  p = rotX(p, -lean);
  p = rotY(p, yaw);
  if (!isNormal) p += at + vec3(0.0, abs(swing) * 0.05 * step(0.001, abs(gait)), 0.0);
  return p;
}`)
      .replace('#include <beginnormal_vertex>', `vec3 objectNormal = crewTransform(normal, true);
#ifdef USE_TANGENT
vec3 objectTangent = vec3( tangent.xyz );
#endif`)
      .replace('#include <begin_vertex>', `vec3 transformed = crewTransform(position, false);
vCrewColor = tint < 0.5 ? aShirt : tint < 1.5 ? aPants : aSkin;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCrewColor;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= vCrewColor;');
  };
  return mat;
}

/** A small fixed shuffle, so the same figures leave the deck first as the crew falls. */
function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Lays out a crew on the hull's upper deck. `h` is the hull (hull.js); `share` scales the numbers
 * (1 on High, less on Low). Returns the mesh and the knobs ship.js turns.
 */
export function buildCrew(h, { share = 1, seed = 1, reduced: reducedAtStart = false, cls = 3 } = {}) {
  let reduced = reducedAtStart;
  let calm = false;
  const { form, deckY, deckX, ports } = h;
  const rnd = mulberry(seed * 2654435761);
  const total = Math.max(4, Math.round((FULL_CREW[cls] ?? FULL_CREW[3]) * share));
  const at = (u, x) => new THREE.Vector3(x, deckY(u), form.zOf(u));
  const jobs = [];

  // gun crews at the upper deck's guns, one figure for every other gun
  const top = Math.max(...ports.map((p) => p.deck));
  const upper = ports.filter((p) => p.deck === top);
  for (const side of [1, -1]) {
    upper.forEach((p, i) => {
      if (i % 2) return;
      const x = side * Math.max(0.6, deckX(p.u) - 1.3);
      jobs.push({ role: ROLE.gun, from: at(p.u, x), to: at(p.u, x), side });
    });
  }
  // hands running the gangways, clear of the masts and boats on the centreline
  const runners = Math.round(total * 0.4);
  for (let i = 0; i < runners; i++) {
    const side = i % 2 ? 1 : -1;
    const u0 = lerp(0.18, 0.45, rnd());
    const u1 = lerp(0.55, 0.85, rnd());
    const x = side * deckX(0.5) * lerp(0.35, 0.55, rnd());
    jobs.push({ role: ROLE.run, from: at(u0, x * (deckX(u0) / deckX(0.5))), to: at(u1, x * (deckX(u1) / deckX(0.5))), side });
  }
  // officers on the quarterdeck, by the wheel
  for (let i = 0; i < 3; i++) {
    const u = lerp(0.08, 0.2, rnd());
    jobs.push({ role: ROLE.stand, from: at(u, (rnd() - 0.5) * deckX(u) * 1.2), to: null, side: 0, officer: true });
  }
  // shuffle so that a thinning crew loses some of every kind, then keep the first `total`
  for (let i = jobs.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [jobs[i], jobs[j]] = [jobs[j], jobs[i]];
  }
  jobs.length = Math.min(jobs.length, total);

  const geo = new THREE.InstancedBufferGeometry().copy(figureGeometry());
  const n = jobs.length;
  const from = new Float32Array(n * 3);
  const to = new Float32Array(n * 3);
  const job = new Float32Array(n * 4);
  const shirt = new Float32Array(n * 3);
  const pants = new Float32Array(n * 3);
  const skin = new Float32Array(n * 3);
  const c = new THREE.Color();
  jobs.forEach((j, i) => {
    j.from.toArray(from, i * 3);
    (j.to ?? j.from).toArray(to, i * 3);
    job.set([j.role, rnd(), 1.6 + rnd() * 1.6, j.side], i * 4);
    c.set(j.officer ? COAT : SHIRTS[Math.floor(rnd() * SHIRTS.length)]).toArray(shirt, i * 3);
    c.set(j.officer ? '#e9e4d6' : PANTS[Math.floor(rnd() * PANTS.length)]).toArray(pants, i * 3);
    c.set(SKIN[Math.floor(rnd() * SKIN.length)]).toArray(skin, i * 3);
  });
  geo.setAttribute('aFrom', new THREE.InstancedBufferAttribute(from, 3));
  geo.setAttribute('aTo', new THREE.InstancedBufferAttribute(to, 3));
  geo.setAttribute('aJob', new THREE.InstancedBufferAttribute(job, 4));
  geo.setAttribute('aShirt', new THREE.InstancedBufferAttribute(shirt, 3));
  geo.setAttribute('aPants', new THREE.InstancedBufferAttribute(pants, 3));
  geo.setAttribute('aSkin', new THREE.InstancedBufferAttribute(skin, 3));
  geo.instanceCount = n;

  const uniforms = {
    uTime: { value: 0 },
    uCalm: { value: reduced ? 1 : 0 },
    uStill: { value: reduced ? 1 : 0 },
    uFire: { value: new THREE.Vector2(-99, -99) },
  };
  const mesh = new THREE.Mesh(geo, crewMaterial(uniforms));
  // the figures are placed in the shader: the mesh's own bounds mean nothing to the culler
  mesh.frustumCulled = false;
  return {
    mesh,
    /** Show the share of the crew still aboard (0..1). */
    setStrength(fraction) {
      geo.instanceCount = Math.max(0, Math.min(n, Math.round(n * fraction)));
    },
    setCalm(on) {
      calm = on;
      uniforms.uCalm.value = calm || reduced ? 1 : 0;
    },
    /** Reduced motion, which the Hall can switch while the battle runs: everyone stands still. */
    setReduced(on) {
      reduced = on;
      uniforms.uCalm.value = calm || reduced ? 1 : 0;
      uniforms.uStill.value = reduced ? 1 : 0;
    },
    tick(time) {
      uniforms.uTime.value = time;
    },
    fired(side, time) {
      if (side === 'L') uniforms.uFire.value.x = time;
      else uniforms.uFire.value.y = time;
    },
  };
}
