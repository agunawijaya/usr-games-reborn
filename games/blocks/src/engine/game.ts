import type { Rng } from '@usr-games/kit';
import { cellsOf, FORMS, KINDS, type Offset } from './forms';

/**
 * One tank and the sinker falling through it, played a step at a time.
 *
 * Classic rules are the 1992 program's: shapes drawn uniformly at random, quarter turns
 * counter-clockwise only and only where they fit, a point for every landing and a point for every
 * row a dropped shape falls, rows that score nothing, a dropped shape that can still be slid and
 * turned until the next tick, and a total multiplied by the level at the end.
 *
 * Standard rules keep the same shapes and turns and add what Sinkers is about: turns both ways
 * with a one-cell nudge off a wall, a plunge that lands at once and scores twice the depth fallen,
 * landings worth more the deeper they settle, and cleared rows that burst into bubbles worth more
 * for every plunge in a row. A dive may add currents that push a sinker aside as it passes a row,
 * and cells set in the tank before the first sinker: coral to clear, seaweed in the way.
 */

export type Rules = 'standard' | 'classic';

/** Settled cells that were never a sinker: set in the tank by a dive. */
export const SEAWEED = 7;
export const CORAL = 8;

/** A current across one row: a sinker whose centre sinks into that row is pushed one cell. */
export interface Current {
  readonly row: number;
  readonly dir: -1 | 1;
}

/** A cell of a settled sinker. */
export interface Settled {
  /** Which sinker it came from, so its cells can be drawn fused together. */
  readonly group: number;
  readonly kind: number;
  /** The row its sinker settled at, for its colour: shallow to deep. */
  readonly depth: number;
}

export type Landing = 'soft' | 'plunge';

export interface Burst {
  rows: number[];
  points: number;
  combo: number;
}

export type GameEvent =
  | { kind: 'moved'; dx: number; dy: number }
  | { kind: 'drifted'; dx: number }
  | { kind: 'turned'; nudge: number }
  | { kind: 'blocked' }
  | { kind: 'plunged'; rows: number; points: number }
  | { kind: 'landed'; cells: Offset[]; how: Landing; points: number; group: number }
  | { kind: 'burst'; burst: Burst }
  | { kind: 'spawned'; shape: number }
  | { kind: 'levelled'; level: number }
  | { kind: 'over' };

export interface Game {
  readonly rules: Rules;
  readonly width: number;
  readonly height: number;
  /** Rows from -1 (one hidden row above the water, as the original had) to height - 1. */
  readonly cells: (Settled | null)[];
  form: number;
  x: number;
  y: number;
  /** The kind that comes next. */
  next: number;
  level: number;
  /** The level a run began at; Marathon climbs from it. */
  readonly startLevel: number;
  /** Rows to burst for each level up (Marathon), or null for a level that stays put. */
  readonly levelEvery: number | null;
  readonly currents: readonly Current[];
  /** Classic: points before the level multiplies them. Standard: the score itself. */
  points: number;
  /** Classic: microseconds between ticks, a hair shorter every tick. */
  fallMicros: number;
  /** Classic: the shape was dropped and lands at the next tick unless moved on. */
  dropped: boolean;
  rowsCleared: number;
  landings: number;
  rowsPlunged: number;
  /**
   * The depth combo: plunges in a row without a soft landing. A burst cashes it in and it starts
   * over, so it measures how much a player builds up before letting the rows go.
   */
  combo: number;
  /** The deepest combo a burst has cashed in. */
  bestCombo: number;
  bursts: number;
  fourRowBursts: number;
  /** Sinkers in a row whose landing burst rows, and the longest such run. */
  burstChain: number;
  bestBurstChain: number;
  /** For the packages: turns clockwise taken, and rows sunk with the sink key. */
  turnsRight: number;
  sinks: number;
  over: boolean;
  nextGroup: number;
  readonly random: Rng;
  /** A fixed run of kinds (the Daily Dive); random draws once it runs out. */
  plan: number[] | null;
}

