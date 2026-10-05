import { describe, expect, it } from 'vitest';
import { CORE_DECK, deckById } from '../decks/decks';
import { tierOf } from '../engine/difficulty';
import { PACKAGES } from './packages';
import {
  emptyRecords,
  recordBeach,
  recordDaily,
  recordDuel,
  recordRun,
  recordWord,
  type WordPlayed,
} from './records';
import { Session, type SessionSpec } from './session';
import { classicWords, dailyPool, dailyWordFor, runWords } from './words';
import { createRng } from '@usr-games/kit';

const spec = (patch: Partial<SessionSpec>): SessionSpec => ({
  mode: 'beach',
  deckId: 'ocean',
  tier: 'any',
  seed: 'test',
  dailyNumber: 35,
  recent: [],
  ...patch,
});

function solve(session: Session) {
  for (const letter of new Set(session.round.word)) session.guess(letter);
}

function lose(session: Session) {
  for (const letter of 'abcdefghijklmnopqrstuvwxyz') {
    if (session.phase !== 'playing') break;
    if (!session.round.word.includes(letter)) session.guess(letter);
  }
}

describe('packages', () => {
  it('are twelve in the mix the progression model expects', () => {
    const tiers = PACKAGES.map((p) => p.tier);
    expect(tiers.filter((t) => t === 'core')).toHaveLength(6);
    expect(tiers.filter((t) => t === 'extra')).toHaveLength(4);
    expect(tiers.filter((t) => t === 'rare')).toHaveLength(2);
  });
});

describe('word sources', () => {
  it('Classic keeps the six-letter minimum', () => {
    expect(classicWords().every((word) => word.length >= 6)).toBe(true);
    expect(classicWords().length).toBeGreaterThan(1500);
  });

  it('the Daily pool is everyday words of five to ten letters, not easy', () => {
    const pool = dailyPool();
    expect(pool.length).toBeGreaterThan(1000);
    expect(pool.every((w) => w.length >= 5 && w.length <= 10 && tierOf(w) !== 'easy')).toBe(true);
    expect(CORE_DECK.words).toContain(dailyWordFor(35));
  });

  it('a Tide run climbs from easy to hard without repeats', () => {
    const words = runWords('core', [], createRng(1));
    expect(new Set(words).size).toBe(10);
    expect(words.slice(0, 3).map(tierOf)).toEqual(['easy', 'easy', 'easy']);
    expect(words.slice(7).map(tierOf)).toEqual(['hard', 'hard', 'hard']);
  });
});

describe('a session', () => {
  it('Beach day keeps a golf average across words and avoids repeats', () => {
    const session = new Session(spec({}));
    expect(deckById('ocean').words).toContain(session.round.word);
    session.guess('q');
    solve(session);
    expect(session.phase).toBe('word-over');
    const first = session.round.word;
    session.next();
    expect(session.round.word).not.toBe(first);
    lose(session);
    expect(session.tally.words).toBe(2);
    expect(session.words[1]!.score).toBe(9);
    session.finish();
    expect(session.phase).toBe('over');
  });

  it('the Daily is one word for everyone, without the Lighthouse', () => {
    const a = new Session(spec({ mode: 'daily', seed: 'a' }));
    const b = new Session(spec({ mode: 'daily', seed: 'b' }));
    expect(a.round.word).toBe(b.round.word);
    expect(a.lighthouseAllowed).toBe(false);
    expect(a.lighthouse()).toBeNull();
    solve(a);
    expect(a.phase).toBe('over');
  });

  it('Classic draws six letters and up and offers no help', () => {
    const session = new Session(spec({ mode: 'classic' }));
    expect(session.round.word.length).toBeGreaterThanOrEqual(6);
    expect(session.lighthouseAllowed).toBe(false);
  });

  it('a Tide run carries the castle and ends when it falls', () => {
    const session = new Session(spec({ mode: 'run', deckId: 'core' }));
    lose(session);
    expect(session.phase).toBe('over');
    expect(session.run!.status).toBe('castle-fell');
  });

  it('a Duel waits for a secret word, then swaps who sets it', () => {
    const session = new Session(
      spec({ mode: 'duel', duel: { names: ['Ada', 'Ken'], turnsEach: 1 } }),
    );
    expect(session.phase).toBe('secret');
    expect(session.duelTurn).toEqual({ setter: 0, guesser: 1 });
    expect(session.setSecret('noose')).toEqual({ ok: false, problem: 'not-for-the-beach' });
    expect(session.setSecret('lagoon')).toEqual({ ok: true });
    solve(session);
    session.next();
    expect(session.phase).toBe('secret');
    expect(session.duelTurn).toEqual({ setter: 1, guesser: 0 });
    session.setSecret('kelp');
    lose(session);
    expect(session.phase).toBe('over');
  });

  it('the Lighthouse costs a wave in Beach day', () => {
    const session = new Session(spec({}));
    const outcome = session.lighthouse()!;
    expect(outcome).not.toBeNull();
    expect(session.round.waves).toBe(1);
  });
});

