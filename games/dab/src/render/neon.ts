import type { Point, Stroke } from './marks';
import { hash, rgba } from './noise';

/**
 * Neon at night. A tube is a white-hot core inside its colour, inside a wide soft glow, the
 * three added together. A tube that has just been lit flickers for a moment before it holds.
 */

/** How lit a tube is, `age` seconds after it was switched on: flickers, then steady. */
export function flickerOn(age: number, seed: number): number {
  if (age >= 0.45) return 1;
  if (age <= 0) return 0;
  const blink = hash(seed, Math.floor(age * 40)) > 0.45 ? 1 : 0.25;
  return Math.min(1, age / 0.45 + 0.2) * blink;
}

export function neonPath(
  ctx: CanvasRenderingContext2D,
  points: readonly Point[],
  width: number,
  colour: string,
  core: string,
  lit = 1,
) {
  if (points.length < 2 || lit <= 0) return;
  const trace = () => {
    ctx.beginPath();
    points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  };
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalCompositeOperation = 'lighter';
  for (const [w, a] of [
    [4.2, 0.07],
    [2.6, 0.12],
    [1.6, 0.22],
  ] as const) {
    ctx.strokeStyle = rgba(colour, a * lit);
    ctx.lineWidth = width * w;
    trace();
    ctx.stroke();
  }
  ctx.strokeStyle = rgba(colour, 0.95 * lit);
  ctx.lineWidth = width;
  trace();
  ctx.stroke();
  ctx.strokeStyle = rgba(core, 0.85 * lit);
  ctx.lineWidth = width * 0.38;
  trace();
  ctx.stroke();
  ctx.restore();
}

/** A neon tube from `a` to `b`, lit up to `progress` of its length. */
export function neonLine(
  ctx: CanvasRenderingContext2D,
  a: Point,
  b: Point,
  width: number,
  colour: string,
  core: string,
  lit = 1,
  progress = 1,
) {
  const end = { x: a.x + (b.x - a.x) * progress, y: a.y + (b.y - a.y) * progress };
  neonPath(ctx, [a, end], width, colour, core, lit);
}

export function neonMark(
  ctx: CanvasRenderingContext2D,
  strokes: readonly Stroke[],
  x: number,
  y: number,
  size: number,
  colour: string,
  core: string,
  lit = 1,
) {
  for (const stroke of strokes) {
    neonPath(
      ctx,
      stroke.map((p) => ({ x: x + p.x * size, y: y + p.y * size })),
      Math.max(1.4, size * 0.055),
      colour,
      core,
      lit,
    );
  }
}

/** A neon node: a small bright bead with a halo. */
export function neonDot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  colour: string,
  glow: string,
) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const halo = ctx.createRadialGradient(x, y, 0, x, y, radius * 4);
  halo.addColorStop(0, glow);
  halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(x - radius * 4, y - radius * 4, radius * 8, radius * 8);
  ctx.restore();
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}
