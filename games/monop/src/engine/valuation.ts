import { LAYOUT, TRANSIT_SPACES, UTILITY_SPACES } from '../boards/layout';
import { landingOdds } from './markov';
import { DEED_SPACES, GROUPS, deedOf, groupOf, seatsIn } from './state';
import type { GameState, TradeOffer } from './types';

/**
 * What deeds are worth, in coins, to whoever holds them. Income is the Markov landing odds times
 * the rent times the rivals who might land, summed over the rounds left with a discount; a
 * complete district adds what building on it could earn; an incomplete one is an option on
 * completing it. In a Quick game every deed also counts at its price in the final reckoning.
 */

export interface Outlook {
  /** Expected landings on each space in one player's turn. */
  readonly landing: readonly number[];
  readonly byCard: readonly number[];
  /** Players who could land on a seat's lots each round. */
  readonly rivals: number;
  /** Discounted rounds of income still to come. */
  readonly annuity: number;
  readonly quick: boolean;
}

/** Who owns each space in a world being imagined: today's table, or one after a trade. */
export type Owners = (number | null)[];

const DISCOUNT = 0.96;
const CLASSIC_HORIZON = 30;
/** Building later and on borrowed time: how much of a district's building upside a holder can count on. */
const DEVELOPMENT_SHARE = 0.6;
/** The chance of completing a district, scaled by the share already held, open or blocked by a rival. */
const OPEN_COMPLETION = 0.4;
const BLOCKED_COMPLETION = 0.15;
const AVERAGE_DICE = 7;

/**
 * The view of the game a valuation works from. `naive` sees every space as equally likely, the
 * way a player who has never counted the odds would.
 */
export function outlook(state: GameState, naive = false): Outlook {
  const owned = DEED_SPACES.filter((space) => state.deeds[space]!.owner !== null).length;
  // Once the board is mostly sold, players sit in the lock-up rather than pay to leave.
  const odds = landingOdds(owned / DEED_SPACES.length > 0.75 ? 'long' : 'short');
  const even = odds.rollsPerTurn / odds.perTurn.length;
  // A Quick game ends on its last round; a Classic game runs until someone goes broke, so its
  // horizon never shrinks.
  const rounds =
    state.rules.mode === 'quick' ? Math.max(1, state.rules.rounds - state.round) : CLASSIC_HORIZON;
  let annuity = 0;
  for (let r = 1; r <= rounds; r++) annuity += DISCOUNT ** r;
  return {
    landing: naive ? odds.perTurn.map(() => even) : odds.perTurn,
    byCard: naive ? odds.byCard.map(() => 0) : odds.byCard,
    rivals: Math.max(1, seatsIn(state).length - 1),
    annuity,
    quick: state.rules.mode === 'quick',
  };
}

export function ownersOf(state: GameState): Owners {
  return state.deeds.map((deed) => deed?.owner ?? null);
}

function count(owners: Owners, seat: number, spaces: readonly number[]): number {
  return spaces.filter((space) => owners[space] === seat).length;
}

/** Expected rent a lot brings in each round, at a given building level. */
export function roundIncome(
  state: GameState,
  o: Outlook,
  owners: Owners,
  space: number,
  level: number,
): number {
  const owner = owners[space];
  if (owner === null || owner === undefined || state.deeds[space]!.mortgaged) return 0;
  const economy = deedOf(state, space);
  const kind = LAYOUT[space]!.kind;
  let rent: number;
  if (kind === 'transit') {
    rent = economy.rents[count(owners, owner, TRANSIT_SPACES) - 1]! * (1 + o.byCard[space]!);
  } else if (kind === 'utility') {
    const times = economy.rents[count(owners, owner, UTILITY_SPACES) - 1]!;
    rent = AVERAGE_DICE * (times * (1 - o.byCard[space]!) + economy.rents[1]! * o.byCard[space]!);
  } else {
    const complete = GROUPS[groupOf(space)!]!.every((s) => owners[s] === owner);
    rent = !complete
      ? economy.rents[0]!
      : level > 0
        ? economy.rents[level]!
        : economy.rents[0]! * 2;
  }
  return rent * o.landing[space]! * o.rivals;
}

/**
 * The best height to build a complete district to, evenly, and what it would add net of the
 * buildings' cost. In a Quick game buildings count at cost in the final reckoning, so most of
 * their price comes back; only the cash tied up is a real cost. `thrift` below 1 says coins are
 * plentiful, so what buildings earn matters more than what they cost.
 */
