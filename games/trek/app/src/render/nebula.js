// trek/procedural-web — per-quadrant volumetric nebula.
//
// Each quadrant's sky is generated from (qx, qy): a palette, a structure
// style, embedded stars and a star-field density are all drawn from a
// seeded RNG, so the same quadrant always shows the same sky (the painted
// port does this with `hash(qx,qy) mod 7` over seven images; here every
// one of the 64 quadrants is its own sky).
//
// The expensive part — an emission/absorption march through 3D gradient
// noise — runs once per quadrant into a half-float render target:
//   rgb = light emitted towards the camera (HDR)
//   a   = transmittance, so background stars disappear behind dust lanes
// Every frame, a cheap full-screen shader cover-fits that bake with a slow
// parallax drift, adds analytic anti-aliased star fields (dimmed by the
// transmittance) and the sharp cores + diffraction spikes of the embedded
// stars whose light is baked into the gas.

import * as THREE from 'three';
import { NOISE, HASH, FULLSCREEN_VERT } from './glsl.js';
import { mulberry32, quadrantSeed, rrange } from './rng.js';

// ---------------------------------------------------------------------------
// Palettes — loosely after real narrow-band / RGB astrophotography.
// gas: dim → bright emission ramp. dust: lit dust tint. sky: faint floor.
// ---------------------------------------------------------------------------

export const PALETTES = [
  { name: 'hydrogen crimson', gas: ['#2a0610', '#8c1630', '#ff5a6e', '#ffd3a8'], dust: '#3a1a10', sky: '#07040a', stars: ['#fff1d8', '#ffc8a0'], filament: 0.35 },
  { name: 'pillars (SHO)',    gas: ['#06202a', '#127a86', '#e0a64a', '#fff4d6'], dust: '#2c1a0c', sky: '#030709', stars: ['#fff8e8', '#cfe8ff'], filament: 0.25 },
  { name: 'reflection blue',  gas: ['#030a2a', '#173f96', '#4f8fe8', '#b8dcff'], dust: '#10141c', sky: '#02040c', stars: ['#dbe9ff', '#ffffff'], filament: 0.15 },
  { name: 'orion magenta',    gas: ['#1c0626', '#7a1a78', '#ff5fb0', '#ffc78a'], dust: '#2a1016', sky: '#06030a', stars: ['#ffe9f4', '#ffd9b0'], filament: 0.3 },
  { name: 'oxygen teal',      gas: ['#02161a', '#0d6a64', '#48e0c0', '#e8fff4'], dust: '#0f1a18', sky: '#020707', stars: ['#e8fff8', '#fff3cf'], filament: 0.55 },
  { name: 'carina amber',     gas: ['#1c0c04', '#7a3a10', '#f09a3a', '#fff0c8'], dust: '#241208', sky: '#060403', stars: ['#fff4dc', '#bfdcff'], filament: 0.3 },
  { name: 'violet storm',     gas: ['#0c0620', '#2e2266', '#9a7cff', '#f0d8ff'], dust: '#140c20', sky: '#040310', stars: ['#efe8ff', '#cde6ff'], filament: 0.45 },
  { name: 'veil remnant',     gas: ['#04121e', '#1a5c7a', '#62d0ff', '#ffb98a'], dust: '#10141a', sky: '#02050a', stars: ['#e0f2ff', '#ffe2c8'], filament: 0.95 },
  { name: 'ice and fire',     gas: ['#0a0c24', '#1c4a9a', '#ff7a3c', '#fff0d8'], dust: '#1c1410', sky: '#040508', stars: ['#fff0dc', '#d6e8ff'], filament: 0.4 },
  { name: 'dark lane',        gas: ['#0a0808', '#3c2418', '#a8683c', '#f4d8b8'], dust: '#140c08', sky: '#050505', stars: ['#ffe8cc', '#ffffff'], filament: 0.2 },
];

const lin = (hex) => new THREE.Color(hex);  // ColorManagement converts sRGB hex → linear

