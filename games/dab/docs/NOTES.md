# Double Cross — notes

Prompt 08 (dab), wave 2, no kit ownership. Dev port 5287, Hall suites on 5307. Started and
finished 2026-10-02; hero frames approved by the owner the same day.

## Sources studied

| Source (read-only, outside the repository) | What it settled                                                            |
| ------------------------------------------ | -------------------------------------------------------------------------- |
| `BSDGames-master/dab/algor.cc`             | The computer: its order of choices, the closures it counts, its randomness |
| `BSDGames-master/dab/board.cc`, `box.cc`   | Moves, closing boxes, the edge numbering of a box                          |
| `BSDGames-master/dab/main.cc`, `player.cc` | Board size, players, games in a row, scores and totals                     |
| `BSDGames-master/dab/random.cc`, `test.cc` | The randomiser, and what the test program tests                            |
| `BSDGames-master/dab/human.cc`, `dab.6`    | Keys, cursor, options, author, the book the manual points to               |

**Year: 2003.** Every source file carries "Copyright (c) 2003 The NetBSD Foundation, Inc." and says
the code was contributed by Christos Zoulas (`algor.cc` L4–8); the first check-ins are dated
2003-12-26 to 2003-12-28 (`$NetBSD$` lines). The manual page is "Copyright (c) 2003 Thomas
Klausner" (`dab.6` L3).

## Verified behaviour of the original

Each point from prompt §1 and §2, checked against the source. Where the prompt and the source
differ, the source wins and the difference is noted.

- **The game.** A turn draws one border; whoever draws the fourth border of a box scores it and
  moves again (`dab.6` L40–45; `board.cc` `domove` L113–150 returns the boxes closed, and
  `player.cc` L74–94 keeps the turn while it is above zero). The game ends when no border is left
  (`board.cc` L152–161). Verified.
- **Board size.** Default 3 × 3 (`main.cc` L137–139); one argument makes a square board; two give x
  then y (`main.cc` L145–147), as the manual's synopsis says (`dab.6` L38, `xdim [ydim]`).
  **Correction:** the program's own usage line prints `[<ydim> [<xdim>]]` (`main.cc` L64), the
  other way round. Any size the terminal can show; Double Cross's Custom mode keeps "any x × y"
  within 2–10.
- **Players.** `-p` picks computer or human for each side, default `ch` (`main.cc` L109, L122–124,
  L157–173): **the computer is the first player and moves first** (`play`, `main.cc` L76–85 starts
  with player 0). `-p cc` lets the computer play itself; `-n` plays that many games in a row
  (L126–128, L182–186), and `-w` waits for a key between them. Scores, running totals, games won
  and ties are kept per player (`player.cc` `wl` L63–68) and posted after each game
  (`main.cc` L87–103). Verified.
- **The computer's order of choices** (`algor.cc` `play` L296–314):
  1. take the largest closure available (`find_max_closure` L133–155, which closes every closure on
     a scratch board and keeps the biggest);
  2. otherwise draw a border that gives no box away (`find_good_turn`), trying a box's sides in a
     random order "to randomize the game" (comment at L169–170);
  3. otherwise give away as few boxes as it can (`find_min_closure` L278–293 over three passes of
     `find_min_closure1` L240–273).
- **It never plays the double cross.** Verified: step 1 runs before anything else, so whenever a
  box can be taken the computer takes it, and it takes every box of a chain to the end. Declining
  the last two boxes is never considered. **New hook, not in the prompt:** right after step 1 sits
  an unfinished block, `#ifdef notyet` / `find_single()` / `find_double()` (`algor.cc` L300–303),
  functions that exist nowhere in the source. The author left room for counting singles and
  doubles and never came back to it. It is the perfect line for ABOUT.
- **Its randomness.** `RANDOM` hands out a permutation of 0…n−1 using `lrand48`, and every new
  `RANDOM` reseeds with `srand48(time(NULL))` (constructor `random.cc` L50–55 calls `clear`,
  L62–67). So within one second every fresh permutation is the same: the "random" order repeats
  move after move. Ported exactly (`src/engine/rand48.ts`, tested against a BigInt reference of
  the 48-bit generator), with the clock passed in so tests and the Daily Board are repeatable.
