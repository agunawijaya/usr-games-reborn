export interface Point {
  x: number;
  y: number;
}

/** A closed polygon with its corners softened, like a hand-cut flagstone. */
export function softPolygon(
  ctx: CanvasRenderingContext2D,
  points: readonly Point[],
  radius: number,
) {
  const n = points.length;
  const at = (i: number) => points[((i % n) + n) % n]!;
  const start = midpoint(at(-1), at(0));
  ctx.moveTo(start.x, start.y);
  for (let i = 0; i < n; i++) {
    const corner = at(i);
    const next = midpoint(corner, at(i + 1));
    ctx.arcTo(corner.x, corner.y, next.x, next.y, radius);
  }
  ctx.closePath();
}

export function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** A four-pointed sparkle, the glint of light on a gem. */
export function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const waist = size * 0.18;
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.quadraticCurveTo(x + waist, y - waist, x + size, y);
  ctx.quadraticCurveTo(x + waist, y + waist, x, y + size);
  ctx.quadraticCurveTo(x - waist, y + waist, x - size, y);
  ctx.quadraticCurveTo(x - waist, y - waist, x, y - size);
  ctx.closePath();
}

/** A soft round glow that fades to nothing at `radius`. */
export function glow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  colour: string,
) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, colour);
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

/** Catmull-Rom points through `points`, `samples` per span, for smooth bodies and streams. */
export function smoothPath(points: readonly Point[], samples: number): Point[] {
  if (points.length < 2) return points.map((p) => ({ ...p }));
  const result: Point[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[Math.min(points.length - 1, i + 2)]!;
    for (let s = 0; s < samples; s++) {
      const t = s / samples;
      const t2 = t * t;
      const t3 = t2 * t;
      result.push({
        x:
          0.5 *
          (2 * p1.x +
            (-p0.x + p2.x) * t +
            (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
            (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y:
          0.5 *
          (2 * p1.y +
            (-p0.y + p2.y) * t +
            (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
            (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  result.push({ ...points[points.length - 1]! });
  return result;
}
