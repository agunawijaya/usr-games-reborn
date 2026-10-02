# Trek — Deep Space — notes

Adopted on 2026-10-01 by prompt 01 (adopt eight finished games), as a static hosted game like
Selene.

## Sources studied

| Source                                                                         | What we took or learned                                                                               |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `E:\Projects\BSDGames\bsdgames\trek\ports\procedural-web` (the owner’s port)   | Copied into `games/trek/app/` as described below; its docs are the source for these docs              |
| `BSDGames-master/trek/main.c`                                                  | Authors, date and lineage; the user-id check on the debugging options                                 |
| `BSDGames-master/trek/trek.6.in`                                               | Manual page copyright (1980, 1993); the length and skill questions                                    |
| `BSDGames-master/trek/setup.c`                                                 | Game lengths and skills, starting energy, torpedoes and shields, the password and its tournament code |
| `BSDGames-master/trek/trek.h`, `play.c`, `externs.c`                           | Galaxy size, hostile ships per quadrant, phaser banks, loss codes, the command and device tables      |
| `BSDGames-master/trek/getcodi.c`, `phaser.c`, `torped.c`, `attack.c`, `dock.c` | Courses in degrees, phasers and shields, torpedo bursts, hostile fire, docking                        |
| `BSDGames-master/trek/help.c`, `destruct.c`, `score.c`, `win.c`                | Calling for help, self-destruct, the rating and the promotion                                         |

### What was copied

- **From:** `E:\Projects\BSDGames\bsdgames\trek\ports\procedural-web` only. The other trek port
  (`fancy-web`, the painted one) was not opened.
- **Copied:** 63 files, 2,705,337 bytes, into `games/trek/app/`.
- **Left out:** `media/` (25 files, 35.6 MB of screenshots and comparison pairs),
  `node_modules/` (183 files, 17.7 MB) and `package-lock.json`.
- **Moved:** the upstream ADRs (`docs/decisions/`) to [`adr/`](adr/), unchanged.
- **Folded:** the upstream `AGENTS.md` and `CLAUDE.md` into `app/UPSTREAM-AGENTS.md`, with a note
  that repository rules win.
- **Kept as history:** the upstream `README.md` and `docs/` (architecture, comparison, change log,
  cheat guide, notes, test scenarios). Their links to the earlier project, to the painted port and
  to the left-out screenshots no longer resolve.
- **Not shipped:** `lab.html`, an art-direction bench for skies and ships, is left out of the site
  build with the rest of the workbench (ADR 0011).

### Integration changes (every file touched)

| File               | Change                                                                                                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `app/index.html`   | Google Fonts links replaced by the local `src/fonts/fonts.css`; the bridge script tag added before the module script                                                                       |
| `app/src/fonts/*`  | New: `fonts.css` and two Latin woff2 files (Orbitron variable, Share Tech Mono)                                                                                                            |
| `app/src/hall.js`  | New: the bridge glue (title screen, results, packages, poster)                                                                                                                             |
| `app/src/main.js`  | One import and four calls: `noteMissionStarted` in `startNewGame`, `noteCommand` at the top of `playEffects`, `reportMission` at the top of `endGame`, the poster offer after `view.frame` |
| `app/package.json` | `serve` on the collection’s port for trek, 5208                                                                                                                                            |

Nothing else changed: no rebalancing, restyling, copy edits or refactors. `galaxy.js`, `parser.js`
and `hints.js` are pinned by SHA-256 in the upstream tests and were not touched. The 77 upstream
tests pass unchanged (re-run 2026-10-01).

## Verified behaviour of the original

- The C version is Eric P. Allman’s, dated May 1976 at Berkeley, with help from Jeff Poskanzer and
  Pete Rubinstein. Its header credits Kay Fisher’s FORTRAN version, itself from Mike Mayfield’s
  BASIC program, and names a FORTRAN version by David Matuszek and Paul Reynolds as the main
  inspiration, with smaller debts to others. — the header comment of `main.c`.
