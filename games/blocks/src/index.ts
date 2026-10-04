import './ui/sinkers.css';
import type {
  AppearanceState,
  DemoHandle,
  GameContext,
  GameInstance,
  GameModule,
  PackageDefinition,
  PosterOptions,
} from '@usr-games/kit';
import { createRng } from '@usr-games/kit';
import manifest from '../manifest.json';
import { SinkersApp } from './app/app';
import { choosePlacement, playSteps } from './engine/bot';
import { createGame, type Game } from './engine/game';
import { TANK_HEIGHT, TANK_WIDTH } from './dives/dives';
import { AutoTank } from './play/auto';
import type { BurstMoment } from './render/effects';
import { fallingOf, landingOf, settledCells } from './render/from-game';
import { type Look, lookFor } from './render/look';
import { depthShare, TankView } from './render/view';
import { h } from './ui/dom';

/**
 * Sinkers for the Hall: the game itself, a silent demo for the attract mode, and the key art.
 * The Hall loads the fonts every native game shares; nothing here fetches anything.
 */

function lookOf(appearance: AppearanceState | PosterOptions['appearance']): Look {
  const dark =
    typeof appearance === 'string' ? appearance === 'dark' : appearance.appearance === 'dark';
  return lookFor(dark);
}

function mount(host: HTMLElement, context: GameContext): GameInstance {
  const app = new SinkersApp(host, context);
  return {
    unmount: () => app.destroy(),
    playAgain: () => app.playAgain(),
  };
}

/** The house diver at play in a plain tank, silently, in the Hall's appearance. */
function demo(seed: string, appearance: AppearanceState): DemoHandle {
  const canvas = h('canvas', {
    'aria-hidden': 'true',
    style: 'display:block;width:100%;height:100%',
  });
  // No position of its own: the Hall places the element over the tile.
  const element = h(
    'div',
    { class: 'snk-demo', style: 'width:100%;height:100%;overflow:hidden' },
    canvas,
  );
  const view = new TankView(canvas, { topShare: 0.06, floorShare: 0.06 });
  const auto = new AutoTank(view, lookOf(appearance), `demo:${seed}`, {
    reducedMotion: appearance.reducedMotion,
  });
  const observer = new ResizeObserver(() => {
    const box = element.getBoundingClientRect();
    view.resize(box.width, box.height, window.devicePixelRatio || 1);
    auto.draw();
  });
  observer.observe(element);
  let visible = true;
  if (!appearance.reducedMotion) auto.start();
  return {
    element,
    setAppearance(state) {
      auto.setLook(lookOf(state));
    },
    setVisible(next) {
      if (next === visible) return;
      visible = next;
      if (next && !appearance.reducedMotion) auto.start();
      else auto.stop();
    },
    destroy() {
      observer.disconnect();
      auto.stop();
      element.remove();
    },
  };
}

/** The poster's tank: a stack the house diver built, and a sinker high above it. */
function posterGame(): Game {
  const game = createGame({
    rules: 'standard',
    width: TANK_WIDTH,
    height: TANK_HEIGHT,
    level: 3,
    random: createRng('poster'),
  });
  for (let i = 0; i < 18 && !game.over; i++) playSteps(game, choosePlacement(game)!.steps);
  playSteps(game, choosePlacement(game)!.steps.slice(0, -1));
  game.y = 4;
  return game;
}

/**
 * Two rows bursting just above the stack, so their column of bubbles rises past the sinker with
 * nothing left hanging over them.
 */
function posterBurst(game: Game): Omit<BurstMoment, 'born'> {
  const top = Math.min(game.height, ...settledCells(game).map((c) => c.y));
  const rows = [top - 2, top - 1];
  return {
    rows,
    cells: rows.flatMap((y, r) =>
      Array.from({ length: TANK_WIDTH }, (_, x) => ({
        x,
        y,
        group: 900 + r * 4 + Math.floor(x / 3),
        kind: (x + r * 3) % 7,
        depth: depthShare(y, game.height),
      })),
    ),
    points: 0,
    combo: 1,
    level: game.level,
  };
}

/** How old the burst is in the still poster, and how long the moving poster's loop lasts. */
const POSTER_AGE = 0.55;
const POSTER_LOOP = 2.2;

/** Key art: a glowing sinker plunging through a column of bubbles from a burst below. */
function poster(canvas: HTMLCanvasElement, options: PosterOptions): { stop(): void } {
  const look = lookOf(options.appearance);
  const scale = canvas.width / options.width;
  const view = new TankView(canvas, { topShare: 0.05, floorShare: 0.06 });
  view.adopt(options.width, options.height, scale);
  const game = posterGame();
  const falling = fallingOf(game);
  const burst = posterBurst(game);
  const settled = settledCells(game);
  const draw = (time: number, age: number) =>
    view.draw({
      cols: game.width,
      rows: game.height,
      settled,
      falling,
      landing: landingOf(game),
      next: game.next,
      look,
      seed: 'poster',
      bursts: [{ ...burst, born: time - age }],
      trails: [{ x: game.x, from: 0, to: game.y, born: time - Math.min(age, 0.3) }],
      time,
      reducedMotion: !options.animate,
    });
  // A still frame still hands back a handle: it tells the Hall the canvas is ours from now on.
  if (!options.animate) {
    draw(3, POSTER_AGE);
    return { stop() {} };
  }
  let stopped = false;
  let frame = 0;
  const started = performance.now();
  const tick = () => {
    if (stopped) return;
    // The moment loops: a burst, its bubbles rising past the sinker, and again.
    const elapsed = (performance.now() - started) / 1000;
    draw(3 + elapsed, 0.15 + (elapsed % POSTER_LOOP));
    frame = requestAnimationFrame(tick);
  };
  tick();
  return {
    stop() {
      stopped = true;
      cancelAnimationFrame(frame);
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
