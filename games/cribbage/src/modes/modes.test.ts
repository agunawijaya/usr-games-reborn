import { describe, expect, it } from 'vitest';
import { createRng } from '@usr-games/kit';
import { type CardId, parseCard } from '@usr-games/kit/cards';
import { prefsFrom, recordsFrom, savedGameFrom } from '../app/saves';
import { dailyPuzzle, dailyShareText, judgeDiscard, shareCards } from '../engine/daily';
import { startMatch } from '../engine/match';
import { isRightCount, readAnswer, trainerHand } from '../engine/trainer';
import { pegWords } from '../play/director';
import { addToAlbum, ALBUM_SIZE, type AlbumEntry, albumFrom } from './album';
import {
  type GameSummary,
  PACKAGES,
  packagesForGame,
  packagesForMoment,
  xpEventsFor,
} from './packages';

const cs = (text: string): CardId[] => text.split(' ').map((word) => parseCard(word)!);

describe('the Daily Discard', () => {
  it('deals the same puzzle for the same day, and a different one the next', () => {
    const a = dailyPuzzle('cribbage:daily:2026-10-24');
    expect(dailyPuzzle('cribbage:daily:2026-10-24')).toEqual(a);
    expect(dailyPuzzle('cribbage:daily:2026-10-25')).not.toEqual(a);
    expect(a.hand).toHaveLength(6);
    expect(new Set(a.hand).size).toBe(6);
  });

  it('scores the best throw 100 % and takes ten for each point given away', () => {
    const puzzle = dailyPuzzle('cribbage:daily:2026-10-24');
    const best = judgeDiscard(
      puzzle,
      judgeDiscard(puzzle, puzzle.hand.slice(0, 2)).options[0]!.thrown,
    );
    expect(best.place).toBe(1);
    expect(best.percent).toBe(100);
    const worst = judgeDiscard(puzzle, best.options[14]!.thrown);
    expect(worst.place).toBe(15);
    const lost = best.options[0]!.value - best.options[14]!.value;
    expect(worst.percent).toBe(Math.max(0, Math.round(100 - 10 * lost)));
    for (const option of best.options.slice(1)) {
      const verdict = judgeDiscard(puzzle, option.thrown);
      expect(verdict.percent).toBeLessThan(100);
      expect(verdict.percent).toBeLessThanOrEqual(best.percent);
    }
  });

  it('picks puzzles where the choice is a real one', () => {
    for (let day = 1; day <= 20; day++) {
      const puzzle = dailyPuzzle(`cribbage:daily:2026-11-${String(day).padStart(2, '0')}`);
      const options = judgeDiscard(puzzle, puzzle.hand.slice(0, 2)).options;
      expect(options[0]!.value - options[14]!.value).toBeGreaterThan(1);
    }
  });

  it('shares without a URL, with the daily number and up to three cards', () => {
    expect(shareCards(100)).toBe('🃏🃏🃏');
    expect(shareCards(98)).toBe('🃏🃏');
    expect(shareCards(60)).toBe('🃏');
    const text = dailyShareText('2026-10-12', 98);
    expect(text).toBe('Fifteen-Two #42 · discard 98% of best · 🃏🃏');
    expect(text).not.toMatch(/http|www/);
  });
});

describe('the counting trainer', () => {
  it('deals real hands, rarely worthless ones', () => {
    const rng = createRng('trainer-test');
    let zero = 0;
    for (let i = 0; i < 400; i++) {
      const hand = trainerHand(rng);
      expect(new Set([...hand.hand, hand.starter]).size).toBe(5);
      if (hand.count.total === 0) zero++;
    }
    // About one hand in thirteen is worth nothing; most of those are dealt again.
    expect(zero).toBeLessThan(20);
  });

  it('reads answers and takes nineteen for a hand of nothing', () => {
    expect(readAnswer(' 12 ')).toBe(12);
    expect(readAnswer('30')).toBeNull();
    expect(readAnswer('x')).toBeNull();
    expect(isRightCount(19, 0)).toBe(true);
    expect(isRightCount(19, 4)).toBe(false);
    expect(isRightCount(4, 4)).toBe(true);
  });
});

const summary = (patch: Partial<GameSummary> = {}): GameSummary => ({
  level: 'classic',
  length: 121,
  counting: 'automatic',
  outcome: 'win',
  skunk: 'none',
  scores: [121, 100],
  hands: 9,
  thirtyOnes: 0,
  hisHeels: 0,
  bestCount: 12,
  claims: 0,
  rightClaims: 0,
  pegged: 30,
  shown: 91,
  ...patch,
});

