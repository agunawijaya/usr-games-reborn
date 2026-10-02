import type { Cell } from '../engine/geometry';

/** Where the chamber sits on the canvas, in CSS pixels. */
export interface BoardFrame {
  readonly x: number;
  readonly y: number;
  readonly cell: number;
  readonly columns: number;
  readonly rows: number;
}

export interface Region {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** The stone rim around the sunken chamber, as a share of a square. */
export const RIM = 0.62;

/** The largest whole-pixel square size that fits the chamber and its rim in the region, centred. */
export function fitBoard(region: Region, columns: number, rows: number): BoardFrame {
  const cell = Math.floor(
    Math.min(region.width / (columns + RIM * 2), region.height / (rows + RIM * 2)),
  );
  const width = cell * columns;
  const height = cell * rows;
  return {
    x: Math.round(region.x + (region.width - width) / 2),
    y: Math.round(region.y + (region.height - height) / 2),
    cell,
    columns,
    rows,
  };
}

export function centre(frame: BoardFrame, cell: Cell): { x: number; y: number } {
  return {
    x: frame.x + (cell.x + 0.5) * frame.cell,
    y: frame.y + (cell.y + 0.5) * frame.cell,
  };
}

/** The square under a point, or null outside the board. */
export function cellAt(frame: BoardFrame, x: number, y: number): Cell | null {
  const cx = Math.floor((x - frame.x) / frame.cell);
  const cy = Math.floor((y - frame.y) / frame.cell);
  if (cx < 0 || cy < 0 || cx >= frame.columns || cy >= frame.rows) return null;
  return { x: cx, y: cy };
}
