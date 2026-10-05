/**
 * The beach backdrop as one full-screen fragment shader (WebGL 1, GLSL ES 1.0): sky, sea,
 * breaking waves, the swash that runs up the sand, wet and dry sand. See docs/adr/0001.
 *
 * Coordinates: `p` is in CSS-sized pixels with y pointing down, `f` is p over the resolution.
 * The breathing of the sea is a seven-second cycle; a wrong letter adds a swell (`uSwell`)
 * that rises behind the castle, breaks and surges (`uSurge`) up the beach towards it.
 */
export const VERTEX_SHADER = `
attribute vec2 aPosition;
void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }
`;

export const FRAGMENT_SHADER = `
precision highp float;

uniform vec2 uRes;
uniform float uTime;
uniform float uScale;
uniform float uHorizon;
uniform float uShore;
uniform float uNight;
uniform vec2 uOrb;
uniform float uSurgeX;
uniform float uSurge;
uniform float uSurgeReach;
uniform float uWet;
uniform float uSwell;
uniform float uSwellGlow;
uniform float uCalm;

uniform vec3 uSkyTop;
uniform vec3 uSkyHorizon;
uniform vec3 uHaze;
uniform vec3 uOrbColor;
uniform vec3 uOrbGlow;
uniform vec3 uSeaDeep;
uniform vec3 uSeaMid;
uniform vec3 uSeaShallow;
uniform vec3 uFoam;
uniform vec3 uGlow;
uniform vec3 uSandWet;
uniform vec3 uSandDry;
uniform vec3 uSandShade;
uniform vec3 uSandLight;
uniform vec3 uIsland;

const float CYCLE = 7.0;
const float PI = 3.14159265;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(17.1, 9.7);
    a *= 0.5;
  }
  return v;
}

// The calm shoreline, a gentle S across the beach.
float shoreLine(float fx) {
  return uShore + 0.010 * sin(fx * 5.3 + 1.1) + 0.006 * sin(fx * 12.7 - 0.4)
    + 0.003 * sin(uTime * 0.7);
}

// How far up the sand the swash reaches in this breath (0 to 1).
float runUp(float q) {
  if (q < 0.2) return sin(q / 0.2 * PI * 0.5);
  return pow(clamp(1.0 - (q - 0.2) / 0.62, 0.0, 1.0), 1.7);
}

float surgeProfile(float fx, float aspect) {
  float d = (fx - uSurgeX) * aspect / 0.8;
  return exp(-d * d);
}

vec3 sky(vec2 f, float aspect) {
  float t = clamp(f.y / uHorizon, 0.0, 1.0);
  vec3 col = mix(uSkyTop, uSkyHorizon, pow(t, 1.6));
  vec2 d = (f - uOrb) * vec2(aspect, 1.0);
  float r = length(d);
  float glow = exp(-r * mix(5.0, 7.5, uNight));
  col += uOrbGlow * glow * mix(0.55, 0.32, uNight);
  float disc = smoothstep(0.034, 0.031, r);
  vec3 orb = uOrbColor;
  // The moon's seas: soft darker patches.
  float seas = fbm(d * 26.0 + 3.0);
  orb = mix(orb, orb * 0.9, uNight * smoothstep(0.5, 0.8, seas));
  col = mix(col, orb, disc);
  if (uNight > 0.5) {
    for (int layer = 0; layer < 2; layer++) {
      float density = layer == 0 ? 90.0 : 170.0;
      vec2 sp = f * vec2(aspect, 1.0) * density + float(layer) * 13.7;
      vec2 cell = floor(sp);
      float star = hash(cell);
      vec2 offset = vec2(hash(cell + 3.1), hash(cell + 7.7)) - 0.5;
      vec2 inCell = fract(sp) - 0.5 - offset * 0.6;
      float twinkle = 0.55 + 0.45 * sin(uTime * (0.8 + star * 2.5) + star * 40.0);
      float size = layer == 0 ? 0.11 : 0.08;
      float point = smoothstep(size, 0.0, length(inCell));
      float threshold = layer == 0 ? 0.965 : 0.94;
      col += vec3(0.88, 0.92, 1.0) * point * step(threshold, star) * twinkle * (1.0 - t * 0.75) * (layer == 0 ? 1.0 : 0.6);
    }
  } else {
    // Faint high cloud.
    float cloud = fbm(vec2(f.x * aspect * 2.2 + uTime * 0.006, f.y * 9.0));
    col = mix(col, uHaze, smoothstep(0.55, 0.8, cloud) * 0.35 * (1.0 - t));
  }
  // A distant island on the horizon, hazy blue.
  float island = 0.018 * smoothstep(0.03, 0.12, f.x) * smoothstep(0.34, 0.2, f.x)
    * (0.6 + 0.4 * noise(vec2(f.x * 30.0, 1.0)));
  if (f.y > uHorizon - island) col = mix(col, uIsland, 0.85);
  col = mix(col, uHaze, smoothstep(0.75, 1.0, t) * 0.4);
  return col;
}

vec3 sea(vec2 f, float shore, float aspect) {
  float tt = clamp((f.y - uHorizon) / (shore - uHorizon), 0.0, 1.0);
  float depthWave = 1.0 / (tt + 0.09);
  float xw = (f.x - 0.5) * aspect * depthWave * 0.9;
  vec3 col = mix(uSeaDeep, uSeaMid, smoothstep(0.0, 0.55, tt));
  col = mix(col, uSeaShallow, smoothstep(0.55, 1.0, tt) * (1.0 - uNight * 0.35));

  // Swells rolling towards the beach.
  float phase = depthWave * 1.15 + uTime * 0.33 + fbm(vec2(xw * 0.35, depthWave * 0.3)) * 1.4;
  float swell = sin(phase * 2.0 * PI);
  float crest = smoothstep(0.55, 1.0, swell) * (0.08 + 0.5 * tt);
  float trough = smoothstep(0.2, -1.0, swell) * 0.12 * (0.3 + tt);
  col = mix(col, uFoam, crest * 0.35 * (1.0 - uNight * 0.6));
  col *= 1.0 - trough;
  // Fine ripples.
  float ripple = noise(vec2(xw * 6.0, phase * 5.0 + uTime * 0.6));
  col += (ripple - 0.5) * 0.06 * (1.0 - uNight * 0.5);

  // The glade under the sun or moon, with glints on the crests.
  float glade = exp(-pow((f.x - uOrb.x) * aspect / (0.05 + 0.28 * tt), 2.0));
  vec2 gpos = vec2(xw * 26.0, phase * 22.0);
  vec2 gcell = floor(gpos);
  vec2 gin = fract(gpos) - 0.5;
  float glint = step(0.9, hash(gcell + floor(uTime * 3.0)));
  float streak = smoothstep(0.5, 0.0, length(gin * vec2(1.2, 5.0)));
  float sparkle = glint * streak * smoothstep(-0.2, 0.9, swell) * (0.2 + glade * 1.2);
  col += uOrbColor * sparkle * mix(0.55, 0.45, uNight) * smoothstep(0.02, 0.25, tt);
  col += uOrbGlow * glade * mix(0.10, 0.2, uNight) * (1.0 - tt * 0.5);

  // The breaker: a line of foam that rolls in each breath and spills near the shore.
  float q = fract(uTime / CYCLE + 0.78);
  float breakAt = mix(0.62, 1.02, smoothstep(0.0, 1.0, q));
  float lace = fbm(vec2(xw * 3.0, uTime * 0.25));
  float band = 0.014 + 0.03 * smoothstep(0.75, 1.0, breakAt);
  float breaker = smoothstep(band, 0.0, abs(tt - breakAt + (lace - 0.5) * 0.03));
  float wake = smoothstep(0.0, 0.12, breakAt - tt) * smoothstep(0.3, 0.0, breakAt - tt);
  float wakeLace = smoothstep(0.55, 0.78, fbm(vec2(xw * 4.0, tt * 30.0 - uTime * 0.2)));
  float foam = (breaker * (0.65 + 0.35 * lace) + wake * wakeLace * 0.5) * (1.0 - uCalm);

  // The wrong letter's swell: a dark face and a bright, spilling crest behind the castle.
  float swellAt = mix(0.35, 1.0, uSwell);
  float local = surgeProfile(f.x, aspect);
  float rise = sin(uSwell * PI) * local;
  float lipWobble = (fbm(vec2(xw * 2.5, uTime * 0.5)) - 0.5) * 0.025;
  float ahead = tt - swellAt + lipWobble;
  float faceDepth = 0.24;
  float face = smoothstep(-0.004, 0.006, ahead) * smoothstep(faceDepth * 1.05, faceDepth * 0.9, ahead);
  // The back of the wave, darker, so the white lip stands out against it.
  float back = smoothstep(-0.09, -0.01, ahead) * smoothstep(0.0, -0.01, ahead);
  col = mix(col, uSeaDeep, back * rise * 0.45);
  // The face glows where the light shines through its thin top, and darkens towards its foot.
  vec3 backlit = mix(uSeaShallow, vec3(0.5, 1.0, 0.86), 0.7 * (1.0 - uNight));
  backlit = mix(backlit, uGlow * 0.55 + uSeaMid * 0.5, uNight * 0.6);
  float faceShade = smoothstep(0.0, faceDepth, ahead);
  vec3 faceColour = mix(backlit, uSeaDeep * mix(0.7, 0.9, uNight), smoothstep(0.05, 0.85, faceShade));
  col = mix(col, faceColour, face * rise);
  float streaks = smoothstep(0.5, 0.85, noise(vec2(xw * 16.0, ahead * 9.0 - uTime * 0.4)));
  col = mix(col, uFoam, face * rise * streaks * 0.45 * (1.0 - faceShade));
  float swellTrough = smoothstep(faceDepth * 0.6, faceDepth, ahead) * smoothstep(faceDepth * 1.8, faceDepth, ahead);
  col *= 1.0 - swellTrough * rise * 0.25;
  float lip = smoothstep(0.03, 0.006, abs(ahead + 0.008));
  foam += lip * rise * 1.8;
  // Foam spilling down the top of the face as the lip pitches over.
  float spill = smoothstep(0.0, 0.01, ahead) * smoothstep(0.07, 0.015, ahead);
  float spillFoam = smoothstep(0.42, 0.7, fbm(vec2(xw * 7.0, ahead * 30.0 - uTime * 0.8)));
  foam += spill * spillFoam * rise * 0.9;
  float behind = smoothstep(0.0, -0.05, ahead) * smoothstep(-0.12, -0.03, ahead);
  float spillLace = smoothstep(0.45, 0.72, fbm(vec2(xw * 5.0, tt * 40.0 + uTime)));
  foam += behind * spillLace * rise * 0.8;

  // Lacy foam at the very edge of the water.
  float edge = smoothstep(0.93, 1.0, tt) * smoothstep(0.45, 0.7, fbm(vec2(xw * 3.0, uTime * 0.3)));
  foam += edge * 0.6;

  foam = clamp(foam, 0.0, 1.0);
  col = mix(col, uFoam, foam * mix(0.95, 0.55, uNight));
  // Moonlit Tide: breaking water lights up.
  col += uGlow * foam * uNight * (0.55 + 0.9 * uSwellGlow * local);
  col = mix(col, uHaze, smoothstep(0.15, 0.0, tt) * 0.5);
  return col;
}

vec3 sand(vec2 p, vec2 f, float aspect) {
  float near = (f.y - uShore) / (1.0 - uShore);
  vec2 sp = vec2(f.x * aspect, f.y) * vec2(1.0, 1.6);
  float dunes = fbm(sp * 3.0);
  vec3 col = mix(uSandDry, uSandShade, smoothstep(0.35, 0.8, dunes) * 0.7);
  // Wind ripples, gently curving.
  float ripples = sin((sp.y * 90.0 + fbm(sp * 4.0) * 6.0 + sp.x * 6.0));
  col = mix(col, uSandShade, smoothstep(0.6, 1.0, ripples) * 0.18);
  col = mix(col, uSandLight, smoothstep(0.6, 1.0, -ripples) * 0.16 * (1.0 - uNight * 0.5));
  // Grains.
  float grain = hash(floor(p / max(1.0, uScale * 1.6)));
  col += (grain - 0.5) * 0.06;
  col *= mix(1.0, 0.9, near * uNight);
  return col;
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 f = vec2(gl_FragCoord.x / uRes.x, 1.0 - gl_FragCoord.y / uRes.y);
  float aspect = uRes.x / uRes.y;
  float shore = shoreLine(f.x);

  if (f.y < uHorizon) {
    gl_FragColor = vec4(sky(f, aspect), 1.0);
    return;
  }
  if (f.y < shore) {
    gl_FragColor = vec4(sea(f, shore, aspect), 1.0);
    return;
  }

  // Up the beach: swash, wet sand, then dry sand.
  float q = fract(uTime / CYCLE);
  float breath = runUp(q) * (1.0 - uCalm * 0.7);
  float ragged = fbm(vec2(f.x * 7.0, floor(uTime / CYCLE) * 3.1));
  float local = surgeProfile(f.x, aspect);
  float surge = uSurge * uSurgeReach * local * (0.85 + 0.3 * ragged);
  float reach = shore + breath * (0.028 + 0.02 * ragged) + surge;
  float wetLine = shore + 0.05 + 0.015 * ragged + uWet * uSurgeReach * local * 1.05;

  vec3 col = sand(p, f, aspect);
  // Damp sand darkens and shines; at night it holds the stars.
  float damp = smoothstep(wetLine + 0.012, wetLine - 0.01, f.y);
  vec3 wet = uSandWet;
  float mirrorY = uHorizon - (f.y - shore) * 1.6;
  vec3 reflected = sky(vec2(f.x + (noise(vec2(f.x * 40.0, f.y * 200.0)) - 0.5) * 0.004, max(mirrorY, 0.0)), aspect);
  wet = mix(wet, reflected, mix(0.22, 0.42, uNight) * smoothstep(wetLine, shore, f.y));
  float glade = exp(-pow((f.x - uOrb.x) * aspect / 0.06, 2.0));
  wet += uOrbGlow * glade * 0.12 * smoothstep(wetLine, shore, f.y);
  col = mix(col, wet, damp * 0.88);

  // The swash: a thin sheet of water with a lacy foam edge.
  if (f.y < reach) {
    float depth = clamp((reach - f.y) / max(0.002, reach - shore), 0.0, 1.0);
    vec3 water = mix(uSeaShallow, uFoam, 0.12 * (1.0 - uNight));
    col = mix(col, water, mix(0.35, 0.75, depth) * mix(1.0, 0.8, uNight));
    float shimmer = noise(vec2(f.x * aspect * 60.0, f.y * 160.0 - uTime * 2.0));
    col += uOrbColor * smoothstep(0.75, 0.95, shimmer) * 0.12;
  }
  float edgeWidth = 0.0035 + 0.004 * local * uSurge;
  float edge = smoothstep(edgeWidth, 0.0, abs(f.y - reach + 0.002));
  float lace = smoothstep(0.35, 0.65, fbm(vec2(f.x * aspect * 18.0, uTime * 0.4)));
  float edgeFoam = edge * (0.5 + 0.5 * lace) * step(shore, reach - 0.001);
  col = mix(col, uFoam, edgeFoam * mix(0.9, 0.5, uNight));
  col += uGlow * edgeFoam * uNight * (0.6 + uSwellGlow * local);
  // Bubbles left behind as the water drains.
  float bubbles = step(0.985, hash(floor(p / max(2.0, uScale * 3.0)))) * smoothstep(reach + 0.03, reach, f.y) * step(reach, f.y);
  col = mix(col, uFoam, bubbles * 0.4 * (1.0 - uNight * 0.5));

  gl_FragColor = vec4(col, 1.0);
}
`;