/** Everything that defines quadrant (qx, qy)'s sky. Pure function. */
export function skyParams(qx, qy) {
  const rand = mulberry32(quadrantSeed(qx, qy));
  const palIndex = Math.floor(rand() * PALETTES.length);
  const pal = PALETTES[palIndex];
  const dark = pal.name === 'dark lane';
  const embCount = 1 + Math.floor(rand() * 3);
  const emb = [];
  for (let i = 0; i < 4; i++) {
    const on = i < embCount;
    // Keep bright background stars out of the central play area, where
    // they could be mistaken for the quadrant's own (navigational) stars.
    let x = rrange(rand, 0.1, 0.9), y = rrange(rand, 0.1, 0.9);
    if (Math.abs(x - 0.5) < 0.3 && Math.abs(y - 0.5) < 0.3) {
      if (Math.abs(x - 0.5) > Math.abs(y - 0.5)) x = x < 0.5 ? x - 0.3 : x + 0.3;
      else y = y < 0.5 ? y - 0.3 : y + 0.3;
      x = Math.min(0.95, Math.max(0.05, x));
      y = Math.min(0.95, Math.max(0.05, y));
    }
    emb.push({
      x,
      y,
      z: rrange(rand, 0.15, 0.85),
      radius: rrange(rand, 0.06, 0.17),
      power: on ? rrange(rand, 0.6, 1.8) * [1, 0.6, 0.4, 0.3][i] : 0,
      core: on ? rrange(rand, 0.6, 1.4) * [1, 0.5, 0.3, 0.2][i] : 0,
      color: pal.stars[Math.floor(rand() * pal.stars.length)],
    });
  }
  const bandAngle = rand() * Math.PI;
  return {
    qx, qy, palIndex, palette: pal,
    seed: [rrange(rand, -400, 400), rrange(rand, -400, 400), rrange(rand, -400, 400)],
    scale: rrange(rand, 2.1, 3.1),
    coverage: dark ? rrange(rand, 0.47, 0.53) : rrange(rand, 0.43, 0.55),
    density: dark ? rrange(rand, 0.9, 1.2) : rrange(rand, 1.4, 2.4),
    dust: dark ? rrange(rand, 1.2, 1.6) : rrange(rand, 0.35, 1.1),
    filament: pal.filament * rrange(rand, 0.7, 1.3),
    warp: rrange(rand, 0.5, 1.3),
    ambient: rrange(rand, 0.35, 0.6),
    band: rrange(rand, 0.0, 1.0) < 0.55 ? rrange(rand, 0.25, 0.7) : 0.0,
    bandDir: [Math.cos(bandAngle), Math.sin(bandAngle)],
    bandWidth: rrange(rand, 0.25, 0.5),
    starDensity: rrange(rand, 0.75, 1.35),
    emb,
    // Direction of the dominant light in this sky, used for ship key light.
    keyDir: (() => {
      const e = emb[0];
      return new THREE.Vector3((e.x - 0.5) * 2, 1.4, (e.y - 0.5) * 2).normalize();
    })(),
    keyColor: pal.stars[0],
    ambientColor: pal.gas[1],
    planet: planetParams(qx, qy, emb),
  };
}

// ---------------------------------------------------------------------------
// Sky planets — hero objects for about half the quadrants. Kept off the
// play grid: a big horizon arc rising from the top or bottom edge, or a
// smaller world in the free band beside the grid. Drawn once into the bake.
// A separate RNG stream, so adding planets did not reshuffle any nebula.
// ---------------------------------------------------------------------------

const PLANET_KINDS = {
  gas: [
    ['#d2aa80', '#8a5a3a', '#f4e2c6', '#f0c898'],
    ['#78a8d0', '#2e5a86', '#dcecf8', '#a8d4ff'],
    ['#d8b070', '#a0602e', '#fff0d0', '#ffd8a0'],
    ['#a898d0', '#4a3a78', '#e4dcf8', '#c8b8ff'],
    ['#90c8b0', '#2e6a5a', '#e2f4ea', '#a8f0d8'],
  ],
  terran: [['#16386e', '#56763a', '#8c7852', '#7fb8ff'], ['#1a4a6a', '#6a6a3a', '#a08a5a', '#8fd0ff']],
  barren: [['#8a8078', '#4a4440', '#b8aca0', '#b0a8a0'], ['#b8c8d8', '#708090', '#eef4fa', '#c8e0ff'], ['#9a6a4a', '#5a3a2a', '#c89a70', '#e0a080']],
};

function planetParams(qx, qy, emb) {
  const r = mulberry32(quadrantSeed(qx, qy) ^ 0x51A7E7);
  if (r() > 0.5) return null;
  const k = r();
  const kind = k < 0.45 ? 'gas' : k < 0.7 ? 'terran' : 'barren';
  const set = PLANET_KINDS[kind];
  const colors = set[Math.floor(r() * set.length)];
  let x, y, radius;
  if (r() < 0.5) {
    // Horizon arc: centre just beyond the top or bottom edge.
    radius = rrange(r, 0.3, 0.46);
    x = rrange(r, 0.3, 0.7);
    y = r() < 0.5 ? -radius * rrange(r, 0.22, 0.4) : 1 + radius * rrange(r, 0.22, 0.4);
  } else {
    radius = rrange(r, 0.09, 0.15);
    x = r() < 0.5 ? rrange(r, 0.17, 0.27) : rrange(r, 0.73, 0.83);
    y = rrange(r, 0.22, 0.78);
  }
  // No embedded star may shine through the planet.
  for (const e of emb) {
    if (Math.hypot((e.x - x) * 1.6, e.y - y) < radius * 1.4) e.x = 1 - e.x;
  }
  const key = emb[0];
  const L = new THREE.Vector3((key.x - x) * 1.6, key.y - y, 0.55).normalize();
  return {
    kind, colors, x, y, radius, light: L,
    type: kind === 'gas' ? 0 : kind === 'terran' ? 1 : 2,
    ring: kind === 'gas' && r() < 0.55,
    ringTilt: rrange(r, 0.18, 0.4), ringAngle: rrange(r, -0.5, 0.5),
    seed: rrange(r, 0, 100),
  };
}

