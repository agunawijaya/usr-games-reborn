import { directionAngle, LETTER_POSES, type Pose } from '../codecs/semaphore';
import type { DeskPalette } from './palette';
import { alpha, type Ctx, FONT_DISPLAY, mix, roundRect } from './paint';

/** Height of a chart row for a given width and column count. */
export function chartHeight(width: number, columns: number, count: number): number {
  const cell = width / columns;
  return Math.ceil(count / columns) * cell * 1.22 + cell * 0.1;
}

/**
 * The pose chart: a little figure per letter, as on a scout's pocket card, with the letter
 * being sent ringed. Figures face the reader, like the signaller on the roof.
 */
export function paintMiniPose(
  ctx: Ctx,
  cx: number,
  cy: number,
  size: number,
  pose: Pose,
  pal: DeskPalette,
  ink: string,
) {
  const shoulderY = cy - size * 0.12;
  const shoulderX = size * 0.08;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  // Head and body.
  ctx.beginPath();
  ctx.arc(cx, cy - size * 0.25, size * 0.075, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = size * 0.075;
  ctx.beginPath();
  ctx.moveTo(cx, shoulderY);
  ctx.lineTo(cx, cy + size * 0.16);
  ctx.moveTo(cx, cy + size * 0.16);
  ctx.lineTo(cx - size * 0.07, cy + size * 0.38);
  ctx.moveTo(cx, cy + size * 0.16);
  ctx.lineTo(cx + size * 0.07, cy + size * 0.38);
  ctx.stroke();
  for (const [side, direction] of [
    [-1, pose.near],
    [1, pose.far],
  ] as const) {
    const angle = directionAngle(direction);
    const sx = cx + side * shoulderX;
    const length = size * 0.26;
    const hx = sx + Math.cos(angle) * length;
    const hy = shoulderY + Math.sin(angle) * length;
    ctx.lineWidth = size * 0.06;
    ctx.beginPath();
    ctx.moveTo(sx, shoulderY);
    ctx.lineTo(hx, hy);
    ctx.stroke();
    // The flag: a small square on the end of the arm, half red, half white.
    const fx = hx + Math.cos(angle) * size * 0.02;
    const fy = hy + Math.sin(angle) * size * 0.02;
    ctx.save();
    ctx.translate(fx, fy);
    ctx.rotate(angle);
    const f = size * 0.17;
    ctx.fillStyle = pal.inkRed;
    ctx.beginPath();
    ctx.moveTo(0, -f / 2);
    ctx.lineTo(f, -f / 2);
    ctx.lineTo(0, f / 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f2c230';
    ctx.beginPath();
    ctx.moveTo(f, -f / 2);
    ctx.lineTo(f, f / 2);
    ctx.lineTo(0, f / 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = mix(ink, '#000000', 0.2);
    ctx.lineWidth = Math.max(0.8, size * 0.012);
    ctx.strokeRect(0, -f / 2, f, f);
    ctx.restore();
  }
  ctx.restore();
}

/** A card of letters and their poses in a grid; `current` is ringed. */
export function paintPoseChart(
  ctx: Ctx,
  x: number,
  y: number,
  width: number,
  letters: readonly string[],
  columns: number,
  pal: DeskPalette,
  current: string | null,
  done: ReadonlySet<string> = new Set(),
) {
  const cell = width / columns;
  const ink = pal.look === 'night' ? '#f3e7cf' : pal.ink;
  letters.forEach((letter, i) => {
    const col = i % columns;
    const row = Math.floor(i / columns);
    const cx = x + col * cell + cell / 2;
    const cy = y + row * cell * 1.22 + cell * 0.55;
    if (letter === current) {
      ctx.fillStyle = alpha(pal.look === 'night' ? '#ffb347' : '#e08a1e', 0.22);
      ctx.strokeStyle = pal.look === 'night' ? '#ffb347' : '#c9731a';
      ctx.lineWidth = 3;
      roundRect(ctx, cx - cell * 0.47, cy - cell * 0.5, cell * 0.94, cell * 1.16, cell * 0.12);
      ctx.fill();
      ctx.stroke();
    }
    ctx.globalAlpha = done.has(letter) && letter !== current ? 0.55 : 1;
    ctx.fillStyle = letter === current ? (pal.look === 'night' ? '#ffd38a' : '#9b4f0f') : ink;
    ctx.font = `700 ${cell * 0.22}px ${FONT_DISPLAY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(letter, cx, cy + cell * 0.6);
    paintMiniPose(ctx, cx, cy - cell * 0.04, cell * 0.95, LETTER_POSES[letter]!, pal, ink);
    ctx.globalAlpha = 1;
  });
}
