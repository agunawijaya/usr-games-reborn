import type { Layout } from './layout';
import { darken, depthColour, type Look, lighten, mix, withAlpha } from './look';

/**
 * Sinkers drawn as what they are meant to be: four glassy pebbles fused into one smooth cluster,
 * never four bricks. Each cluster's outline is traced round its cells and inset a little, so
 * neighbouring clusters keep a seam of water between them; its corners are rounded (generously
 * where the cluster bulges, gently where it turns in). The glass is tinted by depth, lit from the
 * top left, darker at its rim, with a bright edge where light refracts out at the bottom right,
 * and each pebble carries the glyph of its shape, etched into the glass.
 */

export interface PebbleCell {
  x: number;
  y: number;
  /** Cells with the same group are one cluster. */
  group: number;
  kind: number;
  /** 0 at the top of the tank, 1 at the bottom: the colour. */
  depth: number;
}

interface Point {
  x: number;
  y: number;
}

/**
 * The outline of a set of grid cells as closed loops of corner points, clockwise on screen,
 * straight runs merged.
 */
export function outlineLoops(cells: readonly Point[]): Point[][] {
  const key = (x: number, y: number) => `${x},${y}`;
  const inside = new Set(cells.map((c) => key(c.x, c.y)));
  const next = new Map<string, Point>();
  const add = (a: Point, b: Point) => next.set(key(a.x, a.y), b);
  for (const { x, y } of cells) {
    if (!inside.has(key(x, y - 1))) add({ x, y }, { x: x + 1, y });
    if (!inside.has(key(x + 1, y))) add({ x: x + 1, y }, { x: x + 1, y: y + 1 });
    if (!inside.has(key(x, y + 1))) add({ x: x + 1, y: y + 1 }, { x, y: y + 1 });
    if (!inside.has(key(x - 1, y))) add({ x, y: y + 1 }, { x, y });
  }
  const loops: Point[][] = [];
  const used = new Set<string>();
  for (const start of next.keys()) {
    if (used.has(start)) continue;
    const loop: Point[] = [];
    let at = start;
    while (!used.has(at)) {
      used.add(at);
      const [x, y] = at.split(',').map(Number) as [number, number];
      loop.push({ x, y });
      const to = next.get(at)!;
      at = key(to.x, to.y);
    }
    loops.push(dropStraights(loop));
  }
  return loops;
}

function dropStraights(loop: Point[]): Point[] {
  return loop.filter((p, i) => {
    const a = loop[(i - 1 + loop.length) % loop.length]!;
    const b = loop[(i + 1) % loop.length]!;
    return (p.x - a.x) * (b.y - p.y) - (p.y - a.y) * (b.x - p.x) !== 0;
  });
}

/** How a loop is traced: its inset, its corner radii, and the pinch where two pebbles meet. */
export interface Trace {
  inset: number;
  /** Where the outline bulges out. */
  round: number;
  /** Where it turns in. */
  turnIn: number;
  /** How far the outline dips in where one pebble meets the next along a side. */
  pinch?: number;
  shiftY?: number;
}

/**
 * Traces a loop of grid corners as a path in pixels, every edge moved inwards by `inset`, corners
 * rounded. Along a side, wherever one pebble meets the next, the outline dips in a little: that
 * waist is what makes a cluster read as pebbles fused together rather than a block.
 */
export function traceLoop(
  ctx: CanvasRenderingContext2D,
  loop: readonly Point[],
  layout: Layout,
  trace: Trace,
): void {
  const { inset, round, turnIn, pinch = 0, shiftY = 0 } = trace;
  const { cell } = layout;
  const n = loop.length;
  const px = loop.map((p, i) => {
    const prev = loop[(i - 1 + n) % n]!;
    const next = loop[(i + 1) % n]!;
    const d1 = { x: Math.sign(p.x - prev.x), y: Math.sign(p.y - prev.y) };
    const d2 = { x: Math.sign(next.x - p.x), y: Math.sign(next.y - p.y) };
    // Inward normals of the two edges meeting here (the inside is on the right going clockwise).
    const nx = -d1.y - d2.y;
    const ny = d1.x + d2.x;
    const convex = d1.x * d2.y - d1.y * d2.x > 0;
    return {
      x: layout.left + p.x * cell + nx * inset,
      y: layout.top + (p.y + shiftY) * cell + ny * inset,
      radius: convex ? round : turnIn,
    };
  });
  const mid = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const start = mid(px[n - 1]!, px[0]!);
  ctx.moveTo(start.x, start.y);
  for (let i = 0; i < n; i++) {
    const corner = px[i]!;
    const after = px[(i + 1) % n]!;
    ctx.arcTo(corner.x, corner.y, after.x, after.y, corner.radius);
    if (pinch > 0) pinchSide(ctx, corner, after, cell, pinch);
  }
  ctx.closePath();
}

