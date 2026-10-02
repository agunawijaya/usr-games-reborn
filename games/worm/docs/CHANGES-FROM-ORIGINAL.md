# Noodle Nine — changes from the original

The original is `worm` from the BSD games: Michael Toy, UC Santa Cruz, source copyright the Regents
of the University of California, 1980. Every fact below was read in `worm.c` and `worm.6`; the
details are in [NOTES.md](NOTES.md).

## Kept

| Rule of the original                                                                                            | In Noodle Nine                                                    |
| --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| The order of a move: the tail moves up (or a unit of growth is used), the cell ahead is read, the head moves in | Exactly; locked by the engine tests                               |
| Growth is the digit eaten, a cell a move, from the tail                                                         | Exactly                                                           |
| The score of a bite is the whole growth still to come                                                           | Exactly (9 then 5 two moves later is 9 + 12), times the tempo     |
| One digit at a time, 1 to 9, the value chosen before its place                                                  | Exactly in Endless; gardens may narrow the range or fix the run   |
| The worm waits for the first key                                                                                | Yes                                                               |
| Left alone it moves once a second; a key moves it at once and restarts the second                               | Classic tempo is exactly this; the other tempos are faster creeps |
| Capital H J K L dash 1 + 8 across and 1 + 4 up or down, stopping on a digit                                     | Shift + direction, same lengths, same stop                        |
| Chasing your tail is safe unless you are growing                                                                | Yes                                                               |
| Filling the box wins                                                                                            | Yes, and it is the goal of the fill puzzles                       |
| The starting worm, 7 behind the head, laid out leftwards                                                        | Endless starts the same length and lies the same way              |

## Changed

| Original                                         | Noodle Nine                                                                        | Why                                        |
| ------------------------------------------------ | ---------------------------------------------------------------------------------- | ------------------------------------------ |
| The score formula is an invisible accident       | **Chains** counted and shown; bulges ride down the body; a rainbow for long chains | Make the hidden depth readable             |
| Pace is whoever presses faster                   | **Tempo**: creep, stroll, rush, zoom multiply a bite ×1, ×1.5, ×2, ×3              | Speed becomes a choice with a risk         |
| Reversing into the neck ends the game            | A soft bump, nothing else                                                          | Prompt §4; a typo should not end a run     |
| Any other key stalls the worm for a second       | Other keys do nothing                                                              | An unintended freeze                       |
| A full box is checked only at a bite             | After any move                                                                     | Same while digits remain; lets puzzles end |
| The crash leaves the tail one cell shorter       | The body stays whole for the bonk                                                  | It is drawn; the run is over either way    |
| One empty box the size of the terminal (77 × 21) | Twelve hand-built gardens (16 × 10 to 24 × 13); Endless in a 30 × 15 open bed      | Bigger cells make the noodle readable      |
| Rocks, roots, mud, one-way soil, tunnels: none   | One new idea per garden                                                            | Variety and level design                   |
| The win almost nobody reached                    | Fifteen fill puzzles, each proved solvable, with stars for fewer moves             | Make the forgotten win the star            |
| Game over is a line of text                      | A bonk: stars, swirly eyes, the colour draining, a soft boing; then a card         | Feel it, kindly                            |
| A score on the title line                        | Length, score, chain and tempo in the top bar; records per tempo                   | Readable at a glance                       |
| No daily, no tutorial                            | A Daily Garden for everyone and a tutorial under a minute                          | Collection standards                       |
| Text on a terminal                               | A garden in two designed looks, drawn in code                                      | Reborn, not emulated                       |

## Dropped

- `Ctrl-L` to redraw the screen.
- The command-line length argument; Endless always starts at the original's default.
- The original's own messages: none of its wording is used anywhere (a test checks).
