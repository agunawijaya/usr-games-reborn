import { describe, expect, it } from 'vitest';
import {
  checkSecret,
  duelLeader,
  duelRound,
  duelTotals,
  isDuelOver,
  nextSetter,
  recordTurn,
  startDuel,
} from './duel';
import { guess, type Round } from './round';
import { finishRunWord, runRound, startRun, type TideRun } from './tide-run';

function playOut(round: Round, letters: string): Round {
  let current = round;
  for (const letter of letters) {
    const outcome = guess(current, letter);
    if (outcome.kind === 'hit' || outcome.kind === 'miss') current = outcome.round;
  }
  return current;
}

const RUN_WORDS = [
  'anchor',
  'breeze',
  'coral',
  'dune',
  'eddy',
  'ferry',
  'gull',
  'harbor',
  'inlet',
  'jetty',
];

describe('a Tide run', () => {
  it('carries the castle from word to word', () => {
    let run: TideRun = startRun(RUN_WORDS);
    run = finishRunWord(run, playOut(runRound(run), 'zxanchor'));
    expect(run.standing).toBe(5);
    expect(run.found).toBe(1);
    expect(runRound(run).wavesAllowed).toBe(5);
  });

  it('repairs a section after a clean word, never above seven', () => {
    let run = startRun(RUN_WORDS);
    run = finishRunWord(run, playOut(runRound(run), 'anchor'));
    expect(run.standing).toBe(7);
    expect(run.repairs).toBe(0);
    run = finishRunWord(run, playOut(runRound(run), 'qbreeze'));
    run = finishRunWord(run, playOut(runRound(run), 'coral'));
    expect(run.standing).toBe(7);
    expect(run.repairs).toBe(1);
    expect(run.cleanWords).toBe(2);
  });

  it('ends when the castle falls', () => {
    let run = startRun(RUN_WORDS);
    run = finishRunWord(run, playOut(runRound(run), 'bdfgijanchor'));
    expect(run.standing).toBe(1);
    const last = playOut(runRound(run), 'q');
    expect(last.status).toBe('lost');
    run = finishRunWord(run, last);
    expect(run.status).toBe('castle-fell');
    expect(run.found).toBe(1);
  });

  it('is complete after ten words', () => {
    let run = startRun(RUN_WORDS);
    for (const word of RUN_WORDS) run = finishRunWord(run, playOut(runRound(run), word));
    expect(run.status).toBe('complete');
    expect(run.found).toBe(10);
  });
});

describe('a Duel', () => {
  const screen = (word: string) => word === 'noose';

  it('checks the secret word', () => {
    expect(checkSecret('  Lantern ', screen)).toEqual({ ok: true, word: 'lantern' });
    expect(checkSecret('ab', screen)).toEqual({ ok: false, problem: 'too-short' });
    expect(checkSecret('sand castle', screen)).toEqual({ ok: false, problem: 'not-letters' });
    expect(checkSecret('noose', screen)).toEqual({ ok: false, problem: 'not-for-the-beach' });
  });

  it('alternates setters and adds up waves golf-style', () => {
    let duel = startDuel(['Ada', 'Ken'], 1);
    expect(nextSetter(duel)).toBe(0);
    duel = recordTurn(duel, playOut(duelRound('pebble'), 'xpebl'));
    expect(nextSetter(duel)).toBe(1);
    duel = recordTurn(duel, playOut(duelRound('kelp'), 'abcdfghij'));
    expect(isDuelOver(duel)).toBe(true);
    expect(duelTotals(duel)).toEqual([9, 1]);
    expect(duelLeader(duel)).toBe(1);
  });
});
