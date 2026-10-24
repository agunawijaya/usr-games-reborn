import { createRng, type Rng } from '@usr-games/kit';
import { type Mind } from './ai/minds';
import {
  discardView,
  hasLaidAway,
  layAway,
  type MatchEvent,
  type MatchOptions,
  type MatchState,
  needsClaim,
  nextHand,
  playCard,
  playView,
  RIVAL,
  type Seat,
  showNext,
  startMatch,
  type Step,
  YOU,
} from './match';

/**
 * Two computer players playing a whole game against each other: for the balance simulations,
 * the attract-mode demo and the tests. Seat 0 claims its hands correctly when a counting mode
 * asks for a claim.
 */

export interface Seats {
  minds: [Mind, Mind];
  rngs: [Rng, Rng];
}

export function seatsFor(minds: [Mind, Mind], seed: string): Seats {
  const base = createRng(`${seed}:minds`);
  return { minds, rngs: [base.split('seat-0'), base.split('seat-1')] };
}

/** The next action for whoever must act, or null when the game is over. */
export function autoStep(state: MatchState, seats: Seats): Step | null {
  switch (state.phase) {
    case 'discard': {
      const seat: Seat = hasLaidAway(state, YOU) ? RIVAL : YOU;
      const thrown = seats.minds[seat].layAway(discardView(state, seat), seats.rngs[seat]);
      return layAway(state, seat, thrown);
    }
    case 'play': {
      const seat = state.play!.turn;
      const card = seats.minds[seat].play(playView(state, seat), seats.rngs[seat]);
      return playCard(state, seat, card);
    }
    case 'show': {
      if (!needsClaim(state)) return showNext(state);
      // A computer in seat 0 always knows the true count.
      const preview = showNext({ ...state, options: { ...state.options, counting: 'automatic' } });
      const shown = preview.events.find((event) => event.type === 'shown');
      return showNext(state, shown && shown.type === 'shown' ? shown.count.total : 0);
    }
    case 'hand-over':
      return nextHand(state);
    case 'game-over':
      return null;
  }
}

export interface PlayedGame {
  state: MatchState;
  events: MatchEvent[];
  hands: number;
}

export function playGame(options: MatchOptions, seed: string, minds: [Mind, Mind]): PlayedGame {
  const seats = seatsFor(minds, seed);
  let step: Step | null = startMatch(options, seed);
  const events: MatchEvent[] = [...step.events];
  let state = step.state;
  for (let guard = 0; guard < 5000; guard++) {
    step = autoStep(state, seats);
    if (!step) break;
    state = step.state;
    events.push(...step.events);
  }
  if (state.phase !== 'game-over') throw new Error('the game did not finish');
  return { state, events, hands: state.hand };
}
