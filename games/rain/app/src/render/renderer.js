// The modern view: wave simulation -> scene -> particles -> bloom -> screen.
//
// Quality profiles (README "Requirements"):
//   high  full grid, full-resolution scene, bloom
//   low   half grid, scene at a reduced scale, cheaper clouds
// A software rasteriser starts on low; no WebGL2 or no float render
// targets -> the caller falls back to the classic view.
import {
  createContext, isSoftware, FULLSCREEN_VS, startProgram, ready, finishProgram,
  createTarget, useTexture,
} from './gl.js';
import { SIM_FS, MAX_IMPULSES } from './shaders/sim.js';
import { SCENE_FS, ENV_FS, MAX_LAMPS } from './shaders/scene.js';
import { DOWN_FS, UP_FS, COMPOSITE_FS } from './shaders/post.js';
import { createPond, WAVE_SPEED } from './geometry.js';
import { createParticles } from './particles.js';

export const PROFILES = {
  high: { grid: 'high', scale: 1.0, oct: 6, bloom: 5, maxPixels: 2560 * 1440, env: [1024, 384], envEvery: 1, skyEnv: false, streaks: 1 },
  low: { grid: 'low', scale: 0.5, oct: 4, bloom: 3, maxPixels: 1280 * 720, env: [768, 256], envEvery: 3, skyEnv: true, streaks: 0.5 },
  // software rasterisers only: the canvas itself is drawn at half size
  lite: { grid: 'low', scale: 1.0, canvasScale: 0.5, oct: 3, bloom: 0, maxPixels: 960 * 540, env: [512, 192], envEvery: 4, skyEnv: true, streaks: 0.3 },
};
// the environment map covers these azimuths and heights (sin elevation)
const ENV_MAP = [-1.3, 1.3, -0.02, 0.95];

const DAMPING = 0.75; // 1/s: a ring is mostly gone after ~3 s

// The stage table of ADR-003: what each age of a drop does to the water.
// sigma in metres, amplitude in millimetres, ring radius in metres.
export const IMPULSES = [
  { sigma: 0.012, amp: -3.0, ring: 0 }, // 0 "."  impact: a crater
  { sigma: 0.010, amp: 1.3, ring: 0.028 }, // 1 "o"  the crown collapses: a ring
  { sigma: 0.009, amp: 2.4, ring: 0 }, // 2 "O"  the jet
  { sigma: 0.012, amp: -1.1, ring: 0 }, // 3 ring  the droplet falls back
  { sigma: 0.016, amp: 0.6, ring: 0 }, // 4 ring  the rebound
  null, // 5 erased: nothing new; the rings run on
];

// Lanterns on the far bank: azimuth as a fraction of the terminal's half
// width, height above the water (m), bokeh radius (rad), power, warmth.
const LAMPS = [
  [-0.74, 1.6, 0.0085, 3.2, 1.0],
  [-0.69, 1.3, 0.0060, 1.8, 0.9],
  [0.16, 2.1, 0.0100, 4.5, 1.0],
  [0.22, 1.4, 0.0075, 2.6, 1.0],
  [0.27, 1.7, 0.0070, 2.2, 0.85],
  [0.62, 3.2, 0.0065, 1.6, 0.5],
  [0.86, 1.2, 0.0090, 2.8, 1.0],
];
const SHORE = 250;

