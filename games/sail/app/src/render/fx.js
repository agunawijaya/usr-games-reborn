// Combat effects: one CPU particle pool drawn as camera-facing instanced
// quads in two passes (alpha-blended smoke/spray/debris, additive fire and
// flashes). Every puff is shaded as a lit sphere with fbm edges, which is
// what makes billboard smoke read as volume. Smoke drifts down the engine's
// wind and lingers across turns, as powder smoke did.

import * as THREE from 'three';
import { NOISE } from './glsl.js';

const T_SMOKE = 0; const T_SPRAY = 1; const T_DEBRIS = 2; const T_CLOTH = 3;
const T_FLASH = 10; const T_FIRE = 11; const T_EMBER = 12;

const vert = /* glsl */ `
attribute vec4 iPos;    // xyz, size
attribute vec4 iColor;  // rgb, alpha
attribute vec4 iParam;  // type, seed, rotation, life 0..1
varying vec4 vColor;
varying vec4 vParam;
varying vec2 vUv;
varying vec3 vView;
void main() {
  vColor = iColor;
  vParam = iParam;
  vUv = position.xy;
  float c = cos(iParam.z);
  float s = sin(iParam.z);
  vec2 q = mat2(c, -s, s, c) * position.xy;
  vec4 mv = viewMatrix * vec4(iPos.xyz, 1.0);
  mv.xy += q * iPos.w;
  vView = mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`;

const frag = /* glsl */ `
precision highp float;
uniform vec3 uSunView;     // sun direction in view space
uniform vec3 uSunColor;
uniform vec3 uAmbient;
uniform float uTime;
uniform float uAdditive;
varying vec4 vColor;
varying vec4 vParam;
varying vec2 vUv;
varying vec3 vView;
${NOISE}
void main() {
  float type = vParam.x;
  float seed = vParam.y;
  float life = vParam.w;
  vec2 p = vUv * 2.0;
  float r = length(p);
  if (uAdditive > 0.5) {
    // flashes, flames, embers: hot core, soft falloff, flickering noise
    float n = fbm(p * 2.2 + seed * 7.0 + vec2(0.0, -uTime * 3.0), 3);
    float a = smoothstep(1.0, 0.0, r + (n - 0.5) * 0.7);
    if (type > 11.5) a = smoothstep(1.0, 0.2, r);
    vec3 col = vColor.rgb * (1.0 + 2.5 * smoothstep(0.6, 0.0, r));
    // AdditiveBlending is (SRC_ALPHA, ONE): alpha must carry the weight
    gl_FragColor = vec4(col, clamp(a * vColor.a, 0.0, 1.0));
    return;
  }
  if (type > 2.5) {
    // scraps of sailcloth
    if (abs(p.x) > 0.8 || abs(p.y) > 0.5) discard;
    gl_FragColor = vec4(vColor.rgb * (0.7 + 0.3 * uSunColor), vColor.a);
    return;
  }
  if (type > 1.5) {
    // splinters and debris: small hard-edged shards
    if (abs(p.x) > 0.25 + 0.2 * sin(seed * 9.0) || abs(p.y) > 0.9) discard;
    gl_FragColor = vec4(vColor.rgb * (0.4 + 0.6 * uSunColor * 0.5 + uAmbient * 0.5), vColor.a);
    return;
  }
  // smoke and spray: a lit, noisy sphere
  float n = fbm(p * 1.6 + seed * 13.0 + vec2(uTime * 0.05, -uTime * 0.08), 4);
  float edge = r + (n - 0.5) * 0.9;
  float a = smoothstep(1.0, 0.35, edge);
  if (a <= 0.003) discard;
  vec3 nrm = normalize(vec3(p * 0.9, sqrt(max(0.0, 1.0 - dot(p, p) * 0.8))));
  float sun = clamp(dot(nrm, uSunView) * 0.5 + 0.5, 0.0, 1.0);
  float dens = smoothstep(0.1, 0.9, n);
  vec3 lit = vColor.rgb * (uAmbient * 0.75 + uSunColor * sun * 0.9);
  // thin edges glow when back-lit
  lit += uSunColor * vColor.rgb * pow(clamp(-uSunView.z, 0.0, 1.0), 2.0) * (1.0 - a) * 0.6;
  lit *= 0.85 + 0.3 * dens;
  float fade = smoothstep(2.0, 12.0, -vView.z); // no puffs glued to the lens
  gl_FragColor = vec4(lit, a * vColor.a * fade);
}
`;

