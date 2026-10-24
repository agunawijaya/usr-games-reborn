import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { type CardId, cardLabel, parseCard } from '@usr-games/kit/cards';
import { classicDiscard, classicPlay, cribAdjust } from './classic';

const cards = (text: string): CardId[] =>
  text === '-'
    ? []
    : text.split(' ').map((word) => {
        const card = parseCard(word);
        if (card === null) throw new Error(`not a card: ${word}`);
        return card;
      });
const show = (list: readonly CardId[]) => list.map(cardLabel).join(' ');

const fixture = readFileSync(new URL('../testing/classic-positions.txt', import.meta.url), 'utf8')
  .split(/\r?\n/)
  .filter((line) => line && !line.startsWith('#'));

describe('Classic plays exactly like the C program', () => {
  it('lays away the same two cards in every recorded discard', () => {
    const discards = fixture.filter((line) => line.startsWith('discard'));
    expect(discards.length).toBeGreaterThanOrEqual(700);
    const wrong: string[] = [];
    for (const line of discards) {
      const [, whose, hand, answer] = /^discard (own|their) \| (.+) => (.+)$/.exec(line)!;
      const thrown = classicDiscard(cards(hand!), whose === 'own');
      const expected = cards(answer!);
      if (show([...thrown].sort()) !== show([...expected].sort())) {
        wrong.push(`${line}  (ours: ${show(thrown)})`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it('lays the same card in every recorded play', () => {
    const plays = fixture.filter((line) => line.startsWith('play'));
    expect(plays.length).toBeGreaterThanOrEqual(1600);
    const wrong: string[] = [];
    for (const line of plays) {
      const [, , hand, pile, answer] = /^play (\d+) \| (.+) \| (.+) => (.+)$/.exec(line)!;
      const card = classicPlay(cards(hand!), cards(pile!));
      if (card !== cards(answer!)[0]) wrong.push(`${line}  (ours: ${cardLabel(card)})`);
    }
    expect(wrong).toEqual([]);
  });

  it('rounds the crib table like the original adjust', () => {
    // A pair of fives is the richest gift to a crib; a king and a ten are among the poorest.
    expect(cribAdjust(cards('5c')[0]!, cards('5d')[0]!)).toBe(9);
    expect(cribAdjust(cards('kc')[0]!, cards('10d')[0]!)).toBe(3);
  });
});
