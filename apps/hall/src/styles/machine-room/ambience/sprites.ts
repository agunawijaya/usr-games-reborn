import { withAlpha } from '@usr-games/kit';

/**
 * Pre-rendered soft glows. Drawing a cached radial sprite is far cheaper than canvas
 * shadowBlur, which is what keeps dozens of blinking lights at a steady frame rate.
 */
const cache = new Map<string, HTMLCanvasElement>();

export function glowSprite(color: string, radius: number, core = 0.9): HTMLCanvasElement {
  const key = `${color}:${radius}:${core}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const size = Math.ceil(radius * 2);
  const sprite = document.createElement('canvas');
  sprite.width = size;
  sprite.height = size;
  const context = sprite.getContext('2d');
  if (context) {
    const gradient = context.createRadialGradient(radius, radius, 0, radius, radius, radius);
    gradient.addColorStop(0, withAlpha(color, core));
    gradient.addColorStop(0.25, withAlpha(color, core * 0.45));
    gradient.addColorStop(1, withAlpha(color, 0));
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  }
  cache.set(key, sprite);
  return sprite;
}

export function drawGlow(
  context: CanvasRenderingContext2D,
  color: string,
  x: number,
  y: number,
  radius: number,
  alpha = 1,
): void {
  if (alpha <= 0) return;
  const sprite = glowSprite(color, radius);
  context.globalAlpha = Math.min(1, alpha);
  context.drawImage(sprite, x - radius, y - radius);
  context.globalAlpha = 1;
}

/** A fine grain texture, drawn once per size, tiled by the scenes that want paper or glass. */
export function grainTexture(
  width: number,
  height: number,
  color: string,
  density: number,
  random: () => number,
): HTMLCanvasElement {
  const texture = document.createElement('canvas');
  texture.width = width;
  texture.height = height;
  const context = texture.getContext('2d');
  if (!context) return texture;
  const count = Math.round(width * height * density);
  for (let i = 0; i < count; i++) {
    const x = random() * width;
    const y = random() * height;
    const length = 1 + random() * 5;
    const angle = random() * Math.PI;
    context.strokeStyle = withAlpha(color, 0.02 + random() * 0.05);
    context.lineWidth = 0.6 + random() * 0.6;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    context.stroke();
  }
  return texture;
}
