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
import {
  customSetup,
  dailySetup,
  ladderSetup,
  localSetup,
  puzzleSetup,
  tutorialSetup,
} from './game/setups';
import { AttractLoop } from './render/attract';
import { drawPoster } from './render/poster';
import { App, lookOf } from './ui/app';
import {
  customSetupScreen,
  helpScreen,
  ladderScreen,
  localSetupScreen,
  puzzlesScreen,
  recordsScreen,
  settingsScreen,
} from './ui/screens/pages';
import { playScreen } from './ui/screens/play';
import { titleScreen } from './ui/screens/title';

/**
 * Double Cross: draw a line, close a box, learn when to give one away. Inspired by dab, the
 * NetBSD dots-and-boxes game. This file is the whole contract with the Hall.
 */

function mount(host: HTMLElement, context: GameContext): GameInstance {
  const app = new App(host, context);
  const prefs = () => app.saves.prefs.load();
  const nonce = () => String(Date.now() % 1_000_000);
  app.go = {
    title: () => app.show(titleScreen),
    ladder: () => app.show(ladderScreen),
    ladderMatch: (number) => app.show((a) => playScreen(a, ladderSetup(number, prefs(), nonce()))),
    daily: () =>
      app.show((a) =>
        playScreen(
          a,
          dailySetup(
            prefs(),
            context.daily.seed(),
            context.daily.number(),
            context.daily.dateKey(),
          ),
        ),
      ),
    puzzles: () => app.show(puzzlesScreen),
    puzzle: (number) => app.show((a) => playScreen(a, puzzleSetup(number, prefs(), nonce()))),
    tutorial: (step = 0) => app.show((a) => playScreen(a, tutorialSetup(step, prefs()))),
    local: () => app.show((a) => playScreen(a, localSetup(prefs(), nonce()))),
    localSetup: () => app.show(localSetupScreen),
    custom: () => app.show((a) => playScreen(a, customSetup(prefs(), nonce()))),
    customSetup: () => app.show(customSetupScreen),
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

/** Key art: a neon board mid-cascade, the double cross just played, from the game's own renderer. */
function poster(canvas: HTMLCanvasElement, options: PosterOptions) {
  return drawPoster(
    canvas,
    options.width,
    options.height,
    options.appearance === 'dark' ? 'neon' : 'chalk',
    options.animate,
  );
}

const game: GameModule = { mount, demo, poster, achievements: PACKAGES };
export default game;
