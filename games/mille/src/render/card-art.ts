import { type Family, type Kind, familyOf, isDistance, MILES } from '../engine/cards';
import { CARD_COPY, FAMILY_LABEL } from '../content/cards';
import type { CardInk, FamilyInk } from './look';
import {
  type Ctx,
  DISPLAY_FONT,
  alpha,
  circle,
  fillWith,
  fitText,
  glowing,
  poly,
  roundRect,
  strokeWith,
} from './paint';

/**
 * Detour's deck, drawn like old travel posters: flat shapes, a few colours per card, bold type.
 * Every face carries its family three ways: the colour of its band, the glyph in the band
 * (milestone, warning triangle, ring, shield) and the family's name. Faces are drawn in card
 * units, 100 wide and 140 tall, then scaled.
 */

export const CARD_W = 100;
export const CARD_H = 140;
export const CARD_ASPECT = CARD_H / CARD_W;

const BAND_H = 22;
const VIGNETTE = { x: 8, y: 26, w: 84, h: 78 };

export interface FaceOptions {
  /** Leave out the name and fine detail, for cards drawn small. */
  compact?: boolean;
}

export function drawCardFace(
  ctx: Ctx,
  kind: Kind,
  width: number,
  height: number,
  ink: CardInk,
  options: FaceOptions = {},
): void {
  const family = familyOf(kind);
  const fam = ink.families[family];
  ctx.save();
  ctx.scale(width / CARD_W, height / CARD_H);
  paper(ctx, ink);
  band(ctx, kind, family, fam, ink);
  ctx.save();
  roundRect(ctx, VIGNETTE.x, VIGNETTE.y, VIGNETTE.w, VIGNETTE.h, 5);
  ctx.clip();
  ctx.fillStyle = fam.tint;
  ctx.fillRect(VIGNETTE.x, VIGNETTE.y, VIGNETTE.w, VIGNETTE.h);
  VIGNETTES[kind](ctx, ink, fam);
  ctx.restore();
  roundRect(ctx, VIGNETTE.x, VIGNETTE.y, VIGNETTE.w, VIGNETTE.h, 5);
  strokeWith(ctx, alpha(fam.deep, 0.55), 0.8);
  nameLine(ctx, kind, ink, options.compact === true);
  ctx.restore();
}

function paper(ctx: Ctx, ink: CardInk): void {
  roundRect(ctx, 0, 0, CARD_W, CARD_H, 7);
  fillWith(ctx, ink.paper);
  roundRect(ctx, 0.5, 0.5, CARD_W - 1, CARD_H - 1, 6.5);
  strokeWith(ctx, ink.paperEdge, 1);
  // A fine printed frame inside the edge, as on old posters.
  roundRect(ctx, 3.2, 3.2, CARD_W - 6.4, CARD_H - 6.4, 4.5);
  strokeWith(ctx, alpha(ink.ink, 0.16), 0.6);
}

