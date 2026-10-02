import './ui/wump.css';
import type {
  AppearanceState,
  DemoHandle,
  GameContext,
  GameInstance,
  GameModule,
  PackageDefinition,
  PosterOptions,
} from '@usr-games/kit';
import manifest from '../manifest.json';
import { WumpApp } from './app/app';
import { AutoCave, drawKeyArt } from './play/auto';
import { LANTERN_DARK, type Look, SCRAP_PAPER } from './render/look';
import { h } from './ui/dom';

/**
 * Hush the Wumpus for the Hall: the game itself, a silent demo for the attract mode, and the key
 * art. The Hall loads the fonts every native game shares; nothing here fetches anything.
 */

function lookOf(appearance: AppearanceState | PosterOptions['appearance']): Look {
  const dark =
    typeof appearance === 'string' ? appearance === 'dark' : appearance.appearance === 'dark';
  return dark ? LANTERN_DARK : SCRAP_PAPER;
}

function mount(host: HTMLElement, context: GameContext): GameInstance {
  const app = new WumpApp(host, context);
  return {
    unmount: () => app.destroy(),
    playAgain: () => app.playAgain(),
  };
}

/** The Scout exploring a cave on its own, silently, in the Hall's appearance. */
function demo(seed: string, appearance: AppearanceState): DemoHandle {
  const canvas = h('canvas', {
    'aria-hidden': 'true',
    style: 'display:block;width:100%;height:100%',
  });
  // No position of its own: the Hall places the element over the tile.
  const element = h(
    'div',
    { class: 'hw-demo', style: 'width:100%;height:100%;overflow:hidden' },
    canvas,
  );
  const cave = new AutoCave(canvas, `demo:${seed}`, lookOf(appearance));
  const observer = new ResizeObserver(() => cave.draw(performance.now() / 1000));
  observer.observe(element);
  let visible = true;
  if (!appearance.reducedMotion) cave.start();
  return {
    element,
    setAppearance(state) {
      cave.setLook(lookOf(state));
    },
    setVisible(next) {
      if (next === visible) return;
      visible = next;
      if (next && !appearance.reducedMotion) cave.start();
      else cave.stop();
    },
    destroy() {
      observer.disconnect();
      cave.stop();
      element.remove();
    },
  };
}

/** Key art: the wumpus asleep by a lantern, the cave's map sketched round it. */
function poster(canvas: HTMLCanvasElement, options: PosterOptions): { stop(): void } | void {
  const look = lookOf(options.appearance);
  const ctx = canvas.getContext('2d')!;
  const scale = canvas.width / options.width;
  const draw = (time: number) => {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    drawKeyArt(ctx, look, options.width, options.height, time);
  };
  if (!options.animate) {
    draw(2.4);
    return;
  }
  let stopped = false;
  let timer = 0;
  const started = performance.now();
  // The wumpus breathes slowly; a handful of frames a second is plenty and keeps the Hall light.
  const tick = () => {
    if (stopped) return;
    draw((performance.now() - started) / 1000);
    timer = window.setTimeout(() => requestAnimationFrame(tick), 150);
  };
  tick();
  return {
    stop() {
      stopped = true;
      window.clearTimeout(timer);
    },
  };
}

const game: GameModule = {
  mount,
  demo,
  poster,
  achievements: manifest.packages as PackageDefinition[],
};

export default game;
