import type { Kind } from '../engine/cards';
import { drawCardBack, drawCardFace } from './card-art';
import type { Look } from './look';

/**
 * Card images painted once per size and look, then copied every frame: a card face has dozens
 * of paths, far too many to redraw for every card on the table sixty times a second.
 */
export class CardSprites {
  private readonly cache = new Map<string, HTMLCanvasElement>();

  constructor(
    private look: Look,
    private dpr: number,
  ) {}

  setLook(look: Look, dpr: number): void {
    if (look === this.look && dpr === this.dpr) return;
    this.look = look;
    this.dpr = dpr;
    this.cache.clear();
  }

  face(kind: Kind, w: number, h: number, compact = false): HTMLCanvasElement {
    return this.paint(`${kind}:${Math.round(w)}:${compact ? 'c' : 'f'}`, w, h, (ctx) =>
      drawCardFace(ctx, kind, w, h, this.look.card, { compact }),
    );
  }

  back(w: number, h: number): HTMLCanvasElement {
    return this.paint(`back:${Math.round(w)}`, w, h, (ctx) =>
      drawCardBack(ctx, w, h, this.look.card),
    );
  }

  private paint(
    key: string,
    w: number,
    h: number,
    draw: (ctx: CanvasRenderingContext2D) => void,
  ): HTMLCanvasElement {
    const hit = this.cache.get(key);
    if (hit) return hit;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(w * this.dpr);
    canvas.height = Math.ceil(h * this.dpr);
    const ctx = canvas.getContext('2d')!;
    ctx.scale(this.dpr, this.dpr);
    draw(ctx);
    this.cache.set(key, canvas);
    return canvas;
  }
}
