/**
 * Detour's deck: nineteen kinds of card in four families. The kinds are listed in the order the
 * original program numbers them (`mille.h`, C_25 … C_RIGHT_WAY), because its computer player
 * breaks ties by hand position and its ordered hand sorts by that number.
 *
 * Names here are ours. The rules each card follows are the original's.
 */

export const KINDS = [
  'm25',
  'm50',
  'm75',
  'm100',
  'm200',
  'noFuel',
  'flatTyre',
  'fenderBender',
  'redLight',
  'slowZone',
  'fillUp',
  'spareTyre',
  'mechanic',
  'greenLight',
  'openRoad',
  'longRangeTank',
  'runFlats',
  'roadSense',
  'greenWave',
] as const;

export type Kind = (typeof KINDS)[number];
export type Distance = 'm25' | 'm50' | 'm75' | 'm100' | 'm200';
export type Hazard = 'noFuel' | 'flatTyre' | 'fenderBender' | 'redLight' | 'slowZone';
export type Remedy = 'fillUp' | 'spareTyre' | 'mechanic' | 'greenLight' | 'openRoad';
export type Safety = 'longRangeTank' | 'runFlats' | 'roadSense' | 'greenWave';
export type Family = 'distance' | 'hazard' | 'remedy' | 'safety';

export const DISTANCES: readonly Distance[] = ['m25', 'm50', 'm75', 'm100', 'm200'];
export const HAZARDS: readonly Hazard[] = [
  'noFuel',
  'flatTyre',
  'fenderBender',
  'redLight',
  'slowZone',
];
export const REMEDIES: readonly Remedy[] = [
  'fillUp',
  'spareTyre',
  'mechanic',
  'greenLight',
  'openRoad',
];
/** In the order of the original's safety area: fuel, tyres, driving, right of way. */
export const SAFETIES: readonly Safety[] = ['longRangeTank', 'runFlats', 'roadSense', 'greenWave'];

/** A card in play: its index into the hand's `cards` table. */
export type CardId = number;

/** The original's card number (C_25 = 0 … C_RIGHT_WAY = 18). */
export function ordinal(kind: Kind): number {
  return KINDS.indexOf(kind);
}

export function familyOf(kind: Kind): Family {
  const n = ordinal(kind);
  if (n <= 4) return 'distance';
  if (n <= 9) return 'hazard';
  if (n <= 14) return 'remedy';
  return 'safety';
}

export const isDistance = (kind: Kind | null): kind is Distance =>
  kind !== null && familyOf(kind) === 'distance';
export const isHazard = (kind: Kind | null): kind is Hazard =>
  kind !== null && familyOf(kind) === 'hazard';
export const isRemedy = (kind: Kind | null): kind is Remedy =>
  kind !== null && familyOf(kind) === 'remedy';
export const isSafety = (kind: Kind | null): kind is Safety =>
  kind !== null && familyOf(kind) === 'safety';

export const MILES: Readonly<Record<Distance, number>> = {
  m25: 25,
  m50: 50,
  m75: 75,
  m100: 100,
  m200: 200,
};

/**
 * Each card's partner, as the original pairs them: a hazard and the remedy that clears it, and
 * a safety and the hazard it parries. Distances pair with themselves.
 */
const OPPOSITE: Readonly<Record<Kind, Kind>> = {
  m25: 'm25',
  m50: 'm50',
  m75: 'm75',
  m100: 'm100',
  m200: 'm200',
  noFuel: 'fillUp',
  flatTyre: 'spareTyre',
  fenderBender: 'mechanic',
  redLight: 'greenLight',
  slowZone: 'openRoad',
  fillUp: 'noFuel',
  spareTyre: 'flatTyre',
  mechanic: 'fenderBender',
  greenLight: 'redLight',
  openRoad: 'slowZone',
  longRangeTank: 'noFuel',
  runFlats: 'flatTyre',
  roadSense: 'fenderBender',
  greenWave: 'redLight',
};

export function opposite(kind: Kind): Kind {
  return OPPOSITE[kind];
}

/** The safety that guards against a hazard, answers to a remedy, or is itself (`safety()` in the original). */
export function safetyFor(kind: Hazard | Remedy | Safety): Safety {
  switch (kind) {
    case 'noFuel':
    case 'fillUp':
    case 'longRangeTank':
      return 'longRangeTank';
    case 'flatTyre':
    case 'spareTyre':
    case 'runFlats':
      return 'runFlats';
    case 'fenderBender':
    case 'mechanic':
    case 'roadSense':
      return 'roadSense';
    default:
      return 'greenWave';
  }
}

/** The safety's index in the safety area (the original's S_GAS_SAFE … S_RIGHT_WAY). */
export function safetyIndex(safety: Safety): number {
  return SAFETIES.indexOf(safety);
}

/**
 * How many of each kind a deck holds. The original's 101 cards are the two-handed deck; the
 * partnership game adds one more of every hazard, as the commercial rules do for four players.
 */
export type DeckCounts = Readonly<Record<Kind, number>>;

export const DUEL_DECK: DeckCounts = {
  m25: 10,
  m50: 10,
  m75: 10,
  m100: 12,
  m200: 4,
  noFuel: 2,
  flatTyre: 2,
  fenderBender: 2,
  redLight: 4,
  slowZone: 3,
  fillUp: 6,
  spareTyre: 6,
  mechanic: 6,
  greenLight: 14,
  openRoad: 6,
  longRangeTank: 1,
  runFlats: 1,
  roadSense: 1,
  greenWave: 1,
};

export const TEAM_DECK: DeckCounts = {
  ...DUEL_DECK,
  noFuel: 3,
  flatTyre: 3,
  fenderBender: 3,
  redLight: 5,
  slowZone: 4,
};

export function deckSize(counts: DeckCounts): number {
  return KINDS.reduce((sum, kind) => sum + counts[kind], 0);
}

/** Every card of a deck, in kind order: the table a hand's card ids index into. */
export function deckKinds(counts: DeckCounts): Kind[] {
  return KINDS.flatMap((kind) => Array.from({ length: counts[kind] }, () => kind));
}
