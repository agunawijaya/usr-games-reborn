import { CardSprites, cardId, QUEEN, type Suit } from '@usr-games/kit/cards';
import { type BloomState, drawBloom } from './bloom';
import { drawCard } from './card-draw';
import type { Look } from './look';
import {
  type Decor,
  makeSky,
  paintObservatoryBase,
  paintObservatoryLight,
  paintObservatoryShade,
  paintStars,
  paintSunroomBase,
  paintSunroomLight,
  paintSunroomShade,
  type Sky,
} from './scenery';

/**
 * The key art, painted onto a single canvas: the room, the four queens fanned in a hand, and one
 * lotus opening behind them. The table's light and shade are laid over by hand here, as a lone
 * canvas has no CSS layers to blend. Used for the Hall's poster, the game menu and the demo.
 */

type Surface = HTMLCanvasElement | OffscreenCanvas;

function surface(width: number, height: number): Surface {
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    return canvas;
  }
  return new OffscreenCanvas(Math.max(1, Math.round(width)), Math.max(1, Math.round(height)));
}

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function context(canvas: Surface): Ctx2D {
  return canvas.getContext('2d') as Ctx2D;
}

const QUEENS: Suit[] = ['spades', 'hearts', 'clubs', 'diamonds'];

export interface PosterLayout {
  /** Centre of the fan of queens. */
  x: number;
  y: number;
  /** Card height in the fan. */
  cardH: number;
  /** Where the room puts its centrepiece; zero size for none. */
  decor: Decor;
}

export function posterLayout(width: number, height: number): PosterLayout {
  const cardH = Math.min(height * 0.44, width * 0.26);
  return {
    x: width * 0.5,
    y: height * 0.6,
    cardH,
    decor: { x: 0, y: 0, w: 0, h: 0 },
  };
}

export class PosterPainter {
  private size = '';
  private base: Surface | null = null;
  private shade: Surface | null = null;
  private light: Surface | null = null;
  private sprites: CardSprites | null = null;
  private readonly sky: Sky = makeSky();

  constructor(private look: Look) {}

  setLook(look: Look): void {
    this.look = look;
    this.size = '';
  }

  private prepare(width: number, height: number, scale: number, layout: PosterLayout): void {
    const key = `${width}x${height}@${scale}:${this.look.name}:${layout.cardH}:${layout.decor.w}`;
    if (key === this.size) return;
    this.size = key;
    const layer = (paint: (ctx: Ctx2D) => void) => {
      const canvas = surface(width * scale, height * scale);
      const ctx = context(canvas);
      ctx.scale(scale, scale);
      paint(ctx);
      return canvas;
    };
    const dark = this.look.dark;
    this.base = layer((ctx) =>
      dark
        ? paintObservatoryBase(ctx, width, height, layout.decor)
        : paintSunroomBase(ctx, width, height, layout.decor),
    );
    this.shade = layer((ctx) =>
      dark ? paintObservatoryShade(ctx, width, height) : paintSunroomShade(ctx, width, height),
    );
    this.light = layer((ctx) =>
      dark
        ? paintObservatoryLight(ctx, width, height, layout.decor)
        : paintSunroomLight(ctx, width, height),
    );
    const cardW = Math.round(layout.cardH / 1.4);
    this.sprites = new CardSprites({
      width: cardW,
      height: Math.round(layout.cardH),
      scale,
      look: this.look.deck,
      fourColour: false,
      back: this.look.back,
    });
  }

  /**
   * Paints one frame. `bloom` is how far the lotus has opened, 0–13 petals (fractions open the
   * next petal part way), and `time` turns the Observatory's sky.
   */
  paint(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    scale: number,
    options: { time: number; bloom: number; layout?: PosterLayout; motion?: boolean },
  ): void {
    const layout = options.layout ?? posterLayout(width, height);
    this.prepare(width, height, scale, layout);
    ctx.save();
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    if (this.look.dark) {
      const sky = ctx.createRadialGradient(
        width * 0.55,
        -height * 0.3,
        0,
        width * 0.55,
        -height * 0.3,
        height * 1.6,
      );
      sky.addColorStop(0, '#2a347f');
      sky.addColorStop(0.35, '#141b4c');
      sky.addColorStop(0.7, '#090c27');
      sky.addColorStop(1, '#05071a');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, height);
      paintStars(
        ctx,
        width,
        height,
        this.sky,
        layout.decor,
        options.time,
        options.motion ?? true,
        false,
      );
    }
    ctx.drawImage(this.base!, 0, 0, width, height);
    this.paintFan(ctx as CanvasRenderingContext2D, layout, options.bloom, options.time);
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(this.shade!, 0, 0, width, height);
    ctx.globalCompositeOperation = 'soft-light';
    ctx.drawImage(this.light!, 0, 0, width, height);
    ctx.restore();
  }

  private paintFan(
    ctx: CanvasRenderingContext2D,
    layout: PosterLayout,
    bloom: number,
    time: number,
  ): void {
    const sprites = this.sprites!;
    const w = sprites.width;
    const h = sprites.height;
    // The lotus rises behind the hand, its card hidden beneath the queens.
    const count = Math.max(0, Math.min(13, Math.ceil(bloom)));
    const opening = bloom - Math.floor(bloom);
    const state: BloomState = {
      suit: 'hearts',
      count,
      openedAt: Array.from({ length: count }, (_, i) =>
        i === count - 1 && opening > 0 ? time - opening * 0.55 : time - 10,
      ),
      wrappedAt: null,
      fullAt: bloom >= 13 ? time - 10 : null,
    };
    drawBloom(ctx, layout.x - w / 2, layout.y - h * 0.62, w, h, state, this.look, time, true);
    QUEENS.forEach((suit, i) => {
      const angle = (i - 1.5) * 0.3;
      // Each card turns about a point well below the hand, as cards held in a fan do.
      const reach = h * 1.4;
      const pivotY = layout.y + h * 1.15;
      const cx = layout.x + Math.sin(angle) * reach;
      const cy = pivotY - Math.cos(angle) * reach;
      const pose = { x: cx - w / 2, y: cy - h / 2, rotation: angle, lift: 0.15, faceUp: true };
      drawCard(ctx, sprites, cardId(suit, QUEEN), pose, this.look, 'cast');
    });
  }
}
