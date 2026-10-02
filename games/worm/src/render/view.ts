import type { Board } from '../engine/board';
import type { Digit } from '../engine/game';
import type { Cell, Dir } from '../engine/geometry';
import {
  type Burst,
  drawBonk,
  drawBursts,
  drawMosaic,
  drawPopups,
  drawRipple,
  mosaicTint,
  type Popup,
} from './effects';
import { drawFruit } from './fruit';
import { type Layout, type LayoutOptions, layoutFor } from './layout';
import type { Look } from './look';
import { drawNoodle, type Mood } from './noodle';
import { backdrop } from './scenery';
import { paintChewedRoot, paintTunnelMouth } from './terrain';

/**
 * The garden on its canvas: the painted backdrop, the fruit, the noodle and the moments on top.
 * One `GardenFrame` describes everything to draw; the view keeps nothing between frames but the
 * canvas size.
 */

export interface GardenFrame {
  board: Board;
  /** Seeds the scenery, so a garden always looks the same. */
  seed: string;
  look: Look;
  grid: boolean;
  body: readonly Cell[];
  heading: Dir | null;
  digit: Digit | null;
  /** Seconds since the digit appeared, for its pop. */
  digitAge?: number;
  bulges?: readonly { at: number; size: number }[];
  pulse?: number | null;
  mood?: Mood;
  sag?: number;
  popups?: readonly Popup[];
  bursts?: readonly Burst[];
  /** Seconds since the box was filled, or null. */
  mosaic?: number | null;
  /** The loss: where the head hit, and seconds since. */
  bonk?: { at: Cell; age: number } | null;
  /** Root cells chewed open, drawn as gaps in the root. */
  chewed?: readonly Cell[];
  /** Night: dark but for a pool of light round the head, and the glowing digits. */
  night?: boolean;
  /** How far the latest move has got (0 to 1) and the cell the tail left, for a smooth slide. */
  lead?: number;
  vacated?: Cell | null;
  time: number;
  reducedMotion: boolean;
  shapes?: boolean;
}

export class GardenView {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private cssWidth = 0;
  private cssHeight = 0;
  private dpr = 1;
  private options: LayoutOptions;

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

  layoutFor(board: Board): Layout {
    return layoutFor(
      this.canvas.width,
      this.canvas.height,
      board.width,
      board.height,
      this.dpr,
      this.options,
    );
  }

  get ready(): boolean {
    return this.cssWidth > 0 && this.cssHeight > 0;
  }

  draw(frame: GardenFrame): void {
    if (!this.ready) return;
    const ctx = this.ctx;
    const layout = this.layoutFor(frame.board);
    ctx.drawImage(
      backdrop({
        layout,
        look: frame.look,
        board: frame.board,
        seed: frame.seed,
        grid: frame.grid,
      }),
      0,
      0,
    );
    for (const cell of frame.chewed ?? []) paintChewedRoot(ctx, layout, frame.look, cell);
    if (frame.look.firefly && !frame.night)
      drawFireflies(ctx, layout, frame.look.firefly, frame.time, frame.reducedMotion);
    if (frame.night && frame.body[0]) drawNight(ctx, layout, frame.look, frame.body[0]);
    if (frame.mosaic !== null && frame.mosaic !== undefined) {
      drawMosaic(ctx, layout, frame.look, frame.body, frame.mosaic, frame.reducedMotion);
      drawNoodle(ctx, {
        body: frame.body,
        heading: frame.heading,
        layout,
        look: frame.look,
        time: frame.time,
        mood: 'delight',
        tint: mosaicTint(frame.mosaic, frame.reducedMotion),
        tunnelPartner: (c) => frame.board.tunnelExit.get(c.y * frame.board.width + c.x) ?? null,
        coverHole: (c) => paintTunnelMouth(ctx, layout, frame.look, frame.board, c),
        reducedMotion: frame.reducedMotion,
      });
      if (frame.body[0]) drawRipple(ctx, layout, frame.body[0], frame.mosaic, frame.reducedMotion);
      return;
    }
    const digitCentre = frame.digit
      ? {
          x: layout.left + (frame.digit.at.x + 0.5) * layout.cell,
          y: layout.top + (frame.digit.at.y + 0.5) * layout.cell,
        }
      : null;
    if (frame.digit && digitCentre) {
      drawFruit(ctx, digitCentre.x, digitCentre.y, frame.digit.value, layout.cell, frame.look, {
        time: frame.time,
        appear: frame.digitAge === undefined ? 1 : Math.min(1, frame.digitAge / 0.35),
        shapes: frame.shapes,
        reducedMotion: frame.reducedMotion,
      });
    }
    // Juice splashes out from under the head, so the face stays clear.
    drawBursts(ctx, layout, frame.look, frame.bursts ?? [], frame.time);
    drawNoodle(ctx, {
      body: frame.body,
      heading: frame.heading,
      layout,
      look: frame.look,
      time: frame.time,
      bulges: frame.bulges,
      pulse: frame.pulse,
      lookAt: digitCentre,
      tunnelPartner: (c) => frame.board.tunnelExit.get(c.y * frame.board.width + c.x) ?? null,
      coverHole: (c) => paintTunnelMouth(ctx, layout, frame.look, frame.board, c),
      mood: frame.mood,
      sag: frame.sag,
      lead: frame.lead,
      vacated: frame.vacated,
      reducedMotion: frame.reducedMotion,
    });
    drawPopups(ctx, layout, frame.look, frame.popups ?? [], frame.time);
    if (frame.bonk && frame.body[0])
      drawBonk(
        ctx,
        layout,
        frame.body[0],
        frame.bonk.at,
        frame.bonk.age,
        frame.time,
        frame.reducedMotion,
      );
  }
}

