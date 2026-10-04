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
import { startDemo } from './render/demo';
import { App, lookOf } from './ui/app';
import { aftermathScreen } from './ui/screens/aftermath';
import { battleScreen } from './ui/screens/battle';
import { briefingScreen } from './ui/screens/briefing';
import { dockyardScreen } from './ui/screens/dockyard';
import { epilogueScreen } from './ui/screens/epilogue';
import { helpScreen } from './ui/screens/help';
import { launchScreen } from './ui/screens/launch';
import { logScreen } from './ui/screens/log';
import { openScreen } from './ui/screens/open';
import { titleScreen } from './ui/screens/title';
import { voyageScreen } from './ui/screens/voyage';

/**
 * Figurehead: the life of one sailing ship, from her launch to her last voyage. Inspired by
 * sail from the BSD games. This file is the whole contract with the Hall.
 */

function mount(host: HTMLElement, context: GameContext): GameInstance {
  const app = new App(host, context);
  app.go = {
    title: () => app.show(titleScreen),
    launch: () => app.show(launchScreen),
    voyage: () => app.show(voyageScreen),
    briefing: (mode) => app.show((a) => briefingScreen(a, mode)),
    battle: (mode, resume = false) => app.show((a) => battleScreen(a, mode, resume)),
    aftermath: (ending) => app.show((a) => aftermathScreen(a, ending)),
    dockyard: () => app.show(dockyardScreen),
    epilogue: () => app.show(epilogueScreen),
    log: () => app.show(logScreen),
    daily: () =>
      app.go.briefing({
        kind: 'daily',
        dateKey: context.daily.dateKey(),
        number: context.daily.number(),
      }),
    open: () => app.show(openScreen),
    help: () => app.show(helpScreen),
  };
  app.go.title();
  // Development only: open a screen directly, for the documentation screenshots.
  if (import.meta.env.DEV) {
    Object.assign(window, {
      __figureheadGo: (screen: 'title' | 'voyage' | 'dockyard' | 'epilogue' | 'log' | 'launch') =>
        app.go[screen](),
    });
  }
  return { unmount: () => app.destroy() };
}

function demo(seed: string, appearance: AppearanceState): DemoHandle {
  const element = document.createElement('div');
  element.style.cssText = 'width:100%;height:100%;overflow:hidden';
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block;width:100%;height:100%';
  canvas.setAttribute('aria-hidden', 'true');
  element.append(canvas);
  const film = startDemo(
    canvas,
    lookOf(appearance),
    appearance.reducedMotion,
    `figurehead:demo:${seed}`,
  );
  const observer = new ResizeObserver(() => film.resize(element.clientWidth, element.clientHeight));
  observer.observe(element);
  return {
    element,
    setAppearance: (state) => film.setLook(lookOf(state), state.reducedMotion),
    setVisible: (visible) => film.setVisible(visible),
    destroy() {
      observer.disconnect();
      film.destroy();
    },
  };
}

/** Key art: a frigate action on the chart, the turn's broadsides in the air. */
function poster(canvas: HTMLCanvasElement, options: PosterOptions) {
  const film = startDemo(
    canvas,
    options.appearance === 'dark' ? 'night' : 'day',
    !options.animate,
    `figurehead:poster:${options.seed}`,
  );
  film.resize(options.width, options.height);
  if (!options.animate) film.setVisible(false);
  return { stop: () => film.destroy() };
}

const game: GameModule = { mount, demo, poster, achievements: PACKAGES };

export default game;
