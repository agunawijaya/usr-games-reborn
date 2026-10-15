import './ui/detour.css';
import './ui/pages.css';
import type {
  AppearanceState,
  DemoHandle,
  GameContext,
  GameInstance,
  GameModule,
  PosterHandle,
  PosterOptions,
} from '@usr-games/kit';
import { DetourApp } from './app/app';
import { PACKAGES } from './modes/packages';
import { DemoRoad } from './play/demo';
import { lookFor } from './render/look';
import { paintPoster } from './render/poster';

/**
 * Detour for the Hall: the game itself, a silent demo for the attract mode, and the key art.
 * The Hall loads the fonts every native game shares; nothing here fetches anything.
 */

function mount(host: HTMLElement, context: GameContext): GameInstance {
  const app = new DetourApp(host, context);
  return {
    unmount: () => app.destroy(),
    playAgain: () => app.playAgain(),
  };
}

/** Classic against Classic on the road, silent, in the Hall's appearance. */
function demo(seed: string, appearance: AppearanceState): DemoHandle {
  const road = new DemoRoad(
    seed,
    lookFor(appearance.appearance === 'dark'),
    appearance.reducedMotion,
  );
  const element = document.createElement('div');
  element.className = 'dt-demo';
  element.style.cssText = 'width:100%;height:100%;overflow:hidden;position:relative';
  element.append(road.canvas);
  let visible = true;
  road.start();
  return {
    element,
    setAppearance(state) {
      road.setLook(lookFor(state.appearance === 'dark'), state.reducedMotion);
    },
    setVisible(next) {
      if (next === visible) return;
      visible = next;
      if (next) road.start();
      else road.stop();
    },
    destroy() {
      road.stop();
      element.remove();
    },
  };
}

/** Key art: both cars on the neon city road, a safety slamming down in gold. */
function poster(canvas: HTMLCanvasElement, options: PosterOptions): PosterHandle {
  const ctx = canvas.getContext('2d')!;
  const scale = canvas.width / options.width;
  const look = lookFor(options.appearance === 'dark');
  const draw = (time: number) => {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    paintPoster(ctx, options.width, options.height, look, time);
  };
  if (!options.animate) {
    draw(1.2);
    return { stop() {} };
  }
  let stopped = false;
  let frame = 0;
  const started = performance.now();
  const tick = () => {
    if (stopped) return;
    draw((performance.now() - started) / 1000);
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