- The manual page and the sources carry the Regents’ copyright of 1980 and 1993. — `trek.6.in`
  and every source header.
- A game starts with two questions: its length (short, medium or long, weighted 1, 2 and 4) and
  its skill (novice, fair, good, expert, commodore or impossible), or “restart” for a saved game.
  The time allowed is six stardates per unit of length plus two, and the number of hostile ships
  grows with length × skill. — `setup.c`, `trek.6.in`.
- The ship starts with 5,000 energy, ten torpedoes, 1,500 in the shields and a crew of 387. —
  `setup.c`.
- The galaxy is 8×8 quadrants of 10×10 sectors, with up to nine hostile ships in a quadrant; the
  ship has six phaser banks; there are thirteen ways to lose. — `trek.h`.
- Courses are typed in degrees, 0 to 360, with a distance of up to 15. — `getcodi.c`.
- Phasers refuse to fire while the shields are up, and have an automatic and a manual mode;
  torpedoes can go in bursts of three spread over at most 15 degrees. — `phaser.c`, `torped.c`.
- Hostile ships lose power each time they fire and stop attacking below 20. — `attack.c`.
- Docking refuels and rearms at once, while damaged devices still need time, only less. —
  `dock.c`.
- The self-destruct sequence asks again for the password typed at setup and stops if it does not
  match; it can win the game if it takes the last hostile ship along. — `destruct.c`.
- Typing “tournament” as the password asks for a tournament code instead, and the code seeds the
  random generator, so the same code always deals the same game. — `setup.c`.
- `help` calls the nearest starbase to beam the ship aboard: three tries, with odds set by the
  distance, and every call costs 100 points of the final rating. — `help.c`, `score.c`.
- The rating rewards hostile ships destroyed, the rate of destruction and a win at a higher skill,
  and takes points off for ships left, being destroyed, starbases, stars and inhabited systems
  destroyed, calls for help, an abandoned ship and casualties. — `score.c`.
- A win promotes the player one skill level when the rating reaches 1,000 and the record is clean
  (no calls for help, no starbases or inhabited systems destroyed, few stars destroyed or
  casualties, the starting ship still in use). — `win.c`.
- The trace and priority options are accepted only from one hard-coded user id. — `main.c`.
- The device table lists fourteen devices (and two placeholders), each with the crew member who
  repairs it, named after characters of the series. The port uses none of them. — `externs.c`.
- The command table has 23 entries, among them cloak, capture, ram, rest, visual, destruct,
  abandon, dump (save) and undock. — `play.c`.

## The adopted engine

The engine is shared with the owner’s painted port and was written anew; the upstream
[`../app/docs/notes.md`](../app/docs/notes.md) compares its combat with the original’s. Its own
quirks, recorded upstream and confirmed by reading `app/src/engine.js`, were kept on adoption:

- Raising the shields costs 50 energy without checking the reserve, so energy can go below zero
  (`doShields`).
- Running out of energy is only checked after hostile ships fire, so spending it all in an empty
  quadrant never loses; further moves are refused instead (the return-fire step).
- A warp into a quadrant already visited lands on a random sector without checking it is free, so
  the ship can share a sector with a star or a hostile ship (`doMove`). The override’s instant warp
  searches for a free sector.
- The impulse effect records where the ship came from after it has moved; `main.js` remembers the
  old sector itself.
- `warp` without a course heads east (course 0).

## Network findings

