// Talon's Shadow — saved progress. Kept under the collection's `usr-games:` prefix, so the Hall's
// "Forget everything" clears the expedition, the stamps, the field book and the Daily record with
// the rest. Storage can be missing or full (a private window, a preview): every call fails quietly
// and the game plays on with fresh defaults.

const PREFIX = 'usr-games:snake-classic:';
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
    return saved && saved.v === VERSION ? { ...fallback(), ...saved.data } : fallback();
  } catch (_) {
    return fallback();
  }
}

/** @param {string} name @param {unknown} data */
export function save(name, data) {
  try {
    globalThis.localStorage?.setItem(PREFIX + name, JSON.stringify({ v: VERSION, data }));
  } catch (_) {
    // A full or blocked storage loses this save; the flight itself is unaffected.
  }
}
