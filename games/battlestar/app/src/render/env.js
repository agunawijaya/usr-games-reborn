// Procedural environment maps for image-based lighting. Each mood is a small
// shader-painted sphere (gradients + a few bright "light blobs") prefiltered
// with PMREM, so metals and gloss reflect a plausible surrounding without a
// single image file (ADR-002).

import * as THREE from 'three';

const FRAG = /* glsl */ `
uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uBottom;
uniform vec4 uBlob[6]; uniform vec3 uBlobC[6]; uniform float uBands; uniform vec3 uBandC;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  vec3 col = d.y > 0.0 ? mix(uHorizon, uTop, pow(d.y, 0.6)) : mix(uHorizon, uBottom, pow(-d.y, 0.5));
  for (int i = 0; i < 6; i++) {
    float k = max(dot(d, normalize(uBlob[i].xyz)), 0.0);
    col += uBlobC[i] * pow(k, uBlob[i].w);
  }
  if (uBands > 0.0) col += uBandC * smoothstep(0.92, 0.99, fract(atan(d.x, d.z) / 6.2831 * uBands)) * smoothstep(0.35, 0.6, d.y);
  gl_FragColor = vec4(col, 1.0);
}`;

const MOODS = {
  'ship-mil': { top: [0.35, 0.38, 0.44], horizon: [0.12, 0.14, 0.17], bottom: [0.05, 0.05, 0.06], bands: 8, band: [3, 2.6, 2.2],
    blobs: [[[0, 1, 0], 18, [2.4, 2.1, 1.8]], [[1, 0.2, 0], 30, [0.6, 0.12, 0.05]]] },
  'ship-lux': { top: [0.4, 0.28, 0.18], horizon: [0.3, 0.16, 0.08], bottom: [0.12, 0.08, 0.05],
    blobs: [[[1, 0.3, 0], 40, [3, 2, 1.2]], [[-1, 0.3, 0], 40, [3, 2, 1.2]], [[0, 0.2, -1], 30, [0.6, 0.7, 1.4]]] },
  'ship-med': { top: [0.7, 0.8, 0.8], horizon: [0.4, 0.46, 0.46], bottom: [0.15, 0.17, 0.17], bands: 6, band: [2, 2.3, 2.3], blobs: [] },
  space: { top: [0.01, 0.01, 0.025], horizon: [0.02, 0.015, 0.04], bottom: [0.005, 0.005, 0.01],
    blobs: [[[0.6, 0.3, -0.7], 400, [30, 26, 22]], [[-0.5, -0.4, 0.2], 3, [0.03, 0.08, 0.12]]] },
  day: { top: [0.35, 0.55, 1.0], horizon: [0.8, 0.88, 0.95], bottom: [0.22, 0.26, 0.16],
    blobs: [[[0.4, 0.7, -0.4], 300, [40, 36, 30]]] },
  dusk: { top: [0.2, 0.25, 0.5], horizon: [1.0, 0.55, 0.3], bottom: [0.12, 0.1, 0.08],
    blobs: [[[0, 0.05, -1], 60, [12, 6, 2.5]]] },
  night: { top: [0.02, 0.03, 0.07], horizon: [0.05, 0.07, 0.12], bottom: [0.01, 0.012, 0.015],
    blobs: [[[-0.3, 0.8, -0.4], 600, [6, 6, 7]]] },
  forest: { top: [0.25, 0.4, 0.2], horizon: [0.22, 0.3, 0.16], bottom: [0.06, 0.07, 0.04],
    blobs: [[[0.2, 1, -0.3], 60, [8, 8, 5]]] },
  cave: { top: [0.02, 0.018, 0.016], horizon: [0.03, 0.026, 0.022], bottom: [0.01, 0.009, 0.008], blobs: [] },
  'cave-warm': { top: [0.06, 0.035, 0.02], horizon: [0.08, 0.05, 0.03], bottom: [0.02, 0.012, 0.008],
    blobs: [[[0, 0.3, -1], 20, [1.5, 0.9, 0.4]]] },
  cockpit: { top: [0.02, 0.02, 0.04], horizon: [0.05, 0.04, 0.08], bottom: [0.01, 0.01, 0.02],
    blobs: [[[0.5, 0.4, -0.8], 200, [20, 18, 16]], [[0, -1, 0], 4, [0.05, 0.12, 0.2]]] },
};

export class EnvLibrary {
  constructor(renderer) {
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.cache = new Map();
    this.mat = new THREE.ShaderMaterial({
      vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: FRAG,
      side: THREE.BackSide,
      uniforms: {
        uTop: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uBottom: { value: new THREE.Color() },
        uBlob: { value: Array.from({ length: 6 }, () => new THREE.Vector4(0, 1, 0, 1)) },
        uBlobC: { value: Array.from({ length: 6 }, () => new THREE.Color(0, 0, 0)) },
        uBands: { value: 0 }, uBandC: { value: new THREE.Color() },
      },
    });
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 48, 24), this.mat));
  }

  get(mood) {
    if (!MOODS[mood]) mood = 'ship-mil';
    if (this.cache.has(mood)) return this.cache.get(mood);
    const m = MOODS[mood];
    const u = this.mat.uniforms;
    u.uTop.value.setRGB(...m.top);
    u.uHorizon.value.setRGB(...m.horizon);
    u.uBottom.value.setRGB(...m.bottom);
    u.uBands.value = m.bands || 0;
    u.uBandC.value.setRGB(...(m.band || [0, 0, 0]));
    for (let i = 0; i < 6; i++) {
      const b = m.blobs[i];
      if (b) { u.uBlob.value[i].set(...b[0], b[1]); u.uBlobC.value[i].setRGB(...b[2]); } else u.uBlobC.value[i].setRGB(0, 0, 0);
    }
    const tex = this.pmrem.fromScene(this.scene, 0.02).texture;
    this.cache.set(mood, tex);
    return tex;
  }
}
