import { type CardId, cardName, rankLabel, rankOf, suitOf, suitSymbol } from '@usr-games/kit/cards';

/**
 * A small element builder: `h('button', { class: 'ft-button', onclick: go }, 'Deal')`. An
 * attribute whose name starts with `on` and whose value is a function becomes a listener; `true`
 * sets an empty attribute and `false` or `undefined` leaves it out.
 */

type Attributes = Record<string, string | number | boolean | undefined | ((event: Event) => void)>;
type Child = Node | string | number | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Attributes = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (value === undefined || value === false) continue;
    if (typeof value === 'function') {
      element.addEventListener(name.slice(2), value);
      continue;
    }
    element.setAttribute(name, value === true ? '' : String(value));
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    element.append(child instanceof Node ? child : String(child));
  }
  return element;
}

/** An inline SVG from markup we wrote ourselves (icons only, never anything a player typed). */
export function svg(markup: string): SVGSVGElement {
  const template = document.createElement('template');
  template.innerHTML = markup.trim();
  return template.content.firstElementChild as SVGSVGElement;
}

/**
 * A card written in text: its rank and a larger suit symbol in the suit's own colour (four
 * colours, so spades and clubs differ by more than their shape), read aloud as its name.
 */
export function cardChip(card: CardId): HTMLSpanElement {
  const suit = suitOf(card);
  return h(
    'span',
    { class: 'ft-chip', 'data-suit': suit, 'aria-label': cardName(card), role: 'img' },
    rankLabel(rankOf(card)),
    h('span', { class: 'ft-chip__suit', 'aria-hidden': 'true' }, suitSymbol(suit)),
  );
}

/** Several cards in text, with thin spaces between them. */
export function cardChips(cards: readonly CardId[]): HTMLSpanElement {
  return h('span', { class: 'ft-chips' }, ...cards.map(cardChip));
}
