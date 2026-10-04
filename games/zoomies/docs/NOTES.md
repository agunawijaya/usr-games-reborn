# Zoomies — notes

Built on 2026-10-01, at the owner's request, directly in one session (no prompt file): a
from-scratch reborn of `robots` that sits in the Hall beside the adopted 3D Robots port, which
stays as it is.

## Sources studied

All read-only, in `E:\Projects\BSDGames\BSDGames-master\robots`.

| File                                        | What we learned                                                                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `robots.h`                                  | Field 60×23 inside the border (59×22 playable), forty robot slots, ten points a robot, the 600 bonus   |
| `main.c`                                    | The options, including `-r` (real time) and the two hidden experiments chosen by the score file's name |
| `make_level.c`, `rnd_pos.c`, `init_field.c` | Robots placed at random first, then the player, any empty square, next to a robot or not               |
| `move.c`                                    | `get_move`, the step check (`do_move`, `eaten`), `must_telep`, running, the pattern experiment         |
| `move_robs.c`                               | Robots step by the sign of the distance; the catch is checked before heaps; the wait bonus             |
| `play_level.c`                              | The advance bonus and the wait bonus, paid only on a cleared level                                     |
| `auto.c`                                    | The automatic player, its distance, screen check, closest robot and heap, and the "between" geometry   |
| `score.c`                                   | The shared score file, five scores a user, automatic games marked as such                              |
| `robots.6.in`                               | Authors, commands and the manual's account of waiting and teleporting                                  |
| `Makefrag`, `Makefile.bsd`                  | The hidden experiments are compiled in the Linux bsd-games build (`-DFANCY`), not in NetBSD's          |

## Verified behaviour of the original

- The code is copyright 1980 (the manual page 1991, `auto.c` 1999). Our manifest says 1980. — read
  the headers.
- A turn: the player moves, then every robot steps by the sign of the distance on both axes, all at
  once; a robot on the player's square is a catch even if others arrive with it; two robots on a
  square, or one on a heap, become a heap. — `move_robs.c`.
- Robots per level: `min(level × 10, 40)`. From level 4 on, every level is the same. — `make_level.c`.
- Teleporting picks random squares until one is empty; it does not avoid robots. — `rnd_pos.c`.
- Every command except `w` is refused if it would get the player eaten, and a step onto a robot or
  heap is refused too. `>` waits while safe; `w` waits to the end and pays one point (10% of a
  robot) per robot that dies meanwhile, only if the level is cleared. — `move.c`, `play_level.c`.
- Starting at level 4 (`-a`) pays 600 for clearing that first level. — `play_level.c`.
- `-r` (real time) moves the robots every three seconds whether or not the player moves; it is not in
  the manual's list of options. — `main.c`, `move_robs.c`.
- **Hidden experiments.** When the score file is named `stand_still`, the game plays itself: wait
  while safe, teleport the moment a robot is adjacent. Named `pattern_roll`, it runs as far as it
  can in Y, H, B, J, N, L, U, K order, round and round. Both hand the last robot to the human, and
  both start another game automatically until one of theirs sets a new record. — `main.c`
  (`another`), `move.c` (`get_move`, `must_telep`).
- **The automatic player's ghosts.** `closest_robot` walks all forty slots, including scrapped
  robots (row set to −1) and unused ones (column 0). `distance` subtracts absolute values, so a
  scrapped robot counts as standing on the top row in its last column. Near the top edge the
  player runs from robots that are gone. — `auto.c`; locked in `rivals.test.ts`.
- **The automatic player's corners.** `find_moves` reads the curses screen and treats any `+` next to
  a square as a robot; the border's four corners are drawn with `+`, so the corner squares always
  look deadly. — `auto.c`, `init_field.c`; locked in `rivals.test.ts`.
- **The automatic player's line.** `move_between` computes the slope with integer division and adds
  `slope × robot.y` as the constant (it should be `robot.y − slope × robot.x`). In practice the
  first branch can never be reached for an adjacent robot, and the second gives a direction that
  has little to do with the heap. — `auto.c`.
- Automatic games are written to the shared score file with a flag and listed as the automatic
  player's. — `score.c`.

## Balance targets and simulations

