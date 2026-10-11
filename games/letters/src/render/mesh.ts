/**
 * A unit cube with rounded edges and corners: a subdivided cube whose points are pulled onto a
 * smaller inner box and pushed back out along their offset. The same geometry serves every
 * cube and, stretched, the tray. Positions span −0.5…0.5; normals follow the rounding.
 */
export interface Mesh {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint16Array;
}

const FACES: readonly {
  normal: [number, number, number];
  u: [number, number, number];
  v: [number, number, number];
}[] = [
  { normal: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] },
  { normal: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  { normal: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] },
  { normal: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
  { normal: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
  { normal: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] },
];

/**
 * @param radius corner radius as a share of the cube's side (0–0.5)
 * @param steps subdivisions per face edge; the rounding needs a few near each edge
 */
export function roundedCube(radius: number, steps = 12): Mesh {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const inner = 0.5 - radius;
  // Spacing the subdivisions towards the edges spends the vertices where the curve is.
  const at = (i: number) => {
    const t = i / steps;
    const eased = t < 0.5 ? 0.5 * (2 * t) ** 1.6 : 1 - 0.5 * (2 - 2 * t) ** 1.6;
    return eased - 0.5;
  };
  for (const face of FACES) {
    const base = positions.length / 3;
    for (let j = 0; j <= steps; j++) {
      for (let i = 0; i <= steps; i++) {
        const a = at(i);
        const b = at(j);
        const p = [0, 1, 2].map(
          (axis) => face.normal[axis]! * 0.5 + face.u[axis]! * a + face.v[axis]! * b,
        ) as [number, number, number];
        const core = p.map((value) => Math.max(-inner, Math.min(inner, value))) as [
          number,
          number,
          number,
        ];
        const offset = [p[0] - core[0], p[1] - core[1], p[2] - core[2]];
        const length = Math.hypot(offset[0]!, offset[1]!, offset[2]!) || 1;
        const n = offset.map((value) => value / length);
        for (let axis = 0; axis < 3; axis++) {
          positions.push(core[axis]! + n[axis]! * radius);
          normals.push(n[axis]!);
        }
      }
    }
    for (let j = 0; j < steps; j++) {
      for (let i = 0; i < steps; i++) {
        const a = base + j * (steps + 1) + i;
        const b = a + 1;
        const c = a + steps + 1;
        const d = c + 1;
        indices.push(a, b, d, a, d, c);
      }
    }
  }
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint16Array(indices),
  };
}
