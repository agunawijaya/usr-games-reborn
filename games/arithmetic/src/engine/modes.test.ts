import { createRng } from '@usr-games/kit';
import { describe, expect, it } from 'vitest';
import { collect, emptyAlbum, specialsOf, summarize, twinPairs } from './album';
import { CHAPTERS, chapterPar, chapterStars, starCount } from './chapters';
import { dailyPlan, shareLine } from './daily';
import { type EventResult, eventCount, eventPar } from './events';
import { factorize, isPrime } from './factor';
import { hintFor } from './hints';
import { emptyBook } from './penalties';
import { SPELL_LEVELS, SPLIT_LEVELS, SUMS_LEVELS, spellItems, splitNumbers } from './levels';
import { declarePrime, splitHint, startSplit, trySplit } from './split';
import {
  BLOCK_SIZE,
  blockCard,
  checkAnswer,
  HINT_AFTER,
  nextProblem,
  type Problem,
  scorePercent,
  startBlock,
  submitAnswer,
} from './sums';

const randomOf = (seed: string) => {
  const rng = createRng(seed);
  return (n: number) => rng.int(0, n - 1);
};

describe('a block of Quick Sums', () => {
  it('stays on a problem until it is answered right, then moves on', () => {
    const random = randomOf('block');
    let state = startBlock(emptyBook(), { ops: 'x', range: 10 }, 'rush', random);
    const first = state.problem;
    state = submitAnswer(state, String(first.answer + 1), 3000, random).state;
    expect(state.problem).toBe(first);
    expect(state.wrongs).toBe(1);
    state = submitAnswer(state, 'seven', 3000, random).state;
    expect(state.wrongs).toBe(1);
    state = submitAnswer(state, String(first.answer), 3000, random).state;
    expect(state.solved).toBe(1);
    expect(state.firstTries).toBe(0);
  });

  it('raises the picture hint on the third miss', () => {
    const random = randomOf('hint');
    let state = startBlock(emptyBook(), { ops: '+', range: 10 }, 'calm', random);
    const wrong = String(state.problem.answer + 2);
    const raised: boolean[] = [];
    for (let i = 0; i < HINT_AFTER; i++) {
      const result = submitAnswer(state, wrong, 1000, random);
      raised.push(result.hintNow);
      state = result.state;
    }
    expect(raised).toEqual([false, false, true]);
    expect(state.hinted).toBe(1);
  });

  it('ends after twenty and prints the original block card', () => {
    const random = randomOf('card');
    let state = startBlock(emptyBook(), { ops: '+-', range: 10 }, 'rush', random);
    state = submitAnswer(state, '999', 1000, random).state;
    for (let i = 0; i < BLOCK_SIZE; i++) {
      state = submitAnswer(state, String(state.problem.answer), 1500, random).state;
    }
    expect(state.finished).toBe(true);
    const card = blockCard(state);
    expect(card).toMatchObject({ rights: 20, wrongs: 1, percent: 95, firstTries: 19 });
    expect(card.perProblemMs).toBe(1500);
    expect(scorePercent(20, 3)).toBe(86);
  });

  it('takes a remainder answer as "7 r 5" or "7 5"', () => {
    const problem: Problem = {
      op: '/',
      left: 47,
      right: 6,
      answer: 7,
      remainder: 5,
      askRemainder: true,
    };
    expect(checkAnswer(problem, '7 r 5')).toBe('right');
    expect(checkAnswer(problem, '7 5')).toBe('right');
    expect(checkAnswer(problem, '7r5')).toBe('right');
    expect(checkAnswer(problem, '7')).toBe('not-a-number');
    expect(checkAnswer(problem, '7 r 4')).toBe('wrong');
  });

  it('never puts the answer in a hint', () => {
    const random = randomOf('hints');
    for (const level of SUMS_LEVELS) {
      for (let i = 0; i < 300; i++) {
        const { problem } = nextProblem(emptyBook(), level, random);
        const hint = hintFor(problem);
        const text = [hint.caption, ...(hint.kind === 'steps' ? hint.steps : [])].join(' ');
        for (const match of text.matchAll(/=\s*(\d+)/g)) {
          expect(Number(match[1])).not.toBe(problem.answer);
        }
      }
    }
  });

  it('draws a 7 × 8 hint as seven rows of eight dots', () => {
    const hint = hintFor({
      op: 'x',
      left: 7,
      right: 8,
      answer: 56,
      remainder: 0,
      askRemainder: false,
    });
    expect(hint).toMatchObject({ kind: 'array', rows: 7, columns: 8 });
    expect(hint.caption).toBe('7 × 8 = 7 × 4 × 2');
  });
});

