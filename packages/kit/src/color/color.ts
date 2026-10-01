/**
 * Colour maths for contrast checks and for deriving theme-safe variants of a game's accent.
 *
 * Contrast follows WCAG 2.x relative luminance. Adjustments happen in OKLCH so a colour keeps
 * its hue and feel while only its lightness moves until it reads clearly.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Oklch {
  l: number;
  c: number;
  h: number;
}

export const AA_TEXT = 4.5;
export const AA_LARGE_TEXT = 3;
export const AA_UI = 3;

const HEX_PATTERN = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function parseHex(hex: string): Rgb {
  const match = HEX_PATTERN.exec(hex.trim());
  if (!match) throw new TypeError(`Not a hex colour: ${hex}`);
  let digits = match[1] as string;
  if (digits.length === 3) digits = [...digits].map((d) => d + d).join('');
  return {
    r: parseInt(digits.slice(0, 2), 16),
    g: parseInt(digits.slice(2, 4), 16),
    b: parseInt(digits.slice(4, 6), 16),
  };
}

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_PATTERN.test(value.trim());
}

export function toHex({ r, g, b }: Rgb): string {
  const channel = (v: number) =>
    Math.round(Math.min(255, Math.max(0, v)))
      .toString(16)
      .padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

function toLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function fromLinear(value: number): number {
  const v = Math.min(1, Math.max(0, value));
  return 255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);
}

export function relativeLuminance(color: string | Rgb): number {
  const { r, g, b } = typeof color === 'string' ? parseHex(color) : color;
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function meetsContrast(foreground: string, background: string, minimum = AA_TEXT): boolean {
  return contrastRatio(foreground, background) >= minimum;
}

export function hexToOklch(hex: string): Oklch {
  const { r, g, b } = parseHex(hex);
  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const hue = (Math.atan2(B, A) * 180) / Math.PI;
  return { l: L, c: Math.hypot(A, B), h: hue < 0 ? hue + 360 : hue };
}

function oklchToLinear({ l, c, h }: Oklch): [number, number, number] {
  const radians = (h * Math.PI) / 180;
  const A = c * Math.cos(radians);
  const B = c * Math.sin(radians);
  const lp = (l + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const mp = (l - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const sp = (l - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * lp - 3.3077115913 * mp + 0.2309699292 * sp,
    -1.2684380046 * lp + 2.6097574011 * mp - 0.3413193965 * sp,
    -0.0041960863 * lp - 0.7034186147 * mp + 1.707614701 * sp,
  ];
}

function inGamut(linear: [number, number, number]): boolean {
  return linear.every((v) => v >= -1e-4 && v <= 1 + 1e-4);
}

/** Converts back to sRGB, lowering chroma until the colour fits instead of clipping its hue. */
export function oklchToHex(color: Oklch): string {
  let chroma = color.c;
  let linear = oklchToLinear({ ...color, c: chroma });
  for (let i = 0; i < 24 && !inGamut(linear); i++) {
    chroma *= 0.9;
    linear = oklchToLinear({ ...color, c: chroma });
  }
  return toHex({ r: fromLinear(linear[0]), g: fromLinear(linear[1]), b: fromLinear(linear[2]) });
}

export function mixHex(a: string, b: string, amount: number): string {
  const ca = parseHex(a);
  const cb = parseHex(b);
  const t = Math.min(1, Math.max(0, amount));
  return toHex({
    r: ca.r + (cb.r - ca.r) * t,
    g: ca.g + (cb.g - ca.g) * t,
    b: ca.b + (cb.b - ca.b) * t,
  });
}

export function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.min(1, Math.max(0, alpha))})`;
}

/**
 * Moves a colour's lightness away from the background until the pair reaches `minimum`.
 * Returns the input untouched when it already passes, so designed colours are never nudged.
 */
export function ensureContrast(foreground: string, background: string, minimum = AA_TEXT): string {
  if (contrastRatio(foreground, background) >= minimum) return toHex(parseHex(foreground));
  const base = hexToOklch(foreground);
  const backgroundIsDark = relativeLuminance(background) < 0.18;
  const target = backgroundIsDark ? 1 : 0;
  let low = backgroundIsDark ? base.l : 0;
  let high = backgroundIsDark ? 1 : base.l;
  let best = oklchToHex({ ...base, l: target });
  for (let i = 0; i < 28; i++) {
    const mid = (low + high) / 2;
    const candidate = oklchToHex({ ...base, l: mid });
    const passes = contrastRatio(candidate, background) >= minimum;
    if (passes) best = candidate;
    // Search for the passing lightness closest to the original colour.
    if (backgroundIsDark === passes) high = mid;
    else low = mid;
  }
  return best;
}
