import { edgeDots, horizontalEdge, isHorizontal, type Shape, verticalEdge } from '../engine/board';

/**
 * The keyboard's chalk. With the arrows you aim from a dot: an arrow points the line that way,
 * and the same arrow again walks to the next dot along. Every line on the board can be reached,
 * and the line you are on is always the one between the dot and where you aimed.
 *
 * The original's keys work too, on the original's lattice: `h` `j` `k` `l` jump to the next
 * parallel line, `y` `u` `b` `n` hop diagonally onto the lines across, and the cursor wraps at
 * the edges of the board (`human.cc`).
 */
export type Direction = 'up' | 'down' | 'left' | 'right';

export interface Cursor {
  /** The dot the line is aimed from, as dot row and column. */
  readonly row: number;
  readonly column: number;
  readonly direction: Direction;
}

const STEP: Readonly<Record<Direction, readonly [number, number]>> = {
  up: [-1, 0],
  down: [1, 0],
  left: [0, -1],
  right: [0, 1],
};

/** Where the original's cursor starts: the left side of the top-left box. */
export function startCursor(): Cursor {
  return { row: 0, column: 0, direction: 'down' };
}

function onBoard(shape: Shape, row: number, column: number): boolean {
  return row >= 0 && column >= 0 && row <= shape.rows && column <= shape.columns;
}

/** The line a cursor is on, or −1 when it points off the board. */
export function cursorEdge(shape: Shape, cursor: Cursor): number {
  const [dr, dc] = STEP[cursor.direction];
  const row = cursor.row + dr;
  const column = cursor.column + dc;
  if (!onBoard(shape, cursor.row, cursor.column) || !onBoard(shape, row, column)) return -1;
  if (dr === 0) return horizontalEdge(shape, cursor.row, Math.min(column, cursor.column));
  return verticalEdge(shape, Math.min(row, cursor.row), cursor.column);
}

/** An arrow: aim that way, or walk on if already aimed that way. Stays put at the border. */
export function aim(shape: Shape, cursor: Cursor, direction: Direction): Cursor {
  if (cursor.direction !== direction) {
    const turned = { ...cursor, direction };
    return cursorEdge(shape, turned) >= 0 ? turned : walk(shape, cursor, direction);
  }
  return walk(shape, cursor, direction);
}

/**
 * Moves the dot one step along. At the last dot before the border there is no line further on,
 * so the cursor turns round onto the line it came along: from that dot, every other way is open.
 */
function walk(shape: Shape, cursor: Cursor, direction: Direction): Cursor {
  const [dr, dc] = STEP[direction];
  const row = cursor.row + dr;
  const column = cursor.column + dc;
  if (!onBoard(shape, row, column)) return cursor;
  const onward = { row, column, direction };
  if (cursorEdge(shape, onward) >= 0) return onward;
  const back = { row, column, direction: opposite(direction) };
  return cursorEdge(shape, back) >= 0 ? back : cursor;
}

function opposite(direction: Direction): Direction {
  if (direction === 'up') return 'down';
  if (direction === 'down') return 'up';
  return direction === 'left' ? 'right' : 'left';
}

/** The cursor resting on a given line, aimed from its top or left dot. */
export function cursorOn(shape: Shape, edge: number): Cursor {
  const [[row, column]] = edgeDots(shape, edge);
  return { row, column, direction: isHorizontal(shape, edge) ? 'right' : 'down' };
}

/** The original's lattice: dots at even/even, boxes at odd/odd, lines in between. */
function lattice(shape: Shape, edge: number): [number, number] {
  const [[row, column]] = edgeDots(shape, edge);
  return isHorizontal(shape, edge) ? [row * 2, column * 2 + 1] : [row * 2 + 1, column * 2];
}

function fromLattice(shape: Shape, y: number, x: number): number {
  return y % 2 === 0
    ? horizontalEdge(shape, y / 2, (x - 1) / 2)
    : verticalEdge(shape, (y - 1) / 2, x / 2);
}

export type OriginalKey = 'h' | 'j' | 'k' | 'l' | 'y' | 'u' | 'b' | 'n';

const ORIGINAL_STEP: Readonly<Record<OriginalKey, readonly [number, number]>> = {
  h: [0, -2],
  l: [0, 2],
  k: [-2, 0],
  j: [2, 0],
  y: [-1, -1],
  u: [-1, 1],
  b: [1, -1],
  n: [1, 1],
};

/** One of the original's keys, wrapping at the edges the way `human.cc` does. */
export function originalStep(shape: Shape, edge: number, key: OriginalKey): number {
  const [dy, dx] = ORIGINAL_STEP[key];
  let [y, x] = lattice(shape, edge);
  y += dy;
  x += dx;
  const width = shape.columns * 2;
  const height = shape.rows * 2;
  if (x - (x & 1) < 0) x = width + (x & 1);
  if (x >= width + 1) x = x & 1;
  if (y - (y & 1) < 0) y = height + (y & 1);
  if (y >= height + 1) y = y & 1;
  // A wrap can leave the cursor on a dot or a box centre at the border; nudge it onto a line.
  if ((x + y) % 2 === 0) x = x > 0 ? x - 1 : x + 1;
  return fromLattice(shape, y, x);
}
