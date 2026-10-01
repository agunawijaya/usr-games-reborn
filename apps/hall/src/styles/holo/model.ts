import {
  addDays,
  type DateKey,
  packageKey,
  type PackageDefinition,
  packageWording,
  type PackageTier,
  packageXp,
  weekStartKey,
} from '@usr-games/kit';
import type { Category } from '@usr-games/kit/manifest';
import { HALL_PACKAGES, type ProgressionState } from '@usr-games/kit/progression';
import type { CatalogEntry } from '../../catalog/catalog';

/**
 * What the Holo Collection shows, computed without the DOM: the look of each card by category,
 * the album's achievement slots, and this week's streak days.
 */

/** Each category is a "set" with its own frame colours and foil, like a trading-card series. */
export type FoilKind = 'rainbow' | 'etched' | 'sparkle' | 'lattice';

export interface SetLook {
  foil: FoilKind;
  frameFrom: string;
  frameTo: string;
}

export const SET_LOOKS: Readonly<Record<Category, SetLook>> = {
  arcade: { foil: 'rainbow', frameFrom: '#ff5fa2', frameTo: '#ffb347' },
  strategy: { foil: 'etched', frameFrom: '#3d7bff', frameTo: '#29d3c2' },
  board: { foil: 'lattice', frameFrom: '#2fbf71', frameTo: '#b7e34b' },
  cards: { foil: 'sparkle', frameFrom: '#ff5d5d', frameTo: '#ffd166' },
  words: { foil: 'rainbow', frameFrom: '#8b5cf6', frameTo: '#f472b6' },
  numbers: { foil: 'etched', frameFrom: '#06b6d4', frameTo: '#6366f1' },
  stories: { foil: 'sparkle', frameFrom: '#f59e0b', frameTo: '#a855f7' },
  toys: { foil: 'lattice', frameFrom: '#34d399', frameTo: '#60a5fa' },
};

/** Rarity frames for achievement cards, rarest first. */
export const TIER_ORDER: readonly PackageTier[] = ['rare', 'extra', 'core'];

export const TIER_NAMES: Readonly<Record<PackageTier, string>> = {
  rare: 'Rare',
  extra: 'Special',
  core: 'Common',
};

export interface AlbumSlot {
  key: string;
  /** Null for the Hall's own achievements. */
  entry: CatalogEntry | null;
  definition: PackageDefinition;
  title: string;
  description: string;
  tier: PackageTier;
  xp: number;
  earnedOn: DateKey | null;
}

export interface AlbumGroup {
  key: string;
  title: string;
  entry: CatalogEntry | null;
  slots: AlbumSlot[];
  earned: number;
}

export type AlbumSort = 'game' | 'rarity';

function slotFor(
  entry: CatalogEntry | null,
  definition: PackageDefinition,
  state: ProgressionState,
): AlbumSlot {
  const scope = entry ? entry.manifest.id : 'hall';
  const key = packageKey(scope, definition.id);
  const earnedOn = state.packages[key]?.installedOn ?? null;
  // Hidden achievements keep their surprise until they are earned.
  const wording = packageWording(definition, true);
  const description =
    definition.hidden && !earnedOn ? 'A surprise. Keep playing to find out.' : wording.description;
  return {
    key,
    entry,
    definition,
    title: wording.title,
    description,
    tier: definition.tier,
    xp: packageXp(definition),
    earnedOn,
  };
}

/** Every achievement in the collection: the Hall's first, then each game's in catalog order. */
export function albumSlots(entries: readonly CatalogEntry[], state: ProgressionState): AlbumSlot[] {
  const hall = HALL_PACKAGES.map((definition) => slotFor(null, definition, state));
  const games = entries.flatMap((entry) =>
    (entry.manifest.packages ?? []).map((definition) => slotFor(entry, definition, state)),
  );
  return [...hall, ...games];
}

function group(
  key: string,
  title: string,
  entry: CatalogEntry | null,
  slots: AlbumSlot[],
): AlbumGroup {
  return { key, title, entry, slots, earned: slots.filter((slot) => slot.earnedOn).length };
}

export function albumGroups(slots: readonly AlbumSlot[], sort: AlbumSort): AlbumGroup[] {
  if (sort === 'rarity') {
    return TIER_ORDER.map((tier) =>
      group(
        tier,
        TIER_NAMES[tier],
        null,
        slots.filter((slot) => slot.tier === tier),
      ),
    ).filter((g) => g.slots.length > 0);
  }
  const byScope = new Map<string, AlbumSlot[]>();
  for (const slot of slots) {
    const scope = slot.entry?.manifest.id ?? 'hall';
    byScope.set(scope, [...(byScope.get(scope) ?? []), slot]);
  }
  return [...byScope].map(([scope, grouped]) => {
    const entry = grouped[0]?.entry ?? null;
    return group(scope, entry ? entry.manifest.title : 'The Hall', entry, grouped);
  });
}

/** The newest achievements first, for the little fanned stack on Home. */
export function recentlyEarned(slots: readonly AlbumSlot[], count: number): AlbumSlot[] {
  return slots
    .filter((slot) => slot.earnedOn)
    .sort((a, b) => (b.earnedOn ?? '').localeCompare(a.earnedOn ?? ''))
    .slice(0, count);
}

export type DayMark = 'played' | 'frozen' | 'quiet' | 'future';

export interface WeekDay {
  day: DateKey;
  letter: string;
  mark: DayMark;
  today: boolean;
}

const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** This week, Monday to Sunday, for the streak strip in the header. */
export function weekDays(state: ProgressionState, today: DateKey): WeekDay[] {
  const monday = weekStartKey(today);
  const frozen = new Set(state.streak.frozen);
  return LETTERS.map((letter, index) => {
    const day = addDays(monday, index);
    const played = Object.keys(state.days[day]?.sessions ?? {}).length > 0;
    const mark: DayMark =
      day > today ? 'future' : played ? 'played' : frozen.has(day) ? 'frozen' : 'quiet';
    return { day, letter, mark, today: day === today };
  });
}
