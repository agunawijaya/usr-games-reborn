import './ui/fivefold.css';
import type {
  AppearanceState,
  DemoHandle,
  GameContext,
  GameInstance,
  GameModule,
  PackageDefinition,
  PosterOptions,
} from '@usr-games/kit';
import manifest from '../manifest.json';
import { FivefoldApp } from './app/app';
import { indexOf, newGame, play } from './engine/game';
import { type Look, lookFor } from './render/look';
import type { PieceView } from './render/view';
import { BoardView } from './render/view';
import { pointCentre } from './render/geometry';
import { AutoBoard } from './play/auto';
import { h } from './ui/dom';

/**
 * Fivefold for the Hall: the game itself, a silent demo for the attract mode, and the key art.
 * The Hall loads the fonts every native game shares; nothing here fetches anything.
 */

function lookOf(appearance: AppearanceState | PosterOptions['appearance']): Look {
  const dark =
    typeof appearance === 'string' ? appearance === 'dark' : appearance.appearance === 'dark';
  return lookFor(dark);
}

function mount(host: HTMLElement, context: GameContext): GameInstance {
  const app = new FivefoldApp(host, context);
  return {
    unmount: () => app.destroy(),
    playAgain: () => app.playAgain(),
  };
}

/** Two gentle opponents at play, silently, in the Hall's appearance. */
function demo(seed: string, appearance: AppearanceState): DemoHandle {
  const canvas = h('canvas', {
    'aria-hidden': 'true',
    style: 'display:block;width:100%;height:100%',
  });
  // No position of its own: the Hall places the element over the tile.
  const element = h(
    'div',
    { class: 'ff-demo', style: 'width:100%;height:100%;overflow:hidden' },
    canvas,
  );
  const board = new AutoBoard(canvas, lookOf(appearance), `demo:${seed}`, appearance.reducedMotion);
  const observer = new ResizeObserver(() => {
    const box = element.getBoundingClientRect();
    if (box.width > 0) board.resize(box.width, box.height, window.devicePixelRatio || 1);
  });
  observer.observe(element);
  let visible = true;
  board.start();
  return {
    element,
    setAppearance(state) {
      board.setLook(lookOf(state));
    },
    setVisible(next) {
      if (next === visible) return;
      visible = next;
      if (next) board.start();
      else board.stop();
    },
    destroy() {
      observer.disconnect();
      board.stop();
      element.remove();
    },
  };
}

/**
 * The poster's position: a game near its end on the 15 × 15 board, the first player's five on a
 * rising diagonal through the middle, other pieces about it.
 */
function posterPosition(): { pieces: PieceView[]; line: number[] } {
  const game = newGame(15, 'freestyle');
  const at = ([x, y]: readonly [number, number]) => indexOf(game, x, y);
  // The first player's moves, the five among them (every other one), then the answers.
  const first: [number, number][] = [
    [4, 10],
    [5, 7],
    [5, 9],
    [9, 7],
    [6, 8],
    [4, 8],
    [7, 7],
    [10, 6],
    [8, 6],
  ];
  const second: [number, number][] = [
    [7, 8],
    [8, 8],
    [6, 10],
    [3, 11],
    [6, 6],
    [9, 5],
    [10, 8],
    [7, 9],
  ];
  first.forEach((move, i) => {
    play(game, at(move));
    const answer = second[i];
    if (answer) play(game, at(answer));
  });
  return {
    pieces: game.moves.map((point, i) => ({ point, side: (i % 2) as 0 | 1, placedAt: -10 })),
    line: game.winningLine ?? [],
  };
}

/** How old the winning moment is in the still poster, and how long the moving poster's loop lasts. */
const POSTER_AGE = { lake: 1.75, sand: 2.4 };
const POSTER_LOOP = 4.2;

/** Key art: five lanterns rising off the lake (by night); five pebbles in a raked ring (by day). */
function poster(canvas: HTMLCanvasElement, options: PosterOptions): { stop(): void } {
  const look = lookOf(options.appearance);
  const scale = canvas.width / options.width;
  const view = new BoardView(canvas, look);
  const { width, height } = options;
  // The board, larger than the frame, its middle low in the picture; the sky above it by night.
  const side = Math.max(width, height) * 1.25;
  const slot = { x: (width - side) / 2, y: height * 0.42 - side * 0.46, width: side, height: side };
  const horizon = height * 0.3;
  view.resize(width, height, scale, slot, horizon, 15);
  view.setMoonX(width * 0.78);
  const position = posterPosition();
  const line = position.line;
  // Pieces whose points fall in the sky (the board is larger than the frame) are left out.
  const g = view.geometry!;
  const pieces = position.pieces.filter(
    (piece) =>
      !look.dark ||
      line.includes(piece.point) ||
      pointCentre(g, piece.point).y > horizon + g.cell * 0.4,
  );
  const age = look.dark ? POSTER_AGE.lake : POSTER_AGE.sand;
  const draw = (time: number, sinceWin: number) =>
    view.draw({
      size: 15,
      pieces,
      last: null,
      threats: [],
      cursor: null,
      ghost: null,
      win: { line, side: 0, at: time - sinceWin },
      time,
      motion: true,
    });
  // A still frame still hands back a handle: it tells the Hall the canvas is ours from now on.
  if (!options.animate) {
    draw(10, age);
    return { stop() {} };
  }
  let stopped = false;
  let frame = 0;
  const started = performance.now();
  const tick = () => {
    if (stopped) return;
    const elapsed = (performance.now() - started) / 1000;
    draw(10 + elapsed, 0.6 + (elapsed % POSTER_LOOP));
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
