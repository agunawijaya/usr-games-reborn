// The sea floor at night: sediment, ripples and pebbles, lit only by the
// worms (the light map), with fog, a faint caustic shimmer near light, the
// -f "WORM" glyph field and the -t luminescent trail.

import { COMMON } from './common.js';

export const FLOOR = /* glsl */ `#version 300 es
precision highp float;
precision highp int;

uniform vec2 uRes;          // canvas px
uniform vec2 uOrigin;       // grid top-left in canvas px (y down)
uniform float uCell;        // px per cell
uniform vec2 uGrid;         // cols, rows
uniform float uTime;         // animation clock (frozen under reduced motion)
uniform float uNow;          // real clock, for ages of trails and eaten letters
uniform float uHigh;        // 1 = high quality
uniform float uTrailOn;
uniform float uFieldOn;
uniform sampler2D uLight;   // light map (rgb), canvas-aligned
uniform highp usampler2D uCells;  // per cell: r=ref, g=glyph(1..4 = W,O,R,M), b=trail dot
uniform sampler2D uTimes;   // per cell: r=trail time, g=eaten time, b=trail species, a=eater species
uniform vec3 uCore[8];
out vec4 outColor;

${COMMON}

float segD(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

// Procedural stroke glyphs for the -f field (cell-local uv, y down).
float glyph(int code, vec2 p) {
  float d = 1e3;
  if (code == 1) {        // W
    d = min(d, segD(p, vec2(0.18, 0.22), vec2(0.33, 0.78)));
    d = min(d, segD(p, vec2(0.33, 0.78), vec2(0.50, 0.42)));
    d = min(d, segD(p, vec2(0.50, 0.42), vec2(0.67, 0.78)));
    d = min(d, segD(p, vec2(0.67, 0.78), vec2(0.82, 0.22)));
  } else if (code == 2) { // O
    vec2 q = (p - vec2(0.5)) / vec2(0.29, 0.31);
    d = abs(length(q) - 1.0) * 0.29;
  } else if (code == 3) { // R
    d = min(d, segD(p, vec2(0.27, 0.22), vec2(0.27, 0.78)));
    d = min(d, segD(p, vec2(0.27, 0.22), vec2(0.58, 0.22)));
    d = min(d, segD(p, vec2(0.58, 0.22), vec2(0.70, 0.34)));
    d = min(d, segD(p, vec2(0.70, 0.34), vec2(0.58, 0.48)));
    d = min(d, segD(p, vec2(0.58, 0.48), vec2(0.27, 0.48)));
    d = min(d, segD(p, vec2(0.46, 0.48), vec2(0.74, 0.78)));
  } else if (code == 4) { // M
    d = min(d, segD(p, vec2(0.20, 0.78), vec2(0.20, 0.22)));
    d = min(d, segD(p, vec2(0.20, 0.22), vec2(0.50, 0.58)));
    d = min(d, segD(p, vec2(0.50, 0.58), vec2(0.80, 0.22)));
    d = min(d, segD(p, vec2(0.80, 0.22), vec2(0.80, 0.78)));
  }
  return d;
}

// sediment height (grid units in, 0..1 out)
float sediment(vec2 g) {
  float dunes = fbm2(g * 0.045 + 3.1);
  float dir = 0.6 + 0.5 * (fbm2(g * 0.02 + 9.0) - 0.5);
  vec2 rd = vec2(cos(dir), sin(dir));
  float warp = fbm2(g * 0.12 + 1.7) * 7.0;
  float ripple = 0.5 + 0.5 * sin(dot(g, rd) * 1.9 + warp);
  // ripple fields only in patches; elsewhere soft, lumpy mud
  ripple = pow(ripple, 1.6) * smoothstep(0.52, 0.78, fbm2(g * 0.05 + 20.0));
  float lumps = fbm2(g * 0.35 + 7.0);
  return dunes * 0.5 + ripple * 0.3 + lumps * 0.2;
}

void main() {
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);          // y down
  vec2 g = (px - uOrigin) / uCell;                                  // grid units
  vec2 uvL = gl_FragCoord.xy / uRes;
  vec3 L = texture(uLight, uvL).rgb;                                // bioluminescence reaching the floor
  float Ly = dot(L, vec3(0.3, 0.55, 0.15));

  // ---- sediment albedo and relief ----
  float h = sediment(g);
  float grain = hash12(floor(px * 0.75)) * 0.5 + 0.5 * vnoise2(g * 3.3);
  // sparse pebbles: cellular bumps
  vec2 cp = g * 0.9;
  vec2 ci = floor(cp);
  float peb = 0.0;
  for (int j = -1; j <= 1; j++)
  for (int i = -1; i <= 1; i++) {
    vec2 c = ci + vec2(i, j);
    vec4 hh = hash42(c + 11.0);
    if (hh.w > 0.18) continue;
    vec2 o = c + 0.2 + 0.6 * hh.xy;
    float r = 0.12 + 0.18 * hh.z;
    peb = max(peb, smoothstep(r, r * 0.35, length(cp - o)));
  }
  vec3 albedo = mix(vec3(0.045, 0.050, 0.054), vec3(0.115, 0.112, 0.100), smoothstep(0.25, 0.8, h));
  albedo *= 0.82 + 0.36 * grain;
  // large, faint patches of paler and darker ooze
  albedo *= 0.8 + 0.4 * fbm2(g * 0.018 + 40.0);
  albedo = mix(albedo, vec3(0.11, 0.10, 0.095), peb * 0.8);
  // burrows: dark holes with a raised, paler rim (where worms live)
  vec2 bp = g * 0.28;
  vec2 bi = floor(bp);
  float burrow = 0.0, brim = 0.0;
  for (int j = -1; j <= 1; j++)
  for (int i = -1; i <= 1; i++) {
    vec2 c = bi + vec2(i, j);
    vec4 hh = hash42(c + 71.0);
    if (hh.w > 0.22) continue;
    float d = length(bp - (c + 0.25 + 0.5 * hh.xy)) / (0.05 + 0.05 * hh.z);
    burrow = max(burrow, smoothstep(1.0, 0.55, d));
    brim = max(brim, exp(-pow((d - 1.25) / 0.35, 2.0)));
  }
  albedo = mix(albedo, albedo * 0.18, burrow);
  albedo *= 1.0 + brim * 0.35;

  // light direction on the floor ~ toward brighter light-map texels
  float shade = 1.0;
  if (uHigh > 0.5) {
    vec2 e = vec2(2.0) / uRes;
    float lx = dot(texture(uLight, uvL + vec2(e.x, 0.0)).rgb - texture(uLight, uvL - vec2(e.x, 0.0)).rgb, vec3(0.33));
    float ly = dot(texture(uLight, uvL + vec2(0.0, e.y)).rgb - texture(uLight, uvL - vec2(0.0, e.y)).rgb, vec3(0.33));
    vec3 ldir = normalize(vec3(lx, -ly, 0.02 + Ly * 0.4));
    float hx = sediment(g + vec2(0.08, 0.0)) - h;
    float hy = sediment(g + vec2(0.0, 0.08)) - h;
    vec3 n = normalize(vec3(-hx * 6.0 - peb * 0.0, -hy * 6.0, 0.35));
    shade = 0.55 + 0.9 * max(dot(n, ldir), 0.0);
  }

  vec3 col = albedo * L * 7.0 * shade;
  col += albedo * vec3(0.030, 0.050, 0.060);                        // faint ambient: the abyss is not quite black

  // ---- caustic shimmer: light rippling through the water near worms ----
  float tm = uTime * 0.18;
  vec2 q = g * 0.22 + 0.3 * vec2(vnoise2(g * 0.07 + tm), vnoise2(g * 0.07 - tm + 5.0));
  float c1 = 1.0 - abs(vnoise2(q + vec2(tm, -tm * 0.7)) * 2.0 - 1.0);
  float c2 = 1.0 - abs(vnoise2(q * 1.6 - vec2(tm * 0.8, tm)) * 2.0 - 1.0);
  float caust = smoothstep(0.55, 1.0, c1 * c2);
  col += L * albedo * caust * 6.0 * uHigh;

  // ---- -t: a fading luminescent trail -------------------------------------
  if (uTrailOn > 0.5) {
    vec3 tr = vec3(0.0);
    ivec2 cc = ivec2(floor(g));
    for (int j = -1; j <= 1; j++)
    for (int i = -1; i <= 1; i++) {
      ivec2 c = cc + ivec2(i, j);
      if (c.x < 0 || c.y < 0 || c.x >= int(uGrid.x) || c.y >= int(uGrid.y)) continue;
      vec4 tt = texelFetch(uTimes, c, 0);
      if (tt.r < 0.0) continue;
      float age = uNow - tt.r;
      float d = length(g - (vec2(c) + 0.5));
      float blob = exp(-d * d * 3.2);
      tr += uCore[int(tt.b)] * blob * smoothstep(8.0, 30.0, age);
    }
    // long after the luminous strip has faded, a trace of slime remains
    col += tr * 0.012;
  }

  // ---- -f: the WORM glyph field ---------------------------------------------
  if (uFieldOn > 0.5) {
    ivec2 c = ivec2(floor(g));
    if (c.x >= 0 && c.y >= 0 && c.x < int(uGrid.x) && c.y < int(uGrid.y)) {
      uvec4 cell = texelFetch(uCells, c, 0);
      vec4 tt = texelFetch(uTimes, c, 0);
      vec2 p = fract(g);
      vec3 glow = vec3(0.10, 0.75, 0.62);
      if (cell.g > 0u) {
        // wobble when light passes: the plankton letters stir
        vec2 wob = (vec2(vnoise2(g * 2.0 + uTime), vnoise2(g * 2.0 - uTime)) - 0.5) * 0.06 * min(Ly * 6.0, 1.0);
        float d = glyph(int(cell.g), p + wob);
        float stroke = smoothstep(0.055, 0.02, d) * 0.65 + exp(-d * 14.0) * 0.35;
        float stir = 1.0 + min(Ly * 10.0, 3.0);
        // plankton writing breathes: slow waves of light drift across the field
        float breathe = 0.45 + 0.55 * smoothstep(0.25, 0.8, fbm2(g * 0.06 + vec2(uTime * 0.05, -uTime * 0.03)));
        col += glow * stroke * 0.085 * stir * breathe;
      } else if (tt.g >= 0.0) {
        // eaten: the letter flares and scatters into motes
        float age = uNow - tt.g;
        if (age < 2.5) {
          int code = int(mod(float(c.y * int(uGrid.x) + c.x), 4.0)) + 1;
          float erode = step(age / 2.5, hash12(floor(p * 9.0) + vec2(c)));
          float d = glyph(code, p + (hash12(vec2(c)) - 0.5) * age * 0.08);
          float stroke = smoothstep(0.07, 0.02, d) * erode;
          vec3 ec = mix(glow, uCore[int(tt.a)], 0.6);
          col += ec * stroke * exp(-age * 1.6) * 0.5;
        }
      }
    }
  }

  // ---- the home burrow: every worm enters at (0, bottom), worms.c:304-309 ----
  vec2 home = vec2(0.5, uGrid.y - 0.5);
  float dh = length(g - home);
  col = mix(col, col * 0.1, smoothstep(1.1, 0.5, dh));                        // the hole
  float vent = exp(-pow((dh - 1.25) / 0.45, 2.0)) + 0.35 * exp(-dh * 0.45);  // warm rim + seep
  col += vec3(0.05, 0.022, 0.012) * vent * (0.8 + 0.2 * sin(uTime * 0.7));

  // ---- water: scattered light haze and depth fog ------------------------------
  col += L * 0.012;                                                  // in-scatter around worms
  // slow drifting murk: the water column has depth
  float murk = fbm2(g * 0.035 + vec2(uTime * 0.012, -uTime * 0.008));
  col += vec3(0.0035, 0.0085, 0.0105) * smoothstep(0.3, 0.8, murk);
  vec2 vc = (gl_FragCoord.xy / uRes - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  float vig = smoothstep(1.15, 0.25, length(vc));
  col = col * mix(0.45, 1.0, vig) + vec3(0.0015, 0.0045, 0.0065) * vig;
  outColor = vec4(col, 1.0);
}
`;
