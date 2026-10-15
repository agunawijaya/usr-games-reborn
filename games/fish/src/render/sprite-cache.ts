import { withAlpha } from './fish/draw';

/**
 * Small offscreen images painted once and copied every frame: firefly glows, the koi's swim
 * cycle, lily pads, the bucket and its fish. Copying a finished image costs a fraction of
 * filling gradients and tracing fish outlines sixty times a second.
 */

export type Sprite = HTMLCanvasElement;

const cache = new Map<string, Sprite>();
const MAX_SPRITES = 400;

/**
 * The sprite for `key`, painted by `paint` on first use into a `width` × `height` image (in CSS
 * pixels, times `scale` for sharpness). `paint` draws with its origin at the sprite's centre.
 */
export function sprite(
  key: string,
  width: number,
  height: number,
  scale: number,
  paint: (ctx: CanvasRenderingContext2D) => void,
): Sprite {
  const full = `${key}|${Math.round(width)}x${Math.round(height)}@${scale}`;
  let image = cache.get(full);
  if (image) return image;
  if (cache.size >= MAX_SPRITES) cache.clear();
  image = document.createElement('canvas');
  image.width = Math.max(1, Math.ceil(width * scale));
  image.height = Math.max(1, Math.ceil(height * scale));
  const ctx = image.getContext('2d')!;
  ctx.scale(scale, scale);
  ctx.translate(width / 2, height / 2);
  paint(ctx);
  cache.set(full, image);
  return image;
}

/** Copies a sprite centred on (x, y), turned and optionally mirrored left to right. */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  image: Sprite,
  x: number,
  y: number,
  width: number,
  height: number,
  angle = 0,
  flip = false,
): void {
  if (angle === 0 && !flip) {
    ctx.drawImage(image, x - width / 2, y - height / 2, width, height);
    return;
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(image, -width / 2, -height / 2, width, height);
  ctx.restore();
}

/** A soft round glow of one colour, for fireflies and the koi's light. */
export function glowSprite(colour: string, scale: number): Sprite {
  return sprite(`glow:${colour}`, 64, 64, scale, (ctx) => {
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 32);
    glow.addColorStop(0, colour);
    // Fading to the same colour, clear, so the edge never darkens.
    glow.addColorStop(1, withAlpha(colour, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(-32, -32, 64, 64);
  });
}
