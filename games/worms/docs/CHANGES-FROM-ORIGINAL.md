# Abyssal Worms — changes from the original

Original: `worms` from the BSD games, by Eric P. Scott, Caltech High Energy Physics (October 1980,
from the author’s note in `worms.c`); manual page copyright 1989 and 1993 by the Regents of the
University of California, which calls it a Unix version of the DEC-2136 program of the same name.

## The soul we kept

Worms that wander with no goal and no player: one cell a step, a random turn now and then, kept in
by the edges of the screen. Abyssal Worms keeps that wandering, computed exactly as the original
computed it, and turns it into something to sit and watch.

## Changes

| Area         | Original                                           | Abyssal Worms                                                                                                 | Why                                                                      |
| ------------ | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Presentation | One character per cell on a curses terminal        | Glowing worms on a sea floor they light themselves; the terminal kept as a view                               | Make a screensaver worth watching again                                  |
| Motion       | Jumps one character per step                       | A smooth glide that equals the grid at every step boundary                                                    | Organic motion without misdrawing the grid                               |
| Speed        | No `-d`: as fast as the terminal could take output | No `-d`: paced like a 9600-baud terminal                                                                      | On a modern screen the original pace is a blur                           |
| Screen size  | The terminal’s columns and lines                   | Columns and lines from the window and a cell size; a resize starts afresh                                     | A browser has no terminal to measure                                     |
| Options      | Read once, at start                                | Changed live in a settings panel, or typed as a command line with the same checks                             | Playing with the options is most of the fun                              |
| Trail `-t`   | Dots that stay                                     | Classic view: the same dots. Abyss: a glowing wake that fades                                                 | Light that never fades would fill the sea                                |
| Field `-f`   | The word WORM repeated across the whole screen     | Classic view: the same letters. Abyss: faint plankton writing, eaten letter by letter                         | The same rule, seen as feeding                                           |
| Randomness   | The C library’s `random()`, never seeded           | The same generator from seed 1, plus a New seed button                                                        | Keep the original’s runs and still offer new ones                        |
| Stopping     | A signal ends it and restores the terminal         | Leave the page                                                                                                | Browsers have no signals                                                 |
| Sound        | None                                               | A drone, bubbles and crossing chimes, following the Hall’s sound in the Hall, otherwise off until asked for   | A quiet deep-sea mood                                                    |
| Progression  | None                                               | A logbook of sightings marked on the floor, a journal of the eight species, a Daily Dive, postcards of scenes | Something to look for, without rewarding the abyss for running unwatched |

## Quirks and bugs in the original

| Quirk                                                                                  | Kept?   | Note                                                                  |
| -------------------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------- |
| `random()` is never seeded, so every run replays identically on the same terminal size | yes     | Seed 1 is the default; New seed gives a different run                 |
| Every worm enters at the bottom-left corner, heading up and to the right               | yes     | The abyss draws a warm-rimmed home burrow there                       |
| A cell is blanked only when the last worm on it leaves (reference counts)              | yes     | Where the count is two or more, the abyss flares and the chime sounds |
| `-d` is read with `strtoul` and cut to an unsigned int, so huge values wrap into range | yes     | The same parsing, errors included                                     |
| Giving `-d 0` is refused, although leaving `-d` out means no delay at all              | yes     | Leaving it out means terminal pace in the port                        |
| With no `-d` the loop never sleeps; the terminal’s line speed set the pace             | changed | Paced like 9600 baud: `max(33, 12.5 × worms)` ms a step               |
| A terminal one column wide makes the original read outside its grid                    | changed | The engine needs at least two columns and two rows                    |

Details and evidence are in [`NOTES.md`](NOTES.md).

## Derived logic or data

Derived, by design. `app/src/engine/worms.js` is a port of the main loop of `worms/worms.c`: the
`XINC`/`YINC` direction steps, the eight flavour characters, the nine turn tables and the loop
itself. `app/src/engine/args.js` follows its option parsing and reproduces its usage and error
messages, which the settings show when a command line is refused. `app/src/engine/random.js`
reproduces the C library’s `random()` from its documented behaviour, not from the BSD source. The
Regents’ notice is kept in [`LICENSES/BSD-3-Clause-UCB.txt`](../../../LICENSES/BSD-3-Clause-UCB.txt)
and the credit in [`CREDITS.md`](../../../CREDITS.md).

## Names

Abyssal Worms is the port’s own name; the Hall lists it under `worms`, the original command. The
eight species names (Lantern worm, Halo worm, Glass eel-worm and the rest) are the port’s own. No
trademarks are involved.