describe('records and packages', () => {
  const word = (patch: Partial<WordPlayed>): WordPlayed => ({
    mode: 'beach',
    deckId: 'ocean',
    word: 'lagoon',
    won: true,
    waves: 0,
    wavesAllowed: 7,
    lighthouseUses: 0,
    score: 0,
    ...patch,
  });

  it('a first clean word earns the first two packages', () => {
    const { earned, records } = recordWord(emptyRecords(), word({}));
    expect(earned).toEqual(expect.arrayContaining(['first-castle', 'clean-sweep']));
    expect(records.found).toBe(1);
    expect(records.lifetime).toEqual({ words: 1, total: 0 });
  });

  it('six waves in is one wave short; twelve letters is a long shoreline', () => {
    expect(recordWord(emptyRecords(), word({ waves: 6, score: 6 })).earned).toContain('last-wave');
    expect(recordWord(emptyRecords(), word({ word: 'lighthouses' })).earned).not.toContain(
      'long-word',
    );
    expect(recordWord(emptyRecords(), word({ word: 'oceanography' })).earned).toContain(
      'long-word',
    );
  });

  it('streaks: twenty without help, five Classic words in a row', () => {
    let records = emptyRecords();
    let earned: string[] = [];
    for (let i = 0; i < 20; i++) ({ records, earned } = recordWord(records, word({})));
    expect(earned).toContain('no-lighthouse');
    ({ records } = recordWord(records, word({ lighthouseUses: 1, waves: 1, score: 1 })));
    expect(records.withoutHelp).toBe(0);
    records = emptyRecords();
    for (let i = 0; i < 5; i++)
      ({ records, earned } = recordWord(records, word({ mode: 'classic' })));
    expect(earned).toContain('classic-at-heart');
    ({ records } = recordWord(records, word({ mode: 'classic', won: false, score: 9 })));
    expect(records.classicStreak).toBe(0);
  });

  it('a word from every deck, and ten from Computing history', () => {
    let records = emptyRecords();
    let earned: string[] = [];
    const ids = ['core', 'ocean', 'space', 'food', 'animals', 'music', 'weather', 'sports'];
    for (const deckId of ids) ({ records } = recordWord(records, word({ deckId })));
    for (let i = 0; i < 10; i++)
      ({ records, earned } = recordWord(records, word({ deckId: 'computing' })));
    expect(earned).toEqual(expect.arrayContaining(['deck-explorer', 'historian']));
  });

  it('Duel words stay out of the tide average', () => {
    const { records } = recordWord(emptyRecords(), word({ mode: 'duel', score: 9, won: false }));
    expect(records.lifetime.words).toBe(0);
  });

  it('under par needs ten words and an average under 2', () => {
    expect(recordBeach(emptyRecords(), { words: 9, total: 0 }).earned).toEqual([]);
    expect(recordBeach(emptyRecords(), { words: 10, total: 19 }).earned).toEqual(['par-golfer']);
    expect(recordBeach(emptyRecords(), { words: 10, total: 20 }).earned).toEqual([]);
  });

  it('runs, duels and the first Daily of each day', () => {
    expect(recordRun(emptyRecords(), 10, true).earned).toEqual(['tide-runner']);
    expect(recordDuel(emptyRecords()).earned).toEqual(['duelist']);
    let records = emptyRecords();
    const first = recordDaily(records, '2026-10-05', { waves: 2 });
    expect(first.first).toBe(true);
    records = first.records;
    expect(recordDaily(records, '2026-10-05', { waves: 0 }).first).toBe(false);
    for (let day = 6; day <= 11; day++) {
      const update = recordDaily(records, `2026-10-${String(day).padStart(2, '0')}`, { waves: 1 });
      records = update.records;
      if (day === 11) expect(update.earned).toEqual(['daily-regular']);
    }
  });
});
