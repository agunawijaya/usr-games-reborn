// Surface bake: evaluates the procedural Moon once, at start-up, into an
// equirectangular texture (lon across, lat up). Nothing here is painted:
// basins, craters, rays and regolith all come from the feature table in
// ../features.js plus seeded noise.
//
// Pass A  -> T1 = (height [milli-radii], albedo, tint, 0)
// Pass B  -> T2 = (slope east, slope north) from T1's height, for normals.

import { COMMON } from './common.js';

export const MAX_MARIA = 40;
export const MAX_CRATERS = 32;

export const BAKE_SURFACE = /* glsl */ `#version 300 es
precision highp float;
precision highp int;

uniform vec2 uSize;
uniform float uMaxFreq;
uniform float uEncode;          // 1 = 8-bit target (fallback), 0 = half float
uniform int uMariaCount;
uniform vec4 uMariaA[${MAX_MARIA}];   // xyz = centre (unit), w = angular radius
uniform vec4 uMariaB[${MAX_MARIA}];   // x = tint, y = basin ring strength
uniform int uCraterCount;
uniform vec4 uCraterA[${MAX_CRATERS}]; // xyz = centre, w = angular radius
uniform vec4 uCraterB[${MAX_CRATERS}]; // x = fresh, y = rays, z = dark floor
out vec4 outColor;

${COMMON}

// Crater cross-section. x = distance / radius. Returns height in units of
// the crater's own depth scale. fresh: 1 = young & sharp, 0 = eroded.
// big: 0 = simple bowl, 1 = complex crater (flat floor + central peak).
float craterProfile(float x, float fresh, float big) {
  float bowl = x < 1.0 ? x * x - 1.0 : 0.0;
  bowl = max(bowl, -mix(1.0, 0.5, big));                 // flat floor
  float wallW = mix(0.12, 0.2, big);
  float outW = mix(0.35, 0.22, fresh);
  float rim = 0.32 * exp(-pow((x - 1.0) / (x < 1.0 ? wallW : outW), 2.0));
  // terraces on the inner wall of big fresh craters
  float terr = x < 1.0 ? 0.05 * big * fresh * sin(x * 28.0) * smoothstep(0.55, 0.95, x) : 0.0;
  float ejecta = x > 1.0 ? 0.12 * exp(-(x - 1.0) * 2.0) : 0.0;
  float peak = big * 0.6 * exp(-pow(x / 0.17, 2.0));
  float soft = mix(0.3, 1.0, fresh);
  return (bowl + peak + terr) * soft + (rim + ejecta) * mix(0.45, 1.0, fresh);
}

// Tangent frame around a surface point.
void frame(vec3 c, out vec3 t1, out vec3 t2) {
  t1 = normalize(cross(abs(c.y) < 0.99 ? vec3(0, 1, 0) : vec3(1, 0, 0), c));
  t2 = cross(c, t1);
}

// Bright ejecta rays: narrow streaks in azimuth, fading with distance.
float rays(vec3 p, vec3 c, float rad, float seed, float reach) {
  vec3 v = p - c;
  float d = length(v);
  float x = d / rad;
  if (x < 0.9 || x > reach) return 0.0;
  vec3 t1, t2;
  frame(c, t1, t2);
  float az = atan(dot(v, t2), dot(v, t1));
  vec2 ring = vec2(cos(az), sin(az));
  // broad streaks that split into finer filaments with distance
  float n = vnoise2(ring * 5.0 + seed) * 0.65 + vnoise2(ring * 14.0 + seed * 1.7) * 0.35;
  float streak = smoothstep(0.5, 0.85, n);
  float fil = vnoise2(ring * 22.0 + seed * 3.1 + x * 0.25);
  streak *= mix(1.0, 0.45 + 0.7 * fil, smoothstep(1.0, reach * 0.5, x));
  float along = exp(-(x - 1.0) / (reach * 0.3)) * smoothstep(reach, reach * 0.6, x);
  float patchy = smoothstep(0.2, 0.8, fbm3(p * 30.0 + seed, 4));
  float nimbus = exp(-pow((x - 1.0) / 1.2, 2.0)); // bright collar just outside the rim
  return streak * along * (0.35 + 0.65 * patchy) + 0.6 * nimbus;
}

// One octave of the random crater population (3-D cellular scatter).
void craterOctave(vec3 p, float freq, float density, float seed, float mare,
                  inout float h, inout float alb) {
  vec3 q = p * freq;
  vec3 ip = floor(q);
  for (int z = -1; z <= 1; z++)
  for (int y = -1; y <= 1; y++)
  for (int x = -1; x <= 1; x++) {
    vec3 cell = ip + vec3(x, y, z);
    vec4 r = hash44(vec4(cell, seed));
    vec4 s = hash44(vec4(cell.zxy + 0.37, seed + 19.1));
    // Maria are young lava plains: they bury most of the older, bigger craters.
    float dens = density * mix(1.0, freq > 40.0 ? 0.22 : 0.06, mare);
    if (r.w > dens) continue;
    vec3 c = (cell + 0.2 + 0.6 * r.xyz) / freq;
    float lc = length(c);
    if (abs(lc - 1.0) > 0.5 / freq) continue;          // only cells on the shell
    c /= lc;
    float rad = (0.12 + 0.3 * s.x * s.x) / freq;
    float d = length(p - c);
    float xr = d / rad;
    if (xr > 3.2) continue;
    // no crater is a perfect circle: wobble the outline, vary the depth
    xr *= 1.0 + 0.22 * (vnoise3(p * freq * 5.0 + s.z * 50.0) - 0.5);
    float amp = mix(0.35, 1.0, s.w);
    float fresh = pow(s.y, 4.5);
    float big = smoothstep(0.006, 0.04, rad);
    float k = mix(0.4, 0.13, big);
    h += craterProfile(xr, fresh, big) * rad * 1000.0 * k * amp;
    float bright = fresh * fresh;
    alb += bright * (xr < 1.0 ? 0.035 : 0.06 * exp(-(xr - 1.0) * 1.6));
    if (fresh > 0.9 && rad > 0.004) alb += 0.16 * rays(p, c, rad, s.z * 91.0, 7.0);
  }
}

void main() {
  vec2 uv = gl_FragCoord.xy / uSize;
  float lon = (uv.x * 2.0 - 1.0) * PI;
  float lat = (uv.y - 0.5) * PI;
  vec3 p = vec3(cos(lat) * sin(lon), sin(lat), cos(lat) * cos(lon));

  // --- Maria: soft-edged basins with warped, irregular shorelines ---------
  vec3 warp = vec3(fbm3(p * 2.3, 5), fbm3(p * 2.3 + 11.0, 5), fbm3(p * 2.3 + 23.0, 5)) - 0.5;
  vec3 warp2 = vec3(fbm3(p * 7.0 + 5.0, 4), fbm3(p * 7.0 + 17.0, 4), fbm3(p * 7.0 + 29.0, 4)) - 0.5;
  vec3 warp3 = vec3(fbm3(p * 21.0 + 2.0, 3), fbm3(p * 21.0 + 8.0, 3), fbm3(p * 21.0 + 14.0, 3)) - 0.5;
  vec3 pd = p + warp * 0.17 + warp2 * 0.055 + warp3 * 0.016;
  // Soft (metaball) union: neighbouring seas bleed into each other the way
  // Imbrium, Serenitatis and Tranquillitatis do, instead of reading as discs.
  float field = 0.0;
  float basin = 0.0;
  float tintW = 0.0, tintS = 0.0;
  float ringH = 0.0;
  for (int i = 0; i < ${MAX_MARIA}; i++) {
    if (i >= uMariaCount) break;
    vec3 c = uMariaA[i].xyz;
    float r = uMariaA[i].w * 1.06;
    float d = length(pd - c) / r;
    float f = smoothstep(1.2, 0.55, d);   // tails overlap only for true neighbours
    field += f;
    basin = max(basin, 1.0 - smoothstep(0.3, 1.3, length(p - c) / r));
    tintW += f;
    tintS += f * uMariaB[i].x;
    float ring = uMariaB[i].y;
    if (ring > 0.0) {
      float dr = length(p - c) / r - 1.08;
      // broken, mountainous arcs rather than a clean ring
      float arcs = smoothstep(0.35, 0.7, fbm3(p * 9.0 + float(i) * 3.0, 3));
      ringH += ring * arcs * exp(-pow(dr / 0.09, 2.0)) * (0.3 + 1.4 * fbm3(p * 38.0 + float(i), 5));
    }
  }
  // ragged shorelines with islands, inlets and lava fingers
  float shore = (fbm3(p * 9.0 + 4.0, 5) - 0.5) + 0.5 * (fbm3(p * 31.0 + 9.0, 3) - 0.5);
  float mare = smoothstep(0.42, 0.62, field + shore * 0.36);
  // albedo fades across a wider, mottled transition zone than the lava edge
  float mottle = fbm3(p * 24.0 + 17.0, 4) - 0.5;
  float mareA = smoothstep(0.3, 0.72, field + shore * 0.36 + mottle * 0.18);
  float tint = tintW > 0.001 ? tintS / tintW : 0.0;

  // --- Height (milli-radii; 1 = 1.74 km) -----------------------------------
  float hi = fbm3(p * 5.0 + 3.0, 6);
  float h = -basin * 1.4;                                  // basins sit low (smoothly)
  h += (1.0 - smoothstep(0.1, 0.5, field)) * (hi - 0.5) * 2.2; // rolling highlands, flattened under lava
  h += ringH * 2.4;                                        // basin-rim mountains
  // wrinkle ridges (dorsa) snake across the maria
  float wr = 1.0 - abs(fbm3(p * 16.0 + 7.0, 4) * 2.0 - 1.0);
  h += mare * pow(wr, 6.0) * 0.35;
  // regolith roughness
  h += (fbm3(p * 160.0, 3) - 0.5) * mix(0.16, 0.06, mare);

  // --- Albedo ---------------------------------------------------------------
  float highAlb = 0.6 + 0.2 * (fbm3(p * 3.0 + 9.0, 5) - 0.5) + 0.1 * (fbm3(p * 22.0, 5) - 0.5);
  highAlb += 0.06 * smoothstep(0.6, 0.85, fbm3(p * 60.0 + 2.0, 3));   // speckle of bright ejecta
  float mareAlb = 0.165 + 0.12 * (fbm3(p * 5.0 + 1.0, 5) - 0.5) - 0.03 * max(-tint, 0.0);
  mareAlb += 0.035 * smoothstep(0.55, 0.85, fbm3(p * 18.0 + 3.0, 4)); // lighter lava flows
  mareAlb -= 0.04 * smoothstep(0.6, 0.9, fbm3(p * 9.0 + 33.0, 4));    // darker, younger flows
  mareAlb += 0.05 * (fbm3(p * 2.2 + 40.0, 4) - 0.5);                   // broad tonal zones
  mareAlb -= 0.035 * smoothstep(0.75, 0.5, field) * mare;              // dark shoreline bands (Serenitatis)
  float alb = mix(highAlb, mareAlb, mareA);
  alb += ringH * 0.02;

  // --- Random crater population, big to small -------------------------------
  float craterAlb = 0.0;
  float f = 4.0;
  float dens = 0.26;
  for (int o = 0; o < 8; o++) {
    if (f > uMaxFreq) break;
    craterOctave(p, f, dens, float(o) * 7.31 + 1.0, mare, h, craterAlb);
    f *= 1.72;
    dens = min(dens * 1.18, 0.6);
  }

  // --- Named craters from the table -----------------------------------------
  float rayAlb = 0.0;
  for (int i = 0; i < ${MAX_CRATERS}; i++) {
    if (i >= uCraterCount) break;
    vec3 c = uCraterA[i].xyz;
    float rad = uCraterA[i].w;
    vec4 b = uCraterB[i];
    float d = length(p - c);
    float xr = d / rad;
    if (b.y > 0.0) rayAlb = max(rayAlb, b.y * rays(p, c, rad, float(i) * 13.7, mix(9.0, 26.0, b.y)));
    if (xr > 3.0) continue;
    float big = smoothstep(0.006, 0.04, rad);
    float k = mix(0.42, 0.12, big);
    // a crater "replaces" what it lands on: blend toward its own profile
    float w = smoothstep(2.2, 1.0, xr);
    h = mix(h, h * 0.35, w * b.x) + craterProfile(xr, b.x, big) * rad * 1000.0 * k;
    if (b.z > 0.0) alb = mix(alb, 0.24, b.z * smoothstep(0.95, 0.75, xr));
    alb += b.x * b.x * (xr < 1.0 ? 0.08 : 0.16 * exp(-(xr - 1.0) * 1.8));
  }

  alb += craterAlb * mix(1.0, 1.3, mare) + rayAlb * mix(0.4, 0.5, mare);
  alb = clamp(alb, 0.12, 1.0);

  if (uEncode > 0.5) outColor = vec4(clamp(h / 24.0 + 0.5, 0.0, 1.0), alb, tint * 0.5 + 0.5, 1.0);
  else outColor = vec4(h, alb, tint, 1.0);
}
`;

