import { describe, expect, it } from 'vitest';
import { diffTurn, dangerCells, nextSteps } from '../src/fx/turnDiff';
import { movePlayer, teleport } from '../src/game/engine';
import { DIRECTIONS, GRID_WIDTH, type GameState } from '../src/game/state';
import { RNG } from '../src/game/rng';

const base = (over: Partial<GameState>): GameState => ({
  level: 1, score: 0, player: { x: 30, y: 10 }, robots: [], piles: [], waitBonus: 0, status: 'playing', ...over,
});

describe('diffTurn', () => {
  it('finds a robot-robot crash where the engine put the wreck', () => {
    const prev = base({ robots: [{ id: 0, x: 20, y: 9 }, { id: 1, x: 20, y: 11 }, { id: 2, x: 2, y: 2 }] });
    const next = movePlayer(prev, DIRECTIONS.stay).state;
    const d = diffTurn(prev, next);
    expect(d.crashes).toEqual([{ at: { x: 21, y: 10 }, count: 2, onPile: false }]);
    expect(next.piles).toContainEqual({ x: 21, y: 10 });
    expect(d.dying.map((x) => x.id).sort()).toEqual([0, 1]);
  });

  it('marks a robot walking into scrap', () => {
    const prev = base({ robots: [{ id: 0, x: 20, y: 10 }, { id: 1, x: 2, y: 2 }], piles: [{ x: 21, y: 10 }] });
    const d = diffTurn(prev, movePlayer(prev, DIRECTIONS.stay).state);
    expect(d.crashes).toEqual([{ at: { x: 21, y: 10 }, count: 1, onPile: true }]);
  });

  it('reports the level clear with the last crash', () => {
    const prev = base({ robots: [{ id: 0, x: 20, y: 9 }, { id: 1, x: 20, y: 11 }] });
    const d = diffTurn(prev, movePlayer(prev, DIRECTIONS.stay).state);
    expect(d.levelCleared).toBe(true);
    expect(d.crashes).toHaveLength(1);
  });

  it('reports death and teleports', () => {
    const prev = base({ robots: [{ id: 0, x: 29, y: 10 }] });
    expect(diffTurn(prev, movePlayer(prev, DIRECTIONS.stay).state).died).toBe(true);
    const far = base({ robots: [{ id: 0, x: 2, y: 2 }] });
    const t = teleport(far, new RNG(5)).state;
    const d = diffTurn(far, t);
    if (Math.max(Math.abs(t.player.x - 30), Math.abs(t.player.y - 10)) > 1) expect(d.teleported).not.toBeNull();
  });
});

describe('danger and preview', () => {
  it('marks the eight squares round a robot, and scrap', () => {
    const s = base({ robots: [{ id: 0, x: 5, y: 5 }], piles: [{ x: 10, y: 10 }] });
    const m = dangerCells(s);
    expect(m[4 * GRID_WIDTH + 4]).toBe(1);
    expect(m[6 * GRID_WIDTH + 6]).toBe(1);
    expect(m[7 * GRID_WIDTH + 7]).toBe(0);
    expect(m[10 * GRID_WIDTH + 10]).toBe(2);
  });
  it('predicts the next sign() step', () => {
    const s = base({ robots: [{ id: 3, x: 20, y: 5 }] });
    expect(nextSteps(s)).toEqual([{ id: 3, from: { x: 20, y: 5 }, to: { x: 21, y: 6 } }]);
  });
});
