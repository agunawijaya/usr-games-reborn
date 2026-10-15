import type { Look } from './look';
import { type Ctx, DISPLAY_FONT, alpha, circle, easeOutCubic, fillWith, roundRect } from './paint';

/**
 * The coup fourré's big moment, painted over the table: a burst of rays where the safety
 * lands, a ring of light, and a banner that drops in with the points.
 */

/** Rays and a ring around (x, y); `t` runs 0–1 over the burst. */
export function drawCoupBurst(
  ctx: Ctx,
  x: number,
  y: number,
  size: number,
  t: number,
  look: Look,
): void {
  const gold = look.card.families.safety.base;
  const grow = easeOutCubic(Math.min(1, t * 2.2));
  const fade = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(t * 0.6);
  const rays = 12;
  const reach = size * (0.45 + grow * 0.75);
  for (let i = 0; i < rays; i++) {
    const a0 = (i * Math.PI * 2) / rays;
    const a1 = a0 + Math.PI / rays;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a0) * reach, Math.sin(a0) * reach);
    ctx.lineTo(Math.cos(a1) * reach, Math.sin(a1) * reach);
    ctx.closePath();
    fillWith(ctx, alpha(i % 2 ? '#ffffff' : gold, (look.dark ? 0.3 : 0.4) * fade));
  }
  ctx.restore();
  ctx.save();
  ctx.lineWidth = size * 0.07 * fade;
  ctx.strokeStyle = alpha(gold, 0.9 * fade);
  circle(ctx, x, y, size * (0.25 + grow * 0.55));
  ctx.stroke();
  ctx.lineWidth = size * 0.03 * fade;
  ctx.strokeStyle = alpha('#ffffff', 0.9 * fade);
  circle(ctx, x, y, size * (0.18 + grow * 0.4));
  ctx.stroke();
  const flash = ctx.createRadialGradient(x, y, 0, x, y, size * 0.9);
  flash.addColorStop(0, alpha('#ffffff', 0.85 * fade * (1 - t)));
  flash.addColorStop(1, alpha('#ffffff', 0));
  ctx.fillStyle = flash;
  circle(ctx, x, y, size * 0.9);
  ctx.fill();
  ctx.restore();
}

/**
 * A ribbon banner: the headline in big poster type and a smaller line under it. `t` is how far
 * it has dropped in (0–1).
 */
export function drawBanner(
  ctx: Ctx,
  x: number,
  y: number,
  scale: number,
  headline: string,
  line: string,
  t: number,
  look: Look,
): void {
  const drop = easeOutCubic(t);
  const s = scale * (0.86 + 0.14 * drop);
  ctx.save();
  ctx.globalAlpha = Math.min(1, t * 3);
  ctx.translate(x, y - (1 - drop) * 60 * scale);
  ctx.rotate(-0.035);
  ctx.font = `800 ${64 * s}px ${DISPLAY_FONT}`;
  const w = ctx.measureText(headline).width + 90 * s;
  const h = 96 * s;
  const gold = look.card.families.safety.base;
  const deep = look.card.families.safety.deep;
  // Ribbon tails.
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(dir * (w / 2 - 20 * s), -h * 0.18);
    ctx.lineTo(dir * (w / 2 + 46 * s), -h * 0.18);
    ctx.lineTo(dir * (w / 2 + 26 * s), h * 0.12);
    ctx.lineTo(dir * (w / 2 + 46 * s), h * 0.42);
    ctx.lineTo(dir * (w / 2 - 20 * s), h * 0.42);
    ctx.closePath();
    fillWith(ctx, deep);
  }
  ctx.save();
  ctx.shadowColor = alpha('#000000', 0.35);
  ctx.shadowBlur = 24 * s;
  ctx.shadowOffsetY = 8 * s;
  roundRect(ctx, -w / 2, -h / 2, w, h, 14 * s);
  fillWith(ctx, gold);
  ctx.restore();
  roundRect(ctx, -w / 2 + 7 * s, -h / 2 + 7 * s, w - 14 * s, h - 14 * s, 10 * s);
  ctx.strokeStyle = alpha('#1c1404', 0.55);
  ctx.lineWidth = 2 * s;
  ctx.stroke();
  ctx.fillStyle = '#1c1404';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(headline, 0, 3 * s);
  if (line) {
    ctx.font = `750 ${24 * s}px ${DISPLAY_FONT}`;
    const lw = ctx.measureText(line).width + 34 * s;
    roundRect(ctx, -lw / 2, h / 2 + 10 * s, lw, 40 * s, 20 * s);
    fillWith(ctx, look.dark ? '#101a2e' : '#1d2838');
    ctx.fillStyle = '#fff6e0';
    ctx.fillText(line, 0, h / 2 + 31 * s);
  }
  ctx.restore();
}

/** A soft white puff of smoke or air. */
export function drawPuff(
  ctx: Ctx,
  x: number,
  y: number,
  r: number,
  a: number,
  night: boolean,
): void {
  ctx.fillStyle = alpha(night ? '#c9cfe0' : '#ffffff', a);
  for (const [dx, dy, k] of [
    [0, 0, 1],
    [0.8, 0.2, 0.75],
    [-0.75, 0.3, 0.65],
    [0.2, -0.55, 0.7],
  ] as const) {
    circle(ctx, x + dx * r, y + dy * r, r * k);
    ctx.fill();
  }
}
