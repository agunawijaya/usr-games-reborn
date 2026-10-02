import { createRng, type Rng } from '@usr-games/kit';
import { indexOf, parseBoard } from '../engine/board';
import type { Game } from '../engine/game';
import { DIRS, step } from '../engine/geometry';
import { type GardenSpec, mapOf, straightStart } from '../gardens/gardens';

/**
 * The Daily Garden: one bed and one run of digits for everyone on the day, made from the kit's
 * daily seed. It is played like Endless (until the noodle bonks or fills the box), and its three
 * stars are shared as squares: length, chain and no dash.
 */

const WIDTH = 20;
const HEIGHT = 11;
/** Kept clear round the noodle's starting row, so the day never opens on a wall. */
const START_ROW = 5;
const CLEAR = { left: 2, right: 13, top: 4, bottom: 6 };

export const DAILY_LENGTH_TARGET = 50;
export const DAILY_CHAIN_TARGET = 3;

const FIRST = [
  'Sunflower',
  'Pumpkin',
  'Bean',
  'Carrot',
  'Mint',
  'Radish',
  'Clover',
  'Tulip',
  'Turnip',
  'Pea',
  'Marigold',
  'Lettuce',
  'Daisy',
  'Parsnip',
];
const SECOND = [
  'Row',
  'Patch',
  'Corner',
  'Bed',
  'Plot',
  'Border',
  'Ridge',
  'Hollow',
  'Rows',
  'Strip',
];

function cleared(x: number, y: number): boolean {
  return x >= CLEAR.left && x <= CLEAR.right && y >= CLEAR.top && y <= CLEAR.bottom;
}

function feature(
  features: Record<string, [number, number][]>,
  ch: string,
  cells: [number, number][],
): void {
  const keep = cells.filter(
    ([x, y]) => x >= 0 && y >= 0 && x < WIDTH && y < HEIGHT && !cleared(x, y),
  );
  features[ch] = [...(features[ch] ?? []), ...keep];
}

/** A small clump of rock: one to four cells hanging together. */
function rockClump(random: Rng): [number, number][] {
  const x = random.int(0, WIDTH - 2);
  const y = random.int(0, HEIGHT - 2);
  const shapes: [number, number][][] = [
    [[0, 0]],
    [
      [0, 0],
      [1, 0],
    ],
    [
      [0, 0],
      [0, 1],
    ],
    [
      [0, 0],
      [1, 0],
      [0, 1],
    ],
    [
      [0, 0],
      [1, 0],
      [1, 1],
    ],
    [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ],
  ];
  return random.pick(shapes).map(([dx, dy]) => [x + dx, y + dy]);
}

/** A root strand growing in from the top or the bottom edge. */
function rootStrand(random: Rng): [number, number][] {
  const fromTop = random.chance(0.5);
  let x = random.int(1, WIDTH - 2);
  const cells: [number, number][] = [];
  for (let k = 0; k < random.int(2, 4); k++) {
    cells.push([x, fromTop ? k : HEIGHT - 1 - k]);
    if (random.chance(0.35)) {
      x += random.chance(0.5) ? 1 : -1;
      cells.push([x, fromTop ? k : HEIGHT - 1 - k]);
    }
  }
  return cells;
}

function mudPatch(random: Rng): [number, number][] {
  const x = random.int(1, WIDTH - 4);
  const y = random.int(1, HEIGHT - 3);
  const cells: [number, number][] = [];
  for (let dy = 0; dy < 2; dy++)
    for (let dx = 0; dx < 3; dx++) if (random.chance(0.75)) cells.push([x + dx, y + dy]);
  return cells;
}

/** True when every cell that is not rock can be reached from the noodle's head. */
function allInReach(map: readonly string[]): boolean {
  const board = parseBoard(map);
  const start = { x: 9, y: START_ROW };
  const seen = new Set([indexOf(board, start)]);
  const queue = [start];
  while (queue.length > 0) {
    const cell = queue.pop()!;
    for (const dir of DIRS) {
      const n = step(cell, dir);
      if (n.x < 0 || n.y < 0 || n.x >= board.width || n.y >= board.height) continue;
      const i = indexOf(board, n);
      if (board.terrain[i] === 'rock' || seen.has(i)) continue;
      seen.add(i);
      queue.push(n);
      const exit = board.tunnelExit.get(i);
      if (exit && !seen.has(indexOf(board, exit))) {
        seen.add(indexOf(board, exit));
        queue.push(exit);
      }
    }
  }
  return board.terrain.every((t, i) => t === 'rock' || seen.has(i));
}

