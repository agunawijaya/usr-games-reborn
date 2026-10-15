import { createRng } from '@usr-games/kit';
import { type CardId, type Rank, shuffledDeck } from '@usr-games/kit/cards';
import { describe, expect, it } from 'vitest';
import { diceFrom } from './chance';
import { seeEvent } from './events';
import type { FishState, Seat } from './game';
import { Knowledge } from './knowledge';
import { createMind, type MindName, MisoMind } from './minds';
import { Table, viewFor } from './table';

const card = (rank: Rank, suit = 0): CardId => suit * 13 + rank - 1;

/**
 * Another world the same seat could not tell apart from this one: every card it cannot see
 * (other hands, the pond) gathered and dealt out again at random, each hand keeping its size.
 */
function hiddenReshuffle(state: FishState, seat: number, seed: string): FishState {
  const hidden = [
    ...state.pond,
    ...state.seats.flatMap((s, index) => (index === seat ? [] : s.hand)),
  ];
  const shuffled = createRng(seed).shuffle(hidden);
  const seats = state.seats.map((s, index): Seat => {
    if (index === seat) return s;
    return { ...s, hand: shuffled.splice(0, s.hand.length) };
  });
  return { ...state, seats, pond: shuffled };
}

describe('Miso uses only public information', () => {
  it('chooses the same ask in every world that looks the same from her seat', () => {
    const lineups: MindName[][] = [
      ['otto', 'miso'],
      ['hazel', 'miso', 'otto'],
      ['otto', 'hazel', 'miso', 'reference'],
    ];
    let decisions = 0;
    let differentWorlds = 0;
    for (let game = 0; game < 30; game++) {
      const names = lineups[game % 3]!;
      const misoSeat = names.indexOf('miso');
      const rng = createRng(`boundary/${game}`);
      const table = new Table({
        rules: game % 2 ? 'all-books' : 'standard',
        minds: names.map((name, seat) => createMind(name, seat)),
        deck: shuffledDeck(rng.split('deck')),
        dice: diceFrom(rng),
      });
      while (!table.over) {
        if (table.turn === misoSeat) {
          const real = table.think();
          const twin = hiddenReshuffle(table.state, misoSeat, `twin/${game}/${decisions}`);
          if (JSON.stringify(twin.seats) !== JSON.stringify(table.state.seats)) differentWorlds++;
          // From her seat the twin world looks exactly the same …
          expect(viewFor(twin, misoSeat)).toEqual(viewFor(table.state, misoSeat));
          // … and a fresh Miso who heard the game from her seat asks the same in it.
          const fresh = new MisoMind(misoSeat);
          for (const event of table.log) fresh.observe(seeEvent(event, misoSeat));
          expect(fresh.choose(viewFor(twin, misoSeat), { below: () => 0 })).toEqual(real);
          decisions++;
        }
        table.step();
      }
    }
    expect(decisions).toBeGreaterThan(300);
    expect(differentWorlds).toBeGreaterThan(decisions * 0.9);
  });
});

describe('what the notebook and Miso can know', () => {
  function watcher() {
    const knowledge = new Knowledge(0);
    knowledge.observe({
      kind: 'deal',
      handCounts: [7, 7, 7],
      hand: [card(2), card(2, 1), card(5), card(7), card(9), card(11), card(13)],
      starter: 1,
    });
    return knowledge;
  }

  it('an ask proves the asker holds the rank', () => {
    const knowledge = watcher();
    knowledge.observe({ kind: 'ask', asker: 1, target: 2, rank: 9 });
    expect(knowledge.knownCount(1, 9)).toBe(1);
    expect(knowledge.chanceHolds(1, 9)).toBe(1);
  });

  it('"Go Fish!" proves the answerer holds none, until they draw unseen cards', () => {
    const knowledge = watcher();
    knowledge.observe({ kind: 'ask', asker: 1, target: 2, rank: 9 });
    knowledge.observe({ kind: 'go-fish', asker: 1, target: 2, rank: 9 });
    expect(knowledge.chanceHolds(2, 9)).toBe(0);
    knowledge.observe({ kind: 'draw', seat: 2, card: null, lucky: false, why: 'fish' });
    expect(knowledge.drawsSinceNone(2, 9)).toBe(1);
    expect(knowledge.chanceHolds(2, 9)).toBeGreaterThan(0);
    expect(knowledge.chanceHolds(2, 9)).toBeLessThan(0.2);
  });

  it('a handover moves what everybody saw, and a book ends the question', () => {
    const knowledge = watcher();
    knowledge.observe({ kind: 'ask', asker: 2, target: 1, rank: 7 });
    knowledge.observe({
      kind: 'give',
      from: 1,
      to: 2,
      rank: 7,
      cards: [card(7, 1), card(7, 2)],
    });
    expect(knowledge.knownCount(2, 7)).toBe(3);
    expect(knowledge.chanceHolds(1, 7)).toBe(0);
    expect(knowledge.handCount(2)).toBe(9);
    knowledge.observe({
      kind: 'book',
      seat: 2,
      rank: 7,
      golden: false,
      cards: [card(7), card(7, 1), card(7, 2), card(7, 3)],
    });
    expect(knowledge.isBooked(7)).toBe(true);
    expect(knowledge.chanceHolds(2, 7)).toBe(0);
  });

  it('with nothing shown, the odds follow the cards still unseen', () => {
    const knowledge = watcher();
    // Two of the twos are in our own hand, so a two is less likely elsewhere than a five.
    expect(knowledge.chanceHolds(1, 2)).toBeLessThan(knowledge.chanceHolds(1, 5));
    expect(knowledge.chanceHolds(1, 5)).toBeGreaterThan(0.3);
  });
});
