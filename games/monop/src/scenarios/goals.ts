import { LAYOUT, TRANSIT_SPACES, UTILITY_SPACES } from '../boards/layout';
import { BOARDS, type BoardId } from '../boards/themes';
import type { Ledger } from '../engine/ledger';
import { DEED_SPACES, GROUPS, holdings, netWorth, ownsGroup, seatsIn } from '../engine/state';
import type { Action, GameState } from '../engine/types';

/**
 * What a scenario asks of the player, and the rules it bends. A goal is plain data, so the same
 * description drives the brief, the progress line on the board and the referee's verdict.
 * Goals that can be met at any moment win the scenario the moment they are all met; a goal about
 * the end ("be the richest", "still be standing") is judged when the last round is over.
 */

export type Goal =
  /** Hold a whole district: a given one, or any (`count` of them at once). */
  | { readonly kind: 'district'; readonly group?: number; readonly count?: number }
  /** Raise landmarks: on a given district, or anywhere. */
  | { readonly kind: 'landmark'; readonly group?: number; readonly count?: number }
  /** Have this many storeys standing at once (a landmark counts as five). */
  | { readonly kind: 'storeys'; readonly count: number }
  | { readonly kind: 'worth'; readonly amount: number }
  | { readonly kind: 'rent'; readonly amount: number }
  | { readonly kind: 'transits'; readonly count: number }
  | { readonly kind: 'utilities'; readonly count: number }
  | { readonly kind: 'deals'; readonly count: number }
  /** See rivals leave the game. */
  | { readonly kind: 'knockout'; readonly count: number }
  /** Nothing of yours mortgaged. */
  | { readonly kind: 'clearMortgages' }
  /** Everyone else gone. */
  | { readonly kind: 'lastStanding' }
  /** At the end: the richest at the table. */
  | { readonly kind: 'richest' }
  /** At the end: still in the game, worth at least this much. */
  | { readonly kind: 'standing'; readonly worth: number };

/** Rules a scenario bends for the player only; rivals play as usual. */
export type Restriction = 'noStreets' | 'noTrades';

export interface Verdict {
  readonly won: boolean;
  /** The player's turns, counting the one in progress. */
  readonly turns: number;
  readonly reason: string;
}

const AT_THE_END: ReadonlySet<Goal['kind']> = new Set(['richest', 'standing']);

export function judgedAtTheEnd(goal: Goal): boolean {
  return AT_THE_END.has(goal.kind);
}

function storeysStanding(state: GameState, seat: number): number {
  return holdings(state, seat).reduce((sum, space) => sum + state.deeds[space]!.level, 0);
}

function heldOf(state: GameState, seat: number, spaces: readonly number[]): number {
  return spaces.filter((space) => state.deeds[space]!.owner === seat).length;
}

function landmarksOn(state: GameState, seat: number, group?: number): number {
  const lots = group === undefined ? holdings(state, seat) : GROUPS[group]!;
  return lots.filter((s) => state.deeds[s]!.owner === seat && state.deeds[s]!.level === 5).length;
}

/** How far along a goal is, as a number to reach a target: `have` of `need`. */
export function progress(
  goal: Goal,
  state: GameState,
  ledger: Ledger,
): { have: number; need: number } {
  const me = ledger.seat;
  switch (goal.kind) {
    case 'district':
      if (goal.group !== undefined)
        return {
          have: heldOf(state, me, GROUPS[goal.group]!),
          need: GROUPS[goal.group]!.length,
        };
      return {
        have: GROUPS.filter((_, g) => ownsGroup(state, me, g)).length,
        need: goal.count ?? 1,
      };
    case 'landmark':
      return {
        have:
          goal.group === undefined
            ? Math.max(ledger.landmarks, landmarksOn(state, me))
            : landmarksOn(state, me, goal.group),
        need: goal.count ?? 1,
      };
    case 'storeys':
      return { have: storeysStanding(state, me), need: goal.count };
    case 'worth':
      return { have: netWorth(state, me), need: goal.amount };
    case 'rent':
      return { have: ledger.rentCollected, need: goal.amount };
    case 'transits':
      return { have: heldOf(state, me, TRANSIT_SPACES), need: goal.count };
    case 'utilities':
      return { have: heldOf(state, me, UTILITY_SPACES), need: goal.count };
    case 'deals':
      return { have: ledger.trades, need: goal.count };
    case 'knockout':
      return { have: ledger.knockouts, need: goal.count };
    case 'clearMortgages':
      return {
        have: holdings(state, me).filter((s) => !state.deeds[s]!.mortgaged).length,
        need: holdings(state, me).length,
      };
    case 'lastStanding':
      return { have: state.seats.length - seatsIn(state).length, need: state.seats.length - 1 };
    case 'richest': {
      const worths = state.seats.map((_, seat) => netWorth(state, seat));
      return { have: worths[me]! >= Math.max(...worths) ? 1 : 0, need: 1 };
    }
    case 'standing':
      return {
        have: state.seats[me]!.out ? 0 : netWorth(state, me),
        need: goal.worth,
      };
  }
}

export function met(goal: Goal, state: GameState, ledger: Ledger): boolean {
  const { have, need } = progress(goal, state, ledger);
  return have >= need;
}

