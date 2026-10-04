# Figurehead — changes from the original

Original: `sail` from the BSD games, by Dave Riggle (first version on a PDP-11/70 at Berkeley in
1980), with Ed Wang (a rewrite almost from scratch in 1983) and Craig Leres (who made it
portable); a computer version of a board game of fighting sail. Source copyright 1983, 1993, the
Regents of the University of California. Studied read-only in
`E:\Projects\BSDGames\BSDGames-master\sail`.

Figurehead is the collection's second interpretation of `sail`. The first, **Broadside**, keeps
the original's historical battles and grammar in a 3D sea; Figurehead keeps its rules and builds
a ship's life around them.

## The soul we kept

Steering by the wind, choosing your shot, and waiting for the moment a broadside bears, above all
the moment you can rake; and the original's own answer to what a victory is worth: a ship taken
by boarding counts double, and a prize must be held against her prisoners, six to one.

## Changes

| Area              | Original                                                                  | Figurehead                                                                                         | Why                                                                                 |
| ----------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Structure         | A menu of separate historical battles                                     | One ship's life: twelve chapters over thirty years, with choices, a dockyard and an epilogue       | Give every battle weight and a reason to come back to the next                      |
| Presentation      | Two-character ship marks on a curses screen                               | A chart in ink and watercolour (or by lantern light), ships seen from above, her portrait in SVG   | Show what the rules decide; make her scars visible                                  |
| Helm              | Typed helm strings in a seven-second window                               | Dots on the chart for every square she can reach, or the same helm grammar by key                  | Time to think; the grammar is kept for those who know it                            |
| Reading the enemy | Nothing beyond positions                                                  | Red squares for every position an enemy could reach next turn                                      | The original's computer captains are predictable in kind; the player should see how |
| Advice            | None                                                                      | The sailing master suggests orders, from the same reckoning the tests' bots use                    | Teach by showing                                                                    |
| Players           | Several people over a shared file                                         | One captain against computer captains, with a squadron of computer allies                          | No shared machine to join                                                           |
| Yielding          | A ship strikes only when her hull is shot away, and then may sink or burn | Also when her masts are gone or her people too few, with her hull sound; she does not sink or burn | Make taking ships whole a real way to win                                           |
| Prizes            | The six-to-one rule during the battle                                     | Kept, and applied again after the action: the prize crew you send decides her fate                 | Turn the original's rule into the chapter's decision                                |
| Computer captains | Close on the nearest enemy                                                | Kept; plus captains who flee, trade, follow your flag, hold off, or ride at anchor                 | Chases, convoys, squadrons and cutting-outs need them                               |
| The chart         | Unbounded                                                                 | Bounded; sailing off it leaves the action                                                          | Chases and convoys need somewhere to run to                                         |
| Hurricane         | Every ship founders                                                       | The action ends unfinished; every ship runs for shelter                                            | A ship's life should not end on a die roll of the weather                           |
| Striking          | Only by being beaten                                                      | The captain may strike to save her people; she is then cut out in the next chapter                 | Defeat as a chapter, not an ending                                                  |
| Scores            | A shared top ten by net points                                            | Renown for her life; a daily rating; the Hall's records                                            | No shared machine to write to                                                       |
| Content           | Thirty-two scenarios with historical ship and battle names                | An invented sea, three invented flags, all ship and person names our own                           | Room for a story of our own, all-ages; Broadside keeps the history                  |
| Sound             | The terminal bell                                                         | A synthesised ship's bell, broadsides near and far, wind in the rigging                            | The sea fight should be heard                                                       |

## Quirks and bugs in the original

| Quirk                                                                                                                 | Kept? | Note                                                                         |
| --------------------------------------------------------------------------------------------------------------------- | ----- | ---------------------------------------------------------------------------- |
| The computer's ships never reload and fire double shot alongside every turn                                           | yes   | The game says so, and the advice and the tips teach around it                |
| A broadside fires at the closest ship it bears on, friend or foe                                                      | yes   | The battery card warns when its target is a friend                           |
| The angle routine maps the zero vector to west and crosses octants at a ratio of 2.4                                  | yes   | Pinned by the canonical tests                                                |
| The firing arcs: one side covered three octants, the other two; the target's stern was stepped to with the wrong sign | fixed | As Broadside's port fixed them (its ADR 004)                                 |
| A negative remainder reported some port-side hits as starboard                                                        | fixed | A true modulo                                                                |
| Defenders kept back to repel boarders were never counted, so they never fought twice as hard                          | fixed | As the manual intends                                                        |
| A boarding party's third section counted whenever any party was away                                                  | fixed | Counted only when sent                                                       |
| Points for a prize retaken by boarding were replaced, not reduced (an operator-precedence slip)                       | fixed | Subtracted                                                                   |
| The wind table stops at a full gale, but the wind can rise to a hurricane                                             | fixed | The hurricane turn reads the full-gale row, and then the action ends         |
| A helm order that overran was cut to its first character                                                              | fixed | Every order up to the failing one is kept, as the manual's own example shows |

Details and evidence are in [NOTES.md](NOTES.md).

## Derived logic or data

Derived, by design. `src/engine/tables.ts` holds the original's wind-effect, rigging, hull,
ammunition, hit-chance, crew-quality and melee tables, and ten rows of its ship table (cited by
row), from `sail/globals.c`. The rules in `src/engine/` are ported to TypeScript function by
function from `sail/game.c`, `pl_*.c`, `dr_*.c`, `assorted.c`, `misc.c` and `parties.c`, each
module naming the files it follows; Broadside's port (`games/sail/app/src/engine/`) was read as a
cross-check and its documented fixes were carried over. No text of the original appears on
screen. The Regents' notice is kept in
[`LICENSES/BSD-3-Clause-UCB.txt`](../../../LICENSES/BSD-3-Clause-UCB.txt) and the credit in
[`CREDITS.md`](../../../CREDITS.md).

## Names

Figurehead is our own title; the Hall lists the original under `sail`. The Gannet Sea, Alder,
Vesk and Gullrock, every ship's name and every officer's are invented here. Nothing of the
original's historical scenarios is used.
