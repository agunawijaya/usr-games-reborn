// Sky dome: the shared skyColor() with full-quality clouds, rendered behind
// everything and following the camera.

import * as THREE from 'three';
import { NOISE, SKY_UNIFORMS, SKY_FN } from './glsl.js';

const vertex = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww; // on the far plane
}
`;

const fragment = /* glsl */ `
precision highp float;
${SKY_UNIFORMS}
uniform float uOct;
varying vec3 vDir;
${NOISE}
${SKY_FN}
void main() {
  vec3 dir = normalize(vDir);
  vec3 col = skyColor(dir, int(uOct));
  gl_FragColor = vec4(col, 1.0);
}
`;

export function createSky(atmo, { quality = 'high' } = {}) {
  const geo = new THREE.SphereGeometry(1000, 48, 24);
  const mat = new THREE.ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    uniforms: { ...atmo.u, uOct: { value: quality === 'high' ? 6 : 4 } },
    side: THREE.BackSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -2;
  return {
    mesh,
    update(camera) {
      mesh.position.copy(camera.position);
    },
  };
}
