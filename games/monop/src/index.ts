import './ui/styles.css';
import type { GameContext, GameInstance, GameModule } from '@usr-games/kit';
import { DeedsApp, type DevOptions } from './app/app';
import { demo, poster } from './app/showpiece';
import { PACKAGES } from './career/packages';

/**
 * Deeds & Dice for the Hall: the game, its attract mode (a town drifting by) and its poster
 * (Harbour City from the same renderer). The Hall loads the shared fonts; nothing here fetches
 * anything.
 */

declare global {
  interface Window {
    /** Workbench and test overrides (seed, rounds, pace); the Hall never sets them. */
    __ddDev?: DevOptions;
    /** The world, for the workbench's performance and memory checks. */
    __ddWorld?: unknown;
  }
}

function mount(host: HTMLElement, context: GameContext): GameInstance {
  const app = new DeedsApp(host, context, window.__ddDev ?? {});
  return {
    unmount: () => app.destroy(),
    playAgain: () => app.playAgain(),
  };
}

const game: GameModule = { mount, demo, poster, achievements: PACKAGES };

export default game;
