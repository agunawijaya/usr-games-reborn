import type { Point } from './camera';
import { type Palette, withAlpha } from './palette';

/**
 * The 2D layer over the cubes: the ribbon that flows through a traced chain, the order badges
 * on its cubes (so the path reads without colour), and the reveal's web of every word on the
 * board. Pure drawing from the points it is given.
 */

export interface RibbonStyle {
  /** Ribbon width in CSS pixels. */
  width: number;
  time: number;
  /** 0–1: the long-word flare. */
  flare: number;
  /** 0–1: fades the whole ribbon (a hover trace in the reveal draws lighter). */
  strength: number;
}

/** A smooth curve through the points (Catmull–Rom, as cubic Béziers). */
function tracePath(ctx: CanvasRenderingContext2D, points: readonly Point[]) {
  ctx.beginPath();
  ctx.moveTo(points[0]!.x, points[0]!.y);
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[Math.min(points.length - 1, i + 2)]!;
    // Low tension: the ribbon bends at each cube without swinging out over its neighbours.
    const tension = 0.1;
    ctx.bezierCurveTo(
      p1.x + (p2.x - p0.x) * tension,
      p1.y + (p2.y - p0.y) * tension,
      p2.x - (p3.x - p1.x) * tension,
      p2.y - (p3.y - p1.y) * tension,
      p2.x,
      p2.y,
    );
  }
}

