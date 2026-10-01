// Abyssal Worms renderer: the WebGL2 pass graph of port ADR-001.
//
//   light map (1/4 res)  worms as wide soft ribbons, additive, blurred
//   scene (HDR)          sea floor lit by the light map, worms, marine snow
//   bloom                bright pass, dual-filter down/up chain
//   composite            ACES tone map, in-water scatter, grain, dither
//
// The engine world is read, never written. Cell data (ref counts, field
// letters, trail dots, event times) is uploaded once per engine step.

import {
  createContext, startProgram, programReady, finishProgram, setUniforms,
  createTarget, drawFullscreen, bindTarget, clearTarget, createCellTexture, disposeTarget,
} from './gl.js';
import { FLOOR } from './shaders/floor.js';
import { WORM_VS, WORM_FS, LIGHT_FS, TRAIL_FS } from './shaders/worm.js';
import { BLUR_FS, PREFILTER_FS, DOWN_FS, UP_FS, COMPOSITE_FS, SNOW_VS, SNOW_FS } from './shaders/post.js';
import { slidingPath, writeRibbon, writeTrail, FLOATS_PER_VERTEX } from './geometry.js';
import { SPECIES, speciesOf } from './species.js';
import { bodyCells } from '../engine/worms.js';

/** True if a WebGL renderer string names a CPU rasteriser rather than a GPU. */
export function looksSoftware(name) {
  return /swiftshader|llvmpipe|softpipe|software|basic render|lavapipe/i.test(name || '');
}

const GLYPH = { 87: 1, 79: 2, 82: 3, 77: 4 }; // W O R M
const DOT = 46;

export class WormRenderer {
  constructor(canvas) {
    const ctx = createContext(canvas, { alpha: false });
    if (!ctx) throw new Error('WebGL2 unavailable');
    this.canvas = canvas;
    this.gl = ctx.gl;
    this.floatRT = ctx.floatRT;
    const gl = this.gl;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    this.rendererName = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    this.software = looksSoftware(this.rendererName);

    // all programs compile in parallel (KHR_parallel_shader_compile), see ready()
    this.pending = {
      floor: startProgram(gl, FLOOR, 'floor'),
      worm: startProgram(gl, WORM_FS, 'worm', WORM_VS),
      light: startProgram(gl, LIGHT_FS, 'light', WORM_VS),
      blur: startProgram(gl, BLUR_FS, 'blur'),
      prefilter: startProgram(gl, PREFILTER_FS, 'prefilter'),
      down: startProgram(gl, DOWN_FS, 'down'),
      up: startProgram(gl, UP_FS, 'up'),
      composite: startProgram(gl, COMPOSITE_FS, 'composite'),
      snow: startProgram(gl, SNOW_FS, 'snow', SNOW_VS),
      trail: startProgram(gl, TRAIL_FS, 'trail', WORM_VS),
    };
    this.p = null;

    // ribbon vertex stream (rebuilt each frame)
    this.vao = gl.createVertexArray();
    this.vbo = gl.createBuffer();
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    const stride = FLOATS_PER_VERTEX * 4;
    const attrs = [[0, 2, 0], [1, 2, 8], [2, 1, 16], [3, 1, 20], [4, 1, 24], [5, 1, 28]];
    for (const [loc, size, off] of attrs) {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, off);
    }
    gl.bindVertexArray(null);
    this.verts = new Float32Array(1 << 16);

    this.snowVao = gl.createVertexArray();
    this.snowVbo = gl.createBuffer();
    this.snowCount = 0;

