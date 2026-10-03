/**
 * Where the board sits and how big a cell is. The board's slot is a square that holds the grid and
 * a margin for the coordinates; everything else on the canvas (garden, lake, sky) fills around it.
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BoardGeometry {
  /** Lines each way. */
  size: number;
  /** Pixels between neighbouring lines. */
  cell: number;
  /** The pixel position of the top-left point. */
  left: number;
  top: number;
  /** The board's slot: the grid plus its coordinate margin. */
  slot: Rect;
}

/** Room for the coordinates outside the outer lines, in cells. */
const MARGIN = 0.95;

export function boardGeometry(slot: Rect, size: number): BoardGeometry {
  const side = Math.min(slot.width, slot.height);
  const cell = side / (size - 1 + MARGIN * 2);
  const span = cell * (size - 1);
  return {
    size,
    cell,
    left: slot.x + (slot.width - span) / 2,
    top: slot.y + (slot.height - span) / 2,
    slot,
  };
}

/** The pixel centre of a point. Points are numbered `y * size + x` from the top left. */
export function pointCentre(g: BoardGeometry, p: number): { x: number; y: number } {
  return { x: g.left + (p % g.size) * g.cell, y: g.top + Math.floor(p / g.size) * g.cell };
}

/** The point nearest a pixel, or null when the pixel is not near any point. */
export function pointAtPixel(g: BoardGeometry, px: number, py: number): number | null {
  const x = Math.round((px - g.left) / g.cell);
  const y = Math.round((py - g.top) / g.cell);
  if (x < 0 || y < 0 || x >= g.size || y >= g.size) return null;
  const dx = px - (g.left + x * g.cell);
  const dy = py - (g.top + y * g.cell);
  return dx * dx + dy * dy <= (g.cell * 0.62) ** 2 ? y * g.size + x : null;
}

/** The marked points: the fourth line in from each corner and the centre (and the sides on 19). */
export function starPoints(size: number): number[] {
  const near = 3;
  const far = size - 1 - near;
  const mid = (size - 1) / 2;
  const lines = size >= 19 ? [near, mid, far] : [near, far];
  const points = lines.flatMap((y) => lines.map((x) => y * size + x));
  if (size < 19) points.push(mid * size + mid);
  return points;
}

/**
 * The play screen's arrangement for a viewport: the board's slot centred low (leaving a band at
 * the top for the bar and, by night, the sky), with the side columns beside it.
 */
export function playLayout(width: number, height: number): { slot: Rect; horizon: number } {
  const bottom = Math.round(height * 0.024);
  const side = Math.round(Math.min(height * 0.835, width - 2 * Math.max(250, width * 0.2)));
  const slot = {
    x: Math.round((width - side) / 2),
    y: height - bottom - side,
    width: side,
    height: side,
  };
  return { slot, horizon: slot.y - Math.round(height * 0.006) };
}
