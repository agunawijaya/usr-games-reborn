import { type Kind, MILES, isDistance, isHazard, isSafety } from '../engine/cards';
import type { HandEvent, PlayVerdict } from '../engine/hand';
import { CARD_COPY } from './cards';

/**
 * What the table says: the helper's reason a card cannot go down, and a line for every play,
 * shown on the line of play and read out to screen readers. Seats are named by the caller.
 */

export function reasonFor(verdict: PlayVerdict, teams: boolean): string {
  const rival = teams ? 'The rivals are' : 'Your rival is';
  switch (verdict) {
    case 'draw-first':
      return 'Draw a card first.';
    case 'need-green':
      return 'You need a green light to roll.';
    case 'slow-zone':
      return 'In a slow zone only 25s and 50s go.';
    case 'over-trip':
      return 'That would take you past the end of the trip.';
    case 'two-long-hauls':
      return 'Two 200s already this hand: that is the limit.';
    case 'rival-stopped':
      return `${rival} already stopped.`;
    case 'rival-immune':
      return `${rival} safe from that for the rest of the hand.`;
    case 'rival-slowed':
      return `${rival} already in a slow zone.`;
    case 'nothing-to-fix':
      return 'Nothing of yours for it to fix.';
    case 'fix-first':
      return 'Fix the trouble first; the green light comes after.';
    case 'not-slowed':
      return 'You are not in a slow zone.';
    case 'already-rolling':
      return 'You are already rolling.';
    case 'not-your-turn':
      return 'Wait for your turn.';
    case 'decide-extension':
      return 'Decide on the extension first.';
    default:
      return '';
  }
}

/** One line for an event. `who` names a seat; `whose` names a side's piles ("your", "the rival's"). */
export function narrate(
  event: HandEvent,
  who: (seat: number) => string,
  sideName: (side: 0 | 1) => string,
  cardsOf: (card: number) => Kind,
): string | null {
  // "You drive", "Your rival drives": the verb agrees with whoever is named.
  const verb = (seat: number, you: string, they: string) => (who(seat) === 'You' ? you : they);
  const does = (seat: number, you: string, they: string) => `${who(seat)} ${verb(seat, you, they)}`;
  switch (event.type) {
    case 'play': {
      const name = CARD_COPY[event.kind].name;
      const seat = event.seat;
      if (event.coup) return `Coup fourré! ${does(seat, 'parry', 'parries')} with ${name}: +300.`;
      if (isDistance(event.kind))
        return `${does(seat, 'drive', 'drives')} ${MILES[event.kind]} miles.`;
      if (isHazard(event.kind))
        return `${does(seat, 'throw', 'throws')} ${article(name)} at ${sideName(event.side)}.`;
      if (isSafety(event.kind)) {
        return event.cleared
          ? `${does(seat, 'lay', 'lays')} ${name}, clearing the ${CARD_COPY[event.cleared].name.toLowerCase()}, and ${verb(seat, 'play', 'plays')} again.`
          : `${does(seat, 'lay', 'lays')} ${name} and ${verb(seat, 'play', 'plays')} again.`;
      }
      return `${does(seat, 'play', 'plays')} ${name}.`;
    }
    case 'discard':
      return `${does(event.seat, 'throw', 'throws')} away ${article(CARD_COPY[cardsOf(event.card)].name)}.`;
    case 'trip':
      return `${does(event.seat, 'reach', 'reaches')} ${event.miles} miles!`;
    case 'extension':
      return event.extend
        ? `${does(event.seat, 'extend', 'extends')} the trip to 1000 miles.`
        : `${does(event.seat, 'stop', 'stops')} at 700.`;
    case 'over':
      return event.reason === 'trip'
        ? 'The hand is over.'
        : 'Nobody can play on: the hand is over.';
    default:
      return null;
  }
}

function article(name: string): string {
  return /^[AEIOU]/.test(name) ? `an ${name}` : `a ${name}`;
}
