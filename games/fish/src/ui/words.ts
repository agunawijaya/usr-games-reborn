import { type Rank, rankLabel } from '@usr-games/kit/cards';
import type { SeatEvent } from '../engine/events';

/**
 * Everything the pond says in words: names, ranks spoken aloud, the notebook's log lines and the
 * screen reader's announcements. All of it is ours; none of the original's messages are used.
 */

const RANK_WORDS = [
  ['ace', 'aces'],
  ['two', 'twos'],
  ['three', 'threes'],
  ['four', 'fours'],
  ['five', 'fives'],
  ['six', 'sixes'],
  ['seven', 'sevens'],
  ['eight', 'eights'],
  ['nine', 'nines'],
  ['ten', 'tens'],
  ['jack', 'jacks'],
  ['queen', 'queens'],
  ['king', 'kings'],
] as const;

export function rankWord(rank: Rank, count = 2): string {
  const [one, many] = RANK_WORDS[rank - 1]!;
  return count === 1 ? one : many;
}

export function rankShort(rank: Rank): string {
  return rankLabel(rank);
}

const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four'];

export function countWord(count: number): string {
  return NUMBER_WORDS[count] ?? String(count);
}

/** A seat's name in a sentence: "you" for the player, the rival's name otherwise. */
export interface Names {
  of(seat: number): string;
  /** Capitalised for the start of a sentence. */
  title(seat: number): string;
}

export function namesFor(rivals: readonly string[]): Names {
  const of = (seat: number) => (seat === 0 ? 'you' : (rivals[seat - 1] ?? `seat ${seat}`));
  return { of, title: (seat) => (seat === 0 ? 'You' : of(seat)) };
}

export interface LogLine {
  /** Parts in order; `who` parts are names, `good` parts are good news. */
  parts: readonly { text: string; kind?: 'who' | 'good' }[];
}

/**
 * One notebook line for an event the player saw, or null for events the notebook leaves out
 * (deals, turns, cards drawn in secret). Asks are folded into the answer that follows them.
 */
export function logLine(
  event: SeatEvent,
  previous: SeatEvent | undefined,
  names: Names,
): LogLine | null {
  switch (event.kind) {
    case 'give':
      return {
        parts: [
          { text: names.title(event.to), kind: 'who' },
          {
            text: ` took ${countWord(event.cards.length)} ${rankWord(event.rank, event.cards.length)} from `,
          },
          { text: names.of(event.from), kind: 'who' },
        ],
      };
    case 'go-fish':
      return {
        parts: [
          { text: names.title(event.asker), kind: 'who' },
          { text: ` asked ` },
          { text: names.of(event.target), kind: 'who' },
          { text: ` for ${rankWord(event.rank)}: Go fish!` },
        ],
      };
    case 'draw':
      if (!event.lucky || previous?.kind !== 'go-fish') return null;
      return {
        parts: [
          { text: 'Lucky catch: ', kind: 'good' },
          { text: names.of(event.seat), kind: 'who' },
          { text: ` fished up a ${rankWord(previous.rank, 1)}` },
        ],
      };
    case 'book':
      return {
        parts: [
          { text: names.title(event.seat), kind: 'who' },
          {
            text: ` made a book of ${rankWord(event.rank)}${event.golden ? ', a golden one!' : ''}`,
            kind: event.seat === 0 ? 'good' : undefined,
          },
        ],
      };
    default:
      return null;
  }
}

export function lineText(line: LogLine): string {
  return line.parts.map((part) => part.text).join('');
}
