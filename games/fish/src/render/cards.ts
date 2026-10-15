import {
  type CardId,
  CardSprites,
  flip,
  type Rank,
  rankOf,
  sizeForHeight,
} from '@usr-games/kit/cards';
import { drawPad } from './flora';
import type { PondLayout } from './layout';
import type { Look } from './look';

/**
 * The cards on the pond: your hand fanned on the near bank, grouped by rank; the face-down pile
 * on its great lily pad; and any card in flight (cast, reeled, handed over, gathered into a
 * book). Faces and backs come from the kit's deck, painted once per size and look and copied
 * every frame.
 */

type Ctx = CanvasRenderingContext2D;

export class CardPainter {
  private sprites: CardSprites | null = null;

  /** Sprites for this layout and look, painted again only when either changes. */
  prepare(layout: PondLayout, look: Look, dpr: number): CardSprites {
    const { width, height } = sizeForHeight(layout.hand.cardHeight);
    const options = {
      width,
      height,
      scale: Math.min(2, dpr),
      look: look.deck,
      fourColour: false,
      back: look.back,
    };
    if (!this.sprites?.matches(options)) this.sprites = new CardSprites(options);
    return this.sprites;
  }

  get current(): CardSprites {
    if (!this.sprites) throw new Error('call prepare first');
    return this.sprites;
  }
}

export interface CardPose {
  x: number;
  y: number;
  angle: number;
  /** 1 is the hand's size. */
  scale?: number;
  /** 0 back up … 1 face up; between them the card is turning over. */
  turn?: number;
  /** How high above the table, for its shadow: 0 resting, 1 well up. */
  lift?: number;
  /** Fresh from the water: darker, with a sheen and drips. */
  wet?: number;
  alpha?: number;
  /** A glow round the edge: the selected rank, a lucky catch. */
  glow?: string;
}

export function drawCardAt(
  ctx: Ctx,
  sprites: CardSprites,
  card: CardId | null,
  pose: CardPose,
): void {
  const scale = pose.scale ?? 1;
  const w = sprites.width * scale;
  const h = sprites.height * scale;
  const turned = flip(pose.turn ?? 1);
  ctx.save();
  ctx.globalAlpha *= pose.alpha ?? 1;
  ctx.translate(pose.x, pose.y);
  ctx.rotate(pose.angle);
  const lift = pose.lift ?? 0;
  if (lift > 0) {
    const margin = sprites.shadowMargin() * scale;
    ctx.save();
    ctx.globalAlpha *= 0.28 * (1 - lift * 0.4);
    ctx.drawImage(
      sprites.shadow(),
      -w / 2 - margin + lift * 10 * scale,
      -h / 2 - margin + lift * 16 * scale,
      w + margin * 2,
      h + margin * 2,
    );
    ctx.restore();
  }
  ctx.scale(turned.scaleX, 1);
  if (pose.glow) {
    ctx.shadowColor = pose.glow;
    ctx.shadowBlur = 22 * scale;
  }
  const image = card !== null && turned.faceUp ? sprites.face(card) : sprites.back();
  ctx.drawImage(image, -w / 2, -h / 2, w, h);
  ctx.shadowBlur = 0;
  if (pose.wet) {
    ctx.globalAlpha *= pose.wet;
    const sheen = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
    sheen.addColorStop(0, 'rgba(40, 90, 110, 0.32)');
    sheen.addColorStop(0.45, 'rgba(255, 255, 255, 0.35)');
    sheen.addColorStop(0.55, 'rgba(40, 90, 110, 0.2)');
    sheen.addColorStop(1, 'rgba(20, 60, 80, 0.35)');
    ctx.fillStyle = sheen;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, w * 0.07);
    ctx.fill();
  }
  ctx.restore();
}

export interface HandSlot {
  card: CardId;
  x: number;
  y: number;
  angle: number;
}

/**
 * Where each card of the hand sits: a gentle fan, grouped by rank with a little gap between
 * groups so the ranks read at a glance, squeezed to fit as the hand grows.
 */
