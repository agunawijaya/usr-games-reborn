import { createRng, hashString, type Rng } from '@usr-games/kit';
import { LAYOUT } from '../boards/layout';
import { BOARDS } from '../boards/themes';
import { whyNot } from './game';
import type { PersonalityId } from './rivals';
import {
  DEED_SPACES,
  GROUPS,
  deedOf,
  groupHasBuildings,
  groupOf,
  holdings,
  liquidValue,
  ownsGroup,
  rentFor,
  saleValue,
  seatsIn,
  taxableWorth,
  unmortgageCost,
  whyNotBuild,
  whyNotMortgage,
  whyNotOffer,
  whyNotSell,
  whyNotUnmortgage,
} from './state';
import type { Action, Auction, Difficulty, GameState, TradeBundle, TradeOffer } from './types';
import {
  buildPlan,
  denialValue,
  marginalValue,
  outlook,
  ownersOf,
  roundIncome,
  tradeGains,
  type Outlook,
} from './valuation';

/**
 * The rivals' minds. Every rival reads the same valuation; a personality is a set of parameters
 * on top of it (how much cash to keep, how keen to buy, build and trade) and the difficulty sets
 * how precisely it sees the numbers. A decision is one legal move, and for trades a plain
 * sentence saying why.
 */

export interface Mind {
  /** Coins always kept back. */
  readonly reserve: number;
  /** Share of the worst rent on the board also kept back. */
  readonly dangerShare: number;
  /** Multiplier on a deed's worth when buying or bidding. */
  readonly appetite: number;
  /** Extra weight on finishing a district. */
  readonly setFocus: number;
  /** Multiplier on what building earns. */
  readonly buildDrive: number;
  /**
   * Mortgages lots outside its districts to pay for building when the building plan earns this
   * many times the rent the mortgage gives up.
   */
  readonly borrowBar: number;
  /** Chance of looking for a trade on a turn. */
  readonly tradeEagerness: number;
  /** How much better than even a trade must be, in coins. */
  readonly tradeMargin: number;
}

export const MINDS: Readonly<Record<PersonalityId, Mind>> = {
  builder: {
    reserve: 60,
    dangerShare: 0.25,
    appetite: 1.05,
    setFocus: 1,
    buildDrive: 1.3,
    borrowBar: 1,
    tradeEagerness: 0.35,
    tradeMargin: 40,
  },
  saver: {
    reserve: 200,
    dangerShare: 0.55,
    appetite: 0.9,
    setFocus: 1,
    buildDrive: 1,
    borrowBar: 4,
    tradeEagerness: 0.2,
    tradeMargin: 60,
  },
  collector: {
    reserve: 140,
    dangerShare: 0.4,
    appetite: 1,
    setFocus: 1.8,
    buildDrive: 1,
    borrowBar: 2.5,
    tradeEagerness: 0.5,
    tradeMargin: 40,
  },
  dealmaker: {
    reserve: 150,
    dangerShare: 0.45,
    appetite: 1,
    setFocus: 1.2,
    buildDrive: 1,
    borrowBar: 2.5,
    tradeEagerness: 1,
    tradeMargin: 20,
  },
  steady: {
    reserve: 180,
    dangerShare: 0.5,
    appetite: 1,
    setFocus: 1,
    buildDrive: 1.05,
    borrowBar: 2,
    tradeEagerness: 0.4,
    tradeMargin: 30,
  },
};

interface Sight {
  /** How far off a rival's sense of a deed's worth can be, as a share. */
  readonly noise: number;
  /** How much a rival weighs keeping a deed out of other hands. */
  readonly denial: number;
  /** Whether it weighs what a trade gives the other side. */
  readonly weighsPartner: boolean;
  /** Turns down any trade worse than this for it, measured exactly. */
  readonly clearlyBad: number | null;
  /** How many lots it will hold mortgaged to pay for building: 0 never thinks of it. */
  readonly borrowing: number;
  /** Counts the landing odds (the Markov model) rather than taking every space as equally likely. */
  readonly countsOdds: boolean;
}