export function dailyName(seed: string): string {
  const random = createRng(`${seed}:name`);
  return `${random.pick(FIRST)} ${random.pick(SECOND)}`;
}

export function dailyGarden(seed: string, number: number): GardenSpec {
  const random = createRng(seed);
  for (let attempt = 0; attempt < 50; attempt++) {
    const features: Record<string, [number, number][]> = {};
    for (let i = 0; i < random.int(4, 7); i++) feature(features, '#', rockClump(random));
    if (random.chance(0.6))
      for (let i = 0; i < random.int(1, 3); i++) feature(features, 'r', rootStrand(random));
    if (random.chance(0.5)) feature(features, '~', mudPatch(random));
    if (random.chance(0.5)) {
      // A tunnel joins the left and right ends of the bed.
      feature(features, 'A', [
        [random.int(0, 2), random.int(0, HEIGHT - 1)],
        [random.int(WIDTH - 3, WIDTH - 1), random.int(0, HEIGHT - 1)],
      ]);
      if (features.A!.length !== 2) delete features.A;
    }
    // Later features win a cell; keep each kind off the others.
    const taken = new Set<string>();
    for (const ch of ['A', '#', 'r', '~']) {
      if (!features[ch]) continue;
      features[ch] = features[ch]!.filter(([x, y]) => {
        const key = `${x},${y}`;
        if (taken.has(key)) return false;
        taken.add(key);
        return true;
      });
      if (ch === 'A' && features.A!.length !== 2) delete features.A;
    }
    const map = mapOf(WIDTH, HEIGHT, features);
    if (!allInReach(map)) continue;
    return {
      id: `daily-${number}`,
      number,
      title: dailyName(seed),
      idea: '',
      map,
      start: straightStart({ x: 9, y: START_ROW }, 'right', 6),
      heading: 'right',
      // Played until the noodle bonks or fills the bed, like Endless.
      goal: null,
      chainTarget: DAILY_CHAIN_TARGET,
    };
  }
  throw new Error(`No Daily Garden could be made from ${seed}`);
}

export interface DailyOutcome {
  length: number;
  bestChain: number;
  dashes: number;
}

export function dailyOutcome(game: Game): DailyOutcome {
  return {
    length: game.body.length + game.growing,
    bestChain: game.bestChain,
    dashes: game.dashes,
  };
}

type Square = 'hit' | 'near' | 'empty';

/**
 * Length, chain and no dash: earned, close, or not this time. Going without a dash only counts
 * on a run that also grew: bonking early with no dash is not much of a feat.
 */
export function dailySquares(outcome: DailyOutcome): Square[] {
  const long = outcome.length >= DAILY_LENGTH_TARGET;
  const nearlyLong = outcome.length >= DAILY_LENGTH_TARGET * 0.75;
  return [
    long ? 'hit' : nearlyLong ? 'near' : 'empty',
    outcome.bestChain >= DAILY_CHAIN_TARGET
      ? 'hit'
      : outcome.bestChain === DAILY_CHAIN_TARGET - 1
        ? 'near'
        : 'empty',
    outcome.dashes === 0 && long ? 'hit' : outcome.dashes <= 2 && nearlyLong ? 'near' : 'empty',
  ];
}

const SQUARE_EMOJI: Record<Square, string> = { hit: '🟩', near: '🟨', empty: '⬜' };

/** `Noodle Nine #42 · length 87 · best chain ×6 · 🟩🟩🟨`, with no link. */
export function dailyShareText(number: number, outcome: DailyOutcome): string {
  const chain = outcome.bestChain >= 2 ? `best chain ×${outcome.bestChain}` : 'no chain yet';
  const squares = dailySquares(outcome)
    .map((s) => SQUARE_EMOJI[s])
    .join('');
  return `Noodle Nine #${number} · length ${outcome.length} · ${chain} · ${squares}`;
}
