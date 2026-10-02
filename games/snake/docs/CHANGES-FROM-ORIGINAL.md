# Full Pockets — changes from the original

Original: `snake` (and `snscore`) from the BSD games, copyright 1980 and 1993 by the Regents of the
University of California (from the files' own notices; no individual author is named). Every fact
below was checked in `snake/snake.c`, `snake/snake.6.in` and `snscore/snscore.c`; the evidence is in
[NOTES.md](NOTES.md).

## The soul we kept

One step for you, one step for the snake, and a snake that grows bolder the richer you are. You
pick up treasure while it closes in, and you decide when you have enough to leave.

## Changes

| Area          | Original                                        | Full Pockets                                                                               | Why                                       |
| ------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------- |
| Presentation  | `I`, `S`, `s`, `$` and `#` on a CRT             | A sunken garden in Sun Garden and Moon Garden looks, a characterful snake                  | All ages, readable at a glance            |
| Boldness      | Hidden in the weights of `chase()`              | A meter, the snake's crown and eyes, and the strike preview's exact chances                | Make the hidden rule readable             |
| Structure     | One board; the exit ends everything             | Runs of ten chambers: every door asks bank or deeper; Classic keeps the one board          | Push-your-luck                            |
| Movement      | Four directions; diagonals for the snake only   | Eight directions in runs; four in Classic, as the original                                 | Prompt §4; the original kept for Classic  |
| Bumping       | Walking into the wall still spends the turn     | A bump costs nothing                                                                       | No turn lost to a misjudged key           |
| Counts, jumps | Counts, `.` and capital jumps                   | Kept, plus a click along a line to walk it                                                 | Same power, easier to learn               |
| Capture roll  | A digit flashed at the bottom of the screen     | The Lucky Break: a sundial against your digit, odds shown                                  | Keep the charm, show the odds             |
| The wink      | Only if you beat your best                      | Kept, and given its own moment                                                             | Charm                                     |
| Money         | Dollars                                         | Glints: gems and coins                                                                     | All ages; no currency                     |
| Being caught  | A message that you were eaten                   | The snake coils round you, the satchel bursts, you scramble out                            | All ages, still a loss                    |
| Scores        | A shared score file, root and daemon excluded   | Records on this device and the Hall's; a hidden package for root                           | No shared machine; a wink to the original |
| Peek in a run | A twelfth of the width, a seventh of the height | The original's reach on its own 78 × 22 board (6 columns, 3 rows); Classic keeps fractions | Small chambers made peeking useless       |
| Fair starts   | The snake can start beside you                  | In a run it starts at least seven squares away; Classic keeps the original's layout        | No capture before the first decision      |
| New chambers  | —                                               | Hedges, lily pools (the snake swims two squares), corridors, twin glints, sleeping, mirror | Variety and a rising challenge            |

## Quirks and bugs in the original

| Quirk                                                                                | Kept?     | Note                                                      |
| ------------------------------------------------------------------------------------ | --------- | --------------------------------------------------------- |
| With empty pockets the snake never heads straight for you                            | yes       | The heart of the game                                     |
| The snake keeps its course a little more, the richer you are (`oldw`)                | yes       | Exactly                                                   |
| Ten random bits modulo the total favour the first directions slightly                | yes       | The strike preview counts the fold                        |
| A pickup ends your turn before the snake moves                                       | yes       | Also the door; warping and peeking cost no turn           |
| Standing where the tail just was counts as caught                                    | yes       |                                                           |
| The capture roll favours 0–5 (26 in 256) over 6–9 (25 in 256)                        | yes       | Owner's decision; the dial says "about one chance in ten" |
| A "bonus" escape refunds nothing: the penalty is folded into the loot                | yes       | Owner's decision                                          |
| In debt, the digit is negative, so no escape is possible unless the debt ends in 0   | yes       | The dial says so                                          |
| The body starts as a random walk behind the head and can fold onto itself            | yes       | In runs it is placed well away from you                   |
| Every weight zero divides by zero (a crash)                                          | fixed     | The snake takes its aimed step                            |
| Negative loot after an escape in debt makes negative weights                         | fixed     | Weights never go below zero                               |
| The wink always shows for root and daemon (they can never record a score)            | nodded to | The hidden `root-denied` package                          |
| The comment's "$99 on a 4 × 4 board" no longer holds: edges under 12 pay as 12 ($36) | yes       | We show the real value                                    |
| Walking into the wall spends a turn                                                  | changed   | A bump is free                                            |

## Derived logic or data

From `snake/snake.c` (BSD licence, the Regents of the University of California): the snake's
`chase()` weighting and draw, the placement rules (`snrand`, the body grown by chase steps), the
turn order of `mainloop` and `pushsnake` (including the old-tail capture), the pickup value
hyperbola, the warp penalty, the capture roll and its fold, and the peek rule of `stretch()`. The
notice is kept in [`LICENSES/BSD-3-Clause-UCB.txt`](../../../LICENSES/BSD-3-Clause-UCB.txt) and
credited in [`CREDITS.md`](../../../CREDITS.md). No text, messages or layout were taken.

## Names

The game is Full Pockets; its money is glints; its snake has no name. `snake` appears only as the
manifest's `originalTitle` and in the credits.
