# Gone Fishing — changes from the original

Original: `fish` from the BSD games, installed as `go-fish`, contributed to Berkeley by Muffy
Barkocy (copyright 1990, 1993, the Regents of the University of California); the version studied
is 4.4BSD's of 1993 as kept by NetBSD.

## The soul we kept

Go Fish as a game of memory against a computer that remembers in its own way. The original's two
minds are here exactly: Otto plays its normal mode (its ranks in turn, round and round) and Hazel
its pro mode (it remembers what you asked for and asks it back). Classic 1993 is the 1993 program
itself: one rival, seven cards each, the `p` switch, the rare peek and the rare parting shot. 1 200
recorded games of the original replay through our engine event for event (`NOTES.md`).

## Changes

| Area                 | Original                                                                 | Reborn                                                                                                    | Why                                                                     |
| -------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Presentation         | Ranks typed at a prompt; hands printed as lines of text                  | A pond drawn in code by morning and by firefly light: casts, reels, a fish for every book                 | The game's own image, "go fish", made literal                           |
| Players              | You and the computer                                                     | You and one to three rivals                                                                               | Memory gets interesting when there is more than one person to remember  |
| Rivals               | One computer, two modes                                                  | Otto (normal mode), Hazel (pro mode) and Miso, a new mind that reasons from everything said               | Three clear steps of skill, each with a face                            |
| Pro mode             | `p` at any prompt or `-p`, for good                                      | Classic 1993: P or the pause menu, for good. Elsewhere Hazel is always pro                                | Faithful in Classic; Hazel's character elsewhere                        |
| The peek             | In pro mode, about one ask in 1 536, the computer looks at your hand     | Kept in Classic 1993 only; never elsewhere, and Miso never peeks                                          | Faithful where asked; honest in the new game (owner's call, 2026-10-15) |
| Endings              | The game ends the moment a hand holds no cards                           | Kept in Standard and Classic; All 13 books draws an emptied hand a card and plays every book out          | Fair score comparisons for the Tournament and the Daily                 |
| Hand size            | Seven                                                                    | Seven with two or three players, five with four                                                           | Enough cards left in the pond                                           |
| What you know        | Your memory; Enter shows the computer's card count and books             | The notebook: asks, answers, shown cards, denials; open or closed, and a bonus for winning closed         | A teaching aid that can be put away                                     |
| The taunt            | One game in 1 024 with an outright winner ends with a jibe               | Kept, in our own words and kinder: cheeky when you win, a happy boast when a rival wins; a hidden package | The original's joke, all-ages                                           |
| Asking a booked rank | Allowed: the turn is wasted (and with an empty pool reads past the deck) | Not possible: books leave the hand                                                                        | A bug, not a rule                                                       |
| Shuffle              | Seeded from the time                                                     | The kit's seeded shuffle; the Daily Pond the same for everyone                                            | Reproducible games and a shared daily                                   |
| Content              | The original's instructions and messages                                 | Written from scratch                                                                                      | Our own words                                                           |
| New modes            | —                                                                        | Quick game, Tournament, Daily Pond, the fish album, thirteen packages                                     | The brief                                                               |

## Quirks and bugs in the original

| Quirk                                                                                | Kept?   | Note                                                                        |
| ------------------------------------------------------------------------------------ | ------- | --------------------------------------------------------------------------- |
| Rotation's first ask is a two whenever a two is held; the ace always comes last      | yes     | Otto's habit; you can learn it                                              |
| Pro mode remembers asks only, never answers: it asks again straight after "Go Fish!" | yes     | Hazel's weakness, and the original's                                        |
| One in three pro-mode asks goes for the biggest group, lowest rank on ties           | yes     | Exactly                                                                     |
| "Cheats only rarely": the pro mode's peek at your hand                               | Classic | The one place the original promised honesty and broke it, kept as a curio   |
| The hand size Enter reports counts booked cards                                      | fixed   | Plates show cards in hand and books apart                                   |
| A booked rank can be asked for; with an empty pool the draw reads before the deck    | fixed   | Books leave the hand                                                        |
| The computer's ordinary draws are silent; only a lucky one is announced              | yes     | You see the line go out; the card stays hidden unless it was the rank asked |
| The parting shot rolls only with an outright winner                                  | yes     | A draw rolls nothing                                                        |

## Derived logic or data

The rules and both computer minds are derived from `fish/fish.c` (the Regents of the University
of California, contributed by Muffy Barkocy; BSD three-clause licence, kept in
[`LICENSES/BSD-3-Clause-UCB.txt`](../../../LICENSES/BSD-3-Clause-UCB.txt)): the deal and who
starts (`init`, `main`), asking and its answers (`usermove`, `goodmove`, `gofish`, `drawcard`),
the normal mind (`compmove`), the pro mind with its memory and the rare peek (`promove`), books
and the ending with its parting roll (`chkwinner`, `countbooks`). They are written anew in
TypeScript in `src/engine/` and listed in `CREDITS.md`. The C library's `random()` is reproduced
in `src/engine/testing/c-random.ts` only to replay recorded games in the tests. No text, layout
or messages were taken.

## Names

The game is **Gone Fishing**; the original's names, `fish` and `go-fish`, appear only in the
credits and the manifest's `originalTitle`. Go Fish is also the name of the card game itself. Our
terms: the **pond** (the original's pool), **casting** (drawing), **books**, the **notebook**,
**Otto**, **Hazel** and **Miso** (the original's computer in its two modes, and one new rival).
