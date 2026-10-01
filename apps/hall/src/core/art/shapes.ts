import { createRng, hexToOklch, oklchToHex, type Rng } from '@usr-games/kit';

/**
 * Small drawing helpers shared by every poster: layout, colour, gradients and seeded scatter.
 * All drawing happens in CSS pixels; the canvas transform already carries the pixel ratio.
 */

export const TAU = Math.PI * 2;

export type ColorStop = readonly [offset: number, color: string];

/** Where a poster puts its subject for the shape it is drawn at. */
export interface Composition {
  width: number;
  height: number;
  /** Taller than wide: a Holo card. The subject then sits centred. */
  portrait: boolean;
  /** The shorter side, the unit most sizes scale from. */
  unit: number;
  /** Focus point: right of centre on wide art (the title sits bottom-left), centred on portrait. */
  focusX: number;
  focusY: number;
}

export function compose(width: number, height: number): Composition {
  const portrait = height > width * 1.02;
  return {
    width,
    height,
    portrait,
    unit: Math.min(width, height),
    focusX: portrait ? width * 0.5 : width * 0.64,
    focusY: portrait ? height * 0.46 : height * 0.5,
  };
}

/** The pixel ratio a context is drawing at, so offscreen layers match it. */
export function pixelRatio(context: CanvasRenderingContext2D): number {
  return Math.max(1, Math.min(3, Math.abs(context.getTransform().a) || 1));
}

export function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

export function linear(
  context: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  stops: readonly ColorStop[],
): CanvasGradient {
  const gradient = context.createLinearGradient(x0, y0, x1, y1);
  for (const [offset, color] of stops) gradient.addColorStop(offset, color);
  return gradient;
}

export function radial(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  inner: number,
  outer: number,
  stops: readonly ColorStop[],
): CanvasGradient {
  const gradient = context.createRadialGradient(x, y, inner, x, y, outer);
  for (const [offset, color] of stops) gradient.addColorStop(offset, color);
  return gradient;
}

/** A soft round light: a radial gradient fill, far cheaper than shadowBlur in an animation loop. */
export function glow(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  alpha = 1,
): void {
  if (radius <= 0 || alpha <= 0) return;
  context.save();
  context.globalAlpha = Math.min(1, alpha);
  context.fillStyle = radial(context, x, y, 0, radius, [
    [0, color],
    [0.35, withOpacity(color, 0.45)],
    [1, withOpacity(color, 0)],
  ]);
  context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  context.restore();
}

/** `#rrggbb` with an alpha, as rgba(). Accepts rgba() input and replaces its alpha. */
export function withOpacity(color: string, alpha: number): string {
  const a = Math.min(1, Math.max(0, alpha));
  if (color.startsWith('#')) {
    const hex =
      color.length === 4 ? [...color.slice(1)].map((c) => c + c).join('') : color.slice(1);
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  const match = /rgba?\(([^)]+)\)/.exec(color);
  if (!match) return color;
  const [r, g, b] = (match[1] as string).split(',').map((part) => part.trim());
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** A tone of a colour in OKLCH: same hue, chosen lightness, chroma scaled. */
export function tone(hex: string, lightness: number, chromaScale = 1, hueShift = 0): string {
  const color = hexToOklch(hex);
  return oklchToHex({
    l: lightness,
    c: color.c * chromaScale,
    h: (color.h + hueShift + 360) % 360,
  });
}

export interface Speck {
  x: number;
  y: number;
  size: number;
  phase: number;
  speed: number;
}

/** Points scattered in the unit square, the same for the same seed on every machine. */
export function scatter(seed: string, count: number): Speck[] {
  const rng = createRng(seed);
  return Array.from({ length: count }, () => ({
    x: rng.next(),
    y: rng.next(),
    size: rng.next(),
    phase: rng.float(0, TAU),
    speed: rng.float(0.5, 1.5),
  }));
}

export function seeded(seed: string): Rng {
  return createRng(seed);
}

/** Ease for loops that should breathe rather than tick. */
export function breathe(t: number, period: number, phase = 0): number {
  return 0.5 + 0.5 * Math.sin((t / period) * TAU + phase);
}

export function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

/** Darkens the edges so the subject holds the eye and overlaid titles stay legible. */
export function vignette(
  context: CanvasRenderingContext2D,
  composition: Composition,
  strength: number,
  color = '#000000',
): void {
  const { width, height } = composition;
  const radius = Math.hypot(width, height) * 0.62;
  context.fillStyle = radial(context, width * 0.55, height * 0.45, radius * 0.35, radius, [
    [0, withOpacity(color, 0)],
    [1, withOpacity(color, strength)],
  ]);
  context.fillRect(0, 0, width, height);
}

/** Draws a manifest emblem (a 48×48 stroked path) centred on (x, y) at the given size. */
export function strokeEmblem(
  context: CanvasRenderingContext2D,
  emblem: string,
  x: number,
  y: number,
  size: number,
  color: string,
  lineWidth = 3,
): void {
  const scale = size / 48;
  context.save();
  context.translate(x - size / 2, y - size / 2);
  context.scale(scale, scale);
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.lineWidth = lineWidth;
  context.strokeStyle = color;
  context.stroke(new Path2D(emblem));
  context.restore();
}
