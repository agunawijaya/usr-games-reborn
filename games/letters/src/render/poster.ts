import type { PosterHandle, PosterOptions } from '@usr-games/kit';
import { ATTRACT_BOARDS } from './attract-boards';
import { rollOf } from './attract';
import { BoardView } from './board-view';
import { paletteFor } from './palette';

/**
 * Key art for Console Home and Holo Collection: cubes caught mid-tumble above the tray, glass
 * over a glowing grid by night, pastel by day. Drawn by the game's own renderer on a board view
 * kept off screen, then copied into the Hall's canvas; its GPU context goes when the poster stops.
 */
const MOMENT = 0.66;
const LOOP_SECONDS = 4.2;

export function drawPoster(canvas: HTMLCanvasElement, options: PosterOptions): PosterHandle {
  const ctx = canvas.getContext('2d')!;
  const { width, height } = options;
  const view = new BoardView(
    paletteFor(options.appearance === 'dark' ? 'arcade' : 'studio'),
    false,
  );
  view.setVisible(false);
  view.element.style.cssText = `position:fixed;left:-${width + 100}px;top:0;width:${width}px;height:${height}px;pointer-events:none`;
  document.body.append(view.element);
  view.resizeTo(width, height);
  view.setBoardRect({
    x: width * 0.16,
    y: height * 0.16,
    width: width * 0.68,
    height: height * 0.8,
  });
  const seed = [...options.seed].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const showcase = ATTRACT_BOARDS[seed % ATTRACT_BOARDS.length]!;
  let frame = 0;
  let stopped = false;
  const start = performance.now();

  const paint = (now: number) => {
    const t = options.animate ? ((now - start) / 1000) % LOOP_SECONDS : MOMENT;
    view.freeze(100);
    view.setRoll(rollOf(showcase), 13, true);
    view.freeze(100 + t);
    view.draw();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    view.copyTo(ctx, canvas.width, canvas.height);
    if (options.animate && !stopped) frame = requestAnimationFrame(paint);
  };
  paint(start);
  const stop = () => {
    stopped = true;
    cancelAnimationFrame(frame);
    view.destroy();
  };
  if (!options.animate) stop();
  return { stop };
}
