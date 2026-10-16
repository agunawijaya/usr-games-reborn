import { LAYOUT } from '../boards/layout';

/**
 * Prices, rents and building costs: our own numbers from our own formula, tuned by simulation
 * (NOTES.md, "Economy"). Every board shares one economy, so the three boards are exactly as fair
 * as each other. A handful of parameters builds the whole table, which is what the simulations
 * tune.
 */

export interface DeedEconomy {
  readonly price: number;
  /**
   * Street: rent at levels 0–5 (bare lot, one to four storeys, landmark); a complete group
   * doubles the bare rent. Transit: rent by how many the owner has, 1–4. Utility: the dice
   * multiplier with one and with both.
   */
  readonly rents: readonly number[];
  readonly buildCost: number;
  readonly mortgage: number;
}

export interface EconomyParams {
  readonly startCoins: number;
  /** Added to the starting purse for each seat after the first, to make up for rolling later. */
  readonly seatBonus: number;
  readonly salary: number;
  /** The tax at space 4 (the one with the Berkeley choice) and the flat one at space 38. */
  readonly taxes: readonly [number, number];
  readonly fine: number;
  /** Price of each group's cheapest street, round the loop. */
  readonly groupBase: readonly number[];
  /** Added for each further street in a group, and again for the last one. */
  readonly step: number;
  /** Bare rent as a share of the price, for the cheapest district. */
  readonly rentShare: number;
  /** How much larger that share grows by the dearest district, so dear districts pay back as fast as cheap ones. */
  readonly rentTilt: number;
  /** Rent at each level as a multiple of the bare rent. */
  readonly ladder: readonly number[];
  readonly buildBase: number;
  readonly buildStep: number;
  readonly transitPrice: number;
  readonly transitRents: readonly number[];
  readonly utilityPrice: number;
  readonly utilityTimes: readonly number[];
  readonly storeySupply: number;
  readonly landmarkSupply: number;
}

export interface Economy extends EconomyParams {
  readonly deeds: readonly (DeedEconomy | null)[];
}

const round5 = (n: number) => Math.round(n / 5) * 5;

function street(index: number, p: EconomyParams): DeedEconomy {
  const group = LAYOUT[index]!.group!;
  const members = LAYOUT.filter((s) => s.group === group).map((s) => s.index);
  const position = members.indexOf(index);
  const last = position === members.length - 1;
  const price = p.groupBase[group]! + position * p.step + (last ? p.step : 0);
  const share = p.rentShare * (1 + (p.rentTilt * group) / (p.groupBase.length - 1));
  const bare = Math.max(4, Math.round((price * share) / 2) * 2);
  return {
    price,
    rents: p.ladder.map((m, level) => (level === 0 ? bare : round5(bare * m))),
    buildCost: round5(p.buildBase + group * p.buildStep),
    mortgage: price / 2,
  };
}

export function makeEconomy(p: EconomyParams): Economy {
  const deeds = LAYOUT.map((slot): DeedEconomy | null => {
    if (slot.kind === 'street') return street(slot.index, p);
    if (slot.kind === 'transit')
      return {
        price: p.transitPrice,
        rents: p.transitRents,
        buildCost: 0,
        mortgage: p.transitPrice / 2,
      };
    if (slot.kind === 'utility')
      return {
        price: p.utilityPrice,
        rents: p.utilityTimes,
        buildCost: 0,
        mortgage: p.utilityPrice / 2,
      };
    return null;
  });
  return { ...p, deeds };
}

/** The tuned parameters; NOTES.md records how they were chosen. */
export const ECONOMY_PARAMS: EconomyParams = {
  startCoins: 1600,
  seatBonus: 50,
  salary: 220,
  taxes: [180, 90],
  fine: 60,
  groupBase: [70, 110, 150, 190, 230, 270, 310, 370],
  step: 10,
  rentShare: 0.065,
  rentTilt: 0.4,
  ladder: [1, 4.5, 13, 32, 42, 54],
  buildBase: 45,
  buildStep: 10,
  transitPrice: 190,
  transitRents: [30, 60, 110, 210],
  utilityPrice: 160,
  utilityTimes: [5, 12],
  storeySupply: 34,
  landmarkSupply: 12,
};

export const ECONOMY: Economy = makeEconomy(ECONOMY_PARAMS);

/** The board's deed economy, for the interface; null for spaces nobody can own. */
export function deedEconomy(index: number, economy: Economy = ECONOMY): DeedEconomy | null {
  return economy.deeds[index] ?? null;
}
