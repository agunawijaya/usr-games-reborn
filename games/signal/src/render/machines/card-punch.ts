import { CARD_COLUMNS, ROW_NAMES } from '../../codecs/bcd';
import type { DeskPalette } from '../palette';
import {
  alpha,
  contactShadow,
  type Ctx,
  FONT_MONO,
  glow,
  linear,
  mix,
  radial,
  roundRect,
} from '../paint';

/**
 * Punch cards and the desk punch that makes them. A card is manila stock with its top-left
 * corner cut, ten rows of printed digits under two blank zone rows, and a crisp rectangular hole
 * wherever a column is punched. The original printed 48 columns, so our cards have 48.
 */
export interface CardLook {
  /** Twelve-bit hole patterns per column. */
  columns: readonly number[];
  /** Characters printed along the top edge (blank where none). */
  printed?: string;
  /** Column being read or punched, ringed with light. */
  cursor?: number | null;
  /** Show the row names down the left edge (help on). */
  rowNames?: boolean;
  /** What shows through a hole. */
  behind?: string;
}

/** A card's width over its height, as real cards (7⅜ × 3¼ inches). */
export const CARD_ASPECT = 2.27;

export function paintCard(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  pal: DeskPalette,
  look: CardLook,
) {
  const h = w / CARD_ASPECT;
  const cut = h * 0.12;
  ctx.save();
  // Stock.
  ctx.beginPath();
  ctx.moveTo(x + cut, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + cut);
  ctx.closePath();
  ctx.fillStyle = linear(ctx, x, y, x + w * 0.3, y + h, [
    [0, mix(pal.manila, '#ffffff', 0.18)],
    [1, pal.manila],
  ]);
  ctx.fill();
  ctx.strokeStyle = alpha(pal.manilaShade, 0.9);
  ctx.lineWidth = Math.max(0.6, w * 0.0015);
  ctx.stroke();
  const left = x + w * 0.035;
  const right = x + w * 0.985;
  const top = y + h * 0.13;
  const bottom = y + h * 0.95;
  const colW = (right - left) / CARD_COLUMNS;
  const rowH = (bottom - top) / 12;
  const ink = pal.look === 'night' ? '#7d4a2e' : '#9a5a3a';
  // Printed digits in rows 0–9 of every column.
  const digitSize = Math.min(colW * 0.72, rowH * 0.62);
  if (digitSize >= 3) {
    ctx.fillStyle = alpha(ink, 0.7);
    ctx.font = `500 ${digitSize}px ${FONT_MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let row = 2; row < 12; row++) {
      const label = ROW_NAMES[row]!;
      for (let col = 0; col < CARD_COLUMNS; col++) {
        ctx.fillText(label, left + (col + 0.5) * colW, top + (row + 0.5) * rowH);
      }
    }
    // Column numbers in tiny type under the zero row, as real cards had.
    if (digitSize >= 6) {
      ctx.font = `500 ${digitSize * 0.48}px ${FONT_MONO}`;
      ctx.fillStyle = alpha(ink, 0.55);
      for (let col = 0; col < CARD_COLUMNS; col++) {
        ctx.fillText(String(col + 1), left + (col + 0.5) * colW, top + 3 * rowH - rowH * 0.02);
      }
    }
  } else {
    // Too small for type: faint ruled bands stand in for the printing.
    ctx.fillStyle = alpha(ink, 0.18);
    for (let row = 2; row < 12; row++)
      ctx.fillRect(left, top + (row + 0.42) * rowH, right - left, rowH * 0.16);
  }
  // Printed characters along the top edge.
  if (look.printed && digitSize >= 3) {
    ctx.fillStyle = pal.ink;
    ctx.font = `600 ${Math.min(colW * 0.95, h * 0.09)}px ${FONT_MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    [...look.printed].forEach((char, col) => {
      if (col < CARD_COLUMNS) ctx.fillText(char, left + (col + 0.5) * colW, y + h * 0.065);
    });
  }
  if (look.rowNames && digitSize >= 5) {
    ctx.fillStyle = alpha(pal.inkRed, 0.85);
    ctx.font = `700 ${digitSize * 0.8}px ${FONT_MONO}`;
    ctx.textAlign = 'right';
    for (const row of [0, 1])
      ctx.fillText(ROW_NAMES[row]!, left - colW * 0.15, top + (row + 0.5) * rowH);
  }
  // Holes.
  const behind = look.behind ?? mix(pal.woodDark, '#000000', 0.5);
  look.columns.forEach((pattern, col) => {
    if (col >= CARD_COLUMNS) return;
    for (let row = 0; row < 12; row++) {
      if (!(pattern & (1 << (11 - row)))) continue;
      const hw = colW * 0.52;
      const hh = rowH * 0.66;
      const hx = left + (col + 0.5) * colW - hw / 2;
      const hy = top + (row + 0.5) * rowH - hh / 2;
      ctx.fillStyle = behind;
      roundRect(ctx, hx, hy, hw, hh, Math.min(hw, hh) * 0.18);
      ctx.fill();
      // The cut edge of the stock catches light along the bottom.
      ctx.fillStyle = alpha('#ffffff', 0.35);
      ctx.fillRect(hx, hy + hh - Math.max(0.6, hh * 0.08), hw, Math.max(0.6, hh * 0.08));
    }
  });
  if (look.cursor !== null && look.cursor !== undefined) {
    const cx = left + look.cursor * colW;
    ctx.strokeStyle = pal.inkRed;
    ctx.lineWidth = Math.max(1, colW * 0.12);
    roundRect(ctx, cx - colW * 0.08, top - rowH * 0.15, colW * 1.16, rowH * 12.3, colW * 0.2);
    ctx.stroke();
  }
  ctx.restore();
}

/** Where a card's column and row cells sit, for clicks and labels. */
export function cardCell(x: number, y: number, w: number, col: number, row: number) {
  const h = w / CARD_ASPECT;
  const left = x + w * 0.035;
  const right = x + w * 0.985;
  const top = y + h * 0.13;
  const bottom = y + h * 0.95;
  const colW = (right - left) / CARD_COLUMNS;
  const rowH = (bottom - top) / 12;
  return { x: left + col * colW, y: top + row * rowH, width: colW, height: rowH };
}

export interface PunchState {
  /** The card in the bed. */
  card: CardLook;
  /** 0–1 the punch head's stroke. */
  stroke: number;
  /** 0–1 the ready lamp. */
  lamp: number;
}

/**
 * The desk punch, 420 × 250 at scale 1, `x`, `y` at its front-left foot: a cream enamel cabinet
 * with a sloped deck, a hopper of blank cards, a stacker of punched ones, the card in the bed
 * under the punch hood, and a keyboard.
 */
export function paintCardPunch(
  ctx: Ctx,
  x: number,
  y: number,
  scale: number,
  pal: DeskPalette,
  state: PunchState,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  contactShadow(ctx, 210, 0, 230, 22, 0.5);
  // A blue-grey enamel, so the punch never reads as the printer's twin.
  const enamel = pal.look === 'night' ? '#55666f' : '#9fb3be';
  const enamelShade = mix(enamel, '#000000', 0.3);
  // Cabinet front.
  ctx.fillStyle = linear(ctx, 0, -120, 0, 0, [
    [0, enamel],
    [1, enamelShade],
  ]);
  roundRect(ctx, 0, -120, 420, 120, 10);
  ctx.fill();
  // Sloped deck.
  ctx.fillStyle = linear(ctx, 0, -230, 0, -118, [
    [0, mix(enamel, '#ffffff', 0.22)],
    [1, mix(enamel, '#ffffff', 0.06)],
  ]);
  ctx.beginPath();
  ctx.moveTo(18, -232);
  ctx.lineTo(402, -232);
  ctx.lineTo(420, -118);
  ctx.lineTo(0, -118);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = alpha('#000000', 0.18);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -118);
  ctx.lineTo(420, -118);
  ctx.stroke();
  // The card bed, a dark channel across the deck.
  ctx.fillStyle = mix(pal.steelDeep, '#000000', 0.3);
  ctx.beginPath();
  ctx.moveTo(30, -206);
  ctx.lineTo(390, -206);
  ctx.lineTo(396, -150);
  ctx.lineTo(24, -150);
  ctx.closePath();
  ctx.fill();
  // The card lying in the bed (drawn flat, a little squashed by the slope).
  ctx.save();
  ctx.translate(46, -202);
  ctx.scale(1, 0.48);
  paintCard(ctx, 0, 0, 260, pal, { ...state.card, behind: mix(pal.steelDeep, '#000000', 0.4) });
  ctx.restore();
  // Punch hood over the card's right end.
  ctx.fillStyle = linear(ctx, 300, 0, 380, 0, [
    [0, pal.steelLight],
    [0.5, pal.steel],
    [1, pal.steelDeep],
  ]);
  roundRect(ctx, 300, -246 + state.stroke * 6, 78, 72, 8);
  ctx.fill();
  ctx.fillStyle = alpha('#000000', 0.3);
  ctx.fillRect(304, -178 + state.stroke * 6, 70, 6);
  // Hopper of blank cards, tilted, at the back right.
  for (let i = 0; i < 9; i++) {
    ctx.fillStyle = i % 2 === 0 ? pal.manila : mix(pal.manila, pal.manilaShade, 0.5);
    ctx.fillRect(330 + i * 1.2, -300 + i * 3, 74, 60);
  }
  ctx.fillStyle = linear(ctx, 326, 0, 410, 0, [
    [0, pal.steel],
    [1, pal.steelDeep],
  ]);
  ctx.fillRect(326, -246, 86, 10);
  // Stacker of punched cards at the back left.
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = i % 2 === 0 ? pal.manila : mix(pal.manila, pal.manilaShade, 0.6);
    ctx.fillRect(30 + i * 1.4, -282 + i * 4, 74, 54);
  }
  ctx.fillStyle = alpha('#000000', 0.35);
  for (let i = 0; i < 6; i++) ctx.fillRect(44 + (i % 3) * 18, -262 + Math.floor(i / 3) * 12, 3, 5);
  // Keyboard on the front.
  for (let row = 0; row < 3; row++) {
    for (let k = 0; k < 13; k++) {
      const kx = 30 + k * 27 + row * 8;
      const ky = -100 + row * 28;
      ctx.fillStyle = mix(pal.enamelLight, '#000000', 0.2);
      roundRect(ctx, kx, ky + 3, 22, 20, 4);
      ctx.fill();
      ctx.fillStyle = linear(ctx, 0, ky, 0, ky + 18, [
        [0, k === 12 && row === 0 ? pal.inkRed : mix(pal.cream, '#ffffff', 0.25)],
        [1, k === 12 && row === 0 ? mix(pal.inkRed, '#000000', 0.2) : pal.creamShade],
      ]);
      roundRect(ctx, kx, ky, 22, 18, 4);
      ctx.fill();
    }
  }
  // The ready lamp.
  ctx.fillStyle = radial(ctx, 396, -96, 12, [
    [0, mix('#3a2a12', '#fff1c4', state.lamp)],
    [1, mix('#2a1a08', pal.indicator, state.lamp)],
  ]);
  ctx.beginPath();
  ctx.arc(396, -96, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function cardPunchLamp(x: number, y: number, scale: number) {
  return { x: x + 396 * scale, y: y - 96 * scale, r: 9 * scale };
}

export function paintCardPunchGlow(
  ctx: Ctx,
  x: number,
  y: number,
  scale: number,
  pal: DeskPalette,
  lamp: number,
) {
  if (lamp <= 0.02) return;
  const at = cardPunchLamp(x, y, scale);
  glow(ctx, at.x, at.y, at.r * 7, pal.indicatorGlow, lamp);
}
