// Saves on this device under `usr-games:hunt:`, each with a version so an
// old shape can be dropped rather than misread. The port's own settings and
// key bindings keep their keys (`hunt.settings`, `hunt.keys`).

const PREFIX = 'usr-games:hunt:';

export function load(name, version, fallback) {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFIX + name) || 'null');
    return saved && saved.v === version ? saved.data : fallback;
  } catch {
    return fallback;
  }
}

export function save(name, version, data) {
  try {
    localStorage.setItem(PREFIX + name, JSON.stringify({ v: version, data }));
  } catch {
    // storage unavailable (private window, blocked site data): play goes on unsaved
  }
}
