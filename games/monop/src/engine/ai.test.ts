import { createRng } from '@usr-games/kit';
import { describe, expect, it } from 'vitest';
import { Rival, SIGHT, rivalry } from './ai';
import { apply, newGame, whyNot } from './game';
import type { PersonalityId } from './rivals';
import { makeRules } from './rules';
import { simulate } from './simulate';
import { DEED_SPACES, actor, holdings } from './state';
import { own, table } from './testing';
import type { Difficulty, GameState, TradeOffer } from './types';
import { outlook, tradeGains } from './valuation';

const PERSONALITIES: PersonalityId[] = ['builder', 'saver', 'collector', 'dealmaker', 'steady'];

/** A game between rivals, stopped after a number of turns. */
function midGame(
  seed: string,
  turns: number,
  difficulty: Difficulty = 'medium',
): { state: GameState; rivals: Rival[] } {
  const state = newGame({
    board: 'harbour',
    seed,
    rules: makeRules('standard', 'quick'),
    seats: [0, 1, 2].map((i) => ({
      name: `R${i}`,
      kind: 'ai' as const,
      token: 't',
      personality: PERSONALITIES[i]!,
      difficulty,
    })),
  });
  const rivals = [0, 1, 2].map((i) => new Rival(i, PERSONALITIES[i]!, difficulty, seed));
  while (state.turns < turns && state.phase.kind !== 'over')
    apply(state, rivals[actor(state)]!.decide(state).action);
  return { state, rivals };
}

