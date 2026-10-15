import { createRng } from '@usr-games/kit';
import { rankOf, shuffledDeck } from '@usr-games/kit/cards';
import { diceFrom } from '../src/engine/chance';
import { type GameEvent, type SeatEvent, seeEvent } from '../src/engine/events';
import type { FishState } from '../src/engine/game';
import { Knowledge } from '../src/engine/knowledge';
import { createMind, type MindName } from '../src/engine/minds';
import type { RuleSetId } from '../src/engine/rules';
import { Table } from '../src/engine/table';
import { type LogLine, logLine, namesFor } from '../src/ui/words';

/**
 * Finds real moments for the hero frames: seeded games played to the end, seat 0 played by a
 * careful stand-in for the player, and the first moment that looks the way a frame needs.
 * Nothing is arranged by hand; staging only chooses the moment.
 */

export const RIVAL_NAMES = ['Otto', 'Hazel', 'Miso'];
const LINEUP: MindName[] = ['miso', 'otto', 'hazel', 'miso'];

export interface Moment {
  /** The state just before the player asks. */
  state: FishState;
  /** The log up to this moment. */
  log: GameEvent[];
  knowledge: Knowledge;
  lines: LogLine[];
  /** What the player's ask brings, for frames that show it under way. */
  next: GameEvent[];
}

function newTable(seed: string, rules: RuleSetId): Table {
  const rng = createRng(seed);
  return new Table({
    rules,
    minds: LINEUP.map((name, seat) => createMind(name, seat)),
    deck: shuffledDeck(rng.split('deck')),
    dice: diceFrom(rng),
    mindChance: (seat) => {
      const stream = rng.split(`mind/${seat}`);
      return { below: (n) => stream.int(0, n - 1) };
    },
  });
}

export function notebookFor(log: readonly GameEvent[]): { knowledge: Knowledge; lines: LogLine[] } {
  const knowledge = new Knowledge(0);
  const names = namesFor(RIVAL_NAMES);
  const lines: LogLine[] = [];
  let previous: SeatEvent | undefined;
  for (const event of log) {
    const seen = seeEvent(event, 0);
    knowledge.observe(seen);
    const line = logLine(seen, previous, names);
    if (line) lines.unshift(line);
    previous = seen;
  }
  return { knowledge, lines };
}

/** Plays seeded games and returns the first moment `accept` likes, just before seat 0 asks. */
function findMoment(
  rules: RuleSetId,
  accept: (state: FishState, log: readonly GameEvent[], next: GameEvent[]) => boolean,
): Moment {
  for (let game = 0; game < 400; game++) {
    const table = newTable(`hero/${game}`, rules);
    while (!table.over) {
      if (table.turn !== 0) {
        table.step();
        continue;
      }
      // The state is immutable, so holding on to it is a snapshot of this moment.
      const state = table.state;
      const log = [...table.log];
      const next = table.step();
      if (accept(state, log, next)) return { state, log, ...notebookFor(log), next };
    }
  }
  throw new Error('no moment found');
}

const books = (state: FishState, seat: number) => state.seats[seat]!.books.length;

/** Mid-game: a full hand, a few fish in every bucket, a notebook with a story in it. */
export function findMidgame(): Moment {
  return findMoment('standard', (state, log) => {
    const hand = state.seats[0]!.hand.length;
    const rivalsWithBooks = [1, 2, 3].filter((seat) => books(state, seat) >= 1).length;
    return (
      hand >= 7 &&
      hand <= 10 &&
      books(state, 0) >= 2 &&
      rivalsWithBooks >= 2 &&
      state.pond.length >= 12 &&
      state.pond.length <= 22 &&
      new Set(state.seats[0]!.hand.map(rankOf)).size >= 4 &&
      notebookFor(log).lines.length >= 9
    );
  });
}

/** "Go Fish!": the player asks, the rival has none, and the cast brings up a card. */
export function findCast(): Moment {
  return findMoment('standard', (state, _log, next) => {
    const draw = next.find((e) => e.kind === 'draw');
    return (
      next.some((e) => e.kind === 'go-fish') &&
      draw?.kind === 'draw' &&
      !draw.lucky &&
      state.seats[0]!.hand.length >= 6 &&
      books(state, 0) >= 1 &&
      state.pond.length >= 16
    );
  });
}

/** A book: the player takes the last cards of a rank from a rival. */
export function findBook(): Moment {
  return findMoment('standard', (state, _log, next) => {
    const give = next.find((e) => e.kind === 'give');
    return (
      give?.kind === 'give' &&
      give.cards.length >= 2 &&
      next.some((e) => e.kind === 'book' && e.seat === 0) &&
      state.seats[0]!.hand.length >= 7 &&
      books(state, 0) >= 1
    );
  });
}
