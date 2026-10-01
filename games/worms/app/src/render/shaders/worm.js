// Worm bodies: a camera-facing ribbon shaded as a translucent, glowing tube.
// The same vertex stream feeds two passes:
//   WORM_FS  - the body itself (HDR, premultiplied alpha)
//   LIGHT_FS - a wide, soft version of it: the light the worm casts

export const WORM_VS = /* glsl */ `#version 300 es
precision highp float;
layout(location = 0) in vec2 aCenter;   // grid units
layout(location = 1) in vec2 aNormal;
layout(location = 2) in float aSide;    // -1 / +1
layout(location = 3) in float aHalf;    // half width, cells
layout(location = 4) in float aS;       // 0 tail .. 1 head
layout(location = 5) in float aArc;     // cells behind the head
uniform vec2 uRes;                      // target px
uniform vec2 uOrigin;                   // grid top-left, canvas px (y down)
uniform float uCell;
uniform vec2 uCanvas;                   // canvas px (targets may be smaller)
uniform float uWidthMul;                // 1 body, >1 light
uniform float uWidthAdd;                // extra half width, cells
uniform float uPointSize;               // light pass draws points
out float vSide;
out float vS;
out float vArc;
out vec2 vGrid;
out vec2 vNrm;
void main() {
  float hw = aHalf * uWidthMul + uWidthAdd * step(0.001, aHalf);
  vec2 g = aCenter + aNormal * aSide * hw;
  vec2 px = uOrigin + g * uCell;                              // canvas px, y down
  vec2 ndc = vec2(px.x / uCanvas.x, 1.0 - px.y / uCanvas.y) * 2.0 - 1.0;
  gl_Position = vec4(ndc, 0.0, 1.0);
  vSide = aSide;
  vS = aS;
  vArc = aArc;
  vGrid = g;
  vNrm = aNormal;
  gl_PointSize = uPointSize;
}`;

