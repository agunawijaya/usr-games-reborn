/**
 * The cube scene's GLSL (WebGL 2). Four programs: the backdrop (a lamp-lit studio wall, or a
 * slow aurora), the tray, the soft shadows and glows under the cubes, and the cubes themselves
 * (glossy pastel by day, glass lit from inside by night). `uLook` is 0 for Studio, 1 for Arcade.
 */

const NOISE = /* glsl */ `
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 4; i++) {
    value += amplitude * noise(p);
    p = p * 2.03 + vec2(17.1, 3.7);
    amplitude *= 0.5;
  }
  return value;
}
`;

export const BACKDROP_VERTEX = /* glsl */ `#version 300 es
const vec2 CORNERS[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
void main() {
  gl_Position = vec4(CORNERS[gl_VertexID], 0.0, 1.0);
}
`;

export const BACKDROP_FRAGMENT = /* glsl */ `#version 300 es
precision highp float;
uniform vec2 uResolution;
uniform float uTime;
uniform float uLook;
uniform vec3 uSkyTop;
uniform vec3 uSkyBottom;
uniform vec3 uGlowA;
uniform vec3 uGlowB;
uniform vec3 uGlowC;
uniform vec2 uFocus;
uniform float uFocusRadius;
uniform float uReveal;
out vec4 outColor;
${NOISE}
void main() {
  vec2 frag = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y);
  vec2 uv = frag / uResolution;
  float aspect = uResolution.x / uResolution.y;
  vec2 centred = (uv - 0.5) * vec2(aspect, 1.0);
  vec3 colour = mix(uSkyTop, uSkyBottom, smoothstep(0.0, 1.0, uv.y));
  float focus = length((frag - uFocus) / uFocusRadius);
  if (uLook < 0.5) {
    // A photographer's sweep: wall above, floor below, joined by a soft curve behind the tray.
    float floor_ = smoothstep(uFocus.y / uResolution.y - 0.36, uFocus.y / uResolution.y + 0.04, uv.y);
    colour = mix(uSkyTop, mix(uSkyBottom, vec3(1.0, 0.975, 0.93), 0.35), floor_);
    // The lamp's pool on the floor round the tray, and its glow on the wall behind.
    vec2 pool = (frag - uFocus) / (uFocusRadius * vec2(1.15, 0.7));
    colour = mix(colour, uGlowA, exp(-dot(pool, pool) * 0.9) * (0.55 + 0.15 * uReveal));
    colour = mix(colour, uGlowA, exp(-focus * focus * 2.2) * 0.25 * (1.0 - floor_));
    // Out-of-focus studio lights drifting slowly at the edges of the set.
    for (int i = 0; i < 8; i++) {
      float fi = float(i);
      vec2 centre = vec2(fract(0.08 + fi * 0.371 + 0.0035 * uTime * (0.6 + 0.4 * sin(fi * 2.1))), 0.08 + 0.84 * fract(0.21 + fi * 0.617));
      float radius = 0.05 + 0.05 * fract(fi * 0.77);
      float disc = smoothstep(radius, radius * 0.7, length((uv - centre) * vec2(aspect, 1.0)));
      vec3 tint = mod(fi, 2.0) < 1.0 ? uGlowB : uGlowC;
      colour = mix(colour, tint, disc * 0.2);
    }
    colour *= 1.0 - 0.09 * smoothstep(0.55, 1.4, length(centred));
    colour += (hash(frag + fract(uTime)) - 0.5) * 0.01;
  } else {
    vec2 p = vec2(uv.x * aspect, uv.y);
    float t = uTime * 0.035;
    float warp = fbm(p * 1.5 + vec2(t, -t * 0.6));
    float curtain = fbm(vec2(p.x * 5.0 + warp * 2.0, uv.y * 1.4 - t * 3.0));
    float bandA = exp(-pow((uv.y - 0.2 - 0.1 * sin(p.x * 1.6 + warp * 3.0 + t * 3.0)) * 6.5, 2.0));
    float bandB = exp(-pow((uv.y - 0.36 - 0.08 * sin(p.x * 2.2 - warp * 2.6 - t * 2.0)) * 8.0, 2.0));
    vec3 aurora = uGlowA * bandA * (0.35 + curtain) + uGlowB * bandB * (0.45 + 0.9 * curtain) + uGlowC * bandA * bandB * 1.2;
    colour += aurora * (0.42 + 0.2 * uReveal);
    vec2 cell = floor(frag / 3.0);
    float star = step(0.9972, hash(cell)) * (0.55 + 0.45 * sin(uTime * 1.3 + hash(cell + 3.0) * 30.0));
    colour += vec3(star) * 0.55 * (1.0 - uv.y);
    colour += uGlowB * exp(-focus * focus * 1.1) * (0.16 + 0.12 * uReveal);
    colour *= 1.0 - 0.32 * smoothstep(0.5, 1.4, length(centred));
  }
  outColor = vec4(colour, 1.0);
}
`;