- **Quirk kept.** `find_min_closure1` tries its bad turns one after another on the same scratch
  board without resetting it (`algor.cc` L244–265), so later trials are judged on a board already
  changed by earlier ones. Greedy Gus keeps this.
- **The random player.** **Correction:** there is no random player. `test.cc` is "Test program for
  randomizer" (L40): it prints permutations from `RANDOM rd(10)` (L52). Scribbler, the random
  opponent, is ours.
- **Keys** (`dab.6` L47–75, `human.cc` L60–110): `h` `j` `k` `l` move two half-steps (box to box),
  `y` `u` `b` `n` move one diagonal half-step to switch between the rows of horizontal and vertical
  borders, space draws, `q` quits, `CTRL-L`/`CTRL-R` redraw. The cursor starts on the top-left
  border (`human.cc` L53–54). Double Cross keeps the vi keys alongside the arrows.
- **The book.** The manual's SEE ALSO is Elwyn R. Berlekamp, _The Dots and Boxes Game:
  Sophisticated Child's Play_, A K Peters, 2000 (`dab.6` L103–109). Verified.

## Other corrections to the prompt

- **"The 1990s computer" and "the Berkeley computer"** (§1 pitch and teaser): dab was written in
  2003 for NetBSD, not at Berkeley. Proposed teaser ending: "The computer that shipped with NetBSD
  never figured that out. You will." The year in the manifest is 2003.
- **The words "double cross".** In Berlekamp's book the player who declines the last two boxes makes
  a _double-dealing_ move, and the opponent's reply, taking both with one line, is the
  _double-cross_. The prompt uses "the double cross" for the whole moment, as most players do. The
  game does too (the banner, the achievement, the share line), and the tutorial is worded so that
  both readings hold: "leave the pair: the coach takes both with one line, the double cross, and has
  to open the bottom chain for you". To be confirmed by the owner.

## The advertising clause

The dab sources carry the four-clause NetBSD Foundation licence. Clause 3: "All advertising
materials mentioning features or use of this software must display the following acknowledgement:
This product includes software developed by the NetBSD Foundation, Inc. and its contributors."

How Double Cross complies:

1. **The notice.** `LICENSES/BSD-NetBSD-Foundation.txt` already holds the full notice, and
   `LICENSES/README.md` already maps `dab` to it; the manual page's own licence (Thomas Klausner) is
   `LICENSES/BSD-Klausner-dab.txt`. Nothing new is needed in `LICENSES/`.
2. **In the code.** The files that port the original keep the attribution in their headers:
   `src/ai/greedy-gus.ts` (the algorithm) and `src/engine/rand48.ts` (the randomiser).
3. **ABOUT.** `docs/ABOUT.md` (its Acknowledgement section) and the in-game How to play page
   (Where it comes from) carry the acknowledgement word for word, next to the credit to Christos
   Zoulas.
4. **CREDITS.md.** The Double Cross row names both licences and carries the same sentence, as the
   Zoomies row already does for `robots/auto.c`.
5. **Store and share text.** The Hall's catalog teaser and the share line do not mention the
   original's software features, so they need no acknowledgement; if a later teaser does, it gets
   the sentence too.

## Balance targets and simulations

Target (prompt §5): each ladder opponent beats the one before it at least 70 % of the time over
1 000 games on 5 × 5. Measured with `npx tsx scripts/balance.ts 1000` (seeded games, the first move
alternating, 2026-10-02):

| Opponent      | Against       | Wins | Losses | Ties | Win rate | Mean margin | Mean move | Slowest move |
| ------------- | ------------- | ---: | -----: | ---: | -------: | ----------: | --------: | -----------: |
| Greedy Gus    | Scribbler     | 1000 |      0 |    0 |  100.0 % |       23.39 |   0.02 ms |         3 ms |
| Chain Counter | Greedy Gus    |  900 |    100 |    0 |   90.0 % |        6.04 |   1.02 ms |       232 ms |
| Pupil         | Chain Counter |  833 |    167 |    0 |   83.3 % |        5.61 |   0.04 ms |         5 ms |
| Master        | Pupil         |  829 |    171 |    0 |   82.9 % |        8.19 |   0.36 ms |        35 ms |

