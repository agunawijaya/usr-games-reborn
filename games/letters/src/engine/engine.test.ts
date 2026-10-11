import { beforeAll, describe, expect, it } from 'vitest';
import { loadDictionary } from '../dictionary/load';
import { CUBE_SETS } from './cube-sets';
import { dealBoard, dealDaily, MIN_WORDS } from './deal';
import {
  type Board,
  canExtend,
  type GridSize,
  isValidPath,
  neighbours,
  type Rule,
  spell,
} from './grid';
import { facesOf, rollCubes } from './roll';
import { newRound, roundCoverage, submitPath, submitTyped } from './round';
import {
  basePoints,
  comboAfterWord,
  multiplierFor,
  NO_COMBO,
  pooledAverage,
  wordScore,
} from './score';
import { pathsSpelling, solveBoard } from './solver';
import type { Trie } from './trie';
import { createRng } from '@usr-games/kit';

let trie: Trie;
beforeAll(async () => {
  trie = await loadDictionary();
});

function board(size: GridSize, letters: string): Board {
  const faces: string[] = [];
  for (let i = 0; i < letters.length; i++) {
    if (letters[i] === 'Q') faces.push('qu');
    else faces.push(letters[i]!.toLowerCase());
  }
  expect(faces).toHaveLength(size * size);
  return { size, faces };
}

/** Every path of up to `maxCubes` cubes, checked word by word: slow, obviously right. */
function referenceWords(b: Board, rule: Rule, maxCubes: number, minLetters: number): Set<string> {
  const found = new Set<string>();
  const extend = (path: number[]) => {
    const word = spell(b, path);
    if (word.length >= minLetters && trie.has(word)) found.add(word);
    if (path.length === maxCubes) return;
    for (let next = 0; next < b.faces.length; next++) {
      if (canExtend(b.size, rule, path, next)) extend([...path, next]);
    }
  };
  for (let cube = 0; cube < b.faces.length; cube++) extend([cube]);
  return found;
}

describe('the grid', () => {
  it('links each cube to the cubes touching it, diagonals included', () => {
    const links = neighbours(4);
    expect([...links[0]!].sort((a, b) => a - b)).toEqual([1, 4, 5]);
    expect(links[5]).toHaveLength(8);
    expect(links[15]).toHaveLength(3);
    for (let a = 0; a < 16; a++) for (const b of links[a]!) expect(links[b]).toContain(a);
  });

  it('keeps each rule switch to its own reuse', () => {
    expect(canExtend(4, 'classic', [0, 1], 0)).toBe(false);
    expect(canExtend(4, 'echo', [0, 1], 0)).toBe(true);
    expect(canExtend(4, 'echo', [0], 0)).toBe(false);
    expect(canExtend(4, 'mirror', [0], 0)).toBe(true);
    expect(canExtend(4, 'mirror', [0], 2)).toBe(false);
    expect(isValidPath(4, 'classic', [0, 5, 10, 15])).toBe(true);
    expect(isValidPath(4, 'classic', [0, 2])).toBe(false);
  });
});

describe('the solver', () => {
  const sample = board(4, 'SQEAOATSTBRCAMVO');

  for (const [rule, depth] of [
    ['classic', 6],
    ['echo', 5],
    ['mirror', 5],
  ] as const) {
    it(`finds exactly the words a brute-force search finds (${rule}, up to ${depth} cubes)`, () => {
      const solved = solveBoard(sample, trie, { rule, minLetters: 3 })
        .filter((w) => w.path.length <= depth)
        .map((w) => w.word);
      const reference = referenceWords(sample, rule, depth, 3);
      expect(new Set(solved)).toEqual(reference);
      expect(reference.size).toBeGreaterThan(20);
    });
  }

  it('gives every word a path that spells it under the rule', () => {
    for (const rule of ['classic', 'echo', 'mirror'] as const) {
      for (const word of solveBoard(sample, trie, { rule, minLetters: 3 })) {
        expect(spell(sample, word.path)).toBe(word.word);
        expect(isValidPath(4, rule, word.path)).toBe(true);
      }
    }
  });

  it('reads the Qu face as two letters and never a lone q', () => {
    const words = solveBoard(board(4, 'QITEUAERSNOLDPMK'), trie, {
      rule: 'classic',
      minLetters: 3,
    }).map((w) => w.word);
    expect(words).toContain('quit');
    expect(words.every((w) => !/q(?!u)/.test(w))).toBe(true);
  });

  it('holds back words below the minimum length', () => {
    const words = solveBoard(sample, trie, { rule: 'classic', minLetters: 5 });
    expect(words.every((w) => w.word.length >= 5)).toBe(true);
  });

  it('lets reuse rules find words classic rules cannot', () => {
    const classic = new Set(
      solveBoard(sample, trie, { rule: 'classic', minLetters: 3 }).map((w) => w.word),
    );
    const echo = solveBoard(sample, trie, { rule: 'echo', minLetters: 3 }).map((w) => w.word);
    const mirror = solveBoard(sample, trie, { rule: 'mirror', minLetters: 3 }).map((w) => w.word);
    expect(echo.filter((w) => !classic.has(w)).length).toBeGreaterThan(0);
    expect(mirror.length).toBeGreaterThanOrEqual(echo.length);
  });

  it('finds every path for typed letters, Qu included', () => {
    const paths = pathsSpelling(sample, 'classic', 'quota');
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) expect(spell(sample, path)).toBe('quota');
    expect(pathsSpelling(sample, 'classic', 'q').length).toBe(1);
  });
});

