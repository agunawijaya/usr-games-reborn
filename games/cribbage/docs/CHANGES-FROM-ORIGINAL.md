# Fifteen-Two — changes from the original

Original: `cribbage` from the BSD games, game logic by Earl T. Cohen and screen interface by Ken
Arnold (1980; the source carries "Copyright (c) 1980, 1993 The Regents of the University of
California", and the manual names both authors).

## The soul we kept

Two players, one crib, the play to 31 and the show: every hand a small decision about what to
keep and what to give away, and every card laid a chance to peg or to give a point. And the
original's best idea: counting your own hand is part of the game.

## Changes

| Area          | Original                                                                                                   | Reborn                                                                                                                                    | Why                                                                 |
| ------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Presentation  | Text windows: hands, table, a four-row text board                                                          | A wooden table and board drawn in code, cards from the kit's deck, two designed looks                                                     | The game finally looks like the game                                |
| Counting      | You type your total; over-count: true score and 2 for the computer; under-count: the rest lost; 19 means 0 | Three modes: Automatic (lit up and counted for you), Count yourself (no penalty), Classic 1980 (exactly the original's rule, 19 included) | Newcomers learn by seeing; the old rule stays for those who want it |
| Explanation   | `-e` prints one line explaining the true count                                                             | Every combination lights up in turn with a ledger, for every hand, yours and the computer's                                               | Counting you can see                                                |
| Controls      | Type cards ("kd", "king of diamonds") and numbers; cut positions asked but ignored                         | Click, drag or keyboard; cuts are made for you                                                                                            | Web first; the original ignored the cut numbers anyway              |
| Opponent      | One computer player                                                                                        | Three: Beginner, Classic (the original's player, card for card) and Sharp                                                                 | Something for every player                                          |
| Help          | `-e` and a rules primer from a Hoyle shown in a pager                                                      | A coach for the throw and the play, a How to play page, a counting trainer                                                                | Learning by doing                                                   |
| Modes         | One game after another, 61 or 121                                                                          | Games to 61 or 121, Continue, a counting trainer, the Daily Discard, hand records                                                         | Reasons to come back that are not timers                            |
| Score keeping | Games won counted 1, skunks 2, double skunks 4, in a log file                                              | Records, an album of best hands, packages and the Hall's XP                                                                               | The collection's progression                                        |
| Board         | Text, two pegs a side leapfrogging                                                                         | Walnut and maple, two brass pegs a side leapfrogging with a tok, brass plates with the scores                                             | The same leapfrog, now with a sound                                 |
| Content       | Messages in the program's voice                                                                            | Written from scratch                                                                                                                      | Our own words                                                       |

## Quirks and bugs in the original

| Quirk                                                                                | Kept?                                                              | Note                                                                 |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------ | -------------------------------------------------------------------- |
| A claim of 19 is read as 0                                                           | yes, in Classic 1980; the trainer accepts 19 for a hand of nothing | The hook                                                             |
| An over-count's 2 points are not pegged when the true count already wins             | yes, in Classic 1980                                               | `settleClaim` / `showNext`                                           |
| The computer weighs its own kept hand as a crib (no four-card flush)                 | yes, in Classic only                                               | Its character; Sharp counts it properly                              |
| The crib table counts four-card crib flushes (every suited entry 8,580 too high)     | yes, in Classic only                                               | Found by recomputing the table; NOTES.md                             |
| The pegging scorer reads one card before the table when the whole pile shares a rank | fixed                                                              | We implement the intended rule; the recorded positions assume it     |
| The `-e` explanation can print two commas in a row (nobs with a four-card flush)     | dropped                                                            | Our ledger lists each combination                                    |
| The manual says Enter at a number prompt means the lowest value; the code asks again | dropped                                                            | Our claim pad asks for a number                                      |
| Cut positions are asked for and ignored                                              | dropped                                                            | We cut without asking                                                |
| Double skunk in a game of 61 needs the loser on 0                                    | yes                                                                | The arithmetic is kept; the Double skunk package needs a game of 121 |
| The loser of a game deals first in the next                                          | yes                                                                | Play again                                                           |

## Derived logic or data

From `support.c`, `score.c` and `crib.c` (© 1980, 1993 The Regents of the University of
California, [BSD-3-Clause-UCB](../../../LICENSES/BSD-3-Clause-UCB.txt), listed in `CREDITS.md`):

- the computer player's discard (`cdiscard`, with `adjust`) and play (the choice in `peg` and
  `cchose`), ported decision for decision as Classic in `src/engine/ai/classic.ts`;
- the rules as the program applies them: the play with go and last card, the show's order and
  scoring, the over- and under-count rule with 19 read as nothing, skunks, and the loser dealing
  first.

The crib table is not copied: we compute it with our own counter (`scripts/crib-table.ts`) and
add back the original's four-card flush sum for Classic. No text, messages, layouts or art are
taken.

## Names

Fifteen-Two (from the count every player says aloud). The three opponents are named by how they
play: Beginner, Classic, Sharp. The original's title appears only as `originalTitle` in the
manifest and in `CREDITS.md`.