export const SIGHT: Readonly<Record<Difficulty, Sight>> = {
  easy: {
    noise: 0.35,
    denial: 0,
    weighsPartner: false,
    clearlyBad: null,
    borrowing: 0,
    countsOdds: false,
  },
  medium: {
    noise: 0.2,
    denial: 0.4,
    weighsPartner: true,
    clearlyBad: 40,
    borrowing: 2,
    countsOdds: true,
  },
  hard: {
    noise: 0,
    denial: 0.4,
    weighsPartner: true,
    clearlyBad: 20,
    borrowing: Infinity,
    countsOdds: true,
  },
};

export interface Decision {
  readonly action: Action;
  /** One plain sentence for the table, when the move is an offer or an answer. */
  readonly line?: string;
}

/** How much a trade's gain to the other side counts against it: nearly all of it with two players left. */
export function rivalry(state: GameState): number {
  const players = seatsIn(state).length;
  return players <= 2 ? 0.85 : players === 3 ? 0.6 : 0.45;
}

const round10 = (n: number) => Math.ceil(n / 10) * 10;
/** Turns of expected rent a rival keeps cash for. */
const DANGER_TURNS = 4;
const NOTHING: TradeBundle = { deeds: [], coins: 0, cards: 0 };

export class Rival {
  readonly mind: Mind;
  readonly sight: Sight;
  private readonly rng: Rng;
  private readonly salt: number;
  private proposedOnTurn = -1;
  private counteredOnTurn = -1;
  private readonly refused = new Set<string>();

  constructor(
    readonly seat: number,
    readonly personality: PersonalityId,
    readonly difficulty: Difficulty,
    seed: string,
  ) {
    this.mind = MINDS[personality];
    this.sight = SIGHT[difficulty];
    this.rng = createRng(`${seed}/rival/${seat}`);
    this.salt = hashString(`${seed}/${seat}`);
  }

  decide(state: GameState): Decision {
    const decision = this.choose(state);
    if (whyNot(state, decision.action) === null) return decision;
    return { action: this.fallback(state) };
  }

  private choose(state: GameState): Decision {
    const phase = state.phase;
    switch (phase.kind) {
      case 'turn':
        return { action: this.startTurn(state) };
      case 'buy':
        return { action: this.buyOrNot(state, phase.space) };
      case 'auction':
        return { action: this.bid(state, phase.auction) };
      case 'debt':
        return { action: this.fixDebt(state) };
      case 'trade':
        return this.answer(state, phase.offer);
      case 'taxChoice': {
        const tenth = Math.floor(taxableWorth(state, this.seat) / 10);
        return {
          action: { type: 'taxChoice', choice: tenth <= state.economy.taxes[0] ? 'tenth' : 'flat' },
        };
      }
      case 'after':
        return this.afterLanding(state, phase.rollAgain);
      case 'over':
        return { action: { type: 'endTurn' } };
    }
  }

  private fallback(state: GameState): Action {
    switch (state.phase.kind) {
      case 'buy':
        return { type: 'decline' };
      case 'auction':
        return { type: 'pass', seat: this.seat };
      case 'debt':
        return { type: 'resign' };
      case 'trade':
        return { type: 'answer', accept: false };
      case 'after':
        return state.phase.rollAgain ? { type: 'roll' } : { type: 'endTurn' };
      default:
        return { type: 'roll' };
    }
  }

  /** The game as this rival sees it: with the landing odds counted, or not. */
  private view(state: GameState): Outlook {
    return outlook(state, !this.sight.countsOdds);
  }

  /** A steady error in how this rival sees each deed, so its mistakes are consistent, not random. */
  private wobble(space: number): number {
    if (this.sight.noise === 0) return 1;
    const u = hashString(`${this.salt}:${space}`) / 4294967296;
    return 1 + this.sight.noise * (u * 2 - 1);
  }

