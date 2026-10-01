# Abyssal Worms — notes

Adopted on 2026-10-01 by prompt 01 (adopt eight finished games), as a static (no build step) hosted
game like Selene.

## Sources studied

| Source                                                                   | What we took or learned                                                                   |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `E:\Projects\BSDGames\bsdgames\worms\ports\fancy-web` (the owner’s port) | Copied into `games/worms/app/` as described below; its docs are the source for these docs |
| `BSDGames-master/worms/worms.c`                                          | Author and date, the turn tables, the main loop, option parsing, the unseeded `random()`  |
| `BSDGames-master/worms/worms.6`                                          | Manual page copyright years (1989, 1993) and the program it was modelled on               |

### What was copied

- **From:** `E:\Projects\BSDGames\bsdgames\worms\ports\fancy-web` (and nothing else from the
  earlier project).
- **Copied:** 35 files, 206,218 bytes, into `games/worms/app/`.
- **Left out:** `media/` (9 screenshots, 9.1 MB), `node_modules/` (183 files, 17.7 MB) and
  `package-lock.json`.
- **Moved:** the upstream ADRs (`docs/decisions/`) to [`adr/`](adr/), unchanged.
- **Folded:** the upstream `AGENTS.md` and `CLAUDE.md` into `app/UPSTREAM-AGENTS.md`, with a note
  that repository rules win.
- **Kept as history:** the upstream `README.md` and `docs/` (architecture, diff log, notes, test
  scenarios). Their links to the earlier project’s folders and to the left-out screenshots no longer
  resolve.

### Integration changes (every file touched)

| File                 | Change                                                                                                                                                                                                                                                                                          |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/index.html`     | Google Fonts links replaced by the local `fonts.css`; the bridge script tag `../../bridge/bridge.js` added                                                                                                                                                                                      |
| `app/src/ui/fonts/*` | New: `fonts.css` and two Latin woff2 files (Inter, JetBrains Mono)                                                                                                                                                                                                                              |
| `app/src/hall.js`    | New: the bridge glue (visit, packages, poster)                                                                                                                                                                                                                                                  |
| `app/src/ui/app.js`  | One import and calls into `hall.js`: `noteLettersEaten` in `doStep` while the field is on, `noteOptions` in `applyOpts`, `noteCommandLine` after an accepted command line, `noteView` in `setView`, `noteSplitMoved` on a divider drag or arrow key, the poster offer after a successful render |
| `app/package.json`   | `start` serves on the collection’s port for worms, 5203                                                                                                                                                                                                                                         |

Nothing else changed: no rebalancing, restyling, copy edits or refactors.

## Verified behaviour of the original

- Eric P. Scott wrote it at Caltech High Energy Physics in October 1980; the manual page carries the
  Regents’ 1989 and 1993 copyright and calls it a Unix version of the DEC-2136 program of the same
  name. — the author’s banner in `worms.c`; `worms.6`.
- It never calls `srandom()`, so the C library starts from its default seed and a run replays
  identically on a terminal of the same size. — read `main()`; upstream, seven configurations ×
  four screens captured from a binary built from this source each match the port at seed 1 at
  exactly one step, with no differing cells (`app/docs/notes.md`).
- Every worm starts with orientation 0 (up and to the right) and no cells; on its first move it
  appears at column 0 of the bottom row. — the start-up loop and the first lines of the main loop.
- A tail cell is blanked only when its reference count falls to zero, so a cell shared by two worms
  survives the first one leaving; blanked cells take the trail character (a space, or a dot with
  `-t`). — the main loop.
- The next turn comes from one of nine tables chosen by where the head stands (a corner, an edge or
  open screen), picked by `random()` modulo the number of options; a table with no options would
  abort, and no reachable state has one. — read the nested choice; proved by the port’s invariant
  tests.
- `-d` is read with `strtoul` and cut to an unsigned int before the 1–1000 check, so huge values wrap
  into range; giving `-d 0` is refused; with no `-d` the loop never sleeps. — read the option
  parsing and the loop; upstream, 31 argument lists captured from the binary.
- The adopted engine’s 33 tests pass unchanged after adoption (`tests/fixtures/worms-binary-golden.json`
  holds the captures).

## Network findings

| Found                                                                      | Kind            | Action                                                      |
| -------------------------------------------------------------------------- | --------------- | ----------------------------------------------------------- |
| Google Fonts links in `index.html`                                         | web font load   | Self-hosted Inter and JetBrains Mono (OFL); links removed   |
| `github.com/vattam/BSDGames/…` in credit comments in `worms.js`, `args.js` | comment         | Kept; allow-listed (ADR 0011)                               |
| `http://localhost…` in `scripts/serve.mjs` and `capture-screenshots.mjs`   | developer tools | Not shipped (the build leaves `scripts/` out); allow-listed |

Everything else is drawn and synthesised in code. The in-Hall suite records every request during a
visit; none leaves the Hall’s origin.

## XP and packages

Abyssal Worms is a toy (`/usr/games/toys`), so the progression engine gives it a flat 6 XP once a
day whatever it reports, and ignores XP events. The visit counts (`outcome: complete`) on the first
key press or click; moving the pointer does not count, so opening the worms and leaving them
running earns nothing. Its six packages are 15 XP each, matching the progression model for toys
(`packages/kit/src/progression/sim/collection.ts`: six small packages worth 15 XP), so the balance
simulations stay representative.

## Performance

Upstream measurements (RTX 4060 laptop, ANGLE/D3D11, `-n 20 -l 64 -t -f`): 60 fps at 1440×900 at
pixel ratios 1 and 2 and at 2560×1440, about 9–13 ms of render time a frame; the bodies and trails
cost about 2.3 ms of CPU geometry. A software renderer gets Low quality at once and is ready in
about 0.3 s; slow frames on High switch to Low once. The documentation screenshots are taken on the
GPU (`GPU_LAUNCH_ARGS` in `packages/bridge/testing/shots.ts`), because headless Chromium otherwise
falls back to SwiftShader and Low quality.

## Decisions log

| Date       | Decision                                                     | Why                                                                             |
| ---------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| 2026-10-01 | Title “Abyssal Worms”, as the game shows itself              | Prompt 01 §7: the final title is the one the game already shows                 |
| 2026-10-01 | No title-screen signal                                       | Abyssal Worms has no title screen; the Hall’s strip carries the ways out        |
| 2026-10-01 | A visit counts once, on the first key press or click         | Toys must never reward being left open; pointer movement only wakes the toolbar |
| 2026-10-01 | Packages only for moments the controller already knows about | Changes to the game stay single calls into `hall.js` (ADR 0011)                 |
| 2026-10-01 | The poster is taken from `#abyss` 5 s after opening          | By then the worms have left the corner and spread across the floor              |

## Open questions

- Abyssal Worms has only its dark night look; a light appearance is listed among the missing
  appearances in `docs/KNOWN-ISSUES.md`.
- The Hall’s reduced-motion setting does not reach it: it reads `prefers-reduced-motion` once, at
  start (`docs/KNOWN-ISSUES.md`).
- The sound keeps playing while the tab is hidden; nothing listens for the page becoming hidden.
- Resizing the window restarts the worms, by design upstream (a new terminal), which can surprise.
- Its shortcuts are single letters (C, V, S, M, R, F) and Space, with no modifier.
- The command line’s usage and error messages are the original’s own wording (derived under its
  BSD licence); whether to keep them is for the owner or a worms modification prompt (ADR 0011).
