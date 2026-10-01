# Control Room 1986 — notes

Adopted on 2026-10-01 as a static hosted game, by the owner’s addendum to prompt 02: the owner’s
earlier typed-radar port of `atc` joins the Hall as a second interpretation of the game, beside the
collection’s native `atc`, which another session builds in parallel. The two share nothing: no code,
no files, no progress.

## Sources studied

| Source                                                                  | What we took or learned                                                                                      |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `E:\Projects\BSDGames\bsdgames\atc\ports\fancy-web` (the owner’s port)  | Copied into `games/atc-classic/app/` as described below; its docs are the source for these docs              |
| `BSDGames-master/atc/main.c`                                            | Authorship and both notices; the main loop, where an empty line forces an update                             |
| `BSDGames-master/atc/atc.6.in`                                          | Goals, display, the order grammar, the delay, marking, the field file format and its example, files, authors |
| `BSDGames-master/atc/update.c`                                          | The order of an update, rate limits, fuel, the loss checks and their messages, new planes, plane names       |
| `BSDGames-master/atc/input.c`                                           | The grammar’s state table, the forced update, the bell on a refused key                                      |
| `BSDGames-master/atc/def.h`, `graphics.c`, `log.c`                      | The low-fuel threshold, the radar’s characters, the score file and its order                                 |
| `BSDGames-master/atc/games/` (`Game_List`, `default`, `easy`, `Killer`) | The fifteen sectors and the three the port names, compared with `src/playfields.js`                          |

### What was copied

- **From:** `E:\Projects\BSDGames\bsdgames\atc\ports\fancy-web` only. Nothing else in the earlier
  project was opened.
- **Copied:** 18 files, 246,953 bytes, into `games/atc-classic/app/`, unchanged.
- **Left out:** `media/` (3 screenshots, 774,589 bytes, about 0.74 MB). The port had no
  `node_modules/`, no `package-lock.json` and no `package.json`.
- **Moved:** the upstream ADRs (`docs/decisions/`) to [`adr/`](adr/), byte for byte.
- **Folded:** the upstream `AGENTS.md` and `CLAUDE.md` into `app/UPSTREAM-AGENTS.md`, with a note
  that repository rules win.
- **Kept as history:** the upstream `README.md` and `docs/diff-log.md`. Their links to the earlier
  project’s shared docs and to the left-out screenshots no longer resolve, and the README’s
  `docs/test-scenarios.md` never existed.

### Integration changes (every file touched)

