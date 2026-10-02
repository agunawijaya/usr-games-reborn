import { createRng } from '@usr-games/kit';
import { parseBoard } from '../src/engine/board';
import { chooseMove } from '../src/engine/bot';
import { type Bite, cloneGame, createGame, type Game, isFree, move } from '../src/engine/game';
import { type Cell, DIRS, type Dir, dirBetween, OPPOSITE, step } from '../src/engine/geometry';
import { TEMPO_MULTIPLIER } from '../src/engine/tempo';
import { ATTRACT, type GardenSpec, mapOf, ROOT_CELLAR } from '../src/gardens/gardens';
import { driftFor } from '../src/render/effects';
import { lookFor } from '../src/render/look';
import { createPlayScreen } from '../src/ui/play-screen';
import { createTitleScreen, type MenuEntry } from '../src/ui/title-screen';
import { h } from '../src/ui/dom';

/**
 * The hero scenes, staged with the real engine, house noodle and renderer. Staging only decides
 * where a few digits land, so a chain happens on cue; everything drawn comes from the game.
 */

export interface HeroOptions {
  dark: boolean;
  live: boolean;
  /** Seconds into the scene at which a still frame is taken. */
  time: number;
}

type Scene = (host: HTMLElement, options: HeroOptions) => Promise<void> | void;

interface Staged {
  game: Game;
  bites: Bite[];
}

function touching(a: Cell, b: Cell): boolean {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
}

/** Pairs of body cells side by side that are not neighbours along the body: coils pressed together. */
function selfContacts(body: readonly Cell[]): number {
  const index = new Map(body.map((c, i) => [`${c.x},${c.y}`, i]));
  let contacts = 0;
  body.forEach((c, i) => {
    for (const d of DIRS) {
      const n = step(c, d);
      const j = index.get(`${n.x},${n.y}`);
      if (j !== undefined && j > i + 1) contacts++;
    }
  });
  return contacts;
}

/**
 * How good a still the noodle makes: many bends, no long straight runs, the head well away from
 * the walls, the body spread over the bed in open loops rather than hugging an edge or packed
 * into a knot. The noodle must read as one creature at a glance, so a body that is partly
 * through a tunnel, or a head pressed against its own coils or tail, rules a moment out.
 */
function shapeScore(game: Game): number {
  const { body, board } = game;
  if (body.some((c, i) => i > 0 && !touching(body[i - 1]!, c))) return -Infinity;
  const head = body[0]!;
  if (body.slice(2).some((c) => touching(head, c))) return -Infinity;
  let turns = 0;
  let run = 0;
  let longest = 0;
  let wallHugging = 0;
  for (let i = 1; i < body.length - 1; i++) {
    const a = dirBetween(body[i - 1]!, body[i]!);
    const b = dirBetween(body[i]!, body[i + 1]!);
    if (a !== b) {
      turns++;
      run = 0;
    } else longest = Math.max(longest, ++run);
    const c = body[i]!;
    if (c.x === 0 || c.y === 0 || c.x === board.width - 1 || c.y === board.height - 1)
      wallHugging++;
  }
  const margin = Math.min(head.x, head.y, board.width - 1 - head.x, board.height - 1 - head.y);
  // A head against the wall leaves no room for its face to be seen or its points to rise.
  if (margin < 2) return -Infinity;
  return (
    turns * 3 - longest * 2 - wallHugging * 1.5 - selfContacts(body) * 2 + Math.min(margin, 3) * 6
  );
}

/** A free cell exactly two moves ahead of the head, straight on if possible. */
function twoAhead(game: Game): Cell | null {
  const head = game.body[0]!;
  const heading = game.heading ?? 'right';
  const order: Dir[] = [heading, ...DIRS.filter((d) => d !== heading && d !== OPPOSITE[heading])];
  for (const first of order) {
    const a = step(head, first);
    if (!isFree(game, a)) continue;
    for (const second of [first, ...DIRS.filter((d) => d !== first && d !== OPPOSITE[first])]) {
      const b = step(a, second);
      if (
        isFree(game, b) &&
        (game.digit === null || b.x !== game.digit.at.x || b.y !== game.digit.at.y)
      )
        return b;
    }
  }
  return null;
}

