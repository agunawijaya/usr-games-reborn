import type { Span } from './room';

/**
 * The design frame: everything is composed at 1920 × 1080 and scaled to fit the screen's height
 * or width, whichever is tighter. Extra width shows more wall and desk at the sides; extra height
 * shows more wall above, so the desk's front edge always sits on the bottom of the screen.
 */
export const DESIGN_WIDTH = 1920;
export const DESIGN_HEIGHT = 1080;

export interface DesignFrame {
  /** Screen size in CSS pixels. */
  width: number;
  height: number;
  /** CSS pixels per design pixel. */
  scale: number;
  /** Where the design frame's origin lands on screen, in CSS pixels. */
  offsetX: number;
  offsetY: number;
  /** The design-space columns that are visible. */
  span: Span;
  /** The design-space row at the top of the screen (zero or less). */
  top: number;
}

export function designFrame(width: number, height: number): DesignFrame {
  const scale = Math.min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT);
  const offsetX = (width - DESIGN_WIDTH * scale) / 2;
  const offsetY = height - DESIGN_HEIGHT * scale;
  return {
    width,
    height,
    scale,
    offsetX,
    offsetY,
    span: { left: -offsetX / scale, right: (width - offsetX) / scale },
    top: -offsetY / scale,
  };
}

/** Converts a design-space point to screen CSS pixels. */
export function toScreen(frame: DesignFrame, x: number, y: number): { x: number; y: number } {
  return { x: frame.offsetX + x * frame.scale, y: frame.offsetY + y * frame.scale };
}

/** Converts a screen CSS-pixel point to design space. */
export function toDesign(frame: DesignFrame, x: number, y: number): { x: number; y: number } {
  return { x: (x - frame.offsetX) / frame.scale, y: (y - frame.offsetY) / frame.scale };
}

/**
 * A full-size canvas kept at the device's pixel ratio. `paint` hands the painter a context
 * already transformed to the design frame.
 */
export class DesignCanvas {
  readonly element: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  frame: DesignFrame = designFrame(DESIGN_WIDTH, DESIGN_HEIGHT);
  ratio = 1;

  constructor(className = '') {
    this.element = document.createElement('canvas');
    this.element.className = className;
    this.element.setAttribute('aria-hidden', 'true');
    this.ctx = this.element.getContext('2d', { alpha: false })!;
  }

  resize(width: number, height: number, ratio = Math.min(2, window.devicePixelRatio || 1)) {
    this.ratio = ratio;
    this.element.width = Math.max(1, Math.round(width * ratio));
    this.element.height = Math.max(1, Math.round(height * ratio));
    this.element.style.width = `${width}px`;
    this.element.style.height = `${height}px`;
    this.frame = designFrame(width, height);
  }

  paint(painter: (ctx: CanvasRenderingContext2D, frame: DesignFrame) => void) {
    const { ctx, frame } = this;
    ctx.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    ctx.translate(frame.offsetX, frame.offsetY);
    ctx.scale(frame.scale, frame.scale);
    painter(ctx, frame);
  }
}

/**
 * An offscreen layer the size of the screen, painted once in the design frame and copied each
 * frame: the parts of a scene that do not move.
 */
export class CachedLayer {
  private canvas: HTMLCanvasElement | null = null;
  private key = '';

  /** Returns the layer, repainting it only when `key` or the screen changed. */
  get(
    frame: DesignFrame,
    ratio: number,
    key: string,
    paint: (ctx: CanvasRenderingContext2D) => void,
  ): HTMLCanvasElement {
    const full = `${key}|${frame.width}x${frame.height}@${ratio}`;
    if (this.canvas && this.key === full) return this.canvas;
    const canvas = this.canvas ?? document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(frame.width * ratio));
    canvas.height = Math.max(1, Math.round(frame.height * ratio));
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.translate(frame.offsetX, frame.offsetY);
    ctx.scale(frame.scale, frame.scale);
    paint(ctx);
    this.canvas = canvas;
    this.key = full;
    return canvas;
  }

  invalidate() {
    this.key = '';
  }
}

/** Copies a cached layer onto a context that is in the design frame. */
export function blit(ctx: CanvasRenderingContext2D, layer: HTMLCanvasElement) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(layer, 0, 0);
  ctx.restore();
}
