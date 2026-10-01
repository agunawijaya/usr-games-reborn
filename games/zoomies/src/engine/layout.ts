import type { Furniture, Layout, Point } from './types';

export function createLayout(
  width: number,
  height: number,
  furniture: readonly Furniture[] = [],
): Layout {
  const blocked = new Array<boolean>(width * height).fill(false);
  for (const piece of furniture) {
    for (let y = piece.y; y < piece.y + piece.h; y++) {
      for (let x = piece.x; x < piece.x + piece.w; x++) {
        if (inBounds({ width, height }, x, y)) blocked[y * width + x] = true;
      }
    }
  }
  return { width, height, furniture, blocked };
}

export function inBounds(size: { width: number; height: number }, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < size.width && y < size.height;
}

export function isBlocked(layout: Layout, x: number, y: number): boolean {
  return !inBounds(layout, x, y) || layout.blocked[y * layout.width + x] === true;
}

export function cellIndex(layout: Layout, point: Point): number {
  return point.y * layout.width + point.x;
}

export function samePoint(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y;
}

/** Moves on a grid where diagonals cost one step, as the robots and the cat both move. */
export function chebyshev(a: Point, b: Point): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

export function sign(n: number): -1 | 0 | 1 {
  return n < 0 ? -1 : n > 0 ? 1 : 0;
}
