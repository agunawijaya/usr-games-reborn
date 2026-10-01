/** Where the room sits on the canvas: one square per cell, centred, with floor around it. */

export interface Geometry {
  /** Cell size in CSS pixels. */
  readonly cell: number;
  readonly boardX: number;
  readonly boardY: number;
  readonly cols: number;
  readonly rows: number;
  readonly width: number;
  readonly height: number;
}

export function fitGeometry(
  cols: number,
  rows: number,
  width: number,
  height: number,
  options: { margin?: number; maxCell?: number } = {},
): Geometry {
  const margin = options.margin ?? 0.8;
  const maxCell = options.maxCell ?? 78;
  const cell = Math.max(
    6,
    Math.min(width / (cols + margin * 2), height / (rows + margin * 2), maxCell),
  );
  // A touch lower than centre: heads and aerials poke up above their squares.
  const boardX = Math.round((width - cols * cell) / 2);
  const boardY = Math.round((height - rows * cell) / 2 + cell * 0.12);
  return { cell, boardX, boardY, cols, rows, width, height };
}

export function cellCenter(geo: Geometry, x: number, y: number): { x: number; y: number } {
  return { x: geo.boardX + (x + 0.5) * geo.cell, y: geo.boardY + (y + 0.5) * geo.cell };
}

export function cellAt(geo: Geometry, px: number, py: number): { x: number; y: number } | null {
  const x = Math.floor((px - geo.boardX) / geo.cell);
  const y = Math.floor((py - geo.boardY) / geo.cell);
  if (x < 0 || y < 0 || x >= geo.cols || y >= geo.rows) return null;
  return { x, y };
}
