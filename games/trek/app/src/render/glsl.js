// trek/procedural-web — shared GLSL snippets.
//
// Hashes are Dave Hoskins' "hash without sine" (stable across GPUs, no
// precision cliffs). Gradient noise follows Inigo Quilez's formulation.
// Everything here is plain GLSL ES; Three.js injects the version header.

export const HASH = /* glsl */ `
float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float hash13(vec3 p3) { p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
vec3 hash33(vec3 p3) { p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yxz + 33.33); return fract((p3.xxy + p3.yxx) * p3.zyx); }
`;

export const NOISE = HASH + /* glsl */ `
// 2D value noise, [0,1].
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x),
             mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}

// 3D gradient noise, roughly [-1,1].
vec3 gdir(vec3 p) { return normalize(hash33(p) * 2.0 - 1.0 + 1e-4); }
float gnoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float n000 = dot(gdir(i + vec3(0,0,0)), f - vec3(0,0,0));
  float n100 = dot(gdir(i + vec3(1,0,0)), f - vec3(1,0,0));
  float n010 = dot(gdir(i + vec3(0,1,0)), f - vec3(0,1,0));
  float n110 = dot(gdir(i + vec3(1,1,0)), f - vec3(1,1,0));
  float n001 = dot(gdir(i + vec3(0,0,1)), f - vec3(0,0,1));
  float n101 = dot(gdir(i + vec3(1,0,1)), f - vec3(1,0,1));
  float n011 = dot(gdir(i + vec3(0,1,1)), f - vec3(0,1,1));
  float n111 = dot(gdir(i + vec3(1,1,1)), f - vec3(1,1,1));
  return mix(mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
             mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y), u.z) * 1.6;
}

// Cheap 3D value noise, [0,1] — for animated surfaces.
float vnoise3(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash13(i), hash13(i + vec3(1,0,0)), u.x),
                 mix(hash13(i + vec3(0,1,0)), hash13(i + vec3(1,1,0)), u.x), u.y),
             mix(mix(hash13(i + vec3(0,0,1)), hash13(i + vec3(1,0,1)), u.x),
                 mix(hash13(i + vec3(0,1,1)), hash13(i + vec3(1,1,1)), u.x), u.y), u.z);
}

float fbm2(vec2 p) {
  float s = 0.0, a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = r * p * 2.03 + 11.7; a *= 0.5; }
  return s;
}

float fbm3(vec3 p, int oct) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 7; i++) {
    if (i >= oct) break;
    s += a * gnoise(p);
    p = p * 2.02 + vec3(17.1, 9.3, 5.7);
    a *= 0.5;
  }
  return s;
}

// Ridged multifractal: sharp filaments where noise crosses zero.
float ridged3(vec3 p, int oct) {
  float s = 0.0, a = 0.5, prev = 1.0;
  for (int i = 0; i < 6; i++) {
    if (i >= oct) break;
    float n = 1.0 - abs(gnoise(p));
    n *= n;
    s += n * a * prev;
    prev = n;
    p = p * 2.07 + vec3(3.1, 7.7, 1.9);
    a *= 0.5;
  }
  return s;
}
`;

/** Full-screen triangle vertex shader (position attribute in clip space). */
export const FULLSCREEN_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/** Blackbody-ish colour ramp for fire / star temperature, t in [0,1]. */
export const HEAT = /* glsl */ `
vec3 heatRamp(float t) {
  t = clamp(t, 0.0, 1.0);
  vec3 c = mix(vec3(0.08, 0.01, 0.0), vec3(0.9, 0.15, 0.02), smoothstep(0.0, 0.35, t));
  c = mix(c, vec3(1.0, 0.55, 0.12), smoothstep(0.3, 0.6, t));
  c = mix(c, vec3(1.0, 0.9, 0.6), smoothstep(0.55, 0.85, t));
  c = mix(c, vec3(1.0, 1.0, 1.0), smoothstep(0.85, 1.0, t));
  return c;
}
`;
