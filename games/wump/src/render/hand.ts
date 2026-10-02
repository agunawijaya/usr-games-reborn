import { noise2 } from './noise';

/**
 * The explorer's hand: lines, circles and letters drawn as strokes with a little wobble, the way
 * a fountain pen, a pencil or a stick of chalk would put them down. Room numbers and notebook
 * marks are hand-lettered from the stroke glyphs below, so no handwriting font is needed.
 */

export type Medium = 'ink' | 'pencil' | 'chalk';

export interface Point {
  x: number;
  y: number;
}

export interface StrokeStyle {
  medium: Medium;
  color: string;
  width: number;
  /** Seeds the wobble, so the same line always wobbles the same way. */
  seed: number;
  /** How far the line strays from its path, in pixels. */
  wobble?: number;
  /** Draws only the first part of the stroke (0–1), for lines that write themselves. */
  progress?: number;
  alpha?: number;
}

/** Points along a line from a to b, `step` pixels apart. */
export function linePoints(a: Point, b: Point, step = 6): Point[] {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  const count = Math.max(2, Math.ceil(length / step));
  return Array.from({ length: count + 1 }, (_, i) => ({
    x: a.x + ((b.x - a.x) * i) / count,
    y: a.y + ((b.y - a.y) * i) / count,
  }));
}

/** A closed polygon as closely spaced points, so its corners stay sharp under the wobble. */
export function polygonPoints(corners: readonly Point[], step = 4): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i]!;
    const b = corners[(i + 1) % corners.length]!;
    points.push(...linePoints(a, b, step).slice(0, -1));
  }
  points.push(corners[0]!);
  return points;
}

/** Points along a quadratic curve. */
export function curvePoints(a: Point, control: Point, b: Point, count = 24): Point[] {
  return Array.from({ length: count + 1 }, (_, i) => {
    const t = i / count;
    const u = 1 - t;
    return {
      x: u * u * a.x + 2 * u * t * control.x + t * t * b.x,
      y: u * u * a.y + 2 * u * t * control.y + t * t * b.y,
    };
  });
}

/** Moves each point sideways by low-frequency noise, the hand's unsteadiness. */
export function wobblePoints(points: readonly Point[], amount: number, seed: number): Point[] {
  if (amount <= 0 || points.length < 2) return [...points];
  let travelled = 0;
  return points.map((point, i) => {
    const previous = points[Math.max(0, i - 1)]!;
    const next = points[Math.min(points.length - 1, i + 1)]!;
    travelled += Math.hypot(point.x - previous.x, point.y - previous.y);
    const dx = next.x - previous.x;
    const dy = next.y - previous.y;
    const length = Math.hypot(dx, dy) || 1;
    const offset = (noise2(travelled * 0.035, seed * 0.17, seed) - 0.5) * 2 * amount;
    return { x: point.x - (dy / length) * offset, y: point.y + (dx / length) * offset };
  });
}

function truncate(points: readonly Point[], progress: number): Point[] {
  if (progress >= 1) return [...points];
  if (progress <= 0) return [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y);
  }
  const wanted = total * progress;
  const kept: Point[] = [points[0]!];
  let travelled = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const step = Math.hypot(b.x - a.x, b.y - a.y);
    if (travelled + step >= wanted) {
      const t = step === 0 ? 0 : (wanted - travelled) / step;
      kept.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      break;
    }
    kept.push(b);
    travelled += step;
  }
  return kept;
}

function tracePath(ctx: CanvasRenderingContext2D, points: readonly Point[]): void {
  ctx.beginPath();
  ctx.moveTo(points[0]!.x, points[0]!.y);
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i]!;
    const q = points[i + 1]!;
    ctx.quadraticCurveTo(p.x, p.y, (p.x + q.x) / 2, (p.y + q.y) / 2);
  }
  const last = points[points.length - 1]!;
  ctx.lineTo(last.x, last.y);
}

