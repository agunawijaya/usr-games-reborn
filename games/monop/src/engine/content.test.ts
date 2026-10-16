import { describe, expect, it } from 'vitest';
import { BOARD_IDS, BOARDS } from '../boards/themes';
import { DECK_SIZE, EFFECTS, cardText } from './cards';
import { HOUSE_RULE_NAMES } from './rules';
import { PERSONALITIES } from './rivals';

/** Words from the published property game that must never appear in ours. */
const FORBIDDEN =
  /\b(monopoly|hasbro|parker|chance|community chest|free parking|jail|boardwalk|park place|mayfair|get out of)\b/i;

function everyText(): string[] {
  const texts: string[] = [];
  for (const id of BOARD_IDS) {
    const board = BOARDS[id];
    texts.push(
      board.name,
      board.tagline,
      board.decks.a,
      board.decks.b,
      ...board.spaces,
      ...board.groups.map((g) => g.name),
      ...board.tokens.map((t) => t.name),
    );
    for (const deck of ['a', 'b'] as const)
      for (let card = 0; card < DECK_SIZE; card++) texts.push(cardText(id, deck, card));
  }
  for (const p of Object.values(PERSONALITIES)) texts.push(p.name, p.title, p.blurb);
  for (const rule of Object.values(HOUSE_RULE_NAMES)) texts.push(rule.label, rule.detail);
  return texts;
}

describe('our own words', () => {
  it('never borrow the published game’s names', () => {
    for (const text of everyText()) expect(text).not.toMatch(FORBIDDEN);
    for (const id of BOARD_IDS) expect(BOARDS[id].spaces[0]).not.toBe('Go');
  });

  it('give every card a text on every board, with its spaces filled in', () => {
    for (const id of BOARD_IDS) {
      for (const deck of ['a', 'b'] as const) {
        expect(EFFECTS[deck]).toHaveLength(DECK_SIZE);
        for (let card = 0; card < DECK_SIZE; card++) {
          const text = cardText(id, deck, card);
          expect(text).not.toMatch(/[{}]/);
          expect(text.length).toBeLessThan(120);
        }
      }
    }
  });

  it('state the amount a money card pays or charges', () => {
    for (const id of BOARD_IDS) {
      for (const deck of ['a', 'b'] as const) {
        EFFECTS[deck].forEach((effect, card) => {
          if ('amount' in effect) expect(cardText(id, deck, card)).toContain(String(effect.amount));
          if (effect.kind === 'repairs')
            expect(cardText(id, deck, card)).toContain(`${effect.storey} for each storey`);
        });
      }
    }
  });

  it('keep the nod to the original’s eleven-coin prize', () => {
    expect(EFFECTS.a.some((e) => e.kind === 'collect' && e.amount === 11)).toBe(true);
  });
});