    this.targets = null;
    this.world = null;
    this.snaps = [];
  }

  /** Poll the parallel compile; true once every program is linked. */
  ready() {
    if (this.p) return true;
    const gl = this.gl;
    if (!Object.values(this.pending).every((pp) => programReady(gl, pp))) return false;
    this.p = {};
    for (const [k, pp] of Object.entries(this.pending)) this.p[k] = finishProgram(gl, pp);
    this.pending = null;
    return true;
  }

  // ---------------------------------------------------------------- world
  setWorld(world, time) {
    const gl = this.gl;
    this.world = world;
    const { cols, rows } = world;
    this.cellTex?.dispose();
    this.timeTex?.dispose();
    this.cellTex = createCellTexture(gl, cols, rows, 'u8x4');
    this.timeTex = createCellTexture(gl, cols, rows, 'f32x4');
    this.cellData = new Uint8Array(cols * rows * 4);
    this.timeData = new Float32Array(cols * rows * 4).fill(-1);
    for (let i = 0; i < cols * rows; i++) { this.timeData[i * 4 + 2] = 0; this.timeData[i * 4 + 3] = 0; }
    this.snaps = world.worms.map((_, n) => ({ prev: [], curr: bodyCells(world, n) }));
    this.trails = world.worms.map(() => []);
    this.syncCells(time, true);
  }

  /** Call after every engine step (and after live edits). */
  onStep(time, { snap = false } = {}) {
    const w = this.world;
    while (this.snaps.length < w.worms.length) this.snaps.push({ prev: [], curr: [] });
    this.snaps.length = w.worms.length;
    while (this.trails.length < w.worms.length) this.trails.push([]);
    this.trails.length = w.worms.length;
    for (let n = 0; n < w.worms.length; n++) {
      const s = this.snaps[n];
      s.prev = snap ? bodyCells(w, n) : s.curr;
      s.curr = bodyCells(w, n);
      // -t: remember where the tail just left, for the luminous trail
      if (w.trail === DOT && !snap && s.prev.length === s.curr.length && s.prev.length > 1) {
        const tr = this.trails[n];
        const [x, y] = s.prev[0];
        const last = tr[tr.length - 1];
        if (last && !last.gap && Math.max(Math.abs(last.x - x), Math.abs(last.y - y)) > 1) tr.push({ gap: true });
        tr.push({ x, y, t: time });
        if (tr.length > 900) tr.splice(0, tr.length - 900);
      }
    }
    const td = this.timeData;
    if (w.trail === DOT) {
      w.erased.forEach((i, k) => {
        td[i * 4] = time;
        td[i * 4 + 2] = Math.max(0, w.erasedBy[k]) % SPECIES.length;
      });
    }
    w.ate.forEach((i, k) => {
      td[i * 4 + 1] = time;
      td[i * 4 + 3] = w.ateBy[k] % SPECIES.length;
    });
    this.syncCells(time);
  }

  /** Rebuild the per-cell texture from the engine state. */
  syncCells(time, all = false) {
    const w = this.world;
    const cd = this.cellData;
    const n = w.cols * w.rows;
    for (let i = 0; i < n; i++) {
      const r = w.ref[i];
      const ch = w.screen[i];
      cd[i * 4] = Math.min(r, 255);
      cd[i * 4 + 1] = r === 0 ? (GLYPH[ch] || 0) : 0;
      cd[i * 4 + 2] = ch === DOT ? 255 : 0;
      if (all && ch !== DOT) this.timeData[i * 4] = -1;
    }
    if (!w.trail || w.trail !== DOT) {
      // trail switched off: forget old trail glow
      for (let i = 0; i < n; i++) if (cd[i * 4 + 2] === 0) this.timeData[i * 4] = -1;
    }
    this.cellTex.upload(cd);
    this.timeTex.upload(this.timeData);
  }

  clearTrails() {
    this.trails = this.trails.map(() => []);
    for (let i = 0; i < this.world.cols * this.world.rows; i++) this.timeData[i * 4] = -1;
    this.timeTex.upload(this.timeData);
  }

  // ------------------------------------------------------------- targets
  resize(W, H, high) {
    const gl = this.gl;
    const key = `${W}x${H}:${high}`;
    if (this.targets?.key === key) return;
    if (this.targets) for (const t of this.targets.all) disposeTarget(gl, t);
    const fmt = this.floatRT ? 'rgba16f' : 'rgba8';
    const mk = (w, h) => createTarget(gl, Math.max(1, Math.round(w)), Math.max(1, Math.round(h)), fmt);
    const scene = mk(W, H);
    const lightA = mk(W / 4, H / 4);
    const lightB = mk(W / 4, H / 4);
    const mips = [];
    const levels = high ? 6 : 4;
    for (let i = 0; i < levels; i++) mips.push(mk(W / 2 ** (i + 1), H / 2 ** (i + 1)));
    this.targets = { key, scene, lightA, lightB, mips, all: [scene, lightA, lightB, ...mips] };

    // marine snow seeds
    const count = high ? 2400 : 700;
    const seeds = new Float32Array(count * 4);
    let s = 12345;
    const rnd = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
    for (let i = 0; i < count; i++) {
      seeds[i * 4] = rnd();
      seeds[i * 4 + 1] = rnd();
      seeds[i * 4 + 2] = Math.pow(rnd(), 2.2);
      seeds[i * 4 + 3] = rnd();
    }
    gl.bindVertexArray(this.snowVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.snowVbo);
    gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 16, 0);
    gl.bindVertexArray(null);
    this.snowCount = count;
  }

  // --------------------------------------------------------------- frame
  /**
   * s = { width, height, dpr (device px per css px, already quality-scaled),
   *       cell (css px), origin [x, y] (css px), f (step fraction), time,
   *       high, motion, glow, bloom, exposure, field, trail }
   */
  render(s) {
    if (!this.ready() || !this.world) return false;
    const gl = this.gl;
    const W = Math.max(1, Math.round(s.width * s.dpr));
    const H = Math.max(1, Math.round(s.height * s.dpr));
    if (this.canvas.width !== W || this.canvas.height !== H) {
      this.canvas.width = W;
      this.canvas.height = H;
    }
    this.resize(W, H, s.high);
    const T = this.targets;
    const cell = s.cell * s.dpr;
    const origin = [s.origin[0] * s.dpr, s.origin[1] * s.dpr];
    const w = this.world;
    const anim = s.animTime ?? s.time;   // frozen under reduced motion

    // ---- ribbons (CPU) ----
    const draws = [];
    let o = 0;
    const spc = s.high ? 7 : 4;
    const need = w.worms.length * (w.length + 3) * spc * 2 * FLOATS_PER_VERTEX + 64;
    if (this.verts.length < need) this.verts = new Float32Array(need * 1.5);
    for (let n = 0; n < w.worms.length; n++) {
      const sp = speciesOf(n);
      const snap = this.snaps[n];
      const path = slidingPath(snap.prev, snap.curr);
      const first = o / FLOATS_PER_VERTEX;
      const count = writeRibbon(this.verts, o, path, {
        f: s.f, samplesPerCell: spc, width: 0.44 * sp.width, sway: s.motion ? sp.sway : 0, rings: sp.rings,
        time: anim, phase: n * 1.7,
      });
      o += count * FLOATS_PER_VERTEX;
      if (count > 0) draws.push({ n, first, count, sp });
    }
    // -t trails: smooth strips along each worm's recent tail path
    const trailDraws = [];
    if (s.trail) {
      for (let n = 0; n < this.trails.length; n++) {
        // split the history at gaps (live edits can teleport a tail)
        let seg = [];
        const flush = () => {
          if (seg.length > 1) {
            const need2 = o + (seg.length + 2) * spc * 2 * FLOATS_PER_VERTEX;
            if (this.verts.length < need2) {
              const nv = new Float32Array(need2 * 1.5);
              nv.set(this.verts.subarray(0, o));
              this.verts = nv;
            }
            const first = o / FLOATS_PER_VERTEX;
            const count = writeTrail(this.verts, o, seg, { now: s.time, fade: 10, width: 0.16, samplesPerCell: Math.max(2, spc - 3) });
            o += count * FLOATS_PER_VERTEX;
            if (count > 0) trailDraws.push({ n, first, count, sp: speciesOf(n) });
          }
          seg = [];
        };
        for (const pt of this.trails[n]) { if (pt.gap) flush(); else seg.push(pt); }
        flush();
      }
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.verts.subarray(0, o), gl.DYNAMIC_DRAW);

    const common = { uCanvas: [W, H], uOrigin: origin, uCell: cell, uTime: anim, uGrid: [w.cols, w.rows] };
    const bindTex = (p, name, unit, tex) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(p.loc[name], unit);
    };
    const drawWorms = (p, extra, mode = gl.TRIANGLE_STRIP, list = draws) => {
      gl.useProgram(p.prog);
      setUniforms(gl, p, { ...common, ...extra });
      bindTex(p, 'uCells', 0, this.cellTex.tex);
      if (p.loc.uLight) bindTex(p, 'uLight', 1, T.lightA.tex);
      gl.bindVertexArray(this.vao);
      for (const d of list) {
        setUniforms(gl, p, {
          uCoreC: d.sp.core, uRimC: d.sp.rim, uRings: d.sp.rings, uPulse: d.sp.pulse, uPhase: d.n * 1.7,
          uSpeciesLight: d.sp.width * d.sp.width,   // thin worms cast less light
        });
        if (p.loc.uPattern) gl.uniform1i(p.loc.uPattern, d.sp.pattern);
        gl.drawArrays(mode, d.first, d.count);
      }
      gl.bindVertexArray(null);
    };

    // ---- 1. light map ----
    clearTarget(gl, T.lightA);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    const lightRadius = 4.8 * cell / 4;   // px in the quarter-res target
    drawWorms(this.p.light, {
      uWidthMul: 0.0, uWidthAdd: 0.0, uPointSize: Math.min(lightRadius * 2, 255),
      uDensity: 0.06 / spc, uRes: [T.lightA.w, T.lightA.h],
    }, gl.POINTS);
    // fresh trails cast a little light on the sediment too
    if (trailDraws.length) {
      drawWorms(this.p.trail, { uWidthMul: 7.0, uWidthAdd: 0.0, uPointSize: 1, uGain: 0.05, uRes: [T.lightA.w, T.lightA.h] }, gl.TRIANGLE_STRIP, trailDraws);
    }
    gl.disable(gl.BLEND);
    const blur = (src, dst, dx, dy) => {
      bindTarget(gl, dst);
      gl.useProgram(this.p.blur.prog);
      bindTex(this.p.blur, 'uSrc', 0, src.tex);
      setUniforms(gl, this.p.blur, { uDir: [dx / src.w, dy / src.h] });
      drawFullscreen(gl);
    };
    for (let k = 0; k < (s.high ? 2 : 1); k++) {
      blur(T.lightA, T.lightB, 1, 0);
      blur(T.lightB, T.lightA, 0, 1);
    }

    // ---- 2. scene ----
    bindTarget(gl, T.scene);
    const pf = this.p.floor;
    gl.useProgram(pf.prog);
    setUniforms(gl, pf, {
      uRes: [W, H], uOrigin: origin, uCell: cell, uGrid: [w.cols, w.rows], uTime: anim, uNow: s.time,
      uHigh: s.high ? 1 : 0, uTrailOn: s.trail ? 1 : 0, uFieldOn: s.field ? 1 : 0,
    });
    gl.uniform3fv(pf.loc.uCore, new Float32Array(SPECIES.flatMap((x) => x.core)));
    bindTex(pf, 'uLight', 0, T.lightA.tex);
    bindTex(pf, 'uCells', 1, this.cellTex.tex);
    bindTex(pf, 'uTimes', 2, this.timeTex.tex);
    drawFullscreen(gl);

    gl.enable(gl.BLEND);
    if (trailDraws.length) {
      gl.blendFunc(gl.ONE, gl.ONE);
      drawWorms(this.p.trail, { uWidthMul: 1.0, uWidthAdd: 0.0, uPointSize: 1, uGain: 0.55, uRes: [W, H] }, gl.TRIANGLE_STRIP, trailDraws);
    }
    // bodies: premultiplied, translucent tissue + emission
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    drawWorms(this.p.worm, { uWidthMul: 1.0, uWidthAdd: 0.0, uPointSize: 1, uRes: [W, H], uGlow: s.glow });
    // marine snow, additive, above everything
    gl.blendFunc(gl.ONE, gl.ONE);
    const ps = this.p.snow;
    gl.useProgram(ps.prog);
    setUniforms(gl, ps, { uCanvas: [W, H], uTime: anim, uDpr: s.dpr, uMotion: s.motion ? 1 : 0 });
    bindTex(ps, 'uLight', 0, T.lightA.tex);
    gl.bindVertexArray(this.snowVao);
    gl.drawArrays(gl.POINTS, 0, this.snowCount);
    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);

    // ---- 3. bloom ----
    bindTarget(gl, T.mips[0]);
    gl.useProgram(this.p.prefilter.prog);
    bindTex(this.p.prefilter, 'uSrc', 0, T.scene.tex);
    setUniforms(gl, this.p.prefilter, { uThreshold: 0.35 });
    drawFullscreen(gl);
    for (let i = 1; i < T.mips.length; i++) {
      bindTarget(gl, T.mips[i]);
      gl.useProgram(this.p.down.prog);
      bindTex(this.p.down, 'uSrc', 0, T.mips[i - 1].tex);
      drawFullscreen(gl);
    }
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    for (let i = T.mips.length - 1; i > 0; i--) {
      bindTarget(gl, T.mips[i - 1]);
      gl.useProgram(this.p.up.prog);
      bindTex(this.p.up, 'uSrc', 0, T.mips[i].tex);
      setUniforms(gl, this.p.up, { uWeight: 1.0 });
      drawFullscreen(gl);
    }
    gl.disable(gl.BLEND);

    // ---- 4. composite ----
    bindTarget(gl, null, W, H);
    const pc = this.p.composite;
    gl.useProgram(pc.prog);
    bindTex(pc, 'uScene', 0, T.scene.tex);
    bindTex(pc, 'uBloom', 1, T.mips[0].tex);
    bindTex(pc, 'uLight', 2, T.lightA.tex);
    setUniforms(gl, pc, { uRes: [W, H], uBloomAmt: s.bloom, uTime: s.time, uExposure: s.exposure });
    drawFullscreen(gl);
    return true;
  }
}
