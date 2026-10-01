// Gerstner water for the sea, the lagoon, the thermal pools and flooded
// caves. Depth per vertex (sampled from the terrain) drives the shallow
// colour and the shore foam; the sun (or moon) gives glitter and a glade.

import * as THREE from 'three';
import { NOISE } from './glsl.js';

const VERT = /* glsl */ `
#include <fog_pars_vertex>
attribute float depth;
uniform float uTime; uniform float uCalm; uniform float uScale;
varying vec3 vWP; varying vec3 vN; varying float vDepth; varying float vCrest;
vec3 gerstner(vec3 p, vec2 dir, float steep, float len, float speed, inout vec3 tang, inout vec3 bin) {
  float k = 6.2831 / len; float c = sqrt(9.8 / k) * speed; vec2 d = normalize(dir);
  float f = k * (dot(d, p.xz) - c * uTime); float a = steep / k;
  tang += vec3(-d.x * d.x * steep * sin(f), d.x * steep * cos(f), -d.x * d.y * steep * sin(f));
  bin += vec3(-d.x * d.y * steep * sin(f), d.y * steep * cos(f), -d.y * d.y * steep * sin(f));
  return vec3(d.x * a * cos(f), a * sin(f), d.y * a * cos(f));
}
void main() {
  vec3 p = (modelMatrix * vec4(position, 1.0)).xyz;
  vDepth = depth;
  float amp = uCalm * clamp(depth * 0.6 + 0.25, 0.25, 1.0);
  vec3 tang = vec3(1, 0, 0); vec3 bin = vec3(0, 0, 1);
  vec3 off = vec3(0);
  off += gerstner(p, vec2(1.0, 0.35), 0.16 * amp, 16.0 * uScale, 1.0, tang, bin);
  off += gerstner(p, vec2(0.7, 1.0), 0.11 * amp, 9.0 * uScale, 1.0, tang, bin);
  off += gerstner(p, vec2(-0.4, 1.0), 0.07 * amp, 5.3 * uScale, 1.0, tang, bin);
  off += gerstner(p, vec2(1.0, -0.6), 0.05 * amp, 3.1 * uScale, 1.0, tang, bin);
  p += off;
  vCrest = off.y;
  vWP = p;
  vN = normalize(cross(bin, tang));
  vec4 mvPosition = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const FRAG = /* glsl */ `
