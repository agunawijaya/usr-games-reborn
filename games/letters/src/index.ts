import './ui/styles.css';
import type {
  AppearanceState,
  DemoHandle,
  GameContext,
  GameInstance,
  GameModule,
  PosterOptions,
} from '@usr-games/kit';
import { CLOCK_SECONDS, type RoundPlan, TUTORIAL_SECONDS } from './game/modes';
import { PACKAGES } from './game/packages';
import { loadLetterFont } from './render/atlas';
import { AttractLoop } from './render/attract';
import { BoardView } from './render/board-view';
import { lookOf, paletteFor } from './render/palette';
import { drawPoster } from './render/poster';
import { App } from './ui/app';
import { bookScreen, helpScreen, recordsScreen } from './ui/screens/pages';
import { playScreen } from './ui/screens/play';
import { setupScreen } from './ui/screens/setup';
import { titleScreen } from './ui/screens/title';

/**
 * Chain Letter: trace words through a grid of letter cubes and beat the dictionary. Inspired by
 * `bog`, the 1988 letter-cube word hunt of the BSD games. This file is the whole contract with
 * the Hall.
 */
async function mount(host: HTMLElement, context: GameContext): Promise<GameInstance> {
  // The cube letters are drawn into a texture once; give the letter face a moment to arrive.
  await loadLetterFont();
  const app = new App(host, context);
  // Development builds (the workbench, the Hall's dev server) let tests read the live round.
  if (import.meta.env.DEV) (window as unknown as { __chl?: App }).__chl = app;
  app.go = {
    title: () => app.show(titleScreen),
    setup: (mode) => app.show(setupScreen(mode)),
    play: (plan) => app.show(playScreen(plan, plan.mode === 'pass' ? { turn: 0 } : undefined)),
    daily: () => {
      const dateKey = context.daily.dateKey();
      const plan: RoundPlan = {
        mode: 'daily',
        size: 4,
        rule: 'classic',
        minLetters: 3,
        seconds: CLOCK_SECONDS[4],
        seed: context.daily.seed(),
        dateKey,
        dailyNumber: context.daily.number(),
      };
      app.show(playScreen(plan));
    },
    tutorial: () =>
      app.show(
        playScreen({
          mode: 'tutorial',
          size: 4,
          rule: 'classic',
          minLetters: 3,
          seconds: TUTORIAL_SECONDS,
          seed: 'letters:tutorial',
        }),
      ),
    book: () => app.show(bookScreen),
    records: () => app.show(recordsScreen),
    help: () => app.show(helpScreen),
  };
  app.go.title();
  return { unmount: () => app.destroy() };
}

function demo(seed: string, appearance: AppearanceState): DemoHandle {
  const element = document.createElement('div');
  element.style.cssText = 'position:relative;width:100%;height:100%;overflow:hidden';
  element.setAttribute('aria-hidden', 'true');
  const board = new BoardView(paletteFor(lookOf(appearance)), appearance.reducedMotion);
  element.append(board.element);
  board.element.style.cssText = 'position:absolute;inset:0';
  const place = () => {
    const box = element.getBoundingClientRect();
    board.setBoardRect({
      x: box.width * 0.08,
      y: box.height * 0.06,
      width: box.width * 0.84,
      height: box.height * 0.9,
    });
  };
  const observer = new ResizeObserver(place);
  observer.observe(element);
  const loop = new AttractLoop(
    board,
    [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0),
  );
  loop.start();
  return {
    element,
    setAppearance: (state) => board.setPalette(paletteFor(lookOf(state)), state.reducedMotion),
    setVisible: (visible) => loop.setVisible(visible),
    destroy: () => {
      observer.disconnect();
      loop.stop();
      board.destroy();
    },
  };
}

/** Key art: cubes caught mid-tumble above the tray, glass by night, pastel by day. */
function poster(canvas: HTMLCanvasElement, options: PosterOptions) {
  return drawPoster(canvas, options);
}

const game: GameModule = { mount, demo, poster, achievements: PACKAGES };
export default game;