export interface NewGame {
  rules: Rules;
  width: number;
  height: number;
  level: number;
  random: Rng;
  plan?: readonly number[];
  levelEvery?: number;
  currents?: readonly Current[];
}

/** Rows hidden above the water: shapes may poke one row out, as they could in 1992. */
const HIDDEN = 1;

/** Standard bursts by rows cleared at once. */
export const BURST_POINTS = [0, 10, 30, 60, 100] as const;

/** Marathon climbs no higher than this. */
export const TOP_LEVEL = 15;

export function spawnColumn(width: number): number {
  // The original put the centre in column 5 of 1 to 10: the middle, leaning left.
  return Math.floor((width - 1) / 2);
}

function drawKind(game: Pick<Game, 'plan' | 'random'>): number {
  const planned = game.plan?.shift();
  return planned ?? game.random.int(0, KINDS - 1);
}

export function createGame(options: NewGame): Game {
  const game: Game = {
    rules: options.rules,
    width: options.width,
    height: options.height,
    cells: Array.from({ length: options.width * (options.height + HIDDEN) }, () => null),
    form: 0,
    x: spawnColumn(options.width),
    y: 0,
    next: 0,
    level: options.level,
    startLevel: options.level,
    levelEvery: options.levelEvery ?? null,
    currents: options.currents ?? [],
    points: 0,
    fallMicros: Math.floor(1_000_000 / options.level),
    dropped: false,
    rowsCleared: 0,
    landings: 0,
    rowsPlunged: 0,
    combo: 0,
    bestCombo: 0,
    bursts: 0,
    fourRowBursts: 0,
    burstChain: 0,
    bestBurstChain: 0,
    turnsRight: 0,
    sinks: 0,
    over: false,
    nextGroup: 1,
    random: options.random,
    plan: options.plan ? [...options.plan] : null,
  };
  // As in 1992, the shape that comes next is drawn before the one that falls first.
  game.next = drawKind(game);
  game.form = drawKind(game);
  return game;
}

/** A copy that can be played ahead without touching the original (the diver's look-ahead). */
export function cloneGame(game: Game, random: Rng): Game {
  return { ...game, cells: [...game.cells], random, plan: game.plan ? [...game.plan] : null };
}

export function cellAt(game: Game, x: number, y: number): Settled | null | undefined {
  if (x < 0 || x >= game.width || y < -HIDDEN || y >= game.height) return undefined;
  return game.cells[(y + HIDDEN) * game.width + x];
}

/** Sets a cell in the tank before play: coral, seaweed, or anything a test needs. */
export function setCell(game: Game, x: number, y: number, cell: Settled | null): void {
  game.cells[(y + HIDDEN) * game.width + x] = cell;
}

/** How many settled cells of a kind are left (the coral a dive asks to clear). */
export function countKind(game: Game, kind: number): number {
  return game.cells.filter((c) => c?.kind === kind).length;
}

/** True when every cell of the form is inside the tank (or the hidden row) and empty. */
export function fits(game: Game, form: number, x: number, y: number): boolean {
  return cellsOf(form, x, y).every((c) => cellAt(game, c.x, c.y) === null);
}

export function fallingCells(game: Game): Offset[] {
  return cellsOf(game.form, game.x, game.y);
}

function currentAt(game: Pick<Game, 'currents'>, row: number): -1 | 1 | 0 {
  return game.currents.find((c) => c.row === row)?.dir ?? 0;
}

/**
 * One row down from (x, y) if the form fits there, then the push of any current in that row if
 * the form fits aside too. Null when it cannot go down at all.
 */
export function stepDown(game: Game, form: number, x: number, y: number): Offset | null {
  if (!fits(game, form, x, y + 1)) return null;
  const push = currentAt(game, y + 1);
  if (push !== 0 && fits(game, form, x + push, y + 1)) return { x: x + push, y: y + 1 };
  return { x, y: y + 1 };
}

