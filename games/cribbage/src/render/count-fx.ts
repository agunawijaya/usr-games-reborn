import type { CardId } from '@usr-games/kit/cards';
import type { ShowCombo } from '../engine/score';
import { CARD, cardWidth, type Point } from './layout';
import type { Look } from './look';

/**
 * The counting moment drawn over the laid-out hand. Each fifteen is a bridge of light over the
 * cards that make it, each on its own height so they never hide one another; the combination
 * being counted burns bright with a spark running along it while those already counted stay as
 * soft traces. Runs get a bar beneath their cards, a flush a sweep of light across its cards,
 * and his nobs a little burst at the jack's corner. Pairs pulse through the cards' own rings,
 * which the scene sets.
 */

type Ctx = CanvasRenderingContext2D;

export interface ShowFx {
  combos: ShowCombo[];
  /** Where each card of the hand and the starter sits. */
  positions: Map<CardId, Point>;
  /** Combos before this index are counted; the one at it is being counted, `progress` 0–1. */
  active: number;
  progress: number;
}

const HALF_HEIGHT = CARD.show / 2;
const HALF_WIDTH = cardWidth(CARD.show) / 2;

function glowColour(look: Look, combo: ShowCombo): string {
  return look.glow[combo.kind];
}

/** The order a fifteen's bridge is stacked in: its index among the fifteens. */
function fifteenLevel(combos: readonly ShowCombo[], index: number): number {
  let level = 0;
  for (let i = 0; i < index; i++) if (combos[i]!.kind === 'fifteen') level++;
  return level;
}

function bridgePath(ctx: Ctx, points: readonly Point[], rise: number): void {
  ctx.beginPath();
  ctx.moveTo(points[0]!.x, points[0]!.y);
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const span = Math.abs(b.x - a.x);
    const peak = Math.min(a.y, b.y) - rise - span * 0.05;
    ctx.bezierCurveTo(a.x, peak, b.x, peak, b.x, b.y);
  }
}

/** A point part-way along the bridge, for the spark that runs along the active one. */
function pointOnBridge(points: readonly Point[], rise: number, t: number): Point {
  const segments = points.length - 1;
  const scaled = Math.min(segments - 1e-6, Math.max(0, t * segments));
  const index = Math.floor(scaled);
  const u = scaled - index;
  const a = points[index]!;
  const b = points[index + 1]!;
  const span = Math.abs(b.x - a.x);
  const peak = Math.min(a.y, b.y) - rise - span * 0.05;
  const mt = 1 - u;
  return {
    x: mt * mt * mt * a.x + 3 * mt * mt * u * a.x + 3 * mt * u * u * b.x + u * u * u * b.x,
    y: mt * mt * mt * a.y + 3 * mt * mt * u * peak + 3 * mt * u * u * peak + u * u * u * b.y,
  };
}

function drawFifteen(
  ctx: Ctx,
  look: Look,
  combo: ShowCombo,
  positions: Map<CardId, Point>,
  level: number,
  strength: number,
  progress: number,
  time: number,
): void {
  const points = combo.cards
    .map((card) => positions.get(card))
    .filter((point): point is Point => point !== undefined)
    .sort((a, b) => a.x - b.x)
    .map((point) => ({ x: point.x, y: point.y - HALF_HEIGHT - 6 }));
  if (points.length < 2) return;
  const rise = 26 + level * 21;
  const colour = glowColour(look, combo);
  // The bridge draws itself across during the first part of its count.
  const reveal = Math.min(1, progress * 2.2);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  bridgePath(ctx, points, rise);
  ctx.setLineDash(reveal < 1 ? [2000 * reveal, 4000] : []);
  ctx.shadowColor = colour;
  ctx.shadowBlur = 22 * strength;
  ctx.strokeStyle = colour;
  ctx.globalAlpha = 0.25 + 0.75 * strength;
  ctx.lineWidth = 3 + 4 * strength;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = look.glow.core;
  ctx.globalAlpha = 0.25 + 0.7 * strength;
  ctx.lineWidth = 1.2 + 1.6 * strength;
  ctx.stroke();
  ctx.setLineDash([]);
  // A bead of light where the bridge touches each card.
  for (const point of points) {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 4 + 3 * strength, 0, Math.PI * 2);
    ctx.fillStyle = colour;
    ctx.globalAlpha = 0.4 + 0.6 * strength;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(point.x, point.y, 2 + strength, 0, Math.PI * 2);
    ctx.fillStyle = look.glow.core;
    ctx.fill();
  }
  if (strength > 0.6) {
    const spark = pointOnBridge(points, rise, (time * 0.7) % 1);
    const halo = ctx.createRadialGradient(spark.x, spark.y, 0, spark.x, spark.y, 16);
    halo.addColorStop(0, look.glow.core);
    halo.addColorStop(0.4, colour);
    halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.globalAlpha = strength;
    ctx.fillStyle = halo;
    ctx.fillRect(spark.x - 16, spark.y - 16, 32, 32);
    // "15" rides at the top of the bridge being counted.
    const top = pointOnBridge(points, rise, 0.5 / (points.length - 1));
    ctx.font = '700 22px "Fraunces Variable", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 5;
    ctx.strokeStyle = look.tableHalo;
    ctx.globalAlpha = Math.min(1, (progress - 0.25) * 4);
    ctx.strokeText('15', top.x, top.y - 14);
    ctx.fillStyle = look.tableInk;
    ctx.fillText('15', top.x, top.y - 14);
  }
  ctx.restore();
}

