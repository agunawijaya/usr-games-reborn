import { createRng, type Rng } from '@usr-games/kit';
import { isLongPiece, pieces } from '../ai/endgame';
import { chooseMove, type OpponentId } from '../ai/opponents';
import { Position } from '../ai/position';
import { type Board, isFull, newBoard, type Player, play } from '../engine/board';
import type { MarkId } from '../render/marks';
import type { Mode } from './modes';

/** One side of the board: you, a friend at the same keyboard, or a computer opponent. */
export interface Seat {
  readonly kind: 'you' | 'friend' | 'computer';
  readonly name: string;
  /** The short name on the score chip. */
  readonly short: string;
  readonly mark: MarkId;
  readonly opponent?: OpponentId;
}

export interface MatchSpec {
  readonly mode: Mode;
  readonly seats: readonly [Seat, Seat];
  /** The position to start from; a fresh board of `columns × rows` otherwise. */
  readonly start?: Board;
  readonly columns: number;
  readonly rows: number;
  readonly first: Player;
  readonly lensAllowed: boolean;
  readonly seed: string;
  readonly ladder?: number;
  readonly puzzle?: number;
}

/** What one line did. */
export interface Turn {
  readonly edge: number;
  readonly by: Player;
  readonly closed: readonly number[];
  /**
   * Boxes the mover could have taken but handed back as pairs that fall to a single line each:
   * the last two of a chain, or the last four of a loop split in the middle.
   */
  readonly handedBack: readonly number[];
  /** How many boxes the line put within the other player's reach. */
  readonly handedOver: number;
  /** It opened a long chain or a loop. */
  readonly openedLong: boolean;
  /** It opened a loop. */
  readonly openedLoop: boolean;
}

export interface MatchStats {
  /** Double crosses made: the last two (or four) boxes handed back on purpose. */
  readonly crosses: [number, number];
  /** Long chains and loops each player had to open. */
  readonly openedLong: [number, number];
  /** The most boxes one line put within the other player's reach. */
  readonly biggestGift: [number, number];
  /** The last piece opened in the game was a loop. */
  endedOnLoop: boolean;
}

/**
 * A match from the first line to the last: the board, whose turn it is, the computer's moves,
 * and the counts the achievements and the results need. Pure: no timing, no drawing.
 */
export class Match {
  board: Board;
  readonly spec: MatchSpec;
  readonly turns: Turn[] = [];
  readonly stats: MatchStats = {
    crosses: [0, 0],
    openedLong: [0, 0],
    biggestGift: [0, 0],
    endedOnLoop: false,
  };
  readonly startedAt = Date.now();
  private readonly rng: Rng;
  /** The clock Greedy Gus seeds from: a second per line, from a start fixed by the seed. */
  private readonly clockBase: number;

  constructor(spec: MatchSpec) {
    this.spec = spec;
    const start = spec.start ?? newBoard({ columns: spec.columns, rows: spec.rows }, spec.first);
    this.board = { ...start, toMove: spec.start ? start.toMove : spec.first };
    this.rng = createRng(`dab:${spec.seed}:moves`);
    this.clockBase = 1_072_483_200 + (this.rng.nextUint32() % 86_400);
  }

  get toMove(): Player {
    return this.board.toMove;
  }

  get seat(): Seat {
    return this.spec.seats[this.board.toMove];
  }

  get over(): boolean {
    return isFull(this.board);
  }

  /** Whose turn it is is a computer's. */
  get computerToMove(): boolean {
    return !this.over && this.seat.kind === 'computer';
  }

  canDraw(edge: number): boolean {
    return !this.over && edge >= 0 && edge < this.board.drawn.length && !this.board.drawn[edge];
  }

  /** The computer's line for the seat to move. */
  computerMove(): number {
    const opponent = this.seat.opponent ?? 'greedy-gus';
    return chooseMove(opponent, this.board, {
      rng: this.rng,
      clock: this.clockBase + this.turns.length,
    });
  }

  draw(edge: number): Turn {
    if (!this.canDraw(edge)) throw new RangeError(`Edge ${edge} cannot be drawn now.`);
    const before = Position.from(this.board);
    const by = this.board.toMove;
    const couldTake = before.firstCapturable() >= 0;
    const piecesBefore = couldTake ? [] : pieces(before);
    const { board, closed } = play(this.board, edge);
    this.board = board;
    const after = Position.from(board);
    const reachable: number[] = [];
    for (let box = 0; box < after.grid.boxes; box++)
      if (after.sides[box] === 3) reachable.push(box);
    const handedBack =
      closed.length === 0 && couldTake && handsBackPairs(after, reachable, edge) ? reachable : [];
    const opened =
      closed.length === 0 && !couldTake
        ? piecesBefore.find((piece) => piece.boxes.some((box) => after.sides[box] === 3))
        : undefined;
    const turn: Turn = {
      edge,
      by,
      closed,
      handedBack,
      handedOver: closed.length === 0 ? reachable.length : 0,
      openedLong: opened ? isLongPiece(opened) : false,
      openedLoop: opened?.kind === 'loop',
    };
    this.turns.push(turn);
    this.count(turn, opened !== undefined);
    return turn;
  }

  private count(turn: Turn, openedPiece: boolean) {
    const { stats } = this;
    if (isDoubleCross(turn)) stats.crosses[turn.by]++;
    if (turn.openedLong) stats.openedLong[turn.by]++;
    stats.biggestGift[turn.by] = Math.max(stats.biggestGift[turn.by], turn.handedOver);
    if (openedPiece) stats.endedOnLoop = turn.openedLoop;
  }

  /** The player ahead at the end, or 'tie'; null while the game goes on. */
  winner(): Player | 'tie' | null {
    if (!this.over) return null;
    const [a, b] = this.board.scores;
    return a === b ? 'tie' : a > b ? 0 : 1;
  }
}

/** Handing back exactly the last two boxes of a chain, or the last four of a loop. */
export function isDoubleCross(turn: Turn): boolean {
  return turn.handedBack.length === 2 || turn.handedBack.length === 4;
}

/**
 * The boxes now open pair up, each pair waiting on the one line they share, and the line just
 * drawn touches them: a deliberate hand-back, not a box simply left lying about.
 */
export function handsBackPairs(
  position: Position,
  boxes: readonly number[],
  edge: number,
): boolean {
  if (boxes.length !== 2 && boxes.length !== 4) return false;
  const lastSide = boxes.map((box) => position.lastSide(box));
  const paired = boxes.every((box, i) =>
    boxes.some((other, j) => j !== i && lastSide[j] === lastSide[i] && other !== box),
  );
  const touched = boxes.some((box) =>
    position.grid.boxEdges.slice(box * 4, box * 4 + 4).includes(edge),
  );
  return paired && touched;
}