On 4 × 4 (200 games a pair) the order holds too: 100 %, 97.8 %, 75.3 %, 93.3 %.

Locked: `src/ai/balance.test.ts` replays the first forty games of each pair on 5 × 5 and asks
≥ 70 % of each (runs in about four seconds).

How the numbers were reached, for whoever tunes them next:

- Chain Counter first judged the end of the safe phase with the pieces model (sizes of chains
  alternating to each side): 61.7 % against Gus. A greedy playout of the real endgame (pieces
  re-read after every opening, so joints are seen) lifted it to 74 %; letting it also choose which
  piece to open by the same playout lifted it to 90 %.
- Master at first won only 70.5 % against the Pupil. The cause was a bug, not the idea: when the
  solver ran out of budget mid-search it left lines drawn on the shared scratch position, so the
  fallback reasoned about a different board. The solver now works on a copy; Master went to 87 %,
  then settled at 82.9 % with the solve starting from 32 free lines (always finishing within budget
  on 5 × 5) instead of 34 (often not, at about 50 ms a failed attempt).
- Solver success by free lines on 5 × 5, 20 games, budget 150 000: every attempt from 32 lines down
  finished (32: 9 ms on average, 30: 1 ms); at 34, 6 of 20; above, none.

## Endgame puzzles

Forty, generated by `npx tsx scripts/puzzles.ts` and checked by `src/game/puzzles.test.ts`:

| Board | Hand them back | Give before you must | Choose your gift |
| ----- | -------------: | -------------------: | ---------------: |
| 3 × 3 |              6 |                    2 |                4 |
| 4 × 3 |              4 |                    3 |                5 |
| 4 × 4 |              3 |                    3 |                4 |
| 5 × 4 |              2 |                    2 |                2 |

A position qualifies when the exact solver, trying every line at the top, finds that all of its
best lines give boxes away; the best line that does not (or, with nothing safe left, the line Greedy
Gus would draw) is at least two boxes worse; and all the best lines touch one piece of the board.
The goal shown is the most boxes there are to take, (open + value) / 2.

## Performance

`npx tsx scripts/perf.ts` at 1920 × 1080 on this machine (Chromium, Direct3D):

| Scene                                      | Sidewalk Chalk | Night Neon |
| ------------------------------------------ | -------------: | ---------: |
| Game menu (the board playing itself)       |       60.2 fps |   60.0 fps |
| 7 × 7 against Master, lens on, lines going |       60.1 fps |   59.8 fps |

The slowest frame seen was 33 ms (neon, during a computer move). The ground and the settled ink are
cached layers; only live lines, fills, the lens's glow and the cursor are drawn every frame.

The game's chunk in `pnpm build` is 110.5 KB (37.3 KB gzipped), loaded only when the game opens; it
includes the forty puzzles.

## Decisions log

| Date       | Decision                                                                                      | Why                                                            |
| ---------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 2026-10-02 | Hero frames approved; the owner accepted all four proposals                                   | Owner checkpoint                                               |
| 2026-10-02 | "Double cross" names the whole moment (banner, achievement, share line)                       | As players say it; the tutorial's wording holds in both senses |
| 2026-10-02 | Teaser ends "The computer that shipped with NetBSD never figured that out. You will."         | The original is NetBSD's, 2003, not Berkeley's                 |
| 2026-10-02 | Scribbler draws any free line at random, boxes or not                                         | The original has no random player to copy; the weakest rung    |
| 2026-10-02 | Lines keep the colour of whoever drew them; lines nobody drew (puzzles, Daily) are neutral    | Shows the game's history; neutral lines mark a set position    |
| 2026-10-02 | Chalk inks darkened, pavement lightened, dark rims on white dots                              | 3:1 for every line on every part of the ground                 |
| 2026-10-02 | A double cross is a hand-back of pairs waiting on one line each, not any box left lying about | Scribbler's accidents were being announced as double crosses   |
| 2026-10-02 | Keyboard: aim from a dot and walk; the original's lattice keys kept beside it                 | Every line reachable with the arrows alone                     |

