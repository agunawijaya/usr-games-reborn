import { createRng, restoreRng, themeTokens } from '@usr-games/kit';
import sinkers from '../src/index';
import { choosePlacement, playSteps } from '../src/engine/bot';
import {
  cloneGame,
  createGame,
  fall,
  type Game,
  plunge,
  shift,
  sink,
  turn,
} from '../src/engine/game';
import type { BurstMoment } from '../src/render/effects';
import { fallingOf, landingOf, settledCells } from '../src/render/from-game';
import { depthShare } from '../src/render/view';
import { lookFor } from '../src/render/look';
import { diveGame, DIVES } from '../src/dives/dives';
import { createPlayScreen } from '../src/ui/play-screen';
import { createTitleScreen, type MenuEntry } from '../src/ui/title-screen';

/**
 * The hero scenes, staged with the real engine, house diver and renderer. Staging only chooses
 * the moment (and, for the burst, keeps a column open for the long sinker); every cell drawn
 * comes from a game the diver played.
 */

export interface HeroOptions {
  dark: boolean;
  live: boolean;
  /** Seconds into the scene at which a still frame is taken. */
  time: number;
}

type Scene = (host: HTMLElement, options: HeroOptions) => Promise<void> | void;

const WIDTH = 11;
const HEIGHT = 18;
const LONG = 6;

function newGame(seed: string, level = 3): Game {
  return createGame({
    rules: 'standard',
    width: WIDTH,
    height: HEIGHT,
    level,
    random: createRng(seed),
  });
}

/** A copy to try a move on, its random draws carrying on from the same point. */
function trialOf(game: Game): Game {
  return cloneGame(game, restoreRng(game.random.state()));
}

/** How many rows the settled stack stands, and how many holes it hides. */
function stackShape(game: Game): { height: number; holes: number } {
  let height = 0;
  let holes = 0;
  for (let x = 0; x < game.width; x++) {
    let covered = false;
    for (let y = 0; y < game.height; y++) {
      const filled = game.cells[(y + 1) * game.width + x] !== null;
      if (filled && !covered) height = Math.max(height, game.height - y);
      if (filled) covered = true;
      else if (covered) holes++;
    }
  }
  return { height, holes };
}

function waitFrames(n: number): Promise<void> {
  return new Promise((resolve) => {
    const tick = (left: number) =>
      left <= 0 ? resolve() : requestAnimationFrame(() => tick(left - 1));
    tick(n);
  });
}

/** Runs `draw` once at `time`, or every frame from there when the scene is live. */
async function present(draw: (time: number) => void, options: HeroOptions): Promise<void> {
  if (!options.live) {
    draw(options.time);
    await waitFrames(2);
    return;
  }
  const start = performance.now();
  const loop = () => {
    draw(options.time + (performance.now() - start) / 1000);
    requestAnimationFrame(loop);
  };
  loop();
}

/**
 * The diver's own dive, stopped at a moment worth a still: a stack seven to ten rows high with
 * few holes, a new sinker turned and slid over a landing spot well below it.
 */
function aboutToPlunge(): Game {
  let best: { game: Game; score: number } | null = null;
  for (let seed = 0; seed < 24; seed++) {
    const game = newGame(`hero:play:${seed}`);
    for (let i = 0; i < 120 && !game.over; i++) {
      const placement = choosePlacement(game)!;
      const shape = stackShape(game);
      if (i > 20 && shape.height >= 7 && shape.height <= 10) {
        const trial = trialOf(game);
        playSteps(trial, placement.steps.slice(0, -1));
        // A few rows down into the water, as a player lines up a plunge.
        for (let k = 0; k < 3; k++) sink(trial);
        const fallBy = (landingOf(trial)?.[0]?.y ?? 0) - trial.y;
        const score =
          fallBy * 2 -
          shape.holes * 6 +
          (shape.height === 8 ? 4 : 0) +
          Math.min(trial.combo, 4) * 2;
        if (fallBy >= 6 && (!best || score > best.score)) best = { game: trial, score };
      }
      playSteps(game, placement.steps);
    }
  }
  if (!best) throw new Error('No moment to stage');
  return best.game;
}

/** a) Mid-dive: a sinker poised high in the tank, its sonar line drawn on the stack below. */
const dive: Scene = async (host, options) => {
  const look = lookFor(options.dark);
  // Caught with a sonar ping half-way down to the footprint.
  const at = { ...options, time: options.time + 0.72 };
  const game = aboutToPlunge();
  const screen = createPlayScreen(host, look.id);
  screen.renderBar({
    context: 'Dive 6',
    title: 'Kelp Forest',
    score: game.points,
    level: game.level,
    rows: game.rowsCleared,
    combo: game.combo,
  });
  screen.fit();
  await present(
    (time) =>
      screen.view.draw({
        cols: WIDTH,
        rows: HEIGHT,
        settled: settledCells(game),
        falling: fallingOf(game),
        fallLead: 0.35,
        landing: landingOf(game),
        next: game.next,
        look,
        seed: 'kelp-forest',
        time,
        reducedMotion: false,
      }),
    at,
  );
};

