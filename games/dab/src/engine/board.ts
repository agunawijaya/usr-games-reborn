/**
 * The board: a grid of boxes and the lines between its dots. Every line is an edge with a
 * number. Horizontal edges come first, row by row (a board `columns` boxes wide has `columns`
 * of them in each of its `rows + 1` dot rows), then the vertical ones (`columns + 1` in each of
 * the `rows` box rows).
 *
 * A move draws one edge. Closing a box (drawing its fourth side) claims it, and the same player
 * moves again; a move that closes nothing passes the turn. The game ends when every edge is
 * drawn. The rules are the original's (`board.cc`, `player.cc`), written afresh.
 */

export type Player = 0 | 1;

/** A box's four sides, in the original's order (`box.h`): top, bottom, left, right. */
export const TOP = 0;
export const BOTTOM = 1;
export const LEFT = 2;
export const RIGHT = 3;
export type Side = typeof TOP | typeof BOTTOM | typeof LEFT | typeof RIGHT;

export interface Shape {
  readonly columns: number;
  readonly rows: number;
}

export interface Board extends Shape {
  /** 1 where an edge is drawn. */
  readonly drawn: Uint8Array;
  /** The player who closed each box, or -1. */
  readonly owner: Int8Array;
  readonly scores: readonly [number, number];
  readonly toMove: Player;
  /** Every edge drawn so far, in order, with who drew it. */
  readonly history: readonly Move[];
}

export interface Move {
  readonly edge: number;
  readonly by: Player;
  /** The boxes this move closed (none, one or two). */
  readonly closed: readonly number[];
}

export const SMALLEST = 1;
export const LARGEST = 10;

export function horizontalCount(shape: Shape): number {
  return (shape.rows + 1) * shape.columns;
}

export function edgeCount(shape: Shape): number {
  return horizontalCount(shape) + shape.rows * (shape.columns + 1);
}

export function boxCount(shape: Shape): number {
  return shape.rows * shape.columns;
}

export function isHorizontal(shape: Shape, edge: number): boolean {
  return edge < horizontalCount(shape);
}

export function horizontalEdge(shape: Shape, row: number, column: number): number {
  return row * shape.columns + column;
}

export function verticalEdge(shape: Shape, row: number, column: number): number {
  return horizontalCount(shape) + row * (shape.columns + 1) + column;
}

export function boxAt(shape: Shape, row: number, column: number): number {
  return row * shape.columns + column;
}

export function boxRow(shape: Shape, box: number): number {
  return Math.floor(box / shape.columns);
}

export function boxColumn(shape: Shape, box: number): number {
  return box % shape.columns;
}

/** The edge on one side of a box. */
export function sideEdge(shape: Shape, box: number, side: Side): number {
  const row = boxRow(shape, box);
  const column = boxColumn(shape, box);
  switch (side) {
    case TOP:
      return horizontalEdge(shape, row, column);
    case BOTTOM:
      return horizontalEdge(shape, row + 1, column);
    case LEFT:
      return verticalEdge(shape, row, column);
    case RIGHT:
      return verticalEdge(shape, row, column + 1);
  }
}

export function boxEdges(shape: Shape, box: number): [number, number, number, number] {
  return [
    sideEdge(shape, box, TOP),
    sideEdge(shape, box, BOTTOM),
    sideEdge(shape, box, LEFT),
    sideEdge(shape, box, RIGHT),
  ];
}

/** The one or two boxes an edge borders. */
export function edgeBoxes(shape: Shape, edge: number): number[] {
  const boxes: number[] = [];
  if (isHorizontal(shape, edge)) {
    const row = Math.floor(edge / shape.columns);
    const column = edge % shape.columns;
    if (row > 0) boxes.push(boxAt(shape, row - 1, column));
    if (row < shape.rows) boxes.push(boxAt(shape, row, column));
  } else {
    const index = edge - horizontalCount(shape);
    const row = Math.floor(index / (shape.columns + 1));
    const column = index % (shape.columns + 1);
    if (column > 0) boxes.push(boxAt(shape, row, column - 1));
    if (column < shape.columns) boxes.push(boxAt(shape, row, column));
  }
  return boxes;
}

/** The two dots an edge joins, as [row, column] dot coordinates. */
export function edgeDots(shape: Shape, edge: number): [[number, number], [number, number]] {
  if (isHorizontal(shape, edge)) {
    const row = Math.floor(edge / shape.columns);
    const column = edge % shape.columns;
    return [
      [row, column],
      [row, column + 1],
    ];
  }
  const index = edge - horizontalCount(shape);
  const row = Math.floor(index / (shape.columns + 1));
  const column = index % (shape.columns + 1);
  return [
    [row, column],
    [row + 1, column],
  ];
}

export function newBoard(shape: Shape, first: Player = 0): Board {
  if (
    shape.columns < SMALLEST ||
    shape.rows < SMALLEST ||
    shape.columns > LARGEST ||
    shape.rows > LARGEST
  ) {
    throw new RangeError(`Boards run from ${SMALLEST} to ${LARGEST} boxes a side.`);
  }
  return {
    columns: shape.columns,
    rows: shape.rows,
    drawn: new Uint8Array(edgeCount(shape)),
    owner: new Int8Array(boxCount(shape)).fill(-1),
    scores: [0, 0],
    toMove: first,
    history: [],
  };
}

/** How many of a box's four sides are drawn (the original's `BOX::count`). */
export function sidesDrawn(board: Board, box: number): number {
  let count = 0;
  for (const edge of boxEdges(board, box)) count += board.drawn[edge]!;
  return count;
}

export function isFull(board: Board): boolean {
  return board.drawn.every((d) => d === 1);
}

export function freeEdges(board: Board): number[] {
  const edges: number[] = [];
  board.drawn.forEach((d, edge) => {
    if (!d) edges.push(edge);
  });
  return edges;
}

export interface Played {
  readonly board: Board;
  readonly closed: readonly number[];
}

/**
 * Draws an edge for the player to move. Closing one or two boxes scores them and keeps the turn;
 * closing none passes it. An edge already drawn is refused (the original rang the bell).
 */
export function play(board: Board, edge: number): Played {
  if (edge < 0 || edge >= board.drawn.length || board.drawn[edge]) {
    throw new RangeError(`Edge ${edge} cannot be drawn.`);
  }
  const drawn = board.drawn.slice();
  drawn[edge] = 1;
  const owner = board.owner.slice();
  const next = { ...board, drawn, owner };
  const closed = edgeBoxes(board, edge).filter((box) => sidesDrawn(next, box) === 4);
  for (const box of closed) owner[box] = board.toMove;
  const scores: [number, number] = [board.scores[0], board.scores[1]];
  scores[board.toMove] += closed.length;
  return {
    board: {
      ...next,
      scores,
      toMove: closed.length > 0 ? board.toMove : ((1 - board.toMove) as Player),
      history: [...board.history, { edge, by: board.toMove, closed }],
    },
    closed,
  };
}

export function winner(board: Board): Player | 'tie' | null {
  if (!isFull(board)) return null;
  if (board.scores[0] === board.scores[1]) return 'tie';
  return board.scores[0] > board.scores[1] ? 0 : 1;
}
