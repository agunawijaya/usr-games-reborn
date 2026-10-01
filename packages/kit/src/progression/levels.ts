import { RANKS, type RankId, rankForXp } from './ranks';

/**
 * Levels give the ranks a finer, friendlier scale for the styles that speak in plain words:
 * "Level 17 · staff". Each rank owns a band of levels spread evenly across its XP, so levels
 * and ranks can never disagree, and the balance tuned for ranks holds for levels too.
 */

/** The first level of each rank. Root's band keeps going in fixed steps. */
const FIRST_LEVEL: Readonly<Record<RankId, number>> = {
  guest: 1,
  user: 2,
  staff: 10,
  wheel: 25,
  root: 40,
};
const ROOT_LEVEL_STEP = 3_000;

/** The level a rank starts at, for plain-word unlock hints ("Unlocks at Level 10"). */
export function firstLevelOfRank(rank: RankId): number {
  return FIRST_LEVEL[rank];
}
export const MAX_LEVEL = 99;

export interface LevelProgress {
  level: number;
  rank: RankId;
  /** XP at which this level started. */
  levelStart: number;
  /** XP at which the next level starts; null at the maximum level. */
  nextLevelAt: number | null;
  fraction: number;
}

function bandStep(rankIndex: number): number {
  const rank = RANKS[rankIndex];
  const next = RANKS[rankIndex + 1];
  if (!rank || !next) return ROOT_LEVEL_STEP;
  const levels = FIRST_LEVEL[next.id] - FIRST_LEVEL[rank.id];
  return (next.threshold - rank.threshold) / levels;
}

export function levelForXp(xp: number): LevelProgress {
  const rank = rankForXp(Math.max(0, xp));
  const rankIndex = RANKS.indexOf(rank);
  const step = bandStep(rankIndex);
  const nextRank = RANKS[rankIndex + 1];
  const bandLevels = nextRank ? FIRST_LEVEL[nextRank.id] - FIRST_LEVEL[rank.id] : Infinity;
  const within = Math.min(bandLevels - 1, Math.floor((Math.max(0, xp) - rank.threshold) / step));
  const level = Math.min(MAX_LEVEL, FIRST_LEVEL[rank.id] + within);
  const levelStart = Math.round(rank.threshold + within * step);
  const nextLevelAt = level >= MAX_LEVEL ? null : Math.round(rank.threshold + (within + 1) * step);
  const fraction = nextLevelAt === null ? 1 : (xp - levelStart) / (nextLevelAt - levelStart);
  return {
    level,
    rank: rank.id,
    levelStart,
    nextLevelAt,
    fraction: Math.min(1, Math.max(0, fraction)),
  };
}

/** The one-line explanation of the Unix joke behind the rank names. */
export const RANK_TOOLTIP =
  'Ranks are named after Unix permission levels: guest, user, staff, wheel and root, the one who can do anything on the machine.';