const ROTATE = /* glsl */ `
vec3 rotate(vec4 q, vec3 v) {
  vec3 t = 2.0 * cross(q.xyz, v);
  return v + q.w * t + cross(q.xyz, t);
}
`;

export const CUBE_VERTEX = /* glsl */ `#version 300 es
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec4 aCentre;
layout(location = 3) in vec4 aRotation;
layout(location = 4) in vec3 aColour;
layout(location = 5) in vec3 aGlyphsA;
layout(location = 6) in vec3 aGlyphsB;
layout(location = 7) in vec4 aState;
uniform mat4 uViewProjection;
out vec3 vObject;
out vec3 vObjectNormal;
out vec3 vWorld;
out vec3 vNormal;
out vec3 vColour;
flat out vec3 vGlyphsA;
flat out vec3 vGlyphsB;
out vec4 vState;
out float vHeight;
${ROTATE}
void main() {
  vec3 world = rotate(aRotation, aPosition * aCentre.w) + aCentre.xyz;
  vObject = aPosition;
  vObjectNormal = aNormal;
  vWorld = world;
  vNormal = rotate(aRotation, aNormal);
  vColour = aColour;
  vGlyphsA = aGlyphsA;
  vGlyphsB = aGlyphsB;
  vState = aState;
  vHeight = (world.y - (aCentre.y - 0.5 * aCentre.w)) / aCentre.w;
  gl_Position = uViewProjection * vec4(world, 1.0);
}
`;

