# Hunt — Ricochet — changes from the original

Original: `hunt` from the BSD games, by Conrad Huang, Ken Arnold and Greg Couch of the UCSF Computer
Graphics Lab (the build file `Makeconfig` names 1985; the sources carry the copyright of the Regents
of the University of California, 1983–2003).

## The soul we kept

You see only ahead and to your sides, every shot you fire gives you away, and shots outrun you five
to one through a maze that changes as it is blown apart. The rules are the original server’s own,
step for step.

## Changes

| Area         | Original                                                                                                  | Hunt — Ricochet                                                                                                                                | Why                                                                                            |
| ------------ | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Players      | Many people on a 4BSD network, each running the `hunt` client against one `huntd` server; Otto on request | You against 1–8 bots in the browser; no network play                                                                                           | Playable alone today; the engine is shaped so a server could run it later (upstream ADR 003)   |
| Presentation | Characters on an 80×24 terminal                                                                           | A 3D arena lit by your line of sight, plus the original terminal screen and a split view of both                                               | Make the sight rule something you can see                                                      |
| Time         | Nothing moves until someone types                                                                         | A fixed clock: 10 steps a second (8 or 14 to choose), a quarter of that in slow motion                                                         | Real-time play against bots; one step is still one pass of the server (upstream ADR 005)       |
| Re-entry     | The client offers to re-enter at once                                                                     | A 20-step pause in which you choose to enter cloaked, scanning or flying                                                                       | Hit-outs you can read (upstream ADR 005)                                                       |
| Controls     | Lowercase letters step, capitals turn, letters and digits fire                                            | Those keys, or WASD with the arrows or the mouse to face; remappable; each still one original keystroke                                        | Familiar controls without changing the rules underneath (upstream ADR 004)                     |
| Typeahead    | Up to five keys                                                                                           | Up to three keys                                                                                                                               | Upstream ADR 004                                                                               |
| Arena        | A perfect maze; mirrors and doors appear only when blown walls grow back                                  | Classic (the original), Veteran (aged once by the regrowth odds) and Ricochet, the default, a braided maze with about 57 free-standing mirrors | The flipping mirror is the game’s signature and the original arena hides it (upstream ADR 006) |
| Bots         | Otto                                                                                                      | Otto, plus a Novice and a Sharpshooter, both labelled as additions                                                                             | Variety; Otto circles in mazes with loops                                                      |
| Cheat layers | —                                                                                                         | The Coach (a ricochet preview that only draws) and Override (flags that mark the score as cheated)                                             | Learning aids and a sandbox; with every flag off the engine matches the recorded baseline      |
| Spectating   | A separate monitor mode, statistics and a talk announcement                                               | Left out; while hit out you watch the whole arena                                                                                              | They belong to multi-user Unix                                                                 |
| Scores       | Kept by the server for each player while it runs                                                          | The game’s scoreboard per match; the Hall records tags, sessions and packages                                                                  | No shared server to keep them                                                                  |

## Quirks and bugs in the original

| Quirk                                                                                                                                                                                 | Kept?           | Note                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------ |
| The maze is 51×23 cells, not the 80×24 screen; the status panel and the message line take the rest                                                                                    | yes             | The terminal view draws all three; the 3D arena is the 51×23 maze                    |
| The status panel’s kill figure is worked out from the damage capacity, (capacity − 10) ÷ 2, so it covers only the current life and also counts teammates hit out                      | yes             | Shown as it was in the terminal view; the scoreboard counts properly                 |
| Score is tags per entry; after fifteen entries the count of entries stops growing and each new entry shrinks the tags so far by a fifteenth                                           | yes             | The game’s scoreboard; the Hall uses the plain count of tags                         |
| Otto’s own source comment calls it buggy and unfair; three of its logic slips (a dodge test on the wrong field, a direction flag equal to zero, dead ends marked in the wrong column) | yes             | Pinned by the golden traces; they are its personality                                |
| Otto steered by the last arrow it found on its screen (message text included) and waited for an acknowledgement the server did not always send                                        | fixed           | Faults of the client around it, not of its brain; they would freeze or blind the bot |
| A fresh maze has no mirrors and no doors                                                                                                                                              | yes, in Classic | Veteran and Ricochet add them by the original’s own drawing rules                    |
| Shot interception compares the wrong cell; stale kill bonuses after a slot is reused; flying boots can erase a player from the maze; a newcomer can land on a mine                    | yes             | All reproduced and exercised by the golden traces (upstream notes §4)                |
| Removing a wall can loop forever when every regrowth slot is blocked                                                                                                                  | fixed           | Gives up after one lap of the ring                                                   |
| The wandering drone bomb described in the manual is not compiled into the Linux build                                                                                                 | yes (absent)    | The port follows the build flags in `Makeconfig`                                     |
| If nobody moves, everything stands still                                                                                                                                              | changed         | The clock runs; see Time above                                                       |

## Derived logic or data

The rules engine (`app/src/engine/hunt.js`), the maze generator (`maze.js`), the random number
generators (`rng.js`), the constants (`constants.js`), the Otto bot (`app/src/bots/otto.js`) and the
game’s message strings are ported function by function from the `huntd` and `hunt` sources.
`hunt.js`, `constants.js` and `otto.js` carry the Regents’ copyright line in their headers;
`maze.js` and `rng.js` cite the source lines they port. The Regents’ notice that covers `hunt` (the University of California, San
Francisco form) is kept in [`LICENSES/BSD-UCSF-hunt.txt`](../../../LICENSES/BSD-UCSF-hunt.txt), as
[`LICENSES/README.md`](../../../LICENSES/README.md) records, and the credit is in
[`CREDITS.md`](../../../CREDITS.md). The original C is not in the repository; the oracle harness
compiles a local copy outside it. The death and status messages the game prints are the
original’s own words; they are listed in `docs/KNOWN-ISSUES.md` for a later rewording.

## Names

Our title is “Hunt — Ricochet”, the name the adopted game shows itself; `hunt` is the original
program’s plain name, not a trademark. The bots are called otto, rookie and ace in the game.
