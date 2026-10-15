import type { Look } from '../look';

/**
 * What every rival shares: the four moods, where and how big to draw them, and the little
 * effects that carry a mood (a blink, a thought bubble, sparkles of delight, a grumpy puff).
 * Each rival is drawn in its own frame: origin at the middle of where it sits or stands, up is
 * negative y, about 200 units tall at scale 1.
 */

export type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export type Mood = 'idle' | 'thinking' | 'delighted' | 'grumpy';

export interface RivalPose {
  x: number;
  y: number;
  scale: number;
  mood: Mood;
  /** Seconds, for breathing, blinking and fidgets. */
  time: number;
  /** Cards held, drawn as a fan of backs (at most nine shown). */
  cards: number;
  /** Seconds since the mood began, so a delighted hop starts on time. */
  moodAge: number;
  look: Look;
  /** A different rhythm per rival, so they never blink together. */
  seed: number;
  /** 1 faces right, −1 faces left (rivals drawn in profile). */
  facing?: 1 | -1;
}

export interface RivalPainter {
  /** Height above the base in units at scale 1, for placing name plates and bubbles. */
  readonly height: number;
  draw(ctx: Ctx, pose: RivalPose): void;
}

export function ellipse(
  ctx: Ctx,
  x: number,
  y: number,
  rx: number,
  ry: number,
  rotation = 0,
): void {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rotation, 0, Math.PI * 2);
}

/** 0 when the eyes are open, 1 at the middle of a blink; every few seconds, never in step. */
export function blinkAmount(time: number, seed: number): number {
  const period = 3.6 + (seed % 7) * 0.37;
  const phase = (time + seed * 1.3) % period;
  const blinkLength = 0.16;
  if (phase > blinkLength) return 0;
  return Math.sin((phase / blinkLength) * Math.PI);
}

/** A gentle rise and fall, the breath of someone sitting still. */
export function breath(time: number, seed: number): number {
  return Math.sin(time * 1.7 + seed) * 0.5 + 0.5;
}

/** The little jump of delight: up and down once in the first half second of the mood. */
export function hop(moodAge: number): number {
  if (moodAge > 0.55) return 0;
  return Math.sin((moodAge / 0.55) * Math.PI);
}

/** Three dots in a cloud above the head, each swelling in turn while the rival thinks. */
export function drawThoughtBubble(ctx: Ctx, x: number, y: number, time: number, look: Look): void {
  const fill = look.dark ? 'rgba(232, 238, 248, 0.94)' : 'rgba(255, 255, 255, 0.96)';
  const edge = look.dark ? 'rgba(20, 30, 50, 0.5)' : 'rgba(40, 70, 60, 0.35)';
  ctx.save();
  ctx.fillStyle = fill;
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1.5;
  ellipse(ctx, x - 26, y + 30, 5, 5);
  ctx.fill();
  ctx.stroke();
  ellipse(ctx, x - 16, y + 18, 8, 7);
  ctx.fill();
  ctx.stroke();
  ellipse(ctx, x + 10, y - 4, 34, 20);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = look.dark ? '#2a3550' : '#3c5c52';
  // All three dots always show, so any still frame carries the whole thought.
  for (let i = 0; i < 3; i++) {
    const pulse = Math.max(0, Math.sin(time * 5 - i * 1.1));
    ellipse(ctx, x - 3 + i * 13, y - 4 - pulse * 2, 3.4 + pulse * 1.2, 3.4 + pulse * 1.2);
    ctx.fill();
  }
  ctx.restore();
}

/** Four-pointed sparkles that twinkle round a delighted rival. */
export function drawSparkles(
  ctx: Ctx,
  x: number,
  y: number,
  radius: number,
  time: number,
  colour: string,
): void {
  ctx.save();
  ctx.fillStyle = colour;
  for (let i = 0; i < 5; i++) {
    const angle = -Math.PI / 2 + (i - 2) * 0.55;
    const twinkle = (Math.sin(time * 6 + i * 1.7) + 1) / 2;
    const size = 3 + twinkle * 5;
    const sx = x + Math.cos(angle) * radius;
    const sy = y + Math.sin(angle) * radius * 0.8;
    star(ctx, sx, sy, size);
    ctx.fill();
  }
  ctx.restore();
}

export function star(ctx: Ctx, x: number, y: number, size: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.quadraticCurveTo(x, y, x + size, y);
  ctx.quadraticCurveTo(x, y, x, y + size);
  ctx.quadraticCurveTo(x, y, x - size, y);
  ctx.quadraticCurveTo(x, y, x, y - size);
  ctx.closePath();
}

/** A small storm cloud of grumpiness, drifting a little. */
export function drawGrumpCloud(ctx: Ctx, x: number, y: number, time: number, look: Look): void {
  const drift = Math.sin(time * 2) * 2;
  ctx.save();
  ctx.fillStyle = look.dark ? 'rgba(140, 150, 170, 0.85)' : 'rgba(120, 128, 138, 0.82)';
  for (const [dx, dy, r] of [
    [-12, 0, 9],
    [0, -5, 11],
    [12, 0, 9],
    [3, 4, 9],
  ] as const) {
    ellipse(ctx, x + dx + drift, y + dy, r, r * 0.85);
    ctx.fill();
  }
  ctx.strokeStyle = look.dark ? 'rgba(140, 150, 170, 0.85)' : 'rgba(110, 118, 128, 0.85)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (let i = -1; i <= 1; i++) {
    const t = (time * 1.5 + i * 0.3) % 1;
    ctx.globalAlpha = 1 - t;
    ctx.beginPath();
    ctx.moveTo(x + i * 9 + drift, y + 12 + t * 10);
    ctx.lineTo(x + i * 9 + drift - 2, y + 17 + t * 10);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * The cards a rival holds, as a fan of backs, so their hand size reads at a glance. Drawn in the
 * rival's frame, centred on (x, y), fanning upwards.
 */
export function drawHeldCards(
  ctx: Ctx,
  x: number,
  y: number,
  count: number,
  size: number,
  look: Look,
  tilt = 0,
): void {
  const shown = Math.min(9, count);
  if (shown === 0) return;
  const spread = Math.min(0.16, 0.9 / shown);
  const width = size;
  const height = size * 1.4;
  const face = look.back === 'conservatory' ? '#1f5a46' : '#16204a';
  const trim = look.back === 'conservatory' ? '#d6b25c' : '#d9b45a';
  for (let i = 0; i < shown; i++) {
    const angle = tilt + (i - (shown - 1) / 2) * spread;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.translate(-width / 2, -height * 0.92);
    ctx.fillStyle = look.dark ? '#f0e4c8' : '#fbf7ee';
    roundRect(ctx, 0, 0, width, height, width * 0.12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.fillStyle = face;
    roundRect(ctx, width * 0.1, width * 0.1, width * 0.8, height - width * 0.2, width * 0.06);
    ctx.fill();
    ctx.strokeStyle = trim;
    ctx.lineWidth = Math.max(0.6, width * 0.04);
    roundRect(ctx, width * 0.18, width * 0.18, width * 0.64, height - width * 0.36, width * 0.04);
    ctx.stroke();
    ctx.restore();
  }
}

export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
