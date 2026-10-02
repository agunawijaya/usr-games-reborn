import {
  type Cosmetic,
  cosmeticsForRank,
  firstLevelOfRank,
  levelForXp,
  pendingRankUp,
  rankById,
  type RankId,
} from '@usr-games/kit/progression';
import type { HallStore } from '../store/hall-store';
import { playSound } from './sound';

/**
 * The rank-up moment, as data every style can stage its own way: the Machine Room rewrites its
 * prompt, Console Home flares its level ring, Holo Collection reveals a new rare card. Styles
 * call `celebrateRankUp` after their animation (or when the player skips it).
 */

export interface RankUpMoment {
  from: RankId;
  to: RankId;
  /** The new rank's welcome in Unix words (the Machine Room). */
  flavour: string;
  /** The same welcome in plain words (Console Home and Holo Collection). */
  plainFlavour: string;
  /** The first level of the new rank, for the plain-word styles. */
  level: number;
  /**
   * The level the player has actually reached. A single game can carry a player past the first
   * level of the new rank, so this is the number to show as "you are now".
   */
  reachedLevel: number;
  unlocked: Cosmetic[];
}

/** The rank-up the player has not seen yet, or null. */
export function rankUpMoment(store: HallStore): RankUpMoment | null {
  const { progression } = store.snapshot();
  const pending = pendingRankUp(progression);
  if (!pending) return null;
  return {
    from: pending.from,
    to: pending.to,
    flavour: rankById(pending.to).flavour,
    plainFlavour: rankById(pending.to).plainFlavour,
    level: firstLevelOfRank(pending.to),
    reachedLevel: levelForXp(progression.xp).level,
    unlocked: cosmeticsForRank(pending.to),
  };
}

/** Plays the chord that belongs to the moment; quiet by default and silent until a gesture. */
export function rankUpChord(store: HallStore): void {
  playSound(store, 'rankUp');
}

/** Marks the moment as seen so it plays once. */
export function celebrateRankUp(store: HallStore): void {
  store.acknowledgeRank();
}

/** How long the moment lasts before it settles on its own (the brief asks for two seconds). */
export const RANK_UP_MS = 2000;
