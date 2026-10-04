# Control Room 1986 — notes

Adopted on 2026-10-01 as a static hosted game, by the owner’s addendum to prompt 02: the owner’s
earlier typed-radar port of `atc` joins the Hall as a second interpretation of the game, beside the
collection’s native `atc`, which another session builds in parallel. The two share nothing: no code,
no files, no progress.

On 2026-10-02 the owner asked for gamification around the adopted game: a career, briefings with
stamps, printed reports with a logbook and Daily Traffic, together with the Hall's pause reaching
the game and the cheat panel kept out of sight. That work is recorded in "Gamification" below.
Later that day polish prompt P1-C added the order buttons, a readable radar, the moment a plane
comes home, our own names and words, and fixed the quirks listed below; see "Polish P1-C".

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

| File                     | Change                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `app/index.html`         | The three lines that loaded web fonts from a font CDN (two preconnects and the stylesheet) replaced by the local `src/fonts/fonts.css`; the bridge script tag added before the module script; since prompt C1, the title-pulse rule repeated under `:root[data-motion='reduce']`                                                                                                                                                           |
| `app/src/fonts/*`        | New: `fonts.css` and two Latin woff2 files (VT323 400, Share Tech Mono 400) from `@fontsource/vt323` 5.3.0 and `@fontsource/share-tech-mono` 5.3.0                                                                                                                                                                                                                                                                                         |
| `app/src/hall.js`        | New: the bridge glue (title screen, results, packages, poster; since prompt C1 also the Hall’s sound and reduced motion)                                                                                                                                                                                                                                                                                                                   |
| `app/src/main.js`        | One import and five calls (`noteShiftStarted` at the end of `startNewGame`, `noteTick` after `tick`, `noteShiftEnded` at the top of `endGame`, `noteCommand` once an order is accepted, the poster after `render()`); `pickTtsVoice` keeps only on-device voices and `speak` stays silent without one (see below); since prompt C1, `onHallSound`, `hallLevel` on the hum, the beeps and the voice, and `hallReducedMotion` for the report |
| `app/package.json`       | New, minimal: the unit-test script, so `pnpm run test:hosted` runs the upstream tests                                                                                                                                                                                                                                                                                                                                                      |
| `app/UPSTREAM-AGENTS.md` | New: the folded agent guides                                                                                                                                                                                                                                                                                                                                                                                                               |

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
- The delay suffix (`@b1`, `ab1`) was parsed and then ignored. Fixed in P1-C (see below). The
  relative turns, `tt*`, `cl` and `cr` are not parsed.
- In a tick that loses a plane, the engine stops before counting that tick’s arrivals, though the
  event log and the radio already reported them. `hall.js` follows the score and counts nothing
  from that tick.
- `?` did nothing on the title screen, though the title’s own help line offered it. Fixed in
  P1-C: it opens how to play there too.
- Choosing a sector on the title screen did not move the highlight in the sidebar’s sector
  buttons. Since the gamification `startNewGame` sets the highlight for every shift; checked
  again in P1-C.
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
| 2026-10-01 | Airline names, call signs and the airport code kept in `app/` for now                   | Copy is not edited on adoption; listed in `docs/KNOWN-ISSUES.md` (replaced in P1-C)                                                            |
| 2026-10-01 | Test script `node --test "tests/*.test.js"` instead of `tests/`                         | Node 22 reads `tests/` as a pattern and finds no files                                                                                         |

## Gamification (2026-10-02)

The 1986 shift is untouched: the engine, the parser, the radio, the hints and the playfields did
not change. Around it:

| Piece            | Where                           | What it does                                                                                                                 |
| ---------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Career           | `app/src/career.js`             | Twelve assignments over the three sectors, a target each; ranks from Trainee to Chief of the Room; endorsements per sector   |
| Briefing         | `app/src/briefing.js`           | Two tasks per assignment, three drawn per open shift or Daily; a tracker fed by the engine's events and the orders typed     |
| Daily Traffic    | `app/src/daily.js`              | The kit's epoch (#1 on 2026-09-01), a sector by weekday, an FNV-1a seed of the date, a one-line share without a link         |
| Shift report     | `app/src/report.js`, `desk.js`  | 44-column lines printed on green-bar paper; the first key finishes the printing                                              |
| Service, logbook | `app/src/service.js`            | Shifts, planes home, hours on duty, stamps, best open shift per sector, the first Daily of each day; the last twenty reports |
| Saving           | `app/src/store.js`              | `usr-games:atc-classic:` keys with a version, so the Hall's "Forget everything" clears them                                  |
| The desk         | `app/src/desk.js`, `index.html` | The game menu's tabs (1 2 3), the licence card, the panels, the briefing clipboard and sidebar card, the report, the logbook |

