import { readFileSync } from 'node:fs';
import { hashString } from '@usr-games/kit';
import { type CardId, type Rank } from '@usr-games/kit/cards';
import { describe, expect, it } from 'vitest';
import type { Dice } from './chance';
import type { GameEvent } from './events';
import { BerkeleyMind, rankCounts, type SeatView } from './minds';
import { Table } from './table';
import { berkeleyDeck, cRandom } from './testing/c-random';

/**
 * The Classic 1993 rule set against the real program. `testing/berkeley-games.txt` holds 1200
 * games the C program played (built outside the repository; see docs/NOTES.md): a fixed
 * `srandom` seed, a scripted player and every ask, answer, draw, book and ending logged. Here
 * the same seed drives the C library's generator through our engine and our port of the
 * computer, and the two games must match event for event, number for number.
 */

interface GoldenGame {
  seed: number;
  strategy: number;
  proFromStart: boolean;
  proAt: number;
  events?: string;
  hash?: number;
}

function loadGolden(): GoldenGame[] {
  const text = readFileSync(new URL('./testing/berkeley-games.txt', import.meta.url), 'utf8');
  return text
    .split('\n')
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const [head, events, hash] = /^([^|#]+)(?:\|(.*)|#([0-9a-f]{8}))$/.exec(line)!.slice(1);
      const [seed, strategy, pro, proAt] = head!.trim().split(' ').map(Number);
      return {
        seed: seed!,
        strategy: strategy!,
        proFromStart: pro === 1,
        proAt: proAt!,
        events,
        hash: hash ? parseInt(hash, 16) : undefined,
      };
    });
}

const DIGITS = '0123456789abc';
const PLAYER = 0;
const COMPUTER = 1;
/** The harness wrote 0 for the computer and 1 for the player. */
const who = (seat: number) => (seat === PLAYER ? '1' : '0');
const rankDigit = (rank: Rank) => DIGITS[rank - 1]!;

/** The scripted player of the C harness, move for move. */
class ScriptedPlayer {
  private last = -1;
  constructor(private readonly strategy: number) {}

  choose(hand: readonly CardId[]): Rank {
    const counts = rankCounts(hand);
    let pick = -1;
    if (this.strategy === 0) {
      counts.forEach((count, index) => {
        if (count > 0 && (pick < 0 || count > counts[pick]!)) pick = index;
      });
    } else {
      for (let step = 1; step <= 13; step++) {
        const index = (this.last + step + 13) % 13;
        if (counts[index]! > 0) {
          pick = index;
          break;
        }
      }
    }
    this.last = pick;
    return (pick + 1) as Rank;
  }
}

function encode(event: GameEvent, dealing: boolean): string {
  switch (event.kind) {
    case 'deal':
      return `S${who(event.starter)}`;
    case 'ask':
      return `A${who(event.asker)}${rankDigit(event.rank)}`;
    case 'give':
      return `G${who(event.to)}${rankDigit(event.rank)}${event.cards.length}`;
    case 'draw':
      return `F${who(event.seat)}${DIGITS[event.card % 13]}`;
    case 'book':
      // The original kept a dealt book in hand without a word; only books made in play were told.
      return dealing ? '' : `B${who(event.seat)}${rankDigit(event.rank)}`;
    case 'end': {
      const taunt = !event.taunt ? 0 : event.winners[0] === PLAYER ? 1 : 2;
      return `E${event.books[COMPUTER]}.${event.books[PLAYER]}.${taunt}`;
    }
    default:
      return '';
  }
}

/** Plays one golden game through our engine and returns it in the harness's encoding. */
function replay(game: GoldenGame): string {
  const chance = cRandom(game.seed);
  const deck = berkeleyDeck(chance);
  // Golden fish are ours, from their own stream, so they never disturb the original's numbers.
  const dice: Dice = { rules: chance, golden: { below: () => 1 } };
  const computer = new BerkeleyMind(COMPUTER, { pro: game.proFromStart, peeks: true });
  const table = new Table({ rules: 'classic', minds: [null, computer], deck, dice, peeks: true });
  const player = new ScriptedPlayer(game.strategy);
  let out = table.log.map((event) => encode(event, true)).join('');
  let moves = 0;
  while (!table.over) {
    if (table.awaitingPerson) {
      moves++;
      if (game.proAt > 0 && moves === game.proAt && table.switchToPro(COMPUTER)) out += 'P';
      const rank = player.choose(table.state.seats[PLAYER]!.hand);
      out += table
        .play({ target: COMPUTER, rank })
        .map((e) => encode(e, false))
        .join('');
    } else {
      out += table
        .step()
        .map((e) => encode(e, false))
        .join('');
    }
  }
  return out;
}

