// The scene: night sky, far shore, lanterns, mist, and the pond that
// reflects them through the ripple field. Linear HDR out (tone-mapped in
// post.js). Every pixel is a function here (ADR-002); the only textures are
// computed ones: the simulation state, and an environment map of the sky
// that this same code renders each frame (ENV_FS) so that reflections do
// not evaluate the clouds a second time per pixel.
import { COMMON } from './common.js';

export const MAX_LAMPS = 8;

const BODY = /* glsl */ `#version 300 es
precision highp float;
${COMMON}
in vec2 vUv;
out vec4 outColor;

uniform vec2 uRes;
uniform float uTime;
uniform vec3 uCamPos;
uniform vec3 uFwd;
uniform vec3 uUp;
uniform vec3 uRight;
uniform float uTanHalf;
uniform float uAspect;
uniform int uOct;
uniform float uPx;        // radians per output pixel (edge softness)

// the environment map: azimuth x sqrt(height) of the sky and far bank
uniform sampler2D uEnv;
uniform vec4 uEnvMap;     // azMin, azMax, yMin, yMax
uniform float uSkyEnv;    // 1: draw the visible sky from the map too (low)

// the ripple simulation (log-polar grid, see geometry.js)
uniform sampler2D uState;
uniform float uSimOn;
uniform vec2 uSize;
uniform float uCell;
uniform float uR0;
uniform float uTheta0;
uniform float uSponge;
uniform float uSlope;     // mm of height -> surface slope gain

// where the terminal's drops fall (outside it, ambient rain)
uniform float uTermFar;
uniform float uTermAz;
uniform float uRain;      // 0 drizzle .. 1 downpour
uniform float uAmbient;   // 0/1 ambient rings beyond the terminal

uniform vec3 uMoon;
uniform float uMoonR;
uniform vec2 uWind;
uniform float uShore;     // distance to the far bank, m
uniform int uLampCount;
uniform vec3 uLampDir[${MAX_LAMPS}];
uniform vec4 uLampCol[${MAX_LAMPS}]; // rgb (linear, pre-multiplied by power), radius (rad)
uniform float uLampAz[${MAX_LAMPS}];  // their azimuths, precomputed
uniform float uMoonAz;

// ---------------------------------------------------------------- sky
const vec3 ZENITH = vec3(0.0012, 0.0020, 0.0050);
const vec3 HORIZON = vec3(0.0075, 0.0100, 0.0170);

float treeTop(float az) {
  // the far bank: a low wooded ridge with groves and gaps; single crowns
  // along it — mostly rounded broadleaf, now and then a conifer
  float base = -uCamPos.y / uShore;
  float grove = smoothstep(0.25, 0.7, fbm(vec2(az * 4.0, 1.9), 3));
  float ridge = base + 0.003 + 0.006 * fbm(vec2(az * 2.5, 3.7), 3) + 0.006 * grove;
  float top = ridge;
  const float W = 0.0075;
  float c0 = floor(az / W);
  for (int k = -3; k <= 3; k++) {
    float c = c0 + float(k);
    float rnd = hash11(c * 1.37 + 5.0);
    float rnd2 = hash11(c * 7.11 + 1.0);
    float center = (c + 0.5 + (rnd2 - 0.5) * 0.8) * W;
    float width = W * (0.9 + 1.3 * rnd);
    float height = ridge + (0.004 + 0.012 * rnd * rnd2 + 0.006 * rnd) * (0.35 + 0.65 * grove);
    float x = (az - center) / width;
    if (abs(x) < 1.0) {
      float shape = rnd2 > 0.93 ? pow(1.0 - abs(x), 1.4) * 1.3     // conifer
                                : pow(max(1.0 - x * x, 0.0), 0.6); // broadleaf
      shape *= 0.93 + 0.07 * vnoise(vec2(az * 1400.0, c));        // leaf edge
      top = max(top, mix(ridge, height, shape));
    }
  }
  return top;
}

vec3 lampGlow(vec3 d, float spread) {
  // warm lights on the far bank, seen out of focus: bokeh discs
  vec3 c = vec3(0.0);
  for (int i = 0; i < ${MAX_LAMPS}; i++) {
    if (i >= uLampCount) break;
    float a = acos(clamp(dot(d, uLampDir[i]), -1.0, 1.0));
    float r = uLampCol[i].a * spread;
    float disc = smoothstep(r, r * 0.9, a);
    float rim = smoothstep(r * 0.7, r * 0.96, a) * disc;
    float body = disc * (0.42 + 0.3 * rim);
    float halo = exp(-a / (r * 1.6)) * 0.03;
    c += uLampCol[i].rgb * (body + halo) / (spread * spread);
  }
  return c;
}

vec3 lampHaze(vec3 d) {
  vec3 c = vec3(0.0);
  float az = atan(d.x, d.z);
  for (int i = 0; i < ${MAX_LAMPS}; i++) {
    if (i >= uLampCount) break;
    float x = (az - uLampAz[i]) / 0.05;
    float y = (d.y - uLampDir[i].y) / 0.02;
    c += uLampCol[i].rgb * 0.02 * exp(-x * x - y * y);
  }
  return c;
}

// A bright point seen in rippled water is a column of glints: the
// envelope is how far the surface slopes can throw its reflection, the
// sparkle is which facets happen to catch it.
float glints(float rAz, float rY, float lAz, float lY, float wAz, float wEl, float sparkle) {
  float dx = (rAz - lAz) / wAz;
  float dy = (rY - lY) / wEl;
  float core = exp(-dx * dx * 6.0 - dy * dy * 40.0);
  float column = exp(-dx * dx - dy * dy);
  return core + column * sparkle;
}

vec3 lampReflection(float rAz, float rY, float spread, float sparkle) {
  vec3 c = vec3(0.0);
  for (int i = 0; i < ${MAX_LAMPS}; i++) {
    if (i >= uLampCount) break;
    float w = 0.35 * uLampCol[i].a + 0.002;
    c += uLampCol[i].rgb * 0.5 * glints(rAz, rY, uLampAz[i], uLampDir[i].y, w, spread, sparkle);
  }
  return c;
}

float clouds(vec3 d, out float lit) {
  float el = max(d.y, 0.0);
  // clouds on a flat layer overhead; domain-warped for billows
  vec2 p = d.xz / (el + 0.16) * 0.8 + uWind * uTime;
  vec2 warp = vec2(fbm(p * 0.7 + 3.0, 3), fbm(p * 0.7 + 9.0, 3));
  float n = fbm(p + warp * 1.4, uOct);
  float n2 = fbm(p * 2.7 + warp * 2.0 - uWind * uTime * 0.7, max(uOct - 2, 2));
  float cover = n * 0.85 + n2 * 0.3;
  // a ragged break in the overcast near the moon, wider than tall
  float daz = atan(d.x, d.z) - atan(uMoon.x, uMoon.z);
  float del = d.y - uMoon.y;
  float gap = exp(-(daz * daz) / 0.09 - (del * del) / 0.012);
  cover -= 0.16 * gap * (0.4 + 1.2 * fbm(p * 1.3 + 2.0, 4));
  float dens = smoothstep(0.34, 0.66, cover);
  lit = smoothstep(0.62, 0.36, cover); // thin edges catch the moon
  return dens;
}

vec3 sky(vec3 d, bool reflected) {
  float el = d.y;
  float az = atan(d.x, d.z);
  vec3 col = mix(HORIZON, ZENITH, smoothstep(-0.02, 0.35, el));
  // the glow of a town somewhere beyond the trees
  col += vec3(0.030, 0.017, 0.008) * exp(-max(el, 0.0) / 0.035) * (0.35 + 0.65 * exp(-pow((az - 0.45) / 0.35, 2.0)));

  float lit;
  float dens = clouds(d, lit) * smoothstep(-0.005, 0.06, el);
  float ma = acos(clamp(dot(d, uMoon), -1.0, 1.0));

  // stars, only in the gaps
  vec2 sg = vec2(az, el) * 420.0;
  vec2 sc = floor(sg);
  float sh = hash12(sc);
  if (sh > 0.9965 && el > 0.02) {
    vec2 so = hash22(sc) - 0.5;
    float sd = length(fract(sg) - 0.5 - so * 0.6);
    float tw = 0.7 + 0.3 * sin(uTime * (1.5 + 3.0 * sh) + sh * 40.0);
    col += vec3(0.7, 0.75, 0.9) * smoothstep(0.35, 0.0, sd) * (sh - 0.9965) * 900.0 * 0.035 * tw * (1.0 - dens);
  }

  // the moon: a disc with maria, then the clouds drift across it
  {
    vec3 mt = normalize(cross(uMoon, vec3(0.0, 1.0, 0.0)));
    vec3 mb = cross(mt, uMoon);
    vec2 mp = vec2(dot(d, mt), dot(d, mb)) / uMoonR;
    float disc = smoothstep(1.0, 0.9, length(mp));
    float maria = fbm(mp * 2.2 + 7.0, 4);
    float limb = sqrt(max(1.0 - dot(mp, mp), 0.0));
    vec3 moon = vec3(1.0, 0.95, 0.86) * (0.75 + 0.25 * limb) * (1.0 - 0.35 * smoothstep(0.45, 0.7, maria));
    col += moon * disc * 0.5;
  }
  // light in the clouds: dark bellies, silver edges near the moon
  float near = exp(-ma / 0.22) + 0.35 * exp(-ma / 0.9);
  vec3 cloudCol = vec3(0.0035, 0.0042, 0.0065) + HORIZON * 0.35
    + vec3(0.40, 0.42, 0.48) * near * (0.06 + 0.94 * lit) * 0.30
    + vec3(0.40, 0.42, 0.48) * lit * 0.012
    + vec3(0.012, 0.007, 0.004) * exp(-max(el, 0.0) / 0.05);
  col = mix(col, cloudCol, dens * 0.93);
  // corona: moonlight scattered by thin cloud and rain haze
  float thin = 1.0 - dens * 0.6;
  col += vec3(0.55, 0.58, 0.66) * (0.22 * exp(-ma / 0.028) + 0.06 * exp(-ma / 0.11) + 0.012 * exp(-ma / 0.5)) * thin;
  return col;
}

// the bank beyond the water: trees in silhouette, softened by mist
vec3 bank(vec3 d) {
  // nearly black; the lower trunks greyed by mist off the water
  float base = -uCamPos.y / uShore;
  float low = exp(-(d.y - base) / 0.006);
  return mix(vec3(0.0009, 0.0011, 0.0017), HORIZON * 0.9, 0.25 + 0.45 * low);
}

// what a ray sees if it does not hit the water
vec3 environment(vec3 d, bool reflected) {
  float az = atan(d.x, d.z);
  float top = treeTop(az);
  float cover = smoothstep(top + uPx, top - uPx, d.y);
  vec3 c = mix(sky(d, reflected), bank(d), cover);
  // mist lying on the far water, lit warm near the lanterns
  float band = exp(-abs(d.y + 0.001) / 0.006);
  float drift = 0.5 + 0.5 * fbm(vec2(az * 9.0 + uTime * 0.012, d.y * 160.0), 3);
  vec3 mist = HORIZON * 1.25 + lampHaze(d) * 0.35;
  c = mix(c, mist, clamp(band * drift * (0.35 + 0.3 * uRain), 0.0, 0.8));
  return c;
}

vec3 envDir(vec2 uv) {
  float az = mix(uEnvMap.x, uEnvMap.y, uv.x);
  float y = uEnvMap.z + (uEnvMap.w - uEnvMap.z) * uv.y * uv.y;
  float c = sqrt(max(1.0 - y * y, 0.0));
  return vec3(sin(az) * c, y, cos(az) * c);
}
vec3 envSample(vec3 d) {
  float az = atan(d.x, d.z);
  vec2 uv = vec2((az - uEnvMap.x) / (uEnvMap.y - uEnvMap.x),
                 sqrt(clamp((d.y - uEnvMap.z) / (uEnvMap.w - uEnvMap.z), 0.0, 1.0)));
  return texture(uEnv, uv).rgb;
}

// ---------------------------------------------------------------- water
float simH(vec2 uv) {
  return texture(uState, uv).r;
}

// surface slope (dx, dz) at a world point from the ripple simulation
vec2 simSlope(vec2 xz, out float inside) {
  float r = length(xz);
  float az = atan(xz.x, xz.y);
  vec2 g = vec2((az - uTheta0) / uCell, log(r / uR0) / uCell); // texels
  vec2 fw = max(fwidth(g), vec2(1.0));
  vec2 uv = g / uSize;
  vec2 o = fw / uSize;
  float hu = (simH(uv + vec2(o.x, 0.0)) - simH(uv - vec2(o.x, 0.0))) / (2.0 * fw.x);
  float hv = (simH(uv + vec2(0.0, o.y)) - simH(uv - vec2(0.0, o.y))) / (2.0 * fw.y);
  vec2 e = min(g, uSize - g);
  inside = smoothstep(uSponge * 0.4, uSponge * 1.2, min(e.x, e.y));
  float scale = 0.001 / (uCell * r);            // mm per texel -> m per m
  vec2 er = vec2(sin(az), cos(az));
  vec2 et = vec2(cos(az), -sin(az));
  vec2 slope = (hv * er + hu * et) * scale;
  // average away rings far smaller than a pixel instead of aliasing them
  return slope * inside / (1.0 + 0.12 * (fw.y - 1.0));
}

// rain beyond the terminal's border: a statistical field of rings
vec2 ambientSlope(vec2 xz, float foot) {
  if (uAmbient < 0.5 || foot > 0.35) return vec2(0.0);
  const float S = 0.55;
  vec2 cell = floor(xz / S);
  vec2 slope = vec2(0.0);
  float density = mix(0.05, 0.9, uRain);
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 id = cell + vec2(float(i), float(j));
      vec2 rnd = hash22(id * 1.37 + 11.0);
      float period = 1.3 + 1.6 * rnd.y;
      float tt = uTime + rnd.x * period;
      float k = floor(tt / period);
      float a = tt - k * period;
      if (hash12(id + k * 7.31) > density) continue;
      vec2 c = (id + 0.15 + 0.7 * hash22(id + k * 3.1)) * S;
      vec2 dv = xz - c;
      float d = length(dv) + 1e-4;
      float R = 0.25 * a;
      float w = 0.018 + 0.05 * a;
      float x = (d - R) / w;
      float env = exp(-2.2 * a) * exp(-x * x);
      float wave = cos(x * 2.6);
      slope += dv / d * env * wave * 0.22;
    }
  }
  return slope * smoothstep(0.35, 0.05, foot);
}

`;

