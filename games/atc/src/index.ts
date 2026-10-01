import '@fontsource-variable/fraunces/index.css';
import './ui/skyloom.css';
import './ui/screens.css';
import type {
  AppearanceState,
  DemoHandle,
  GameContext,
  GameInstance,
  GameModule,
  PackageDefinition,
  PosterOptions,
} from '@usr-games/kit';
import { HARBOUR_LIGHTS } from './arenas/harbour-lights';
import { ENDLESS_ARENAS } from './arenas/library';
import { SkyloomApp } from './app/app';
import manifest from '../manifest.json';
import { AutoSky } from './play/auto-sky';
import type { LookId } from './render/look';
import { h } from './ui/dom';
import { hashString } from '@usr-games/kit';

/**
 * Skyloom for the Hall: the game itself, a silent demo for the attract mode and the key art.
 */

function lookOf(appearance: AppearanceState | PosterOptions['appearance']): LookId {
  const dark =
    typeof appearance === 'string' ? appearance === 'dark' : appearance.appearance === 'dark';
  return dark ? 'scope' : 'chart';
}

function mount(host: HTMLElement, context: GameContext): GameInstance {
  const app = new SkyloomApp(host, context);
  return {
    unmount: () => app.destroy(),
    playAgain: () => app.playAgain(),
  };
}

/** A sky that keeps itself, chosen by the seed, drawn in the Hall's appearance; silent. */
function demo(seed: string, appearance: AppearanceState): DemoHandle {
  const canvas = h('canvas', {
    'aria-hidden': 'true',
    style: 'display:block;width:100%;height:100%',
  });
  // No position of its own: the host places the element (the Hall lays previews over the tile).
  const element = h(
    'div',
    { class: 'sk-demo', style: 'width:100%;height:100%;overflow:hidden' },
    canvas,
  );
  const arena = ENDLESS_ARENAS[hashString(seed) % ENDLESS_ARENAS.length]!;
  const sky = new AutoSky(canvas, {
    arena,
    seed: `demo:${seed}`,
    look: lookOf(appearance),
    tickSeconds: 0.9,
    warmUp: 30,
    reducedMotion: appearance.reducedMotion,
  });
  const fit = () => {
    const box = element.getBoundingClientRect();
    if (box.width > 0) sky.resize(box.width, box.height, window.devicePixelRatio || 1);
  };
  const observer = new ResizeObserver(() => {
    fit();
    sky.draw();
  });
  observer.observe(element);
  let visible = true;
  if (!appearance.reducedMotion) sky.start();
  return {
    element,
    setAppearance(state) {
      sky.setLook(lookOf(state));
      sky.draw();
    },
    setVisible(next) {
      if (next === visible) return;
      visible = next;
      if (next && !appearance.reducedMotion) sky.start();
      else sky.stop();
    },
    destroy() {
      observer.disconnect();
      sky.stop();
      element.remove();
    },
  };
}

/** Key art: a tilted sky at dusk, its routes hanging as ribbons, leaning in on the harbour. */
function poster(canvas: HTMLCanvasElement, options: PosterOptions): { stop(): void } | void {
  const sky = new AutoSky(canvas, {
    arena: HARBOUR_LIGHTS,
    seed: `poster:${options.seed}`,
    look: lookOf(options.appearance),
    tickSeconds: 1.2,
    tilt: 1,
    focus: { x: 16, y: 11, altitude: 2, zoom: 1.35 },
    warmUp: 60,
  });
  const scale = canvas.width / options.width;
  sky.resize(options.width, options.height, scale);
  if (!options.animate) {
    sky.draw();
    return;
  }
  sky.start();
  return { stop: () => sky.stop() };
}

const game: GameModule = {
  mount,
  demo,
  poster,
  achievements: manifest.packages as PackageDefinition[],
};

export default game;
