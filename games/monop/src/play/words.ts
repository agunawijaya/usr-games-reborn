import { BOARDS } from '../boards/themes';
import { cardText } from '../engine/cards';
import type { GameEvent, GameState, TradeBundle } from '../engine/types';

/**
 * What the table says about each event, for the banner and the "what happened" list. Short,
 * plain and in the second person for the player at the table; amounts in coins, never a
 * currency.
 */

export function who(state: GameState, seat: number): string {
  return state.seats[seat]!.kind === 'human' && humanCount(state) === 1
    ? 'You'
    : state.seats[seat]!.name;
}

function humanCount(state: GameState): number {
  return state.seats.filter((s) => s.kind === 'human').length;
}

/** "You pay" or "Dex pays": the verb agrees with who. */
function verb(state: GameState, seat: number, base: string, third: string): string {
  return `${who(state, seat)} ${who(state, seat) === 'You' ? base : third}`;
}

const n = (amount: number) => amount.toLocaleString('en-GB');

export function space(state: GameState, index: number): string {
  return BOARDS[state.board].spaces[index]!;
}

function bundle(state: GameState, b: TradeBundle): string {
  const parts = b.deeds.map((d) => space(state, d));
  if (b.coins > 0) parts.push(`${n(b.coins)} coins`);
  if (b.cards > 0) parts.push(b.cards === 1 ? 'a pardon card' : `${b.cards} pardon cards`);
  return parts.length ? parts.join(', ') : 'nothing';
}

/** One line for an event, or null for those the table does not announce. */
export function describe(event: GameEvent, state: GameState): string | null {
  switch (event.type) {
    case 'rolled':
      return `${verb(state, event.seat, 'roll', 'rolls')} ${event.dice[0] + event.dice[1]}${event.dice[0] === event.dice[1] ? ', doubles' : ''}`;
    case 'moved':
      if (event.steps === 0) return null;
      return event.steps < 0
        ? `${verb(state, event.seat, 'go', 'goes')} back to ${space(state, event.to)}`
        : `${verb(state, event.seat, 'land', 'lands')} on ${space(state, event.to)}`;
    case 'salary':
      return `${verb(state, event.seat, 'collect', 'collects')} ${n(event.amount)} pay`;
    case 'bought':
      return `${verb(state, event.seat, 'buy', 'buys')} ${space(state, event.space)} for ${n(event.price)}`;
    case 'rent':
      return `${verb(state, event.from, 'pay', 'pays')} ${who(state, event.to) === 'You' ? 'you' : who(state, event.to)} ${n(event.amount)} at ${space(state, event.space)}`;
    case 'transfer':
      return `${verb(state, event.from, 'give', 'gives')} ${who(state, event.to) === 'You' ? 'you' : who(state, event.to)} ${n(event.amount)}`;
    case 'paid':
      return `${verb(state, event.seat, 'pay', 'pays')} ${n(event.amount)}${event.reason === 'tax' ? ' in dues' : event.reason === 'fine' ? ' to leave the lock-up' : event.reason === 'repairs' ? ' for repairs' : ''}`;
    case 'collected':
      return `${verb(state, event.seat, 'collect', 'collects')} ${n(event.amount)}${event.reason === 'pot' ? ' from the pot' : ''}`;
    case 'card':
      return `${BOARDS[state.board].decks[event.deck]}: ${cardText(state.board, event.deck, event.card)}`;
    case 'auctionOpened':
      return `${space(state, event.space)} goes to auction`;
    case 'bid':
      return `${verb(state, event.seat, 'bid', 'bids')} ${n(event.amount)}`;
    case 'auctionWon':
      return event.seat === null
        ? `Nobody bids; ${space(state, event.space)} stays for sale`
        : `${verb(state, event.seat, 'win', 'wins')} ${space(state, event.space)} for ${n(event.amount)}`;
    case 'built':
      return event.level === 5
        ? `A landmark rises on ${space(state, event.space)}`
        : `${verb(state, event.seat, 'build', 'builds')} a storey on ${space(state, event.space)}`;
    case 'sold':
      return `${verb(state, event.seat, 'sell', 'sells')} a storey on ${space(state, event.space)}`;
    case 'mortgaged':
      return `${verb(state, event.seat, event.unmortgaged ? 'pay off' : 'mortgage', event.unmortgaged ? 'pays off' : 'mortgages')} ${space(state, event.space)}`;
    case 'lockup':
      return `${who(state, event.seat) === 'You' ? 'You go' : `${who(state, event.seat)} goes`} to ${space(state, 10)}`;
    case 'free':
      return `${who(state, event.seat) === 'You' ? 'You are' : `${who(state, event.seat)} is`} out of ${space(state, 10)}`;
    case 'debt':
      return `${who(state, event.seat) === 'You' ? 'You are' : `${who(state, event.seat)} is`} ${n(event.amount)} short`;
    case 'traded':
      return `Deal: ${who(state, event.offer.from)} ${who(state, event.offer.from) === 'You' ? 'give' : 'gives'} ${bundle(state, event.offer.give)} for ${bundle(state, event.offer.get)}`;
    case 'declinedTrade':
      return null;
    case 'resigned':
      return `${who(state, event.seat)} ${who(state, event.seat) === 'You' ? 'leave' : 'leaves'} the table`;
    case 'turn':
      return null;
    case 'round':
      return null;
    case 'over':
      return event.winner === null
        ? 'The game is over'
        : `${who(state, event.winner)} ${who(state, event.winner) === 'You' ? 'win' : 'wins'}!`;
  }
}
