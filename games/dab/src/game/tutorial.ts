import type { OpponentId } from '../ai/opponents';
import {
  type Board,
  horizontalEdge,
  newBoard,
  type Player,
  play,
  verticalEdge,
} from '../engine/board';
import type { Match } from './match';

/**
 * The tutorial: five small boards, each with one idea. The coach plays the other side; a step is
 * done when the board shows you have the idea, and a step can be tried again as often as you like.
 */

export type StepState = 'playing' | 'done' | 'retry';

export interface TutorialStep {
  readonly title: string;
  readonly lesson: string;
  /** The coach's line under the lesson, as the step goes on. */
  prompt(match: Match): string;
  readonly board: () => Board;
  /** How the coach plays: safe lines only, or the solver. */
  readonly coach: OpponentId;
  check(match: Match): StepState;
  /** Said when the step is done. */
  readonly praise: string;
  /** Said when the board went the other way. */
  readonly retry?: string;
  /** For the last step: the two choices side by side. */
  readonly options?: ReadonlyArray<{
    title: string;
    detail: string;
    result: string;
    good: boolean;
  }>;
}

/** A board with these lines already drawn, by nobody in particular, and you to move. */
function setUp(
  columns: number,
  rows: number,
  lines: (shape: { columns: number; rows: number }) => number[],
): Board {
  let board = newBoard({ columns, rows });
  const shape = { columns, rows };
  for (const edge of lines(shape)) board = play({ ...board, toMove: 0 }, edge).board;
  return { ...board, toMove: 0 as Player, history: [] };
}

const yourTurns = (match: Match) => match.turns.filter((turn) => turn.by === 0);

export const TUTORIAL: readonly TutorialStep[] = [
  {
    title: 'Draw a line',
    lesson:
      'Take turns joining two neighbouring dots. Click between them, or aim with the arrow keys and press Enter. A line belongs to nobody: what counts is who closes a box.',
    prompt: () => 'Draw any line you like.',
    board: () => newBoard({ columns: 2, rows: 2 }),
    coach: 'greedy-gus',
    check: (match) => (yourTurns(match).length > 0 ? 'done' : 'playing'),
    praise: 'That is all a move is. Now for what a move can win.',
  },
  {
    title: 'Close a box',
    lesson:
      'A box with three sides drawn is there for the taking. Draw its fourth side: the box is yours, and you draw again straight away.',
    prompt: (match) =>
      match.board.scores[0] === 0
        ? 'The top-left box has three sides. Draw the fourth.'
        : 'Yours, and it is still your turn. Draw one more line.',
    board: () =>
      setUp(2, 2, (s) => [horizontalEdge(s, 0, 0), verticalEdge(s, 0, 0), horizontalEdge(s, 1, 0)]),
    coach: 'greedy-gus',
    check: (match) => {
      const closedThenDrew = match.turns.some(
        (turn, i) => turn.by === 0 && turn.closed.length > 0 && match.turns[i + 1]?.by === 0,
      );
      return closedThenDrew ? 'done' : 'playing';
    },
    praise: 'A box, and a free move to spend. Boxes come in runs, though.',
  },
  {
    title: 'Take a chain',
    lesson:
      'Boxes with two sides drawn link up into chains. Once someone draws into a chain, its boxes fall one after another, and the taker keeps drawing.',
    prompt: (match) =>
      match.board.scores[0] === 0
        ? 'The coach has opened this chain of three. Take the first box.'
        : `${match.board.scores[0]} taken. Keep going: each box you close gives you another line.`,
    board: () =>
      setUp(3, 1, (s) => [
        ...[0, 1, 2].flatMap((c) => [horizontalEdge(s, 0, c), horizontalEdge(s, 1, c)]),
        verticalEdge(s, 0, 0),
      ]),
    coach: 'master',
    check: (match) => (match.board.scores[0] === 3 ? 'done' : 'playing'),
    praise: 'Three for one. That is why nobody wants to open a long chain.',
  },
  {
    title: 'The loony move',
    lesson:
      'No safe line is left: every line now gives something away. Opening a long chain is a loony move, because the taker gets to choose what happens next. Give the smallest gift first.',
    prompt: (match) =>
      match.turns.length === 0
        ? 'Give the coach the single box in the corner, not the chain.'
        : match.board.scores[0] > 0
          ? 'The coach had to open the chain. It is all yours.'
          : 'Watch what the coach does now.',
    board: () =>
      setUp(3, 2, (s) => [
        verticalEdge(s, 0, 1),
        horizontalEdge(s, 1, 0),
        horizontalEdge(s, 1, 1),
        horizontalEdge(s, 0, 2),
        verticalEdge(s, 0, 3),
        verticalEdge(s, 1, 3),
        horizontalEdge(s, 2, 0),
        horizontalEdge(s, 2, 1),
        horizontalEdge(s, 2, 2),
      ]),
    coach: 'master',
    check: (match) => {
      if (!match.over) return 'playing';
      return match.board.scores[0] > match.board.scores[1] ? 'done' : 'retry';
    },
    praise: 'One box given, five taken. Whoever runs out of small gifts first opens the big ones.',
    retry:
      'You opened the chain, so the coach took all five. Try again: give the single box first.',
  },
  {
    title: 'The double cross',
    lesson:
      'Two boxes of this chain are left. Take them both and you must draw again, which opens the bottom chain for the coach. Or draw the far end and leave the pair: the coach takes both with one line, the double cross, and has to open the bottom chain for you.',
    prompt: (match) =>
      match.board.scores[0] < 2 && match.turns.length < 3
        ? 'The coach opened the top chain. Take two boxes, then stop and think.'
        : 'The dashed line at the far end gives the pair away. Draw it with Enter, or click it.',
    board: () =>
      setUp(4, 2, (s) => [
        ...[0, 1, 2, 3].flatMap((c) => [
          horizontalEdge(s, 0, c),
          horizontalEdge(s, 1, c),
          horizontalEdge(s, 2, c),
        ]),
        verticalEdge(s, 0, 0),
      ]),
    coach: 'master',
    check: (match) => {
      if (!match.over) return 'playing';
      return match.board.scores[0] > match.board.scores[1] ? 'done' : 'retry';
    },
    praise: 'Two given, six taken: that is the double cross, and the whole secret of the game.',
    retry:
      'You took all four, so you had to open the bottom chain. Try again, and leave the last two.',
    options: [
      {
        title: 'Take both',
        detail: 'Then you open the bottom chain: the coach takes all four.',
        result: 'You 4 · Coach 4',
        good: false,
      },
      {
        title: 'Give two away',
        detail: 'The coach takes the pair and must open the bottom chain for you.',
        result: 'You 6 · Coach 2',
        good: true,
      },
    ],
  },
];
