import { type CardId, CardSprites, CORNER } from '@usr-games/kit/cards';
import { cardWidth } from './layout';
import type { Look } from './look';

/**
 * Cards on the table, from the kit's Art Deco deck. A set of sprites is kept for each card
 * height the table uses, painted at the real on-screen size so every card is crisp; drawing a
 * card is then one image copy plus its shadow. Gold faces for the perfect hand are painted
 * once, on demand.
 */

type Ctx = CanvasRenderingContext2D;

export interface CardDraw {
  card: CardId | 'back';
  x: number;
  y: number;
  height: number;
  angle?: number;
  /** 0 on the table, 1 held well above it: a bigger, softer, further shadow. */
  lift?: number;
  alpha?: number;
  /** A coloured light around the card's edge, 0–1. */
  ring?: { colour: string; strength: number };
  /** 0–1: how far the face has turned to gold. */
  gold?: number;
  /** Dims a card that cannot be played. */
  dim?: boolean;
  /** Squashes the card horizontally for a flip; 1 is flat, 0 edge-on. */
  flip?: number;
}

export class CardPainter {
  private sets = new Map<number, CardSprites>();
  private golden = new Map<string, HTMLCanvasElement>();
  private scale = 1;

  constructor(private look: Look) {}

  setLook(look: Look): void {
    if (look.id === this.look.id) return;
    this.look = look;
    this.sets.clear();
    this.golden.clear();
  }

  /** `scale` is device pixels per design unit. */
  setScale(scale: number): void {
    if (Math.abs(scale - this.scale) < 1e-3) return;
    this.scale = scale;
    this.sets.clear();
    this.golden.clear();
  }

  private sprites(height: number): CardSprites {
    let set = this.sets.get(height);
    if (!set) {
      set = new CardSprites({
        width: cardWidth(height),
        height,
        scale: this.scale,
        look: this.look.deck,
        fourColour: false,
        back: this.look.back,
      });
      this.sets.set(height, set);
    }
    return set;
  }

  warmUp(cards: Iterable<CardId>, heights: readonly number[]): void {
    for (const height of heights) this.sprites(height).warmUp(cards);
  }

  private goldFace(card: CardId, height: number): HTMLCanvasElement {
    const key = `${card}:${height}`;
    let image = this.golden.get(key);
    if (!image) {
      const set = this.sprites(height);
      const face = set.face(card);
      image = document.createElement('canvas');
      image.width = face.width;
      image.height = face.height;
      const ctx = image.getContext('2d')!;
      ctx.drawImage(face as CanvasImageSource, 0, 0);
      ctx.globalCompositeOperation = 'multiply';
      const gold = ctx.createLinearGradient(0, 0, image.width, image.height);
      gold.addColorStop(0, '#ffe08a');
      gold.addColorStop(0.5, '#f2b93b');
      gold.addColorStop(1, '#ffd772');
      ctx.fillStyle = gold;
      ctx.fillRect(0, 0, image.width, image.height);
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(face as CanvasImageSource, 0, 0);
      ctx.globalCompositeOperation = 'screen';
      const sheen = ctx.createLinearGradient(0, 0, image.width, image.height * 0.6);
      sheen.addColorStop(0, 'rgba(255, 250, 225, 0.55)');
      sheen.addColorStop(0.4, 'rgba(255, 250, 225, 0)');
      ctx.fillStyle = sheen;
      ctx.fillRect(0, 0, image.width, image.height);
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = '#b8860b';
      ctx.lineWidth = Math.max(2, image.width * 0.03);
      ctx.beginPath();
      ctx.roundRect(1, 1, image.width - 2, image.height - 2, image.width * CORNER);
      ctx.stroke();
      this.golden.set(key, image);
    }
    return image;
  }

  /** Draws one card centred on (x, y) in design units. */
  draw(ctx: Ctx, card: CardDraw): void {
    const set = this.sprites(card.height);
    const w = set.width;
    const h = set.height;
    const lift = card.lift ?? 0;
    const flip = card.flip ?? 1;
    ctx.save();
    ctx.translate(card.x, card.y);
    if (card.angle) ctx.rotate(card.angle);
    ctx.globalAlpha = card.alpha ?? 1;

    const shadow = this.look.castShadow;
    const margin = set.shadowMargin();
    ctx.save();
    ctx.globalAlpha *= shadow.alpha * (1 - lift * 0.35);
    const sx = shadow.dx * (0.18 + lift * 1.1);
    const sy = shadow.dy * (0.18 + lift * 1.1);
    const grow = 1 + lift * 0.06;
    ctx.drawImage(
      set.shadow() as CanvasImageSource,
      -w / 2 - margin + sx,
      -h / 2 - margin + sy,
      (w + margin * 2) * grow * Math.abs(flip),
      (h + margin * 2) * grow,
    );
    ctx.restore();

    if (card.ring && card.ring.strength > 0) {
      ctx.save();
      ctx.shadowColor = card.ring.colour;
      ctx.shadowBlur = 30 * card.ring.strength;
      ctx.strokeStyle = card.ring.colour;
      ctx.globalAlpha *= Math.min(1, card.ring.strength * 1.4);
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.roundRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6, w * CORNER + 3);
      ctx.stroke();
      ctx.restore();
    }

    ctx.scale(Math.max(0.001, Math.abs(flip)), 1);
    const image =
      card.card === 'back'
        ? set.back()
        : card.gold && card.gold > 0.999
          ? this.goldFace(card.card, card.height)
          : set.face(card.card);
    ctx.drawImage(image as CanvasImageSource, -w / 2, -h / 2, w, h);
    if (card.card !== 'back' && card.gold && card.gold > 0 && card.gold < 0.999) {
      ctx.globalAlpha *= card.gold;
      ctx.drawImage(this.goldFace(card.card, card.height), -w / 2, -h / 2, w, h);
    }
    if (card.dim) {
      ctx.globalAlpha = 0.42;
      ctx.fillStyle = this.look.dark ? '#0d0806' : '#5a3e26';
      ctx.beginPath();
      ctx.roundRect(-w / 2, -h / 2, w, h, w * CORNER);
      ctx.fill();
    }
    ctx.restore();
  }

  /** A squared-up stack of backs, a little of each card's edge showing. */
  drawStack(ctx: Ctx, x: number, y: number, height: number, cards: number): void {
    const layers = Math.max(1, Math.min(7, Math.ceil(cards / 6)));
    for (let i = 0; i < layers; i++) {
      this.draw(ctx, { card: 'back', x: x - i * 1.2, y: y - i * 1.6, height, lift: 0 });
    }
  }
}