/** The dips along one side, one at every seam between two pebbles; a cubic bump either side. */
function pinchSide(
  ctx: CanvasRenderingContext2D,
  from: Point,
  to: Point,
  cell: number,
  pinch: number,
): void {
  const length = Math.round(Math.hypot(to.x - from.x, to.y - from.y) / cell);
  if (length < 2) return;
  const dx = (to.x - from.x) / (length * cell);
  const dy = (to.y - from.y) / (length * cell);
  const inX = -dy;
  const inY = dx;
  const reach = cell * 0.3;
  const lift = pinch / 0.75;
  for (let k = 1; k < length; k++) {
    const sx = from.x + dx * cell * k;
    const sy = from.y + dy * cell * k;
    ctx.lineTo(sx - dx * reach, sy - dy * reach);
    ctx.bezierCurveTo(
      sx - dx * reach * 0.35 + inX * lift,
      sy - dy * reach * 0.35 + inY * lift,
      sx + dx * reach * 0.35 + inX * lift,
      sy + dy * reach * 0.35 + inY * lift,
      sx + dx * reach,
      sy + dy * reach,
    );
  }
}

/** Glyphs etched into the glass, one per shape, so the shape is never told by colour alone. */
function etchGlyph(
  ctx: CanvasRenderingContext2D,
  kind: number,
  cx: number,
  cy: number,
  g: number,
): void {
  ctx.beginPath();
  switch (kind) {
    case 0: // a wave
      ctx.moveTo(cx - g, cy);
      ctx.bezierCurveTo(cx - g * 0.5, cy - g * 0.8, cx - g * 0.2, cy - g * 0.8, cx, cy);
      ctx.bezierCurveTo(cx + g * 0.2, cy + g * 0.8, cx + g * 0.5, cy + g * 0.8, cx + g, cy);
      break;
    case 1: // a chevron
      ctx.moveTo(cx - g, cy + g * 0.45);
      ctx.lineTo(cx, cy - g * 0.45);
      ctx.lineTo(cx + g, cy + g * 0.45);
      break;
    case 2: // a ring
      ctx.arc(cx, cy, g * 0.68, 0, Math.PI * 2);
      break;
    case 3: // a star of four points
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 4;
        ctx.moveTo(cx - Math.cos(a) * g * 0.8, cy - Math.sin(a) * g * 0.8);
        ctx.lineTo(cx + Math.cos(a) * g * 0.8, cy + Math.sin(a) * g * 0.8);
      }
      break;
    case 4: // a spiral
      for (let a = 0; a <= Math.PI * 3; a += 0.25) {
        const r = (a / (Math.PI * 3)) * g * 0.9;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        if (a === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      break;
    case 5: // a cross
      ctx.moveTo(cx - g * 0.8, cy);
      ctx.lineTo(cx + g * 0.8, cy);
      ctx.moveTo(cx, cy - g * 0.8);
      ctx.lineTo(cx, cy + g * 0.8);
      break;
    default: // three little bubbles, one above two
      for (const [dx, dy] of [
        [0, -0.5],
        [-0.55, 0.42],
        [0.55, 0.42],
      ] as const) {
        ctx.moveTo(cx + dx * g + g * 0.24, cy + dy * g);
        ctx.arc(cx + dx * g, cy + dy * g, g * 0.24, 0, Math.PI * 2);
      }
  }
}

export interface DrawOptions {
  time: number;
  /** Shifts every cell down by this many rows (a sinker part-way between two rows). */
  shiftY?: number;
  /** 0–1: how lit from within the sinker is (by night, the falling one most of all). */
  glow?: number;
  /** 0–1: the loss's murk taking the colour out. */
  dim?: number;
  /** 0–1: lit up white-hot, as a bursting row is. */
  lit?: number;
}

export function drawClusters(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  look: Look,
  cells: readonly PebbleCell[],
  options: DrawOptions,
): void {
  const groups = new Map<number, PebbleCell[]>();
  for (const cell of cells) {
    const list = groups.get(cell.group);
    if (list) list.push(cell);
    else groups.set(cell.group, [cell]);
  }
  const { cell } = layout;
  const inset = cell * 0.05;
  const shiftY = options.shiftY ?? 0;
  for (const group of [...groups.values()].flatMap(touching)) {
    const loops = outlineLoops(group);
    const base = depthColour(look, group[0]!.depth);
    const dimmed = options.dim ? mixDim(base, look, options.dim) : base;
    const colour = options.lit ? mix(dimmed, look.sinkerShine, options.lit) : dimmed;
    const path = () => {
      ctx.beginPath();
      for (const loop of loops)
        traceLoop(ctx, loop, layout, {
          inset,
          round: cell * 0.4,
          turnIn: cell * 0.14,
          pinch: cell * 0.1,
          shiftY,
        });
    };
    const xs = group.map((c) => c.x);
    const ys = group.map((c) => c.y + shiftY);
    const box = {
      x0: layout.left + Math.min(...xs) * cell,
      y0: layout.top + Math.min(...ys) * cell,
      x1: layout.left + (Math.max(...xs) + 1) * cell,
      y1: layout.top + (Math.max(...ys) + 1) * cell,
    };
    ctx.save();
    // Light from within, by night: the cluster's own glow on the water round it.
    const glow = (options.glow ?? 0) * look.glow;
    if (glow > 0) {
      ctx.shadowColor = withAlpha(colour, 0.85);
      ctx.shadowBlur = cell * 0.55 * glow;
    }
    const body = ctx.createLinearGradient(box.x0, box.y0, box.x1, box.y1);
    body.addColorStop(0, lighten(colour, look.dark ? 0.1 : 0.32));
    body.addColorStop(0.55, colour);
    body.addColorStop(1, darken(colour, look.dark ? 0.25 : 0.18));
    ctx.fillStyle = body;
    path();
    ctx.globalAlpha = look.dark ? 0.95 : 0.92;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.clip();
    // The glass is darker towards its edge and bright where light refracts out at the bottom right.
    ctx.strokeStyle = withAlpha(darken(colour, 0.45), look.dark ? 0.5 : 0.32);
    ctx.lineWidth = cell * 0.22;
    path();
    ctx.stroke();
    ctx.save();
    ctx.translate(-cell * 0.07, -cell * 0.07);
    ctx.strokeStyle = withAlpha(lighten(colour, 0.6), look.dark ? 0.55 : 0.75);
    ctx.lineWidth = cell * 0.07;
    path();
    ctx.stroke();
    ctx.restore();
    for (const c of group) {
      const cx = layout.left + (c.x + 0.5) * cell;
      const cy = layout.top + (c.y + shiftY + 0.5) * cell;
      // A soft bloom of light in each pebble, and a crisp glint.
      const bloom = ctx.createRadialGradient(
        cx - cell * 0.16,
        cy - cell * 0.18,
        0,
        cx - cell * 0.16,
        cy - cell * 0.18,
        cell * 0.36,
      );
      bloom.addColorStop(0, withAlpha(look.sinkerShine, look.dark ? 0.35 : 0.5));
      bloom.addColorStop(1, withAlpha(look.sinkerShine, 0));
      ctx.fillStyle = bloom;
      ctx.fillRect(cx - cell * 0.55, cy - cell * 0.55, cell * 1.1, cell * 1.1);
      ctx.fillStyle = withAlpha(look.sinkerShine, 0.9);
      ctx.beginPath();
      ctx.ellipse(
        cx - cell * 0.22,
        cy - cell * 0.24,
        cell * 0.07,
        cell * 0.045,
        -0.6,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      // The etched glyph: a dark cut with a bright edge.
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(1.2, cell * 0.06);
      ctx.strokeStyle = look.etchShadow;
      etchGlyph(ctx, c.kind, cx + cell * 0.03, cy + cell * 0.05, cell * 0.17);
      ctx.stroke();
      ctx.strokeStyle = look.etch;
      etchGlyph(ctx, c.kind, cx, cy + cell * 0.02, cell * 0.17);
      ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = look.sinkerEdge;
    ctx.lineWidth = Math.max(1, cell * 0.035);
    path();
    ctx.stroke();
  }
}

/**
 * A sinker split into the pieces whose pebbles still touch side to side. A burst can leave two
 * pebbles of one sinker meeting only at a corner; they are drawn as two, never fused at a point.
 */
function touching(cells: PebbleCell[]): PebbleCell[][] {
  const left = new Set(cells);
  const pieces: PebbleCell[][] = [];
  for (const start of cells) {
    if (!left.has(start)) continue;
    left.delete(start);
    const piece = [start];
    for (let i = 0; i < piece.length; i++) {
      const at = piece[i]!;
      for (const other of left)
        if (Math.abs(other.x - at.x) + Math.abs(other.y - at.y) === 1) {
          left.delete(other);
          piece.push(other);
        }
    }
    pieces.push(piece);
  }
  return pieces;
}

function mixDim(colour: string, look: Look, amount: number): string {
  return look.dark
    ? darken(colour, amount * 0.6)
    : lighten(darken(colour, amount * 0.25), amount * 0.25);
}

/**
 * The sonar line: where the sinker would settle, outlined in dots on the water. Never a copy of
 * the sinker: no fill, no glass, just its footprint, pulsing gently by night. A ping now and then
 * runs down from the sinker to it, so the eye finds it.
 */
export function drawSonar(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  look: Look,
  cells: readonly Point[],
  time: number,
  still: boolean,
  from?: { cells: readonly Point[]; shiftY: number },
): void {
  if (cells.length === 0) return;
  const { cell } = layout;
  const pulse = still ? 1 : 0.75 + 0.25 * Math.sin(time * 4);
  ctx.save();
  ctx.strokeStyle = withAlpha(look.sonar, (look.dark ? 0.85 : 0.9) * pulse);
  ctx.lineCap = 'round';
  ctx.setLineDash([0.01, cell * 0.16]);
  ctx.lineDashOffset = still ? 0 : -time * cell * 0.4;
  ctx.lineWidth = Math.max(2, cell * 0.075);
  ctx.beginPath();
  for (const loop of outlineLoops(cells))
    traceLoop(ctx, loop, layout, {
      inset: cell * 0.08,
      round: cell * 0.36,
      turnIn: cell * 0.1,
      pinch: cell * 0.07,
    });
  ctx.stroke();
  // Reduced motion keeps the footprint and drops the moving ping.
  if (from && !still) drawPing(ctx, layout, cells, from, (time / PING_SECONDS) % 1);
  ctx.restore();
}

const PING_SECONDS = 1.6;

/** One ping, `phase` of the way from the sinker's underside down to the top of its footprint. */
function drawPing(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  landing: readonly Point[],
  from: { cells: readonly Point[]; shiftY: number },
  phase: number,
): void {
  const { cell } = layout;
  const xs = from.cells.map((c) => c.x);
  const x0 = layout.left + Math.min(...xs) * cell + cell * 0.2;
  const x1 = layout.left + (Math.max(...xs) + 1) * cell - cell * 0.2;
  const top = layout.top + (Math.max(...from.cells.map((c) => c.y)) + 1 + from.shiftY) * cell;
  const bottom = layout.top + Math.min(...landing.map((c) => c.y)) * cell;
  if (bottom - top < cell * 1.5) return;
  const y = top + (bottom - top) * phase;
  const bow = cell * 0.35;
  ctx.globalAlpha = Math.sin(phase * Math.PI) * 0.8;
  ctx.lineWidth = Math.max(1.5, cell * 0.06);
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.quadraticCurveTo((x0 + x1) / 2, y + bow * 2, x1, y);
  ctx.stroke();
  ctx.globalAlpha = 1;
}
