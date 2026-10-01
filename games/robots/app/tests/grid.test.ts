import { describe, expect, it } from 'vitest';
import { Grid } from '../src/game/grid';

describe('Grid', () => {
  it('reports in-bounds correctly', () => {
    const grid = new Grid<number>(3, 3, 0);
    expect(grid.inBounds(0, 0)).toBe(true);
    expect(grid.inBounds(2, 2)).toBe(true);
    expect(grid.inBounds(3, 3)).toBe(false);
    expect(grid.inBounds(-1, 0)).toBe(false);
  });

  it('stores and retrieves values', () => {
    const grid = new Grid<string>(2, 2, 'empty');
    grid.set(0, 0, 'player');
    grid.set(1, 1, 'robot');
    expect(grid.get(0, 0)).toBe('player');
    expect(grid.get(1, 1)).toBe('robot');
    expect(grid.get(0, 1)).toBe('empty');
  });

  it('throws on out-of-bounds access', () => {
    const grid = new Grid<number>(2, 2, 0);
    expect(() => grid.get(2, 0)).toThrow(RangeError);
    expect(() => grid.set(-1, 0, 42)).toThrow(RangeError);
  });

  it('rejects non-positive dimensions', () => {
    expect(() => new Grid<number>(0, 5, 0)).toThrow(RangeError);
    expect(() => new Grid<number>(5, -1, 0)).toThrow(RangeError);
  });

  it('iterates every cell exactly once via forEach', () => {
    const grid = new Grid<number>(3, 2, 0);
    const visited: Array<[number, number]> = [];
    grid.forEach((_, x, y) => visited.push([x, y]));
    expect(visited).toHaveLength(6);
    expect(visited).toContainEqual([0, 0]);
    expect(visited).toContainEqual([2, 1]);
  });

  it('fill replaces every cell', () => {
    const grid = new Grid<number>(2, 2, 0);
    grid.set(0, 0, 42);
    grid.fill(99);
    expect(grid.get(0, 0)).toBe(99);
    expect(grid.get(1, 1)).toBe(99);
  });
});
