import type { BeachLayout } from './layout';
import { type BeachPalette, hexToRgb } from './palette';
import { FRAGMENT_SHADER, VERTEX_SHADER } from './sea-shader';

/** What the water is doing this frame; everything else comes from the layout and palette. */
export interface SeaState {
  time: number;
  /** Where the castle stands, as a fraction of the width: surges aim at it. */
  surgeX: number;
  /** 0 to 1: how far a wrong letter's surge has run up towards the castle. */
  surge: number;
  /** 0 to 1: how damp the sand the surge reached still is. */
  wet: number;
  /** 0 to 1: the wrong letter's swell, from rising far out to breaking on the beach. */
  swell: number;
  /** 0 to 1: extra glow on the swell and surge (Moonlit Tide's bioluminescence). */
  swellGlow: number;
  /** 0 to 1: the sea holding its breath (the win moment). */
  calm: number;
}

export const QUIET_SEA: SeaState = {
  time: 0,
  surgeX: 0.5,
  surge: 0,
  wet: 0,
  swell: 0,
  swellGlow: 0,
  calm: 0,
};

const COLOR_UNIFORMS: [string, keyof BeachPalette][] = [
  ['uSkyTop', 'skyTop'],
  ['uSkyHorizon', 'skyHorizon'],
  ['uHaze', 'haze'],
  ['uOrbColor', 'orb'],
  ['uOrbGlow', 'orbGlow'],
  ['uSeaDeep', 'seaDeep'],
  ['uSeaMid', 'seaMid'],
  ['uSeaShallow', 'seaShallow'],
  ['uFoam', 'foam'],
  ['uGlow', 'glow'],
  ['uSandWet', 'sandWet'],
  ['uSandDry', 'sandDry'],
  ['uSandShade', 'sandShade'],
  ['uSandLight', 'sandLight'],
  ['uIsland', 'island'],
];

/** The sun stands high to the left at midday; the moon rides to the right at night. */
export function orbPosition(palette: BeachPalette): [number, number] {
  return palette.look === 'moonlit' ? [0.68, 0.085] : [0.34, 0.075];
}

/**
 * The WebGL backdrop. `create` returns null when WebGL is unavailable, and the beach falls
 * back to the painted Canvas 2D version (`painted-sea.ts`).
 */
export class SeaRenderer {
  private readonly uniforms = new Map<string, WebGLUniformLocation | null>();

  private constructor(
    readonly canvas: HTMLCanvasElement,
    private readonly gl: WebGLRenderingContext,
    private readonly program: WebGLProgram,
  ) {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  }

  static create(canvas: HTMLCanvasElement): SeaRenderer | null {
    const gl = canvas.getContext('webgl', {
      antialias: false,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: 'low-power',
    });
    if (!gl) return null;
    const program = linkProgram(gl);
    if (!program) return null;
    gl.useProgram(program);
    return new SeaRenderer(canvas, gl, program);
  }

  private location(name: string): WebGLUniformLocation | null {
    if (!this.uniforms.has(name)) {
      this.uniforms.set(name, this.gl.getUniformLocation(this.program, name));
    }
    return this.uniforms.get(name)!;
  }

  render(layout: BeachLayout, palette: BeachPalette, sea: SeaState, pixelRatio: number) {
    const { gl } = this;
    const width = Math.round(layout.width * pixelRatio);
    const height = Math.round(layout.height * pixelRatio);
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    gl.viewport(0, 0, width, height);
    gl.uniform2f(this.location('uRes'), width, height);
    gl.uniform1f(this.location('uTime'), sea.time);
    gl.uniform1f(this.location('uScale'), layout.scale * pixelRatio);
    gl.uniform1f(this.location('uHorizon'), layout.horizonY / layout.height);
    gl.uniform1f(this.location('uShore'), layout.shoreY / layout.height);
    gl.uniform1f(this.location('uNight'), palette.look === 'moonlit' ? 1 : 0);
    gl.uniform2f(this.location('uOrb'), ...orbPosition(palette));
    gl.uniform1f(this.location('uSurgeX'), sea.surgeX);
    gl.uniform1f(this.location('uSurge'), sea.surge);
    gl.uniform1f(
      this.location('uSurgeReach'),
      (layout.castle.baseY + 30 * layout.scale - layout.shoreY) / layout.height,
    );
    gl.uniform1f(this.location('uWet'), sea.wet);
    gl.uniform1f(this.location('uSwell'), sea.swell);
    gl.uniform1f(this.location('uSwellGlow'), sea.swellGlow);
    gl.uniform1f(this.location('uCalm'), sea.calm);
    for (const [uniform, key] of COLOR_UNIFORMS) {
      gl.uniform3f(this.location(uniform), ...hexToRgb(palette[key] as string));
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /** Frees the GPU context at once instead of waiting for garbage collection. */
  dispose() {
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn('Before the Tide: sea shader did not compile', gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

function linkProgram(gl: WebGLRenderingContext): WebGLProgram | null {
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();
  if (!vertex || !fragment || !program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  return gl.getProgramParameter(program, gl.LINK_STATUS) ? program : null;
}
