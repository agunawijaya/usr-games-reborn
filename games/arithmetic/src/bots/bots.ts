import { createRng, type Rng } from '@usr-games/kit';
import {
  type EventResult,
  type EventSpec,
  eventCount,
  eventPar,
  sieveLevel,
  sievePoints,
  spellLevel,
  spellPoints,
  splitLevel,
  splitPoints,
  sumsLevel,
} from '../engine/events';
import { factorize, isPrime } from '../engine/factor';
import { spellItems, splitNumbers } from '../engine/levels';
import { emptyBook, type PenaltyBook } from '../engine/penalties';
import { choose, newBoard, parChoices } from '../engine/sieve-board';
import { declarePrime, startSplit, trySplit } from '../engine/split';
import { type Problem, type Tempo, startBlock, submitAnswer } from '../engine/sums';
import { wordTokens, spell } from '../engine/words';

/**
 * Simulated players for balance: how long they take and how often they slip, by skill. They
 * play through the real engines on simulated time, so the stars and pars are measured against
 * the rules the player meets. The Hall's attract loop uses the ace.
 */

export interface Skill {
  readonly name: 'novice' | 'steady' | 'ace';
  /** Milliseconds for the easiest sum, and per unit of difficulty on top. */
  readonly sumBase: number;
  readonly sumPerDifficulty: number;
  /** Chance of a wrong answer on a sum of difficulty 1; grows with difficulty. */
  readonly slip: number;
  /** Milliseconds to try one prime on a number, per digit of the number. */
  readonly probePerDigit: number;
  /** Chance of trying a prime that does not divide. */
  readonly probeSlip: number;
  /** Milliseconds per sieve choice, and chance of choosing a composite. */
  readonly sieveChoice: number;
  readonly sieveSlip: number;
  /** Chance of an extra choice that sweeps nothing new. */
  readonly sieveWaste: number;
  /** Milliseconds per word spelt or read. */
  readonly perWord: number;
  readonly wordSlip: number;
}

export const SKILLS: Record<Skill['name'], Skill> = {
  novice: {
    name: 'novice',
    sumBase: 3800,
    sumPerDifficulty: 2200,
    slip: 0.08,
    probePerDigit: 2200,
    probeSlip: 0.22,
    sieveChoice: 5500,
    sieveSlip: 0.12,
    sieveWaste: 0.25,
    perWord: 3200,
    wordSlip: 0.18,
  },
  steady: {
    name: 'steady',
    sumBase: 2000,
    sumPerDifficulty: 1100,
    slip: 0.035,
    probePerDigit: 1200,
    probeSlip: 0.1,
    sieveChoice: 3400,
    sieveSlip: 0.04,
    sieveWaste: 0.12,
    perWord: 1900,
    wordSlip: 0.06,
  },
  ace: {
    name: 'ace',
    sumBase: 1000,
    sumPerDifficulty: 450,
    slip: 0.01,
    probePerDigit: 600,
    probeSlip: 0.03,
    sieveChoice: 1900,
    sieveSlip: 0,
    sieveWaste: 0.02,
    perWord: 1000,
    wordSlip: 0.015,
  },
};

/** How hard a sum feels: bigger numbers and harder signs take longer and slip more. */
export function sumDifficulty(problem: Problem): number {
  const size = Math.max(problem.left, problem.right, problem.answer);
  const sign = { '+': 0, '-': 0.4, x: 0.8, '/': 1.3 }[problem.op];
  const remainder = problem.askRemainder ? 0.9 : 0;
  return 1 + sign + remainder + Math.max(0, Math.log10(Math.max(size, 1)) - 1) * 1.6;
}

function jitter(rng: Rng, ms: number): number {
  return Math.round(ms * rng.float(0.75, 1.3));
}

function playSums(
  spec: EventSpec & { mode: 'sums' },
  skill: Skill,
  tempo: Tempo,
  rng: Rng,
  book: PenaltyBook,
) {
  const random = (n: number) => rng.int(0, n - 1);
  let state = startBlock(book, sumsLevel(spec.level), tempo, random);
  let hints = 0;
  while (!state.finished) {
    const difficulty = sumDifficulty(state.problem);
    const ms = jitter(rng, skill.sumBase + skill.sumPerDifficulty * (difficulty - 1));
    // After a slip players look harder, so a second slip on the same problem is rarer.
    const slip = skill.slip * difficulty * (state.misses > 0 ? 0.5 : 1);
    const wrong = rng.chance(Math.min(0.9, slip));
    const answer = wrong
      ? String(state.problem.answer + rng.pick([1, -1, 10, 2]))
      : answerOf(state.problem);
    const result = submitAnswer(state, answer, ms * (state.misses + 1), random);
    if (result.hintNow) hints++;
    state = result.state;
  }
  const ms = state.splits.reduce((sum, value) => sum + value, 0);
  const result: EventResult = {
    spec,
    tempo,
    score: state.score,
    items: state.solved,
    clean: state.firstTries,
    rights: state.rights,
    wrongs: state.wrongs,
    hints,
    ms,
  };
  return { result, book: state.book };
}

function answerOf(problem: Problem): string {
  return problem.askRemainder ? `${problem.answer} r ${problem.remainder}` : String(problem.answer);
}

