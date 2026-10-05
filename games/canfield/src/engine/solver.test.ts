import { addDays } from '@usr-games/kit';
import { describe, expect, it } from 'vitest';
import { composeDeal } from './compose';
import { dailyDeal, shuffledDeal, winnableDeal } from './deals';
import { applyMove, type Layout, type Move, openDeal } from './rules';
import { solve } from './solver';

/** The solver against the real rules: every line it claims must win when replayed. */

function replay(layout: Layout, line: readonly Move[]): Layout {
  let state = layout;
  for (const move of line) {
    const step = applyMove(state, move);
    if (!step) throw new Error(`the solver's move ${JSON.stringify(move)} is illegal`);
    state = step.layout;
  }
  return state;
}

// No move is ever possible: kings in the tableau, no queen or base card ever shows, and the
// one card that could go home (8♥) sits where dealing by threes never shows it.
const STUCK = composeDeal({
  stock: ['3c', '4c', '5c', '6c', '9c', '10c', 'jc', '3d', '4d', '5d', '6d', '9d', '2c'],
  base: '7h',
  tableau: ['ks', 'kc', 'kh', 'kd'],
  hand: [
    ...['qs', 'qc', '2h'],
    ...['qh', 'qd', '3h'],
    ...['7s', '7c', '4h'],
    ...['7d', '8h', '5h'],
    ...['8s', '8c', '6h'],
    ...['8d', 'as', '9h'],
    ...['ac', 'ah', '10h'],
    ...['ad', '2s', 'jh'],
    ...['2d', '3s', '4s'],
    ...['5s', '6s', '9s'],
    ...['10s', 'js', '10d'],
    'jd',
  ],
});

// Everything plays straight up: base ace, each suit's next cards waiting in reach.
const EASY = composeDeal({
  stock: ['kc', 'qc', 'jc', '10c', '9c', '8c', '7c', '6c', '5c', '4c', '3c', '2c', 'ac'],
  base: 'ah',
  tableau: ['2h', '3h', '4h', '5h'],
});

describe('solver', () => {
  it('proves a deal with no move at all unwinnable', () => {
    const verdict = solve(openDeal(STUCK, 'standard').layout, { nodeBudget: 10_000 });
    expect(verdict.result).toBe('unwinnable');
  });

  it('finds the line through an easy deal, and the line wins', () => {
    const layout = openDeal(EASY, 'standard').layout;
    const verdict = solve(layout, { nodeBudget: 10_000 });
    expect(verdict.result).toBe('winnable');
    if (verdict.result === 'winnable') expect(replay(layout, verdict.line).outcome).toBe('won');
  });

  it('wins every random deal it calls winnable, in both rule sets', () => {
    let winnable = 0;
    for (const rules of ['standard', 'relaxed'] as const) {
      for (let i = 0; i < 24; i++) {
        const layout = openDeal(shuffledDeal(`solver-test:${i}`), rules).layout;
        const verdict = solve(layout, { nodeBudget: 20_000 });
        if (verdict.result !== 'winnable') continue;
        winnable++;
        expect(replay(layout, verdict.line).outcome).toBe('won');
      }
    }
    expect(winnable).toBeGreaterThan(10);
  });

  it('wins the easy deal in a single pass when asked to', () => {
    const layout = openDeal(EASY, 'standard').layout;
    const verdict = solve(layout, { nodeBudget: 10_000, maxRuns: 1 });
    expect(verdict.result).toBe('winnable');
    if (verdict.result === 'winnable') {
      const end = replay(layout, verdict.line);
      expect(end.outcome).toBe('won');
      expect(end.run).toBe(1);
    }
  });

  it('respects a limit on runs through the hand', () => {
    for (let i = 0; i < 20; i++) {
      const layout = openDeal(shuffledDeal(`one-pass:${i}`), 'standard').layout;
      const verdict = solve(layout, { nodeBudget: 20_000, maxRuns: 1 });
      if (verdict.result !== 'winnable') continue;
      expect(replay(layout, verdict.line).run).toBe(1);
    }
  });

  it('never claims more for Standard than for Relaxed', () => {
    for (let i = 0; i < 10; i++) {
      const deal = shuffledDeal(`compare:${i}`);
      const standard = solve(openDeal(deal, 'standard').layout, { nodeBudget: 20_000 });
      const relaxed = solve(openDeal(deal, 'relaxed').layout, { nodeBudget: 60_000 });
      if (standard.result === 'winnable') expect(relaxed.result).not.toBe('unwinnable');
      if (relaxed.result === 'unwinnable') expect(standard.result).not.toBe('winnable');
    }
  }, 30_000);

  it('solves from the middle of a game too', () => {
    const layout = openDeal(EASY, 'standard').layout;
    const verdict = solve(layout, { nodeBudget: 10_000 });
    if (verdict.result !== 'winnable') throw new Error('easy deal not solved');
    const midway = replay(layout, verdict.line.slice(0, 10));
    const again = solve(midway, { nodeBudget: 10_000 });
    expect(again.result).toBe('winnable');
  });
});

describe('deals', () => {
  it('gives the same shuffle for the same seed', () => {
    expect(shuffledDeal('x')).toEqual(shuffledDeal('x'));
    expect(shuffledDeal('x')).not.toEqual(shuffledDeal('y'));
  });

  it('makes every Daily Deal for a fortnight proven winnable, the same each time', () => {
    let day = '2026-10-01';
    for (let i = 0; i < 14; i++, day = addDays(day, 1)) {
      const daily = dailyDeal(day);
      expect(daily.verdict.result).toBe('winnable');
      if (i === 0) expect(dailyDeal(day).deal).toEqual(daily.deal);
    }
  }, 60_000);

  it('finds winnable deals for Relaxed too', () => {
    const found = winnableDeal('relaxed-test', 'relaxed');
    expect(found.verdict.result).toBe('winnable');
  });
});
