# Selene — changes from the original

Original: `pom` from the BSD games, by Keith E. Brandt (1984, from the author’s note in `pom.c`),
updated to the third edition of Duffett-Smith’s book by Paul Janzen (1998); manual page copyright
1989 by the Regents of the University of California.

## The soul we kept

One question, one honest answer: what is the Moon doing at this moment? The original answers in a
sentence; Selene keeps that sentence, computed the same way, and paints the Moon it describes.

## Changes

| Area          | Original                                   | Selene                                                                    | Why                                            |
| ------------- | ------------------------------------------ | ------------------------------------------------------------------------- | ---------------------------------------------- |
| Presentation  | One line of text                           | A ray-traced Moon over a night lake, with the line kept as a caption      | Let the answer be seen, not only read          |
| Time          | One optional argument per run              | Live clock, hour and day steps, a month scrubber, date picker, timelapse  | Exploring time is the fun part                 |
| Phases        | Only the phase at the time asked           | A calendar and the next eight principal phases                            | Answer the question people actually ask: when? |
| Input         | `[[[[[cc]yy]mm]dd]HH]` on the command line | The same syntax in a field, with the same error message                   | Keep the original’s way of asking              |
| Accessibility | A terminal                                 | Full keyboard control, high contrast, reduced motion, a quiet live region | Everyone can use it                            |

## Quirks and bugs in the original

| Quirk                                                                                                 | Kept?   | Note                                                                               |
| ----------------------------------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------- |
| “Full” and “New” only when the rounded percentage is exactly 100 or 0, so each lasts only a few hours | yes     | Part of the answer being byte for byte                                             |
| “is” only when the time asked equals the current second; any typed hour reads “was” or “will be”      | yes     | The live view shows “is”                                                           |
| Two-digit years below 69 mean the 2000s                                                               | yes     | The same parser                                                                    |
| No correction between the Unix clock (UTC) and the book’s dynamical time, about a minute              | yes     | Documented in the original’s own manual                                            |
| Times must lie within the range of the Unix epoch                                                     | changed | The scrubber and date picker travel further; the `pom` field keeps pom’s own rules |

Details and evidence are in [`NOTES.md`](NOTES.md).

## Derived logic or data

Derived, by design. `app/src/engine/pom.js` is a line-by-line JavaScript port of `potm()` from
`pom/pom.c` (the Duffett-Smith algorithm and its constants), its date parser and the rules and
wording of its one-line answer, which Selene reproduces exactly. The Regents’ notice is kept in
[`LICENSES/BSD-3-Clause-UCB.txt`](../../../LICENSES/BSD-3-Clause-UCB.txt) and the credit in
[`CREDITS.md`](../../../CREDITS.md). The positions of seas and craters come from the IAU/USGS
Gazetteer of Planetary Nomenclature, not from the original.

## Names

Selene is the port’s own name; the Hall lists it under `pom`, the original command. No trademarks
are involved.
