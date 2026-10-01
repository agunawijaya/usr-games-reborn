// Small shared mutable values read every frame by many components (cheaper
// than React props for per-frame data).
import { Vector3 } from 'three';

/** Your world position, updated by the player each frame. */
export const playerWorld = new Vector3();

/** Camera shake energy, 0..1, decays in the camera controller. */
export const shake = { v: 0 };

/** Quality: 'high' renders reflections, shadows and every particle. */
export const quality = { low: false, reducedMotion: false, webgl: true };

// Decided once, before the first frame (the scene builds its materials from
// it): `?quality=low|high` wins; otherwise a software renderer means low.
// No WebGL at all: the page says so instead of staying blank (App.tsx).
// Reduced motion follows the system setting.
function detect(): void {
  if (typeof window === 'undefined') return;
  const q = new URLSearchParams(window.location.search).get('quality');
  let low = q === 'low';
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') ?? c.getContext('webgl');
    quality.webgl = !!gl;
    if (gl && !q) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
      low = /swiftshader|llvmpipe|software/i.test(name);
    }
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch { quality.webgl = false; }
  quality.low = low;
  quality.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}
detect();
