import './ui/cribbage.css';
import './ui/screens.css';
import type { GameContext, GameInstance, GameModule } from '@usr-games/kit';
import { CribbageApp } from './app/app';
import { PACKAGES } from './modes/packages';
import { createDemo } from './play/demo';
import { drawPoster } from './render/poster';

/**
 * Fifteen-Two for the Hall: the game itself, a silent demo of two computer players for the
 * attract mode, and the key art. The Hall loads the fonts every native game shares; nothing
 * here fetches anything.
 */

function mount(host: HTMLElement, context: GameContext): GameInstance {
  const app = new CribbageApp(host, context);
  return {
    unmount: () => app.destroy(),
    playAgain: () => app.playAgain(),
  };
}

const game: GameModule = {
  mount,
  demo: createDemo,
  poster: drawPoster,
  achievements: PACKAGES,
};

export default game;
