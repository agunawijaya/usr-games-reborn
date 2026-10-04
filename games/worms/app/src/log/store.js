// Abyssal Worms — the logbook's memory: sightings by kind, the journal's species, the Daily Dives
// and the postcards. Kept under the collection's `usr-games:` prefix, so the Hall's "Forget
// everything" clears it with the rest. Storage can be missing or full: every call fails quietly.

const KEY = 'usr-games:worms:log';
const VERSION = 1;
export const POSTCARDS_KEPT = 12;
const DAYS_KEPT = 60;

/**
 * @typedef {{ seed: number, opts: { number: number, length: number, delay: number, field: boolean, trail: boolean },
 *   cell: number, view: string, savedOn: string }} Postcard
 * @typedef {{ sightings: Record<string, number>, species: number[], dives: Record<string, string[]>,
 *   divesFinished: number, postcards: Postcard[] }} Log
 */

/** @returns {Log} */
export function freshLog() {
  return { sightings: {}, species: [], dives: {}, divesFinished: 0, postcards: [] };
}

/** @returns {Log} */
export function loadLog() {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (!raw) return freshLog();
    const saved = JSON.parse(raw);
    return saved && saved.v === VERSION ? { ...freshLog(), ...saved.data } : freshLog();
  } catch (_) {
    return freshLog();
  }
}

/** @param {Log} log */
export function saveLog(log) {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify({ v: VERSION, data: log }));
  } catch (_) {
    // A full or blocked storage loses this entry; the abyss is unaffected.
  }
}

/** A sighting logged: returns the next log. */
export function logSighting(log, kind) {
  return { ...log, sightings: { ...log.sightings, [kind]: (log.sightings[kind] ?? 0) + 1 } };
}

export function logSpecies(log, index) {
  return log.species.includes(index) ? log : { ...log, species: [...log.species, index].sort((a, b) => a - b) };
}

/**
 * A sighting found in a dive. Returns the next log and whether this finished the day's dive for
 * the first time.
 */
export function logDiveFind(log, dive, kind) {
  if (!dive.seek.includes(kind)) return { log, finished: false };
  const found = log.dives[dive.key] ?? [];
  if (found.includes(kind) || found.length >= dive.seek.length) return { log, finished: false };
  const next = [...found, kind];
  const keys = [...new Set([...Object.keys(log.dives), dive.key])].sort().slice(-DAYS_KEPT);
  const dives = Object.fromEntries(keys.map((key) => [key, key === dive.key ? next : log.dives[key]]));
  const finished = next.length === dive.seek.length;
  return { log: { ...log, dives, divesFinished: log.divesFinished + (finished ? 1 : 0) }, finished };
}

/** Keeps the newest postcards, newest first. */
export function addPostcard(log, postcard) {
  return { ...log, postcards: [postcard, ...log.postcards].slice(0, POSTCARDS_KEPT) };
}

export function removePostcard(log, index) {
  return { ...log, postcards: log.postcards.filter((_, i) => i !== index) };
}
