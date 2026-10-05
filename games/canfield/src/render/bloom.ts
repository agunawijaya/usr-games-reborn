import { ease } from '@usr-games/kit/cards';
import type { Suit } from '@usr-games/kit/cards';
import type { Look } from './look';

/**
 * Each foundation is a lotus of thirteen petals rising behind its card in an Art Deco fan. A
 * petal opens for every card that comes home, from the middle outwards; the petals still to
 * come stay inlaid in the table, so an empty foundation shows the bloom it can become. When the
 * thirteenth card lands the lotus blooms fully: a second, inner fan and a sunburst behind it.
 */

export const PETALS = 13;

export interface BloomState {
  suit: Suit | null;
  /** Cards home on this foundation. */
  count: number;
  /** When each petal began to open (seconds on the table's clock), in the order they opened. */
  openedAt: readonly number[];
  /** When the pile turned the corner from king to ace: the lotus flares once. */
  wrappedAt: number | null;
  /** When it filled. */
  fullAt: number | null;
}

const OPEN_SECONDS = 0.55;
const FULL_SECONDS = 1.1;
const WRAP_SECONDS = 0.9;
/** The fan spreads a little past a half circle, its outer petals dipping below level. */
const SPREAD = (200 * Math.PI) / 180;

type Ctx2D = CanvasRenderingContext2D;

/** Petal slots fill from the middle of the fan outwards: 6, 5, 7, 4, 8, … */
export function slotOfPetal(order: number): number {
  const middle = (PETALS - 1) / 2;
  if (order === 0) return middle;
  const step = Math.ceil(order / 2);
  return order % 2 === 1 ? middle - step : middle + step;
}

function slotAngle(slot: number): number {
  return -Math.PI / 2 - SPREAD / 2 + (SPREAD * slot) / (PETALS - 1);
}

/** A lotus petal from the pivot along +x: broad near its base, drawn to a point. */
function petalPath(ctx: Ctx2D, length: number, half: number, base: number): void {
  ctx.beginPath();
  ctx.moveTo(base, 0);
  ctx.bezierCurveTo(
    base + length * 0.18,
    -half * 1.15,
    base + length * 0.72,
    -half * 0.95,
    base + length,
    0,
  );
  ctx.bezierCurveTo(base + length * 0.72, half * 0.95, base + length * 0.18, half * 1.15, base, 0);
  ctx.closePath();
}

interface Geometry {
  /** The fan's pivot: inside the card, a little below its top edge. */
  px: number;
  py: number;
  length: number;
  half: number;
  base: number;
}

function geometry(cx: number, cardTop: number, cardH: number): Geometry {
  return {
    px: cx,
    py: cardTop + cardH * 0.2,
    length: cardH * 0.58,
    half: cardH * 0.085,
    base: cardH * 0.04,
  };
}

/** How far the fan reaches above the card's top edge, as a fraction of the card's height. */
export const BLOOM_REACH = 0.58 + 0.04 - 0.2;

