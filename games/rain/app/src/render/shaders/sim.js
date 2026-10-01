// The wave equation on the log-polar grid (port ADR-004).
//
// State texel: r = height now, g = height one step ago (millimetres).
// Verlet step:  h' = h + (h - h_prev)(1 - gamma dt) + (c dt / (s r))^2 lap(h)
// where lap is the five-point Laplacian in grid units; the conformal grid
// makes that exact up to the 1/(s r)^2 scale. Drop impulses (ADR-003's
// stage table) are added on the first sub-step of a frame.
export const MAX_IMPULSES = 96;

export const SIM_FS = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uState;
uniform vec2 uSize;       // Nu, Nv
uniform float uCell;      // radians per texel (= log-distance per texel)
uniform float uR0;
uniform float uTheta0;
uniform float uDt;
uniform float uC;
uniform float uGamma;     // velocity damping, 1/s
uniform float uSponge;    // texels
uniform int uCount;
uniform vec4 uImp[${MAX_IMPULSES}];   // x, z, sigma, amplitude
uniform float uRing[${MAX_IMPULSES}]; // ring radius (0 = a bump)
out vec4 outState;

float h(ivec2 p) {
  p = clamp(p, ivec2(0), ivec2(uSize) - 1);
  return texelFetch(uState, p, 0).r;
}

void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec2 s = texelFetch(uState, p, 0).rg;
  float r = uR0 * exp((float(p.y) + 0.5) * uCell);
  float k = uC * uDt / (uCell * r);
  float lap = h(p + ivec2(1, 0)) + h(p - ivec2(1, 0)) + h(p + ivec2(0, 1)) + h(p - ivec2(0, 1)) - 4.0 * s.r;
  float hn = s.r + (s.r - s.g) * (1.0 - uGamma * uDt) + k * k * lap;

  // absorbing border: a sponge that eats waves before they can reflect
  vec2 q = vec2(p);
  float e = min(min(q.x, uSize.x - 1.0 - q.x), min(q.y, uSize.y - 1.0 - q.y));
  float sp = clamp(e / uSponge, 0.0, 1.0);
  float keep = mix(0.86, 1.0, sp * sp * (3.0 - 2.0 * sp));
  hn *= keep;
  float hp = s.r * keep;

  if (uCount > 0) {
    float az = uTheta0 + (q.x + 0.5) * uCell;
    vec2 w = r * vec2(sin(az), cos(az));
    for (int i = 0; i < ${MAX_IMPULSES}; i++) {
      if (i >= uCount) break;
      vec4 a = uImp[i];
      float d = length(w - a.xy);
      float x = (d - uRing[i]) / a.z;
      if (abs(x) < 4.0) hn += a.w * exp(-x * x);
    }
  }
  outState = vec4(hn, hp, 0.0, 1.0);
}
`;
