import type { Point } from './marks';

/** Where the board sits on the canvas, in CSS pixels. */
export interface BoardFrame {
  readonly x: number;
  readonly y: number;
  /** The distance between neighbouring dots. */
  readonly spacing: number;
  readonly columns: number;
  readonly rows: number;
  readonly width: number;
  readonly height: number;
}

export interface Region {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Room left round the dots, in dot spacings: the dots' own size, the chalk sticks, the sign. */
const MARGIN = 0.7;

export function fitBoard(region: Region, columns: number, rows: number, cap = 150): BoardFrame {
  const spacing = Math.floor(
    Math.min(cap, region.width / (columns + MARGIN * 2), region.height / (rows + MARGIN * 2)),
  );
  const width = spacing * columns;
  const height = spacing * rows;
  return {
    x: Math.round(region.x + (region.width - width) / 2),
    y: Math.round(region.y + (region.height - height) / 2),
    spacing,
    columns,
    rows,
    width,
    height,
  };
}

export function dotAt(frame: BoardFrame, row: number, column: number): Point {
  return { x: frame.x + column * frame.spacing, y: frame.y + row * frame.spacing };
}

export function boxCentre(frame: BoardFrame, row: number, column: number): Point {
  return { x: frame.x + (column + 0.5) * frame.spacing, y: frame.y + (row + 0.5) * frame.spacing };
}
