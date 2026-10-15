import { CARD_ASPECT, drawCardFace } from './card-art';
import { RESTING } from './car';
import type { Look } from './look';
import { drawRoad } from './road';
import type { Route } from './routes';
import { paintAtlas } from './table';

/**
 * Behind the menus: the road atlas, and above it the route with both cars cruising side by side
 * for ever, the camera keeping pace. Still under reduced motion.
 */
export class Backdrop {
  readonly canvas = document.createElement('canvas');
  private frame = 0;
  private started = performance.now();
  private atlas: HTMLCanvasElement | null = null;

  constructor(
    private look: Look,
    private route: Route,
    private reduced: () => boolean,
  ) {
    this.canvas.className = 'dt-backdrop-art';
    this.canvas.setAttribute('aria-hidden', 'true');
  }

  set(look: Look, route: Route): void {
    this.look = look;
    this.route = route;
    this.atlas = null;
  }

  start(): void {
    cancelAnimationFrame(this.frame);
    const tick = () => {
      this.paint();
      if (!this.reduced()) this.frame = requestAnimationFrame(tick);
    };
    tick();
  }

  stop(): void {
    cancelAnimationFrame(this.frame);
  }

  /** A fan of the deck's families lying on the atlas, lower right. */
  private fan(ctx: CanvasRenderingContext2D, w: number, h: number, roadH: number): void {
    const cardH = Math.min((h - roadH) * 0.66, w * 0.14);
    const cardW = cardH / CARD_ASPECT;
    const cx = w * 0.69;
    const cy = roadH + (h - roadH) * 0.52;
    const kinds = ['m200', 'flatTyre', 'greenWave', 'spareTyre', 'greenLight'] as const;
    kinds.forEach((kind, i) => {
      const angle = (i - 2) * 0.11;
      ctx.save();
      ctx.translate(cx + (i - 2) * cardW * 0.78, cy + Math.abs(i - 2) * cardH * 0.05);
      ctx.rotate(angle);
      ctx.shadowColor = this.look.table.shadow;
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 8;
      ctx.fillStyle = this.look.card.paper;
      ctx.fillRect(-cardW / 2 + 4, -cardH / 2 + 4, cardW - 8, cardH - 8);
      ctx.shadowColor = 'transparent';
      ctx.translate(-cardW / 2, -cardH / 2);
      drawCardFace(ctx, kind, cardW, cardH, this.look.card);
      ctx.restore();
    });
  }

  private paint(): void {
    const box = this.canvas.parentElement?.getBoundingClientRect();
    if (!box || box.width === 0) return;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(box.width);
    const h = Math.round(box.height);
    if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) {
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
      this.canvas.style.width = `${w}px`;
      this.canvas.style.height = `${h}px`;
      this.atlas = null;
    }
    const ctx = this.canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const roadH = Math.min(h * 0.6, w * 0.34);
    if (!this.atlas) {
      const atlas = document.createElement('canvas');
      atlas.width = this.canvas.width;
      atlas.height = this.canvas.height;
      const a = atlas.getContext('2d')!;
      a.scale(dpr, dpr);
      paintAtlas(a, w, h, this.look, roadH);
      this.fan(a, w, h, roadH);
      this.atlas = atlas;
    }
    ctx.drawImage(this.atlas, 0, 0, w, h);
    const time = this.reduced() ? 3 : (performance.now() - this.started) / 1000;
    const pace = 70;
    const lead = 180 + time * pace;
    const span = 520;
    const car = (side: 0 | 1, miles: number) => ({
      model: side === 0 ? ('roadster' as const) : ('coupe' as const),
      ink: this.look.cars[side],
      miles,
      shownMiles: Math.round(miles / 25) * 25,
      pose: {
        ...RESTING,
        time,
        lights: this.look.dark,
        wind: 0.9,
        wheelTurn: miles / 9,
        bob: Math.sin(time * 14) * 0.5,
      },
      trouble: null,
      slowed: false,
      greenFlash: 0,
      tag: this.look.cars[side].tag,
      speed: this.reduced() ? 0 : 0.85,
      hideTag: true,
    });
    drawRoad(ctx, {
      route: this.route,
      night: this.look.dark,
      x: 0,
      y: 0,
      w,
      h: roadH,
      left: lead - span * 0.62,
      span,
      end: 100_000,
      passedFlag: null,
      time,
      cars: [
        car(0, lead + Math.sin(time * 0.4) * 30),
        car(1, lead - 60 + Math.sin(time * 0.31 + 1) * 40),
      ],
      puffs: [],
      slowMo: 0,
    });
  }
}
