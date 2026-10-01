import { describe, expect, it } from 'vitest';
import { roomById } from '../data/house';
import { createRoom } from '../engine/room';
import { solve } from '../engine/solver';
import { describeRun, rankRun, rivalsBehind, roomLadder } from './ladder';

describe('the ladder in a room', () => {
  const room = roomById('living');
  const initial = createRoom(room.spec);
  const par = solve(initial)!;
  const ladder = roomLadder(initial, par);

  it('has the four rivals and par, and par always clears', () => {
    expect(ladder.map((r) => r.id)).toEqual(['mochi', 'pip', 'professor', 'glasses', 'par']);
    expect(ladder.find((r) => r.id === 'par')).toMatchObject({
      outcome: 'cleared',
      turns: room.par,
      zooms: 0,
    });
  });

  it('puts a clear without zooms ahead of a faster one with a zoom', () => {
    const steady = { outcome: 'cleared' as const, turns: 9, zooms: 0 };
    const lucky = { outcome: 'cleared' as const, turns: 6, zooms: 1 };
    expect(rankRun(steady, lucky)).toBeLessThan(0);
    expect(rankRun({ outcome: 'caught', turns: 30, zooms: 0 }, lucky)).toBeGreaterThan(0);
  });

  it('counts the rivals a player finished ahead of', () => {
    expect(
      rivalsBehind({ outcome: 'cleared', turns: room.par, zooms: 0 }, ladder),
    ).toBeGreaterThanOrEqual(3);
    expect(rivalsBehind({ outcome: 'caught', turns: 0, zooms: 0 }, ladder)).toBe(0);
  });

  it('describes a run in plain words', () => {
    expect(describeRun({ outcome: 'cleared', turns: 6, zooms: 1 })).toBe('6 turns · 1 zoom');
    expect(describeRun({ outcome: 'caught', turns: 4, zooms: 0 })).toBe('caught on turn 4');
  });
});
