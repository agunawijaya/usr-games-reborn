/**
 * Draws a fish from a species description along a spine that can arch and wriggle. Every part
 * (body, fins, markings, eye) is described in the fish's own straight frame, nose to the right,
 * 100 units from tail tip to snout and centred on 0, then bent through `warp`, so head, body and
 * tail always stay one connected animal however the fish moves.
 */

export type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
export type Point = readonly [number, number];

export interface FishPose {
  /** −1 … 1: the whole body arched, back up for positive values (a leap's curve). */
  arch: number;
  /** 0 … 1: a wave running down the body to the tail (wriggling, swimming). */
  wiggle: number;
  /** The wave's phase in radians; advance it with time. */
  phase: number;
}

export const STILL: FishPose = { arch: 0, wiggle: 0, phase: 0 };

function spineY(x: number, pose: FishPose): number {
  const u = Math.max(-1, Math.min(1, x / 50));
  const arch = -pose.arch * 13 * (1 - u * u);
  // The wave grows towards the tail; the head barely moves, as in a swimming fish.
  const towardTail = Math.max(0, (38 - x) / 88) ** 1.5;
  const wave = pose.wiggle * 11 * towardTail * Math.sin(pose.phase - x * 0.075);
  return arch + wave;
}

/** A point of the straight fish moved onto the bent one: along the spine, then along its normal. */
export function warp(x: number, y: number, pose: FishPose): [number, number] {
  if (pose.arch === 0 && pose.wiggle === 0) return [x, y];
  const spine = spineY(x, pose);
  const slope = spineY(x + 0.5, pose) - spineY(x - 0.5, pose);
  const length = Math.hypot(1, slope);
  return [x - (y * slope) / length, spine + y / length];
}

/** Catmull–Rom through a list of [x, value] points, sampled at any x within them. */
export function curveThrough(points: readonly Point[]): (x: number) => number {
  return (x: number) => {
    if (x <= points[0]![0]) return points[0]![1];
    const last = points[points.length - 1]!;
    if (x >= last[0]) return last[1];
    let i = 0;
    while (points[i + 1]![0] < x) i++;
    const p0 = points[Math.max(0, i - 1)]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[Math.min(points.length - 1, i + 2)]!;
    const t = (x - p1[0]) / (p2[0] - p1[0]);
    const m1 = ((p2[1] - p0[1]) / (p2[0] - p0[0] || 1)) * (p2[0] - p1[0]);
    const m2 = ((p3[1] - p1[1]) / (p3[0] - p1[0] || 1)) * (p2[0] - p1[0]);
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * p1[1] +
      (t3 - 2 * t2 + t) * m1 +
      (-2 * t3 + 3 * t2) * p2[1] +
      (t3 - t2) * m2
    );
  };
}

/** Builds a path in the straight frame and lays it on the bent fish, curves sampled finely. */
export class WarpPath {
  private readonly points: [number, number][] = [];
  private current: Point = [0, 0];

  constructor(private readonly pose: FishPose) {}

  moveTo(x: number, y: number): this {
    this.points.push(warp(x, y, this.pose));
    this.current = [x, y];
    return this;
  }

  lineTo(x: number, y: number, steps = 4): this {
    const [x0, y0] = this.current;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      this.points.push(warp(x0 + (x - x0) * t, y0 + (y - y0) * t, this.pose));
    }
    this.current = [x, y];
    return this;
  }

  quadTo(cx: number, cy: number, x: number, y: number, steps = 8): this {
    const [x0, y0] = this.current;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const u = 1 - t;
      this.points.push(
        warp(
          u * u * x0 + 2 * u * t * cx + t * t * x,
          u * u * y0 + 2 * u * t * cy + t * t * y,
          this.pose,
        ),
      );
    }
    this.current = [x, y];
    return this;
  }

  /** A smooth closed outline through points, the way fins are drawn: curves through midpoints. */
  smoothLoop(points: readonly Point[]): this {
    const n = points.length;
    const mid = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const start = mid(points[n - 1]!, points[0]!);
    this.moveTo(start[0], start[1]);
    for (let i = 0; i < n; i++) {
      const p = points[i]!;
      const next = mid(p, points[(i + 1) % n]!);
      this.quadTo(p[0], p[1], next[0], next[1]);
    }
    return this;
  }

  /** Corners kept sharp at the given indices (spines, fork tips), smooth elsewhere. */
  shapedLoop(points: readonly Point[], sharp: readonly number[]): this {
    if (sharp.length === 0) return this.smoothLoop(points);
    const n = points.length;
    const mid = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const firstSharp = sharp.length > 0 ? sharp[0]! : -1;
    const startIndex = firstSharp >= 0 ? firstSharp : 0;
    const start = firstSharp >= 0 ? points[startIndex]! : mid(points[n - 1]!, points[0]!);
    this.moveTo(start[0], start[1]);
    for (let k = 1; k <= n; k++) {
      const i = (startIndex + k) % n;
      const p = points[i]!;
      if (sharp.includes(i)) {
        this.lineTo(p[0], p[1]);
      } else {
        const next = points[(i + 1) % n]!;
        const target = sharp.includes((i + 1) % n) ? next : mid(p, next);
        this.quadTo(p[0], p[1], target[0], target[1]);
        if (sharp.includes((i + 1) % n)) k++;
      }
    }
    return this;
  }

  /** Writes the path into a canvas context, closed when asked. */
  trace(ctx: Ctx, close = true): void {
    ctx.beginPath();
    this.points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    if (close) ctx.closePath();
  }
}
