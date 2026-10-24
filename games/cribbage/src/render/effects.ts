import { createRng } from '@usr-games/kit';
import type { Point } from './layout';
import type { Look } from './look';
import { softShadow } from './shadow';

/**
 * Everything on the table that is light rather than wood or card: the running count's dial,
 * the words that pop up when points are made, the golden burst of a perfect hand and the
 * rubber stamp of a skunk.
 */

type Ctx = CanvasRenderingContext2D;

const DISPLAY = '"Fraunces Variable", Georgia, serif';
const BODY = '"Atkinson Hyperlegible Next", system-ui, sans-serif';

/** The count dial beside the play: a brass-ringed disc with the count engraved in it. */
export function drawCountDial(
  ctx: Ctx,
  look: Look,
  at: Point,
  count: number,
  flash: number,
  label: string,
): void {
  const r = 64;
  ctx.save();
  ctx.translate(at.x, at.y);
  softShadow(
    ctx,
    look.castShadow.dx * 0.5,
    look.castShadow.dy * 0.5,
    r + 10,
    r + 10,
    look.castShadow.alpha,
  );
  const rim = ctx.createLinearGradient(-r, -r, r, r);
  rim.addColorStop(0, look.board.plate);
  rim.addColorStop(0.5, look.board.plateDeep);
  rim.addColorStop(1, look.board.plate);
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  const face = ctx.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.1, 0, 0, r * 0.9);
  face.addColorStop(0, look.dark ? '#5a3520' : '#8a5a34');
  face.addColorStop(1, look.dark ? '#2e1a0e' : '#5a361c');
  ctx.fillStyle = face;
  ctx.beginPath();
  ctx.arc(0, 0, r - 7, 0, Math.PI * 2);
  ctx.fill();
  // Thirty-one ticks round the face, the count lit up to where it stands.
  for (let i = 0; i < 31; i++) {
    const angle = -Math.PI / 2 + (i / 31) * Math.PI * 2;
    const lit = i < count;
    ctx.strokeStyle = lit ? look.gold : 'rgba(255, 235, 200, 0.22)';
    ctx.lineWidth = i === 14 || i === 30 ? 3 : 1.8;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * (r - 12), Math.sin(angle) * (r - 12));
    ctx.lineTo(
      Math.cos(angle) * (r - (i === 14 || i === 30 ? 21 : 17)),
      Math.sin(angle) * (r - (i === 14 || i === 30 ? 21 : 17)),
    );
    ctx.stroke();
  }
  if (flash > 0) {
    ctx.save();
    ctx.globalAlpha = flash;
    ctx.shadowColor = look.glow.fifteen;
    ctx.shadowBlur = 30;
    ctx.strokeStyle = look.glow.core;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, r + 4 + (1 - flash) * 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = '#fff3dc';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `600 46px ${DISPLAY}`;
  ctx.fillText(String(count), 0, -2);
  ctx.font = `700 11px ${BODY}`;
  ctx.globalAlpha = 0.8;
  ctx.fillText(label.toUpperCase(), 0, 28);
  ctx.restore();
}

export interface Callout {
  text: string;
  /** Gold lettering, for the perfect hand. */
  golden?: boolean;
  /** A smaller line under it, such as "+2". */
  detail?: string;
  at: Point;
  /** 0 when it appears, 1 when it has gone. */
  t: number;
  colour: string;
}

