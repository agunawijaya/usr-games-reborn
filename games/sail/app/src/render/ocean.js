// The ocean: a camera-centred radial grid displaced by the Gerstner field in
// waves.js, shaded with Fresnel sky reflection (the same skyColor() as the
// dome), subsurface colour on backlit crests, wind-streaked crest foam, sun
// glitter, ship wakes, and haze to the horizon.

import * as THREE from 'three';
import { NOISE, SKY_UNIFORMS, SKY_FN } from './glsl.js';
import { MAX_WAVES } from './waves.js';

export const MAX_WAKES = 12;

const GRID_EXP = 2.4;

function radialGrid(rings, segments, maxR) {
  const pos = [];
  const idx = [];
  pos.push(0, 0, 0);
  for (let j = 1; j <= rings; j++) {
    const t = j / rings;
    const r = maxR * Math.pow(t, GRID_EXP);
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      pos.push(Math.cos(a) * r, 0, Math.sin(a) * r);
    }
  }
  for (let i = 0; i < segments; i++) idx.push(0, 1 + ((i + 1) % segments), 1 + i);
  for (let j = 1; j < rings; j++) {
    const a0 = 1 + (j - 1) * segments;
    const a1 = 1 + j * segments;
    for (let i = 0; i < segments; i++) {
      const i1 = (i + 1) % segments;
      idx.push(a0 + i, a0 + i1, a1 + i);
      idx.push(a0 + i1, a1 + i1, a1 + i);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

const vertex = /* glsl */ `
#define MAX_WAVES ${MAX_WAVES}
uniform vec4 uWave[MAX_WAVES];
uniform vec2 uWaveDir[MAX_WAVES];
uniform float uWavePhase[MAX_WAVES];
uniform float uTime;
uniform vec2 uCenter;
uniform float uSteep;
uniform vec3 uGrid; // maxR, rings, exponent
varying vec3 vWorld;
varying vec3 vNormal;
varying float vCrest;
varying float vHeight;
void main() {
  vec2 p = position.xz + uCenter;
  float dist = length(position.xz);
  // radial spacing of the grid at this distance: r = R t^e -> dr = e R t^(e-1) / N
  float tt = pow(max(dist, 0.5) / uGrid.x, 1.0 / uGrid.z);
  float spacing = uGrid.z * uGrid.x * pow(tt, uGrid.z - 1.0) / uGrid.y;
  vec3 d = vec3(0.0);
  vec3 n = vec3(0.0, 1.0, 0.0);
  float crest = 0.0;
  for (int i = 0; i < MAX_WAVES; i++) {
    vec4 w = uWave[i];
    float A = w.x;
    if (A <= 0.0) continue;
    float k = w.y;
    float L = 6.2831853 / k;
    // a wave shorter than ~4 grid cells would alias into moire: fade it out
    // (the fragment shader's detail normals carry the small scales instead)
    float fade = smoothstep(3.0 * spacing, 6.0 * spacing, L);
    A *= fade;
    vec2 D = uWaveDir[i];
    float ph = k * dot(D, p) - w.z * uTime + uWavePhase[i];
    float c = cos(ph);
    float s = sin(ph);
    float Q = w.w;
    d.x += Q * A * D.x * c;
    d.z += Q * A * D.y * c;
    d.y += A * s;
    float WA = k * A;
    n.x -= D.x * WA * c;
    n.z -= D.y * WA * c;
    n.y -= Q * WA * s;
    crest += Q * WA * s;
  }
  vec3 world = vec3(p.x + d.x, d.y, p.y + d.z);
  vWorld = world;
  vNormal = normalize(n);
  vCrest = crest / max(uSteep, 0.001);
  vHeight = d.y;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`;

const fragment = /* glsl */ `
precision highp float;
#define MAX_WAKES ${MAX_WAKES}
${SKY_UNIFORMS}
uniform float uTime;
uniform float uFoam;
uniform float uChop;
uniform float uAmp;
uniform float uStorm;
uniform vec2 uWind;
uniform vec3 uDeep;
uniform vec3 uScatter;
uniform float uFogDensity;
uniform vec3 uFogColor;
uniform float uDetail;
uniform int uDetailOct;
uniform vec4 uWake[MAX_WAKES];   // x, z, heading(rad), speed(0..1)
uniform vec4 uWakeB[MAX_WAKES];  // halfLength, halfBeam, fire(0..1), sinking(0..1)
uniform int uWakeCount;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vCrest;
varying float vHeight;
${NOISE}
${SKY_FN}

// Small-scale roughness: finite-difference gradient of two drifting noise
// fields (capillary chop + wind ripples), stretched along the wind. Noise,
// not sines, so there is no repeating pattern to catch the eye.
float microHeight(vec2 p, float t) {
  vec2 w = normalize(uWind);
  vec2 a = vec2(-w.y, w.x);
  vec2 q = vec2(dot(p, w) * 0.55, dot(p, a));
  float h = fbm(q * 0.32 - vec2(t * 0.55, 0.0), uDetailOct) * 0.9;
  h += fbm(q * 0.95 + vec2(t * 0.9, t * 0.2), max(uDetailOct - 1, 1)) * 0.35;
  return h;
}
vec2 ripple(vec2 p, float t) {
  float e = 0.18;
  float h0 = microHeight(p, t);
  float hx = microHeight(p + vec2(e, 0.0), t);
  float hz = microHeight(p + vec2(0.0, e), t);
  return vec2(hx - h0, hz - h0) / e;
}

// Foam and turbulence around each ship: bow wave, hull-side wash, and a
// V-shaped wake trailing astern, scaled by the ship's speed this turn.
float shipFoam(vec2 p, out float shadowMask) {
  float foam = 0.0;
  shadowMask = 0.0;
  for (int i = 0; i < MAX_WAKES; i++) {
    if (i >= uWakeCount) break;
    vec4 w = uWake[i];
    vec4 b = uWakeB[i];
    vec2 rel = p - w.xy;
    float ca = cos(w.z);
    float sa = sin(w.z);
    // local frame (heading h clockwise from north): y along the bow, x to starboard
    vec2 l = vec2(rel.x * ca + rel.y * sa, rel.x * sa - rel.y * ca);
    float hl = b.x;
    float hb = b.y;
    // distance to the waterline ellipse
    float e = length(vec2(l.x / hb, l.y / hl));
    float ring = smoothstep(1.35, 1.0, e) * smoothstep(0.75, 1.0, e);
    shadowMask = max(shadowMask, smoothstep(1.25, 0.9, e));
    float spd = w.w;
    float bow = smoothstep(hl * 0.3, hl * 1.05, l.y) * ring;
    foam += ring * (0.25 + 0.5 * spd) + bow * spd * 1.2;
    // Kelvin-ish wake behind the stern (l.y < -hl)
    float back = -l.y - hl;
    if (back > 0.0) {
      float spread = back * 0.34 + hb;
      float arms = smoothstep(spread * 0.25, 0.0, abs(abs(l.x) - spread * 0.85));
      float trail = smoothstep(spread * 0.9, 0.0, abs(l.x)) * 0.55;
      float len = exp(-back / (40.0 + 140.0 * spd));
      foam += (arms + trail) * len * spd;
    }
    // burning or foundering ships churn the water
    foam += (b.z * 0.3 + b.w * 0.9) * smoothstep(2.2, 0.8, e);
  }
  return foam;
}

void main() {
  vec3 V = normalize(cameraPosition - vWorld);
  float dist = length(cameraPosition - vWorld);
  // fade micro detail by the pixel footprint: features smaller than a pixel
  // would only sparkle and crawl
  float footprint = length(fwidth(vWorld.xz));
  float detailFade = smoothstep(0.7, 0.08, footprint) * uDetail;
  vec2 rg = detailFade > 0.02 ? ripple(vWorld.xz, uTime) * (0.1 + 0.35 * uChop) * detailFade : vec2(0.0);
  // Mid-scale band (5-40 m): the geometry drops these waves at distance and
  // the micro-normals are far smaller, so without this the sea looks like
  // satin. Always resolvable, so it needs no fade until the far haze.
  vec2 wdir = normalize(uWind);
  vec2 mq = vec2(dot(vWorld.xz, wdir) * 0.7, dot(vWorld.xz, vec2(-wdir.y, wdir.x))) * 0.055;
  float me = 0.06;
  float m0 = fbm(mq - vec2(uTime * 0.09, 0.0), 3);
  float mx = fbm(mq + vec2(me, 0.0) - vec2(uTime * 0.09, 0.0), 3);
  float mz = fbm(mq + vec2(0.0, me) - vec2(uTime * 0.09, 0.0), 3);
  vec2 mg = vec2(mx - m0, mz - m0) / me * 0.055;
  mg = vec2(mg.x * wdir.x - mg.y * wdir.y, mg.x * wdir.y + mg.y * wdir.x);
  float midAmp = (0.25 + 0.9 * uChop) * clamp(uAmp, 0.2, 2.5) * (1.0 - smoothstep(1500.0, 5000.0, dist));
  vec3 N = normalize(vNormal + vec3(-rg.x - mg.x * midAmp, 0.0, -rg.y - mg.y * midAmp));
  vec3 L = normalize(uSunDir);
  // Detail that is no longer drawn still roughens the surface: blend the
  // sharp reflection toward a blurred one (a broad cone around R).
  float rough = (1.0 - detailFade) * (0.35 + 0.65 * uChop);

  // reflection
  vec3 R = reflect(-V, N);
  R.y = abs(R.y) * 0.97 + 0.03;
  vec3 refl = skyColor(normalize(R), 3);
  vec3 Rb = normalize(vec3(R.x, R.y + 0.25 + 0.2 * uChop, R.z));
  vec3 blurred = mix(skyColor(Rb, 1), mix(uHorizon, uZenith, 0.35), 0.4);
  refl = mix(refl, blurred, clamp(rough, 0.0, 0.85));
  float cosT = clamp(dot(N, V), 0.0, 1.0);
  float fres = 0.02 + 0.98 * pow(1.0 - cosT, 5.0);
  fres = clamp(fres, 0.0, 0.9);

  // body colour: deep water + light scattered through the thin crests
  float daylight = clamp(L.y * 2.5 + 0.12, 0.05, 1.0) * (1.0 - 0.55 * uStorm) * (1.0 - 0.8 * uNight);
  vec3 body = uDeep * (0.35 + 0.65 * daylight);
  float thick = clamp(vHeight / max(uAmp, 0.05) * 0.5 + 0.5, 0.0, 1.0);
  float back = pow(clamp(dot(V, -normalize(L + N * 0.55)), 0.0, 1.0), 3.0);
  vec3 sss = uScatter * daylight * (0.1 * thick + 0.95 * back * thick * thick);
  vec3 water = body + sss;
  vec3 col = mix(water, refl, fres);

  // sun: a broad sheen plus a tight highlight plus glitter from the ripples
  vec3 H = normalize(V + L);
  float ndh = max(dot(N, H), 0.0);
  float sunVis = uSunVis;
  col += uSunColor * (pow(ndh, 90.0) * 0.25 + pow(ndh, 1100.0) * 18.0) * sunVis * step(0.0, L.y);
  float sparkleN = hash12(floor(vWorld.xz * 3.0) + floor(uTime * 7.0));
  col += uSunColor * pow(ndh, 260.0) * step(0.985, sparkleN) * 22.0 * sunVis * detailFade;

  // foam: breaking crests (lacy, ridged noise) + downwind streaks + ships
  vec2 wind = normalize(uWind);
  vec2 across = vec2(-wind.y, wind.x);
  vec2 wp = vec2(dot(vWorld.xz, wind), dot(vWorld.xz, across));
  float fn2 = fbm(vWorld.xz * 0.045 + uTime * 0.02, 3);
  // patchiness: only some crests break, more as the wind rises
  // (1) whitecaps: bright, small, sharp, only on the highest crests of
  // some waves; broken up by fine noise so no two look alike.
  float fine = fbm(vWorld.xz * 0.35 - wind * uTime * 0.6, 3);
  float patchy = smoothstep(0.5 - uFoam * 0.4, 0.68 - uFoam * 0.3, fn2);
  float cap = smoothstep(0.5 - uFoam * 0.42, 0.82 - uFoam * 0.4, vCrest + (fine - 0.5) * 0.5);
  float foam = cap * patchy * smoothstep(0.25 - uFoam * 0.2, 0.55, fine) * min(1.0, uFoam * 2.4);
  // (2) residue: thin veined network left behind breaking crests
  float vein = 1.0 - abs(fbm(wp * vec2(0.55, 0.8) - vec2(uTime * 0.3, 0.0), 4) * 2.0 - 1.0);
  float bubbles = smoothstep(0.35, 0.7, fbm(vWorld.xz * 2.2 + uTime * 0.1, 2));
  float residue = smoothstep(0.93, 0.99, vein) * bubbles * smoothstep(-0.2, 0.45, vCrest) * smoothstep(0.35 - uFoam * 0.2, 0.65, fn2);
  foam += residue * uFoam * 0.4 * (0.3 + 0.7 * detailFade);
  foam *= 0.75 + 0.25 * bubbles;
  // far away, individual caps blur into a general whitening of rough water
  foam += (1.0 - detailFade) * uFoam * uFoam * 0.18 * smoothstep(0.1, 0.6, vCrest + fn2 - 0.4);
  // (3) spindrift: faint lines lying downwind, only in a gale
  float st = 1.0 - abs(fbm(wp * vec2(0.03, 0.8) + vec2(-uTime * 0.08, 0.0), 2) * 2.0 - 1.0);
  float streak = smoothstep(0.93, 0.995, st) * smoothstep(0.5, 0.75, fbm(wp * vec2(0.08, 0.12), 2));
  foam += streak * smoothstep(0.45, 0.85, uFoam) * 0.16 * detailFade;
  float hullShade;
  float sf = shipFoam(vWorld.xz, hullShade);
  foam += sf * smoothstep(0.25, 0.7, fbm(vWorld.xz * 0.4 - uTime * 0.2, 3) + 0.25);
  foam = clamp(foam, 0.0, 1.0) * (1.0 - smoothstep(1500.0, 4000.0, dist));
  vec3 foamCol = vec3(0.9, 0.93, 0.95) * (0.35 + 0.65 * daylight) + uSunColor * 0.1 * sunVis;
  col = mix(col, foamCol, foam);
  // darker water in the hull's shadow
  col *= 1.0 - hullShade * 0.25;

  // lightning lights the sea
  col += vec3(0.5, 0.55, 0.7) * uFlash * 0.25 * (0.3 + fres);

  // haze to the horizon
  vec3 hz = skyColor(normalize(vec3(-V.x, 0.015, -V.z)), 2);
  float fog = 1.0 - exp(-dist * uFogDensity);
  col = mix(col, mix(hz, uFogColor, 0.35), clamp(fog, 0.0, 1.0));
  gl_FragColor = vec4(col, 1.0);
}
`;

export function createOcean(atmo, { quality = 'high' } = {}) {
  const hi = quality === 'high';
  const rings = hi ? 280 : 150;
  const segments = hi ? 400 : 200;
  const geo = radialGrid(rings, segments, 12000);
  const uniforms = {
    ...atmo.u,
    uWave: { value: Array.from({ length: MAX_WAVES }, () => new THREE.Vector4()) },
    uWaveDir: { value: Array.from({ length: MAX_WAVES }, () => new THREE.Vector2(1, 0)) },
    uWavePhase: { value: new Float32Array(MAX_WAVES) },
    uCenter: { value: new THREE.Vector2() },
    uSteep: { value: 0.5 },
    uFoam: { value: 0.1 },
    uChop: { value: 0.5 },
    uAmp: { value: 1 },
    uWind: { value: new THREE.Vector2(0, -1) },
    uFogDensity: { value: 0.00012 },
    uFogColor: { value: new THREE.Color() },
    uDetail: { value: hi ? 1 : 0.7 },
    uDetailOct: { value: hi ? 4 : 2 },
    uGrid: { value: new THREE.Vector3(12000, rings, GRID_EXP) },
    uWake: { value: Array.from({ length: MAX_WAKES }, () => new THREE.Vector4()) },
    uWakeB: { value: Array.from({ length: MAX_WAKES }, () => new THREE.Vector4()) },
    uWakeCount: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment, uniforms });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;

  function update(field, camera, target, atmoState) {
    for (let i = 0; i < MAX_WAVES; i++) {
      uniforms.uWave.value[i].set(field.params[i * 4], field.params[i * 4 + 1], field.params[i * 4 + 2], field.params[i * 4 + 3]);
      uniforms.uWaveDir.value[i].set(field.dirs[i * 2], field.dirs[i * 2 + 1]);
      uniforms.uWavePhase.value[i] = field.phases[i];
    }
    let steep = 0;
    for (let i = 0; i < MAX_WAVES; i++) steep += field.params[i * 4 + 1] * field.params[i * 4] * field.params[i * 4 + 3];
    uniforms.uSteep.value = Math.max(0.05, steep);
    uniforms.uFoam.value = field.foam;
    uniforms.uChop.value = field.chop;
    uniforms.uAmp.value = field.amp;
    uniforms.uWind.value.copy(atmoState.windVec);
    uniforms.uFogDensity.value = atmoState.fogDensity;
    uniforms.uFogColor.value.copy(atmoState.fogColor);
    // centre the grid under the camera's ground point, snapped to 6 m
    const cx = Math.round(target.x / 6) * 6;
    const cz = Math.round(target.z / 6) * 6;
    uniforms.uCenter.value.set(cx, cz);
  }

  function setWakes(list) {
    const n = Math.min(MAX_WAKES, list.length);
    for (let i = 0; i < n; i++) {
      const w = list[i];
      uniforms.uWake.value[i].set(w.x, w.z, w.heading, w.speed);
      uniforms.uWakeB.value[i].set(w.halfLength, w.halfBeam, w.fire || 0, w.sinking || 0);
    }
    uniforms.uWakeCount.value = n;
  }

  return { mesh, uniforms, update, setWakes };
}
