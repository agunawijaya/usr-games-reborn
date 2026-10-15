import { isHazard, isSafety, SAFETIES } from '../src/engine/cards';
import type { HandEvent, HandState } from '../src/engine/hand';
import { type MatchState, newMatch, nextDriverAction, step } from '../src/engine/match';
import { cloneHand } from '../src/ai/sly';

/**
 * Finds real moments for the hero frames: hands of Classic against Classic, played from seeded
 * deals, and the first moment that looks the way a frame needs. Nothing is arranged by hand;
 * staging only chooses the moment.
 */

export interface Moment {
  seed: string;
  /** The hand just before the action. */
  before: HandState;
  /** The hand just after it. */
  after: HandState;
  events: HandEvent[];
  totals: [number, number];
  handNo: number;
}

function* moments(seed: string): Generator<Moment> {
  const match: MatchState = newMatch({
    teams: false,
    length: 'full',
    seed,
    drivers: ['classic', 'classic'],
  });
  for (let guard = 0; guard < 2000 && !match.over; guard++) {
    if (match.hand.over) break;
    const before = cloneHand(match.hand);
    const action = nextDriverAction(match);
    if (!action) break;
    const events = step(match, action);
    yield {
      seed,
      before,
      after: cloneHand(match.hand),
      events,
      totals: [...match.totals],
      handNo: match.handNo,
    };
  }
}

/** You have just thrown a hazard (a flat, ideally) at a rival who was rolling, mid-hand. */
export function findHazardMoment(seeds: readonly string[]): Moment {
  let best: { moment: Moment; score: number } | null = null;
  for (const seed of seeds) {
    for (const m of moments(seed)) {
      const play = m.events.find((e) => e.type === 'play' && e.seat === 0 && isHazard(e.kind));
      if (!play || play.type !== 'play' || play.pile !== 'battle') continue;
      const you = m.after.sides[0];
      const rival = m.after.sides[1];
      let score = 0;
      if (play.kind === 'flatTyre') score += 9;
      else if (play.kind === 'fenderBender' || play.kind === 'noFuel') score += 2;
      if (you.miles >= 275 && you.miles <= 475) score += 3;
      if (rival.miles >= 125 && rival.miles <= you.miles - 75) score += 3;
      if (you.canGo) score += 3;
      const kinds = Object.values(you.distanceCounts).filter((n) => n > 0).length;
      score += Math.min(3, kinds);
      score += Math.min(2, Object.values(rival.distanceCounts).filter((n) => n > 0).length);
      if (SAFETIES.some((s) => you.safeties[s] !== 'none')) score += 2;
      const hand = m.after.seats[0]!.hand.filter((c) => c !== null).map((c) => m.after.cards[c!]!);
      if (hand.some((k) => isSafety(k))) score += 2;
      if (new Set(hand).size >= 5) score += 1;
      if (m.after.deck.length >= 35 && m.after.deck.length <= 65) score += 1;
      if (!best || score > best.score) best = { moment: m, score };
    }
  }
  if (!best) throw new Error('no hazard moment found');
  return best.moment;
}

/** The rival has just thrown a hazard at you and you hold the safety that parries it. */
export function findCoupMoment(seeds: readonly string[]): Moment {
  let best: { moment: Moment; score: number } | null = null;
  for (const seed of seeds) {
    for (const m of moments(seed)) {
      const coup = m.events.find((e) => e.type === 'play' && e.seat === 0 && e.coup);
      if (!coup || coup.type !== 'play') continue;
      const you = m.before.sides[0];
      const rival = m.before.sides[1];
      let score = 0;
      if (coup.kind === 'roadSense' || coup.kind === 'runFlats') score += 3;
      if (you.miles >= 200 && you.miles <= 500) score += 3;
      if (rival.miles >= 150) score += 2;
      const apart = Math.abs(you.miles - rival.miles);
      if (apart >= 100 && apart <= 250) score += 4;
      score += Math.min(3, Object.values(you.distanceCounts).filter((n) => n > 0).length);
      if (m.before.deck.length >= 30) score += 1;
      if (!best || score > best.score) best = { moment: m, score };
    }
  }
  if (!best) throw new Error('no coup moment found');
  return best.moment;
}
