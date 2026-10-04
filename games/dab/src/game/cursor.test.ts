import { describe, expect, it } from 'vitest';
import { edgeCount, horizontalEdge, verticalEdge } from '../engine/board';
import { aim, type Cursor, cursorEdge, type Direction, originalStep, startCursor } from './cursor';

const shape = { columns: 3, rows: 2 };

describe('the keyboard cursor', () => {
  it('starts where the original did: the left side of the top-left box', () => {
    expect(cursorEdge(shape, startCursor())).toBe(verticalEdge(shape, 0, 0));
  });

  it('aims, then walks', () => {
    let cursor: Cursor = startCursor();
    cursor = aim(shape, cursor, 'right');
    expect(cursorEdge(shape, cursor)).toBe(horizontalEdge(shape, 0, 0));
    cursor = aim(shape, cursor, 'right');
    expect(cursorEdge(shape, cursor)).toBe(horizontalEdge(shape, 0, 1));
  });

  it('reaches every line with the arrows alone', () => {
    const seen = new Set<number>();
    const directions: Direction[] = ['up', 'down', 'left', 'right'];
    let frontier: Cursor[] = [startCursor()];
    const visited = new Set<string>();
    while (frontier.length) {
      const next: Cursor[] = [];
      for (const cursor of frontier) {
        const key = `${cursor.row},${cursor.column},${cursor.direction}`;
        if (visited.has(key)) continue;
        visited.add(key);
        seen.add(cursorEdge(shape, cursor));
        for (const d of directions) next.push(aim(shape, cursor, d));
      }
      frontier = next;
    }
    expect(seen.size).toBe(edgeCount(shape));
  });

  it('never points off the board', () => {
    let cursor = startCursor();
    for (const d of [
      'up',
      'up',
      'left',
      'left',
      'down',
      'down',
      'down',
      'right',
      'right',
      'right',
      'right',
    ] as const) {
      cursor = aim(shape, cursor, d);
      expect(cursorEdge(shape, cursor)).toBeGreaterThanOrEqual(0);
    }
  });

  it('jumps and hops on the original lattice, wrapping round', () => {
    const left = verticalEdge(shape, 0, 0);
    expect(originalStep(shape, left, 'l')).toBe(verticalEdge(shape, 0, 1));
    expect(originalStep(shape, left, 'u')).toBe(horizontalEdge(shape, 0, 0));
    expect(originalStep(shape, left, 'h')).toBe(verticalEdge(shape, 0, 3));
    for (let edge = 0; edge < edgeCount(shape); edge++) {
      for (const key of ['h', 'j', 'k', 'l', 'y', 'u', 'b', 'n'] as const) {
        const next = originalStep(shape, edge, key);
        expect(next).toBeGreaterThanOrEqual(0);
        expect(next).toBeLessThan(edgeCount(shape));
      }
    }
  });
});
