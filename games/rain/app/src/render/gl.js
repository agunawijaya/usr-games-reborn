// Minimal WebGL2 plumbing: programs (compiled in parallel), a full-screen
// triangle, and ping-pong render targets (port ADR-001).

export function createContext(canvas) {
  const gl = canvas.getContext('webgl2', {
    antialias: false,
    alpha: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance',
  });
  if (!gl) return null;
  const floatRT = !!gl.getExtension('EXT_color_buffer_float');
  const halfRT = floatRT || !!gl.getExtension('EXT_color_buffer_half_float');
  const floatLinear = !!gl.getExtension('OES_texture_float_linear');
  const parallel = gl.getExtension('KHR_parallel_shader_compile');
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  return { gl, floatRT, halfRT, floatLinear, parallel, renderer };
}

// Software rasterisers (SwiftShader, llvmpipe, WARP, ...) get the lite profile.
export function isSoftware(name) {
  return /swiftshader|llvmpipe|softpipe|software|basic render|warp|lavapipe/i.test(name || '');
}

export const FULLSCREEN_VS = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

function shader(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  return sh;
}

// Start compiling without blocking; poll with ready(); then finish().
export function startProgram(gl, vsSrc, fsSrc, label) {
  const prog = gl.createProgram();
  const vs = shader(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = shader(gl, gl.FRAGMENT_SHADER, fsSrc);
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  return { prog, vs, fs, vsSrc, fsSrc, label };
}

export function ready(ctx, p) {
  return !ctx.parallel || ctx.gl.getProgramParameter(p.prog, ctx.parallel.COMPLETION_STATUS_KHR);
}

export function finishProgram(gl, p) {
  if (!gl.getProgramParameter(p.prog, gl.LINK_STATUS)) {
    for (const [sh, src, kind] of [[p.vs, p.vsSrc, 'vertex'], [p.fs, p.fsSrc, 'fragment']]) {
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        const numbered = src.split('\n').map((l, i) => `${String(i + 1).padStart(4)}: ${l}`).join('\n');
        throw new Error(`${p.label} ${kind} shader failed:\n${gl.getShaderInfoLog(sh)}\n${numbered}`);
      }
    }
    throw new Error(`${p.label} link failed: ${gl.getProgramInfoLog(p.prog)}`);
  }
  const loc = {};
  const n = gl.getProgramParameter(p.prog, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p.prog, i);
    loc[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p.prog, info.name);
  }
  return { prog: p.prog, loc, label: p.label };
}

// A render target holding simulation state. `kind`: 'float' | 'half' | 'byte'.
export function createTarget(gl, w, h, kind, linear) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  const fmt = kind === 'float' ? [gl.RGBA32F, gl.RGBA, gl.FLOAT]
    : kind === 'half' ? [gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT]
      : [gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE];
  gl.texImage2D(gl.TEXTURE_2D, 0, fmt[0], w, h, 0, fmt[1], fmt[2], null);
  const filt = linear ? gl.LINEAR : gl.NEAREST;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filt);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filt);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  if (!ok) {
    gl.deleteFramebuffer(fb);
    gl.deleteTexture(tex);
    return null;
  }
  gl.clearColor(0, 0, 0, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { tex, fb, w, h, kind };
}

export function useTexture(gl, unit, tex, loc) {
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.uniform1i(loc, unit);
}
