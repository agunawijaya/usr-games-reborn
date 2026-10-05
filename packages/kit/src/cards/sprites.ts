import { type BackStyle, drawCardBack } from './backs';
import type { CardId } from './deck';
import { CORNER, DEFAULT_INDEX_FONT, drawCardFace, roundedRect } from './face';
import { type DeckLook, deckPalette, type DeckPalette } from './palette';

/**
 * Card images painted once and reused every frame. A table draws 52 cards many times a second;
 * painting a court figure each time would cost far more than copying a finished image. Faces
 * are painted the first time they are asked for, at the card's size times the device pixel
 * ratio, and painted again only when the size, look or options change.
 */

export interface SpriteOptions {
  /** Card size in CSS pixels. */
  width: number;
  height: number;
  /** Device pixel ratio. */
  scale: number;
  look: DeckLook;
  fourColour: boolean;
  back: BackStyle;
  indexFont?: string;
}

type Surface = HTMLCanvasElement | OffscreenCanvas;

function createSurface(width: number, height: number): Surface {
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  return new OffscreenCanvas(width, height);
}

function context(surface: Surface) {
  return surface.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
}

export class CardSprites {
  readonly options: SpriteOptions;
  readonly palette: DeckPalette;
  private readonly faces = new Map<CardId, Surface>();
  private backImage: Surface | null = null;
  private shadowImage: Surface | null = null;

  constructor(options: SpriteOptions) {
    this.options = options;
    this.palette = deckPalette(options.look, options.fourColour);
  }

  get width(): number {
    return this.options.width;
  }

  get height(): number {
    return this.options.height;
  }

  /** True when these sprites were painted for exactly these options. */
  matches(options: SpriteOptions): boolean {
    const a = this.options;
    return (
      a.width === options.width &&
      a.height === options.height &&
      a.scale === options.scale &&
      a.look === options.look &&
      a.fourColour === options.fourColour &&
      a.back === options.back &&
      a.indexFont === options.indexFont
    );
  }

  private paint(draw: (ctx: ReturnType<typeof context>, w: number, h: number) => void): Surface {
    const { width, height, scale } = this.options;
    const surface = createSurface(Math.ceil(width * scale), Math.ceil(height * scale));
    const ctx = context(surface);
    ctx.scale(scale, scale);
    draw(ctx, width, height);
    return surface;
  }

  face(card: CardId): Surface {
    let image = this.faces.get(card);
    if (!image) {
      image = this.paint((ctx, w, h) =>
        drawCardFace(ctx, card, w, h, {
          palette: this.palette,
          indexFont: this.options.indexFont ?? DEFAULT_INDEX_FONT,
        }),
      );
      this.faces.set(card, image);
    }
    return image;
  }

  back(): Surface {
    this.backImage ??= this.paint((ctx, w, h) =>
      drawCardBack(ctx, w, h, this.options.back, this.palette),
    );
    return this.backImage;
  }

  /**
   * A soft shadow the card's shape, painted with a margin for the blur. Draw it at
   * `shadowMargin()` outside the card, offset and faded by how high the card is lifted.
   */
  shadow(): Surface {
    if (!this.shadowImage) {
      const { width, height, scale } = this.options;
      const margin = this.shadowMargin();
      const surface = createSurface(
        Math.ceil((width + margin * 2) * scale),
        Math.ceil((height + margin * 2) * scale),
      );
      const ctx = context(surface);
      ctx.scale(scale, scale);
      ctx.filter = `blur(${margin * 0.42}px)`;
      roundedRect(ctx, margin, margin, width, height, width * CORNER);
      ctx.fillStyle = 'rgba(0, 0, 0, 1)';
      ctx.fill();
      this.shadowImage = surface;
    }
    return this.shadowImage;
  }

  shadowMargin(): number {
    return Math.round(this.options.width * 0.22);
  }

  /** Paints every face now, for example while a deal is being shuffled. */
  warmUp(cards: Iterable<CardId>): void {
    for (const card of cards) this.face(card);
    this.back();
    this.shadow();
  }
}

export function sizeForHeight(height: number): { width: number; height: number } {
  return { width: Math.round(height / 1.4), height: Math.round(height) };
}
