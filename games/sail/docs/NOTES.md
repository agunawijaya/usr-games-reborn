# Broadside — notes

Adopted on 2026-10-01 by prompt 01 (adopt eight finished games). Broadside is a static hosted game
(no build step) that brings its own copy of three.js.

## Sources studied

| Source                                                                  | What we took or learned                                                                                                                             |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `E:\Projects\BSDGames\bsdgames\sail\ports\fancy-web` (the owner’s port) | Copied into `games/sail/app/` as described below; its docs are the source for these docs                                                            |
| `BSDGames-master/sail/sail.6`                                           | Authors and history, the board game it adapts, the player and driver processes, the wind scale, repairs, the computer ships’ habits, the helm rules |
| `BSDGames-master/sail/globals.c`                                        | The 32 scenarios, the ship specifications, the wind-effects table and its seven rows                                                                |
| `BSDGames-master/sail/dr_1.c`                                           | The weather routine that can raise the wind to 7; the capture-points expression in the melee code                                                   |
| `BSDGames-master/sail/game.c`                                           | The movement allowance, which indexes the wind table by the wind speed                                                                              |
| `BSDGames-master/sail/pl_1.c`                                           | The hurricane ending                                                                                                                                |
| `BSDGames-master/sail/extern.h`, `misc.c`                               | The ten-entry log and its net-points ranking                                                                                                        |
| `BSDGames-master/sail/pl_2.c`, `pl_5.c`, `pl_7.c`                       | The single-key commands (with `Q` to quit), the helm messages, the terminal bell                                                                    |
| `BSDGames-master/sail/main.c`, `assorted.c`                             | The Regents’ copyright years                                                                                                                        |

### What was copied

- **From:** `E:\Projects\BSDGames\bsdgames\sail\ports\fancy-web` only.
- **Copied:** 64 files, 2,611,906 bytes, into `games/sail/app/`.
- **Left out:** `media/` (10 screenshots, 16.3 MB), `node_modules/` (1,446 files, 37.2 MB) and
  `package-lock.json`.
- **Moved:** the upstream ADRs (`docs/decisions/`) to [`adr/`](adr/), unchanged.
- **Folded:** the upstream `AGENTS.md` and `CLAUDE.md` into `app/UPSTREAM-AGENTS.md`, with a note
  that repository rules win.
- **Kept as history:** the upstream `README.md` and `docs/` (architecture, diff log, notes, test
  scenarios). Their links to the earlier project’s folders and to the left-out screenshots no longer
  resolve.

### Integration changes (every file touched)

| File                     | Change                                                                                                                                                                                                                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `app/index.html`         | The bridge script tag (`../../bridge/bridge.js`), with a one-line comment, before the module script; since prompt C1, its reduced-motion rules repeated under `:root[data-reduced-motion]`                                                                                                             |
| `app/src/hall.js`        | New: the bridge glue (title screen, results, packages, poster, and dropping the saved battle on a reload inside the Hall; since prompt C1 also the Hall’s sound, motion and pause)                                                                                                                     |
| `app/src/main.js`        | One import and four calls: `noteBattleStarted()` in `startBattle`, `noteTurn(res.events, me)` in `commit`, `reportBattle(st, me)` at the top of `endBattle`, and the poster offer right after `world.render`; since prompt C1, the `followHall` hand-over and the `hallPaused` check in the frame loop |
| `app/src/audio/audio.js` | Prompt C1: `MASTER_LEVEL` (0.8, as designed), `setLevel`, `level` and `context`                                                                                                                                                                                                                        |
| `app/package.json`       | `serve` on the collection’s port for sail, 5205                                                                                                                                                                                                                                                        |

Nothing else changed: no rebalancing, restyling, copy edits or refactors. No fonts needed replacing.
Its 44 tests pass unchanged.

## Verified behaviour of the original

- Dave Riggle wrote the first version on a PDP-11/70 in the autumn of 1980, and a rewrite from the
  top down was working by 1981. Ed Wang rewrote the angle routine in 1981 (and let a player choose a
  ship); Craig Leres made the program portable; Ed Wang’s rewrite almost from scratch, the fourth
  and most thorough, came in the summer and autumn of 1983. — the history section of `sail.6`.
