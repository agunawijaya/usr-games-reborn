# Double Cross — changes from the original

Original: `dab` from the BSD games, by Christos Zoulas, with its manual page by Thomas Klausner
(2003, sourced from the copyright lines of every source file, the manual page and its AUTHORS
section).

## The soul we kept

Take turns drawing lines; close a box to claim it and draw again; have more boxes when the board is
full. And the computer that plays you first is the 2003 computer, choices and all.

## Changes

| Area         | Original                                                        | Reborn                                                                                                   | Why                                                                                        |
| ------------ | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Presentation | A grid of characters in a terminal, the cursor highlighted      | Chalk on a sunny pavement, or neon tubes on a brick wall; marks and fill patterns in claimed boxes       | A board you want to look at; ownership never by colour alone                               |
| Controls     | `h j k l` move two steps, `y u b n` hop diagonally, space draws | Arrows aim and walk, Enter or Space draws, mouse click or drag; the original's keys still work, wrapping | Every line reachable without learning a lattice; the original keys kept for those who know |
| Opponents    | One computer, or a second human                                 | Five opponents on a ladder, the original's computer among them; two players at one keyboard              | The game's real depth only shows against opponents that know it                            |
| Teaching     | A pointer to Berlekamp's book in the manual                     | A five-step tutorial, the chain lens, forty endgame puzzles                                              | The book's central trick, the double cross, becomes something you learn by playing         |
| Board size   | Any size the terminal could show, 3 × 3 by default              | Ladder sizes from 3 × 3 to 7 × 7; Custom from 2 × 2 to 10 × 10                                           | Kept the freedom, gave it a sensible range                                                 |
| Who starts   | The computer, unless told otherwise                             | Alternates on the ladder (Gus's first match lets him start, as he always did); Custom lets you choose    | The first move matters; both sides should be learned                                       |
| Many games   | `-n` games in a row with running totals, wins and ties          | Records per mode, a ladder, a Daily Board with a share line                                              | Progress that means something between sessions                                             |
| Content      | Its own screen messages                                         | Written from scratch, every word                                                                         | Provenance: no original message strings                                                    |

## Quirks and bugs in the original

| Quirk                                                                                    | Kept?   | Note                                                                    |
| ---------------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------- |
| The computer never declines a box, so it never plays the double cross                    | yes     | It is Greedy Gus; beating him is the ladder's second step               |
| Its random order reseeds from the clock every time, repeating within a second            | yes     | Ported exactly, with a clock that ticks once a line                     |
| `find_min_closure1` judges its trials on one scratch board it never resets               | yes     | Part of Gus's character                                                 |
| `#ifdef notyet` around `find_single()` and `find_double()`, which do not exist           | told    | On the game menu's tips and in ABOUT; the Pupil and Master are its idea |
| The usage line names the board's dimensions in the opposite order to the code and manual | dropped | Custom names columns and rows plainly                                   |
| There is no random player (the test program only tests the randomiser)                   | n/a     | Scribbler, the random player, is ours                                   |

## Derived logic or data

- **The computer's algorithm** (`algor.cc`): ported to `src/ai/greedy-gus.ts`, its order of
  choices and its scratch-board quirk intact.
- **The randomiser** (`random.cc`, with the C library's `srand48`/`lrand48`): ported to
  `src/engine/rand48.ts`.

Both files carry the original copyright and licence notice in their headers. The notice is in
`LICENSES/BSD-NetBSD-Foundation.txt` (the four-clause NetBSD Foundation licence, with its
advertising clause) and the manual page's in `LICENSES/BSD-Klausner-dab.txt`; the game's row in
`CREDITS.md` names them and carries the required acknowledgement: This product includes software
developed by the NetBSD Foundation, Inc. and its contributors. The rules and the key layout are
facts of the game, written in our own words.

## Names

The game is **Double Cross**, after the move at its heart. The opponents are ours: Scribbler,
Greedy Gus, Chain Counter, Berlekamp's Pupil (after Elwyn Berlekamp, whose book the original's
manual recommends) and Master. `dab` appears as the manifest's `originalTitle` and in the credits.
