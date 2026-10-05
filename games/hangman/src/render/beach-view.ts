import { paintCastle } from './castle';
import type { CastleState } from './castle-model';
import { type BeachLayout } from './layout';
import { type BeachPalette } from './palette';
import { paintPaintedSea } from './painted-sea';
import { type BeachProps, paintBackProps, paintFrontProps } from './props';
import { type BeachLife, paintLife } from './life';
import { type Effects, paintEffects } from './effects';
import { type SeaState, SeaRenderer } from './sea';

/** Everything the beach shows in one frame. */
export interface BeachFrame {
  time: number;
  /** Reduced motion: sections cross-fade instead of sinking. */
  still?: boolean;
  sea: SeaState;
  castle: CastleState;
  props: BeachProps;
  life: BeachLife;
  effects: Effects;
}

/**
 * Two stacked canvases: the WebGL water and sand underneath, and a Canvas 2D layer on top for
 * the castle, the creatures, the props and the effects. Without WebGL the 2D layer paints a
 * simpler sea itself.
 */
export class BeachView {
  readonly element: HTMLDivElement;
  private readonly seaCanvas: HTMLCanvasElement;
  private readonly paintCanvas: HTMLCanvasElement;
  private readonly sea: SeaRenderer | null;
  private readonly ctx: CanvasRenderingContext2D;

  constructor(private pixelRatio = Math.min(1.5, window.devicePixelRatio || 1)) {
    this.element = document.createElement('div');
    this.element.className = 'bt-beach';
    this.element.setAttribute('aria-hidden', 'true');
    this.seaCanvas = document.createElement('canvas');
    this.paintCanvas = document.createElement('canvas');
    for (const canvas of [this.seaCanvas, this.paintCanvas]) {
      canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
      this.element.append(canvas);
    }
    this.sea = SeaRenderer.create(this.seaCanvas);
    this.ctx = this.paintCanvas.getContext('2d')!;
  }

  get usesWebGl(): boolean {
    return this.sea !== null;
  }

  /** Draws one frame; `extra` paints on top of the 2D layer (the attract loop's word). */
  render(
    layout: BeachLayout,
    palette: BeachPalette,
    frame: BeachFrame,
    extra?: (ctx: CanvasRenderingContext2D) => void,
  ) {
    const ratio = this.pixelRatio;
    const width = Math.round(layout.width * ratio);
    const height = Math.round(layout.height * ratio);
    if (this.paintCanvas.width !== width || this.paintCanvas.height !== height) {
      this.paintCanvas.width = width;
      this.paintCanvas.height = height;
    }
    const { ctx } = this;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, layout.width, layout.height);
    if (this.sea) this.sea.render(layout, palette, frame.sea, ratio);
    else paintPaintedSea(ctx, layout, palette, frame.sea);
    paintBeachScene(ctx, layout, palette, frame);
    extra?.(ctx);
  }

  destroy() {
    this.sea?.dispose();
    this.element.remove();
  }
}

/** The 2D layer, shared with the poster painter. */
export function paintBeachScene(
  ctx: CanvasRenderingContext2D,
  layout: BeachLayout,
  palette: BeachPalette,
  frame: BeachFrame,
) {
  paintBackProps(ctx, layout, palette, frame.props, frame.time);
  paintLife(ctx, layout, palette, frame.life, frame.time, 'behind');
  paintEffects(ctx, layout, palette, frame.effects, frame.time, 'behind');
  paintCastle(ctx, layout.castle, palette, frame.castle, frame.time, frame.still ?? false);
  paintEffects(ctx, layout, palette, frame.effects, frame.time, 'front');
  paintLife(ctx, layout, palette, frame.life, frame.time, 'front');
  paintFrontProps(ctx, layout, palette, frame.props, frame.time);
}
