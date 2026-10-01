# Broadside — changes from the original

Original: `sail` from the BSD games, by Dave Riggle (first version in 1980, working by 1981, per its
manual), with Ed Wang (a better angle routine in 1981 and a rewrite almost from scratch in 1983) and
Craig Leres (who first made it portable); a computer version of a board game of fighting sail by
S. Craig Taylor. Source copyright 1983, 1993, the Regents of the University of California.

## The soul we kept

Steer by the wind, choose your shot, and wait for the moment your broadside bears, above all the
moment you can rake. The original’s tables, computer captains and helm grammar are all still there;
the port makes them visible.

## Changes

| Area          | Original                                                                        | Broadside (port)                                                                                       | Why                                                                   |
| ------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| Presentation  | Two-character ship marks on a curses screen                                     | A 3D sea, sky and weather with procedurally built ships, all drawn in code                             | Show what the rules decide (upstream ADRs 001, 002, 005)              |
| Players       | Several people, each running a player program, with a driver over a shared file | One captain against computer captains; the engine accepts orders for several ships                     | No shared machine to join; a network game is left for later (ADR 003) |
| Turns         | Real time: commands written out about every 7 seconds                           | Give orders, then make it so; the turn plays back as a skippable film                                  | Time to think; the driver’s order of events is kept                   |
| Orders        | Single keys followed by prompts                                                 | The same keys with their answers on one line (`f l h`, `ld r d`), plus buttons; helm strings unchanged | Keep the original’s way of giving orders, without the clock           |
| Help          | The manual page                                                                 | In-game help, a wind rose with the allowance per heading, a chart, a sailing master’s hint             | Teach by showing                                                      |
| End of battle | Runs until every player has left, or a hurricane                                | Victory, defeat, nightfall at turn 200, or the hurricane                                               | A single player needs a defined end (ADR 003)                         |
| Scenarios     | 32 in a numbered menu                                                           | The same 32 under their numbers; 22 staged and playable, the 10 fanciful ones locked                   | Each playable scenario got its own light and weather (ADR 003)        |
| Rules         | The C, bugs included                                                            | Ported function by function; eight evident bugs fixed, out-of-range table reads defined                | Follow the manual’s intent where the code contradicts it (ADR 004)    |
| Scores        | A shared top-ten log file (`sail -s`)                                           | A top ten on this device with the same net-points ranking, plus the Hall’s records                     | No shared machine to write to                                         |
| Signals       | `s` sends a message to other players                                            | Not included                                                                                           | No other players                                                      |
| Sound         | The terminal bell, on a bad keystroke at a prompt                               | Synthesised wind, sea, cannon and bell, delayed by distance                                            | The sea fight should be heard                                         |

## Quirks and bugs in the original

| Quirk                                                                                                                                                                       | Kept? | Note                                                                      |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ------------------------------------------------------------------------- |
| An operator-precedence slip in the capture-points code: when a prize is retaken by boarding, its previous captor’s points are replaced rather than reduced                  | fixed | ADR 004, fix 7                                                            |
| The wind-effects table has rows for wind 0 to 6, but the wind can rise to 7, so the hurricane turn reads past its end                                                       | fixed | The port uses the full-gale row (ADR 004)                                 |
| A hurricane destroys every ship and ends the game                                                                                                                           | yes   | The storm turn plays, then every ship founders; the Hall counts it a draw |
| Computer ships never repair and fire double shot every turn                                                                                                                 | yes   | As the manual says; they never unload either                              |
| A broadside fires at the closest ship it bears on, friend or foe                                                                                                            | yes   | The orders panel warns before a friendly broadside                        |
| The angle routine is slightly off and maps a zero vector to west                                                                                                            | yes   | Pinned by the geometry tests; nothing in the rules needs more precision   |
| Seven more slips found by the port: two in the firing arcs, a negative remainder, defenders never counted, a dead store, an accumulator never reset, a helm order cut short | fixed | Listed in ADR 004, each pinned by a test                                  |

Details and evidence are in [`NOTES.md`](NOTES.md) and [ADR 004](adr/004-rules-fidelity.md).

## Derived logic or data

Derived, by design. `app/src/engine/data.js` (the 32 scenarios, the ship specifications and the
rule tables) is generated by `app/scripts/extract-data.mjs` from the original `sail/globals.c`; the
constants come from `extern.h` and `globals.c`; the damage messages shown in captions and the log
come from `assorted.c`; and the rules are ported function by function, each module citing the C
`file:line` it follows. A few lines on screen are the original’s own messages (damage reports, the
hurricane line, the helm’s complaints when a move is too long or turns too often), kept unchanged
on adoption as ADR 0011 allows. The Regents’ notice is kept in
[`LICENSES/BSD-3-Clause-UCB.txt`](../../../LICENSES/BSD-3-Clause-UCB.txt) and the credit in
[`CREDITS.md`](../../../CREDITS.md).

## Names

Broadside (shown in the game as “Broadside — Wooden Walls”) is the port’s own name; the Hall lists
it under `sail`, the original command. Ship and battle names come from the original’s data, and the
playable ones are historical apart from scenario 21, which comes from a sea novel. Two temporary
trademark exceptions remain in the game’s own screens: the scenario list’s tagline names the board
game it was based on, and the full list of the original’s scenarios names a fictional
1960s-television scenario (with its nations in the engine’s table). Both are listed in
[`docs/KNOWN-ISSUES.md`](../../../docs/KNOWN-ISSUES.md) for the sail modification prompt.
