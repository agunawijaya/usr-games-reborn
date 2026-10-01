// trek/procedural-web — post-processing chain (no Three.js addons).
//
//   scene ──► HDR target (MSAA on High) ──┬──► bloom: prefiltered 13-tap
//                                         │    downsample chain + tent
//                                         │    upsample (Jimenez, SIGGRAPH 2014)
//   distortion scene ──► half-res RG ─────┤
//                                         ▼
//   composite: heat-shimmer / shockwave refraction, bloom, analytic lens
//   flares for in-sector stars, the warp tunnel, exposure, ACES filmic
//   tone map, split-tone grade, vignette, grain, flash/fade, sRGB encode.

import * as THREE from 'three';
import { FULLSCREEN_VERT, HASH } from './glsl.js';

const DOWN_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uThreshold, uKnee;
uniform bool uPrefilter;
varying vec2 vUv;
vec3 s(vec2 o) { return texture2D(tSrc, vUv + o * uTexel).rgb; }
void main() {
  vec3 a = s(vec2(-2.0, 2.0)), b = s(vec2(0.0, 2.0)), c = s(vec2(2.0, 2.0));
  vec3 d = s(vec2(-2.0, 0.0)), e = s(vec2(0.0, 0.0)), f = s(vec2(2.0, 0.0));
  vec3 g = s(vec2(-2.0, -2.0)), h = s(vec2(0.0, -2.0)), i = s(vec2(2.0, -2.0));
  vec3 j = s(vec2(-1.0, 1.0)), k = s(vec2(1.0, 1.0)), l = s(vec2(-1.0, -1.0)), m = s(vec2(1.0, -1.0));
  vec3 col = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  if (uPrefilter) {
    col = clamp(col, vec3(0.0), vec3(48.0));   // also scrubs any NaN (min/max return the other operand)
    float br = max(col.r, max(col.g, col.b));
    float soft = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
    soft = soft * soft / (4.0 * uKnee + 1e-4);
    col *= max(soft, br - uThreshold) / max(br, 1e-4);
  }
  gl_FragColor = vec4(col, 1.0);
}
`;

const UP_FRAG = /* glsl */ `
uniform sampler2D tSrc, tBase;
uniform vec2 uTexel;
uniform float uRadius;
varying vec2 vUv;
vec3 s(vec2 o) { return texture2D(tSrc, vUv + o * uTexel * uRadius).rgb; }
void main() {
  vec3 t = s(vec2(-1.0, 1.0)) + s(vec2(1.0, 1.0)) + s(vec2(-1.0, -1.0)) + s(vec2(1.0, -1.0));
  t += 2.0 * (s(vec2(0.0, 1.0)) + s(vec2(-1.0, 0.0)) + s(vec2(1.0, 0.0)) + s(vec2(0.0, -1.0)));
  t += 4.0 * s(vec2(0.0));
  gl_FragColor = vec4(texture2D(tBase, vUv).rgb + t / 16.0, 1.0);
}
`;

const COMPOSITE_FRAG = HASH + /* glsl */ `
uniform sampler2D tScene, tBloom, tDistort;
uniform vec2 uRes;
uniform float uTime, uBloom, uExposure, uVignette, uGrain, uFlash, uFade, uChroma, uDistortOn, uSat;
uniform vec3 uFlashCol;
uniform vec4 uFlare[6];       // xy uv, z intensity, w size
uniform vec3 uFlareCol[6];
uniform int uFlareCount;
uniform float uWarp;          // 0..1 envelope of the warp tunnel
uniform float uWarpSpeed;     // streak speed factor
uniform vec2 uWarpCenter;     // vanishing point (uv)
uniform vec3 uWarpTint;
varying vec2 vUv;

vec3 aces(vec3 x) {
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}
vec3 toSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

vec3 flares(vec2 uv) {
  vec3 acc = vec3(0.0);
  float aspect = uRes.x / uRes.y;
  for (int i = 0; i < 6; i++) {
    if (i >= uFlareCount) break;
    vec2 p = uFlare[i].xy;
    float I = uFlare[i].z;
    float sz = uFlare[i].w;
    vec3 col = uFlareCol[i];
    vec2 d = (uv - p) * vec2(aspect, 1.0);
    // anamorphic streak
    acc += col * vec3(0.55, 0.75, 1.0) * I * 0.5 * exp(-abs(d.y) / (0.0022 * sz)) * exp(-abs(d.x) / (0.22 * sz));
    // halo ring
    float r = length(d);
    acc += col * I * 0.05 * exp(-pow((r - 0.11 * sz) / (0.012 * sz), 2.0));
    // ghosts along the axis through the screen centre
    vec2 axis = vec2(0.5) - p;
    for (int g = 0; g < 4; g++) {
      float t = g == 0 ? 0.55 : g == 1 ? 0.9 : g == 2 ? 1.35 : 1.8;
      float gs = g == 0 ? 0.035 : g == 1 ? 0.018 : g == 2 ? 0.06 : 0.026;
      vec2 gp = p + axis * t * 2.0;
      vec2 gd = (uv - gp) * vec2(aspect, 1.0);
      // soft hexagonal aperture
      vec2 q = abs(gd);
      float hex = max(q.x * 0.866 + q.y * 0.5, q.y);
      float ghost = smoothstep(gs * sz, gs * sz * 0.7, hex);
      vec3 gc = g == 0 ? vec3(0.4, 0.8, 1.0) : g == 1 ? vec3(1.0, 0.6, 0.3) : g == 2 ? vec3(0.5, 1.0, 0.6) : vec3(0.8, 0.5, 1.0);
      acc += gc * col * ghost * I * 0.035;
    }
  }
  return acc;
}

