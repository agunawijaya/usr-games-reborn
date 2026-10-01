import { describe, expect, it } from 'vitest';
import { createRoom } from '../engine/room';
import { solve } from '../engine/solver';
import { dailyRoom } from './daily';
import { ROOMS } from './house';

describe('the house', () => {
  it('has twelve rooms in order, each with a new idea', () => {
    expect(ROOMS).toHaveLength(12);
    expect(new Set(ROOMS.map((r) => r.id)).size).toBe(12);
  });

  it.each(ROOMS.map((room) => [room.id, room] as const))('%s has a proven par', (_, room) => {
    const solution = solve(createRoom(room.spec), { maxNodes: 1_000_000 });
    expect(solution?.proven).toBe(true);
    expect(solution?.turns).toBe(room.par);
    const [min, max] = room.blueprint.par;
    expect(room.par).toBeGreaterThanOrEqual(min);
    expect(room.par).toBeLessThanOrEqual(max);
  });
});

describe('the daily room', () => {
  it('is the same room for the same day', () => {
    const a = dailyRoom('2026-10-01', 'zoomies:daily:2026-10-01');
    const b = dailyRoom('2026-10-01', 'zoomies:daily:2026-10-01');
    expect(a?.spec).toEqual(b?.spec);
    expect(a?.solution.turns).toBe(b?.solution.turns);
  });

  it('can be cleared on every day of a fortnight', () => {
    for (let day = 1; day <= 14; day++) {
      const key = `2026-11-${String(day).padStart(2, '0')}`;
      const room = dailyRoom(key, `zoomies:daily:${key}`);
      expect(room, key).not.toBeNull();
      expect(room!.solution.turns).toBeGreaterThanOrEqual(9);
    }
  });
});