### Targets

Measured with the cheat panel's autoplayer (every suggestion for every plane, no judgment), over
400 seeds per assignment, how often it reaches the target before a plane is lost. A player who
chooses which plane to serve first does better; the numbers are a floor, and the unit tests only
require each target to be reached on some seed.

| #   | Assignment           | Sector  | Target | Autoplayer reaches |
| --- | -------------------- | ------- | ------ | ------------------ |
| 1   | First watch          | Easy    | 2      | 66.0 %             |
| 2   | Wheels down          | Easy    | 3      | 48.3 %             |
| 3   | Morning push         | Easy    | 5      | 27.3 %             |
| 4   | The reference sector | Default | 3      | 36.3 %             |
| 5   | Two fields           | Default | 5      | 16.0 %             |
| 6   | Long afternoon       | Easy    | 8      | 8.3 %              |
| 7   | Handoffs             | Default | 7      | 5.8 %              |
| 8   | Fast lane            | Killer  | 2      | 41.3 %             |
| 9   | Evening rush         | Default | 9      | 2.8 %              |
| 10  | Short fuse           | Killer  | 4      | 15.3 %             |
| 11  | Double watch         | Default | 12     | 0.5 %              |
| 12  | Midnight in the room | Killer  | 7      | 2.3 %              |

Evening rush was first set at 10 (1.5 %) and Double watch at 14 (0.3 %); both were eased. The
autoplayer's whole shifts, for reference (300 seeds a sector, until a plane is lost): median 2
planes home on Easy and Default and 1 on Killer, best 14, 19 and 10.

### XP

`planes-safe` is now capped at 18 (3 a plane), leaving room under the Hall's cap of 30 for
`stamps` (3 a stamp) and `promotion` (6). Daily Traffic sends `daily: true`, so the manifest says
`daily: true` and the kit's collection model was changed to match; the progression simulation was
re-run and every target still holds (`docs/NOTES-progression.md`). A second weekly goal counts
`stamps` (4–12).

### Decisions

| Date       | Decision                                                                                                        | Why                                                                                                                                                              |
| ---------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-02 | The cheat panel stays in the page but hidden: no button, off by default, `?cheat=1` or Ctrl+Alt+C for one visit | The owner's testing aid for checking a shift can be won by hand; players never see it                                                                            |
| 2026-10-02 | An assignment ends when its target is home ("your relief takes over"), as a win                                 | Gives the endless shift a finish line without changing the rules                                                                                                 |
| 2026-10-02 | Stamps count only on a pass, and a replay keeps the best                                                        | Progress never goes backwards; a failed shift costs nothing                                                                                                      |
| 2026-10-02 | Keeping tasks (no refused order, no minimum fuel) count only at the end, if unbroken                            | They are about the whole shift                                                                                                                                   |
| 2026-10-02 | The Daily's first flight of the day is the one on record; later flights are practice                            | A fair, shared result                                                                                                                                            |
| 2026-10-02 | The clock stops for the briefing, the tutorial, the Hall's pause and a hidden page                              | With rewards at stake, nobody should lose a plane while away                                                                                                     |
| 2026-10-02 | The licence number comes from the clock, not `Math.random`                                                      | The in-Hall suites seed `Math.random` so the engine's traffic repeats                                                                                            |
| 2026-10-02 | Prompt C1: follows the Hall’s sound, motion and pause (bridge 1.1)                                              | ADR 0012; the pause already worked; the Hall’s mute turns the sound switch for the visit only, and reduced motion reaches the two places the game had a path for |

## Polish P1-C (2026-10-02)

Prompt `prompts/p1-c-control-room.md`, after the consolidation review: an on-ramp for players who
do not know the typed language, while typing keeps working exactly as before. The before and after
frames, and four rounds of critique, are in [`media/polish/POLISH.md`](media/polish/POLISH.md);
the owner approved them.

