import { type CardId, JACK, rankOf, suitIndexOf } from '@usr-games/kit/cards';

/**
 * Cribbage's view of a card. The kit numbers cards 0–51 (suit × 13 + rank − 1, clubs first);
 * cribbage cares about three things on top of that: the rank (runs and pairs), the counting
 * value (fifteens and the count to 31, where court cards are worth ten) and the suit (flushes
 * and his nobs).
 */

export type { CardId };

/** The value a card adds to a fifteen or to the count: ace 1, two to ten face value, courts 10. */
export function valueOf(card: CardId): number {
  return Math.min(10, rankOf(card));
}

export function isJack(card: CardId): boolean {
  return rankOf(card) === JACK;
}

export function sameSuit(a: CardId, b: CardId): boolean {
  return suitIndexOf(a) === suitIndexOf(b);
}

/** Lowest rank first, then the kit's suit order: how a hand is fanned in the player's grip. */
export function byRank(a: CardId, b: CardId): number {
  return rankOf(a) - rankOf(b) || suitIndexOf(a) - suitIndexOf(b);
}

export function sortByRank(cards: readonly CardId[]): CardId[] {
  return [...cards].sort(byRank);
}

/** Every way to choose `k` items from `items`, in lexicographic index order. */
export function combinations<T>(items: readonly T[], k: number): T[][] {
  const out: T[][] = [];
  const pick: T[] = [];
  const walk = (start: number) => {
    if (pick.length === k) {
      out.push([...pick]);
      return;
    }
    for (let i = start; i <= items.length - (k - pick.length); i++) {
      pick.push(items[i]!);
      walk(i + 1);
      pick.pop();
    }
  };
  walk(0);
  return out;
}
