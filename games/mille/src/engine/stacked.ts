import { type CardId, type Kind, deckKinds } from './cards';
import { type HandRules, type HandState, HAND_SLOTS, dealHand } from './hand';

/**
 * A deck stacked on purpose: chosen hands for the seats and the next cards to be drawn, the rest
 * in kind order underneath. Used by the tests, the tutorial and the workbench scenes, never by
 * a real deal.
 */
export function stackedOrder(
  rules: HandRules,
  hands: readonly Kind[][],
  draws: readonly Kind[] = [],
): CardId[] {
  const kinds = deckKinds(rules.deck);
  const free = new Map<Kind, CardId[]>();
  kinds.forEach((kind, id) => {
    const ids = free.get(kind) ?? [];
    ids.push(id);
    free.set(kind, ids);
  });
  const take = (kind: Kind): CardId => {
    const id = free.get(kind)?.shift();
    if (id === undefined) throw new Error(`the deck has no more ${kind}`);
    return id;
  };
  const top: CardId[] = [];
  for (const hand of hands) {
    if (hand.length !== HAND_SLOTS - 1) throw new Error('a hand holds six cards');
    for (const kind of hand) top.push(take(kind));
  }
  for (const kind of draws) top.push(take(kind));
  const rest = [...free.values()].flat().sort((a, b) => a - b);
  // The top card is the last one: reverse what is dealt first.
  return [...rest.reverse(), ...top.reverse()];
}

export function stackedHand(
  rules: HandRules,
  hands: readonly Kind[][],
  draws: readonly Kind[] = [],
  starter = 0,
): HandState {
  return dealHand(rules, stackedOrder(rules, hands, draws), starter);
}