  /**
   * The cash this rival keeps back: its own reserve, plus a share of the danger on the board,
   * which is the rent it can expect to pay over the next few turns and a little of the worst
   * single rent it could land on.
   */
  private cushion(state: GameState): number {
    const landing = this.view(state).landing;
    let worst = 0;
    let expected = 0;
    for (const space of LAYOUT.keys()) {
      const deed = state.deeds[space];
      if (!deed || deed.owner === null || deed.owner === this.seat) continue;
      const rent = rentFor(state, space, 7);
      worst = Math.max(worst, rent);
      expected += rent * landing[space]!;
    }
    return this.mind.reserve + this.mind.dangerShare * (expected * DANGER_TURNS + worst * 0.25);
  }

  /** What a deed is worth to this rival, buying it outright. */
  private deedWorth(state: GameState, o: Outlook, space: number): number {
    const owners = ownersOf(state);
    let worth = marginalValue(state, o, this.seat, space, owners) * this.wobble(space);
    const group = groupOf(space);
    if (group !== null && GROUPS[group]!.some((s) => owners[s] === this.seat))
      worth *= this.mind.setFocus;
    worth += this.sight.denial * denialValue(state, o, this.seat, space, owners);
    return worth * this.mind.appetite;
  }

  private startTurn(state: GameState): Action {
    const me = state.seats[this.seat]!;
    if (!me.inLockup) return { type: 'roll' };
    const unsold =
      DEED_SPACES.filter((s) => state.deeds[s]!.owner === null).length / DEED_SPACES.length;
    const leave = unsold > 0.3 || this.cushion(state) - this.mind.reserve < 150;
    if (!leave) return { type: 'roll' };
    if (me.freeCards.length > 0) return { type: 'useCard' };
    if (me.coins - state.economy.fine >= this.mind.reserve) return { type: 'payFine' };
    return { type: 'roll' };
  }

  private buyOrNot(state: GameState, space: number): Action {
    const price = deedOf(state, space).price;
    const worth = this.deedWorth(state, this.view(state), space);
    if (worth < price * 0.9) return { type: 'decline' };
    const me = state.seats[this.seat]!;
    // Buying matters more than the cushion, so only half of it has to stay in hand.
    if (me.coins - price >= this.cushion(state) / 2) return { type: 'buy' };
    if (worth > price * 1.3) {
      const raise = this.cheapestMortgage(state);
      if (
        raise !== null &&
        me.coins + deedOf(state, raise).mortgage - price >= this.cushion(state) / 3
      )
        return { type: 'mortgage', space: raise };
    }
    return { type: 'decline' };
  }

  private bid(state: GameState, auction: Auction): Action {
    const high = auction.high?.amount ?? 0;
    const me = state.seats[this.seat]!;
    const ceiling = Math.min(
      this.deedWorth(state, this.view(state), auction.space),
      me.coins - this.cushion(state) / 3,
    );
    if (ceiling <= high) return { type: 'pass', seat: this.seat };
    // Jump a third of the way to its ceiling, so auctions finish in a few calls.
    const step = Math.max(5, Math.round((ceiling - high) / 3 / 5) * 5);
    return { type: 'bid', seat: this.seat, amount: Math.floor(Math.min(ceiling, high + step)) };
  }

  /** The lot whose mortgage costs the least income per coin raised, outside complete districts. */
  private cheapestMortgage(state: GameState, allowDistricts = false): number | null {
    const o = this.view(state);
    const owners = ownersOf(state);
    let best: number | null = null;
    let bestLoss = Infinity;
    for (const space of holdings(state, this.seat)) {
      if (whyNotMortgage(state, this.seat, space) !== null) continue;
      const group = groupOf(space);
      if (!allowDistricts && group !== null && ownsGroup(state, this.seat, group)) continue;
      const loss =
        (roundIncome(state, o, owners, space, 0) * o.annuity) / deedOf(state, space).mortgage;
      if (loss < bestLoss) {
        bestLoss = loss;
        best = space;
      }
    }
    return best;
  }

