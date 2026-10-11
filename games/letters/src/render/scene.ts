import { drawLetterAtlas } from './atlas';
import { type Camera, halfGrid, PITCH, TRAY_DEPTH, TRAY_MARGIN } from './camera';
import { type Quat, transformPoint, type Vec3 } from './math3d';
import { roundedCube } from './mesh';
import { type Palette, rgb, type Rgb } from './palette';
import {
  BACKDROP_FRAGMENT,
  BACKDROP_VERTEX,
  CUBE_FRAGMENT,
  CUBE_VERTEX,
  SHADOW_FRAGMENT,
  SHADOW_VERTEX,
  TRAY_FRAGMENT,
  TRAY_VERTEX,
} from './shaders';

/**
 * Draws the tabletop with WebGL 2: backdrop, tray, the soft shadows (or glows) under the cubes,
 * and the cubes, all instanced from one rounded-cube mesh. Everything it draws comes from the
 * frame it is given, so any moment can be held still for a picture or a test.
 */

export interface CubeInstance {
  position: Vec3;
  rotation: Quat;
  scale: number;
  colour: Rgb;
  /** Glyph index for each of the six faces (see atlas.ts). */
  glyphs: readonly number[];
  /** 0–1: part of the chain being traced. */
  trace: number;
  /** 0–1: a brief flash, for a found word or a pulse on a repeat. */
  flash: number;
  /** 0–1: stepped back, so other cubes stand out. */
  dim: number;
}

export interface GlowInstance {
  x: number;
  z: number;
  /** Half the side of the shadow's square, before softening. */
  half: number;
  softness: number;
  colour: Rgb;
  alpha: number;
}

export interface SceneFrame {
  camera: Camera;
  palette: Palette;
  time: number;
  cubes: readonly CubeInstance[];
  /** Shadows by day, coloured light pools by night, on the tray under the cubes. */
  glows: readonly GlowInstance[];
  /** The same, on the floor under the tray. */
  floor: readonly GlowInstance[];
  /** The board's centre and reach in CSS pixels, for the backdrop's lamp. */
  focus: { x: number; y: number; radius: number };
  reveal: number;
}

const CUBE_FLOATS = 4 + 4 + 3 + 3 + 3 + 4;
const GLOW_FLOATS = 4 + 4;
const KEY_LIGHT: Vec3 = [-0.55, 1.0, 0.65];

interface Program {
  program: WebGLProgram;
  uniform(name: string): WebGLUniformLocation | null;
}

export class CubeScene {
  private readonly backdrop: Program;
  private readonly cubeProgram: Program;
  private readonly trayProgram: Program;
  private readonly shadowProgram: Program;
  private readonly cubeVao: WebGLVertexArrayObject;
  private readonly trayVao: WebGLVertexArrayObject;
  private readonly shadowVao: WebGLVertexArrayObject;
  private readonly emptyVao: WebGLVertexArrayObject;
  private readonly instanceBuffer: WebGLBuffer;
  private readonly glowBuffer: WebGLBuffer;
  private atlas: WebGLTexture;
  private readonly cubeIndexCount: number;
  private readonly trayIndexCount: number;
  private instanceData = new Float32Array(CUBE_FLOATS * 36);
  private glowData = new Float32Array(GLOW_FLOATS * 40);
  private pixelRatio = 1;

  private constructor(
    private readonly gl: WebGL2RenderingContext,
    readonly canvas: HTMLCanvasElement,
  ) {
    this.backdrop = link(gl, BACKDROP_VERTEX, BACKDROP_FRAGMENT);
    this.cubeProgram = link(gl, CUBE_VERTEX, CUBE_FRAGMENT);
    this.trayProgram = link(gl, TRAY_VERTEX, TRAY_FRAGMENT);
    this.shadowProgram = link(gl, SHADOW_VERTEX, SHADOW_FRAGMENT);
    this.emptyVao = gl.createVertexArray()!;

    const cube = roundedCube(0.15, 12);
    this.cubeIndexCount = cube.indices.length;
    this.instanceBuffer = gl.createBuffer()!;
    this.cubeVao = this.meshVao(cube, true);

    const tray = roundedCube(0.06, 10);
    this.trayIndexCount = tray.indices.length;
    this.trayVao = this.meshVao(tray, false);

    this.glowBuffer = gl.createBuffer()!;
    this.shadowVao = this.quadVao();
    this.atlas = this.uploadAtlas(drawLetterAtlas());
  }

  /** Null when the browser offers no WebGL 2; the board then falls back to its 2D painter. */
  static create(canvas: HTMLCanvasElement): CubeScene | null {
    const gl = canvas.getContext('webgl2', {
      antialias: true,
      alpha: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
    });
    if (!gl) return null;
    try {
      return new CubeScene(gl, canvas);
    } catch {
      return null;
    }
  }

