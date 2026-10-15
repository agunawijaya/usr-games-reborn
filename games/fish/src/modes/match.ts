import { composeShare, createRng, type DateKey } from '@usr-games/kit';
import { shuffledDeck } from '@usr-games/kit/cards';
import { type Chance, chanceFrom, diceFrom } from '../engine/chance';
import { BerkeleyMind, createMind, type Mind, type MindName } from '../engine/minds';
import type { RuleSetId } from '../engine/rules';
import { Table } from '../engine/table';
import type { RivalKind } from '../render/pond-view';

/**
 * Who you play and how: the three rivals, and the setup of every kind of game (a Quick game,
 * a Tournament round, the Daily Pond). A setup and its seed decide the deck, who starts and
 * every rival's dice, so the same setup with the same asks plays the same game.
 */

export type RivalId = 'otto' | 'hazel' | 'miso';

export interface Rival {
  id: RivalId;
  name: string;
  kind: RivalKind;
  mind: MindName;
  /** One line for the menus: how this rival thinks. */
  blurb: string;
}

export const RIVALS: Readonly<Record<RivalId, Rival>> = {
  otto: {
    id: 'otto',
    name: 'Otto',
    kind: 'otter',
    mind: 'otto',
    blurb: 'Forgetful. Asks for his ranks in turn, round and round.',
  },
  hazel: {
    id: 'hazel',
    name: 'Hazel',
    kind: 'heron',
    mind: 'hazel',
    blurb: 'Remembers what you ask for, and asks it back.',
  },
  miso: {
    id: 'miso',
    name: 'Miso',
    kind: 'cat',
    mind: 'miso',
    blurb: 'Remembers everything said and every card handed over.',
  },
};

export const RIVAL_IDS: readonly RivalId[] = ['otto', 'hazel', 'miso'];

export type MatchKind = 'quick' | 'tournament' | 'daily';

export interface MatchSetup {
  kind: MatchKind;
  rules: RuleSetId;
  /** Seats 1, 2, 3 clockwise from you. */
  rivals: readonly RivalId[];
  seed: string;
  /** Tournament round, 0–4. */
  round?: number;
  /** The Daily Pond's public number. */
  daily?: number;
}

/** Classic 1993 has one rival: Otto plays the original's normal mode, Hazel its pro mode. */
export const CLASSIC_RIVALS: readonly RivalId[] = ['otto', 'hazel'];

export function isValidSetup(setup: MatchSetup): boolean {
  const count = setup.rivals.length;
  if (setup.rules === 'classic') return count === 1 && CLASSIC_RIVALS.includes(setup.rivals[0]!);
  return count >= 1 && count <= 3 && new Set(setup.rivals).size === count;
}

function mindFor(rival: Rival, seat: number, rules: RuleSetId): Mind {
  // The Classic computer is the original's, rare peek and all; elsewhere minds never peek.
  if (rules === 'classic')
    return new BerkeleyMind(seat, { pro: rival.mind === 'hazel', peeks: true });
  return createMind(rival.mind, seat);
}

/**
 * A table for this setup: seat 0 is you, the rivals clockwise after. The attract mode passes a
 * mind for seat 0 too, so the pond plays itself.
 */
export function tableFor(setup: MatchSetup, standIn: MindName | null = null): Table {
  const rng = createRng(`gone-fishing:${setup.seed}`);
  const minds = [
    standIn ? createMind(standIn, 0) : null,
    ...setup.rivals.map((id, i) => mindFor(RIVALS[id], i + 1, setup.rules)),
  ];
  const streams: Chance[] = minds.map((_, seat) => chanceFrom(rng.split(`mind/${seat}`)));
  return new Table({
    rules: setup.rules,
    minds,
    deck: shuffledDeck(rng.split('deck')),
    dice: diceFrom(rng),
    mindChance: (seat) => streams[seat]!,
    peeks: setup.rules === 'classic',
  });
}

/** Tournament: five rounds against rivals that grow smarter, played to all thirteen books. */
export const TOURNAMENT_ROUNDS: readonly (readonly RivalId[])[] = [
  ['otto'],
  ['hazel'],
  ['miso'],
  ['otto', 'miso'],
  ['otto', 'hazel', 'miso'],
];

export const TOURNAMENT_WINS_NEEDED = 3;

export function tournamentSetup(tournamentSeed: string, round: number): MatchSetup {
  return {
    kind: 'tournament',
    rules: 'all-books',
    rivals: TOURNAMENT_ROUNDS[round]!,
    seed: `${tournamentSeed}/round-${round}`,
    round,
  };
}

/**
 * The Daily Pond: everyone gets the same deck, the same seats and the same rivals' dice. All
 * three rivals play and every book is made, so the day's scores compare.
 */
export function dailySetup(seed: string, number: number): MatchSetup {
  const seats = createRng(`gone-fishing:${seed}`).split('seats').shuffle(RIVAL_IDS);
  return { kind: 'daily', rules: 'all-books', rivals: seats, seed, daily: number };
}

/** `Gone Fishing #42 · 6 books · 🐟🐟🐟🐟🐠🐟 · no notebook`, with no address in it. */
export function dailyShareText(
  dateKey: DateKey,
  books: readonly { golden: boolean }[],
  notebookUsed: boolean,
): string {
  const fish = books.map((book) => (book.golden ? '🐠' : '🐟')).join('');
  const headline = [
    `${books.length} ${books.length === 1 ? 'book' : 'books'}`,
    fish || '·',
    notebookUsed ? 'notebook' : 'no notebook',
  ].join(' · ');
  return composeShare({ title: 'Gone Fishing', daily: dateKey, headline });
}