| Found                                                                            | Kind                 | Action                                                                                                              |
| -------------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Google Fonts links in `index.html` (Orbitron, Share Tech Mono)                   | web font load        | Self-hosted Latin woff2 files (OFL); links removed. The upstream ADR 002 allowed web fonts; the collection does not |
| `github.com/vattam/BSDGames/…` in a credit comment in `src/engine.js`            | comment              | Kept; allow-listed (ADR 0011)                                                                                       |
| Links in the upstream `README.md` and `docs/`                                    | documentation        | Kept; Markdown and `docs/` are workbench files the build leaves out                                                 |
| `http://localhost…` in `scripts/*.mjs`                                           | developer tools      | Not shipped; allow-listed (`games/*/app/scripts/**`)                                                                |
| In `src/vendor/three.*.js`: link comments, an XML namespace string, file loaders | dormant library code | Kept (the library is unchanged); allow-listed for that path. The game builds every mesh, texture and sound in code  |

The in-Hall suite records every request during a visit; none leaves the Hall’s origin.

## Deep Space Command (2026-10-02)

The owner asked for the adopted trek to be gamified like the reborn games: a campaign, a daily and
more, with the hint panel hidden but kept for testing (Ctrl+Alt+C), and the Captain’s Override left
as it was. Everything new lives in `app/src/career/`; `main.js`, `index.html` and `hall.js` changed
to host it; `galaxy.js`, `parser.js` and `hints.js` stayed byte-identical (the baseline regression
still passes), and `engine.js` was not touched.

- **Sortie seeds** (`app/scripts/tour-search.mjs`): the autopilot’s win rate per setup drew the
  difficulty curve. Over the first 300 seeds the advice alone wins Shakedown Cruise 209 times,
  Picket Duty and Torpedo School 175, The Long Haul 197, No Harbour 148, Phaser Drill 100, Close
  Quarters 60, The Siege 14, Race the Clock 5 and Deep Space none (its seed, 711, came from a
  search of 1,000). The first drafts of the last three sorties (25 ships in 26 stardates) were won
  on no seed at all, so Race the Clock became 12 ships in 24 stardates, The Siege 16 ships with four
  starbases in 34, and Deep Space 20 ships in 34. Each sortie’s seed is the escape-free win with the
  most room to spare.
- **Commendations on those seeds.** The advice alone earns every star except Torpedo School’s
  three torpedo kills and No Harbour’s hull of 50%, so all but two of the thirty stars are proven
  reachable; those two ask for a different line than the advice takes.
- **Daily seeds.** Every one of 365 days from 2026-09-01 has an escape-free winning seed within the
  first few tries; the search takes about a millisecond a try.
- **Orders, not commands.** Scans, `computer`, `damages` and `help` are free so that looking around
  never costs a commendation.
- **Score** stays the ships disabled in every mode; the patrol rating lives in the game and its
  share line, so the Hall’s best score means the same thing for every mission.

## XP and packages

Seventeen packages: the twelve from the adoption (six core, four extra, two rare) and five for Deep
Space Command (three core, one extra, one rare). XP events: 2 XP per ship disabled, at most 25,
and 3 XP per commendation; the Hall caps a session’s extras at 30. With the Daily Patrol, trek is
now `daily: true` in the manifest and in the kit’s collection model.

The adoption’s notes: twelve packages in the tier mix of the progression model, so the
balance simulations stay representative. Prompt 01 asked for “survive, win, win on the hardest
level”; the packages cover winning at each level, winning low on hull or without docking, and the
milestones of a mission. XP events stay small: 2 XP per ship disabled, at most 25, inside the Hall’s
cap of 30. A mission played with the override panel reports its outcome only.

## Balance

Upstream measurement, locked in `app/tests/autoplay.test.js`: an autoplayer that always types the
hint panel’s first suggestion wins 18 of 20 Novice games (locked at 70% or more), disables 11.9 of
15 ships on average at Standard (locked at 8 or more) and 10.1 of 25 at Expert (locked at 5 or
more, with no stalls).

## Performance