export const CUBE_FRAGMENT = /* glsl */ `#version 300 es
precision highp float;
in vec3 vObject;
in vec3 vObjectNormal;
in vec3 vWorld;
in vec3 vNormal;
in vec3 vColour;
flat in vec3 vGlyphsA;
flat in vec3 vGlyphsB;
in vec4 vState;
in float vHeight;
uniform sampler2D uAtlas;
uniform vec3 uEye;
uniform vec3 uKeyLight;
uniform float uLook;
uniform vec3 uLetter;
uniform vec3 uTraceGlow;
out vec4 outColor;

const vec2 ATLAS = vec2(8.0, 4.0);

int faceOf(vec3 p) {
  vec3 a = abs(p);
  if (a.y >= a.x && a.y >= a.z) return p.y > 0.0 ? 0 : 1;
  if (a.x >= a.z) return p.x > 0.0 ? 2 : 3;
  return p.z > 0.0 ? 4 : 5;
}

// The letter's right and up directions on each face, matching mesh.ts and the cube orientations.
vec2 faceUv(int face, vec3 p) {
  if (face == 0) return vec2(p.x, -p.z);
  if (face == 1) return vec2(p.x, p.z);
  if (face == 2) return vec2(-p.z, p.y);
  if (face == 3) return vec2(p.z, p.y);
  if (face == 4) return vec2(p.x, p.y);
  return vec2(-p.x, p.y);
}

float glyphOf(int face) {
  if (face == 0) return vGlyphsA.x;
  if (face == 1) return vGlyphsA.y;
  if (face == 2) return vGlyphsA.z;
  if (face == 3) return vGlyphsB.x;
  if (face == 4) return vGlyphsB.y;
  return vGlyphsB.z;
}

vec2 atlasUv(float glyph, vec2 uv) {
  vec2 cell = vec2(mod(glyph, ATLAS.x), floor(glyph / ATLAS.x));
  vec2 local = clamp(vec2(uv.x + 0.5, 0.5 - uv.y), 0.03, 0.97);
  return (cell + local) / ATLAS;
}

void main() {
  vec3 n = normalize(vNormal);
  vec3 v = normalize(uEye - vWorld);
  vec3 l = normalize(uKeyLight);
  vec3 h = normalize(l + v);
  int face = faceOf(vObject);
  vec4 glyph = texture(uAtlas, atlasUv(glyphOf(face), faceUv(face, vObject)));
  float letter = glyph.r;
  float halo = glyph.g;
  float trace = vState.x;
  float flash = vState.y;
  float dim = vState.z;
  float facing = max(dot(n, v), 0.0);
  float fresnel = pow(1.0 - facing, 4.0);
  vec3 an = abs(normalize(vObjectNormal));
  float bevel = 1.0 - max(an.x, max(an.y, an.z));
  if (uLook < 0.5) {
    vec3 albedo = mix(vColour, uLetter, letter * 0.97);
    float diffuse = max(dot(n, l), 0.0);
    float fill = max(dot(n, normalize(vec3(0.7, 0.45, 0.5))), 0.0) * 0.22;
    vec3 ambient = mix(vec3(0.78, 0.66, 0.64), vec3(1.0, 0.97, 0.94), 0.5 + 0.5 * n.y) * 0.5;
    float occlusion = mix(0.6, 1.0, smoothstep(0.0, 0.6, vHeight));
    vec3 colour = albedo * (ambient + diffuse * 0.56 + fill) * occlusion;
    float gloss = pow(max(dot(n, h), 0.0), 80.0) * 0.55 + pow(max(dot(n, h), 0.0), 12.0) * 0.08;
    colour += gloss * (1.0 - letter * 0.7) * vec3(1.0, 0.98, 0.95);
    colour += fresnel * 0.16 * vec3(1.0, 0.95, 0.9);
    colour += uTraceGlow * trace * (fresnel * 0.8 + smoothstep(0.03, 0.25, bevel) * 0.6);
    // A found word's flash: a warm bloom rather than a white wash, so the cubes keep their colour.
    colour += flash * (uTraceGlow * 0.32 + 0.08);
    colour = mix(colour, colour * 0.62 + vec3(0.06), dim);
    outColor = vec4(colour, 1.0);
  } else {
    float edge = smoothstep(0.02, 0.2, bevel);
    float upper = mix(0.14, 1.0, smoothstep(0.55, 0.9, n.y));
    vec3 rim = mix(vColour, uTraceGlow, trace * 0.7);
    vec3 colour = vColour * (0.08 + 0.1 * trace);
    colour += rim * edge * (0.55 + trace * 0.7);
    colour += mix(vColour, vec3(1.0), 0.4) * pow(1.0 - facing, 3.0) * 0.5;
    vec3 lit = mix(uLetter, mix(uLetter, uTraceGlow, 0.45), trace);
    colour += lit * (letter * 1.3 + halo * 0.5) * upper * (1.0 + trace * 0.5);
    colour += vColour * halo * 0.3 * upper;
    colour += pow(max(dot(n, h), 0.0), 90.0) * 0.85;
    colour += flash * 0.45 * rim;
    colour *= 1.0 - dim * 0.6;
    float alpha = clamp(0.46 + fresnel * 0.4 + edge * 0.5 + letter * 0.6 * upper + trace * 0.15, 0.0, 1.0);
    outColor = vec4(colour, alpha);
  }
}
`;

export const TRAY_VERTEX = /* glsl */ `#version 300 es
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
uniform mat4 uViewProjection;
uniform vec3 uTraySize;
uniform vec3 uTrayCentre;
out vec3 vWorld;
out vec3 vNormal;
void main() {
  vec3 world = aPosition * uTraySize + uTrayCentre;
  vWorld = world;
  vNormal = normalize(aNormal / uTraySize);
  gl_Position = uViewProjection * vec4(world, 1.0);
}
`;

