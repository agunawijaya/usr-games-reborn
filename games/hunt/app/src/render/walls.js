// Walls as the viewer knows them (src/view.js terrain): interior masonry
// (dies to any blast, regrows), and the gunmetal border (indestructible).
// One instanced mesh; each instance samples the visibility field at its own
// cell: lit = shaded block, remembered = dark block with ghost edges.
// A wall that is destroyed shows glowing cracks for a moment, then its
// debris flies (render/fx.js); a regrowing wall rises with a light seam.

import * as THREE from 'three';
import * as K from '../engine/constants.js';
import { NOISE, LIGHTS, BEAM } from './glsl.js';
import { COL } from './palette.js';
import { T_WALL, T_BORDER } from '../view.js';

const W = K.WIDTH;
const H = K.HEIGHT;
const MAX = W * H + 64;
export const WALL_H = 1.05;
export const BORDER_H = 1.5;

export class Walls {
  constructor(fields, lightUniforms) {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0);
    const ig = new THREE.InstancedBufferGeometry();
    ig.index = geo.index;
    ig.attributes.position = geo.attributes.position;
    ig.attributes.normal = geo.attributes.normal;
    this.aCell = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 2), 2);
    this.aKind = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 4), 4); // kind, birth, death, seed
    this.aNb = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 4), 4); // wall to N, S, E, W (1 = hide that side)
    this.aNb.setUsage(THREE.DynamicDrawUsage);
    this.aCell.setUsage(THREE.DynamicDrawUsage);
    this.aKind.setUsage(THREE.DynamicDrawUsage);
    ig.setAttribute('aCell', this.aCell);
    ig.setAttribute('aKind', this.aKind);
    ig.setAttribute('aNb', this.aNb);
    ig.instanceCount = 0;
    this.geo = ig;
    const c = (h) => new THREE.Color(h);
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        uVis: { value: fields.vis },
        uTime: { value: 0 },
        uEye: { value: new THREE.Vector3() },
        uFace: { value: new THREE.Vector2(1, 0) },
        uBeamOn: { value: 1 },
      uAmb: { value: 0 },
        uSeeAll: { value: 0 },
        uBasalt: { value: c(COL.basalt) },
        uMetal: { value: c(COL.gunmetal) },
        uSeam: { value: c(COL.seam) },
        uGhost: { value: c(COL.ghost) },
        uWallH: { value: WALL_H },
        uBorderH: { value: BORDER_H },
        uLite: { value: 0 },
        ...lightUniforms,
      },
      vertexShader: /* glsl */ `
        attribute vec2 aCell;
        attribute vec4 aKind;
        attribute vec4 aNb;
        varying vec4 vNb;
        uniform float uTime, uWallH, uBorderH;
        varying vec3 vW;
        varying vec3 vL;
        varying vec3 vN;
        varying vec4 vKind;
        varying vec2 vCell;
        varying float vRise;
        void main() {
          float border = step(0.5, aKind.x);
          float h = mix(uWallH, uBorderH, border);
          // regrowth: rise out of the floor
          float rise = clamp((uTime - aKind.y) / 0.45, 0.0, 1.0);
          rise = 1.0 - pow(1.0 - rise, 3.0);
          // destruction: a crack flash, then collapse
          float dying = aKind.z > 0.0 ? clamp((uTime - aKind.z) / 0.16, 0.0, 1.0) : 0.0;
          vec3 p = position;
          p.y *= h * rise * (1.0 - smoothstep(0.55, 1.0, dying));
          p.xz *= 1.0 + dying * 0.08;
          vec3 w = vec3(aCell.x - 25.0 + p.x, p.y, aCell.y - 11.0 + p.z);
          vW = w;
          vL = vec3(position.x, position.y * h, position.z);
          vN = normal;
          vKind = vec4(aKind.x, dying, aKind.w, h);
          vCell = aCell;
          vNb = aNb;
          vRise = rise;
          gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform sampler2D uVis;
        uniform float uTime, uSeeAll, uLite;
        uniform vec3 uBasalt, uMetal, uSeam, uGhost;
        varying vec3 vW;
        varying vec3 vL;
        varying vec3 vN;
        varying vec4 vKind;
        varying vec2 vCell;
        varying float vRise;
        varying vec4 vNb;
        ${NOISE}
        ${LIGHTS}
        ${BEAM}
        void main() {
          // a side face against a neighbouring wall is inside the masonry run
          vec3 nn = normalize(vN);
          if (nn.z < -0.5 && vNb.x > 0.5) discard;
          if (nn.z > 0.5 && vNb.y > 0.5) discard;
          if (nn.x > 0.5 && vNb.z > 0.5) discard;
          if (nn.x < -0.5 && vNb.w > 0.5) discard;
          vec4 V = texture(uVis, (vCell + 0.5) / vec2(51.0, 23.0));
          float lit = max(V.r, uSeeAll * 0.85);
          float border = step(0.5, vKind.x);
          float h = vKind.w;
          vec3 n = normalize(vN);
          // face-local coordinates for edges and patterns
          vec2 fc = abs(n.y) > 0.5 ? vL.xz : (abs(n.x) > 0.5 ? vec2(vL.z, vL.y) : vec2(vL.x, vL.y));
          vec2 ext = abs(n.y) > 0.5 ? vec2(0.5) : vec2(0.5, h);
          vec2 e2 = abs(n.y) > 0.5 ? min(fc + 0.5, 0.5 - fc) : vec2(min(fc.x + 0.5, 0.5 - fc.x), min(fc.y, h - fc.y));
          // distance to each edge of this face, ignoring edges shared with a neighbour wall
          float big = 9.0;
          float eL, eR, eB, eT;
          if (abs(n.y) > 0.5) {
            eL = vNb.w > 0.5 ? big : fc.x + 0.5; eR = vNb.z > 0.5 ? big : 0.5 - fc.x;
            eB = vNb.x > 0.5 ? big : fc.y + 0.5; eT = vNb.y > 0.5 ? big : 0.5 - fc.y;
          } else if (abs(n.x) > 0.5) {
            eL = vNb.x > 0.5 ? big : fc.x + 0.5; eR = vNb.y > 0.5 ? big : 0.5 - fc.x;
            eB = fc.y; eT = h - fc.y;
          } else {
            eL = vNb.w > 0.5 ? big : fc.x + 0.5; eR = vNb.z > 0.5 ? big : 0.5 - fc.x;
            eB = fc.y; eT = h - fc.y;
          }
          float edge = 1.0 - smoothstep(0.0, 0.03, min(min(eL, eR), min(eB, eT)));
          float silhouette = abs(n.y) > 0.5 ? edge : 1.0 - smoothstep(0.0, 0.03, min(min(eL, eR), eT));

          vec3 base;
          if (border > 0.5) {
            // gunmetal: brushed panels with a seam every half cell
            float brushed = vnoise(vec2(fc.x * 3.0, fc.y * 90.0)) * 0.25;
            float panel = 1.0 - smoothstep(0.0, 0.02, abs(fract(fc.x + 0.5) - 0.5));
            base = uMetal * (0.8 + brushed) * (1.0 - panel * 0.5);
          } else {
            // masonry: courses of blocks, mortar joints, per-block tone
            float row = floor(vL.y / 0.26);
            float u = fc.x + mod(row, 2.0) * 0.25 + (vCell.x + vCell.y) * 0.5;
            float col = floor(u / 0.5);
            float fy = fract(vL.y / 0.26);
            float fu = fract(u / 0.5);
            float mortar = abs(n.y) > 0.5 ? 0.0 :
              max(1.0 - smoothstep(0.0, 0.016, min(fy, 1.0 - fy) * 0.26),
                  1.0 - smoothstep(0.0, 0.018, min(fu, 1.0 - fu) * 0.5));
            float tone = hash12(vec2(row, col) + vCell * 3.1);
            float grain = uLite > 0.5 ? 0.5 : vnoise(vW.xz * 4.0 + vW.y * 3.0) * 0.6 + vnoise(vW.xz * 11.0 + vW.y * 7.0) * 0.4;
            base = uBasalt * (0.75 + 0.4 * tone + 0.35 * grain);
            if (abs(n.y) > 0.5) base *= 1.25 + 0.3 * (uLite > 0.5 ? 0.5 : vnoise(vW.xz * 6.0));
            base *= 1.0 - mortar * 0.55;
          }

          vec3 light = beamLight(vW, n, lit) + pointLights(vW, n);
          vec3 colr = base * light;
          // top-edge bevel catches the beam
          float top = smoothstep(h - 0.05, h, vL.y) * (1.0 - abs(n.y));
          colr += vec3(1.0, 0.95, 0.9) * edge * 0.12 * lit;
          if (border > 0.5) {
            // indestructible: a cold steel rim along the top
            float rim = smoothstep(h - 0.06, h - 0.01, vL.y) * (1.0 - abs(n.y)) + (abs(n.y) > 0.5 ? edge : 0.0);
            colr += vec3(0.45, 0.7, 1.0) * rim * (0.35 + 0.65 * lit);
          } else {
            // floor-level light seam of the masonry
            float seam = 1.0 - smoothstep(0.0, 0.035, vL.y);
            colr += uSeam * seam * 0.35 * (0.2 + lit) * (1.0 - abs(n.y));
          }
          // remembered only: near-black block with ghost edges
          float ghost = (1.0 - lit) * max(V.g, uSeeAll);
          colr += uGhost * silhouette * 0.14 * ghost + uGhost * 0.01 * ghost;
          // regrowth: a light seam running up the rising face
          float front = (1.0 - vRise) * (1.0 - smoothstep(0.0, 0.06, abs(vL.y - h * vRise + 0.02)));
          colr += vec3(0.4, 0.95, 1.0) * (front * 3.0 + (1.0 - vRise) * 0.4);
          // dying: cracks glow white-hot
          if (vKind.y > 0.0) {
            float cr = 1.0 - smoothstep(0.0, 0.05 + 0.1 * vKind.y, worley(vec2(fc.x * 5.0 + vKind.z * 7.0, fc.y * 5.0)));
            colr += vec3(1.0, 0.7, 0.35) * cr * (1.0 - vKind.y) * 4.0 + vec3(1.0, 0.6, 0.3) * vKind.y * 0.6;
          }
          gl_FragColor = vec4(colr, 1.0);
        }`,
    });
    this.mesh = new THREE.Mesh(this.geo, this.mat);
    this.mesh.frustumCulled = false;
    this.birth = new Float32Array(W * H).fill(-10);
    this.dying = []; // {x, y, border, t}
    this.prevTerrain = null;
  }

  // Rebuild the instances from the viewer's terrain.
  update(terrain, time) {
    const C = this.aCell.array;
    const Kd = this.aKind.array;
    const Nb = this.aNb.array;
    const isW = (x, y) => x >= 0 && y >= 0 && x < W && y < H && (terrain[y * W + x] === T_WALL || terrain[y * W + x] === T_BORDER);
    const tall = (x, y) => terrain[y * W + x] === T_BORDER;
    let n = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const t = terrain[y * W + x];
        if (t !== T_WALL && t !== T_BORDER) continue;
        C[n * 2] = x;
        C[n * 2 + 1] = y;
        Kd[n * 4] = t === T_BORDER ? 1 : 0;
        Kd[n * 4 + 1] = this.birth[y * W + x];
        Kd[n * 4 + 2] = 0;
        Kd[n * 4 + 3] = ((x * 73856093) ^ (y * 19349663)) % 97 / 97;
        // hide a side only if the neighbour is at least as tall
        const me = t === T_BORDER;
        const hide = (nx, ny) => (isW(nx, ny) && (tall(nx, ny) || !me) ? 1 : 0);
        Nb[n * 4] = hide(x, y - 1);
        Nb[n * 4 + 1] = hide(x, y + 1);
        Nb[n * 4 + 2] = hide(x + 1, y);
        Nb[n * 4 + 3] = hide(x - 1, y);
        n++;
      }
    }
    this.dying = this.dying.filter((d) => time - d.t < 0.2);
    for (const d of this.dying) {
      if (n >= MAX) break;
      C[n * 2] = d.x;
      C[n * 2 + 1] = d.y;
      Kd[n * 4] = d.border ? 1 : 0;
      Kd[n * 4 + 1] = -10;
      Kd[n * 4 + 2] = d.t;
      Kd[n * 4 + 3] = 0.3;
      Nb[n * 4] = Nb[n * 4 + 1] = Nb[n * 4 + 2] = Nb[n * 4 + 3] = 0;
      n++;
    }
    this.geo.instanceCount = n;
    this.aCell.needsUpdate = true;
    this.aKind.needsUpdate = true;
    this.aNb.needsUpdate = true;
  }

  regrow(x, y, time) { this.birth[y * W + x] = time; }
  crumble(x, y, time) { this.dying.push({ x, y, border: false, t: time }); }
}
