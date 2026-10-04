import { cascadeShowcase } from '../game/showcase';
import { BoardView, type ViewScene } from './board-view';
import type { Look } from './look';

/**
 * The key art for the Hall: a board mid-cascade, the double cross just played: the pair handed
 * back still flashing, the scissors' cut across the chain, and the next chain falling box by box.
 * Neon by night, chalk by day, from the game's own renderer.
 */
export function drawPoster(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  look: Look,
  animate: boolean,
) {
  const view = new BoardView(canvas);
  const ratio = canvas.width / Math.max(1, width) || 1;
  const margin = Math.min(width, height) * 0.04;
  view.layout(
    width,
    height,
    { x: margin, y: margin, width: width - margin * 2, height: height - margin * 2 },
    ratio,
  );
  view.maxSpacing = 400;
  const show = cascadeShowcase();
  const trail = show.cascade.boxes.slice(show.taken);
  const falling = show.cascade.boxes[show.taken - 1]!;
  const scene = (time: number): ViewScene => {
    // The cascade keeps falling on a loop when animated: the last taken box fills again and again.
    const fill = animate ? (time % 1.6) / 1.2 : 0.45;
    return {
      board: show.board,
      look,
      marks: ['star', 'cap'],
      lens: null,
      cursor: null,
      hover: null,
      drawing: null,
      filling: new Map([[falling, Math.min(1, fill)]]),
      lineAges: new Map(),
      doubleCross: { domino: show.domino, cutEdge: show.cutEdge, cut: 0.6, trail, falling },
      seed: 11,
    };
  };
  let frame = 0;
  const started = performance.now();
  const paint = (now: number) => {
    const time = animate ? (now - started) / 1000 : 2.4;
    view.render(scene(time), time);
    if (animate) frame = requestAnimationFrame(paint);
  };
  paint(started);
  return { stop: () => cancelAnimationFrame(frame) };
}
