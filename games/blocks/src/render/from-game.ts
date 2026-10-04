import { cellsOf, FORMS, type Offset } from '../engine/forms';
import { cellAt, fallingCells, type Game, landingSpot } from '../engine/game';
import type { PebbleCell } from './sinkers';
import { depthShare } from './view';

/** The settled cells of a game, ready to draw, coloured by the depth they settled at. */
export function settledCells(game: Game): PebbleCell[] {
  const cells: PebbleCell[] = [];
  for (let y = 0; y < game.height; y++)
    for (let x = 0; x < game.width; x++) {
      const cell = cellAt(game, x, y);
      if (cell)
        cells.push({
          x,
          y,
          group: cell.group,
          kind: cell.kind,
          depth: depthShare(cell.depth, game.height),
        });
    }
  return cells;
}

/** The falling sinker as the view wants it, or null once the dive is over. */
export function fallingOf(game: Game): { cells: Offset[]; kind: number; group: number } | null {
  if (game.over) return null;
  return { cells: fallingCells(game), kind: FORMS[game.form]!.kind, group: 0 };
}

/** Where the falling sinker would settle, currents and all: the cells under the sonar line. */
export function landingOf(game: Game): Offset[] | null {
  if (game.over) return null;
  const spot = landingSpot(game);
  return spot.y === game.y ? null : cellsOf(game.form, spot.x, spot.y);
}