describe('scoring', () => {
  it('pays by length', () => {
    expect(['cat', 'cats', 'chain', 'chains', 'letters', 'lettered'].map(basePoints)).toEqual([
      1, 1, 2, 3, 5, 11,
    ]);
    expect(basePoints('at')).toBe(0);
  });

  it('builds the chain on words within four seconds and drops it after', () => {
    let combo = comboAfterWord(NO_COMBO, 10);
    expect(combo.level).toBe(0);
    combo = comboAfterWord(combo, 13);
    combo = comboAfterWord(combo, 16.5);
    combo = comboAfterWord(combo, 20);
    expect(multiplierFor(combo.level)).toBe(3);
    combo = comboAfterWord(combo, 24.1);
    expect(combo.level).toBe(0);
    expect(wordScore('letters', 1)).toBe(8);
  });

  it('pools the lifetime average as the 1988 game did', () => {
    expect(pooledAverage(30 + 10, 100 + 20)).toBeCloseTo(1 / 3);
  });
});

describe('a round', () => {
  it('judges found, repeated, unknown, short and impossible words', () => {
    const sample = board(4, 'SQEAOATSTBRCAMVO');
    const answers = solveBoard(sample, trie, { rule: 'classic', minLetters: 3 });
    let state = newRound(
      { size: 4, rule: 'classic', minLetters: 3, seconds: 180 },
      sample,
      answers,
    );
    const quota = answers.find((w) => w.word === 'quota')!;
    const first = submitPath(state, quota.path, 5);
    expect(first.verdict.kind).toBe('found');
    state = first.state;
    expect(submitTyped(state, 'QUOTA', 6).verdict.kind).toBe('again');
    expect(submitTyped(state, 'zzz', 7).verdict.kind).toBe('not-on-board');
    expect(submitTyped(state, 'ab', 7).verdict.kind).toBe('too-short');
    expect(submitPath(state, [0, 2], 8).verdict.kind).toBe('not-on-board');
    expect(roundCoverage(state)).toBeCloseTo(1 / answers.length);
  });
});

describe('cubes and deals', () => {
  it('gives every size six faces per cube and one Qu', () => {
    for (const size of [4, 5, 6] as GridSize[]) {
      const cubes = CUBE_SETS[size];
      expect(cubes).toHaveLength(size * size);
      expect(cubes.every((cube) => /^[a-z]{6}$/.test(cube))).toBe(true);
      expect(cubes.join('').split('q')).toHaveLength(2);
    }
    expect(facesOf('aeqrst')).toContain('qu');
  });

  it('rolls the same board from the same seed', () => {
    const a = rollCubes(4, createRng('same'));
    const b = rollCubes(4, createRng('same'));
    expect(a).toEqual(b);
  });

  it('deals boards rich enough to play, deterministically', () => {
    for (let i = 0; i < 20; i++) {
      const deal = dealBoard(trie, { size: 4, rule: 'classic', seed: `deal-${i}`, minLetters: 3 });
      expect(deal.words.length).toBeGreaterThanOrEqual(MIN_WORDS[4]);
    }
    const daily = dealDaily(trie, 'letters:daily:2026-10-11');
    expect(dealDaily(trie, 'letters:daily:2026-10-11')).toEqual(daily);
    expect(daily.words[0]!.word.length).toBeGreaterThanOrEqual(7);
  });
});