/**
 * The diver keeps the right-hand column open; whenever a long sinker comes with four full rows
 * waiting, it is stood up and plunged into the gap. Of those bursts, the one with the least left
 * above the rows wins: the column of bubbles then rises through open water.
 */
function fourRowBurst(): { game: Game; burst: Omit<BurstMoment, 'born'> } {
  let best: { game: Game; burst: Omit<BurstMoment, 'born'>; above: number } | null = null;
  for (let seed = 0; seed < 60; seed++) {
    const game = newGame(`hero:burst:${seed}`);
    for (let i = 0; i < 160 && !game.over; i++) {
      if (game.form === LONG && i > 25) {
        const trial = trialOf(game);
        const before = settledCells(trial);
        turn(trial, 'left');
        while (shift(trial, 1)[0]!.kind === 'moved');
        const events = plunge(trial);
        const burst = events.find((e) => e.kind === 'burst');
        if (burst?.kind === 'burst' && burst.burst.rows.length === 4 && burst.burst.combo >= 3) {
          const rows = burst.burst.rows;
          const above = before.filter((c) => c.y < rows[0]!).length;
          if (!best || above < best.above)
            best = {
              game: trial,
              above,
              burst: {
                rows,
                cells: [
                  ...before.filter((c) => rows.includes(c.y)),
                  ...rows.map((y) => ({
                    x: WIDTH - 1,
                    y,
                    group: -2,
                    kind: LONG,
                    depth: depthShare(rows[1]!, HEIGHT),
                  })),
                ],
                points: burst.burst.points,
                combo: burst.burst.combo,
                level: trial.level,
              },
            };
        }
      }
      playSteps(game, choosePlacement(game, { well: WIDTH - 1 })!.steps);
    }
  }
  if (!best) throw new Error('No four-row burst to stage');
  return best;
}

/** b) The signature moment: four rows burst into a column of bubbles, light blooming through. */
const burst: Scene = async (host, options) => {
  const look = lookFor(options.dark);
  const { game, burst: moment } = fourRowBurst();
  const screen = createPlayScreen(host, look.id);
  screen.renderBar({
    context: 'Dive 6',
    title: 'Kelp Forest',
    score: game.points,
    level: game.level,
    rows: game.rowsCleared,
    combo: game.combo,
  });
  screen.fit();
  // The moment: the rows nearly gone, the column of bubbles rushing up, the score on its way.
  const age = Number(new URLSearchParams(location.search).get('age') ?? '0.46');
  const born = options.time - age;
  await present(
    (time) =>
      screen.view.draw({
        cols: WIDTH,
        rows: HEIGHT,
        settled: settledCells(game),
        falling: null,
        landing: null,
        next: game.next,
        look,
        seed: 'kelp-forest',
        bursts: [{ ...moment, born }],
        time,
        reducedMotion: false,
      }),
    options,
  );
};

/** c) The game menu over the attract tank, the house diver at play in it. */
const title: Scene = async (host, options) => {
  const look = lookFor(options.dark);
  const game = newGame('hero:title', 2);
  for (let i = 0; i < 34 && !game.over; i++) playSteps(game, choosePlacement(game)!.steps);
  const placement = choosePlacement(game)!;
  playSteps(game, placement.steps.slice(0, -1));
  fall(game);
  const noop = () => {};
  const entries: MenuEntry[] = [
    { label: 'Continue', meta: 'Dive 6 · Kelp Forest', primary: true, run: noop },
    { label: 'Dives', meta: '14 of 36 stars', run: noop },
    { label: 'Marathon', meta: 'best 48,210 · level 7', run: noop },
    { label: 'Classic 1992', meta: 'the original rules', run: noop },
    { label: 'Daily Dive', meta: '#33 · deepest combo ×6', run: noop },
    { label: 'Tutorial', meta: 'about a minute', run: noop },
    { label: 'Records', meta: 'champions by level', run: noop },
    { label: 'How to play', meta: 'keys and scoring', run: noop },
    { label: 'Settings', meta: 'Standard rules, sound', run: noop },
  ];
  const screen = createTitleScreen(host, look.id, entries);
  screen.fit();
  await present(
    (time) =>
      screen.view.draw({
        cols: WIDTH,
        rows: HEIGHT,
        settled: settledCells(game),
        falling: fallingOf(game),
        fallLead: 0.5,
        landing: landingOf(game),
        next: game.next,
        look,
        seed: 'attract',
        time,
        reducedMotion: false,
      }),
    options,
  );
};

