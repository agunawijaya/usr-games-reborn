// Selene renderer: owns the WebGL2 context, bakes the procedural Moon
// surface progressively (a few tiles per frame), draws the night scene,
// and renders mini Moons for the calendar with the same shader.

import { createContext, startProgram, programReady, finishProgram, setUniforms, createTarget, drawFullscreen } from './gl.js';
import { BAKE_SURFACE, BAKE_SLOPES } from './shaders/bake.js';
import { SCENE } from './shaders/scene.js';
import { featureUniforms } from './features.js';

const DEG = Math.PI / 180;

/** Sun direction in view space from pom's elongation D (degrees). */
export function sunVector(elongationDeg) {
  const D = elongationDeg * DEG;
  // D = 0: Sun behind the Moon (New). D = 90: lit from the right (First Q,
  // northern-hemisphere view). D = 180: Sun behind the observer (Full).
  return [Math.sin(D), 0, -Math.cos(D)];
}

/** Rotation matrix (column-major mat3) for small drag offsets (radians). */
export function surfaceRotation(yaw, pitch) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  // R = Rx(pitch) * Ry(yaw), maps selenographic -> view
  const m = [
    cy, sp * sy, -cp * sy,
    0, cp, sp,
    sy, -sp * cy, cp * cy,
  ];
  return new Float32Array(m);
}

/**
 * True if a WebGL renderer string names a CPU rasteriser rather than a GPU
 * (Chrome's SwiftShader, Mesa's llvmpipe/softpipe, Windows' WARP adapter).
 */
export function looksSoftware(rendererName) {
  return /swiftshader|llvmpipe|softpipe|software|basic render|warp|lavapipe/i.test(rendererName || '');
}

