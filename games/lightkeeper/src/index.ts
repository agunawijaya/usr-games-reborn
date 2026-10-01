import './ui/styles.css';
import type {
  AppearanceState,
  DemoHandle,
  GameContext,
  GameInstance,
  GameModule,
  PosterOptions,
} from '@usr-games/kit';
import { PACKAGES } from './game/packages';
import { drawReachPoster, startReachDemo } from './render/backdrop';
import { App, lookOf } from './ui/app';
import { briefingScreen } from './ui/screens/briefing';
import { helpScreen } from './ui/screens/help';
import { openWatchScreen } from './ui/screens/open-watch';
import { playScreen } from './ui/screens/play';
import { recordScreen } from './ui/screens/record';
import { resultsScreen } from './ui/screens/results';
import { titleScreen } from './ui/screens/title';

/**
 * Lightkeeper: one keeper ship, thirty-two lit worlds and a swarm of mining drones. Inspired by
 * trek from the BSD games. This file is the whole contract with the Hall.
 */

function mount(host: HTMLElement, context: GameContext): GameInstance {
  const app = new App(host, context);
  app.go = {
    title: () => app.show(titleScreen),
    briefing: (watch) => app.show((a) => briefingScreen(a, watch)),
    play: (watch, resume = false) => app.show((a) => playScreen(a, watch, resume)),
    results: (ending) => app.show((a) => resultsScreen(a, ending)),
    record: () => app.show(recordScreen),
    openWatch: () => app.show(openWatchScreen),
    help: () => app.show(helpScreen),
  };
  app.go.title();
  return { unmount: () => app.destroy() };
}

function demo(seed: string, appearance: AppearanceState): DemoHandle {
  const element = document.createElement('div');
  element.style.cssText = 'width:100%;height:100%;overflow:hidden';
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block;width:100%;height:100%';
  canvas.setAttribute('aria-hidden', 'true');
  element.append(canvas);
  const reach = startReachDemo(
    canvas,
    lookOf(appearance),
    appearance.reducedMotion,
    `lightkeeper:demo:${seed}`,
    true,
  );
  const observer = new ResizeObserver(() =>
    reach.resize(element.clientWidth, element.clientHeight),
  );
  observer.observe(element);
  return {
    element,
    setAppearance(state) {
      reach.setLook(lookOf(state), state.reducedMotion);
    },
    setVisible: (visible) => reach.setVisible(visible),
    destroy() {
      observer.disconnect();
      reach.destroy();
    },
  };
}

/** Key art: the Reach mid-watch, every light the steady captain has kept so far. */
function poster(canvas: HTMLCanvasElement, options: PosterOptions) {
  const look = options.appearance === 'dark' ? 'night' : 'chart';
  const view = drawReachPoster(canvas, look, options.width, options.height);
  return { stop: () => view.stop() };
}

const game: GameModule = { mount, demo, poster, achievements: PACKAGES };

export default game;
