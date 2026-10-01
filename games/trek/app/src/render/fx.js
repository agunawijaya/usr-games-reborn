// trek/procedural-web — weapons and explosion effects.
//
//   Beam       phaser: a billboarded ribbon with a white-hot core, a
//              flowing glow, lateral wobble, and a twin written into the
//              distortion target for heat shimmer
//   Bolt       disruptor: a short hot segment racing along its path
//   Torpedo    spiky pulsing head + ember trail + moving point light
//   explosion  flash → shockwave ring (also refracts) → fireball puffs →
//              sparks → tumbling hull debris → cooling ember cloud → smoke;
//              every stage scales with the size of what blew up
//   ping       sensor sweep ring on the ecliptic
//
// Everything lives in world space; one sector cell = one unit.

import * as THREE from 'three';
import { NOISE } from './glsl.js';
import { Particles } from './particles.js';
import { glowSprite } from './parts.js';
import { fxRand } from './rng.js';

const rr = (a, b) => a + (b - a) * fxRand();
const randDir = (flat = 0.35) => {
  const a = fxRand() * Math.PI * 2;
  const y = (fxRand() * 2 - 1) * flat;
  return new THREE.Vector3(Math.cos(a), y, Math.sin(a)).normalize();
};

// ---------------------------------------------------------------------------
// Beam ribbon (shared by phasers and disruptor bolts)
// ---------------------------------------------------------------------------

const SEG = 40;
function ribbonGeometry() {
  const g = new THREE.BufferGeometry();
  const t = [], s = [], idx = [];
  for (let i = 0; i <= SEG; i++) {
    t.push(i / SEG, i / SEG);
    s.push(-1, 1);
    if (i < SEG) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Array((SEG + 1) * 2 * 3).fill(0), 3));
  g.setAttribute('aT', new THREE.Float32BufferAttribute(t, 1));
  g.setAttribute('aSide', new THREE.Float32BufferAttribute(s, 1));
  g.setIndex(idx);
  return g;
}
const RIBBON = ribbonGeometry();

const BEAM_VERT = /* glsl */ `
attribute float aT;
attribute float aSide;
uniform vec3 uA, uB;
uniform float uWidth, uTime, uWobble;
varying float vT;
varying float vSide;
void main() {
  vec3 dir = uB - uA;
  float L = max(length(dir), 1e-4);
  vec3 d = dir / L;
  vec3 p = uA + dir * aT;
  vec3 toCam = normalize(cameraPosition - p);
  vec3 side = normalize(cross(d, toCam) + vec3(1e-5));
  float envelope = sin(aT * 3.14159);
  p += side * sin(aT * L * 9.0 - uTime * 38.0) * uWobble * envelope;
  float w = uWidth * (0.82 + 0.18 * sin(aT * 50.0 - uTime * 70.0));
  p += side * aSide * w;
  vT = aT;
  vSide = aSide;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`;
const BEAM_FRAG = /* glsl */ `
uniform vec3 uCore, uGlow;
uniform float uIntensity, uGrow, uTail, uTime;
varying float vT;
varying float vSide;
void main() {
  if (vT > uGrow || vT < uTail) discard;
  float x = abs(vSide);
  float core = exp(-x * x * 45.0);
  float glow = exp(-x * x * 3.2);
  float flow = 0.72 + 0.28 * sin(vT * 70.0 - uTime * 90.0);
  float head = smoothstep(uGrow, uGrow - 0.04, vT);
  float tail = smoothstep(uTail, uTail + 0.04, vT);
  vec3 c = (uCore * core * 3.0 + uGlow * glow * flow) * uIntensity * head * tail;
  gl_FragColor = vec4(c, 1.0);
}
`;
const SHIMMER_FRAG = NOISE + /* glsl */ `
uniform float uStrength, uTime, uGrow, uTail;
varying float vT;
varying float vSide;
void main() {
  if (vT > uGrow || vT < uTail) discard;
  float x = abs(vSide);
  float m = exp(-x * x * 1.6) * uStrength;
  vec2 n = vec2(vnoise(vec2(vT * 55.0, uTime * 11.0)), vnoise(vec2(vT * 55.0 + 7.3, uTime * 11.0 + 3.1))) - 0.5;
  gl_FragColor = vec4(n * m, 0.0, 1.0);
}
`;