export function drawRibbon(
  ctx: CanvasRenderingContext2D,
  points: readonly Point[],
  palette: Palette,
  style: RibbonStyle,
) {
  if (points.length === 0) return;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const width = style.width * (1 + style.flare * 0.9);
  const gradient = ctx.createLinearGradient(first.x, first.y, last.x + 0.01, last.y + 0.01);
  gradient.addColorStop(0, palette.ribbonFrom);
  gradient.addColorStop(1, palette.ribbonTo);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (points.length > 1) {
    if (palette.look === 'studio') {
      // Multiplied over the cubes, the ribbon tints them and leaves the dark letters readable.
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = style.strength * 0.78;
      ctx.strokeStyle = gradient;
      ctx.lineWidth = width;
      tracePath(ctx, points);
      ctx.stroke();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = style.strength * (0.45 + style.flare * 0.4);
      ctx.strokeStyle = palette.ribbonShine;
      ctx.lineWidth = width * 0.18;
      tracePath(ctx, points);
      ctx.stroke();
    } else {
      // Added light: white letters stay white, the glow spreads round them.
      ctx.globalCompositeOperation = 'lighter';
      ctx.shadowColor = palette.ribbonFrom;
      ctx.shadowBlur = width * (0.9 + style.flare * 1.6);
      ctx.globalAlpha = style.strength * (0.38 + style.flare * 0.3);
      ctx.strokeStyle = gradient;
      ctx.lineWidth = width;
      tracePath(ctx, points);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = style.strength * (0.42 + style.flare * 0.4);
      ctx.strokeStyle = palette.ribbonShine;
      ctx.lineWidth = width * 0.13;
      tracePath(ctx, points);
      ctx.stroke();
    }
    // Light flowing along the chain, first cube to last.
    const dash = width * 0.45;
    ctx.globalCompositeOperation = palette.look === 'studio' ? 'screen' : 'lighter';
    ctx.globalAlpha = style.strength * (palette.look === 'studio' ? 0.55 : 0.7);
    ctx.setLineDash([dash, dash * 3.4]);
    ctx.lineDashOffset = -(style.time * 120) % (dash * 4.4);
    ctx.strokeStyle = palette.ribbonShine;
    ctx.lineWidth = width * 0.34;
    tracePath(ctx, points);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // The live end of the chain: where the pointer is, or the last cube.
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = style.strength;
  ctx.fillStyle = palette.ribbonTo;
  ctx.beginPath();
  ctx.arc(last.x, last.y, width * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = palette.ribbonShine;
  ctx.beginPath();
  ctx.arc(last.x, last.y, width * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Order badges at each traced cube's corner: the chain readable without its colours. */
export function drawBadges(
  ctx: CanvasRenderingContext2D,
  corners: readonly Point[],
  palette: Palette,
  radius: number,
) {
  ctx.save();
  ctx.font = `700 ${Math.round(radius * 1.15)}px 'Atkinson Hyperlegible Next', system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const [index, corner] of corners.entries()) {
    const t = corners.length === 1 ? 0 : index / (corners.length - 1);
    ctx.fillStyle = palette.look === 'studio' ? '#ffffff' : '#0b0f2a';
    ctx.strokeStyle = mixHex(palette.ribbonFrom, palette.ribbonTo, t);
    ctx.lineWidth = Math.max(2, radius * 0.22);
    ctx.beginPath();
    ctx.arc(corner.x, corner.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = palette.look === 'studio' ? palette.ink : '#ffffff';
    ctx.fillText(String(index + 1), corner.x, corner.y + radius * 0.06);
  }
  ctx.restore();
}

export interface WebStrand {
  points: readonly Point[];
  found: boolean;
  /** 0–1: how much of the strand has drawn in. */
  progress: number;
}

export interface WebEdge {
  from: Point;
  to: Point;
  /** Words of yours, and words still hidden, that step between these two cubes. */
  found: number;
  hidden: number;
  /** Words the Duel's hunter found that take this step. */
  ghost: number;
  /** 0–1: how far the edge has drawn in. */
  progress: number;
}

/**
 * The reveal's web: every step any word takes between two cubes, drawn once as a pair of
 * strands, one for your words and one for the words still hidden, each as thick as the number
 * of words that take it. Strands stop short of the cubes' centres, so the letters stay clear.
 */
export function drawWeb(
  ctx: CanvasRenderingContext2D,
  edges: readonly WebEdge[],
  palette: Palette,
  pitch: number,
  fade: number,
) {
  ctx.save();
  ctx.lineCap = 'round';
  const arcade = palette.look === 'arcade';
  ctx.globalCompositeOperation = arcade ? 'lighter' : 'source-over';
  const gap = pitch * 0.27;
  const apart = pitch * 0.022;
  const busiest = Math.max(1, ...edges.map((edge) => Math.max(edge.found, edge.hidden)));
  for (const halo of [true, false]) {
    for (const edge of edges) {
      if (edge.progress <= 0) continue;
      const dx = edge.to.x - edge.from.x;
      const dy = edge.to.y - edge.from.y;
      const length = Math.hypot(dx, dy);
      if (length <= gap * 2) continue;
      const ux = dx / length;
      const uy = dy / length;
      const span = (length - gap * 2) * edge.progress;
      for (const [count, colour, side] of [
        [edge.hidden, palette.webMissed, -1],
        [edge.found, palette.webFound, 1],
      ] as const) {
        if (count === 0) continue;
        const weight = Math.sqrt(count / busiest);
        const offset = edge.found > 0 && edge.hidden > 0 ? apart * side : 0;
        const x = edge.from.x + ux * gap - uy * offset;
        const y = edge.from.y + uy * gap + ux * offset;
        const yours = side === 1;
        const strength = yours ? (halo ? 0.22 : 0.95) : halo ? 0.14 : arcade ? 0.6 : 0.7;
        ctx.strokeStyle = withAlpha(colour, strength * (0.5 + 0.5 * weight) * fade);
        ctx.lineWidth = pitch * (0.01 + 0.028 * weight) * (halo ? 3 : 1);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + ux * span, y + uy * span);
        ctx.stroke();
      }
      if (edge.ghost > 0 && !halo) {
        // The hunter's steps: a dashed ghost along the middle of the pair.
        ctx.save();
        ctx.setLineDash([pitch * 0.05, pitch * 0.05]);
        ctx.strokeStyle = withAlpha(palette.ink, (arcade ? 0.55 : 0.5) * fade);
        ctx.lineWidth = pitch * 0.012;
        const span = (length - gap * 2) * edge.progress;
        const x = edge.from.x + ux * gap;
        const y = edge.from.y + uy * gap;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + ux * span, y + uy * span);
        ctx.stroke();
        ctx.restore();
      }
    }
  }
  ctx.restore();
}

export function mixHex(a: string, b: string, t: number): string {
  const pa = Number.parseInt(a.slice(1), 16);
  const pb = Number.parseInt(b.slice(1), 16);
  const channel = (shift: number) =>
    Math.round(((pa >> shift) & 255) * (1 - t) + ((pb >> shift) & 255) * t);
  return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`;
}