/** Draws a stroke in the chosen medium. */
export function stroke(
  ctx: CanvasRenderingContext2D,
  path: readonly Point[],
  style: StrokeStyle,
): void {
  const wobbled = wobblePoints(path, style.wobble ?? style.width * 0.6, style.seed);
  const points = truncate(wobbled, style.progress ?? 1);
  if (points.length < 2) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = style.color;
  const alpha = style.alpha ?? 1;
  if (style.medium === 'ink') {
    ctx.globalAlpha = alpha * 0.9;
    ctx.lineWidth = style.width;
    tracePath(ctx, points);
    ctx.stroke();
    // A second, thinner pass a hair aside: ink pooling where the nib pressed.
    ctx.globalAlpha = alpha * 0.35;
    ctx.lineWidth = style.width * 0.55;
    ctx.translate(0.35, 0.3);
    tracePath(ctx, points);
    ctx.stroke();
  } else if (style.medium === 'pencil') {
    ctx.globalAlpha = alpha * 0.78;
    ctx.lineWidth = style.width;
    tracePath(ctx, points);
    ctx.stroke();
    ctx.globalAlpha = alpha * 0.3;
    ctx.lineWidth = style.width * 1.8;
    ctx.setLineDash([1.2, 2.6]);
    tracePath(ctx, points);
    ctx.stroke();
  } else {
    // Chalk: several dry, broken passes; the gaps show the rock underneath.
    for (let pass = 0; pass < 3; pass++) {
      const shift = (pass - 1) * style.width * 0.28;
      ctx.globalAlpha = alpha * (pass === 1 ? 0.75 : 0.32);
      ctx.lineWidth = style.width * (pass === 1 ? 0.9 : 0.55);
      ctx.setLineDash(pass === 1 ? [9 + (style.seed % 5), 1.6] : [2.2, 2.8 + pass]);
      ctx.lineDashOffset = style.seed % 7;
      ctx.save();
      ctx.translate(shift, -shift * 0.6);
      tracePath(ctx, points);
      ctx.stroke();
      ctx.restore();
    }
  }
  ctx.restore();
}

/**
 * A hand-drawn circle: slightly oval, slightly spiralling, its two ends overlapping where the
 * pen came round again.
 */
export function circlePoints(
  center: Point,
  radius: number,
  seed: number,
  overshoot = 0.32,
): Point[] {
  const start = (seed % 628) / 100;
  const count = Math.max(24, Math.round(radius * 1.2));
  const sweep = Math.PI * 2 + overshoot;
  const squash = 0.94 + (seed % 7) * 0.012;
  return Array.from({ length: count + 1 }, (_, i) => {
    const t = i / count;
    const angle = start + sweep * t;
    const r = radius * (1 + (t - 0.5) * 0.07);
    return { x: center.x + Math.cos(angle) * r, y: center.y + Math.sin(angle) * r * squash };
  });
}

// —— hand lettering ——

type Glyph = { width: number; strokes: Point[][] };

function arc(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  from: number,
  to: number,
  steps = 18,
): Point[] {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const angle = from + ((to - from) * i) / steps;
    return { x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry };
  });
}

const P = (x: number, y: number): Point => ({ x, y });
const PI = Math.PI;

