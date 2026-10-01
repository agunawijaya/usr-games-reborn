// trek/procedural-web — GPU ballistic particles.
//
// Every particle is fully described at spawn time (origin, velocity, drag,
// birth time, lifetime, size and colour ramps). The vertex shader
// integrates its motion analytically — p(t) = p0 + v0·(1 − e^(−k·t))/k —
// so the CPU only writes a particle once, into a ring buffer, and never
// touches it again. One class serves four looks:
//   'glow'   soft additive dots (embers, torpedo trails, scan motes)
//   'spark'  additive streaks stretched along their screen-space velocity
//   'fire'   additive noise-shaded fireball puffs with a heat ramp
//   'smoke'  normally-blended dark puffs that cool and spread

import * as THREE from 'three';
import { NOISE, HEAT } from './glsl.js';
import { fxRand } from './rng.js';

const VERT = /* glsl */ `
attribute vec3 aP0;
attribute vec3 aV;
attribute vec2 aTime;      // birth, life
attribute vec3 aCol0;
attribute vec3 aCol1;
attribute vec4 aSize;      // size0, size1, stretch, drag
attribute vec2 aExtra;     // seed, gravity (towards −Y)
uniform float uTime;
varying vec3 vCol;
varying vec2 vUv;
varying float vK;
varying float vSeed;
void main() {
  float age = uTime - aTime.x;
  float life = aTime.y;
  if (age < 0.0 || age > life) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float k = age / life;
  float drag = aSize.w;
  float f = drag > 1e-3 ? (1.0 - exp(-drag * age)) / drag : age;
  vec3 p = aP0 + aV * f - vec3(0.0, aExtra.y * age * age * 0.5, 0.0);
  vec3 v = aV * exp(-drag * age);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float size = mix(aSize.x, aSize.y, k);
  vec2 corner = position.xy;
  if (aSize.z > 0.0) {
    vec3 vv = (modelViewMatrix * vec4(v, 0.0)).xyz;
    float sp = length(vv.xy);
    vec2 dir = sp > 1e-4 ? vv.xy / sp : vec2(1.0, 0.0);
    vec2 nrm = vec2(-dir.y, dir.x);
    float len = size + sp * aSize.z;
    mv.xy += dir * corner.x * len + nrm * corner.y * size;
  } else {
    mv.xy += corner * size;
  }
  gl_Position = projectionMatrix * mv;
  vCol = mix(aCol0, aCol1, k);
  vUv = corner;
  vK = k;
  vSeed = aExtra.x;
}
`;

const FRAG_GLOW = /* glsl */ `
varying vec3 vCol; varying vec2 vUv; varying float vK;
void main() {
  float r2 = dot(vUv, vUv);
  if (r2 > 1.0) discard;
  float a = exp(-r2 * 4.0) * pow(1.0 - vK, 1.4);
  gl_FragColor = vec4(vCol * a, 1.0);
}
`;

const FRAG_SPARK = /* glsl */ `
varying vec3 vCol; varying vec2 vUv; varying float vK;
void main() {
  float a = exp(-vUv.y * vUv.y * 6.0) * smoothstep(1.0, 0.3, abs(vUv.x)) * pow(1.0 - vK, 1.2);
  gl_FragColor = vec4(vCol * a, 1.0);
}
`;

const FRAG_FIRE = NOISE + HEAT + /* glsl */ `
uniform float uTime;
varying vec3 vCol; varying vec2 vUv; varying float vK; varying float vSeed;
void main() {
  float r = length(vUv);
  if (r > 1.0) discard;
  float n = fbm2(vUv * 2.4 + vec2(vSeed * 17.0, vSeed * 5.0) + vec2(0.0, -uTime * 0.5));
  float n2 = vnoise(vUv * 7.0 + vSeed * 31.0 - uTime * 1.3);
  // Ragged, billowing silhouette; hotter where the noise is dense.
  float shape = smoothstep(1.0, 0.2, r + (n - 0.5) * 1.3 + (n2 - 0.5) * 0.35);
  float heat = clamp((1.0 - vK * 1.35) * (0.4 + n * 1.0) - r * 0.5, 0.0, 1.0);
  vec3 c = heatRamp(heat) * (0.14 + heat * 1.15);
  float a = shape * (1.0 - smoothstep(0.45, 1.0, vK)) * (0.55 + 0.45 * n2);
  gl_FragColor = vec4(c * vCol * a, 1.0);
}
`;