  resize(width: number, height: number, pixelRatio: number): void {
    this.pixelRatio = pixelRatio;
    const w = Math.max(1, Math.round(width * pixelRatio));
    const h = Math.max(1, Math.round(height * pixelRatio));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  render(frame: SceneFrame): void {
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    this.drawBackdrop(frame);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);
    this.drawGlows(frame, frame.floor, -TRAY_DEPTH);
    this.drawTray(frame);
    this.drawGlows(frame, frame.glows, 0.004);
    this.drawCubes(frame);
    gl.disable(gl.CULL_FACE);
  }

  /** Redraws the letters, once the letter face has loaded, if the first atlas fell back. */
  refreshAtlas(): void {
    const old = this.atlas;
    this.atlas = this.uploadAtlas(drawLetterAtlas());
    this.gl.deleteTexture(old);
  }

  dispose(): void {
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }

  private drawBackdrop(frame: SceneFrame) {
    const gl = this.gl;
    const { palette } = frame;
    const p = this.backdrop;
    gl.useProgram(p.program);
    gl.uniform2f(p.uniform('uResolution'), this.canvas.width, this.canvas.height);
    gl.uniform1f(p.uniform('uTime'), frame.time);
    gl.uniform1f(p.uniform('uLook'), palette.look === 'arcade' ? 1 : 0);
    gl.uniform3fv(p.uniform('uSkyTop'), rgb(palette.skyTop));
    gl.uniform3fv(p.uniform('uSkyBottom'), rgb(palette.skyBottom));
    gl.uniform3fv(p.uniform('uGlowA'), rgb(palette.glowA));
    gl.uniform3fv(p.uniform('uGlowB'), rgb(palette.glowB));
    gl.uniform3fv(p.uniform('uGlowC'), rgb(palette.glowC));
    gl.uniform2f(
      p.uniform('uFocus'),
      frame.focus.x * this.pixelRatio,
      frame.focus.y * this.pixelRatio,
    );
    gl.uniform1f(p.uniform('uFocusRadius'), frame.focus.radius * this.pixelRatio);
    gl.uniform1f(p.uniform('uReveal'), frame.reveal);
    gl.bindVertexArray(this.emptyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private drawTray(frame: SceneFrame) {
    const gl = this.gl;
    const { palette, camera } = frame;
    const size = camera.size;
    const p = this.trayProgram;
    const width = 2 * (halfGrid(size) + TRAY_MARGIN);
    gl.useProgram(p.program);
    gl.uniformMatrix4fv(p.uniform('uViewProjection'), false, camera.viewProjection);
    gl.uniform3f(p.uniform('uTraySize'), width, TRAY_DEPTH, width);
    gl.uniform3f(p.uniform('uTrayCentre'), 0, -TRAY_DEPTH / 2, 0);
    gl.uniform3fv(p.uniform('uEye'), camera.eye);
    gl.uniform3fv(p.uniform('uKeyLight'), KEY_LIGHT);
    gl.uniform1f(p.uniform('uLook'), palette.look === 'arcade' ? 1 : 0);
    gl.uniform3fv(p.uniform('uTray'), rgb(palette.tray));
    gl.uniform3fv(p.uniform('uWell'), rgb(palette.trayWell));
    gl.uniform3fv(p.uniform('uEdge'), rgb(palette.trayEdge));
    gl.uniform1f(p.uniform('uCells'), size);
    gl.uniform1f(p.uniform('uPitch'), PITCH);
    gl.uniform1f(p.uniform('uCube'), 1);
    gl.uniform1f(p.uniform('uTrayHalf'), width / 2);
    gl.uniform1f(p.uniform('uTime'), frame.time);
    gl.bindVertexArray(this.trayVao);
    gl.drawElements(gl.TRIANGLES, this.trayIndexCount, gl.UNSIGNED_SHORT, 0);
  }

  private drawGlows(frame: SceneFrame, glows: readonly GlowInstance[], planeY: number) {
    const gl = this.gl;
    const count = glows.length;
    if (count === 0) return;
    if (this.glowData.length < count * GLOW_FLOATS)
      this.glowData = new Float32Array(count * GLOW_FLOATS);
    glows.forEach((glow, i) => {
      this.glowData.set(
        [glow.x, glow.z, glow.half, glow.softness, ...glow.colour, glow.alpha],
        i * GLOW_FLOATS,
      );
    });
    gl.bindBuffer(gl.ARRAY_BUFFER, this.glowBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.glowData.subarray(0, count * GLOW_FLOATS), gl.DYNAMIC_DRAW);
    const p = this.shadowProgram;
    gl.useProgram(p.program);
    gl.uniformMatrix4fv(p.uniform('uViewProjection'), false, frame.camera.viewProjection);
    gl.uniform1f(p.uniform('uPlaneY'), planeY);
    gl.enable(gl.BLEND);
    if (frame.palette.look === 'arcade') gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    else gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.bindVertexArray(this.shadowVao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }

  private drawCubes(frame: SceneFrame) {
    const gl = this.gl;
    const { palette, camera } = frame;
    const glass = palette.look === 'arcade';
    // Glass blends with what lies behind it, so the far cubes go first.
    const cubes = glass
      ? [...frame.cubes].sort((a, b) => depthOf(camera, b) - depthOf(camera, a))
      : frame.cubes;
    const count = cubes.length;
    if (count === 0) return;
    if (this.instanceData.length < count * CUBE_FLOATS)
      this.instanceData = new Float32Array(count * CUBE_FLOATS);
    cubes.forEach((cube, i) => {
      const g = cube.glyphs;
      this.instanceData.set(
        [
          ...cube.position,
          cube.scale,
          ...cube.rotation,
          ...cube.colour,
          g[0] ?? 0,
          g[1] ?? 0,
          g[2] ?? 0,
          g[3] ?? 0,
          g[4] ?? 0,
          g[5] ?? 0,
          cube.trace,
          cube.flash,
          cube.dim,
          0,
        ],
        i * CUBE_FLOATS,
      );
    });
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      this.instanceData.subarray(0, count * CUBE_FLOATS),
      gl.DYNAMIC_DRAW,
    );
    const p = this.cubeProgram;
    gl.useProgram(p.program);
    gl.uniformMatrix4fv(p.uniform('uViewProjection'), false, camera.viewProjection);
    gl.uniform3fv(p.uniform('uEye'), camera.eye);
    gl.uniform3fv(p.uniform('uKeyLight'), KEY_LIGHT);
    gl.uniform1f(p.uniform('uLook'), glass ? 1 : 0);
    gl.uniform3fv(p.uniform('uLetter'), rgb(palette.letter));
    gl.uniform3fv(p.uniform('uTraceGlow'), rgb(palette.traceGlow));
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.atlas);
    gl.uniform1i(p.uniform('uAtlas'), 0);
    if (glass) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }
    gl.bindVertexArray(this.cubeVao);
    gl.drawElementsInstanced(gl.TRIANGLES, this.cubeIndexCount, gl.UNSIGNED_SHORT, 0, count);
    gl.disable(gl.BLEND);
  }

