# Escape the Gallows — changes from the original

Original: `hangman` from the BSD games, written by Ken Arnold (the Regents' 1983 notice). This
game is the owner's earlier fancy-web port of it, adopted into the collection; the table below
compares it with the original program. Facts about the original are from
[Before the Tide's notes](../../hangman/docs/NOTES.md), verified in the source.

## The soul we kept

One hidden word, letters guessed one at a time, every place a right letter appears filled in at
once, a fixed budget of mistakes, and the tension of the last one.

## Changes

| Area         | Original                                                          | Escape the Gallows                                                                     | Why                                                                                |
| ------------ | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Mistakes     | Seven (`MAXERRS`)                                                 | Six                                                                                    | The port's visual steps (water, gas, sand, the Count, oxygen) were laid out in six |
| Words        | Any dictionary word of six letters or more                        | About forty words per room, each with a clue                                           | A cipher on a pirate's door should be a pirate's word                              |
| The figure   | A figure drawn on a gallows, part by part                         | A trap per room, and an ending per room                                                | The port's escape framing                                                          |
| Scoring      | A running average of mistakes per word, a lost word counting nine | Each cipher reported to the Hall: an escape scores 50 and 10 for every mistake in hand | The Hall keeps the player's records                                                |
| Presentation | A curses screen                                                   | Five illustrated rooms, every picture drawn in code                                    | The port's look, redrawn without its reference images                              |
| Content      | The system dictionary                                             | The port's own word lists and clues                                                    | Our own words                                                                      |

## Changes made on adoption

| Area                  | The port as found                                                     | As adopted                                                                                           |
| --------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Pictures              | Reference images (raster and SVG of unknown licence) in `references/` | Every picture redrawn in code in `app/src/art/` (ADR 0001); `references/` never came along           |
| The alchemist         | A likeness of a real person                                           | An original character, Doktor Formalin                                                               |
| Ends of a room        | Bodies afloat, a suffocated alchemist, a vampire killing the werewolf | The captain's bones and coat adrift, the doktor flat out, the cape closing and the candles going out |
| The crypt's last line | A line about teeth and a throat                                       | "The cape closes. The candles die."                                                                  |
| Motion                | Looping sparks; bats only inside the window; water as drifting bands  | Live streamers from the coil, bats across the crypt, rolling waves, a walking mummy                  |
| The alchemist's trap  | Gas only; the alchemist stood until the end                           | The doktor sinks a little with every miss, from upright to flat out                                  |
| The bridge            | A painted bridge with an oxygen bar above it                          | A cockpit with life-support monitors for oxygen, carbon dioxide, ammonia and hydrogen sulphide       |
| Short screens         | The keyboard below the fold at 1280 × 720                             | The stage shrinks with the window's height so the cipher and keyboard stay in view                   |
| The Hall              | —                                                                     | Results, packages, the Hall's pause and reduced motion, a poster                                     |

## Derived logic or data

None. The port did not copy code or data from the original; it re-implements the loop in its own
words. Word lists and clues are the port's own.

## Names

The game is **Escape the Gallows**, the port's own title; the original's name, `hangman`, appears
only in the credits and as the manifest's `originalTitle`.
