# BSD falling-blocks fancy-web — Diff Log

What the owner's fancy-web port (read-only reference outside this repo, never copied verbatim)
kept from the canonical BSD original, what it changed or added on top, and what changed again on
adoption into /usr/games Reborn as `blocks-classic`.

## What the fancy-web port kept from the BSD original

- The seven tetromino shapes (I, O, T, S, Z, J, L).
- The 10-wide × 20-high well as the default board size.
- The core loop: spawn → move/rotate/drop → lock → clear lines → repeat.
- Gravity as the main pressure, and the line-clear scoring bonus (single/double/triple/quad).
- Single-keystroke, immediate controls; restarting immediately after a shift ends.

## What the fancy-web port changed or added (kept on adoption)

- **Rotation:** clockwise and counter-clockwise with a basic wall kick, instead of the original's
  one-direction rotation.
- **Randomizer:** a seven-bag randomizer instead of `random() % 7`, so no long piece droughts.
- **Speed curve:** gravity scales by level (from lines cleared) rather than a continuous curve.
- **Scoring:** multipliers for line clears and soft/hard-drop bonuses.
- **Non-rectangular well presets:** Canyon, Split, Hourglass, Donut, Staircase, Tower, Wide
  (ADR [001](decisions/001-custom-well-shapes.md)).
- **Starting rubble stack** with configurable height and density, and a **flood mode** where
  rubble rows rise periodically (ADR [002](decisions/002-flood-mode.md)).
- Next-piece preview, ghost piece, lock delay, a pause overlay, on-screen touch controls.

## What changed again on adoption into `blocks-classic`

- **Engine made pure and seedable.** The fancy-web port's `Game` class read the DOM and called
  `Math.random()` directly. The adopted `src/engine.js` is DOM-free (a page drives it with
  `update(dt)` and reads its fields to draw) and takes a seeded RNG, so the Daily Shift is the
  same well for every player and the Node tests can replay a run exactly.
- **Renamed, never retextured mechanics.** "Wall" cells became "rock"; the garbage stack and
  Survival mode became "rubble" and "the flood" in the UI, but the collision rules, wall kicks,
  lock delay and scoring are unchanged.
- **The original's trademarked name never appears in the UI**, per this collection's hard rule on trademarks; the
  title became "Broken Well" and the original name is kept only in `manifest.json`'s
  `inspiredBy.originalTitle` and in `CREDITS.md`.
- **Language.** The fancy-web port's pause overlay read `Tekan P untuk melanjutkan` and its win
  overlay `Selesai!`; both were Indonesian debug strings left in by the owner's earlier session.
  The three sibling adopted classics (`atc-classic`, `wump-classic`, `worm-classic`) all play in
  English, so `blocks-classic`'s copy is English throughout, written fresh rather than translated.
- **Gamification added on top:** a quarry foreman's twelve-shift career with ranks, a three-contract
  briefing per shift, a logbook, Free Dig (the original port's settings screen, re-themed) and a
  Daily Shift, none of which touch the engine's own rules.
- **Settings UI removed as a title screen**; its fields (board preset, dimensions, garbage height
  and density, mode, start level) now live inside Free Dig, reached from the game menu.

## What Was Removed

- Terminal/curses rendering (removed before the fancy-web port even existed).
- The original high-score file system (setgid/flock) — there was never one in the fancy-web port.
- The fancy-web port's own high-score persistence (none existed) is replaced by the Hall's save and
  this game's own career/logbook saves (`src/store.mjs`).

## Open Questions / Future Work

- A hold-piece slot and a longer next queue (2–5 pieces), as the fancy-web port's own diff-log
  already proposed and never built.
- Sprint / Time Attack modes, also proposed upstream and not built here.
- On-screen touch controls were part of the fancy-web port; this adoption did not rebuild them
  (see `docs/KNOWN-ISSUES.md`).
