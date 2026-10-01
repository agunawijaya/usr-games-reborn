// Shared GLSL. Every texture in the port is computed from these functions
// or from engine data (port ADR 002).

export const NOISE = /* glsl */ `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x),
             mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    s += a * vnoise(p);
    p = p * 2.03 + vec2(17.1, 9.3);
    a *= 0.5;
  }
  return s;
}
// cellular (Worley) distance, for bubbles and cracks
float worley(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float d = 1.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 o = vec2(float(x), float(y));
    vec2 r = o + hash22(i + o) - f;
    d = min(d, dot(r, r));
  }
  return sqrt(d);
}
`;

// World <-> maze cell. The maze is 51 x 23; cell (x, y) is centred on
// world (x - 25, y - 11) with +z pointing south (down the screen).
export const MAZE = /* glsl */ `
const vec2 MAZE = vec2(51.0, 23.0);
vec2 cellUv(vec2 worldXZ) {
  return (worldXZ + vec2(25.0, 11.0) + 0.5) / MAZE;
}
`;

// Dynamic point lights shared by floor, walls and actors: explosions,
// muzzle flashes, lava, shots. xyz position, w radius; rgb colour * power.
export const LIGHTS = /* glsl */ `
#define NLIGHTS 16
uniform vec4 uLightPos[NLIGHTS];
uniform vec3 uLightCol[NLIGHTS];
vec3 pointLights(vec3 p, vec3 n) {
  vec3 acc = vec3(0.0);
  for (int i = 0; i < NLIGHTS; i++) {
    vec4 lp = uLightPos[i];
    if (lp.w <= 0.0) continue;
    vec3 d = lp.xyz - p;
    float dist = length(d);
    float att = clamp(1.0 - dist / lp.w, 0.0, 1.0);
    att *= att;
    float lam = max(dot(n, d / max(dist, 1e-3)), 0.0) * 0.8 + 0.2;
    acc += uLightCol[i] * att * lam;
  }
  return acc;
}
`;

// The viewer's light: a 3-wide flashlight beam ahead (look()/see() in
// draw.c), dimmer fill to the sides, nothing behind — multiplied by the
// per-cell visibility mask so it never leaks past a wall.
export const BEAM = /* glsl */ `
uniform vec3 uEye;      // viewer position (world), y = hover height
uniform vec2 uFace;     // facing unit vector in xz
uniform float uBeamOn;  // 0 while dead / see-all
uniform float uAmb;     // overhead fill for the see-all (monitor) view
vec3 beamLight(vec3 p, vec3 n, float lit) {
  vec2 v = p.xz - uEye.xz;
  float along = dot(v, uFace);
  float side = abs(v.x * uFace.y - v.y * uFace.x);
  float dist = length(v);
  // wide soft cone from the chest of the avatar, straight down the corridor
  float cone = smoothstep(-0.3, 1.2, along) * (1.0 - smoothstep(0.7 + along * 0.06, 1.8 + along * 0.1, side));
  float fall = exp(-along / 9.0) * (0.55 + 0.45 * exp(-along / 2.5));
  float pool = 1.0 - smoothstep(0.3, 1.9, dist);
  vec3 L = normalize(vec3(uEye.x - p.x, 0.75 - p.y * 0.4, uEye.z - p.z));
  float lam = max(dot(n, L), 0.0) * 0.85 + 0.15;
  vec3 warm = vec3(1.0, 0.9, 0.76);
  vec3 cool = vec3(0.55, 0.65, 0.9);
  float top = max(n.y, 0.0) * 0.6 + max(dot(n, normalize(vec3(-0.4, 0.6, 0.7))), 0.0) * 0.5 + 0.15;
  return lit * (warm * lam * (cone * fall * 2.6 * uBeamOn + pool * 0.55 * uBeamOn) + cool * 0.16)
       + vec3(0.55, 0.6, 0.72) * top * uAmb * 0.5;
}
`;
