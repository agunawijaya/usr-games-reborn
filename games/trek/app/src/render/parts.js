// trek/procedural-web — reusable ship parts: materials, engines, windows,
// running lights and additive glow billboards.

import * as THREE from 'three';
import { hullSkin } from './hulltex.js';
import { NOISE } from './glsl.js';

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------

/** PBR hull material over a faction skin. `tint` multiplies the albedo. */
export function hullMaterial(faction, {
  tint = 0xffffff, rough = 1, metal = 1, envI = 0.9, flat = true,
  glow = 0, glowColor = 0xff5020, normalScale = 0.7, anisotropy = 4,
} = {}) {
  const skin = hullSkin(faction, anisotropy);
  const m = new THREE.MeshStandardMaterial({
    color: tint, map: skin.map,
    roughness: rough, metalness: metal, roughnessMap: skin.roughMetal, metalnessMap: skin.roughMetal,
    normalMap: skin.normal, normalScale: new THREE.Vector2(normalScale, normalScale),
    envMapIntensity: envI, flatShading: flat,
  });
  if (glow > 0 && skin.hasGlow) {
    m.emissive = new THREE.Color(glowColor);
    m.emissiveMap = skin.emissive;
    m.emissiveIntensity = glow;
  }
  m.userData.baseEmissive = m.emissive.clone();
  m.userData.baseEmissiveIntensity = m.emissiveIntensity;
  return m;
}

/** Unlit HDR colour (windows, emitters, engine throats). */
export function emissiveMaterial(color, intensity = 3) {
  const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity) });
  m.toneMapped = false;
  return m;
}

// ---------------------------------------------------------------------------
// Glow billboards
// ---------------------------------------------------------------------------

