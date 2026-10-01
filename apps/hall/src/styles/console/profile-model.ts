import {
  type DateKey,
  packageKey,
  type PackageDefinition,
  type PackageTier,
  packageWording,
  packageXp,
} from '@usr-games/kit';
import {
  type Cosmetic,
  COSMETICS,
  firstLevelOfRank,
  type GameStats,
  HALL_PACKAGES,
  isUnlocked,
  levelForXp,
  type ProgressionState,
  rankById,
  type RankId,
} from '@usr-games/kit/progression';
import type { CatalogEntry } from '../../catalog/catalog';

/**
 * What Console Home's profile page shows, worked out from the player's progression without any
 * DOM: achievements grouped by where they come from, the games played, the accent skins and how
 * far the server closet is. Everything is in plain words, ready to render.
 */

export interface AchievementItem {
  key: string;
  title: string;
  description: string;
  tier: PackageTier;
  xp: number;
  earnedOn: DateKey | null;
  /** Hidden achievements keep their surprise until earned. */
  secret: boolean;
}

export interface AchievementGroup {
  id: string;
  title: string;
  entry: CatalogEntry | null;
  items: AchievementItem[];
  earned: number;
}

const TIER_ORDER: Record<PackageTier, number> = { core: 0, extra: 1, rare: 2 };

function itemFor(scope: string, definition: PackageDefinition, state: ProgressionState) {
  const key = packageKey(scope, definition.id);
  const earnedOn = state.packages[key]?.installedOn ?? null;
  const wording = packageWording(definition, true);
  const secret = Boolean(definition.hidden) && earnedOn === null;
  return {
    key,
    title: secret ? 'A secret' : wording.title,
    description: secret ? 'Revealed once you earn it.' : wording.description,
    tier: definition.tier,
    xp: packageXp(definition),
    earnedOn,
    secret,
  };
}

function group(
  id: string,
  title: string,
  entry: CatalogEntry | null,
  items: AchievementItem[],
): AchievementGroup {
  return { id, title, entry, items, earned: items.filter((item) => item.earnedOn).length };
}

/** The Hall's own achievements first, then every listed game that has some, in catalog order. */
export function achievementGroups(
  entries: readonly CatalogEntry[],
  state: ProgressionState,
): AchievementGroup[] {
  const hall = group(
    'hall',
    'The Hall',
    null,
    HALL_PACKAGES.map((definition) => itemFor('hall', definition, state)),
  );
  const games = entries
    .filter((entry) => (entry.manifest.packages?.length ?? 0) > 0)
    .map((entry) =>
      group(
        entry.manifest.id,
        entry.manifest.title,
        entry,
        (entry.manifest.packages ?? []).map((definition) =>
          itemFor(entry.manifest.id, definition, state),
        ),
      ),
    );
  return [hall, ...games];
}

/** The newest earned achievements first. */
export function recentlyEarned(groups: readonly AchievementGroup[], count: number) {
  return groups
    .flatMap((g) => g.items.map((item) => ({ item, group: g })))
    .filter(({ item }) => item.earnedOn)
    .sort((a, b) => (b.item.earnedOn ?? '').localeCompare(a.item.earnedOn ?? ''))
    .slice(0, count);
}

/**
 * Good next goals: the easiest achievements still to find, from games the player already plays
 * (and the Hall's) before the ones from games they have not opened yet. Secrets stay out.
 */
export function upNext(
  groups: readonly AchievementGroup[],
  state: ProgressionState,
  count: number,
) {
  const played = (g: AchievementGroup) => g.entry === null || Boolean(state.games[g.id]);
  return groups
    .flatMap((g) => g.items.map((item) => ({ item, group: g })))
    .filter(({ item }) => !item.earnedOn && !item.secret)
    .sort(
      (a, b) =>
        Number(played(b.group)) - Number(played(a.group)) ||
        TIER_ORDER[a.item.tier] - TIER_ORDER[b.item.tier] ||
        a.item.xp - b.item.xp,
    )
    .slice(0, count);
}

export interface GameRow {
  entry: CatalogEntry;
  stats: GameStats;
}

/** Every game the player has started, most played first. */
export function gamesPlayed(entries: readonly CatalogEntry[], state: ProgressionState): GameRow[] {
  return entries
    .flatMap((entry) => {
      const stats = state.games[entry.manifest.id];
      return stats && stats.sessions > 0 ? [{ entry, stats }] : [];
    })
    .sort(
      (a, b) =>
        b.stats.sessions - a.stats.sessions || b.stats.lastPlayed.localeCompare(a.stats.lastPlayed),
    );
}

export interface SkinChoice {
  id: string;
  name: string;
  description: string;
  unlocked: boolean;
  /** The level that unlocks it, for the plain wording. */
  level: number;
  rank: RankId;
}

function rankOf(cosmetic: Cosmetic): RankId {
  return 'rank' in cosmetic.source ? cosmetic.source.rank : 'guest';
}

/** Standard plus every accent skin, in unlock order. */
export function skinChoices(state: ProgressionState): SkinChoice[] {
  const standard: SkinChoice = {
    id: 'default',
    name: 'Standard',
    description: 'The Console Home chrome everyone starts with.',
    unlocked: true,
    level: 1,
    rank: 'guest',
  };
  const skins = COSMETICS.filter((cosmetic) => cosmetic.kind === 'skin').map((cosmetic) => ({
    id: cosmetic.id,
    name: cosmetic.name.replace(/ skin$/i, ''),
    description: cosmetic.description,
    unlocked: isUnlocked(cosmetic, state),
    level: firstLevelOfRank(rankOf(cosmetic)),
    rank: rankOf(cosmetic),
  }));
  return [standard, ...skins];
}

/** Looks unlocked for the other two styles, so the profile can mention them in one line. */
export function otherLooks(state: ProgressionState): { finishes: number; machineRoom: number } {
  const unlocked = COSMETICS.filter((cosmetic) => isUnlocked(cosmetic, state));
  return {
    finishes: unlocked.filter((cosmetic) => cosmetic.kind === 'finish').length,
    machineRoom: unlocked.filter(
      (cosmetic) => cosmetic.kind !== 'finish' && cosmetic.kind !== 'skin',
    ).length,
  };
}

export interface ClosetDistance {
  open: boolean;
  level: number;
  openingLevel: number;
  xpToGo: number;
  fraction: number;
}

/** How far the player is from the server closet, which opens at the top rank. */
export function closetDistance(state: ProgressionState): ClosetDistance {
  const threshold = rankById('root').threshold;
  return {
    open: state.xp >= threshold,
    level: levelForXp(state.xp).level,
    openingLevel: firstLevelOfRank('root'),
    xpToGo: Math.max(0, threshold - state.xp),
    fraction: Math.min(1, state.xp / threshold),
  };
}
