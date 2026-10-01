// The stage: one WebGL renderer, one scene, a fixed light rig, the current
// room view (built by a biome kit from a RoomSpec), camera motion, travel
// transitions and effects. Also hosts the dogfight cockpit.

import * as THREE from 'three';
import { Post } from './post.js';
import { matTime } from './materials.js';
import { makeSky, celestial } from './sky.js';
import { buildView } from './kits/index.js';
import { Cockpit } from './cockpit.js';
import { EnvLibrary } from './env.js';
import { setDetail } from './model.js';

const FACING_DEG = { 1010: 0, 1011: 180, 1012: 90, 1013: 270 };
const MOVE_DIR = {
  ahead: [0, 0, 1], back: [0, 0, -1], left: [-1, 0, 0], right: [1, 0, 0], up: [0, 1, 0], down: [0, -1, 0],
};

/** Returns 'high' | 'low' | null (no WebGL) and some renderer facts. */
export function probeGL() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    if (!gl) return { ok: false };
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    const software = /swiftshader|llvmpipe|software|basic render/i.test(String(name));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return { ok: true, name: String(name), software };
  } catch {
    return { ok: false };
  }
}

export class Stage {
  constructor(canvas, { quality = 'high', software = false, reducedMotion = false, highContrast = false } = {}) {
    this.canvas = canvas;
    this.quality = quality;
    this.software = software; // CPU rasteriser: fill rate is everything, render smaller
    this.reducedMotion = reducedMotion;
    this.highContrast = highContrast;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false });
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.shadowMap.enabled = quality === 'high';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.post = new Post(this.renderer, { bloom: quality === 'high', msaa: quality === 'high' ? 4 : 0 });
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.05, 2000);
    this.clock = new THREE.Clock();
    this.t = 0;

    // Fixed light rig: counts never change, so shaders never recompile between rooms.
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x222222, 1);
    this.key = new THREE.DirectionalLight(0xffffff, 1);
    this.key.castShadow = quality === 'high';
    this.key.shadow.mapSize.set(2048, 2048);
    this.key.shadow.bias = -0.0004;
    this.key.shadow.normalBias = 0.03;
    const sc = this.key.shadow.camera;
    sc.left = -30; sc.right = 30; sc.top = 30; sc.bottom = -30; sc.near = 1; sc.far = 200;
    this.scene.add(this.hemi, this.key, this.key.target);
    this.points = [];
    for (let i = 0; i < 4; i++) {
      const p = new THREE.PointLight(0xffffff, 0, 10, 2);
      this.points.push(p);
      this.scene.add(p);
    }
    this.sky = makeSky();
    this.scene.add(this.sky);
    this.envs = new EnvLibrary(this.renderer);

    this.view = null;
    this.spec = null;
    this.camRest = { pos: new THREE.Vector3(0, 1.6, 4), look: new THREE.Vector3(0, 1.6, -10), fov: 60 };
    this.camFrom = null;
    this.camK = 1;
    this.shake = 0;
    this.flash = 0;
    this.flashColor = new THREE.Vector3(1, 1, 1);
    this.cockpit = null;
    this.status = { injuries: 0, fatal: 0, tired: 0, hungry: 0, wizard: 0, alarm: 0 };
    this.onDemand = quality === 'low' && false;
    this.running = true;
    this.frames = 0;
    this.fps = 60;
    this._fpsT = 0;
    this._fpsN = 0;
    this.resize();
    this._raf = requestAnimationFrame(() => this.loop());
    this._ro = new ResizeObserver(() => this.resize());
    this._ro.observe(canvas.parentElement);
  }

  resize() {
    const el = this.canvas.parentElement;
    const w = Math.max(1, el.clientWidth);
    const h = Math.max(1, el.clientHeight);
    const pr = Math.min(window.devicePixelRatio || 1, this.quality === 'high' ? 1.75 : this.software ? 0.6 : 0.85);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.post.setSize(Math.round(w * pr), Math.round(h * pr));
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Shows a room. `move` is the travel verb of the last move event (or null). */
  show(spec, move = null, how = null) {
    const prevSpec = this.spec;
    this.spec = spec;
    const facingDeg = FACING_DEG[spec.facing] ?? 0;
    if (this.view) this.disposeView(this.view);
    setDetail(this.quality);
    this.view = buildView(spec, { quality: this.quality, facingDeg, THREE, stage: this, artStyle: this.artStyle || null });
    this.scene.add(this.view.group);
    if (!this.camera.parent) this.scene.add(this.camera);
    if (this.view.cameraAttach) this.camera.add(this.view.cameraAttach);
    this.applyLights(this.view, spec, facingDeg);
    const c = this.view.camera;
    this.camRest = {
      pos: new THREE.Vector3(...c.pos), look: new THREE.Vector3(...c.look), fov: c.fov ?? 60,
    };
    // Travel transition in the direction of the move.
    if (move && prevSpec && !this.reducedMotion && how !== 'instant') {
      const d = MOVE_DIR[move] || [0, 0, 1];
      const dir2 = [d[0] * 1.0, d[1] * 1.0];
      const zoom = d[2];
      this.post.beginTransition(dir2, zoom, how === 'teleport' ? 0.6 : 0.15);
      // arrive with a small dolly along the travel direction
      const off = new THREE.Vector3(-d[0] * 1.4, -d[1] * 1.0, d[2] * 2.2);
      this.camFrom = { pos: this.camRest.pos.clone().add(off), look: this.camRest.look.clone().add(off.clone().multiplyScalar(0.5)) };
      this.camK = 0;
    } else if (prevSpec && !this.reducedMotion && how !== 'instant') {
      this.post.beginTransition([0, 0], 0, how === 'sleep' ? 1 : 0.4);
      this.camFrom = null;
      this.camK = 1;
    } else {
      this.camFrom = null;
      this.camK = 1;
    }
    this.statusFrom(spec);
  }

  /** Updates only what changes without a rebuild (status, match light, alarm). */
  refresh(spec) {
    const rebuild = !this.spec || spec.room !== this.spec.room || spec.night !== this.spec.night ||
      spec.light.dark !== this.spec.light.dark || spec.facing !== this.spec.facing ||
      JSON.stringify(spec.props) !== JSON.stringify(this.spec.props) || spec.people.join() !== this.spec.people.join() ||
      spec.flying !== this.spec.flying;
    if (rebuild) { this.show(spec, null); return; }
    this.spec = spec;
    if (this.view && this.view.refresh) this.view.refresh(spec);
    this.applyLights(this.view, spec, FACING_DEG[spec.facing] ?? 0);
    this.statusFrom(spec);
  }

  statusFrom(spec) {
    const s = spec.status;
    this.status.injuries = s.injuries;
    this.status.fatal = s.fatal;
    this.status.tired = s.tired;
    this.status.hungry = s.hungry ? 1 : 0;
    this.status.wizard = s.wizard ? 1 : 0;
  }

  applyLights(view, spec, facingDeg) {
    const L = view.lights;
    const sky = this.sky;
    sky.visible = !!view.sky;
    if (view.sky) {
      const cel = celestial(spec.light, facingDeg);
      const u = sky.material.uniforms;
      u.uSun.value.copy(cel.sun);
      if (cel.moon) u.uMoon.value.copy(cel.moon);
      u.uNight.value = cel.night ? 1 : 0;
      u.uSunElev.value = cel.sunElev;
      u.uCloud.value = view.sky.cloud ?? 0.5;
      u.uSeed.value = (spec.seed % 1000) / 37;
      u.uHaze.value.set(...(view.sky.haze || [0.7, 0.8, 0.9]));
      u.uStorm.value = view.sky.storm || 0;
      // key light follows the sun or moon
      if (L.key && L.key.fromSky) {
        const dir = cel.night ? cel.moon : cel.sun;
        const up = cel.night ? cel.moonElev : cel.sunElev;
        const k = Math.max(0, Math.min(1, (up + 4) / 20));
        this.key.position.copy(dir).multiplyScalar(80);
        this.key.target.position.set(0, 0, 0);
        this.key.color.set(cel.night ? 0x8fa6d8 : (cel.sunElev < 15 ? 0xffb070 : 0xfff1dd));
        this.key.intensity = (cel.night ? 1.4 : 2.4) * k * (L.key.scale ?? 1);
      }
    }
    if (L.key && !L.key.fromSky) {
      this.key.position.set(...L.key.dir).multiplyScalar(40);
      this.key.target.position.set(0, 0, 0);
      this.key.color.set(L.key.color);
      this.key.intensity = L.key.intensity;
    }
    if (!L.key) this.key.intensity = 0;
    this.key.castShadow = this.quality === 'high' && !!(L.key && L.key.shadow);
    this.hemi.color.set(L.hemi.sky);
    this.hemi.groundColor.set(L.hemi.ground);
    this.hemi.intensity = L.hemi.intensity;
    this.pointCfg = L.points || [];
    this.points.forEach((p, i) => {
      const c = this.pointCfg[i];
      if (!c) { p.intensity = 0; p.userData.base = 0; p.userData.flicker = 0; p.userData.strobe = 0; return; }
      p.position.set(...c.pos);
      p.color.set(c.color);
      p.distance = c.distance ?? 12;
      p.decay = c.decay ?? 2;
      p.userData.base = c.intensity;
      p.userData.flicker = c.flicker || 0;
      p.userData.strobe = c.strobe || 0;
      p.intensity = c.intensity;
    });
    // image-based light: a procedural environment per mood
    let mood = view.env;
    if (!mood && view.sky) {
      const cel = celestial(spec.light, facingDeg);
      mood = cel.night ? 'night' : cel.sunElev < 12 ? 'dusk' : 'day';
    }
    // A CPU rasteriser pays dearly for image-based light (per-pixel cube
    // sampling): on software Low, drop it and lift the ambient instead.
    const skipEnv = this.software && this.quality === 'low';
    this.scene.environment = skipEnv ? null : this.envs.get(mood || 'ship-mil');
    this.scene.environmentIntensity = view.envIntensity ?? 1;
    if (skipEnv) this.hemi.intensity = L.hemi.intensity + 0.6 * (view.envIntensity ?? 1);
    this.scene.fog = view.fog ? new THREE.FogExp2(view.fog.color, view.fog.density) : null;
    this.scene.background = new THREE.Color(view.background ?? 0x000000);
    const g = this.post.grade;
    const gr = view.grade || {};
    g.uExposure.value = gr.exposure ?? 1;
    g.uSat.value = gr.saturation ?? 1;
    g.uContrast.value = gr.contrast ?? 1;
    g.uTint.value.set(...(gr.tint || [1, 1, 1]));
    g.uLift.value.set(...(gr.lift || [0, 0, 0]));
    g.uVignette.value = gr.vignette ?? 0.35;
    g.uBloom.value = gr.bloom ?? 0.55;
    g.uGrain.value = gr.grain ?? 0.02;
    g.uHC.value = this.highContrast ? 1 : 0;
    this.post.pBright.uniforms.uThreshold.value = gr.threshold ?? 1.0;
  }

  disposeView(v) {
    this.scene.remove(v.group);
    if (v.cameraAttach) this.camera.remove(v.cameraAttach);
    v.group.traverse((o) => {
      if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
    });
    if (v.dispose) v.dispose();
  }

  /** One-shot effects driven by engine events. */
  fx(type, data = {}) {
    if (this.reducedMotion && (type === 'shake')) return;
    switch (type) {
      case 'shake': this.shake = Math.max(this.shake, data.amount ?? 0.6); break;
      case 'flash':
        this.flash = Math.max(this.flash, data.amount ?? 0.8);
        this.flashColor.set(...(data.color || [1, 1, 1]));
        break;
      default:
        if (this.view && this.view.fx) this.view.fx(type, data);
    }
  }

  /** Enters or leaves the dogfight cockpit. */
  setFlight(sim, opts = {}) {
    if (sim && !this.cockpit) {
      this.cockpit = new Cockpit(this, sim, opts);
      this.post.beginTransition([0, -1], 0, 0.8);
    } else if (!sim && this.cockpit) {
      this.cockpit.dispose();
      this.cockpit = null;
      this.post.beginTransition([0, 1], 0, 0.8);
    } else if (sim && this.cockpit) this.cockpit.sim = sim;
  }

  loop() {
    if (!this.running) return;
    this._raf = requestAnimationFrame(() => this.loop());
    // animation steps are clamped; transitions and the fps meter use real time
    // so a slow (software) renderer does not leave a slide half-finished
    const raw = this.clock.getDelta();
    const dt = Math.min(0.05, raw);
    this.rawDt = Math.min(0.25, raw);
    this.t += dt;
    matTime.value = this.t;
    // fps meter
    this._fpsT += raw; this._fpsN++;
    if (this._fpsT > 1) { this.fps = this._fpsN / this._fpsT; this._fpsT = 0; this._fpsN = 0; }
    if (this.cockpit) {
      this.cockpit.update(this.t, dt);
      this.renderFrame(this.cockpit.scene, this.cockpit.camera, dt);
      return;
    }
    this.animateCamera(dt);
    this.animateLights();
    if (this.view && this.view.update) this.view.update(this.t, dt, this.camera);
    this.sky.position.copy(this.camera.position);
    this.sky.material.uniforms.uTime.value = this.t;
    this.renderFrame(this.scene, this.camera, dt);
  }

  renderFrame(scene, camera, dt) {
    const g = this.post.grade;
    g.uTime.value = this.t;
    g.uInjury.value = this.status.injuries;
    g.uFatal.value = this.status.fatal;
    g.uTired.value = this.status.tired;
    g.uHungry.value = this.status.hungry;
    g.uWizard.value = this.status.wizard;
    g.uAlarm.value = this.cockpit ? 0 : this.alarmLevel();
    this.flash = Math.max(0, this.flash - dt * 2.2);
    g.uFlash.value = this.flash;
    g.uFlashColor.value.copy(this.flashColor);
    this.post.render(scene, camera, this.rawDt ?? dt, this.reducedMotion ? 4 : 1.25);
    this.afterFrame?.(this.canvas); // /usr/games Reborn: key art for the Hall, same task as the draw
  }

  alarmLevel() {
    const s = this.spec;
    if (!s || s.biome !== 'ship') return 0;
    const a = s.light.alert;
    if (this.reducedMotion) return a * 0.08;
    const rate = 0.8 + a * 2.2;
    const pulse = Math.pow(0.5 + 0.5 * Math.sin(this.t * Math.PI * rate), 4);
    return pulse * (0.04 + 0.16 * a);
  }

  animateCamera(dt) {
    const rest = this.camRest;
    this.camK = Math.min(1, this.camK + dt * (this.reducedMotion ? 10 : 1.1));
    const e = 1 - Math.pow(1 - this.camK, 3);
    const pos = this.camFrom ? this.camFrom.pos.clone().lerp(rest.pos, e) : rest.pos.clone();
    const look = this.camFrom ? this.camFrom.look.clone().lerp(rest.look, e) : rest.look.clone();
    // breathing sway
    if (!this.reducedMotion) {
      const s = this.view && this.view.sway !== undefined ? this.view.sway : 1;
      pos.x += Math.sin(this.t * 0.5) * 0.03 * s;
      pos.y += Math.sin(this.t * 0.8) * 0.02 * s;
      look.x += Math.sin(this.t * 0.31) * 0.08 * s;
    }
    if (this.shake > 0) {
      const k = this.shake * 0.12;
      pos.x += (Math.random() - 0.5) * k;
      pos.y += (Math.random() - 0.5) * k;
      look.x += (Math.random() - 0.5) * k * 2;
      this.shake = Math.max(0, this.shake - dt * 1.4);
    }
    this.camera.position.copy(pos);
    this.camera.lookAt(look);
    if (this.camera.fov !== rest.fov) { this.camera.fov = rest.fov; this.camera.updateProjectionMatrix(); }
  }

  animateLights() {
    const t = this.t;
    for (const p of this.points) {
      const base = p.userData.base || 0;
      if (!base) continue;
      let k = 1;
      if (p.userData.flicker) k *= 1 - p.userData.flicker * (0.5 + 0.5 * Math.sin(t * 17 + Math.sin(t * 7.3) * 3)) * 0.6;
      if (p.userData.strobe && !this.reducedMotion) {
        const r = p.userData.strobe;
        k *= Math.pow(0.5 + 0.5 * Math.sin(t * Math.PI * r), 6);
      }
      p.intensity = base * k;
    }
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this._raf);
    this._ro.disconnect();
  }

  info() {
    return { fps: Math.round(this.fps), quality: this.quality, calls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles, programs: this.renderer.info.programs?.length };
  }
}