  /** Raise money with the least harm: the cheapest mortgage or building sale, or give up when nothing can cover it. */
  private fixDebt(state: GameState): Action {
    const me = state.seats[this.seat]!;
    if (me.coins + liquidValue(state, this.seat) < 0) return { type: 'resign' };
    const o = this.view(state);
    const owners = ownersOf(state);
    let best: Action | null = null;
    let bestLoss = Infinity;
    for (const space of holdings(state, this.seat)) {
      const deed = state.deeds[space]!;
      if (whyNotMortgage(state, this.seat, space) === null) {
        const loss =
          (roundIncome(state, o, owners, space, 0) * o.annuity) / deedOf(state, space).mortgage;
        if (loss < bestLoss) [best, bestLoss] = [{ type: 'mortgage', space }, loss];
      }
      if (whyNotSell(state, this.seat, space) === null) {
        const drop =
          roundIncome(state, o, owners, space, deed.level) -
          roundIncome(state, o, owners, space, deed.level - 1);
        const loss = (drop * o.annuity) / saleValue(state, space);
        if (loss < bestLoss) [best, bestLoss] = [{ type: 'sell', space }, loss];
      }
    }
    return best ?? { type: 'resign' };
  }

  private afterLanding(state: GameState, rollAgain: boolean): Decision {
    if (rollAgain) return { action: { type: 'roll' } };
    const manage = this.unmortgage(state) ?? this.build(state);
    if (manage) return { action: manage };
    if (this.proposedOnTurn !== state.turns && this.rng.chance(this.mind.tradeEagerness)) {
      this.proposedOnTurn = state.turns;
      const deal = this.findDeal(state);
      if (deal) return deal;
    }
    return { action: { type: 'endTurn' } };
  }

  private unmortgage(state: GameState): Action | null {
    const me = state.seats[this.seat]!;
    const spare = me.coins - this.cushion(state) * 1.5;
    for (const space of holdings(state, this.seat)) {
      if (whyNotUnmortgage(state, this.seat, space) !== null) continue;
      if (unmortgageCost(state, space) <= spare) return { type: 'unmortgage', space };
    }
    return null;
  }

  /** Builds towards the height that pays best on its most rewarding district, lowest lot first. */
  private build(state: GameState): Action | null {
    const o = this.view(state);
    const owners = ownersOf(state);
    const me = state.seats[this.seat]!;
    // A rival sitting on far more coins than it needs builds as if buildings cost little: they
    // are how a game is won, and idle coins win nothing.
    const thrift = Math.min(1, (2 * (this.cushion(state) + 500)) / Math.max(1, me.coins));
    let best: number | null = null;
    let bestGain = 0;
    GROUPS.forEach((lots, group) => {
      if (!ownsGroup(state, this.seat, group)) return;
      const drive = this.mind.buildDrive * this.wobble(lots[0]!);
      const plan = buildPlan(state, o, owners, group, drive, thrift);
      if (plan.gain <= bestGain) return;
      const next = lots.find(
        (s) => state.deeds[s]!.level < plan.level && whyNotBuild(state, this.seat, s) === null,
      );
      if (next === undefined) return;
      [best, bestGain] = [next, plan.gain];
    });
    if (best === null) return null;
    const cost = deedOf(state, best).buildCost;
    if (me.coins - cost >= this.cushion(state)) return { type: 'build', space: best };
    const mortgaged = holdings(state, this.seat).filter((s) => state.deeds[s]!.mortgaged).length;
    if (mortgaged >= this.sight.borrowing) return null;
    const raise = this.cheapestMortgage(state);
    if (raise === null) return null;
    const givenUp = roundIncome(state, o, owners, raise, 0) * o.annuity;
    return bestGain >= this.mind.borrowBar * Math.max(givenUp, 10)
      ? { type: 'mortgage', space: raise }
      : null;
  }

