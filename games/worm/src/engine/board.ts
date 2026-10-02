import { type Cell, type Dir, step } from './geometry';

/**
 * A garden's box: its size and what lies in each cell. Gardens are written as rows of
 * characters, one per cell:
 *
 *   .  soil, where the noodle can go
 *   #  rock: in the way, for good
 *   r  root: in the way
 *   ~  mud: soil the noodle can cross, slowly
 *   > < ^ v  soil that flows one way: entered only moving that way
 *   A–Z  a tunnel mouth; the two cells with the same letter are joined
 *
 * The 1980 box is all soil.
 */

export type Terrain = 'soil' | 'rock' | 'root' | 'mud' | 'flow' | 'tunnel';

export interface Board {
  readonly width: number;
  readonly height: number;
  readonly terrain: readonly Terrain[];
  /** For a flow cell: the only direction it can be entered in. */
  readonly flow: ReadonlyMap<number, Dir>;
  /** For a tunnel mouth: the cell you come out of, through the other mouth. */
  readonly tunnelExit: ReadonlyMap<number, Cell>;
  /** Tunnel mouths by letter, for drawing them as pairs. */
  readonly tunnels: ReadonlyMap<string, readonly [Cell, Cell]>;
  /** Cells the noodle can occupy: everything but rock and root. */
  readonly openCount: number;
}

const FLOWS: Readonly<Record<string, Dir>> = { '>': 'right', '<': 'left', '^': 'up', v: 'down' };

export function indexOf(board: Pick<Board, 'width'>, cell: Cell): number {
  return cell.y * board.width + cell.x;
}

export function cellAt(board: Pick<Board, 'width'>, index: number): Cell {
  return { x: index % board.width, y: Math.floor(index / board.width) };
}

export function inside(board: Pick<Board, 'width' | 'height'>, cell: Cell): boolean {
  return cell.x >= 0 && cell.y >= 0 && cell.x < board.width && cell.y < board.height;
}

export function terrainAt(board: Board, cell: Cell): Terrain | null {
  return inside(board, cell) ? board.terrain[indexOf(board, cell)]! : null;
}

/** Rock and root stand in the way; every other kind of cell can hold the noodle. */
export function isSolid(terrain: Terrain): boolean {
  return terrain === 'rock' || terrain === 'root';
}

export function parseBoard(rows: readonly string[]): Board {
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  if (width === 0) throw new Error('A garden needs at least one cell');
  const terrain: Terrain[] = [];
  const flow = new Map<number, Dir>();
  const mouths = new Map<string, Cell[]>();
  rows.forEach((row, y) => {
    if (row.length !== width) throw new Error(`Row ${y} is ${row.length} cells wide, not ${width}`);
    [...row].forEach((ch, x) => {
      const index = y * width + x;
      if (ch === '.') terrain.push('soil');
      else if (ch === '#') terrain.push('rock');
      else if (ch === 'r') terrain.push('root');
      else if (ch === '~') terrain.push('mud');
      else if (ch in FLOWS) {
        terrain.push('flow');
        flow.set(index, FLOWS[ch]!);
      } else if (/[A-Z]/.test(ch)) {
        terrain.push('tunnel');
        mouths.set(ch, [...(mouths.get(ch) ?? []), { x, y }]);
      } else throw new Error(`Unknown cell “${ch}” at ${x},${y}`);
    });
  });
  const tunnelExit = new Map<number, Cell>();
  const tunnels = new Map<string, readonly [Cell, Cell]>();
  for (const [letter, cells] of mouths) {
    if (cells.length !== 2) throw new Error(`Tunnel ${letter} needs exactly two mouths`);
    const [a, b] = cells as [Cell, Cell];
    tunnelExit.set(a.y * width + a.x, b);
    tunnelExit.set(b.y * width + b.x, a);
    tunnels.set(letter, [a, b]);
  }
  const openCount = terrain.filter((t) => !isSolid(t)).length;
  return { width, height, terrain, flow, tunnelExit, tunnels, openCount };
}

/** An empty box of soil, as the 1980 game drew it. */
export function emptyBoard(width: number, height: number): Board {
  return parseBoard(Array.from({ length: height }, () => '.'.repeat(width)));
}

/**
 * Where a step lands: one cell on, unless that cell is a tunnel mouth, in which case the
 * noodle comes out of the other mouth (it occupies the far mouth, not the near one).
 */
export function landing(board: Board, from: Cell, dir: Dir): Cell {
  const next = step(from, dir);
  if (!inside(board, next)) return next;
  return board.tunnelExit.get(indexOf(board, next)) ?? next;
}

/**
 * The 1980 starting worm in a box of this size: the head a few cells in from the left on the
 * middle row, the body laid out leftwards behind it and, when it reaches the left edge, folded
 * down a row and back to the right. `length` counts the body behind the head, as the game's
 * command-line argument did. Returned head first.
 */
export function classicStart(width: number, height: number, length: number): Cell[] {
  // The original placed the head at column (length mod (COLS-5)) + 2 of a window whose box
  // started at column 1, on row LINES/2; in box cells that is the column below and the row
  // just above the middle.
  const head = { x: (length % (width - 2)) + 1, y: Math.floor((height + 3) / 2) - 1 };
  const body: Cell[] = [head];
  let along = 1;
  let previous = head;
  for (let i = 0; i < length; i++) {
    const turn = (previous.x <= 1 && along === 1) || (previous.x >= width - 2 && along === -1);
    let next: Cell;
    if (turn) {
      along = -along;
      next = { x: previous.x, y: previous.y + 1 };
    } else next = { x: previous.x - along, y: previous.y };
    body.push(next);
    previous = next;
  }
  return body;
}
