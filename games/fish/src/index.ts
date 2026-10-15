import './ui/fish.css';
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
import { FishApp } from './app/app';
import { PACKAGES } from './modes/packages';
import { DemoPond } from './play/demo';
import { lookFor } from './render/look';
import { PosterPainter } from './render/poster';

/**
 * Gone Fishing for the Hall: the game itself, a silent demo of the pond playing itself for the
 * attract mode, and the key art. The Hall loads the fonts every native game shares; nothing
 * here fetches anything.
 */

function mount(host: HTMLElement, context: GameContext): GameInstance {
  const app = new FishApp(host, context);
  return {
    unmount: () => app.destroy(),
    playAgain: () => app.playAgain(),
  };
}

function demo(seed: string, appearance: AppearanceState): DemoHandle {
  const pond = new DemoPond(
    seed,
    lookFor(appearance.appearance === 'dark'),
    appearance.reducedMotion,
  );
  // No position of its own: the Hall places the element over the tile.
  const element = pond.element;
  element.style.position = 'relative';
  element.style.width = '100%';
  element.style.height = '100%';
  const observer = new ResizeObserver(() => {
    const box = element.getBoundingClientRect();
    if (box.width > 0)
      pond.resize(Math.round(box.width), Math.round(box.height), window.devicePixelRatio || 1);
  });
  observer.observe(element);
  pond.start();
  return {
    element,
    setAppearance(state) {
      pond.setLook(lookFor(state.appearance === 'dark'), state.reducedMotion);
    },
    setVisible(visible) {
      pond.setVisible(visible);
    },
    destroy() {
      observer.disconnect();
      pond.destroy();
      element.remove();
    },
  };
}

/** Key art: a golden koi leaping from the moonlit pond (the morning pond by day). */
function poster(canvas: HTMLCanvasElement, options: PosterOptions): PosterHandle {
  const painter = new PosterPainter(lookFor(options.appearance === 'dark'));
  const ctx = canvas.getContext('2d')!;
  const scale = canvas.width / options.width;
  if (!options.animate) {
    painter.paint(ctx, options.width, options.height, scale, 1.2);
    return { stop() {} };
  }
  let stopped = false;
  let frame = 0;
  const started = performance.now();
  const tick = () => {
    if (stopped) return;
    painter.paint(
      ctx,
      options.width,
      options.height,
      scale,
      1.2 + (performance.now() - started) / 1000,
    );
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
