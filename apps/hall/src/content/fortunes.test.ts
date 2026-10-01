import { describe, expect, it } from 'vitest';
import { addDays } from '@usr-games/kit';
import { didYouKnowFor, FACTS, FORTUNES, fortuneFor } from './fortunes';

describe('fortunes', () => {
  it('ships sixty short, distinct lines', () => {
    expect(FORTUNES).toHaveLength(60);
    expect(new Set(FORTUNES).size).toBe(60);
    for (const line of FORTUNES) expect(line.length).toBeLessThanOrEqual(110);
  });

  it('is stable for a day and never repeats on consecutive days', () => {
    expect(fortuneFor('2026-09-28')).toBe(fortuneFor('2026-09-28'));
    let previous = fortuneFor('2025-12-01');
    for (let i = 1; i < 400; i++) {
      const today = fortuneFor(addDays('2025-12-01', i));
      expect(today).not.toBe(previous);
      previous = today;
    }
  });

  it('shows every line once per sixty-day cycle', () => {
    const cycle = Array.from({ length: 60 }, (_, i) => fortuneFor(addDays('2026-01-01', i)));
    expect(new Set(cycle).size).toBe(60);
  });
});

describe('did you know', () => {
  it('keeps only facts and every entry is a real fortune line', () => {
    expect(FACTS.length).toBeGreaterThanOrEqual(35);
    for (const fact of FACTS) expect(FORTUNES).toContain(fact);
    expect(FACTS).not.toContain('Blink, stretch, sip some water. The processes will wait.');
    expect(FACTS).toContain(didYouKnowFor('2026-10-01'));
  });
});
