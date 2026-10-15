import { type HandState, type Side, other, safetiesPlayed } from './hand';

/**
 * The score of a hand, item by item, as the original's score window lists them (`end.c`,
 * `print.c`, `mille.h`). Every side scores its miles, safeties and coups; only a side that
 * completed the trip scores the trip bonuses.
 */

export const POINTS = {
  safety: 100,
  allSafeties: 300,
  coup: 300,
  trip: 400,
  safeTrip: 300,
  delayedAction: 300,
  extension: 200,
  shutOut: 500,
} as const;

export interface HandScore {
  milestones: number;
  safeties: number;
  allSafeties: number;
  coups: number;
  trip: number;
  safeTrip: number;
  delayedAction: number;
  extension: number;
  shutOut: number;
  total: number;
}

export type ScoreItem = Exclude<keyof HandScore, 'total'>;

export const SCORE_ITEMS: readonly ScoreItem[] = [
  'milestones',
  'safeties',
  'allSafeties',
  'coups',
  'trip',
  'safeTrip',
  'delayedAction',
  'extension',
  'shutOut',
];

/** Whether this side finished the trip (the original's `mileage == End`). */
export function completedTrip(state: HandState, side: Side): boolean {
  return state.sides[side].miles === state.end;
}

export function scoreSide(state: HandState, side: Side): HandScore {
  const tableau = state.sides[side];
  const safeties = safetiesPlayed(tableau);
  const score: HandScore = {
    milestones: tableau.miles,
    safeties: safeties * POINTS.safety,
    allSafeties: safeties === 4 ? POINTS.allSafeties : 0,
    coups: tableau.coups * POINTS.coup,
    trip: 0,
    safeTrip: 0,
    delayedAction: 0,
    extension: 0,
    shutOut: 0,
    total: 0,
  };
  if (state.over && completedTrip(state, side)) {
    score.trip = POINTS.trip;
    if (tableau.distanceCounts.m200 === 0) score.safeTrip = POINTS.safeTrip;
    if (state.deck.length === 0) score.delayedAction = POINTS.delayedAction;
    if (state.extendedBy !== null) score.extension = POINTS.extension;
    if (state.sides[other(side)].miles === 0) score.shutOut = POINTS.shutOut;
  }
  score.total = SCORE_ITEMS.reduce((sum, item) => sum + score[item], 0);
  return score;
}

export function scoreHand(state: HandState): [HandScore, HandScore] {
  return [scoreSide(state, 0), scoreSide(state, 1)];
}