function drawSunburst(ctx: Ctx2D, g: Geometry, look: Look, t: number): void {
  ctx.save();
  ctx.globalAlpha = t;
  const glow = ctx.createRadialGradient(0, 0, g.length * 0.2, 0, 0, g.length * 1.25);
  glow.addColorStop(0, look.dark ? 'rgba(255, 214, 140, 0.75)' : 'rgba(255, 233, 160, 0.85)');
  glow.addColorStop(1, 'rgba(255, 220, 150, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, g.length * 1.25, Math.PI, Math.PI * 2);
  ctx.lineTo(g.length * 1.25, g.length * 0.2);
  ctx.lineTo(-g.length * 1.25, g.length * 0.2);
  ctx.fill();
  ctx.strokeStyle = look.petalEdge;
  ctx.lineWidth = 1.2;
  for (let i = 0; i <= 24; i++) {
    const a = -Math.PI / 2 - SPREAD / 2 + (SPREAD * i) / 24;
    const inner = g.length * 0.9;
    const outer = g.length * (i % 2 === 0 ? 1.22 : 1.1) * (0.85 + 0.15 * t);
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
    ctx.lineTo(Math.cos(a) * outer, Math.sin(a) * outer);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Draws one foundation's lotus for a card whose top-left corner is (x, y) and size `cardW` ×
 * `cardH`, at table time `time`. Call before drawing the foundation's cards.
 */
export function drawBloom(
  ctx: Ctx2D,
  x: number,
  y: number,
  cardW: number,
  cardH: number,
  bloom: BloomState,
  look: Look,
  time: number,
  motion: boolean,
): void {
  const g = geometry(x + cardW / 2, y, cardH);
  const fullAge = bloom.fullAt === null ? -1 : time - bloom.fullAt;
  const full = bloom.fullAt !== null && fullAge >= 0;
  const fullT = full ? (motion ? ease.outCubic(Math.min(1, fullAge / FULL_SECONDS)) : 1) : 0;
  const wrapAge = bloom.wrappedAt === null ? Infinity : time - bloom.wrappedAt;
  const flare = motion && wrapAge < WRAP_SECONDS ? Math.sin((Math.PI * wrapAge) / WRAP_SECONDS) : 0;
  const colours = bloom.suit ? look.petals[bloom.suit] : null;

  ctx.save();
  ctx.translate(g.px, g.py);
  if (full) drawSunburst(ctx, g, look, fullT);

  // Which slots are open, and how far: petals open from the middle out.
  const progress = new Array<number>(PETALS).fill(0);
  for (let order = 0; order < Math.min(bloom.count, PETALS); order++) {
    const age = time - (bloom.openedAt[order] ?? -Infinity);
    progress[slotOfPetal(order)] = motion ? Math.min(1, Math.max(0, age / OPEN_SECONDS)) : 1;
  }

  // From the outside in, so the middle petal lies on top.
  const drawOrder = Array.from({ length: PETALS }, (_, i) => i).sort(
    (a, b) => Math.abs(b - (PETALS - 1) / 2) - Math.abs(a - (PETALS - 1) / 2),
  );
  for (const slot of drawOrder) {
    const angle = slotAngle(slot);
    const t = progress[slot]!;
    // Outer petals a little shorter, as a lotus's are.
    const reach = 1 - Math.abs(slot - (PETALS - 1) / 2) * 0.025;
    ctx.save();
    ctx.rotate(angle);
    if (t < 1) {
      petalPath(ctx, g.length * reach, g.half, g.base);
      ctx.strokeStyle = look.inlay;
      ctx.lineWidth = 1.3;
      ctx.stroke();
    }
    if (t > 0 && colours) {
      const grow = ease.outBack(t);
      const length = g.length * reach * (0.55 + 0.45 * grow) * (1 + 0.05 * fullT + 0.04 * flare);
      ctx.globalAlpha = Math.min(1, t * 2.5);
      petalPath(ctx, length, g.half * (0.7 + 0.3 * grow), g.base);
      const fill = ctx.createLinearGradient(g.base, 0, g.base + length, 0);
      fill.addColorStop(0, colours.deep);
      fill.addColorStop(0.62, colours.fill);
      fill.addColorStop(1, look.dark ? '#fff2dc' : '#fffaf0');
      ctx.fillStyle = fill;
      if (look.dark) {
        ctx.shadowColor = colours.fill;
        ctx.shadowBlur = cardH * (0.05 + 0.05 * flare);
      }
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = look.petalEdge;
      ctx.lineWidth = Math.max(1, cardH * 0.0065);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(g.base + length * 0.3, 0);
      ctx.lineTo(g.base + length * 0.88, 0);
      ctx.strokeStyle = look.petalEdge;
      ctx.lineWidth = Math.max(0.7, cardH * 0.0035);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  if (full && colours) {
    // The inner fan: thirteen pale petals between the first.
    for (let slot = 0; slot < PETALS - 1; slot++) {
      ctx.save();
      ctx.rotate(slotAngle(slot + 0.5));
      ctx.globalAlpha = fullT;
      const length = g.length * 0.66 * fullT;
      petalPath(ctx, length, g.half * 0.75, g.base);
      ctx.fillStyle = look.dark ? '#fff0cc' : '#fffaf0';
      ctx.fill();
      ctx.strokeStyle = look.petalEdge;
      ctx.lineWidth = Math.max(1, cardH * 0.005);
      ctx.stroke();
      ctx.restore();
    }
  }
  ctx.restore();
}

/** A lotus that keeps moving: still opening, flaring or blooming at this time. */
export function isBloomAnimating(bloom: BloomState, time: number): boolean {
  const last = bloom.openedAt[Math.min(bloom.count, PETALS) - 1];
  return (
    (last !== undefined && time - last < OPEN_SECONDS) ||
    (bloom.wrappedAt !== null && time - bloom.wrappedAt < WRAP_SECONDS) ||
    (bloom.fullAt !== null && time - bloom.fullAt < FULL_SECONDS)
  );
}
