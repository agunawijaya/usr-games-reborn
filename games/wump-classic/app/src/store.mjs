// The Rune Gates — saved progress. Kept under the collection's `usr-games:` prefix, so the Hall's
// "Forget everything" clears the career, the ledger, the codex and the Daily record with the
// rest. Storage can be missing or full (a private window, a preview): every call fails quietly
// and the game plays on with fresh defaults.

const PREFIX = 'usr-games:wump-classic:';
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
    // A full or blocked storage loses this save; the delve itself is unaffected.
  }
}