  /** How good a trade is for this rival: its own gain, less a share of what the other side gains. */
  private score(state: GameState, o: Outlook, offer: TradeOffer, exact = false): number {
    const gains = tradeGains(state, o, offer);
    const mine = offer.to === this.seat ? gains.to : gains.from;
    const theirs = offer.to === this.seat ? gains.from : gains.to;
    const deeds = [...offer.give.deeds, ...offer.get.deeds];
    const wobble =
      exact || deeds.length === 0
        ? 1
        : deeds.reduce((sum, s) => sum + this.wobble(s), 0) / deeds.length;
    const partnerWeight = exact || this.sight.weighsPartner ? rivalry(state) : 0;
    return mine * wobble - partnerWeight * theirs;
  }

  private answer(state: GameState, offer: TradeOffer): Decision {
    const key = JSON.stringify(offer);
    const score = this.score(state, this.view(state), offer);
    const exact = this.score(state, outlook(state), offer, true);
    const clearlyBad = this.sight.clearlyBad !== null && exact < -this.sight.clearlyBad;
    if (!clearlyBad && score >= this.mind.tradeMargin) {
      return {
        action: { type: 'answer', accept: true },
        line: acceptLine(state, offer, this.seat),
      };
    }
    const counter = this.counterTo(state, offer, score);
    if (counter && !this.refused.has(key) && this.counteredOnTurn !== state.turns) {
      this.refused.add(key);
      this.counteredOnTurn = state.turns;
      return {
        action: { type: 'answer', accept: false, counter: counter.offer },
        line: counter.line,
      };
    }
    return {
      action: { type: 'answer', accept: false },
      line: declineLine(state, offer, this.seat),
    };
  }

  /** The same deal with more coins coming this rival's way, if the other side can pay them. */
  private counterTo(
    state: GameState,
    offer: TradeOffer,
    score: number,
  ): { offer: TradeOffer; line: string } | null {
    const extra = round10((this.mind.tradeMargin - score) / (1 + rivalry(state)));
    if (extra <= 0 || extra > 2000) return null;
    // Turned round, the counter comes from this rival: it pays less, or asks for more.
    let give = offer.get;
    let get = offer.give;
    if (give.coins >= extra) {
      give = { ...give, coins: give.coins - extra };
    } else {
      get = { ...get, coins: get.coins + extra - give.coins };
      give = { ...give, coins: 0 };
    }
    const counter: TradeOffer = { from: this.seat, to: offer.from, give, get };
    if (whyNotOffer(state, counter) !== null) return null;
    const verify = this.score(state, this.view(state), counter);
    if (verify < this.mind.tradeMargin - 10) return null;
    return { offer: counter, line: counterLine(state, offer, this.seat, extra) };
  }

