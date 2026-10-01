// trek/procedural-web — in-sector stars (the engine's navigation hazards).
//
// A star is a sphere shaded with animated granulation, sunspots and
// Eddington limb darkening (the disc dims and reddens towards its edge,
// the single cue that makes it read as a ball of gas instead of a glowing
// disc), plus a camera-facing corona with slowly drifting streamers. Its
// light is a real point light on the ships nearby, and the post pass draws
// a lens flare from its screen position. Spectral class — and so colour —
// comes from a hash of the quadrant and sector.

import * as THREE from 'three';
import { NOISE } from './glsl.js';
import { hashInts, mulberry32 } from './rng.js';

export const SPECTRAL = [
  { cls: 'G', color: [1.0, 0.82, 0.52], corona: [1.0, 0.78, 0.45], weight: 0.34 },
  { cls: 'K', color: [1.0, 0.6, 0.3], corona: [1.0, 0.55, 0.25], weight: 0.24 },
  { cls: 'M', color: [1.0, 0.42, 0.2], corona: [1.0, 0.38, 0.18], weight: 0.14 },
  { cls: 'F', color: [1.0, 0.95, 0.84], corona: [0.95, 0.9, 0.8], weight: 0.16 },
  { cls: 'B', color: [0.66, 0.8, 1.0], corona: [0.55, 0.72, 1.0], weight: 0.12 },
];

export function spectralFor(qx, qy, sx, sy) {
  const r = mulberry32(hashInts(qx, qy, sx, sy, 0x57A2))();
  let acc = 0;
  for (const s of SPECTRAL) { acc += s.weight; if (r < acc) return s; }
  return SPECTRAL[0];
}

const BODY_VERT = /* glsl */ `
varying vec3 vObjN;
varying vec3 vNormalV;
varying vec3 vViewPos;
void main() {
  vObjN = normalize(position);
  vNormalV = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vViewPos = mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`;
const BODY_FRAG = NOISE + /* glsl */ `
uniform vec3 uColor;
uniform float uTime, uIntensity, uSeed, uFlare;
varying vec3 vObjN;
varying vec3 vNormalV;
varying vec3 vViewPos;
void main() {
  float mu = clamp(dot(normalize(vNormalV), normalize(-vViewPos)), 0.0, 1.0);
  // Eddington-style limb darkening, slightly redder at the limb.
  float limb = 1.0 - 0.6 * (1.0 - pow(mu, 0.75));
  vec3 p = vObjN * 5.0 + vec3(uSeed, uSeed * 0.3, 0.0);
  float gran = vnoise3(p * 1.6 + vec3(0.0, uTime * 0.25, 0.0)) * 0.55 + vnoise3(p * 3.7 - vec3(uTime * 0.4)) * 0.45;
  float cells = 0.82 + 0.3 * gran;
  float spots = smoothstep(0.66, 0.74, fbm3(vObjN * 2.3 + uSeed, 3) * 0.5 + 0.5);
  vec3 c = uColor * limb * cells * (1.0 - spots * 0.55);
  c = mix(c * vec3(1.0, 0.8, 0.65), c, mu);
  c *= uIntensity * (1.0 + uFlare * 2.5);
  gl_FragColor = vec4(c, 1.0);
}
`;

const CORONA_VERT = /* glsl */ `
uniform float uSize;
varying vec2 vUv;
void main() {
  vUv = position.xy;
  vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  mv.xy += position.xy * uSize;
  gl_Position = projectionMatrix * mv;
}
`;
const CORONA_FRAG = NOISE + /* glsl */ `
uniform vec3 uColor;
uniform float uTime, uIntensity, uSeed, uBody, uFlare;
varying vec2 vUv;
void main() {
  float r = length(vUv);
  if (r > 1.0) discard;
  float rb = r / uBody;                 // radius in units of the star's radius
  float ang = atan(vUv.y, vUv.x);
  float glow = exp(-max(rb - 1.0, 0.0) * 1.35) * 0.9 + exp(-max(rb - 1.0, 0.0) * 0.35) * 0.12;
  vec2 pa = vec2(cos(ang), sin(ang));
  float streak = fbm2(pa * 3.0 + vec2(uSeed, 0.0) + vec2(0.0, rb * 0.6 - uTime * 0.06));
  float rays = pow(streak, 3.5) * 3.0 * exp(-max(rb - 1.0, 0.0) * 0.8);
  float edge = smoothstep(1.0, 0.7, r);
  float inside = smoothstep(0.92, 1.05, rb);   // do not paint over the disc
  vec3 c = uColor * (glow + rays) * uIntensity * edge * inside * (1.0 + uFlare * 3.0);
  gl_FragColor = vec4(c, 1.0);
}
`;

const bodyGeo = new THREE.SphereGeometry(1, 48, 32);
const quad = new THREE.PlaneGeometry(2, 2);

export class Star {
  /**
   * @param spec  entry from SPECTRAL
   * @param seed  numeric seed for surface detail
   * @param radius star radius in cells
   */
  constructor(spec, seed, radius = 0.22) {
    this.spec = spec;
    this.radius = radius;
    this.group = new THREE.Group();
    const color = new THREE.Color(...spec.color);
    this.bodyMat = new THREE.ShaderMaterial({
      vertexShader: BODY_VERT, fragmentShader: BODY_FRAG,
      uniforms: { uColor: { value: color }, uTime: { value: 0 }, uIntensity: { value: 5.0 }, uSeed: { value: seed % 100 }, uFlare: { value: 0 } },
    });
    this.body = new THREE.Mesh(bodyGeo, this.bodyMat);
    this.body.scale.setScalar(radius);
    this.coronaMat = new THREE.ShaderMaterial({
      vertexShader: CORONA_VERT, fragmentShader: CORONA_FRAG,
      uniforms: {
        uColor: { value: new THREE.Color(...spec.corona) }, uTime: { value: 0 }, uIntensity: { value: 1.6 },
        uSeed: { value: seed % 50 }, uSize: { value: radius * 5.0 }, uBody: { value: 1 / 5.0 }, uFlare: { value: 0 },
      },
      blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
    });
    this.corona = new THREE.Mesh(quad, this.coronaMat);
    this.corona.frustumCulled = false;
    this.corona.renderOrder = 8;
    this.group.add(this.body, this.corona);
    this.flare = 0;
  }

  /** Torpedo impact: the star flares briefly. */
  kick(k = 1) { this.flare = Math.min(2, this.flare + k); }

  update(t, dt) {
    this.flare = Math.max(0, this.flare - dt * 1.4);
    this.bodyMat.uniforms.uTime.value = t;
    this.bodyMat.uniforms.uFlare.value = this.flare;
    this.coronaMat.uniforms.uTime.value = t;
    this.coronaMat.uniforms.uFlare.value = this.flare;
  }

  dispose() {
    this.bodyMat.dispose();
    this.coronaMat.dispose();
  }
}
