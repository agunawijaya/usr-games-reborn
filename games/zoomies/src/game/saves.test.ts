import { describe, expect, it } from 'vitest';
import { createRoom } from '../engine/room';
import { current, play, startSession, undo } from '../engine/session';
import { addDaily, addNight, mergeRoomRecord, starsEarned } from './saves';

describe('undo', () => {
  it('takes a turn back, and a zoom tried again lands where it did before', () => {
    const room = createRoom({
      width: 9,
      height: 7,
      rules: 'house',
      cat: { x: 4, y: 3 },
      vacuums: [{ kind: 'basic', x: 0, y: 0 }],
      seed: 'undo',
    });
    let session = startSession(room);
    session = play(session, { type: 'zoom' }).session;
    const first = current(session).cat;
    session = undo(session);
    expect(current(session).cat).toEqual(room.cat);
    expect(session.undos).toBe(1);
    session = play(session, { type: 'zoom' }).session;
    expect(current(session).cat).toEqual(first);
  });
});

describe('saves', () => {
  it('keeps the best of two room records', () => {
    const merged = mergeRoomRecord(
      { stars: [true, false, true], bestTurns: 12, tidy: true },
      { stars: [true, true, false], bestTurns: 9, tidy: true },
    );
    expect(merged).toEqual({ stars: [true, true, true], bestTurns: 9, tidy: true });
    expect(starsEarned({ rooms: { hallway: merged }, lastRoom: null })).toBe(3);
  });

  it('keeps ten nights, best first, and says where a new one placed', () => {
    let progress = {
      top: [] as { score: number; waves: number; dateKey: string; startWave: number }[],
    };
    for (let i = 1; i <= 11; i++) {
      progress = addNight(progress, {
        score: i * 10,
        waves: 1,
        dateKey: '2026-10-01',
        startWave: 1,
      }).progress;
    }
    expect(progress.top).toHaveLength(10);
    expect(progress.top[0]!.score).toBe(110);
    const { place } = addNight(progress, {
      score: 55,
      waves: 1,
      dateKey: '2026-10-02',
      startWave: 1,
    });
    expect(place).toBe(7);
  });

  it('keeps the first finish of a day, unless a clear replaces a loss', () => {
    const lost = { outcome: 'caught' as const, turns: 5, par: 10, zooms: 0, undos: 0, ahead: 0 };
    const won = { outcome: 'cleared' as const, turns: 12, par: 10, zooms: 0, undos: 2, ahead: 3 };
    let daily = addDaily({ days: {} }, '2026-10-01', lost);
    daily = addDaily(daily, '2026-10-01', won);
    expect(daily.days['2026-10-01']).toEqual(won);
    daily = addDaily(daily, '2026-10-01', { ...won, turns: 10 });
    expect(daily.days['2026-10-01']!.turns).toBe(12);
  });
});
