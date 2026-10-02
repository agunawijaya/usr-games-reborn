/**
 * The grid the noodle lives on. Cells are counted from the top-left corner of a garden's
 * open box; the border of the box is never a cell.
 */

export type Dir = 'up' | 'down' | 'left' | 'right';

export interface Cell {
  readonly x: number;
  readonly y: number;
}

export const DIRS: readonly Dir[] = ['up', 'right', 'down', 'left'];

export const STEP: Readonly<Record<Dir, Cell>> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export const OPPOSITE: Readonly<Record<Dir, Dir>> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

export function step(cell: Cell, dir: Dir): Cell {
  const d = STEP[dir];
  return { x: cell.x + d.x, y: cell.y + d.y };
}

export function sameCell(a: Cell, b: Cell): boolean {
  return a.x === b.x && a.y === b.y;
}

export function isHorizontal(dir: Dir): boolean {
  return dir === 'left' || dir === 'right';
}

/** The direction from one cell to a neighbouring one, or null when they do not touch. */
export function dirBetween(from: Cell, to: Cell): Dir | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 1 && dy === 0) return 'right';
  if (dx === -1 && dy === 0) return 'left';
  if (dx === 0 && dy === 1) return 'down';
  if (dx === 0 && dy === -1) return 'up';
  return null;
}
