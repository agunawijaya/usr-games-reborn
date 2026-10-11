/**
 * The little linear algebra the cube scene needs: column-major 4×4 matrices as WebGL expects,
 * unit quaternions for cube orientation, and rays for picking cubes under the pointer.
 */

export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number];
export type Mat4 = Float32Array;

export const IDENTITY_QUAT: Quat = [0, 0, 0, 1];

export function vec3(x: number, y: number, z: number): Vec3 {
  return [x, y, z];
}

export function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function scale(a: Vec3, s: number): Vec3 {
  return [a[0] * s, a[1] * s, a[2] * s];
}

export function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

export function normalize(a: Vec3): Vec3 {
  const length = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / length, a[1] / length, a[2] / length];
}

export function perspective(fovY: number, aspect: number, near: number, far: number): Mat4 {
  const f = 1 / Math.tan(fovY / 2);
  const m = new Float32Array(16);
  m[0] = f / aspect;
  m[5] = f;
  m[10] = (far + near) / (near - far);
  m[11] = -1;
  m[14] = (2 * far * near) / (near - far);
  return m;
}

export function lookAt(eye: Vec3, target: Vec3, up: Vec3): Mat4 {
  const z = normalize(sub(eye, target));
  const x = normalize(cross(up, z));
  const y = cross(z, x);
  const m = new Float32Array(16);
  m[0] = x[0];
  m[1] = y[0];
  m[2] = z[0];
  m[4] = x[1];
  m[5] = y[1];
  m[6] = z[1];
  m[8] = x[2];
  m[9] = y[2];
  m[10] = z[2];
  m[12] = -dot(x, eye);
  m[13] = -dot(y, eye);
  m[14] = -dot(z, eye);
  m[15] = 1;
  return m;
}

export function multiply(a: Mat4, b: Mat4): Mat4 {
  const out = new Float32Array(16);
  for (let column = 0; column < 4; column++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[k * 4 + row]! * b[column * 4 + k]!;
      out[column * 4 + row] = sum;
    }
  }
  return out;
}

/** Shifts the image in clip space, so the grid can be centred in any part of the canvas. */
export function shiftClip(dx: number, dy: number): Mat4 {
  const m = new Float32Array(16);
  m[0] = 1;
  m[5] = 1;
  m[10] = 1;
  m[15] = 1;
  m[8] = dx;
  m[9] = dy;
  return m;
}

export function transformPoint(m: Mat4, p: Vec3): [number, number, number, number] {
  const [x, y, z] = p;
  return [
    m[0]! * x + m[4]! * y + m[8]! * z + m[12]!,
    m[1]! * x + m[5]! * y + m[9]! * z + m[13]!,
    m[2]! * x + m[6]! * y + m[10]! * z + m[14]!,
    m[3]! * x + m[7]! * y + m[11]! * z + m[15]!,
  ];
}