/**
 * The night garden: everything sinks into the dark except a pool of light round the noodle's
 * head. The digits and the noodle are drawn afterwards, so they glow through it. By day the
 * dark is a deep dusk blue; in Glow Soil it is nearly black.
 */
function drawNight(ctx: CanvasRenderingContext2D, layout: Layout, look: Look, head: Cell): void {
  const x = layout.left + (head.x + 0.5) * layout.cell;
  const y = layout.top + (head.y + 0.5) * layout.cell;
  const dark = look.dark ? '6, 3, 16' : '18, 22, 58';
  const light = ctx.createRadialGradient(x, y, layout.cell * 1.6, x, y, layout.cell * 4.2);
  light.addColorStop(0, `rgba(${dark}, 0)`);
  light.addColorStop(1, `rgba(${dark}, ${look.dark ? 0.93 : 0.88})`);
  ctx.save();
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, layout.width, layout.height);
  // The edge of the bed stays faintly lit: the walls are never a surprise in the dark.
  ctx.strokeStyle = look.bedRim;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = Math.max(2, layout.cell * 0.08);
  ctx.beginPath();
  ctx.roundRect(
    layout.left,
    layout.top,
    layout.cols * layout.cell,
    layout.rows * layout.cell,
    layout.cell * 0.3,
  );
  ctx.stroke();
  ctx.restore();
}

/** Fireflies drifting over the grass at night, each on its own slow loop, blinking. */
function drawFireflies(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  colour: string,
  time: number,
  still: boolean,
): void {
  const count = Math.max(8, Math.round(layout.width / (110 * layout.dpr)));
  const t = still ? 0 : time;
  ctx.save();
  for (let i = 0; i < count; i++) {
    const seed = i * 12.9898;
    const baseX = (((Math.sin(seed) * 43758.5453) % 1) + 1) % 1;
    const x = (baseX + Math.sin(t * 0.13 + i) * 0.03) * layout.width;
    const y =
      layout.surface -
      layout.cell * (0.4 + ((((Math.sin(seed * 1.7) * 1000) % 1) + 1) % 1) * 1.6) +
      Math.sin(t * 0.9 + i * 2) * layout.cell * 0.25;
    const blink = 0.35 + 0.65 * Math.max(0, Math.sin(t * 1.7 + i * 1.3));
    const r = layout.cell * 0.07;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 6);
    glow.addColorStop(0, colour);
    glow.addColorStop(1, 'rgba(246, 245, 138, 0)');
    ctx.globalAlpha = blink * 0.6;
    ctx.fillStyle = glow;
    ctx.fillRect(x - r * 6, y - r * 6, r * 12, r * 12);
    ctx.globalAlpha = blink;
    ctx.fillStyle = '#ffffe0';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
