import { fitGeometry, type Geometry } from './geometry';

/**
 * The camera for big rooms. The cat is drawn about 0.92 of a square tall, so squares never go
 * below MIN_CELL and the cat stays at least 48 px tall (at 1280×720 too); when the room no longer
 * fits at that size, the floor is laid out larger than the view and the camera follows the cat.
 */

export const MIN_CELL = 53;

export interface Framing {
  /** The whole floor, in its own coordinates; larger than the view when the camera follows. */
  readonly geo: Geometry;
  readonly follows: boolean;
}

export function frameRoom(
  cols: number,
  rows: number,
  viewWidth: number,
  viewHeight: number,
  options: { margin: number; maxCell: number; wholeRoom: boolean },
): Framing {
  const fit = fitGeometry(cols, rows, viewWidth, viewHeight, options);
  if (fit.cell >= MIN_CELL || options.wholeRoom) return { geo: fit, follows: false };
  const cell = MIN_CELL;
  const width = Math.max(viewWidth, Math.ceil((cols + options.margin * 2) * cell));
  const height = Math.max(viewHeight, Math.ceil((rows + options.margin * 2) * cell));
  const geo: Geometry = {
    cell,
    boardX: Math.round((width - cols * cell) / 2),
    boardY: Math.round((height - rows * cell) / 2 + cell * 0.12),
    cols,
    rows,
    width,
    height,
  };
  return { geo, follows: true };
}

export interface View {
  x: number;
  y: number;
}

/** Where the view's top-left corner goes to keep `focus` centred, without leaving the floor. */
export function viewFor(
  focus: { x: number; y: number },
  geo: Geometry,
  viewWidth: number,
  viewHeight: number,
): View {
  const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), Math.max(0, max));
  return {
    x: clamp(focus.x - viewWidth / 2, geo.width - viewWidth),
    y: clamp(focus.y - viewHeight / 2, geo.height - viewHeight),
  };
}

/** Eases the view towards its target; a time constant of 140 ms reads as a smooth follow. */
export function follow(view: View, target: View, dtMs: number, instant: boolean): View {
  if (instant) return { ...target };
  const k = 1 - Math.exp(-Math.max(0, dtMs) / 140);
  return { x: view.x + (target.x - view.x) * k, y: view.y + (target.y - view.y) * k };
}