  /** Looks for a district this rival could finish by trading with one other player, and an offer they might take. */
  private findDeal(state: GameState): Decision | null {
    const o = this.view(state);
    const me = state.seats[this.seat]!;
    const spendable = Math.max(0, me.coins - this.cushion(state));
    let best: { offer: TradeOffer; mine: number; group: number } | null = null;
    GROUPS.forEach((lots, group) => {
      const held = lots.filter((s) => state.deeds[s]!.owner === this.seat);
      if (held.length === 0 || held.length === lots.length) return;
      const others = new Set(
        lots.filter((s) => state.deeds[s]!.owner !== this.seat).map((s) => state.deeds[s]!.owner),
      );
      if (others.size !== 1 || others.has(null)) return;
      const partner = [...others][0]!;
      if (state.rules.tradeOnlyUnbuilt && groupHasBuildings(state, group)) return;
      const want = lots.filter((s) => state.deeds[s]!.owner === partner);
      const sweeteners: number[][] = [[]];
      for (const space of holdings(state, this.seat)) {
        const g = groupOf(space);
        if (g === group || (g !== null && ownsGroup(state, this.seat, g))) continue;
        if (state.rules.tradeOnlyUnbuilt && g !== null && groupHasBuildings(state, g)) continue;
        sweeteners.push([space]);
      }
      for (const extra of sweeteners) {
        const base: TradeOffer = {
          from: this.seat,
          to: partner,
          give: { ...NOTHING, deeds: extra },
          get: { ...NOTHING, deeds: want },
        };
        const gains = tradeGains(state, o, base);
        const lambda = rivalry(state);
        const margin = 30;
        // Coins this side pays so the other side's score clears its margin, and the most it can pay.
        const need = (margin - gains.to + lambda * gains.from) / (1 + lambda);
        const most = (gains.from - lambda * gains.to - this.mind.tradeMargin) / (1 + lambda);
        const pay = round10(Math.max(0, need) + 10);
        if (pay > most || pay > spendable) continue;
        const offer: TradeOffer = { ...base, give: { ...base.give, coins: pay } };
        if (whyNotOffer(state, offer) !== null) continue;
        const mine = this.score(state, o, offer);
        if (mine > this.mind.tradeMargin && (!best || mine > best.mine))
          best = { offer, mine, group };
      }
    });
    if (!best) return null;
    const { offer, group } = best as { offer: TradeOffer; mine: number; group: number };
    return { action: { type: 'propose', offer }, line: proposalLine(state, offer, group) };
  }
}

function district(state: GameState, group: number): string {
  return BOARDS[state.board].groups[group]!.name;
}

function street(state: GameState, space: number): string {
  return BOARDS[state.board].spaces[space]!;
}

/** The district a set of deeds finishes for a seat, if any. */
function completes(state: GameState, seat: number, deeds: readonly number[]): number | null {
  for (const space of deeds) {
    const group = groupOf(space);
    if (group === null) continue;
    if (GROUPS[group]!.every((s) => deeds.includes(s) || state.deeds[s]!.owner === seat))
      return group;
  }
  return null;
}

function acceptLine(state: GameState, offer: TradeOffer, me: number): string {
  const mineIn = offer.to === me ? offer.give.deeds : offer.get.deeds;
  const group = completes(state, me, mineIn);
  if (group !== null) return `Deal. That finishes my ${district(state, group)}.`;
  return 'Fair enough, you have a deal.';
}

function declineLine(state: GameState, offer: TradeOffer, me: number): string {
  const partner = offer.to === me ? offer.from : offer.to;
  const theirsIn = offer.to === me ? offer.get.deeds : offer.give.deeds;
  const group = completes(state, partner, theirsIn);
  if (group !== null) return `No thanks: that would hand you the whole ${district(state, group)}.`;
  return 'No thanks, I would be giving away too much there.';
}

function counterLine(state: GameState, offer: TradeOffer, me: number, extra: number): string {
  const wanted = offer.to === me ? offer.get.deeds : offer.give.deeds;
  const mineIn = offer.to === me ? offer.give.deeds : offer.get.deeds;
  const finishes = completes(state, offer.from, wanted);
  if (finishes !== null)
    return `I'll take it if you add ${extra}: that finishes your ${district(state, finishes)}.`;
  const mine = completes(state, me, mineIn);
  if (mine !== null)
    return `Add ${extra} and it's yours; I would rather keep building my ${district(state, mine)}.`;
  const lot = wanted[0];
  if (lot !== undefined)
    return `I'll take it if you add ${extra}; ${street(state, lot)} is worth more to me than that.`;
  return `Make it ${extra} more and we have a deal.`;
}

function proposalLine(state: GameState, offer: TradeOffer, group: number): string {
  const lots = offer.get.deeds.map((s) => street(state, s)).join(' and ');
  const sweetener =
    offer.give.deeds.length > 0
      ? ` plus ${offer.give.deeds.map((s) => street(state, s)).join(' and ')}`
      : '';
  return `${lots} would finish my ${district(state, group)}. ${offer.give.coins} coins${sweetener} for it?`;
}
