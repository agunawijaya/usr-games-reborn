import type { Look } from './palette';
import { circle, type Ctx, easeOutCubic, withAlpha } from './shapes';

/**
 * Short-lived flourishes: dust puffs, sparkles, fur, and comic words. Each effect knows its own
 * lifetime and draws itself from the time since it started; none of them carries information
 * that is not also shown in the panel, so reduced motion can simply skip most of them.
 */

interface Effect {
  readonly start: number;
  readonly duration: number;
  draw(ctx: Ctx, t: number): void;
}

const DISPLAY_FONT =
  "'Fredoka Variable', 'Fredoka', 'Atkinson Hyperlegible Next', system-ui, sans-serif";

export class Effects {
  private list: Effect[] = [];

  constructor(private look: Look) {}

  setLook(look: Look) {
    this.look = look;
  }

  clear() {
    this.list = [];
  }

  get busy(): boolean {
    return this.list.length > 0;
  }

  draw(ctx: Ctx, now: number) {
    this.list = this.list.filter((e) => now - e.start < e.duration);
    for (const effect of this.list) {
      const t = (now - effect.start) / effect.duration;
      if (t >= 0) effect.draw(ctx, t);
    }
  }

  puff(now: number, x: number, y: number, size: number, color?: string, count = 9) {
    const tint =
      color ?? (this.look === 'day' ? 'rgba(160, 140, 120, 0.55)' : 'rgba(200, 196, 240, 0.45)');
    const seeds = Array.from({ length: count }, (_, i) => ({
      angle: (i / count) * Math.PI * 2 + Math.random() * 0.4,
      reach: 0.25 + Math.random() * 0.35,
      r: 0.08 + Math.random() * 0.1,
    }));
    this.list.push({
      start: now,
      duration: 650,
      draw: (ctx, t) => {
        const e = easeOutCubic(t);
        withAlpha(ctx, 1 - t, () => {
          for (const p of seeds) {
            circle(
              ctx,
              x + Math.cos(p.angle) * p.reach * size * e,
              y + Math.sin(p.angle) * p.reach * size * e * 0.7,
              p.r * size * (0.6 + e),
              tint,
            );
          }
        });
      },
    });
  }

  fur(now: number, x: number, y: number, size: number, color: string) {
    const tufts = Array.from({ length: 16 }, (_, i) => ({
      angle: (i / 16) * Math.PI * 2,
      reach: 0.4 + Math.random() * 0.5,
      spin: Math.random() * 6,
    }));
    this.list.push({
      start: now,
      duration: 1200,
      draw: (ctx, t) => {
        const e = easeOutCubic(t);
        withAlpha(ctx, 1 - t * t, () => {
          for (const p of tufts) {
            ctx.save();
            ctx.translate(
              x + Math.cos(p.angle) * p.reach * size * e,
              y + Math.sin(p.angle) * p.reach * size * e - t * size * 0.2,
            );
            ctx.rotate(p.spin * t);
            ctx.beginPath();
            ctx.ellipse(0, 0, size * 0.07, size * 0.03, 0, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.restore();
          }
        });
      },
    });
  }

  sparkle(now: number, x: number, y: number, size: number, color: string) {
    this.list.push({
      start: now,
      duration: 700,
      draw: (ctx, t) => {
        withAlpha(ctx, 1 - t, () => {
          for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2 + t * 2;
            const r = size * (0.2 + t * 0.4);
            star(ctx, x + Math.cos(a) * r, y + Math.sin(a) * r, size * 0.08 * (1 - t * 0.5), color);
          }
        });
      },
    });
  }

  /** A comic word in a burst, popping up over the floor. */
  word(now: number, x: number, y: number, size: number, text: string, fill: string, ink: string) {
    this.list.push({
      start: now,
      duration: 900,
      draw: (ctx, t) => {
        const pop =
          t < 0.18 ? easeOutCubic(t / 0.18) * 1.15 : 1.15 - Math.min(0.15, (t - 0.18) * 0.6);
        withAlpha(ctx, t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1, () => {
          ctx.save();
          ctx.translate(x, y - size * 0.55 - t * size * 0.25);
          ctx.scale(pop, pop);
          burst(ctx, size * 0.5, size * 0.3, fill, ink, size * 0.03);
          ctx.font = `700 ${Math.round(size * 0.26)}px ${DISPLAY_FONT}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = ink;
          ctx.fillText(text, 0, size * 0.01);
          ctx.restore();
        });
      },
    });
  }

  /** The zoom: a streak of fading copies between where the cat was and where it lands. */
  streak(
    now: number,
    from: { x: number; y: number },
    to: { x: number; y: number },
    size: number,
    color: string,
  ) {
    this.list.push({
      start: now,
      duration: 520,
      draw: (ctx, t) => {
        withAlpha(ctx, 1 - t, () => {
          ctx.save();
          ctx.setLineDash([size * 0.12, size * 0.1]);
          ctx.lineDashOffset = -t * size * 2;
          ctx.strokeStyle = color;
          ctx.lineWidth = size * 0.08;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(from.x, from.y);
          const mx = (from.x + to.x) / 2;
          const my = Math.min(from.y, to.y) - size * 1.2;
          ctx.quadraticCurveTo(mx, my, to.x, to.y);
          ctx.stroke();
          ctx.restore();
        });
      },
    });
  }
}

/** An eight-point star, the sparkle's and the dizzy stars' shape. */
export function star(ctx: Ctx, x: number, y: number, r: number, color: string) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const rr = i % 2 === 0 ? r : r * 0.4;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function burst(ctx: Ctx, rx: number, ry: number, fill: string, ink: string, width: number) {
  ctx.beginPath();
  const points = 14;
  for (let i = 0; i <= points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2;
    const k = i % 2 === 0 ? 1 : 0.78;
    ctx.lineTo(Math.cos(a) * rx * k, Math.sin(a) * ry * k);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = ink;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

export { DISPLAY_FONT };
