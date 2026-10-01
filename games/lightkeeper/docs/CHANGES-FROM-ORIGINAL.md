# Lightkeeper — changes from the original

Original: `trek` from the BSD games, by Eric Allman, written in C at the University of California,
Berkeley, in May 1976 with help from Jeff Poskanzer and Pete Rubinstein (from the header of
`trek/main.c`). His notes trace it to Mike Mayfield's BASIC game, Kay Fisher's FORTRAN adaptation
of it, and a FORTRAN version by David Matuszek and Paul Reynolds. Copyright the Regents of the
University of California; BSD licence.

## The soul we kept

One ship against a galaxy and a clock. Every order spends power or time and every enemy in the
quadrant answers it; the game is the budget between shields, weapons, engines and the days left.
And the parts of the original that lived in its source rather than its manual: a clock shared by
the enemy, distress calls that become new enemies, starbases under siege, a fragile radio, a time
warp to the galaxy's last snapshot, tournament codes, and a promotion for a clean win.

## Changes

| Area            | Original                                                                                       | Lightkeeper                                                                                                                          | Why                                                  |
| --------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| Fiction         | A starship, an enemy empire, a federation; borrowed from a television series                   | The Lantern, self-replicating mining drones (gleaners), thirty-two named worlds; our own names throughout                            | Our own world, all ages: nothing alive is destroyed  |
| Presentation    | Typed commands, a 10×10 letter grid on request, printed reports                                | A drawn zone and a chart of lights; every order aimed with the mouse or the keyboard, with its cost and risk shown first             | Aim, don't type                                      |
| Worlds          | 31 named inhabited systems, unknown until scanned                                              | 32 worlds, all on the chart from the start as lights                                                                                 | The lights are the point of the game                 |
| Quadrant layout | Stars, starbases and black holes re-scattered every time you entered a quadrant                | Each zone keeps the layout it was given on the first visit, drawn from its own seed                                                  | A place should stay put; same code, same Reach       |
| Long-range scan | A free command                                                                                 | Made on every arrival while the far sensors work                                                                                     | It was free; asking was busywork                     |
| Shields on red  | The computer asked whether to raise them                                                       | The computer raises them (the player can travel shield-down to avoid the cost)                                                       | The answer was always yes                            |
| Undocking       | A separate command                                                                             | Moving away from a harbour leaves it                                                                                                 | One order less                                       |
| Rest            | The crew asked whether to cut a rest short on news                                             | News always cuts a rest short                                                                                                        | The answer was always yes                            |
| Phaser choice   | Manual banks (course, spread) or automatic                                                     | Automatic, with a preview and a suggested amount; aimed banks only when the computer or sensors are down                             | The automatic mode is what players used              |
| Torpedo bursts  | Asked for on any skill                                                                         | A spread of three from Head Keeper on (Shift), at 5°                                                                                 | One new idea per rank                                |
| Capture         | Asked a random enemy ship to surrender; captives filled the brig                               | Hail the gleaner you pick; ore fills the hold. The original's comment asked for exactly this choice                                  | All ages; the captain chooses                        |
| Surrender loss  | Prisoners were needed to be exchanged after abandoning ship, or the captain was "captured"     | Abandoning ship needs a harbour left, nothing more                                                                                   | All ages                                             |
| Self-destruct   | A command, with the password typed at setup                                                    | Dropped                                                                                                                              | Nothing to gain; all ages                            |
| Losses          | Deaths aboard, a captain killed                                                                | Crew are hurt and go to the sickbay; a lost ship means the crew rowing home                                                          | All ages                                             |
| Setup           | Length × six skills, then a password                                                           | The career's ranks; open watches offer every skill and length, with the 1976 rules                                                   | One choice to start                                  |
| Career tuning   | One rule set                                                                                   | The career unlocks events by rank and climbs the swarm's strength more gently (see NOTES); the 1976 rules keep every original number | The original's top levels were mostly luck           |
| Time portal     | The NetBSD port copied the snapshot the wrong way, so a "negative time portal" changed nothing | The galaxy rewinds to its last snapshot while the ship keeps its state, as the 1976 code meant                                       | The intended behaviour                               |
| Positive portal | Moved the date without draining the resources                                                  | The skipped days drain the reserve like any others; repairs and snares wait                                                          | An honest clock                                      |
| Distress cap    | After five calls in a whole game, no more ever came (the counter never went down)              | Kept in the 1976 rules; the career counts live calls only                                                                            | A bug in the original, kept where it is the original |
| Score           | Printed at the end                                                                             | The same lines on a results screen, with the promotion check shown mark by mark                                                      | See why                                              |
| Daily           | None (tournament codes)                                                                        | Tonight's watch: a daily tournament code; open watches take any code                                                                 | The original's idea, every night                     |
| Sound           | The terminal bell                                                                              | Synthesised patches, quiet by default                                                                                                | Feel without files                                   |

## Quirks and bugs in the original

| Quirk                                                                                                         | Kept?   | Note                                                                    |
| ------------------------------------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------- |
| The automatic phasers' "energy needed" multiplies by the angle constant instead of its cosine: ~4× too high   | kept    | It still caps the banks; the preview's suggestion uses the real formula |
| Bank shares are taken from the energy still left, so later banks get less                                     | kept    | The suggestion searches for the least power that stops everything       |
| Enemies take the signed larger step, not the absolute one, when moving                                        | kept    | It shapes how they close in and drift                                   |
| An enemy that leaves the quadrant swaps in the last one, which then skips its move                            | kept    |                                                                         |
| Tired enemies are the likeliest to move after firing                                                          | kept    |                                                                         |
| Uncalibrated navigation strays more (±43°) than damaged navigation (±21°)                                     | kept    |                                                                         |
| Surrender requests are counted but the count is never read                                                    | kept    | Hailing the same gleaner again has no penalty                           |
| A destroyed starbase heard of only by a broken radio leaves a dead event slot behind forever                  | dropped | Our event list has no slots to leak                                     |
| Hidden distress events are not cleared when the quadrant is cleared, only when they fire                      | changed | Clearing a zone answers its calls, heard or not                         |
| The radio backlog never marks reported events as reported                                                     | fixed   | Each late call is heard once                                            |
| Firing torpedoes while docked uses none and is never answered                                                 | kept    | A harbour's tubes; the shot strays twice as far                         |
| Supernovas you cause do not count the starbase or the worlds as your fault, but do count the enemies as yours | kept    |                                                                         |
| The time portal restore ran the copy backwards (NetBSD)                                                       | fixed   | See the table above                                                     |

## Derived logic or data

The rules and their numbers are **derived from the BSD source**: the setup formulas, the event
delays, the volley, movement and phaser formulas, the torpedo scatter, novas and supernovas, the
warp costs and damage, the help call odds, the scoring lines and the promotion rule. They were
re-implemented in TypeScript from reading the C, not copied; no text, table of names or message of
the original is used (a test checks every string literal of the original against our files). The
Regents' notice is kept in [`LICENSES/BSD-3-Clause-UCB.txt`](../../../LICENSES/BSD-3-Clause-UCB.txt)
and the original is credited in [`CREDITS.md`](../../../CREDITS.md).

## Names

"Lightkeeper", the Lantern, the Ember, gleaners, the Reach, its zones and its thirty-two worlds
are our own. The original's title and its names came from a television series; they are
trademarks and appear only in `CREDITS.md` and as `originalTitle` in the manifest.
