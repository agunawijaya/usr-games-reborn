import type { Rng } from '@usr-games/kit';
import { CampbellMind, type Weighing } from './campbell/mind';
import { cloneGame, type GameState, other, type Stone } from './game';
import type { Opponent } from './opponents';
import {
  canForceWin,
  fivePoints,
  fourMoves,
  hasOpenFourMove,
  type SolveOptions,
  winningFirstMoves,
} from './solver';

/**
 * An opponent at the board. Every one takes a five when it has one and blocks yours (Pebble now
 * and then forgets to), then asks the 1994 player for its move, thinking as far ahead as its
 * personality allows. The gentler ones then make human slips: a near-best point on a quiet move,
 * or an open three of yours overlooked. The Referee first looks for a win by a chain of threats,
 * and checks that the 1994 choice does not leave you one.
 */

export type Reason =
  'five' | 'block' | 'forcing-win' | 'defence' | 'search' | 'slip' | 'overlooked';

export interface Choice {
  point: number;
  reason: Reason;
  /** What the 1994 player weighed, when it was asked. */
  weighing: Weighing | null;
}

const BY_FOURS: SolveOptions = { moves: 10, threes: false, nodes: 20_000 };
const BY_THREATS: SolveOptions = { moves: 5, threes: true, nodes: 20_000 };

/** How far down its own list of good points a slip may reach. */
const SLIP_REACH = 5;

export class OpponentMind {
  private readonly mind: CampbellMind;

  constructor(
    readonly opponent: Opponent,
    readonly size: number,
    private readonly rng: Rng,
  ) {
    this.mind = new CampbellMind(size, { next: () => rng.nextUint32() >>> 1 });
  }

  /** Tells the opponent a stone was played (its own included). */
  played(p: number, stone: Stone): void {
    this.mind.played(p, stone === 'black');
  }

  choose(game: GameState): Choice {
    const me = game.toMove;
    const them = other(me);
    const play = this.opponent.play;
    const fives = fivePoints(game, me);
    if (fives.length > 0) return { point: fives[0]!, reason: 'five', weighing: null };
    const danger = fivePoints(game, them);
    const forgetsTheBlock = danger.length > 0 && this.rng.chance(play.blindToFour);
    if (danger.length > 0 && !forgetsTheBlock)
      return { point: danger[0]!, reason: 'block', weighing: null };
    if (play.threatSearch && danger.length === 0) {
      const win = this.forcingWin(game);
      if (win !== null) return { point: win, reason: 'forcing-win', weighing: null };
    }

    const searched = this.mind.choose(me === 'black', {
      maxDepth: play.maxDepth,
      maxWork: play.maxWork,
    }).point;
    const weighing = this.mind.weighing();
    if (forgetsTheBlock) return { point: this.slip(game, danger), reason: 'overlooked', weighing };
    if (play.threatSearch) {
      const safe = this.defend(game, searched);
      return { point: safe, reason: safe === searched ? 'search' : 'defence', weighing };
    }
    if (
      hasOpenFourMove(game, them) &&
      stopsOpenFour(game, searched) &&
      this.rng.chance(play.blindToThree)
    ) {
      const own = weighing?.best[me === 'black' ? 0 : 1];
      const point =
        own !== undefined && !stopsOpenFour(game, own) ? own : this.slip(game, [searched]);
      return { point, reason: 'overlooked', weighing };
    }
    if (isQuiet(game, searched) && this.rng.chance(play.slip))
      return { point: this.slip(game, [searched]), reason: 'slip', weighing };
    return { point: searched, reason: 'search', weighing };
  }

  /** A near-best point by the 1994 player's own reckoning, never one of `avoid`. */
  private slip(game: GameState, avoid: readonly number[]): number {
    const ranked = this.mind
      .ranked(game.toMove === 'black')
      .filter((p) => !avoid.includes(p) && game.board[p] === null);
    const reach = Math.min(SLIP_REACH, ranked.length);
    return reach > 0 ? ranked[this.rng.int(0, reach - 1)]! : avoid[0]!;
  }

  /** The Referee's own forcing win: by fours first, then with threes. */
  private forcingWin(game: GameState): number | null {
    const trial = cloneGame(game);
    for (const options of [BY_FOURS, BY_THREATS]) {
      const { moves } = winningFirstMoves(trial, options);
      if (moves.length > 0) return moves[0]!;
    }
    return null;
  }

  /**
   * If `candidate` would leave the other side a forcing win, the first answer that leaves it none:
   * a point of its winning lines, a four of our own, or one of the 1994 player's next choices.
   */
  private defend(game: GameState, candidate: number): number {
    const me = game.toMove;
    const them = other(me);
    const trial = cloneGame(game);
    const leavesThemAWin = (p: number): boolean => {
      trial.board[p] = me;
      trial.toMove = them;
      const lost = BY_THREATS_AND_FOURS.some((options) => canForceWin(trial, options));
      trial.board[p] = null;
      trial.toMove = me;
      return lost;
    };
    if (!leavesThemAWin(candidate)) return candidate;
    trial.toMove = them;
    const theirs = BY_THREATS_AND_FOURS.flatMap(
      (options) => winningFirstMoves(trial, options).moves,
    );
    trial.toMove = me;
    const answers = new Set([
      ...theirs,
      ...fourMoves(trial, me),
      ...this.mind.ranked(me === 'black').slice(0, 12),
    ]);
    for (const p of answers) if (trial.board[p] === null && !leavesThemAWin(p)) return p;
    return candidate;
  }
}

const BY_THREATS_AND_FOURS = [BY_FOURS, BY_THREATS];

/** Would playing `p` (for the side to move) leave the other side no open four to make? */
function stopsOpenFour(game: GameState, p: number): boolean {
  const me = game.toMove;
  game.board[p] = me;
  const stopped = !hasOpenFourMove(game, other(me));
  game.board[p] = null;
  return stopped;
}

/** No fours anywhere, no open four in the making for the other side, and `p` makes no four. */
function isQuiet(game: GameState, p: number): boolean {
  const me = game.toMove;
  if (hasOpenFourMove(game, other(me))) return false;
  if (fivePoints(game, other(me)).length > 0) return false;
  game.board[p] = me;
  const makesFour = fivePoints(game, me).length > 0;
  game.board[p] = null;
  return !makesFour;
}
