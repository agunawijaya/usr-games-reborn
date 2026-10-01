// Hype: how loud the stadium is. Pile-ups, chains and living dangerously
// raise it; teleporting away and quiet turns let it fall. The louder the
// crowd, the more every crash is worth. Points only: the rules never change.

export type HypeTier = Readonly<{ name: string; min: number; multiplier: number }>;

export const HYPE_TIERS: readonly HypeTier[] = [
  { name: 'Warm', min: 0, multiplier: 1 },
  { name: 'Loud', min: 25, multiplier: 2 },
  { name: 'Roaring', min: 50, multiplier: 3 },
  { name: 'Showtime', min: 80, multiplier: 4 },
];

export const MAX_HYPE = 100;

export function tierOf(hype: number): HypeTier {
  let tier = HYPE_TIERS[0];
  for (const t of HYPE_TIERS) if (hype >= t.min) tier = t;
  return tier;
}

export function tierIndex(hype: number): number {
  return HYPE_TIERS.indexOf(tierOf(hype));
}

/** What a turn did, as far as the crowd is concerned. */
export type TurnForCrowd = Readonly<{
  crashed: number;
  /** The running chain after this turn (crashes on consecutive turns). */
  chain: number;
  waited: boolean;
  teleported: boolean;
  /** A robot ended the turn right beside you, and you are still standing. */
  closeCall: boolean;
}>;

const PER_CRASH = 5;
const PER_CHAIN_STEP = 2;
const WAIT_CRASH = 2;
const CLOSE_CALL = 3;
const TELEPORT = -25;
const QUIET = -2;

export function hypeAfter(hype: number, turn: TurnForCrowd, gain = 1): number {
  let rise = 0;
  if (turn.crashed > 0) {
    const chainBonus = PER_CHAIN_STEP * Math.max(0, Math.min(8, turn.chain) - 1);
    rise += turn.crashed * (PER_CRASH + chainBonus + (turn.waited ? WAIT_CRASH : 0));
  }
  if (turn.closeCall) rise += CLOSE_CALL;
  let fall = 0;
  if (turn.teleported) fall += TELEPORT;
  if (turn.crashed === 0 && !turn.closeCall) fall += QUIET;
  return Math.max(0, Math.min(MAX_HYPE, hype + rise * gain + fall));
}
