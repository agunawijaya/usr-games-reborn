// Skies: the island's day/night dome and the deep-space backdrop.
// The sun and moon move with the engine clock and sit at their true
// compass bearing relative to the player's facing (the scene's -Z is
// "ahead"), so facing east at dawn shows the sunrise.

import * as THREE from 'three';
import { NOISE } from './glsl.js';

/** Scene-space direction of an absolute compass bearing (deg from north) at elevation (deg). */
export function bearingDir(bearingDeg, elevDeg, facingDeg) {
  const rel = THREE.MathUtils.degToRad(bearingDeg - facingDeg);
  const el = THREE.MathUtils.degToRad(elevDeg);
  return new THREE.Vector3(Math.sin(rel) * Math.cos(el), Math.sin(el), -Math.cos(rel) * Math.cos(el));
}

/** Sun and moon for an engine light state. phase: 0..1 within day or night. */
export function celestial(light, facingDeg) {
  const p = light.phase;
  const arc = (q) => ({ bearing: 90 + 180 * q, elev: Math.sin(Math.PI * q) * 72 - 4 });
  if (!light.night) {
    const s = arc(p);
    return { sun: bearingDir(s.bearing, s.elev, facingDeg), sunElev: s.elev, moon: null, night: false };
  }
  const m = arc(p);
  return { sun: bearingDir(90 + 180 * p + 180, -30, facingDeg), sunElev: -30, moon: bearingDir(m.bearing, m.elev * 0.85, facingDeg),
    moonElev: m.elev * 0.85, night: true };
}

// Crisp, sparse stars: one candidate per cell of a direction grid, jittered
// inside the cell, brightness from a steep power law, Gaussian falloff.
const STARS = /* glsl */ `
float bs_stars(vec3 d, float n, float density, float seedOff) {
  vec3 p = d * n;
  vec3 c = floor(p);
  vec3 f = fract(p);
  float s = 0.0;
  float h = bs_hash13(c + seedOff);
  if (h > 1.0 - density) {
    vec3 o = vec3(bs_hash13(c + 11.3 + seedOff), bs_hash13(c + 27.1 + seedOff), bs_hash13(c + 5.7 + seedOff)) * 0.7 + 0.15;
    float r = length(f - o);
    float mag = pow((h - (1.0 - density)) / density, 3.0);
    s = mag * exp(-r * r * 90.0);
  }
  return s;
}
`;

const SKY_FRAG = /* glsl */ `
uniform vec3 uSun; uniform vec3 uMoon; uniform float uNight; uniform float uSunElev; uniform float uCloud;
uniform float uTime; uniform float uSeed; uniform vec3 uHaze; uniform float uStorm;
varying vec3 vDir;
${NOISE}
${STARS}
void main() {
  vec3 d = normalize(vDir);
  float h = max(d.y, 0.0);
  float se = clamp(uSunElev / 60.0, -0.3, 1.0);
  float day = smoothstep(-0.12, 0.25, se) * (1.0 - uNight);
  // Rayleigh-ish gradient
  vec3 zenith = mix(vec3(0.015, 0.03, 0.08), vec3(0.12, 0.34, 0.85), day);
  vec3 horizon = mix(vec3(0.05, 0.07, 0.14), vec3(0.62, 0.78, 0.95), day);
  float low = 1.0 - smoothstep(0.0, 0.35, se);
  vec3 sunset = vec3(1.0, 0.45, 0.16) * low * (1.0 - uNight) * smoothstep(-0.15, 0.1, se);
  float toSun = max(dot(d, normalize(uSun)), 0.0);
  horizon = mix(horizon, sunset * 1.6 + vec3(0.25, 0.1, 0.12), pow(toSun, 3.0) * low * (1.0 - uNight));
  vec3 col = mix(horizon, zenith, pow(h, 0.55));
  col = mix(col, uHaze, (1.0 - smoothstep(0.0, 0.15, h)) * 0.35);
  // sun disc and glow
  if (uNight < 0.5) {
    col += vec3(1.0, 0.85, 0.6) * pow(toSun, 900.0) * 30.0 * smoothstep(-0.05, 0.02, d.y);
    col += vec3(1.0, 0.7, 0.4) * pow(toSun, 12.0) * 0.45 * (0.4 + low);
  }
  // night: stars, a milky band, the moon
  if (uNight > 0.5) {
    float st = (bs_stars(d, 160.0, 0.06, 0.0) + bs_stars(d, 420.0, 0.03, 7.0) * 0.6) * step(0.0, d.y + 0.02);
    float tw = 0.7 + 0.3 * sin(uTime * 2.7 + dot(d, vec3(91.0, 37.0, 53.0)));
    col += vec3(0.9, 0.95, 1.0) * st * 2.2 * tw;
    float band = exp(-pow(dot(d, normalize(vec3(0.4, 0.3, 0.86))) * 3.2, 2.0));
    col += vec3(0.18, 0.2, 0.3) * band * bs_fbm3(d * 6.0 + uSeed) * 0.5;
    float toMoon = max(dot(d, normalize(uMoon)), 0.0);
    float disc = smoothstep(0.99955, 0.99975, toMoon);
    float mare = bs_fbm3(d * 90.0) * 0.35;
    col = mix(col, vec3(1.0, 0.97, 0.9) * (1.1 - mare) * 2.2, disc);
    col += vec3(0.5, 0.55, 0.7) * pow(toMoon, 60.0) * 0.35 + vec3(0.3, 0.33, 0.45) * pow(toMoon, 6.0) * 0.08;
  }
  // clouds: a flat layer projected on the dome
  if (d.y > 0.0 && uCloud > 0.0) {
    vec2 cp = d.xz / (d.y + 0.08) * 1.6 + vec2(uTime * 0.004, uTime * 0.002) + uSeed;
    float c = smoothstep(0.52 - uCloud * 0.25, 0.85, bs_fbm2(cp) + 0.12 * bs_noise2(cp * 5.0));
    vec3 lit = mix(vec3(0.08, 0.09, 0.13), mix(vec3(1.0, 0.93, 0.85), vec3(1.0, 0.6, 0.35), low), day);
    lit += vec3(0.25, 0.27, 0.35) * uNight * pow(max(dot(d, normalize(uMoon)), 0.0), 3.0);
    lit = mix(lit, lit * 0.45, uStorm);
    col = mix(col, lit, c * smoothstep(0.0, 0.2, d.y) * 0.9);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() { vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }
`;

