import type { HouseRules, Mode, Preset, Rules } from './types';

/**
 * The two rule sets and the house rules. Standard is how most people play a property game
 * today; Berkeley 1980 is the original program's behaviour, verified in its source (NOTES.md):
 * the bank lends, there is no auction once two players remain, no limit on buildings, built lots
 * can be traded, a utility's rent takes a fresh roll, and the income tax is a guess between a
 * tenth of your worth and the flat sum, made before you see your worth.
 */

export const NO_HOUSE_RULES: HouseRules = {
  restPot: false,
  doubleSalaryOnStart: false,
  noRentInLockup: false,
};

/**
 * Rounds in a Quick game, by the number of players, so a game with one person at the table runs
 * about thirty minutes on the simulated clock (NOTES.md, "Economy": minutes per round).
 */
const QUICK_ROUNDS_BY_PLAYERS: Readonly<Record<number, number>> = {
  2: 80,
  3: 56,
  4: 48,
  5: 42,
  6: 37,
};

export function quickRounds(players: number): number {
  return QUICK_ROUNDS_BY_PLAYERS[Math.min(6, Math.max(2, players))]!;
}

export const QUICK_ROUNDS = quickRounds(3);

/**
 * Classic plays until one player is left, as the original did. A table that has stopped
 * changing (two players, the builders' stock used up, coins piling up) would never end, so after
 * this many rounds, about two and a half hours on the clock, the richest player wins.
 */
export const CLASSIC_LONG_STOP = 250;

export function makeRules(
  preset: Preset,
  mode: Mode = 'quick',
  house: HouseRules = NO_HOUSE_RULES,
  rounds = mode === 'quick' ? QUICK_ROUNDS : CLASSIC_LONG_STOP,
): Rules {
  const berkeley = preset === 'berkeley';
  return {
    preset,
    bankLends: berkeley,
    auctions: true,
    noAuctionWithTwo: berkeley,
    buildingSupply: !berkeley,
    tradeOnlyUnbuilt: !berkeley,
    utilityFreshRoll: berkeley,
    taxChoice: berkeley,
    house,
    mode,
    rounds,
  };
}

export const HOUSE_RULE_NAMES: Readonly<
  Record<keyof HouseRules, { label: string; detail: string }>
> = {
  restPot: {
    label: 'A pot on the rest space',
    detail: 'Taxes and card payments go into a pot; whoever lands on the rest space takes it.',
  },
  doubleSalaryOnStart: {
    label: 'Double pay on the start',
    detail: 'Landing exactly on the start pays twice the usual pay.',
  },
  noRentInLockup: {
    label: 'No rent from the lock-up',
    detail: 'An owner sitting in the lock-up collects no rent until they are out.',
  },
};
