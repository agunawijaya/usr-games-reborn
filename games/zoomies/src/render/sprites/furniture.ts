import type { Furniture } from '../../engine/types';
import type { Look } from '../palette';
import { circle, type Ctx, ellipse, line, roundRect } from '../shapes';

/**
 * Furniture from a little above. Pieces fill their squares (vacuums and the cat cannot enter
 * them) and cast a soft shadow down and to the right, away from the window.
 */

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  s: number;
}

const DAY = {
  fabric: '#7f9fb8',
  fabricDark: '#6688a2',
  wood: '#b07a4a',
  woodDark: '#8a5a32',
  white: '#f5f2ec',
  whiteShade: '#d9d3c8',
  pot: '#c96f4a',
  leaf: '#5f9a5a',
  leafDark: '#467a46',
  outline: 'rgba(60, 40, 25, 0.45)',
};

const NIGHT = {
  fabric: '#3a4a6a',
  fabricDark: '#2e3c58',
  wood: '#5a3e38',
  woodDark: '#442e2a',
  white: '#4a4a5c',
  whiteShade: '#3a3a4a',
  pot: '#6a3e3a',
  leaf: '#2e5a4a',
  leafDark: '#22463a',
  outline: 'rgba(0, 0, 0, 0.6)',
};

type Paint = typeof DAY;

function shadowUnder(ctx: Ctx, b: Box, look: Look) {
  ctx.save();
  ctx.fillStyle = look === 'day' ? 'rgba(84, 58, 32, 0.22)' : 'rgba(0, 0, 0, 0.42)';
  ctx.beginPath();
  ctx.roundRect(b.x + b.s * 0.12, b.y + b.s * 0.16, b.w, b.h, b.s * 0.18);
  ctx.fill();
  ctx.restore();
}

function sofa(ctx: Ctx, b: Box, p: Paint, armchair: boolean) {
  const inset = b.s * 0.08;
  roundRect(
    ctx,
    b.x + inset,
    b.y + inset,
    b.w - inset * 2,
    b.h - inset * 2,
    b.s * 0.2,
    p.fabric,
    p.outline,
    b.s * 0.03,
  );
  // Back along the far side, arms at the ends.
  const back = Math.min(b.h, b.s) * 0.32;
  roundRect(ctx, b.x + inset, b.y + inset, b.w - inset * 2, back, b.s * 0.16, p.fabricDark);
  const arm = b.s * 0.24;
  roundRect(ctx, b.x + inset, b.y + inset, arm, b.h - inset * 2, b.s * 0.14, p.fabricDark);
  roundRect(
    ctx,
    b.x + b.w - inset - arm,
    b.y + inset,
    arm,
    b.h - inset * 2,
    b.s * 0.14,
    p.fabricDark,
  );
  if (!armchair) {
    const seats = Math.max(2, Math.round(b.w / b.s / 1.5));
    const seatW = (b.w - inset * 2 - arm * 2) / seats;
    for (let i = 1; i < seats; i++) {
      const x = b.x + inset + arm + seatW * i;
      line(ctx, x, b.y + inset + back, x, b.y + b.h - inset * 1.5, p.fabricDark, b.s * 0.03);
    }
  }
  // A cushion someone left askew.
  ctx.save();
  ctx.translate(b.x + inset + arm + b.s * 0.35, b.y + b.h * 0.6);
  ctx.rotate(-0.25);
  roundRect(ctx, -b.s * 0.18, -b.s * 0.14, b.s * 0.36, b.s * 0.28, b.s * 0.08, '#e9b45a');
  ctx.restore();
}

