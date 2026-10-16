import { describe, expect, it } from 'vitest';
import { BOARD_IDS } from '../boards/themes';
import { ECONOMY } from '../engine/economy';
import { apply, newGame } from '../engine/game';
import { keep, openLedger } from '../engine/ledger';
import { rig } from '../engine/testing';
import { SCENARIOS, scenarioById } from './catalogue';
import { dailyDeal, dailyScenario, dailyShareText } from './daily';
import { describeGoal, judge, restricted, type Goal } from './goals';
import { playScenario, scenarioGame } from './run';

function tableOf(id: string, seed = 'test') {
  const scenario = scenarioById(id)!;
  const game = scenarioGame(scenario, seed);
  const state = newGame(game);
  game.prepare(state);
  return { scenario, state, ledger: openLedger(0, state) };
}

describe('the catalogue', () => {
  it('has twenty-four scenarios, eight a board, numbered in order', () => {
    expect(SCENARIOS).toHaveLength(24);
    expect(SCENARIOS.map((s) => s.number)).toEqual([...Array(24).keys()].map((i) => i + 1));
    expect(new Set(SCENARIOS.map((s) => s.id)).size).toBe(24);
    for (const board of BOARD_IDS)
      expect(SCENARIOS.filter((s) => s.board === board)).toHaveLength(8);
  });

  it('sets every table legally: owned deeds, honest building stock, two to four seats', () => {
    for (const scenario of SCENARIOS) {
      const { state } = tableOf(scenario.id);
      expect(state.seats.length, scenario.id).toBeGreaterThanOrEqual(2);
      expect(state.seats.length, scenario.id).toBeLessThanOrEqual(4);
      expect(state.supply.storeys, scenario.id).toBeGreaterThanOrEqual(0);
      const built = state.deeds.reduce(
        (sum, d) => sum + (d && d.level > 0 && d.level < 5 ? d.level : 0),
        0,
      );
      expect(state.supply.storeys + built, scenario.id).toBe(ECONOMY.storeySupply);
      for (const deed of state.deeds) {
        if (!deed || deed.level === 0) continue;
        expect(deed.owner, scenario.id).not.toBeNull();
      }
      // No scenario is decided before the first roll.
      expect(judge(scenario.goals, state, openLedger(0, state)), scenario.id).toBeNull();
    }
  });

  it('describes every goal in its board’s own words, with briefs kept short', () => {
    for (const scenario of SCENARIOS) {
      for (const goal of scenario.goals)
        expect(describeGoal(goal, scenario.board).length, scenario.id).toBeGreaterThan(8);
      expect(scenario.brief.length, scenario.id).toBeLessThanOrEqual(200);
    }
    expect(describeGoal({ kind: 'transits', count: 4 }, 'harbour')).toBe('Own all four ferries');
    expect(describeGoal({ kind: 'district', group: 1 }, 'colony')).toBe(
      'Own the whole Hydroponics',
    );
  });
});

describe('the referee', () => {
  it('wins the moment every goal that can be met mid-game is met', () => {
    const { scenario, state, ledger } = tableOf('first-mooring');
    state.deeds[3]!.owner = 0;
    expect(judge(scenario.goals, state, ledger)).toMatchObject({ won: true, turns: 1 });
  });

  it('judges goals about the end only when the game is over', () => {
    const { scenario, state, ledger } = tableOf('captains-spire');
    state.seats[0]!.coins = 99999;
    expect(judge(scenario.goals, state, ledger)).toBeNull();
    state.phase = { kind: 'over' };
    expect(judge(scenario.goals, state, ledger)).toMatchObject({ won: true });
    state.seats[0]!.coins = 0;
    expect(judge(scenario.goals, state, ledger)).toMatchObject({ won: false });
  });

  it('loses when the rounds run out or the player is out', () => {
    const { scenario, state, ledger } = tableOf('ferry-baron');
    state.phase = { kind: 'over' };
    expect(judge(scenario.goals, state, ledger)).toMatchObject({
      won: false,
      reason: 'The rounds ran out first.',
    });
    state.phase = { kind: 'turn' };
    state.seats[0]!.out = true;
    expect(judge(scenario.goals, state, ledger)?.won).toBe(false);
  });

  it('counts the rent the player collects, move by move', () => {
    const { scenario, state, ledger } = tableOf('rent-day');
    const goal = scenario.goals[0] as Extract<Goal, { kind: 'rent' }>;
    // Seat 1 lands on Beacon Rise (24), two storeys high.
    state.current = 1;
    state.seats[1]!.position = 20;
    rig(state, [1, 3]);
    keep(ledger, state, apply(state, { type: 'roll' }));
    expect(ledger.rentCollected).toBe(ECONOMY.deeds[24]!.rents[2]);
    expect(ledger.rentCollected).toBeLessThan(goal.amount);
  });
});

