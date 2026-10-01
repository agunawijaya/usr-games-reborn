// Post-processing: bloom, colour grade, vignette, status effects and the
// directional travel transition. Hand-written passes on full-screen
// triangles; HDR in, sRGB out.

import * as THREE from 'three';
import { NOISE, TONE } from './glsl.js';

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

function tri() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  return g;
}

function pass(frag, uniforms) {
  const m = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });
  const mesh = new THREE.Mesh(tri(), m);
  mesh.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(mesh);
  return { m, scene, uniforms };
}

const BRIGHT = /* glsl */ `
uniform sampler2D tSrc; uniform float uThreshold; varying vec2 vUv;
void main() {
  vec3 c = texture2D(tSrc, vUv).rgb;
  float l = max(c.r, max(c.g, c.b));
  gl_FragColor = vec4(c * smoothstep(uThreshold, uThreshold * 2.0 + 0.5, l), 1.0);
}`;

const DOWN = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
void main() {
  vec3 c = texture2D(tSrc, vUv).rgb * 4.0;
  c += texture2D(tSrc, vUv + uTexel * vec2(-1, -1)).rgb + texture2D(tSrc, vUv + uTexel * vec2(1, -1)).rgb;
  c += texture2D(tSrc, vUv + uTexel * vec2(-1, 1)).rgb + texture2D(tSrc, vUv + uTexel * vec2(1, 1)).rgb;
  gl_FragColor = vec4(c / 8.0, 1.0);
}`;

const UP = /* glsl */ `
uniform sampler2D tSrc; uniform sampler2D tAdd; uniform vec2 uTexel; varying vec2 vUv;
void main() {
  vec3 c = vec3(0.0);
  c += texture2D(tSrc, vUv + uTexel * vec2(-1, 0)).rgb * 2.0 + texture2D(tSrc, vUv + uTexel * vec2(1, 0)).rgb * 2.0;
  c += texture2D(tSrc, vUv + uTexel * vec2(0, -1)).rgb * 2.0 + texture2D(tSrc, vUv + uTexel * vec2(0, 1)).rgb * 2.0;
  c += texture2D(tSrc, vUv + uTexel * vec2(-1, -1)).rgb + texture2D(tSrc, vUv + uTexel * vec2(1, -1)).rgb;
  c += texture2D(tSrc, vUv + uTexel * vec2(-1, 1)).rgb + texture2D(tSrc, vUv + uTexel * vec2(1, 1)).rgb;
  gl_FragColor = vec4(c / 12.0 + texture2D(tAdd, vUv).rgb, 1.0);
}`;

const COMPOSITE = /* glsl */ `
uniform sampler2D tScene; uniform sampler2D tBloom; uniform float uBloom; uniform float uHasBloom;
uniform float uExposure; uniform float uSat; uniform float uContrast; uniform vec3 uTint; uniform vec3 uLift;
uniform float uVignette; uniform float uTime; uniform float uGrain;
uniform float uInjury; uniform float uFatal; uniform float uTired; uniform float uHungry; uniform float uAlarm;
uniform float uFlash; uniform vec3 uFlashColor; uniform float uWizard; uniform float uHC;
varying vec2 vUv;
${NOISE}
${TONE}
void main() {
  vec2 uv = vUv;
  // fatigue: a slow swimming warp near exhaustion
  uv += uTired * 0.004 * vec2(sin(uTime * 0.9 + uv.y * 6.0), cos(uTime * 0.7 + uv.x * 5.0));
  vec3 c = texture2D(tScene, uv).rgb;
  if (uTired > 0.3) { // soft double vision
    c = mix(c, texture2D(tScene, uv + vec2(0.006 * uTired, 0.0)).rgb, 0.35 * uTired);
  }
  if (uHasBloom > 0.5) c += texture2D(tBloom, uv).rgb * uBloom;
  c *= uExposure;
  c = c * uTint + uLift;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, uSat * (1.0 - 0.35 * uHungry));
  c = bs_aces(c);
  // contrast as a power curve around linear mid-grey: shadows keep their detail
  // (a linear (c - 0.5) * k pivot would clamp everything under ~17% sRGB to black)
  c = 0.18 * pow(max(c, vec3(0.0)) / 0.18, vec3(uContrast));
  vec2 d = vUv - 0.5; float r = length(d * vec2(1.25, 1.0));
  float vig = smoothstep(0.35, 0.95, r);
  c *= 1.0 - vig * (uVignette + uTired * 0.55);
  // injuries: red edges; with two of the three fatal wounds, a heartbeat
  float beat = uFatal > 1.5 ? pow(0.5 + 0.5 * sin(uTime * 7.5), 6.0) : 0.0;
  float hurt = clamp(uInjury * 0.13, 0.0, 0.75) + beat * 0.4;
  float edge = smoothstep(0.22, 0.9, r);
  c = mix(c, vec3(0.42, 0.015, 0.01), clamp(edge * hurt, 0.0, 0.85));
  // red alert wash on the battlestar
  c += vec3(0.5, 0.02, 0.0) * uAlarm * (0.35 + 0.65 * vig);
  // wizard glow
  c += vec3(1.0, 0.82, 0.4) * uWizard * vig * 0.12 * (0.7 + 0.3 * sin(uTime * 2.0));
  c = mix(c, uFlashColor, uFlash);
  if (uHC > 0.5) c = 0.18 * pow(max(c, vec3(0.0)) / 0.18, vec3(1.25));
  // film grain in display space (in linear space it would swamp the shadows)
  float grain = (bs_hash12(vUv * 1024.0 + fract(uTime) * 37.0) - 0.5) * uGrain;
  gl_FragColor = vec4(bs_srgb(clamp(c, 0.0, 1.0)) + grain, 1.0);
}`;

const TRANSITION = /* glsl */ `
uniform sampler2D tPrev; uniform sampler2D tCur; uniform float uP; uniform vec2 uDir; uniform float uZoom; uniform float uFade;
varying vec2 vUv;
vec3 blurTap(sampler2D t, vec2 uv, vec2 v) {
  vec3 s = vec3(0.0);
  for (int i = 0; i < 6; i++) s += texture2D(t, clamp(uv + v * (float(i) / 5.0 - 0.5), 0.001, 0.999)).rgb;
  return s / 6.0;
}
void main() {
  float p = uP; float e = p * p * (3.0 - 2.0 * p);
  // previous frame leaves in the travel direction; the new one arrives
  vec2 c = vUv - 0.5;
  vec2 uvPrev = 0.5 + c / (1.0 + uZoom * e * 0.9) + uDir * e * 0.55;
  vec2 uvCur = 0.5 + c * (1.0 + uZoom * (1.0 - e) * 0.35) - uDir * (1.0 - e) * 0.35;
  vec2 mb = (uDir * 0.06 + c * uZoom * 0.05) * sin(3.14159 * p);
  vec3 a = blurTap(tPrev, uvPrev, mb);
  vec3 b = blurTap(tCur, uvCur, mb);
  float w = smoothstep(0.15, 0.85, p);
  vec3 col = mix(a, b, w);
  col *= 1.0 - uFade * sin(3.14159 * p) * 0.85;
  gl_FragColor = vec4(col, 1.0);
}`;

const COPY = /* glsl */ `
uniform sampler2D tSrc; varying vec2 vUv;
void main() { gl_FragColor = texture2D(tSrc, vUv); }`;

export class Post {
  constructor(renderer, { bloom = true, msaa = 4 } = {}) {
    this.r = renderer;
    this.bloomOn = bloom;
    this.msaa = msaa;
    this.w = 1;
    this.h = 1;
    const hdr = { type: THREE.HalfFloatType, depthBuffer: true, samples: msaa };
    this.rtScene = new THREE.WebGLRenderTarget(1, 1, hdr);
    this.levels = [];
    for (let i = 0; i < 5; i++) {
      this.levels.push({
        down: new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false }),
        up: new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false }),
      });
    }
    this.rtA = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
    this.rtB = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
    this.cur = this.rtA;
    this.prev = this.rtB;
    this.pBright = pass(BRIGHT, { tSrc: { value: null }, uThreshold: { value: 1.0 } });
    this.pDown = pass(DOWN, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
    this.pUp = pass(UP, { tSrc: { value: null }, tAdd: { value: null }, uTexel: { value: new THREE.Vector2() } });
    this.pComp = pass(COMPOSITE, {
      tScene: { value: null }, tBloom: { value: null }, uBloom: { value: 0.6 }, uHasBloom: { value: bloom ? 1 : 0 },
      uExposure: { value: 1 }, uSat: { value: 1 }, uContrast: { value: 1 }, uTint: { value: new THREE.Vector3(1, 1, 1) },
      uLift: { value: new THREE.Vector3(0, 0, 0) }, uVignette: { value: 0.35 }, uTime: { value: 0 }, uGrain: { value: 0.025 },
      uInjury: { value: 0 }, uFatal: { value: 0 }, uTired: { value: 0 }, uHungry: { value: 0 }, uAlarm: { value: 0 },
      uFlash: { value: 0 }, uFlashColor: { value: new THREE.Vector3(1, 1, 1) }, uWizard: { value: 0 }, uHC: { value: 0 },
    });
    this.pTrans = pass(TRANSITION, {
      tPrev: { value: null }, tCur: { value: null }, uP: { value: 1 }, uDir: { value: new THREE.Vector2() },
      uZoom: { value: 0 }, uFade: { value: 0 },
    });
    this.pCopy = pass(COPY, { tSrc: { value: null } });
    this.ortho = new THREE.Camera();
    this.transition = null;
  }

  setSize(w, h) {
    this.w = w;
    this.h = h;
    this.rtScene.setSize(w, h);
    let lw = Math.max(1, w >> 1);
    let lh = Math.max(1, h >> 1);
    for (const l of this.levels) {
      l.down.setSize(lw, lh);
      l.up.setSize(lw, lh);
      lw = Math.max(1, lw >> 1);
      lh = Math.max(1, lh >> 1);
    }
    this.rtA.setSize(w, h);
    this.rtB.setSize(w, h);
  }

  get grade() { return this.pComp.uniforms; }

  /** Starts a travel transition from the last finished frame. */
  beginTransition(dir, zoom, fade = 0) {
    const t = this.prev;
    this.prev = this.cur;
    this.cur = t;
    this.transition = { p: 0 };
    this.pTrans.uniforms.uDir.value.set(dir[0], dir[1]);
    this.pTrans.uniforms.uZoom.value = zoom;
    this.pTrans.uniforms.uFade.value = fade;
  }

  render(scene, camera, dt, transitionSpeed = 1.2) {
    const r = this.r;
    r.setRenderTarget(this.rtScene);
    r.clear();
    r.render(scene, camera);
    let bloomTex = null;
    if (this.bloomOn) {
      this.pBright.uniforms.tSrc.value = this.rtScene.texture;
      r.setRenderTarget(this.levels[0].down);
      r.render(this.pBright.scene, this.ortho);
      for (let i = 1; i < this.levels.length; i++) {
        const src = this.levels[i - 1].down;
        this.pDown.uniforms.tSrc.value = src.texture;
        this.pDown.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
        r.setRenderTarget(this.levels[i].down);
        r.render(this.pDown.scene, this.ortho);
      }
      let acc = this.levels[this.levels.length - 1].down;
      for (let i = this.levels.length - 2; i >= 0; i--) {
        this.pUp.uniforms.tSrc.value = acc.texture;
        this.pUp.uniforms.tAdd.value = this.levels[i].down.texture;
        this.pUp.uniforms.uTexel.value.set(1 / acc.width, 1 / acc.height);
        r.setRenderTarget(this.levels[i].up);
        r.render(this.pUp.scene, this.ortho);
        acc = this.levels[i].up;
      }
      bloomTex = acc.texture;
    }
    const u = this.pComp.uniforms;
    u.tScene.value = this.rtScene.texture;
    u.tBloom.value = bloomTex;
    r.setRenderTarget(this.cur);
    r.render(this.pComp.scene, this.ortho);
    r.setRenderTarget(null);
    if (this.transition) {
      this.transition.p = Math.min(1, this.transition.p + dt * transitionSpeed);
      this.pTrans.uniforms.uP.value = this.transition.p;
      this.pTrans.uniforms.tPrev.value = this.prev.texture;
      this.pTrans.uniforms.tCur.value = this.cur.texture;
      r.render(this.pTrans.scene, this.ortho);
      if (this.transition.p >= 1) this.transition = null;
    } else {
      this.pCopy.uniforms.tSrc.value = this.cur.texture;
      r.render(this.pCopy.scene, this.ortho);
    }
  }

  dispose() {
    for (const t of [this.rtScene, this.rtA, this.rtB, ...this.levels.flatMap((l) => [l.down, l.up])]) t.dispose();
  }
}
