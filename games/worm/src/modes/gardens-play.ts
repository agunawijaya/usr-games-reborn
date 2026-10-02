import { createRng, type Rng } from '@usr-games/kit';
import { parseBoard } from '../engine/board';
import { chooseMove } from '../engine/bot';
import { createGame, type Game, move } from '../engine/game';
import type { GardenSpec } from '../gardens/gardens';
import { type FillPuzzle, secondStarMoves } from '../gardens/puzzles';

/**
 * Games set up from the gardens and puzzles, how their stars are earned, and a run of the house
 * noodle through a garden for the balance checks.
 */

export function gardenGame(spec: GardenSpec, random: Rng): Game {
  return createGame({
    board: parseBoard(spec.map),
    body: spec.start,
    heading: spec.heading,
    random,
    goal: spec.goal ?? undefined,
    digits: spec.digits,
    plan: spec.plan,
    countUpBonus: spec.countUpBonus,
  });
}

export function puzzleGame(puzzle: FillPuzzle): Game {
  return createGame({
    board: parseBoard(puzzle.map),
    body: puzzle.start,
    heading: puzzle.heading,
    plan: puzzle.plan,
    // A puzzle's digits are all placed; the random source is only a formality.
    random: createRng(`puzzle:${puzzle.id}`),
  });
}

export interface GardenStars {
  grown: boolean;
  chain: boolean;
  noDash: boolean;
}

export function gardenStars(spec: GardenSpec, game: Game): GardenStars {
  const grown = game.status === 'grown' || game.status === 'filled';
  return {
    grown,
    chain: game.bestChain >= spec.chainTarget,
    noDash: grown && game.dashes === 0,
  };
}

export function starCount(stars: GardenStars): number {
  return [stars.grown, stars.chain, stars.noDash].filter(Boolean).length;
}

/** One star for filling the box, two within a few moves of par, three at par or better. */
export function puzzleStars(puzzle: FillPuzzle, game: Game): number {
  if (game.status !== 'filled') return 0;
  if (game.moves <= puzzle.par) return 3;
  return game.moves <= secondStarMoves(puzzle) ? 2 : 1;
}

export interface BotRun {
  stars: GardenStars;
  moves: number;
  score: number;
  bestChain: number;
  length: number;
}

/** The house noodle plays a garden to its end (or a move limit), never dashing. */
export function botRun(spec: GardenSpec, seed: string, moveLimit = 4000): BotRun {
  const game = gardenGame(spec, createRng(seed));
  while (game.moves < moveLimit && (game.status === 'playing' || game.status === 'waiting')) {
    const dir = chooseMove(game);
    if (!dir) break;
    move(game, dir);
  }
  return {
    stars: gardenStars(spec, game),
    moves: game.moves,
    score: game.score,
    bestChain: game.bestChain,
    length: game.body.length + game.growing,
  };
}
