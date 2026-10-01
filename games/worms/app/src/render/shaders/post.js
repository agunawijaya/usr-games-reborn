// Post-processing: separable blur (light map), bloom chain, composite,
// plus marine snow particles.

export const BLUR_FS = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uSrc;
uniform vec2 uDir;        // texel step (x or y)
out vec4 outColor;
void main() {
  vec2 uv = gl_FragCoord.xy / vec2(textureSize(uSrc, 0));
  const float w[5] = float[5](0.2270270, 0.1945946, 0.1216216, 0.0540541, 0.0162162);
  vec3 c = texture(uSrc, uv).rgb * w[0];
  for (int i = 1; i < 5; i++) {
    c += texture(uSrc, uv + uDir * float(i) * 1.5).rgb * w[i];
    c += texture(uSrc, uv - uDir * float(i) * 1.5).rgb * w[i];
  }
  outColor = vec4(c, 1.0);
}`;

// Bright pass with a soft knee, from the full-resolution scene into mip 0.
export const PREFILTER_FS = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uSrc;
uniform float uThreshold;
out vec4 outColor;
void main() {
  vec2 ts = 1.0 / vec2(textureSize(uSrc, 0));
  vec2 uv = gl_FragCoord.xy * 2.0 * ts;
  vec3 c = (texture(uSrc, uv + ts * vec2(-1, -1)).rgb + texture(uSrc, uv + ts * vec2(1, -1)).rgb +
            texture(uSrc, uv + ts * vec2(-1, 1)).rgb + texture(uSrc, uv + ts * vec2(1, 1)).rgb) * 0.25;
  float br = max(c.r, max(c.g, c.b));
  float knee = uThreshold * 0.6;
  float soft = clamp(br - uThreshold + knee, 0.0, 2.0 * knee);
  soft = soft * soft / (4.0 * knee + 1e-4);
  float contrib = max(soft, br - uThreshold) / max(br, 1e-4);
  outColor = vec4(c * contrib, 1.0);
}`;

// Dual-filter downsample (centre x4 + four diagonals).
export const DOWN_FS = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uSrc;
out vec4 outColor;
void main() {
  vec2 ts = 1.0 / vec2(textureSize(uSrc, 0));
  vec2 uv = (gl_FragCoord.xy * 2.0) * ts;
  vec3 c = texture(uSrc, uv).rgb * 4.0;
  c += texture(uSrc, uv + ts * vec2(-1, -1)).rgb;
  c += texture(uSrc, uv + ts * vec2(1, -1)).rgb;
  c += texture(uSrc, uv + ts * vec2(-1, 1)).rgb;
  c += texture(uSrc, uv + ts * vec2(1, 1)).rgb;
  outColor = vec4(c / 8.0, 1.0);
}`;

// Tent upsample, blended additively onto the next larger mip.
export const UP_FS = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uSrc;
uniform float uWeight;
out vec4 outColor;
void main() {
  vec2 ts = 1.0 / vec2(textureSize(uSrc, 0));
  vec2 uv = (gl_FragCoord.xy * 0.5) * ts;
  vec3 c = texture(uSrc, uv + ts * vec2(-1, 0)).rgb * 2.0;
  c += texture(uSrc, uv + ts * vec2(1, 0)).rgb * 2.0;
  c += texture(uSrc, uv + ts * vec2(0, -1)).rgb * 2.0;
  c += texture(uSrc, uv + ts * vec2(0, 1)).rgb * 2.0;
  c += texture(uSrc, uv + ts * vec2(-1, -1)).rgb;
  c += texture(uSrc, uv + ts * vec2(1, -1)).rgb;
  c += texture(uSrc, uv + ts * vec2(-1, 1)).rgb;
  c += texture(uSrc, uv + ts * vec2(1, 1)).rgb;
  outColor = vec4(c / 12.0 * uWeight, 1.0);
}`;

export const COMPOSITE_FS = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform sampler2D uLight;
uniform vec2 uRes;
uniform float uBloomAmt;
uniform float uTime;
uniform float uExposure;
out vec4 outColor;

vec3 aces(vec3 x) {
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}
vec3 toSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * .1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec3 c = texture(uScene, uv).rgb;
  vec3 b = texture(uBloom, uv).rgb;
  vec3 l = texture(uLight, uv).rgb;
  c += b * uBloomAmt;
  c += l * 0.015;                                   // light scattering in the water column
  c *= uExposure;
  vec3 o = toSRGB(aces(c));
  // film grain + dither (breaks banding in the near-black water)
  float n = hash12(gl_FragCoord.xy + fract(uTime * 13.0) * 317.0);
  o += (n - 0.5) * (1.5 / 255.0);
  outColor = vec4(o, 1.0);
}`;

// Marine snow: slow organic debris between the camera and the floor.
export const SNOW_VS = /* glsl */ `#version 300 es
precision highp float;
layout(location = 0) in vec4 aSeed;    // x, y, depth, phase (0..1)
uniform vec2 uCanvas;
uniform float uTime;
uniform float uDpr;
uniform float uMotion;
out float vDepth;
out float vPhase;
out vec2 vUv;
void main() {
  float d = aSeed.z;                               // 0 far (near the floor) .. 1 near the camera
  float t = uTime * uMotion;
  vec2 drift = vec2(0.006 + 0.012 * d, 0.003 + 0.004 * d) * t;
  vec2 sway = vec2(sin(t * 0.4 + aSeed.w * 6.28), cos(t * 0.33 + aSeed.w * 9.0)) * 0.004 * (0.5 + d);
  vec2 p = fract(aSeed.xy + drift + sway);
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
  gl_PointSize = (0.8 + 3.2 * d * d) * uDpr;
  vDepth = d;
  vPhase = aSeed.w;
}`;

export const SNOW_FS = /* glsl */ `#version 300 es
precision highp float;
in float vDepth;
in float vPhase;
in vec2 vUv;
uniform sampler2D uLight;
uniform float uTime;
out vec4 outColor;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float r = length(q) * 2.0;
  float soft = smoothstep(1.0, 0.0, r);
  soft *= soft;
  vec3 L = texture(uLight, vUv).rgb;
  float tw = 0.7 + 0.3 * sin(uTime * (0.6 + vPhase) + vPhase * 40.0);
  vec3 c = (L * 4.0 + vec3(0.018, 0.028, 0.032)) * tw;
  // near particles are out of focus: dimmer per pixel
  c *= mix(1.0, 0.45, vDepth);
  outColor = vec4(c * soft, 0.0);
}`;
