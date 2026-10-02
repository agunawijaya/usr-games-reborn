/** A square of the garden: x grows to the east, y to the south. */
export interface Cell {
  readonly x: number;
  readonly y: number;
}

export interface Step {
  readonly dx: number;
  readonly dy: number;
}

/**
 * The eight directions in the original's own order (`mx`/`my` in snake.c): north first, then
 * clockwise. The order matters: when two directions point at you equally well, the snake's
 * aim settles on the one that comes first.
 */
export const DIRECTIONS: readonly Step[] = [
  { dx: 0, dy: -1 },
  { dx: 1, dy: -1 },
  { dx: 1, dy: 0 },
  { dx: 1, dy: 1 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 1 },
  { dx: -1, dy: 0 },
  { dx: -1, dy: -1 },
];

/** The lengths the original divides by, with the diagonal rounded to 1.4 as it wrote it. */
export const DIRECTION_LENGTH: readonly number[] = [1, 1.4, 1, 1.4, 1, 1.4, 1, 1.4];

export const NORTH = 0;
export const EAST = 2;
export const SOUTH = 4;
export const WEST = 6;

/** The four directions the original lets you walk in; diagonals belong to the snake alone. */
export const ORTHOGONAL: readonly number[] = [NORTH, EAST, SOUTH, WEST];

export function isDiagonal(direction: number): boolean {
  return direction % 2 === 1;
}

export function same(a: Cell, b: Cell): boolean {
  return a.x === b.x && a.y === b.y;
}

export function moved(cell: Cell, direction: number): Cell {
  const step = DIRECTIONS[direction]!;
  return { x: cell.x + step.dx, y: cell.y + step.dy };
}

/** The king's-move distance: how many snake steps apart two squares are on an open board. */
export function reach(a: Cell, b: Cell): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/** The direction from one square to a neighbour, or -1 when they are not neighbours. */
export function directionBetween(from: Cell, to: Cell): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return DIRECTIONS.findIndex((d) => d.dx === dx && d.dy === dy);
}

export function cellKey(cell: Cell): string {
  return `${cell.x},${cell.y}`;
}
