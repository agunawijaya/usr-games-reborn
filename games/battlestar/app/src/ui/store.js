// localStorage wrapper: settings, save slots, autosave, hall of fame.
// Every access is guarded: private windows and blocked storage must not
// break the game (it simply stops persisting).

const P = 'battlestar:';

function get(key, fallback = null) {
  try {
    const v = localStorage.getItem(P + key);
    return v === null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}

function set(key, value) {
  try {
    localStorage.setItem(P + key, JSON.stringify(value));
    return null;
  } catch (e) {
    return e && e.name === 'QuotaExceededError' ? 'storage is full' : 'storage is not available';
  }
}

function del(key) {
  try { localStorage.removeItem(P + key); } catch { /* ignore */ }
}

export const store = {
  settings(defaults) { return { ...defaults, ...(get('settings') || {}) }; },
  saveSettings(s) { set('settings', s); },

  /** Named saves made with the in-game `save` verb. */
  save(name, snapshot, meta) {
    const index = get('saves-index', []);
    const entry = { name, at: Date.now(), ...meta };
    const i = index.findIndex((e) => e.name === name);
    if (i >= 0) index[i] = entry; else index.push(entry);
    const err = set(`save:${name}`, snapshot);
    if (err) return err;
    set('saves-index', index);
    return null;
  },
  load(name) { return get(`save:${name}`); },
  remove(name) {
    del(`save:${name}`);
    set('saves-index', get('saves-index', []).filter((e) => e.name !== name));
  },
  list() { return get('saves-index', []).sort((a, b) => b.at - a.at); },

  /** The autosave (resumes at the prompt, ADR-007). */
  autosave(snapshot, meta) { return set('autosave', { snapshot, meta, at: Date.now() }); },
  autoload() { return get('autosave'); },
  clearAutosave() { del('autosave'); },

  /** Hall of fame: the port's stand-in for the score file (post() in command6.c). */
  post(entry) {
    const list = get('fame', []);
    list.push({ at: Date.now(), ...entry });
    set('fame', list.slice(-100));
  },
  fame() { return get('fame', []); },
};
