import { CARD_ASPECT, drawCardFace } from './card-art';
import { RESTING } from './car';
import type { Look } from './look';
import { alpha, circle } from './paint';
import { type RoadCar, type RoadFrame, drawRoad, mileToX, roadGeometry } from './road';
import { ROUTES } from './routes';

/**
 * Detour's key art: both cars racing along the neon city road at night, close enough to read at
 * a tile's size, and a safety card slamming down above your car in a burst of gold as the coup
 * fourré lands. Night in both appearances; the card itself follows the Hall's look.
 */
export function paintPoster(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  look: Look,
  time: number,
): void {
  // Fewer miles across a narrow poster keeps both cars and the gap between them in view.
  const span = Math.max(160, Math.min(320, (w / h) * 180));
  const left = 520 - span * 0.62;
  const car = (side: 0 | 1, miles: number): RoadCar => ({
    model: side === 0 ? 'roadster' : 'coupe',
    ink: look.cars[side],
    miles,
    shownMiles: miles,
    pose: {
      ...RESTING,
      time,
      lights: true,
      wind: 1,
      wheelTurn: miles / 9 + time,
      bob: Math.sin(time * 14) * 0.5,
    },
    trouble: null,
    slowed: false,
    greenFlash: 0,
    tag: look.cars[side].tag,
    speed: 0.95,
    glow: side === 0 ? 0.9 : 0,
    hideTag: true,
  });
  const frame: RoadFrame = {
    route: ROUTES.city,
    night: true,
    x: 0,
    y: 0,
    w,
    h,
    left,
    span,
    end: 100_000,
    passedFlag: null,
    time,
    cars: [
      car(0, 540 + Math.sin(time * 0.5) * 4),
      car(1, 520 - span * 0.34 + Math.sin(time * 0.4 + 1) * 6),
    ],
    puffs: [],
    slowMo: 0,
    carScale: Math.min(h * 0.0042, w * 0.0021),
  };
  drawRoad(ctx, frame);
  const g = roadGeometry(frame);
  const yourX = mileToX(frame, frame.cars[0].miles);
  const cardW = Math.min(w * 0.2, h * 0.27);
  const cardH = cardW * CARD_ASPECT;
  const cx = Math.min(w - cardW * 0.8, Math.max(cardW * 0.8, yourX - g.carScale * 20));
  const cy = Math.max(cardH * 0.62, g.nearGround - g.carScale * 62 - cardH * 0.62);
  burst(ctx, cx, cy, cardW * 1.7, time);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.16 + Math.sin(time) * 0.02);
  ctx.shadowColor = alpha('#000000', 0.55);
  ctx.shadowBlur = cardW * 0.2;
  ctx.shadowOffsetY = cardW * 0.1;
  ctx.translate(-cardW / 2, -cardH / 2);
  drawCardFace(ctx, 'greenWave', cardW, cardH, look.card);
  ctx.restore();
}

/** Warm gold all through: a glow, slow-turning rays that fade outward, and two rings. */
function burst(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  time: number,
): void {
  const glow = ctx.createRadialGradient(x, y, 0, x, y, size);
  glow.addColorStop(0, alpha('#ffd76a', 0.55));
  glow.addColorStop(0.45, alpha('#ffb43a', 0.2));
  glow.addColorStop(1, alpha('#ffb43a', 0));
  ctx.fillStyle = glow;
  circle(ctx, x, y, size);
  ctx.fill();
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(time * 0.08);
  const rays = 16;
  for (let i = 0; i < rays; i++) {
    const a = (i * Math.PI * 2) / rays;
    const reach = size * (i % 2 ? 0.9 : 1.15);
    const half = Math.PI / rays / 2.2;
    const ray = ctx.createLinearGradient(0, 0, Math.cos(a) * reach, Math.sin(a) * reach);
    ray.addColorStop(0, alpha('#ffe08a', 0.75));
    ray.addColorStop(1, alpha('#ffb43a', 0));
    ctx.fillStyle = ray;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a - half) * reach, Math.sin(a - half) * reach);
    ctx.lineTo(Math.cos(a + half) * reach, Math.sin(a + half) * reach);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  const pulse = 1 + Math.sin(time * 1.6) * 0.03;
  ctx.lineWidth = size * 0.045;
  ctx.strokeStyle = alpha('#ffc94a', 0.9);
  circle(ctx, x, y, size * 0.62 * pulse);
  ctx.stroke();
  ctx.lineWidth = size * 0.018;
  ctx.strokeStyle = alpha('#fff4cf', 0.85);
  circle(ctx, x, y, size * 0.5 * pulse);
  ctx.stroke();
}
