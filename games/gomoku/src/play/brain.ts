import { createRng } from '@usr-games/kit';
import { type Choice, OpponentMind } from '../engine/ai';
import { type GameState, newGame, play, type Rules } from '../engine/game';
import { opponentById, type OpponentId } from '../engine/opponents';

/**
 * One opponent's seat at the board: a copy of the game kept in step with every move, and the
 * opponent's mind. It runs in a worker during play (see `ai-worker.ts`) and in the page itself
 * where workers are not available (tests) or not worth it (the Hall's demo).
 */

export interface SeatSetup {
  opponent: OpponentId;
  size: number;
  rules: Rules;
  seed: string;
  /** Moves already played, for a seat joining a game in progress. */
  moves?: readonly number[];
}

export class Brain {
  private readonly game: GameState;
  private readonly mind: OpponentMind;

  constructor(setup: SeatSetup) {
    this.game = newGame(setup.size, setup.rules);
    this.mind = new OpponentMind(opponentById(setup.opponent), setup.size, createRng(setup.seed));
    for (const p of setup.moves ?? []) this.played(p);
  }

  played(p: number): void {
    this.mind.played(p, this.game.toMove);
    play(this.game, p);
  }

  choose(): Choice {
    return this.mind.choose(this.game);
  }
}
