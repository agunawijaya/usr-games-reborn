// Procedural materials: MeshStandardMaterial + an injected GLSL surface
// function per "family" (panel, carpet, wood, stone, sand, terrain, bark,
// leaf, ...). Lighting, fog and shadows stay Three's; every surface pattern
// is computed from world/object position, so nothing is a texture (ADR-002).
// One shader program per family: parameters are uniforms, so switching
// rooms never compiles new shaders.

import * as THREE from 'three';
import { NOISE } from './glsl.js';

const COMMON = /* glsl */ `
varying vec3 vWP; varying vec3 vOP; varying vec3 vWN; varying vec2 vUvB; varying float vInst;
#ifdef BS_MASK
varying vec4 vMask;
#endif
uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3; uniform vec4 uP; uniform vec4 uQ;
uniform float uTime; uniform float uSeed;
${NOISE}
vec2 bs_planar(vec3 p, vec3 n) {
  vec3 a = abs(n);
  if (a.y > 0.6) return p.xz;
  return a.x > a.z ? p.zy : p.xy;
}
vec3 bs_bump(vec3 p, float s) {
  float e = 0.07; float c = bs_noise3(p * s);
  return vec3(bs_noise3((p + vec3(e, 0, 0)) * s) - c, bs_noise3((p + vec3(0, e, 0)) * s) - c, bs_noise3((p + vec3(0, 0, e)) * s) - c) / e;
}
`;

