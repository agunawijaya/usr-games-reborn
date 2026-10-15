import { createRng } from '@usr-games/kit';
import type { PondLayout } from './layout';
import type { Look } from './look';
import { glowSprite } from './sprite-cache';

/**
 * Life in the air: by day a few dragonflies dart and hover over the reeds; by night fireflies
 * drift and blink above the banks and the water. Both are pure functions of time.
 */

type Ctx = CanvasRenderingContext2D;

export function drawFlyers(ctx: Ctx, layout: PondLayout, look: Look, time: number): void {
  if (look.moon) drawFireflies(ctx, layout, look, time);
  else drawDragonflies(ctx, layout, look, time);
}

function drawFireflies(ctx: Ctx, layout: PondLayout, look: Look, time: number): void {
  const rng = createRng('gone-fishing:fireflies');
  const { width, height, s } = layout;
  for (let i = 0; i < 46; i++) {
    const homeX = rng.float(0, layout.pondArea.w + 60 * s);
    const homeY = rng.float(layout.horizon * 0.9, height * 0.9);
    const speed = rng.float(0.15, 0.4);
    const phase = rng.float(0, Math.PI * 2);
    const x =
      homeX + Math.sin(time * speed + phase) * 40 * s + Math.sin(time * speed * 2.3) * 12 * s;
    const y = homeY + Math.cos(time * speed * 0.8 + phase) * 26 * s;
    if (x > width) continue;
    // Each blinks on and off on its own slow rhythm.
    const glow = Math.max(0, Math.sin(time * rng.float(0.8, 1.6) + phase)) ** 2;
    if (glow < 0.04) continue;
    const r = 16 * s * glow;
    ctx.drawImage(glowSprite(look.flyer.glow, 1), x - r, y - r, r * 2, r * 2);
    ctx.fillStyle = '#fff7c2';
    ctx.globalAlpha = glow;
    ctx.beginPath();
    ctx.arc(x, y, 1.8 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawDragonflies(ctx: Ctx, layout: PondLayout, look: Look, time: number): void {
  const { pond, s } = layout;
  const routes = [
    { cx: pond.cx - pond.rx * 0.78, cy: pond.cy - pond.ry * 0.45, rx: 120, ry: 50, speed: 0.5 },
    { cx: pond.cx + pond.rx * 0.7, cy: pond.cy + pond.ry * 0.2, rx: 140, ry: 70, speed: 0.38 },
    { cx: pond.cx - pond.rx * 0.2, cy: pond.cy + pond.ry * 0.62, rx: 90, ry: 40, speed: 0.6 },
  ];
  routes.forEach((route, i) => {
    // Darting: quick moves between hovers, which a smooth path with a pause in it gives.
    const t = time * route.speed + i * 2;
    const hover = Math.sin(t * 3) * 0.5 + 0.5;
    const progress = t + hover * 0.3;
    const x = route.cx + Math.sin(progress * 1.3) * route.rx * s;
    const y = route.cy + Math.sin(progress * 2.1) * route.ry * s;
    const dx = Math.cos(progress * 1.3) * 1.3 * route.rx;
    const dy = Math.cos(progress * 2.1) * 2.1 * route.ry;
    drawDragonfly(ctx, x, y, Math.atan2(dy, dx), s, look, time + i);
  });
}

function drawDragonfly(
  ctx: Ctx,
  x: number,
  y: number,
  heading: number,
  s: number,
  look: Look,
  time: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);
  ctx.scale(s, s);
  const flap = 0.6 + Math.abs(Math.sin(time * 40)) * 0.4;
  ctx.fillStyle = look.flyer.wing;
  ctx.strokeStyle = 'rgba(40, 80, 100, 0.35)';
  ctx.lineWidth = 0.6;
  for (const [offset, length] of [
    [3, 15],
    [-2, 13],
  ] as const) {
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(
        offset,
        side * length * 0.5 * flap,
        length * 0.28,
        length * 0.5 * flap,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.strokeStyle = look.flyer.body;
  ctx.lineCap = 'round';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(-20, 0);
  ctx.lineTo(4, 0);
  ctx.stroke();
  ctx.fillStyle = look.flyer.body;
  ctx.beginPath();
  ctx.ellipse(5, 0, 4, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#103040';
  ctx.beginPath();
  ctx.arc(8, -1.6, 1.6, 0, Math.PI * 2);
  ctx.arc(8, 1.6, 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
