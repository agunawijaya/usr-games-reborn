import { type TableLayout, computeLayout } from './layout';
import type { Look } from './look';
import { type RoadFrame, drawRoad } from './road';
import { CardSprites } from './sprites';
import { type TableView, drawTable, paintAtlas } from './table';

export type RoadScene = Omit<RoadFrame, 'x' | 'y' | 'w' | 'h'>;

/**
 * The canvas the whole table is painted on: the road strip, the atlas and everything on it.
 * The atlas is painted once per size and look; the rest is drawn every frame.
 */
export class Stage {
  readonly canvas = document.createElement('canvas');
  private readonly ctx: CanvasRenderingContext2D;
  private atlas: HTMLCanvasElement | null = null;
  private dpr = 1;
  layout: TableLayout = computeLayout(1920, 1080);
  readonly sprites: CardSprites;

  constructor(private look: Look) {
    this.canvas.className = 'dt-canvas';
    this.ctx = this.canvas.getContext('2d')!;
    this.sprites = new CardSprites(look, 1);
  }

  setLook(look: Look): void {
    this.look = look;
    this.sprites.setLook(look, this.dpr);
    this.atlas = null;
  }

  resize(width: number, height: number, dpr: number): void {
    this.dpr = dpr;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.layout = computeLayout(width, height);
    this.sprites.setLook(this.look, dpr);
    this.atlas = null;
  }

  render(
    road: RoadScene,
    table: TableView,
    overlay?: (ctx: CanvasRenderingContext2D, layout: TableLayout) => void,
  ): void {
    const ctx = this.ctx;
    const { width, height } = this.layout;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.drawImage(this.atlasImage(), 0, 0, width, height);
    const r = this.layout.road;
    drawRoad(ctx, { ...road, x: r.x, y: r.y, w: r.w, h: r.h });
    drawTable(ctx, this.layout, table, this.look, this.sprites);
    overlay?.(ctx, this.layout);
  }

  private atlasImage(): HTMLCanvasElement {
    if (this.atlas) return this.atlas;
    const { width, height } = this.layout;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * this.dpr);
    canvas.height = Math.round(height * this.dpr);
    const ctx = canvas.getContext('2d')!;
    ctx.scale(this.dpr, this.dpr);
    ctx.fillStyle = this.look.ui.bar;
    ctx.fillRect(0, 0, width, this.layout.road.y);
    paintAtlas(ctx, width, height, this.look, this.layout.road.y + this.layout.road.h);
    this.atlas = canvas;
    return canvas;
  }
}