/** The island sky dome (follows the camera). */
export function makeSky() {
  const m = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    uniforms: {
      uSun: { value: new THREE.Vector3(0, 1, 0) }, uMoon: { value: new THREE.Vector3(0, 1, 0) },
      uNight: { value: 0 }, uSunElev: { value: 40 }, uCloud: { value: 0.5 }, uTime: { value: 0 }, uSeed: { value: 0 },
      uHaze: { value: new THREE.Color(0.7, 0.8, 0.9) }, uStorm: { value: 0 },
    },
    side: THREE.BackSide, depthWrite: false, depthTest: true, fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), m);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return mesh;
}

const SPACE_FRAG = /* glsl */ `
uniform float uTime; uniform float uSeed; uniform vec3 uNebA; uniform vec3 uNebB; uniform float uNeb;
varying vec3 vDir;
${NOISE}
${STARS}
void main() {
  vec3 d = normalize(vDir);
  vec3 p = d * 2.2 + uSeed;
  float n = bs_fbm3(p);
  float n2 = bs_fbm3(p * 2.7 + 5.0);
  float dust = smoothstep(0.45, 0.75, bs_fbm3(p * 1.6 + 9.0));
  vec3 neb = mix(uNebA, uNebB, smoothstep(0.3, 0.8, n2)) * smoothstep(0.42, 0.85, n) * uNeb;
  neb *= 1.0 - 0.8 * dust;
  vec3 col = vec3(0.004, 0.005, 0.012) + neb;
  // three layers of crisp stars, denser in the nebula band
  float band = smoothstep(0.3, 0.8, n);
  float a = bs_stars(d, 520.0, 0.05 + 0.05 * band, 0.0) * 1.2;
  float b = bs_stars(d, 190.0, 0.035, 7.0) * 3.0;
  float c = bs_stars(d, 70.0, 0.02, 3.0) * 7.0;
  float tw = 0.8 + 0.2 * sin(uTime * 2.3 + dot(d, vec3(71.0, 13.0, 29.0)));
  vec3 tint = mix(vec3(0.72, 0.82, 1.0), vec3(1.0, 0.86, 0.7), bs_hash13(floor(d * 190.0) + 1.0));
  col += vec3(0.85, 0.9, 1.0) * a + tint * (b + c) * tw;
  gl_FragColor = vec4(col, 1.0);
}`;

