// Rain streaks and splash droplets: one instanced segment program.
//
// Every particle is a line segment in the world (where it is now, where it
// was a shutter-time ago), projected and widened into a screen quad —
// motion blur for free. Width comes from the drop's size plus a thin-lens
// circle of confusion (focus ~6 m), and the light is conserved when a
// segment is drawn wider than it is: out-of-focus rain is broad and faint.
//
//   ambient  thousands of streaks generated in the vertex shader from the
//            instance id (no CPU cost); density follows the delay
//   engine   the drops the engine made, falling for LATENCY_MS to land on
//            their "." (ADR-003); crown and jet droplets thrown up by the
//            ages of each drop (ADR-003's table)
import { startProgram, ready, finishProgram } from './gl.js';
import { MAX_LAMPS } from './shaders/scene.js';

const MAX_CPU = 12000;
const FLOATS = 12; // p0.xyz width | p1.xyz light | rgb soft
export const FALL_SPEED = 7.0; // m/s, a 2 mm raindrop near terminal speed
export const SHUTTER = 1 / 55; // s, a cinematic 180-degree shutter
const GRAVITY = 9.81;
const FOCUS = 6.0;
const APERTURE = 0.018; // m: sets the circle of confusion

const COMMON_VS = /* glsl */ `
uniform vec3 uCamPos;
uniform vec3 uFwd;
uniform vec3 uUp;
uniform vec3 uRight;
uniform float uTanHalf;
uniform float uAspect;
uniform vec2 uRes;
uniform float uTime;
uniform int uLampCount;
uniform vec3 uLampDir[${MAX_LAMPS}];
uniform vec4 uLampCol[${MAX_LAMPS}];
uniform vec3 uMoon;
out vec2 vQ;      // x: across (-1..1), y: along (0 head .. 1 tail)
out vec3 vCol;
out float vSoft;

vec3 toCam(vec3 p) {
  vec3 q = p - uCamPos;
  return vec3(dot(q, uRight), dot(q, uUp), dot(q, uFwd));
}

// light falling on a drop from the lanterns and the moon, seen from here
vec3 dropLight(vec3 p) {
  vec3 dir = normalize(p - uCamPos);
  float az = atan(dir.x, dir.z);
  // mostly unlit; drops toward the moon are backlit and glow
  float ma = acos(clamp(dot(dir, uMoon), -1.0, 1.0));
  vec3 c = vec3(0.42, 0.46, 0.56) * (0.10 + 1.3 * exp(-ma / 0.30) + 0.25 * exp(-ma / 0.9));
  for (int i = 0; i < ${MAX_LAMPS}; i++) {
    if (i >= uLampCount) break;
    float laz = atan(uLampDir[i].x, uLampDir[i].z);
    float x = (az - laz) / 0.09;
    c += uLampCol[i].rgb * 0.05 * exp(-x * x);
  }
  return c;
}

void emit(vec3 p0, vec3 p1, float width, float light, vec3 col, float soft) {
  // clip at the water: a drop does not fall through the surface
  if (p1.y < 0.0 && p0.y < 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  if (p0.y < 0.0) p0 = mix(p1, p0, p1.y / max(p1.y - p0.y, 1e-5));
  if (p1.y < 0.0) p1 = mix(p0, p1, p0.y / max(p0.y - p1.y, 1e-5));
  vec3 a = toCam(p0);
  vec3 b = toCam(p1);
  if (a.z < 0.08 || b.z < 0.08) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec2 sa = vec2(a.x / (a.z * uTanHalf * uAspect), a.y / (a.z * uTanHalf)) * 0.5 * uRes;
  vec2 sb = vec2(b.x / (b.z * uTanHalf * uAspect), b.y / (b.z * uTanHalf)) * 0.5 * uRes;
  float pxPerM = uRes.y / (2.0 * uTanHalf * a.z);
  // thin-lens circle of confusion, as a width in metres at that distance
  float coc = ${APERTURE.toFixed(4)} * abs(a.z - ${FOCUS.toFixed(1)}) / ${FOCUS.toFixed(1)};
  float wm = width + coc;
  float wpx = max(wm * pxPerM, 1.3);
  float energy = (width * pxPerM) / wpx; // light conserved when widened
  vec2 axis = sb - sa;
  float len = length(axis);
  vec2 dirv = len > 1e-3 ? axis / len : vec2(0.0, 1.0);
  vec2 nrm = vec2(-dirv.y, dirv.x);
  int k = gl_VertexID % 6;
  // two triangles: (0,1,2) (2,1,3) over corners (head/tail x left/right)
  int corner = k == 0 ? 0 : k == 1 ? 1 : k == 2 ? 2 : k == 3 ? 2 : k == 4 ? 1 : 3;
  float side = (corner == 1 || corner == 3) ? 1.0 : -1.0;
  float along = corner >= 2 ? 1.0 : 0.0;
  float half_ = wpx * 0.5 + 1.0;
  vec2 pos = mix(sa - dirv * half_, sb + dirv * half_, along) + nrm * side * half_;
  gl_Position = vec4(pos / (0.5 * uRes), 0.0, 1.0);
  vQ = vec2(side, along);
  // a longer streak spreads the same light over more pixels
  float spread = wpx / (len + wpx);
  vCol = col * light * energy * spread;
  vSoft = soft;
}
`;