export function handSlots(layout: PondLayout, hand: readonly CardId[], lifted?: Rank): HandSlot[] {
  const sorted = [...hand].sort((a, b) => rankOf(a) - rankOf(b) || a - b);
  const n = sorted.length;
  if (n === 0) return [];
  const { width: cardW, height: cardH } = sizeForHeight(layout.hand.cardHeight);
  const groups = new Set(sorted.map(rankOf)).size;
  const groupGap = 14 * layout.s;
  const room = layout.hand.maxWidth - cardW - (groups - 1) * groupGap;
  const step = n > 1 ? Math.min(cardW * 0.62, room / (n - 1)) : 0;
  const total = step * (n - 1) + (groups - 1) * groupGap;
  let x = layout.hand.cx - total / 2;
  const middle = (n - 1) / 2;
  return sorted.map((card, i) => {
    if (i > 0 && rankOf(sorted[i - 1]!) !== rankOf(card)) x += groupGap;
    const offset = (i - middle) / Math.max(1, middle);
    const raise = lifted === rankOf(card) ? 26 * layout.s : 0;
    const slot = {
      card,
      x,
      y: layout.hand.baseline - cardH / 2 + offset * offset * 14 * layout.s - raise,
      angle: offset * 0.07,
    };
    x += step;
    return slot;
  });
}

export function drawHand(
  ctx: Ctx,
  sprites: CardSprites,
  layout: PondLayout,
  hand: readonly CardId[],
  options: { lifted?: Rank; look: Look; hidden?: ReadonlySet<CardId> },
): void {
  for (const slot of handSlots(layout, hand, options.lifted)) {
    if (options.hidden?.has(slot.card)) continue;
    const lifted = options.lifted === rankOf(slot.card);
    drawCardAt(ctx, sprites, slot.card, {
      x: slot.x,
      y: slot.y,
      angle: slot.angle,
      lift: lifted ? 0.6 : 0.15,
      glow: lifted
        ? options.look.dark
          ? 'rgba(255, 214, 102, 0.9)'
          : 'rgba(255, 255, 255, 0.95)'
        : undefined,
    });
  }
}

/** The pond's face-down pile on its great lily pad, as thick as the cards left in it. */
export function drawPile(
  ctx: Ctx,
  sprites: CardSprites,
  layout: PondLayout,
  count: number,
  look: Look,
  time: number,
): void {
  const { pile, s } = layout;
  const bob = Math.sin(time * 0.7) * 1.6 * s;
  drawPad(ctx, pile.x, pile.y + 30 * s + bob, 158 * s, 0.4 + Math.sin(time * 0.25) * 0.02, look);
  const layers = Math.ceil(count / 2);
  const scale = 0.96;
  for (let i = 0; i < layers; i++) {
    // Each layer a hair higher and a touch askew, as a stack left on a leaf would be.
    const jitter = Math.sin(i * 12.9898) * 0.05;
    drawCardAt(ctx, sprites, null, {
      x: pile.x + Math.sin(i * 7.1) * 2 * s,
      y: pile.y + bob + 22 * s - i * 1.25 * s,
      angle: Math.PI / 2 + jitter,
      scale,
      lift: i === 0 ? 0.25 : 0,
    });
  }
}

/** Water dripping from a card just pulled out of the pond: a pure function of time. */
export function drawDrips(
  ctx: Ctx,
  x: number,
  y: number,
  width: number,
  time: number,
  look: Look,
  s: number,
): void {
  ctx.fillStyle = look.spray;
  for (let i = 0; i < 9; i++) {
    const cycle = (time * 1.6 + i * 0.37) % 1;
    const dx = Math.sin(i * 4.3) * 0.5 * width;
    const dy = cycle * cycle * 90 * s;
    ctx.globalAlpha = (1 - cycle) * 0.9;
    ctx.beginPath();
    ctx.ellipse(x + dx, y + dy, 2.2 * s, 3.4 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
