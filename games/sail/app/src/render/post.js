// Post-processing: the scene renders into an HDR target; a bright pass is
// blurred at half and quarter resolution for bloom; a composite pass applies
// exposure, ACES filmic tone mapping, a light colour grade, vignette and
// film grain, then writes sRGB to the screen. No addons, ~one screen of GLSL.

import * as THREE from 'three';

const quadVert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const brightFrag = /* glsl */ `
uniform sampler2D tSrc;
uniform float uThreshold;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tSrc, vUv).rgb;
  float l = max(max(c.r, c.g), c.b);
  float k = smoothstep(uThreshold, uThreshold * 2.5, l);
  gl_FragColor = vec4(c * k, 1.0);
}
`;

const blurFrag = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uDir;
varying vec2 vUv;
void main() {
  vec3 s = texture2D(tSrc, vUv).rgb * 0.227027;
  s += texture2D(tSrc, vUv + uDir * 1.3846153).rgb * 0.3162162;
  s += texture2D(tSrc, vUv - uDir * 1.3846153).rgb * 0.3162162;
  s += texture2D(tSrc, vUv + uDir * 3.2307692).rgb * 0.0702702;
  s += texture2D(tSrc, vUv - uDir * 3.2307692).rgb * 0.0702702;
  gl_FragColor = vec4(s, 1.0);
}
`;

const compositeFrag = /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tBloomA;
uniform sampler2D tBloomB;
uniform float uExposure;
uniform float uBloom;
uniform float uVignette;
uniform float uGrain;
uniform float uTime;
uniform float uSaturation;
uniform vec3 uTint;
uniform float uFlash;
varying vec2 vUv;
vec3 aces(vec3 x) {
  const float a = 2.51; const float b = 0.03; const float c = 2.43; const float d = 0.59; const float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}
float rnd(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec3 c = texture2D(tScene, vUv).rgb;
  vec3 bloom = texture2D(tBloomA, vUv).rgb * 0.6 + texture2D(tBloomB, vUv).rgb * 0.8;
  c += bloom * uBloom;
  c *= uExposure * (1.0 + uFlash * 0.6);
  c *= uTint;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, uSaturation);
  c = aces(c);
  // vignette
  vec2 q = vUv - 0.5;
  c *= 1.0 - uVignette * smoothstep(0.25, 0.85, dot(q, q) * 2.2);
  // sRGB
  c = pow(c, vec3(1.0 / 2.2));
  c += (rnd(vUv * 1000.0 + uTime) - 0.5) * uGrain;
  gl_FragColor = vec4(c, 1.0);
}
`;

export function createPost(renderer, { quality = 'high' } = {}) {
  const hi = quality === 'high';
  const opts = { type: THREE.HalfFloatType, depthBuffer: true };
  const main = new THREE.WebGLRenderTarget(1, 1, { ...opts, samples: hi ? 4 : 0 });
  const half = [new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }), new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType })];
  const quarter = [new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }), new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType })];
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  quad.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(quad);

  const bright = new THREE.ShaderMaterial({ vertexShader: quadVert, fragmentShader: brightFrag, uniforms: { tSrc: { value: null }, uThreshold: { value: 1.2 } }, depthTest: false, depthWrite: false });
  const blur = new THREE.ShaderMaterial({ vertexShader: quadVert, fragmentShader: blurFrag, uniforms: { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } }, depthTest: false, depthWrite: false });
  const composite = new THREE.ShaderMaterial({
    vertexShader: quadVert,
    fragmentShader: compositeFrag,
    uniforms: {
      tScene: { value: main.texture },
      tBloomA: { value: half[0].texture },
      tBloomB: { value: quarter[0].texture },
      uExposure: { value: 1 },
      uBloom: { value: 0.5 },
      uVignette: { value: 0.55 },
      uGrain: { value: 0.025 },
      uTime: { value: 0 },
      uSaturation: { value: 1 },
      uTint: { value: new THREE.Color(1, 1, 1) },
      uFlash: { value: 0 },
    },
    depthTest: false,
    depthWrite: false,
  });

  function pass(mat, target) {
    quad.material = mat;
    renderer.setRenderTarget(target);
    renderer.render(scene, cam);
  }

  function setSize(w, h) {
    const dpr = renderer.getPixelRatio();
    const W = Math.max(1, Math.floor(w * dpr));
    const H = Math.max(1, Math.floor(h * dpr));
    main.setSize(W, H);
    half.forEach((t) => t.setSize(Math.max(1, W >> 1), Math.max(1, H >> 1)));
    quarter.forEach((t) => t.setSize(Math.max(1, W >> 2), Math.max(1, H >> 2)));
  }

  function render(worldScene, camera, params) {
    renderer.setRenderTarget(main);
    renderer.render(worldScene, camera);
    // bloom
    bright.uniforms.tSrc.value = main.texture;
    pass(bright, half[0]);
    const hw = half[0].width;
    const hh = half[0].height;
    blur.uniforms.tSrc.value = half[0].texture;
    blur.uniforms.uDir.value.set(1 / hw, 0);
    pass(blur, half[1]);
    blur.uniforms.tSrc.value = half[1].texture;
    blur.uniforms.uDir.value.set(0, 1 / hh);
    pass(blur, half[0]);
    const qw = quarter[0].width;
    const qh = quarter[0].height;
    blur.uniforms.tSrc.value = half[0].texture;
    blur.uniforms.uDir.value.set(2 / qw, 0);
    pass(blur, quarter[1]);
    blur.uniforms.tSrc.value = quarter[1].texture;
    blur.uniforms.uDir.value.set(0, 2 / qh);
    pass(blur, quarter[0]);
    const u = composite.uniforms;
    u.uExposure.value = params.exposure;
    u.uBloom.value = params.bloom ?? 0.5;
    u.uTime.value = params.time % 100;
    u.uSaturation.value = params.saturation ?? 1;
    u.uTint.value.copy(params.tint || new THREE.Color(1, 1, 1));
    u.uFlash.value = params.flash || 0;
    u.uVignette.value = params.vignette ?? 0.55;
    pass(composite, null);
  }

  function dispose() {
    [main, ...half, ...quarter].forEach((t) => t.dispose());
  }

  return { render, setSize, dispose, composite };
}
