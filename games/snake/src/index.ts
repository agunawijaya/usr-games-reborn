import './ui/styles.css';
import type {
  AppearanceState,
  DemoHandle,
  GameContext,
  GameInstance,
  GameModule,
  PosterOptions,
} from '@usr-games/kit';
import { CLASSIC_SIZES } from './game/saves';
import { PACKAGES } from './game/packages';
import { AttractLoop } from './render/attract';
import { drawPoster } from './render/poster';
import { App, lookOf } from './ui/app';
import { helpScreen, recordsScreen, settingsScreen } from './ui/screens/pages';
import { playScreen } from './ui/screens/play';
import { titleScreen } from './ui/screens/title';

/**
 * Full Pockets: a treasure garden, a door, and one very interested snake. Inspired by snake
 * from the BSD games. This file is the whole contract with the Hall.
 */

function mount(host: HTMLElement, context: GameContext): GameInstance {
  const app = new App(host, context);
  const fresh = (label: string) => `${label}:${context.daily.dateKey()}:${Date.now() % 1_000_000}`;
  app.go = {
    title: () => app.show(titleScreen),
    run: () => app.show((a) => playScreen(a, { mode: 'run', seed: fresh('run') })),
    daily: () => app.show((a) => playScreen(a, { mode: 'daily', seed: context.daily.seed() })),
    classic: () => {
      const size = CLASSIC_SIZES[app.saves.prefs.load().classicSize] ?? CLASSIC_SIZES[5]!;
      app.show((a) =>
        playScreen(a, { mode: 'classic', seed: fresh('classic'), classicSize: size }),
      );
    },
    tutorial: () => app.show((a) => playScreen(a, { mode: 'tutorial', seed: 'tutorial' })),
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
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
  canvas.setAttribute('aria-hidden', 'true');
  element.append(canvas);
  const loop = new AttractLoop(canvas, {
    look: lookOf(appearance),
    reducedMotion: appearance.reducedMotion,
    seed: seedNumber(seed),
  });
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

/** Key art: the snake coiled round a heap of glints, winking, from the game's own renderer. */
function poster(canvas: HTMLCanvasElement, options: PosterOptions) {
  return drawPoster(
    canvas,
    options.width,
    options.height,
    options.appearance === 'dark' ? 'moon' : 'sun',
    options.animate,
  );
}

const game: GameModule = { mount, demo, poster, achievements: PACKAGES };
export default game;
