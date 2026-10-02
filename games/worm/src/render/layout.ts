import type { Cell } from '../engine/geometry';

/**
 * Where the garden sits on the canvas: a strip of sky and grass across the top, then soil, with
 * the box (the bed the noodle lives in) centred in it. All numbers are device pixels.
 */

export interface Layout {
  width: number;
  height: number;
  cols: number;
  rows: number;
  cell: number;
  /** The box's top-left corner. */
  left: number;
  top: number;
  /** Where the grass meets the sky. */
  surface: number;
  dpr: number;
  /** The size grass, flowers and pebbles are drawn at: the cell, but never huge. */
  scenery: number;
}

export interface LayoutOptions {
  /** Room kept free on each side, as a share of the width. */
  sideShare?: number;
  /** Room kept for sky and grass above the box, as a share of the height. */
  skyShare?: number;
  /** Room below the box, as a share of the height. */
  bottomShare?: number;
  /** The largest cell, in CSS pixels; small boxes (fill puzzles) are not blown up beyond it. */
  maxCell?: number;
  /** Moves the box sideways, as a share of the width (the title screen sets it off to the right). */
  shiftShare?: number;
  /** The most of the width the box may take. */
  widthShare?: number;
}

export function layoutFor(
  width: number,
  height: number,
  cols: number,
  rows: number,
  dpr: number,
  options: LayoutOptions = {},
): Layout {
  const side = width * (options.sideShare ?? 0.07);
  const sky = height * (options.skyShare ?? 0.15);
  const bottom = height * (options.bottomShare ?? 0.05);
  const maxCell = (options.maxCell ?? 120) * dpr;
  const across = Math.min(width - side * 2, width * (options.widthShare ?? 1));
  const cell = Math.max(
    4,
    Math.floor(Math.min(across / cols, (height - sky - bottom) / rows, maxCell)),
  );
  const boxWidth = cell * cols;
  const boxHeight = cell * rows;
  const left = Math.round((width - boxWidth) / 2 + width * (options.shiftShare ?? 0));
  // Centre the box in the soil, but never let it climb into the sky strip.
  const soilTop = sky;
  const top = Math.round(Math.max(soilTop, soilTop + (height - soilTop - bottom - boxHeight) / 2));
  const scenery = Math.min(cell, 64 * dpr);
  const surface = Math.round(Math.min(top - scenery * 0.9, sky * 0.82));
  return { width, height, cols, rows, cell, left, top, surface, dpr, scenery };
}

/** The centre of a cell, in device pixels. */
export function centre(layout: Layout, cell: Cell): { x: number; y: number } {
  return {
    x: layout.left + (cell.x + 0.5) * layout.cell,
    y: layout.top + (cell.y + 0.5) * layout.cell,
  };
}

/** The cell under a point in CSS pixels, or null outside the box. */
export function cellUnder(layout: Layout, cssX: number, cssY: number): Cell | null {
  const x = Math.floor((cssX * layout.dpr - layout.left) / layout.cell);
  const y = Math.floor((cssY * layout.dpr - layout.top) / layout.cell);
  if (x < 0 || y < 0 || x >= layout.cols || y >= layout.rows) return null;
  return { x, y };
}
