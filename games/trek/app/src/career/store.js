// Deep Space Command — saved progress. Kept under the collection's `usr-games:` prefix, so the
// Hall's "Forget everything" clears the tour, the patrol log and the service record with the
// rest. Storage can be missing or full (a private window, a preview): every call fails quietly
// and the game plays on with fresh defaults.

const PREFIX = 'usr-games:trek:';
const VERSION = 1;

/**
 * @template T
 * @param {string} name
 * @param {() => T} fallback
 * @returns {T}
 */
export function loadSaved(name, fallback) {
  try {
    const raw = globalThis.localStorage?.getItem(PREFIX + name);
    if (!raw) return fallback();
    const saved = JSON.parse(raw);
    return saved && saved.v === VERSION ? saved.data : fallback();
  } catch (_) {
    return fallback();
  }
}

/** @param {string} name @param {unknown} data */
export function save(name, data) {
  try {
    globalThis.localStorage?.setItem(PREFIX + name, JSON.stringify({ v: VERSION, data }));
  } catch (_) {
    // A full or blocked storage loses this save; the mission itself is unaffected.
  }
}

/** The Frontier Tour: for each sortie, whether it was won and which commendations were earned. */
export function loadTour() {
  return loadSaved('tour', () => ({ sorties: {} }));
}

export function saveTour(tour) {
  save('tour', tour);
}

/** Daily patrols by date: the first patrol of each day, however it ended, is the one that counts. */
export function loadPatrols() {
  return loadSaved('patrols', () => ({ days: {} }));
}

export function savePatrols(patrols) {
  save('patrols', patrols);
}

/** Lifetime numbers for the service record. */
export function loadRecord() {
  return loadSaved('record', () => ({
    missions: 0,
    victories: 0,
    shipsDestroyed: 0,
    orders: 0,
    patrolsFlown: 0,
  }));
}

export function saveRecord(record) {
  save('record', record);
}
