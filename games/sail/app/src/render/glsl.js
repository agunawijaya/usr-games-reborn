// Shared GLSL chunks: noise, and the one sky function used by the sky dome,
// the ocean's reflections and the fog, so sea and sky can never disagree.

export const NOISE = /* glsl */ `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x),
             mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
float vnoise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  float a = hash13(i);
  float b = hash13(i + vec3(1.0, 0.0, 0.0));
  float c = hash13(i + vec3(0.0, 1.0, 0.0));
  float d = hash13(i + vec3(1.0, 1.0, 0.0));
  float e = hash13(i + vec3(0.0, 0.0, 1.0));
  float f1 = hash13(i + vec3(1.0, 0.0, 1.0));
  float g = hash13(i + vec3(0.0, 1.0, 1.0));
  float h = hash13(i + vec3(1.0, 1.0, 1.0));
  return mix(mix(mix(a, b, u.x), mix(c, d, u.x), u.y), mix(mix(e, f1, u.x), mix(g, h, u.x), u.y), u.z);
}
float fbm(vec2 p, int oct) {
  float s = 0.0;
  float a = 0.5;
  mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 6; i++) {
    if (i >= oct) break;
    s += a * vnoise(p);
    p = r * p * 2.03 + 17.1;
    a *= 0.5;
  }
  return s;
}
float fbm3(vec3 p, int oct) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    if (i >= oct) break;
    s += a * vnoise3(p);
    p = p * 2.02 + vec3(11.3, 7.1, 3.7);
    a *= 0.5;
  }
  return s;
}
`;

// Uniforms expected: uSunDir, uSunColor, uZenith, uHorizon, uGround,
// uCloudCover, uCloudDark, uCloudShift (vec2), uFlash, uHaze.
export const SKY_UNIFORMS = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uZenith;
uniform vec3 uMid;
uniform vec3 uHorizon;
uniform vec3 uGround;
uniform float uCloudCover;
uniform float uCloudDark;
uniform vec2 uCloudShift;
uniform float uFlash;
uniform float uHaze;
uniform float uSunVis;
uniform float uNight;
uniform float uCloudLight;
`;

export const SKY_FN = /* glsl */ `
// Clouds on a virtual plane 1 unit up; dir must be normalised.
vec4 cloudLayer(vec3 dir, int oct) {
  if (dir.y <= 0.0) return vec4(0.0);
  vec2 p = dir.xz / (dir.y + 0.06) * 0.9 + uCloudShift;
  float n = fbm(p, oct);
  float n2 = fbm(p * 2.7 + 5.3 - uCloudShift * 0.6, max(oct - 2, 1));
  float cov = uCloudCover;
  float v = n * 0.78 + n2 * 0.34;
  float th = mix(0.74, 0.28, cov);
  float d = smoothstep(th, th + 0.22, v);
  // thin out toward the horizon (perspective + haze)
  d *= smoothstep(0.0, 0.18, dir.y);
  // light: bright where the sun shines through the thin edge, dark bellies
  float mu = max(dot(dir, uSunDir), 0.0);
  float edge = 1.0 - smoothstep(0.1, 0.9, d);
  float silver = pow(mu, 6.0) * edge * 1.6;
  float thick = smoothstep(0.2, 1.0, n2);
  vec3 lit = mix(vec3(0.95, 0.96, 1.0), uSunColor * 1.2, 0.35);
  vec3 dark = mix(vec3(0.42, 0.45, 0.52), vec3(0.08, 0.09, 0.11), uCloudDark);
  vec3 col = mix(lit * (1.0 - 0.75 * uCloudDark), dark, clamp(thick * 0.8 + uCloudDark * 0.6, 0.0, 1.0));
  col += uSunColor * silver * (1.0 - uCloudDark * 0.8);
  col *= uCloudLight; // moonlit clouds are dim silver-grey, not white
  col += vec3(0.75, 0.8, 1.0) * uFlash * (0.5 + thick);
  return vec4(col, d);
}

vec3 skyColor(vec3 dir, int oct) {
  float y = dir.y;
  float yc = clamp(y, 0.0, 1.0);
  // three stops: horizon -> pale mid-sky -> zenith
  // an explicit mid-sky colour: a straight mix of a warm horizon and a blue
  // zenith goes muddy lavender, which real skies do not
  vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.12, yc));
  col = mix(col, uZenith, smoothstep(0.08, 0.55, yc));
  // Horizon haze band
  col = mix(col, uHorizon * 1.05, exp(-max(y, 0.0) * 30.0) * uHaze * 0.7);
  // Sun-side sky is warmer and brighter (a broad forward-scattering lobe)
  float mu = max(dot(dir, uSunDir), 0.0);
  float low = 1.0 - smoothstep(0.0, 0.5, uSunDir.y);
  col += uSunColor * pow(mu, 3.0) * (0.12 + 0.3 * low) * exp(-yc * 2.5) * uSunVis;
  // Sun glare (Mie-ish lobes) and disc; the moon gets a tighter halo
  vec3 glare = uSunColor * (pow(mu, 8.0) * 0.2 * (1.0 - uNight) + pow(mu, 64.0) * 0.6 * (1.0 - 0.6 * uNight) + pow(mu, 900.0) * 4.0);
  col += glare * uSunVis;
  float disc = smoothstep(0.99955, 0.99975, mu);
  // stars: sparse points on a sphere of cells, fading toward the horizon
  if (uNight > 0.0 && y > 0.0) {
    vec3 sp = dir * 420.0;
    vec3 cell = floor(sp);
    float h = hash13(cell);
    float d = length(fract(sp) - 0.5);
    float star = step(0.9965, h) * smoothstep(0.33, 0.0, d) * (0.4 + 0.6 * hash13(cell + 7.1));
    col += vec3(0.85, 0.9, 1.0) * star * 1.6 * uNight * smoothstep(0.02, 0.25, y) * (1.0 - smoothstep(0.9, 0.999, mu));
  }
  // Clouds
  vec4 cl = cloudLayer(dir, oct);
  col = mix(col + uSunColor * disc * 22.0 * uSunVis, cl.rgb, cl.a);
  // Below the horizon (seen only in reflections): fade to ground/sea haze.
  col = mix(col, uGround, smoothstep(0.0, -0.08, y));
  col += vec3(0.6, 0.65, 0.8) * uFlash * 0.35;
  return col;
}
`;