function drawRunBar(
  ctx: Ctx,
  look: Look,
  combo: ShowCombo,
  positions: Map<CardId, Point>,
  level: number,
  strength: number,
  progress: number,
): void {
  const xs = combo.cards
    .map((card) => positions.get(card)?.x)
    .filter((x): x is number => x !== undefined);
  if (xs.length === 0) return;
  const anyY = positions.get(combo.cards[0]!)!.y;
  const y = anyY + HALF_HEIGHT + 20 + level * 14;
  const left = Math.min(...xs) - HALF_WIDTH * 0.6;
  const right = Math.max(...xs) + HALF_WIDTH * 0.6;
  const reveal = Math.min(1, progress * 2);
  const colour = glowColour(look, combo);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.shadowColor = colour;
  ctx.shadowBlur = 18 * strength;
  ctx.strokeStyle = colour;
  ctx.globalAlpha = 0.3 + 0.7 * strength;
  ctx.lineWidth = 4 + 3 * strength;
  ctx.beginPath();
  ctx.moveTo(left, y);
  ctx.lineTo(left + (right - left) * reveal, y);
  ctx.stroke();
  for (const x of xs) {
    if (x > left + (right - left) * reveal) continue;
    ctx.beginPath();
    ctx.moveTo(x, y - 9);
    ctx.lineTo(x, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawFlushSweep(
  ctx: Ctx,
  look: Look,
  combo: ShowCombo,
  positions: Map<CardId, Point>,
  strength: number,
  progress: number,
): void {
  const band = -0.3 + progress * 1.6;
  ctx.save();
  for (const card of combo.cards) {
    const point = positions.get(card);
    if (!point) continue;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(point.x - HALF_WIDTH, point.y - HALF_HEIGHT, HALF_WIDTH * 2, HALF_HEIGHT * 2, 12);
    ctx.clip();
    const sweep = ctx.createLinearGradient(
      point.x - HALF_WIDTH,
      point.y - HALF_HEIGHT,
      point.x + HALF_WIDTH,
      point.y + HALF_HEIGHT,
    );
    const at = Math.max(0, Math.min(1, band));
    sweep.addColorStop(Math.max(0, at - 0.18), 'rgba(255, 255, 255, 0)');
    sweep.addColorStop(at, look.glow.flush);
    sweep.addColorStop(Math.min(1, at + 0.18), 'rgba(255, 255, 255, 0)');
    ctx.globalAlpha = 0.55 * strength;
    ctx.fillStyle = sweep;
    ctx.fillRect(point.x - HALF_WIDTH, point.y - HALF_HEIGHT, HALF_WIDTH * 2, HALF_HEIGHT * 2);
    ctx.restore();
  }
  ctx.restore();
}

function drawNobsSpark(
  ctx: Ctx,
  look: Look,
  combo: ShowCombo,
  positions: Map<CardId, Point>,
  strength: number,
  time: number,
): void {
  const point = positions.get(combo.cards[0]!);
  if (!point) return;
  const x = point.x - HALF_WIDTH + 18;
  const y = point.y - HALF_HEIGHT + 18;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(time * 1.4);
  ctx.globalAlpha = strength;
  ctx.shadowColor = look.glow.nobs;
  ctx.shadowBlur = 18;
  ctx.fillStyle = look.glow.core;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const r = i % 2 === 0 ? 20 : 6;
    const angle = (i / 8) * Math.PI * 2;
    ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = look.glow.nobs;
  ctx.beginPath();
  ctx.arc(0, 0, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Draws every counted combination as a trace and the active one in full. */
export function drawShowFx(ctx: Ctx, look: Look, fx: ShowFx, time: number): void {
  let runLevel = 0;
  fx.combos.forEach((combo, index) => {
    if (index > fx.active) return;
    const isActive = index === fx.active;
    const progress = isActive ? fx.progress : 1;
    const strength = isActive ? Math.min(1, 0.4 + progress * 1.4) : 0.28;
    switch (combo.kind) {
      case 'fifteen':
        drawFifteen(
          ctx,
          look,
          combo,
          fx.positions,
          fifteenLevel(fx.combos, index),
          strength,
          progress,
          time,
        );
        break;
      case 'run':
        drawRunBar(ctx, look, combo, fx.positions, runLevel++, strength, progress);
        break;
      case 'flush':
        if (isActive) drawFlushSweep(ctx, look, combo, fx.positions, strength, progress);
        break;
      case 'nobs':
        drawNobsSpark(ctx, look, combo, fx.positions, isActive ? 1 : 0.5, time);
        break;
      case 'pair':
        break;
    }
  });
}

/** How brightly a card's ring glows for the pair (or other combination) being counted. */
export function ringFor(
  look: Look,
  fx: ShowFx,
  card: CardId,
  time: number,
): { colour: string; strength: number } | undefined {
  const combo = fx.combos[fx.active];
  if (!combo || !combo.cards.includes(card)) return undefined;
  const pulse = combo.kind === 'pair' ? 0.65 + 0.35 * Math.sin(time * 7) : 0.55;
  return { colour: look.glow[combo.kind], strength: pulse * Math.min(1, fx.progress * 3) };
}
