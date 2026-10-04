// Talon's Shadow — the expedition. The port's eight looks become eight regions flown in order,
// each with its own bird of prey, its own harvest and its own rivals: the first birds are
// patient and slow to dive, the last lock on quickly; from the River on, a fence in the shape of
// a letter stands in the field, and a bird of the place hunts on foot (hens.mjs). A region is cleared by escaping with its goal of fruit, which
// opens the next; clearing Midnight ends the expedition. Pure data and rules; the desk
// (desk.mjs) draws them.

/**
 * @typedef {{ patience: number, patienceSpread: number, lockMs: number, diveMs: number,
 *   strikeRadius: number, appleCount: number, glideSpeed: number, firstDelay: number }} Tuning
 * @typedef {{ id: string, theme: string, name: string, bird: string, fruit: string,
 *   temper: string, fence: string, rivals: number, rivalSpeed: number, harvest: number,
 *   goal: number, hunter: { name: string, speed: number, count: number }, tuning: Tuning }} Region
 */

/** @type {readonly Region[]} */
export const REGIONS = [
  {
    id: 'savanna',
    theme: 'savanna',
    name: 'Savanna',
    bird: 'African fish eagle',
    fruit: 'Sun mango',
    temper: 'Patient, and slow to come down.',
    fence: 'none',
    rivals: 1,
    rivalSpeed: 0.05,
    harvest: 10,
    goal: 4,
    hunter: { name: 'Secretary bird', speed: 0.09, count: 1 },
    tuning: { patience: 5600, patienceSpread: 600, lockMs: 1150, diveMs: 340, strikeRadius: 20, appleCount: 5, glideSpeed: 95, firstDelay: 3000 },
  },
  {
    id: 'river',
    theme: 'river',
    name: 'River',
    bird: 'Osprey',
    fruit: 'Coral fruit',
    temper: 'Watches the water a long while, then drops.',
    fence: 'I',
    rivals: 1,
    rivalSpeed: 0.055,
    harvest: 12,
    goal: 5,
    hunter: { name: 'Grey heron', speed: 0.095, count: 1 },
    tuning: { patience: 5200, patienceSpread: 500, lockMs: 1050, diveMs: 325, strikeRadius: 21, appleCount: 5, glideSpeed: 100, firstDelay: 2600 },
  },
  {
    id: 'jungle',
    theme: 'jungle',
    name: 'Jungle',
    bird: 'Harpy eagle',
    fruit: 'Canopy mango',
    temper: 'Heavy wings, a sure aim.',
    fence: 'T',
    rivals: 2,
    rivalSpeed: 0.055,
    harvest: 15,
    goal: 6,
    hunter: { name: 'Jungle fowl', speed: 0.1, count: 1 },
    tuning: { patience: 4900, patienceSpread: 450, lockMs: 980, diveMs: 315, strikeRadius: 21, appleCount: 5, glideSpeed: 105, firstDelay: 2300 },
  },
  {
    id: 'desert',
    theme: 'desert',
    name: 'Desert',
    bird: 'Pale hawk',
    fruit: 'Prickly pear',
    temper: 'Restless in the heat; it rarely waits.',
    fence: 'H',
    rivals: 2,
    rivalSpeed: 0.06,
    harvest: 16,
    goal: 7,
    hunter: { name: 'Desert courser', speed: 0.105, count: 1 },
    tuning: { patience: 4700, patienceSpread: 400, lockMs: 940, diveMs: 305, strikeRadius: 22, appleCount: 5, glideSpeed: 110, firstDelay: 2100 },
  },
  {
    id: 'neon-grid',
    theme: 'neon-grid',
    name: 'Neon Grid',
    bird: 'Grid eagle',
    fruit: 'Glow orb',
    temper: 'The port’s own bird: as it always flew.',
    fence: 'plus',
    rivals: 2,
    rivalSpeed: 0.062,
    harvest: 18,
    goal: 7,
    hunter: { name: 'Circuit hen', speed: 0.11, count: 1 },
    tuning: { patience: 4500, patienceSpread: 250, lockMs: 900, diveMs: 295, strikeRadius: 22, appleCount: 5, glideSpeed: 105, firstDelay: 2000 },
  },
  {
    id: 'aztec',
    theme: 'aztec',
    name: 'Aztec',
    bird: 'Golden eagle',
    fruit: 'Pomegranate',
    temper: 'Proud and quick, with a wide strike.',
    fence: 'O',
    rivals: 2,
    rivalSpeed: 0.065,
    harvest: 21,
    goal: 8,
    hunter: { name: 'Wild turkey', speed: 0.115, count: 1 },
    tuning: { patience: 4300, patienceSpread: 250, lockMs: 860, diveMs: 290, strikeRadius: 23, appleCount: 4, glideSpeed: 115, firstDelay: 1800 },
  },
  {
    id: 'origami',
    theme: 'origami',
    name: 'Origami',
    bird: 'Paper eagle',
    fruit: 'Folded apple',
    temper: 'Light as paper, and twice as sudden.',
    fence: 'U',
    rivals: 3,
    rivalSpeed: 0.065,
    harvest: 25,
    goal: 8,
    hunter: { name: 'Paper hen', speed: 0.115, count: 1 },
    tuning: { patience: 4100, patienceSpread: 250, lockMs: 820, diveMs: 285, strikeRadius: 23, appleCount: 4, glideSpeed: 120, firstDelay: 1700 },
  },
  {
    id: 'midnight',
    theme: 'midnight',
    name: 'Midnight',
    bird: 'Horned owl',
    fruit: 'Night berry',
    temper: 'Silent, quick, and hard to see coming.',
    fence: 'HH',
    rivals: 3,
    rivalSpeed: 0.068,
    harvest: 30,
    goal: 9,
    hunter: { name: 'Night heron', speed: 0.115, count: 2 },
    tuning: { patience: 3900, patienceSpread: 200, lockMs: 780, diveMs: 280, strikeRadius: 24, appleCount: 4, glideSpeed: 125, firstDelay: 1600 },
  },
];

/** @param {string} id */
export function regionById(id) {
  return REGIONS.find((region) => region.id === id) ?? REGIONS[0];
}

/**
 * True once the region has been escaped with its goal of fruit.
 * @param {Region} region
 * @param {Record<string, number>} bestHaul the most fruit escaped with, by region
 */
export function isCleared(region, bestHaul) {
  return (bestHaul[region.id] ?? -1) >= region.goal;
}

/**
 * Which regions are open: the first always; each next one once the region before it is cleared.
 * @param {Record<string, number>} bestHaul
 */
export function openRegions(bestHaul) {
  const open = [REGIONS[0].id];
  for (let i = 1; i < REGIONS.length; i++) {
    if (isCleared(REGIONS[i - 1], bestHaul)) open.push(REGIONS[i].id);
    else break;
  }
  return open;
}

/** The expedition is over once its last region, Midnight, is cleared. */
export function expeditionComplete(bestHaul) {
  return isCleared(REGIONS[REGIONS.length - 1], bestHaul);
}

/** The region an escape just opened, if it opened one. */
export function regionOpenedBy(regionId, fruit, bestBefore) {
  const index = REGIONS.findIndex((region) => region.id === regionId);
  const region = REGIONS[index];
  if (!region || index === REGIONS.length - 1) return null;
  if (fruit >= region.goal && (bestBefore ?? -1) < region.goal) return REGIONS[index + 1];
  return null;
}
