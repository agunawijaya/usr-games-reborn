// trek/procedural-web — top-level renderer: owns the WebGL context, the
// post chain, the nebula, and switches between the title showcase, the
// tactical view and the galaxy chart.

import * as THREE from 'three';
import { createRenderer, fitRenderer, PROFILES, prefersReducedMotion } from './core.js';
import { Nebula } from './nebula.js';
import { Post } from './post.js';
import { Tactical } from './tactical.js';
import { Chart } from './chart.js';

export class Renderer {
  constructor(canvas, { quality = 'auto', preserve = false } = {}) {
    const { renderer, profile, gpu } = createRenderer(canvas, quality, { preserve });
    this.gl = renderer;
    this.profile = profile;
    this.gpu = gpu;
    this.post = new Post(renderer, profile);
    this.nebula = new Nebula(renderer, profile);
    this.tactical = new Tactical(renderer, profile, this.nebula, this.post);
    this.chart = new Chart(renderer, profile, this.nebula);
    this.mode = 'title';           // 'title' | 'tactical' | 'chart'
    this.reduced = prefersReducedMotion();
    this.time = 0;
    this.last = 0;
    this.frames = 0;
    this.fpsSamples = [];
    this.flash = 0;
    this.resize();
  }

  resize() {
    const cssW = window.innerWidth, cssH = window.innerHeight;
    const { w, h } = fitRenderer(this.gl, this.profile, cssW, cssH);
    this.W = w; this.H = h;
    this.post.setSize(w, h);
    this.tactical.resize(w, h, cssW, cssH);
    this.chart.resize(w, h, cssW, cssH);
  }

  setQuality(name) {
    const base = PROFILES[name];
    this.profile = { ...base, fpsCap: this.gpu.software ? Math.max(base.fpsCap, 30) || 30 : base.fpsCap };
    this.post.setProfile(this.profile);
    this.nebula.setProfile(this.profile);
    this.tactical.applyProfile(this.profile);
    this.tactical.fx.glow.budget = this.tactical.fx.spark.budget = this.profile.particles;
    this.tactical.fx.fire.budget = this.tactical.fx.smoke.budget = this.profile.particles;
    this.tactical.fx.distortScene = this.profile.shimmer ? this.tactical.distortScene : null;
    this.resize();
  }

  setReducedMotion(v) { this.reduced = v; }

  frame(tms) {
    const t = tms / 1000;
    const dt = Math.min(0.1, Math.max(0, t - this.last));
    this.last = t;
    this.time = t;
    const tac = this.tactical;
    tac.reduced = this.reduced;
    tac.showcase = this.mode === 'title';
    tac.update(t, dt);

    const post = this.post;
    const u = post.uniforms;
    const gl = this.gl;
    const chartOn = this.mode === 'chart';
    if (chartOn) {
      this.chart.update(t, dt, this.reduced);
      this.nebula.update(this.W, this.H, t, tac.drift, 0.3, this.reduced ? 0 : 1, 0.12);
    } else {
      this.nebula.update(this.W, this.H, t, tac.drift, 1.0, this.reduced ? 0 : 1, this.mode === 'title' ? 0.8 : 0.28);
    }

    gl.setRenderTarget(post.sceneRT);
    gl.setClearColor(0x000000, 1);
    gl.clear();
    if (chartOn) this.chart.render(gl, this.nebula);
    else gl.render(tac.scene, tac.camera);

    const shimmer = !chartOn && this.profile.shimmer && tac.fx.items.length > 0;
    if (shimmer) {
      post.beginDistort();
      gl.render(tac.distortScene, tac.camera);
    }

    // Lens flares (tactical only).
    const flares = !chartOn && this.profile.flares ? tac.flares() : [];
    u.uFlareCount.value = flares.length;
    flares.forEach((f, i) => {
      u.uFlare.value[i].set(f.x, f.y, f.intensity * 0.8, f.size);
      u.uFlareCol.value[i].setRGB(...f.color);
    });
    const w = chartOn ? { amount: 0, fade: 0 } : tac.warpState();
    u.uWarp.value = w.amount;
    if (w.center) u.uWarpCenter.value.set(w.center[0], w.center[1]);
    u.uWarpSpeed.value = w.speed ?? 1;
    u.uFade.value = w.fade ?? 0;
    u.uFlash.value = chartOn ? 0 : tac.fx.screenFlash;
    u.uGrain.value = this.reduced ? 0.01 : 0.018;
    post.finish(t, shimmer);

    // FPS book-keeping for the quality auto-downgrade and __info.
    this.fpsSamples.push(dt);
    if (this.fpsSamples.length > 90) this.fpsSamples.shift();
    this.frames++;
  }

  /** True while something is moving that deserves full frame rate. */
  get animating() {
    return this.mode === 'chart' || this.tactical.busy;
  }

  get fps() {
    if (!this.fpsSamples.length) return 0;
    const avg = this.fpsSamples.reduce((a, b) => a + b, 0) / this.fpsSamples.length;
    return avg > 0 ? 1 / avg : 0;
  }
}