/** Where a form dropped from (x, y) would settle, currents and all. */
export function restingPlace(game: Game, form: number, x: number, y: number): Offset {
  let at: Offset = { x, y };
  for (;;) {
    const next = stepDown(game, form, at.x, at.y);
    if (!next) return at;
    at = next;
  }
}

/** Where the falling sinker would settle if dropped now. */
export function landingSpot(game: Game): Offset {
  return restingPlace(game, game.form, game.x, game.y);
}

/** The row the falling sinker would settle at if dropped now. */
export function landingRow(game: Game): number {
  return landingSpot(game).y;
}

/** True when the sinker can still go down a row. */
export function canSink(game: Game): boolean {
  return !game.over && fits(game, game.form, game.x, game.y + 1);
}

/** Down a row, pushed by the current there. */
function descend(game: Game): GameEvent[] {
  const next = stepDown(game, game.form, game.x, game.y)!;
  const events: GameEvent[] = [{ kind: 'moved', dx: 0, dy: 1 }];
  if (next.x !== game.x) events.push({ kind: 'drifted', dx: next.x - game.x });
  game.x = next.x;
  game.y = next.y;
  return events;
}

export function shift(game: Game, dx: -1 | 1): GameEvent[] {
  if (game.over) return [];
  if (!fits(game, game.form, game.x + dx, game.y)) return [{ kind: 'blocked' }];
  game.x += dx;
  return [{ kind: 'moved', dx, dy: 0 }];
}

/**
 * A quarter turn. Classic turns only counter-clockwise and only where the turned form fits.
 * Standard turns both ways and, against a wall or a neighbour, tries one cell aside.
 */
export function turn(game: Game, way: 'left' | 'right'): GameEvent[] {
  if (game.over) return [];
  if (game.rules === 'classic' && way === 'right') return [{ kind: 'blocked' }];
  const turned = way === 'left' ? FORMS[game.form]!.left : FORMS[game.form]!.right;
  const nudges = game.rules === 'classic' ? [0] : [0, -1, 1];
  for (const nudge of nudges) {
    if (fits(game, turned, game.x + nudge, game.y)) {
      game.form = turned;
      game.x += nudge;
      if (way === 'right') game.turnsRight++;
      return [{ kind: 'turned', nudge }];
    }
  }
  return [{ kind: 'blocked' }];
}

/** A tick of the clock: down a row, or settle where it is. */
export function fall(game: Game): GameEvent[] {
  if (game.over) return [];
  if (canSink(game)) return descend(game);
  return settle(game, game.dropped ? 'plunge' : 'soft');
}

/** Standard's soft sink: a row down now, and the clock carries on. */
export function sink(game: Game): GameEvent[] {
  if (!canSink(game)) return [];
  game.sinks++;
  return descend(game);
}

/**
 * Straight to the bottom. Classic scores a point a row and leaves the shape there to land at the
 * next tick (it can still be slid and turned meanwhile, as in 1992). Standard scores twice the
 * depth, times the level, and settles at once.
 */
export function plunge(game: Game): GameEvent[] {
  if (game.over) return [];
  const spot = landingSpot(game);
  const rows = spot.y - game.y;
  const drift = spot.x - game.x;
  game.x = spot.x;
  game.y = spot.y;
  game.rowsPlunged += rows;
  const drifted: GameEvent[] = drift !== 0 ? [{ kind: 'drifted', dx: drift }] : [];
  if (game.rules === 'classic') {
    game.points += rows;
    game.dropped = true;
    return [...drifted, { kind: 'plunged', rows, points: rows }];
  }
  const points = rows * 2 * game.level;
  game.points += points;
  return [...drifted, { kind: 'plunged', rows, points }, ...settle(game, 'plunge')];
}