describe('packages', () => {
  it('lists twelve packages and earns each from the right moment', () => {
    expect(PACKAGES).toHaveLength(12);
    expect(packagesForMoment({ handTotal: 29 })).toEqual([
      'twenty-plus',
      'twenty-four-plus',
      'perfect-29',
    ]);
    expect(packagesForMoment({ thirtyOne: true, hisHeels: true })).toEqual([
      'thirty-one',
      'his-heels',
    ]);
    expect(packagesForGame(summary())).toEqual(['long-game']);
    expect(packagesForGame(summary({ level: 'sharp', skunk: 'double-skunk' }))).toEqual([
      'long-game',
      'beat-sharp',
      'skunk',
      'double-skunk',
    ]);
    expect(packagesForGame(summary({ outcome: 'loss' }))).toEqual([]);
    expect(
      packagesForGame(
        summary({ counting: 'classic-1980', claims: 18, rightClaims: 18, outcome: 'loss' }),
      ),
    ).toEqual(['perfect-counter']);
    expect(
      packagesForGame(summary({ counting: 'classic-1980', claims: 18, rightClaims: 17 })),
    ).not.toContain('perfect-counter');
  });

  it('keeps XP events within the Hall’s limits', () => {
    const events = xpEventsFor(
      summary({
        level: 'sharp',
        skunk: 'skunk',
        thirtyOnes: 5,
        bestCount: 29,
        claims: 3,
        rightClaims: 3,
      }),
    );
    for (const event of events) expect(event.xp).toBeLessThanOrEqual(25);
    expect(xpEventsFor(summary({ outcome: 'loss' }))).toEqual([]);
  });
});

describe('hand records', () => {
  const entry = (total: number, date = '2026-10-24'): AlbumEntry => ({
    hand: cs('5c 5d 5h js'),
    starter: parseCard('5s')!,
    isCrib: false,
    total,
    date,
    opponent: 'classic',
  });

  it('keeps the best hands first and an earlier equal hand ahead', () => {
    let album: AlbumEntry[] = [];
    for (const total of [8, 20, 12, 20, 29, 4])
      album = addToAlbum(album, entry(total, `d${total}-${album.length}`)).album;
    expect(album.map((e) => e.total)).toEqual([29, 20, 20, 12, 8, 4]);
    expect(album[1]!.date).toBe('d20-1');
  });

  it('holds at most its size and refuses hands worth nothing', () => {
    let album: AlbumEntry[] = [];
    for (let i = 0; i < ALBUM_SIZE + 10; i++) album = addToAlbum(album, entry(10)).album;
    expect(album).toHaveLength(ALBUM_SIZE);
    expect(addToAlbum(album, entry(10)).added).toBe(false);
    expect(addToAlbum(album, entry(0)).added).toBe(false);
    expect(albumFrom([{ junk: true }, entry(3)])).toHaveLength(1);
  });
});

describe('saves', () => {
  it('repairs damaged preferences and records', () => {
    expect(prefsFrom({ level: 'grandmaster', length: 99, counting: 'loud', coach: 'yes' })).toEqual(
      {
        level: 'classic',
        length: 121,
        counting: 'automatic',
        coach: true,
        pace: 'relaxed',
      },
    );
    const records = recordsFrom({
      games: -3,
      wins: 'two',
      byLevel: { sharp: { games: 4, wins: 1 } },
      bestCount: 99,
    });
    expect(records.games).toBe(0);
    expect(records.byLevel.sharp).toEqual({ games: 4, wins: 1 });
    expect(records.bestCount).toBe(29);
  });

  it('keeps a game in progress but not a finished one', () => {
    const { state } = startMatch({ length: 61, counting: 'automatic' }, 'saved');
    expect(savedGameFrom({ level: 'sharp', state, seed: 's' })?.level).toBe('sharp');
    expect(
      savedGameFrom({ level: 'sharp', state: { ...state, phase: 'game-over' }, seed: 's' }),
    ).toBeNull();
    expect(savedGameFrom({ level: 'nobody', state, seed: 's' })).toBeNull();
  });
});

describe('words at the table', () => {
  it('names what a card made in the play', () => {
    expect(pegWords([{ kind: 'fifteen', points: 2, cards: [] }])).toBe('Fifteen');
    expect(
      pegWords([
        { kind: 'fifteen', points: 2, cards: [] },
        { kind: 'pair', points: 2, cards: [] },
      ]),
    ).toBe('Fifteen and a pair');
    expect(pegWords([{ kind: 'pair', points: 6, cards: [] }])).toBe('Pair royal');
    expect(pegWords([{ kind: 'run', points: 4, cards: [] }])).toBe('Run of four');
    expect(pegWords([{ kind: 'thirty-one', points: 2, cards: [] }])).toBe('Thirty-one');
  });
});