/** Detect a CPU-only WebGL context: renderer name, then the browser's own verdict. */
function detectSoftware(gl) {
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const name = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  if (looksSoftware(name)) return { software: true, name };
  // A browser refuses a context with failIfMajorPerformanceCaveat when it
  // would have to fall back to software rendering.
  let caveat = false;
  try {
    const probe = document.createElement('canvas').getContext('webgl2', { failIfMajorPerformanceCaveat: true });
    caveat = !probe;
    probe?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch { /* ignore */ }
  return { software: caveat, name };
}

export class Renderer {
  /**
   * quality: 'auto' | 'high' | 'lite'. 'auto' becomes 'lite' on a CPU-only
   * (software) WebGL context: a smaller surface texture, finer bake tiles.
   */
  constructor(canvas, { quality = 'auto', lowPrecision = false } = {}) {
    const ctx = createContext(canvas);
    if (!ctx) throw new Error('WebGL2 unavailable');
    this.canvas = canvas;
    this.gl = ctx.gl;
    this.floatRT = ctx.floatRT && !lowPrecision;   // lowPrecision: test the 8-bit path
    const gl = this.gl;

    const sw = detectSoftware(gl);
    this.rendererName = sw.name;
    this.software = sw.software;
    this.lite = quality === 'lite' || (quality === 'auto' && sw.software);

    const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    const mem = navigator.deviceMemory ?? 8;
    const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
    const big = quality === 'high' || (quality === 'auto' && !this.lite && maxTex >= 8192 && mem >= 4 && !mobile);
    this.texW = this.lite ? 1024 : big ? 4096 : 2048;
    this.texH = this.texW / 2;
    this.encode = this.floatRT ? 0 : 1;

    // Start all three programs at once; they compile in parallel and are
    // collected by bakeStep() without blocking the page (KHR_parallel_shader_compile).
    this.compileStarted = performance.now();
    this.pending = [
      startProgram(gl, BAKE_SURFACE, 'bake-surface'),
      startProgram(gl, BAKE_SLOPES, 'bake-slopes'),
      startProgram(gl, SCENE, 'scene'),
    ];
    this.phase = 'compile';

    const fmt1 = this.floatRT ? 'rgba16f' : 'rgba8';
    const fmt2 = this.floatRT ? 'rg16f' : 'rg8';
    this.t1 = createTarget(gl, this.texW, this.texH, fmt1, { mipmaps: true, wrapS: 'repeat' });
    this.t2 = createTarget(gl, this.texW, this.texH, fmt2, { mipmaps: true, wrapS: 'repeat' });

    this.tile = 0;
    // small tiles on a CPU rasteriser so each frame stays short and progress shows
    this.tileRows = this.lite ? 16 : this.texW >= 4096 ? 64 : 128;
    this.tilesPerPass = this.texH / this.tileRows;
    this.baked = false;
    this.bakeStarted = performance.now();
    this.miniTarget = null;
  }

  /** Advance the progressive bake; returns progress 0..1. */
  bakeStep(budgetMs = 10) {
    if (this.baked) return 1;
    if (this.pending) {
      if (!this.pending.every((p) => programReady(this.gl, p))) return 0;
      [this.bakeProg, this.slopeProg, this.sceneProg] = this.pending.map((p) => finishProgram(this.gl, p));
      this.pending = null;
      this.compileMs = performance.now() - this.compileStarted;
      this.phase = 'bake';
      this.bakeStarted = performance.now();
    }
    const gl = this.gl;
    const total = this.tilesPerPass * 2;
    const t0 = performance.now();
    const fu = featureUniforms();
    while (this.tile < total && performance.now() - t0 < budgetMs) {
      const passB = this.tile >= this.tilesPerPass;
      const row = (this.tile % this.tilesPerPass) * this.tileRows;
      const target = passB ? this.t2 : this.t1;
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
      gl.viewport(0, 0, this.texW, this.texH);
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(0, row, this.texW, this.tileRows);
      if (!passB) {
        const p = this.bakeProg;
        gl.useProgram(p.prog);
        setUniforms(gl, p, {
          uSize: [this.texW, this.texH],
          uMaxFreq: this.texW >= 4096 ? 110 : this.texW >= 2048 ? 60 : 30,
          uEncode: this.encode,
        });
        gl.uniform1i(p.loc.uMariaCount, fu.mariaCount);
        gl.uniform4fv(p.loc.uMariaA, fu.mariaA);
        gl.uniform4fv(p.loc.uMariaB, fu.mariaB);
        gl.uniform1i(p.loc.uCraterCount, fu.craterCount);
        gl.uniform4fv(p.loc.uCraterA, fu.craterA);
        gl.uniform4fv(p.loc.uCraterB, fu.craterB);
      } else {
        if (this.tile === this.tilesPerPass) {
          gl.bindTexture(gl.TEXTURE_2D, this.t1.tex);
          gl.generateMipmap(gl.TEXTURE_2D);
        }
        const p = this.slopeProg;
        gl.useProgram(p.prog);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.t1.tex);
        gl.uniform1i(p.loc.uT1, 0);
        setUniforms(gl, p, { uSize: [this.texW, this.texH], uEncode: this.encode });
      }
      drawFullscreen(gl);
      gl.disable(gl.SCISSOR_TEST);
      this.tile++;
      // force the tile to finish so one frame never holds too much GPU work
      gl.finish?.call(gl);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (this.tile >= total) {
      gl.bindTexture(gl.TEXTURE_2D, this.t2.tex);
      gl.generateMipmap(gl.TEXTURE_2D);
      this.baked = true;
      this.phase = 'done';
      this.bakeMs = performance.now() - this.bakeStarted;
    }
    return this.tile / total;
  }

  _bindSurface(p) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.t1.tex);
    gl.uniform1i(p.loc.uT1, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.t2.tex);
    gl.uniform1i(p.loc.uT2, 1);
  }

  /**
   * Draw the full scene.
   * s = { width, height, dpr, time, moon: {x, y, r} (CSS px, top-left origin),
   *       elongation, illuminated, yaw, pitch, ready, hc, motion, horizon }
   */
  render(s) {
    const gl = this.gl;
    if (!this.sceneProg) return;   // still compiling
    const W = Math.round(s.width * s.dpr);
    const H = Math.round(s.height * s.dpr);
    if (this.canvas.width !== W || this.canvas.height !== H) {
      this.canvas.width = W;
      this.canvas.height = H;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    const p = this.sceneProg;
    gl.useProgram(p.prog);
    this._bindSurface(p);
    setUniforms(gl, p, {
      uRes: [W, H],
      uDpr: s.dpr,
      uTime: s.time,
      uMode: 0,
      uMoonC: [s.moon.x * s.dpr, (s.height - s.moon.y) * s.dpr],
      uMoonR: s.moon.r * s.dpr,
      uSun: sunVector(s.elongation),
      uIllum: s.illuminated,
      uCosD: Math.cos(s.elongation * DEG),
      uRot: { mat3: surfaceRotation(s.yaw, s.pitch) },
      uTexSize: [this.texW, this.texH],
      uEncode: this.encode,
      uReady: Math.min(Math.max(s.ready, 0), 1),
      uHC: s.hc ? 1 : 0,
      uMotion: s.motion ? 1 : 0,
      uHorizon: s.horizon,
      uRelief: 1.3,
      uExposure: s.exposure ?? 1.0,
    });
    drawFullscreen(gl);
  }

  /**
   * Render a mini Moon (same shader) and return its pixels as ImageData
   * (straight alpha), ready for a 2-D canvas.
   */
  renderMini(size, elongation, illuminated, { hc = false } = {}) {
    const gl = this.gl;
    if (!this.sceneProg) return null;   // still compiling
    if (!this.miniTarget || this.miniTarget.w !== size) {
      this.miniTarget = createTarget(gl, size, size, 'rgba8');
      this.miniBuf = new Uint8Array(size * size * 4);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.miniTarget.fbo);
    gl.viewport(0, 0, size, size);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const p = this.sceneProg;
    gl.useProgram(p.prog);
    this._bindSurface(p);
    setUniforms(gl, p, {
      uRes: [size, size],
      uDpr: 1,
      uTime: 0,
      uMode: 1,
      uSun: sunVector(elongation),
      uIllum: illuminated,
      uRot: { mat3: surfaceRotation(0, 0) },
      uTexSize: [this.texW, this.texH],
      uEncode: this.encode,
      uReady: 1,
      uHC: hc ? 1 : 0,
      uMotion: 0,
      uRelief: 1.3,
      uExposure: 1.0,
    });
    drawFullscreen(gl);
    gl.readPixels(0, 0, size, size, gl.RGBA, gl.UNSIGNED_BYTE, this.miniBuf);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    // flip rows (GL origin is bottom-left)
    const img = new ImageData(size, size);
    const row = size * 4;
    for (let y = 0; y < size; y++) {
      img.data.set(this.miniBuf.subarray((size - 1 - y) * row, (size - y) * row), y * row);
    }
    return img;
  }
}
