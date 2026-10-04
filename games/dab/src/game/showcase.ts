import { greedyGusMove } from '../ai/greedy-gus';
import { type Board, isFull, newBoard, type Player, play } from '../engine/board';
import { type Component, components, isLong, safeEdges } from '../engine/chains';
import { chainEndEdge, declineEdge, sharedEdge } from '../engine/moves';

/**
 * A board in the middle of a double cross, played for real: the original computer plays itself
 * on a 5 × 5 board until no safe line is left (a fixed clock, so it comes out the same every
 * time), then the double cross is played out and the cascade begins. The poster and the hero
 * frames show it.
 */
export interface Showcase {
  readonly board: Board;
  /** The pair handed back. */
  readonly domino: readonly [number, number];
  /** The line the scissors cut along. */
  readonly cutEdge: number;
  /** The chain falling to the player who kept control, and how far it has fallen. */
  readonly cascade: Component;
  readonly taken: number;
}

/** Greedy Gus against himself from an empty 5 × 5 board until no safe line is left. */
export function greedyOpening(seed: number): Board {
  let board = newBoard({ columns: 5, rows: 5 });
  let clock = 1_072_483_200 + seed * 1013;
  while (!isFull(board) && safeEdges(board).length > 0) {
    board = play(board, greedyGusMove(board, clock)).board;
    clock += 3;
  }
  return board;
}

export function cascadeShowcase(taken = 3): Showcase {
  let board = greedyOpening(28);
  const move = (edge: number, by: Player) => {
    board = play({ ...board, toMove: by }, edge).board;
  };
  const longChains = components(board)
    .filter((c) => c.kind === 'chain' && isLong(c))
    .sort((a, b) => a.boxes.length - b.boxes.length);
  const first = longChains[0]!;
  const second = longChains[1]!;
  // Your rival opens the shortest long chain; you take all but its last two and decline those.
  move(chainEndEdge(board, first, true), 1);
  const n = first.boxes.length;
  for (let i = 0; i < n - 2; i++) move(sharedEdge(board, first.boxes[i]!, first.boxes[i + 1]!), 0);
  const pairA = first.boxes[n - 2]!;
  const pairB = first.boxes[n - 1]!;
  move(declineEdge(board, pairA, pairB), 0);
  // The rival takes the pair with one line, then has to open the next chain for you.
  move(sharedEdge(board, pairA, pairB), 1);
  move(chainEndEdge(board, second, true), 1);
  for (let i = 0; i < taken; i++)
    move(sharedEdge(board, second.boxes[i]!, second.boxes[i + 1]!), 0);
  return {
    board,
    domino: [pairA, pairB],
    cutEdge: sharedEdge(board, first.boxes[n - 3]!, pairA),
    cascade: second,
    taken,
  };
}
