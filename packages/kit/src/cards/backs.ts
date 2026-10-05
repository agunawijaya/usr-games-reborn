import { createRng } from '../rng/rng';
import { CORNER, roundedRect } from './face';
import type { DeckPalette } from './palette';
import type { Ctx } from './pips';

/**
 * Two card backs, both the same either way up so a back never gives away which way a card
 * lies: Conservatory, a green field under gilt glazing bars with a thirteen-petal bloom, and
 * Constellations, a night field of gold stars round a ring of thirteen.
 */

export type BackStyle = 'conservatory' | 'constellations';

const CONSERVATORY = { field: '#1f5a46', fieldDeep: '#143e30', gold: '#d6b25c', cream: '#f6efdc' };
const CONSTELLATIONS = {
  field: '#16204a',
  fieldDeep: '#0b1130',
  gold: '#d9b45a',
  cream: '#efe2c4',
};

/** Repeats a drawing at a half turn about the card's centre. */
function twice(ctx: Ctx, width: number, height: number, draw: () => void): void {
  draw();
  ctx.save();
  ctx.translate(width, height);
  ctx.rotate(Math.PI);
  draw();
  ctx.restore();
}

function drawBloom(
  ctx: Ctx,
  cx: number,
  cy: number,
  radius: number,
  gold: string,
  field: string,
): void {
  for (let i = 0; i < 13; i++) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((Math.PI * 2 * i) / 13);
    ctx.beginPath();
    ctx.moveTo(0, -radius * 0.22);
    ctx.quadraticCurveTo(radius * 0.26, -radius * 0.62, 0, -radius);
    ctx.quadraticCurveTo(-radius * 0.26, -radius * 0.62, 0, -radius * 0.22);
    ctx.fillStyle = gold;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, -radius * 0.36);
    ctx.lineTo(0, -radius * 0.82);
    ctx.strokeStyle = field;
    ctx.lineWidth = radius * 0.03;
    ctx.stroke();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.2, 0, Math.PI * 2);
  ctx.fillStyle = gold;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.12, 0, Math.PI * 2);
  ctx.fillStyle = field;
  ctx.fill();
}

function drawCornerFan(
  ctx: Ctx,
  x: number,
  y: number,
  radius: number,
  angle: number,
  gold: string,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.strokeStyle = gold;
  for (let i = 0; i <= 6; i++) {
    const a = (Math.PI / 2) * (i / 6);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
    ctx.lineWidth = radius * 0.04;
    ctx.stroke();
  }
  for (const r of [0.45, 0.75, 1]) {
    ctx.beginPath();
    ctx.arc(0, 0, radius * r, 0, Math.PI / 2);
    ctx.lineWidth = radius * 0.035;
    ctx.stroke();
  }
  ctx.restore();
}

function field(
  ctx: Ctx,
  width: number,
  height: number,
  colours: { field: string; fieldDeep: string },
) {
  const inset = width * 0.07;
  const fx = inset;
  const fy = inset;
  const fw = width - inset * 2;
  const fh = height - inset * 2;
  roundedRect(ctx, fx, fy, fw, fh, width * 0.035);
  const shade = ctx.createRadialGradient(
    width / 2,
    height / 2,
    0,
    width / 2,
    height / 2,
    height * 0.6,
  );
  shade.addColorStop(0, colours.field);
  shade.addColorStop(1, colours.fieldDeep);
  ctx.fillStyle = shade;
  ctx.fill();
  return { fx, fy, fw, fh };
}

function drawConservatory(ctx: Ctx, width: number, height: number): void {
  const c = CONSERVATORY;
  const { fx, fy, fw, fh } = field(ctx, width, height, c);
  ctx.save();
  roundedRect(ctx, fx, fy, fw, fh, width * 0.035);
  ctx.clip();
  // Glazing bars: a fine diagonal lattice, like the panes of a glasshouse roof.
  ctx.strokeStyle = c.gold;
  ctx.globalAlpha = 0.3;
  ctx.lineWidth = Math.max(0.6, width * 0.006);
  const step = width * 0.11;
  for (let i = -height; i < width + height; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + height, height);
    ctx.moveTo(i + height, 0);
    ctx.lineTo(i, height);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  twice(ctx, width, height, () => drawCornerFan(ctx, fx, fy, width * 0.2, 0, c.gold));
  twice(ctx, width, height, () =>
    drawCornerFan(ctx, fx + fw, fy, width * 0.2, Math.PI / 2, c.gold),
  );
  ctx.restore();
  // The medallion.
  const r = width * 0.26;
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, r * 1.12, 0, Math.PI * 2);
  ctx.fillStyle = c.fieldDeep;
  ctx.fill();
  ctx.strokeStyle = c.gold;
  ctx.lineWidth = width * 0.012;
  ctx.stroke();
  drawBloom(ctx, width / 2, height / 2, r, c.gold, c.fieldDeep);
  // Double gilt rule round the field.
  ctx.strokeStyle = c.gold;
  ctx.lineWidth = width * 0.01;
  roundedRect(ctx, fx, fy, fw, fh, width * 0.035);
  ctx.stroke();
  ctx.lineWidth = width * 0.005;
  roundedRect(
    ctx,
    fx + width * 0.025,
    fy + width * 0.025,
    fw - width * 0.05,
    fh - width * 0.05,
    width * 0.02,
  );
  ctx.stroke();
}