export const WORM_FS = /* glsl */ `#version 300 es
precision highp float;
in float vSide;
in float vS;
in float vArc;
in vec2 vGrid;
in vec2 vNrm;
uniform float uTime;
uniform vec3 uCoreC;
uniform vec3 uRimC;
uniform int uPattern;
uniform float uRings;
uniform float uPulse;
uniform float uPhase;
uniform float uGlow;              // global emission scale
uniform highp usampler2D uCells;  // r = ref count
uniform sampler2D uLight;         // light from all worms (for cross-illumination)
uniform vec2 uGrid;
uniform vec2 uCanvas;
out vec4 outColor;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * .1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  float v = vSide;                                  // -1..1 across the body
  float a = abs(v);
  float cover = smoothstep(1.0, 0.82, a);           // soft membrane edge
  if (cover <= 0.0) discard;
  float z = sqrt(max(1.0 - a * a, 0.0));            // tube depth

  // a cylinder normal in screen space (y down), for the wet sheen
  vec3 N = normalize(vec3(vNrm * v, z));
  vec3 Ld = normalize(vec3(-0.45, -0.6, 0.66));     // light from the upper left
  float spec = pow(max(dot(reflect(-Ld, N), vec3(0.0, 0.0, 1.0)), 0.0), 28.0);

  // segments (annelid rings): grooves between bulging segments
  float segPh = vArc * uRings;
  float segF = fract(segPh);
  float groove = smoothstep(0.16, 0.0, min(segF, 1.0 - segF));

  // a pulse of light running down the gut, head to tail
  float pulse = 0.5 + 0.5 * sin(vArc * 1.3 - uTime * uPulse * 4.0 + uPhase);
  pulse = pow(pulse, 4.0);

  vec3 core = uCoreC;
  vec3 rim = uRimC;
  float stripe = 1.0;
  float photo = 0.0;
  // paired photophores on every segment, both flanks
  float pp = smoothstep(0.17, 0.05, length(vec2((segF - 0.5) * 1.2, a - 0.58)));
  if (uPattern == 0) {             // O  lantern: steady paired lanterns
    photo = pp * 1.4;
  } else if (uPattern == 1) {      // *  starlight: lanterns that twinkle
    float id = floor(segPh);
    float tw = 0.5 + 0.5 * sin(uTime * (2.5 + 5.0 * hash12(vec2(id, sign(v)))) + id * 7.0);
    photo = pp * tw * tw * 3.2;
  } else if (uPattern == 2) {      // #  banded: dark saddles every other segment
    stripe = mix(0.35, 1.0, step(0.5, fract(segPh * 0.5)));
  } else if (uPattern == 3) {      // $  gilded: bristle glints along the flanks
    photo = smoothstep(0.1, 0.0, abs(a - 0.86)) * (0.5 + 0.5 * sin(vArc * 14.0 + uTime * 2.0)) * 1.6;
  } else if (uPattern == 4) {      // %  twin-lamp: a different colour each side
    core = v < 0.0 ? uCoreC : uRimC;
    rim = v < 0.0 ? uRimC : uCoreC;
  } else if (uPattern == 5) {      // 0  halo: every groove is a ring of light
    photo = groove * 1.6;
  } else if (uPattern == 6) {      // @  spiral: a stripe winding round the body
    stripe = mix(0.3, 1.0, smoothstep(0.35, 0.6, abs(fract(vArc * 0.7 + v * 0.3) - 0.5) * 2.0));
  } else {                         // ~  glass eel: clear body, one bright spine
    photo = smoothstep(0.16, 0.0, a) * 1.1;
    stripe = 0.6;
  }

  // head: a brighter lamp with two light organs
  float head = smoothstep(1.4, 0.0, vArc);
  float eyes = smoothstep(0.15, 0.0, length(vec2(vArc - 0.38, a - 0.42))) * 3.0;
  float tail = smoothstep(0.0, 0.3, vS);

  // translucency: grazing edges look through more tissue and glow most;
  // the middle is a darker channel (the gut) carrying the pulse
  float fres = pow(1.0 - z, 1.8);
  float gut = smoothstep(0.32, 0.0, a);
  vec3 emit = rim * fres * 1.25 * stripe;
  emit += core * z * (0.10 + 0.14 * stripe) * (1.0 - gut * 0.6);
  emit += mix(core, vec3(1.0), 0.25) * gut * pulse * 1.3;
  emit *= 1.0 - groove * 0.45;
  emit += core * photo;
  emit += mix(core, vec3(1.0), 0.6) * eyes * head;
  emit *= (0.3 + 0.7 * tail) * (1.0 + head * 0.7);

  // overlapping worms (ref count >= 2) flare where they cross
  ivec2 cell = ivec2(floor(vGrid));
  uint refc = texelFetch(uCells, clamp(cell, ivec2(0), ivec2(uGrid) - 1), 0).r;
  emit *= refc >= 2u ? 1.7 : 1.0;
  emit *= uGlow;

  // lit by the other worms: a wet sheen that picks up their colour
  vec3 Lw = texture(uLight, gl_FragCoord.xy / uCanvas).rgb;
  vec3 sheen = (Lw * 3.0 + vec3(0.04, 0.07, 0.08)) * spec * 1.6;

  float alpha = cover * mix(0.55, 0.92, fres) * (0.5 + 0.5 * tail);
  vec3 tissue = core * 0.015 * z;
  outColor = vec4((emit + sheen) * cover + tissue * alpha, alpha);
}`;

export const LIGHT_FS = /* glsl */ `#version 300 es
precision highp float;
in float vSide;
in float vS;
in float vArc;
in vec2 vGrid;
in vec2 vNrm;
uniform vec3 uCoreC;
uniform vec3 uRimC;
uniform float uTime;
uniform float uPulse;
uniform float uPhase;
uniform float uDensity;       // compensates for samples per cell
uniform float uSpeciesLight;
out vec4 outColor;
void main() {
  // drawn as points along the body: a round pool of light per sample
  vec2 q = gl_PointCoord - 0.5;
  float r2 = dot(q, q) * 4.0;
  float fall = exp(-r2 * 3.0) * smoothstep(1.0, 0.7, r2);
  float pulse = 0.75 + 0.25 * sin(vArc * 1.6 - uTime * uPulse * 4.0 + uPhase);
  float head = 1.0 + 1.2 * smoothstep(1.5, 0.0, vArc);
  float tail = smoothstep(0.0, 0.4, vS);
  vec3 c = mix(uCoreC, uRimC, 0.35);
  outColor = vec4(c * fall * pulse * head * tail * uDensity * uSpeciesLight, 0.0);
}`;

// -t: a luminous slime trail. aS carries the age fraction (0 new .. 1 gone).
export const TRAIL_FS = /* glsl */ `#version 300 es
precision highp float;
in float vSide;
in float vS;
uniform vec3 uCoreC;
uniform float uGain;
out vec4 outColor;
void main() {
  float across = exp(-vSide * vSide * 3.0);
  float age = vS;
  float fade = pow(1.0 - age, 1.6);
  // fresh slime glows almost white at the core, cooling to the species colour
  vec3 c = mix(uCoreC, mix(uCoreC, vec3(1.0), 0.5), across * (1.0 - age));
  outColor = vec4(c * across * fade * uGain, 0.0);
}`;