describe('restrictions', () => {
  it('keeps streets out of the player’s hands, but not transit stops', () => {
    const { state } = tableOf('harbour-master');
    state.phase = { kind: 'buy', space: 6 };
    expect(restricted(['noStreets'], state, 0, { type: 'buy' })).toMatch(/off limits/);
    state.phase = { kind: 'buy', space: 25 };
    expect(restricted(['noStreets'], state, 0, { type: 'buy' })).toBeNull();
    state.phase = { kind: 'auction', auction: { space: 9, high: null, bidders: [0, 1], at: 0 } };
    expect(
      restricted(['noStreets'], state, 0, { type: 'bid', seat: 0, amount: 50 }),
    ).not.toBeNull();
    const offer = {
      from: 0,
      to: 1,
      give: { deeds: [], coins: 100, cards: 0 },
      get: { deeds: [9], coins: 0, cards: 0 },
    };
    expect(restricted(['noStreets'], state, 0, { type: 'propose', offer })).not.toBeNull();
    state.phase = {
      kind: 'trade',
      offer: { ...offer, from: 1, to: 0, give: offer.get, get: offer.give },
      then: { kind: 'turn' },
    };
    expect(restricted(['noStreets'], state, 0, { type: 'answer', accept: true })).not.toBeNull();
    expect(restricted(['noStreets'], state, 0, { type: 'answer', accept: false })).toBeNull();
  });

  it('closes the trade table when trading is off', () => {
    const { state } = tableOf('market-day');
    const offer = {
      from: 0,
      to: 1,
      give: { deeds: [], coins: 10, cards: 0 },
      get: { deeds: [], coins: 0, cards: 0 },
    };
    expect(restricted(['noTrades'], state, 0, { type: 'propose', offer })).toMatch(/No trading/);
    expect(restricted(['noTrades'], state, 0, { type: 'roll' })).toBeNull();
  });
});

describe('every scenario can be won', () => {
  // The full proof (NOTES.md) plays 200 seeds each; this keeps a lighter watch on it.
  const SEEDS = 40;
  for (const scenario of SCENARIOS) {
    it(`${scenario.number} ${scenario.title}`, () => {
      let wins = 0;
      for (let i = 0; i < SEEDS; i++)
        if (playScenario(scenario, `${scenario.id}:proof:${i}`).verdict.won) wins += 1;
      expect(wins / SEEDS).toBeGreaterThanOrEqual(0.15);
      expect(wins / SEEDS).toBeLessThanOrEqual(0.98);
    });
  }
});

describe('the Daily Deal', () => {
  it('deals every scenario once in each run of twenty-four days', () => {
    const cycle = Array.from({ length: 24 }, (_, i) => dailyScenario(25 + i).id);
    expect(new Set(cycle).size).toBe(24);
  });

  it('is the same for everyone and always proven winnable', () => {
    for (let day = 40; day < 70; day++) {
      const deal = dailyDeal(`monop:daily:day-${day}`, day);
      expect(dailyDeal(`monop:daily:day-${day}`, day)).toEqual(deal);
      expect(playScenario(deal.scenario, deal.seed).verdict.won, `day ${day}`).toBe(true);
    }
  });

  it('shares a line with the day’s number and no link', () => {
    const text = dailyShareText('2026-10-12', {
      number: 42,
      scenario: 'ferry-baron',
      won: true,
      turns: 14,
      towers: 3,
      deals: 2,
    });
    expect(text).toBe('Deeds & Dice #42 · won in 14 turns · 🏙️ 3 towers · 🤝 2 deals');
    expect(
      dailyShareText('2026-10-12', {
        number: 42,
        scenario: 'ferry-baron',
        won: false,
        turns: 10,
        towers: 1,
        deals: 0,
      }),
    ).toBe('Deeds & Dice #42 · not this time · 🏙️ 1 tower · 🤝 0 deals');
  });
});
