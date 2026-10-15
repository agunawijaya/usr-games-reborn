import type { Rank } from '@usr-games/kit/cards';
import type { Chance } from '../chance';
import type { SeatEvent } from '../events';
import type { Ask } from '../game';
import { Knowledge } from '../knowledge';
import { askableSeats, type Mind, rankCounts, type SeatView } from './mind';

/**
 * Miso, a new and stronger mind: she remembers every ask, every answer and every card that
 * changed hands, and works out who most likely holds what. She learns only from her own seat's
 * view of the events (see `Knowledge`), never from hidden cards, which the information-boundary
 * test proves.
 *
 * How she asks, in order:
 * 1. A sure thing: a rank somebody is known to hold (they asked for it and still have it). Of
 *    several, the one that brings her nearest a book, then the bigger haul.
 * 2. Otherwise her biggest group, put to whoever most likely holds it. Chasing the rank she holds
 *    most completes books sooner and keeps telling the table about one rank, not many; in the
 *    balance runs it beat chasing the best odds (docs/NOTES.md).
 * 3. Never a rank somebody has just said "Go Fish!" to, unless they have drawn since.
 */

const SURE = 1000;
const ODDS_WEIGHT = 0.5;
/** Below this chance a holder was just shown to have none; the ask would be wasted. */
const JUST_DENIED = 0.03;
const DENIED_PENALTY = 5;

export class MisoMind implements Mind {
  readonly name = 'miso';
  readonly seat: number;
  readonly knowledge: Knowledge;

  constructor(seat: number) {
    this.seat = seat;
    this.knowledge = new Knowledge(seat);
  }

  observe(event: SeatEvent): void {
    this.knowledge.observe(event);
  }

  choose(view: SeatView, _chance: Chance): Ask {
    const counts = rankCounts(view.hand);
    let best: Ask | null = null;
    let bestScore = -Infinity;
    for (let index = 0; index < 13; index++) {
      if (counts[index] === 0) continue;
      const rank = (index + 1) as Rank;
      for (const target of askableSeats(view)) {
        const score = this.weigh(target, rank, counts[index]!);
        if (score > bestScore) {
          bestScore = score;
          best = { target, rank };
        }
      }
    }
    if (!best) throw new Error(`seat ${this.seat} has nothing to ask`);
    return best;
  }

  private weigh(target: number, rank: Rank, held: number): number {
    const odds = this.knowledge.chanceHolds(target, rank);
    if (odds >= 1) return SURE + held + this.knowledge.knownCount(target, rank);
    return held + ODDS_WEIGHT * odds - (odds < JUST_DENIED ? DENIED_PENALTY : 0);
  }
}
