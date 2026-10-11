import { describe, expect, it } from 'vitest';
import type { EventResult, EventSpec } from '../engine/events';
import { addWord, dropWord } from '../ui/screens/spell';
import {
  emptyRecords,
  ghostGap,
  noteChapter,
  noteDaily,
  noteEvent,
  noteForgiven,
  sanitizeRecords,
  totalStars,
} from './records';
import { defaultPrefs, sanitizePrefs } from './saves';

function result(spec: EventSpec, ms: number, score = 1000): EventResult {
  return { spec, tempo: 'rush', score, items: 20, clean: 20, rights: 20, wrongs: 0, hints: 0, ms };
}

const SUMS: EventSpec = { mode: 'sums', level: 'times-10' };
const splits = (ms: number) => Array.from({ length: 20 }, () => ms);

describe('records', () => {
  it('keeps the fastest block and its pace for the ghost, and calls a faster one a best', () => {
    let noted = noteEvent(
      emptyRecords(),
      result(SUMS, 40_000),
      { mode: 'sums', splits: splits(2000), firstTries: 19 },
      'sums:times-10',
    );
    expect(noted.personalBest).toBe(false);
    expect(noted.records.sums['sums:times-10']).toMatchObject({ ms: 40_000 });
    expect(noted.records.sums['sums:times-10']!.pace[1]).toBe(4000);
    noted = noteEvent(
      noted.records,
      result(SUMS, 30_000),
      { mode: 'sums', splits: splits(1500), firstTries: 20 },
      'sums:times-10',
    );
    expect(noted.personalBest).toBe(true);
    expect(noted.earned).toEqual(['perfect-block', 'lightning']);
    expect(noted.records.counters.sumsSolved).toBe(40);
  });

  it('does not count a Calm block as a time', () => {
    const calm = { ...result(SUMS, 10_000), tempo: 'calm' as const };
    const noted = noteEvent(
      emptyRecords(),
      calm,
      { mode: 'sums', splits: splits(500), firstTries: 20 },
      'sums:times-10',
    );
    expect(noted.records.sums['sums:times-10']!.ms).toBeNull();
    expect(noted.earned).toEqual(['perfect-block']);
  });

  it('measures how far the ghost leads', () => {
    const pace = [1000, 2000, 3000, 4000];
    expect(ghostGap(pace, 2500, 2)).toBeCloseTo(0.5);
    expect(ghostGap(pace, 1000, 3)).toBeCloseTo(-2);
    expect(ghostGap([], 1000, 0)).toBeNull();
  });

  it('earns the split, sieve and spell packages', () => {
    const split = noteEvent(
      emptyRecords(),
      result({ mode: 'split', level: 'six-digits' }, 9000),
      { mode: 'split', starts: [123_456] },
      'split:six-digits',
    );
    expect(split.earned).toEqual(['first-split', 'big-split']);
    const wanted = noteEvent(
      emptyRecords(),
      result({ mode: 'split', level: 'most-wanted' }, 9000),
      { mode: 'split', starts: [99_999_999] },
      'split:most-wanted',
    );
    expect(wanted.earned).toContain('most-wanted');
    const sieve = noteEvent(
      emptyRecords(),
      result({ mode: 'sieve', level: 'hundred' }, 9000),
      { mode: 'sieve', wrongClicks: 0 },
      'sieve:hundred',
    );
    expect(sieve.earned).toEqual(['clean-sweep']);
    const spell = noteEvent(
      emptyRecords(),
      result({ mode: 'spell', level: 'millions' }, 9000),
      {
        mode: 'spell',
        items: [
          { numeral: '123456789', misses: 1 },
          { numeral: '1.5', misses: 0 },
        ],
      },
      'spell:millions',
    );
    expect(spell.earned).toEqual(['wordsmith']);
    expect(spell.records.counters.fractionsClean).toBe(1);
  });

  it('scores only the first Daily of a day, and counts the regular', () => {
    let records = emptyRecords();
    for (let day = 1; day <= 7; day++) {
      const noted = noteDaily(records, `2026-10-0${day}`, { score: 100 * day, line: 'x' });
      records = noted.records;
      expect(noted.earned).toEqual(day === 7 ? ['daily-regular'] : []);
    }
    expect(noteDaily(records, '2026-10-07', { score: 9999, line: 'x' }).records).toBe(records);
    expect(records.daily.best?.score).toBe(700);
  });

  it('keeps the best stars per tempo and earns calm-and-collected', () => {
    let noted = noteChapter(emptyRecords(), 'warm-up', 2, 'rush', 500);
    noted = noteChapter(noted.records, 'warm-up', 3, 'calm', 400);
    expect(noted.earned).toEqual(['calm-and-collected']);
    expect(noted.records.chapters['warm-up']).toEqual({ rush: 2, calm: 3, score: 500 });
    expect(totalStars(noted.records)).toBe(3);
  });

  it('counts forgiven numbers', () => {
    expect(noteForgiven(emptyRecords(), 2).records.counters.forgiven).toBe(2);
    expect(noteForgiven(emptyRecords(), 0).earned).toEqual([]);
  });

  it('repairs damaged saves instead of dropping them', () => {
    expect(sanitizeRecords(null)).toEqual(emptyRecords());
    expect(sanitizeRecords({ daily: { played: 3 }, counters: { sumsSolved: 9 } })).toMatchObject({
      daily: { played: 3, days: {} },
      counters: { sumsSolved: 9, numbersSplit: 0 },
    });
    expect(
      sanitizePrefs({ theme: 'neon', tempo: 'calm', custom: { ops: 'q', range: 5000 } }),
    ).toEqual({
      ...defaultPrefs(),
      tempo: 'calm',
      custom: { ops: '+-', range: 999 },
    });
  });
});

describe('word tiles', () => {
  it('joins tens and units with a hyphen and takes words back off', () => {
    let answer = addWord('', 'four');
    answer = addWord(answer, 'thousand');
    answer = addWord(addWord(answer, 'twenty'), 'one');
    expect(answer).toBe('four thousand twenty-one');
    expect(dropWord(answer)).toBe('four thousand twenty');
    expect(dropWord('four')).toBe('');
  });
});