vec3 warpTunnel(vec2 uv, vec3 base) {
  float aspect = uRes.x / uRes.y;
  vec2 d = (uv - uWarpCenter) * vec2(aspect, 1.0);
  float r = length(d) + 1e-4;
  float ang = atan(d.y, d.x);
  // radial zoom blur of the scene towards the vanishing point
  vec3 blur = vec3(0.0);
  for (int i = 0; i < 10; i++) {
    float k = 1.0 - float(i) * 0.035 * uWarp;
    blur += texture2D(tScene, uWarpCenter + (uv - uWarpCenter) * k).rgb;
  }
  blur /= 10.0;
  vec3 c = mix(base, blur, clamp(uWarp * 1.4, 0.0, 1.0));
  // star streaks rushing outward
  float lanes = 420.0;
  float a = (ang / 6.2831853 + 0.5) * lanes;
  float id = floor(a);
  float lanePos = abs(fract(a) - 0.5);
  float h = hash11(id * 1.37);
  float speed = (0.6 + h * 1.6) * uWarpSpeed;
  float head = fract(h * 13.1 + uTime * speed);
  float rr = pow(r, 0.7);
  float len = 0.08 + 0.35 * uWarp * uWarpSpeed * 0.5;
  float along = (head * 1.4 - rr);
  float streak = smoothstep(0.0, 0.02, along) * smoothstep(len, 0.0, along) * smoothstep(0.5, 0.0, lanePos * (1.0 + r * 3.0) * 1.0);
  streak *= step(0.55, hash11(id * 7.7 + floor(uTime * speed * 0.3 + h * 5.0)));
  vec3 streakCol = mix(uWarpTint, vec3(1.0), 0.5 + 0.5 * h) * (0.6 + 2.2 * r);
  // tunnel rings
  float rings = pow(0.5 + 0.5 * sin(1.0 / r * 3.5 - uTime * 26.0 * uWarpSpeed), 14.0) * smoothstep(0.08, 0.4, r);
  float swirl = 0.5 + 0.5 * sin(ang * 6.0 + 1.0 / r * 2.0 - uTime * 4.0);
  vec3 tunnel = uWarpTint * rings * (0.3 + 0.3 * swirl) * 0.8;
  // bright core at the vanishing point
  vec3 core = mix(uWarpTint, vec3(1.0), 0.5) * exp(-r * 16.0) * 1.3;
  return c + (streak * streakCol * 2.5 + tunnel + core) * uWarp;
}