class Beam {
  constructor(fx, from, to, { core = [0.85, 0.97, 1.0], glow = [0.15, 0.7, 1.0], width = 0.075, intensity = 2.6, dur = 0.8, grow = 0.1, wobble = 0.005, shimmer = true }) {
    this.fx = fx;
    this.t0 = fx.time;
    this.dur = dur;
    this.grow = grow;
    const uni = {
      uA: { value: from.clone() }, uB: { value: to.clone() }, uWidth: { value: width }, uTime: { value: 0 },
      uWobble: { value: wobble }, uCore: { value: new THREE.Color(...core) }, uGlow: { value: new THREE.Color(...glow) },
      uIntensity: { value: intensity }, uGrow: { value: 0 }, uTail: { value: 0 },
    };
    this.mat = new THREE.ShaderMaterial({
      vertexShader: BEAM_VERT, fragmentShader: BEAM_FRAG, uniforms: uni,
      blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(RIBBON, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 13;
    fx.scene.add(this.mesh);
    this.intensity = intensity;
    if (shimmer && fx.distortScene) {
      this.smat = new THREE.ShaderMaterial({
        vertexShader: BEAM_VERT, fragmentShader: SHIMMER_FRAG,
        uniforms: {
          uA: uni.uA, uB: uni.uB, uWidth: { value: width * 5 }, uTime: uni.uTime, uWobble: uni.uWobble,
          uStrength: { value: 0.006 }, uGrow: uni.uGrow, uTail: uni.uTail,
        },
        blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide,
      });
      this.smesh = new THREE.Mesh(RIBBON, this.smat);
      this.smesh.frustumCulled = false;
      fx.distortScene.add(this.smesh);
    }
  }
  setEnds(a, b) { this.mat.uniforms.uA.value.copy(a); this.mat.uniforms.uB.value.copy(b); }
  update(t) {
    const age = t - this.t0;
    const u = this.mat.uniforms;
    if (this.source) u.uA.value.copy(this.source());
    u.uTime.value = t;
    u.uGrow.value = Math.min(1.05, age / this.grow);
    const fadeStart = this.dur * 0.7;
    u.uIntensity.value = this.intensity * (age < fadeStart ? 1 : Math.max(0, 1 - (age - fadeStart) / (this.dur - fadeStart)));
    if (this.smat) this.smat.uniforms.uStrength.value = 0.006 * u.uIntensity.value / this.intensity;
    return age < this.dur;
  }
  dispose() {
    this.fx.scene.remove(this.mesh);
    this.mat.dispose();
    if (this.smesh) { this.fx.distortScene.remove(this.smesh); this.smat.dispose(); }
  }
}

// ---------------------------------------------------------------------------
// Shockwave / ping rings
// ---------------------------------------------------------------------------

const RING_VERT = /* glsl */ `
varying vec2 vP;
void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const RING_FRAG = NOISE + /* glsl */ `
uniform vec3 uColor;
uniform float uRadius, uWidth, uAlpha, uSeed;
varying vec2 vP;
void main() {
  float r = length(vP);
  float ang = atan(vP.y, vP.x);
  float breakup = 0.55 + 0.45 * vnoise(vec2(ang * 5.0 + uSeed, r * 2.0));
  float ring = exp(-pow((r - uRadius) / uWidth, 2.0));
  float inner = smoothstep(uRadius, 0.0, r) * 0.12;
  gl_FragColor = vec4(uColor * (ring * breakup + inner * breakup) * uAlpha, 1.0);
}
`;
const RING_DISTORT_FRAG = /* glsl */ `
uniform float uRadius, uWidth, uAlpha;
varying vec2 vP;
void main() {
  float r = length(vP);
  float ring = exp(-pow((r - uRadius) / (uWidth * 1.6), 2.0));
  vec2 dir = r > 1e-4 ? vP / r : vec2(0.0);
  gl_FragColor = vec4(vec2(dir.x, -dir.y) * ring * 0.012 * uAlpha, 0.0, 1.0);
}
`;
const ringGeo = new THREE.PlaneGeometry(2, 2);

class Ring {
  constructor(fx, pos, { maxR = 2, dur = 1, width = 0.08, color = [1, 0.7, 0.4], intensity = 3, distort = false }) {
    this.fx = fx;
    this.t0 = fx.time;
    this.maxR = maxR;
    this.dur = dur;
    this.intensity = intensity;
    this.uni = {
      uColor: { value: new THREE.Color(...color) }, uRadius: { value: 0 }, uWidth: { value: width },
      uAlpha: { value: 0 }, uSeed: { value: fxRand() * 50 },
    };
    this.mat = new THREE.ShaderMaterial({
      vertexShader: RING_VERT, fragmentShader: RING_FRAG, uniforms: this.uni,
      blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(ringGeo, this.mat);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.copy(pos);
    this.mesh.scale.setScalar(maxR * 1.2);
    this.mesh.renderOrder = 11;
    fx.scene.add(this.mesh);
    if (distort && fx.distortScene) {
      this.dmat = new THREE.ShaderMaterial({
        vertexShader: RING_VERT, fragmentShader: RING_DISTORT_FRAG, uniforms: this.uni,
        blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide,
      });
      this.dmesh = new THREE.Mesh(ringGeo, this.dmat);
      this.dmesh.rotation.copy(this.mesh.rotation);
      this.dmesh.position.copy(pos);
      this.dmesh.scale.copy(this.mesh.scale);
      fx.distortScene.add(this.dmesh);
    }
  }
  update(t) {
    const k = (t - this.t0) / this.dur;
    if (k < 0) { this.uni.uAlpha.value = 0; return true; }
    const ease = 1 - Math.pow(1 - Math.min(1, k), 2.2);
    // Radius in the plane's local units (plane spans ±1 → scale maxR·1.2).
    this.uni.uRadius.value = ease / 1.2;
    this.uni.uAlpha.value = this.intensity * Math.pow(1 - Math.min(1, k), 1.5);
    return k < 1;
  }
  dispose() {
    this.fx.scene.remove(this.mesh);
    this.mat.dispose();
    if (this.dmesh) { this.fx.distortScene.remove(this.dmesh); this.dmat.dispose(); }
  }
}

// ---------------------------------------------------------------------------
// Torpedo head
// ---------------------------------------------------------------------------

const HEAD_VERT = /* glsl */ `
uniform float uSize, uRot;
varying vec2 vUv;
void main() {
  float c = cos(uRot), s = sin(uRot);
  vUv = mat2(c, -s, s, c) * position.xy;
  vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  mv.xy += position.xy * uSize;
  gl_Position = projectionMatrix * mv;
}
`;
const HEAD_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uIntensity;
varying vec2 vUv;
void main() {
  float r = length(vUv);
  if (r > 1.0) discard;
  vec2 a = abs(vUv);
  float spikes = exp(-a.x * 40.0) * exp(-a.y * 3.0) + exp(-a.y * 40.0) * exp(-a.x * 3.0);
  float core = exp(-r * r * 90.0) * 6.0 + exp(-r * r * 12.0);
  vec3 c = mix(uColor, vec3(1.0), clamp(core * 0.3, 0.0, 1.0)) * (core + spikes * 0.9) * uIntensity;
  gl_FragColor = vec4(c * smoothstep(1.0, 0.6, r), 1.0);
}
`;

class Torpedo {
  constructor(fx, points, { speed = 7.5, color = [1.0, 0.45, 0.18], onArrive }) {
    this.fx = fx;
    this.points = points;
    this.onArrive = onArrive;
    this.color = color;
    this.lengths = [0];
    for (let i = 1; i < points.length; i++) this.lengths.push(this.lengths[i - 1] + points[i].distanceTo(points[i - 1]));
    this.total = this.lengths[this.lengths.length - 1];
    this.dur = Math.max(0.18, this.total / speed);
    this.t0 = fx.time;
    this.mat = new THREE.ShaderMaterial({
      vertexShader: HEAD_VERT, fragmentShader: HEAD_FRAG,
      uniforms: { uColor: { value: new THREE.Color(...color) }, uIntensity: { value: 3.2 }, uSize: { value: 0.22 }, uRot: { value: 0 } },
      blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
    });
    this.mesh = new THREE.Mesh(ringGeo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 15;
    this.mesh.position.copy(points[0]);
    fx.scene.add(this.mesh);
    this.light = fx.takeLight(new THREE.Color(...color), 3.5, this.dur + 0.1);
    this.prev = points[0].clone();
    this.done = false;
  }
  at(d) {
    let i = 1;
    while (i < this.lengths.length - 1 && this.lengths[i] < d) i++;
    const a = this.points[i - 1], b = this.points[i];
    const seg = this.lengths[i] - this.lengths[i - 1] || 1;
    return a.clone().lerp(b, (d - this.lengths[i - 1]) / seg);
  }
  update(t) {
    const k = Math.min(1, (t - this.t0) / this.dur);
    const p = this.at(k * this.total);
    this.mesh.position.copy(p);
    this.mat.uniforms.uRot.value = t * 3.0;
    this.mat.uniforms.uIntensity.value = 3.2 * (0.85 + 0.15 * Math.sin(t * 40));
    this.light?.position.copy(p);
    // Ember trail: a few motes per frame along the segment travelled.
    const P = this.fx.glow;
    const n = P.n(4);
    for (let i = 0; i < n; i++) {
      const q = this.prev.clone().lerp(p, i / n);
      P.spawn({
        pos: q, vel: randDir(0.6).multiplyScalar(rr(0.05, 0.25)), life: rr(0.35, 0.7),
        size: [rr(0.06, 0.1), 0.01], color: [this.color[0] * 3, this.color[1] * 2.2, this.color[2] * 1.5], color1: [0.6, 0.08, 0.02], drag: 2.5,
      });
    }
    if (fxRand() < 0.35) {
      this.fx.spark.spawn({ pos: p, vel: randDir(0.5).multiplyScalar(rr(0.4, 1.2)), life: rr(0.2, 0.4), size: [0.012, 0.004], stretch: 0.08, color: [3, 1.6, 0.6], color1: [1, 0.2, 0.05], drag: 3 });
    }
    this.prev.copy(p);
    if (k >= 1 && !this.done) {
      this.done = true;
      this.onArrive?.(p);
      return false;
    }
    return true;
  }
  dispose() {
    this.fx.scene.remove(this.mesh);
    this.mat.dispose();
  }
}

// ---------------------------------------------------------------------------
// Debris — tumbling hull shards, instanced
// ---------------------------------------------------------------------------

const shardGeo = (() => {
  const g = new THREE.IcosahedronGeometry(1, 0);
  g.scale(1, 0.35, 0.7);
  return g;
})();

class Debris {
  constructor(fx, pos, scale, { tint = 0x8a8680, count = 24, heatColor = 0xff6020 }) {
    this.fx = fx;
    this.t0 = fx.time;
    this.life = 3.2 + scale * 0.6;
    this.mat = new THREE.MeshStandardMaterial({
      color: tint, roughness: 0.55, metalness: 0.7, flatShading: true,
      emissive: new THREE.Color(heatColor), emissiveIntensity: 2.2, envMapIntensity: 0.8,
    });
    const n = Math.max(6, Math.round(count));
    this.mesh = new THREE.InstancedMesh(shardGeo, this.mat, n);
    this.mesh.frustumCulled = false;
    this.items = [];
    for (let i = 0; i < n; i++) {
      const dir = randDir(0.45);
      this.items.push({
        p: pos.clone().addScaledVector(dir, rr(0.02, 0.2) * scale),
        v: dir.multiplyScalar(rr(0.5, 2.4) * scale),
        axis: randDir(1).normalize(),
        spin: rr(2, 9),
        s: (fxRand() < 0.2 ? rr(0.08, 0.14) : rr(0.02, 0.07)) * Math.sqrt(scale),
        q: new THREE.Quaternion().setFromAxisAngle(randDir(1), fxRand() * 6.28),
      });
    }
    fx.scene.add(this.mesh);
    this.m4 = new THREE.Matrix4();
    this.dq = new THREE.Quaternion();
    this.last = fx.time;
  }
  update(t) {
    const dt = Math.min(0.05, t - this.last);
    this.last = t;
    const age = t - this.t0;
    const k = age / this.life;
    const drag = Math.exp(-dt * 0.9);
    const shrink = k > 0.75 ? Math.max(0, 1 - (k - 0.75) / 0.25) : 1;
    this.mat.emissiveIntensity = 1.6 * Math.exp(-age * 2.6);
    this.items.forEach((d, i) => {
      d.v.multiplyScalar(drag);
      d.p.addScaledVector(d.v, dt);
      this.dq.setFromAxisAngle(d.axis, d.spin * dt);
      d.q.multiply(this.dq);
      this.m4.compose(d.p, d.q, new THREE.Vector3(d.s, d.s, d.s).multiplyScalar(shrink));
      this.mesh.setMatrixAt(i, this.m4);
      // Some shards trail embers early on.
      if (age < 1.2 && i % 3 === 0 && fxRand() < 0.5) {
        this.fx.glow.spawn({ pos: d.p, vel: d.v.clone().multiplyScalar(-0.1), life: rr(0.3, 0.6), size: [0.035, 0.005], color: [2.2, 0.9, 0.25], color1: [0.5, 0.05, 0.0], drag: 2 });
      }
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    return k < 1;
  }
  dispose() {
    this.fx.scene.remove(this.mesh);
    this.mat.dispose();
    this.mesh.dispose();
  }
}

// ---------------------------------------------------------------------------
// FX manager
// ---------------------------------------------------------------------------

export class FX {
  constructor(scene, distortScene, profile) {
    this.scene = scene;
    this.distortScene = profile.shimmer ? distortScene : null;
    this.time = 0;
    const b = profile.particles;
    this.glow = new Particles(Math.round(6000 * b) + 512, 'glow');
    this.spark = new Particles(Math.round(2500 * b) + 256, 'spark');
    this.fire = new Particles(Math.round(600 * b) + 64, 'fire');
    this.smoke = new Particles(Math.round(400 * b) + 64, 'smoke');
    for (const p of [this.glow, this.spark, this.fire, this.smoke]) {
      p.budget = b;
      scene.add(p.mesh);
    }
    // Fixed pool of point lights: a constant light count means no shader
    // recompiles mid-battle.
    this.lights = [0, 1, 2].map(() => {
      const l = new THREE.PointLight(0xffffff, 0, 9, 2);
      scene.add(l);
      return { l, t0: -99, dur: 1, peak: 0 };
    });
    this.items = [];     // anything with update(t) → alive and dispose()
    this.timers = [];    // { at, fn }
    this.shakeAmp = 0;
    this.screenFlash = 0;
    this.reduced = false;
  }

  after(delay, fn) { this.timers.push({ at: this.time + delay, fn }); }

  takeLight(color, peak, dur, pos) {
    let best = this.lights[0];
    for (const L of this.lights) if (L.t0 + L.dur < best.t0 + best.dur) best = L;
    best.l.color.copy(color);
    best.t0 = this.time;
    best.dur = dur;
    best.peak = peak;
    if (pos) best.l.position.copy(pos);
    return best.l;
  }

  shake(a) { if (!this.reduced) this.shakeAmp = Math.min(0.6, this.shakeAmp + a); }
  flash(a) { this.screenFlash = Math.min(this.reduced ? 0.15 : 0.6, this.screenFlash + a); }

  // --- weapons -----------------------------------------------------------

  /** Player phaser: beam + impact sprays for `dur` seconds. */
  phaser(from, to, { dur = 0.85, onImpact, source } = {}) {
    const beam = new Beam(this, from, to, { dur, grow: 0.09 });
    beam.source = source || null;
    this.items.push(beam);
    this.takeLight(new THREE.Color(0.4, 0.8, 1.0), 6, dur, to);
    const burst = () => {
      const n = this.spark.n(6);
      for (let i = 0; i < n; i++) {
        this.spark.spawn({ pos: to, vel: randDir(0.8).multiplyScalar(rr(1, 3)), life: rr(0.15, 0.35), size: [0.014, 0.004], stretch: 0.06, color: [2.4, 3.2, 4], color1: [0.3, 0.6, 1.2], drag: 4 });
      }
      this.glow.spawn({ pos: to, vel: new THREE.Vector3(), life: 0.18, size: [0.35, 0.2], color: [1.5, 2.6, 3.4], color1: [0.1, 0.3, 0.8] });
    };
    for (let k = 0.1; k < dur * 0.8; k += 0.07) this.after(k, burst);
    if (onImpact) this.after(0.1, onImpact);
    return beam;
  }

  /** Disruptor bolt from → to; calls onImpact at arrival. */
  bolt(from, to, { color = [1.0, 0.35, 0.12], speed = 13, onImpact } = {}) {
    const dist = from.distanceTo(to);
    const dur = Math.max(0.12, dist / speed);
    const dir = to.clone().sub(from).normalize();
    const len = Math.min(0.55, dist * 0.35);
    const beam = new Beam(this, from, from, { core: [1.0, 0.85, 0.7], glow: color, width: 0.04, intensity: 3.2, dur: dur + 0.05, grow: 0.001, wobble: 0, shimmer: false });
    const t0 = this.time;
    const self = this;
    const item = {
      update(t) {
        const k = Math.min(1, (t - t0) / dur);
        const head = from.clone().lerp(to, k);
        const tail = head.clone().addScaledVector(dir, -len);
        if (tail.distanceTo(from) > head.distanceTo(from)) tail.copy(from);
        beam.setEnds(tail, head);
        beam.mat.uniforms.uGrow.value = 1.05;
        beam.mat.uniforms.uIntensity.value = 3.2;
        beam.mat.uniforms.uTime.value = t;
        if (k >= 1) { onImpact?.(to); return false; }
        return true;
      },
      dispose() { beam.dispose(); },
    };
    this.items.push(item);
    // muzzle flash
    this.glow.spawn({ pos: from, vel: new THREE.Vector3(), life: 0.14, size: [0.22, 0.1], color: [color[0] * 4, color[1] * 4, color[2] * 4], color1: [0.4, 0.05, 0] });
    void self;
  }

  torpedo(points, opts) {
    const t = new Torpedo(this, points, opts);
    this.items.push(t);
    this.glow.spawn({ pos: points[0], vel: new THREE.Vector3(), life: 0.2, size: [0.3, 0.1], color: [4, 2, 0.8], color1: [0.5, 0.1, 0] });
    return t;
  }

  /** Metal sparks off a hull (hits that got through the shields). */
  hullSparks(pos, normal, amount = 1) {
    const n = this.spark.n(26 * amount);
    for (let i = 0; i < n; i++) {
      const v = normal.clone().multiplyScalar(rr(0.6, 1.6)).add(randDir(0.9).multiplyScalar(rr(0.4, 1.4))).multiplyScalar(rr(0.8, 2.6));
      this.spark.spawn({ pos, vel: v, life: rr(0.25, 0.7), size: [0.013, 0.003], stretch: 0.07, color: [4, 2.6, 1.2], color1: [1.2, 0.25, 0.04], drag: 2.2 });
    }
    for (let i = 0; i < this.fire.n(2 * amount); i++) {
      this.fire.spawn({ pos: pos.clone().addScaledVector(randDir(0.3), 0.04), vel: normal.clone().multiplyScalar(rr(0.1, 0.35)), life: rr(0.4, 0.7), size: [0.08, 0.2], color: [1, 1, 1], drag: 1.5 });
    }
    this.takeLight(new THREE.Color(1, 0.55, 0.25), 5 * amount, 0.35, pos);
  }

  /**
   * Multi-stage explosion.
   * @param scale ~1 for a warship, 1.6 for a super-commander, 3 for a starbase
   */
  explosion(pos, scale = 1, { tint = 0x8a8680 } = {}) {
    const s = scale;
    const P = pos.clone();
    // 1. flash
    const flash = glowSprite(0xfff0d8, 0.5 * s, 10, { core: 4, falloff: 5, depthTest: false });
    flash.position.copy(P);
    this.scene.add(flash);
    const f0 = this.time;
    this.items.push({
      update: (t) => {
        const k = (t - f0) / 0.3;
        flash.material.uniforms.uIntensity.value = 10 * Math.max(0, 1 - k) ** 2.5;
        flash.material.uniforms.uSize.value = (0.45 + k * 0.6) * s;
        return k < 1;
      },
      dispose: () => { this.scene.remove(flash); flash.material.dispose(); },
    });
    this.takeLight(new THREE.Color(1, 0.7, 0.45), 45 * s, 0.9 + 0.2 * s, P);
    this.flash(0.12 * s);
    this.shake(0.12 * s);

    // 2. shockwave ring (+ refraction)
    this.items.push(new Ring(this, P, { maxR: 2.4 * s, dur: 0.7 + 0.12 * s, width: 0.016, color: [1.1, 1.05, 1.2], intensity: 1.0, distort: true }));
    if (s > 1.2) this.after(0.12, () => this.items.push(new Ring(this, P, { maxR: 3.2 * s, dur: 1.3, width: 0.012, color: [1.0, 0.55, 0.3], intensity: 0.7 })));

    // 3. fireball puffs
    const nf = this.fire.n(18 * s);
    for (let i = 0; i < nf; i++) {
      const d = randDir(0.5);
      const core = i < nf * 0.3;
      this.fire.spawn({
        pos: P.clone().addScaledVector(d, rr(0, core ? 0.08 : 0.22) * s), vel: d.multiplyScalar(rr(core ? 0.1 : 0.4, core ? 0.5 : 1.5) * s),
        life: rr(0.9, 1.8) * (0.8 + 0.2 * s), size: [rr(0.3, 0.5) * s, rr(core ? 0.8 : 0.6, core ? 1.2 : 1.0) * s], color: core ? [1.1, 1.05, 1.0] : [0.85, 0.8, 0.8], drag: 2.2, delay: rr(0, 0.1),
      });
    }
    // 4. sparks
    const ns = this.spark.n(70 * s);
    for (let i = 0; i < ns; i++) {
      this.spark.spawn({ pos: P, vel: randDir(0.55).multiplyScalar(rr(2, 7) * Math.sqrt(s)), life: rr(0.3, 0.9), size: [0.016, 0.004], stretch: 0.06, color: [3.2, 2.2, 1.3], color1: [1.2, 0.25, 0.04], drag: 1.8 });
    }
    // 5. debris
    this.items.push(new Debris(this, P, s, { tint, count: 22 * s * this.glow.budget + 6 }));
    // 6. embers
    const ne = this.glow.n(140 * s);
    for (let i = 0; i < ne; i++) {
      this.glow.spawn({
        pos: P.clone().addScaledVector(randDir(0.5), rr(0, 0.3) * s), vel: randDir(0.5).multiplyScalar(rr(0.15, 1.0) * s),
        life: rr(1.6, 3.8), size: [rr(0.02, 0.05), 0.004], color: [3.2, 1.3, 0.35], color1: [0.35, 0.03, 0.0], drag: 0.9, delay: rr(0.05, 0.4),
      });
    }
    // 7. smoke
    const nk = this.smoke.n(10 * s);
    for (let i = 0; i < nk; i++) {
      const d = randDir(0.4);
      this.smoke.spawn({ pos: P.clone().addScaledVector(d, rr(0.05, 0.3) * s), vel: d.multiplyScalar(rr(0.1, 0.4) * s), life: rr(2.2, 3.6), size: [0.45 * s, 1.35 * s], color: [0.16, 0.12, 0.1], color1: [0.07, 0.07, 0.08], drag: 0.7, delay: rr(0.12, 0.4) });
    }
    // Secondary blasts for big hulls.
    if (s > 1.3) {
      for (const [dt, off] of [[0.28, 0.5], [0.55, 0.7], [0.85, 0.4]]) {
        this.after(dt, () => this.smallBlast(P.clone().addScaledVector(randDir(0.2), off * s * 0.6), 0.45 * s));
      }
    }
  }

  smallBlast(pos, s = 0.5) {
    this.takeLight(new THREE.Color(1, 0.6, 0.3), 14 * s, 0.4, pos);
    for (let i = 0; i < this.fire.n(5); i++) {
      const d = randDir(0.5);
      this.fire.spawn({ pos, vel: d.multiplyScalar(rr(0.2, 0.8) * s), life: rr(0.5, 0.9), size: [0.2 * s, 0.6 * s], color: [1, 1, 1], drag: 2 });
    }
    for (let i = 0; i < this.spark.n(20); i++) {
      this.spark.spawn({ pos, vel: randDir(0.5).multiplyScalar(rr(1.5, 4)), life: rr(0.2, 0.5), size: [0.014, 0.003], stretch: 0.06, color: [4, 2.8, 1.4], color1: [1, 0.2, 0.03], drag: 2 });
    }
  }

  /** Expanding sensor ring. */
  ping(pos, maxR = 6, color = [0.3, 0.9, 1.2], dur = 1.4, intensity = 1.2) {
    this.items.push(new Ring(this, pos, { maxR, dur, width: 0.03, color, intensity }));
  }

  update(t) {
    const dt = Math.min(0.1, Math.max(0, t - this.time));
    this.time = t;
    for (let i = this.timers.length - 1; i >= 0; i--) {
      if (this.timers[i].at <= t) {
        const fn = this.timers[i].fn;
        this.timers.splice(i, 1);
        fn();
      }
    }
    for (let i = this.items.length - 1; i >= 0; i--) {
      if (!this.items[i].update(t)) {
        this.items[i].dispose();
        this.items.splice(i, 1);
      }
    }
    for (const L of this.lights) {
      const k = (t - L.t0) / L.dur;
      L.l.intensity = k >= 0 && k < 1 ? L.peak * (1 - k) * (1 - k) : 0;
    }
    for (const p of [this.glow, this.spark, this.fire, this.smoke]) p.update(t);
    this.shakeAmp *= Math.exp(-dt * 6);
    this.screenFlash *= Math.exp(-dt * 7);
  }

  get busy() { return this.items.length > 0 || this.timers.length > 0; }

  /** Drop every live effect. Timers survive by default: a warp clears the
   *  old quadrant's visuals but the arrival return-fire is still queued. */
  clear({ timers = false } = {}) {
    for (const it of this.items) it.dispose();
    this.items = [];
    if (timers) this.timers = [];
    for (const p of [this.glow, this.spark, this.fire, this.smoke]) p.clear();
  }
}
