# Rain on Still Water — changes from the original

Original: `rain` from the BSD games, by Eric P. Scott, Caltech High Energy Physics (1980, from the
author’s note in `rain.c`; source copyright 1980 and 1993 by the Regents of the University of
California). Its manual page, copyright 1989 and 1993, says it was modelled on the VAX/VMS program
of the same name.

## The soul we kept

A drop lands, its rings spread, it fades; five at a time, for as long as you watch, at a pace you
set. Rain on Still Water keeps every drop’s place and moment from the original loop and shows what
those characters were drawing: rain on water.

## Changes

| Area             | Original                                                     | Rain on Still Water                                                                                       | Why                                                 |
| ---------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Presentation     | Dots, `o`, `O` and rings of dashes and slashes on a terminal | A night pond with a wave simulation; the 80×24 screen kept as a view                                      | Show what the characters were drawing               |
| A drop’s stages  | Characters in and around one cell                            | Each age pushes on the water; rings spread, cross and interfere                                           | Real rings instead of drawn ones                    |
| Timing on screen | Drawn at once                                                | Both views run 350 ms behind the engine                                                                   | So each drop is seen falling before it lands        |
| `-d 0`           | Waits for the terminal to send its output                    | Paced as a 9600-baud line would take the frame, about 150 ms                                              | A browser has no line to wait for                   |
| Terminal size    | Whatever the terminal was                                    | Always 80×24                                                                                              | The captures were 80×24; the pond needs no grid     |
| A drop’s spot    | One character cell                                           | A fixed point inside that cell                                                                            | So the drops of a downpour do not line up in rows   |
| Intensity        | `-d` on the command line, once                               | A slider, presets and keys, applied at once                                                               | Changing the rain is the point                      |
| A bad delay      | An error, and the program exits                              | The same message in a notice; it rains at the default delay                                               | A page has no exit status                           |
| A hidden tab     | —                                                            | The engine skips the time it was hidden                                                                   | Replaying minutes of rain in one frame helps no one |
| Stopping         | A signal ends it and restores the terminal                   | Leave the page                                                                                            | Browsers have no signals                            |
| Sound            | None                                                         | A hiss, splashes and bubble plinks, following the Hall’s sound in the Hall, otherwise off until asked for | The sound of rain on a pond                         |

## Quirks and bugs in the original

| Quirk                                                                                    | Kept?   | Note                                                                |
| ---------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------- |
| `random()` is never seeded, so it rains the same way every run on the same terminal size | yes     | Seed 1 is the default; `?seed=` gives a different shower            |
| With no `-d` it waits for the terminal to drain, so a 9600-baud line set the pace        | changed | Modelled as the frame’s bytes at 960 bytes a second                 |
| `-d 0` is accepted, although the message for a bad delay names 1 to 999                  | yes     | It is the 9600-baud setting                                         |
| The five-wide wipe of the oldest drop can blank parts of neighbouring drops              | yes     | Reproduced on the classic screen; the pond’s rings are not affected |
| The five starting positions enter part-way through their lives, with no dot              | yes     | Shown from their current age; they never land and make no sound     |
| `-d` is read with `strtoul` in any base, and a minus sign wraps to a huge value          | yes     | So `?d=0x10` means 16 and `?d=-5` is refused, as the original would |

Details and evidence are in [`NOTES.md`](NOTES.md).

## Derived logic or data

Derived, by design. `app/src/engine/rain.js` is a port of the loop logic of `rain/rain.c`: the
five-slot buffer and its drawing order, the drop’s glyphs at each age and the wipe, and its two
error messages for a bad delay. `app/src/engine/random.js` reproduces the C library’s `random()`
from its documented behaviour, not from the BSD source. The Regents’ notice is kept in
[`LICENSES/BSD-3-Clause-UCB.txt`](../../../LICENSES/BSD-3-Clause-UCB.txt) and the credit in
[`CREDITS.md`](../../../CREDITS.md).

## Names

Rain on Still Water is the port’s own name; the Hall lists it under `rain`, the original command.
No trademarks are involved in its title or interface.
