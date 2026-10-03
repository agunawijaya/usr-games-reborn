import { createRng } from '@usr-games/kit';
import { OpponentMind } from './ai';
import { type GameState, indexOf, newGame, play, type Rules } from './game';
import { type Opponent, opponentById, type OpponentId } from './opponents';

/**
 * A whole game between two opponents, for the balance tests and the Bot League's numbers. The
 * first stone goes near the middle, chosen by the seed, so games differ.
 */
export function match(
  blackId: OpponentId | Opponent,
  whiteId: OpponentId | Opponent,
  seed: string,
  options: { size?: number; rules?: Rules } = {},
): GameState {
  const size = options.size ?? 15;
  const game = newGame(size, options.rules ?? 'freestyle');
  const rng = createRng(seed);
  const who = (o: OpponentId | Opponent) => (typeof o === 'string' ? opponentById(o) : o);
  const black = new OpponentMind(who(blackId), size, rng.split('black'));
  const white = new OpponentMind(who(whiteId), size, rng.split('white'));
  const middle = (size - 1) / 2;
  const first = indexOf(game, middle + rng.int(-2, 2), middle + rng.int(-2, 2));
  for (const m of [black, white]) m.played(first, 'black');
  play(game, first);
  while (game.winner === null && !game.draw) {
    const mover = game.toMove === 'black' ? black : white;
    const { point } = mover.choose(game);
    for (const m of [black, white]) m.played(point, game.toMove);
    if (play(game, point) === 'illegal')
      throw new Error(`${seed}: a move to a taken point, ${point}`);
  }
  return game;
}