const GOLDEN = loadGolden();

describe('Classic 1993 replays the Berkeley program', () => {
  it('has the recorded games to check against', () => {
    expect(GOLDEN.length).toBe(1200);
    expect(GOLDEN.filter((game) => game.events).length).toBe(40);
  });

  it('reproduces the C library generator', () => {
    // srandom(1): the first numbers glibc's random() returns.
    const random = cRandom(1);
    expect([random.random(), random.random(), random.random()]).toEqual([
      1804289383, 846930886, 1681692777,
    ]);
  });

  it('matches forty recorded games event for event', () => {
    for (const game of GOLDEN.filter((g) => g.events)) {
      expect(replay(game), `seed ${game.seed}`).toBe(game.events);
    }
  });

  it('matches 1160 more recorded games by their fingerprints', () => {
    const mismatches = GOLDEN.filter((g) => g.hash !== undefined)
      .filter((game) => hashString(replay(game)) !== game.hash)
      .map((game) => game.seed);
    expect(mismatches).toEqual([]);
  });

  it('includes the one game whose ending drew the rare taunt', () => {
    const tauntGame = GOLDEN.find((game) => game.seed === 168)!;
    expect(replay(tauntGame).endsWith('E7.4.2')).toBe(true);
  });
});

describe('the Berkeley minds', () => {
  const view = (hand: CardId[], seat = 1): SeatView => ({
    seat,
    hand,
    handCounts: seat === 1 ? [7, hand.length] : [hand.length, 7],
    pond: 30,
    books: [[], []],
  });
  const never = { below: () => 0 };
  // Cards by rank: an ace of clubs is 0, a two of clubs 1, and so on.
  const card = (rank: Rank, suit = 0) => suit * 13 + rank - 1;

  it('asks in rotation from the two, skipping ranks not held', () => {
    const otto = new BerkeleyMind(1, { pro: false });
    const hand = [card(1), card(4), card(4, 1), card(9), card(13)];
    const asked = Array.from({ length: 6 }, () => otto.choose(view(hand), never).rank);
    expect(asked).toEqual([4, 9, 13, 1, 4, 9]);
  });

  it('asks a two first when it holds one, and the ace last', () => {
    const otto = new BerkeleyMind(1, { pro: false });
    const hand = [card(1), card(2), card(3)];
    const asked = Array.from({ length: 3 }, () => otto.choose(view(hand), never).rank);
    expect(asked).toEqual([2, 3, 1]);
  });

  it('in pro mode asks back a rank the player asked for, once it holds it (promove)', () => {
    const hazel = new BerkeleyMind(1, { pro: true });
    hazel.observe({ kind: 'ask', asker: 0, target: 1, rank: 8 });
    // Without an eight it cannot ask back; with one it asks the player for eights at once.
    const withoutEight = hazel.choose(view([card(3), card(5)]), { below: () => 0 });
    expect(withoutEight.rank).not.toBe(8);
    const withEight = hazel.choose(view([card(3), card(8)]), { below: () => 0 });
    expect(withEight).toEqual({ target: 0, rank: 8 });
    // The memory is spent once used, as in the original.
    const again = hazel.choose(view([card(3), card(8)]), { below: () => 0 });
    expect(again.rank).toBe(3);
  });

  it('in pro mode one time in three asks for its biggest group', () => {
    const hazel = new BerkeleyMind(1, { pro: true });
    const choice = hazel.choose(view([card(3), card(9), card(9, 1), card(12)]), {
      below: (n) => (n === 3 ? 1 : 0),
    });
    expect(choice.rank).toBe(9);
  });

  it('peeks one time in 1024 only when the rule set hands it a look', () => {
    const playerHand = [card(12, 2)];
    const rolls = { below: (n: number) => (n === 1024 ? 0o723 : 0) };
    const peek = { handOf: () => playerHand };
    const honest = new BerkeleyMind(1, { pro: true });
    expect(honest.choose(view([card(3), card(12)]), rolls, peek).rank).toBe(3);
    const classic = new BerkeleyMind(1, { pro: true, peeks: true });
    expect(classic.choose(view([card(3), card(12)]), rolls, peek).rank).toBe(12);
  });
});
