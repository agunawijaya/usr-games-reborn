# ADR-007: Persistence — Versioned JSON Snapshots in localStorage

- **Status:** Accepted
- **Date:** 2026-09-24
- **Deciders:** Agun Wijaya (repo owner), implemented with Claude
- **Scope:** Port-level (`battlestar/ports/fancy-web`)

## Context

The original `save` verb asks for a file name and dumps raw variables
to `$HOME/.Bstar` (`save.c`); `battlestar -r` restores it and re-enters
the turn loop at `start:` (so `news()` runs again). The dump omits
`beenthere`, `wiz`, `tempwiz` and `verbose`, and only the *current*
day or night room file is written — the other one reverts to its
compiled defaults (e.g. a door you blew open at night is closed again
in the day table after a restore). A browser has no home directory.

## Options Considered

### Option A — Emulate `.Bstar` byte for byte in localStorage

**Pros:** maximal fidelity. **Cons:** binary layout depends on the C
ABI; inherits the omissions (visited rooms and the map would be lost on
every reload); unreadable.

### Option B — Versioned JSON snapshot of the whole engine (chosen)

**Description:** `Battlestar.snapshot()` returns every engine field
(both room files' links and objects, inventory, injuries, notes,
`beenthere`, the fly.c persistents, the parser's word arrays, the
Override flags and the glibc RNG state), tagged
`{format: 'battlestar-fancy-web', version: 1}`.

**Pros:**
- Lossless round trip, tested: a restored game continues with a
  transcript identical to the uninterrupted one.
- Human-readable; forward-compatible through the version field.

**Cons:**
- Not the original's (buggy) omissions — a small, documented deviation.

### Option C — IndexedDB / cloud sync

**Pros:** larger quotas, cross-device. **Cons:** unneeded for ~40 KB.

## Decision

**We chose Option B.**

- The `save` verb keeps the original prompt ("Save file name (default
  .Bstar): "); the name becomes a slot key in `localStorage`
  (`battlestar:save:<name>`); the message is "Saved in <name>."
  (no `$HOME` path).
- **Load** (menu) restores a slot the way `battlestar -r` does:
  banner, then the `start:` block, so `news()` runs again as in C.
- **Autosave** (between commands) keeps a separate slot and resumes
  *at the prompt* without re-running `news()`, so reloading the page
  never triggers a second fight or a day/night event.
- `beenthere` and `verbose` are persisted (the map and the "visited"
  score survive a reload); `tempwiz` is persisted too, although the
  engine would recompute it from the artifacts held.

## Consequences
- Old saves with a higher `version` are refused with a clear message.

## References
- `save.c`, `src/engine/battlestar.js` `snapshot()`/`restore()`,
  `tests/save.test.js`.
