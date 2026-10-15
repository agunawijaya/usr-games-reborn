import { describe, expect, it } from 'vitest';
import {
  albumFrom,
  catchInto,
  DEFAULT_PREFS,
  EMPTY_ALBUM,
  prefsFrom,
  recordsFrom,
  tournamentFrom,
} from './saves';

describe('saves repair what they load', () => {
  it('preferences: unknown values fall back, rivals are kept unique and real', () => {
    expect(prefsFrom(null)).toEqual(DEFAULT_PREFS);
    expect(
      prefsFrom({
        rules: 'chess',
        notebook: 'yes',
        rivals: ['miso', 'shark', 'miso'],
        speed: 'brisk',
      }),
    ).toEqual({
      ...DEFAULT_PREFS,
      rivals: ['miso'],
      speed: 'brisk',
    });
    expect(prefsFrom({ rivals: [] }).rivals).toEqual(DEFAULT_PREFS.rivals);
  });

  it('records: counts are whole and never negative', () => {
    const records = recordsFrom({ games: 3.7, wins: -2, beaten: { otto: 2, miso: 'x' } });
    expect(records.games).toBe(3);
    expect(records.wins).toBe(0);
    expect(records.beaten).toEqual({ otto: 2, hazel: 0, miso: 0 });
  });

  it('the album: thirteen entries whatever was stored', () => {
    expect(albumFrom('broken')).toEqual(EMPTY_ALBUM());
    expect(albumFrom([{ first: '2026-10-01', caught: 2 }])[0]).toEqual({
      first: '2026-10-01',
      caught: 2,
      goldenFirst: null,
      golden: 0,
    });
  });

  it('the tournament: five results at most, of known kinds', () => {
    expect(
      tournamentFrom({ seed: 's', results: ['win', 'nope', 'loss', 'draw', 'win', 'win', 'win'] }),
    ).toEqual({
      seed: 's',
      results: ['win', 'loss', 'draw', 'win', 'win'],
    });
    expect(tournamentFrom({ results: [] })).toBeNull();
  });
});

describe('catching into the album', () => {
  it('dates first catches and first golden ones, and counts every catch', () => {
    const first = catchInto(
      EMPTY_ALBUM(),
      [
        { rank: 13, golden: false },
        { rank: 2, golden: true },
      ],
      '2026-10-15',
    );
    expect(first.newSpecies).toEqual([13, 2]);
    expect(first.newGolden).toEqual([2]);
    expect(first.album[12]).toMatchObject({ first: '2026-10-15', caught: 1 });
    const again = catchInto(first.album, [{ rank: 13, golden: true }], '2026-10-16');
    expect(again.newSpecies).toEqual([]);
    expect(again.newGolden).toEqual([13]);
    expect(again.album[12]).toMatchObject({
      first: '2026-10-15',
      caught: 2,
      goldenFirst: '2026-10-16',
      golden: 1,
    });
  });
});