describe('rivals', () => {
  it('only ever choose legal moves', () => {
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      const { state, rivals } = midGame(`legal-${difficulty}`, 0, difficulty);
      for (let step = 0; step < 3000 && state.phase.kind !== 'over'; step++) {
        const decision = rivals[actor(state)]!.decide(state);
        expect(whyNot(state, decision.action), JSON.stringify(decision.action)).toBeNull();
        apply(state, decision.action);
      }
    }
  });

  it('finish every game, Quick and Classic, under both rule sets', () => {
    for (const preset of ['standard', 'berkeley'] as const) {
      for (const mode of ['quick', 'classic'] as const) {
        for (let game = 0; game < 6; game++) {
          const result = simulate({
            seed: `finish-${preset}-${mode}-${game}`,
            rules: makeRules(preset, mode),
            seats: [0, 1, 2, 3].map((i) => ({
              personality: PERSONALITIES[(i + game) % 5]!,
              difficulty: 'medium' as const,
            })),
            maxActions: 60000,
          });
          expect(result.stalled, `${preset} ${mode} ${game}`).toBe(false);
        }
      }
    }
  });

  it('never accept a clearly bad trade at Medium or Hard', () => {
    const rng = createRng('bad-trades');
    let accepted = 0;
    for (const difficulty of ['medium', 'hard'] as const) {
      for (let sample = 0; sample < 40; sample++) {
        const { state } = midGame(`bad-${difficulty}-${sample}`, 12 + sample, difficulty);
        if (state.phase.kind !== 'turn') continue;
        const proposer = state.current;
        const responder = (proposer + 1) % 3;
        const rival = new Rival(responder, PERSONALITIES[sample % 5]!, difficulty, 'answer');
        const mine = holdings(state, proposer);
        const theirs = holdings(state, responder);
        for (let attempt = 0; attempt < 12; attempt++) {
          const offer: TradeOffer = {
            from: proposer,
            to: responder,
            give: {
              deeds: mine.filter(() => rng.chance(0.3)),
              coins: rng.int(0, 6) * 25,
              cards: 0,
            },
            get: { deeds: theirs.filter(() => rng.chance(0.35)), coins: 0, cards: 0 },
          };
          if (whyNot(state, { type: 'propose', offer }) !== null) continue;
          const trial = structuredClone(state);
          apply(trial, { type: 'propose', offer });
          const decision = rival.decide(trial);
          expect(decision.line).toBeTruthy();
          if (decision.action.type !== 'answer' || !decision.action.accept) continue;
          accepted += 1;
          const gains = tradeGains(state, outlook(state), offer);
          expect(
            gains.to - rivalry(state) * gains.from,
            JSON.stringify(offer),
          ).toBeGreaterThanOrEqual(-SIGHT[difficulty].clearlyBad!);
        }
      }
    }
    expect(accepted).toBeGreaterThan(0);
  });

  it('refuse to hand over the last lot of a district for pocket money', () => {
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      const state = table(3);
      own(state, 0, 6, 8);
      own(state, 1, 9);
      const rival = new Rival(1, 'steady', difficulty, 'x');
      apply(state, {
        type: 'propose',
        offer: {
          from: 0,
          to: 1,
          give: { deeds: [], coins: 10, cards: 0 },
          get: { deeds: [9], coins: 0, cards: 0 },
        },
      });
      const decision = rival.decide(state);
      expect(decision.action).toMatchObject({ type: 'answer', accept: false });
    }
  });

  it('answer a stingy offer with a counter-offer and a single plain sentence', () => {
    const state = table(3);
    own(state, 0, 6, 8);
    own(state, 1, 9, 39);
    const rival = new Rival(1, 'dealmaker', 'hard', 'x');
    const offer: TradeOffer = {
      from: 0,
      to: 1,
      give: { deeds: [], coins: 60, cards: 0 },
      get: { deeds: [9], coins: 0, cards: 0 },
    };
    apply(state, { type: 'propose', offer });
    const decision = rival.decide(state);
    expect(decision.action.type).toBe('answer');
    if (decision.action.type !== 'answer') return;
    expect(decision.action.accept).toBe(false);
    const counter = decision.action.counter!;
    expect(counter).toMatchObject({ from: 1, to: 0, give: { deeds: [9] } });
    expect(counter.get.coins).toBeGreaterThan(60);
    expect(decision.line).toMatch(/^[^.?!]+[.?!]$/);
    expect(decision.line).toContain(String(counter.get.coins - 60));
    apply(state, decision.action);
    expect(state.phase).toMatchObject({ kind: 'trade', offer: counter });
  });

  it('propose trades that finish a district, with a reason', () => {
    let proposals = 0;
    for (let game = 0; game < 30 && proposals === 0; game++) {
      const { state, rivals } = midGame(`deal-${game}`, 0, 'hard');
      for (let step = 0; step < 4000 && state.phase.kind !== 'over'; step++) {
        const decision = rivals[actor(state)]!.decide(state);
        if (decision.action.type === 'propose') {
          proposals += 1;
          expect(decision.line).toMatch(/would finish my/);
        }
        apply(state, decision.action);
      }
    }
    expect(proposals).toBeGreaterThan(0);
  });

  it('play better the higher the difficulty', () => {
    const wins: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0 };
    const levels: Difficulty[] = ['easy', 'medium', 'hard'];
    for (let game = 0; game < 240; game++) {
      const seats = [0, 1, 2].map((i) => ({
        personality: PERSONALITIES[(game + i) % 5]!,
        difficulty: levels[(game + i) % 3]!,
      }));
      const result = simulate({ seed: `ladder-${game}`, seats });
      if (result.winner !== null) wins[seats[result.winner]!.difficulty] += 1;
    }
    expect(wins.hard).toBeGreaterThan(wins.medium);
    expect(wins.medium).toBeGreaterThan(wins.easy);
  }, 30000);

  it('keep every deed in play: nobody is left owning a lot after resigning', () => {
    const result = simulate({
      seed: 'resign-check',
      seats: [0, 1, 2, 3].map((i) => ({
        personality: PERSONALITIES[i]!,
        difficulty: 'hard' as const,
      })),
      rules: makeRules('standard', 'classic'),
    });
    for (const space of DEED_SPACES) {
      const owner = result.state.deeds[space]!.owner;
      if (owner !== null) expect(result.state.seats[owner]!.out).toBe(false);
    }
  });
});