/** Deep-space backdrop: nebula + stars. */
export function makeSpace(seed = 0, palette = 0) {
  const PAL = [
    [new THREE.Color(0.35, 0.12, 0.55), new THREE.Color(0.05, 0.35, 0.6)],
    [new THREE.Color(0.55, 0.12, 0.2), new THREE.Color(0.9, 0.45, 0.15)],
    [new THREE.Color(0.05, 0.3, 0.35), new THREE.Color(0.25, 0.1, 0.5)],
  ][palette % 3];
  const m = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT, fragmentShader: SPACE_FRAG,
    uniforms: { uTime: { value: 0 }, uSeed: { value: seed }, uNebA: { value: PAL[0] }, uNebB: { value: PAL[1] }, uNeb: { value: 0.55 } },
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), m);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return mesh;
}

const PLANET_VERT = /* glsl */ `
varying vec3 vN; varying vec3 vP; varying vec3 vV;
void main() { vN = normalize(normalMatrix * normal); vP = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }
`;
const PLANET_FRAG = /* glsl */ `
uniform vec3 uSunV; uniform float uTime; uniform vec3 uOcean; uniform vec3 uLand; uniform vec3 uAtmo; uniform float uIce;
varying vec3 vN; varying vec3 vP; varying vec3 vV;
${NOISE}
void main() {
  vec3 n = normalize(vN); vec3 v = normalize(vV);
  vec3 p = normalize(vP);
  float cont = bs_fbm3(p * 2.2 + 3.0);
  float land = smoothstep(0.52, 0.56, cont);
  vec3 alb = mix(uOcean, uLand * (0.7 + 0.5 * bs_fbm3(p * 9.0)), land);
  alb = mix(alb, vec3(0.85, 0.9, 0.95), smoothstep(0.8 - uIce * 0.3, 0.95, abs(p.y)) * 0.8);
  float cl = smoothstep(0.5, 0.8, bs_fbm3(p * 3.5 + vec3(uTime * 0.01, 0.0, 0.0)));
  alb = mix(alb, vec3(0.92), cl * 0.7);
  float ndl = dot(n, normalize(uSunV));
  float lit = smoothstep(-0.08, 0.35, ndl);
  vec3 col = alb * lit * 0.85;
  float spec = pow(max(dot(reflect(-normalize(uSunV), n), v), 0.0), 60.0) * (1.0 - land) * (1.0 - cl);
  col += vec3(1.0, 0.9, 0.7) * spec * lit;
  float rim = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  col += uAtmo * rim * (0.12 + 0.55 * smoothstep(-0.3, 0.4, ndl));
  gl_FragColor = vec4(col, 1.0);
}`;
const HALO_FRAG = /* glsl */ `
uniform vec3 uSunV; uniform vec3 uAtmo;
varying vec3 vN; varying vec3 vP; varying vec3 vV;
void main() {
  vec3 n = normalize(vN); vec3 v = normalize(vV);
  float rim = pow(1.0 - abs(dot(n, v)), 4.0);
  float lit = smoothstep(-0.4, 0.5, dot(n, normalize(uSunV)));
  gl_FragColor = vec4(uAtmo * rim * lit * 0.55, rim * lit);
}`;

/** A planet with oceans, continents, clouds and an atmospheric rim. */
export function makePlanet(kind = 'tropical') {
  const pal = kind === 'blue'
    ? { ocean: [0.02, 0.1, 0.35], land: [0.55, 0.62, 0.7], atmo: [0.35, 0.55, 1.0], ice: 1 }
    : { ocean: [0.01, 0.16, 0.26], land: [0.12, 0.36, 0.12], atmo: [0.45, 0.75, 1.0], ice: 0 };
  const u = {
    uSunV: { value: new THREE.Vector3(1, 0.3, 0.4) }, uTime: { value: 0 },
    uOcean: { value: new THREE.Color(...pal.ocean) }, uLand: { value: new THREE.Color(...pal.land) },
    uAtmo: { value: new THREE.Color(...pal.atmo) }, uIce: { value: pal.ice },
  };
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), new THREE.ShaderMaterial({ vertexShader: PLANET_VERT, fragmentShader: PLANET_FRAG, uniforms: u, fog: false }));
  const halo = new THREE.Mesh(new THREE.SphereGeometry(1.06, 64, 48), new THREE.ShaderMaterial({ vertexShader: PLANET_VERT, fragmentShader: HALO_FRAG, uniforms: u, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide, fog: false }));
  g.add(body, halo);
  g.userData.u = u;
  return g;
}
