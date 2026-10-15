/** Small canvas helpers shared by the card, car and road painters. */

export type Ctx = CanvasRenderingContext2D;

export const DISPLAY_FONT =
  '"Bricolage Grotesque Variable", "Atkinson Hyperlegible Next", system-ui, sans-serif';
export const BODY_FONT = '"Atkinson Hyperlegible Next", system-ui, sans-serif';
export const MONO_FONT = '"IBM Plex Mono", ui-monospace, monospace';

export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function circle(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
}

export function poly(ctx: Ctx, points: readonly number[]): void {
  ctx.beginPath();
  ctx.moveTo(points[0]!, points[1]!);
  for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i]!, points[i + 1]!);
  ctx.closePath();
}

export function fillWith(ctx: Ctx, colour: string): void {
  ctx.fillStyle = colour;
  ctx.fill();
}

export function strokeWith(ctx: Ctx, colour: string, width: number): void {
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.stroke();
}

/** Draws with a soft halo when `glow` is set: lamps, signals and neon at night. */
export function glowing(
  ctx: Ctx,
  glow: boolean,
  colour: string,
  blur: number,
  draw: () => void,
): void {
  if (!glow) {
    draw();
    return;
  }
  ctx.save();
  ctx.shadowColor = colour;
  ctx.shadowBlur = blur;
  draw();
  ctx.restore();
}

/** A deterministic pseudo-random sequence for scenery that must look the same every frame. */
export function seeded(seed: number): () => number {
  let x = (seed >>> 0) * 2654435761 + 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return ((x >>> 0) % 100000) / 100000;
  };
}

/** A stable value in [0, 1) for an integer position: scenery that repeats as the road scrolls. */
export function hash01(n: number, salt = 0): number {
  let x = Math.imul(n ^ (salt * 0x9e3779b1), 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

export function mix(a: string, b: string, t: number): string {
  const pa = parse(a);
  const pb = parse(b);
  const c = pa.map((v, i) => Math.round(v + (pb[i]! - v) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

export function alpha(colour: string, a: number): string {
  const [r, g, b] = parse(colour);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function parse(colour: string): [number, number, number] {
  if (colour.startsWith('#')) {
    const hex = colour.slice(1);
    const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex.slice(0, 6);
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
  }
  const m = colour.match(/[\d.]+/g) ?? ['0', '0', '0'];
  return [Number(m[0]), Number(m[1]), Number(m[2])];
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function easeOutCubic(t: number): number {
  return 1 - (1 - clamp(t, 0, 1)) ** 3;
}

export function easeInOut(t: number): number {
  const x = clamp(t, 0, 1);
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

/** Fits a line of text to a width by shrinking the font, returning the size used. */
export function fitText(
  ctx: Ctx,
  text: string,
  maxWidth: number,
  size: number,
  font: string,
  weight: number,
): number {
  let px = size;
  for (; px > 6; px -= 0.5) {
    ctx.font = `${weight} ${px}px ${font}`;
    if (ctx.measureText(text).width <= maxWidth) break;
  }
  return px;
}
