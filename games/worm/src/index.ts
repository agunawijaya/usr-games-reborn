import './ui/noodle.css';
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
import { NoodleApp } from './app/app';
import { parseBoard } from './engine/board';
import type { Cell } from './engine/geometry';
import { mapOf } from './gardens/gardens';
import { AutoGarden } from './play/auto';
import { GARDEN_BED, GLOW_SOIL, type Look } from './render/look';
import { GardenView } from './render/view';
import { h } from './ui/dom';

/**
 * Noodle Nine for the Hall: the game itself, a silent demo for the attract mode, and the key
 * art. The Hall loads the fonts every native game shares; nothing here fetches anything.
 */

function lookOf(appearance: AppearanceState | PosterOptions['appearance']): Look {
  const dark =
    typeof appearance === 'string' ? appearance === 'dark' : appearance.appearance === 'dark';
  return dark ? GLOW_SOIL : GARDEN_BED;
}

function mount(host: HTMLElement, context: GameContext): GameInstance {
  const app = new NoodleApp(host, context);
  return {
    unmount: () => app.destroy(),
    playAgain: () => app.playAgain(),
  };
}

/** The house noodle playing an open box (the 1980 rules), silently, in the Hall's appearance. */
function demo(seed: string, appearance: AppearanceState): DemoHandle {
  const canvas = h('canvas', {
    'aria-hidden': 'true',
    style: 'display:block;width:100%;height:100%',
  });
  // No position of its own: the Hall places the element over the tile.
  const element = h(
    'div',
    { class: 'nn-demo', style: 'width:100%;height:100%;overflow:hidden' },
    canvas,
  );
  const view = new GardenView(canvas, { skyShare: 0.14, bottomShare: 0.04, sideShare: 0.03 });
  const auto = new AutoGarden(
    view,
    { kind: 'open', width: 18, height: 10 },
    lookOf(appearance),
    `demo:${seed}`,
    {
      reducedMotion: appearance.reducedMotion,
    },
  );
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

/** The poster's little bed: the noodle curled round three sides of a big 9, nose to the fruit. */
const POSTER_BOARD = parseBoard(mapOf(9, 7, {}));
const POSTER_BODY: Cell[] = [
  [3, 3],
  [2, 3],
  [2, 2],
  [2, 1],
  [3, 1],
  [4, 1],
  [5, 1],
  [6, 1],
  [6, 2],
  [6, 3],
  [6, 4],
  [6, 5],
  [5, 5],
  [4, 5],
  [3, 5],
  [2, 5],
  [1, 5],
  [0, 5],
].map(([x, y]) => ({ x: x!, y: y! }));

/** Key art: the glowing noodle mid-chain, curled round a big 9, a rainbow running down it. */
function poster(canvas: HTMLCanvasElement, options: PosterOptions): { stop(): void } {
  const look = lookOf(options.appearance);
  const scale = canvas.width / options.width;
  const view = new GardenView(canvas, { skyShare: 0.16, bottomShare: 0.05, sideShare: 0.05 });
  view.adopt(options.width, options.height, scale);
  const draw = (time: number) =>
    view.draw({
      board: POSTER_BOARD,
      seed: 'poster',
      look,
      grid: false,
      body: POSTER_BODY,
      heading: 'right',
      digit: { at: { x: 4, y: 3 }, value: 9 },
      bulges: [
        { at: 3, size: 6 },
        { at: 8, size: 4 },
      ],
      pulse: ((time * 0.35) % 1.4) / 1.4,
      mood: 'delight',
      popups: [
        {
          at: { x: 3, y: 3 },
          points: 38,
          chain: 4,
          value: 7,
          born: time - 0.5,
          drift: { dx: 1.7, dy: -0.9 },
        },
      ],
      time,
      reducedMotion: !options.animate,
    });
  // A still frame still hands back a handle: it tells the Hall the canvas is ours from now on.
  if (!options.animate) {
    draw(2.4);
    return { stop() {} };
  }
  let stopped = false;
  let frame = 0;
  const started = performance.now();
  const tick = () => {
    if (stopped) return;
    draw(2.4 + (performance.now() - started) / 1000);
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
