// trek/procedural-web — WebGL setup, GPU detection and quality profiles.

import * as THREE from 'three';

/** Three profiles. Lite is picked automatically on software rasterisers
 *  (no GPU); High → Low → Lite also steps down automatically when the
 *  frame rate stays low, unless the player chose a quality. */
export const PROFILES = {
  high: {
    name: 'high', dprCap: 2, renderScale: 1, msaa: 4, bloomLevels: 6, bloomThreshold: 1.1,
    bakeW: 2048, bakeH: 1280, steps: 18, octaves: 5, env: true, shimmer: true,
    particles: 1.0, flares: true, anisotropy: 8, fpsCap: 0, idleFps: 0, bakedStars: false, pointLights: true,
  },
  low: {
    name: 'low', dprCap: 1, renderScale: 1, msaa: 0, bloomLevels: 4, bloomThreshold: 1.2,
    bakeW: 1024, bakeH: 640, steps: 9, octaves: 4, env: false, shimmer: false,
    particles: 0.5, flares: true, anisotropy: 2, fpsCap: 0, idleFps: 0, bakedStars: false, pointLights: true,
  },
  // Lite: half-resolution rendering, stars baked into the sky texture, no
  // point lights, two bloom levels, idle frames throttled. For CPU-only
  // WebGL (SwiftShader, llvmpipe) and very old integrated GPUs.
  lite: {
    name: 'lite', dprCap: 1, renderScale: 0.5, msaa: 0, bloomLevels: 2, bloomThreshold: 1.3,
    bakeW: 768, bakeH: 480, steps: 6, octaves: 3, env: false, shimmer: false,
    particles: 0.3, flares: false, anisotropy: 1, fpsCap: 30, idleFps: 12, bakedStars: true, pointLights: false,
  },
};
export const QUALITY_ORDER = ['high', 'low', 'lite'];

/** True if WebGL2 can be created at all. */
export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch {
    return false;
  }
}

export function detectGpu(renderer) {
  const gl = renderer.getContext();
  let name = '';
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  } catch { /* privacy mode */ }
  const software = /swiftshader|llvmpipe|software|basic render|softpipe|microsoft basic/i.test(name);
  return { name: String(name), software };
}

/**
 * @param canvas <canvas>
 * @param want   'high' | 'low' | 'auto'
 */
export function createRenderer(canvas, want = 'auto', { preserve = false } = {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: false, alpha: false, powerPreference: 'high-performance',
    preserveDrawingBuffer: preserve, stencil: false,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.autoClear = false;
  const gpu = detectGpu(renderer);
  const pick = want === 'auto' || !PROFILES[want] ? (gpu.software ? 'lite' : 'high') : want;
  const profile = { ...PROFILES[pick] };
  if (gpu.software) profile.fpsCap = 30;
  return { renderer, profile, gpu };
}

/** Resize a renderer to the window, honouring the profile's DPR cap. */
export function fitRenderer(renderer, profile, w, h) {
  const dpr = Math.min(window.devicePixelRatio || 1, profile.dprCap) * (profile.renderScale ?? 1);
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h, false);
  return { w: Math.floor(w * dpr), h: Math.floor(h * dpr), dpr };
}

export const prefersReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
