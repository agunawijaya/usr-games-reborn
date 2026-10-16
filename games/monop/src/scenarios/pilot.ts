import { LAYOUT, TRANSIT_SPACES, UTILITY_SPACES } from '../boards/layout';
import { MINDS, Rival, rivalry } from '../engine/ai';
import type { Ledger } from '../engine/ledger';
import {
  GROUPS,
  deedOf,
  holdings,
  ownsGroup,
  unmortgageCost,
  whyNotBuild,
  whyNotOffer,
  whyNotUnmortgage,
} from '../engine/state';
import type { Action, GameState, TradeOffer } from '../engine/types';
import { outlook, tradeGains } from '../engine/valuation';
import type { Scenario } from './catalogue';
import { type Goal, met, restricted } from './goals';

/**
 * The proof's player: a hard rival's mind in your seat that also chases the scenario's goals the
 * way a person would. It offers coins for the deeds a goal needs (as much as the owner wants, if
 * it can pay), takes offers that bring them, pays off mortgages and builds when a goal asks for
 * buildings, and otherwise plays as its personality does. It keeps to the restrictions.
 */

/** Coins the pilot keeps in hand when it spends for a goal. */
const KEEP = 60;
const ceil10 = (n: number) => Math.ceil(n / 10) * 10;

export class Pilot {
  private readonly mind: Rival;
  private triedOnTurn = -1;

  constructor(
    private readonly scenario: Scenario,
    seed: string,
  ) {
    this.mind = new Rival(0, scenario.pilot, 'hard', `${seed}/pilot`);
  }

  decide(state: GameState, ledger: Ledger): Action {
    const phase = state.phase;
    const restrictions = this.scenario.restrictions ?? [];
    let action: Action | null = null;
    if (phase.kind === 'trade' && phase.offer.to === 0 && this.welcome(state, phase.offer, ledger))
      action = { type: 'answer', accept: true };
    else if (phase.kind === 'after' && !phase.rollAgain) {
      action = this.push(state, ledger);
      if (!action && this.triedOnTurn !== state.turns && !restrictions.includes('noTrades')) {
        this.triedOnTurn = state.turns;
        const offer = this.goalOffer(state, ledger);
        if (offer) action = { type: 'propose', offer };
      }
    }
    action ??= this.mind.decide(state).action;
    // When mortgages must be paid off, new ones are only taken to cover a debt.
    const clearing = this.scenario.goals.some((g) => g.kind === 'clearMortgages');
    if (clearing && action.type === 'mortgage' && phase.kind !== 'debt') return stepAside(state);
    return restricted(restrictions, state, 0, action) === null ? action : stepAside(state);
  }

  private open(state: GameState, ledger: Ledger): Goal[] {
    return this.scenario.goals.filter((goal) => !met(goal, state, ledger));
  }

  /** Deeds held by others that the open goals need. */
  private wanted(state: GameState, ledger: Ledger): Set<number> {
    const want = new Set<number>();
    const others = (spaces: readonly number[]) =>
      spaces.filter((s) => state.deeds[s]!.owner !== null && state.deeds[s]!.owner !== 0);
    const needsDistrict = (group?: number) => {
      if (group !== undefined) return others(GROUPS[group]!).forEach((s) => want.add(s));
      // The district nearest to whole among those the pilot has a foot in.
      const candidates = GROUPS.map((lots, g) => ({ g, lots }))
        .filter(
          ({ g, lots }) => !ownsGroup(state, 0, g) && lots.some((s) => state.deeds[s]!.owner === 0),
        )
        .sort((a, b) => others(a.lots).length - others(b.lots).length);
      if (candidates[0]) others(candidates[0].lots).forEach((s) => want.add(s));
    };
    for (const goal of this.open(state, ledger)) {
      switch (goal.kind) {
        case 'district':
        case 'landmark':
          needsDistrict(goal.group);
          break;
        case 'storeys':
        case 'rent':
          if (!GROUPS.some((_, g) => ownsGroup(state, 0, g))) needsDistrict();
          break;
        case 'transits':
          others(TRANSIT_SPACES).forEach((s) => want.add(s));
          break;
        case 'utilities':
          others(UTILITY_SPACES).forEach((s) => want.add(s));
          break;
        default:
          break;
      }
    }
    if ((this.scenario.restrictions ?? []).includes('noStreets'))
      for (const space of want) if (LAYOUT[space]!.kind === 'street') want.delete(space);
    return want;
  }

  /** Accepts an offer that brings a wanted deed, or any fair-ish one when trades are the goal. */
  private welcome(state: GameState, offer: TradeOffer, ledger: Ledger): boolean {
    const gains = tradeGains(state, outlook(state), offer);
    const mine = gains.to;
    if (this.open(state, ledger).some((g) => g.kind === 'deals') && mine > -150) return true;
    const want = this.wanted(state, ledger);
    if (!offer.give.deeds.some((s) => want.has(s))) return false;
    // Never hand back a deed a goal needs to get one.
    if (offer.get.deeds.some((s) => this.keeps(state, ledger, s))) return false;
    return state.seats[0]!.coins - offer.get.coins >= KEEP;
  }

