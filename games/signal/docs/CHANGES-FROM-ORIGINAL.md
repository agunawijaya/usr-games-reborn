# Dits & Daws — changes from the originals

Originals: `caesar` (Stan King and John Eldridge, after an idea of Bob Morris; contributed to
Berkeley by Rick Adams), `rot13` (a script calling `caesar 13`), `morse`, `ppt`, `bcd` (Steve
Hayman, 1989, with Dyane Bruce's fixes of 1993) and `banner` (Mark Horton, 1980), all from the
BSD games (the Regents of the University of California). Flag semaphore has no original.

## The soul we kept

Each program turned a message into something else and, where it could, back again: Morse in
dits and daws, a card of holes, a strip of tape, a banner too big for a screen, and a cipher
broken by counting letters. The game keeps that loop (encode, carry, decode) and makes each
step a machine you work with your hands.

## Changes

| Area         | Originals                                                   | Reborn                                                                                                           | Why                                         |
| ------------ | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Presentation | Text on a terminal: `dit daw` lines, `]` holes, `#` banners | Six machines on a desk drawn in code, by morning and by night                                                    | The prompt's codebreaker's desk             |
| Purpose      | Filters: text in, text out                                  | A campaign of 42 messages, free play, a Daily Signal, a sandbox                                                  | Something to do with each tool, and a story |
| Morse        | Prints the code, decodes dots and dashes                    | Plays it on a sounder with a lamp and a register; you read it or key it                                          | The craft of the operator, by eye and ear   |
| caesar       | Guesses the turn and prints the result                      | You turn the wheel; the guess is the scope's light, which you may trust or beat                                  | Learn the trick, then learn its limits      |
| bcd          | Prints a card for a line of text                            | Read cards by their holes, punch them by hand; the code chart notes the real code                                | The card as a puzzle                        |
| ppt          | Punches and reads tape                                      | Read rows by adding hole values; punch rows with the number keys                                                 | Binary by hand                              |
| banner       | Prints sideways down 132 columns; `-w` scrunches            | Prints sideways while you read it; narrow widths are "squint" difficulty; a right answer turns the paper upright | Reading early is the game                   |
| Semaphore    | —                                                           | A sixth machine: read a signaller on the roof, or send with two flags against a clock                            | Owner's addition                            |
| Content      | —                                                           | All messages, stories and phrases written for this desk                                                          | Our own words                               |

## Quirks and bugs in the originals

| Quirk                                                                                                    | Kept?           | Note                                                                                               |
| -------------------------------------------------------------------------------------------------------- | --------------- | -------------------------------------------------------------------------------------------------- |
| `morse` says "daw", and that is its default output                                                       | yes             | The title                                                                                          |
| `morse` ends every message with SK and swallows it when decoding                                         | yes (codec)     | Reproduced in the codec and its tests                                                              |
| `morse -d` turns a run of ten marks into one `x` and eats the next character                             | yes (codec)     | Tested against the original's output                                                               |
| `bcd.6` says `-d` decodes "dots and slashes"                                                             | noted           | A typo for dashes                                                                                  |
| `caesar`'s manual table differs from the one in its code                                                 | both shown      | The scope scores with the code's table; the manual's is in the notes                               |
| `caesar` guesses from the first 2048 bytes only                                                          | yes (codec)     |                                                                                                    |
| `bcd`'s deduced table: Q and R once shared a code; `\ ] ^ _ { \| } ~` slipped by one; `_` is 0-1-6-7-8-9 | kept, explained | The game punches Hayman's table as the prompt asks; the chart marks where the GE-635 code differed |
| `bcd`'s upper byte half is the lower half shifted by one                                                 | dropped in play | Only ASCII is punched                                                                              |
| `ppt -d` stops at the first line without a sprocket ("lost sync?")                                       | yes (codec)     |                                                                                                    |
| `banner` from standard input drops the last character                                                    | yes (codec)     | The game passes messages directly, so players never meet it                                        |
| `banner`'s backquote prints the double quote's glyph                                                     | yes             |                                                                                                    |
| `banner -w` uses one mask for columns and for lines inside each glyph                                    | yes             | It is the grain the game calls squint                                                              |

## Derived logic or data

All under the BSD-3-Clause notice of the Regents of the University of California
([`LICENSES/BSD-3-Clause-UCB.txt`](../../../LICENSES/BSD-3-Clause-UCB.txt)), credited in
[`CREDITS.md`](../../../CREDITS.md):

- the Morse table, its output forms and decoder (`morse.c`);
- `caesar`'s frequency table, its log weighting and its choice of turn (`caesar.c`), and the
  manual's table (`caesar.6`);
- `bcd`'s 256-entry hole table and its card layout (`bcd.c`);
- `ppt`'s row layout and its reader (`ppt.c`);
- `banner`'s glyphs, converted from its byte program, and its `-w` scrunching (`banner.c`).

No text of the originals' messages or manuals appears in the game.

## Names

The game is **Dits & Daws**. The machines keep plain names (telegraph, cipher wheel, card punch,
tape reader, banner printer, flags). The original programs' names appear only in the man page
credit, the notes and `inspiredBy`.
