import { describe, expect, it } from 'vitest';
import { bankedTotals, type MatchState, newMatch, nextHand, playOut, starterOf } from './match';

/** Games of several hands: targets, winners, the first turn passing round, determinism. */

describe('a game', () => {
  it('passes the first turn round the table, the player opening', () => {
    expect([0, 1, 2, 3].map((n) => starterOf(n, 2))).toEqual([0, 1, 0, 1]);
    expect([0, 1, 2, 3, 4].map((n) => starterOf(n, 4))).toEqual([0, 1, 2, 3, 0]);
  });

  it('plays hands until a side reaches 5000, and the higher total wins', () => {
    const match = playOut(
      newMatch({ teams: false, length: 'full', seed: 'full:1', drivers: ['classic', 'classic'] }),
    );
    expect(match.over).toBe(true);
    expect(Math.max(...match.totals)).toBeGreaterThanOrEqual(5000);
    const totals = match.history.reduce(
      (sum, record) => [sum[0]! + record.scores[0].total, sum[1]! + record.scores[1].total],
      [0, 0],
    );
    expect(totals).toEqual(match.totals);
    expect(match.winner).toBe(match.totals[0] > match.totals[1] ? 0 : 1);
  });

  it('stops at 2500 for the short game', () => {
    const match = playOut(
      newMatch({ teams: false, length: 'short', seed: 'short:1', drivers: ['classic', 'classic'] }),
    );
    expect(Math.max(...match.totals)).toBeGreaterThanOrEqual(2500);
    const before = match.totals.map((t, i) => t - match.history.at(-1)!.scores[i]!.total);
    expect(Math.max(...before)).toBeLessThan(2500);
  });

  it('decides a single hand on that hand alone', () => {
    const match = playOut(
      newMatch({
        teams: false,
        length: 'single',
        seed: 'single:1',
        drivers: ['classic', 'classic'],
      }),
    );
    expect(match.history).toHaveLength(1);
    expect(() => nextHand(match)).toThrow();
  });

  it('keeps a closed hand out of the score banked before it, so the bar never counts it twice', () => {
    const match = playOut(
      newMatch({
        teams: false,
        length: 'single',
        seed: 'single:1',
        drivers: ['classic', 'classic'],
      }),
    );
    expect(bankedTotals(match)).toEqual([0, 0]);
    expect(match.totals).toEqual(match.history[0]!.scores.map((score) => score.total));
  });

  it('replays exactly from the same seed', () => {
    const run = (): MatchState =>
      playOut(
        newMatch({ teams: false, length: 'full', seed: 'same', drivers: ['rookie', 'classic'] }),
      );
    const a = run();
    const b = run();
    expect(b.totals).toEqual(a.totals);
    expect(b.history.length).toBe(a.history.length);
  });

  it('survives a save and restore through JSON mid-hand', () => {
    const match = newMatch({
      teams: false,
      length: 'full',
      seed: 'save',
      drivers: ['classic', 'classic'],
    });
    const copy = JSON.parse(JSON.stringify(match)) as MatchState;
    expect(playOut(copy).totals).toEqual(playOut(match).totals);
  });

  it('plays partnerships to 1000 a hand with four drivers', () => {
    const match = playOut(
      newMatch({
        teams: true,
        length: 'single',
        seed: 'teams:1',
        drivers: ['classic', 'classic', 'classic', 'classic'],
      }),
    );
    expect(match.hand.end).toBe(1000);
    expect(match.hand.seats).toHaveLength(4);
    expect(match.history[0]!.extended).toBe(false);
  });
});