// One layer of anti-aliased point stars — used per frame (twinkling) or,
// in the Lite profile, baked once into the sky texture.
const STAR_LAYER = /* glsl */ `
uniform float uTime, uTwinkle;
// One layer of anti-aliased point stars on a jittered grid.
vec3 starLayer(vec2 p, float thresh, float seed) {
  vec2 cell = floor(p);
  vec2 f = fract(p);
  vec3 acc = vec3(0.0);
  float px = max(fwidth(p.x), 1e-4);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 c = cell + vec2(i, j);
    float h = hash12(c + seed);
    if (h < thresh) continue;
    vec2 pos = hash22(c + seed * 1.7) * 0.8 + 0.1 + vec2(i, j);
    float mag = pow((h - thresh) / (1.0 - thresh), 4.0);
    float r = length(f - pos) / px;
    float size = 0.5 + mag * 0.9;
    float s = exp(-r * r / (size * size));
    float temp = hash12(c + seed * 3.1);
    vec3 tint = temp < 0.25 ? vec3(1.0, 0.72, 0.5) : temp < 0.55 ? vec3(1.0, 0.95, 0.85) : temp < 0.85 ? vec3(0.85, 0.92, 1.0) : vec3(0.65, 0.78, 1.0);
    float tw = 1.0 + uTwinkle * 0.3 * sin(uTime * (1.3 + hash12(c + 9.1) * 3.0) + h * 60.0) * step(0.5, hash12(c + 2.2));
    acc += tint * s * (0.05 + mag * 3.2) * tw;
  }
  return acc;
}

`;

// ---------------------------------------------------------------------------
// Bake shader
// ---------------------------------------------------------------------------