export function invert(m: Mat4): Mat4 {
  const inv = new Float32Array(16);
  const a = (i: number) => m[i]!;
  inv[0] =
    a(5) * a(10) * a(15) -
    a(5) * a(11) * a(14) -
    a(9) * a(6) * a(15) +
    a(9) * a(7) * a(14) +
    a(13) * a(6) * a(11) -
    a(13) * a(7) * a(10);
  inv[4] =
    -a(4) * a(10) * a(15) +
    a(4) * a(11) * a(14) +
    a(8) * a(6) * a(15) -
    a(8) * a(7) * a(14) -
    a(12) * a(6) * a(11) +
    a(12) * a(7) * a(10);
  inv[8] =
    a(4) * a(9) * a(15) -
    a(4) * a(11) * a(13) -
    a(8) * a(5) * a(15) +
    a(8) * a(7) * a(13) +
    a(12) * a(5) * a(11) -
    a(12) * a(7) * a(9);
  inv[12] =
    -a(4) * a(9) * a(14) +
    a(4) * a(10) * a(13) +
    a(8) * a(5) * a(14) -
    a(8) * a(6) * a(13) -
    a(12) * a(5) * a(10) +
    a(12) * a(6) * a(9);
  inv[1] =
    -a(1) * a(10) * a(15) +
    a(1) * a(11) * a(14) +
    a(9) * a(2) * a(15) -
    a(9) * a(3) * a(14) -
    a(13) * a(2) * a(11) +
    a(13) * a(3) * a(10);
  inv[5] =
    a(0) * a(10) * a(15) -
    a(0) * a(11) * a(14) -
    a(8) * a(2) * a(15) +
    a(8) * a(3) * a(14) +
    a(12) * a(2) * a(11) -
    a(12) * a(3) * a(10);
  inv[9] =
    -a(0) * a(9) * a(15) +
    a(0) * a(11) * a(13) +
    a(8) * a(1) * a(15) -
    a(8) * a(3) * a(13) -
    a(12) * a(1) * a(11) +
    a(12) * a(3) * a(9);
  inv[13] =
    a(0) * a(9) * a(14) -
    a(0) * a(10) * a(13) -
    a(8) * a(1) * a(14) +
    a(8) * a(2) * a(13) +
    a(12) * a(1) * a(10) -
    a(12) * a(2) * a(9);
  inv[2] =
    a(1) * a(6) * a(15) -
    a(1) * a(7) * a(14) -
    a(5) * a(2) * a(15) +
    a(5) * a(3) * a(14) +
    a(13) * a(2) * a(7) -
    a(13) * a(3) * a(6);
  inv[6] =
    -a(0) * a(6) * a(15) +
    a(0) * a(7) * a(14) +
    a(4) * a(2) * a(15) -
    a(4) * a(3) * a(14) -
    a(12) * a(2) * a(7) +
    a(12) * a(3) * a(6);
  inv[10] =
    a(0) * a(5) * a(15) -
    a(0) * a(7) * a(13) -
    a(4) * a(1) * a(15) +
    a(4) * a(3) * a(13) +
    a(12) * a(1) * a(7) -
    a(12) * a(3) * a(5);
  inv[14] =
    -a(0) * a(5) * a(14) +
    a(0) * a(6) * a(13) +
    a(4) * a(1) * a(14) -
    a(4) * a(2) * a(13) -
    a(12) * a(1) * a(6) +
    a(12) * a(2) * a(5);
  inv[3] =
    -a(1) * a(6) * a(11) +
    a(1) * a(7) * a(10) +
    a(5) * a(2) * a(11) -
    a(5) * a(3) * a(10) -
    a(9) * a(2) * a(7) +
    a(9) * a(3) * a(6);
  inv[7] =
    a(0) * a(6) * a(11) -
    a(0) * a(7) * a(10) -
    a(4) * a(2) * a(11) +
    a(4) * a(3) * a(10) +
    a(8) * a(2) * a(7) -
    a(8) * a(3) * a(6);
  inv[11] =
    -a(0) * a(5) * a(11) +
    a(0) * a(7) * a(9) +
    a(4) * a(1) * a(11) -
    a(4) * a(3) * a(9) -
    a(8) * a(1) * a(7) +
    a(8) * a(3) * a(5);
  inv[15] =
    a(0) * a(5) * a(10) -
    a(0) * a(6) * a(9) -
    a(4) * a(1) * a(10) +
    a(4) * a(2) * a(9) +
    a(8) * a(1) * a(6) -
    a(8) * a(2) * a(5);
  const det = a(0) * inv[0]! + a(1) * inv[4]! + a(2) * inv[8]! + a(3) * inv[12]!;
  const scaleBy = det === 0 ? 0 : 1 / det;
  for (let i = 0; i < 16; i++) inv[i] = inv[i]! * scaleBy;
  return inv;
}

export function quatFromAxisAngle(axis: Vec3, angle: number): Quat {
  const [x, y, z] = normalize(axis);
  const s = Math.sin(angle / 2);
  return [x * s, y * s, z * s, Math.cos(angle / 2)];
}

/** a then b: rotating by the result is rotating by `b`, then by `a`. */
export function quatMultiply(a: Quat, b: Quat): Quat {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

/** The rotation that turns the orthonormal frame (fromA, fromB) into (toA, toB). */
export function quatFromFrames(fromA: Vec3, fromB: Vec3, toA: Vec3, toB: Vec3): Quat {
  const fromC = cross(fromA, fromB);
  const toC = cross(toA, toB);
  // R = T · Fᵀ, with the frames as columns.
  const r = (i: number, j: number) =>
    toA[i]! * fromA[j]! + toB[i]! * fromB[j]! + toC[i]! * fromC[j]!;
  const m00 = r(0, 0);
  const m11 = r(1, 1);
  const m22 = r(2, 2);
  const trace = m00 + m11 + m22;
  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2;
    return [(r(2, 1) - r(1, 2)) / s, (r(0, 2) - r(2, 0)) / s, (r(1, 0) - r(0, 1)) / s, s / 4];
  }
  if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    return [s / 4, (r(0, 1) + r(1, 0)) / s, (r(0, 2) + r(2, 0)) / s, (r(2, 1) - r(1, 2)) / s];
  }
  if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    return [(r(0, 1) + r(1, 0)) / s, s / 4, (r(1, 2) + r(2, 1)) / s, (r(0, 2) - r(2, 0)) / s];
  }
  const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
  return [(r(0, 2) + r(2, 0)) / s, (r(1, 2) + r(2, 1)) / s, s / 4, (r(1, 0) - r(0, 1)) / s];
}

export function rotate(q: Quat, v: Vec3): Vec3 {
  const u: Vec3 = [q[0], q[1], q[2]];
  const w = q[3];
  const t = scale(cross(u, v), 2);
  return add(add(v, scale(t, w)), cross(u, t));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}