### The rival ladder over Long Nights

`tsx games/zoomies/scripts/sim-rivals.ts 60` (60 seeded nights each, the original's rules):

| Rival                 | Median score | Range   | Median waves cleared | Most waves |
| --------------------- | ------------ | ------- | -------------------- | ---------- |
| Mochi                 | 300          | 0–1,190 | 2                    | 4          |
| Pip                   | 500          | 0–2,340 | 2                    | 7          |
| Professor             | 650          | 0–3,620 | 3                    | 10         |
| Professor, glasses on | 910          | 0–3,880 | 3                    | 11         |

The ladder climbs in the intended order. `rivals.test.ts` locks that the patched Professor's median
over 15 nights is above Mochi's.

### The house

Rooms were searched by `scripts/search-rooms.ts`: a layout is kept if the solver proves a par in
the blueprint's range, the napping strategy cannot clear it without a zoom, the patched Professor
cannot match par, and a careless player (random safe steps, `scripts/random-player.ts`, 60 tries)
wins a share of games within the room's `ease` band. `scripts/difficulty.ts 300` and
`scripts/house-report.ts` give:

| Room             | Par | Solver nodes | Careless player wins | Mochi         | Pip          | Professor    | Glasses on   |
| ---------------- | --- | ------------ | -------------------- | ------------- | ------------ | ------------ | ------------ |
| The hallway      | 4   | 35           | 87%                  | 5 (1 zoom)    | caught t24   | 5            | 5            |
| The kitchen      | 6   | 695          | 64%                  | 58 (16 zooms) | 12 (2 zooms) | 15 (3 zooms) | 8 (1 zoom)   |
| The living room  | 9   | 611          | 66%                  | caught t4     | 6 (1 zoom)   | 9            | 26 (2 zooms) |
| The laundry      | 7   | 462          | 63%                  | 10 (5 zooms)  | caught t3    | caught t8    | 14 (3 zooms) |
| The study        | 8   | 1,740        | 55%                  | 17 (3 zooms)  | caught t6    | 10           | 10           |
| The bathroom     | 6   | 302          | 72%                  | 13 (4 zooms)  | caught t23   | caught t86   | 7            |
| The bedroom      | 8   | 968          | 62%                  | 24 (5 zooms)  | 26 (3 zooms) | 36 (5 zooms) | 9            |
| The playroom     | 10  | 2,608        | 58%                  | caught t6     | caught t5    | 10           | 12           |
| The garage       | 16  | 14,104       | 42%                  | 13 (2 zooms)  | caught t5    | caught t13   | still going  |
| The conservatory | 19  | 86,240       | 25%                  | caught t13    | caught t26   | caught t23   | caught t22   |
| The landing      | 10  | 1,049        | 20%                  | caught t2     | caught t3    | caught t2    | 11           |
| The whole house  | 16  | 44,560       | 31%                  | caught t4     | caught t4    | 28 (3 zooms) | 24 (3 zooms) |

`house.test.ts` proves every par again with the solver (node budget 1,000,000).

### Today's Mess

Weekday plans on a 14×9 room with one of five furniture sets; par between 9 and 16. Over 21
consecutive days from 2026-10-01 the search needed 1 to 34 candidates and 1–94 ms in Node, with pars
of 9 to 15. `house.test.ts` checks determinism and that a fortnight of days all have a room.

### The Pattern Lab

Pip's Y H B J N L U K scores 2,490 over the five lab nights. Of 600 random patterns (one to eight
letters), 242 beat Pip, 113 beat him by half again, 40 more than doubled him and 1 tripled him.
The rare package asks for more than double: about one random pattern in fifteen, and well within
reach of a player who experiments.

## Performance

`scripts/perf.ts` on the workbench at 1920×1080, two seconds of frames:

| Scene                                  | RTX 4060 laptop (D3D11) | Software renderer (SwiftShader) |
| -------------------------------------- | ----------------------- | ------------------------------- |
| Long Night wave 4, idle (40 vacuums)   | 60 fps                  | 48 fps                          |
| Long Night wave 4, loafing (animating) | 60 fps                  | 49 fps                          |
| The whole house at night, loafing      | 60 fps                  | 59 fps                          |
| Game menu with the demo running        | 60 fps                  | —                               |

