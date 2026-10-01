// Control Room 1986 — the service record and the logbook: what the licence card and the logbook
// drawer show. Pure arithmetic over shift summaries (see report.js); main.js saves the results.

/** Reports kept in the logbook, newest first. */
export const LOGBOOK_PAGES = 20;

/**
 * @typedef {object} ServiceRecord
 * @property {number} shifts
 * @property {number} planesHome
 * @property {number} landings
 * @property {number} exits
 * @property {number} takeoffs
 * @property {number} orders
 * @property {number} seconds        time on position over all shifts
 * @property {number} stamps         commendation stamps over all shifts
 * @property {Record<string, number>} bestOpen   best open shift per sector key
 * @property {Record<string, { number: number, safe: number, tasksDone: boolean[], sectorName: string }>} dailies  first flight of each day
 */

/** @returns {ServiceRecord} */
export function newService() {
  return {
    shifts: 0,
    planesHome: 0,
    landings: 0,
    exits: 0,
    takeoffs: 0,
    orders: 0,
    seconds: 0,
    stamps: 0,
    bestOpen: {},
    dailies: {},
  };
}

/**
 * The record after one shift. A shift left before anything happened is not a shift worked.
 * @param {ServiceRecord} service
 * @param {import('./report.js').ShiftSummary} summary
 * @param {string} sectorKey
 * @returns {ServiceRecord}
 */
export function withShift(service, summary, sectorKey) {
  if (summary.ended === 'quit' && summary.orders === 0 && summary.safe === 0) return service;
  const stamps = summary.tasks.filter((task) => task.done).length;
  const next = {
    ...service,
    shifts: service.shifts + 1,
    planesHome: service.planesHome + summary.safe,
    landings: service.landings + summary.landings,
    exits: service.exits + summary.exits,
    takeoffs: service.takeoffs + summary.takeoffs,
    orders: service.orders + summary.orders,
    seconds: service.seconds + summary.seconds,
    stamps: service.stamps + stamps,
    bestOpen: { ...service.bestOpen },
    dailies: { ...service.dailies },
  };
  if (summary.mode === 'open') {
    next.bestOpen[sectorKey] = Math.max(service.bestOpen[sectorKey] ?? 0, summary.safe);
  }
  // The first flight of the day is the one on record; later flights are practice.
  if (summary.mode === 'daily' && summary.daily && !service.dailies[summary.dateKey]) {
    next.dailies[summary.dateKey] = {
      number: summary.daily.number,
      safe: summary.safe,
      tasksDone: summary.tasks.map((task) => task.done),
      sectorName: summary.sectorName,
    };
  }
  return next;
}

/** Hours on duty for the licence card, one decimal. */
export function hoursOnDuty(service) {
  return (service.seconds / 3600).toFixed(1);
}

/**
 * The logbook with a new report on top, the oldest falling out.
 * @template T
 * @param {T[]} pages
 * @param {T} page
 * @returns {T[]}
 */
export function withPage(pages, page) {
  return [page, ...pages].slice(0, LOGBOOK_PAGES);
}

/** A licence number that stays the same for this player: four digits and the year. */
export function licenceNumber(seed) {
  return `${String(1000 + (seed % 9000)).padStart(4, '0')}-86`;
}
