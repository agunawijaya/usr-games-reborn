import type { Rank } from '@usr-games/kit/cards';
import type { Chance } from '../chance';
import type { Ask } from '../game';
import { anyOpponent, type Mind, rankCounts, type SeatView } from './mind';

/**
 * The yardstick for balance runs: no memory at all, any rank in hand, anyone with cards. Every
 * rival's win rate is measured against it (see docs/NOTES.md).
 */
export class ReferenceMind implements Mind {
  readonly name = 'reference';
  readonly seat: number;

  constructor(seat: number) {
    this.seat = seat;
  }

  observe(): void {}

  choose(view: SeatView, chance: Chance): Ask {
    const held = rankCounts(view.hand).flatMap((count, index) => (count > 0 ? [index] : []));
    const index = held[chance.below(held.length)]!;
    return { target: anyOpponent(view, chance), rank: (index + 1) as Rank };
  }
}
