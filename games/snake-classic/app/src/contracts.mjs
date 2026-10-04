// Talon's Shadow — three contracts in every region. Each is checked against a flight's summary
// once it ends; meeting one earns its stamp for good. Pure.

/**
 * @typedef {{ escaped: boolean, fruit: number, dodges: number, locks: number,
 *   edge: 'north' | 'east' | 'south' | 'west' | null, seconds: number, rivalsAte: number,
 *   rivalsTaken: number, bare: boolean }} FlightSummary
 * @typedef {{ id: string, text: string, met: (s: FlightSummary) => boolean,
 *   progress?: (s: FlightSummary) => string }} Contract
 */

const haul = (n) => ({
  id: `haul-${n}`,
  text: `Escape with at least ${n} fruit`,
  met: (s) => s.escaped && s.fruit >= n,
  progress: (s) => `${Math.min(s.fruit, n)}/${n}`,
});

const dodge = (n) => ({
  id: `dodge-${n}`,
  text: `Dodge ${n} ${n === 1 ? 'dive' : 'dives'} in one flight, then escape`,
  met: (s) => s.escaped && s.dodges >= n,
  progress: (s) => `${Math.min(s.dodges, n)}/${n}`,
});

const edge = (side, n) => ({
  id: `edge-${side}-${n}`,
  text: `Escape over the ${side} edge with at least ${n} fruit`,
  met: (s) => s.escaped && s.edge === side && s.fruit >= n,
});

const quick = (seconds, n) => ({
  id: `quick-${seconds}-${n}`,
  text: `Escape within ${seconds} seconds with at least ${n} fruit`,
  met: (s) => s.escaped && s.seconds <= seconds && s.fruit >= n,
});

const calm = (locks, n) => ({
  id: `calm-${locks}-${n}`,
  text: `Escape with ${n} fruit before the bird has locked on ${locks + 1} times`,
  met: (s) => s.escaped && s.locks <= locks && s.fruit >= n,
});

/** More fruit brought home than all the rivals ate together. */
const outeat = () => ({
  id: 'outeat',
  text: 'Bring home more fruit than the rivals eat between them',
  met: (s) => s.escaped && s.fruit > s.rivalsAte,
  progress: (s) => `${s.fruit} to ${s.rivalsAte}`,
});

/** Let the bird carry off a rival, and get away yourself. */
const decoy = (n) => ({
  id: `decoy-${n}`,
  text: `Let the bird carry off a rival, then escape with at least ${n} fruit`,
  met: (s) => s.escaped && s.rivalsTaken > 0 && s.fruit >= n,
});

/** @type {Readonly<Record<string, readonly Contract[]>>} */
export const CONTRACTS = {
  savanna: [haul(6), dodge(1), edge('north', 2)],
  river: [haul(7), quick(40, 4), outeat()],
  jungle: [haul(8), edge('east', 5), calm(3, 5)],
  desert: [haul(9), dodge(3), decoy(6)],
  'neon-grid': [haul(10), outeat(), dodge(3)],
  aztec: [haul(11), calm(4, 7), edge('west', 7)],
  origami: [haul(11), dodge(4), quick(80, 8)],
  midnight: [haul(12), outeat(), decoy(8)],
};

export const STAMPS_IN_ALL = Object.values(CONTRACTS).reduce((sum, list) => sum + list.length, 0);

/** The stamp's key in the saved progress. */
export function stampKey(regionId, contract) {
  return `${regionId}/${contract.id}`;
}

/**
 * The contracts this flight met that were not stamped before.
 * @param {string} regionId @param {FlightSummary} summary @param {readonly string[]} stamped
 */
export function newStamps(regionId, summary, stamped) {
  return (CONTRACTS[regionId] ?? [])
    .filter((contract) => contract.met(summary) && !stamped.includes(stampKey(regionId, contract)))
    .map((contract) => stampKey(regionId, contract));
}