const AMBIENT_VS = /* glsl */ `#version 300 es
precision highp float;
${COMMON_VS}
uniform float uWindX;
uniform float uSpeed;

uint hh(uint x) {
  x ^= x >> 16; x *= 0x7feb352du; x ^= x >> 15; x *= 0x846ca68bu; x ^= x >> 16;
  return x;
}
float rnd(uint x) { return float(hh(x) & 0xffffffu) / 16777216.0; }

void main() {
  uint id = uint(gl_VertexID / 6);
  float r1 = rnd(id * 7u + 1u);
  float r2 = rnd(id * 7u + 2u);
  float r3 = rnd(id * 7u + 3u);
  // distance: rain fills the whole volume over the pond, so most drops
  // are far away (fine, faint); none closer than 3 m — nearer ones read
  // as rain running down the screen, not rain over the water
  float D = mix(3.0, 45.0, sqrt(r1));
  float yTop = uCamPos.y + D * 0.33 + 0.6;
  float v = uSpeed * (0.8 + 0.4 * r2);
  float cyc = uTime * v / yTop + r3;
  float k = floor(cyc);
  uint seed = hh(id * 131u + uint(k) * 977u);
  float sx = rnd(seed) * 2.4 - 1.2;
  float y = yTop * (1.0 - fract(cyc));
  vec3 vel = vec3(uWindX, -v, 0.0);
  vec3 p0 = vec3(sx * D * uTanHalf * uAspect, y, D) + vec3(uWindX * (yTop - y) / v, 0.0, 0.0);
  vec3 p1 = p0 - vel * ${SHUTTER.toFixed(5)};
  float light = (1.4 + 2.2 * rnd(seed + 5u) * rnd(seed + 9u))
    * mix(0.45, 1.0, smoothstep(3.0, 8.0, D)); // the nearest, blurriest: dimmer
  emit(p0, p1, 0.0016, light, dropLight(p0), 0.0);
}
`;

const CPU_VS = /* glsl */ `#version 300 es
precision highp float;
${COMMON_VS}
uniform sampler2D uData;   // MAX x 3 texels of vec4
void main() {
  int id = gl_VertexID / 6;
  int row = id / 1024;
  int col = id - row * 1024;
  vec4 a = texelFetch(uData, ivec2(col, row * 3), 0);
  vec4 b = texelFetch(uData, ivec2(col, row * 3 + 1), 0);
  vec4 c = texelFetch(uData, ivec2(col, row * 3 + 2), 0);
  vec3 tint = c.rgb;
  vec3 col3 = length(tint) > 0.0 ? tint : dropLight(a.xyz);
  emit(a.xyz, b.xyz, a.w, b.w, col3, c.a);
}
`;