/** Feeds the noodle a run of digits two cells apart, so each bite lands while it is still growing. */
function chainBites(staged: Staged, values: readonly number[], multiplier: number): void {
  const { game } = staged;
  for (const value of values) {
    const at = twoAhead(game);
    if (!at) throw new Error('No room for a chain here');
    game.digit = { at, value };
    for (let i = 0; i < 6; i++) {
      const dir = chooseMove(game);
      if (!dir) break;
      const events = move(game, dir, { multiplier });
      const bite = events.find((e) => e.kind === 'bite');
      if (bite?.kind === 'bite') {
        staged.bites.push(bite.bite);
        break;
      }
    }
  }
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
 * The house noodle's own play, searched for the moment that makes the best still: run it on a
 * few seeds and, around the wanted length, try feeding it a chain; keep the shapeliest result.
 */
function bestChainMoment(spec: GardenSpec, length: number, values: readonly number[]): Staged {
  let best: { staged: Staged; score: number } | null = null;
  for (let seed = 0; seed < 14; seed++) {
    const game = createGame({
      board: parseBoard(spec.map),
      body: spec.start,
      heading: spec.heading,
      random: createRng(`moment:${seed}`),
    });
    const bites: Bite[] = [];
    for (let i = 0; i < 3000 && game.status !== 'lost' && game.body.length <= length + 10; i++) {
      if (game.body.length >= length - 6 && game.growing === 0 && i % 2 === 0) {
        const trial: Staged = { game: cloneGame(game), bites: [...bites] };
        try {
          chainBites(trial, values, TEMPO_MULTIPLIER.rush);
          if (trial.game.status !== 'lost' && trial.game.chain >= values.length) {
            const score = shapeScore(trial.game);
            if (score > (best?.score ?? -Infinity)) best = { staged: trial, score };
          }
        } catch {
          // No room for a chain at this moment; keep looking.
        }
      }
      const dir = chooseMove(game);
      if (!dir) break;
      for (const e of move(game, dir)) if (e.kind === 'bite') bites.push(e.bite);
    }
  }
  if (!best) throw new Error('No moment for a chain was found');
  return best.staged;
}

/** a) Mid-garden: the noodle digesting three bites in a row, the third popping up as chain ×3. */
const garden: Scene = async (host, options) => {
  const look = lookFor(options.dark);
  const staged = bestChainMoment(ROOT_CELLAR, 44, [6, 4, 9]);
  const { game } = staged;
  const screen = createPlayScreen(host, look.id);
  screen.renderBar({
    context: `Garden ${ROOT_CELLAR.number}`,
    title: ROOT_CELLAR.title,
    length: game.body.length + game.growing,
    score: game.score,
    chain: game.chain,
    tempo: 'rush',
  });
  screen.fit();
  const last = staged.bites.at(-1)!;
  const recent = staged.bites.filter((b) => game.moves - b.move < game.body.length);
  // Late enough that the popup has lifted clear of the head and the juice has splashed out.
  const t0 = options.time - 0.48;
  await present(
    (time) =>
      screen.view.draw({
        board: game.board,
        seed: ROOT_CELLAR.id,
        look,
        grid: true,
        body: game.body,
        heading: game.heading,
        digit: game.digit,
        digitAge: time - t0,
        bulges: recent.map((b) => ({
          at: game.moves - b.move + Math.min(1, (time - t0) * 2),
          size: b.value,
        })),
        pulse: Math.min(1, Math.max(0, (time - t0) / 1.6)),
        mood: 'delight',
        popups: [
          {
            at: last.at,
            points: last.points,
            chain: last.chain,
            value: last.value,
            born: t0,
            drift: driftFor(last.at, game.board.width, game.board.height, [
              ...game.body,
              ...landmarks(game),
            ]),
          },
        ],
        bursts: [{ at: last.at, value: last.value, born: t0 + 0.12 }],
        time,
        reducedMotion: false,
      }),
    options,
  );
};

/** Everything on the board a popup should not cover: rocks, roots, mud, tunnels and the digit. */
function landmarks(game: Game): Cell[] {
  const cells: Cell[] = [];
  game.board.terrain.forEach((terrain, i) => {
    if (terrain !== 'soil')
      cells.push({ x: i % game.board.width, y: Math.floor(i / game.board.width) });
  });
  if (game.digit) cells.push(game.digit.at);
  return cells;
}

/** A path that winds into the middle of a box: tail on the outside, head at the centre. */
function spiral(width: number, height: number): Cell[] {
  const path: Cell[] = [];
  let [left, top, right, bottom] = [0, 0, width - 1, height - 1];
  while (left <= right && top <= bottom) {
    for (let x = left; x <= right; x++) path.push({ x, y: top });
    for (let y = top + 1; y <= bottom; y++) path.push({ x: right, y });
    if (top < bottom) for (let x = right - 1; x >= left; x--) path.push({ x, y: bottom });
    if (left < right) for (let y = bottom - 1; y > top; y--) path.push({ x: left, y });
    [left, top, right, bottom] = [left + 1, top + 1, right - 1, bottom - 1];
  }
  return path.reverse();
}

/** b) A fill puzzle the moment the box is full: the coil turns to a rippling mosaic. */
const fill: Scene = async (host, options) => {
  const look = lookFor(options.dark);
  const board = parseBoard(mapOf(9, 7, {}));
  const body = spiral(9, 7);
  const screen = createPlayScreen(host, look.id);
  screen.renderBar({
    context: 'Fill puzzle 7',
    title: 'The Snail Shell',
    length: body.length,
    score: 512,
    chain: 0,
    tempo: 'creep',
    par: { moves: 61, par: 64 },
  });
  screen.fit();
  screen.view.resize(
    screen.stage.clientWidth,
    screen.stage.clientHeight,
    window.devicePixelRatio || 1,
    { sideShare: 0.24, skyShare: 0.16, bottomShare: 0.06, maxCell: 104, shiftShare: -0.1 },
  );
  const head = body[0]!;
  const neck = body[1]!;
  const heading: Dir =
    head.x > neck.x ? 'right' : head.x < neck.x ? 'left' : head.y > neck.y ? 'down' : 'up';
  screen.overlay.append(
    h(
      'section',
      { class: 'nn-card', style: 'right:9%;top:50%;transform:translateY(-50%);width:330px' },
      h('p', { class: 'nn-card__kicker' }, 'Fill puzzle 7'),
      h('h2', { class: 'nn-card__title' }, 'Box filled!'),
      h('div', { class: 'nn-stars', 'aria-label': 'Three stars' }, '★★★'),
      h('p', {}, '61 moves, three under par. Every cell of the box is noodle.'),
    ),
  );
  const t0 = options.time - 0.62;
  await present(
    (time) =>
      screen.view.draw({
        board,
        seed: 'snail-shell',
        look,
        grid: false,
        body,
        heading,
        digit: null,
        mosaic: time - t0,
        time,
        reducedMotion: false,
      }),
    options,
  );
};

/**
 * The house noodle's play on a garden, stopped at its shapeliest moment near `length`. Cells for
 * which `faded` holds lie under something drawn over the garden, so a body kept out of them wins.
 */
function bestShape(
  spec: GardenSpec,
  length: number,
  faded: (c: Cell) => boolean = () => false,
): Game {
  let best: { game: Game; score: number } | null = null;
  for (let seed = 0; seed < 10; seed++) {
    const game = createGame({
      board: parseBoard(spec.map),
      body: spec.start,
      heading: spec.heading,
      random: createRng(`shape:${seed}`),
    });
    for (let i = 0; i < 3000 && game.status !== 'lost' && game.body.length <= length + 8; i++) {
      if (game.body.length >= length - 4) {
        const score = shapeScore(game) - game.body.filter(faded).length * 3;
        if (score > (best?.score ?? -Infinity)) best = { game: cloneGame(game), score };
      }
      const dir = chooseMove(game);
      if (!dir) break;
      move(game, dir);
    }
  }
  if (!best) throw new Error('The house noodle never grew that long');
  return best.game;
}

/** c) The game menu over the attract garden, the house noodle at play in it. */
const title: Scene = async (host, options) => {
  const look = lookFor(options.dark);
  // The menu's wash fades the first few columns of the garden.
  const game = bestShape(ATTRACT, 30, (c) => c.x < 3);
  const noop = () => {};
  const entries: MenuEntry[] = [
    { label: 'Continue', meta: 'Garden 6 · The Root Cellar', primary: true, run: noop },
    { label: 'Gardens', meta: '17 of 36 stars', run: noop },
    { label: 'Fill puzzles', meta: '6 of 15 filled', run: noop },
    { label: 'Endless', meta: 'best 214', run: noop },
    { label: 'Daily Garden', meta: '#32 · Sunflower Row', run: noop },
    { label: 'Tutorial', meta: 'under a minute', run: noop },
    { label: 'Records', meta: 'longest 131', run: noop },
    { label: 'How to play', meta: 'keys and rules', run: noop },
    { label: 'Settings', meta: 'tempo, grid, sound', run: noop },
  ];
  const screen = createTitleScreen(host, look.id, entries);
  screen.fit();
  let moved = 0;
  await present((time) => {
    if (options.live) {
      while (moved < Math.floor((time - options.time) / 0.16)) {
        const dir = chooseMove(game);
        if (dir) move(game, dir);
        moved++;
      }
    }
    screen.view.draw({
      board: game.board,
      seed: ATTRACT.id,
      look,
      grid: false,
      body: game.body,
      heading: game.heading,
      digit: game.digit,
      time,
      reducedMotion: false,
    });
  }, options);
};

/**
 * A moment in the house noodle's play from which a few steps straight on end at a rock, away from
 * the walls: the shapeliest such moment, played on to the bonk.
 */
function bonkIntoRock(spec: GardenSpec, length: number): Game {
  let best: { game: Game; score: number } | null = null;
  for (let seed = 0; seed < 10; seed++) {
    const game = createGame({
      board: parseBoard(spec.map),
      body: spec.start,
      heading: spec.heading,
      random: createRng(`bonk:${seed}`),
    });
    for (let i = 0; i < 3000 && game.status !== 'lost' && game.body.length <= length + 8; i++) {
      if (game.body.length >= length - 4) {
        for (const dir of DIRS) {
          if (game.heading && dir === OPPOSITE[game.heading]) continue;
          const trial = cloneGame(game);
          for (let k = 0; k < 4 && trial.status !== 'lost'; k++) move(trial, dir);
          if (trial.loss?.kind !== 'rock') continue;
          const score = shapeScore(trial);
          if (score > (best?.score ?? -Infinity)) best = { game: trial, score };
        }
      }
      const next = chooseMove(game);
      if (!next) break;
      move(game, next);
    }
  }
  if (!best) throw new Error('No rock to bonk into');
  return best.game;
}

/** Bonus: the loss, kindly. The noodle runs into a rock, sees stars and goes limp. */
const bonk: Scene = async (host, options) => {
  const look = lookFor(options.dark);
  const game = bonkIntoRock(ROOT_CELLAR, 36);
  const screen = createPlayScreen(host, look.id);
  screen.renderBar({
    context: `Garden ${ROOT_CELLAR.number}`,
    title: ROOT_CELLAR.title,
    length: game.body.length + game.growing,
    score: game.score,
    chain: 0,
    tempo: 'stroll',
  });
  screen.fit();
  const t0 = options.time - 0.32;
  await present(
    (time) =>
      screen.view.draw({
        board: game.board,
        seed: ROOT_CELLAR.id,
        look,
        grid: true,
        body: game.body,
        heading: game.heading,
        digit: game.digit,
        mood: 'dizzy',
        sag: Math.min(1, (time - t0) / 1.2),
        bonk: game.loss ? { at: game.loss.at, age: time - t0 } : null,
        time,
        reducedMotion: false,
      }),
    options,
  );
};

/**
 * A close look at the noodle itself, large: head, tail, the saddle, a bulge, and a stretch of body
 * going into one tunnel mouth and out of the other. Not a hero frame; for checking the drawing.
 */
const anatomy: Scene = async (host, options) => {
  const look = lookFor(options.dark);
  const board = parseBoard(
    mapOf(10, 6, {
      A: [
        [1, 4],
        [8, 1],
      ],
      '#': [[3, 4]],
    }),
  );
  // Head first. The noodle went down into mouth A at (1, 4) and came out at (8, 1).
  const body: Cell[] = [
    { x: 5, y: 4 },
    { x: 5, y: 3 },
    { x: 5, y: 2 },
    { x: 6, y: 2 },
    { x: 7, y: 2 },
    { x: 8, y: 2 },
    { x: 8, y: 1 },
    { x: 1, y: 3 },
    { x: 1, y: 2 },
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 3, y: 1 },
    { x: 4, y: 1 },
  ];
  const screen = createPlayScreen(host, look.id);
  screen.renderBar({
    context: 'Check',
    title: 'Noodle close up',
    length: body.length,
    score: 0,
    chain: 0,
    tempo: 'creep',
  });
  screen.fit();
  screen.view.resize(
    screen.stage.clientWidth,
    screen.stage.clientHeight,
    window.devicePixelRatio || 1,
    { sideShare: 0.08, skyShare: 0.12, bottomShare: 0.04, maxCell: 150 },
  );
  await present(
    (time) =>
      screen.view.draw({
        board,
        seed: 'anatomy',
        look,
        grid: true,
        body,
        heading: 'down',
        digit: { at: { x: 7, y: 4 }, value: 7 },
        bulges: [{ at: 3, size: 6 }],
        time,
        reducedMotion: false,
      }),
    options,
  );
};