/** Words that pop up when points are made, and drift up as they fade. */
export function drawCallout(ctx: Ctx, look: Look, callout: Callout): void {
  const { t } = callout;
  const appear = Math.min(1, t * 6);
  const fade = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1;
  const pop = 1 + 0.18 * Math.sin(Math.min(1, t * 5) * Math.PI);
  ctx.save();
  ctx.translate(callout.at.x, callout.at.y - t * 26);
  ctx.scale(pop * appear, pop * appear);
  ctx.globalAlpha = fade;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 40px ${DISPLAY}`;
  const width = ctx.measureText(callout.text).width;
  ctx.fillStyle = look.dark ? 'rgba(28, 14, 8, 0.86)' : 'rgba(255, 246, 228, 0.92)';
  ctx.strokeStyle = callout.colour;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(-width / 2 - 26, -32, width + 52, callout.detail ? 92 : 64, 32);
  ctx.fill();
  ctx.stroke();
  if (callout.golden) {
    const gold = ctx.createLinearGradient(0, -24, 0, 22);
    gold.addColorStop(0, '#fff1b8');
    gold.addColorStop(0.5, '#f2b93b');
    gold.addColorStop(1, '#b97a12');
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = look.dark ? '#5a3208' : '#8a5a12';
    ctx.strokeText(callout.text, 0, 0);
    ctx.fillStyle = gold;
  } else {
    ctx.fillStyle = look.dark ? '#fff1d8' : '#2d1a0b';
  }
  ctx.fillText(callout.text, 0, 0);
  if (callout.detail) {
    ctx.font = `700 24px ${BODY}`;
    ctx.fillStyle = callout.colour;
    ctx.fillText(callout.detail, 0, 38);
  }
  ctx.restore();
}

interface Leaf {
  x: number;
  y: number;
  size: number;
  spin: number;
  speed: number;
  sway: number;
}

const LEAVES: Leaf[] = (() => {
  const rng = createRng('gold-leaf');
  return Array.from({ length: 140 }, () => ({
    x: rng.float(0, 1),
    y: rng.float(0, 1),
    size: rng.float(5, 13),
    spin: rng.float(-4, 4),
    speed: rng.float(0.08, 0.2),
    sway: rng.float(0, Math.PI * 2),
  }));
})();

/** The perfect hand: the table dims and slow golden rays turn behind the cards. */
export function drawCelebration(
  ctx: Ctx,
  look: Look,
  centre: Point,
  t: number,
  time: number,
  area: { w: number; h: number },
): void {
  const strength = Math.min(1, t * 2);
  ctx.save();
  ctx.globalAlpha = (look.dark ? 0.45 : 0.28) * strength;
  ctx.fillStyle = look.dark ? '#000' : '#3a2008';
  ctx.fillRect(0, 0, area.w, area.h);
  ctx.restore();
  ctx.save();
  ctx.translate(centre.x, centre.y);
  ctx.rotate(time * 0.08);
  const rays = 18;
  for (let i = 0; i < rays; i++) {
    const angle = (i / rays) * Math.PI * 2;
    const glow = ctx.createLinearGradient(0, 0, Math.cos(angle) * 900, Math.sin(angle) * 900);
    glow.addColorStop(0, `rgba(255, 214, 110, ${0.55 * strength})`);
    glow.addColorStop(1, 'rgba(255, 214, 110, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 1000, angle - 0.07, angle + 0.07);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  const core = ctx.createRadialGradient(centre.x, centre.y, 0, centre.x, centre.y, 560);
  core.addColorStop(0, `rgba(255, 236, 170, ${0.5 * strength})`);
  core.addColorStop(1, 'rgba(255, 236, 170, 0)');
  ctx.fillStyle = core;
  ctx.fillRect(centre.x - 560, centre.y - 560, 1120, 1120);
}

/** Gold leaf drifting down over everything, catching the light as it turns. */
export function drawGoldLeaf(
  ctx: Ctx,
  look: Look,
  t: number,
  time: number,
  area: { w: number; h: number },
): void {
  const strength = Math.min(1, t * 2);
  ctx.save();
  for (const leaf of LEAVES) {
    const fall = (leaf.y + time * leaf.speed) % 1;
    const x = leaf.x * area.w + Math.sin(time * 1.3 + leaf.sway) * 30;
    const y = fall * (area.h + 60) - 30;
    const turn = Math.sin(time * leaf.spin * 0.7 + leaf.sway);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(time * leaf.spin);
    ctx.scale(1, Math.abs(turn) * 0.8 + 0.2);
    ctx.globalAlpha = strength * 0.95;
    ctx.fillStyle = turn > 0.6 ? '#fff4c8' : leaf.size > 9 ? look.gold : look.goldDeep;
    ctx.fillRect(-leaf.size / 2, -leaf.size / 2, leaf.size, leaf.size * 0.7);
    ctx.restore();
  }
  ctx.restore();
}

/** Four-pointed glints that wink on golden cards. */
export function drawGlints(ctx: Ctx, points: readonly Point[], time: number): void {
  ctx.save();
  points.forEach((point, i) => {
    const phase = (time * 0.9 + i * 0.37) % 1;
    const size = Math.sin(phase * Math.PI) * 16;
    if (size < 1) return;
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.rotate(0.3);
    ctx.globalAlpha = Math.sin(phase * Math.PI);
    ctx.fillStyle = '#fffbe8';
    ctx.shadowColor = '#ffd56a';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.quadraticCurveTo(0, 0, size, 0);
    ctx.quadraticCurveTo(0, 0, 0, size);
    ctx.quadraticCurveTo(0, 0, -size, 0);
    ctx.quadraticCurveTo(0, 0, 0, -size);
    ctx.fill();
    ctx.restore();
  });
  ctx.restore();
}

/**
 * A rubber stamp pressed onto the board: an inked frame, a little skunk with its tail up, and
 * the word below it, on two lines if it is long, so it fits the board's narrow face.
 */
export function drawStamp(ctx: Ctx, look: Look, at: Point, word: string, t: number): void {
  const press = t < 0.15 ? 1.5 - (t / 0.15) * 0.5 : 1;
  const ink = look.dark ? '#ff7a7a' : '#b42318';
  const lines = word.toUpperCase().split(' ');
  const width = 214;
  const height = 132 + lines.length * 40;
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.rotate(-0.14);
  ctx.scale(press, press);
  ctx.globalAlpha = Math.min(1, t * 8) * 0.9;
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.roundRect(-width / 2, -height / 2, width, height, 20);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-width / 2 + 10, -height / 2 + 10, width - 20, height - 20, 13);
  ctx.stroke();
  // The skunk in silhouette: body, pointed snout, an ear, short legs and a big plumed tail.
  ctx.save();
  ctx.translate(14, -height / 2 + 70);
  ctx.beginPath();
  ctx.ellipse(0, 10, 28, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(26, 4, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(30, -2);
  ctx.lineTo(48, 9);
  ctx.lineTo(30, 13);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(20, -4);
  ctx.lineTo(24, -16);
  ctx.lineTo(29, -5);
  ctx.closePath();
  ctx.fill();
  for (const legX of [-16, 14]) ctx.fillRect(legX, 18, 7, 11);
  ctx.beginPath();
  ctx.moveTo(-22, 10);
  ctx.bezierCurveTo(-62, 2, -64, -50, -22, -58);
  ctx.bezierCurveTo(2, -62, 8, -38, -8, -32);
  ctx.bezierCurveTo(-28, -26, -30, -6, -14, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.font = `800 40px ${DISPLAY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((line, i) => {
    const y = -height / 2 + 124 + i * 40;
    ctx.save();
    const measured = ctx.measureText(line).width;
    const squeeze = Math.min(1, (width - 40) / measured);
    ctx.translate(0, y);
    ctx.scale(squeeze, 1);
    ctx.fillText(line, 0, 0);
    ctx.restore();
  });
  ctx.restore();
}
