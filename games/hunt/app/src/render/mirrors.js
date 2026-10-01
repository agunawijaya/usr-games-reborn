// Mirrors '/' and '\' as standing glass panes. A deflection flips the
// wall in hunt (shots.c:243, 264), so the pane swivels 90 degrees, flashes
// and ripples from the point the shot touched. Doors '#' are scatter-gates:
// a swirling vortex a shot comes out of in a random direction.

import * as THREE from 'three';
import * as K from '../engine/constants.js';
import { NOISE, LIGHTS, BEAM } from './glsl.js';
import { COL } from './palette.js';
import { T_MIRROR_SLASH, T_MIRROR_BACK, T_DOOR } from '../view.js';

const W = K.WIDTH;
const H = K.HEIGHT;
const MAXM = 400;

const sameMod = (a, b) => {
  const d = (((a - b) % Math.PI) + Math.PI) % Math.PI;
  return d < 1e-3 || Math.PI - d < 1e-3;
};

const ANGLE = { [T_MIRROR_SLASH]: Math.PI / 4, [T_MIRROR_BACK]: -Math.PI / 4 };

export class Mirrors {
  constructor(fields, lightUniforms) {
    const pane = new THREE.BoxGeometry(1.34, 0.98, 0.06, 1, 1, 1);
    pane.translate(0, 0.49 + 0.03, 0);
    const ig = new THREE.InstancedBufferGeometry();
    ig.index = pane.index;
    for (const k of ['position', 'normal', 'uv']) ig.attributes[k] = pane.attributes[k];
    this.a = new THREE.InstancedBufferAttribute(new Float32Array(MAXM * 4), 4); // x, y, angle, hitT
    this.b = new THREE.InstancedBufferAttribute(new Float32Array(MAXM * 4), 4); // hitU, hitV, bounces, flipT
    this.a.setUsage(THREE.DynamicDrawUsage);
    this.b.setUsage(THREE.DynamicDrawUsage);
    ig.setAttribute('aA', this.a);
    ig.setAttribute('aB', this.b);
    ig.instanceCount = 0;
    this.geo = ig;
    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uVis: { value: fields.vis },
        uTime: { value: 0 },
        uEye: { value: new THREE.Vector3() },
        uFace: { value: new THREE.Vector2(1, 0) },
        uBeamOn: { value: 1 },
      uAmb: { value: 0 },
        uSeeAll: { value: 0 },
        uGlass: { value: new THREE.Color(COL.mirror) },
        ...lightUniforms,
      },
      vertexShader: /* glsl */ `
        attribute vec4 aA;
        attribute vec4 aB;
        varying vec3 vW;
        varying vec3 vN;
        varying vec2 vUv;
        varying vec4 vA;
        varying vec4 vB;
        varying vec3 vL;
        void main() {
          float c = cos(aA.z);
          float s = sin(aA.z);
          vec3 p = vec3(c * position.x + s * position.z, position.y, -s * position.x + c * position.z);
          vec3 n = vec3(c * normal.x + s * normal.z, normal.y, -s * normal.x + c * normal.z);
          vec3 w = vec3(aA.x - 25.0, 0.0, aA.y - 11.0) + p;
          vW = w;
          vN = n;
          vUv = uv;
          vL = position;
          vA = aA;
          vB = aB;
          gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform sampler2D uVis;
        uniform float uTime, uSeeAll;
        uniform vec3 uGlass;
        varying vec3 vW;
        varying vec3 vN;
        varying vec2 vUv;
        varying vec4 vA;
        varying vec4 vB;
        varying vec3 vL;
        ${NOISE}
        ${LIGHTS}
        ${BEAM}
        void main() {
          vec4 V = texture(uVis, (vA.xy + 0.5) / vec2(51.0, 23.0));
          float lit = max(V.r, uSeeAll * 0.85);
          float known = max(V.g, uSeeAll);
          vec3 n = normalize(vN);
          vec3 v = normalize(cameraPosition - vW);
          float fres = pow(clamp(1.0 - abs(dot(n, v)), 0.0, 1.0), 3.0);
          // fake environment: dark sky with a soft horizon band and streaks
          vec3 r = reflect(-v, n);
          float band = exp(-abs(r.y - 0.15) * 7.0);
          float streak = smoothstep(0.7, 1.0, vnoise(vec2(atan(r.z, r.x) * 6.0, 0.0)));
          vec3 env = mix(vec3(0.02, 0.03, 0.05), vec3(0.35, 0.55, 0.7), band) + streak * 0.15;
          // thin-film shimmer at grazing angles
          vec3 irid = 0.5 + 0.5 * cos(6.2831 * (fres * 1.5 + vec3(0.0, 0.33, 0.67)));
          vec3 light = beamLight(vW, n, lit) + pointLights(vW, n);
          vec3 col = uGlass * 0.08 + env * (0.3 + fres) + irid * fres * 0.25;
          col *= 0.25 + light * 0.9;
          // frame lines: bright top and bottom rails
          float rail = smoothstep(0.035, 0.0, min(vL.y - 0.03, 1.01 - vL.y)) + smoothstep(0.03, 0.0, 0.67 - abs(vL.x));
          col += uGlass * rail * (0.35 + 1.1 * lit);
          // hit: flash + ripple rings from the touch point
          float t = uTime - vA.w;
          if (t >= 0.0 && t < 1.5) {
            float d = length(vec2(vL.x - vB.x, vL.y - vB.y));
            float front = t * 2.4;
            float ring = sin((d - front) * 34.0) * exp(-t * 3.2) * (1.0 - smoothstep(front - 0.05, front + 0.03, d));
            float flash = exp(-t * 9.0) * (1.0 - smoothstep(0.0, 0.8, d));
            vec3 hitCol = mix(vec3(0.7, 0.95, 1.0), vec3(1.0, 0.85, 0.5), clamp(vB.z / 6.0, 0.0, 1.0));
            col += hitCol * (max(ring, 0.0) * 1.3 + flash * 5.0);
          }
          // swivel glow while flipping
          float ft = uTime - vB.w;
          if (ft >= 0.0 && ft < 0.35) col += uGlass * (1.0 - ft / 0.35) * 0.9;
          float alpha = (0.35 + 0.55 * fres + rail * 0.6) * max(lit, 0.0);
          // remembered: ghost outline only
          float ghost = known * (1.0 - lit);
          col += vec3(0.3, 0.55, 1.0) * rail * ghost * 0.6;
          alpha = max(alpha, rail * ghost * 0.5);
          if (t >= 0.0 && t < 1.5) alpha = max(alpha, exp(-t * 4.0));
          gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
        }`,
    });
    this.mesh = new THREE.Mesh(this.geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.state = new Map(); // cell -> { angle, from, to, flipT, hitT, hitU, hitV, n }
  }

  // Terrain changes (a flip, a new mirror, a destroyed one).
  sync(terrain, time) {
    const seen = new Set();
    for (let i = 0; i < W * H; i++) {
      const t = terrain[i];
      if (t !== T_MIRROR_SLASH && t !== T_MIRROR_BACK) continue;
      seen.add(i);
      const target = ANGLE[t];
      let s = this.state.get(i);
      if (!s) {
        s = { angle: target, from: target, to: target, flipT: -10, hitT: -10, hitU: 0, hitV: 0.5, n: 0 };
        this.state.set(i, s);
      } else if (!sameMod(s.to, target)) {
        // a deflection flipped it: swivel a quarter turn, always the same way
        s.from = s.angle;
        s.to -= Math.PI / 2;
        s.flipT = time;
      }
    }
    for (const k of [...this.state.keys()]) if (!seen.has(k)) this.state.delete(k);
  }

  hit(x, y, time, fromFace, bounces) {
    const s = this.state.get(y * W + x);
    if (!s) return;
    s.hitT = time;
    s.hitU = (fromFace === K.LEFTS || fromFace === K.ABOVE ? 1 : -1) * 0.05;
    s.hitV = 0.28;
    s.n = bounces;
  }

  frame(time) {
    const A = this.a.array;
    const B = this.b.array;
    let n = 0;
    for (const [i, s] of this.state) {
      if (n >= MAXM) break;
      const y = Math.floor(i / W);
      const x = i - y * W;
      const k = Math.min(1, (time - s.flipT) / 0.18);
      const e = k < 1 ? 1 - Math.pow(1 - k, 3) * Math.cos(k * 5) : 1;
      s.angle = s.from + (s.to - s.from) * Math.max(0, Math.min(1.08, e));
      if (k >= 1) s.from = s.to;
      A[n * 4] = x;
      A[n * 4 + 1] = y;
      A[n * 4 + 2] = s.angle;
      A[n * 4 + 3] = s.hitT;
      B[n * 4] = s.hitU;
      B[n * 4 + 1] = s.hitV;
      B[n * 4 + 2] = s.n;
      B[n * 4 + 3] = s.flipT;
      n++;
    }
    this.geo.instanceCount = n;
    this.a.needsUpdate = true;
    this.b.needsUpdate = true;
  }
}

