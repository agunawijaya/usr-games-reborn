/**
 * The tunnel the dart flies through, drawn by one fragment shader: no library, nothing to load.
 * Every pixel looks down a bending tube of rock (a polar mapping with the bend projected back
 * onto the screen), with a swelling chamber at each room the dart passes. Scrap Paper shades it
 * with pencil hatching on cream paper; Lantern Dark lights the rock with the dart's own glow.
 */

const VERTEX = `#version 300 es
in vec2 corner;
void main() { gl_Position = vec4(corner, 0.0, 1.0); }`;

const FRAGMENT = `#version 300 es
precision highp float;
out vec4 color;
uniform vec2 uRes;
uniform float uTime;
uniform float uTravel;
uniform float uLook;
uniform float uSeed;
uniform float uHop;
uniform float uEnd;
uniform float uWobble;
uniform float uFlash;

float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}
float fbm(vec3 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; }
  return s;
}
vec2 bend(float z) {
  return vec2(sin(z * 0.21 + uSeed) * 0.9 + sin(z * 0.09 + uSeed * 2.0) * 0.5, cos(z * 0.16 + uSeed * 1.3) * 0.55);
}
float swell(float z) {
  float k = z / uHop;
  float d = min(fract(k), 1.0 - fract(k)) * uHop;
  return k < 0.5 ? 0.0 : exp(-d * d * 0.22);
}
float line(float coord, float width) {
  float g = abs(fract(coord) - 0.5) / max(fwidth(coord), 1e-4);
  return 1.0 - smoothstep(width * 0.5, width * 0.5 + 1.0, g);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float wob = uWobble * (sin(uTime * 19.0) * 0.05 + sin(uTime * 31.0) * 0.02);
  uv = mat2(cos(wob), -sin(wob), sin(wob), cos(wob)) * uv + vec2(sin(uTime * 23.0), cos(uTime * 17.0)) * uWobble * 0.01;
  float z0 = uTravel;
  vec2 c0 = bend(z0);
  float t = 1.0 / (length(uv) + 1e-4);
  vec2 p = uv;
  for (int i = 0; i < 5; i++) {
    float z = z0 + t;
    p = uv - (bend(z) - c0) / max(t, 0.35) * 0.55;
    t = min(60.0, (1.0 + swell(z) * 0.6) / (length(p) + 1e-4));
  }
  float z = z0 + t;
  float ang = atan(p.y, p.x);
  vec2 around = vec2(cos(ang), sin(ang));
  // Detail fades with distance, so the far end blurs instead of glittering.
  float detail = 1.0 - smoothstep(3.0, 9.0, t);
  // Rock stretched along the tunnel: its grain streams towards the vanishing point.
  vec3 q = vec3(around * 2.3, z * 0.32);
  float base = fbm(q + uSeed);
  float ridged = 1.0 - abs(2.0 * fbm(q * 1.9 + 11.0) - 1.0);
  float rock = mix(0.5, base, detail);
  float crease = mix(0.0, smoothstep(0.84, 0.97, ridged), detail);
  float grain = mix(0.5, noise(q * vec3(9.0, 9.0, 14.0) + 3.0), detail);
  float side = mix(0.5, fbm(q + uSeed + vec3(-around.y, around.x, 0.0) * 0.2), detail);
  float bump = clamp(0.5 + (side - rock) * 6.0, 0.0, 1.0);
  float near = exp(-t * 0.2);
  float room = swell(z);
  float arrival = uEnd > 0.0 ? smoothstep(uEnd - 2.5, uEnd + 0.3, z) : 0.0;
  // The lip where a tunnel opens into the next chamber.
  float lip = smoothstep(0.08, 0.25, room) * (1.0 - smoothstep(0.25, 0.6, room)) * detail;
  // The next chamber glows ahead, the light at the end of each tunnel.
  float nextChamber = (floor(z0 / uHop) + 1.0) * uHop;
  float tn = max(nextChamber - z0, 0.35);
  vec2 cn = (bend(nextChamber) - c0) / tn * 0.55;
  float halo = exp(-length(uv - cn) * (5.0 + tn * 0.6)) / (1.0 + tn * 0.22);

  if (uLook < 0.5) {
    // Scrap Paper: pencil hatching whose strokes thicken with the shade.
    float tone = 0.02 + (1.0 - near) * 0.55 + (0.5 - bump) * 0.45 + crease * 0.3 + (grain - 0.5) * 0.15;
    tone -= room * 0.45 + arrival * 0.95 + halo * 1.4;
    tone = clamp(tone, 0.0, 1.0);
    vec2 f = gl_FragCoord.xy;
    float spacing = 6.0;
    float g1 = abs(fract((f.x + f.y) / spacing) - 0.5) * spacing;
    float g2 = abs(fract((f.x - f.y) / spacing) - 0.5) * spacing;
    float w1 = tone * 2.2;
    float w2 = max(0.0, tone - 0.62) * 5.0;
    float ink = 1.0 - smoothstep(w1 - 0.6, w1 + 0.6, g1);
    ink = max(ink, 1.0 - smoothstep(w2 - 0.6, w2 + 0.6, g2));
    ink = max(ink, crease * 0.75);
    ink = max(ink, lip * 0.5);
    vec3 paper = vec3(0.953, 0.918, 0.84) * (0.97 + 0.03 * noise(vec3(f * 0.35, 1.0)));
    vec3 ochre = vec3(0.86, 0.66, 0.37);
    vec3 slate = vec3(0.52, 0.57, 0.62);
    vec3 wash = mix(paper, mix(ochre, slate, smoothstep(0.55, 0.85, base)), 0.55 * near * (1.0 - room * 0.5));
    wash = mix(wash, paper, arrival);
    vec3 col = mix(wash, vec3(0.16, 0.16, 0.2), ink * 0.88);
    col = mix(col, vec3(1.0, 0.97, 0.88), uFlash * 0.6);
    float vignette = smoothstep(1.3, 0.4, length(uv));
    color = vec4(col * mix(0.9, 1.0, vignette), 1.0);
  } else {
    // Lantern Dark: rock lit by the dart's lavender glow, warm light pooled in each chamber.
    vec3 stone = mix(vec3(0.2, 0.15, 0.12), vec3(0.6, 0.48, 0.37), rock) * (0.45 + bump * 1.0);
    stone *= (1.0 - crease * 0.7) * (0.8 + grain * 0.4);
    float glow = pow(near, 1.8) * 1.7;
    vec3 lit = stone * glow * vec3(0.8, 0.78, 1.0);
    lit += stone * room * pow(near, 0.6) * vec3(1.0, 0.58, 0.24) * 1.8;
    lit += vec3(1.0, 0.62, 0.3) * lip * 0.25 * pow(near, 0.5);
    lit += vec3(1.0, 0.72, 0.38) * arrival * 0.9 * (0.6 + rock * 0.4);
    lit += vec3(1.0, 0.64, 0.3) * halo * 1.1;
    float motes = step(0.997, hash(vec3(floor(gl_FragCoord.xy / 3.0), floor(uTime * 12.0))));
    lit += motes * 0.4 * near;
    lit += vec3(0.85, 0.8, 1.0) * uFlash * 0.35;
    float vignette = smoothstep(1.25, 0.2, length(uv));
    color = vec4(lit * (0.3 + 0.7 * vignette), 1.0);
  }
}`;