const BAKE_FRAG = NOISE + STAR_LAYER + /* glsl */ `
uniform vec3 uSeed;
uniform float uAspect, uScale, uCoverage, uDensity, uDust, uFilament, uWarpAmt, uAmbient;
uniform int uSteps, uOct;
uniform vec3 uGas0, uGas1, uGas2, uGas3, uDustCol, uSky;
uniform float uBand, uBandWidth;
uniform vec2 uBandDir;
uniform vec3 uBandCol;
uniform vec4 uEmb[4];      // xy uv, z depth, w radius
uniform vec3 uEmbCol[4];   // colour * power
uniform float uBakeStars, uStarDensity, uSeedF;
uniform vec4 uPlanet;          // xy centre (uv), z radius (uv height), w type (-1 none, 0 gas, 1 terran, 2 barren)
uniform vec3 uPlA, uPlB, uPlC, uPlAtm, uPlL;
uniform vec4 uRing;            // x tilt, y angle, z on, w seed
varying vec2 vUv;

vec3 planetSurface(vec3 n) {
  float seed = uRing.w;
  if (uPlanet.w < 0.5) {
    // Gas giant: latitude bands, stretched by turbulence, with storms.
    float turb = fbm3(n * vec3(2.0, 7.0, 2.0) + seed, 4);
    float lat = n.y * 9.0 + turb * 1.6;
    float bands = 0.5 + 0.5 * sin(lat * 2.0 + fbm3(n * 3.0 + seed * 1.3, 3) * 2.5);
    vec3 c = mix(uPlA, uPlB, smoothstep(0.2, 0.8, bands));
    float fine = 0.5 + 0.5 * sin(lat * 7.0 + turb * 4.0);
    c = mix(c, uPlC, fine * 0.25);
    float storm = smoothstep(0.62, 0.7, fbm3(n * 4.0 + seed * 2.1, 4) * 0.5 + 0.5);
    return mix(c, uPlC * 1.1, storm * 0.6);
  } else if (uPlanet.w < 1.5) {
    // Terran: oceans, continents, ice caps, clouds.
    float h = fbm3(n * 2.1 + seed, 6);
    float land = smoothstep(0.02, 0.07, h);
    vec3 c = mix(uPlA * (0.8 + 0.4 * smoothstep(-0.4, 0.0, h)), mix(uPlB, uPlC, smoothstep(0.1, 0.35, h)), land);
    c = mix(c, vec3(0.92, 0.95, 1.0), smoothstep(0.72, 0.85, abs(n.y) + h * 0.2));
    float clouds = smoothstep(0.05, 0.45, fbm3(n * 3.2 + vec3(seed * 3.0, 0.0, 1.0), 5));
    return mix(c, vec3(0.82, 0.85, 0.9), clouds * 0.55);
  }
  // Barren / icy: craters and mottling.
  float m = fbm3(n * 3.0 + seed, 5);
  float cr = ridged3(n * 5.0 + seed * 1.7, 4);
  vec3 c = mix(uPlB, uPlA, smoothstep(-0.3, 0.3, m));
  return mix(c, uPlC, smoothstep(0.55, 0.85, cr) * 0.6);
}

vec3 gasRamp(float t) {
  t = clamp(t, 0.0, 1.0);
  vec3 c = mix(uGas0, uGas1, smoothstep(0.0, 0.4, t));
  c = mix(c, uGas2, smoothstep(0.35, 0.75, t));
  return mix(c, uGas3, smoothstep(0.72, 1.0, t));
}

void main() {
  vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0) * uScale;
  // 2D domain warp, once per pixel: gives the gas its swirls.
  vec2 w = vec2(fbm2(p * 0.8 + uSeed.xy * 0.01), fbm2(p * 0.8 + uSeed.yz * 0.01 + 7.3)) - 0.5;
  vec2 pw = p + w * uWarpAmt * 1.6;
  // Large-scale envelope: where the cloud masses are, where the voids are.
  float env = fbm2(pw * 0.38 + uSeed.zx * 0.013);
  env = smoothstep(uCoverage - 0.1, uCoverage + 0.14, env);
  float envSoft = smoothstep(uCoverage - 0.3, uCoverage + 0.1, fbm2(pw * 0.38 + uSeed.zx * 0.013));

  // Dust lanes cluster in some regions instead of veining the whole sky.
  float laneMask = smoothstep(0.38, 0.62, fbm2(pw * 0.55 + uSeed.xz * 0.017 + 21.0));
  // Large-scale brightness modulation: some cloud masses glow, some sulk.
  float glowMod = 0.15 + 1.6 * smoothstep(0.35, 0.72, fbm2(pw * 0.6 + uSeed.yx * 0.021 + 5.0));

  float steps = float(uSteps);
  float jitter = hash12(gl_FragCoord.xy + uSeed.xy);
  float T = 1.0;
  vec3 col = vec3(0.0);
  for (int i = 0; i < 40; i++) {
    if (i >= uSteps) break;
    float z = (float(i) + jitter) / steps;          // 0 = nearest the viewer
    vec3 q = vec3(pw, z * 1.6) + uSeed * 0.01;
    // Cloud shape: a low-frequency body eroded by high-frequency detail,
    // the same trick real-time cloud renderers use for crisp edges.
    float body = fbm3(q * 1.05, 4);
    float detail = fbm3(q * 4.2 + 30.0, uOct);
    float shape = body * 0.95 + (env - 0.5) * 1.25 - detail * 0.32;
    float gas = smoothstep(0.02, 0.42, shape);
    float rim = gas * (1.0 - gas) * 4.0;            // ionisation fronts at cloud edges
    gas = gas * gas;
    float fil = ridged3(q * 2.4 + 4.0, uOct - 1);
    float filament = pow(fil, 5.0) * uFilament * (0.2 + envSoft) * 1.6;
    // Dust: thin dark lanes plus broad dark clouds.
    float lane = ridged3(q * vec3(1.7, 1.7, 0.8) + 11.0, 4);
    float dust = smoothstep(0.62, 0.9, lane) * 1.4 * laneMask + max(0.0, fbm3(q * 0.8 + 50.0, 3) - 0.12) * 0.8;
    dust *= uDust * (0.3 + envSoft);

    float tc = clamp(0.3 + 0.42 * gnoise(q * 0.55 + 2.0) + gas * 0.3 + rim * 0.18, 0.0, 1.0);
    vec3 ec = gasRamp(tc) * glowMod + gasRamp(0.7) * rim * 0.35 * glowMod + gasRamp(0.85) * filament;
    gas = gas * 0.9 + filament * 0.25 + rim * 0.12;

    vec3 light = vec3(uAmbient);
    for (int k = 0; k < 4; k++) {
      vec2 dd = (vUv - uEmb[k].xy) * vec2(uAspect, 1.0);
      float dzz = (z - uEmb[k].z) * 0.3;
      float r2 = dot(dd, dd) + dzz * dzz;
      float rr = uEmb[k].w;
      light += uEmbCol[k] / (1.0 + r2 / (rr * rr)) ;
    }
    float dz = 1.0 / steps;
    vec3 emission = ec * gas * light * uDensity;
    emission += uDustCol * dust * light * 0.08;       // lit dust scatters a little
    col += T * emission * dz;
    T *= exp(-(gas * 0.7 + dust * 3.2) * dz * 2.4);
  }
  float band = exp(-pow(dot(p / uScale, uBandDir) / uBandWidth, 2.0)) * uBand;
  float bandNoise = 0.6 + 0.8 * fbm2(pw * 1.7 + 3.0);
  col += (uSky + uBandCol * band * bandNoise) * T;

  if (uPlanet.w > -0.5) {
    vec2 d = (vUv - uPlanet.xy) * vec2(uAspect, 1.0) / uPlanet.z;
    float r = length(d);
    float aa = fwidth(r) * 1.5;
    // Ring geometry (drawn after the disc; the near half crosses in front).
    vec3 ringCol = vec3(0.0);
    float ringA = 0.0, ringFront = 0.0;
    if (uRing.z > 0.5) {
      float ca = cos(uRing.y), sa = sin(uRing.y);
      vec2 q = vec2(ca * d.x + sa * d.y, -sa * d.x + ca * d.y);
      float rr = length(vec2(q.x, q.y / uRing.x));
      float band = smoothstep(1.35, 1.42, rr) * smoothstep(2.35, 2.2, rr);
      float grooves = 0.55 + 0.45 * sin(rr * 38.0 + fbm2(vec2(rr * 9.0, uRing.w)) * 3.0);
      float gap = smoothstep(0.02, 0.05, abs(rr - 1.86));
      ringA = band * grooves * gap * 0.85;
      ringFront = step(q.y, 0.0);
      ringCol = mix(uPlC, uPlA, 0.4) * (0.35 + 0.65 * clamp(dot(normalize(vec3(q, 0.3)), uPlL) * 0.5 + 0.6, 0.0, 1.0));
    }
    if (r < 1.0 + aa) {
      float z = sqrt(max(0.0, 1.0 - r * r));
      vec3 n = vec3(d, z);
      float ndl = dot(n, uPlL);
      float lit = smoothstep(-0.06, 0.35, ndl);
      float limb = 0.5 + 0.5 * z;
      vec3 pc = planetSurface(n) * (lit * limb * 0.46 + 0.006);
      pc *= mix(vec3(1.0, 0.72, 0.55), vec3(1.0), smoothstep(0.0, 0.3, ndl));   // warm terminator
      float rim = pow(1.0 - z, 3.0);
      pc += uPlAtm * rim * (0.03 + lit * 0.22);
      float cover = smoothstep(1.0 + aa, 1.0 - aa, r);
      col = mix(col, pc, cover);
      T = mix(T, 0.0, cover);
    } else {
      // Thin atmospheric halo on the lit side.
      vec2 dn = d / max(r, 1e-4);
      float side = clamp(dot(vec3(dn, 0.0), uPlL) * 0.8 + 0.35, 0.0, 1.0);
      col += uPlAtm * exp(-(r - 1.0) * 22.0) * side * 0.12;
    }
    if (ringA > 0.0) {
      float behind = (r < 1.0 && ringFront < 0.5) ? 0.0 : 1.0;
      col = mix(col, ringCol * 0.28, ringA * behind);
      T = mix(T, T * 0.4, ringA * behind);
    }
  }

  if (uBakeStars > 0.5) {
    // Lite profile: stars are baked (no twinkle) so the per-frame pass is one fetch.
    vec2 sp = vUv * vec2(uAspect, 1.0);
    // The Lite bake is upscaled ~2× on screen: fewer, dimmer stars so they
    // stay pin-points instead of blobs.
    vec3 stars = starLayer(sp * 150.0, 1.0 - 0.06 * uStarDensity, uSeedF) * 0.55
               + starLayer(sp * 60.0, 1.0 - 0.012 * uStarDensity, uSeedF + 19.0) * 0.7
               + starLayer(sp * 24.0, 1.0 - 0.006 * uStarDensity, uSeedF + 41.0) * 1.0;
    col += stars * mix(0.08, 1.0, T);
  }
  gl_FragColor = vec4(col, T);
}
`;

