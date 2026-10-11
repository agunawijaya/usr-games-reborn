/**
 * Small drawing helpers shared by every painter: paths, gradients, soft shadows, glows and a
 * grain texture. Everything is drawn in code; nothing here loads an image.
 */
export type Ctx = CanvasRenderingContext2D;

export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function linear(
  ctx: Ctx,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  stops: ReadonlyArray<readonly [number, string]>,
): CanvasGradient {
  const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [at, color] of stops) gradient.addColorStop(at, color);
  return gradient;
}

export function radial(
  ctx: Ctx,
  x: number,
  y: number,
  r: number,
  stops: ReadonlyArray<readonly [number, string]>,
  innerRadius = 0,
): CanvasGradient {
  const gradient = ctx.createRadialGradient(x, y, innerRadius, x, y, r);
  for (const [at, color] of stops) gradient.addColorStop(at, color);
  return gradient;
}

/** A soft elliptical contact shadow under an object. */
export function contactShadow(
  ctx: Ctx,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  alpha: number,
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, ry / rx);
  ctx.fillStyle = radial(ctx, 0, 0, rx, [
    [0, `rgba(20, 10, 4, ${alpha})`],
    [0.55, `rgba(20, 10, 4, ${alpha * 0.55})`],
    [1, 'rgba(20, 10, 4, 0)'],
  ]);
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Additive light: a lamp, an indicator, a phosphor bloom. */
export function glow(ctx: Ctx, x: number, y: number, r: number, color: string, strength = 1) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.max(0, Math.min(1, strength));
  ctx.fillStyle = radial(ctx, x, y, r, [
    [0, color],
    [0.25, color],
    [1, 'rgba(0, 0, 0, 0)'],
  ]);
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

/** Mixes two `#rrggbb` colours; `t` = 0 gives `a`. */
export function mix(a: string, b: string, t: number): string {
  const pa = parse(a);
  const pb = parse(b);
  const c = pa.map((v, i) => Math.round(v + (pb[i]! - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

export function alpha(color: string, a: number): string {
  const [r, g, b] = parse(color);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function parse(hex: string): [number, number, number] {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** A small deterministic random stream for scattering details (grain, stars, windows). */
export function scatter(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const grainCache = new Map<string, CanvasPattern | null>();

/** A tiling speckle texture, made once per colour and strength. */
export function grain(ctx: Ctx, color: string, strength: number, size = 160): CanvasPattern | null {
  const key = `${color}:${strength}:${size}`;
  if (grainCache.has(key)) return grainCache.get(key)!;
  const tile = document.createElement('canvas');
  tile.width = size;
  tile.height = size;
  const g = tile.getContext('2d')!;
  const random = scatter(size * 7 + Math.round(strength * 1000));
  const [r, gr, b] = parse(color);
  for (let i = 0; i < size * size * 0.22; i++) {
    g.fillStyle = `rgba(${r}, ${gr}, ${b}, ${random() * strength})`;
    g.fillRect(Math.floor(random() * size), Math.floor(random() * size), 1, 1);
  }
  const pattern = ctx.createPattern(tile, 'repeat');
  grainCache.set(key, pattern);
  return pattern;
}

/** A screw or rivet head seen from above, with its slot. */
export function screw(
  ctx: Ctx,
  x: number,
  y: number,
  r: number,
  light: string,
  dark: string,
  angle = 0.6,
) {
  ctx.save();
  ctx.fillStyle = radial(ctx, x - r * 0.3, y - r * 0.35, r * 1.3, [
    [0, light],
    [1, dark],
  ]);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = alpha('#000000', 0.45);
  ctx.lineWidth = Math.max(0.6, r * 0.28);
  ctx.beginPath();
  ctx.moveTo(x - Math.cos(angle) * r * 0.75, y - Math.sin(angle) * r * 0.75);
  ctx.lineTo(x + Math.cos(angle) * r * 0.75, y + Math.sin(angle) * r * 0.75);
  ctx.stroke();
  ctx.restore();
}

/** Text with letter spacing, which the canvas only gained recently. */
export function spacedText(
  ctx: Ctx,
  text: string,
  x: number,
  y: number,
  spacing: number,
  align: 'left' | 'center' = 'center',
) {
  const widths = [...text].map((char) => ctx.measureText(char).width);
  const total = widths.reduce((sum, w) => sum + w, 0) + spacing * (text.length - 1);
  let cursor = align === 'center' ? x - total / 2 : x;
  const previous = ctx.textAlign;
  ctx.textAlign = 'left';
  [...text].forEach((char, i) => {
    ctx.fillText(char, cursor, y);
    cursor += widths[i]! + spacing;
  });
  ctx.textAlign = previous;
}

export const FONT_DISPLAY = "'Fraunces Variable', 'Fraunces', Georgia, serif";
export const FONT_MONO = "'IBM Plex Mono', ui-monospace, monospace";
export const FONT_BODY = "'Atkinson Hyperlegible Next', system-ui, sans-serif";
