import type { PosterHandle, PosterOptions } from '@usr-games/kit';
import { paintBeachScene } from './beach-view';
import { castleAfter } from './castle-model';
import { NO_EFFECTS } from './effects';
import { beachLayout } from './layout';
import { FULL_LIFE } from './life';
import { paletteFor } from './palette';
import { NO_PROPS } from './props';
import { paintSandWord } from './sand-word';
import { paintPaintedSea } from './painted-sea';
import { QUIET_SEA, SeaRenderer } from './sea';

/**
 * Key art for Console Home and Holo Collection: the castle in full dress at the water's edge,
 * by moonlight with glowing breakers (dark) or at midday (light), the title's first word in
 * the sand. The water is rendered by the same shader on a canvas of its own and copied in;
 * its GPU context is released as soon as the poster stops.
 */
export function drawPoster(canvas: HTMLCanvasElement, options: PosterOptions): PosterHandle {
  const ctx = canvas.getContext('2d')!;
  const { width, height } = options;
  const ratio = canvas.width / Math.max(1, width);
  const palette = paletteFor(options.appearance === 'dark' ? 'moonlit' : 'midday');
  const layout = beachLayout(width, height, 6, { compact: true });
  const water = document.createElement('canvas');
  const sea = SeaRenderer.create(water);
  const castle = {
    ...castleAfter(0, 12),
    windowsLit: options.appearance === 'dark' ? 1 : 0,
    flagUnfurl: 0.6,
  };
  let frame = 0;
  let stopped = false;
  const started = performance.now();

  const draw = (now: number) => {
    const time = 3.4 + (options.animate ? (now - started) / 1000 : 0);
    const seaState = { ...QUIET_SEA, time, surgeX: 0.5, swell: 0.55, swellGlow: 1 };
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    if (sea) {
      sea.render(layout, palette, seaState, ratio);
      ctx.drawImage(water, 0, 0, width, height);
    } else {
      paintPaintedSea(ctx, layout, palette, seaState);
    }
    paintBeachScene(ctx, layout, palette, {
      time,
      sea: seaState,
      castle,
      props: NO_PROPS,
      life: FULL_LIFE,
      effects: { ...NO_EFFECTS, swell: 0.55 },
    });
    paintSandWord(ctx, layout, palette, [...'before']);
    if (options.animate && !stopped) frame = requestAnimationFrame(draw);
  };
  draw(started);
  if (!options.animate) sea?.dispose();
  return {
    stop() {
      stopped = true;
      cancelAnimationFrame(frame);
      sea?.dispose();
    },
  };
}
