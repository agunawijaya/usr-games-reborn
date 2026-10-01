// The whole night, one full-screen fragment shader:
//   sky gradient -> Milky Way -> stars -> Moon (ray-traced sphere) ->
//   atmospheric halo -> procedural landscape -> filmic tone map.
// uMode 1 renders only the Moon, centred, with alpha: the calendar's
// mini Moons come from this exact code path.

import { COMMON } from './common.js';

export const SCENE = /* glsl */ `#version 300 es
precision highp float;
precision highp int;

uniform vec2 uRes;          // framebuffer size (device px)
uniform float uDpr;         // device px per CSS px
uniform float uTime;        // seconds (frozen when reduced motion)
uniform float uMode;        // 0 = full scene, 1 = mini Moon
uniform vec2 uMoonC;        // Moon centre (device px, GL origin bottom-left)
uniform float uMoonR;       // Moon radius (device px)
uniform vec3 uSun;          // unit vector to the Sun, view space (+z toward viewer)
uniform float uIllum;       // pom lit fraction 0..1
uniform mat3 uRot;          // surface orientation (drag / libration)
uniform sampler2D uT1;      // height, albedo, tint
uniform sampler2D uT2;      // slopes
uniform vec2 uTexSize;
uniform float uEncode;
uniform float uReady;       // 0..1 fade-in once the bake finishes
uniform float uHC;          // high-contrast mode
uniform float uMotion;      // 0 when prefers-reduced-motion
uniform float uHorizon;     // base horizon height (CSS px from bottom)
uniform float uRelief;      // normal-map exaggeration
uniform float uExposure;
uniform float uCosD;        // cos of pom's elongation (terminator ellipse)

out vec4 outColor;

${COMMON}

// ---------------------------------------------------------------- utilities
vec3 aces(vec3 x) {
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}
vec3 toSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

vec4 surf1(vec2 uv, vec2 gx, vec2 gy) {
  vec4 t = textureGrad(uT1, uv, gx, gy);
  if (uEncode > 0.5) t = vec4((t.r - 0.5) * 24.0, t.g, t.b * 2.0 - 1.0, 1.0);
  return t;
}
vec2 slopes(vec2 uv, vec2 gx, vec2 gy) {
  vec2 s = textureGrad(uT2, uv, gx, gy).rg;
  return uEncode > 0.5 ? s * 2.0 - 1.0 : s;
}
float heightLod(vec3 p, float lod) {
  vec2 uv = vec2(atan(p.x, p.z) / TAU + 0.5, asin(clamp(p.y, -1.0, 1.0)) / PI + 0.5);
  float h = textureLod(uT1, uv, lod).r;
  return uEncode > 0.5 ? (h - 0.5) * 24.0 : h;
}

// ----------------------------------------------------------------- the Moon
// Returns linear radiance (rgb) and coverage (a) for the disc.
vec4 moon(vec2 fc, float R, vec2 C) {
  vec2 q = (fc - C) / R;
  float len = length(q);
  float cover = clamp((1.0 - len) * R + 0.5, 0.0, 1.0);
  // Clamp to the disc so derivatives stay sane at the limb.
  vec2 qc = len > 0.9995 ? q / len * 0.9995 : q;
  vec3 n0 = vec3(qc, sqrt(max(1.0 - dot(qc, qc), 0.0)));   // sphere normal (view)
  vec3 p = transpose(uRot) * n0;                            // selenographic point
  vec2 uv = vec2(atan(p.x, p.z) / TAU + 0.5, asin(clamp(p.y, -1.0, 1.0)) / PI + 0.5);
  vec2 gx = dFdx(uv), gy = dFdy(uv);
  // avoid the longitude seam blowing up derivatives (far side only)
  gx.x = abs(gx.x) > 0.5 ? 0.0 : gx.x;
  gy.x = abs(gy.x) > 0.5 ? 0.0 : gy.x;
  if (cover <= 0.0) return vec4(0.0);

  vec4 s1 = surf1(uv, gx, gy);
  vec2 sl = slopes(uv, gx, gy);
  float lon = atan(p.x, p.z);
  vec3 east = vec3(cos(lon), 0.0, -sin(lon));
  vec3 north = cross(p, east);
  // the equirectangular map pinches at the poles: fade relief out there
  float polar = smoothstep(0.975, 0.998, abs(p.y));
  vec3 nObj = normalize(p - uRelief * (1.0 - polar) * (sl.x * east + sl.y * north));
  vec3 n = uRot * nObj;

  vec3 L = uSun;
  vec3 V = vec3(0.0, 0.0, 1.0);
  float gEarly = acos(clamp(dot(L, V), -1.0, 1.0));
  n = normalize(mix(n0, n, smoothstep(0.03, 0.6, gEarly)));  // relief vanishes toward Full
  float mu0 = dot(n, L);
  float mu = max(dot(n, V), 0.0);
  float muS = n0.z;                                        // macro (sphere) view cosine
  float g = acos(clamp(dot(L, V), -1.0, 1.0));             // phase angle

  // --- cast shadows: march the height field toward the Sun near the terminator
  vec3 Lo = transpose(uRot) * L;
  float sinE = dot(p, Lo);
  // Heights are exaggerated by uRelief; the sphere's curvature is not.
  float shadow = sinE < -0.1 ? 0.0 : 1.0;
  if (sinE > -0.1 && sinE < 0.3 && uReady > 0.0 && polar < 1.0) {
    vec3 dh = Lo - p * sinE;
    float dl = length(dh);
    if (dl > 1e-4) {
      dh /= dl;
      float tanE = sinE / max(sqrt(1.0 - sinE * sinE), 1e-3);
      float h0 = s1.r * 1e-3 * uRelief;
      float texel = TAU / uTexSize.x;
      float st = texel * 1.2;
      for (int i = 0; i < 24; i++) {
        vec3 qp = normalize(p * cos(st) + dh * sin(st));
        // longitude texels crowd toward the poles: sample coarser there
        float lod = clamp(log2(st / (texel * max(abs(qp.x) + abs(qp.z), 0.08))) - 1.5, 0.0, 7.0);
        float hq = heightLod(qp, lod) * 1e-3 * uRelief;
        float ray = h0 + st * tanE + 0.5 * st * st;         // ray height above datum
        float clearance = (ray - hq) / st;                  // tangent of clearance angle
        shadow = min(shadow, clamp(0.5 + clearance / 0.016, 0.0, 1.0)); // Sun is 0.53 deg wide; a little wider hides texel steps
        st *= 1.28;
        if (st > 0.16 || shadow <= 0.0) break;
      }
    }
  }

  // --- photometry: lunar-Lambert (McEwen) — regolith is not a Lambert surface.
  // At full Moon the disc is flat-bright edge to edge, like the real thing.
  float Lw = clamp(1.0 - pow(g / PI, 1.5), 0.0, 1.0);
  float m0 = max(mu0, 0.0);
  float ls = m0 / (m0 + max(mix(mu, muS, 0.6), 0.04));
  float brdf = 2.0 * Lw * ls + (1.0 - Lw) * m0;
  float opposition = 1.0 + 0.2 * exp(-g / 0.1);            // opposition surge

  vec3 hiCol = vec3(1.0, 0.972, 0.93);
  vec3 blue = vec3(0.90, 0.95, 1.06);
  vec3 brown = vec3(1.06, 0.98, 0.89);
  vec3 tintCol = s1.b < 0.0 ? mix(hiCol, blue, -s1.b) : mix(hiCol, brown, s1.b);
  vec3 albedo = s1.g * tintCol;

  // cast shadows hide behind their casters when the Sun is behind us (Full Moon)
  shadow = mix(shadow, smoothstep(-0.01, 0.02, sinE), polar);
  shadow *= smoothstep(-0.02, 0.006, sinE);   // only true peaks catch light past the terminator
  shadow = mix(1.0, shadow, smoothstep(0.04, 0.45, g));
  vec3 col = albedo * brdf * opposition * shadow * vec3(1.0, 0.985, 0.96) * 0.92;

  // --- earthshine: sunlight bounced off a nearly-full Earth near New Moon
  float earthPhase = 0.5 * (1.0 + cos(PI - g));             // Earth's lit fraction seen from the Moon
  float es = 0.011 * pow(earthPhase, 4.0) * (1.0 - smoothstep(-0.05, 0.2, dot(p, Lo)));
  col += albedo * mu * es * vec3(0.55, 0.72, 1.0);

  if (uHC > 0.5) {
    // high contrast: lit side pure bright, dark side a visible slate, crisp limb
    float lit = smoothstep(0.0, 0.08, mu0 * shadow);
    col = mix(vec3(0.04), vec3(1.6) * (0.75 + 0.5 * s1.g), lit);
    float rim = smoothstep(1.0 - 2.5 / R, 1.0 - 1.0 / R, len);
    col = mix(col, vec3(1.2), rim);
  }
  return vec4(col * uReady, cover);
}

// Distance (in Moon radii) from q to the sunlit part of the disc.
// The lit part of each row y spans [sqrt(1-y^2) cos D, sqrt(1-y^2)] in the
// Sun's x direction; we take the nearest of 17 rows plus the pixel's own row.
float litDistance(vec2 q, float cosD, float sx) {
  float x = sx * q.x;
  // soft minimum (log-sum-exp) so the discrete rows leave no ridges
  const float K = 24.0;
  float acc = 0.0;
  for (int i = 0; i <= 24; i++) {
    float y = -1.0 + float(i) / 12.0;
    float h = sqrt(max(1.0 - y * y, 0.0));
    float dx = max(max(h * cosD - x, x - h), 0.0);
    acc += exp(-K * length(vec2(dx, q.y - y)));
  }
  float d = max(-log(acc + 1e-30) / K, 0.0);
  if (abs(q.y) < 1.0) {
    float h = sqrt(1.0 - q.y * q.y);
    d = min(d, max(max(h * cosD - x, x - h), 0.0));
  }
  return max(d, length(q) - 1.0);   // never closer than the disc itself
}

// ---------------------------------------------------------------------- sky
vec3 skyBase(vec2 pc, vec2 res) {
  float t = clamp((pc.y - uHorizon) / (res.y - uHorizon), 0.0, 1.0);
  float toHorizon = pow(1.0 - t, 2.5);
  vec3 zen = vec3(0.0021, 0.0034, 0.0092);
  vec3 hor = vec3(0.013, 0.018, 0.033);
  vec3 c = mix(zen, hor, toHorizon);
  // faint green airglow band ~10 degrees up, visible only on dark nights
  float ag = exp(-pow((t - 0.12) / 0.09, 2.0)) * (1.0 - smoothstep(0.05, 0.5, uIllum));
  c += vec3(0.002, 0.0045, 0.0022) * ag;
  // moonlight scattered by the air: brighter, bluer sky toward Full
  float ms = pow(uIllum, 1.7);
  c += ms * mix(vec3(0.004, 0.009, 0.022), vec3(0.010, 0.016, 0.030), toHorizon);
  // faint warm skyglow hugging the horizon (distant towns)
  c += vec3(0.010, 0.006, 0.003) * exp(-(pc.y - uHorizon) / (res.y * 0.07)) * 0.6;
  return c;
}

vec3 milkyWay(vec2 pc, vec2 res, out float band) {
  vec2 uv = pc / res.y;
  vec2 O = vec2(res.x / res.y * 0.1, 0.12);
  vec2 dir = normalize(vec2(0.5, 1.0));
  vec2 nrm = vec2(dir.y, -dir.x);
  float u = dot(uv - O, dir);
  float v = dot(uv - O, nrm) + 0.04 * sin(u * 2.1 + 0.4);
  float w = 0.12 * mix(1.3, 0.85, clamp(u, 0.0, 1.0));
  vec2 bc = vec2(u, v);
  // domain-warped, isotropic noise: clumpy star clouds, not streaks
  vec2 bw = bc + 0.05 * vec2(fbm2(bc * 5.0 + 1.0) - 0.5, fbm2(bc * 5.0 + 9.0) - 0.5);
  float glow = exp(-v * v / (w * w * 3.0));
  band = exp(-v * v / (w * w));
  float centre = 1.0 + 2.2 * exp(-max(u + 0.05, 0.0) * 3.0);   // galactic bulge low on the horizon
  float clouds = smoothstep(0.25, 0.85, fbm2(bw * 7.0 + 4.0));
  float fine = 0.55 + 0.9 * fbm2(bw * 30.0 + 9.0);
  // the Great Rift: an irregular dark lane splitting the band
  float laneV = v - 0.018 * sin(u * 7.0) + 0.01;
  float rift = exp(-pow(laneV / (w * 0.3), 2.0)) * smoothstep(0.3, 0.6, fbm2(bw * 6.0 + 3.0));
  float dust = smoothstep(0.5, 0.78, fbm2(bw * 11.0 + 21.0));
  float I = (0.22 * glow + band * clouds * fine) * centre;
  I *= (1.0 - 0.85 * rift) * (1.0 - 0.55 * dust * band);
  vec3 cool = vec3(0.60, 0.68, 0.95);
  vec3 warm = vec3(1.0, 0.86, 0.68);
  vec3 col = mix(cool, warm, smoothstep(0.3, 1.8, band * centre));
  // faint hydrogen-alpha knots, as in long exposures
  col += vec3(0.8, 0.2, 0.3) * smoothstep(0.72, 0.9, fbm2(bw * 16.0 + 5.0)) * band * 0.5;
  float vis = 1.0 - 0.92 * smoothstep(0.04, 0.7, uIllum);  // moonlight washes it out
  return col * pow(I, 1.15) * 0.022 * vis;
}

vec3 starLayer(vec2 p, float cell, float seed, float prob, float bright, float scint, float limit) {
  vec2 g = p / cell;
  vec2 id = floor(g);
  vec4 h = hash42(id + seed * 17.31);
  if (h.w > prob) return vec3(0.0);
  vec4 k = hash42(id * 1.37 + seed * 3.1 + 5.0);
  vec2 pos = 0.12 + 0.76 * h.xy;
  vec2 dv = (g - id - pos) * cell;                            // CSS px
  float m = pow(h.z, 12.0);                                   // few bright, many faint
  float b = bright * (0.12 + 5.0 * m);
  b = max(b - limit, 0.0);
  if (b <= 0.0) return vec3(0.0);
  float sigma = max(0.4 + 0.6 * m, 0.6 / uDpr);
  float psf = exp(-dot(dv, dv) / (2.0 * sigma * sigma));
  psf += m * 0.04 * exp(-length(dv) * 0.9);                   // soft glow of the brightest
  float tw = 1.0 + uMotion * scint * (vnoise1(uTime * (5.0 + 9.0 * k.x) + k.y * 100.0) - 0.5) * 2.0;
  // stellar colours: mostly white, some blue-white, some orange
  vec3 col = k.z < 0.18 ? vec3(0.75, 0.84, 1.0) : k.z > 0.82 ? vec3(1.0, 0.78, 0.55) : vec3(1.0, 0.97, 0.92);
  return col * b * psf * tw;
}

// ---------------------------------------------------------------- landscape
// Heights in CSS px. uHorizon is the waterline / base of the far range.
float farRidge(float x, float H) {
  float r = 1.0 - abs(fbm1(x / H * 1.3 + 3.7) * 2.0 - 1.0);
  float r2 = 1.0 - abs(fbm1(x / H * 3.1 + 8.2) * 2.0 - 1.0);
  return uHorizon + H * (0.012 + 0.07 * r * r + 0.022 * r2 * r2);
}
// A forested headland reaching in from the left, and a small island.
float headland(float x, float H) {
  float xn = x / H;
  float land = smoothstep(0.95, 0.35, xn) + 0.8 * exp(-pow((xn - 1.35) / 0.07, 2.0));
  float base = uHorizon - H * 0.03 + H * 0.065 * land * (0.55 + 0.6 * fbm1(xn * 3.0 + 11.0));
  float canopy = H * 0.006 * (fbm1(xn * 90.0) + 0.6 * vnoise1(xn * 260.0));  // tree line
  return base + canopy * smoothstep(0.1, 0.4, land);
}
// Foreground banks rising at both edges.
float shore(float x, float W, float H) {
  float xl = x / W;
  float left = smoothstep(0.42, 0.0, xl);
  float right = smoothstep(0.8, 1.02, xl);
  float n = fbm1(x / H * 4.0 + 23.9);
  return H * (0.16 * left * left * (0.7 + 0.5 * n) + 0.09 * right * right * (0.6 + 0.6 * n));
}

// Pine silhouettes standing on the shore. Returns coverage.
float pines(vec2 p, float W, float H) {
  float sc = H / 900.0;
  float s = 11.0 * sc;
  float cid = floor(p.x / s);
  float cov = 0.0;
  for (int k = -3; k <= 3; k++) {
    float id = cid + float(k);
    vec3 h = hash31(id + 71.0);
    float cx = (id + 0.5 + (h.x - 0.5) * 0.9) * s;
    float gy = shore(cx, W, H);
    float onLand = smoothstep(H * 0.02, H * 0.07, gy);
    if (h.z > onLand * 0.9) continue;
    float th = (40.0 + 150.0 * h.y * h.y) * sc * (0.5 + 0.7 * onLand);
    float yy = p.y - gy + 3.0 * sc;
    if (yy < 0.0 || yy > th) continue;
    float t = yy / th;
    float tiers = 6.0 + floor(h.x * 5.0);
    float tier = fract(t * tiers + h.y);
    float hw = th * 0.17 * pow(1.0 - t, 0.85) * (0.55 + 0.45 * (1.0 - tier));
    hw *= 0.8 + 0.4 * hash11(floor(t * tiers * 3.0) + id);   // ragged branches
    hw = max(hw, 0.7 * sc * (1.0 - t * 0.5));                 // trunk and spire
    float dx = abs(p.x - cx);
    cov = max(cov, clamp((hw - dx) * uDpr + 0.5, 0.0, 1.0));
  }
  return cov;
}

// Everything above the waterline: sky, Milky Way, stars, Moon, halo, hills.
// Called once per pixel, either directly or through the water's mirror.
vec3 above(vec2 pc, vec2 res) {
  float H = res.y;
  vec2 Cc = uMoonC / uDpr;
  float Rc = uMoonR / uDpr;
  vec3 col = skyBase(pc, res);

  float band = 0.0;
  if (uHC < 0.5) col += milkyWay(pc, res, band);

  float dMoon = length(pc - Cc) / Rc;
  float alt = clamp((pc.y - uHorizon) / (H - uHorizon), 0.0, 1.0);
  float scint = mix(0.6, 0.15, alt);
  float limit = 0.085 * pow(uIllum, 1.2);         // moonlight hides faint stars
  float glare = smoothstep(1.15, 3.0, dMoon);     // and drowns stars near the Moon
  float extinction = smoothstep(0.0, 0.12, alt);  // thick air near the horizon
  vec3 st = vec3(0.0);
  if (uHC < 0.5) {
    st += starLayer(pc, 3.3, 1.0, 0.06 + 0.5 * band, 0.03, scint, limit * 0.4);
    st += starLayer(pc + 3.1, 7.5, 2.0, 0.28 + 0.3 * band, 0.06, scint, limit * 0.7);
    st += starLayer(pc + 7.7, 17.0, 3.0, 0.45, 0.14, scint, limit);
    st += starLayer(pc + 1.3, 42.0, 4.0, 0.5, 0.4, scint, limit * 1.4);
    st += starLayer(pc + 13.0, 115.0, 5.0, 0.55, 1.1, scint, limit * 2.0);
  } else {
    st += starLayer(pc + 7.7, 40.0, 3.0, 0.5, 1.0, 0.0, 0.0);
  }
  col += st * glare * extinction;

  vec4 m = moon(pc * uDpr, uMoonR, uMoonC);
  vec3 airInFront = skyBase(pc, res);
  col = mix(col, m.rgb + airInFront, m.a);

  float lum = pow(uIllum, 1.3) * uReady;
  // far from the disc the lit-region shape no longer matters: skip the soft-min
  float rr = dMoon > 4.5 ? dMoon - 1.0 : litDistance((pc - Cc) / Rc, uCosD, uSun.x >= 0.0 ? 1.0 : -1.0);
  vec3 haloCol = vec3(0.80, 0.86, 1.0);
  float halo = 0.075 * exp(-rr * 5.0) + 0.028 * exp(-rr * 1.2) + 0.0065 / (1.0 + rr * rr * 0.35);
  float moonY = dot(m.rgb, vec3(0.3, 0.6, 0.1));
  col += haloCol * halo * lum * (1.0 - m.a * smoothstep(0.0, 0.08, moonY) * 0.9) * (uHC > 0.5 ? 0.0 : 1.0);

  // ---- distant range + forested headland -----------------------------------
  float moonLight = 0.3 + 0.7 * pow(uIllum, 0.8);
  vec3 hazeCol = vec3(0.018, 0.026, 0.046) * moonLight;
  // moonlight scattering toward the Moon's azimuth brightens the haze there
  float towardMoon = exp(-pow((pc.x - Cc.x) / (res.x * 0.35), 2.0));
  hazeCol *= 1.0 + 0.8 * towardMoon * lum;

  float yFar = farRidge(pc.x, H);
  float cFar = clamp((yFar - pc.y) * uDpr + 0.5, 0.0, 1.0);
  vec3 farCol = skyBase(vec2(pc.x, uHorizon), res) * 0.42 + hazeCol * 0.3;
  farCol *= 0.8 + 0.25 * smoothstep(yFar - H * 0.05, yFar, pc.y);    // ridges lighter at the crest
  farCol += hazeCol * 0.8 * exp(-(pc.y - uHorizon) / (H * 0.012));   // mist on the water
  col = mix(col, farCol, cFar * (uHC > 0.5 ? 0.0 : 1.0));

  float yHead = headland(pc.x, H);
  float cHead = clamp((yHead - pc.y) * uDpr + 0.5, 0.0, 1.0);
  vec3 headCol = vec3(0.0022, 0.003, 0.0052) * moonLight;
  headCol += hazeCol * 0.35 * exp(-(pc.y - uHorizon + H * 0.03) / (H * 0.01));
  col = mix(col, headCol, cHead);
  if (uHC > 0.5) col = mix(col, vec3(0.0), max(cFar, cHead));
  return col;
}

void main() {
  // ---- mini Moon mode (calendar) ------------------------------------------
  if (uMode > 0.5) {
    vec2 C = uRes * 0.5;
    float R = uRes.x * 0.46;
    vec4 m = moon(gl_FragCoord.xy, R, C);
    // faint ghost of the unlit disc so a New Moon still reads as a shape
    vec3 c = m.rgb + vec3(0.010, 0.013, 0.02);
    c = toSRGB(aces(c * uExposure));
    outColor = vec4(c, m.a);
    return;
  }

  vec2 res = uRes / uDpr;                        // CSS px
  vec2 pc = gl_FragCoord.xy / uDpr;              // CSS px, bottom-left origin
  float H = res.y;
  float W = res.x;
  vec2 Cc = uMoonC / uDpr;
  float Rc = uMoonR / uDpr;
  float lum = pow(uIllum, 1.3) * uReady;

  vec3 col;
  float waterY = uHorizon;
  if (pc.y >= waterY) {
    col = above(pc, res);
  } else {
    // ---- the lake: a perspective-rippled mirror of everything above ----------
    float depth = (waterY - pc.y) / H;                       // 0 at the far shore
    float Z = 0.06 / max(depth, 0.0015);                     // distance on the water plane
    vec2 gp = vec2((pc.x / H - 0.5 * W / H) * Z, Z);         // ground-plane coords
    float t = uTime * uMotion;
    vec2 wa = gp * vec2(5.0, 9.0) + vec2(t * 0.05, -t * 0.25);
    float e = 0.02;
    float h0 = fbm2(wa);
    float hx = fbm2(wa + vec2(e, 0.0));
    float hy = fbm2(wa + vec2(0.0, e));
    vec2 slope = vec2(hx - h0, hy - h0) / e;
    // screen-space distortion shrinks with distance (perspective)
    float amp = H * (0.002 + depth * 0.09 + depth * depth * 0.4);
    vec2 rp = vec2(pc.x + slope.x * amp * 0.6, 2.0 * waterY - pc.y + slope.y * amp * 1.6);
    float fres = mix(0.14, 0.7, exp(-depth * 12.0));         // grazing water mirrors more
    col = above(rp, res) * fres + vec3(0.0005, 0.0008, 0.0012);

    // moon glade: wave facets that catch the Moon, in a column below it,
    // widening toward the viewer
    float halfW = Rc * (0.5 + depth * 5.0);
    float colMask = exp(-pow((pc.x - Cc.x) / halfW, 2.0));
    float facets = smoothstep(0.62, 0.95, fbm2(wa * 3.0 + slope * 2.0));
    float glade = colMask * facets * lum * (0.35 + 1.4 * depth) * (0.4 + 0.6 * exp(-depth * 4.0));
    col += vec3(0.95, 0.96, 1.0) * glade * 0.5 * (uHC > 0.5 ? 0.0 : 1.0);
    col += vec3(0.8, 0.86, 1.0) * colMask * lum * 0.02 * exp(-depth * 3.0);  // soft sheen
    if (uHC > 0.5) col = vec3(0.0);
  }

  // ---- foreground banks with pines -------------------------------------------
  float yShore = shore(pc.x, W, H);
  float cShore = clamp((yShore - pc.y) * uDpr + 0.5, 0.0, 1.0);
  cShore = max(cShore, pines(pc, W, H));
  col = mix(col, vec3(0.0007, 0.0009, 0.0014), cShore);

  // ---- output: filmic tone map, sRGB, dither ------------------------------------
  vec3 outc = toSRGB(aces(col * uExposure));
  float dither = (hash12(gl_FragCoord.xy + fract(uTime * 7.0) * 311.0) - 0.5) / 255.0;
  outColor = vec4(outc + dither, 1.0);
}
`;