function star(ctx: Ctx, x: number, y: number, r: number, colour: string): void {
  ctx.beginPath();
  ctx.moveTo(x, y - r * 2.2);
  ctx.quadraticCurveTo(x, y, x + r * 2.2, y);
  ctx.quadraticCurveTo(x, y, x, y + r * 2.2);
  ctx.quadraticCurveTo(x, y, x - r * 2.2, y);
  ctx.quadraticCurveTo(x, y, x, y - r * 2.2);
  ctx.fillStyle = colour;
  ctx.fill();
}

/** Original star figures, as fractions of the field: a small plough of a kite and a crown. */
const FIGURES: readonly (readonly [number, number])[][] = [
  [
    [0.18, 0.12],
    [0.3, 0.2],
    [0.27, 0.32],
    [0.4, 0.27],
    [0.3, 0.2],
  ],
  [
    [0.62, 0.1],
    [0.74, 0.15],
    [0.84, 0.1],
    [0.8, 0.24],
  ],
];

function drawConstellations(ctx: Ctx, width: number, height: number): void {
  const c = CONSTELLATIONS;
  const { fx, fy, fw, fh } = field(ctx, width, height, c);
  ctx.save();
  roundedRect(ctx, fx, fy, fw, fh, width * 0.035);
  ctx.clip();
  // A seeded dusting of faint stars, mirrored by the half turn.
  const rng = createRng('constellation-back');
  const dust = Array.from({ length: 34 }, () => ({
    x: fx + rng.next() * fw,
    y: fy + rng.next() * (fh / 2),
    r: width * (0.004 + rng.next() * 0.006),
    a: 0.35 + rng.next() * 0.5,
  }));
  twice(ctx, width, height, () => {
    for (const d of dust) {
      ctx.globalAlpha = d.a;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fillStyle = c.cream;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const figure of FIGURES) {
      ctx.beginPath();
      figure.forEach(([u, v], i) => {
        const x = fx + u * fw;
        const y = fy + v * fh;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = c.gold;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = width * 0.005;
      ctx.stroke();
      ctx.globalAlpha = 1;
      for (const [u, v] of figure) star(ctx, fx + u * fw, fy + v * fh, width * 0.009, c.gold);
    }
  });
  ctx.restore();
  // The ring of thirteen.
  const cx = width / 2;
  const cy = height / 2;
  const r = width * 0.25;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = c.gold;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = width * 0.005;
  ctx.stroke();
  ctx.globalAlpha = 1;
  for (let i = 0; i < 13; i++) {
    const a = -Math.PI / 2 + (Math.PI * 2 * i) / 13;
    star(
      ctx,
      cx + Math.cos(a) * r,
      cy + Math.sin(a) * r,
      width * (i % 3 === 0 ? 0.016 : 0.011),
      c.gold,
    );
  }
  star(ctx, cx, cy, width * 0.03, c.gold);
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.42, 0, Math.PI * 2);
  ctx.strokeStyle = c.gold;
  ctx.lineWidth = width * 0.004;
  ctx.stroke();
  // Stepped gilt frame.
  ctx.strokeStyle = c.gold;
  ctx.lineWidth = width * 0.01;
  roundedRect(ctx, fx, fy, fw, fh, width * 0.035);
  ctx.stroke();
  const s = width * 0.06;
  twice(ctx, width, height, () => {
    ctx.beginPath();
    ctx.moveTo(fx + width * 0.03, fy + s * 1.6);
    ctx.lineTo(fx + width * 0.03, fy + width * 0.03);
    ctx.lineTo(fx + s * 1.6, fy + width * 0.03);
    ctx.moveTo(fx + fw - width * 0.03, fy + s * 1.6);
    ctx.lineTo(fx + fw - width * 0.03, fy + width * 0.03);
    ctx.lineTo(fx + fw - s * 1.6, fy + width * 0.03);
    ctx.lineWidth = width * 0.006;
    ctx.stroke();
  });
}

/** Draws a back into (0, 0, width, height). */
export function drawCardBack(
  ctx: Ctx,
  width: number,
  height: number,
  style: BackStyle,
  palette: DeckPalette,
): void {
  const r = width * CORNER;
  roundedRect(ctx, 0.5, 0.5, width - 1, height - 1, r);
  ctx.fillStyle = style === 'conservatory' ? CONSERVATORY.cream : CONSTELLATIONS.cream;
  ctx.fill();
  ctx.strokeStyle = palette.edge;
  ctx.lineWidth = Math.max(1, width * 0.008);
  ctx.stroke();
  if (style === 'conservatory') drawConservatory(ctx, width, height);
  else drawConstellations(ctx, width, height);
}
