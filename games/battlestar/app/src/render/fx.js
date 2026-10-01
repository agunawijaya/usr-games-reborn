// Particles: steam, smoke, sparks, embers, fireflies, dust motes, rain,
// mist, bubbles. One shader, soft round sprites computed in the fragment
// shader (no textures). Each emitter animates its particles analytically
// from a birth time, so there is no per-frame CPU work beyond one uniform.

import * as THREE from 'three';

const VERT = /* glsl */ `
attribute vec4 aSeed; // x,y,z jitter, w phase
uniform float uTime; uniform float uLife; uniform vec3 uVel; uniform vec3 uSpread; uniform float uSize;
uniform float uGrow; uniform float uSwirl; uniform float uGravity; uniform float uPixel;
varying float vAge; varying float vSeed;
void main() {
  float age = fract(uTime / uLife + aSeed.w);
  vAge = age; vSeed = aSeed.x;
  vec3 p = position + (aSeed.xyz - 0.5) * uSpread;
  p += uVel * age * uLife + vec3(0.0, -uGravity * age * age * uLife * uLife, 0.0);
  p.x += sin(age * 6.2831 * 1.3 + aSeed.w * 40.0) * uSwirl * age;
  p.z += cos(age * 6.2831 * 1.1 + aSeed.y * 40.0) * uSwirl * age;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * (1.0 + uGrow * age) * uPixel / max(0.2, -mv.z);
}`;

const FRAG = /* glsl */ `
uniform vec3 uColor; uniform vec3 uColor2; uniform float uAlpha; uniform float uSoft; uniform float uFade;
varying float vAge; varying float vSeed;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float a = smoothstep(0.5, 0.5 * (1.0 - uSoft), d);
  float life = smoothstep(0.0, 0.12, vAge) * (1.0 - smoothstep(1.0 - uFade, 1.0, vAge));
  vec3 col = mix(uColor, uColor2, vAge);
  gl_FragColor = vec4(col, a * life * uAlpha);
  if (gl_FragColor.a < 0.003) discard;
}`;

const PRESETS = {
  steam: { color: 0xdfe8f0, color2: 0xa9b6c4, life: 3.2, vel: [0, 0.55, 0], spread: [0.25, 0.1, 0.25], size: 90, grow: 3.5, swirl: 0.25, alpha: 0.22, soft: 1, fade: 0.6, blend: 'normal' },
  smoke: { color: 0x2a2724, color2: 0x151413, life: 6, vel: [0.12, 0.7, 0], spread: [1.5, 0.3, 1.5], size: 160, grow: 3, swirl: 0.5, alpha: 0.42, soft: 1, fade: 0.5, blend: 'normal' },
  sparks: { color: 0xffe2a0, color2: 0xff5a10, life: 0.9, vel: [0, 1.2, 0], spread: [0.2, 0.2, 0.2], size: 7, grow: -0.6, swirl: 1.4, alpha: 1, soft: 0.2, fade: 0.4, gravity: 3.5, blend: 'add' },
  embers: { color: 0xffb060, color2: 0xff3a10, life: 3.5, vel: [0.05, 0.9, 0], spread: [1.2, 0.2, 1.2], size: 6, grow: -0.3, swirl: 0.6, alpha: 0.9, soft: 0.3, fade: 0.5, blend: 'add' },
  fireflies: { color: 0xd8ff7a, color2: 0x9fffb0, life: 7, vel: [0, 0.08, 0], spread: [14, 3, 14], size: 9, grow: 0, swirl: 1.2, alpha: 0.9, soft: 0.5, fade: 0.5, blend: 'add' },
  motes: { color: 0xfff1d0, color2: 0xfff1d0, life: 12, vel: [0.02, 0.03, 0], spread: [8, 4, 8], size: 3, grow: 0, swirl: 0.4, alpha: 0.35, soft: 0.5, fade: 0.5, blend: 'add' },
  rain: { color: 0xaec8e0, color2: 0xaec8e0, life: 0.8, vel: [0.3, -14, 0], spread: [40, 1, 40], size: 5, grow: 0, swirl: 0, alpha: 0.35, soft: 0.6, fade: 0.2, blend: 'add' },
  mist: { color: 0xc8d8e2, color2: 0xb0c0cc, life: 16, vel: [0.25, 0.02, 0], spread: [26, 1.5, 26], size: 900, grow: 0.4, swirl: 0.8, alpha: 0.05, soft: 1, fade: 0.5, blend: 'normal' },
  bubbles: { color: 0xe8fff8, color2: 0xa8fff0, life: 2.5, vel: [0, 0.6, 0], spread: [1.6, 0.05, 1.6], size: 6, grow: 0.2, swirl: 0.15, alpha: 0.7, soft: 0.2, fade: 0.2, blend: 'add' },
  drips: { color: 0xa8d8ff, color2: 0xa8d8ff, life: 1.4, vel: [0, -0.2, 0], spread: [10, 0.2, 10], size: 4, grow: 0, swirl: 0, alpha: 0.7, soft: 0.3, fade: 0.1, gravity: 2.5, blend: 'add' },
  glitter: { color: 0xffe9a0, color2: 0xffffff, life: 2.2, vel: [0, 0.2, 0], spread: [3, 2, 3], size: 5, grow: -0.5, swirl: 0.3, alpha: 1, soft: 0.3, fade: 0.5, blend: 'add' },
  spores: { color: 0x7affd8, color2: 0x4aa8ff, life: 9, vel: [0, 0.12, 0], spread: [10, 2, 10], size: 6, grow: 0.2, swirl: 0.8, alpha: 0.8, soft: 0.5, fade: 0.5, blend: 'add' },
};

