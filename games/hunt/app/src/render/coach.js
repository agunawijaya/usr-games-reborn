// Coach (cheat layer 1, backtick): the live ricochet preview for the
// current facing and weapon — the same side-effect-free trace the
// Sharpshooter uses (src/engine/trajectory.js), with every mirror flip the
// shot itself would cause. Bounce points get diamonds, a door ends the
// preview with a scatter mark, and heavier ordnance shows its blast square.

import * as THREE from 'three';
import * as K from '../engine/constants.js';

const MAXV = 4096;

export class Coach {
  constructor() {
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(MAXV * 3);
    this.col = new Float32Array(MAXV * 4);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    this.geo = geo;
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 } },
      vertexShader: /* glsl */ `attribute vec4 color; varying vec4 vC; varying vec3 vW;
        void main(){ vC = color; vW = position; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `uniform float uTime; varying vec4 vC; varying vec3 vW;
        void main(){ float dash = 0.55 + 0.45 * step(0.5, fract((vW.x + vW.z) * 1.5 - uTime * 2.0));
          gl_FragColor = vec4(vC.rgb * vC.a * dash, 1.0); }`,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 40;
    this.mesh.visible = false;
    this.v = 0;
  }

  quad(ax, az, bx, bz, w, c, a, y = 0.08) {
    const dx = bx - ax;
    const dz = bz - az;
    const l = Math.hypot(dx, dz) || 1;
    const nx = -dz / l * w;
    const nz = dx / l * w;
    const P = [[ax + nx, az + nz], [ax - nx, az - nz], [bx + nx, bz + nz], [bx - nx, bz - nz]];
    for (const k of [0, 1, 2, 1, 3, 2]) {
      if (this.v >= MAXV) return;
      this.pos[this.v * 3] = P[k][0]; this.pos[this.v * 3 + 1] = y; this.pos[this.v * 3 + 2] = P[k][1];
      this.col[this.v * 4] = c[0]; this.col[this.v * 4 + 1] = c[1]; this.col[this.v * 4 + 2] = c[2]; this.col[this.v * 4 + 3] = a;
      this.v++;
    }
  }

  diamond(x, z, s, c, a) {
    this.quad(x - s, z, x + s, z, s * 0.7, c, a, 0.1);
    this.quad(x, z - s, x, z + s, s * 0.7, c, a, 0.1);
  }

  square(x, z, half, c, a) {
    const e = [[x - half, z - half], [x + half, z - half], [x + half, z + half], [x - half, z + half]];
    for (let i = 0; i < 4; i++) this.quad(e[i][0], e[i][1], e[(i + 1) % 4][0], e[(i + 1) % 4][1], 0.03, c, a);
  }

  // plan: { x, y, face, tr (trajectory result), size (blast), extra: [tr...] }
  show(plan, time) {
    this.v = 0;
    this.mesh.visible = !!plan;
    if (!plan) return;
    this.mat.uniforms.uTime.value = time;
    const W = (x, y) => [x - 25, y - 11];
    const draw = (tr, x0, y0, main) => {
      const c = main ? [0.55, 1.0, 0.9] : [0.4, 0.55, 0.8];
      const a = main ? 0.9 : 0.25;
      let [px, pz] = W(x0, y0);
      for (const [cx, cy] of tr.cells) {
        const [qx, qz] = W(cx, cy);
        this.quad(px, pz, qx, qz, main ? 0.05 : 0.025, c, a);
        px = qx; pz = qz;
      }
      if (!main) return;
      for (const b of tr.bounces) {
        const [bx, bz] = W(b.x, b.y);
        this.diamond(bx, bz, 0.2, [1.0, 0.9, 0.4], 1.0);
      }
      const [ex, ez] = W(tr.end.x, tr.end.y);
      if (tr.end.kind === 'door') this.diamond(ex, ez, 0.35, [0.75, 0.5, 1.0], 1.0);
      else if (tr.end.kind === 'player') this.square(ex, ez, 0.45, [1.0, 0.35, 0.35], 1.0);
      else this.diamond(ex, ez, 0.16, [1.0, 0.6, 0.3], 0.9);
      if (plan.size > 1) this.square(ex, ez, plan.size - 0.5, [1.0, 0.55, 0.25], 0.6);
    };
    for (const tr of plan.extra || []) draw(tr, plan.x, plan.y, false);
    draw(plan.tr, plan.x, plan.y, true);
    this.geo.setDrawRange(0, this.v);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }
}

export const SIZE_OF = { f: 1, g: 2, F: 3, G: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 0: 10, '@': 11, o: 1 };
void K;
