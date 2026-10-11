/**
 * The grid of cubes and the three ways cubes may chain. Cubes are numbered row by row from the
 * top left, as in the 1988 program.
 */

export type GridSize = 4 | 5 | 6;

export const GRID_SIZES: readonly GridSize[] = [4, 5, 6];

/**
 * Classic: each cube once per word. Echo (the original's `+`): a cube may come back, but not
 * twice in a row. Mirror (`++`): a cube also counts as its own neighbour, so it may repeat
 * straight away.
 */
export type Rule = 'classic' | 'echo' | 'mirror';

export const RULES: readonly Rule[] = ['classic', 'echo', 'mirror'];

/** A face is one lowercase letter, or `qu`, which spells two letters on one cube. */
export type Face = string;

export interface Board {
  size: GridSize;
  faces: readonly Face[];
}

export const QU = 'qu';

const neighbourCache = new Map<GridSize, readonly (readonly number[])[]>();

/** The up to eight cubes touching each cube, horizontally, vertically or diagonally. */
export function neighbours(size: GridSize): readonly (readonly number[])[] {
  const cached = neighbourCache.get(size);
  if (cached) return cached;
  const lists: number[][] = [];
  for (let cube = 0; cube < size * size; cube++) {
    const row = Math.floor(cube / size);
    const column = cube % size;
    const list: number[] = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const r = row + dr;
        const c = column + dc;
        if (r >= 0 && r < size && c >= 0 && c < size) list.push(r * size + c);
      }
    }
    lists.push(list);
  }
  neighbourCache.set(size, lists);
  return lists;
}

export function touching(size: GridSize, from: number, to: number): boolean {
  return neighbours(size)[from]!.includes(to);
}

/**
 * Whether `next` may follow `path` under the rule. The first cube may be any cube; the
 * caller checks the letters.
 */
export function canExtend(
  size: GridSize,
  rule: Rule,
  path: readonly number[],
  next: number,
): boolean {
  if (next < 0 || next >= size * size) return false;
  if (path.length === 0) return true;
  const last = path[path.length - 1]!;
  if (next === last) return rule === 'mirror';
  if (!touching(size, last, next)) return false;
  return rule !== 'classic' || !path.includes(next);
}

export function isValidPath(size: GridSize, rule: Rule, path: readonly number[]): boolean {
  for (let i = 0; i < path.length; i++) {
    if (!canExtend(size, rule, path.slice(0, i), path[i]!)) return false;
  }
  return path.length > 0;
}

/** The letters a path spells on the board (`qu` faces give two letters). */
export function spell(board: Board, path: readonly number[]): string {
  return path.map((cube) => board.faces[cube]!).join('');
}

/** Letters, counting `qu` as two, as the scoring and the minimum length do. */
export function letterCount(word: string): number {
  return word.length;
}

export function faceLabel(face: Face): string {
  return face === QU ? 'Qu' : face.toUpperCase();
}

export function rowColumn(size: GridSize, cube: number): { row: number; column: number } {
  return { row: Math.floor(cube / size), column: cube % size };
}