// ---------------------------------------------------------------------------
// Background (per frame) shader
// ---------------------------------------------------------------------------

const BG_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 1.0, 1.0);
}
`;

// Mean-luminance probe: 32×20 cells, 16 taps each, luminance in R.
const MEASURE_FRAG = /* glsl */ `
uniform sampler2D tBake;
varying vec2 vUv;
void main() {
  float l = 0.0;
  for (int j = 0; j < 4; j++) for (int i = 0; i < 4; i++) {
    vec2 o = (vec2(float(i), float(j)) - 1.5) / vec2(32.0 * 4.0, 20.0 * 4.0);
    vec3 c = texture2D(tBake, vUv + o).rgb;
    l += dot(c, vec3(0.2126, 0.7152, 0.0722));
  }
  gl_FragColor = vec4(clamp(l / 16.0 * 4.0, 0.0, 1.0), 0.0, 0.0, 1.0);
}
`;



const BG_FRAG = HASH + STAR_LAYER + /* glsl */ `
uniform sampler2D tBake;
uniform vec2 uCover;       // viewport → bake uv scale (cover fit)
uniform vec2 uOffset;      // parallax drift, bake uv units
uniform float uBakeAspect;
uniform float uDim, uStarDensity, uSeedF, uSkyExposure, uEmbScale, uStarsBaked;
uniform vec4 uEmb[4];      // xy uv, z core size, w core intensity
uniform vec3 uEmbCol[4];
varying vec2 vUv;

