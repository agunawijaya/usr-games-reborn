import {
  LAYOUT,
  LOCKUP_INDEX,
  SPACE_COUNT,
  TRANSIT_SPACES,
  UTILITY_SPACES,
} from '../boards/layout';
import { DECK_SIZE, EFFECTS } from './cards';
import { nearestAhead } from './state';

/**
 * Where tokens land, as a Markov chain over one roll at a time. A state is a square plus how
 * many doubles have been rolled this turn, or a stay in the lock-up with its failed tries; the
 * chain follows the dice, the third double, the lock-up corner and every card that moves a
 * token. Its long-run distribution says how often a token lands on each space per turn, which
 * is what a deed is worth to its owner and what the coach's heat map shows.
 */

/** How a player leaves the lock-up: pay at once (early game) or roll for doubles (late game). */
export type LockupStay = 'short' | 'long';

export interface LandingOdds {
  /** Expected landings on each space during one player's turn (doubles can add more than one). */
  readonly perTurn: readonly number[];
  /** The share of those landings that came by a card sending the token to the nearest transit or utility. */
  readonly byCard: readonly number[];
  /** Expected rolls in a turn. */
  readonly rollsPerTurn: number;
  /** The chance a turn ends in the lock-up. */
  readonly lockupPerTurn: number;
}

interface Arrival {
  readonly at: number;
  readonly jailed: boolean;
  readonly p: number;
}

const DOUBLES_STATES = 3;
const JAIL_BASE = SPACE_COUNT * DOUBLES_STATES;
const STATE_COUNT = JAIL_BASE + 3;

const stateOf = (space: number, doubles: number) => space * DOUBLES_STATES + doubles;

/**
 * Follows a token from the space it stopped on through any cards it draws, recording every
 * landing (`landed`, `byCard`) and where it finally rests.
 */
function resolve(
  space: number,
  p: number,
  arrivals: Arrival[],
  landed: Float64Array,
  byCard: Float64Array,
  viaCard = false,
): void {
  landed[space]! += p;
  if (viaCard) byCard[space]! += p;
  const slot = LAYOUT[space]!;
  if (slot.kind === 'toLockup') {
    arrivals.push({ at: LOCKUP_INDEX, jailed: true, p });
    return;
  }
  if (slot.kind !== 'card') {
    arrivals.push({ at: space, jailed: false, p });
    return;
  }
  const share = p / DECK_SIZE;
  for (const effect of EFFECTS[slot.deck!]) {
    switch (effect.kind) {
      case 'advance':
        resolve(effect.to, share, arrivals, landed, byCard);
        break;
      case 'back':
        resolve(
          (space - effect.spaces + SPACE_COUNT) % SPACE_COUNT,
          share,
          arrivals,
          landed,
          byCard,
        );
        break;
      case 'lockup':
        arrivals.push({ at: LOCKUP_INDEX, jailed: true, p: share });
        break;
      case 'nearestTransit':
        resolve(nearestAhead(space, TRANSIT_SPACES), share, arrivals, landed, byCard, true);
        break;
      case 'nearestUtility':
        resolve(nearestAhead(space, UTILITY_SPACES), share, arrivals, landed, byCard, true);
        break;
      default:
        arrivals.push({ at: space, jailed: false, p: share });
    }
  }
}

interface Step {
  readonly next: Map<number, number>;
  readonly landed: Float64Array;
  readonly byCard: Float64Array;
}

function emptyStep(): Step {
  return {
    next: new Map(),
    landed: new Float64Array(SPACE_COUNT),
    byCard: new Float64Array(SPACE_COUNT),
  };
}

function addNext(step: Step, state: number, p: number): void {
  step.next.set(state, (step.next.get(state) ?? 0) + p);
}

/**
 * One roll from a square with `doubles` already rolled this turn. `freedByRoll` is the roll that
 * takes a token out of the lock-up: its doubles earn no further roll.
 */
