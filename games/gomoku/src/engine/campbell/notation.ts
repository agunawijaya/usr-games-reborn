import type { CampbellBoard } from './board';

/**
 * The original's move names: a column letter (A to T, no I, as on a Go board) and a row number
 * counted from the bottom, as `stoc.c` writes them.
 */
const LETTERS = 'ABCDEFGHJKLMNOPQRST';

export function spotName(bd: CampbellBoard, spot: number): string {
  const x = spot % bd.rowSpan;
  const y = Math.floor(spot / bd.rowSpan);
  return `${LETTERS[x - 1]}${y}`;
}

export function spotOf(bd: CampbellBoard, name: string): number {
  const x = LETTERS.indexOf(name[0]!.toUpperCase()) + 1;
  const y = Number(name.slice(1));
  return bd.pt(x, y);
}
