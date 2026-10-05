import './ui/styles.css';
import './ui/screens.css';
import type {
  AppearanceState,
  DemoHandle,
  GameContext,
  GameInstance,
  GameModule,
  PosterOptions,
} from '@usr-games/kit';
import { PACKAGES } from './game/packages';
import { AttractLoop } from './render/attract';
import { drawPoster } from './render/poster';
import { App, lookOf } from './ui/app';
import { helpScreen, recordsScreen, settingsScreen } from './ui/screens/pages';
import { playScreen } from './ui/screens/play';
import { deckScreen, duelScreen } from './ui/screens/setup';
import { titleScreen } from './ui/screens/title';

/**
 * Before the Tide: guess the word before the sea takes the sandcastle. Inspired by hangman
 * from the BSD games. This file is the whole contract with the Hall.
 */
function mount(host: HTMLElement, context: GameContext): GameInstance {
  const app = new App(host, context);
  app.go = {
    title: () => app.show(titleScreen),
    tutorial: () => app.show(playScreen({ mode: 'tutorial' })),
    beach: () => {
      const prefs = app.saves.prefs.load();
      app.show(playScreen({ mode: 'beach', deckId: prefs.deck, tier: prefs.tier }));
    },
    chooseDeck: () => app.show(deckScreen),
    daily: () => app.show(playScreen({ mode: 'daily' })),
    classic: () => app.show(playScreen({ mode: 'classic' })),
    run: () => app.show(playScreen({ mode: 'run', deckId: 'core' })),
    duel: () => app.show(duelScreen),
    records: () => app.show(recordsScreen),
    help: () => app.show(helpScreen),
    settings: () => app.show(settingsScreen),
  };
  app.go.title();
  return { unmount: () => app.destroy() };
}

function seedNumber(seed: string): number {
  let number = 0;
  for (const char of seed) number = (number * 31 + char.charCodeAt(0)) >>> 0;
  return number % 997;
}

function demo(seed: string, appearance: AppearanceState): DemoHandle {
  const element = document.createElement('div');
  element.style.cssText = 'position:relative;width:100%;height:100%;overflow:hidden';
  element.setAttribute('aria-hidden', 'true');
  const loop = new AttractLoop(
    element,
    lookOf(appearance),
    appearance.reducedMotion,
    seedNumber(seed),
  );
  const observer = new ResizeObserver(() => loop.resize());
  observer.observe(element);
  return {
    element,
    setAppearance: (state) => loop.setLook(lookOf(state), state.reducedMotion),
    setVisible: (visible) => loop.setVisible(visible),
    destroy: () => {
      observer.disconnect();
      loop.destroy();
    },
  };
}

/** Key art: the castle in full dress at the water's edge, moonlit with glowing breakers. */
function poster(canvas: HTMLCanvasElement, options: PosterOptions) {
  return drawPoster(canvas, options);
}

const game: GameModule = { mount, demo, poster, achievements: PACKAGES };
export default game;