describe('Split', () => {
  it('splits 360 one prime at a time', () => {
    let state = startSplit(360);
    const moves = [2, 4, 7, 2, 2, 3, 3, 5].map((value) => {
      const result = trySplit(state, value);
      state = result.state;
      return result.move.kind;
    });
    expect(moves).toEqual([
      'split',
      'not-prime',
      'no-divide',
      'split',
      'split',
      'split',
      'split',
      'split',
    ]);
    expect(state).toMatchObject({ remaining: 1, done: true, bounces: 2 });
    expect(state.found).toEqual([2, 2, 2, 3, 3, 5]);
  });

  it('lets the player declare a large remainder prime', () => {
    let state = trySplit(startSplit(2 * 3 * 7919), 2).state;
    state = trySplit(state, 3).state;
    expect(declarePrime(state).move).toEqual({ kind: 'split', prime: 7919, last: true });
    expect(declarePrime(startSplit(91)).move).toEqual({ kind: 'not-prime', value: 91 });
  });

  it('builds every rung inside its bounds, from its own primes, never prime', () => {
    for (const level of SPLIT_LEVELS) {
      const rng = createRng(`split:${level.id}`);
      for (let i = 0; i < 40; i++) {
        for (const value of splitNumbers(level, rng)) {
          expect(value).toBeGreaterThanOrEqual(level.min);
          expect(value).toBeLessThanOrEqual(level.max);
          expect(isPrime(value)).toBe(false);
          const outside = factorize(value).filter((p) => !level.pool.includes(p));
          expect(outside.length).toBeLessThanOrEqual(level.boss ? 1 : 0);
        }
      }
    }
  });
});

describe('Spell It rounds', () => {
  it('alternates spelling and reading, starting with spelling', () => {
    for (const level of SPELL_LEVELS) {
      const items = spellItems(level, createRng(`spell:${level.id}`));
      expect(items.map((item) => item.direction)).toEqual([
        'spell',
        'read',
        'spell',
        'read',
        'spell',
      ]);
      expect(new Set(items.map((item) => item.numeral)).size).toBe(items.length);
    }
  });

  it('gives fractions a non-zero last decimal', () => {
    const fractions = SPELL_LEVELS.find((level) => level.id === 'fractions')!;
    for (const item of spellItems(fractions, createRng('fractions'))) {
      expect(item.numeral).toMatch(/^\d+\.\d*[1-9]$/);
    }
  });
});

describe('the campaign and the Daily', () => {
  it('has twelve chapters, each with a par for every event', () => {
    expect(CHAPTERS).toHaveLength(12);
    CHAPTERS.forEach((chapter, i) => {
      expect(chapter.number).toBe(i + 1);
      for (const spec of chapter.events) expect(eventPar(spec)).toBeGreaterThan(0);
      expect(chapterPar(chapter)).toBeGreaterThan(45);
    });
  });

  it('awards accuracy, speed and no-hint stars in Rush, a clean run in Calm', () => {
    const chapter = CHAPTERS[0]!;
    const result = (ms: number, wrongs: number, hints: number): EventResult => ({
      spec: chapter.events[0]!,
      tempo: 'rush',
      score: 0,
      items: 20,
      clean: 20 - wrongs,
      rights: 20,
      wrongs,
      hints,
      ms,
    });
    expect(starCount(chapterStars(chapter, [result(30_000, 0, 0)], 'rush'))).toBe(3);
    expect(chapterStars(chapter, [result(999_000, 1, 0)], 'rush')).toEqual({
      accurate: true,
      second: false,
      noHints: true,
    });
    expect(chapterStars(chapter, [result(999_000, 1, 0)], 'calm').second).toBe(true);
    expect(chapterStars(chapter, [result(10_000, 4, 1)], 'rush')).toEqual({
      accurate: false,
      second: true,
      noHints: false,
    });
  });

  it('plans the same Daily for everyone and shares it without a link', () => {
    const plan = dailyPlan('arithmetic:daily:2026-10-12');
    expect(plan).toEqual(dailyPlan('arithmetic:daily:2026-10-12'));
    expect(plan.events.map((spec) => spec.mode)).toEqual(['sums', 'split', 'sieve', 'spell']);
    const results: EventResult[] = plan.events.map((spec, i) => ({
      spec,
      tempo: 'rush',
      score: [1200, 900, 540, 200][i]!,
      items: eventCount(spec),
      clean: [19, 5, 1, 3][i]!,
      rights: 1,
      wrongs: 0,
      hints: 0,
      ms: [60_000, 50_000, 41_000, 30_000][i]!,
    }));
    expect(shareLine(42, results)).toBe(
      'Number Sprint #42 · 2,840 · Sums 19/20 · Split 5/5 · Sieve 0:41 · Spell ✓',
    );
  });
});

describe('the prime album', () => {
  it('collects each prime once and finds the specials', () => {
    let { album, added } = collect(emptyAlbum(), [5, 7, 7, 9, 101, 1009]);
    expect(added).toEqual([5, 7, 101, 1009]);
    ({ album, added } = collect(album, [7, 3]));
    expect(added).toEqual([3]);
    expect(twinPairs(album)).toEqual([3, 5]);
    expect(specialsOf(album, 101)).toEqual(['palindrome']);
    expect(specialsOf(album, 1009)).toEqual(['big']);
    expect(summarize(album)).toMatchObject({
      count: 5,
      twins: 2,
      big: 1,
      palindromes: 1,
      largest: 1009,
    });
  });
});

describe('split hints', () => {
  it('names the divisibility rule that finds the smallest prime', () => {
    expect(splitHint(180)).toBe('It is even, so 2 goes in.');
    expect(splitHint(45)).toBe('Its digits add up to 9, a multiple of 3, so 3 goes in.');
    expect(splitHint(35)).toBe('It ends in 5, so 5 goes in.');
    expect(splitHint(121)).toMatch(/multiple of 11, so 11 goes in/);
    expect(splitHint(91)).toBe('2, 3 and 5 do not go in. Try 7.');
    expect(splitHint(7919)).toBe('No prime up to 88 goes into 7,919, so it is prime itself.');
  });
});