- It is a computer version of a board game of fighting sail first developed by S. Craig Taylor. —
  the description in `sail.6`.
- The source files carry the Regents’ 1983, 1993 copyright; the manual page carries 1988, 1993. —
  the headers of `main.c`, `assorted.c` and `sail.6`.
- Each player runs a player process and a driver process works out what happens; they share a
  temporary file, and each player process writes its buffered commands to it about every 7 seconds.
  Only the last movement command typed between two updates counts. — `sail.6`, the section on
  separate player and driver processes.
- There are 32 scenarios. — counted the `scene[]` entries in `globals.c`, whose size is `nscene`.
- The log keeps ten captains (`NLOG`), ranked by points won divided by the points value of their
  own ship. — `extern.h`, `misc.c`.
- The capture-points slip: in the melee code, when a ship that is someone’s prize is taken back by
  boarding, the expression meant to subtract her value from the previous captor’s points parses as
  a test of `points - struck`, so the captor’s points are overwritten with her value or twice it. —
  read in `dr_1.c`, lines 204–208; the port subtracts (upstream ADR 004, fix 7).
- The wind-effects table `WET` has seven rows (wind 0 to 6), the weather routine can raise the wind
  to 7, and the movement allowance indexes the table by the wind speed, so the hurricane turn reads
  past its end. — `globals.c` line 407, the weather code near the end of `dr_1.c`, `game.c` lines
  78–86. The port uses the full-gale row.
- A hurricane destroys every ship and ends the game. — the wind scale in `sail.6` and the leaving
  message in `pl_1.c`.
- Computer ships never repair, may fire double shot every turn, and are moved by a depth-first
  search for the best score. — `sail.6`, the section on computer ships.
- A turn into the wind stops the move there; a ship that has drifted must move ahead before it turns
  more than once. — the movement section of `sail.6`.
- `Q` quits; a bad keystroke at a prompt rings the terminal bell. — `pl_2.c`, `pl_7.c`.
- The upstream port’s other seven fixes (ADR 004, fixes 1–6 and 8) were not re-traced on adoption;
  each is pinned by its own test, and those tests pass.

## Simulations (upstream)

- Computer against computer, all 32 scenarios with eight seeds each: every battle ends, the ships’
  numbers stay within bounds after every turn, and fewer than 15% end at nightfall. — locked in
  `app/tests/autoplay.test.js`, passing after adoption.
- A captain who fires every turn and follows the sailing master beats the Guerriere with the
  Constitution 11 times in 12 and takes the Chesapeake with the Shannon 7 in 12; one who sails
  straight and fires every turn usually loses. — upstream `app/docs/diff-log.md`; the test checks
  only that such a captain wins for some seeds.

## Network findings

| Found                                                                                                                                                                     | Kind                 | Action                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | -------------------------------------------------------------------------- |
| `github.com/vattam/BSDGames/…` in a comment in `src/engine/data.js`                                                                                                       | credit comment       | Kept; allow-listed (ADR 0011)                                              |
| The same link in `scripts/extract-data.mjs`                                                                                                                               | developer tool       | Not shipped (the build leaves `scripts/` out); allow-listed                |
| `http://localhost…` in `scripts/serve.mjs`, `snap.mjs`, `ui-smoke.mjs` and `ui-flows.mjs`                                                                                 | developer tools      | Not shipped; allow-listed                                                  |
| In the vendored three.js (`src/vendor/three.core.js`, `three.module.js`): about a hundred link comments, the XHTML namespace string and file loaders the game never calls | dormant library code | Kept unchanged; allow-listed for that folder and its built copy (ADR 0011) |
| Web fonts                                                                                                                                                                 | none                 | Nothing to replace: the page uses system serif and monospace stacks        |

The upstream Markdown files carry links too; Markdown is never shipped. Every sea, sky, ship and
flag is drawn in code and every sound is synthesised. The in-Hall suite records every request during
a visit; none leaves the Hall’s origin.

## The career and the counsel (2026-10-02)