| Piece           | Where                   | What it does                                                                                                                                                       |
| --------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Order board     | `app/src/orders.js`     | For a plane: every order with its typed command, piece by piece, and the command as the parser reads it; off when the engine would refuse it or it changes nothing |
| Order panel     | `app/src/orderpanel.js` | The board as buttons in the sheet beside the radar, the beacon picker for waiting orders, the "Typed as" line                                                      |
| Pause, settings | `app/src/sheets.js`     | The pause menu (Resume · order buttons · How to play · settings · Game menu · Back to the Hall), the settings, the leave questions                                 |
| Settings        | `app/src/settings.js`   | Order buttons (and their default from the service record), radar text size, reference card, the tips done                                                          |
| Tips            | `app/src/tips.js`       | The three first-shift tips and where they point                                                                                                                    |
| Carriers        | `app/src/carriers.js`   | The invented carriers: codes, radio names, call signs                                                                                                              |
| Radar colours   | `app/src/palette.js`    | The radar's colours and the contrast arithmetic that tests them                                                                                                    |
| Testing aid     | `app/src/planner.js`    | The cheat panel's planner (below), owner's request                                                                                                                 |

### The credit: 1986 or 1987

- The manual page `atc.6.in` carries `Copyright (c) 1986 Ed James. All rights reserved.` (line
  35, under the Berkeley SCCS line `@(#)atc.6 8.1 (Berkeley) 5/31/93`).
- Every source file (`main.c`, `input.c`, `update.c`, `grammar.y`, `lex.l` and the rest) carries
  `Copyright (c) 1987 by Ed James, UC Berkeley. All rights reserved.`
- Both sit under the Regents’ copyright of 1990 and 1993; `LICENSES/atc-Ed-James.txt` keeps the
  1987 notice of the code we derive from.

The game menu, ABOUT and CHANGES therefore credit him **1986–87**: the year on his manual and the
year on his code. The title "Control Room 1986" is the port's own name and stays.

### Our own names

The fifteen carriers, as `CODE` Radio name: `HBM` Hornbeam, `QLW` Quailwood, `MRW` Merrow, `SVF`
Silverfen, `BCK` Bracken, `ELW` Elderwood, `GYF` Greyfell, `STW` Stackwind, `LMP` Lamplight,
`TLM` Tallowmere, `CPW` Copperwing, `DLF` Dalefold, `FNW` Fernway, `THD` Thistledown, `RVM`
Ravenmoor. Codes avoid the bezel's weather words (`BKN`, `SCT`, `FEW`, `CLR`). They are not checked
against the full ICAO register of airline designators; the radio names are what a player reads
and hears. The sectors are `QREF Approach` (Default), `QTRN Approach` (Easy) and `QKLR Approach`
(Killer): no ICAO region uses Q for its airports, so none can be a real one. `tests/names.test.js`
keeps the old real names out of everything the game ships.

### Loss wording

The meaning of each of the original's checks, in the room's own words (`LOSS` in `engine.js`):

| Check                                        | Wording                                 |
| -------------------------------------------- | --------------------------------------- |
| Fuel below zero                              | fuel exhausted, diverted                |
| At its airport at 0, against the arrow       | came in against the runway arrow        |
| At its exit below 9                          | left the sector at the wrong altitude   |
| Above 9                                      | climbed above the sector ceiling        |
| At 0 on another airport                      | set down at the wrong field             |
| At 0 on an airport when bound for an exit    | set down instead of leaving the sector  |
| At 0 away from any airport                   | reached the ground away from a field    |
| Off the grid by another exit (never happens) | left the sector by the wrong exit       |
| Off the grid when bound for an airport       | left the sector instead of landing      |
| Off the grid                                 | strayed out of the sector between exits |
| Collision                                    | lost separation with _B_                |

The pilot's mayday on a loss became the controller's calm call: "HBM42, lost separation with B.
All stations, stand by."

### The delay

