/**
 * What a pickup is worth, as the original works it out. Its author fitted a hyperbola through
 * three points, one of them chosen by how play felt: $25 a pickup on a 24-square edge, $40 on
 * 12, $15 on 48. Only the shorter edge counts, because that is the bottleneck. Edges under 12 are
 * paid as 12, and two squares are added for the border the original drew inside the screen.
 */
export function chunkFor(width: number, height: number): number {
  const shorter = Math.max(Math.min(width, height), 12) + 2;
  return Math.trunc(675 / (shorter + 6) + 2.5);
}

/** The original refuses boards with an edge under four: on 3×3 a player can win without end. */
export const SMALLEST_EDGE = 4;

/**
 * Each pickup adds 25 to the loot whatever it is worth; warping adds a tenth of the loot to the
 * penalty. The pockets show `chunk × (loot − penalty) / 25`, in the original's whole-number
 * arithmetic, which rounds toward zero, debts included.
 */
export const LOOT_PER_PICKUP = 25;
export const WARP_PENALTY_DIVISOR = 10;

export function pocketValue(chunk: number, loot: number, penalty: number): number {
  return Math.trunc((chunk * (loot - penalty)) / LOOT_PER_PICKUP);
}
