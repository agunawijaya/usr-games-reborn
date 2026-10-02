import type { Box } from './map';
import type { Look } from './look';
import { hash2, scatter } from './noise';

/**
 * What a lost expedition does to the map. On paper it crumples from the edges in: creases catch
 * the light on one side and shadow on the other, and two corners fold over. On the rock the chalk
 * is rubbed away at the edges, as if a sleeve had brushed it on the way out.
 */
export function spoilMap(
  ctx: CanvasRenderingContext2D,
  box: Box,
  look: Look,
  amount: number,
): void {
  if (amount <= 0) return;
  if (look.dark) smudge(ctx, box, amount);
  else crumple(ctx, box, amount);
}

function crumple(ctx: CanvasRenderingContext2D, box: Box, amount: number): void {
  const random = scatter(31);
  ctx.save();
  // The page darkens and greys towards its edges.
  const edge = ctx.createRadialGradient(
    box.x + box.w / 2,
    box.y + box.h / 2,
    Math.min(box.w, box.h) * 0.3,
    box.x + box.w / 2,
    box.y + box.h / 2,
    Math.hypot(box.w, box.h) * 0.55,
  );
  edge.addColorStop(0, 'rgba(80, 70, 55, 0)');
  edge.addColorStop(1, `rgba(80, 70, 55, ${0.28 * amount})`);
  ctx.fillStyle = edge;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  // Creases running in from the edges.
  for (let i = 0; i < 12; i++) {
    const side = i % 4;
    const along = 0.1 + random() * 0.8;
    const start =
      side === 0
        ? { x: box.x + box.w * along, y: box.y }
        : side === 1
          ? { x: box.x + box.w, y: box.y + box.h * along }
          : side === 2
            ? { x: box.x + box.w * along, y: box.y + box.h }
            : { x: box.x, y: box.y + box.h * along };
    const toward = { x: box.x + box.w / 2 - start.x, y: box.y + box.h / 2 - start.y };
    const length = Math.hypot(toward.x, toward.y) || 1;
    const reach = length * (0.25 + random() * 0.35) * amount;
    const points = [start];
    let x = start.x;
    let y = start.y;
    for (let k = 1; k <= 4; k++) {
      x += (toward.x / length) * (reach / 4) + (random() - 0.5) * 18;
      y += (toward.y / length) * (reach / 4) + (random() - 0.5) * 18;
      points.push({ x, y });
    }
    for (const [offset, color] of [
      [1.2, 'rgba(255, 252, 240, 0.7)'],
      [-1.2, 'rgba(70, 55, 35, 0.32)'],
    ] as const) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      points.forEach((p, k) =>
        k === 0 ? ctx.moveTo(p.x + offset, p.y) : ctx.lineTo(p.x + offset, p.y),
      );
      ctx.stroke();
    }
  }
  // Two corners folded over, showing the back of the page.
  for (const [cx, cy, sx, sy] of [
    [box.x + box.w, box.y, -1, 1],
    [box.x, box.y + box.h, 1, -1],
  ] as const) {
    const size = Math.min(box.w, box.h) * 0.12 * amount;
    ctx.fillStyle = 'rgba(60, 45, 25, 0.25)';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + sx * size * 1.15, cy);
    ctx.lineTo(cx, cy + sy * size * 1.15);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e6d8b9';
    ctx.strokeStyle = 'rgba(60, 45, 25, 0.5)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx + sx * size, cy);
    ctx.lineTo(cx, cy + sy * size);
    ctx.lineTo(cx + sx * size * 0.86, cy + sy * size * 0.86);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function smudge(ctx: CanvasRenderingContext2D, box: Box, amount: number): void {
  ctx.save();
  for (let i = 0; i < 9; i++) {
    const side = i % 4;
    const along = hash2(i, 3);
    const x = side === 1 ? box.x + box.w : side === 3 ? box.x : box.x + box.w * along;
    const y = side === 0 ? box.y : side === 2 ? box.y + box.h : box.y + box.h * along;
    const r = Math.min(box.w, box.h) * (0.18 + hash2(i, 5) * 0.16) * amount;
    const wipe = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
    wipe.addColorStop(0, 'rgba(22, 25, 27, 0.92)');
    wipe.addColorStop(1, 'rgba(22, 25, 27, 0)');
    ctx.fillStyle = wipe;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.strokeStyle = 'rgba(230, 225, 210, 0.08)';
    ctx.lineWidth = r * 0.25;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - r * 0.5, y + r * 0.2);
    ctx.lineTo(x + r * 0.5, y - r * 0.15);
    ctx.stroke();
  }
  ctx.restore();
}
