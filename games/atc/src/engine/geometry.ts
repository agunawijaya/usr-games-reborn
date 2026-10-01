/**
 * Headings and grid steps. The sky is a grid of cells; a heading is one of eight compass points
 * counted clockwise from north, exactly as the 1986 game numbered them, so the classic keys
 * (w e d c x z a q) and every rule about turning keep their meaning.
 */

export type Heading = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const HEADING_COUNT = 8;

export interface Cell {
  x: number;
  y: number;
}

/** One move along each heading; y grows southwards, as on a terminal. */
export const STEPS: readonly Readonly<Cell>[] = [
  { x: 0, y: -1 },
  { x: 1, y: -1 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
  { x: -1, y: 1 },
  { x: -1, y: 0 },
  { x: -1, y: -1 },
];

/** The classic heading keys, in heading order. */
export const HEADING_KEYS = ['w', 'e', 'd', 'c', 'x', 'z', 'a', 'q'] as const;

export function toHeading(value: number): Heading {
  return (((value % HEADING_COUNT) + HEADING_COUNT) % HEADING_COUNT) as Heading;
}

export function headingDegrees(heading: Heading): number {
  return heading * 45;
}

/**
 * The heading that best points along a displacement. The original rounds the angle with an
 * offset of 2.5 and truncates; the arithmetic is kept so ties break the same way.
 */
export function headingToward(dx: number, dy: number): Heading {
  const sector = Math.atan2(dy, dx) * (HEADING_COUNT / (2 * Math.PI)) + 2.5 + HEADING_COUNT;
  return toHeading(Math.trunc(sector));
}

export function step(cell: Cell, heading: Heading): Cell {
  const move = STEPS[heading]!;
  return { x: cell.x + move.x, y: cell.y + move.y };
}

export function sameCell(a: Cell, b: Cell): boolean {
  return a.x === b.x && a.y === b.y;
}

/**
 * Signed difference from one heading to another, in eighths. A reversal stays at +4 or -4
 * depending on which number is larger, as in the original, so it turns right from north and
 * left from south.
 */
export function turnBetween(from: Heading, to: Heading): number {
  const diff = to - from;
  if (diff > HEADING_COUNT / 2) return diff - HEADING_COUNT;
  if (diff < -(HEADING_COUNT / 2)) return diff + HEADING_COUNT;
  return diff;
}

/** Chebyshev distance: moves needed on a grid where diagonals cost one. */
export function gridDistance(a: Cell, b: Cell): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}