function band(ctx: Ctx, kind: Kind, family: Family, fam: FamilyInk, ink: CardInk): void {
  ctx.save();
  roundRect(ctx, 5, 5, CARD_W - 10, BAND_H - 2, 3.5);
  fillWith(ctx, fam.base);
  ctx.fillStyle = fam.onBase;
  ctx.strokeStyle = fam.onBase;
  glyph(ctx, family, 15.5, 15, fam);
  ctx.fillStyle = fam.onBase;
  ctx.textBaseline = 'middle';
  if (isDistance(kind)) {
    ctx.font = `800 13px ${DISPLAY_FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(String(MILES[kind]), CARD_W - 9, 15.6);
  }
  ctx.font = `750 8.4px ${DISPLAY_FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText(FAMILY_LABEL[family].toUpperCase(), 25, 15.4);
  void ink;
  ctx.restore();
}

/** The family's mark: a milestone, a warning triangle, a ring, a shield. */
function glyph(ctx: Ctx, family: Family, x: number, y: number, fam: FamilyInk): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = fam.onBase;
  ctx.strokeStyle = fam.onBase;
  ctx.lineJoin = 'round';
  switch (family) {
    case 'distance':
      ctx.beginPath();
      ctx.moveTo(-4, 6);
      ctx.lineTo(-4, -2);
      ctx.arc(0, -2, 4, Math.PI, 0);
      ctx.lineTo(4, 6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = fam.base;
      ctx.fillRect(-2.4, -1.2, 4.8, 1.6);
      break;
    case 'hazard':
      poly(ctx, [0, -6.2, 6.4, 5.4, -6.4, 5.4]);
      ctx.fill();
      ctx.fillStyle = fam.base;
      ctx.fillRect(-0.85, -2.4, 1.7, 4.4);
      circle(ctx, 0, 3.6, 0.95);
      ctx.fill();
      break;
    case 'remedy':
      circle(ctx, 0, 0, 5.4);
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-2.6, 0.2);
      ctx.lineTo(-0.6, 2.3);
      ctx.lineTo(2.8, -2.2);
      ctx.stroke();
      break;
    case 'safety':
      ctx.beginPath();
      ctx.moveTo(0, -6.4);
      ctx.lineTo(5.6, -4);
      ctx.quadraticCurveTo(5.4, 3.6, 0, 6.6);
      ctx.quadraticCurveTo(-5.4, 3.6, -5.6, -4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = fam.base;
      star(ctx, 0, 0, 2.6, 1.1);
      ctx.fill();
      break;
  }
  ctx.restore();
}

function nameLine(ctx: Ctx, kind: Kind, ink: CardInk, compact: boolean): void {
  if (compact) return;
  const copy = CARD_COPY[kind];
  ctx.save();
  ctx.fillStyle = ink.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const main = copy.sub ?? copy.name;
  const size = fitText(ctx, main, 82, 12.5, DISPLAY_FONT, 760);
  ctx.font = `760 ${size}px ${DISPLAY_FONT}`;
  ctx.fillText(main, 50, copy.sub ? 118 : 123);
  if (copy.sub) {
    ctx.fillStyle = ink.inkSoft;
    ctx.font = `600 8px ${DISPLAY_FONT}`;
    ctx.fillText(copy.name.toUpperCase(), 50, 129.5);
  }
  ctx.restore();
}

function star(ctx: Ctx, x: number, y: number, outer: number, inner: number, points = 5): void {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function sunburst(ctx: Ctx, cx: number, cy: number, colour: string, rays = 18): void {
  ctx.save();
  ctx.fillStyle = colour;
  for (let i = 0; i < rays; i++) {
    const a0 = (i * Math.PI * 2) / rays;
    const a1 = a0 + Math.PI / rays;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a0) * 140, cy + Math.sin(a0) * 140);
    ctx.lineTo(cx + Math.cos(a1) * 140, cy + Math.sin(a1) * 140);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------
// Distance: a poster scene for each length of road, with the miles in big type over the sky.

function bigMiles(ctx: Ctx, miles: number, ink: CardInk, fam: FamilyInk, y = 58): void {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const size = miles >= 100 ? 31 : 37;
  ctx.font = `800 ${size}px ${DISPLAY_FONT}`;
  ctx.fillStyle = fam.deep;
  ctx.fillText(String(miles), 51.6, y + 1.6);
  ctx.fillStyle = ink.glow ? ink.ink : ink.paper;
  ctx.lineJoin = 'round';
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = fam.deep;
  ctx.strokeText(String(miles), 50, y);
  ctx.fillText(String(miles), 50, y);
  ctx.restore();
}

function hills(ctx: Ctx, top: number, colour: string, wave: number, phase: number): void {
  ctx.beginPath();
  ctx.moveTo(0, 110);
  for (let x = 0; x <= 100; x += 4) ctx.lineTo(x, top + Math.sin(x / 13 + phase) * wave);
  ctx.lineTo(100, 110);
  ctx.closePath();
  fillWith(ctx, colour);
}

function side25(ctx: Ctx, ink: CardInk, fam: FamilyInk): void {
  // A side street: a row of houses with lit windows, a café awning and a lamp post.
  const houses = [
    [8, 66, 18, 38],
    [26, 60, 16, 44],
    [42, 70, 20, 34],
    [62, 63, 15, 41],
    [77, 68, 16, 36],
  ] as const;
  houses.forEach(([x, y, w, hgt], i) => {
    ctx.fillStyle = i % 2 ? fam.base : fam.deep;
    ctx.fillRect(x, y, w, hgt);
    poly(ctx, [x - 1, y, x + w / 2, y - 6, x + w + 1, y]);
    fillWith(ctx, i % 2 ? fam.deep : fam.base);
    for (let wy = y + 5; wy < y + hgt - 8; wy += 8) {
      for (let wx = x + 3; wx < x + w - 3; wx += 6) {
        glowing(ctx, ink.glow, '#ffd27a', 4, () => {
          ctx.fillStyle = ink.glow ? '#ffd27a' : alpha(ink.paper, 0.85);
          ctx.fillRect(wx, wy, 3, 4);
        });
      }
    }
  });
  // Awning stripes over the café.
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = i % 2 ? ink.paper : '#d6462f';
    ctx.fillRect(42 + i * 3.4, 86, 3.4, 4);
  }
  ctx.fillStyle = alpha(ink.ink, 0.35);
  ctx.fillRect(8, 100, 84, 4);
  // Lamp post.
  ctx.fillStyle = ink.ink;
  ctx.fillRect(86, 74, 1.6, 30);
  glowing(ctx, ink.glow, '#ffe39a', 8, () => {
    circle(ctx, 86.8, 73, 2.6);
    fillWith(ctx, ink.glow ? '#ffe39a' : '#f6d27a');
  });
  bigMiles(ctx, 25, ink, fam, 58);
}

function lane50(ctx: Ctx, ink: CardInk, fam: FamilyInk): void {
  hills(ctx, 80, fam.base, 3, 0.6);
  hills(ctx, 90, fam.deep, 2.5, 2.4);
  // A lane winding off between the fields.
  ctx.beginPath();
  ctx.moveTo(40, 104);
  ctx.bezierCurveTo(48, 96, 58, 93, 56, 84);
  ctx.lineTo(58, 84);
  ctx.bezierCurveTo(62, 93, 56, 98, 54, 104);
  ctx.closePath();
  fillWith(ctx, alpha(ink.paper, ink.glow ? 0.35 : 0.9));
  // A fence and a round tree.
  ctx.strokeStyle = ink.ink;
  ctx.lineWidth = 0.9;
  for (let x = 12; x < 38; x += 6) {
    ctx.beginPath();
    ctx.moveTo(x, 96);
    ctx.lineTo(x, 89);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(11, 91.5);
  ctx.lineTo(38, 90.5);
  ctx.stroke();
  ctx.fillStyle = ink.ink;
  ctx.fillRect(79, 78, 1.8, 9);
  circle(ctx, 80, 74, 7);
  fillWith(ctx, fam.deep);
  circle(ctx, 77.6, 72.2, 3.4);
  fillWith(ctx, alpha(ink.paper, 0.25));
  bigMiles(ctx, 50, ink, fam, 59);
}

function coast75(ctx: Ctx, ink: CardInk, fam: FamilyInk): void {
  ctx.fillStyle = fam.base;
  ctx.fillRect(0, 76, 100, 30);
  ctx.strokeStyle = alpha(ink.paper, ink.glow ? 0.35 : 0.75);
  ctx.lineWidth = 0.8;
  for (let y = 81; y < 104; y += 5) {
    ctx.beginPath();
    ctx.moveTo(30 + (y % 3) * 6, y);
    ctx.lineTo(48 + (y % 3) * 6, y);
    ctx.stroke();
  }
  // The cliff and the road climbing along it.
  poly(ctx, [0, 64, 22, 66, 36, 78, 46, 106, 0, 106]);
  fillWith(ctx, fam.deep);
  ctx.beginPath();
  ctx.moveTo(0, 74);
  ctx.bezierCurveTo(16, 72, 28, 80, 32, 106);
  ctx.lineTo(38, 106);
  ctx.bezierCurveTo(32, 80, 18, 69, 0, 69);
  ctx.closePath();
  fillWith(ctx, alpha(ink.paper, ink.glow ? 0.4 : 0.92));
  // A sail on the water.
  poly(ctx, [76, 92, 76, 79, 84, 92]);
  fillWith(ctx, ink.glow ? ink.ink : ink.paper);
  ctx.fillStyle = ink.ink;
  ctx.fillRect(72, 92, 14, 1.6);
  bigMiles(ctx, 75, ink, fam, 59);
}

function highway100(ctx: Ctx, ink: CardInk, fam: FamilyInk): void {
  hills(ctx, 80, fam.base, 1.5, 1);
  // A straight road running to the horizon.
  poly(ctx, [47, 80, 53, 80, 80, 106, 20, 106]);
  fillWith(ctx, fam.deep);
  ctx.fillStyle = ink.glow ? '#ffd27a' : ink.paper;
  for (let i = 0; i < 4; i++) {
    const y0 = 82 + i * 6.5;
    const w = 0.6 + i * 0.5;
    ctx.fillRect(50 - w / 2, y0, w, 3 + i);
  }
  // A sign gantry over it.
  ctx.fillStyle = ink.ink;
  ctx.fillRect(28, 66, 1.4, 16);
  ctx.fillRect(70.6, 66, 1.4, 16);
  roundRect(ctx, 36, 64, 28, 8, 1.2);
  fillWith(ctx, fam.base);
  roundRect(ctx, 36, 64, 28, 8, 1.2);
  strokeWith(ctx, ink.glow ? ink.ink : ink.paper, 0.6);
  ctx.fillStyle = ink.glow ? ink.ink : ink.paper;
  ctx.fillRect(40, 67.3, 14, 1.2);
  poly(ctx, [56, 66.4, 60, 68, 56, 69.6]);
  ctx.fill();
  bigMiles(ctx, 100, ink, fam, 57);
}

function throttle200(ctx: Ctx, ink: CardInk, fam: FamilyInk): void {
  // A low sun on the horizon and the road straight into it.
  sunburst(ctx, 50, 82, alpha(fam.base, 0.32), 22);
  circle(ctx, 50, 82, 13);
  glowing(ctx, ink.glow, '#ffb36b', 10, () => fillWith(ctx, ink.glow ? '#ffb36b' : '#f2b84b'));
  ctx.fillStyle = fam.deep;
  ctx.fillRect(0, 82, 100, 26);
  poly(ctx, [48.5, 82, 51.5, 82, 74, 106, 26, 106]);
  fillWith(ctx, ink.rubber);
  ctx.fillStyle = ink.glow ? '#ffd27a' : ink.paper;
  for (let i = 0; i < 4; i++) ctx.fillRect(49.6 - i * 0.3, 85 + i * 5.5, 0.8 + i * 0.6, 2.6 + i);
  // Speed lines.
  ctx.strokeStyle = alpha(ink.glow ? ink.ink : ink.paper, 0.9);
  ctx.lineWidth = 1.1;
  ctx.lineCap = 'round';
  for (const [x, y, len] of [
    [10, 92, 12],
    [14, 98, 16],
    [76, 94, 13],
    [72, 100, 18],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y);
    ctx.stroke();
  }
  bigMiles(ctx, 200, ink, fam, 60);
}

// ---------------------------------------------------------------------------------------------
// Hazards.

function warningStripes(ctx: Ctx, fam: FamilyInk): void {
  ctx.save();
  ctx.fillStyle = alpha(fam.base, 0.16);
  for (let x = -100; x < 120; x += 12) {
    poly(ctx, [x, 26, x + 6, 26, x + 6 + 80, 106, x + 80, 106]);
    ctx.fill();
  }
  ctx.restore();
}

function noFuel(ctx: Ctx, ink: CardInk, fam: FamilyInk): void {
  warningStripes(ctx, fam);
  // A fuel gauge with its needle down on E.
  const cx = 50;
  const cy = 76;
  ctx.beginPath();
  ctx.arc(cx, cy, 30, Math.PI, 0);
  ctx.lineTo(cx + 30, cy + 6);
  ctx.lineTo(cx - 30, cy + 6);
  ctx.closePath();
  fillWith(ctx, ink.ink);
  ctx.beginPath();
  ctx.arc(cx, cy, 26, Math.PI, 0);
  ctx.closePath();
  fillWith(ctx, ink.glow ? '#203054' : ink.paper);
  ctx.strokeStyle = ink.glow ? ink.ink : ink.ink;
  ctx.lineWidth = 1.4;
  for (let i = 0; i <= 8; i++) {
    const a = Math.PI + (i * Math.PI) / 8;
    const r0 = i % 4 === 0 ? 17 : 20;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    ctx.lineTo(cx + Math.cos(a) * 24, cy + Math.sin(a) * 24);
    ctx.stroke();
  }
  ctx.fillStyle = ink.ink;
  ctx.font = `800 9px ${DISPLAY_FONT}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = fam.base;
  ctx.fillText('E', cx - 19, cy + 1);
  ctx.fillStyle = ink.ink;
  ctx.fillText('F', cx + 19, cy + 1);
  // The needle, all the way down.
  const a = Math.PI + 0.22;
  glowing(ctx, ink.glow, fam.base, 6, () => {
    ctx.strokeStyle = fam.base;
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * 22, cy + Math.sin(a) * 22);
    ctx.stroke();
  });
  circle(ctx, cx, cy, 3);
  fillWith(ctx, ink.ink);
  // An empty drop.
  drop(ctx, 50, 94, 6);
  strokeWith(ctx, fam.deep, 1.4);
  ctx.strokeStyle = fam.deep;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(44, 101);
  ctx.lineTo(56, 89);
  ctx.stroke();
}

function drop(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y - r * 1.6);
  ctx.bezierCurveTo(x + r * 0.9, y - r * 0.4, x + r, y + r * 0.2, x, y + r);
  ctx.bezierCurveTo(x - r, y + r * 0.2, x - r * 0.9, y - r * 0.4, x, y - r * 1.6);
  ctx.closePath();
}

function tyre(
  ctx: Ctx,
  ink: CardInk,
  x: number,
  y: number,
  r: number,
  squash: number,
  hub: string,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1 + squash * 0.25, 1 - squash);
  circle(ctx, 0, 0, r);
  fillWith(ctx, ink.rubber);
  ctx.strokeStyle = alpha(ink.glow ? '#ffffff' : '#000000', 0.25);
  ctx.lineWidth = r * 0.06;
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * 0.82, Math.sin(a) * r * 0.82);
    ctx.lineTo(Math.cos(a) * r * 0.98, Math.sin(a) * r * 0.98);
    ctx.stroke();
  }
  circle(ctx, 0, 0, r * 0.56);
  fillWith(ctx, ink.steel);
  circle(ctx, 0, 0, r * 0.4);
  fillWith(ctx, hub);
  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI * 2) / 5;
    circle(ctx, Math.cos(a) * r * 0.24, Math.sin(a) * r * 0.24, r * 0.06);
    fillWith(ctx, ink.steel);
  }
  ctx.restore();
}

function flatTyre(ctx: Ctx, ink: CardInk, fam: FamilyInk): void {
  warningStripes(ctx, fam);
  ctx.fillStyle = alpha(ink.ink, 0.25);
  ctx.fillRect(8, 97, 84, 9);
  flatWheel(ctx, ink, 46, 74, 22, fam.base);
  // The nail that did it.
  ctx.save();
  ctx.translate(60, 93);
  ctx.rotate(0.5);
  ctx.fillStyle = ink.steel;
  ctx.fillRect(-0.8, -8, 1.6, 8);
  ctx.fillRect(-2.8, -9.2, 5.6, 1.6);
  ctx.restore();
  // Air hissing out.
  ctx.strokeStyle = ink.glow ? ink.ink : ink.inkSoft;
  ctx.lineWidth = 1.2;
  ctx.lineCap = 'round';
  for (const [x, y] of [
    [70, 84],
    [73, 89],
    [70, 94],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 4, y - 3, x + 8, y);
    ctx.stroke();
  }
  puff(ctx, 84, 82, 4.2, alpha(ink.glow ? ink.ink : ink.paper, 0.95));
}

/** A wheel sagging on a flat: round above, its tread squashed wide where it meets the road. */
function flatWheel(ctx: Ctx, ink: CardInk, x: number, y: number, r: number, hub: string): void {
  ctx.save();
  ctx.translate(x, y);
  const k = Math.SQRT1_2 * r;
  ctx.beginPath();
  ctx.arc(0, 0, r, Math.PI * 0.75, Math.PI * 2.25);
  ctx.quadraticCurveTo(r * 1.08, r * 0.95, r * 0.62, r + 1.6);
  ctx.lineTo(-r * 0.62, r + 1.6);
  ctx.quadraticCurveTo(-r * 1.08, r * 0.95, -k, k);
  ctx.closePath();
  fillWith(ctx, ink.rubber);
  ctx.strokeStyle = alpha(ink.glow ? '#ffffff' : '#000000', 0.22);
  ctx.lineWidth = r * 0.06;
  for (let i = 0; i < 12; i++) {
    const a = Math.PI * 0.8 + (i * Math.PI * 1.4) / 11;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8);
    ctx.lineTo(Math.cos(a) * r * 0.97, Math.sin(a) * r * 0.97);
    ctx.stroke();
  }
  circle(ctx, 0, r * 0.08, r * 0.55);
  fillWith(ctx, ink.steel);
  circle(ctx, 0, r * 0.08, r * 0.38);
  fillWith(ctx, hub);
  circle(ctx, 0, r * 0.08, r * 0.12);
  fillWith(ctx, ink.steel);
  ctx.restore();
}

function puff(ctx: Ctx, x: number, y: number, r: number, colour: string): void {
  ctx.fillStyle = colour;
  circle(ctx, x, y, r);
  ctx.fill();
  circle(ctx, x + r * 0.9, y + r * 0.3, r * 0.75);
  ctx.fill();
  circle(ctx, x - r * 0.8, y + r * 0.4, r * 0.65);
  ctx.fill();
}

function fenderBender(ctx: Ctx, ink: CardInk, fam: FamilyInk): void {
  warningStripes(ctx, fam);
  ctx.fillStyle = alpha(ink.ink, 0.25);
  ctx.fillRect(8, 96, 84, 10);
  // Two noses meeting, gently.
  carNose(ctx, ink, 8, 70, 1, fam.base, fam.deep);
  carNose(ctx, ink, 92, 70, -1, ink.steel, ink.inkSoft);
  // A cartoon bonk.
  ctx.save();
  ctx.translate(50, 70);
  star(ctx, 0, 0, 16, 9, 10);
  fillWith(ctx, ink.glow ? '#ffd27a' : '#ffd86b');
  star(ctx, 0, 0, 16, 9, 10);
  strokeWith(ctx, '#1d2838', 1);
  ctx.fillStyle = '#1d2838';
  ctx.font = `800 5.4px ${DISPLAY_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('BONK', 0, 0.6);
  ctx.restore();
  star(ctx, 36, 54, 2.6, 1.1);
  fillWith(ctx, ink.ink);
  star(ctx, 64, 52, 2.2, 0.9);
  fillWith(ctx, ink.ink);
}

function carNose(
  ctx: Ctx,
  ink: CardInk,
  x: number,
  y: number,
  dir: 1 | -1,
  body: string,
  deep: string,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  ctx.beginPath();
  ctx.moveTo(0, -12);
  ctx.lineTo(18, -12);
  ctx.quadraticCurveTo(30, -11, 34, -2);
  ctx.lineTo(36, 12);
  ctx.lineTo(0, 14);
  ctx.closePath();
  fillWith(ctx, body);
  ctx.fillStyle = deep;
  ctx.fillRect(0, 6, 36, 3);
  // Headlamp and bumper.
  glowing(ctx, ink.glow, '#fff2b0', 6, () => {
    circle(ctx, 30, -1, 3);
    fillWith(ctx, ink.glow ? '#fff2b0' : '#fff7da');
  });
  roundRect(ctx, 28, 10, 11, 4, 2);
  fillWith(ctx, ink.steel);
  tyre(ctx, ink, 14, 15, 7, 0, ink.steel);
  ctx.restore();
}

function trafficLight(
  ctx: Ctx,
  ink: CardInk,
  x: number,
  y: number,
  s: number,
  lit: 'red' | 'green',
  colour: string,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = ink.ink;
  ctx.fillRect(-1.6, 30, 3.2, 30);
  roundRect(ctx, -11, -32, 22, 64, 6);
  fillWith(ctx, ink.glow ? '#0c1220' : '#2b3442');
  // Visors.
  for (const ly of [-20, 0, 20]) {
    ctx.beginPath();
    ctx.ellipse(0, ly - 6, 9.5, 4, 0, Math.PI, 0);
    fillWith(ctx, ink.glow ? '#060a12' : '#1d2430');
  }
  const lamps: [number, 'red' | 'amber' | 'green'][] = [
    [-20, 'red'],
    [0, 'amber'],
    [20, 'green'],
  ];
  for (const [ly, which] of lamps) {
    const on = which === lit;
    const tone = which === 'red' ? '#ff5a3c' : which === 'amber' ? '#ffb83c' : '#3fe08a';
    if (on) {
      glowing(ctx, ink.glow, tone, 14, () => {
        circle(ctx, 0, ly, 7.6);
        fillWith(ctx, colour);
      });
      circle(ctx, -2.4, ly - 2.4, 2.2);
      fillWith(ctx, alpha('#ffffff', 0.55));
    } else {
      circle(ctx, 0, ly, 7.6);
      fillWith(ctx, alpha(tone, ink.glow ? 0.14 : 0.22));
    }
  }
  ctx.restore();
}

function redLight(ctx: Ctx, ink: CardInk, fam: FamilyInk): void {
  warningStripes(ctx, fam);
  ctx.fillStyle = alpha(ink.ink, 0.22);
  ctx.fillRect(8, 98, 84, 8);
  ctx.fillStyle = ink.glow ? ink.ink : ink.paper;
  ctx.fillRect(12, 100, 76, 2.2);
  trafficLight(ctx, ink, 50, 62, 0.95, 'red', fam.base);
}

function roadSign(
  ctx: Ctx,
  ink: CardInk,
  x: number,
  y: number,
  r: number,
  ring: string,
  draw: () => void,
): void {
  ctx.fillStyle = ink.ink;
  ctx.fillRect(x - 1.2, y + r - 2, 2.4, 106 - y - r + 2);
  circle(ctx, x, y, r);
  fillWith(ctx, ring);
  circle(ctx, x, y, r * 0.74);
  fillWith(ctx, ink.glow ? '#e9e2d0' : '#fffaf0');
  draw();
}

function slowZone(ctx: Ctx, ink: CardInk, fam: FamilyInk): void {
  warningStripes(ctx, fam);
  roadSign(ctx, ink, 50, 62, 25, fam.base, () => {
    ctx.fillStyle = '#1d2838';
    ctx.font = `800 21px ${DISPLAY_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('50', 50, 63.5);
  });
}

// ---------------------------------------------------------------------------------------------
// Remedies.

function rays(ctx: Ctx, fam: FamilyInk): void {
  sunburst(ctx, 50, 64, alpha(fam.base, 0.13), 16);
}

function fillUp(ctx: Ctx, ink: CardInk, fam: FamilyInk): void {
  rays(ctx, fam);
  ctx.fillStyle = alpha(ink.ink, 0.22);
  ctx.fillRect(8, 99, 84, 7);
  // A round-shouldered pump with its window lit.
  ctx.beginPath();
  ctx.moveTo(32, 100);
  ctx.lineTo(32, 50);
  ctx.quadraticCurveTo(32, 38, 46, 38);
  ctx.quadraticCurveTo(60, 38, 60, 50);
  ctx.lineTo(60, 100);
  ctx.closePath();
  fillWith(ctx, fam.base);
  ctx.fillStyle = fam.deep;
  ctx.fillRect(32, 90, 28, 10);
  circle(ctx, 46, 49, 8);
  glowing(ctx, ink.glow, '#fff3c4', 10, () => fillWith(ctx, ink.glow ? '#fff3c4' : ink.paper));
  ctx.fillStyle = '#1d2838';
  ctx.font = `800 6px ${DISPLAY_FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('FUEL', 46, 51.2);
  roundRect(ctx, 37, 62, 18, 10, 2);
  fillWith(ctx, ink.glow ? '#0c1220' : '#2b3442');
  ctx.fillStyle = ink.glow ? '#7ef0b4' : '#a6e3b8';
  ctx.fillRect(39, 64.5, 14, 2);
  ctx.fillRect(39, 68, 9, 2);
  // Hose and nozzle.
  ctx.strokeStyle = ink.rubber;
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(60, 60);
  ctx.bezierCurveTo(78, 58, 80, 82, 72, 88);
  ctx.stroke();
  ctx.save();
  ctx.translate(72, 88);
  ctx.rotate(-0.5);
  roundRect(ctx, -3, -2, 9, 5, 1.4);
  fillWith(ctx, ink.steel);
  ctx.fillStyle = ink.steel;
  ctx.fillRect(5, -1, 6, 2);
  ctx.restore();
  drop(ctx, 80, 97, 3);
  fillWith(ctx, fam.base);
}

function spareTyre(ctx: Ctx, ink: CardInk, fam: FamilyInk): void {
  rays(ctx, fam);
  ctx.fillStyle = alpha(ink.ink, 0.22);
  ctx.fillRect(8, 99, 84, 7);
  tyre(ctx, ink, 46, 72, 23, 0, fam.base);
  // A wheel brace across it.
  ctx.save();
  ctx.translate(70, 74);
  ctx.rotate(-0.6);
  ctx.fillStyle = ink.steel;
  ctx.fillRect(-2, -20, 4, 34);
  ctx.fillRect(-11, -18, 22, 4);
  ctx.restore();
  for (const [x, y, r] of [
    [22, 48, 3.4],
    [76, 50, 2.6],
    [24, 92, 2.2],
  ] as const) {
    star(ctx, x, y, r, r * 0.4, 4);
    fillWith(ctx, ink.glow ? '#fff3c4' : fam.deep);
  }
}

function mechanic(ctx: Ctx, ink: CardInk, fam: FamilyInk): void {
  rays(ctx, fam);
  // A gear behind crossed tools.
  ctx.save();
  ctx.translate(50, 66);
  ctx.fillStyle = fam.base;
  ctx.beginPath();
  for (let i = 0; i < 24; i++) {
    const r = i % 2 ? 21 : 25;
    const a = (i * Math.PI) / 12;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  circle(ctx, 0, 0, 10);
  fillWith(ctx, fam.tint);
  for (const angle of [-0.75, 0.75]) {
    ctx.save();
    ctx.rotate(angle);
    roundRect(ctx, -2.6, -30, 5.2, 58, 2.4);
    fillWith(ctx, ink.steel);
    roundRect(ctx, -2.6, -30, 5.2, 58, 2.4);
    strokeWith(ctx, ink.ink, 0.9);
    // An open jaw at one end, a ring at the other.
    ctx.beginPath();
    ctx.arc(0, -31, 7, 0, Math.PI * 2);
    fillWith(ctx, ink.steel);
    ctx.beginPath();
    ctx.arc(0, -31, 7, 0, Math.PI * 2);
    strokeWith(ctx, ink.ink, 0.9);
    ctx.fillStyle = fam.tint;
    ctx.fillRect(-3, -40, 6, 9);
    circle(ctx, 0, 31, 6);
    fillWith(ctx, ink.steel);
    circle(ctx, 0, 31, 6);
    strokeWith(ctx, ink.ink, 0.9);
    circle(ctx, 0, 31, 2.6);
    fillWith(ctx, fam.tint);
    ctx.restore();
  }
  ctx.restore();
}

function greenLight(ctx: Ctx, ink: CardInk, fam: FamilyInk): void {
  rays(ctx, fam);
  ctx.fillStyle = alpha(ink.ink, 0.22);
  ctx.fillRect(8, 98, 84, 8);
  trafficLight(ctx, ink, 50, 62, 0.95, 'green', fam.base);
}

function openRoad(ctx: Ctx, ink: CardInk, fam: FamilyInk): void {
  rays(ctx, fam);
  const signInk = '#1d2838';
  roadSign(ctx, ink, 50, 60, 24, ink.glow ? '#e9e2d0' : '#fffaf0', () => {
    circle(ctx, 50, 60, 24);
    strokeWith(ctx, signInk, 1.6);
    ctx.save();
    circle(ctx, 50, 60, 22);
    ctx.clip();
    ctx.fillStyle = alpha(signInk, 0.25);
    ctx.font = `800 20px ${DISPLAY_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('50', 50, 61.5);
    ctx.translate(50, 60);
    ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = signInk;
    for (const dx of [-7, -2.5, 2, 6.5]) ctx.fillRect(dx - 1, -30, 2, 60);
    ctx.restore();
  });
  // A road opening out below.
  ctx.fillStyle = fam.base;
  ctx.fillRect(8, 96, 84, 10);
  ctx.fillStyle = ink.glow ? '#ffd27a' : ink.paper;
  for (let x = 12; x < 90; x += 10) ctx.fillRect(x, 100.5, 6, 1.6);
}

// ---------------------------------------------------------------------------------------------
// Safeties: a gold burst behind each, like a medal.

function medal(ctx: Ctx, fam: FamilyInk): void {
  sunburst(ctx, 50, 64, alpha(fam.base, 0.32), 20);
  circle(ctx, 50, 64, 30);
  fillWith(ctx, alpha(fam.base, 0.22));
}

function longRangeTank(ctx: Ctx, ink: CardInk, fam: FamilyInk): void {
  medal(ctx, fam);
  // A big jerrycan with a star, and a gauge on full.
  ctx.save();
  ctx.translate(50, 66);
  ctx.rotate(-0.08);
  roundRect(ctx, -19, -26, 38, 52, 5);
  fillWith(ctx, fam.base);
  roundRect(ctx, -19, -26, 38, 52, 5);
  strokeWith(ctx, fam.deep, 1.6);
  ctx.strokeStyle = fam.deep;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(-12, -16);
  ctx.lineTo(12, 18);
  ctx.moveTo(12, -16);
  ctx.lineTo(-12, 18);
  ctx.stroke();
  roundRect(ctx, -14, -34, 18, 9, 3);
  strokeWith(ctx, ink.ink, 2.4);
  roundRect(ctx, 8, -32, 8, 7, 1.5);
  fillWith(ctx, ink.steel);
  circle(ctx, 0, 1, 9.5);
  fillWith(ctx, ink.glow ? '#0c1220' : ink.paper);
  star(ctx, 0, 1, 7, 3);
  fillWith(ctx, fam.deep);
  ctx.restore();
}

function runFlats(ctx: Ctx, ink: CardInk, fam: FamilyInk): void {
  medal(ctx, fam);
  tyre(ctx, ink, 50, 66, 25, 0, fam.base);
  ctx.save();
  ctx.translate(50, 66);
  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.lineTo(8.5, -6.6);
  ctx.quadraticCurveTo(8, 5, 0, 10.5);
  ctx.quadraticCurveTo(-8, 5, -8.5, -6.6);
  ctx.closePath();
  fillWith(ctx, fam.deep);
  star(ctx, 0, 0, 4, 1.7);
  fillWith(ctx, ink.glow ? '#fff3c4' : ink.paper);
  ctx.restore();
}

function roadSense(ctx: Ctx, ink: CardInk, fam: FamilyInk): void {
  medal(ctx, fam);
  ctx.save();
  ctx.translate(50, 66);
  circle(ctx, 0, 0, 25);
  ctx.lineWidth = 5.4;
  ctx.strokeStyle = ink.ink;
  ctx.stroke();
  ctx.lineWidth = 4.4;
  ctx.strokeStyle = fam.deep;
  for (const a of [Math.PI / 2, Math.PI * 1.1, -Math.PI * 0.1]) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * 23, Math.sin(a) * 23);
    ctx.stroke();
  }
  circle(ctx, 0, 0, 9);
  fillWith(ctx, fam.base);
  star(ctx, 0, 0, 6.4, 2.7);
  fillWith(ctx, ink.glow ? '#fff3c4' : ink.paper);
  ctx.restore();
}

function greenWave(ctx: Ctx, ink: CardInk, fam: FamilyInk): void {
  medal(ctx, fam);
  for (const [x, y] of [
    [26, 66],
    [50, 58],
    [74, 66],
  ] as const) {
    trafficLight(ctx, ink, x, y, 0.42, 'green', '#3fd884');
  }
  ctx.strokeStyle = fam.deep;
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let x = 12; x <= 88; x += 2) {
    const y = 96 + Math.sin(x / 7) * 3;
    if (x === 12) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

const VIGNETTES: Readonly<Record<Kind, (ctx: Ctx, ink: CardInk, fam: FamilyInk) => void>> = {
  m25: side25,
  m50: lane50,
  m75: coast75,
  m100: highway100,
  m200: throttle200,
  noFuel,
  flatTyre,
  fenderBender,
  redLight,
  slowZone,
  fillUp,
  spareTyre,
  mechanic,
  greenLight,
  openRoad,
  longRangeTank,
  runFlats,
  roadSense,
  greenWave,
};

/** The back: a road running into a low sun under the game's name. */
export function drawCardBack(ctx: Ctx, width: number, height: number, ink: CardInk): void {
  const { field, stripe, emblem } = ink.back;
  ctx.save();
  ctx.scale(width / CARD_W, height / CARD_H);
  roundRect(ctx, 0, 0, CARD_W, CARD_H, 7);
  fillWith(ctx, field);
  ctx.save();
  roundRect(ctx, 6, 6, CARD_W - 12, CARD_H - 12, 4);
  ctx.clip();
  sunburst(ctx, 50, 92, alpha(stripe, 0.18), 24);
  circle(ctx, 50, 92, 18);
  glowing(ctx, ink.glow, stripe, 12, () => fillWith(ctx, stripe));
  ctx.fillStyle = alpha('#000000', 0.25);
  ctx.fillRect(0, 92, 100, 50);
  poly(ctx, [48, 92, 52, 92, 78, 140, 22, 140]);
  fillWith(ctx, alpha(emblem, 0.92));
  ctx.fillStyle = field;
  for (let i = 0; i < 4; i++) ctx.fillRect(49.4 - i * 0.4, 96 + i * 10, 1.2 + i * 0.8, 4 + i * 1.6);
  ctx.restore();
  roundRect(ctx, 6, 6, CARD_W - 12, CARD_H - 12, 4);
  strokeWith(ctx, stripe, 1.6);
  roundRect(ctx, 9, 9, CARD_W - 18, CARD_H - 18, 3);
  strokeWith(ctx, alpha(stripe, 0.5), 0.6);
  ctx.fillStyle = emblem;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const size = fitText(ctx, 'DETOUR', 76, 20, DISPLAY_FONT, 800);
  ctx.font = `800 ${size}px ${DISPLAY_FONT}`;
  ctx.fillText('DETOUR', 50, 38);
  const tag = 'RACE · BLOCK · REPAIR · COUNTER';
  ctx.font = `650 ${fitText(ctx, tag, 62, 6.2, DISPLAY_FONT, 650)}px ${DISPLAY_FONT}`;
  ctx.fillStyle = alpha(emblem, 0.85);
  ctx.fillText(tag, 50, 52);
  ctx.restore();
}
