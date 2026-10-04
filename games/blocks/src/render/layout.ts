/**
 * Where the tank sits on the canvas. Everything is in device pixels. The tank is tall and stands
 * on the sand near the bottom of the screen, with room above it for the bubble that carries the
 * next sinker; the sea fills the rest.
 */

export interface Layout {
  width: number;
  height: number;
  dpr: number;
  cols: number;
  rows: number;
  /** One cell of the tank. */
  cell: number;
  /** The tank's inside: the top-left corner of cell (0, 0). */
  left: number;
  top: number;
  /** Where the sand begins. */
  floor: number;
  /** The size scenery is drawn at (plants, fish, pebbles): the cell, but never huge. */
  scenery: number;
}

/**
 * Air inside the tank above the water, in rows: a new sinker is lowered in from there (the
 * original's hidden row above the well), so its top may stand out of the water at first.
 */
export const AIR_ROWS = 1.3;

export interface LayoutOptions {
  /** Room kept above the tank, as a share of the height (the next bubble floats there). */
  topShare?: number;
  /** Sand below the tank, as a share of the height. */
  floorShare?: number;
  /** Moves the tank sideways, as a share of the width (the title screen puts it to the right). */
  shiftShare?: number;
  /** The largest cell, in CSS pixels. */
  maxCell?: number;
}

export function layoutFor(
  width: number,
  height: number,
  cols: number,
  rows: number,
  dpr: number,
  options: LayoutOptions = {},
): Layout {
  const top = height * (options.topShare ?? 0.1);
  const floorBand = height * (options.floorShare ?? 0.07);
  const maxCell = (options.maxCell ?? 64) * dpr;
  const cell = Math.max(
    4,
    Math.floor(
      Math.min((height - top - floorBand) / (rows + AIR_ROWS), (width * 0.9) / cols, maxCell),
    ),
  );
  const tankWidth = cell * cols;
  const tankHeight = cell * (rows + AIR_ROWS);
  const left = Math.round((width - tankWidth) / 2 + width * (options.shiftShare ?? 0));
  const tankTop = Math.round(top + (height - top - floorBand - tankHeight) / 2 + AIR_ROWS * cell);
  return {
    width,
    height,
    dpr,
    cols,
    rows,
    cell,
    left,
    top: tankTop,
    floor: tankTop + rows * cell + cell * 0.25,
    scenery: Math.min(cell, 56 * dpr),
  };
}
