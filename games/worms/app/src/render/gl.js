// Minimal WebGL2 plumbing: programs, a full-screen triangle, render targets.
// Deliberately tiny so the shaders stay the star of the show (port ADR-001).
// Shared with the pom fancy-web port; extended with custom vertex shaders,
// per-cell data textures and clearable targets.

export function createContext(canvas, opts = {}) {
  const gl = canvas.getContext('webgl2', {
    antialias: false,
    alpha: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance',
    ...opts,
  });
  if (!gl) return null;
  const floatRT = !!gl.getExtension('EXT_color_buffer_float');
  gl.getExtension('OES_texture_float_linear');
  return { gl, floatRT };
}

function shader(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  return sh;
}

const FULLSCREEN_VS = `#version 300 es
// One oversized triangle covers the viewport; no vertex buffer needed.
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

/**
 * Start compiling and linking a full-screen program WITHOUT waiting for it.
 * Querying compile or link status blocks until the driver finishes. On
 * Windows/D3D11 a first compile of the big shaders takes seconds, so
 * programs are started together and polled with KHR_parallel_shader_compile.
 */
export function startProgram(gl, fragSrc, label, vertSrc = FULLSCREEN_VS) {
  const prog = gl.createProgram();
  const vs = shader(gl, gl.VERTEX_SHADER, vertSrc);
  const fs = shader(gl, gl.FRAGMENT_SHADER, fragSrc);
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  return { prog, vs, fs, fragSrc, vertSrc, label };
}

/** True once a started program can be queried without blocking. */
export function programReady(gl, pending) {
  const ext = gl.getExtension('KHR_parallel_shader_compile');
  return !ext || gl.getProgramParameter(pending.prog, ext.COMPLETION_STATUS_KHR);
}

/** Check a started program for errors and cache its uniform locations. */
export function finishProgram(gl, pending) {
  const { prog, vs, fs, fragSrc, vertSrc, label } = pending;
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    for (const [sh, src, kind] of [[vs, vertSrc, 'vertex'], [fs, fragSrc, 'fragment']]) {
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        const numbered = src.split('\n').map((l, i) => `${String(i + 1).padStart(4)}: ${l}`).join('\n');
        throw new Error(`${label} ${kind} shader compile failed:\n${gl.getShaderInfoLog(sh)}\n${numbered}`);
      }
    }
    throw new Error(`${label} link failed: ${gl.getProgramInfoLog(prog)}`);
  }
  const loc = {};
  const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(prog, i);
    const name = info.name.replace(/\[0\]$/, '');
    loc[name] = gl.getUniformLocation(prog, info.name);
  }
  return { prog, loc };
}

/** Compile, link and finish in one blocking call. */
export function createProgram(gl, fragSrc, label, vertSrc) {
  return finishProgram(gl, startProgram(gl, fragSrc, label, vertSrc));
}

/** Set uniforms by name; unknown names (optimised out) are ignored. */
export function setUniforms(gl, p, values) {
  for (const [name, v] of Object.entries(values)) {
    const l = p.loc[name];
    if (l === undefined || l === null) continue;
    if (typeof v === 'number') gl.uniform1f(l, v);
    else if (typeof v === 'boolean') gl.uniform1f(l, v ? 1 : 0);
    else if (v.int !== undefined) gl.uniform1i(l, v.int);
    else if (v.mat3) gl.uniformMatrix3fv(l, false, v.mat3);
    else if (v.vec4) gl.uniform4fv(l, v.vec4);
    else if (v.length === 2) gl.uniform2fv(l, v);
    else if (v.length === 3) gl.uniform3fv(l, v);
    else if (v.length === 4) gl.uniform4fv(l, v);
  }
}

/**
 * A 2-D texture you can render into. `format` is 'rgba16f', 'rg16f' or 'rgba8'.
 */
export function createTarget(gl, w, h, format, { mipmaps = false, wrapS = 'clamp' } = {}) {
  const F = {
    rgba16f: [gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT],
    rg16f: [gl.RG16F, gl.RG, gl.HALF_FLOAT],
    rgba8: [gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE],
    rg8: [gl.RG8, gl.RG, gl.UNSIGNED_BYTE],
  }[format];
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  if (mipmaps) {
    const levels = Math.floor(Math.log2(Math.max(w, h))) + 1;
    gl.texStorage2D(gl.TEXTURE_2D, levels, F[0], w, h);
  } else {
    gl.texStorage2D(gl.TEXTURE_2D, 1, F[0], w, h);
  }
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mipmaps ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapS === 'repeat' ? gl.REPEAT : gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  if (!ok) throw new Error(`render target ${format} ${w}x${h} incomplete`);
  return { tex, fbo, w, h, format };
}

export function drawFullscreen(gl) {
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

/** Bind a target (or the canvas when null) and set the viewport to it. */
export function bindTarget(gl, target, canvasW, canvasH) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null);
  gl.viewport(0, 0, target ? target.w : canvasW, target ? target.h : canvasH);
}

/** Clear a target to a colour. */
export function clearTarget(gl, target, r = 0, g = 0, b = 0, a = 0) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
  gl.viewport(0, 0, target.w, target.h);
  gl.clearColor(r, g, b, a);
  gl.clear(gl.COLOR_BUFFER_BIT);
}

/**
 * A texture holding one texel per terminal cell (no filtering). kind:
 * 'u8x4' (RGBA8UI) or 'f32x4' (RGBA32F). Returns { tex, w, h, upload(data) }.
 */
export function createCellTexture(gl, w, h, kind) {
  // u8x4 is an integer texture (read with usampler2D + texelFetch)
  const F = kind === 'f32x4'
    ? [gl.RGBA32F, gl.RGBA, gl.FLOAT]
    : [gl.RGBA8UI, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE];
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texStorage2D(gl.TEXTURE_2D, 1, F[0], w, h);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return {
    tex, w, h,
    upload(data) {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, h, F[1], F[2], data);
    },
    dispose() { gl.deleteTexture(tex); },
  };
}

/** Free a render target. */
export function disposeTarget(gl, t) {
  if (!t) return;
  gl.deleteFramebuffer(t.fbo);
  gl.deleteTexture(t.tex);
}