Upstream measurements (RTX 4060 laptop, 1600×900, a fresh browser profile): the first frame takes
3.4–3.7 s on High while every shader compiles; then 60 fps idle, 61 in a phaser volley and 57 in an
explosion (Low: 60, 61, 58). On a software renderer the Lite profile runs at 12 fps when idle (its
cap), 19 in combat and 18 in an explosion; the 2D fallback holds 60. Each warp bakes the new sky in
about 80–180 ms under the warp tunnel. The page loads about 2.1 MB of vendored three.js (about
420 KB gzipped), about 370 KB of its own code and 25 KB of fonts, and no images.

## Decisions log

| Date       | Decision                                                                       | Why                                                                                                    |
| ---------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| 2026-10-01 | Title “Trek — Deep Space”, from the game’s own title screen                    | Prompt 01 §7                                                                                           |
| 2026-10-01 | The title screen is reported from its `shown` class with a `MutationObserver`  | Keeps the changes to `main.js` to four calls                                                           |
| 2026-10-01 | Score = hostile ships disabled; the original’s rating is not reproduced        | The game keeps no score of its own; the count is honest at every level                                 |
| 2026-10-01 | The typed `quit` reports `quit`                                                | An aborted mission earns no XP                                                                         |
| 2026-10-01 | Missions with an override report no score, ships, XP events or packages        | Progress must be honest; the game already marks those missions itself                                  |
| 2026-10-01 | Poster: the tactical view six seconds into the first mission                   | Prompt 01 §7 names the tactical view as trek’s key art                                                 |
| 2026-10-01 | `galaxy.js`, `parser.js` and `hints.js` untouched                              | They are pinned by SHA-256 in the upstream tests                                                       |
| 2026-10-01 | Google Fonts replaced by self-hosted files                                     | No runtime network requests (hard rule 4, ADR 0011)                                                    |
| 2026-10-01 | Trademark words kept in `app/` for now                                         | Copy is not edited on adoption; listed in `docs/KNOWN-ISSUES.md` for the trek modification prompt (§8) |
| 2026-10-02 | Deep Space Command: Frontier Tour, Daily Patrol, free missions, service record | The owner asked for a campaign and a daily like the reborn games                                       |
| 2026-10-02 | Sorties are presets added to `DIFFICULTY` plus a fixed seed                    | `galaxy.js` must stay byte-identical; no rule changes                                                  |
| 2026-10-02 | Sorties and patrols are proven winnable by following the hints alone           | The owner tests winnability with the hint panel; typing its first suggestion replays the proof         |
| 2026-10-02 | The hint panel loses its button and backtick key; Ctrl+Alt+C or `?cheat=1`     | Owner: keep the feature for testing, out of sight for players                                          |
| 2026-10-02 | `quit` asks first and the report says ABANDONED                                | Navigation standard: confirm before losing progress                                                    |
| 2026-10-02 | The report follows the results order: the way on, R, M, H                      | Navigation standard; KNOWN-ISSUES #24                                                                  |
| 2026-10-02 | The series’ names stay in this adopted port                                    | Owner: “the original game uses those names, leave them”; new copy does not use them                    |

## Open questions

Listed in `docs/KNOWN-ISSUES.md` for the owner:

- The series’ names for the enemy, the player’s ship and the government stay in the game’s UI,
  engine and upstream docs, by the owner’s decision (2026-10-02).
- One dark look only; no light appearance.
- The Hall’s reduced-motion setting does not reach the game, which reads the system setting (or
  `?reduced=1`) when it starts.
- `:focus-visible` styles cover the game menu, the report and the bezel buttons; the HUD panels
  and the tutorial still have no ARIA roles.
- Without WebGL the game draws on its 2D canvas, but the poster is still taken from the hidden
  WebGL canvas, so the Hall would receive a blank poster on such machines.
- The Hall’s volume and mute settings do not reach the game, which has its own sound switch.
- At 1280 px the top bar’s readout and buttons wrap onto two lines once a mission is under way.

Resolved on 2026-10-02 by Deep Space Command: Tab-focused difficulty buttons now only choose a
level, `quit` asks first, the GPU’s name left the title screen, the report follows the results
order, and override missions report no charted quadrants.
