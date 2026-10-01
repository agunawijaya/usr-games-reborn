import { botOrder } from '../engine/bot';
import { applyOrder } from '../engine/orders';
import { newWatch } from '../engine/setup';
import type { WatchState } from '../engine/types';
import { ChartView } from './chart-view';
import type { Look } from './palette';

/**
 * The Reach keeping itself: a seeded watch played by the steady captain, drawn as the chart of
 * lights. It runs behind the game menu and as the Hall's attract mode, silently, and stands
 * still under reduced motion.
 */

export interface ReachDemo {
  resize(width: number, height: number): void;
  setLook(look: Look, reducedMotion: boolean): void;
  setVisible(visible: boolean): void;
  destroy(): void;
}

function warmedUp(seed: string, orders: number): WatchState {
  let state = newWatch({ seed, rank: 3, length: 1, ruleSet: 'commission' }).state;
  for (let i = 0; i < orders && !state.outcome; i++) {
    const result = applyOrder(state, botOrder(state));
    state = result.accepted ? result.state : applyOrder(state, { type: 'rest', days: 0.3 }).state;
  }
  return state;
}

export function startReachDemo(
  canvas: HTMLCanvasElement,
  look: Look,
  reducedMotion: boolean,
  seed = 'lightkeeper:demo',
  opaque = false,
): ReachDemo {
  const view = new ChartView(canvas, look, reducedMotion);
  view.opaque = opaque;
  let round = 0;
  let state = warmedUp(`${seed}:${round}`, 6);
  view.show(state);
  view.start();
  let visible = true;
  let still = reducedMotion;
  const step = () => {
    if (!visible || still) return;
    if (state.outcome) {
      round++;
      state = warmedUp(`${seed}:${round}`, 4);
      view.show(state);
      return;
    }
    const result = applyOrder(state, botOrder(state));
    const next = result.accepted
      ? result.state
      : applyOrder(state, { type: 'rest', days: 0.3 }).state;
    view.play(state, next, result.beats);
    state = next;
  };
  const timer = window.setInterval(step, 1400);
  return {
    resize: (width, height) => view.resize(width, height),
    setLook(nextLook, nextReduced) {
      view.setLook(nextLook, nextReduced);
      still = nextReduced;
    },
    setVisible(next) {
      visible = next;
      view.setVisible(next);
    },
    destroy() {
      window.clearInterval(timer);
      view.stop();
    },
  };
}

export function startTitleBackdrop(
  canvas: HTMLCanvasElement,
  look: Look,
  reducedMotion: boolean,
): ReachDemo {
  return startReachDemo(canvas, look, reducedMotion, 'lightkeeper:title');
}

/** One still frame of the Reach mid-watch, for the Hall's key art. */
export function drawReachPoster(
  canvas: HTMLCanvasElement,
  look: Look,
  width: number,
  height: number,
) {
  const view = new ChartView(canvas, look, true);
  view.opaque = true;
  view.resize(width, height);
  view.show(warmedUp('lightkeeper:poster', 18));
  view.draw();
  return view;
}
