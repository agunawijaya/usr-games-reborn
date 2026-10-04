import { type Board, boxEdges, edgeBoxes, sidesDrawn } from './board';
import type { Component } from './chains';

/** The undrawn sides of a box. */
export function freeSides(board: Board, box: number): number[] {
  return boxEdges(board, box).filter((edge) => !board.drawn[edge]);
}

/** Every edge that would close a box right now. */
export function capturingEdges(board: Board): number[] {
  const edges = new Set<number>();
  board.owner.forEach((owner, box) => {
    if (owner === -1 && sidesDrawn(board, box) === 3) edges.add(freeSides(board, box)[0]!);
  });
  return [...edges];
}

/** The edge between two neighbouring boxes. */
export function sharedEdge(board: Board, a: number, b: number): number {
  const edges = boxEdges(board, b);
  const shared = boxEdges(board, a).find((edge) => edges.includes(edge));
  if (shared === undefined) throw new RangeError(`Boxes ${a} and ${b} are not neighbours.`);
  return shared;
}

/**
 * The free edge at one end of a chain that leads out of it (to the border or a joint): drawing
 * it opens the chain from that end.
 */
export function chainEndEdge(board: Board, chain: Component, fromStart = true): number {
  const boxes = fromStart ? chain.boxes : [...chain.boxes].reverse();
  const end = boxes[0]!;
  const inside = new Set(chain.boxes);
  const out = freeSides(board, end).find((edge) =>
    edgeBoxes(board, edge).every((box) => box === end || !inside.has(box)),
  );
  if (out === undefined) throw new RangeError('This chain has no open end there.');
  return out;
}

/**
 * Declining the last two boxes of a chain: of the pair (the first has three sides, the second
 * two), draw the second's outer free side, so both wait on the one edge between them.
 */
export function declineEdge(board: Board, first: number, second: number): number {
  const between = sharedEdge(board, first, second);
  const outer = freeSides(board, second).find((edge) => edge !== between);
  if (outer === undefined) throw new RangeError('There is nothing to decline here.');
  return outer;
}
