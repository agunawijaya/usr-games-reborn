import { describe, expect, it } from 'vitest';
import { buildAdvice, landingHeat, newChronicle, record, tradeMeter, turningPoint } from './coach';
import { apply } from './game';
import { simulate } from './simulate';
import { own, table } from './testing';

describe('the coach', () => {
  it('shows the hottest spaces at full heat and the coldest well below', () => {
    const heat = landingHeat(table());
    expect(Math.max(...heat)).toBeGreaterThanOrEqual(1);
    expect(heat[24]!).toBeGreaterThan(heat[37]!);
  });

  it('says how many rounds a building takes to pay for itself', () => {
    const state = table();
    own(state, 0, 16, 18, 19);
    state.deeds[16]!.level = 2;
    state.deeds[18]!.level = 2;
    state.deeds[19]!.level = 2;
    const advice = buildAdvice(state, 0, 16)!;
    expect(advice.level).toBe(3);
    expect(advice.text).toMatch(/^A third storey here pays back in about \d+ rounds?\.$/);
    expect(advice.rounds).toBeGreaterThan(1);
    expect(buildAdvice(state, 1, 16)).toBeNull();
  });

  it('asks for the whole district before advising on a lone lot', () => {
    const state = table();
    own(state, 0, 16);
    expect(buildAdvice(state, 0, 16)!.text).toBe('Own the whole district before building here.');
  });

  it('reads a fair swap as even and a giveaway as leaning one way', () => {
    const state = table();
    own(state, 0, 6, 8, 11);
    own(state, 1, 9, 13, 14);
    const swap = tradeMeter(state, {
      from: 0,
      to: 1,
      give: { deeds: [11], coins: 0, cards: 0 },
      get: { deeds: [9], coins: 0, cards: 0 },
    });
    expect(swap.offerer).toBeGreaterThan(0);
    expect(swap.receiver).toBeGreaterThan(0);
    const gift = tradeMeter(state, {
      from: 0,
      to: 1,
      give: { deeds: [], coins: 500, cards: 0 },
      get: { deeds: [], coins: 0, cards: 0 },
    });
    expect(gift.balance).toBeLessThan(-0.5);
    expect(gift.text).toBe('You lose by this one.');
  });

  it('records the moments of a trade that finishes a district', () => {
    const state = table(3);
    own(state, 0, 6, 8);
    own(state, 1, 9);
    const story = newChronicle(state);
    apply(state, {
      type: 'propose',
      offer: {
        from: 0,
        to: 1,
        give: { deeds: [], coins: 400, cards: 0 },
        get: { deeds: [9], coins: 0, cards: 0 },
      },
    });
    record(story, state, apply(state, { type: 'answer', accept: true }));
    expect(story.moments).toEqual([
      { turn: 0, seat: 0, kind: 'trade', partner: 1 },
      { turn: 0, seat: 0, kind: 'district', group: 1 },
    ]);
    state.winner = 0;
    story.worth.push([5000, 100, 100]);
    expect(turningPoint(story, state)!.text).toBe('The trade on turn 1 decided the game.');
  });

  it('names the turning point of every finished game in one sentence', () => {
    for (let game = 0; game < 20; game++) {
      const result = simulate({
        seed: `story-${game}`,
        seats: ['builder', 'steady', 'dealmaker'].map((p) => ({
          personality: p as 'builder',
          difficulty: 'hard' as const,
        })),
      });
      const point = turningPoint(result.chronicle, result.state);
      expect(point).not.toBeNull();
      expect(point!.text).toMatch(/^[^.]+(decided the game|kept it|turned on turn \d+)\.$/);
      expect(result.chronicle.worth.length).toBeGreaterThan(result.state.turns / 2);
    }
  });
});