  private meshVao(
    mesh: ReturnType<typeof roundedCube>,
    instanced: boolean,
  ): WebGLVertexArrayObject {
    const gl = this.gl;
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    attribute(gl, 0, mesh.positions, 3);
    attribute(gl, 1, mesh.normals, 3);
    const indices = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);
    if (instanced) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
      const stride = CUBE_FLOATS * 4;
      const layout: [number, number][] = [
        [2, 4],
        [3, 4],
        [4, 3],
        [5, 3],
        [6, 3],
        [7, 4],
      ];
      let offset = 0;
      for (const [location, size] of layout) {
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride, offset);
        gl.vertexAttribDivisor(location, 1);
        offset += size * 4;
      }
    }
    gl.bindVertexArray(null);
    return vao;
  }

  private quadVao(): WebGLVertexArrayObject {
    const gl = this.gl;
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    attribute(gl, 0, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), 2);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.glowBuffer);
    const stride = GLOW_FLOATS * 4;
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, stride, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, stride, 16);
    gl.vertexAttribDivisor(2, 1);
    gl.bindVertexArray(null);
    return vao;
  }

  private uploadAtlas(source: HTMLCanvasElement): WebGLTexture {
    const gl = this.gl;
    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const anisotropy = gl.getExtension('EXT_texture_filter_anisotropic');
    if (anisotropy) gl.texParameterf(gl.TEXTURE_2D, anisotropy.TEXTURE_MAX_ANISOTROPY_EXT, 8);
    return texture;
  }
}

function depthOf(camera: Camera, cube: CubeInstance): number {
  return transformPoint(camera.viewProjection, cube.position)[3];
}

function attribute(gl: WebGL2RenderingContext, location: number, data: Float32Array, size: number) {
  const buffer = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(location);
  gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
}

function link(gl: WebGL2RenderingContext, vertexSource: string, fragmentSource: string): Program {
  const program = gl.createProgram()!;
  for (const [type, source] of [
    [gl.VERTEX_SHADER, vertexSource],
    [gl.FRAGMENT_SHADER, fragmentSource],
  ] as const) {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) ?? 'shader failed to compile');
    }
    gl.attachShader(program, shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) ?? 'program failed to link');
  }
  const locations = new Map<string, WebGLUniformLocation | null>();
  return {
    program,
    uniform(name) {
      if (!locations.has(name)) locations.set(name, gl.getUniformLocation(program, name));
      return locations.get(name)!;
    },
  };
}
