import { drawFish, fishPoint } from './fish/draw';
import { speciesFor } from './fish/species';
import type { Look } from './look';
import { type PondScene, PondView } from './pond-view';
import { drawSpray } from './cast';
import { star } from './rivals/common';

/**
 * Key art for Console Home and Holo Collection: a golden koi leaping from the pond, the moon
 * on the water by night (the morning sun by day), the three rivals watching from the far bank
 * and the pile waiting on its lily pad. Drawn with the game's own painters.
 */
export class PosterPainter {
  private readonly view: PondView;
  private width = 0;
  private height = 0;

  constructor(private readonly look: Look) {
    this.view = new PondView(look);
  }

  paint(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    scale: number,
    time: number,
  ): void {
    if (width !== this.width || height !== this.height) {
      this.width = width;
      this.height = height;
      this.view.resize(width, height, scale, { poster: true });
    }
    const layout = this.view.layout;
    const splashAt = {
      x: layout.pond.cx + layout.pond.rx * 0.08,
      y: layout.pond.cy + layout.pond.ry * 0.28,
    };
    const scene: PondScene = {
      time,
      rivals: [
        { kind: 'otter', mood: 'delighted', moodAge: 3, cards: 5 },
        { kind: 'heron', mood: 'idle', moodAge: 3, cards: 6 },
        { kind: 'cat', mood: 'thinking', moodAge: 3, cards: 5 },
      ],
      pond: 24,
      hand: [],
      bucket: [],
      hideBucket: true,
      ripples: [
        { ...splashAt, start: time - 0.4, strength: 1.4 },
        { ...splashAt, start: time - 1.3, strength: 1.2 },
      ],
      motion: 1,
    };
    this.view.draw(scene);
    ctx.save();
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    this.view.composite(ctx, width, height);
    drawLeapingKoi(ctx, this.look, splashAt, Math.min(width * 0.36, height * 0.62), time, layout.s);
    ctx.restore();
  }
}

function drawLeapingKoi(
  ctx: CanvasRenderingContext2D,
  look: Look,
  splashAt: { x: number; y: number },
  length: number,
  time: number,
  s: number,
): void {
  const bob = Math.sin(time * 1.4) * length * 0.03;
  const place = {
    x: splashAt.x + length * 0.12,
    y: splashAt.y - length * 0.62 + bob,
    length,
    angle: -0.55,
    pose: { arch: 0.75, wiggle: 0.35, phase: time * 6 },
    golden: true,
    gold: look.gold,
    time,
  };
  const glow = ctx.createRadialGradient(place.x, place.y, 0, place.x, place.y, length * 0.75);
  glow.addColorStop(0, look.dark ? 'rgba(255, 214, 120, 0.5)' : 'rgba(255, 246, 210, 0.6)');
  glow.addColorStop(1, 'rgba(255, 220, 120, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(place.x - length, place.y - length, length * 2, length * 2);
  // Drops shaken from the tail as it clears the water.
  drawSpray(ctx, splashAt, 0.28 + (time % 0.5) * 0.2, look, Math.max(0.6, s * 1.6), 1.6);
  drawFish(ctx, speciesFor(13), place);
  ctx.fillStyle = look.gold.shine;
  for (let i = 0; i < 9; i++) {
    const [x, y] = fishPoint(place, -40 + i * 11, Math.sin(i * 2.1) * 22);
    const twinkle = (Math.sin(time * 5 + i * 1.9) + 1) / 2;
    star(
      ctx,
      x + Math.cos(i * 1.7) * length * 0.18,
      y + Math.sin(i * 2.9) * length * 0.16,
      (3 + twinkle * 6) * Math.max(0.6, s * 1.4),
    );
    ctx.fill();
  }
}