export const ENV_FS = `${BODY}
void main() {
  outColor = vec4(environment(envDir(vUv), true), 1.0);
}
`;

export const SCENE_FS = `${BODY}
void main() {
  vec2 ndc = vUv * 2.0 - 1.0;
  vec3 d = normalize(uFwd + ndc.x * uTanHalf * uAspect * uRight + ndc.y * uTanHalf * uUp);
  float bankEl = -uCamPos.y / uShore;

  if (d.y >= bankEl) {
    // (low: the sky comes from the map, except around the moon, whose
    // disc is too small for it)
    bool nearMoon = dot(d, uMoon) > cos(uMoonR * 4.0);
    vec3 sk = uSkyEnv > 0.5 && !nearMoon ? envSample(d) : environment(d, false);
    outColor = vec4(sk + lampGlow(d, 1.0), 1.0);
    return;
  }

  float t = -uCamPos.y / d.y;
  vec3 P = uCamPos + d * t;
  vec2 xz = P.xz;
  float r = length(xz);
  float az = atan(xz.x, xz.y);
  float foot = length(fwidth(xz));

  vec2 slope = vec2(0.0);
  float inside = 0.0;
  if (uSimOn > 0.5) slope += simSlope(xz, inside) * uSlope;
  // outside the terminal's rows and columns: ambient rain
  float beyond = max(smoothstep(uTermFar * 0.97, uTermFar * 1.12, r),
                     smoothstep(uTermAz * 1.0, uTermAz * 1.08, abs(az)));
  slope += ambientSlope(xz, foot) * beyond;
  // far away, rain breaks the mirror into horizontal shimmer; sampled in
  // (azimuth, log distance) so its grain is never finer than the pixels
  vec2 sh = vec2(az * 220.0, log(r) * 70.0 - uTime * 0.6);
  float shim = (vnoise(sh) - 0.5) + 0.5 * (vnoise(sh * vec2(2.1, 1.7) + 9.0) - 0.5);
  slope.y += shim * (0.004 + 0.012 * uRain) * smoothstep(6.0, 40.0, r);
  // the faintest breath of wind, so the far water is not a perfect mirror
  vec2 wp = xz * vec2(1.3, 0.55) + uWind * uTime * 3.0;
  slope += (vec2(vnoise(wp * 3.1), vnoise(wp * 3.1 + 17.0)) - 0.5) * 0.02 * smoothstep(0.2, 0.02, foot);

  vec3 N = normalize(vec3(-slope.x, 1.0, -slope.y));
  vec3 R = reflect(d, N);
  R.y = abs(R.y);
  float cosT = max(dot(N, -d), 0.0);
  float F = 0.02 + 0.98 * pow(1.0 - cosT, 5.0);
  // sub-pixel rings and rain roughen the far water: the glitter column
  // under each light lengthens; the sparkle is which facets catch it
  float spread = 0.012 + 0.035 * uRain + 0.02 * smoothstep(0.05, 0.4, foot);
  vec2 gp = xz * vec2(9.0, 3.2) + vec2(0.0, uTime * 0.35);
  float sp = vnoise(gp) * vnoise(gp * 2.3 + 5.0);
  float sparkle = smoothstep(0.18, 0.55, sp) * 1.4 + 0.08;
  float rAz = atan(R.x, R.z);
  vec3 refl = envSample(R) + lampReflection(rAz, R.y, spread, sparkle);
  float mg = glints(rAz, R.y, uMoonAz, uMoon.y, 0.02, spread * 1.3, sparkle);
  refl += vec3(0.62, 0.64, 0.7) * mg * 0.9;
  // the water itself: nearly black, a trace of peat-brown green
  vec3 body = vec3(0.0006, 0.0010, 0.0010);
  vec3 col = mix(body, refl, F);

  // mist over the water, thicker with distance and with rain
  float fog = 1.0 - exp(-t / mix(140.0, 70.0, uRain));
  vec3 mist = HORIZON * 1.2 + lampHaze(normalize(vec3(d.x, 0.004, d.z))) * 0.5 * smoothstep(25.0, 150.0, t);
  col = mix(col, mist, fog * 0.7);
  outColor = vec4(col, 1.0);
}
`;
