/**
 * Ranks are named after Unix permission levels. Thresholds are lifetime XP and were tuned by
 * the simulations in `sim/` (see docs/NOTES-progression.md); change them only together with
 * the locked targets in `sim/targets.test.ts`.
 */

export const RANK_IDS = ['guest', 'user', 'staff', 'wheel', 'root'] as const;
export type RankId = (typeof RANK_IDS)[number];

export interface Rank {
  id: RankId;
  threshold: number;
  /** The one-line welcome shown on rank-up and in the profile, in the Machine Room's Unix words. */
  flavour: string;
  /** The same welcome in plain words, for Console Home and Holo Collection. */
  plainFlavour: string;
}

export const RANKS: readonly Rank[] = [
  {
    id: 'guest',
    threshold: 0,
    flavour: 'Just looking around. Pull up a chair; the machine does not mind.',
    plainFlavour: 'Just looking around. Every game is open to you; pick one and press play.',
  },
  {
    id: 'user',
    threshold: 150,
    flavour: 'A home directory of your own, with your name on the door.',
    plainFlavour: 'Your name is on the door now, with a shelf of your own for what you win.',
  },
  {
    id: 'staff',
    threshold: 2_700,
    flavour: 'Trusted around the machine. The night operator nods when you come in.',
    plainFlavour: 'A regular here. The games have started to know your face.',
  },
  {
    id: 'wheel',
    threshold: 14_800,
    flavour: 'One step from the top. You know where the spare keys are kept.',
    plainFlavour: 'One step from the top. You know where the spare keys are kept.',
  },
  {
    id: 'root',
    threshold: 48_000,
    flavour: 'The whole machine is yours. Listen: the server closet hums back.',
    plainFlavour: 'The top of the collection. Listen: the server closet hums back.',
  },
];

export function rankById(id: RankId): Rank {
  return RANKS.find((rank) => rank.id === id) as Rank;
}

export function rankForXp(xp: number): Rank {
  let current = RANKS[0] as Rank;
  for (const rank of RANKS) if (xp >= rank.threshold) current = rank;
  return current;
}

export function nextRank(xp: number): Rank | null {
  return RANKS.find((rank) => rank.threshold > xp) ?? null;
}

export function rankIndex(id: RankId): number {
  return RANK_IDS.indexOf(id);
}

export interface RankProgress {
  rank: Rank;
  next: Rank | null;
  /** XP earned since reaching the current rank. */
  into: number;
  /** XP between the current and next rank; 0 at root. */
  span: number;
  fraction: number;
  toNext: number;
}

export function rankProgress(xp: number): RankProgress {
  const rank = rankForXp(xp);
  const next = nextRank(xp);
  if (!next) return { rank, next, into: xp - rank.threshold, span: 0, fraction: 1, toNext: 0 };
  const span = next.threshold - rank.threshold;
  const into = xp - rank.threshold;
  return { rank, next, into, span, fraction: into / span, toNext: next.threshold - xp };
}