The owner asked for Broadside to be gamified like the reborn games (a campaign, a daily or anything
that makes it more fun), for a hidden “cheat” like Trek's that shows how to win, opened with
Ctrl+Alt+C, and for more detailed ships whose damage shows when they are hit. Everything for the
career lives in `app/src/career/`; `main.js`, `menu.js`, `hall.js` and `index.html` changed to host
it; the engine was not touched.

- **Tuning the counsel** (every staged scenario from every ship, 30 seeds each, 1,890 battles): the
  first draft, which loaded double shot within one square, won 640; round shot only won 810, so the
  counsel never loads double (it leaves a broadside empty for two turns). Holding fire beyond six or
  three squares (801, 805), aiming at the rigging beyond two (779), crowding sail beyond five (754)
  or never (814), grape at close range (648) and boarding at even crews (804) or only at three to
  one (778) were no better or worse than the chosen rules. The computer captains won 973 of the same
  battles, firing double shot every turn as the original lets them.
- **Choosing the Sea Service's actions**: over 120 seeds the counsel wins Constellation against the
  Insurgent 119 times, the United States 118, Constitution against the Guerriere 116, Constitution
  against two sloops 98, Constellation at night 91, the Shannon 85, the Ambuscade 80, the Nymphe 73,
  the Droits de l'Homme 61 and the Mars 42. Fleet actions were left out: the counsel's ship often wins
  them without firing a shot. Each action's seed is a win with a sound hull and a short fight, and
  each threshold was set from the counsel's own result on it: the counsel earns 22 of the 30 stars.
- **The daily pool** keeps the twelve duels the counsel wins on four seeds in ten or more; 120 days
  from 2026-09-01 all found a winning seed within the first tries.
- **Holding fire while boarding**: with every section away there is nobody at the guns, and the
  engine refuses the broadside. The counsel now says so instead of ordering it; the battles play out
  the same, since a refused broadside draws no dice.
- **Visible damage** was built on what the renderer already had (shot holes in the hull shader, sail
  tears, falling masts): holes now follow the hull points lost, so a battle resumed or staged shows
  them too, with splintered rims that read on a black hull; the other effects are listed in
  `ARCHITECTURE.md`. The stern windows had faced inboard and were never seen from astern; fixed.

## XP and packages

Fifteen packages: the ten from the adoption and five for the career (three core, one extra, one
rare). The adoption's notes: ten packages: five core, three extra, two rare, all read from what the engine already reports. The
`fire` events carry rake and stern-rake flags; `strike` and `capture` events name the ship that
caused them; the result names the reason the battle ended. A proposed “weight of metal” package was
dropped because the engine does not expose the side calculation it needs. The one XP event,
`ships-taken`, gives 8 XP per ship taken, up to 25, inside the Hall’s cap of 30 for a session’s
events. The weekly goals count `shipsTaken` (2 to 5) and `broadsidesFired` (20 to 60), and since
the career `commendations` (3 to 9), with 3 XP per commendation. With the Daily Engagement the
manifest and the kit's collection model say `daily: true`. The progression model (`modelPackages` in `packages/kit/src/progression/sim/collection.ts`)
still counts twelve packages for every game, so it slightly overstates what Broadside can award.

## Performance

Upstream measurements at 1600×900, device pixel ratio 1, Algeciras (10 ships) mid-broadside: an
RTX 4060 laptop GPU holds 60 fps (vsync) on both High and Low; an integrated Intel UHD runs 56 fps
on High and 60 on Low. In the engine, a 10-ship turn including every computer captain’s search takes
0.3 ms median and 3.6 ms at worst, in Node. Measured on 2026-10-01: the vendored three.js is 2.1 MB
in two files (about 420 KB gzipped), the game’s own code about 355 KB (about 106 KB gzipped), and
the page 13 KB, with no fonts. The in-Hall suites and screenshots run on the machine’s GPU
(`GPU_LAUNCH_ARGS` in `packages/bridge/testing/shots.ts`); with software WebGL on Windows they took
minutes longer.

## Decisions log

