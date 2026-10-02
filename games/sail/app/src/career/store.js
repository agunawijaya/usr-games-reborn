// Saved progress, kept under the collection's `usr-games:` prefix so the Hall's "Forget
// everything" clears the Sea Service, the engagements and the service record with the rest.
// Storage can be missing or full (a private window, a preview): every call fails quietly and the
// game plays on with fresh defaults. The top ten and the captain's name keep their own keys.

const PREFIX = 'usr-games:sail:';
const VERSION = 1;

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

export function save(name, data) {
  try {
    globalThis.localStorage?.setItem(PREFIX + name, JSON.stringify({ v: VERSION, data }));
  } catch (_) {
    // A full or blocked storage loses this save; the battle itself is unaffected.
  }
}

/** The Sea Service: for each action, whether it was won and which commendations were earned. */
export const loadService = () => loadSaved('service', () => ({ actions: {} }));
export const saveService = (service) => save('service', service);

/** Daily engagements by date: the first one fought each day is the one that counts. */
export const loadEngagements = () => loadSaved('engagements', () => ({ days: {} }));
export const saveEngagements = (engagements) => save('engagements', engagements);

/** Lifetime numbers for the service record. */
export const loadRecord = () =>
  loadSaved('record', () => ({ battles: 0, victories: 0, prizes: 0, broadsides: 0, rakes: 0, engagements: 0 }));
export const saveRecord = (record) => save('record', record);
