import type { DeskPalette } from './palette';
import { alpha, contactShadow, type Ctx, FONT_MONO, linear, mix } from './paint';

/** Small things on the desk that make it someone's: a mug, a notepad and pencil, telegrams. */

export function paintMug(ctx: Ctx, x: number, y: number, s: number, pal: DeskPalette) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  contactShadow(ctx, 4, 0, 52, 10, 0.45);
  const body = pal.look === 'night' ? '#b8432f' : '#c94c35';
  ctx.fillStyle = linear(ctx, -36, 0, 36, 0, [
    [0, mix(body, '#000000', 0.2)],
    [0.35, mix(body, '#ffffff', 0.15)],
    [1, mix(body, '#000000', 0.35)],
  ]);
  ctx.beginPath();
  ctx.moveTo(-34, -84);
  ctx.lineTo(34, -84);
  ctx.lineTo(31, -6);
  ctx.quadraticCurveTo(0, 4, -31, -6);
  ctx.closePath();
  ctx.fill();
  // Handle.
  ctx.strokeStyle = mix(body, '#000000', 0.25);
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.arc(40, -46, 18, -Math.PI / 2.2, Math.PI / 2.2);
  ctx.stroke();
  // Rim and tea.
  ctx.fillStyle = mix(body, '#ffffff', 0.2);
  ctx.beginPath();
  ctx.ellipse(0, -84, 34, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5a3418';
  ctx.beginPath();
  ctx.ellipse(0, -82, 29, 6.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // A white band with dots and dashes.
  ctx.fillStyle = alpha('#fff8ec', 0.9);
  ctx.fillRect(-32, -52, 64, 12);
  ctx.fillStyle = body;
  let cursor = -26;
  for (const mark of '-.-. ..-') {
    if (mark === ' ') cursor += 6;
    else if (mark === '.') {
      ctx.beginPath();
      ctx.arc(cursor + 2, -46, 2, 0, Math.PI * 2);
      ctx.fill();
      cursor += 7;
    } else {
      ctx.fillRect(cursor, -48, 8, 4);
      cursor += 11;
    }
  }
  ctx.restore();
}

export function paintNotepad(
  ctx: Ctx,
  x: number,
  y: number,
  s: number,
  pal: DeskPalette,
  lines: readonly string[],
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.rotate(-0.06);
  contactShadow(ctx, 110, 8, 140, 20, 0.35);
  ctx.fillStyle = mix(pal.paper, '#000000', 0.08);
  ctx.fillRect(6, -150, 220, 156);
  ctx.fillStyle = pal.paper;
  ctx.fillRect(0, -156, 220, 156);
  ctx.fillStyle = alpha('#6a8fc7', 0.4);
  for (let i = 0; i < 9; i++) ctx.fillRect(0, -128 + i * 15, 220, 1);
  ctx.fillStyle = alpha('#d9534f', 0.5);
  ctx.fillRect(26, -156, 1.5, 156);
  // Binding at the top.
  ctx.fillStyle = pal.inkRed;
  ctx.fillRect(0, -164, 220, 12);
  ctx.fillStyle = pal.ink;
  ctx.font = `500 14px ${FONT_MONO}`;
  lines.forEach((line, i) => ctx.fillText(line, 34, -132 + i * 15 + 10));
  ctx.restore();
  // The pencil across it.
  ctx.save();
  ctx.translate(x + 150 * s, y - 40 * s);
  ctx.rotate(0.5);
  ctx.scale(s, s);
  ctx.fillStyle = alpha('#000000', 0.25);
  ctx.fillRect(-90, 6, 180, 8);
  ctx.fillStyle = linear(ctx, 0, -6, 0, 6, [
    [0, '#f6c84a'],
    [1, '#c99a1c'],
  ]);
  ctx.fillRect(-90, -5, 160, 11);
  ctx.fillStyle = '#e8c9a0';
  ctx.beginPath();
  ctx.moveTo(70, -5);
  ctx.lineTo(92, 0.5);
  ctx.lineTo(70, 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.moveTo(86, -1);
  ctx.lineTo(92, 0.5);
  ctx.lineTo(86, 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e88f8f';
  ctx.fillRect(-100, -5, 12, 11);
  ctx.fillStyle = '#b9b9b9';
  ctx.fillRect(-90, -5, 8, 11);
  ctx.restore();
}

/** A small stack of telegram forms with a paper clip. */
export function paintTelegrams(ctx: Ctx, x: number, y: number, s: number, pal: DeskPalette) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  contactShadow(ctx, 70, 4, 100, 14, 0.3);
  for (let i = 0; i < 4; i++) {
    ctx.save();
    ctx.rotate((i - 1.5) * 0.04);
    ctx.fillStyle = mix(pal.manila, '#ffffff', 0.35 - i * 0.05);
    ctx.fillRect(i * 2, -86 - i * 3, 150, 86);
    ctx.restore();
  }
  ctx.fillStyle = alpha(pal.inkRed, 0.8);
  ctx.fillRect(14, -90, 70, 6);
  ctx.fillStyle = alpha(pal.ink, 0.5);
  for (let i = 0; i < 4; i++) ctx.fillRect(14, -72 + i * 13, 100 - i * 14, 3);
  ctx.strokeStyle = pal.steelLight;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(126, -98);
  ctx.lineTo(126, -64);
  ctx.arc(132, -64, 6, Math.PI, 0, true);
  ctx.lineTo(138, -92);
  ctx.stroke();
  ctx.restore();
}