/**
 * A close look at the sinkers themselves, large: a few settled, one falling over its sonar line.
 * Not a hero frame; for checking the drawing.
 */
const closeup: Scene = async (host, options) => {
  const look = lookFor(options.dark);
  const game = createGame({
    rules: 'standard',
    width: 7,
    height: 6,
    level: 1,
    random: createRng('closeup'),
    plan: [2, 4, 0, 6, 3, 5, 1, 2],
  });
  for (let i = 0; i < 4; i++) playSteps(game, choosePlacement(game)!.steps);
  playSteps(game, choosePlacement(game)!.steps.slice(0, -1));
  const screen = createPlayScreen(host, look.id);
  screen.renderBar({
    context: 'Check',
    title: 'Sinkers close up',
    score: game.points,
    level: 1,
    rows: game.rowsCleared,
    combo: game.combo,
  });
  screen.fit();
  screen.view.resize(
    screen.stage.clientWidth,
    screen.stage.clientHeight,
    window.devicePixelRatio || 1,
    { maxCell: 130, topShare: 0.12, floorShare: 0.1 },
  );
  await present(
    (time) =>
      screen.view.draw({
        cols: 7,
        rows: 6,
        settled: settledCells(game),
        falling: fallingOf(game),
        landing: landingOf(game),
        next: game.next,
        look,
        seed: 'closeup',
        time,
        reducedMotion: false,
      }),
    options,
  );
};

/**
 * The heaviest tank there is, for the frame-rate test: the Sunken Garden's coral and seaweed with
 * its current, a stack the diver built over them, a sinker falling with its sonar, and a four-row
 * burst going off every few seconds. `night=1` darkens it as the night dives are.
 */
const perf: Scene = async (host, options) => {
  const look = lookFor(options.dark);
  const dive = DIVES.find((d) => d.id === 'sunken-garden')!;
  const game = diveGame(dive, createRng('perf'));
  for (let i = 0; i < 16 && !game.over; i++) playSteps(game, choosePlacement(game)!.steps);
  const { burst: moment } = fourRowBurst();
  const night = new URLSearchParams(location.search).get('night') === '1';
  const screen = createPlayScreen(host, look.id);
  screen.renderBar({
    context: 'Dive 11',
    title: dive.title,
    score: game.points,
    level: game.level,
    rows: game.rowsCleared,
    combo: game.combo,
  });
  screen.fit();
  await present(
    (time) =>
      screen.view.draw({
        cols: WIDTH,
        rows: HEIGHT,
        settled: settledCells(game),
        falling: fallingOf(game),
        fallLead: -((time * 2) % 1),
        landing: landingOf(game),
        next: game.next,
        look,
        seed: dive.id,
        bursts: [{ ...moment, born: Math.floor(time / 2.6) * 2.6 }],
        trails: [{ x: 5, from: 0, to: 12, born: Math.floor(time / 1.3) * 1.3 }],
        currents: game.currents,
        night,
        time,
        reducedMotion: false,
      }),
    options,
  );
};

/**
 * The Hall's key art and attract tile side by side, as the Hall would show them: the poster at
 * 640 × 360 and the demo in a tile of the same size. Not a hero frame; for checking both.
 */
const hall: Scene = async (host, options) => {
  const box = (label: string) => {
    const frame = document.createElement('figure');
    frame.style.cssText =
      'margin:24px;display:inline-block;width:640px;height:360px;position:relative;overflow:hidden;border-radius:16px';
    frame.setAttribute('aria-label', label);
    host.append(frame);
    return frame;
  };
  const appearance = options.dark ? 'dark' : 'light';
  const posterBox = box('poster');
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 360;
  canvas.style.cssText = 'width:640px;height:360px;display:block';
  posterBox.append(canvas);
  sinkers.poster!(canvas, {
    seed: 'hall',
    appearance,
    width: 640,
    height: 360,
    animate: options.live,
  });
  const demo = sinkers.demo('hall', {
    appearance,
    style: 'console',
    theme: 'console',
    tokens: themeTokens({ theme: 'console', appearance, colorBlindPalette: false }),
    accent: '#0f8fb0',
    reducedMotion: !options.live,
  });
  box('demo').append(demo.element);
  await new Promise((resolve) => setTimeout(resolve, 400));
};

export const HERO_SCENES: Record<string, Scene> = { dive, burst, title, closeup, perf, hall };
