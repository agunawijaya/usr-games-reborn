# Selene — notes

Adopted on 2026-10-01 by prompt 01 (adopt eight finished games). Selene is the pilot for the
static (no build step) kind of hosted game.

## Sources studied

| Source                                                                 | What we took or learned                                                                           |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `E:\Projects\BSDGames\bsdgames\pom\ports\fancy-web` (the owner’s port) | Copied into `games/pom/app/` as described below; its docs are the source for these docs           |
| `BSDGames-master/pom/pom.c`                                            | Authorship and dates, the epoch, the output rules, the two-digit-year rule (verified facts below) |
| `BSDGames-master/pom/pom.6`                                            | Manual page copyright year (1989), author, acknowledged book, documented bugs                     |

### What was copied

- **From:** `E:\Projects\BSDGames\bsdgames\pom\ports\fancy-web` (and nothing else from the earlier
  project).
- **Copied:** 32 files, 492,656 bytes, into `games/pom/app/`.
- **Left out:** `node_modules/` (183 files), `media/` (10 screenshots, 7.4 MB) and
  `package-lock.json`. No `dist/`, `test-results/`, `references/` or coverage folders existed.
- **Moved:** the upstream ADRs (`docs/decisions/`) to [`adr/`](adr/), unchanged.
- **Folded:** the upstream `AGENTS.md` and `CLAUDE.md` into `app/UPSTREAM-AGENTS.md`, with a note
  that repository rules win.
- **Kept as history:** the upstream `README.md` and `docs/` (architecture, diff log, notes, test
  scenarios). Their links to the earlier project’s folders and to the left-out screenshots no longer
  resolve.

### Integration changes (every file touched)

| File                 | Change                                                                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `app/index.html`     | Google Fonts links replaced by the local `fonts.css`; the bridge script tag added                                                                            |
| `app/src/ui/fonts/*` | New: `fonts.css` and four Latin woff2 files (Cormorant Garamond ×2, Inter, JetBrains Mono)                                                                   |
| `app/src/hall.js`    | New: the bridge glue (results and packages)                                                                                                                  |
| `app/src/ui/app.js`  | One import and four calls into `hall.js`, the `settledHour` watch in the frame loop, and the once-per-visit full-Moon key-art frame beside the normal render |
| `app/package.json`   | `start` serves on the collection’s port for pom, 5201                                                                                                        |

Nothing else changed: no rebalancing, restyling, copy edits or refactors.

## Verified behaviour of the original

- The answer’s tense compares the time asked with the current second: earlier reads “was”,
  exactly now reads “is”, later reads “will be”. — read in `main()` of `pom.c`.
- “Full” and “New” are printed only when the percentage, rounded, is exactly 100 or 0; a rounded
  50 is a quarter (first or last by whether tomorrow is brighter); anything else is waxing or
  waning, gibbous or crescent, with the percentage. — read in `main()`.
- The epoch is 1990 January 0.0 in the book’s dynamical time; the program ignores the difference
  from the Unix clock. — the comment and constants above `potm()`; also listed as a bug in the
  manual.
- In the date argument, a two-digit year below 69 is taken as 20yy. — `parsetime()`.
- The author’s note dates the program to August 1984 (Keith E. Brandt) and the third-edition
  update to September 1998 (Paul Janzen); the manual page carries the Regents’ 1989 copyright. —
  the header comments of `pom.c` and `pom.6`.
- The adopted engine is checked against 1,616 captures of the real binary (Ubuntu’s bsdgames under
  WSL), recorded upstream in `app/docs/notes.md`; its 29 tests pass unchanged after adoption.

## Network findings

| Found                                                                    | Kind            | Action                                                      |
| ------------------------------------------------------------------------ | --------------- | ----------------------------------------------------------- |
| Google Fonts `preconnect`, `preload` and stylesheet links                | web font load   | Self-hosted the three families (OFL); links removed         |
| `github.com/vattam/BSDGames/…` in the About dialog                       | credit link     | Kept; allow-listed (ADR 0011)                               |
| `github.com/vattam/BSDGames/…` in a comment in `pom.js`                  | comment         | Kept; allow-listed (ADR 0011)                               |
| `http://localhost…` in `scripts/serve.mjs` and `capture-screenshots.mjs` | developer tools | Not shipped (the build leaves `scripts/` out); allow-listed |

The in-Hall suite records every request during a visit; none leaves the Hall’s origin.

## XP and packages

Selene is a toy (`/usr/games/toys`), so the progression engine gives it a flat 6 XP once a day
whatever it reports, and ignores XP events. The visit counts (`outcome: complete`) the first time
the view rests on a chosen hour, a timelapse starts or pom answers a typed date, so opening Selene
and leaving it running earns nothing. Its six packages are 15 XP each, matching the progression
model for toys (`packages/kit/src/progression/sim/collection.ts`: six small packages worth 15 XP),
so the balance simulations stay representative.

## Performance

Upstream measurements (RTX 4060 laptop, ANGLE/D3D11): about 6 ms a frame at 1440×900, 8.5 ms at
2560×1440; first shader compile on Windows takes several seconds, later visits use the browser’s
cache. On a software renderer Selene switches itself to a lite profile. The documentation
screenshots are taken on the GPU (`GPU_LAUNCH_ARGS` in `packages/bridge/testing/shots.ts`),
because headless Chromium otherwise falls back to SwiftShader and the lite profile.

## Decisions log

| Date       | Decision                                                               | Why                                                                           |
| ---------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 2026-10-01 | Title “Selene”, as the game shows itself                               | Prompt 01 §7: the final title is the one the game already shows               |
| 2026-10-01 | No title-screen signal                                                 | Selene has no title screen; the Hall strip would stay over its toolbar        |
| 2026-10-01 | A visit counts once, on the first real journey through time            | Toys must never reward being left open                                        |
| 2026-10-01 | “Resting on an hour” watched in the frame loop, not in the text update | The text update can skip the last frame of a jump; found by the in-Hall suite |

## Open questions

- Selene has only its night look; a light appearance is logged in `docs/KNOWN-ISSUES.md`.
- The Hall’s reduced-motion setting does not reach Selene, which reads the system setting when it
  starts (logged in `docs/KNOWN-ISSUES.md`).
- The one-line answer is the original’s own wording, reproduced by design (see
  [`CHANGES-FROM-ORIGINAL.md`](CHANGES-FROM-ORIGINAL.md) and `docs/KNOWN-ISSUES.md`).