/** Single-stroke letterforms on a box one unit tall; y runs down. */
const GLYPHS: Record<string, Glyph> = {
  '0': {
    width: 0.6,
    strokes: [arc(0.3, 0.5, 0.28, 0.49, -PI / 2 - 0.25, (3 * PI) / 2 + 0.05, 28)],
  },
  '1': { width: 0.34, strokes: [[P(0.1, 0.17), P(0.27, 0.02), P(0.27, 1)]] },
  '2': {
    width: 0.6,
    strokes: [[...arc(0.3, 0.29, 0.27, 0.27, -PI * 0.95, PI * 0.18), P(0.04, 1), P(0.6, 0.98)]],
  },
  '3': {
    width: 0.58,
    strokes: [
      [
        ...arc(0.27, 0.26, 0.26, 0.24, -PI * 0.9, PI * 0.5),
        ...arc(0.27, 0.74, 0.3, 0.26, -PI * 0.5, PI * 0.88),
      ],
    ],
  },
  '4': {
    width: 0.64,
    strokes: [
      [P(0.42, 0.02), P(0.02, 0.68), P(0.64, 0.68)],
      [P(0.47, 0.3), P(0.47, 1)],
    ],
  },
  '5': {
    width: 0.6,
    strokes: [
      [
        P(0.56, 0.03),
        P(0.13, 0.03),
        P(0.09, 0.45),
        ...arc(0.3, 0.71, 0.28, 0.29, -PI * 0.72, PI * 0.86),
      ],
    ],
  },
  '6': {
    width: 0.6,
    strokes: [
      [
        P(0.52, 0.03),
        P(0.3, 0.17),
        P(0.12, 0.42),
        P(0.05, 0.7),
        ...arc(0.32, 0.73, 0.27, 0.27, PI, -PI),
      ],
    ],
  },
  '7': { width: 0.6, strokes: [[P(0.03, 0.04), P(0.6, 0.04), P(0.24, 1)]] },
  '8': {
    width: 0.6,
    strokes: [
      arc(0.3, 0.26, 0.23, 0.24, PI / 2, PI / 2 + PI * 2, 22),
      arc(0.3, 0.74, 0.28, 0.26, -PI / 2, PI * 1.5, 24),
    ],
  },
  '9': {
    width: 0.6,
    strokes: [[...arc(0.29, 0.3, 0.26, 0.28, 0.05, PI * 2.05, 22), P(0.55, 0.62), P(0.43, 1)]],
  },
  S: {
    width: 0.6,
    strokes: [
      [
        ...arc(0.3, 0.27, 0.25, 0.24, -0.3, -PI * 1.5),
        ...arc(0.3, 0.74, 0.28, 0.25, -PI / 2, PI * 0.88),
      ],
    ],
  },
  P: {
    width: 0.6,
    strokes: [
      [P(0.08, 1), P(0.08, 0.02), ...arc(0.27, 0.27, 0.3, 0.25, -PI / 2, PI / 2), P(0.08, 0.52)],
    ],
  },
  B: {
    width: 0.62,
    strokes: [
      [
        P(0.08, 1),
        P(0.08, 0.02),
        ...arc(0.27, 0.25, 0.26, 0.23, -PI / 2, PI / 2),
        P(0.08, 0.48),
        ...arc(0.29, 0.74, 0.31, 0.26, -PI / 2, PI / 2),
        P(0.08, 1),
      ],
    ],
  },
  W: { width: 0.82, strokes: [[P(0, 0.02), P(0.18, 1), P(0.41, 0.36), P(0.62, 1), P(0.82, 0.02)]] },
  '?': {
    width: 0.52,
    strokes: [
      [...arc(0.26, 0.27, 0.24, 0.24, -PI * 0.95, PI * 0.4), P(0.27, 0.72)],
      arc(0.27, 0.95, 0.03, 0.03, 0, PI * 2, 6),
    ],
  },
  '!': {
    width: 0.2,
    strokes: [[P(0.1, 0.02), P(0.1, 0.7)], arc(0.1, 0.95, 0.03, 0.03, 0, PI * 2, 6)],
  },
  '✓': { width: 0.7, strokes: [[P(0, 0.55), P(0.24, 0.96), P(0.7, 0.02)]] },
  '-': { width: 0.42, strokes: [[P(0.04, 0.52), P(0.4, 0.5)]] },
  '→': {
    width: 0.8,
    strokes: [
      [P(0, 0.52), P(0.78, 0.5)],
      [P(0.52, 0.26), P(0.8, 0.5), P(0.52, 0.76)],
    ],
  },
  ' ': { width: 0.36, strokes: [] },
};

export interface LetteringStyle {
  medium: Medium;
  color: string;
  /** Height of the letters in pixels. */
  size: number;
  seed: number;
  /** Line width relative to the size. */
  weight?: number;
  align?: 'left' | 'center' | 'right';
  alpha?: number;
  progress?: number;
}

export function letteringWidth(text: string, size: number): number {
  let width = 0;
  for (const char of text) width += ((GLYPHS[char]?.width ?? 0.6) + 0.2) * size;
  return Math.max(0, width - 0.2 * size);
}

/**
 * Hand-letters `text` with its baseline-centre at (x, y): the letters lean a little and each
 * one wanders on its own, as written ones do.
 */
export function letter(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  style: LetteringStyle,
): void {
  const { size, seed } = style;
  const total = letteringWidth(text, size);
  const align = style.align ?? 'center';
  let cursor = align === 'left' ? x : align === 'right' ? x - total : x - total / 2;
  const top = y - size / 2;
  let index = 0;
  for (const char of text) {
    const glyph = GLYPHS[char] ?? GLYPHS['?']!;
    const jitterY = (noise2(index * 3.1, seed, seed) - 0.5) * size * 0.08;
    const tilt = (noise2(index * 1.7, seed * 0.3, seed + 5) - 0.5) * 0.12;
    for (const [s, strokePath] of glyph.strokes.entries()) {
      const points = strokePath.map((p) => {
        const lean = (1 - p.y) * 0.1;
        const gx = (p.x + lean - glyph.width / 2) * size;
        const gy = (p.y - 0.5) * size;
        return {
          x: cursor + (glyph.width * size) / 2 + gx * Math.cos(tilt) - gy * Math.sin(tilt),
          y: top + size / 2 + jitterY + gx * Math.sin(tilt) + gy * Math.cos(tilt),
        };
      });
      stroke(ctx, points, {
        medium: style.medium,
        color: style.color,
        width: Math.max(1, size * (style.weight ?? 0.11)),
        seed: seed + index * 17 + s * 5,
        wobble: size * 0.025,
        alpha: style.alpha,
        progress: style.progress,
      });
    }
    cursor += (glyph.width + 0.2) * size;
    index += 1;
  }
}