export class Doors {
  constructor(fields) {
    const disc = new THREE.CircleGeometry(0.5, 40);
    disc.rotateX(-Math.PI / 2);
    disc.translate(0, 0.03, 0);
    const ig = new THREE.InstancedBufferGeometry();
    ig.index = disc.index;
    ig.attributes.position = disc.attributes.position;
    ig.attributes.uv = disc.attributes.uv;
    this.a = new THREE.InstancedBufferAttribute(new Float32Array(256 * 4), 4); // x, y, kickT, seed
    this.a.setUsage(THREE.DynamicDrawUsage);
    ig.setAttribute('aA', this.a);
    ig.instanceCount = 0;
    this.geo = ig;
    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uVis: { value: fields.vis },
        uTime: { value: 0 },
        uSeeAll: { value: 0 },
        uCol: { value: new THREE.Color(COL.door) },
      },
      vertexShader: /* glsl */ `
        attribute vec4 aA;
        varying vec2 vUv;
        varying vec4 vA;
        void main() {
          vUv = uv;
          vA = aA;
          vec3 w = vec3(aA.x - 25.0, 0.0, aA.y - 11.0) + position;
          gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform sampler2D uVis;
        uniform float uTime, uSeeAll;
        uniform vec3 uCol;
        varying vec2 vUv;
        varying vec4 vA;
        ${NOISE}
        void main() {
          vec4 V = texture(uVis, (vA.xy + 0.5) / vec2(51.0, 23.0));
          float lit = max(V.r, uSeeAll);
          float known = max(V.g, uSeeAll);
          vec2 p = vUv * 2.0 - 1.0;
          float r = length(p);
          float kick = exp(-max(uTime - vA.z, 0.0) * 4.0) * step(0.0, uTime - vA.z);
          float spin = uTime * (1.4 + 6.0 * kick) + vA.w * 6.28;
          float a = atan(p.y, p.x);
          float arms = 0.5 + 0.5 * sin(a * 3.0 + r * 9.0 - spin * 3.0);
          float swirl = arms * smoothstep(1.0, 0.25, r) * (0.55 + 0.45 * fbm(p * 3.0 + spin * 0.3));
          float ring = smoothstep(0.08, 0.0, abs(r - 0.9));
          float core = smoothstep(0.35, 0.0, r);
          vec3 c = uCol * (swirl * 1.2 + ring * 1.4 + core * 0.8) + vec3(1.0) * core * kick * 2.0;
          float vis = max(lit, known * 0.18);
          gl_FragColor = vec4(c * vis * (1.0 + kick * 2.0), 1.0);
        }`,
    });
    this.mesh = new THREE.Mesh(this.geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
    this.kick = new Map();
  }

  sync(terrain) {
    const A = this.a.array;
    let n = 0;
    for (let i = 0; i < W * H && n < 256; i++) {
      if (terrain[i] !== T_DOOR) continue;
      const y = Math.floor(i / W);
      A[n * 4] = i - y * W;
      A[n * 4 + 1] = y;
      A[n * 4 + 2] = this.kick.get(i) ?? -10;
      A[n * 4 + 3] = (i * 0.618) % 1;
      n++;
    }
    this.geo.instanceCount = n;
    this.a.needsUpdate = true;
  }

  scatter(x, y, time) { this.kick.set(y * W + x, time); }
}