/** Surface bodies. In: vWP vOP vWN vUvB vInst (+vMask). InOut: alb rough metal emi pert alpha. */
const FAMILIES = {
  // Ship panels: uP.x panel size, uP.y strip width, uP.z strip height (0 = none), uP.w scorch; uQ.x grime.
  panel: /* glsl */ `
    vec2 pl = bs_planar(vWP, vWN) / uP.x;
    vec2 cell = floor(pl); vec2 f = fract(pl);
    float edge = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y));
    float seam = 1.0 - smoothstep(0.0, 0.025, edge);
    float h = bs_hash12(cell + uSeed * 0.013);
    vec3 base = uC1 * (0.78 + 0.34 * h);
    float brush = bs_noise2(vec2(pl.x * 48.0, pl.y * 3.0 + h * 17.0));
    base *= 0.9 + 0.16 * brush;
    vec2 q = abs(f - 0.5);
    float riv = 1.0 - smoothstep(0.012, 0.022, length(q - vec2(0.44)));
    float grime = smoothstep(0.35, 0.9, bs_fbm3(vWP * 0.9 + uSeed)) * uQ.x;
    float low = 1.0 - smoothstep(0.0, 0.7, vWP.y);
    alb = mix(base, uC2, seam * 0.9);
    alb = mix(alb, uC2 * 1.6, riv * 0.8);
    alb *= 1.0 - 0.45 * grime - 0.25 * low * uQ.x;
    float burn = smoothstep(0.52, 0.78, bs_fbm3(vWP * 0.33 + uSeed * 0.1)) * uP.w;
    alb = mix(alb, vec3(0.02, 0.018, 0.015), burn * 0.9);
    rough = mix(0.28, 0.68, brush * 0.5 + seam * 0.6 + grime * 0.4 + burn * 0.5);
    metal = mix(0.85, 0.2, seam + burn) * (1.0 - uQ.y);
    if (uP.z > 0.0 && abs(vWN.y) < 0.5) {
      float s = 1.0 - smoothstep(uP.y * 0.5, uP.y * 0.5 + 0.015, abs(vWP.y - uP.z));
      float stutter = 0.75 + 0.25 * step(0.08, fract(sin(floor(uTime * 7.0 + cell.x) * 12.9) * 43758.5));
      emi += uC3 * s * stutter;
    }
    if (burn > 0.2) emi += vec3(1.0, 0.35, 0.08) * smoothstep(0.85, 1.0, bs_noise3(vWP * 3.0 + uTime * 0.5)) * burn * 0.6;
    pert += vec3(bs_noise3(vWP * 30.0) - 0.5) * 0.08 * brush;
  `,
  // Deck grating: uP.x cell size.
  grate: /* glsl */ `
    vec2 pl = bs_planar(vWP, vWN) / uP.x;
    vec2 f = fract(pl * vec2(1.0, 5.0));
    float bar = step(0.2, f.x) * step(0.3, f.y);
    alb = mix(uC1, mix(uC1, uC2, 0.7), bar) * (0.85 + 0.2 * bs_noise2(pl * 3.0));
    rough = mix(0.35, 0.9, bar); metal = mix(0.9, 0.3, bar);
    emi += uC3 * bar * (0.5 + 0.5 * sin(vWP.z * 0.8 - uTime * 2.0)) * uP.y;
  `,
  // Deep fur / carpet: uP.x fibre scale, uP.y pattern scale.
  carpet: /* glsl */ `
    float fib = bs_noise3(vWP * vec3(uP.x, uP.x * 0.2, uP.x));
    float pat = bs_fbm2(vWP.xz * uP.y + uSeed);
    alb = mix(uC1, uC2, smoothstep(0.35, 0.7, pat)) * (0.75 + 0.35 * fib);
    float border = uP.z > 0.0 ? 1.0 - smoothstep(0.0, 0.08, min(abs(fract(vWP.x / uP.z) - 0.5), abs(fract(vWP.z / uP.z) - 0.5))) : 0.0;
    alb = mix(alb, uC3, border * 0.8);
    rough = 0.95; metal = 0.0;
    pert += (vec3(fib) - 0.5) * 0.35;
  `,
  // Wood with metal inlay strips: uP.x grain scale, uP.y inlay frequency (0 = none), uP.z inlay width.
  wood: /* glsl */ `
    vec3 p = vOP * uP.x;
    float g = p.x + bs_fbm3(p * vec3(0.4, 3.0, 3.0)) * 2.4;
    float ring = fract(g * 3.0);
    alb = mix(uC1, uC2, smoothstep(0.3, 0.9, ring) * 0.8 + bs_noise3(p * vec3(1.0, 8.0, 8.0)) * 0.2);
    rough = 0.5 + 0.2 * ring; metal = 0.0;
    if (uP.y > 0.0) {
      float b = 1.0 - smoothstep(uP.z, uP.z + 0.01, abs(fract(vOP.y * uP.y) - 0.5));
      alb = mix(alb, uC3, b); rough = mix(rough, 0.18, b); metal = mix(metal, 1.0, b);
    }
    pert += vec3(0.0, bs_noise3(p * vec3(1, 10, 10)) - 0.5, 0.0) * 0.06;
  `,
  // Wood panelling (boiserie): framed panels uP.x wide by uP.y tall, frame width uP.z,
  // metal inlay (uC3) along the inner edge of every frame, dado rail at uP.w metres.
  paneling: /* glsl */ `
    vec2 pl = bs_planar(vWP, vWN);
    vec2 cell = floor(pl / uP.xy); vec2 f = fract(pl / uP.xy);
    vec2 fw = uP.z / uP.xy;
    float inFrame = step(fw.x, f.x) * step(f.x, 1.0 - fw.x) * step(fw.y, f.y) * step(f.y, 1.0 - fw.y);
    float edge = min(min(f.x - fw.x, 1.0 - fw.x - f.x) * uP.x, min(f.y - fw.y, 1.0 - fw.y - f.y) * uP.y);
    float inlay = inFrame * (1.0 - smoothstep(0.012, 0.022, edge));
    float h = bs_hash12(cell + uSeed);
    // vertical grain inside panels, horizontal in the frame rails
    vec2 g = inFrame > 0.5 ? vec2(pl.x * 9.0, pl.y * 0.7) : vec2(pl.y * 9.0, pl.x * 0.7);
    float grain = bs_fbm2(g + h * 13.0);
    float fig = bs_noise2(g * vec2(0.25, 1.6) + 3.0);
    vec3 wood = mix(uC1, uC2, smoothstep(0.35, 0.75, grain) * 0.75 + fig * 0.2);
    wood *= inFrame > 0.5 ? (0.92 + 0.12 * h) : 0.72;
    float bevel = inFrame * (1.0 - smoothstep(0.0, 0.05, edge)) * 0.35;
    alb = wood * (1.0 - bevel);
    rough = inFrame > 0.5 ? 0.38 : 0.5; metal = 0.0;
    float dado = uP.w > 0.0 ? 1.0 - smoothstep(0.03, 0.045, abs(vWP.y - uP.w)) : 0.0;
    float m = max(inlay, dado);
    alb = mix(alb, uC3, m); rough = mix(rough, 0.15, m); metal = mix(metal, 1.0, m);
    pert += vec3(0.0, (grain - 0.5) * 0.08, 0.0);
  `,
  // Rock: uP.x scale, uP.y wetness, uP.z moss/algae amount (uC3), uP.w glowing veins (uQ.rgb colour).
  stone: /* glsl */ `
    vec3 p = vWP * uP.x;
    float r = bs_ridge3(p + uSeed);
    float n = bs_fbm3(p * 2.3);
    alb = mix(uC1, uC2, n) * (0.62 + 0.55 * r);
    float strata = sin(vWP.y * 3.1 + n * 4.0) * 0.5 + 0.5;
    alb *= 0.9 + 0.12 * strata;
    float wet = smoothstep(0.35, 0.75, bs_noise3(vWP * 0.45 + 9.0 + vec3(0.0, uTime * 0.02, 0.0))) * uP.y;
    alb *= 1.0 - 0.4 * wet;
    float moss = smoothstep(0.45, 0.8, bs_fbm3(p * 1.7 + 3.0)) * uP.z * smoothstep(-0.2, 0.6, vWN.y + 0.3);
    alb = mix(alb, uC3, moss);
    rough = mix(0.92, 0.18, wet) * mix(1.0, 1.05, moss);
    metal = 0.0;
    if (uP.w > 0.0) {
      // veins of ore: polished metal that catches the light, with only a faint
      // glow (a strong one read as confetti floating in front of unlit rock)
      float v = smoothstep(0.86, 0.96, r) * uP.w;
      emi += uQ.rgb * v * 0.12 * (0.7 + 0.3 * sin(uTime * 1.3 + vWP.x));
      alb = mix(alb, uQ.rgb * 0.8, v); rough = mix(rough, 0.25, v); metal = mix(metal, 1.0, v);
    }
    // the bump's finite difference grows with the frequency: keep it in check
    // above uP.x = 1, where it used to turn into black speckle
    pert += bs_bump(vWP, uP.x * 3.0) * 0.18 / max(1.0, uP.x);
  `,
  // Sand: uP.x shoreline height (wet below), uP.y ripple scale, uP.z speck amount.
  sand: /* glsl */ `
    float n = bs_fbm2(vWP.xz * 0.3 + uSeed);
    float rip = sin(dot(vWP.xz, vec2(0.8, 0.6)) * uP.y + n * 6.0) * 0.5 + 0.5;
    alb = mix(uC1, uC2, n * 0.8 + rip * 0.15);
    float spk = step(0.985 - uP.z * 0.02, bs_hash12(floor(vWP.xz * 38.0)));
    alb = mix(alb, uC3, spk * 0.8);
    float wet = 1.0 - smoothstep(uP.x - 0.05, uP.x + 0.25, vWP.y);
    alb *= 1.0 - 0.45 * wet;
    rough = mix(0.95, 0.22, wet); metal = 0.0;
    pert += vec3(cos(dot(vWP.xz, vec2(0.8, 0.6)) * uP.y), 0.0, 0.0) * 0.05 * (1.0 - wet);
  `,
  // Terrain with a mask attribute: r = path/dirt, g = wet, b = rock, a = sand. uC1 grass, uC2 dirt, uC3 rock.
  terrain: /* glsl */ `
    float n = bs_fbm2(vWP.xz * 0.25 + uSeed);
    float m = bs_noise2(vWP.xz * 2.2);
    vec3 grass = uC1 * (0.7 + 0.5 * n) * (0.85 + 0.25 * m);
    grass = mix(grass, uC1 * vec3(1.25, 1.15, 0.6), smoothstep(0.55, 0.8, bs_noise2(vWP.xz * 0.12 + 4.0)) * 0.5);
    vec3 dirt = uC2 * (0.8 + 0.35 * bs_noise2(vWP.xz * 1.6));
    vec3 rock = uC3 * (0.6 + 0.6 * bs_ridge3(vWP * 0.6));
    vec3 sand = uQ.rgb * (0.9 + 0.15 * n);
    float path = smoothstep(0.25, 0.75, vMask.r + (m - 0.5) * 0.3);
    alb = mix(grass, dirt, path);
    alb = mix(alb, sand, smoothstep(0.3, 0.8, vMask.a));
    alb = mix(alb, rock, smoothstep(0.3, 0.8, vMask.b + (n - 0.5) * 0.4));
    alb *= 1.0 - 0.35 * vMask.g;
    rough = mix(0.9, 0.35, vMask.g); metal = 0.0;
    pert += bs_bump(vWP, 1.8) * mix(0.05, 0.2, vMask.b);
  `,
  // Bark: uP.x around frequency, uP.y along frequency, uP.z ring strength (palms).
  bark: /* glsl */ `
    float a = atan(vOP.x, vOP.z);
    vec2 p = vec2(a * uP.x, vOP.y * uP.y);
    float fib = bs_noise2(p * vec2(1.0, 0.15));
    float ring = uP.z * (1.0 - smoothstep(0.0, 0.25, abs(fract(vOP.y * uP.y * 0.6) - 0.5) * 2.0));
    alb = mix(uC1, uC2, fib) * (1.0 - 0.35 * ring);
    rough = 0.9; metal = 0.0;
    pert += vec3(cos(a), 0.0, sin(a)) * (fib - 0.5) * 0.4;
  `,
  // Leaf blades with shape from UV (x across, y along): uP.x width, uP.y serration, uP.z translucency.
  leaf: /* glsl */ `
    float y = vUvB.y; float x = abs(vUvB.x - 0.5) * 2.0;
    float w = uP.x * sin(3.14159 * clamp(y, 0.0, 1.0)) * (1.0 - 0.25 * y);
    w *= 1.0 - uP.y * 0.35 * step(0.5, fract(y * 18.0));
    alpha = step(x, w) * step(0.005, y);
    float h = bs_hash11(vInst * 1.37 + uSeed);
    alb = mix(uC1, uC2, h * 0.8 + 0.2 * bs_noise2(vWP.xz * 3.0));
    float vein = 1.0 - smoothstep(0.0, 0.06, x);
    alb = mix(alb, uC3, vein * 0.6);
    alb *= 0.75 + 0.35 * y;
    rough = 0.6; metal = 0.0;
    emi += alb * uP.z;
  `,
  // Generic metal: uP.x roughness, uP.y wear.
  metal: /* glsl */ `
    float n = bs_noise3(vWP * 6.0 + uSeed);
    alb = uC1 * (0.85 + 0.2 * n);
    float wear = smoothstep(0.6, 0.9, bs_fbm3(vWP * 3.0)) * uP.y;
    alb = mix(alb, uC2, wear);
    rough = clamp(uP.x + 0.15 * n + 0.3 * wear, 0.05, 1.0); metal = mix(1.0, 0.3, wear);
  `,
  // Cloth with soft folds: uP.x fold scale.
  cloth: /* glsl */ `
    float f = bs_fbm3(vOP * uP.x + uSeed);
    alb = mix(uC1, uC2, smoothstep(0.3, 0.8, f)) * (0.8 + 0.3 * bs_noise3(vOP * 60.0));
    rough = 0.85; metal = 0.0;
    pert += bs_bump(vOP, uP.x) * 0.25;
  `,
  // Woven textile: uP.x weave density (threads per metre / 100), uP.y velvet sheen,
  // uP.z damask figure amount (uC3), uP.w pile noise. Weave follows the object's
  // own axes so it bends with the cushion or the drape.
  fabric: /* glsl */ `
    vec3 q = vOP * uP.x * 100.0;
    float wx = 0.5 + 0.5 * sin(q.x * 3.14159); float wz = 0.5 + 0.5 * sin((q.z + q.y) * 3.14159);
    float weave = mix(wx, wz, step(0.5, fract((floor(q.x) + floor(q.z + q.y)) * 0.5)));
    float fig = uP.z > 0.0 ? smoothstep(0.55, 0.62, bs_noise2(vOP.xz * 7.0 + vOP.y * 3.0 + uSeed)) : 0.0;
    alb = mix(uC1, uC2, weave * 0.35 + bs_noise3(vOP * 9.0 + uSeed) * 0.25);
    alb = mix(alb, uC3, fig * uP.z);
    vec3 V = normalize(cameraPosition - vWP);
    float rim = pow(1.0 - clamp(abs(dot(normalize(vWN), V)), 0.0, 1.0), 2.5);
    alb *= 1.0 + uP.y * rim * 1.4;
    alb *= 0.9 + 0.1 * bs_noise3(vOP * 220.0) * uP.w;
    rough = 0.78 - 0.2 * uP.y * rim; metal = 0.0;
    pert += (vec3(weave) - 0.5) * 0.05;
  `,
  // Matte paint / lacquer for the stylised look: flat colour uC1 fading to uC2
  // over uP.y metres of height, roughness uP.x, metalness uP.z.
  matte: /* glsl */ `
    float k = uP.y > 0.0 ? clamp(vWP.y / uP.y, 0.0, 1.0) : 0.0;
    alb = mix(uC1, uC2, k) * (0.97 + 0.05 * bs_noise3(vWP * 1.5 + uSeed));
    rough = uP.x; metal = uP.z;
  `,
  // Painted plaster / interior walls: uP.x dado height (wood below, uC2), uP.y stripe.
  plaster: /* glsl */ `
    float n = bs_fbm3(vWP * 2.0 + uSeed);
    alb = uC1 * (0.9 + 0.12 * n);
    if (uP.x > 0.0 && vWP.y < uP.x) alb = uC2 * (0.85 + 0.2 * bs_noise3(vWP * vec3(8.0, 0.5, 8.0)));
    if (uP.y > 0.0) alb = mix(alb, uC3, (1.0 - smoothstep(0.0, 0.02, abs(vWP.y - uP.y))) * 0.9);
    rough = 0.8; metal = 0.0;
  `,
  // Tiles / mosaic: uP.x tile size, uP.y gap, uP.z colour variety.
  tile: /* glsl */ `
    vec2 pl = bs_planar(vWP, vWN) / uP.x;
    vec2 c = floor(pl); vec2 f = fract(pl);
    float gap = 1.0 - step(uP.y, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)));
    float h = bs_hash12(c + uSeed);
    vec3 col = h < 0.33 ? uC1 : (h < 0.66 ? uC2 : uC3);
    col = mix(uC1, col, uP.z) * (0.85 + 0.25 * bs_hash12(c * 3.1));
    alb = mix(col, vec3(0.05), gap);
    rough = mix(0.25, 0.9, gap); metal = 0.0;
    emi += col * uQ.x * (1.0 - gap) * step(0.93, bs_hash12(c * 7.7)) * (0.6 + 0.4 * sin(uTime * 2.0 + h * 30.0));
  `,
  // Emissive glow (lamps, screens, embers): uP.x intensity, uP.y flicker.
  glow: /* glsl */ `
    float fl = 1.0 - uP.y * 0.5 * (bs_noise2(vec2(uTime * 9.0, vInst + uSeed)) );
    alb = uC1 * 0.2; rough = 0.5; metal = 0.0;
    emi += uC1 * uP.x * fl;
  `,
  // Gold and gems for artifacts and treasure: uP.x sparkle.
  gold: /* glsl */ `
    float n = bs_noise3(vWP * 20.0);
    // uP.x sparkle, uP.y extra roughness (satin gold)
    alb = uC1 * (0.85 + 0.2 * n); rough = 0.18 + uP.y + 0.1 * n; metal = 1.0;
    float sp = step(0.985, bs_hash13(floor(vWP * 60.0) + floor(uTime * 3.0)));
    emi += uC2 * sp * uP.x;
  `,
  // Silhouette people: nearly black with a coloured rim computed from the view (uC1 rim).
  shade: /* glsl */ `
    alb = uC2; rough = 0.9; metal = 0.0;
    emi += uC1 * uP.x;
  `,
};