/** Standard landing: a point times the depth bonus, deeper rows worth more. */
export function depthBonus(game: Pick<Game, 'height'>, row: number): number {
  return 1 + Math.floor((Math.max(0, row) * 3) / game.height);
}

function settle(game: Game, how: Landing): GameEvent[] {
  const cells = fallingCells(game);
  const group = game.nextGroup++;
  const kind = FORMS[game.form]!.kind;
  for (const c of cells) setCell(game, c.x, c.y, { group, kind, depth: Math.max(0, game.y) });
  game.landings++;
  game.dropped = false;
  const landingPoints = game.rules === 'classic' ? 1 : depthBonus(game, game.y) * game.level;
  game.points += landingPoints;
  if (game.rules === 'standard') game.combo = how === 'plunge' ? game.combo + 1 : 0;
  const events: GameEvent[] = [{ kind: 'landed', cells, how, points: landingPoints, group }];
  const level = game.level;
  const burst = clearRows(game);
  if (burst) events.push({ kind: 'burst', burst });
  game.burstChain = burst ? game.burstChain + 1 : 0;
  game.bestBurstChain = Math.max(game.bestBurstChain, game.burstChain);
  if (game.level !== level) events.push({ kind: 'levelled', level: game.level });
  game.form = game.next;
  game.next = drawKind(game);
  game.x = spawnColumn(game.width);
  game.y = 0;
  if (!fits(game, game.form, game.x, game.y)) {
    game.over = true;
    events.push({ kind: 'over' });
  } else events.push({ kind: 'spawned', shape: FORMS[game.form]!.kind });
  return events;
}

/** Full rows vanish, top to bottom, everything above falling to fill in (the hidden row too). */
function clearRows(game: Game): Burst | null {
  const rows: number[] = [];
  for (let y = 0; y < game.height; y++) {
    let full = true;
    for (let x = 0; x < game.width && full; x++) if (!cellAt(game, x, y)) full = false;
    if (!full) continue;
    rows.push(y);
    for (let row = y; row > -HIDDEN; row--)
      for (let x = 0; x < game.width; x++) setCell(game, x, row, cellAt(game, x, row - 1)!);
    for (let x = 0; x < game.width; x++) setCell(game, x, -HIDDEN, null);
  }
  if (rows.length === 0) return null;
  game.rowsCleared += rows.length;
  if (rows.length >= 4) game.fourRowBursts++;
  if (game.rules === 'classic') return { rows, points: 0, combo: 0 };
  game.bursts++;
  // The burst is paid at the level it happened at; any climb comes after.
  const level = game.level;
  if (game.levelEvery)
    game.level = Math.min(
      TOP_LEVEL,
      game.startLevel + Math.floor(game.rowsCleared / game.levelEvery),
    );
  const combo = Math.max(1, game.combo);
  const points = BURST_POINTS[Math.min(4, rows.length)]! * combo * level;
  game.points += points;
  game.bestCombo = Math.max(game.bestCombo, combo);
  game.combo = 0;
  return { rows, points, combo };
}

/**
 * Classic: the clock's next wait. Like the original, every tick first takes a three-thousandth off
 * the wait (in whole microseconds), so play speeds up a hair at a time, forever.
 */
export function classicTickMicros(game: Game): number {
  game.fallMicros -= Math.floor(game.fallMicros / 3000);
  return game.fallMicros;
}

/** Classic's final score: the points times the level. */
export function classicScore(game: Game): number {
  return game.points * game.level;
}

/** The score a run is judged by: Classic's points times its level, Standard's score as it is. */
export function finalScore(game: Game): number {
  return game.rules === 'classic' ? classicScore(game) : game.points;
}

/**
 * Standard's clock: seconds for a sinker to sink one row by itself. Level 1 sinks a row a second,
 * as the original's level 1 did; each level after adds a little over half a row a second.
 */
export function sinkSeconds(level: number): number {
  return 1 / (1 + 0.55 * (level - 1));
}