## Open questions

- None blocking. A worker thread for Master would let it search deeper on 6 × 6 and 7 × 7; that
  needs a kit or Hall decision.

## Hero frames

Six frames in `docs/media/hero/` (see its README), staged in `dev/scenes.ts` from real positions:
Greedy Gus plays itself from an empty 5 × 5 board (seed 28) until no safe border is left, which gives
chains of 5, 6 and 5, a loop of 4 and a short chain.

### Critique log, hero frames

1. **First render.** The lens was painted straight onto the canvas and its "hollow" cut through the
   ground to the page behind: opaque cream pipes that hid the board. Labels sat on dots ("loop 4"
   crossed by a line). The cursor was a faint white dash. Neon boxes lost their marks (the cached
   layer drew them at flicker age 0). The score sat off-centre from the board, and the side panel
   had a hole in the middle.
2. **Lens on its own layer**, tabs moved into each chain's first box, the cursor redrawn in the
   mover's colour over a pale halo, neon marks lit, the match moved into the side panel and the
   score centred over the board. New problems: the night lens mixed yellow into the dark board as
   mud; the short chain's dashes merged into a solid band.
3. **Night lens as a tube** (only the outline, blurred and added for glow). Short chains' dashes
   now read as ladder rungs; the double cross showed a scissors glyph sitting on a dot and a cascade
   that read as a solid block.
4. **Short chains get a faint solid outline instead.** The cascade only part-way (two boxes in, the
   third filling); the cut longer, with a pale bed so it reads over a drawn line; scissors bigger
   and pivoting at the rivet; the banner moved to the top. New bug: settled hatching spilled out of
   its box.
5. **Fills clipped to the box** and grown as a rounded square; the cascade's way shown by a dashed
   trail with chevrons. Tutorial review: the board was small, the scissors floated above it before
   any cut, and nothing showed the bottom chain.
6. **Tutorial:** dots may spread wider on tiny boards; the lens outlines the bottom chain of four;
   no scissors before the cut; a score bar for You and the coach; the night pair's tint toned down.
7. **Day lens lightened** to a highlighter rather than mustard.
8. **Chalk sticks** stayed beside the board even when the coach card covered that spot; they now
   move under the board when the interface needs the room.
9. **Sticks dropped** clear of the bottom border. All six frames re-rendered; nothing else found.

### Critique log, the whole game

1. **First walk** (menu, intro, play at 1920, chalk): the menu's board started empty; "You draws
   first"; the 3 × 3 board was small; Scribbler's random line was announced as a double cross.
   Fixed: the menu's board starts a dozen lines in, the grammar, a larger spacing cap, and a strict
   double-cross test (pairs waiting on one line).
2. **Results, puzzle, tutorial, puzzles list**: the results' buttons wrapped; the puzzle list was a
   wall of numbers. A wider results card; every puzzle tile now shows its board in miniature; pages
   sit on a field of dots.
3. **Night Neon at 1920**: good; the locked ladder rungs read oddly ("Win the match before" → "Win
   match 4 first"); the start of play focused the Game menu button. Fixed both.
4. **1280 × 720**: the game menu overflowed. A compact layout for short screens.
5. **Remaining pages at 1280, neon**: How to play's columns were uneven; a 0–9 loss was called
   "Close."; player 2's marks were drawn in player 1's colour; pages ran under the Hall's Pause
   corner. One readable column with board miniatures, the loss line by margin, colours by player,
   pages start 80 px down.
6. **A live double cross by the Pupil**: banner, cut and flash all right; the cascade's trail showed
   through the pair handed back, which is not the controller's run. The trail now shows only while
   the player who kept control is taking.

## Gotchas

- Scripts run with `tsx` that drive Playwright must pass `page.evaluate` bodies as strings (named
  inner functions become `__name` calls that do not exist in the page).
- On Windows, Python writes CRLF in text mode; edit scripts open files with `newline=''`.
