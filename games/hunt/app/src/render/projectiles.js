// Shots in flight. Each engine step gives every shot the exact cells it
// crossed (g.trails, including the corner at a mirror); the renderer moves
// the head along that polyline during the step and keeps a tail behind it,
// so a ricochet shows as a bent streak of light. Shots are only drawn
// where the viewer can see (the ribbon shader samples the visibility
// field); explosions and muzzle flashes are drawn for everyone elsewhere.

import * as THREE from 'three';
import * as K from '../engine/constants.js';
import { NOISE } from './glsl.js';

const MAXV = 24000;
export const SHOT_Y = 0.46;

const cellToWorld = (x, y) => [x - 25, y - 11];

function pointAt(poly, cum, d) {
  if (d <= 0) return poly[0];
  for (let i = 1; i < poly.length; i++) {
    if (cum[i] >= d) {
      const k = (d - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]);
      return [poly[i - 1][0] + (poly[i][0] - poly[i - 1][0]) * k, poly[i - 1][1] + (poly[i][1] - poly[i - 1][1]) * k];
    }
  }
  return poly[poly.length - 1];
}

function cumulative(poly) {
  const c = [0];
  for (let i = 1; i < poly.length; i++) c.push(c[i - 1] + Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]));
  return c;
}

const LOOK = {
  [K.SHOT]: { w: 0.07, tail: 2.6, core: [1.0, 1.0, 1.0], orb: 0 },
  [K.GRENADE]: { w: 0.13, tail: 1.4, core: [1.0, 0.8, 0.45], orb: 0.16 },
  [K.SATCHEL]: { w: 0.16, tail: 1.2, core: [1.0, 0.62, 0.3], orb: 0.22 },
  [K.BOMB]: { w: 0.2, tail: 1.2, core: [1.0, 0.45, 0.35], orb: 0.3 },
  [K.SLIME]: { w: 0.16, tail: 1.0, core: [0.55, 1.0, 0.35], orb: 0.2 },
};

