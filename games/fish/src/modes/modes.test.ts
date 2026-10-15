import { validateManifest } from '@usr-games/kit/manifest';
import { describe, expect, it } from 'vitest';
import manifest from '../../manifest.json';
import { MAX_ASKS } from '../engine/rules';
import {
  dailySetup,
  dailyShareText,
  isValidSetup,
  type MatchSetup,
  tableFor,
  TOURNAMENT_ROUNDS,
  tournamentSetup,
} from './match';
import { type GameSummary, PACKAGES, packagesForGame, xpEventsFor } from './packages';

const quick = (patch: Partial<MatchSetup> = {}): MatchSetup => ({
  kind: 'quick',
  rules: 'standard',
  rivals: ['otto', 'hazel', 'miso'],
  seed: 'test',
  ...patch,
});

describe('setups', () => {
  it('Classic 1993 takes one rival, Otto or Hazel; the others take one to three', () => {
    expect(isValidSetup(quick({ rules: 'classic', rivals: ['otto'] }))).toBe(true);
    expect(isValidSetup(quick({ rules: 'classic', rivals: ['hazel'] }))).toBe(true);
    expect(isValidSetup(quick({ rules: 'classic', rivals: ['miso'] }))).toBe(false);
    expect(isValidSetup(quick({ rules: 'classic', rivals: ['otto', 'hazel'] }))).toBe(false);
    expect(isValidSetup(quick({ rivals: [] }))).toBe(false);
    expect(isValidSetup(quick({ rivals: ['otto', 'otto'] }))).toBe(false);
  });

  it('a setup and its seed replay the same game', () => {
    const play = () => {
      const table = tableFor(quick({ seed: 'replay' }), 'miso');
      table.runComputers();
      return table.log;
    };
    expect(play()).toEqual(play());
  });

  it('every kind of game finishes well inside the guard', () => {
    for (let i = 0; i < 12; i++) {
      for (const setup of [
        quick({ seed: `finish/${i}` }),
        quick({ seed: `finish/${i}`, rules: 'classic', rivals: [i % 2 ? 'hazel' : 'otto'] }),
        tournamentSetup(`t${i}`, i % 5),
        dailySetup(`fish:daily:2026-10-${10 + i}`, 40 + i),
      ]) {
        const table = tableFor(setup, 'hazel');
        table.runComputers();
        expect(table.over).toBe(true);
        expect(table.state.asks).toBeLessThan(MAX_ASKS);
      }
    }
  });

  it('the Tournament grows from Otto alone to all three, every round to the last book', () => {
    expect(TOURNAMENT_ROUNDS).toEqual([
      ['otto'],
      ['hazel'],
      ['miso'],
      ['otto', 'miso'],
      ['otto', 'hazel', 'miso'],
    ]);
    expect(tournamentSetup('cup', 3)).toMatchObject({
      rules: 'all-books',
      rivals: ['otto', 'miso'],
      round: 3,
    });
  });

  it('the Daily Pond seats all three rivals in the same order for everyone on a day', () => {
    const a = dailySetup('fish:daily:2026-10-15', 45);
    const b = dailySetup('fish:daily:2026-10-15', 45);
    expect(a).toEqual(b);
    expect([...a.rivals].sort()).toEqual(['hazel', 'miso', 'otto']);
    expect(a.rules).toBe('all-books');
    const tables = [tableFor(a), tableFor(b)];
    expect(tables[0]!.state.seats[0]!.hand).toEqual(tables[1]!.state.seats[0]!.hand);
  });

  it('shares the day as one line, fish for books, with no address in it', () => {
    const text = dailyShareText(
      '2026-10-12',
      [{ golden: false }, { golden: true }, { golden: false }],
      false,
    );
    expect(text).toBe('Gone Fishing #42 · 3 books · 🐟🐠🐟 · no notebook');
    expect(dailyShareText('2026-10-12', [{ golden: false }], true)).toBe(
      'Gone Fishing #42 · 1 book · 🐟 · notebook',
    );
  });
});

describe('packages and XP', () => {
  const summary = (patch: Partial<GameSummary> = {}): GameSummary => ({
    setup: quick(),
    outcome: 'win',
    books: [{ rank: 7, golden: false }],
    luckyCasts: 0,
    mostBooksInATurn: 1,
    notebookUsed: true,
    taunt: false,
    ...patch,
  });
  const none = { dailyDays: 0, tournamentWon: false };

  it('a win beats every rival at the pond', () => {
    expect(packagesForGame(summary(), none)).toEqual(
      expect.arrayContaining(['first-book', 'beat-otto', 'beat-hazel', 'beat-miso']),
    );
    expect(packagesForGame(summary({ outcome: 'loss' }), none)).not.toContain('beat-otto');
  });

  it('rewards playing from memory, all thirteen books, Classic, luck and gold', () => {
    const won = packagesForGame(
      summary({
        notebookUsed: false,
        setup: quick({ rules: 'all-books' }),
        luckyCasts: 3,
        mostBooksInATurn: 3,
        books: [{ rank: 2, golden: true }],
      }),
      none,
    );
    expect(won).toEqual(
      expect.arrayContaining([
        'no-notebook-win',
        'full-house',
        'lucky-cast',
        'three-books-one-turn',
        'golden-catch',
      ]),
    );
    expect(
      packagesForGame(summary({ setup: quick({ rules: 'classic', rivals: ['otto'] }) }), none),
    ).toContain('classic-1993');
  });

  it('the rare taunt, seven Daily days and the cup', () => {
    expect(packagesForGame(summary({ outcome: 'loss', taunt: true }), none)).toContain(
      'rare-taunt',
    );
    expect(packagesForGame(summary(), { dailyDays: 7, tournamentWon: false })).toContain(
      'daily-regular',
    );
    expect(packagesForGame(summary(), { dailyDays: 0, tournamentWon: true })).toContain(
      'tournament-cup',
    );
  });

  it('XP for a game stays modest: books, a win, from memory, a golden', () => {
    const events = xpEventsFor(
      summary({
        books: Array.from({ length: 8 }, () => ({ rank: 3, golden: true })),
        notebookUsed: false,
      }),
    );
    expect(events.map((e) => e.id)).toEqual(['books', 'win', 'from-memory', 'golden']);
    expect(events.find((e) => e.id === 'books')!.xp).toBe(12);
    expect(xpEventsFor(summary({ outcome: 'loss', books: [] }))).toEqual([]);
  });
});

describe('the manifest', () => {
  it('validates and lists exactly the packages the game installs', () => {
    const result = validateManifest(manifest);
    expect(result.ok, JSON.stringify(result)).toBe(true);
    expect(manifest.packages).toEqual(PACKAGES.map((p) => ({ ...p })));
  });
});
