/**
 * Rarity tiers for the word book, read from SCOWL's size levels: the smaller the list a word
 * first appears in, the more common it is. No other data source is involved.
 */
export type Tier = 0 | 1 | 2 | 3;

export const TIER_NAMES = ['Common', 'Uncommon', 'Rare', 'Very rare'] as const;

export const TIERS: readonly Tier[] = [0, 1, 2, 3];

export function tierName(tier: Tier): string {
  return TIER_NAMES[tier];
}
