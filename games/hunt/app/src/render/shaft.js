// The flashlight you see in the air: a thin volumetric shaft from the
// drone down the corridor ahead, fading with distance, clipped to the cells
// the viewer can actually see (the visibility field), so it stops dead at
// the first wall exactly like draw.c's see() does.

import * as THREE from 'three';
import { NOISE } from './glsl.js';

export class Shaft {
  constructor(fields) {
    // a fan of slanted quads: from chest height, spreading forward
    const geo = new THREE.PlaneGeometry(1, 1, 24, 1);
    geo.translate(0.5, 0, 0);            // x: 0 .. 1 along the beam
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: {
        uVis: { value: fields.vis },
        uTime: { value: 0 },
        uLen: { value: 22 },
        uOn: { value: 0 },
      },
      vertexShader: /* glsl */ `
        uniform float uLen;
        varying vec3 vW; varying vec2 vUv;
        void main() {
          vUv = uv;
          float along = position.x * uLen;
          float half_ = 0.18 + along * 0.075;
          vec3 p = vec3(along, 0.55 - along * 0.012, position.y * 2.0 * half_);
          vec4 w = modelMatrix * vec4(p, 1.0);
          vW = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uVis; uniform float uTime, uLen, uOn;
        varying vec3 vW; varying vec2 vUv;
        ${NOISE}
        void main() {
          vec2 uv = (vW.xz + vec2(25.5, 11.5)) / vec2(51.0, 23.0);
          float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
          float lit = texture(uVis, uv).r * inside;
          float d = vUv.x * uLen;
          float across = 1.0 - abs(vUv.y * 2.0 - 1.0);
          float fall = exp(-d / 7.0) * smoothstep(0.0, 0.6, d);
          float dust = 0.65 + 0.35 * fbm(vW.xz * 1.3 + vec2(uTime * 0.15, -uTime * 0.1));
          float a = pow(clamp(across, 0.0, 1.0), 1.6) * fall * dust * smoothstep(0.35, 0.9, lit) * uOn;
          gl_FragColor = vec4(vec3(1.0, 0.9, 0.74) * a * 0.22, 1.0);
        }`,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 12;
  }

  pose(x, z, angle, on, time) {
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.set(0, angle, 0);
    this.mat.uniforms.uOn.value = on;
    this.mat.uniforms.uTime.value = time;
  }
}