const cache = new Map();

function inject(material, family, opts) {
  const body = FAMILIES[family];
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, material.userData.u);
    const mask = !!opts.mask;
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', `varying vec3 vWP; varying vec3 vOP; varying vec3 vWN; varying vec2 vUvB; varying float vInst;
uniform float uTime; uniform float uSway;
${mask ? 'attribute vec4 mask; varying vec4 vMask;' : ''}
void main() {`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
  vOP = transformed; vUvB = uv; vInst = float(gl_InstanceID);
  if (uSway > 0.0) {
    vec3 bsIp = vec3(0.0);
    #ifdef USE_INSTANCING
      bsIp = instanceMatrix[3].xyz;
    #endif
    float bsL = length(transformed.xz) * 0.6 + max(transformed.y, 0.0) * 0.4;
    float bsPh = uTime * 1.2 + bsIp.x * 0.37 + bsIp.z * 0.23;
    transformed.x += sin(bsPh) * uSway * bsL * bsL * 0.012;
    transformed.z += cos(bsPh * 0.8 + 1.3) * uSway * bsL * bsL * 0.009;
    transformed.y += sin(bsPh * 1.7 + transformed.x) * uSway * bsL * 0.004;
  }
  vec4 bsWp = vec4(transformed, 1.0);
  vec3 bsN = objectNormal;
  #ifdef USE_INSTANCING
    bsWp = instanceMatrix * bsWp; bsN = mat3(instanceMatrix) * bsN;
  #endif
  vWP = (modelMatrix * bsWp).xyz; vWN = normalize(mat3(modelMatrix) * bsN);
  ${mask ? 'vMask = mask;' : ''}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', `${mask ? '#define BS_MASK\n' : ''}${COMMON}
void bs_surface(inout vec3 alb, inout float rough, inout float metal, inout vec3 emi, inout vec3 pert, inout float alpha) {
${body}
}
void main() {`)
      .replace('#include <color_fragment>', `#include <color_fragment>
  vec3 bsAlb = diffuseColor.rgb; float bsRough = roughness; float bsMetal = metalness; vec3 bsEmi = vec3(0.0); vec3 bsPert = vec3(0.0); float bsAlpha = diffuseColor.a;
  bs_surface(bsAlb, bsRough, bsMetal, bsEmi, bsPert, bsAlpha);
  diffuseColor.rgb = bsAlb * ${opts.tint ? 'diffuse' : 'vec3(1.0)'}; diffuseColor.a = bsAlpha * opacity;`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
  roughnessFactor = bsRough; metalnessFactor = bsMetal;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  normal = normalize(normal + (viewMatrix * vec4(bsPert, 0.0)).xyz);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  totalEmissiveRadiance += bsEmi;`);
  };
  material.customProgramCacheKey = () => `bs-${family}${opts.mask ? '-m' : ''}${opts.tint ? '-t' : ''}`;
}