function table(ctx: Ctx, b: Box, p: Paint) {
  const inset = b.s * 0.1;
  roundRect(
    ctx,
    b.x + inset,
    b.y + inset,
    b.w - inset * 2,
    b.h - inset * 2,
    b.s * 0.12,
    p.wood,
    p.outline,
    b.s * 0.03,
  );
  roundRect(
    ctx,
    b.x + inset * 2,
    b.y + inset * 2,
    b.w - inset * 4,
    b.h - inset * 4,
    b.s * 0.08,
    undefined,
    p.woodDark,
    b.s * 0.02,
  );
  // A mug and a little vase.
  circle(ctx, b.x + b.w * 0.35, b.y + b.h * 0.45, b.s * 0.12, p.white);
  circle(ctx, b.x + b.w * 0.35, b.y + b.h * 0.45, b.s * 0.08, '#6b4a3a');
  circle(ctx, b.x + b.w * 0.66, b.y + b.h * 0.58, b.s * 0.1, '#e8a0b4');
}

function desk(ctx: Ctx, b: Box, p: Paint) {
  table(ctx, b, p);
  // An open laptop and a lamp.
  roundRect(ctx, b.x + b.w * 0.18, b.y + b.h * 0.25, b.s * 0.9, b.s * 0.6, b.s * 0.05, '#8a8f99');
  roundRect(
    ctx,
    b.x + b.w * 0.18 + b.s * 0.06,
    b.y + b.h * 0.25 + b.s * 0.05,
    b.s * 0.78,
    b.s * 0.32,
    b.s * 0.03,
    '#bfe0f0',
  );
  circle(ctx, b.x + b.w * 0.8, b.y + b.h * 0.3, b.s * 0.16, '#f2c04a');
}

function bed(ctx: Ctx, b: Box, p: Paint) {
  const inset = b.s * 0.06;
  roundRect(
    ctx,
    b.x + inset,
    b.y + inset,
    b.w - inset * 2,
    b.h - inset * 2,
    b.s * 0.14,
    p.wood,
    p.outline,
    b.s * 0.03,
  );
  roundRect(
    ctx,
    b.x + inset * 2.5,
    b.y + inset * 2.5,
    b.w - inset * 5,
    b.h - inset * 5,
    b.s * 0.12,
    p.white,
  );
  // Pillows at the head, a folded blanket over the rest.
  const pillowW = (b.w - inset * 7) / 2;
  roundRect(ctx, b.x + inset * 3, b.y + inset * 3, pillowW, b.s * 0.5, b.s * 0.14, p.whiteShade);
  roundRect(
    ctx,
    b.x + inset * 4 + pillowW,
    b.y + inset * 3,
    pillowW,
    b.s * 0.5,
    b.s * 0.14,
    p.whiteShade,
  );
  roundRect(
    ctx,
    b.x + inset * 2.5,
    b.y + b.h * 0.42,
    b.w - inset * 5,
    b.h * 0.58 - inset * 2.5,
    b.s * 0.12,
    '#c98ab0',
  );
  line(
    ctx,
    b.x + inset * 2.5,
    b.y + b.h * 0.5,
    b.x + b.w - inset * 2.5,
    b.y + b.h * 0.5,
    '#e8b8d2',
    b.s * 0.05,
  );
}

function plant(ctx: Ctx, b: Box, p: Paint) {
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  circle(ctx, cx, cy + b.s * 0.08, b.s * 0.3, p.pot);
  circle(ctx, cx, cy + b.s * 0.06, b.s * 0.24, '#5a3a2a');
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 - Math.PI / 2;
    ellipse(
      ctx,
      cx + Math.cos(a) * b.s * 0.2,
      cy + Math.sin(a) * b.s * 0.16 - b.s * 0.08,
      b.s * 0.2,
      b.s * 0.09,
      i % 2 ? p.leaf : p.leafDark,
      a,
    );
  }
  circle(ctx, cx, cy - b.s * 0.08, b.s * 0.1, p.leaf);
}