| File                     | Change                                                                                                                                                                                                                                                                                                            |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/index.html`         | The three lines that loaded web fonts from a font CDN (two preconnects and the stylesheet) replaced by the local `src/fonts/fonts.css`; the bridge script tag added before the module script                                                                                                                      |
| `app/src/fonts/*`        | New: `fonts.css` and two Latin woff2 files (VT323 400, Share Tech Mono 400) from `@fontsource/vt323` 5.3.0 and `@fontsource/share-tech-mono` 5.3.0                                                                                                                                                                |
| `app/src/hall.js`        | New: the bridge glue (title screen, results, packages, poster)                                                                                                                                                                                                                                                    |
| `app/src/main.js`        | One import and five calls (`noteShiftStarted` at the end of `startNewGame`, `noteTick` after `tick`, `noteShiftEnded` at the top of `endGame`, `noteCommand` once an order is accepted, the poster after `render()`); `pickTtsVoice` keeps only on-device voices and `speak` stays silent without one (see below) |
| `app/package.json`       | New, minimal: the unit-test script, so `pnpm run test:hosted` runs the upstream tests                                                                                                                                                                                                                             |
| `app/UPSTREAM-AGENTS.md` | New: the folded agent guides                                                                                                                                                                                                                                                                                      |

Nothing else changed: no rebalancing, restyling, copy edits or refactors. The 65 upstream tests
pass unchanged (re-run 2026-10-01), one more than the upstream README counts. The test script is `node --test "tests/*.test.js"`: on Node 22 a bare `tests/` is read
as a file pattern and finds nothing, so the folder form the README gives no longer runs.

## Verified behaviour of the original

- The sources say the code was contributed to Berkeley by Ed James, under the Regents’ copyright
  of 1990 and 1993, with his own notice of 1987 asking that it be kept on every copy. — the
  headers of `main.c` and every source file.
- The manual says the game is based on someone’s description of a game written for an unknown PC
  many years earlier, “maybe”. — `atc.6.in`, AUTHOR.
- There is no winning state: the goal is to keep the game going, and the score list is sorted by
  planes safe, then by updates. — `atc.6.in`, GOALS; `log.c`.
- One update, in order: planes ordered above 0 leave the ground; each plane in the air (props only
  on even clocks) burns one fuel, moves its altitude one step toward the ordered one, turns at most
  two eighths toward the ordered heading unless it is holding for a beacon, and moves one cell;
  then it is checked against its destination and the loss conditions; then arrivals are counted,
  the radar redrawn, pairs checked for collision and a new plane rolled with odds of one in the
  sector’s `newplane`. — `update.c`, `update`.
- Planes are type 0 or type 1 at even odds; type 0 moves only on every other update and is shown
  as an uppercase letter, type 1 as a lowercase one, and the manual calls the uppercase ones props
  and the lowercase ones jets. — `update.c` (`addplane`, `name`); `atc.6.in`, RADAR.
- A plane’s fuel at the start is the sector’s width plus its height; the information area marks it
  with an asterisk below 15. — `update.c`; `def.h` (`LOWFUEL`).
- Planes enter from an exit at 7,000 feet in the exit’s direction, or wait on the ground at an
  airport; a plane from an exit is held back while any plane in the air is within four cells in
  every direction and four thousand feet. — `update.c`, `addplane`; `atc.6.in`.
- Collision is adjacency in all three dimensions: within one cell across and one thousand feet. —
  `update.c`, `too_close`; `atc.6.in`.
- Every cell of the border lies outside the arena: a plane there that is not on its own exit at
  9,000 feet ends the game, with “exited via the wrong exit” if the cell is another exit and
  “illegally left the flight arena” otherwise. — `update.c`.
- The loss messages: ran out of fuel, landed in the wrong direction, exited at the wrong altitude,
  “exceded” flight ceiling, landed at the wrong airport, landed instead of exited, crashed on the
  ground, exited via the wrong exit, exited instead of landed, illegally left the flight arena,
  collided with another plane, and a destination that needs “help”. — `update.c`.
- An empty line forces the next update at once. — `input.c` (`getcommand` returns early) and
  `main.c`.
- Every order starts with a plane letter (case ignored). Altitude: `a` with a digit, `c`/`+` or
  `d`/`-` for relative changes. Turns: to one of the eight keys around `s`, left or right by an
  amount (`l`, `-`, `r`, `+`), hard left or right (`L`, `R`), or toward a beacon, exit or airport
  (`tt` with `b` or `*`, `e`, `a`). Circling: `c`, `cl` or `cr`. Marking: `m`, `u`, `i`. A delay
  (`a` or `@`, then `b` and a digit) holds a turn or circle until the plane reaches that beacon. —
  `input.c` (the state table); `atc.6.in`.
- `?` lists the characters that may come next; a key that cannot be accepted rings the terminal
  bell. — `input.c`.
- Suspending the game is not permitted. — `atc.6.in`.
- Fifteen sectors ship, listed in `Game_List` with `default` first. The `default` file says a new
  plane every 10 updates on average while the manual’s example of it says 5; `easy` is 15×15 with
  a 7-second update, `Killer` 30×21 with a 1-second update, one airport and four beacons. —
  `games/`.

## The adopted engine

The port’s engine was written from its own specification of the rules above; its comments call
it faithful, and the tick order, rate limits, fuel and collision rule do match. Where it differs,
recorded by reading `app/src/engine.js` and `app/src/parser.js` and kept on adoption:

- The edge cells, exits included, are inside the radar. A plane may fly along the edge and over
  other exits; only leaving the grid loses, always as “illegally left the flight arena”, so
  “exited via the wrong exit” and “exited instead of landed” can never happen.
- New planes are held back by planes within four cells across, from any origin, without comparing
  altitude.
- Letter case is swapped: jets (fast) are uppercase, props lowercase.
- The delay suffix (`@b1`, `ab1`) is parsed and then ignored: the order runs at once, and the
  `beacon` event never fires. The relative turns, `tt*`, `cl` and `cr` are not parsed.
- In a tick that loses a plane, the engine stops before counting that tick’s arrivals, though the
  event log and the radio already reported them. `hall.js` follows the score and counts nothing
  from that tick.
- `?` does nothing on the title screen, though the title’s own help line offers it.
- Choosing a sector on the title screen does not move the highlight in the sidebar’s sector
  buttons, which keep showing the previous choice until one of them is pressed.
- The sector comments in `playfields.js` call Easy and Killer the original’s maps; they are new
  layouts (see [`CHANGES-FROM-ORIGINAL.md`](CHANGES-FROM-ORIGINAL.md)).
- The `SHIFT` clock counts down fifteen minutes and stops at zero; nothing reads it.

## Network findings

| Found                                                                                                  | Kind                         | Action                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Web fonts from a font CDN in `index.html`: two preconnects and the stylesheet (VT323, Share Tech Mono) | web font load                | Self-hosted Latin woff2 files (OFL); the three lines removed. The upstream ADR 001 chose the web fonts; the collection does not allow them |
| Three badge images and a source link in the upstream `README.md`                                       | documentation                | Kept; top-level Markdown is workbench the build leaves out, and the network guard scans code only                                          |
| “WebRTC / WebSocket” and a live radio feed in `docs/diff-log.md` and the README                        | roadmap text                 | Kept; prose about ideas for later, with no code behind it (`docs/` and Markdown are not shipped)                                           |
| The radio voice: `speechSynthesis` in `src/main.js`                                                    | possible request at run time | Changed: only voices with `localService` true are used, and without one the game does not speak (below)                                    |

No `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, `importScripts`, workers,
images or external URLs exist in the shipped files (`index.html` and `src/`).

**The voice.** The radio speaks through the Web Speech API when the player turns the voice on (it
is off by default). Some browsers offer online voices (`localService` false) that send the text to
a speech service, and when no voice is set on an utterance the browser’s default voice is used,
which can be one of those. Upstream picked the first US English voice, then any English one, then
the first voice of all. Two lines in `main.js` now keep only on-device voices and return before
speaking when there is none, so the subtitles fall back to their own reading-pace timer. The
in-Hall suite proves both: with an online US English voice and an on-device British one offered,
every line goes to the on-device voice; with only the online one, nothing is spoken and the
subtitle still shows. The in-Hall suite also records every request during a visit (title, a shift
begun, a forced tick): none leaves the Hall’s origin.

## XP and packages

Twelve packages in the tier mix of the progression model (six core, four extra, two rare), so the
balance simulations stay representative. All are read from the engine’s own events and the
orders the player types:

| Package               | Tier  | Detected from                                                                                             |
| --------------------- | ----- | --------------------------------------------------------------------------------------------------------- |
| `wheels-down`         | core  | a `land` event                                                                                            |
| `handed-off`          | core  | an `exit` event                                                                                           |
| `cleared-for-takeoff` | core  | a `takeoff` event                                                                                         |
| `holding-pattern`     | core  | a `circle` order accepted for a plane that later lands or exits                                           |
| `on-the-beacon`       | core  | a `towardsBeacon` order accepted for a plane that later lands or exits                                    |
| `steady-hands`        | core  | 5 planes safe in one shift                                                                                |
| `reference-sector`    | extra | 5 planes safe in one shift on Default                                                                     |
| `minimum-fuel`        | extra | a plane seen in the air at fuel 6 or less (when its pilot calls “minimum fuel”) that later lands or exits |
| `full-board`          | extra | 10 planes safe in one shift                                                                               |
| `fast-lane`           | extra | a `land` or `exit` event on Killer                                                                        |
| `rush-hour`           | rare  | 5 planes safe in one shift on Killer                                                                      |
| `double-shift`        | rare  | 25 planes safe in one shift                                                                               |

A plane is followed by its radar letter; the sets forget a letter when its plane arrives or a new
plane takes the letter. Nothing counts from a tick that loses a plane.

XP events stay small: 3 XP per plane safe, at most 25, inside the Hall’s cap of 30. At the upstream
stress averages (3.2 planes on Easy) a shift earns about 10. The weekly goal “Guide {n} planes
home” (10–30) counts `planesSafe`. The catalog’s progression row already said arcade, 5–15
minutes and no daily challenge, which is true: each shift draws new traffic and there is no daily
seed.

## Balance

Upstream measurement, locked loosely in `app/tests/stress.test.js`: an autoplayer that types every
suggestion of the cheat panel for every plane, for up to 200 ticks, loses every run, bringing home
96 planes over 30 Easy seeds (3.2 a shift) and 52 over 20 Default seeds (2.6). The test only
requires that 40% of Easy runs and 30% of Default runs bring at least one plane home. Collisions
and fuel are the usual ends. The upstream README expects a player who judges which plane to serve
first to do better than the autoplayer; that was not measured.

## Performance

Upstream claim, not re-measured: 60 fps on 2020-era mid-range hardware with more than 20 planes
on Killer. The radar is redrawn every frame in Canvas 2D (dots, rings, sweep, letters). The site
ships `index.html` (54 KB, all CSS inline), 113 KB of its own JavaScript and 31 KB of fonts, about
199 KB in all, and no images.

## Decisions log

| Date       | Decision                                                                                | Why                                                                                                                                            |
| ---------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-01 | Adopted as `atc-classic`, “Control Room 1986”, a second interpretation of `atc`         | The owner’s decision; the title is the game’s own branding                                                                                     |
| 2026-10-01 | The title screen is reported from its `hiding` class with a `MutationObserver`          | Keeps the changes to `main.js` to single calls                                                                                                 |
| 2026-10-01 | No extra Escape guard for the tutorial                                                  | It cannot open over the title, and during a shift the game already calls `preventDefault` when Escape closes it; the in-Hall suite checks both |
| 2026-10-01 | `win` when at least one plane came home, else `loss`                                    | The game has no winning state; the first plane home is its first milestone (ADR 0011)                                                          |
| 2026-10-01 | Score = planes safe                                                                     | It is the game’s own score, and the original’s ranking                                                                                         |
| 2026-10-01 | A shift abandoned with a sidebar sector button, after at least one tick, reports `quit` | Its planes still count toward the weekly goal, but it earns no XP; switching before any tick logs nothing                                      |
| 2026-10-01 | The cheat panel does not mark a shift                                                   | It only suggests; the player types every order, as with trek’s hint panel. It is on by default                                                 |
| 2026-10-01 | Nothing counts from a tick that loses a plane                                           | The engine leaves those arrivals out of the score                                                                                              |
| 2026-10-01 | Poster: the radar six seconds into the first shift, with a plane in the air             | The radar is the game; the title’s canvas holds only a sweep                                                                                   |
| 2026-10-01 | CDN web fonts replaced by self-hosted files; voice limited to on-device voices          | No runtime network requests (hard rule 4, ADR 0011)                                                                                            |
| 2026-10-01 | Airline names, call signs and the airport code kept in `app/` for now                   | Copy is not edited on adoption; listed in `docs/KNOWN-ISSUES.md`                                                                               |
| 2026-10-01 | Test script `node --test "tests/*.test.js"` instead of `tests/`                         | Node 22 reads `tests/` as a pattern and finds no files                                                                                         |

## Open questions

Listed in `docs/KNOWN-ISSUES.md` for the owner or a modification prompt:

- The temporary trademark exception: real airline names and call signs in the radio, the traffic
  panel and the event log, and a real airport’s code in the Default sector’s name.
- Upstream wording: the loss reasons repeat the original’s messages almost word for word.
- One dark look only; no light appearance.
- The Hall’s pause does not reach the game: in a hidden tab the shift keeps ticking, and a plane
  can be lost while the player is away. Sound is on by default and keeps playing while the tab is
  hidden.
- No `:focus-visible` styles, no ARIA beyond a hidden subtitle bar, and no reduced-motion handling
  (the sweep and the title’s fade always run).
- Enter on a Tab-focused sector button begins the shift before the choice applies, so a keyboard
  player cannot pick a sector.
- The sidebar’s sector buttons abandon a running shift without asking.
- `?` does nothing on the title, though the title offers it; the sidebar highlight lags the
  title’s sector choice.
- The delay suffix is accepted and silently ignored.
- The loss screen offers only a new shift; the results order of the navigation standard (Play
  again, Game menu, Back to the Hall) is left to the Hall’s strip.
- The Hall’s volume and mute settings do not reach the game, which has its own switches.
- This session’s screenshots and in-Hall runs used a Hall that Playwright started on port 5209:
  the Hall already running on 5174 had read the games’ manifests before this one existed, and its
  dev server does not notice new manifest files until it restarts.