| Date       | Decision                                                                         | Why                                                                                                                                                     |
| ---------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-01 | Title “Broadside”, as the game shows itself                                      | Prompt 01 §7; the page’s full title is “Broadside — Wooden Walls”                                                                                       |
| 2026-10-01 | The scenario list is the title screen; the ship choice and top ten are not       | They share the overlay but are steps inside the game, each with its own Back button                                                                     |
| 2026-10-01 | A reload inside the Hall drops the saved battle                                  | The Hall’s Game menu reloads the frame and should bring back the scenario list; the quality switch is a navigation and still resumes                    |
| 2026-10-01 | Nightfall and the hurricane report `draw`                                        | Neither side has won; the hurricane sinks everyone                                                                                                      |
| 2026-10-01 | The typed `Q` reports `quit` and does not earn `see-it-through`                  | Handing over command is not seeing the action through; under the Hall’s rules a quit earns no XP                                                        |
| 2026-10-01 | Score is the player’s ship points, never below zero                              | Points can go negative when a prize is retaken                                                                                                          |
| 2026-10-01 | 8 XP per ship taken, at most 25                                                  | Taking ships is the game’s real milestone; 25 is the Hall’s limit for one event                                                                         |
| 2026-10-01 | Ten packages; “weight of metal” dropped                                          | The engine does not expose the side calculation it needs                                                                                                |
| 2026-10-01 | The poster is taken 7 s into the first battle                                    | The opening sweep over the fleet has settled; before any battle the Hall shows its own key art                                                          |
| 2026-10-01 | The Q key, the end screen and the sound default stay as they are                 | Prompt 01 §4: no behaviour or copy changes on adoption; each is logged in `docs/KNOWN-ISSUES.md`                                                        |
| 2026-10-01 | The suites run on the machine’s GPU                                              | Software WebGL made them minutes slower                                                                                                                 |
| 2026-10-02 | A game menu: the Sea Service, the Daily Engagement, historical actions, a record | The owner asked for a campaign and a daily like the reborn games                                                                                        |
| 2026-10-02 | Every action and engagement is proven winnable by the counsel                    | The owner tests winnability with the hidden counsel; giving its orders replays the proof                                                                |
| 2026-10-02 | The counsel has no button or help line; Ctrl+Alt+C or `?counsel=1`               | Owner: a testing aid, out of sight for players, as in Trek                                                                                              |
| 2026-10-02 | Career battles start with round shot and the last captain's name                 | The proofs use round shot; the name changes nothing in the battle                                                                                       |
| 2026-10-02 | The report follows the results order, with Look around kept last                 | Navigation standard; KNOWN-ISSUES #24                                                                                                                   |
| 2026-10-02 | Damage drawn from engine values: holes, smoke, settling, lost guns, topgallants  | The owner asked to see the damage when a ship is hit                                                                                                    |
| 2026-10-02 | Prompt C1: follows the Hall’s sound, motion and pause (bridge 1.1)               | ADR 0012; the Hall’s state is never saved into the remembered sound switch, and a pause holds the frame loop, which is where everything that moves runs |

## Open questions

All but the last two are logged in [`docs/KNOWN-ISSUES.md`](../../../docs/KNOWN-ISSUES.md) for the
sail modification prompt.

- A light appearance: Broadside has one look.
- Answered by prompt C1 (2026-10-02): the Hall’s reduced-motion setting now reaches the game live,
  where before it read the system setting when it started.
- Temporary trademark exceptions: the scenario list’s tagline names the board game it was based on,
  and the full list of the original’s scenarios names a fictional 1960s-television scenario.
- After Look around on the battle report there is no way in the game back to the game menu; the
  Hall’s Game menu covers it.
- Pressing Q outside the command line switches the quality and reloads the page, which is easy to
  confuse with the typed `Q` that gives up command.
- Sound is on by default when the game runs on its own. Answered by prompt C1 (2026-10-02): in the
  Hall it now follows the Hall’s volume and mute.
- Giving up is only the typed command `Q` (or `quit`); there is no button for it.
- Escape in the help opened from the scenario list used to close the help and also take the player
  back to the Hall (the game does not mark the key as handled). Fixed on 2026-10-01 in `hall.js`: the
  scenario list counts as the title screen only while the help is closed, and Escape is marked as
  handled while the help is open. The in-Hall suite covers it.
- The ten fanciful scenarios (22 to 31) are listed but locked until they get their own staging.