export const TRAY_FRAGMENT = /* glsl */ `#version 300 es
precision highp float;
in vec3 vWorld;
in vec3 vNormal;
uniform vec3 uEye;
uniform vec3 uKeyLight;
uniform float uLook;
uniform vec3 uTray;
uniform vec3 uWell;
uniform vec3 uEdge;
uniform float uCells;
uniform float uPitch;
uniform float uCube;
uniform float uTrayHalf;
uniform float uTime;
out vec4 outColor;
${NOISE}
float roundedBox(vec2 p, vec2 half_, float radius) {
  vec2 q = abs(p) - half_ + radius;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
}
void main() {
  vec3 n = normalize(vNormal);
  vec3 v = normalize(uEye - vWorld);
  float half_ = uCells * uPitch * 0.5;
  float halfGrid_ = uTrayHalf;
  vec2 grid = (vWorld.xz + half_) / uPitch;
  vec2 cell = clamp(floor(grid), 0.0, uCells - 1.0);
  vec2 local = vWorld.xz + half_ - (cell + 0.5) * uPitch;
  float well = roundedBox(local, vec2(uCube * 0.5 + 0.05), 0.2);
  float top = smoothstep(0.6, 0.95, n.y);
  if (uLook < 0.5) {
    float grain = fbm(vWorld.xz * 9.0) * 0.06 - 0.03;
    vec3 surface = mix(uTray, uWell, (1.0 - smoothstep(-0.03, 0.03, well)) * 0.9) + grain;
    // Each well is pressed into the felt: a shaded inner lip and a lit outer rim.
    surface -= smoothstep(0.06, 0.0, abs(well + 0.02)) * 0.05;
    surface += smoothstep(0.05, 0.0, abs(well - 0.05)) * 0.04;
    // A lit bevel round the tray's top edge.
    float border = halfGrid_ - max(abs(vWorld.x), abs(vWorld.z));
    surface += smoothstep(0.08, 0.0, border) * 0.06;
    vec3 colour = mix(uEdge, surface, top);
    float diffuse = max(dot(n, normalize(uKeyLight)), 0.0);
    colour *= 0.62 + diffuse * 0.42;
    colour += pow(1.0 - max(dot(n, v), 0.0), 5.0) * 0.12;
    outColor = vec4(colour, 1.0);
  } else {
    vec3 colour = mix(uTray * 0.7, uTray, top);
    float line = smoothstep(0.035, 0.0, abs(well - 0.02)) * top;
    float pulse = 0.55 + 0.25 * sin(uTime * 0.8 + (cell.x + cell.y) * 0.7);
    colour += uEdge * line * 0.32 * pulse;
    colour += mix(uWell, uEdge, 0.08) * (1.0 - smoothstep(-0.03, 0.03, well)) * 0.5 * top;
    colour += uEdge * pow(1.0 - max(dot(n, v), 0.0), 3.0) * 0.55;
    colour += uEdge * (1.0 - top) * 0.12;
    outColor = vec4(colour, 1.0);
  }
}
`;

export const SHADOW_VERTEX = /* glsl */ `#version 300 es
layout(location = 0) in vec2 aCorner;
layout(location = 1) in vec4 aPlacement;
layout(location = 2) in vec4 aColour;
uniform mat4 uViewProjection;
uniform float uPlaneY;
out vec2 vLocal;
out vec2 vHalf;
out vec4 vColour;
out float vSoftness;
void main() {
  vec2 halfSize = vec2(aPlacement.z);
  float softness = aPlacement.w;
  vec2 extent = halfSize + softness;
  vLocal = aCorner * extent;
  vHalf = halfSize;
  vColour = aColour;
  vSoftness = softness;
  vec3 world = vec3(aPlacement.x + vLocal.x, uPlaneY, aPlacement.y + vLocal.y);
  gl_Position = uViewProjection * vec4(world, 1.0);
}
`;

export const SHADOW_FRAGMENT = /* glsl */ `#version 300 es
precision highp float;
in vec2 vLocal;
in vec2 vHalf;
in vec4 vColour;
in float vSoftness;
out vec4 outColor;
void main() {
  vec2 q = abs(vLocal) - vHalf + 0.18;
  float distance_ = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 0.18;
  float shade = 1.0 - smoothstep(-vSoftness, vSoftness, distance_);
  outColor = vec4(vColour.rgb, vColour.a * shade);
}
`;
