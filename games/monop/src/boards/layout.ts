/**
 * The shape every board shares: a loop of 40 spaces, the four corners at 0, 10, 20 and 30. The
 * order of kinds is the structure the 1980 game inherited from the board games before it (a
 * start that pays a salary, eight groups of two or three streets that rise in value round the
 * loop, a transit stop in the middle of each side, two utilities, two card decks, two taxes and
 * a lock-up). The names, prices and look of every board are our own.
 */

export type SpaceKind =
  'start' | 'street' | 'transit' | 'utility' | 'card' | 'tax' | 'lockup' | 'rest' | 'toLockup';

export type DeckId = 'a' | 'b';

export interface SpaceSlot {
  readonly index: number;
  readonly kind: SpaceKind;
  /** 0–7 for a street: the group it belongs to, in the order of the loop. */
  readonly group?: number;
  /** For a card space, the deck it draws from. */
  readonly deck?: DeckId;
  /** 0 or 1 for a tax space: 0 is the bigger one, which Berkeley rules let you pay as a tenth of your worth. */
  readonly tax?: number;
}

const street = (index: number, group: number): SpaceSlot => ({ index, kind: 'street', group });
const card = (index: number, deck: DeckId): SpaceSlot => ({ index, kind: 'card', deck });

export const LAYOUT: readonly SpaceSlot[] = [
  { index: 0, kind: 'start' },
  street(1, 0),
  card(2, 'a'),
  street(3, 0),
  { index: 4, kind: 'tax', tax: 0 },
  { index: 5, kind: 'transit' },
  street(6, 1),
  card(7, 'b'),
  street(8, 1),
  street(9, 1),
  { index: 10, kind: 'lockup' },
  street(11, 2),
  { index: 12, kind: 'utility' },
  street(13, 2),
  street(14, 2),
  { index: 15, kind: 'transit' },
  street(16, 3),
  card(17, 'a'),
  street(18, 3),
  street(19, 3),
  { index: 20, kind: 'rest' },
  street(21, 4),
  card(22, 'b'),
  street(23, 4),
  street(24, 4),
  { index: 25, kind: 'transit' },
  street(26, 5),
  street(27, 5),
  { index: 28, kind: 'utility' },
  street(29, 5),
  { index: 30, kind: 'toLockup' },
  street(31, 6),
  street(32, 6),
  card(33, 'a'),
  street(34, 6),
  { index: 35, kind: 'transit' },
  card(36, 'b'),
  street(37, 7),
  { index: 38, kind: 'tax', tax: 1 },
  street(39, 7),
];

export const SPACE_COUNT = LAYOUT.length;
export const GROUP_COUNT = 8;
export const LOCKUP_INDEX = 10;

/** The streets of a group, in loop order. */
export function groupSpaces(group: number): number[] {
  return LAYOUT.filter((slot) => slot.group === group).map((slot) => slot.index);
}

export const TRANSIT_SPACES = LAYOUT.filter((s) => s.kind === 'transit').map((s) => s.index);
export const UTILITY_SPACES = LAYOUT.filter((s) => s.kind === 'utility').map((s) => s.index);

/** Spaces that can be owned: streets, transit stops and utilities. */
export function isDeed(index: number): boolean {
  const kind = LAYOUT[index]!.kind;
  return kind === 'street' || kind === 'transit' || kind === 'utility';
}
