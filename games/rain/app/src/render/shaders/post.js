// Post: bloom (down/up chain) and the final composite — exposure, filmic
// tone curve, vignette, a little grain and a slow lens breathing.
import { COMMON } from './common.js';

// 13-tap downsample (Jimenez 2014), with a soft threshold on the first level
export const DOWN_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
uniform sampler2D uSrc;
uniform vec2 uTexel;
uniform float uThreshold; // < 0: no threshold
vec3 s(vec2 off) { return texture(uSrc, vUv + off * uTexel).rgb; }
void main() {
  vec3 a = s(vec2(-2, -2)), b = s(vec2(0, -2)), c = s(vec2(2, -2));
  vec3 d = s(vec2(-1, -1)), e = s(vec2(1, -1));
  vec3 f = s(vec2(-2, 0)), g = s(vec2(0, 0)), h = s(vec2(2, 0));
  vec3 i = s(vec2(-1, 1)), j = s(vec2(1, 1));
  vec3 k = s(vec2(-2, 2)), l = s(vec2(0, 2)), m = s(vec2(2, 2));
  vec3 col = (d + e + i + j) * 0.125 + g * 0.125 + (a + c + k + m) * 0.03125 + (b + f + h + l) * 0.0625;
  if (uThreshold >= 0.0) {
    float br = max(col.r, max(col.g, col.b));
    float soft = clamp(br - uThreshold + 0.5, 0.0, 1.0);
    soft = soft * soft * 0.5;
    float w = max(soft, br - uThreshold) / max(br, 1e-4);
    col *= w;
  }
  o = vec4(col, 1.0);
}
`;

// 3x3 tent upsample, added onto the next larger level by blending
export const UP_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
uniform sampler2D uSrc;
uniform vec2 uTexel;
uniform float uWeight;
void main() {
  vec3 c = vec3(0.0);
  c += texture(uSrc, vUv + vec2(-1, -1) * uTexel).rgb;
  c += texture(uSrc, vUv + vec2(0, -1) * uTexel).rgb * 2.0;
  c += texture(uSrc, vUv + vec2(1, -1) * uTexel).rgb;
  c += texture(uSrc, vUv + vec2(-1, 0) * uTexel).rgb * 2.0;
  c += texture(uSrc, vUv).rgb * 4.0;
  c += texture(uSrc, vUv + vec2(1, 0) * uTexel).rgb * 2.0;
  c += texture(uSrc, vUv + vec2(-1, 1) * uTexel).rgb;
  c += texture(uSrc, vUv + vec2(0, 1) * uTexel).rgb * 2.0;
  c += texture(uSrc, vUv + vec2(1, 1) * uTexel).rgb;
  o = vec4(c / 16.0 * uWeight, 1.0);
}
`;

export const COMPOSITE_FS = /* glsl */ `#version 300 es
precision highp float;
${COMMON}
in vec2 vUv;
out vec4 o;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform float uBloomOn;
uniform float uBloomAmt;
uniform float uExposure;
uniform float uTime;
uniform vec2 uRes;
uniform float uGrain;
uniform float uFade;   // 0..1 fade from black on start

vec3 aces(vec3 x) {
  // Narkowicz's fit of the ACES filmic curve
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

void main() {
  vec3 c = texture(uScene, vUv).rgb;
  if (uBloomOn > 0.5) c += texture(uBloom, vUv).rgb * uBloomAmt;
  c *= uExposure;
  // a cool night grade: lift blues in the shadows, keep warm lights warm
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(c, c * vec3(0.86, 0.96, 1.12), smoothstep(0.25, 0.0, lum) * 0.6);
  c = aces(c);
  vec2 q = vUv - 0.5;
  q.x *= uRes.x / uRes.y;
  c *= 1.0 - 0.42 * smoothstep(0.35, 1.05, length(q));
  c = pow(c, vec3(1.0 / 2.2));
  float g = hash12(gl_FragCoord.xy + fract(uTime * 13.7) * 311.0) - 0.5;
  c += g * uGrain;
  o = vec4(c * uFade, 1.0);
}
`;