  /** Deeds the pilot holds that a goal still counts on. */
  private keeps(state: GameState, ledger: Ledger, space: number): boolean {
    const group = LAYOUT[space]!.group;
    return this.scenario.goals.some((goal) => {
      if (goal.kind === 'transits') return TRANSIT_SPACES.includes(space);
      if (goal.kind === 'utilities') return UTILITY_SPACES.includes(space);
      if ((goal.kind === 'district' || goal.kind === 'landmark') && group !== undefined)
        return goal.group === undefined || goal.group === group;
      return !met(goal, state, ledger) && group !== undefined && ownsGroup(state, 0, group);
    });
  }

  /** Pays off mortgages or builds, when a goal asks for it. */
  private push(state: GameState, ledger: Ledger): Action | null {
    const coins = state.seats[0]!.coins;
    const lends = state.rules.bankLends;
    for (const goal of this.open(state, ledger)) {
      if (goal.kind === 'clearMortgages') {
        const owed = holdings(state, 0).filter((s) => state.deeds[s]!.mortgaged);
        const lot = owed.find(
          (s) =>
            whyNotUnmortgage(state, 0, s) === null && coins - unmortgageCost(state, s) >= KEEP * 2,
        );
        if (lot !== undefined) return { type: 'unmortgage', space: lot };
        // Saving up: nothing else gets spent while a mortgage is still owed.
        if (owed.length > 0) return { type: 'endTurn' };
      }
      if (goal.kind === 'storeys' || goal.kind === 'landmark' || goal.kind === 'rent') {
        const lots = holdings(state, 0).filter(
          (s) =>
            (goal.kind !== 'landmark' ||
              goal.group === undefined ||
              LAYOUT[s]!.group === goal.group) &&
            whyNotBuild(state, 0, s) === null,
        );
        const lot = lots.sort((a, b) => state.deeds[a]!.level - state.deeds[b]!.level)[0];
        if (lot !== undefined && coins - deedOf(state, lot).buildCost >= (lends ? 0 : KEEP))
          return { type: 'build', space: lot };
      }
    }
    return null;
  }

  /** An offer of coins for the wanted deeds one owner holds, at what that owner should accept. */
  private goalOffer(state: GameState, ledger: Ledger): TradeOffer | null {
    const want = this.wanted(state, ledger);
    const byOwner = new Map<number, number[]>();
    for (const space of want) {
      const owner = state.deeds[space]!.owner!;
      byOwner.set(owner, [...(byOwner.get(owner) ?? []), space]);
    }
    const o = outlook(state);
    const lambda = rivalry(state);
    const coins = state.seats[0]!.coins;
    let best: TradeOffer | null = null;
    for (const [partner, deeds] of byOwner) {
      const personality = state.seats[partner]!.personality ?? 'steady';
      const base: TradeOffer = {
        from: 0,
        to: partner,
        give: { deeds: [], coins: 0, cards: 0 },
        get: { deeds, coins: 0, cards: 0 },
      };
      const gains = tradeGains(state, o, base);
      const pay = ceil10(
        Math.max(
          0,
          (MINDS[personality].tradeMargin + 30 - gains.to + lambda * gains.from) / (1 + lambda),
        ),
      );
      if (pay > coins - KEEP) continue;
      const offer = { ...base, give: { ...base.give, coins: pay } };
      if (whyNotOffer(state, offer) !== null) continue;
      if (!best || pay < best.give.coins) best = offer;
    }
    if (best || !this.open(state, ledger).some((g) => g.kind === 'deals')) return best;
    return this.saleOffer(state);
  }

  /** For a trading goal: sell a rival the deed that finishes its district. */
  private saleOffer(state: GameState): TradeOffer | null {
    for (const space of holdings(state, 0)) {
      const group = LAYOUT[space]!.group;
      if (group === undefined) continue;
      const rest = GROUPS[group]!.filter((s) => s !== space).map((s) => state.deeds[s]!.owner);
      const partner = rest[0];
      if (partner === null || partner === undefined || partner === 0) continue;
      if (!rest.every((owner) => owner === partner)) continue;
      const offer: TradeOffer = {
        from: 0,
        to: partner,
        give: { deeds: [space], coins: 0, cards: 0 },
        get: { deeds: [], coins: deedOf(state, space).price, cards: 0 },
      };
      if (whyNotOffer(state, offer) === null) return offer;
    }
    return null;
  }
}

/** A move the restrictions allow in place of one they forbid. */
export function stepAside(state: GameState): Action {
  const phase = state.phase;
  switch (phase.kind) {
    case 'buy':
      return { type: 'decline' };
    case 'auction':
      return { type: 'pass', seat: 0 };
    case 'trade':
      return { type: 'answer', accept: false };
    case 'after':
      return phase.rollAgain ? { type: 'roll' } : { type: 'endTurn' };
    default:
      return { type: 'roll' };
  }
}