`executeDelayed` follows `delayb()` in `input.c`: only direction orders (turns, circling,
"towards") may wait; a "towards" order is aimed from the beacon; "already there" and "already going
that way" are refused. Two choices of ours: the beacon must be on the plane's track (the original
checked only the general direction, and a plane that missed the beacon held its heading for good),
and an altitude or status order leaves a waiting turn alone (the original's next order of any kind
cleared it, so a climb after a delayed turn made the plane turn at once). The `beacon` event now
names the beacon.

### The testing aid's planner

The owner asked for the cheat panel to be fixed: following its rules of thumb never landed a plane
(0 landings in 30 Easy shifts) and lost every shift to fuel, strays and separation. `planner.js`
finds each plane a route by an A* search over its possible moves (a quarter turn and 1,000 feet a
move at most, counted in ticks, as props move every other tick). The planes are planned shortest on
fuel first, each keeping clear of the routes already planned and, at first, of where the others
are heading. A plane with no clear route gets the safest next move, one that stays in the sector,
off the ground and with a way on. A plane on the ground waits until its climb-out is clear. Small
tie-break costs make the routes ones a controller would fly: present orders kept, few turns,
altitude changed only towards where it is needed, and an early climb for an exit. The suggestions
are the fewest orders that fly the route exactly.

Following every suggestion, 30 seeds a sector, 300 ticks each (`tests/planner.test.js` locks a
smaller run):

| Sector  | Lost | Landings | Handoffs | Orders typed | Slowest plan |
| ------- | ---- | -------- | -------- | ------------ | ------------ |
| Easy    | 0    | 207      | 874      | 3,004        | 50 ms        |
| Default | 0    | 379      | 1,290    | 5,513        | 155 ms       |
| Killer  | 0    | 797      | 1,932    | 10,586       | 161 ms       |

The old rules of thumb stay in `hints.js` as the last fallback, with their own tests. The
"Targets" table above was measured with them, so it is now a floor well below what the cheat
reaches.

### Decisions

| Date       | Decision                                                                                         | Why                                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| 2026-10-02 | A button sends its command through the same path as Enter, after typing it a key at a time       | What the engine receives is exactly what a player would type; the language is seen every time          |
| 2026-10-02 | A typed key closes the panel and keeps the letter a click put on the line                        | Typing is never blocked; clicking then typing the rest is a natural mix                                |
| 2026-10-02 | Enter on the letter alone brings the next tick                                                   | The letter was put there by a click, not typed; it should not count as a refused order                 |
| 2026-10-02 | A key pressed while a button types drops the button's order; Enter sends it at once              | The keys are the player's                                                                              |
| 2026-10-02 | Escape stays the command line's clear key; pause is the bezel button and Alt+P                   | Every keyboard controller's habit since 1986; the owner agreed at the checkpoint                       |
| 2026-10-02 | Settings keys are Alt with a letter (`e.code`, so other layouts work); AltGr still types         | Letters and digits are orders                                                                          |
| 2026-10-02 | Enter reaches a button only when Tab brought the focus there                                     | A clicked button keeps the focus; Enter must still send the line. `:focus-visible` cannot tell the two |
| 2026-10-02 | The console is inert while the game menu covers it                                               | Tab must not reach buttons hidden behind the menu                                                      |
| 2026-10-02 | The sheet beside the radar takes width the radar does not use at 16:9                            | The radar is bound by its height there and keeps its size; the reference card never covers an exit     |
| 2026-10-02 | The order panel stays docked (idle when no plane is chosen) while the buttons are on             | A layout that jumped each time a plane was clicked would be worse                                      |
| 2026-10-02 | The data block sits across from the heading, inside near the edges                               | The heading arrow ran through it, and through the letter                                               |
| 2026-10-02 | The reference card's state has a new save, closed by default                                     | The old key was written on every visit with the old default (open), so it could not tell a choice      |
| 2026-10-02 | Reduced motion: no sweep, positions fade in per tick; a Hall at full motion wins over the system | The prompt; and the edge case in `docs/KNOWN-ISSUES.md` #37, fixed here for this game                  |

## Open questions

Listed in `docs/KNOWN-ISSUES.md` for the owner or a modification prompt:

- One dark look only; no light appearance (by design, the prompt left it open).
- The relative turns (`tl`, `tr`), `tt*`, `cl` and `cr` of the original are still not parsed.
- In a tick that loses a plane, arrivals are announced but not scored (upstream, kept).
- The fifteen original sectors: three ship.