function playSplit(
  spec: EventSpec & { mode: 'split' },
  skill: Skill,
  tempo: Tempo,
  rng: Rng,
): EventResult {
  const level = splitLevel(spec.level);
  const numbers = splitNumbers({ ...level, count: eventCount(spec) }, rng);
  const par = eventPar(spec) / numbers.length;
  let score = 0;
  let clean = 0;
  let rights = 0;
  let wrongs = 0;
  let totalMs = 0;
  for (const start of numbers) {
    let state = startSplit(start);
    let ms = 0;
    for (let guard = 0; guard < 200 && !state.done; guard++) {
      const digits = String(state.remaining).length;
      ms += jitter(rng, skill.probePerDigit * digits);
      const smallest = factorize(state.remaining)[0]!;
      let move;
      if (isPrime(state.remaining) && state.remaining > 50) {
        move = declarePrime(state);
      } else if (rng.chance(skill.probeSlip)) {
        const wrong = level.pool.find((p) => state.remaining % p !== 0) ?? 4;
        move = trySplit(state, wrong);
      } else {
        move = trySplit(state, smallest);
      }
      state = move.state;
      if (move.move.kind === 'split') rights++;
      else wrongs++;
    }
    if (state.bounces === 0) clean++;
    score += splitPoints(state.bounces, ms, par, tempo);
    totalMs += ms + (tempo === 'rush' ? 3000 * state.bounces : 0);
  }
  return {
    spec,
    tempo,
    score,
    items: numbers.length,
    clean,
    rights,
    wrongs,
    hints: 0,
    ms: totalMs,
  };
}

function playSieve(
  spec: EventSpec & { mode: 'sieve' },
  skill: Skill,
  tempo: Tempo,
  rng: Rng,
): EventResult {
  const setup = sieveLevel(spec.level);
  let board = newBoard(setup);
  const plan = parChoices(setup);
  let ms = 0;
  for (const prime of plan) {
    if (rng.chance(skill.sieveSlip)) {
      const composite = [9, 15, 21, 25, 27, 33, 35, 39, 49].find(
        (n) => n >= setup.first && n <= setup.last,
      );
      if (composite !== undefined) {
        board = choose(board, composite).board;
        ms += jitter(rng, skill.sieveChoice) + (tempo === 'rush' ? 3000 : 0);
      }
    }
    if (rng.chance(skill.sieveWaste)) {
      const idle = [...board.strip, 41, 43, 47, 53].find(
        (p) => !board.chosen.includes(p) && !plan.includes(p),
      );
      if (idle !== undefined) {
        board = choose(board, idle).board;
        ms += jitter(rng, skill.sieveChoice);
      }
    }
    board = choose(board, prime).board;
    ms += jitter(rng, skill.sieveChoice);
  }
  const par = eventPar(spec);
  return {
    spec,
    tempo,
    score: sievePoints(board.clicks, plan.length, board.wrongClicks, ms, par, tempo),
    items: 1,
    clean: board.wrongClicks === 0 ? 1 : 0,
    rights: board.clicks - board.wrongClicks,
    wrongs: board.wrongClicks,
    hints: 0,
    ms,
    clicks: board.clicks,
    parClicks: plan.length,
  };
}

function playSpell(
  spec: EventSpec & { mode: 'spell' },
  skill: Skill,
  tempo: Tempo,
  rng: Rng,
): EventResult {
  const level = spellLevel(spec.level);
  const items = spellItems({ ...level, count: eventCount(spec) }, rng);
  const par = eventPar(spec) / items.length;
  let score = 0;
  let clean = 0;
  let wrongs = 0;
  let totalMs = 0;
  for (const item of items) {
    const words = wordTokens(spell(item.numeral)).length;
    const perTry = jitter(rng, skill.perWord * (item.direction === 'spell' ? words : words * 0.6));
    let misses = 0;
    while (rng.chance(Math.min(0.8, skill.wordSlip * Math.sqrt(words) * (misses > 0 ? 0.4 : 1))))
      misses++;
    const ms = perTry * (1 + misses * 0.5);
    if (misses === 0) clean++;
    wrongs += misses;
    score += spellPoints(misses, ms, par, tempo);
    totalMs += ms;
  }
  return {
    spec,
    tempo,
    score,
    items: items.length,
    clean,
    rights: items.length,
    wrongs,
    hints: 0,
    ms: totalMs,
  };
}

export interface PlayedEvents {
  readonly results: EventResult[];
  readonly book: PenaltyBook;
}

export function playEvents(
  events: readonly EventSpec[],
  skill: Skill,
  tempo: Tempo,
  seed: string,
  book: PenaltyBook = emptyBook(),
): PlayedEvents {
  const rng = createRng(seed);
  let current = book;
  const results = events.map((spec, i) => {
    const stream = rng.split(`event-${i}`);
    switch (spec.mode) {
      case 'sums': {
        const played = playSums(spec, skill, tempo, stream, current);
        current = played.book;
        return played.result;
      }
      case 'split':
        return playSplit(spec, skill, tempo, stream);
      case 'sieve':
        return playSieve(spec, skill, tempo, stream);
      case 'spell':
        return playSpell(spec, skill, tempo, stream);
    }
  });
  return { results, book: current };
}