function shelf(ctx: Ctx, b: Box, p: Paint) {
  roundRect(
    ctx,
    b.x + b.s * 0.04,
    b.y + b.s * 0.08,
    b.w - b.s * 0.08,
    b.h - b.s * 0.16,
    b.s * 0.06,
    p.woodDark,
    p.outline,
    b.s * 0.03,
  );
  const colors = ['#d96a5a', '#5a8ad9', '#e8c04a', '#6aaa7a', '#a87ad0', '#f0a070'];
  let x = b.x + b.s * 0.12;
  let i = 0;
  while (x < b.x + b.w - b.s * 0.2) {
    const w = b.s * (0.12 + ((i * 37) % 5) * 0.02);
    roundRect(ctx, x, b.y + b.s * 0.16, w, b.h - b.s * 0.32, b.s * 0.02, colors[i % colors.length]);
    x += w + b.s * 0.03;
    i++;
  }
}

function washer(ctx: Ctx, b: Box, p: Paint) {
  roundRect(
    ctx,
    b.x + b.s * 0.08,
    b.y + b.s * 0.08,
    b.w - b.s * 0.16,
    b.h - b.s * 0.16,
    b.s * 0.14,
    p.white,
    p.outline,
    b.s * 0.03,
  );
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2 + b.s * 0.08;
  circle(ctx, cx, cy, b.s * 0.55, p.whiteShade);
  circle(ctx, cx, cy, b.s * 0.42, '#8ec6e6');
  circle(ctx, cx - b.s * 0.12, cy - b.s * 0.12, b.s * 0.1, 'rgba(255,255,255,0.6)');
  roundRect(
    ctx,
    b.x + b.s * 0.25,
    b.y + b.s * 0.2,
    b.s * 0.5,
    b.s * 0.12,
    b.s * 0.04,
    p.whiteShade,
  );
}

function tub(ctx: Ctx, b: Box, p: Paint) {
  roundRect(
    ctx,
    b.x + b.s * 0.06,
    b.y + b.s * 0.06,
    b.w - b.s * 0.12,
    b.h - b.s * 0.12,
    b.s * 0.45,
    p.white,
    p.outline,
    b.s * 0.03,
  );
  roundRect(
    ctx,
    b.x + b.s * 0.22,
    b.y + b.s * 0.22,
    b.w - b.s * 0.44,
    b.h - b.s * 0.44,
    b.s * 0.35,
    '#9fd6ea',
  );
  // Bubbles and a rubber duck.
  for (let i = 0; i < 5; i++)
    circle(
      ctx,
      b.x + b.w * (0.3 + i * 0.1),
      b.y + b.h * (0.45 + (i % 2) * 0.1),
      b.s * 0.07,
      'rgba(255,255,255,0.8)',
    );
  circle(ctx, b.x + b.w * 0.75, b.y + b.h * 0.5, b.s * 0.12, '#f2c430');
  circle(ctx, b.x + b.w * 0.75 + b.s * 0.1, b.y + b.h * 0.5 - b.s * 0.08, b.s * 0.07, '#f2c430');
}

function toybox(ctx: Ctx, b: Box, p: Paint) {
  roundRect(
    ctx,
    b.x + b.s * 0.1,
    b.y + b.s * 0.1,
    b.w - b.s * 0.2,
    b.h - b.s * 0.2,
    b.s * 0.12,
    '#e86f6a',
    p.outline,
    b.s * 0.03,
  );
  roundRect(
    ctx,
    b.x + b.s * 0.1,
    b.y + b.s * 0.1,
    b.w - b.s * 0.2,
    b.s * 0.35,
    b.s * 0.1,
    '#f2a43a',
  );
  circle(ctx, b.x + b.w * 0.35, b.y + b.h * 0.6, b.s * 0.22, '#5fa0e0');
  circle(ctx, b.x + b.w * 0.68, b.y + b.h * 0.65, b.s * 0.16, '#8cd07a');
  line(
    ctx,
    b.x + b.w * 0.35 - b.s * 0.22,
    b.y + b.h * 0.6,
    b.x + b.w * 0.35 + b.s * 0.22,
    b.y + b.h * 0.6,
    '#ffffff',
    b.s * 0.04,
  );
}

