import { cellsOf, type Offset } from '../engine/forms';
import { CORAL, type Current, SEAWEED } from '../engine/game';
import {
  type BurstMoment,
  drawBurst,
  drawMurk,
  drawScoreBubble,
  drawTrail,
  dropProgress,
  paintBubble,
  type Trail,
} from './effects';
import { type Layout, type LayoutOptions, layoutFor } from './layout';
import { FONT_UI, type Look, withAlpha } from './look';
import { backdrop, drawCaustics, drawFish, drawPlants, drawRays, drawSnow } from './scenery';
import { drawClusters, drawSonar, type PebbleCell } from './sinkers';
import { drawCoral, drawCurrents, drawKelp, drawNight } from './specials';
import { drawTankBack, drawTankFront } from './tank';

/**
 * The tank on its canvas: the sea, the tank's water, the settled sinkers, the sonar line, the
 * falling sinker, the moments, the glass, and the bubble carrying the next sinker. One `TankFrame`
 * describes everything to draw; the view keeps nothing between frames but the canvas size.
 */

export interface TankFrame {
  cols: number;
  rows: number;
  /** Settled cells, rows counted from the top of the tank. */
  settled: readonly PebbleCell[];
  falling: { cells: readonly Offset[]; kind: number; group: number } | null;
  /** How far the falling sinker has got towards its next row, 0–1, for a smooth sink. */
  fallLead?: number;
  /** Where the falling sinker would settle: the sonar line. */
  landing: readonly Offset[] | null;
  next: number | null;
  look: Look;
  /** Seeds the scenery, so a tank always has the same plants and pebbles. */
  seed: string;
  bursts?: readonly BurstMoment[];
  trails?: readonly Trail[];
  /** 0–1: the end of a dive clouding the water. */
  murk?: number;
  /** The dive's currents, drawn across their rows. */
  currents?: readonly Current[];
  /** A night dive: the tank dark but round the falling sinker. */
  night?: boolean;
  time: number;
  reducedMotion: boolean;
}

export class TankView {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private cssWidth = 0;
  private cssHeight = 0;
  private dpr = 1;
  private options: LayoutOptions;
  private scratch: HTMLCanvasElement | null = null;

  constructor(canvas: HTMLCanvasElement, options: LayoutOptions = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.options = options;
  }

  resize(cssWidth: number, cssHeight: number, dpr: number, options?: LayoutOptions): void {
    this.cssWidth = cssWidth;
    this.cssHeight = cssHeight;
    this.dpr = dpr;
    if (options) this.options = options;
    this.canvas.width = Math.round(cssWidth * dpr);
    this.canvas.height = Math.round(cssHeight * dpr);
    this.canvas.style.width = `${cssWidth}px`;
    this.canvas.style.height = `${cssHeight}px`;
  }

  /** For a canvas someone else has already sized (the Hall's poster): only remember its size. */
  adopt(cssWidth: number, cssHeight: number, dpr: number, options?: LayoutOptions): void {
    this.cssWidth = cssWidth;
    this.cssHeight = cssHeight;
    this.dpr = dpr;
    if (options) this.options = options;
  }

  layoutFor(cols: number, rows: number): Layout {
    return layoutFor(this.canvas.width, this.canvas.height, cols, rows, this.dpr, this.options);
  }

  get ready(): boolean {
    return this.cssWidth > 0 && this.cssHeight > 0;
  }

  draw(frame: TankFrame): void {
    if (!this.ready) return;
    const ctx = this.ctx;
    const layout = this.layoutFor(frame.cols, frame.rows);
    const { look, time, reducedMotion: still } = frame;
    ctx.drawImage(backdrop(layout, look, frame.seed), 0, 0);
    drawCaustics(ctx, layout, look, still ? 4 : time);
    drawRays(ctx, layout, look, time, still);
    drawFish(ctx, layout, look, time, still);
    drawPlants(ctx, layout, look, frame.seed, time, still);
    drawTankBack(ctx, layout, look, time, still);
    drawCurrents(ctx, layout, look, frame.currents ?? [], time, still);

    const bursts = frame.bursts ?? [];
    drawSettled(ctx, layout, frame, bursts);
    const lead = frame.fallLead ?? 0;
    // A gentle wobble as the sinker sinks: a sway of a few hundredths of a cell.
    const sway = still || !frame.falling ? 0 : Math.sin(time * 2.2) * 0.035;
    if (frame.night) {
      const cells = frame.falling?.cells ?? [];
      const light =
        cells.length > 0
          ? {
              x:
                layout.left +
                (cells.reduce((s, c) => s + c.x, 0) / cells.length + 0.5 + sway) * layout.cell,
              y:
                layout.top +
                (cells.reduce((s, c) => s + c.y, 0) / cells.length + 0.5 + lead) * layout.cell,
            }
          : null;
      this.scratch ??= document.createElement('canvas');
      drawNight(ctx, layout, look, light, this.scratch);
    }
    if (frame.landing)
      drawSonar(
        ctx,
        layout,
        look,
        frame.landing,
        time,
        still,
        frame.falling ? { cells: frame.falling.cells, shiftY: lead } : undefined,
      );
    if (frame.falling) {
      // The whole sinker shares the colour of its centre's depth.
      const depth = depthShare(frame.falling.cells[0]!.y + lead, frame.rows);
      const cells = frame.falling.cells.map((c) => ({
        x: c.x,
        y: c.y,
        group: frame.falling!.group,
        kind: frame.falling!.kind,
        depth,
      }));
      ctx.save();
      ctx.translate(sway * layout.cell, 0);
      drawClusters(ctx, layout, look, cells, { time, shiftY: lead, glow: 1 });
      ctx.restore();
    }
    for (const trail of frame.trails ?? []) drawTrail(ctx, layout, look, trail, time);
    for (const burst of bursts) drawBurst(ctx, layout, look, burst, time, still);
    drawTankFront(ctx, layout, look);
    if (frame.next !== null) drawNextBubble(ctx, layout, look, frame.next, time, still);
    for (const burst of bursts) drawScoreBubble(ctx, layout, look, burst, time);
    drawSnow(ctx, layout, look, time, still);
    drawMurk(ctx, layout, look, frame.murk ?? 0);
  }
}