const FRAG_SMOKE = NOISE + /* glsl */ `
uniform float uTime;
varying vec3 vCol; varying vec2 vUv; varying float vK; varying float vSeed;
void main() {
  float r = length(vUv);
  if (r > 1.0) discard;
  float n = fbm2(vUv * 2.0 + vSeed * 13.0 + uTime * 0.05);
  float shape = smoothstep(1.0, 0.2, r + (n - 0.5) * 0.8);
  float a = shape * 0.55 * smoothstep(0.0, 0.12, vK) * (1.0 - smoothstep(0.5, 1.0, vK));
  gl_FragColor = vec4(vCol, a);
}
`;

const FRAGS = { glow: FRAG_GLOW, spark: FRAG_SPARK, fire: FRAG_FIRE, smoke: FRAG_SMOKE };

export class Particles {
  constructor(capacity = 2048, kind = 'glow') {
    this.capacity = capacity;
    this.kind = kind;
    const g = new THREE.InstancedBufferGeometry();
    const quad = new THREE.PlaneGeometry(2, 2);
    g.index = quad.index;
    g.setAttribute('position', quad.attributes.position);
    const A = (n) => {
      const a = new THREE.InstancedBufferAttribute(new Float32Array(capacity * n), n);
      a.setUsage(THREE.DynamicDrawUsage);
      return a;
    };
    this.attr = {
      aP0: A(3), aV: A(3), aTime: A(2), aCol0: A(3), aCol1: A(3), aSize: A(4), aExtra: A(2),
    };
    for (const [k, v] of Object.entries(this.attr)) g.setAttribute(k, v);
    // Park every slot as already dead.
    this.attr.aTime.array.fill(-1e9);
    g.instanceCount = capacity;
    this.geometry = g;
    const smoke = kind === 'smoke';
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAGS[kind],
      uniforms: { uTime: { value: 0 } },
      blending: smoke ? THREE.NormalBlending : THREE.AdditiveBlending,
      transparent: true, depthWrite: false,
    });
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = smoke ? 5 : 12;
    this.cursor = 0;
    this.dirtyLo = Infinity;
    this.dirtyHi = -1;
    this.time = 0;
    this.budget = 1;   // quality scale for spawn counts (profile.particles)
  }

  /**
   * @param o { pos, vel, life, size:[s0,s1], color:[r,g,b], color1?, drag?, stretch?, gravity?, delay? }
   */
  spawn(o) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.capacity;
    const a = this.attr;
    a.aP0.setXYZ(i, o.pos.x, o.pos.y, o.pos.z);
    a.aV.setXYZ(i, o.vel?.x ?? 0, o.vel?.y ?? 0, o.vel?.z ?? 0);
    a.aTime.setXY(i, this.time + (o.delay ?? 0), o.life);
    const c0 = o.color, c1 = o.color1 ?? o.color;
    a.aCol0.setXYZ(i, c0[0], c0[1], c0[2]);
    a.aCol1.setXYZ(i, c1[0], c1[1], c1[2]);
    a.aSize.setXYZW(i, o.size[0], o.size[1], o.stretch ?? 0, o.drag ?? 0);
    a.aExtra.setXY(i, o.seed ?? fxRand(), o.gravity ?? 0);
    this.dirtyLo = Math.min(this.dirtyLo, i);
    this.dirtyHi = Math.max(this.dirtyHi, i);
  }

  /** How many to spawn for a requested count, scaled by quality. */
  n(count) { return Math.max(1, Math.round(count * this.budget)); }

  update(time) {
    this.time = time;
    this.material.uniforms.uTime.value = time;
    if (this.dirtyHi >= 0) {
      for (const a of Object.values(this.attr)) {
        a.clearUpdateRanges();
        a.addUpdateRange(this.dirtyLo * a.itemSize, (this.dirtyHi - this.dirtyLo + 1) * a.itemSize);
        a.needsUpdate = true;
      }
      this.dirtyLo = Infinity;
      this.dirtyHi = -1;
    }
  }

  clear() {
    this.attr.aTime.array.fill(-1e9);
    this.attr.aTime.clearUpdateRanges();
    this.attr.aTime.needsUpdate = true;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}