/**
 * The frame-rate check: a 300-cell noodle snaking through a big bed, gliding a cell every tenth
 * of a second with a chain pulse running down it, drawn every frame. Not a hero frame.
 */
const perf: Scene = async (host, options) => {
  const look = lookFor(options.dark);
  const width = 36;
  const height = 18;
  const board = parseBoard(mapOf(width, height, {}));
  // A path back and forth across the bed, long enough to take 300 cells and then some.
  const lane: Cell[] = [];
  for (let y = 1; y < height - 1; y++)
    for (let i = 0; i < width - 2; i++) lane.push({ x: y % 2 === 1 ? 1 + i : width - 2 - i, y });
  const screen = createPlayScreen(host, look.id);
  screen.renderBar({
    context: 'Check',
    title: 'A noodle of 300',
    length: 300,
    score: 0,
    chain: 4,
    tempo: 'zoom',
  });
  screen.fit();
  const started = performance.now();
  const frame = () => {
    const t = (performance.now() - started) / 1000;
    const moved = Math.floor(t * 10);
    const headAt = 300 + (moved % (lane.length - 301));
    const body = lane.slice(headAt - 299, headAt + 1).reverse();
    screen.view.draw({
      board,
      seed: 'perf',
      look,
      grid: true,
      body,
      heading: 'right',
      digit: { at: { x: 2, y: 0 }, value: 9 },
      bulges: [
        { at: (t * 10) % 1, size: 9 },
        { at: 40 + ((t * 10) % 1), size: 6 },
      ],
      pulse: (t % 2) / 2,
      lead: (t * 10) % 1,
      vacated: lane[headAt - 300] ?? null,
      time: t,
      reducedMotion: false,
    });
    requestAnimationFrame(frame);
  };
  frame();
  void options;
};

export const HERO_SCENES: Record<string, Scene> = { garden, fill, title, bonk, anatomy, perf };