export async function createRenderer(canvas, opts = {}) {
  const ctx = createContext(canvas);
  if (!ctx) return { error: 'no-webgl2' };
  const { gl } = ctx;
  const simKind = ctx.floatRT && ctx.floatLinear ? 'float' : ctx.halfRT ? 'half' : null;
  if (!simKind) return { error: 'no-float-targets' };
  const software = isSoftware(ctx.renderer);
  const vao = gl.createVertexArray();

  const pending = {
    sim: startProgram(gl, FULLSCREEN_VS, SIM_FS, 'sim'),
    scene: startProgram(gl, FULLSCREEN_VS, SCENE_FS, 'scene'),
    env: startProgram(gl, FULLSCREEN_VS, ENV_FS, 'environment'),
    down: startProgram(gl, FULLSCREEN_VS, DOWN_FS, 'down'),
    up: startProgram(gl, FULLSCREEN_VS, UP_FS, 'up'),
    comp: startProgram(gl, FULLSCREEN_VS, COMPOSITE_FS, 'composite'),
  };
  // let the driver compile in parallel; don't block the page meanwhile
  await new Promise((resolve) => {
    const poll = () => (Object.values(pending).every((p) => ready(ctx, p)) ? resolve() : setTimeout(poll, 16));
    poll();
  });
  const P = {};
  for (const [k, p] of Object.entries(pending)) P[k] = finishProgram(gl, p);
  const particles = await createParticles(ctx);

  const R = {
    ctx,
    gl,
    software,
    simKind,
    profileName: PROFILES[opts.quality] ? opts.quality : software ? 'lite' : 'high',
    // what "Low" means on this machine
    lightProfile: software ? 'lite' : 'low',
    reducedMotion: !!opts.reducedMotion,
    skip: new Set(opts.skip || []), // diagnostics: passes to leave out
    pond: null,
    sim: null,
    cur: 0,
    hdr: null,
    bloom: [],
    width: 0,
    height: 0,
    impulses: [],
    simAccum: 0,
    particles,
    fade: 0,
    lamps: null,
    moon: null,
  };

  function profile() { return PROFILES[R.profileName]; }

  function freeTargets(list) {
    for (const t of list) {
      if (!t) continue;
      gl.deleteFramebuffer(t.fb);
      gl.deleteTexture(t.tex);
    }
  }

  function layout() {
    const aspect = R.width / R.height;
    const pond = createPond(aspect, profile().grid);
    const same = R.pond && R.pond.Nu === pond.Nu && R.pond.Nv === pond.Nv && R.pond.cell === pond.cell;
    R.pond = pond;
    if (!same) {
      freeTargets(R.sim || []);
      R.sim = [0, 1].map(() => createTarget(gl, pond.Nu, pond.Nv, simKind, true));
      R.cur = 0;
    }
    // lanterns and the moon are placed relative to what the frame shows
    const el = (h) => Math.atan((h - pond.cam.pos[1]) / SHORE);
    R.lamps = LAMPS.map(([f, h, rad, pow, warm]) => {
      const az = f * pond.termAz;
      const e = el(h);
      const dir = [Math.sin(az) * Math.cos(e), Math.sin(e), Math.cos(az) * Math.cos(e)];
      const col = [1.0, 0.52 + 0.3 * (1 - warm), 0.2 + 0.55 * (1 - warm)].map((c) => c * pow);
      return { dir, col, rad };
    });
    const maz = -0.42 * pond.termAz;
    const mel = 0.135;
    R.moon = [Math.sin(maz) * Math.cos(mel), Math.sin(mel), Math.cos(maz) * Math.cos(mel)];
  }

  function buildHdr() {
    const pr = profile();
    let w = Math.max(2, Math.round(R.width * pr.scale));
    let h = Math.max(2, Math.round(R.height * pr.scale));
    const over = (w * h) / pr.maxPixels;
    if (over > 1) {
      w = Math.round(w / Math.sqrt(over));
      h = Math.round(h / Math.sqrt(over));
    }
    freeTargets([R.hdr, R.env, ...R.bloom]);
    R.hdr = createTarget(gl, w, h, 'half', true);
    R.env = createTarget(gl, pr.env[0], pr.env[1], 'half', true);
    R.envAge = Infinity;
    R.bloom = [];
    let bw = w;
    let bh = h;
    for (let i = 0; i < pr.bloom; i++) {
      bw = Math.max(1, bw >> 1);
      bh = Math.max(1, bh >> 1);
      R.bloom.push(createTarget(gl, bw, bh, 'half', true));
    }
  }

  R.resize = (cssW, cssH) => {
    const k = profile().canvasScale || 1;
    const w = Math.max(2, Math.round(cssW * k));
    const h = Math.max(2, Math.round(cssH * k));
    if (w === R.width && h === R.height) return;
    R.width = w;
    R.height = h;
    canvas.width = w;
    canvas.height = h;
    layout();
    buildHdr();
  };

  // Callers follow this with resize() (the canvas scale may change).
  R.setQuality = (name) => {
    if (name === 'low') name = R.lightProfile;
    if (!PROFILES[name] || name === R.profileName) return;
    R.profileName = name;
    R.width = 0;
    R.height = 0;
  };

  // One stage of one drop (ADR-003), at world position (x, z).
  R.impulse = (age, x, z, gain = 1) => {
    const s = IMPULSES[age];
    if (!s || !R.pond) return;
    const r = Math.hypot(x, z);
    // a drop far away is smaller than a grid cell: widen it, keep its volume-ish
    const minSigma = 1.3 * R.pond.cell * r;
    const sigma = Math.max(s.sigma, minSigma);
    const amp = s.amp * (s.sigma / sigma) * gain;
    if (R.impulses.length < MAX_IMPULSES * 4) R.impulses.push([x, z, sigma, amp, s.ring]);
  };

  // A drop at age `age` (ADR-003): its impulse into the water and its spray.
  R.drop = (age, x, z, gain = 1) => {
    R.impulse(age, x, z, gain);
    particles.splash(age, x, z, gain);
  };

  const impBuf = new Float32Array(MAX_IMPULSES * 4);
  const ringBuf = new Float32Array(MAX_IMPULSES);

  function stepSim(dt) {
    const { pond } = R;
    R.simAccum = Math.min(R.simAccum + dt, pond.dt * pond.substeps * 3);
    let first = true;
    gl.useProgram(P.sim.prog);
    const L = P.sim.loc;
    gl.uniform2f(L.uSize, pond.Nu, pond.Nv);
    gl.uniform1f(L.uCell, pond.cell);
    gl.uniform1f(L.uR0, pond.r0);
    gl.uniform1f(L.uTheta0, pond.theta0);
    gl.uniform1f(L.uDt, pond.dt);
    gl.uniform1f(L.uC, WAVE_SPEED);
    gl.uniform1f(L.uGamma, DAMPING);
    gl.uniform1f(L.uSponge, pond.sponge);
    gl.viewport(0, 0, pond.Nu, pond.Nv);
    while (R.simAccum >= pond.dt) {
      R.simAccum -= pond.dt;
      let n = 0;
      if (first) {
        n = Math.min(R.impulses.length, MAX_IMPULSES);
        const batch = R.impulses.splice(0, n);
        for (let i = 0; i < n; i++) {
          impBuf.set(batch[i].slice(0, 4), i * 4);
          ringBuf[i] = batch[i][4];
        }
        if (n) {
          gl.uniform4fv(L.uImp, impBuf);
          gl.uniform1fv(L.uRing, ringBuf);
        }
        first = false;
      }
      gl.uniform1i(L.uCount, n);
      const src = R.sim[R.cur];
      const dst = R.sim[1 - R.cur];
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb);
      useTexture(gl, 0, src.tex, L.uState);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      R.cur = 1 - R.cur;
    }
  }

  function camera(t) {
    const { cam } = R.pond;
    if (R.reducedMotion) return cam;
    // a slow, barely-there breathing of the camera: a hand-held tripod
    const yaw = 0.0035 * Math.sin(t * 0.071) + 0.0015 * Math.sin(t * 0.23);
    const pitch = cam.pitch + 0.0022 * Math.sin(t * 0.053 + 1.0);
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const fwd = [sy * Math.cos(pitch), -Math.sin(pitch), cy * Math.cos(pitch)];
    const up = [sy * Math.sin(pitch), Math.cos(pitch), cy * Math.sin(pitch)];
    const right = [cy, 0, -sy];
    const pos = [0, cam.pos[1] + 0.004 * Math.sin(t * 0.11), 0];
    return { ...cam, fwd, up, right, pos };
  }

  function drawEnv(t, cam, params) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, R.env.fb);
    gl.viewport(0, 0, R.env.w, R.env.h);
    gl.useProgram(P.env.prog);
    sceneUniforms(P.env.loc, t, cam, params, R.env);
    // an env texel spans more sky than a screen pixel: soften edges to match
    gl.uniform1f(P.env.loc.uPx, (ENV_MAP[1] - ENV_MAP[0]) / R.env.w);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function drawScene(t, cam, params) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, R.hdr.fb);
    gl.viewport(0, 0, R.hdr.w, R.hdr.h);
    gl.useProgram(P.scene.prog);
    const L = P.scene.loc;
    sceneUniforms(L, t, cam, params, R.hdr);
    gl.uniform1f(L.uPx, (2 * cam.tanHalf) / R.hdr.h);
    useTexture(gl, 1, R.env.tex, L.uEnv);
    gl.uniform1f(L.uSkyEnv, profile().skyEnv ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function sceneUniforms(L, t, cam, params, target) {
    const { pond } = R;
    gl.uniform2f(L.uRes, target.w, target.h);
    gl.uniform4fv(L.uEnvMap, ENV_MAP);
    gl.uniform1f(L.uTime, t);
    gl.uniform3fv(L.uCamPos, cam.pos);
    gl.uniform3fv(L.uFwd, cam.fwd);
    gl.uniform3fv(L.uUp, cam.up);
    gl.uniform3fv(L.uRight, cam.right);
    gl.uniform1f(L.uTanHalf, cam.tanHalf);
    gl.uniform1f(L.uAspect, cam.aspect);
    gl.uniform1i(L.uOct, profile().oct);
    useTexture(gl, 0, R.sim[R.cur].tex, L.uState);
    gl.uniform1f(L.uSimOn, 1);
    gl.uniform2f(L.uSize, pond.Nu, pond.Nv);
    gl.uniform1f(L.uCell, pond.cell);
    gl.uniform1f(L.uR0, pond.r0);
    gl.uniform1f(L.uTheta0, pond.theta0);
    gl.uniform1f(L.uSponge, pond.sponge);
    gl.uniform1f(L.uSlope, params.slope ?? 1.7);
    gl.uniform1f(L.uTermFar, pond.termFar);
    gl.uniform1f(L.uTermAz, pond.termAz);
    gl.uniform1f(L.uRain, params.rain);
    gl.uniform1f(L.uAmbient, params.ambient === false ? 0 : 1);
    gl.uniform3fv(L.uMoon, R.moon);
    gl.uniform1f(L.uMoonR, 0.0115);
    gl.uniform2f(L.uWind, 0.010, 0.0035);
    gl.uniform1f(L.uShore, SHORE);
    const n = Math.min(R.lamps.length, MAX_LAMPS);
    gl.uniform1i(L.uLampCount, n);
    gl.uniform3fv(L.uLampDir, R.lamps.slice(0, n).flatMap((l) => l.dir));
    gl.uniform4fv(L.uLampCol, R.lamps.slice(0, n).flatMap((l) => [...l.col, l.rad]));
    gl.uniform1fv(L.uLampAz, R.lamps.slice(0, n).map((l) => Math.atan2(l.dir[0], l.dir[2])));
    gl.uniform1f(L.uMoonAz, Math.atan2(R.moon[0], R.moon[2]));
  }

  function drawBloom() {
    const levels = R.bloom;
    if (!levels.length) return;
    gl.useProgram(P.down.prog);
    let src = R.hdr;
    levels.forEach((dst, i) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb);
      gl.viewport(0, 0, dst.w, dst.h);
      useTexture(gl, 0, src.tex, P.down.loc.uSrc);
      gl.uniform2f(P.down.loc.uTexel, 1 / src.w, 1 / src.h);
      gl.uniform1f(P.down.loc.uThreshold, i === 0 ? 0.35 : -1);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      src = dst;
    });
    gl.useProgram(P.up.prog);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    for (let i = levels.length - 1; i > 0; i--) {
      const s = levels[i];
      const d = levels[i - 1];
      gl.bindFramebuffer(gl.FRAMEBUFFER, d.fb);
      gl.viewport(0, 0, d.w, d.h);
      useTexture(gl, 0, s.tex, P.up.loc.uSrc);
      gl.uniform2f(P.up.loc.uTexel, 1 / s.w, 1 / s.h);
      gl.uniform1f(P.up.loc.uWeight, 1.0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.disable(gl.BLEND);
  }

  function composite(t, params) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, R.width, R.height);
    gl.useProgram(P.comp.prog);
    const L = P.comp.loc;
    useTexture(gl, 0, R.hdr.tex, L.uScene);
    useTexture(gl, 1, (R.bloom[0] || R.hdr).tex, L.uBloom);
    gl.uniform1f(L.uBloomOn, R.bloom.length ? 1 : 0);
    gl.uniform1f(L.uBloomAmt, 0.22);
    gl.uniform1f(L.uExposure, params.exposure ?? 1.6);
    gl.uniform1f(L.uTime, t);
    gl.uniform2f(L.uRes, R.width, R.height);
    gl.uniform1f(L.uGrain, 0.018);
    gl.uniform1f(L.uFade, R.fade);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // Draw one frame. t: seconds; dt: seconds since the last frame.
  // params: { rain (0..1), falling (engine drops in flight), exposure }
  R.frame = (t, dt, params) => {
    gl.bindVertexArray(vao);
    R.fade = Math.min(1, R.fade + dt / 1.6);
    R.avgDt = R.avgDt ? R.avgDt * 0.95 + dt * 0.05 : dt;
    const skip = R.skip;
    if (!skip.has('sim')) stepSim(dt);
    const cam = camera(t);
    if (++R.envAge >= profile().envEvery && !skip.has('env')) {
      drawEnv(t, cam, params);
      R.envAge = 0;
    }
    if (!skip.has('scene')) drawScene(t, cam, params);
    if (!skip.has('particles')) particles.draw(R, cam, t, dt, { ...params, streaks: (params.streaks ?? 1) * profile().streaks });
    gl.bindVertexArray(vao);
    if (!skip.has('bloom')) drawBloom();
    composite(t, params);
  };

  R.info = () => ({
    renderer: ctx.renderer,
    software,
    profile: R.profileName,
    grid: R.pond && `${R.pond.Nu}x${R.pond.Nv}`,
    substeps: R.pond && R.pond.substeps,
    scene: R.hdr && `${R.hdr.w}x${R.hdr.h}`,
    sim: simKind,
  });

  return R;
}
