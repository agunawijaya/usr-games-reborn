import type { Point, Stroke } from './marks';
import { hash, painter, rgba } from './noise';

/**
 * Chalk on pavement. A chalk line is a soft core with ragged edges: many short dabs along it,
 * each nudged off the line a little, plus grains that missed the stone's high points. The
 * wobble and the grain are seeded, so a line looks the same every frame.
 */

/** A chalk line from `a` to `b`, drawn up to `progress` (0–1) of its length. */
export function chalkLine(
  ctx: CanvasRenderingContext2D,
  a: Point,
  b: Point,
  width: number,
  colour: string,
  seed: number,
  progress = 1,
) {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  if (length < 0.5 || progress <= 0) return;
  const dx = (b.x - a.x) / length;
  const dy = (b.y - a.y) / length;
  const nx = -dy;
  const ny = dx;
  const wobble = (t: number) =>
    (Math.sin(t * 6.3 + hash(seed, 1) * 6) * 0.5 + Math.sin(t * 13 + hash(seed, 2) * 6) * 0.25) *
    width *
    0.35;
  const reach = length * progress;
  const random = painter(seed * 7919 + 13);

  // The body: overlapping dabs, slightly irregular.
  ctx.fillStyle = rgba(colour, 0.55);
  for (let d = 0; d < reach; d += width * 0.32) {
    const t = d / length;
    const off = wobble(t);
    const r = width * (0.42 + random() * 0.16);
    ctx.beginPath();
    ctx.ellipse(
      a.x + dx * d + nx * off,
      a.y + dy * d + ny * off,
      r,
      r * (0.7 + random() * 0.3),
      random() * 3,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  // Grain: tiny specks inside and just outside the stroke, some pale where chalk skipped.
  for (let d = 0; d < reach; d += width * 0.18) {
    const t = d / length;
    const off = wobble(t);
    for (let k = 0; k < 2; k++) {
      const across = (random() - 0.5) * width * 1.5;
      const x = a.x + dx * d + nx * (off + across);
      const y = a.y + dy * d + ny * (off + across);
      ctx.fillStyle =
        random() < 0.65 ? rgba(colour, 0.5 + random() * 0.4) : 'rgba(255, 255, 255, 0.35)';
      ctx.fillRect(x, y, width * (0.08 + random() * 0.12), width * (0.08 + random() * 0.12));
    }
  }
  // A brighter thread down the middle where the chalk pressed hardest.
  ctx.strokeStyle = rgba(colour, 0.6);
  ctx.lineWidth = width * 0.35;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let d = 0; d <= reach; d += width * 0.5) {
    const off = wobble(d / length) * 0.6;
    const x = a.x + dx * d + nx * off;
    const y = a.y + dy * d + ny * off;
    if (d === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

/** A chalk mark (a doodle of strokes) centred at `x, y`, `size` across. */
export function chalkMark(
  ctx: CanvasRenderingContext2D,
  strokes: readonly Stroke[],
  x: number,
  y: number,
  size: number,
  colour: string,
  seed: number,
  progress = 1,
) {
  const width = Math.max(1.5, size * 0.07);
  let budget = progress * strokes.reduce((sum, s) => sum + s.length - 1, 0);
  strokes.forEach((stroke, si) => {
    for (let i = 1; i < stroke.length && budget > 0; i++, budget--) {
      const p = stroke[i - 1]!;
      const q = stroke[i]!;
      chalkLine(
        ctx,
        { x: x + p.x * size, y: y + p.y * size },
        { x: x + q.x * size, y: y + q.y * size },
        width,
        colour,
        seed * 31 + si * 97 + i,
        Math.min(1, budget),
      );
    }
  });
}

/** A chalk dot: a small irregular dab where the lines meet. */
export function chalkDot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  colour: string,
  seed: number,
) {
  const random = painter(seed * 104729 + 7);
  // A soft dark ring first: white chalk alone is too faint on a sunny pavement.
  ctx.fillStyle = 'rgba(58, 48, 36, 0.55)';
  ctx.beginPath();
  ctx.arc(x, y + radius * 0.12, radius * 1.32, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = rgba(colour, 0.95);
  ctx.beginPath();
  for (let i = 0; i <= 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const r = radius * (0.82 + random() * 0.3);
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  for (let k = 0; k < 5; k++) {
    ctx.fillRect(
      x + (random() - 0.5) * radius * 2.4,
      y + (random() - 0.5) * radius * 2.4,
      radius * 0.25,
      radius * 0.25,
    );
  }
}

/** Dust kicked off a chalk tip as it draws. */
export function chalkDust(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  colour: string,
  time: number,
  seed: number,
) {
  const random = painter(seed * 613 + Math.floor(time * 30));
  for (let k = 0; k < 7; k++) {
    ctx.fillStyle = rgba(colour, 0.25 + random() * 0.35);
    const r = size * (0.04 + random() * 0.06);
    ctx.beginPath();
    ctx.arc(
      x + (random() - 0.5) * size * 0.6,
      y + (random() - 0.5) * size * 0.6,
      r,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
}