const col = (c) => (c instanceof THREE.Color ? c : new THREE.Color(c ?? 0xffffff));

/** Shared clock for all procedural materials. */
export const matTime = { value: 0 };

/**
 * @param {string} family  one of FAMILIES
 * @param {object} o  { c1, c2, c3, p:[4], q:[4], seed, side, transparent, alphaTest, mask, key }
 */
export function mat(family, o = {}) {
  const key = o.key || `${family}|${JSON.stringify([o.c1, o.c2, o.c3, o.p, o.q, o.seed, o.side, o.alphaTest, o.mask, o.transparent, o.opacity, o.flat, o.sway])}`;
  if (cache.has(key)) return cache.get(key);
  const m = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    side: o.side ?? THREE.FrontSide,
    transparent: !!o.transparent,
    opacity: o.opacity ?? 1,
    alphaTest: o.alphaTest ?? 0,
    flatShading: !!o.flat,
    depthWrite: o.depthWrite ?? true,
  });
  m.userData.u = {
    uC1: { value: col(o.c1) }, uC2: { value: col(o.c2 ?? o.c1) }, uC3: { value: col(o.c3 ?? o.c1) },
    uP: { value: new THREE.Vector4(...(o.p || [1, 0, 0, 0])) },
    uQ: { value: new THREE.Vector4(...(o.q || [0, 0, 0, 0])) },
    uTime: matTime,
    uSeed: { value: o.seed ?? 0 },
    uSway: { value: o.sway ?? 0 },
  };
  inject(m, family, o);
  cache.set(key, m);
  return m;
}

/** Plain unlit emissive material (cheap), for strips, lamps, stars. */
export function glowMat(color, intensity = 1, opts = {}) {
  const key = `glow|${color}|${intensity}|${JSON.stringify(opts)}`;
  if (cache.has(key)) return cache.get(key);
  const c = col(color).clone().multiplyScalar(intensity);
  const m = new THREE.MeshBasicMaterial({ color: c, transparent: !!opts.transparent, opacity: opts.opacity ?? 1,
    blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: !opts.additive, side: opts.side ?? THREE.FrontSide,
    fog: opts.fog ?? true, toneMapped: false });
  cache.set(key, m);
  return m;
}

export const FAMILY_NAMES = Object.keys(FAMILIES);