#include <fog_pars_fragment>
uniform float uTime; uniform vec3 uSun; uniform vec3 uSunCol; uniform vec3 uSkyTop; uniform vec3 uSkyHor;
uniform vec3 uDeep; uniform vec3 uShallow; uniform float uNight; uniform float uFoam; uniform float uGlow; uniform vec3 uGlowCol;
uniform float uOpacity; uniform float uGlowNear;
varying vec3 vWP; varying vec3 vN; varying float vDepth; varying float vCrest;
${NOISE}
void main() {
  vec3 V = normalize(cameraPosition - vWP);
  // fine detail fades with distance: from the air the ripples and foam cells
  // are sub-pixel and would alias into white noise
  float camD = distance(cameraPosition, vWP);
  float farK = smoothstep(25.0, 140.0, camD);
  vec3 N = normalize(vN + vec3(bs_noise2(vWP.xz * 1.7 + uTime * 0.6) - 0.5, 0.0, bs_noise2(vWP.zx * 1.9 - uTime * 0.5) - 0.5) * 0.12 * (1.0 - farK));
  float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  vec3 R = reflect(-V, N);
  vec3 sky = mix(uSkyHor, uSkyTop, clamp(R.y, 0.0, 1.0));
  float shallow = exp(-max(vDepth, 0.0) * 0.45);
  // the water body is unlit colour: darken it at night (moonlight is the reflection)
  vec3 body = mix(uDeep, uShallow, shallow) * (1.0 - uNight * 0.92);
  // sand showing through the shallows
  body = mix(body, vec3(0.75, 0.68, 0.5) * (1.0 - uNight * 0.85), smoothstep(0.35, 0.0, vDepth) * 0.55);
  vec3 col = mix(body, sky, fres);
  // sun/moon glade: tight up close, broad far away (many unresolved ripples)
  float ex = mix(uNight > 0.5 ? 180.0 : 600.0, uNight > 0.5 ? 28.0 : 90.0, farK);
  float sp = pow(max(dot(R, normalize(uSun)), 0.0), ex) * mix(1.0, 0.3, farK);
  col += uSunCol * sp * (uNight > 0.5 ? 2.5 : 8.0);
  // glitter
  // (a small soft point inside each lucky cell; whole cells read as tiles)
  vec2 gc = vWP.xz * 9.0;
  float gd = length(fract(gc) - 0.5);
  float gl = step(0.985, bs_hash12(floor(gc) + floor(uTime * 8.0))) * smoothstep(0.22, 0.04, gd) * pow(max(dot(R, normalize(uSun)), 0.0), 20.0) * smoothstep(70.0, 10.0, camD);
  col += uSunCol * gl * 2.0;
  // shore foam and crest foam
  float n = mix(bs_noise2(vWP.xz * 2.3 + vec2(uTime * 0.3, 0.0)) * bs_noise2(vWP.xz * 5.1 - uTime * 0.2), 0.22, farK);
  float shore = smoothstep(0.6, 0.0, vDepth + vCrest * 0.8) * smoothstep(0.08, 0.45, n + 0.2);
  float crest = smoothstep(0.18, 0.32, vCrest) * smoothstep(0.2, 0.5, n);
  col = mix(col, vec3(0.92, 0.96, 1.0) * (1.0 - 0.9 * uNight) + uSunCol * 0.05, clamp((shore + crest) * uFoam, 0.0, 1.0));
  // bioluminescence / emissive glow (thermal pools at night, the goddess's water)
  // (uGlowNear > 0: a light carried by the viewer, falling off with distance)
  float near = uGlowNear > 0.0 ? exp(-distance(cameraPosition.xz, vWP.xz) * uGlowNear) : 1.0;
  col += uGlowCol * uGlow * (0.4 + 0.6 * bs_noise2(vWP.xz * 3.0 + uTime * 0.4)) * shallow * near;
  gl_FragColor = vec4(col, uOpacity);
  #include <fog_fragment>
}`;

/**
 * @param {object} o { size, res, level, depthAt(x,z), deep, shallow, calm, scale, foam, glow, glowCol, glowNear, opacity }
 */
export function makeWater(o = {}) {
  const size = o.size ?? 400;
  const res = o.quality === 'low' ? Math.round((o.res ?? 160) * 0.5) : (o.res ?? 160);
  const g = new THREE.PlaneGeometry(size, size, res, res);
  g.rotateX(-Math.PI / 2);
  if (o.offset) g.translate(...o.offset);
  const pos = g.attributes.position;
  const depth = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) depth[i] = o.depthAt ? o.depthAt(pos.getX(i), pos.getZ(i)) : 20;
  g.setAttribute('depth', new THREE.BufferAttribute(depth, 1));
  const m = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, fog: true, transparent: (o.opacity ?? 1) < 1,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uTime: { value: 0 }, uCalm: { value: o.calm ?? 1 }, uScale: { value: o.scale ?? 1 },
      uSun: { value: new THREE.Vector3(0, 1, -1) }, uSunCol: { value: new THREE.Color(1, 0.95, 0.85) },
      uSkyTop: { value: new THREE.Color(0.2, 0.4, 0.8) }, uSkyHor: { value: new THREE.Color(0.7, 0.8, 0.9) },
      uDeep: { value: new THREE.Color(o.deep ?? 0x03303a) }, uShallow: { value: new THREE.Color(o.shallow ?? 0x2fb0a8) },
      uNight: { value: 0 }, uFoam: { value: o.foam ?? 1 }, uGlow: { value: o.glow ?? 0 }, uGlowCol: { value: new THREE.Color(o.glowCol ?? 0x40ffd0) },
      uOpacity: { value: o.opacity ?? 1 }, uGlowNear: { value: o.glowNear ?? 0 },
    }]),
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.position.y = o.level ?? 0;
  mesh.receiveShadow = false;
  mesh.userData.tick = (t) => { m.uniforms.uTime.value = t; };
  /** Sky/sun from the stage's celestial state. */
  mesh.userData.setSky = ({ sun, sunCol, top, horizon, night }) => {
    if (sun) m.uniforms.uSun.value.copy(sun);
    if (sunCol) m.uniforms.uSunCol.value.set(sunCol);
    if (top) m.uniforms.uSkyTop.value.set(top);
    if (horizon) m.uniforms.uSkyHor.value.set(horizon);
    m.uniforms.uNight.value = night ? 1 : 0;
  };
  return mesh;
}