export interface TunnelFrame {
  /** Distance travelled, in the same units as `hop`. */
  travel: number;
  hop: number;
  /** Where the last chamber is (the dart's end), or 0 when not in view. */
  end: number;
  dark: boolean;
  seed: number;
  time: number;
  wobble: number;
  flash: number;
}

export interface TunnelRenderer {
  canvas: HTMLCanvasElement;
  draw(frame: TunnelFrame, width: number, height: number): void;
  dispose(): void;
}

/** Creates the tunnel canvas, or returns null where WebGL 2 is not available. */
export function createTunnel(scale = 0.75, keepFrame = false): TunnelRenderer | null {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: keepFrame });
  if (!gl) return null;
  const program = link(gl);
  if (!program) return null;
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const corner = gl.getAttribLocation(program, 'corner');
  const uniform = (name: string) => gl.getUniformLocation(program, name);
  const at = {
    res: uniform('uRes'),
    time: uniform('uTime'),
    travel: uniform('uTravel'),
    look: uniform('uLook'),
    seed: uniform('uSeed'),
    hop: uniform('uHop'),
    end: uniform('uEnd'),
    wobble: uniform('uWobble'),
    flash: uniform('uFlash'),
  };
  return {
    canvas,
    draw(frame, width, height) {
      const w = Math.max(1, Math.round(width * scale));
      const h = Math.max(1, Math.round(height * scale));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, w, h);
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(corner);
      gl.vertexAttribPointer(corner, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(at.res, w, h);
      gl.uniform1f(at.time, frame.time);
      gl.uniform1f(at.travel, frame.travel);
      gl.uniform1f(at.look, frame.dark ? 1 : 0);
      gl.uniform1f(at.seed, frame.seed);
      gl.uniform1f(at.hop, frame.hop);
      gl.uniform1f(at.end, frame.end);
      gl.uniform1f(at.wobble, frame.wobble);
      gl.uniform1f(at.flash, frame.flash);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    dispose() {
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}

function link(gl: WebGL2RenderingContext): WebGLProgram | null {
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader));
      return null;
    }
    return shader;
  };
  const vertex = compile(gl.VERTEX_SHADER, VERTEX);
  const fragment = compile(gl.FRAGMENT_SHADER, FRAGMENT);
  if (!vertex || !fragment) return null;
  const program = gl.createProgram()!;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    return null;
  }
  return program;
}
