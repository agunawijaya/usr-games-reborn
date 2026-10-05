import { type CardId, JACK, KING, QUEEN, rankLabel, rankOf, type Suit, suitOf } from './deck';
import { type CourtRank, courtSpec, drawCourtHalf } from './courts';
import type { DeckPalette } from './palette';
import { type Ctx, drawPip, pipLayout } from './pips';

/**
 * Prints a card face: the card stock, the corner indices, then the pips, the ace's medallion
 * or a court panel. Everything scales from the card's width and height.
 */

export const CARD_ASPECT = 1.4;
/** The corner radius as a fraction of the card's width. */
export const CORNER = 0.07;

export const DEFAULT_INDEX_FONT =
  '"Fraunces Variable", "Fraunces", Georgia, "Times New Roman", serif';

export interface FaceOptions {
  palette: DeckPalette;
  /** A CSS font family for the indices; the deck is designed around a sturdy old-style serif. */
  indexFont?: string;
}

export function roundedRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/** The blank card: stock with a gentle fall of light and a fine cut edge. */
export function drawCardStock(ctx: Ctx, width: number, height: number, palette: DeckPalette): void {
  const r = width * CORNER;
  roundedRect(ctx, 0.5, 0.5, width - 1, height - 1, r);
  const shade = ctx.createLinearGradient(0, 0, width * 0.4, height);
  shade.addColorStop(0, palette.face);
  shade.addColorStop(1, palette.faceShade);
  ctx.fillStyle = shade;
  ctx.fill();
  ctx.strokeStyle = palette.edge;
  ctx.lineWidth = Math.max(1, width * 0.008);
  ctx.stroke();
}

function drawIndex(
  ctx: Ctx,
  rank: string,
  suit: Suit,
  width: number,
  height: number,
  colour: string,
  font: string,
): void {
  const size = height * 0.15;
  const cx = width * 0.115;
  ctx.save();
  ctx.font = `700 ${size}px ${font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = colour;
  const measured = ctx.measureText(rank).width;
  const maxWidth = width * 0.17;
  const squeeze = measured > maxWidth ? maxWidth / measured : 1;
  ctx.translate(cx, height * 0.155);
  ctx.scale(squeeze, 1);
  ctx.fillText(rank, 0, 0);
  ctx.restore();
  drawPip(ctx, suit, cx, height * 0.215, height * 0.085, colour);
}

function drawIndices(
  ctx: Ctx,
  card: CardId,
  width: number,
  height: number,
  options: FaceOptions,
): void {
  const suit = suitOf(card);
  const colour = options.palette.suit[suit];
  const font = options.indexFont ?? DEFAULT_INDEX_FONT;
  const label = rankLabel(rankOf(card));
  drawIndex(ctx, label, suit, width, height, colour, font);
  ctx.save();
  ctx.translate(width, height);
  ctx.rotate(Math.PI);
  drawIndex(ctx, label, suit, width, height, colour, font);
  ctx.restore();
}

/** The ace: one large mark in a gilt sunburst medallion. */
function drawAce(ctx: Ctx, suit: Suit, width: number, height: number, palette: DeckPalette): void {
  const cx = width / 2;
  const cy = height / 2;
  const ring = width * 0.3;
  ctx.save();
  ctx.strokeStyle = palette.gold;
  for (let i = 0; i < 32; i++) {
    const a = (Math.PI * 2 * i) / 32;
    const inner = ring * 1.08;
    const outer = ring * (i % 2 === 0 ? 1.42 : 1.24);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
    ctx.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer);
    ctx.lineWidth = width * (i % 2 === 0 ? 0.008 : 0.005);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, ring, 0, Math.PI * 2);
  ctx.fillStyle = palette.cream;
  ctx.fill();
  ctx.lineWidth = width * 0.012;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, ring * 0.9, 0, Math.PI * 2);
  ctx.lineWidth = width * 0.005;
  ctx.stroke();
  ctx.restore();
  drawPip(ctx, suit, cx, cy, width * 0.4, palette.suit[suit]);
}

function drawPips(
  ctx: Ctx,
  card: CardId,
  width: number,
  height: number,
  palette: DeckPalette,
): void {
  const suit = suitOf(card);
  const size = width * 0.19;
  for (const place of pipLayout(rankOf(card)))
    drawPip(ctx, suit, place.x * width, place.y * height, size, palette.suit[suit], place.flipped);
}

const COURT_RANKS: Record<number, CourtRank> = { [JACK]: 'jack', [QUEEN]: 'queen', [KING]: 'king' };

/** The court panel: two half figures, head to foot, inside a gilt frame. */
function drawCourt(
  ctx: Ctx,
  card: CardId,
  width: number,
  height: number,
  palette: DeckPalette,
): void {
  const spec = courtSpec(COURT_RANKS[rankOf(card)]!, suitOf(card));
  const x = width * 0.205;
  const y = height * 0.068;
  const w = width * 0.59;
  const h = height * 0.864;
  ctx.save();
  ctx.fillStyle = palette.panel;
  ctx.fillRect(x, y, w, h);
  const half = { x, y, width: w, height: h / 2 };
  drawCourtHalf(ctx, spec, palette, half);
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(Math.PI);
  ctx.translate(-(x + w / 2), -(y + h / 2));
  drawCourtHalf(ctx, spec, palette, half);
  ctx.restore();
  // The sash where the two halves meet, and the frame.
  ctx.save();
  ctx.strokeStyle = palette.gold;
  ctx.lineWidth = Math.max(1, width * 0.012);
  ctx.beginPath();
  ctx.moveTo(x, y + h / 2);
  ctx.lineTo(x + w, y + h / 2);
  ctx.stroke();
  drawPip(ctx, 'diamonds', x + w / 2, y + h / 2, width * 0.05, palette.gold);
  ctx.strokeStyle = palette.ink;
  ctx.lineWidth = Math.max(1, width * 0.008);
  ctx.strokeRect(x, y, w, h);
  ctx.strokeStyle = palette.gold;
  ctx.lineWidth = Math.max(0.75, width * 0.005);
  const inset = width * 0.014;
  ctx.strokeRect(x - inset, y - inset, w + inset * 2, h + inset * 2);
  ctx.restore();
}

/** Draws the whole face into (0, 0, width, height). */
export function drawCardFace(
  ctx: Ctx,
  card: CardId,
  width: number,
  height: number,
  options: FaceOptions,
): void {
  const { palette } = options;
  drawCardStock(ctx, width, height, palette);
  const rank = rankOf(card);
  if (rank === 1) drawAce(ctx, suitOf(card), width, height, palette);
  else if (rank >= JACK) drawCourt(ctx, card, width, height, palette);
  else drawPips(ctx, card, width, height, palette);
  drawIndices(ctx, card, width, height, options);
}
