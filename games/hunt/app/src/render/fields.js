// Per-cell fields the shaders sample (51 x 23 texels, linear filtering, so
// light and goo spread smoothly across cell borders):
//   vis.r  lit now (the viewer's line of sight)       — eased
//   vis.g  known (seen this life or on their screen)  — eased
//   vis.b  slime                                        — goo + fading residue
//   vis.a  lava
//   fx.r   scorch (burn marks, slow fade)
//   fx.g   blast heat (fresh explosion squares)
//   fx.b   ooze flash (slime/lava visible to everyone, showexpl '*')
//   fx.a   regrow glow (walls rising)

import * as THREE from 'three';
import * as K from '../engine/constants.js';

const W = K.WIDTH;
const H = K.HEIGHT;
const N = W * H;

export class Fields {
  constructor() {
    this.visData = new Uint8Array(N * 4);
    this.fxData = new Uint8Array(N * 4);
    this.vis = new THREE.DataTexture(this.visData, W, H, THREE.RGBAFormat);
    this.fx = new THREE.DataTexture(this.fxData, W, H, THREE.RGBAFormat);
    this.terrData = new Uint8Array(N * 4);
    this.terr = new THREE.DataTexture(this.terrData, W, H, THREE.RGBAFormat);
    for (const t of [this.vis, this.fx, this.terr]) {
      t.magFilter = THREE.LinearFilter;
      t.minFilter = THREE.LinearFilter;
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      t.flipY = false;
      t.needsUpdate = true;
    }
    this.lit = new Float32Array(N);
    this.known = new Float32Array(N);
    this.litT = new Float32Array(N);
    this.knownT = new Float32Array(N);
    this.slime = new Float32Array(N);
    this.slimeT = new Float32Array(N);   // 1 where slime rests now
    this.slimeRes = new Float32Array(N); // residue after it moved on
    this.lava = new Float32Array(N);
    this.lavaT = new Float32Array(N);
    this.lavaRes = new Float32Array(N);
    this.scorch = new Float32Array(N);
    this.heat = new Float32Array(N);
    this.ooze = new Float32Array(N);
    this.grow = new Float32Array(N);
  }

  // Per engine step: targets from the view model and the bullet list.
  setView(vs, instant = false) {
    for (let i = 0; i < N; i++) {
      this.litT[i] = vs.lit[i];
      this.knownT[i] = vs.known[i];
    }
    if (instant) {
      this.lit.set(this.litT);
      this.known.set(this.knownT);
    }
  }

  // wall occupancy of the viewer's known terrain (for floor occlusion)
  setTerrain(terrain) {
    for (let i = 0; i < N; i++) {
      const t = terrain[i];
      this.terrData[i * 4] = t === 1 || t === 2 ? 255 : t === 3 || t === 4 ? 90 : 0;
    }
    this.terr.needsUpdate = true;
  }

  setGoo(g) {
    this.slimeT.fill(0);
    this.lavaT.fill(0);
    for (const b of g.bullets) {
      const i = b.y * W + b.x;
      if (b.type === K.SLIME && b.oozing) this.slimeT[i] = 1;
      else if (b.type === K.LAVA) this.lavaT[i] = 1;
    }
  }

  oozeAt(x, y, lava) {
    const i = y * W + x;
    this.ooze[i] = 1;
    if (lava) this.lavaRes[i] = 1;
    else this.slimeRes[i] = 1;
  }

  blastSquare(cx, cy, size) {
    const d = Math.max(0, size - 1);
    for (let y = cy - d; y <= cy + d; y++) {
      for (let x = cx - d; x <= cx + d; x++) {
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const i = y * W + x;
        const ring = Math.max(Math.abs(x - cx), Math.abs(y - cy));
        const k = 1 - ring / (d + 1);
        this.heat[i] = Math.max(this.heat[i], 0.55 + 0.45 * k);
        this.scorch[i] = Math.min(1, this.scorch[i] + 0.35 * k + 0.1);
      }
    }
  }

  regrow(x, y) { this.grow[y * W + x] = 1; }

  update(dt, reduced) {
    const kv = 1 - Math.exp(-dt * (reduced ? 30 : 9));
    const kk = 1 - Math.exp(-dt * 4);
    const kg = 1 - Math.exp(-dt * 5);
    const res = Math.exp(-dt / 7);       // slime residue fades over ~7 s
    const heat = Math.exp(-dt / 0.35);
    const ooze = Math.exp(-dt / 0.3);
    const scorch = Math.exp(-dt / 40);
    const grow = Math.exp(-dt / 0.6);
    const V = this.visData;
    const F = this.fxData;
    for (let i = 0; i < N; i++) {
      this.lit[i] += (this.litT[i] - this.lit[i]) * kv;
      this.known[i] += (this.knownT[i] - this.known[i]) * kk;
      this.slimeRes[i] *= res;
      this.lavaRes[i] *= res;
      this.slime[i] += (Math.max(this.slimeT[i], this.slimeRes[i] * 0.85) - this.slime[i]) * kg;
      this.lava[i] += (Math.max(this.lavaT[i], this.lavaRes[i] * 0.7) - this.lava[i]) * kg;
      this.heat[i] *= heat;
      this.ooze[i] *= ooze;
      this.scorch[i] *= scorch;
      this.grow[i] *= grow;
      const o = i * 4;
      V[o] = this.lit[i] * 255;
      V[o + 1] = this.known[i] * 255;
      V[o + 2] = this.slime[i] * 255;
      V[o + 3] = this.lava[i] * 255;
      F[o] = this.scorch[i] * 255;
      F[o + 1] = this.heat[i] * 255;
      F[o + 2] = this.ooze[i] * 255;
      F[o + 3] = this.grow[i] * 255;
    }
    this.vis.needsUpdate = true;
    this.fx.needsUpdate = true;
  }

  litAt(x, y) { return this.lit[y * W + x] || 0; }
}