const GLOW_VERT = /* glsl */ `
uniform float uSize;
varying vec2 vUv;
void main() {
  vUv = position.xy;
  float s = length(modelMatrix[0].xyz);
  vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  mv.xy += position.xy * uSize * s;
  gl_Position = projectionMatrix * mv;
}
`;
const GLOW_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uIntensity, uCore, uFalloff;
varying vec2 vUv;
void main() {
  float r = length(vUv);
  if (r > 1.0) discard;
  float g = exp(-r * r * uFalloff) - exp(-uFalloff);
  float core = exp(-r * r * 60.0) * uCore;
  gl_FragColor = vec4(uColor * (g + core) * uIntensity, 1.0);
}
`;
const quadGeo = new THREE.PlaneGeometry(2, 2);
quadGeo.userData.shared = true;

/** Camera-facing additive glow (size = world radius). */
export function glowSprite(color, size = 0.2, intensity = 2, { core = 1.5, falloff = 6, depthTest = true } = {}) {
  const mat = new THREE.ShaderMaterial({
    vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG,
    uniforms: {
      uColor: { value: new THREE.Color(color) }, uSize: { value: size },
      uIntensity: { value: intensity }, uCore: { value: core }, uFalloff: { value: falloff },
    },
    blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, depthTest,
  });
  const m = new THREE.Mesh(quadGeo, mat);
  m.frustumCulled = false;
  m.renderOrder = 10;
  return m;
}

// ---------------------------------------------------------------------------
// Engines
// ---------------------------------------------------------------------------

const PLUME_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const PLUME_FRAG = NOISE + /* glsl */ `
uniform vec3 uColor;
uniform float uTime, uIntensity, uSeed, uThrottle;
varying vec2 vUv;
void main() {
  // Clamp: with MSAA, varyings are evaluated at the pixel centre, which can
  // lie just outside the triangle, and pow() of a negative number is NaN.
  float along = clamp(vUv.x, 0.0, 1.0);     // 0 at the nozzle, 1 at the tail
  float across = clamp(abs(vUv.y - 0.5) * 2.0, 0.0, 1.0);
  float len = mix(0.35, 1.0, uThrottle);
  if (along > len) discard;
  float a = along / len;
  float width = mix(0.9, 0.08, pow(a, 0.7));
  float body = exp(-pow(across / width, 2.0) * 3.0);
  float flick = 0.75 + 0.25 * vnoise(vec2(along * 9.0 - uTime * 26.0, uSeed));
  float shock = 0.7 + 0.3 * sin(along * 40.0 - uTime * 30.0);
  float fade = pow(1.0 - a, 1.6);
  vec3 c = mix(uColor, vec3(1.0), exp(-a * 7.0) * 0.8);
  gl_FragColor = vec4(c * body * fade * flick * shock * uIntensity, 1.0);
}
`;

/**
 * Engine at `pos` (local), exhaust towards −X.
 * @returns { group, update(t, throttle), setBoost(k) }
 */
export function engine({ pos, radius = 0.08, color = 0x80c0ff, intensity = 6, plumeLength = 0.6, seed = 0, bellMat = null, bellGeo = null }) {
  const group = new THREE.Group();
  group.position.copy(pos);
  const HIDE = (globalThis.__labHide || '');
  if (bellGeo && bellMat && !HIDE.includes('bell')) {
    const b = new THREE.Mesh(bellGeo, bellMat);
    group.add(b);
  }
  // Hot throat disc facing aft.
  const throat = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.82, 20), emissiveMaterial(color, intensity * 0.9));
  throat.rotation.y = -Math.PI / 2;
  throat.position.x = 0.004;
  if (!HIDE.includes('throat')) group.add(throat);
  // Plume: two crossed quads so it reads from above and from the side.
  const plumeMat = new THREE.ShaderMaterial({
    vertexShader: PLUME_VERT, fragmentShader: PLUME_FRAG,
    uniforms: {
      uColor: { value: new THREE.Color(color) }, uTime: { value: 0 }, uIntensity: { value: intensity * 0.55 },
      uSeed: { value: seed * 13.1 }, uThrottle: { value: 0.6 },
    },
    blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  const plumeGeo = new THREE.PlaneGeometry(plumeLength, radius * 2.6);
  plumeGeo.translate(-plumeLength / 2, 0, 0);
  // uv.x must run 0 at the nozzle → 1 at the tail
  const uv = plumeGeo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
  const p1 = new THREE.Mesh(plumeGeo, plumeMat);
  p1.rotation.x = -Math.PI / 2;
  const p2 = new THREE.Mesh(plumeGeo, plumeMat);
  if (!HIDE.includes('p1')) group.add(p1);
  if (!HIDE.includes('p2')) group.add(p2);
  p1.renderOrder = p2.renderOrder = 9;
  const glow = glowSprite(color, radius * 2.6, intensity * 0.2, { core: 2.0, falloff: 5 });
  glow.position.x = -radius * 0.4;
  if (!HIDE.includes('glow')) group.add(glow);
  let boost = 0;
  return {
    group,
    update(t, throttle = 0.6) {
      const th = Math.min(1, throttle + boost);
      plumeMat.uniforms.uTime.value = t;
      plumeMat.uniforms.uThrottle.value = th;
      glow.material.uniforms.uIntensity.value = intensity * (0.12 + th * 0.2) * (0.94 + 0.06 * Math.sin(t * 37 + seed));
    },
    setBoost(k) { boost = k; },
  };
}

// ---------------------------------------------------------------------------
// Windows — tiny emissive quads laid on the hull surface, instanced.
// ---------------------------------------------------------------------------

const winGeo = new THREE.PlaneGeometry(1, 1);
winGeo.userData.shared = true;

/**
 * @param spots [{ position, normal, size: [len, h], color }] in ship space
 */
export function windowArray(spots, intensity = 3.2) {
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(intensity) });
  mat.toneMapped = false;
  mat.side = THREE.DoubleSide;
  const mesh = new THREE.InstancedMesh(winGeo, mat, Math.max(1, spots.length));
  const m = new THREE.Matrix4(), t = new THREE.Vector3(), b = new THREE.Vector3();
  spots.forEach((s, i) => {
    const n = s.normal.clone().normalize();
    t.set(1, 0, 0).addScaledVector(n, -n.x);
    if (t.lengthSq() < 1e-6) t.set(0, 0, 1);
    t.normalize();
    b.crossVectors(n, t).normalize();
    const p = s.position.clone().addScaledVector(n, 0.003);
    m.makeBasis(t.clone().multiplyScalar(s.size[0]), b.clone().multiplyScalar(s.size[1]), n);
    m.setPosition(p);
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, new THREE.Color(s.color));
  });
  mesh.count = spots.length;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

// ---------------------------------------------------------------------------
// Running lights — blinking glow sprites.
// ---------------------------------------------------------------------------

export function runningLights(specs) {
  const group = new THREE.Group();
  const items = specs.map(s => {
    const g = glowSprite(s.color, s.size ?? 0.05, s.intensity ?? 3, { core: 3, falloff: 8 });
    g.position.copy(s.pos);
    group.add(g);
    return { g, s };
  });
  return {
    group,
    update(t) {
      for (const { g, s } of items) {
        const period = s.period ?? 0;
        let k = 1;
        if (period > 0) {
          const ph = ((t + (s.phase ?? 0)) % period) / period;
          k = ph < (s.duty ?? 0.12) ? 1 : 0.05;
        }
        g.material.uniforms.uIntensity.value = (s.intensity ?? 3) * k;
      }
    },
  };
}