export function buildPlan(
  state: GameState,
  o: Outlook,
  owners: Owners,
  group: number,
  drive = 1,
  thrift = 1,
): { level: number; gain: number } {
  const lots = GROUPS[group]!;
  const costFactor = (o.quick ? 0.3 : 1) * thrift;
  const levels = lots.map((s) => state.deeds[s]!.level);
  const now = lots.reduce((sum, s, i) => sum + roundIncome(state, o, owners, s, levels[i]!), 0);
  let best = { level: Math.max(...levels), gain: 0 };
  for (let target = Math.max(...levels) + 1; target <= 5; target++) {
    let income = 0;
    let cost = 0;
    lots.forEach((s, i) => {
      const level = Math.max(levels[i]!, target);
      income += roundIncome(state, o, owners, s, level);
      cost += (level - levels[i]!) * deedOf(state, s).buildCost;
    });
    const gain = (income - now) * o.annuity * 0.85 * drive - cost * costFactor;
    if (gain > best.gain) best = { level: target, gain };
  }
  return best;
}

export function buildingUpside(
  state: GameState,
  o: Outlook,
  owners: Owners,
  group: number,
): number {
  return buildPlan(state, o, owners, group).gain;
}

/** Everything a seat would hold in the imagined `owners`, valued in coins. */
export function portfolioValue(state: GameState, o: Outlook, seat: number, owners: Owners): number {
  let value = 0;
  for (const space of DEED_SPACES) {
    if (owners[space] !== seat) continue;
    // Buildings stay on a lot when it changes hands.
    const deed = state.deeds[space]!;
    const level = deed.level;
    value += roundIncome(state, o, owners, space, level) * o.annuity;
    const economy = deedOf(state, space);
    // In a Quick game a deed counts at its price at the end; otherwise it is at least collateral.
    value += o.quick
      ? (deed.mortgaged ? economy.mortgage : economy.price) + level * economy.buildCost
      : deed.mortgaged
        ? 0
        : economy.mortgage * 0.3;
  }
  GROUPS.forEach((lots, group) => {
    const held = count(owners, seat, lots);
    if (held === 0) return;
    if (held === lots.length) {
      if (!lots.some((s) => state.deeds[s]!.mortgaged))
        value += buildingUpside(state, o, owners, group) * DEVELOPMENT_SHARE;
      return;
    }
    const blocked = lots.some((s) => owners[s] !== null && owners[s] !== seat);
    const chance = (blocked ? BLOCKED_COMPLETION : OPEN_COMPLETION) * (held / lots.length);
    value += chance * completedValue(state, o, seat, owners, group);
  });
  return value;
}

/** What the district would be worth to the seat if it held all of it, bare. */
function completedValue(
  state: GameState,
  o: Outlook,
  seat: number,
  owners: Owners,
  group: number,
): number {
  const imagined = owners.slice();
  for (const s of GROUPS[group]!) imagined[s] = seat;
  const income = GROUPS[group]!.reduce((sum, s) => sum + roundIncome(state, o, imagined, s, 0), 0);
  return income * o.annuity + buildingUpside(state, o, imagined, group) * DEVELOPMENT_SHARE;
}

/** What one more deed adds to a seat's holdings. */
export function marginalValue(
  state: GameState,
  o: Outlook,
  seat: number,
  space: number,
  owners: Owners = ownersOf(state),
): number {
  const before = portfolioValue(state, o, seat, owners);
  const after = owners.slice();
  after[space] = seat;
  return portfolioValue(state, o, seat, after) - before;
}

/** The most any rival would gain from a deed: what keeping it out of their hands is worth. */
export function denialValue(
  state: GameState,
  o: Outlook,
  seat: number,
  space: number,
  owners: Owners = ownersOf(state),
): number {
  let worst = 0;
  for (const rival of seatsIn(state)) {
    if (rival !== seat) worst = Math.max(worst, marginalValue(state, o, rival, space, owners));
  }
  return worst;
}

/** The table after a trade, and what each side gains by it (coins and deeds, in coins). */
export function tradeGains(
  state: GameState,
  o: Outlook,
  offer: TradeOffer,
): { from: number; to: number } {
  const before = ownersOf(state);
  const after = before.slice();
  for (const space of offer.give.deeds) after[space] = offer.to;
  for (const space of offer.get.deeds) after[space] = offer.from;
  const cards = offer.get.cards - offer.give.cards;
  const coins = offer.get.coins - offer.give.coins;
  const from =
    portfolioValue(state, o, offer.from, after) -
    portfolioValue(state, o, offer.from, before) +
    coins +
    cards * PARDON_VALUE;
  const to =
    portfolioValue(state, o, offer.to, after) -
    portfolioValue(state, o, offer.to, before) -
    coins -
    cards * PARDON_VALUE;
  return { from, to };
}

/** A pardon card saves the fine, give or take. */
export const PARDON_VALUE = 50;