void main() {
  vec2 uv = vUv;
  if (uDistortOn > 0.5) {
    vec2 off = texture2D(tDistort, uv).rg;
    uv += off;
  }
  vec3 c;
  if (uChroma > 0.0) {
    vec2 dc = (uv - 0.5) * uChroma;
    c = vec3(texture2D(tScene, uv + dc).r, texture2D(tScene, uv).g, texture2D(tScene, uv - dc).b);
  } else {
    c = texture2D(tScene, uv).rgb;
  }
  c = max(c, vec3(0.0));
  c += texture2D(tBloom, vUv).rgb * uBloom;
  c += flares(vUv);
  if (uWarp > 0.001) c = warpTunnel(vUv, c);
  c += uFlashCol * uFlash;
  c *= uExposure;
  c = aces(c);
  // split-tone grade: cool shadows, warm highlights, gentle saturation
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, uSat);
  c += vec3(-0.012, 0.0, 0.02) * (1.0 - l) + vec3(0.015, 0.006, -0.01) * l;
  // vignette
  vec2 v = vUv - 0.5;
  c *= 1.0 - uVignette * smoothstep(0.35, 0.95, length(v * vec2(1.1, 1.0)) * 1.25);
  c = clamp(c, 0.0, 1.0);
  c = toSRGB(c);
  // grain after encoding (perceptually even)
  c += (hash12(vUv * uRes + fract(uTime) * 311.0) - 0.5) * uGrain;
  c *= 1.0 - uFade;
  gl_FragColor = vec4(c, 1.0);
}
`;

function fsMaterial(frag, uniforms, extra = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: FULLSCREEN_VERT, fragmentShader: frag, uniforms,
    depthTest: false, depthWrite: false, ...extra,
  });
}

export class Post {
  constructor(renderer, profile) {
    this.renderer = renderer;
    this.profile = profile;
    this.fsGeo = new THREE.BufferGeometry();
    this.fsGeo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(this.fsGeo);
    this.quad.frustumCulled = false;
    this.quadScene = new THREE.Scene();
    this.quadScene.add(this.quad);

    this.downMat = fsMaterial(DOWN_FRAG, {
      tSrc: { value: null }, uTexel: { value: new THREE.Vector2() },
      uThreshold: { value: 1.0 }, uKnee: { value: 0.6 }, uPrefilter: { value: false },
    });
    this.upMat = fsMaterial(UP_FRAG, {
      tSrc: { value: null }, tBase: { value: null }, uTexel: { value: new THREE.Vector2() }, uRadius: { value: 1.0 },
    });
    this.compMat = fsMaterial(COMPOSITE_FRAG, {
      tScene: { value: null }, tBloom: { value: null }, tDistort: { value: null },
      uRes: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 },
      uBloom: { value: 0.65 }, uExposure: { value: 1.0 }, uVignette: { value: 0.55 }, uGrain: { value: 0.018 },
      uFlash: { value: 0 }, uFlashCol: { value: new THREE.Color(1, 0.9, 0.8) }, uFade: { value: 0 },
      uChroma: { value: 0.0015 }, uDistortOn: { value: 0 }, uSat: { value: 1.08 },
      uFlare: { value: Array.from({ length: 6 }, () => new THREE.Vector4()) },
      uFlareCol: { value: Array.from({ length: 6 }, () => new THREE.Color()) },
      uFlareCount: { value: 0 },
      uWarp: { value: 0 }, uWarpSpeed: { value: 1 }, uWarpCenter: { value: new THREE.Vector2(0.5, 0.5) },
      uWarpTint: { value: new THREE.Color(0.45, 0.75, 1.0) },
    });
    this.uniforms = this.compMat.uniforms;
    this.w = 0; this.h = 0;
    this.targets = [];
  }

  _dispose() {
    for (const t of this.targets) t.dispose();
    this.targets = [];
  }

  setProfile(profile) {
    this.profile = profile;
    if (this.w) { const w = this.w, h = this.h; this.w = 0; this.setSize(w, h); }
  }

  /** Size in drawing-buffer pixels. */
  setSize(w, h) {
    if (w === this.w && h === this.h) return;
    this.w = w; this.h = h;
    this._dispose();
    const hdr = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false };
    this.sceneRT = new THREE.WebGLRenderTarget(w, h, { ...hdr, samples: this.profile.msaa, depthBuffer: true });
    this.targets.push(this.sceneRT);
    this.distortRT = new THREE.WebGLRenderTarget(Math.max(1, w >> 1), Math.max(1, h >> 1), { ...hdr, depthBuffer: false });
    this.targets.push(this.distortRT);
    this.down = [];
    this.up = [];
    let bw = w >> 1, bh = h >> 1;
    for (let i = 0; i < this.profile.bloomLevels; i++) {
      bw = Math.max(1, bw); bh = Math.max(1, bh);
      const d = new THREE.WebGLRenderTarget(bw, bh, { ...hdr, depthBuffer: false });
      const u = new THREE.WebGLRenderTarget(bw, bh, { ...hdr, depthBuffer: false });
      this.down.push(d); this.up.push(u);
      this.targets.push(d, u);
      bw >>= 1; bh >>= 1;
    }
    this.uniforms.uRes.value.set(w, h);
  }

  _pass(mat, target) {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.quadScene, this.cam);
  }

  /** Clear the distortion target (call once per frame before drawing into it). */
  beginDistort() {
    const r = this.renderer;
    r.setRenderTarget(this.distortRT);
    r.setClearColor(0x000000, 0);
    r.clear(true, false, false);
  }

  /** Bloom + composite to the screen. */
  finish(time, distortActive) {
    const r = this.renderer;
    const dm = this.downMat.uniforms;
    // Downsample chain (first pass prefilters).
    let src = this.sceneRT.texture, sw = this.w, sh = this.h;
    for (let i = 0; i < this.down.length; i++) {
      dm.tSrc.value = src;
      dm.uTexel.value.set(1 / sw, 1 / sh);
      dm.uPrefilter.value = i === 0;
      dm.uThreshold.value = this.profile.bloomThreshold;
      this._pass(this.downMat, this.down[i]);
      src = this.down[i].texture;
      sw = this.down[i].width; sh = this.down[i].height;
    }
    // Upsample chain: up[i] = down[i] + tent(up[i+1])
    const um = this.upMat.uniforms;
    const last = this.down.length - 1;
    let upSrc = this.down[last].texture;
    for (let i = last - 1; i >= 0; i--) {
      um.tSrc.value = upSrc;
      um.tBase.value = this.down[i].texture;
      const s = i + 1 === last ? this.down[last] : this.up[i + 1];
      um.uTexel.value.set(1 / s.width, 1 / s.height);
      this._pass(this.upMat, this.up[i]);
      upSrc = this.up[i].texture;
    }
    const u = this.uniforms;
    u.tScene.value = this.sceneRT.texture;
    u.tBloom.value = this.down.length > 1 ? this.up[0].texture : this.down[0].texture;
    u.tDistort.value = this.distortRT.texture;
    u.uDistortOn.value = distortActive ? 1 : 0;
    u.uTime.value = time;
    this._pass(this.compMat, null);
  }

  dispose() {
    this._dispose();
  }
}
