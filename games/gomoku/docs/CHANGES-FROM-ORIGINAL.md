# Fivefold — changes from the original

Original: `gomoku` from the BSD games, by Ralph Campbell (1994, from the manual and the sources'
copyright), with board display routines based on Peter Langston's goref program.

## The soul we kept

Two sides race to five in a row on a Go-sized board, against a computer that reads the board in
frames and hunts for combinations of them that force a win. Every opponent in Fivefold thinks with
that same search; "Campbell" is the 1994 program itself, move for move.

## Changes

| Area          | Original                                                       | Reborn                                                                                                            | Why                                          |
| ------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Presentation  | A curses board of letters, numbers and characters              | A raked stone garden by day, a lantern lake by night, drawn in Canvas                                             | Two designed looks, readable at a glance     |
| Controls      | Typing moves as a letter and a number                          | Point and click, or an arrow-key cursor and Enter                                                                 | Today's players; full keyboard play kept     |
| Board         | 19 × 19                                                        | 15 × 15 by default, 19 × 19 as the original                                                                       | Quicker games for new players                |
| Rules         | Five or more in a row wins                                     | Freestyle (the same) or Exactly five (six counts for nothing)                                                     | A second, well-known rule set                |
| Opponents     | One program, at its full strength                              | Six opponents on a ladder, five of them gentler versions of the same search, one stronger                         | A path from first game to the full 1994 mind |
| Help          | None                                                           | Read the board: fours and open threes drawn                                                                       | Learning to read threats is the game         |
| Insight       | A debug mode printing its search                               | A replay showing what it weighed before each move                                                                 | Its thinking, readable                       |
| Modes         | You against it; two people; it against itself; tournament mode | Ladder, practice, two players, Bot League (the tournament mode as a show), 60 puzzles, a Daily Puzzle, a tutorial | Something for every session length           |
| Saving        | `save` wrote the move log; it could be replayed                | Progress is saved automatically; every game can be replayed at its end                                            | Modern expectations                          |
| Ending a game | A tie after 360 stones, before the five check                  | A draw when the board is full, after the five check                                                               | A five is a five                             |
| Personality   | A gloat, a grumble, a surprised tie line                       | Each opponent's own kind lines; nobody gloats                                                                     | All-ages, kind copy                          |
| Thinking time | As long as the search takes (minutes, now and then)            | Capped work per move, in a worker so the board never freezes                                                      | A responsive game                            |

## Quirks and bugs in the original

| Quirk                                                                                                   | Kept?                                     | Note                                                                              |
| ------------------------------------------------------------------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------- |
| Six or more in a row wins (a frame of five inside it)                                                   | Kept in Freestyle                         | Exactly five is the alternative                                                   |
| The tie is declared at the 360th stone, before the win is checked                                       | Kept in the port; not in Fivefold's rules | The port must match the reference games; Fivefold's own rules end on a full board |
| The deeper search for the side not to move often stops at once (a reused variable)                      | Kept                                      | It is how the 1994 player plays; the reference games prove it                     |
| A frame list's head left on a removed frame when it was the only one                                    | Kept                                      | Part of matching the original move for move                                       |
| With only dead points left, it can name a taken corner, a move it may not make, and the game ends there | Fixed in play                             | The port reproduces it; Fivefold plays the best empty point instead               |
| Search time can run to minutes in crowded positions                                                     | Capped in play                            | Campbell agrees with the uncapped search on about 97 % of moves (NOTES.md)        |
| The tie message's missing apostrophe                                                                    | Dropped                                   | Our lines are our own                                                             |

## Derived logic or data

The 1994 AI is ported from `pickmove.c`, `makemove.c` and `bdinit.c` (with the frame and combination
structures of `gomoku.h`): the algorithm, its constants (the weights 0, 1, 7, 22, 100, the combination
value packing) and its order of work, re-expressed in TypeScript with comments in our own words. The
Regents of the University of California's BSD licence notice for the gomoku sources is in `LICENSES/`,
and the row is in `CREDITS.md` (Ralph Campbell; Peter Langston for goref). The thirty reference games
in `src/engine/campbell/reference-games.json` are moves the original program played, recorded by
running it outside the repo. Nothing else is derived: rules engine, threats, solver, puzzles,
personalities, art, sound and words are new.

## Names

"Fivefold" is ours, as are the opponents' names (Pebble, Reed, Heron, Koi, the Referee); "Campbell"
honours the author, as the prompt asks, and his portrait is a stone lantern, not a likeness. The
pieces are named by the look (slate and quartz, amber and moonlight), never black and white on
screen. The original's name appears only in `CREDITS.md`, the manifest's `inspiredBy`, and the docs.