void main() {
  vec2 uv = (vUv - 0.5) * uCover + 0.5 + uOffset;
  vec4 neb = texture2D(tBake, uv);
  neb.rgb *= uSkyExposure;
  vec2 sp = uv * vec2(uBakeAspect, 1.0);
  vec3 col = neb.rgb;
  if (uStarsBaked < 0.5) {
    vec3 stars = starLayer(sp * 190.0, 1.0 - 0.14 * uStarDensity, uSeedF)
               + starLayer(sp * 80.0, 1.0 - 0.022 * uStarDensity, uSeedF + 19.0) * 1.2
               + starLayer(sp * 30.0, 1.0 - 0.01 * uStarDensity, uSeedF + 41.0) * 1.8;
    col += stars * mix(0.08, 1.0, neb.a);
  }

  // Embedded stars: sharp core, soft glow and four diffraction spikes.
  for (int k = 0; k < 4; k++) {
    if (uEmb[k].w <= 0.0) continue;
    vec2 d = (uv - uEmb[k].xy) * vec2(uBakeAspect, 1.0);
    float r = length(d);
    float sz = uEmb[k].z;
    float core = exp(-r * r / (sz * sz * 0.012));
    float glow = exp(-r / (sz * 0.55)) * 0.3;
    vec2 a = abs(d);
    vec2 b = abs(vec2(d.x + d.y, d.x - d.y) * 0.7071);
    float L = sz * 1.1;
    float spikes = exp(-a.y / (sz * 0.01)) * exp(-(a.x * a.x) / (L * L))
                 + exp(-a.x / (sz * 0.01)) * exp(-(a.y * a.y) / (L * L));
    spikes += 0.25 * (exp(-b.y / (sz * 0.008)) * exp(-(b.x * b.x) / (L * L * 0.3)) + exp(-b.x / (sz * 0.008)) * exp(-(b.y * b.y) / (L * L * 0.3)));
    col += uEmbCol[k] * uEmb[k].w * uEmbScale * (core * 12.0 + glow + spikes * 1.2);
  }
  gl_FragColor = vec4(col * uDim, 1.0);
}
`;

// ---------------------------------------------------------------------------
// Environment map (tiny equirect of the same sky, for hull reflections)
// ---------------------------------------------------------------------------

const ENV_FRAG = NOISE + /* glsl */ `
uniform vec3 uGas0, uGas1, uGas2, uSky, uKeyDir, uKeyCol;
uniform vec3 uSeed;
varying vec2 vUv;
void main() {
  float phi = vUv.x * 6.2831853, th = vUv.y * 3.1415926;
  vec3 dir = vec3(sin(th) * cos(phi), cos(th), sin(th) * sin(phi));
  float n = fbm2(dir.xz * 2.2 + dir.y * 1.3 + uSeed.xy * 0.01);
  float m = smoothstep(0.35, 0.8, n);
  vec3 c = mix(uGas0 * 0.6, uGas1, m) + uGas2 * pow(m, 3.0) * 0.6 + uSky;
  float k = max(0.0, dot(dir, normalize(uKeyDir)));
  c += uKeyCol * (pow(k, 40.0) * 6.0 + pow(k, 4.0) * 0.35);
  gl_FragColor = vec4(c, 1.0);
}
`;

export class Nebula {
  /**
   * @param renderer THREE.WebGLRenderer
   * @param profile  { bakeW, bakeH, steps, octaves, env }
   */
  constructor(renderer, profile) {
    this.renderer = renderer;
    this.profile = profile;
    this.rt = this._makeTarget();
    this.params = null;
    this.key = null;
    this.envMap = null;
    this.pmrem = profile.env ? new THREE.PMREMGenerator(renderer) : null;

    this.fsGeo = new THREE.BufferGeometry();
    this.fsGeo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));

    this.bakeMat = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERT, fragmentShader: BAKE_FRAG,
      uniforms: {
        uSeed: { value: new THREE.Vector3() }, uAspect: { value: 1.6 }, uScale: { value: 2.5 },
        uCoverage: { value: 0.45 }, uDensity: { value: 1 }, uDust: { value: 0.6 }, uFilament: { value: 0.3 },
        uWarpAmt: { value: 1 }, uAmbient: { value: 0.4 }, uSteps: { value: 16 }, uOct: { value: 5 },
        uGas0: { value: new THREE.Color() }, uGas1: { value: new THREE.Color() }, uGas2: { value: new THREE.Color() }, uGas3: { value: new THREE.Color() },
        uDustCol: { value: new THREE.Color() }, uSky: { value: new THREE.Color() },
        uBand: { value: 0 }, uBandWidth: { value: 0.4 }, uBandDir: { value: new THREE.Vector2(1, 0) }, uBandCol: { value: new THREE.Color() },
        uEmb: { value: [0, 1, 2, 3].map(() => new THREE.Vector4()) },
        uEmbCol: { value: [0, 1, 2, 3].map(() => new THREE.Color()) },
        uBakeStars: { value: 0 }, uStarDensity: { value: 1 }, uSeedF: { value: 0 },
        uPlanet: { value: new THREE.Vector4(0, 0, 0, -1) },
        uPlA: { value: new THREE.Color() }, uPlB: { value: new THREE.Color() }, uPlC: { value: new THREE.Color() },
        uPlAtm: { value: new THREE.Color() }, uPlL: { value: new THREE.Vector3(0, 0, 1) },
        uRing: { value: new THREE.Vector4(0.3, 0, 0, 0) },
      },
      depthTest: false, depthWrite: false,
    });
    this.bakeScene = new THREE.Scene();
    this.bakeCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const bakeMesh = new THREE.Mesh(this.fsGeo, this.bakeMat);
    bakeMesh.frustumCulled = false;
    this.bakeScene.add(bakeMesh);

    this.bgMat = new THREE.ShaderMaterial({
      vertexShader: BG_VERT, fragmentShader: BG_FRAG,
      uniforms: {
        tBake: { value: this.rt.texture }, uCover: { value: new THREE.Vector2(1, 1) },
        uOffset: { value: new THREE.Vector2() }, uBakeAspect: { value: profile.bakeW / profile.bakeH },
        uTime: { value: 0 }, uDim: { value: 1 }, uStarDensity: { value: 1 }, uTwinkle: { value: 1 }, uSeedF: { value: 0 },
        uSkyExposure: { value: 1 }, uEmbScale: { value: 1 }, uStarsBaked: { value: 0 },
        uEmb: { value: [0, 1, 2, 3].map(() => new THREE.Vector4()) },
        uEmbCol: { value: [0, 1, 2, 3].map(() => new THREE.Color()) },
      },
      depthTest: false, depthWrite: false,
    });
    this.measureMat = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERT, fragmentShader: MEASURE_FRAG,
      uniforms: { tBake: { value: this.rt.texture } }, depthTest: false, depthWrite: false,
    });
    this.measureRT = new THREE.WebGLRenderTarget(32, 20, { depthBuffer: false });
    this.measureScene = new THREE.Scene();
    const mm = new THREE.Mesh(this.fsGeo, this.measureMat);
    mm.frustumCulled = false;
    this.measureScene.add(mm);
    this.measurePixels = new Uint8Array(32 * 20 * 4);
    /** Mean sky luminance the auto-exposure aims for (linear). */
    this.targetLuminance = 0.05;
    /** Full-screen quad to put first in any scene (renderOrder −1000). */
    this.backgroundMesh = new THREE.Mesh(this.fsGeo, this.bgMat);
    this.backgroundMesh.frustumCulled = false;
    this.backgroundMesh.renderOrder = -1000;
  }

  _makeTarget() {
    return new THREE.WebGLRenderTarget(this.profile.bakeW, this.profile.bakeH, {
      type: THREE.HalfFloatType, format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      depthBuffer: false, generateMipmaps: false,
    });
  }

  setProfile(profile) {
    const resized = profile.bakeW !== this.profile.bakeW || profile.bakeH !== this.profile.bakeH;
    this.profile = profile;
    if (resized) {
      this.rt.dispose();
      this.rt = this._makeTarget();
      this.bgMat.uniforms.tBake.value = this.rt.texture;
      this.bgMat.uniforms.uBakeAspect.value = profile.bakeW / profile.bakeH;
    }
    if (profile.env && !this.pmrem) this.pmrem = new THREE.PMREMGenerator(this.renderer);
    const k = this.key;
    this.key = null;
    if (k) this.bake(k[0], k[1]);
  }

  /** Bake quadrant (qx, qy)'s sky. Cheap no-op if already current. */
  bake(qx, qy) {
    if (this.key && this.key[0] === qx && this.key[1] === qy) return this.params;
    const P = skyParams(qx, qy);
    this.params = P;
    this.key = [qx, qy];
    const u = this.bakeMat.uniforms;
    u.uSeed.value.set(...P.seed);
    u.uAspect.value = this.profile.bakeW / this.profile.bakeH;
    u.uScale.value = P.scale;
    u.uCoverage.value = P.coverage;
    u.uDensity.value = P.density;
    u.uDust.value = P.dust;
    u.uFilament.value = P.filament;
    u.uWarpAmt.value = P.warp;
    u.uAmbient.value = P.ambient;
    u.uSteps.value = this.profile.steps;
    u.uBakeStars.value = this.profile.bakedStars ? 1 : 0;
    const pl = P.planet;
    if (pl) {
      u.uPlanet.value.set(pl.x, pl.y, pl.radius, pl.type);
      u.uPlA.value.copy(lin(pl.colors[0]));
      u.uPlB.value.copy(lin(pl.colors[1]));
      u.uPlC.value.copy(lin(pl.colors[2]));
      u.uPlAtm.value.copy(lin(pl.colors[3]));
      u.uPlL.value.copy(pl.light);
      u.uRing.value.set(pl.ringTilt, pl.ringAngle, pl.ring ? 1 : 0, pl.seed);
    } else {
      u.uPlanet.value.set(0, 0, 0, -1);
    }
    u.uStarDensity.value = P.starDensity;
    u.uSeedF.value = (qx * 8 + qy) * 3.17;
    u.uOct.value = this.profile.octaves;
    u.uGas0.value.copy(lin(P.palette.gas[0]));
    u.uGas1.value.copy(lin(P.palette.gas[1]));
    u.uGas2.value.copy(lin(P.palette.gas[2]));
    u.uGas3.value.copy(lin(P.palette.gas[3]));
    u.uDustCol.value.copy(lin(P.palette.dust));
    u.uSky.value.copy(lin(P.palette.sky));
    u.uBand.value = P.band;
    u.uBandWidth.value = P.bandWidth;
    u.uBandDir.value.set(...P.bandDir);
    u.uBandCol.value.copy(lin(P.palette.gas[1])).lerp(new THREE.Color(0.5, 0.5, 0.55), 0.6).multiplyScalar(0.25);
    for (let i = 0; i < 4; i++) {
      const e = P.emb[i];
      u.uEmb.value[i].set(e.x, e.y, e.z, e.radius);
      u.uEmbCol.value[i].copy(lin(e.color)).multiplyScalar(e.power);
    }

    const prevTarget = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(this.rt);
    this.renderer.render(this.bakeScene, this.bakeCam);
    // Auto-exposure: measure the bake's mean luminance on a 32×20 probe
    // so every sky sits in the same brightness band behind the ships.
    this.measureMat.uniforms.tBake.value = this.rt.texture;
    this.renderer.setRenderTarget(this.measureRT);
    this.renderer.render(this.measureScene, this.bakeCam);
    this.renderer.readRenderTargetPixels(this.measureRT, 0, 0, 32, 20, this.measurePixels);
    this.renderer.setRenderTarget(prevTarget);
    let sum = 0;
    for (let i = 0; i < 32 * 20; i++) sum += this.measurePixels[i * 4];
    const mean = Math.max(1e-3, sum / (32 * 20) / 255 / 4);
    P.measuredLuminance = mean;
    P.skyExposure = Math.min(1.5, Math.max(0.3, this.targetLuminance / mean));

    const b = this.bgMat.uniforms;
    b.uSkyExposure.value = P.skyExposure;
    b.uStarDensity.value = P.starDensity;
    b.uStarsBaked.value = this.profile.bakedStars ? 1 : 0;
    b.uSeedF.value = (qx * 8 + qy) * 3.17;
    for (let i = 0; i < 4; i++) {
      const e = P.emb[i];
      b.uEmb.value[i].set(e.x, e.y, 0.05 + e.radius * 0.25, e.core);
      b.uEmbCol.value[i].copy(lin(e.color));
    }
    if (this.profile.env) this._bakeEnv(P);
    else if (this.envMap) { this.envMap.dispose(); this.envMap = null; }
    return P;
  }

  _bakeEnv(P) {
    if (!this.envMat) {
      this.envMat = new THREE.ShaderMaterial({
        vertexShader: FULLSCREEN_VERT, fragmentShader: ENV_FRAG,
        uniforms: {
          uGas0: { value: new THREE.Color() }, uGas1: { value: new THREE.Color() }, uGas2: { value: new THREE.Color() },
          uSky: { value: new THREE.Color() }, uKeyDir: { value: new THREE.Vector3() }, uKeyCol: { value: new THREE.Color() },
          uSeed: { value: new THREE.Vector3() },
        },
        depthTest: false, depthWrite: false,
      });
      this.envScene = new THREE.Scene();
      const m = new THREE.Mesh(this.fsGeo, this.envMat);
      m.frustumCulled = false;
      this.envScene.add(m);
      this.envRT = new THREE.WebGLRenderTarget(256, 128, { type: THREE.HalfFloatType, depthBuffer: false });
      this.envRT.texture.mapping = THREE.EquirectangularReflectionMapping;
    }
    const u = this.envMat.uniforms;
    u.uGas0.value.copy(lin(P.palette.gas[0]));
    u.uGas1.value.copy(lin(P.palette.gas[1])).multiplyScalar(0.5);
    u.uGas2.value.copy(lin(P.palette.gas[2])).multiplyScalar(0.4);
    u.uSky.value.copy(lin(P.palette.sky));
    u.uKeyDir.value.copy(P.keyDir);
    u.uKeyCol.value.copy(lin(P.keyColor));
    u.uSeed.value.set(...P.seed);
    const prev = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(this.envRT);
    this.renderer.render(this.envScene, this.bakeCam);
    this.renderer.setRenderTarget(prev);
    if (this.envMap) this.envMap.dispose();
    this.envMap = this.pmrem.fromEquirectangular(this.envRT.texture).texture;
  }

  /** Per-frame: cover-fit to the viewport, drift, twinkle, dim. */
  update(viewW, viewH, time, drift, dim = 1, twinkle = 1, embScale = 1) {
    const b = this.bgMat.uniforms;
    b.uEmbScale.value = embScale;
    const bakeAspect = this.profile.bakeW / this.profile.bakeH;
    const viewAspect = viewW / Math.max(1, viewH);
    const over = 0.92;  // leave room for the parallax drift
    if (viewAspect > bakeAspect) b.uCover.value.set(over, over * bakeAspect / viewAspect);
    else b.uCover.value.set(over * viewAspect / bakeAspect, over);
    b.uOffset.value.set(drift.x, drift.y);
    b.uTime.value = time;
    b.uDim.value = dim;
    b.uTwinkle.value = twinkle;
  }

  dispose() {
    this.rt.dispose();
    this.envRT?.dispose();
    this.envMap?.dispose();
    this.pmrem?.dispose();
  }
}
