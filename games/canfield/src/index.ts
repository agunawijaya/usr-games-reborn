import './ui/thirteen.css';
import './ui/screens.css';
import type {
  AppearanceState,
  DemoHandle,
  GameContext,
  GameInstance,
  GameModule,
  PosterHandle,
  PosterOptions,
} from '@usr-games/kit';
import { ThirteenApp } from './app/app';
import { PACKAGES } from './modes/packages';
import { DemoTable } from './play/demo';
import { lookFor } from './render/look';
import { PosterPainter } from './render/poster';
import { h } from './ui/dom';

/**
 * Thirteen Down for the Hall: the game itself, a silent demo for the attract mode, and the key
 * art. The Hall loads the fonts every native game shares; nothing here fetches anything.
 */

function mount(host: HTMLElement, context: GameContext): GameInstance {
  const app = new ThirteenApp(host, context);
  return {
    unmount: () => app.destroy(),
    playAgain: () => app.playAgain(),
  };
}

/** A deal the solver has won, playing itself, silently, in the Hall's appearance. */
function demo(seed: string, appearance: AppearanceState): DemoHandle {
  const table = new DemoTable(
    seed,
    lookFor(appearance.appearance === 'dark'),
    appearance.reducedMotion,
  );
  // No position of its own: the Hall places the element over the tile.
  const element = h(
    'div',
    { class: 'td-demo', style: 'width:100%;height:100%;overflow:hidden;position:relative' },
    table.view.element,
  );
  const observer = new ResizeObserver(() => {
    const box = element.getBoundingClientRect();
    if (box.width > 0)
      table.resize(Math.round(box.width), Math.round(box.height), window.devicePixelRatio || 1);
  });
  observer.observe(element);
  let visible = true;
  table.start();
  return {
    element,
    setAppearance(state) {
      table.setLook(lookFor(state.appearance === 'dark'), state.reducedMotion);
    },
    setVisible(next) {
      if (next === visible) return;
      visible = next;
      if (next) table.start();
      else table.stop();
    },
    destroy() {
      observer.disconnect();
      table.stop();
      element.remove();
    },
  };
}

/** Key art: the four queens fanned over the table, one lotus opening behind them. */
function poster(canvas: HTMLCanvasElement, options: PosterOptions): PosterHandle {
  const painter = new PosterPainter(lookFor(options.appearance === 'dark'));
  const ctx = canvas.getContext('2d')!;
  const scale = canvas.width / options.width;
  const draw = (time: number, bloom: number) =>
    painter.paint(ctx, options.width, options.height, scale, { time, bloom });
  if (!options.animate) {
    draw(0, 8.6);
    return { stop() {} };
  }
  let stopped = false;
  let frame = 0;
  const started = performance.now();
  const tick = () => {
    if (stopped) return;
    const time = (performance.now() - started) / 1000;
    draw(time, Math.min(13, 4 + (time % 16)));
    frame = requestAnimationFrame(tick);
  };
  tick();
  return {
    stop() {
      stopped = true;
      cancelAnimationFrame(frame);
    },
  };
}

const game: GameModule = {
  mount,
  demo,
  poster,
  achievements: PACKAGES,
};

export default game;
