import type { Cell } from './geometry';

/**
 * What a square of a chamber is made of. Flagstones are open to everyone; hedges stop you and
 * the snake alike; pools are open, and the snake glides through them faster.
 */
export type Ground = 'stone' | 'hedge' | 'pool';

/** One chamber's ground and its door (the original's `#`, where you leave with your haul). */
export interface Garden {
  readonly width: number;
  readonly height: number;
  /** Row by row, `width × height` squares. */
  readonly ground: readonly Ground[];
  readonly door: Cell;
}

export function inside(garden: Garden, cell: Cell): boolean {
  return cell.x >= 0 && cell.y >= 0 && cell.x < garden.width && cell.y < garden.height;
}

export function groundAt(garden: Garden, cell: Cell): Ground | null {
  return inside(garden, cell) ? garden.ground[cell.y * garden.width + cell.x]! : null;
}

/** Inside the walls and not a hedge. */
export function isOpen(garden: Garden, cell: Cell): boolean {
  const ground = groundAt(garden, cell);
  return ground !== null && ground !== 'hedge';
}

/** A chamber of bare flagstones, the original's whole board. */
export function openGarden(width: number, height: number, door: Cell): Garden {
  return { width, height, ground: new Array<Ground>(width * height).fill('stone'), door };
}

/** Builds a garden from rows of characters: `.` stone, `H` hedge, `~` pool, `#` the door. */
export function gardenFromRows(rows: readonly string[]): Garden {
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  const ground: Ground[] = [];
  let door: Cell = { x: 0, y: 0 };
  rows.forEach((row, y) => {
    if (row.length !== width) throw new Error(`Row ${y} is ${row.length} wide, not ${width}.`);
    [...row].forEach((char, x) => {
      if (char === '#') door = { x, y };
      ground.push(char === 'H' ? 'hedge' : char === '~' ? 'pool' : 'stone');
    });
  });
  return { width, height, ground, door };
}