class Pool {
  constructor(max, additive) {
    this.max = max;
    this.n = 0;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.grow = new Float32Array(max);
    this.age = new Float32Array(max);
    this.life = new Float32Array(max);
    this.col = new Float32Array(max * 4);
    this.type = new Uint8Array(max);
    this.seed = new Float32Array(max);
    this.rot = new Float32Array(max);
    this.spin = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.buoy = new Float32Array(max);
    const quad = new THREE.PlaneGeometry(1, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.index = quad.index;
    g.setAttribute('position', quad.getAttribute('position'));
    this.aPos = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.aPar = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iPos', this.aPos);
    g.setAttribute('iColor', this.aCol);
    g.setAttribute('iParam', this.aPar);
    g.instanceCount = 0;
    this.uniforms = {
      uSunView: { value: new THREE.Vector3(0, 1, 0) },
      uSunColor: { value: new THREE.Color(1, 1, 1) },
      uAmbient: { value: new THREE.Color(0.5, 0.55, 0.6) },
      uTime: { value: 0 },
      uAdditive: { value: additive ? 1 : 0 },
    };
    const mat = new THREE.ShaderMaterial({
      vertexShader: vert, fragmentShader: frag, uniforms: this.uniforms,
      transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = additive ? 20 : 10;
    this.geo = g;
    this.order = new Uint32Array(max);
    this.depth = new Float32Array(max);
  }

  spawn(o) {
    let i = this.n;
    if (i >= this.max) {
      // recycle the oldest-relative particle
      let best = 0;
      let bestF = -1;
      for (let k = 0; k < this.n; k++) {
        const f = this.age[k] / this.life[k];
        if (f > bestF) { bestF = f; best = k; }
      }
      i = best;
    } else this.n++;
    this.pos.set(o.p, i * 3);
    this.vel[i * 3] = o.v ? o.v[0] : 0;
    this.vel[i * 3 + 1] = o.v ? o.v[1] : 0;
    this.vel[i * 3 + 2] = o.v ? o.v[2] : 0;
    this.size[i] = o.size;
    this.grow[i] = o.grow || 0;
    this.age[i] = 0;
    this.life[i] = o.life;
    this.col.set(o.c, i * 4);
    this.type[i] = o.type;
    this.seed[i] = Math.random();
    this.rot[i] = Math.random() * 6.28;
    this.spin[i] = (Math.random() - 0.5) * (o.spin || 0.3);
    this.drag[i] = o.drag ?? 0.8;
    this.grav[i] = o.grav || 0;
    this.buoy[i] = o.buoy || 0;
  }

  kill(i) {
    const j = --this.n;
    if (i === j) return;
    this.pos.copyWithin(i * 3, j * 3, j * 3 + 3);
    this.vel.copyWithin(i * 3, j * 3, j * 3 + 3);
    this.col.copyWithin(i * 4, j * 4, j * 4 + 4);
    for (const a of ['size', 'grow', 'age', 'life', 'type', 'seed', 'rot', 'spin', 'drag', 'grav', 'buoy']) this[a][i] = this[a][j];
  }

  update(dt, wind, waterY, camera, sort) {
    for (let i = this.n - 1; i >= 0; i--) {
      this.age[i] += dt;
      if (this.age[i] >= this.life[i]) {
        this.kill(i);
        continue;
      }
      const d = Math.exp(-this.drag[i] * dt);
      const k = i * 3;
      // velocity relaxes toward the wind (smoke drifts, debris falls)
      const wf = this.type[i] === T_DEBRIS ? 0 : 1 - d;
      this.vel[k] = this.vel[k] * d + wind.x * wf;
      this.vel[k + 2] = this.vel[k + 2] * d + wind.z * wf;
      this.vel[k + 1] = this.vel[k + 1] * d + (this.buoy[i] - this.grav[i]) * dt;
      this.pos[k] += this.vel[k] * dt;
      this.pos[k + 1] += this.vel[k + 1] * dt;
      this.pos[k + 2] += this.vel[k + 2] * dt;
      if ((this.type[i] === T_SPRAY || this.type[i] === T_DEBRIS || this.type[i] === T_CLOTH) && this.pos[k + 1] < waterY - 0.5) {
        this.kill(i);
        continue;
      }
      this.size[i] += this.grow[i] * dt;
      this.rot[i] += this.spin[i] * dt;
    }
    // write instances (sorted back to front for the alpha pass)
    const n = this.n;
    const ord = this.order;
    for (let i = 0; i < n; i++) ord[i] = i;
    if (sort && n > 1) {
      const e = camera.matrixWorldInverse.elements;
      for (let i = 0; i < n; i++) {
        const k = i * 3;
        this.depth[i] = e[2] * this.pos[k] + e[6] * this.pos[k + 1] + e[10] * this.pos[k + 2] + e[14];
      }
      const sub = ord.subarray(0, n);
      sub.sort((a, b) => this.depth[a] - this.depth[b]);
    }
    const P = this.aPos.array;
    const C = this.aCol.array;
    const Q = this.aPar.array;
    for (let s = 0; s < n; s++) {
      const i = ord[s];
      const f = this.age[i] / this.life[i];
      P[s * 4] = this.pos[i * 3];
      P[s * 4 + 1] = this.pos[i * 3 + 1];
      P[s * 4 + 2] = this.pos[i * 3 + 2];
      P[s * 4 + 3] = this.size[i];
      const t = this.type[i];
      let a = this.col[i * 4 + 3];
      if (t === T_SMOKE) a *= Math.min(1, f * 12) * (1 - f) * (1 - f * 0.3);
      else if (t === T_FLASH) a *= (1 - f) * (1 - f);
      else if (t === T_FIRE) a *= Math.sin(Math.PI * Math.min(1, f * 1.1));
      else a *= 1 - f * f;
      C[s * 4] = this.col[i * 4];
      C[s * 4 + 1] = this.col[i * 4 + 1];
      C[s * 4 + 2] = this.col[i * 4 + 2];
      C[s * 4 + 3] = a;
      Q[s * 4] = t;
      Q[s * 4 + 1] = this.seed[i];
      Q[s * 4 + 2] = this.rot[i];
      Q[s * 4 + 3] = f;
    }
    this.aPos.needsUpdate = true;
    this.aCol.needsUpdate = true;
    this.aPar.needsUpdate = true;
    this.geo.instanceCount = n;
  }
}

const rnd = (a, b) => a + Math.random() * (b - a);

export function createFx(scene, { quality = 'high', reducedMotion = false } = {}) {
  const hi = quality === 'high';
  const alpha = new Pool(hi ? 3200 : 900, false);
  const add = new Pool(hi ? 1400 : 500, true);
  scene.add(alpha.mesh, add.mesh);
  const smokeScale = hi ? 1 : 0.45;

  // a small pool of point lights for muzzle flashes and fires
  const lights = [];
  for (let i = 0; i < (hi ? 6 : 3); i++) {
    const l = new THREE.PointLight(0xffb060, 0, 120, 1.6);
    scene.add(l);
    lights.push({ l, t: 0, dur: 0.1, peak: 0 });
  }
  let li = 0;
  function pulse(pos, peak, dur, color = 0xffb060) {
    const s = lights[li++ % lights.length];
    s.l.position.copy(pos);
    s.l.color.set(color);
    s.t = 0;
    s.dur = dur;
    s.peak = peak;
  }

  const wind3 = new THREE.Vector3();
  const burning = new Map(); // shipIndex -> { anchor(), intensity, acc }
  const rings = [];

  const api = {
    alpha, add,

    // One gun: flash, a jet of dense white smoke rolling outward, sparks.
    muzzle(pos, dir, { big = 1 } = {}) {
      const up = 0.15;
      add.spawn({ p: [pos.x + dir.x * 1.2, pos.y + 0.2, pos.z + dir.z * 1.2], size: 3.2 * big, life: 0.12, c: [1.0, 0.72, 0.35, 1.4], type: T_FLASH });
      add.spawn({ p: [pos.x + dir.x * 3, pos.y + 0.2, pos.z + dir.z * 3], size: 2.2 * big, life: 0.18, c: [1.0, 0.5, 0.2, 1.0], type: T_FLASH });
      const n = Math.round((hi ? 7 : 3) * big);
      for (let i = 0; i < n; i++) {
        const sp = rnd(9, 26) * (1 - i / (n + 2));
        alpha.spawn({
          p: [pos.x + dir.x * 1.5, pos.y + rnd(-0.2, 0.4), pos.z + dir.z * 1.5],
          v: [dir.x * sp + rnd(-1.5, 1.5), up * sp + rnd(0, 1.2), dir.z * sp + rnd(-1.5, 1.5)],
          size: rnd(2.2, 3.6) * big, grow: rnd(0.9, 1.6) * big, life: rnd(22, 38) * smokeScale + 6,
          c: [0.9, 0.89, 0.86, rnd(0.55, 0.8)], type: T_SMOKE, drag: rnd(1.4, 2.2), buoy: rnd(0.25, 0.6), spin: 0.2,
        });
      }
      for (let i = 0; i < (hi ? 3 : 1); i++) {
        add.spawn({ p: [pos.x + dir.x * 2, pos.y, pos.z + dir.z * 2], v: [dir.x * rnd(30, 60), rnd(0, 6), dir.z * rnd(30, 60)], size: 0.25, life: rnd(0.2, 0.5), c: [1, 0.6, 0.25, 1], type: T_EMBER, drag: 1.2, grav: 9.8 });
      }
    },

    flashLight(pos, strength = 1) { pulse(pos, 60 * strength, 0.14); },

    // A shot falling into the sea: a white column and a ring of spray.
    splash(pos, scale = 1) {
      const n = Math.round((hi ? 26 : 10) * scale);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 6.28;
        const r = rnd(0, 1.2);
        const vy = rnd(8, 22) * scale * (1 - r * 0.4);
        alpha.spawn({ p: [pos.x + Math.cos(a) * r, 0.2, pos.z + Math.sin(a) * r], v: [Math.cos(a) * rnd(1, 4), vy, Math.sin(a) * rnd(1, 4)], size: rnd(1.0, 2.4) * scale, grow: 1.2, life: rnd(1.4, 2.4), c: [0.93, 0.95, 0.97, 0.75], type: T_SPRAY, drag: 0.6, grav: 16 });
      }
      for (let i = 0; i < 4; i++) {
        alpha.spawn({ p: [pos.x + rnd(-2, 2), 0.6, pos.z + rnd(-2, 2)], v: [0, 0.5, 0], size: rnd(2.5, 4) * scale, grow: 2.5, life: rnd(2.5, 4), c: [0.9, 0.93, 0.95, 0.45], type: T_SMOKE, drag: 2, buoy: 0.1 });
      }
    },

    // Shot striking timber: splinters fly, a puff of dust and smoke.
    impact(pos, normal, scale = 1) {
      const n = Math.round((hi ? 18 : 7) * scale);
      for (let i = 0; i < n; i++) {
        alpha.spawn({
          p: [pos.x, pos.y, pos.z],
          v: [normal.x * rnd(4, 14) + rnd(-5, 5), rnd(3, 12), normal.z * rnd(4, 14) + rnd(-5, 5)],
          size: rnd(0.35, 0.9), life: rnd(1.5, 3), c: [0.45, 0.33, 0.2, 1], type: T_DEBRIS, drag: 0.3, grav: 9.8, spin: 12,
        });
      }
      for (let i = 0; i < 3; i++) {
        alpha.spawn({ p: [pos.x + normal.x, pos.y, pos.z + normal.z], v: [normal.x * 3, 1.5, normal.z * 3], size: rnd(1.5, 2.5), grow: 1.6, life: rnd(6, 12), c: [0.55, 0.5, 0.45, 0.6], type: T_SMOKE, drag: 1.5, buoy: 0.4 });
      }
      add.spawn({ p: [pos.x, pos.y, pos.z], size: 2.4 * scale, life: 0.1, c: [1, 0.7, 0.4, 1], type: T_FLASH });
    },

    // Chain shot: cloth scraps and cordage whirling out of the rig.
    shreds(pos, scale = 1) {
      const n = Math.round((hi ? 20 : 8) * scale);
      for (let i = 0; i < n; i++) {
        alpha.spawn({ p: [pos.x + rnd(-4, 4), pos.y + rnd(-4, 4), pos.z + rnd(-4, 4)], v: [rnd(-6, 6), rnd(-1, 5), rnd(-6, 6)], size: rnd(0.8, 2.2), life: rnd(3, 6), c: [0.86, 0.82, 0.72, 1], type: T_CLOTH, drag: 1.4, grav: 3.5, spin: 6 });
      }
    },

    // A ship blowing up: fireball, flying debris, a mushroom of smoke.
    explosion(pos, scale = 1) {
      pulse(pos, 400 * scale, 1.2, 0xffa050);
      for (let i = 0; i < (hi ? 60 : 25); i++) {
        const a = Math.random() * 6.28;
        const s = rnd(4, 26);
        add.spawn({ p: [pos.x + rnd(-6, 6), pos.y + rnd(0, 8), pos.z + rnd(-6, 6)], v: [Math.cos(a) * s * 0.6, rnd(6, 30), Math.sin(a) * s * 0.6], size: rnd(6, 16) * scale, grow: 6, life: rnd(0.8, 2.2), c: [1, rnd(0.45, 0.7), 0.2, 1], type: T_FIRE, drag: 1.8, buoy: 2 });
      }
      for (let i = 0; i < (hi ? 90 : 30); i++) {
        const a = Math.random() * 6.28;
        const s = rnd(8, 45);
        alpha.spawn({ p: [pos.x, pos.y + 4, pos.z], v: [Math.cos(a) * s, rnd(8, 40), Math.sin(a) * s], size: rnd(0.6, 2.5), life: rnd(2, 5), c: [0.22, 0.17, 0.12, 1], type: T_DEBRIS, drag: 0.15, grav: 9.8, spin: 8 });
      }
      for (let i = 0; i < (hi ? 50 : 18); i++) {
        alpha.spawn({ p: [pos.x + rnd(-8, 8), pos.y + rnd(2, 20), pos.z + rnd(-8, 8)], v: [rnd(-3, 3), rnd(6, 16), rnd(-3, 3)], size: rnd(8, 16) * scale, grow: rnd(2, 4), life: rnd(25, 45), c: [0.18, 0.16, 0.15, 0.85], type: T_SMOKE, drag: 0.6, buoy: 0.8 });
      }
      rings.push({ pos: pos.clone(), t: 0 });
      api.splash(pos.clone().add(new THREE.Vector3(12, 0, 0)), 1.6);
      api.splash(pos.clone().add(new THREE.Vector3(-10, 0, 6)), 1.4);
    },

    // Foundering: a burst of spray and bubbles as the hull goes under.
    founder(pos) {
      for (let i = 0; i < (hi ? 40 : 15); i++) {
        alpha.spawn({ p: [pos.x + rnd(-15, 15), 0.3, pos.z + rnd(-15, 15)], v: [rnd(-2, 2), rnd(2, 8), rnd(-2, 2)], size: rnd(2, 5), grow: 2, life: rnd(2, 5), c: [0.92, 0.95, 0.97, 0.6], type: T_SPRAY, drag: 0.9, grav: 6 });
      }
    },

    setFire(index, anchor, intensity) {
      if (intensity <= 0) burning.delete(index);
      else burning.set(index, { anchor, intensity, acc: 0, smoke: 0 });
    },

    update(dt, camera, windVec, windSpeed, sun, sunColor, ambient, time) {
      const drift = 0.8 + windSpeed * 1.6;
      wind3.set(windVec.x * drift, 0, windVec.y * drift);
      // fires: flames licking up from hatches and ports, a black column
      for (const b of burning.values()) {
        b.acc += dt * 30 * b.intensity * (hi ? 1 : 0.5);
        while (b.acc > 1) {
          b.acc -= 1;
          const p = b.anchor();
          add.spawn({ p: [p.x + rnd(-2, 2), p.y + rnd(0, 2), p.z + rnd(-2, 2)], v: [rnd(-1, 1), rnd(5, 11), rnd(-1, 1)], size: rnd(4, 8), grow: -2.2, life: rnd(0.7, 1.4), c: [1, rnd(0.38, 0.6), 0.14, 1], type: T_FIRE, drag: 0.6, buoy: 3 });
          if (Math.random() < 0.3) add.spawn({ p: [p.x + rnd(-6, 6), p.y + 4, p.z + rnd(-6, 6)], v: [rnd(-2, 2), rnd(6, 14), rnd(-2, 2)], size: 0.3, life: rnd(1, 2.5), c: [1, 0.55, 0.2, 1], type: T_EMBER, drag: 0.8, buoy: 1 });
          b.smoke += 0.35;
          if (b.smoke > 1) {
            b.smoke -= 1;
            alpha.spawn({ p: [p.x + rnd(-5, 5), p.y + 6, p.z + rnd(-5, 5)], v: [0, rnd(4, 8), 0], size: rnd(5, 9), grow: rnd(1.5, 2.5), life: rnd(18, 30) * smokeScale + 6, c: [0.16, 0.14, 0.13, 0.8], type: T_SMOKE, drag: 0.5, buoy: 1.2 });
          }
        }
        if (Math.random() < dt * 8) pulse(b.anchor(), 25 * b.intensity, 0.3, 0xff7a30);
      }
      for (const L of lights) {
        L.t += dt;
        const f = Math.max(0, 1 - L.t / L.dur);
        L.l.intensity = L.peak * f * f;
      }
      for (let i = rings.length - 1; i >= 0; i--) {
        rings[i].t += dt;
        if (rings[i].t > 3) rings.splice(i, 1);
      }
      const view = camera.matrixWorldInverse;
      for (const pool of [alpha, add]) {
        pool.uniforms.uSunView.value.copy(sun).transformDirection(view);
        pool.uniforms.uSunColor.value.copy(sunColor);
        pool.uniforms.uAmbient.value.copy(ambient);
        pool.uniforms.uTime.value = time;
      }
      alpha.update(dt, wind3, 0, camera, true);
      add.update(dt, wind3, 0, camera, false);
    },

    clear() {
      alpha.n = 0;
      add.n = 0;
      burning.clear();
    },

    get count() { return alpha.n + add.n; },
  };
  if (reducedMotion) api.reduced = true;
  return api;
}
