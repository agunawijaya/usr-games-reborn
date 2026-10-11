import { type Layout, type LayoutKind, layoutFor } from './layout';
import type { Look } from './look';
import type { World } from './world';

/**
 * The canvas behind every screen: sizes itself to its host at the device's pixel ratio (capped
 * at 2), runs the world's frames while visible, and can hold a frozen moment for stills.
 */
export class Stage {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private frame = 0;
  private visible = true;
  private frozenAt: number | null = null;
  private kind: LayoutKind = 'menu';
  layout: Layout;
  private readonly listeners = new Set<(layout: Layout) => void>();
  private readonly observer: ResizeObserver;

  constructor(
    private readonly host: HTMLElement,
    private world: World,
    readonly pixelRatio = Math.min(2, window.devicePixelRatio || 1),
  ) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'ns-stage';
    this.canvas.setAttribute('aria-hidden', 'true');
    host.prepend(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
    this.layout = this.measure();
    this.world.resize(this.layout);
    this.observer = new ResizeObserver(() => this.relayout());
    this.observer.observe(host);
  }

  private measure(): Layout {
    const width = Math.max(320, this.host.clientWidth);
    const height = Math.max(240, this.host.clientHeight);
    this.canvas.width = Math.round(width * this.pixelRatio);
    this.canvas.height = Math.round(height * this.pixelRatio);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    return layoutFor(width, height, this.kind);
  }

  relayout() {
    const width = Math.max(320, this.host.clientWidth);
    const height = Math.max(240, this.host.clientHeight);
    if (
      width === this.layout.width &&
      height === this.layout.height &&
      this.kind === this.layout.kind
    )
      return;
    this.layout = this.measure();
    this.world.resize(this.layout);
    for (const listener of this.listeners) listener(this.layout);
    this.paint();
  }

  setKind(kind: LayoutKind) {
    if (kind === this.kind) return;
    this.kind = kind;
    this.layout = layoutFor(this.layout.width, this.layout.height, kind);
    this.world.resize(this.layout);
    for (const listener of this.listeners) listener(this.layout);
  }

  onLayout(listener: (layout: Layout) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get current(): World {
    return this.world;
  }

  /** Swaps in another world (the player changed theme) and keeps going. */
  setWorld(world: World) {
    this.world.destroy();
    this.world = world;
    world.resize(this.layout);
    this.paint();
  }

  setLook(look: Look, reducedMotion: boolean) {
    this.world.setLook(look, reducedMotion);
    this.paint();
  }

  /** Seconds since the page loaded, or the frozen moment. */
  now(): number {
    return this.frozenAt ?? performance.now() / 1000;
  }

  freeze(at: number) {
    this.frozenAt = at;
    this.paint();
  }

  start() {
    const tick = () => {
      this.frame = requestAnimationFrame(tick);
      if (this.visible) this.paint();
    };
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(tick);
  }

  setVisible(visible: boolean) {
    this.visible = visible;
  }

  paint() {
    this.ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    this.world.draw(this.ctx, this.now());
  }

  destroy() {
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.world.destroy();
    this.canvas.remove();
  }
}
