// Mines and boots. Mines in hunt are ownerless arena hazards dropped on
// every entry and visible to anyone who looks (answer.c:295-313): here a
// faint shimmering disc in view, a ghost marker when remembered, and a
// pulsing red warning ring with the Reveal-mines override. Boots are a
// small golden pair that bobs; flying boots arc through the air.

import * as THREE from 'three';
import * as K from '../engine/constants.js';
import { NOISE } from './glsl.js';

const MAX = 600;

export class Items {
  constructor() {
    const disc = new THREE.CircleGeometry(0.5, 32);
    disc.rotateX(-Math.PI / 2);
    const ig = new THREE.InstancedBufferGeometry();
    ig.index = disc.index;
    ig.attributes.position = disc.attributes.position;
    ig.attributes.uv = disc.attributes.uv;
    this.a = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 4), 4).setUsage(THREE.DynamicDrawUsage); // x, z, kind, state
    ig.setAttribute('aA', this.a);
    ig.instanceCount = 0;
    this.geo = ig;
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 } },
      vertexShader: /* glsl */ `
        attribute vec4 aA;
        varying vec2 vUv; varying vec4 vA;
        void main() {
          vUv = uv; vA = aA;
          float s = aA.z < 1.5 ? 0.42 : (aA.z < 2.5 ? 0.62 : 0.55);
          vec3 p = position * s;
          if (aA.z > 2.5) p.y += 0.25 + 0.05 * sin(aA.x * 3.0 + aA.y);
          gl_Position = projectionMatrix * viewMatrix * vec4(vec3(aA.x, 0.03, aA.y) + p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        varying vec2 vUv; varying vec4 vA;
        ${NOISE}
        void main() {
          vec2 p = vUv * 2.0 - 1.0;
          float r = length(p);
          float a = atan(p.y, p.x);
          vec3 c = vec3(0.0);
          float state = vA.w; // 1 remembered, 2 seen, 3 revealed
          if (vA.z < 2.5) {
            // mine: dark disc, a fine shimmering ring, three prongs on the big one
            float shimmer = 0.5 + 0.5 * sin(a * 6.0 + uTime * 2.5 + vA.x);
            float ring = smoothstep(0.08, 0.0, abs(r - 0.78)) * (0.35 + 0.65 * shimmer);
            float core = smoothstep(0.25, 0.0, r) * (0.5 + 0.5 * sin(uTime * 5.0 + vA.y * 2.0));
            float prongs = vA.z > 1.5 ? smoothstep(0.1, 0.0, abs(sin(a * 1.5))) * step(0.3, r) * step(r, 0.9) : 0.0;
            vec3 tint = vec3(1.0, 0.25, 0.35);
            float led = smoothstep(0.12, 0.0, r) * step(0.5, fract(uTime * 0.7 + vA.x * 0.13));
            c = tint * (ring * 0.1 + led * 0.8) + vec3(0.5, 0.55, 0.6) * prongs * 0.04;
            if (state < 1.5) c = vec3(0.35, 0.55, 1.0) * ring * 0.08;
            if (state > 2.5) c += tint * smoothstep(0.05, 0.0, abs(r - 0.85)) * (0.25 + 0.15 * sin(uTime * 6.0));
          } else {
            // boots: a mirrored pair of L-shaped silhouettes (shaft + foot)
            vec2 q = p;
            float side = sign(q.x);
            q.x = abs(q.x);
            float shaft = step(0.12, q.x) * step(q.x, 0.36) * step(-0.05, q.y) * step(q.y, 0.55);
            float foot = step(0.12, q.x) * step(q.x, 0.62) * step(-0.3, q.y) * step(q.y, -0.02);
            float boot = max(shaft, foot);
            float cuff = step(0.12, q.x) * step(q.x, 0.36) * step(0.45, q.y) * step(q.y, 0.55);
            float halo = exp(-r * r * 3.0) * 0.3;
            c = vec3(1.0, 0.78, 0.35) * (boot * 1.1 + cuff * 0.8 + halo) * (state < 1.5 ? 0.25 : 1.0);
            c *= 0.9 + 0.1 * side;
          }
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    this.mesh = new THREE.Mesh(this.geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
  }

  sync(list, flyingBoots) {
    const A = this.a.array;
    let n = 0;
    for (const it of list) {
      if (n >= MAX) break;
      A[n * 4] = it.x - 25;
      A[n * 4 + 1] = it.y - 11;
      A[n * 4 + 2] = it.c === K.MINE ? 1 : it.c === K.GMINE ? 2 : 3;
      A[n * 4 + 3] = it.state;
      n++;
    }
    for (const b of flyingBoots) {
      if (n >= MAX) break;
      A[n * 4] = b.x; A[n * 4 + 1] = b.z; A[n * 4 + 2] = 3; A[n * 4 + 3] = 2;
      n++;
    }
    this.geo.instanceCount = n;
    this.a.needsUpdate = true;
  }
}
