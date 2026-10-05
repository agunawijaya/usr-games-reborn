import { type CardId, cardLabel, DECK_SIZE, isFullDeck, parseCard } from '@usr-games/kit/cards';

/**
 * Writes a deal by hand: name the cards that matter and the rest fill the gaps in suit order.
 * Used by the tests, the tutorial's easy deal and the hand-made challenges.
 */
export interface DealSpec {
  /** The reserve, bottom first (the last card named is on top). Up to 13. */
  stock?: readonly string[];
  /** The first foundation card; it sets the base rank. */
  base: string;
  /** The four tableau cards, left to right. */
  tableau?: readonly string[];
  /** The hand in dealing order: the first card named is dealt first. Up to 34. */
  hand?: readonly string[];
}

function card(text: string): CardId {
  const parsed = parseCard(text);
  if (parsed === null) throw new Error(`not a card: ${text}`);
  return parsed;
}

/**
 * The 52 cards in the original's deck order (see `openDeal`). Unnamed reserve cards go to the
 * bottom of the reserve and unnamed hand cards to the end of the hand.
 */
export function composeDeal(spec: DealSpec): CardId[] {
  const named = [
    ...(spec.stock ?? []),
    spec.base,
    ...(spec.tableau ?? []),
    ...(spec.hand ?? []),
  ].map(card);
  if (new Set(named).size !== named.length) throw new Error('a card is named twice');
  const spare = Array.from({ length: DECK_SIZE }, (_, i) => i).filter((c) => !named.includes(c));
  const fill = (cards: CardId[], size: number, atStart: boolean) => {
    const missing = spare.splice(0, size - cards.length);
    return atStart ? [...missing, ...cards] : [...cards, ...missing];
  };
  const stock = fill((spec.stock ?? []).map(card), 13, true);
  const tableau = fill((spec.tableau ?? []).map(card), 4, false);
  const hand = fill((spec.hand ?? []).map(card), 34, false);
  const deal = [...stock, card(spec.base), ...tableau, ...hand];
  if (!isFullDeck(deal)) throw new Error('the deal does not hold 52 different cards');
  return deal;
}

/** A compact text form of a deal, for notes and test names: `5♥ 9♣ … | 7♦ | …`. */
export function describeDeal(deal: readonly CardId[]): string {
  const part = (from: number, to: number) => deal.slice(from, to).map(cardLabel).join(' ');
  return `${part(0, 13)} | ${part(13, 14)} | ${part(14, 18)} | ${part(18, 52)}`;
}