function crate(ctx: Ctx, b: Box, p: Paint) {
  roundRect(
    ctx,
    b.x + b.s * 0.06,
    b.y + b.s * 0.06,
    b.w - b.s * 0.12,
    b.h - b.s * 0.12,
    b.s * 0.06,
    p.wood,
    p.outline,
    b.s * 0.03,
  );
  const slats = Math.max(3, Math.round(b.h / b.s) * 2);
  for (let i = 1; i < slats; i++) {
    const y = b.y + b.s * 0.06 + ((b.h - b.s * 0.12) / slats) * i;
    line(ctx, b.x + b.s * 0.1, y, b.x + b.w - b.s * 0.1, y, p.woodDark, b.s * 0.03);
  }
  line(
    ctx,
    b.x + b.s * 0.12,
    b.y + b.s * 0.12,
    b.x + b.w - b.s * 0.12,
    b.y + b.h - b.s * 0.12,
    p.woodDark,
    b.s * 0.05,
  );
}

function counter(ctx: Ctx, b: Box, p: Paint) {
  roundRect(
    ctx,
    b.x + b.s * 0.02,
    b.y + b.s * 0.04,
    b.w - b.s * 0.04,
    b.h - b.s * 0.08,
    b.s * 0.08,
    p.whiteShade,
    p.outline,
    b.s * 0.03,
  );
  roundRect(
    ctx,
    b.x + b.s * 0.3,
    b.y + b.s * 0.18,
    b.s * 0.9,
    b.h - b.s * 0.36,
    b.s * 0.1,
    '#b9c6cf',
  );
  circle(ctx, b.x + b.s * 0.75, b.y + b.h * 0.5, b.s * 0.06, '#6a7a86');
  roundRect(
    ctx,
    b.x + b.w - b.s * 1.4,
    b.y + b.s * 0.16,
    b.s * 0.8,
    b.h - b.s * 0.32,
    b.s * 0.06,
    '#d8a86a',
  );
  ellipse(ctx, b.x + b.w - b.s * 1.0, b.y + b.h * 0.5, b.s * 0.16, b.s * 0.12, '#e05a4a');
}

/** At night every piece sinks into the dark a little, toys and bathwater included. */
function nightShade(ctx: Ctx, b: Box) {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(b.x, b.y, b.w, b.h, b.s * 0.16);
  ctx.clip();
  ctx.fillStyle = 'rgba(16, 12, 44, 0.42)';
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.restore();
}

export function drawFurniture(
  ctx: Ctx,
  piece: Furniture,
  origin: { x: number; y: number },
  s: number,
  look: Look,
) {
  const b: Box = {
    x: origin.x + piece.x * s,
    y: origin.y + piece.y * s,
    w: piece.w * s,
    h: piece.h * s,
    s,
  };
  const p = look === 'day' ? DAY : NIGHT;
  shadowUnder(ctx, b, look);
  drawPiece(ctx, piece, b, p);
  if (look === 'night') nightShade(ctx, b);
}

function drawPiece(ctx: Ctx, piece: Furniture, b: Box, p: Paint) {
  switch (piece.kind) {
    case 'sofa':
      return sofa(ctx, b, p, false);
    case 'armchair':
      return sofa(ctx, b, p, true);
    case 'table':
      return table(ctx, b, p);
    case 'desk':
      return desk(ctx, b, p);
    case 'bed':
      return bed(ctx, b, p);
    case 'plant':
      return plant(ctx, b, p);
    case 'shelf':
      return shelf(ctx, b, p);
    case 'washer':
      return washer(ctx, b, p);
    case 'tub':
      return tub(ctx, b, p);
    case 'toybox':
      return toybox(ctx, b, p);
    case 'crate':
      return crate(ctx, b, p);
    case 'counter':
      return counter(ctx, b, p);
  }
}