What made the difference on the slow path: the danger hatching is a cached tile, floor shadows are
cached sprites, glow is skipped on small squares, the window light and night vignette are painted
once per size, and between turns the board redraws at 30 fps (11 fps on the Long Night's field).

## Polish pass (prompt P1-Z, 2026-10-02)

The consolidation review (`docs/media/review/REVIEW.md`) found the cat a speck on big boards, the
room-cleared reveal too quiet, the day trails blobby and the panel untidy. This pass changed
presentation only: `src/engine/` is untouched, and the solver proves every stored par again
(`src/data/house.test.ts`, 55 unit tests in all). The before-and-after frames and the critique
rounds are in [`media/polish/POLISH.md`](media/polish/POLISH.md).

| What                         | Number                                                                                  |
| ---------------------------- | --------------------------------------------------------------------------------------- |
| The cat's height             | 0.695 of its drawing size, drawn at 1.32 squares: about 0.92 of a square                |
| Smallest square (`MIN_CELL`) | 53 px, so the cat is at least 48 px tall at 1280×720 and above                          |
| Rooms that follow the cat    | The Long Night always; at 1280×720 also the whole house (17×11) and the bathroom (19×5) |
| The follow                   | A 140 ms ease towards the cat, instant under reduced motion                             |
| A big floor's pixels         | At most nine megapixels: past that the floor is painted a little softer                 |
| Hatching away from the cat   | A third as strong (0.32) as on the cat's eight neighbours                               |
| The day lane                 | 0.36 of a square wide (was 0.62); the night lane stays 0.62                             |
| The payoff                   | 2.25 s: close-up to 1.45×, hops, stretch and "mrrp" at 0.82 s, trails 1.3–2.15 s        |
| The reduced-motion payoff    | A still of the tangle with the trails, held 0.7 s                                       |
| Frames in the payoff         | 60 fps, p95 16.8 ms, worst frame 16.8 ms at 1920×1080, both looks (136 frames)          |
| Frames on the Long Night     | 60 fps, p95 16.8 ms while the camera follows four turns at 1920×1080                    |

## Decisions log

| Date       | Decision                                                                              | Why                                                                      |
| ---------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 2026-10-01 | A cat and robot vacuums, titled Zoomies; the old Robots stays in the Hall             | Owner approved the pitch                                                 |
| 2026-10-01 | Mochi and Pip play on past the last robot                                             | The original handed it to a human; a rival must finish its game          |
| 2026-10-01 | Rank clears by fewest zooms before fewest turns                                       | A lucky dash should not outrank par                                      |
| 2026-10-01 | Undo everywhere but the Long Night; zooms keep their stream in the state              | Puzzles invite experiments, without rerolling luck                       |
| 2026-10-01 | A lost room is reported only when the player leaves its results                       | An undo takes the loss back, so it should not earn a session             |
| 2026-10-01 | The Long Night's panel sits under the field                                           | 59 columns need the width: squares grow from 16 to 21 pixels at 1280×720 |
| 2026-10-01 | Real-time mode (`-r`) left out                                                        | A timer fights a puzzle; recorded as an open idea                        |
| 2026-10-01 | House rooms are searched against a difficulty band, not taken at the first valid seed | The first search made the first two rooms the hardest                    |
| 2026-10-02 | P1-Z: the owner approved the polish frames                                            | The checkpoint after §5                                                  |
| 2026-10-02 | The Long Night follows the cat too, with edge markers and Whole room (O)              | A 48 px cat leaves about 36 of its 59 columns in view at 1920            |
| 2026-10-02 | Packages earned mid-room are announced with the results                               | The Hall's notes now sit bottom-left, over the floor; none mid-puzzle    |
| 2026-10-02 | The counter, the line and the room's packages change only after the payoff            | The win is seen before it is read                                        |

## Open questions

- A real-time chapter after `-r` (vacuums move every three seconds) could be a later room or a
  Long Night option.
- Hush the Wumpus keeps its room card where the Hall's toasts stack (KNOWN-ISSUES #49); that is
  for its owner, not for Zoomies.
