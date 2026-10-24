import type { Look } from './look';
import type { Point } from './layout';
import { softShadow } from './shadow';

/**
 * One quiet thing on each table besides the game, so it feels like somebody's table: a glass
 * of lemonade on the porch, sweating in the sun and throwing a patch of yellow light on the
 * wood; a mug of cocoa by the fire, steam curling off it. Drawn in code, out of the way of the
 * cards, in the space above the play and left of the board.
 */

type Ctx = CanvasRenderingContext2D;

export const PROP_AT: Point = { x: 1420, y: 232 };

function lemonade(ctx: Ctx, look: Look, at: Point, time: number): void {
  const { x, y } = at;
  const rx = 46;
  const ry = 15;
  const height = 120;
  // The sun shines through the glass: a warm caustic and a soft shadow fall to the lower right.
  ctx.save();
  ctx.translate(x + 64, y + height * 0.62);
  ctx.rotate(0.62);
  const caustic = ctx.createRadialGradient(0, 0, 4, 0, 0, 72);
  caustic.addColorStop(0, 'rgba(255, 236, 120, 0.75)');
  caustic.addColorStop(0.5, 'rgba(255, 210, 80, 0.35)');
  caustic.addColorStop(1, 'rgba(255, 200, 80, 0)');
  ctx.fillStyle = caustic;
  ctx.beginPath();
  ctx.ellipse(0, 0, 86, 34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  softShadow(
    ctx,
    x + 24,
    y + height + 6,
    rx * 1.25,
    ry * 1.5,
    look.castShadow.alpha * 0.7,
    '59, 34, 16',
  );

  // A damp ring on the wood where the glass stood a moment ago.
  ctx.save();
  ctx.strokeStyle = 'rgba(90, 55, 25, 0.14)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(x - 70, y + height + 30, rx * 0.95, ry * 1.1, 0, 0.3, Math.PI * 1.85);
  ctx.stroke();
  ctx.restore();

  const top = y;
  const bottom = y + height;
  // The lemonade inside, seen through the glass.
  const fillTop = top + 26;
  const drink = ctx.createLinearGradient(x - rx, 0, x + rx, 0);
  drink.addColorStop(0, 'rgba(250, 214, 92, 0.92)');
  drink.addColorStop(0.45, 'rgba(255, 236, 150, 0.85)');
  drink.addColorStop(1, 'rgba(226, 178, 52, 0.95)');
  ctx.fillStyle = drink;
  ctx.beginPath();
  ctx.moveTo(x - rx * 0.94, fillTop);
  ctx.lineTo(x - rx * 0.86, bottom - 6);
  ctx.ellipse(x, bottom - 6, rx * 0.86, ry * 0.86, 0, Math.PI, 0, true);
  ctx.lineTo(x + rx * 0.94, fillTop);
  ctx.ellipse(x, fillTop, rx * 0.94, ry * 0.94, 0, 0, Math.PI, true);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 246, 196, 0.95)';
  ctx.beginPath();
  ctx.ellipse(x, fillTop, rx * 0.94, ry * 0.94, 0, 0, Math.PI * 2);
  ctx.fill();
  // Ice, bobbing a little.
  const bob = Math.sin(time * 0.8) * 1.5;
  for (const [dx, dy, size, turn] of [
    [-16, 2, 20, 0.3],
    [14, -3, 18, -0.4],
    [2, 8, 16, 0.9],
  ] as const) {
    ctx.save();
    ctx.translate(x + dx, fillTop + dy + bob);
    ctx.rotate(turn);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.strokeStyle = 'rgba(200, 220, 230, 0.9)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(-size / 2, -size / 3, size, size * 0.66, 4);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  // The glass: a clear body with bright edges.
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(x - rx, top);
  ctx.lineTo(x - rx * 0.9, bottom);
  ctx.moveTo(x + rx, top);
  ctx.lineTo(x + rx * 0.9, bottom);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(x, bottom, rx * 0.9, ry * 0.9, 0, 0, Math.PI);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(x, top, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  const shine = ctx.createLinearGradient(x - rx, 0, x - rx + 18, 0);
  shine.addColorStop(0, 'rgba(255, 255, 255, 0.75)');
  shine.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = shine;
  ctx.fillRect(x - rx + 5, top + 8, 14, height - 20);
  // Beads of condensation.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  for (let i = 0; i < 14; i++) {
    const bx = x - rx * 0.8 + ((i * 37) % 70);
    const by = fillTop + 16 + ((i * 53) % 70);
    ctx.beginPath();
    ctx.ellipse(bx, by, 1.6, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // A striped paper straw, and a lemon wheel on the rim.
  ctx.save();
  ctx.translate(x + 10, top + 4);
  ctx.rotate(0.32);
  ctx.fillStyle = '#fbf6ec';
  ctx.fillRect(-4, -66, 8, 80);
  ctx.fillStyle = '#d8423a';
  for (let s = -66; s < 14; s += 12) ctx.fillRect(-4, s, 8, 5);
  ctx.restore();
  ctx.save();
  ctx.translate(x - rx + 6, top - 2);
  ctx.rotate(-0.5);
  ctx.fillStyle = '#f4d23c';
  ctx.beginPath();
  ctx.ellipse(0, 0, 22, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff3b0';
  ctx.beginPath();
  ctx.ellipse(0, 0, 18, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#f0c62a';
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(angle) * 17, Math.sin(angle) * 17);
    ctx.stroke();
  }
  ctx.restore();
}

function cocoa(ctx: Ctx, look: Look, at: Point, time: number, still: boolean): void {
  const { x, y } = at;
  const rx = 50;
  const ry = 17;
  const height = 92;
  const top = y + 20;
  const bottom = top + height;
  softShadow(ctx, x + 26, bottom + 4, rx * 1.35, ry * 1.55, look.castShadow.alpha * 0.85);
  // The handle, on the side away from the fire.
  ctx.save();
  ctx.strokeStyle = '#7a2a22';
  ctx.lineWidth = 13;
  ctx.beginPath();
  ctx.ellipse(x + rx + 6, top + height * 0.5, 22, 30, 0, -Math.PI * 0.5, Math.PI * 0.5);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 170, 110, 0.25)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
  // The mug: deep red glaze lit warm from the left.
  const glaze = ctx.createLinearGradient(x - rx, 0, x + rx, 0);
  glaze.addColorStop(0, '#d9643f');
  glaze.addColorStop(0.35, '#a8322a');
  glaze.addColorStop(1, '#4a1410');
  ctx.fillStyle = glaze;
  ctx.beginPath();
  ctx.moveTo(x - rx, top);
  ctx.lineTo(x - rx, bottom);
  ctx.ellipse(x, bottom, rx, ry, 0, Math.PI, 0, true);
  ctx.lineTo(x + rx, top);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#5a1a14';
  ctx.beginPath();
  ctx.ellipse(x, top, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  // Cocoa, with a few marshmallows melting into it.
  ctx.fillStyle = '#4a2814';
  ctx.beginPath();
  ctx.ellipse(x, top + 3, rx * 0.86, ry * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();
  for (const [dx, dy] of [
    [-14, 1],
    [9, -2],
    [-1, 5],
    [20, 4],
  ] as const) {
    ctx.fillStyle = '#f3e4cf';
    ctx.beginPath();
    ctx.roundRect(x + dx - 7, top + dy - 4, 14, 9, 3);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255, 190, 120, 0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(x, top, rx, ry, 0, Math.PI * 0.75, Math.PI * 1.35);
  ctx.stroke();
  // Steam, curling up and fading.
  const t = still ? 1.7 : time;
  ctx.save();
  ctx.lineCap = 'round';
  for (let wisp = 0; wisp < 3; wisp++) {
    ctx.beginPath();
    for (let step = 0; step <= 24; step++) {
      const rise = step / 24;
      const sx = x - 14 + wisp * 14 + Math.sin(rise * 5 + t * 1.3 + wisp * 2) * 9 * rise;
      const sy = top - 6 - rise * 120;
      if (step === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    const fade = ctx.createLinearGradient(0, top, 0, top - 126);
    fade.addColorStop(0, 'rgba(255, 228, 200, 0)');
    fade.addColorStop(0.25, 'rgba(255, 228, 200, 0.32)');
    fade.addColorStop(1, 'rgba(255, 228, 200, 0)');
    ctx.strokeStyle = fade;
    ctx.lineWidth = 6;
    ctx.stroke();
  }
  ctx.restore();
}

export function drawProp(ctx: Ctx, look: Look, time: number, still: boolean): void {
  if (look.dark) cocoa(ctx, look, PROP_AT, time, still);
  else lemonade(ctx, look, PROP_AT, still ? 1 : time);
}
