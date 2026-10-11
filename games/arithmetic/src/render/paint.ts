/** Small drawing helpers both worlds share. */

export interface Layer {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly width: number;
  readonly height: number;
}

/** An offscreen canvas in CSS pixels, backed at `scale` device pixels per CSS pixel. */
export function createLayer(width: number, height: number, scale: number): Layer {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(width * scale));
  canvas.height = Math.max(1, Math.ceil(height * scale));
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  return { canvas, ctx, width, height };
}

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** A soft round glow: a radial gradient from `color` to transparent. */
export function glow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  alpha = 1,
) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, transparentOf(color));
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = gradient;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  ctx.restore();
}

/** A tiny deterministic random stream for scenery, so a redraw never reshuffles the crowd. */
export function scatter(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4_294_967_296;
  };
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function easeOutCubic(t: number): number {
  const u = 1 - clamp(t, 0, 1);
  return 1 - u * u * u;
}

export function easeInOut(t: number): number {
  const x = clamp(t, 0, 1);
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

/** `#rrggbb` with an alpha, for gradients built from palette colours. */
export function alpha(hex: string, a: number): string {
  if (!hex.startsWith('#') || hex.length !== 7) return hex;
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/**
 * The same colour at zero alpha. Gradients blend unpremultiplied, so fading to transparent
 * black would drag a grey fringe through every glow on a light background.
 */
export function transparentOf(color: string): string {
  const rgb = /^rgba?\(([^,]+),([^,]+),([^,)]+)/.exec(color);
  if (rgb) return `rgba(${rgb[1]},${rgb[2]},${rgb[3]},0)`;
  if (color.startsWith('hsla(')) return color.replace(/,\s*[^,)]+\)$/, ', 0)');
  if (color.startsWith('hsl(')) {
    return color.includes('/')
      ? color.replace(/\/\s*[^)]+\)$/, '/ 0)')
      : color.replace(/\)$/, ' / 0)');
  }
  if (color.startsWith('#')) return alpha(color, 0);
  return 'rgba(0,0,0,0)';
}