/**
 * @param {string} kind preset name
 * @param {number} count particles
 * @param {object} o { pos:[x,y,z], quality, ...preset overrides }
 */
export function particles(kind, count, o = {}) {
  const p = { ...PRESETS[kind], ...o };
  const n = Math.max(1, Math.round(count * (o.quality === 'low' ? 0.4 : 1)));
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3);
  const seed = new Float32Array(n * 4);
  let s = (o.seed ?? 7) * 9301 + 49297;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  for (let i = 0; i < n; i++) {
    seed[i * 4] = rnd(); seed[i * 4 + 1] = rnd(); seed[i * 4 + 2] = rnd(); seed[i * 4 + 3] = rnd();
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  const m = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
    blending: p.blend === 'add' ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: {
      uTime: { value: 0 }, uLife: { value: p.life }, uVel: { value: new THREE.Vector3(...p.vel) },
      uSpread: { value: new THREE.Vector3(...p.spread) }, uSize: { value: p.size }, uGrow: { value: p.grow },
      uSwirl: { value: p.swirl }, uGravity: { value: p.gravity || 0 }, uPixel: { value: window.devicePixelRatio > 1 ? 1.6 : 1 },
      uColor: { value: new THREE.Color(p.color) }, uColor2: { value: new THREE.Color(p.color2) },
      uAlpha: { value: p.alpha }, uSoft: { value: p.soft }, uFade: { value: p.fade },
    },
  });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  if (o.pos) pts.position.set(...o.pos);
  pts.userData.tick = (t) => { m.uniforms.uTime.value = t; };
  return pts;
}

/** Soft additive light shafts / glows as a camera-facing quad. */
export function glowSprite(color, size, intensity = 1) {
  const m = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0); mv.xy += position.xy; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `uniform vec3 uC; uniform float uI; varying vec2 vUv; void main() { float d = length(vUv - 0.5) * 2.0; float a = pow(max(0.0, 1.0 - d), 2.4); gl_FragColor = vec4(uC * uI * a, a); }`,
    uniforms: { uC: { value: new THREE.Color(color) }, uI: { value: intensity } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const q = new THREE.Mesh(new THREE.PlaneGeometry(size, size), m);
  q.frustumCulled = false;
  return q;
}

/** Volumetric-looking god rays: stacked additive planes with a noisy falloff. */
export function lightShafts(color, { count = 6, len = 14, width = 2.4, spread = 6, alpha = 0.07, seed = 1 } = {}) {
  const grp = new THREE.Group();
  const m = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `uniform vec3 uC; uniform float uA; uniform float uT; varying vec2 vUv;
      void main() { float edge = smoothstep(0.0, 0.35, vUv.x) * smoothstep(1.0, 0.65, vUv.x); float fall = smoothstep(0.0, 0.25, vUv.y) * (1.0 - vUv.y * 0.6);
        float n = 0.75 + 0.25 * sin(vUv.x * 13.0 + uT * 0.3) * sin(vUv.y * 5.0 - uT * 0.2);
        gl_FragColor = vec4(uC * uA * edge * fall * n, 1.0); }`,
    uniforms: { uC: { value: new THREE.Color(color) }, uA: { value: alpha }, uT: { value: 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  let s = seed;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < count; i++) {
    const q = new THREE.Mesh(new THREE.PlaneGeometry(width * (0.6 + r()), len), m);
    q.position.set((r() - 0.5) * spread * 2, len / 2 - 1, -2 - r() * spread * 1.5);
    q.rotation.set(0.35, (r() - 0.5) * 1.2, 0.25 + (r() - 0.5) * 0.2);
    grp.add(q);
  }
  grp.userData.tick = (t) => { m.uniforms.uT.value = t; };
  return grp;
}
