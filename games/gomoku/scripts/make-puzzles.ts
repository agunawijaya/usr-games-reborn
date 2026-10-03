import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { createRng } from '@usr-games/kit';
import { OpponentMind } from '../src/engine/ai';
import { cloneGame, indexOf, newGame, other, play, type GameState } from '../src/engine/game';
import { opponentById, type OpponentId } from '../src/engine/opponents';
import { fivePoints, winningFirstMoves } from '../src/engine/solver';
import { bandOf, type Band } from '../src/modes/puzzles';

/**
 * Makes the puzzles. Opponents of the ladder play each other on a 15 × 15 board; whenever the
 * 1994 player rates the point it is about to play one move from unstoppable (its combination
 * search has found a forcing win), the position is offered to the solver. It becomes a puzzle if
 * the side to move can force five in two to seven moves and exactly one first move does it that
 * fast, counting threes as well as fours; all fours if it can be done with fours. One puzzle a
 * game at most, so they differ.
 *
 * Games are seeded, so collecting is repeatable and can be split across processes:
 *
 *   tsx scripts/make-puzzles.ts collect 1 250 found-a.jsonl      (and other seed ranges)
 *   tsx scripts/make-puzzles.ts build found-a.jsonl found-b.jsonl ...
 *
 * The build takes the first twenty puzzles of each band by seed for the numbered sixty, and the
 * next two hundred for the Daily Puzzle's pool.
 */

interface Found {
  band: Band;
  moves: number;
  threes: boolean;
  position: number[];
  answer: number;
  /** The game it came from (dropped from the published file). */
  seed: number;
}

const SIZE = 15;
const NODES = 60_000;
const WANT = { gentle: 20, keen: 20, deep: 20 };
const DAILY = 200;
const PAIRS: [OpponentId, OpponentId][] = [
  ['heron', 'koi'],
  ['reed', 'heron'],
  ['koi', 'reed'],
  ['koi', 'campbell'],
  ['campbell', 'heron'],
];

/** The puzzle in this position, if there is one. */
function puzzleAt(game: GameState): Omit<Found, 'position' | 'seed'> | null {
  const me = game.toMove;
  if (fivePoints(game, me).length > 0 || fivePoints(game, other(me)).length > 0) return null;
  for (let n = 2; n <= 7; n++) {
    const fours = winningFirstMoves(game, { moves: n, threes: false, nodes: NODES });
    if (!fours.complete) return null;
    const all = n >= 3 ? winningFirstMoves(game, { moves: n, threes: true, nodes: NODES }) : fours;
    if (!all.complete) return null;
    if (all.moves.length === 0) continue;
    if (all.moves.length !== 1) return null;
    return {
      band: bandOf(n),
      moves: n,
      threes: fours.moves.length === 0,
      answer: all.moves[0]!,
    };
  }
  return null;
}

/** Plays one seeded game and returns its puzzle, if it has one. */
function playGame(seed: number): Found | null {
  const [a, b] = PAIRS[seed % PAIRS.length]!;
  const rng = createRng(`puzzles:${seed}`);
  const game = newGame(SIZE, 'freestyle');
  const minds = {
    black: new OpponentMind(opponentById(a), SIZE, rng.split('black')),
    white: new OpponentMind(opponentById(b), SIZE, rng.split('white')),
  };
  const first = indexOf(game, 7 + rng.int(-2, 2), 7 + rng.int(-2, 2));
  for (const m of Object.values(minds)) m.played(first, 'black');
  play(game, first);
  while (game.winner === null && !game.draw) {
    const side = game.toMove;
    const choice = minds[side].choose(game);
    const w = choice.weighing;
    const forcing = w && w.strength[side === 'black' ? 0 : 1]![w.chosen]! >= 1;
    if (forcing && game.moves.length >= 10) {
      const puzzle = puzzleAt(cloneGame(game));
      if (puzzle) return { ...puzzle, position: [...game.moves], seed };
    }
    for (const m of Object.values(minds)) m.played(choice.point, side);
    play(game, choice.point);
  }
  return null;
}

/** `collect <from> <to> <file>`: plays seeds from..to, adding each puzzle found to the file. */
function collect(from: number, to: number, file: string): void {
  const started = Date.now();
  for (let seed = from; seed <= to; seed++) {
    const found = playGame(seed);
    if (found) appendFileSync(file, `${JSON.stringify(found)}\n`);
    if (seed % 10 === 0)
      console.warn(`seed ${seed}, ${Math.round((Date.now() - started) / 1000)} s`);
  }
}

/** `build <file>...`: the numbered puzzles and the daily pool from what was collected, by seed. */
function build(files: string[]): void {
  const found = files
    .flatMap((file) => readFileSync(file, 'utf8').split('\n'))
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as Found)
    .sort((x, y) => x.seed - y.seed);
  const numbered = (['gentle', 'keen', 'deep'] as const)
    .flatMap((band) => found.filter((f) => f.band === band).slice(0, WANT[band]))
    .sort((x, y) => x.moves - y.moves || x.seed - y.seed);
  const daily = found.filter((f) => !numbered.includes(f)).slice(0, DAILY);
  const strip = ({ seed: _seed, ...puzzle }: Found) => puzzle;
  const out = { size: SIZE, numbered: numbered.map(strip), daily: daily.map(strip) };
  writeFileSync(new URL('../src/modes/puzzles.json', import.meta.url), `${JSON.stringify(out)}\n`);
  const count = (list: Found[], band: Band) => list.filter((f) => f.band === band).length;
  console.warn(
    `from ${found.length}: numbered ${numbered.length} (${count(numbered, 'gentle')}/${count(numbered, 'keen')}/${count(numbered, 'deep')}), daily ${daily.length} (${count(daily, 'gentle')}/${count(daily, 'keen')}/${count(daily, 'deep')})`,
  );
}

const [mode, ...args] = process.argv.slice(2);
if (mode === 'collect') collect(Number(args[0]), Number(args[1]), args[2]!);
else if (mode === 'build') build(args);
else console.warn('usage: make-puzzles.ts collect <from> <to> <file> | build <file>...');
