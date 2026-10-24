import { type CardId, parseCard } from '@usr-games/kit/cards';
import { restingPegs } from './arrange';
import { CARD } from './layout';
import type { Look } from './look';
import { emptyScene, type Scene } from './scene';

/**
 * The table behind the menus: the board with both pairs of pegs home in their start holes, the
 * lemonade or the cocoa, and a hand fanned face up on the wood (the perfect one, as a promise),
 * set to the right where the menu card does not cover it.
 */

const FAN: CardId[] = ['js', '5c', '5d', '5h', '5s'].map((text) => parseCard(text)!);

export function backdropScene(
  look: Look,
  time: number,
  still: boolean,
  scores: [number, number],
  names: [string, string],
): Scene {
  const centre = { x: 1110, y: 600 };
  const cards = FAN.map((card, i) => {
    const t = i / (FAN.length - 1) - 0.5;
    return {
      key: `card:${card}`,
      card,
      x: centre.x + t * 300,
      y: centre.y + Math.abs(t) * 40 - 10,
      height: CARD.show,
      angle: t * 0.5,
      lift: 0.15,
    };
  });
  return {
    ...emptyScene(look),
    time,
    still,
    names,
    plates: scores,
    pegs: restingPegs(scores, [0, 0], 121),
    stock: { at: { x: 1150, y: 250 }, cards: 52 },
    cards,
  };
}