export function depthShare(row: number, rows: number): number {
  return Math.max(0, Math.min(1, row / (rows - 1)));
}

/**
 * Settled sinkers. Just after a burst, the cells above the cleared rows hang where they were for a
 * moment, then drop into place.
 */
function drawSettled(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  frame: TankFrame,
  bursts: readonly BurstMoment[],
): void {
  const live = bursts.filter((b) => dropProgress(frame.time - b.born, b.rows.length) < 1);
  if (live.length === 0) {
    drawCells(ctx, layout, frame, frame.settled, 0);
    return;
  }
  const burst = live.at(-1)!;
  const hang = 1 - dropProgress(frame.time - burst.born, burst.rows.length);
  const byShift = new Map<number, PebbleCell[]>();
  for (const cell of frame.settled) {
    const rowsBelow = rowsFallen(cell.y, burst.rows);
    const list = byShift.get(rowsBelow) ?? [];
    list.push(cell);
    byShift.set(rowsBelow, list);
  }
  for (const [rowsBelow, cells] of byShift) drawCells(ctx, layout, frame, cells, -rowsBelow * hang);
}

/** Settled cells of every kind: seaweed and coral first, then the glass sinkers over them. */
function drawCells(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  frame: TankFrame,
  cells: readonly PebbleCell[],
  shiftY: number,
): void {
  const options = { time: frame.time, shiftY, still: frame.reducedMotion };
  const kelp = cells.filter((c) => c.kind === SEAWEED);
  const coral = cells.filter((c) => c.kind === CORAL);
  if (kelp.length > 0) drawKelp(ctx, layout, frame.look, kelp, options);
  if (coral.length > 0) drawCoral(ctx, layout, frame.look, coral, options);
  const glass = cells.filter((c) => c.kind !== SEAWEED && c.kind !== CORAL);
  drawClusters(ctx, layout, frame.look, glass, { time: frame.time, glow: 0.45, shiftY });
}

/** How many cleared rows a settled cell, now at `row`, has fallen past. */
function rowsFallen(row: number, cleared: readonly number[]): number {
  for (let k = 0; k <= cleared.length; k++) {
    const was = row - k;
    if (cleared.includes(was)) continue;
    if (cleared.filter((r) => r > was).length === k) return k;
  }
  return 0;
}

/** The next sinker, riding in a bubble beside the top of the tank. */
function drawNextBubble(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  look: Look,
  kind: number,
  time: number,
  still: boolean,
): void {
  const { cell } = layout;
  const bob = still ? 0 : Math.sin(time * 1.3) * cell * 0.12;
  const x = layout.left + layout.cols * cell + cell * 2.1;
  const y = layout.top + cell * 1.9 + bob;
  const r = cell * 1.3;
  ctx.save();
  ctx.fillStyle = withAlpha(look.bubbleShine, look.dark ? 0.05 : 0.12);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  // The sinker inside, small.
  const cells = cellsOf(kind, 0, 0);
  const xs = cells.map((c) => c.x);
  const ys = cells.map((c) => c.y);
  const mini = r * 0.34;
  const width = (Math.max(...xs) - Math.min(...xs) + 1) * mini;
  const height = (Math.max(...ys) - Math.min(...ys) + 1) * mini;
  const miniLayout: Layout = {
    ...layout,
    cell: mini,
    left: x - width / 2 - Math.min(...xs) * mini,
    top: y - height / 2 - Math.min(...ys) * mini,
  };
  drawClusters(
    ctx,
    miniLayout,
    look,
    cells.map((c) => ({ x: c.x, y: c.y, group: -1, kind, depth: 0.15 })),
    { time, glow: 0.8 },
  );
  paintBubble(ctx, look, x, y, r);
  ctx.fillStyle = withAlpha(look.gaugeInk, 0.9);
  ctx.font = `700 ${Math.round(cell * 0.3)}px ${FONT_UI}`;
  ctx.textAlign = 'center';
  ctx.fillText('NEXT', x, y - r - cell * 0.22);
  ctx.restore();
}
