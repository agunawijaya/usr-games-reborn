import { type CardId, type CardSprites, CORNER, roundedRect } from '@usr-games/kit/cards';
import type { Look } from './look';

/**
 * One card on the table, as a physical thing: it has a thickness, it casts a shadow that grows
 * softer and further as it is lifted, it leans, and while it turns over it narrows and catches
 * the light.
 */

export interface Pose {
  /** Top-left corner of the card at rest. */
  x: number;
  y: number;
  /** Radians about the card's centre. */
  rotation?: number;
  /** 0 lying on the table … 1 held well above it. */
  lift?: number;
  scale?: number;
  faceUp: boolean;
  /** Width during a turn, 0–1; 1 when not turning. */
  narrow?: number;
  /** Light across the card while it turns, 0–1. */
  sheen?: number;
  alpha?: number;
}

export type ShadowKind = 'none' | 'resting' | 'cast';

export function drawCard(
  ctx: CanvasRenderingContext2D,
  sprites: CardSprites,
  card: CardId,
  pose: Pose,
  look: Look,
  shadow: ShadowKind = 'resting',
): void {
  const w = sprites.width;
  const h = sprites.height;
  const lift = pose.lift ?? 0;
  const scale = (pose.scale ?? 1) * (1 + lift * 0.05);
  const narrow = pose.narrow ?? 1;
  const cx = pose.x + w / 2;
  const cy = pose.y + h / 2;
  const unit = h / 200;
  ctx.save();
  if (pose.alpha !== undefined) ctx.globalAlpha = pose.alpha;

  if (shadow !== 'none') {
    const margin = sprites.shadowMargin();
    const dx = (shadow === 'cast' ? 3 + lift * 16 : 1.5) * unit;
    const dy = (shadow === 'cast' ? 4 + lift * 26 : 2.2) * unit;
    const grow = 1 + lift * 0.08;
    ctx.save();
    ctx.globalAlpha *= shadow === 'cast' ? 0.5 - lift * 0.12 : 0.32;
    ctx.translate(cx + dx, cy + dy);
    ctx.rotate(pose.rotation ?? 0);
    ctx.scale(scale * narrow * grow, scale * grow);
    // A card lying flat casts a tight shadow: squeeze the soft one in.
    const soft = shadow === 'cast' ? 1 : 0.55;
    ctx.drawImage(
      sprites.shadow(),
      -w / 2 - margin * soft,
      -h / 2 - margin * soft,
      w + margin * 2 * soft,
      h + margin * 2 * soft,
    );
    ctx.restore();
  }

  ctx.translate(cx, cy);
  ctx.rotate(pose.rotation ?? 0);
  ctx.scale(scale * narrow, scale);
  // The card's edge, seen below it: its thickness.
  const thickness = Math.max(1, unit * 1.6);
  roundedRect(ctx, -w / 2, -h / 2 + thickness, w, h, w * CORNER);
  ctx.fillStyle = look.cardEdge;
  ctx.fill();
  ctx.drawImage(pose.faceUp ? sprites.face(card) : sprites.back(), -w / 2, -h / 2, w, h);
  if (pose.sheen) {
    roundedRect(ctx, -w / 2, -h / 2, w, h, w * CORNER);
    const light = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
    light.addColorStop(0, `rgba(255, 255, 255, ${(pose.sheen * 0.05).toFixed(3)})`);
    light.addColorStop(0.5, `rgba(255, 255, 255, ${(pose.sheen * 0.45).toFixed(3)})`);
    light.addColorStop(1, `rgba(255, 255, 255, ${(pose.sheen * 0.05).toFixed(3)})`);
    ctx.fillStyle = light;
    ctx.fill();
  }
  ctx.restore();
}

/**
 * A squared stack seen from above: the edges of the cards underneath, stepping down and to the
 * right, so its height says how many cards it holds.
 */
export function drawStackEdges(
  ctx: CanvasRenderingContext2D,
  sprites: CardSprites,
  x: number,
  y: number,
  count: number,
  look: Look,
): { x: number; y: number } {
  const w = sprites.width;
  const h = sprites.height;
  const step = Math.max(0.5, h * 0.0032);
  const layers = Math.min(count - 1, 34);
  for (let i = layers; i > 0; i--) {
    roundedRect(ctx, x + i * step * 0.45, y + i * step, w, h, w * CORNER);
    ctx.fillStyle = i % 2 === 0 ? look.cardEdge : shade(look.cardEdge);
    ctx.fill();
  }
  return { x, y };
}

function shade(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, ((n >> 16) & 255) - 18);
  const g = Math.max(0, ((n >> 8) & 255) - 18);
  const b = Math.max(0, (n & 255) - 18);
  return `rgb(${r}, ${g}, ${b})`;
}