const SEG_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vQ;
in vec3 vCol;
in float vSoft;
out vec4 o;
void main() {
  float across = exp(-vQ.x * vQ.x * 3.0);
  // the head (newest end) is brightest; the blur fades toward the tail
  float along = smoothstep(0.0, 0.12, vQ.y) * mix(1.0, 0.45, vQ.y) * smoothstep(1.0, 0.85, vQ.y);
  o = vec4(vCol * across * mix(along, 1.0, vSoft), 1.0);
}
`;

export async function createParticles(ctx) {
  const { gl } = ctx;
  const pa = startProgram(gl, AMBIENT_VS, SEG_FS, 'rain-ambient');
  const pc = startProgram(gl, CPU_VS, SEG_FS, 'rain-cpu');
  await new Promise((resolve) => {
    const poll = () => (ready(ctx, pa) && ready(ctx, pc) ? resolve() : setTimeout(poll, 16));
    poll();
  });
  const A = finishProgram(gl, pa);
  const C = finishProgram(gl, pc);
  const vao = gl.createVertexArray();

  // CPU particles live in a float texture (1024 wide, 3 rows per particle row)
  const ROWS = Math.ceil(MAX_CPU / 1024);
  const data = new Float32Array(1024 * ROWS * 3 * 4);
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 1024, ROWS * 3, 0, gl.RGBA, gl.FLOAT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  // splash droplets: x y z vx vy vz life kind
  const drops = [];
  let seed = 12345;
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  function put(i, p0, p1, width, light, tint, soft) {
    const row = Math.floor(i / 1024);
    const col = i - row * 1024;
    const o0 = ((row * 3) * 1024 + col) * 4;
    const o1 = ((row * 3 + 1) * 1024 + col) * 4;
    const o2 = ((row * 3 + 2) * 1024 + col) * 4;
    data[o0] = p0[0]; data[o0 + 1] = p0[1]; data[o0 + 2] = p0[2]; data[o0 + 3] = width;
    data[o1] = p1[0]; data[o1 + 1] = p1[1]; data[o1 + 2] = p1[2]; data[o1 + 3] = light;
    data[o2] = tint[0]; data[o2 + 1] = tint[1]; data[o2 + 2] = tint[2]; data[o2 + 3] = soft;
  }

  const NO_TINT = [0, 0, 0];

  // An age of a drop at (x, z): throw droplets (ADR-003's table).
  // Returns the landing spots of droplets for secondary ripples later.
  function splash(age, x, z, gain = 1) {
    const r = Math.hypot(x, z);
    if (age === 0) {
      // the crown: a ring of droplets thrown up and out
      // (mostly upward: from the side, a crown is a cup, not a star)
      const n = r < 5 ? 18 : r < 10 ? 10 : 5;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rand() * 0.4;
        const hs = (0.10 + 0.12 * rand()) * gain;
        const vs = (0.45 + 0.35 * rand()) * gain;
        drops.push([x, 0.002, z, Math.cos(a) * hs, vs, Math.sin(a) * hs, 0, 0]);
      }
    } else if (age === 2) {
      // the jet: one droplet straight up
      drops.push([x, 0.004, z, (rand() - 0.5) * 0.05, (1.0 + 0.4 * rand()) * gain, (rand() - 0.5) * 0.05, 0, 1]);
    }
    if (drops.length > MAX_CPU / 2) drops.splice(0, drops.length - MAX_CPU / 2);
  }

  // Advance droplets; returns the jet droplets that fell back this frame.
  function update(dt) {
    const landed = [];
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d[3] *= 1 - 0.5 * dt;
      d[5] *= 1 - 0.5 * dt;
      d[4] -= GRAVITY * dt;
      d[0] += d[3] * dt;
      d[1] += d[4] * dt;
      d[2] += d[5] * dt;
      d[6] += dt;
      if (d[1] < 0) {
        if (d[7] === 1) landed.push([d[0], d[2]]);
        // swap-remove: order does not matter, and a downpour removes hundreds a frame
        drops[i] = drops[drops.length - 1];
        drops.pop();
      }
    }
    return landed;
  }

  // falling: [[x, z, secondsToLand], ...] for the engine's drops in flight
  function draw(R, cam, t, dt, params) {
    const landed = update(dt);
    for (const [x, z] of landed) R.impulse(3, x, z, 0.25);
    let n = 0;
    const fallLight = 7.0;
    for (const [x, z, s] of params.falling || []) {
      if (n >= MAX_CPU) break;
      const y = FALL_SPEED * Math.max(s, 0);
      put(n++, [x, y, z], [x, y + FALL_SPEED * SHUTTER, z], 0.002, fallLight, NO_TINT, 0);
    }
    for (const d of drops) {
      if (n >= MAX_CPU) break;
      const p1 = [d[0] - d[3] * SHUTTER, d[1] - d[4] * SHUTTER, d[2] - d[5] * SHUTTER];
      put(n++, [d[0], d[1], d[2]], p1, d[7] === 1 ? 0.0018 : 0.0012, d[7] === 1 ? 0.5 : 0.35, NO_TINT, 0.6);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, R.hdr.fb);
    gl.viewport(0, 0, R.hdr.w, R.hdr.h);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.bindVertexArray(vao);

    const common = (P) => {
      const L = P.loc;
      gl.uniform3fv(L.uCamPos, cam.pos);
      gl.uniform3fv(L.uFwd, cam.fwd);
      gl.uniform3fv(L.uUp, cam.up);
      gl.uniform3fv(L.uRight, cam.right);
      gl.uniform1f(L.uTanHalf, cam.tanHalf);
      gl.uniform1f(L.uAspect, cam.aspect);
      gl.uniform2f(L.uRes, R.hdr.w, R.hdr.h);
      gl.uniform1f(L.uTime, t);
      const k = Math.min(R.lamps.length, MAX_LAMPS);
      gl.uniform1i(L.uLampCount, k);
      gl.uniform3fv(L.uLampDir, R.lamps.slice(0, k).flatMap((l) => l.dir));
      gl.uniform4fv(L.uLampCol, R.lamps.slice(0, k).flatMap((l) => [...l.col, l.rad]));
      gl.uniform3fv(L.uMoon, R.moon);
    };

    const ambient = Math.round(ambientCount(params.rain) * (params.streaks ?? 1));
    if (ambient > 0) {
      gl.useProgram(A.prog);
      common(A);
      gl.uniform1f(A.loc.uWindX, 0.7);
      gl.uniform1f(A.loc.uSpeed, FALL_SPEED);
      gl.drawArrays(gl.TRIANGLES, 0, ambient * 6);
    }
    if (n > 0) {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      const rows = Math.ceil(n / 1024);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 1024, rows * 3, gl.RGBA, gl.FLOAT, data, 0);
      gl.useProgram(C.prog);
      common(C);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(C.loc.uData, 0);
      gl.drawArrays(gl.TRIANGLES, 0, n * 6);
    }
    gl.disable(gl.BLEND);
  }

  return { draw, splash, count: () => drops.length };
}

// Streaks in the air for a rain amount 0..1 (drizzle .. downpour).
export function ambientCount(rain) {
  return Math.round(150 + 6000 * rain ** 1.8);
}
