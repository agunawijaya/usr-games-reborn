# Fivefold — working notes

Prompt 07, wave 2. **Status: shipped (2026-10-03).** The hero frames and the seven decisions below
were approved by the owner at the checkpoint ("continue", 2026-10-03); the stages after it
followed.

## Sources read

This section is the provenance: the only place outside `CREDITS.md` where the original program's
name appears beside its files.

`E:\Projects\BSDGames\BSDGames-master\gomoku\` (read-only, outside the repo): `pickmove.c` (cited
below as **pick**), `makemove.c` (**make**), `bdinit.c` (**init**), `main.c` (**main**),
`gomoku.h` (**header**), `stoc.c` (**stoc**), `bdisp.c` (**disp**) and the manual `gomoku.6`
(**manual**). BSD licence, "Copyright (c) 1994 The Regents of the University of California", code
contributed to Berkeley by Ralph Campbell. The port in `src/engine/campbell/` follows the original's
structure with its comments in our own words; the licence notice goes into `LICENSES/` and the
credit (Ralph Campbell, and Peter Langston's goref for the board display) into `CREDITS.md` at the
end. The original's three result messages are not reused anywhere.

## Verified facts about the original

| What              | Where                              | Verified                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Year              | `manual:3, 35`; `main:4`; `pick:4` | Copyright 1994; the manual is dated August 4, 1994. **The manifest's year 1994 is right.**                                                                                                                                                                                                                                                                                      |
| Author, goref     | `manual:91–95`                     | Author Ralph Campbell; the acknowledgements say the board display was based on Peter Langston's goref program.                                                                                                                                                                                                                                                                  |
| Board             | `header:42–45, 91`                 | 19 × 19 (`BSZ`), stored with a border row and column all round; a point is `x + 20·y`.                                                                                                                                                                                                                                                                                          |
| Coordinates       | `stoc:49, 75, 110`; `disp:95, 107` | Letters A–T without I across, numbers 1–19 up from the bottom: "K10" is the centre.                                                                                                                                                                                                                                                                                             |
| First move        | `pick:77`                          | The program opens on the centre point when it moves first.                                                                                                                                                                                                                                                                                                                      |
| Commands          | `stoc:56–58`; `main:248–270`       | Besides moves, "resign" and "quit" (the same thing) and "save" (writes the move log to a file, to be replayed by giving it on the command line).                                                                                                                                                                                                                                |
| Who plays whom    | `main:108–125, 157–205`            | You against it (it asks which colour you want), `-u` two people, `-c` the program against itself, `-b` background mode.                                                                                                                                                                                                                                                         |
| Tournament mode   | `manual:65–73`; `main:110`         | `-b` reads moves on standard input and prints its own on standard output, after a first line naming its colour: "intended for game tournaments where a referee program handles the board display".                                                                                                                                                                              |
| Win               | `make:125–147`                     | After each move it counts the mover's stones in every five-spot frame through it; **five in any frame wins**.                                                                                                                                                                                                                                                                   |
| **Overlines win** | `make:146`                         | A line of six or more holds a frame of five of the mover's stones, so it wins too. Freestyle is the 1994 rule; Exactly five is ours.                                                                                                                                                                                                                                            |
| Tie               | `make:84–86`                       | The move counter is checked **before** the win: the 360th stone ends the game as a tie even if it makes five, with one point still empty.                                                                                                                                                                                                                                       |
| Messages          | `main:293–302`                     | Three result lines: a gloat when it wins, a grumble when you win, and surprise at a tie (with a missing apostrophe). Not reused: our opponents speak their own lines.                                                                                                                                                                                                           |
| Frame values      | `make:149–158`                     | Each frame has a combo value ⟨a, b⟩: `a` = moves still needed to make it unstoppable, `b` = 1 if both ends are open. An open four is ⟨1,1⟩ (`0x101`).                                                                                                                                                                                                                           |
| Spot weights      | `make:51`                          | Tie-break weights by stones in a frame: 0, 1, 7, 22, 100.                                                                                                                                                                                                                                                                                                                       |
| Search depth      | `pick:332–343`                     | Combos of three frames, four and on are tried only while the depth ≤ (moves played + 1) / 2: it thinks shallowly early on. No other limit (`MAXDEPTH` 100, `pick:792`).                                                                                                                                                                                                         |
| Last tie-break    | `pick:217`                         | When two spots are equal in every respect, `random() & 1`. The C library's `random()` therefore decides many moves; to replay a game exactly, the seed and the generator must match.                                                                                                                                                                                            |
| Taken corner      | `pick:99–117`                      | The search for the best spot starts from the top-right corner. When every empty point left is dead (no frame through it), an empty point never beats the corner, and if the corner is taken the program names it anyway, a move it may not make, and the game ends there. Seen in the port on 15 × 15 self-play near a full board; Fivefold plays the best empty point instead. |
| Reused variable   | `pick:301–309`                     | In `scanframes`, the spot index of each forcing frame is stored in `n`, the variable that also holds the combo count the deeper search compares against (`pick:335`). For the side not to move this often stops the deeper search at once. A bug; kept, because it is how the 1994 player plays.                                                                                |

### Hook verdicts (prompt §1)

- **Frames and combinations:** confirmed. A frame is every run of five (six counting the open end)
  spots; the search builds combinations of two frames crossing at an empty spot (`makecombo2`), then
  adds frames one at a time (`addframes`/`makecombo`), keeping only combos that could still force a
  win, and scores every empty spot by the best combo through it. A genuine threat-space idea.
- **Built for robot tournaments:** confirmed (`manual:65–73`); `-c` plays itself (`manual:74–78`).
- **Board from a Go referee program:** confirmed — the acknowledgement names goref by Peter
  Langston, and the board is Go-sized 19 × 19.
- **It gloats, grumbles, and is surprised by a tie with a typo:** confirmed (`main:293–302`).
- **Six or more in a row:** the code tests five _within a frame_, and a run of six contains such a
  frame — **six wins**. Exactly five is offered as our second rule set.
- **New finding:** the program declares a tie at the 360th stone _before_ it checks for a win, so a
  five made with the last stone counts for nothing.

## The original, built and recorded

To test the port against the real thing, the original was built outside the repo (a scratch folder
of this session, never committed): Ubuntu under WSL, gcc 13 and ncurses, with two local changes to
compile on a modern C library (the program's own `getline` renamed, and a missing endian header
supplied). Small drivers linked against its object files:

- **selfplay**: `srandom(seed)`, plays a given opening, then lets `pickmove` play both sides to the
  end, printing every move and the result. 30 games, seeds 1–30, openings cycling through 15 (none,
  the centre and its neighbours, corners, edges, a broken four, a long diagonal, the far corner).
- **dump**: for a position, prints every frame's value, every spot's combo, level and force count —
  used to find where the port first disagreed.

The games are in `src/engine/campbell/reference-games.json`, one per line.

## The port (`src/engine/campbell/`)

- `glibc-random.ts` — the C library's `random()` as glibc implements it: the additive feedback
  generator of degree 31 that `srandom` seeds (by Schrage's method), with the first 310 outputs
  thrown away. Checked against glibc's first outputs for seed 1.
- `board.ts` — the board, frames, the sorted frame lists, `bdinit` and `makemove`, with the
  original's u_char arithmetic (`u8`) wherever it wraps.
- `pickmove.ts` — `pickmove`, `scanframes`, `makecombo2`, `addframes`, `makecombo`, `makeempty`,
  `updatecombo`, `appendcombo`, `checkframes`, `sortcombo`, `better`. Kept quirks: the 360-stone
  tie, overlines, the reused `n` above, and the head of a colour's frame list left pointing at a
  removed frame when it was the only one (`make:104–107`). Added for Fivefold, leaving its choices alone by default: caps on combination
  depth (`maxDepth`) and on combination work (`maxWork`), and a record of what it weighed
  (`thinking`) for the replay.
- `mind.ts` — the 1994 player inside a Fivefold game: keeps its own board in step and translates
  between Fivefold's points (row by row from the top left) and the original's.

**Result: all 30 recorded games are played move for move as the original played them, and end the
same way (wins, and the 360-move tie of seed 1).** The first full run matched 19 of 22; the
divergences traced to the reused `n`, and every game matched once it was reproduced.

The 1994 search is slow in crowded positions, in C as in the port: the C program needs about two
and a half minutes for the whole of seed 9's game; the port takes about three. All 30 games take
about 20 minutes, so the everyday test plays four (the tie and three quick wins, ~40 s);
`GOMOKU_REFERENCE=all` plays all 30.

| Seed  | Opening         | Port time | Seed | Opening             | Port time |
| ----- | --------------- | --------- | ---- | ------------------- | --------- |
| 2     | K10 L11         | 4 s       | 21   | A1 T19 S18          | 20 s      |
| 12    | K1 K19          | 7 s       | 5    | K10 K11 L10         | 40 s      |
| 14    | T1              | 7 s       | 29   | T1                  | 86 s      |
| 1     | none (the tie)  | 19 s      | 9    | K10 L10 J10 M10 H10 | 178 s     |
| 22, 7 | J10 K10 L10 M10 | 15 s      | 24   | K10 L10 J10 M10 H10 | 197 s     |

## Fivefold's own engine

- `src/engine/game.ts` — our rules: 15 or 19 lines, black first, Freestyle (five or more) and
  Exactly five (six or more count for nothing); a full board is a draw. Points are `y·size + x`
  from the top left.
- `src/engine/threats.ts` — what "Read the board" shows. A **four** is four stones of one side in a
  five-point window with no opponent stone in it, plus the point that makes five. An **open three**
  is three stones in such a window where one more stone makes a four with two winning points (an
  open four). Threes inside a four are dropped; threes of one side that share stones in one line are
  one shape and drawn once.
- `src/engine/opponents.ts` — the ladder. All six think with the 1994 search; they differ in combo
  depth (1, 2, 3, 4, uncapped), in how often they slip on a quiet move and how often they overlook an
  open three. The Referee adds a modern threat-space search (a win by continuous fours and threes,
  and defence against one). Their lines are ours and kind; none gloats.
- `src/engine/solver.ts` — the threat-space solver (fours, and open threes when asked), with a node
  budget; it lists every winning first move.

## Hero frames (stage 1)

Three live scenes in `dev/scenes.ts`, light (Zen Sand) and dark (Lantern Lake), 1920 × 1080, shot by
`e2e/hero.spec.ts` into `docs/media/hero/`:

- **midgame** — move 37 of a self-play game (seed 194, combination depths 2 and 3): Heron has a four
  on the long diagonal and an open three; you have an open three of your own but must block at M12.
  Read the board on; the cursor and a ghost pebble/lantern on the blocking point.
- **win** — move 43 of seed 186: your five on a diagonal. By day the line of light, warm light in the
  sand under the five and three rings raked outward; by night the rest of the lake dims and the five
  lanterns lift off together, trailing light and embers, bound for the sky beside the moon where they
  become five new stars (frozen 1.5 s into the moment).
- **ladder** — Pebble and Reed beaten (Pebble with a star), Heron beaten once and up next, Koi,
  Campbell and the Referee still waiting.

Every position is from a game the 1994 player played against itself; staging only picks the moment.

All six live scenes hold **60 fps at 1920 × 1080 (median 16.7 ms, 95th percentile ≤ 16.8 ms)**.

### Critique log

1. First frames: the staged position sat in one corner with half the board empty; reflections read
   as barcodes; the moonlight globes read as light bulbs; the moon hid behind a card; the river-stone
   border was a busy necklace; the quartz vein read as a crack. Searched 200 more self-play games
   for a central, crowded moment with threats on both sides.
2. New position. Pebbles 7 % larger with a resting shadow; milky quartz instead of a vein; a cut
   granite kerb instead of the stone border; round paper lanterns with rims and ribs instead of
   globes; the moon moved into the sky band; drifting lanterns on the open lake beside the board;
   overlapping threes merged into one line; the ghost piece drawn above the threat rings.
3. The kerb's shadow had darkened the whole bed (drawn after it): kerb first. Reflections still
   striped. The rising lanterns ended over the title and collided with the caption: the caption
   moved into your seat card, the stars' place moved beside the moon.
4. The five got lost among the other lanterns: the rest of the lake now burns lower during the
   moment. Warm light by day had muddied the slate pebbles: moved under them, into the sand. Four
   rings to three, wider apart.
5. Staggered lift had stacked the five into a column: they keep their line now, and the still is
   taken while they are big and trailing light. Reflections to one soft column and one glint. The
   ladder's empty upper half: rocks and their raked rings up there by day; by night the sky, the moon
   and drifting lanterns fill it. The moon's path made of uneven streaks (it had looked like rungs).
6. Close-ups at four times scale: the heron is drawn in one piece (head, crest, bill, S-neck, body,
   folded wing, a standing leg and a tucked one), the koi reads from above, pebbles and lanterns hold
   up. At 1280 × 720 the ladder's footer fell off the screen and the opponent card wrapped badly:
   tighter cards, smaller portraits and a shorter staircase on short screens.

## Decisions (approved by the owner, 2026-10-03)

1. **Canvas 2D** for the board and scenery (ADR 0001), and the **1994 player as the engine of every
   opponent** (ADR 0002).
2. **Side names by look.** "Black" and "white" never appear: Slate and Quartz by day, Amber and
   Moonlight by night. The ladder's star "for winning as white" reads "Win moving second ★".
3. **Shape, not only colour, at night:** the first player's lanterns are square paper boxes, the
   second's round paper lanterns.
4. **The night win:** the five lift off together and become a small constellation beside the moon,
   leaving glints on the water; the rest of the lake dims while it happens. By day: a line of light,
   warm sand under the five, and three rings raked outward that stay in the sand.
5. **The ladder:** Pebble, Reed, Heron, Koi, Campbell, and the Referee apart ("beyond"), opened by
   beating Campbell twice. Portraits from the garden and lake: a little cairn, bulrushes, a heron, a
   koi, a stone lantern, the full moon. Campbell is named for the author, as the prompt asks; his
   portrait is the lantern, not a likeness of anyone.
6. **Keys:** T toggles Read the board (R stays Play again, as in every game's results).
7. **Thinking time:** the uncapped 1994 search can take seconds in crowded positions (minutes, in
   rare ones). From stage 2 the opponents run in a Web Worker so the board never freezes, with a cap
   on combination work per move; Campbell keeps the full search except for that safety cap, and how
   often the cap ever changes a move will be measured and recorded.

## After the checkpoint

### Thinking time and the work cap

Self-play on 15 × 15 with the uncapped search (12 games, 1,169 moves): median 3 ms a move, 90th
percentile 0.3 s, 99th percentile 20 s, slowest **116 s**; combination work (combinations of three
frames or more, both sides) median 1,131, 99th percentile 226,112, most 501,150. So every opponent
has a cap per side per move (`maxWork`), and plays in a Web Worker.

Against a near-uncapped search (150,000 per side) over 386 moves of eight games:

| Cap per side | Median | 99th percentile | Slowest | Moves that hit the cap | Same move as near-uncapped |
| ------------ | ------ | --------------- | ------- | ---------------------- | -------------------------- |
| 4,000        | 11 ms  | 25 ms           | 27 ms   | 235                    | 340 (88 %)                 |
| 12,000       | 28 ms  | 122 ms          | 180 ms  | 175                    | 355 (92 %)                 |
| **30,000**   | 28 ms  | 495 ms          | 593 ms  | 106                    | **373 (97 %)**             |

Campbell and the Referee use 30,000 (`CAMPBELL_WORK`); Pebble 2,000, Reed 4,000, Heron 8,000,
Koi 14,000.

### The ladder's balance

Each opponent against a yardstick that is not on the ladder (the 1994 search two frames deep, slips
8 %, overlooks a three 10 %), 40 games each, half moving first (`balance.test.ts`, `GOMOKU_BALANCE`):

| Opponent | Won | Drawn | Score |
| -------- | --- | ----- | ----- |
| Pebble   | 5   | 0     | 13 %  |
| Reed     | 12  | 1     | 31 %  |
| Heron    | 20  | 1     | 51 %  |
| Koi      | 23  | 3     | 61 %  |
| Campbell | 27  | 3     | 71 %  |
| Referee  | 37  | 1     | 94 %  |

A smooth rising curve; the Referee, beyond the ladder, stands well above Campbell. A first run against
Heron itself (24 games each) had Koi below Heron: Koi's slips came down and its blind spot halved,
and the yardstick became a player of its own. The everyday test checks the ends (Pebble below Koi).

### Puzzles

`scripts/make-puzzles.ts` plays ladder opponents against each other on 15 × 15 (pairs Heron–Koi,
Reed–Heron, Koi–Reed, Koi–Campbell, Campbell–Heron). Whenever the 1994 search rates the point it is
about to play one move from unstoppable, the position goes to the solver, which keeps it if the side
to move can force five in 2–7 moves, exactly one first move does it that fast (counting fours and
open threes), and the search finished inside its budget. One puzzle a game at most.

Collected in four processes over seed ranges 1–160, 161–320, 321–480 and 481–640, stopped part-way
once 302 puzzles were in (about one game in two gives one): 147 Gentle, 104 Keen, 51 Deep. The build
takes the first twenty of each band by seed for the numbered sixty and the next two hundred for the
daily pool (100 Gentle, 73 Keen, 27 Deep).

| Numbered | Win in 2 | 3   | 4   | 5   | 6   | 7   | All fours | With threes |
| -------- | -------- | --- | --- | --- | --- | --- | --------- | ----------- |
| 60       | 12       | 8   | 9   | 11  | 16  | 4   | 15        | 45          |

`modes.test.ts` proves every numbered puzzle again (one first move wins, none wins sooner, all fours
exactly when marked so) in the everyday run, and all two hundred daily ones with
`GOMOKU_PUZZLES=all` (all pass, 219 s).

The puzzle judge accepts any move that keeps a forced win within the moves left, not only the
answer; the other side blocks every four and answers a three with the defence after which your
quickest win is longest.

### Tests

| Suite                                                                                  | Result                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit (`vitest --project gomoku`)                                                       | 36 passed, 27 skipped by switch (26 slow reference games, the long balance run); 118 s                                                                                                                                                                                                                                                                                        |
| Browser (`playwright -c games/gomoku`)                                                 | 8 game tests (two players by mouse with the replay; keyboard, take-back and Read the board; a ranked game against Pebble; a puzzle solved and one failed, with Show me; the Daily Puzzle and its share line; a Bot League match; the whole tutorial; the ways out) and 4 in the Hall (Escape, the pause menu's items and Leave, Back to the Hall, H on the results): all pass |
| Frame rate, heaviest board (19 × 19, 300 pieces, Read the board on, everything moving) | 60 fps both looks: mean 16.7 ms, 95th percentile 16.8 ms                                                                                                                                                                                                                                                                                                                      |

### Screens: critique log (1280 × 720 and 1920 × 1080, both looks)

1. The game menu: a rock sat behind the wordmark and the tagline wrapped — the menu got its own rock
   layout, clear of the column, and a wider column. By night: five lanterns afloat and five stars
   above them, the motif of the win.
2. Results: an empty status pill under "Five in a row" (status is now absent when the game is over);
   after a night win the risen lanterns' trails stayed in the sky as a comb of light (trails now fade
   to nothing, the new stars are smaller), and the board stayed dimmed (it brightens again once the
   five are stars).
3. The Daily Puzzle page was a lone card: it now shows the day's position on a small board. The Bot
   League setup had an empty half and a back button wrapping: a matchup panel with both portraits,
   and buttons that never wrap.
4. The replay rebuilt a fresh game behind the results on the way back; the finished game now waits,
   hidden, behind its replay. "Show me" was blocked after a failed try, just when it is offered.

### Deviations and gaps

- **Exactly five and the 1994 player.** It thinks in Freestyle terms, so under Exactly five it may
  steer for a line that becomes six; its fives and blocks are checked against Fivefold's rules.
- **Ranked ladder games keep Read the board off**, as the prompt says; practice games against the
  same opponents allow it, and take-backs, and count for nothing.
- **The tie at the 360th stone** stays in the port (the reference games need it) but not in
  Fivefold's rules: a five with the last stone wins, and a full board is a draw.
- **The illegal-corner bug** is reproduced in the port and caught in play.
- **The daily pool** holds 200 puzzles in a seeded order; after that the same order comes
  round again.