export const BAKE_SLOPES = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uT1;
uniform vec2 uSize;
uniform float uEncode;
out vec4 outColor;

float H(ivec2 c) {
  ivec2 s = ivec2(uSize);
  c.x = (c.x + s.x) % s.x;              // longitude wraps
  c.y = clamp(c.y, 0, s.y - 1);         // latitude clamps
  float h = texelFetch(uT1, c, 0).r;
  return uEncode > 0.5 ? (h - 0.5) * 24.0 : h;
}

void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  float lat = (gl_FragCoord.y / uSize.y - 0.5) * 3.14159265;
  float dLon = 6.28318531 / uSize.x;
  float dLat = 3.14159265 / uSize.y;
  // Sobel-weighted central differences (smoother than plain diffs)
  // Near the poles a longitude texel is tiny; widen the east-west stencil so
  // the difference spans a roughly constant ground distance.
  int k = clamp(int(1.0 / max(cos(lat), 0.04) + 0.5), 1, 24);
  float nw = H(c + ivec2(-k, 1)), n = H(c + ivec2(0, 1)), ne = H(c + ivec2(k, 1));
  float w  = H(c + ivec2(-k, 0)),                         e  = H(c + ivec2(k, 0));
  float sw = H(c + ivec2(-k, -1)), s = H(c + ivec2(0, -1)), se = H(c + ivec2(k, -1));
  float gx = (ne + 2.0 * e + se) - (nw + 2.0 * w + sw);
  float gy = (nw + 2.0 * n + ne) - (sw + 2.0 * s + se);
  gx /= 8.0 * float(k) * dLon * max(cos(lat), 0.03);
  gy /= 8.0 * dLat;
  vec2 slope = vec2(gx, gy) / 1000.0; // milli-radii -> radii: dimensionless slope
  if (uEncode > 0.5) outColor = vec4(clamp(slope * 0.5 + 0.5, 0.0, 1.0), 0.0, 1.0);
  else outColor = vec4(slope, 0.0, 1.0);
}
`;
