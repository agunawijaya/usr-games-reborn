// Shared GLSL chunks: hashing, value noise, fbm, cells. Pure code (ADR-002).

export const NOISE = /* glsl */ `
float bs_hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float bs_hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float bs_hash13(vec3 p3) { p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
vec2 bs_hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float bs_noise2(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(bs_hash12(i), bs_hash12(i + vec2(1, 0)), u.x), mix(bs_hash12(i + vec2(0, 1)), bs_hash12(i + vec2(1, 1)), u.x), u.y);
}
float bs_noise3(vec3 p) {
  vec3 i = floor(p); vec3 f = fract(p); vec3 u = f * f * (3.0 - 2.0 * f);
  float n000 = bs_hash13(i), n100 = bs_hash13(i + vec3(1,0,0)), n010 = bs_hash13(i + vec3(0,1,0)), n110 = bs_hash13(i + vec3(1,1,0));
  float n001 = bs_hash13(i + vec3(0,0,1)), n101 = bs_hash13(i + vec3(1,0,1)), n011 = bs_hash13(i + vec3(0,1,1)), n111 = bs_hash13(i + vec3(1,1,1));
  return mix(mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y), mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y), u.z);
}
float bs_fbm2(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * bs_noise2(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
float bs_fbm3(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * bs_noise3(p); p = p * 2.01 + 11.7; a *= 0.5; } return s; }
float bs_ridge3(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * (1.0 - abs(bs_noise3(p) * 2.0 - 1.0)); p *= 2.07; a *= 0.5; } return s; }
// distance to nearest cell point (F1) and id, 2D
vec3 bs_cells(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); float d = 8.0; vec2 id = vec2(0);
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(x, y); vec2 o = bs_hash22(i + g); vec2 r = g + o - f; float dd = dot(r, r);
    if (dd < d) { d = dd; id = i + g; }
  }
  return vec3(sqrt(d), id);
}
`;

/** ACES filmic tone curve + sRGB encode, used by the final composite. */
export const TONE = /* glsl */ `
vec3 bs_aces(vec3 x) { const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14; return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0); }
vec3 bs_srgb(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
`;