export class Projectiles {
  constructor(fields) {
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(MAXV * 3);
    this.col = new Float32Array(MAXV * 4);
    this.uv = new Float32Array(MAXV * 2);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('uv', new THREE.BufferAttribute(this.uv, 2).setUsage(THREE.DynamicDrawUsage));
    this.idx = new Uint32Array(MAXV * 3);
    geo.setIndex(new THREE.BufferAttribute(this.idx, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo = geo;
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uVis: { value: fields.vis }, uSeeAll: { value: 0 } },
      vertexShader: /* glsl */ `
        attribute vec4 color;
        varying vec4 vC;
        varying vec2 vUv;
        varying vec3 vW;
        void main() { vC = color; vUv = uv; vW = position; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uVis;
        uniform float uSeeAll;
        varying vec4 vC;
        varying vec2 vUv;
        varying vec3 vW;
        void main() {
          float lit = max(texture(uVis, (vW.xz + vec2(25.5, 11.5)) / vec2(51.0, 23.0)).r, uSeeAll);
          float across = clamp(1.0 - abs(vUv.y * 2.0 - 1.0), 0.0, 1.0);
          float core = pow(across, 6.0);
          float halo = pow(across, 1.5) * 0.45;
          float along = clamp(vUv.x, 0.0, 1.0); // 0 tail .. 1 head
          vec3 c = mix(vC.rgb, vec3(1.0), core * 0.8) * (core * 2.2 + halo) * pow(along, 1.4);
          gl_FragColor = vec4(c * vC.a * smoothstep(0.02, 0.35, lit), 1.0);
        }`,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 22;
    // orbs for heavier ordnance
    this.orbGeo = new THREE.IcosahedronGeometry(1, 1);
    this.orbMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 } },
      vertexShader: /* glsl */ `
        attribute vec4 aOrb;   // x, y, z, size
        attribute vec4 aOrbC;  // rgb, alpha
        attribute vec2 aSpin;  // spin phase, kind
        varying vec3 vN; varying vec4 vC; varying vec3 vP; varying vec2 vS;
        uniform float uTime;
        void main() {
          float a = aSpin.x + uTime * 7.0;
          mat3 R = mat3(cos(a), 0.0, sin(a), 0.0, 1.0, 0.0, -sin(a), 0.0, cos(a)) *
                   mat3(1.0, 0.0, 0.0, 0.0, cos(a * 1.3), -sin(a * 1.3), 0.0, sin(a * 1.3), cos(a * 1.3));
          vec3 p = R * position;
          vN = normalize(mat3(viewMatrix) * (R * normal));
          vP = position; vC = aOrbC; vS = aSpin;
          gl_Position = projectionMatrix * viewMatrix * vec4(aOrb.xyz + p * aOrb.w, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        varying vec3 vN; varying vec4 vC; varying vec3 vP; varying vec2 vS;
        ${NOISE}
        void main() {
          float rim = pow(clamp(1.0 - abs(vN.z), 0.0, 1.0), 2.0);
          float bands = smoothstep(0.8, 1.0, sin(vP.y * 9.0 + vS.x * 3.0) * 0.5 + 0.5);
          float goo = vS.y > 3.5 ? fbm(vP.xz * 3.0 + uTime) : 0.0;
          vec3 c = vC.rgb * (0.3 + rim * 0.9 + bands * 0.6 + goo * 0.6);
          gl_FragColor = vec4(c * vC.a, 1.0);
        }`,
    });
    const ig = new THREE.InstancedBufferGeometry();
    ig.index = this.orbGeo.index;
    ig.attributes.position = this.orbGeo.attributes.position;
    ig.attributes.normal = this.orbGeo.attributes.normal;
    this.aOrb = new THREE.InstancedBufferAttribute(new Float32Array(512 * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.aOrbC = new THREE.InstancedBufferAttribute(new Float32Array(512 * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.aSpin = new THREE.InstancedBufferAttribute(new Float32Array(512 * 2), 2).setUsage(THREE.DynamicDrawUsage);
    ig.setAttribute('aOrb', this.aOrb);
    ig.setAttribute('aOrbC', this.aOrbC);
    ig.setAttribute('aSpin', this.aSpin);
    ig.instanceCount = 0;
    this.orbs = new THREE.Mesh(ig, this.orbMat);
    this.orbs.frustumCulled = false;
    this.orbs.renderOrder = 23;
    this.group = new THREE.Group();
    this.group.add(this.mesh, this.orbs);
    this.tracks = new Map(); // id -> { hist: [[x,z]...], path, type, color, ended, endT }
  }

  // New engine step: extend every shot's polyline with the cells it crossed.
  step(trails, colorOf, time, stepDur) {
    const alive = new Set();
    for (const t of trails) {
      if (!LOOK[t.type]) continue;
      alive.add(t.id);
      let tr = this.tracks.get(t.id);
      const pts = t.path.map(([x, y]) => cellToWorld(x, y));
      if (!tr) {
        tr = { hist: [pts[0]], type: t.type, color: colorOf(t), spin: Math.random() * 6 };
        this.tracks.set(t.id, tr);
      }
      tr.from = tr.hist.length - 1;
      tr.hist.push(...pts.slice(1));
      if (tr.hist.length > 40) {
        const cut = tr.hist.length - 40;
        tr.hist.splice(0, cut);
        tr.from = Math.max(0, tr.from - cut);
      }
      tr.t0 = time;
      tr.dur = stepDur;
      tr.ending = t.expl || t.gone;
      tr.endAt = null;
    }
    for (const [id, tr] of this.tracks) {
      if (!alive.has(id)) {
        if (tr.ending) {
          if (tr.endAt == null) tr.endAt = time;
          if (time - tr.endAt > 0.25) this.tracks.delete(id);
        } else this.tracks.delete(id);
      }
    }
  }

  // Where a shot's head is right now (for timing sparks/booms).
  head(id, time) {
    const tr = this.tracks.get(id);
    if (!tr) return null;
    return this._head(tr, time).p;
  }

  _head(tr, time) {
    const seg = tr.hist.slice(tr.from);
    const cum = cumulative(seg);
    const k = Math.min(1, Math.max(0, (time - tr.t0) / tr.dur));
    const total = cum[cum.length - 1];
    const d = total * k;
    const all = tr.hist;
    const cumAll = cumulative(all);
    const dAll = cumAll[tr.from] + d;
    return { p: pointAt(seg, cum, d), all, cumAll, dAll };
  }

  frame(time) {
    let v = 0;
    let ix = 0;
    let orbs = 0;
    const O = this.aOrb.array;
    const OC = this.aOrbC.array;
    const S = this.aSpin.array;
    for (const [, tr] of this.tracks) {
      const L = LOOK[tr.type];
      const { p: head, all, cumAll, dAll } = this._head(tr, time);
      const fade = tr.endAt != null ? Math.max(0, 1 - (time - tr.endAt) / 0.2) : 1;
      if (fade <= 0) continue;
      // ribbon: sample the tail polyline behind the head
      const n = 10;
      const c = tr.color;
      const base = v;
      for (let s = 0; s <= n; s++) {
        const d = dAll - L.tail * (1 - s / n);
        const [x, z] = pointAt(all, cumAll, Math.max(0, d));
        const [x2, z2] = pointAt(all, cumAll, Math.max(0, d + 0.05));
        let dx = x2 - x;
        let dz = z2 - z;
        const len = Math.hypot(dx, dz) || 1;
        dx /= len; dz /= len;
        const w = L.w * (0.35 + 0.65 * s / n);
        for (const side of [-1, 1]) {
          if (v >= MAXV) break;
          this.pos[v * 3] = x - dz * w * side;
          this.pos[v * 3 + 1] = SHOT_Y;
          this.pos[v * 3 + 2] = z + dx * w * side;
          this.col[v * 4] = c.r; this.col[v * 4 + 1] = c.g; this.col[v * 4 + 2] = c.b; this.col[v * 4 + 3] = fade;
          this.uv[v * 2] = s / n;
          this.uv[v * 2 + 1] = side < 0 ? 0 : 1;
          v++;
        }
      }
      for (let s = 0; s < n; s++) {
        const a = base + s * 2;
        this.idx[ix++] = a; this.idx[ix++] = a + 1; this.idx[ix++] = a + 2;
        this.idx[ix++] = a + 1; this.idx[ix++] = a + 3; this.idx[ix++] = a + 2;
      }
      if (L.orb && orbs < 512 && tr.endAt == null) {
        O[orbs * 4] = head[0]; O[orbs * 4 + 1] = SHOT_Y; O[orbs * 4 + 2] = head[1]; O[orbs * 4 + 3] = L.orb;
        OC[orbs * 4] = L.core[0]; OC[orbs * 4 + 1] = L.core[1]; OC[orbs * 4 + 2] = L.core[2]; OC[orbs * 4 + 3] = this.litAt ? this.litAt(head) : 1;
        S[orbs * 2] = tr.spin; S[orbs * 2 + 1] = tr.type === K.SLIME ? 4 : tr.type === K.BOMB ? 3 : 1;
        orbs++;
      }
    }
    this.geo.setDrawRange(0, ix);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
    this.geo.attributes.uv.needsUpdate = true;
    this.geo.index.needsUpdate = true;
    this.orbs.geometry.instanceCount = orbs;
    this.aOrb.needsUpdate = true;
    this.aOrbC.needsUpdate = true;
    this.aSpin.needsUpdate = true;
    this.orbMat.uniforms.uTime.value = time;
  }
}