/**
 * The referee: won as soon as every goal that can be met mid-game is met (with no goal about
 * the end), lost when the player is out of the game, and otherwise decided when the game is over.
 */
export function judge(goals: readonly Goal[], state: GameState, ledger: Ledger): Verdict | null {
  const me = ledger.seat;
  const turns = Math.max(1, ledger.turns);
  if (state.seats[me]!.out)
    return { won: false, turns, reason: 'You ran out of coins before you got there.' };
  const finalGoals = goals.some(judgedAtTheEnd);
  const allMet = goals.every((goal) => met(goal, state, ledger));
  if (!finalGoals && allMet) return { won: true, turns, reason: 'Every goal met.' };
  if (state.phase.kind !== 'over') return null;
  if (allMet) return { won: true, turns, reason: 'Every goal met by the final round.' };
  return { won: false, turns, reason: 'The rounds ran out first.' };
}

const ORDINAL_WORDS = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];
const word = (n: number) => ORDINAL_WORDS[n] ?? String(n);
const plural = (n: number, one: string, many = `${one}s`) => `${word(n)} ${n === 1 ? one : many}`;

/** Each board's word for its transit stops, singular and plural. */
export const TRANSIT_WORDS: Readonly<Record<BoardId, readonly [string, string]>> = {
  harbour: ['ferry', 'ferries'],
  colony: ['shuttle pad', 'shuttle pads'],
  popup: ['railway halt', 'railway halts'],
};

/** The goal in a few words, in the board's own names: "Own the whole Fish Market". */
export function describeGoal(goal: Goal, board: BoardId): string {
  const theme = BOARDS[board];
  const [transit, transits] = TRANSIT_WORDS[board];
  switch (goal.kind) {
    case 'district':
      if (goal.group !== undefined) return `Own the whole ${theme.groups[goal.group]!.name}`;
      return (goal.count ?? 1) > 1
        ? `Own ${word(goal.count!)} whole districts at once`
        : 'Own a whole district';
    case 'landmark':
      if (goal.group !== undefined) return `Raise a landmark in ${theme.groups[goal.group]!.name}`;
      return (goal.count ?? 1) > 1 ? `Raise ${word(goal.count!)} landmarks` : 'Raise a landmark';
    case 'storeys':
      return `Have ${goal.count} storeys standing`;
    case 'worth':
      return `Be worth ${goal.amount.toLocaleString('en-GB')}`;
    case 'rent':
      return `Collect ${goal.amount.toLocaleString('en-GB')} in rent`;
    case 'transits':
      return goal.count === 4
        ? `Own all four ${transits}`
        : `Own ${plural(goal.count, transit, transits)}`;
    case 'utilities':
      return goal.count === 2 ? 'Own both utilities' : 'Own a utility';
    case 'deals':
      return `Make ${plural(goal.count, 'trade')}`;
    case 'knockout':
      return goal.count === 1
        ? 'Put a rival out of the game'
        : `Put ${word(goal.count)} rivals out`;
    case 'clearMortgages':
      return 'Pay off every mortgage';
    case 'lastStanding':
      return 'Be the last one at the table';
    case 'richest':
      return 'Finish the richest';
    case 'standing':
      return `Still be standing at the end, worth ${goal.worth.toLocaleString('en-GB')}`;
  }
}

/** The progress line under a goal on the board: "2 of 4", "1,250 of 1,500". */
export function progressText(goal: Goal, state: GameState, ledger: Ledger): string {
  if (goal.kind === 'richest') {
    const worths = state.seats.map((_, seat) => netWorth(state, seat));
    const ahead = worths[ledger.seat]! >= Math.max(...worths);
    return ahead ? 'you lead' : 'behind';
  }
  const { have, need } = progress(goal, state, ledger);
  const fmt = (n: number) => n.toLocaleString('en-GB');
  return `${fmt(Math.min(have, need))} of ${fmt(need)}`;
}

const isStreet = (space: number) => LAYOUT[space]!.kind === 'street';

/** Why a scenario's restrictions forbid the player this move, or null. */
export function restricted(
  restrictions: readonly Restriction[],
  state: GameState,
  seat: number,
  action: Action,
): string | null {
  const phase = state.phase;
  if (restrictions.includes('noTrades')) {
    if (
      action.type === 'propose' ||
      (action.type === 'answer' && (action.accept || action.counter))
    )
      return 'No trading in this scenario.';
  }
  if (!restrictions.includes('noStreets')) return null;
  const noStreets = 'Streets are off limits in this scenario.';
  switch (action.type) {
    case 'buy':
      return phase.kind === 'buy' && isStreet(phase.space) ? noStreets : null;
    case 'bid':
      return phase.kind === 'auction' && isStreet(phase.auction.space) ? noStreets : null;
    case 'propose':
      return action.offer.get.deeds.some(isStreet) ? noStreets : null;
    case 'answer': {
      if (phase.kind !== 'trade') return null;
      // An offer to the player hands them what its maker gives.
      if (action.accept && phase.offer.to === seat && phase.offer.give.deeds.some(isStreet))
        return noStreets;
      if (action.counter && action.counter.get.deeds.some(isStreet)) return noStreets;
      return null;
    }
    default:
      return null;
  }
}

/** Every street, for restrictions and pilots that need to know. */
export const STREETS: readonly number[] = DEED_SPACES.filter(isStreet);