function rollFrom(space: number, doubles: number, step: Step, freedByRoll: boolean): void {
  for (let a = 1; a <= 6; a++) {
    for (let b = 1; b <= 6; b++) {
      const p = 1 / 36;
      const double = a === b;
      if (!freedByRoll && double && doubles === 2) {
        addNext(step, JAIL_BASE, p);
        continue;
      }
      const arrivals: Arrival[] = [];
      resolve((space + a + b) % SPACE_COUNT, p, arrivals, step.landed, step.byCard);
      for (const arrival of arrivals) {
        if (arrival.jailed) addNext(step, JAIL_BASE, arrival.p);
        else
          addNext(step, stateOf(arrival.at, !freedByRoll && double ? doubles + 1 : 0), arrival.p);
      }
    }
  }
}

function buildSteps(stay: LockupStay): Step[] {
  const steps: Step[] = [];
  for (let space = 0; space < SPACE_COUNT; space++) {
    for (let doubles = 0; doubles < DOUBLES_STATES; doubles++) {
      const step = emptyStep();
      rollFrom(space, doubles, step, false);
      steps.push(step);
    }
  }
  for (let tries = 0; tries < 3; tries++) {
    const step = emptyStep();
    if (stay === 'short') {
      // Paying straight away: the turn goes on as an ordinary roll from the corner.
      rollFrom(LOCKUP_INDEX, 0, step, false);
    } else if (tries < 2) {
      // Doubles free the token and move it (no roll again); anything else waits another turn.
      freedByDoubles(step);
      addNext(step, JAIL_BASE + tries + 1, 30 / 36);
    } else {
      // The third try moves the token whatever the dice show.
      rollFrom(LOCKUP_INDEX, 0, step, true);
    }
    steps.push(step);
  }
  return steps;
}

/** The six doubles out of the lock-up, each 1/36, each moving the token with no roll again. */
function freedByDoubles(step: Step): void {
  for (let a = 1; a <= 6; a++) {
    const arrivals: Arrival[] = [];
    resolve((LOCKUP_INDEX + 2 * a) % SPACE_COUNT, 1 / 36, arrivals, step.landed, step.byCard);
    for (const arrival of arrivals)
      addNext(step, arrival.jailed ? JAIL_BASE : stateOf(arrival.at, 0), arrival.p);
  }
}

const cache = new Map<LockupStay, LandingOdds>();

export function landingOdds(stay: LockupStay = 'short'): LandingOdds {
  const cached = cache.get(stay);
  if (cached) return cached;
  const steps = buildSteps(stay);
  let pi = new Float64Array(STATE_COUNT);
  pi[stateOf(0, 0)] = 1;
  for (let iteration = 0; iteration < 5000; iteration++) {
    const next = new Float64Array(STATE_COUNT);
    steps.forEach((step, state) => {
      const weight = pi[state]!;
      if (weight === 0) return;
      for (const [to, p] of step.next) next[to]! += weight * p;
    });
    let change = 0;
    for (let i = 0; i < STATE_COUNT; i++) change += Math.abs(next[i]! - pi[i]!);
    pi = next;
    if (change < 1e-13) break;
  }

  const landed = new Float64Array(SPACE_COUNT);
  const byCard = new Float64Array(SPACE_COUNT);
  let turnStarts = 0;
  let jailings = 0;
  steps.forEach((step, state) => {
    const weight = pi[state]!;
    for (let space = 0; space < SPACE_COUNT; space++) {
      landed[space]! += weight * step.landed[space]!;
      byCard[space]! += weight * step.byCard[space]!;
    }
    // Every visit to a no-doubles-yet square or a lock-up state starts a turn.
    if (state >= JAIL_BASE || state % DOUBLES_STATES === 0) turnStarts += weight;
    jailings += weight * (step.next.get(JAIL_BASE) ?? 0);
  });

  const perTurn = [...landed].map((value) => value / turnStarts);
  const odds: LandingOdds = {
    perTurn,
    byCard: [...byCard].map((value, space) => (landed[space]! > 0 ? value / landed[space]! : 0)),
    rollsPerTurn: 1 / turnStarts,
    lockupPerTurn: jailings / turnStarts,
  };
  cache.set(stay, odds);
  return odds;
}
