# Full Pockets — notes

Prompt 05 (snake), wave 1, no kit ownership. Dev port 5276. Started 2026-10-02.

## Sources studied

| Source (read-only, outside the repository) | What it settled                                                                 |
| ------------------------------------------ | ------------------------------------------------------------------------------- |
| `BSDGames-master/snake/snake/snake.c`      | Every rule below: board, placement, turn order, `chase()`, capture, warp, peek  |
| `BSDGames-master/snake/snake/snake.6.in`   | Keys as documented, the wink's purpose, scores only at the exit, the bonus line |
| `BSDGames-master/snake/snscore/snscore.c`  | How the score file is read back                                                 |

**Year: 1980.** Both `snake.c` and `snscore.c` carry "Copyright (c) 1980, 1993, The Regents of
the University of California"; the manual page is dated 1993. No individual author is named in any
file header, so the credit goes to the Regents.

## Verified behaviour of the original

Each point from prompt §2, checked against the source. Where the prompt and the source differ, the
source wins and the difference is noted.

- **Board.** The field is the screen minus the border (`LINES − 2` by `COLS − 2`: 78 × 22 on an
  80 × 24 terminal); `-w` and `-l` shrink it. An edge under 4 stops the game with a refusal
  (`main`). Verified.
- **Placement.** The door, you, the treasure and the snake's head go on random squares that are
  free and not in the top-left strip (row 0, columns 0–4) kept for the money display (`snrand`).
  **Correction:** the other five segments are not placed on distinct random squares: each is one
  `chase()` step from the one before, taken with zero loot, so the body is a short random walk. It
  can fold onto itself and can start right beside you.
- **Your moves.** **Correction:** you walk in **four** directions only. The "eight keys" are
  `hjkl` and `sefc` (a pad round `d`), plus the arrows, `i`/`m`, space/backspace and Ctrl-P/Ctrl-N.
  Diagonals belong to the snake alone. A move into the wall still spends the turn (the snake moves).
- **Counts and jumps.** Digits set a repeat count; `.` repeats the last command with the same
  count; `HJKL`/`SEFC` walk to the treasure's column or row and `ATPB` to the four edges, one step
  at a time with the snake answering each step (`mainloop`). Verified.
- **Turn order.** You step; if you landed on the treasure, you pick it up and **the snake does not
  move that turn** (the loop's `continue`); if you reached the door, you leave; otherwise the snake
  takes its step. Warping and peeking cost no snake move either.
- **Treasure.** `loot += 25` a pickup; the pockets show `chunk × (loot − penalty) / 25` in whole
  numbers (`cashvalue`). The new treasure avoids the door, the strip and you. Verified.
- **The hyperbola.** `chunk = 675 / (edge + 6) + 2.5` on the shorter edge, raised to at least 12,
  plus 2 for the border: $25 at the default size, verified. **Note:** the source's comment promises
  "$99/shot" on a 4 × 4 board, but the floor of 12 makes every short edge up to 12 pay $36; the
  comment predates the floor. The 3 × 3 remark (an infinite-money game) is the reason for the
  minimum edge of 4.
- **The snake's step (`chase`).** Exactly as the prompt says, with details: the aim is the direction
  of largest cosine (first index on a tie, north when the head is on you); weights are `loot/10` for
  the aim and 1 for the others, plus `loot/20` for the direction it took last time; borders, the
  treasure and the door are forbidden; a 10-bit random number modulo the total picks. With empty
  pockets the aim weighs 0: the snake never heads straight for a new player. Verified.
- **A crash in the original.** If every weight is 0 (the aimed square is the only way out and the
  loot is under 10), the modulo divides by zero. Full Pockets lets the snake take the aimed step.
- **Capture.** After the snake moves, you are caught if any segment is on you **or** you stand on
  the square the tail just left (`pushsnake`'s `tmp`): stepping onto the tail is caught too.
  Verified.
- **The lottery.** The digit is `cashvalue % 10` and the roll `((random() >> 8) & 255) % 10`.
  **Correction 1:** the roll is not a fair 1 in 10: 0–5 come up 26 times in 256, 6–9 25 times.
  **Correction 2:** a match does **not** refund the warp penalties. It subtracts the penalty from
  the loot and resets it, so the pockets show the same value; the reward is the escape itself (and a
  slightly calmer snake, since boldness follows loot). In debt the digit is negative in C, so only a
  debt that is a multiple of ten can ever be saved.
- **Warp.** `penalty += loot / 10` (a tenth of the gross loot, not of the pockets), and you land on
  a random free square, possibly right beside the snake. Ten warps without a pickup take you to
  zero, the eleventh into debt. Verified.
- **Peek.** Arrows along your own column toward the treasure's row when it is within
  `width / 12` columns, else along your row when within `height / 7` rows; otherwise the same for
  the door; otherwise a `?` flash. On boards narrower than 12 or shorter than 7 those fractions
  round to zero and peeking never shows anything. Verified.
- **Exit and scores.** Only a run that leaves by the door scores; the score file keeps each user's
  best and the champion (`post`). Caught, the manual says, is worth nothing. Verified.
- **The wink.** On capture the snake's face appears; it winks only if the pockets beat your best.
  **Quirk:** `post()` returns "yes" at once for user ids 0 and 1 (root and daemon, who can never
  record a score) and when the score file could not be opened, so the snake **always winks at
  root**. Full Pockets' hidden root achievement will nod to both rules.
- **snscore.** It reads the champion's two numbers in the opposite order from how `post` wrote them
  (it never prints them, so nothing shows), and compares one entry past the end of its list.

## Decisions

| Date       | Decision                                                                                                    | Why                                                                                                                                    |
| ---------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-02 | Canvas 2D for the garden, HTML/SVG for the interface ([ADR 0001](adr/0001-canvas-2d.md))                    | A still board with a few moving things; crisp, accessible text                                                                         |
| 2026-10-02 | Classic keeps four-way walking; runs walk in eight directions                                               | Classic is "the original rules"; §4 asks for eight directions everywhere else                                                          |
| 2026-10-02 | A bump into a wall or hedge costs no turn                                                                   | §4; the original spent the turn                                                                                                        |
| 2026-10-02 | The capture roll keeps the original's 26/25 bias and its no-refund fold                                     | Kept on purpose; the dial says "about one chance in ten" and nothing is staked                                                         |
| 2026-10-02 | Hero chambers are 18 × 11                                                                                   | 78-pixel squares at 1920 × 1080 (47 at 1280 × 720) keep the snake and explorer readable                                                |
| 2026-10-02 | Runs keep a ledger of glints; Classic keeps the original's `cashvalue`                                      | Each chamber pays its own rate; a warp costs a tenth of everything picked up, as before                                                |
| 2026-10-02 | The way down narrows: 18 × 11, then 16 × 10 (2–4), then 14 × 9 (5–10)                                       | Deeper chambers were bigger and safer; the bots proved it                                                                              |
| 2026-10-02 | Lily pools in every chamber below the first (two, then three)                                               | The snake's double stroke is the danger that tells; the bolder snake alone is predictable                                              |
| 2026-10-02 | A sleeping snake is never laid across the only way through                                                  | The bots found a chamber whose door and glint lay behind a sleeping snake                                                              |
| 2026-10-02 | The snake's weights never go below zero                                                                     | A Lucky Break in debt leaves negative loot; the original's draw misbehaved                                                             |
| 2026-10-02 | No "stay put" key                                                                                           | The original has none; walking into a wall was its only wait, and bumps here are free                                                  |
| 2026-10-02 | In a run, peek reaches 6 columns or 3 rows (the original on its 78 × 22 board); Classic keeps the fractions | On a run's 18-wide chambers a twelfth of the width is one column: peeking would never help                                             |
| 2026-10-02 | B and D choose at a door, though B is also a diagonal step                                                  | The door card takes the keys while it shows; the step is the original's key                                                            |
| 2026-10-02 | The kit's simulation row for snake changed to 3–10 minutes with a daily                                     | `scripts/catalog.test.ts` requires the model to match the manifest once the catalog line flips; only that row changed (see the report) |

## The engine and the run (stage 2)

Pure TypeScript in `src/engine/`, seeded with the kit's RNG and tested in `rules.test.ts` and
`run.test.ts` (one test per rule of §2 and per chamber rule).

- **Runs.** Ten chambers (five for the Daily Run): the open lawn first, the hedges second, then a
  per-run shuffle of pools, corridors, twin glints, the sleeping snake, the mirror chamber and
  repeats. Chamber `n` pays `chunk × (1 + 0.2 (n − 1))` a glint and adds `10 (n − 1)` loot of
  appetite to the snake's boldness; your loot and pockets come down with you.
- **Fair starts.** In a run the snake's head starts at least seven squares from you and no segment
  closer than six, and the first chamber has no pools, so no three steps can be forced into
  capture (checked for 365 Daily Runs). Classic keeps the original's careless layout.
- **Daily fairness.** Each chamber is laid out from the seed and its depth alone; how you played the
  chamber before never changes the next one.
- **The strike preview's numbers** are the exact chances of the ten-bit draw, folded remainders
  included; `risk.ts` turns them into the capture risk of each of your steps (both strokes of a
  swim included), which the bots play by.

## Balance (bots, 1000 seeds)

`npx tsx games/snake/scripts/balance.ts 1000`; locked in `src/bots/bots.test.ts`.

| Bot      | Plays                                                                                 | Result                                                                                              |
| -------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Cautious | Two glints, then the door; banks; warps at a 20 % risk; avoids the head               | **Banks in chamber 1 in 99.9 % of runs** (target ≥ 95 %); median haul 72                            |
| Greedy   | `8 + depth / 2` glints a chamber, always deeper; shortcuts past the snake (risk × 30) | **Reaches chamber 5 in 46.2 %** (target 30–50 %); chamber 3: 83.8 %; chamber 10: 4.2 %; banks 1.8 % |

Capture rate per chamber for the greedy bot, by depth: 2 % · 15 % · 21 % · 26 % · 29 % · 31 % ·
29 % · 40 % · 60 % · 63 %. Lucky Breaks saved it 110 times in 1000 runs.

Tuning history: with the deeper chambers larger and no pools, the greedy bot reached chamber 5 in
85 % of runs; capture rates showed the pools (14 %) and the timid snake of the first lawn (5 %) were
the only real dangers, while a bold snake that beelines is easy to lead round in circles. Narrowing
the way down and spreading the pools brought it to 46 %.

## Stages 3–8: the game

- **Screens**: game menu (the garden playing itself behind it), run map card, play (top bar, side
  panel, strike preview, peek arrows, mouse walk preview), door card, warp confirmation, capture
  (coil, spill, the wink, the Lucky Break dial), vault and results, records, how to play, settings.
  The Hall draws the pause button and menu; its one game item is the strike preview.
- **Critique rounds on the real game** (1920 × 1080 and 1280 × 720, both looks): (1) staging scripts
  pressed keys before cards appeared; (2) cards covered the coil, so they now stand on the far side
  of the board from you; the wink card said "best haul of 0" with no record; spilled glints flew out
  of the chamber; (3) after a capture the scene sprang back to normal, so the coil and spilled
  satchel now stay; the primary button's key cap vanished in the Moon Garden; (4) at 1280 × 720 the
  pockets overlapped the chamber's name and the side panel and menu ran off the bottom: short
  screens now fold the extras away; (5) peeking never helped in a run (decision above); the
  boldness meter dropped to 0 % mid-capture and is now held.
- **Emblem**: three rounds; the first read as a download arrow, the second as a key ring. The last
  is a coil round a cut gem with a raised head, an eye and a forked tongue.
- **Performance**: 60 fps at 1920 × 1080 on the game menu's attract garden and while walking with
  the strike preview on, in both looks (`scripts/perf.ts`, RTX-class laptop GPU). The ground is
  painted once per chamber.
- **Poster**: the snake coiled round a heap of glints, winking; checked on the Hall's game page in
  Console Home, light and dark.

## Tests (final)

| Suite                        | Count | Result |
| ---------------------------- | ----- | ------ |
| Engine and run unit tests    | 33    | pass   |
| Balance (1000 seeds per bot) | 2     | pass   |
| Gameplay on the workbench    | 10    | pass   |
| Inside the Hall              | 6     | pass   |
| Hero frames, screenshots     | 8 + 4 | saved  |

## Hero frames: critique log

Eight frames in [`media/hero/`](media/hero/README.md), 1920 × 1080, light (Sun Garden) and dark
(Moon Garden), all live: the real renderer and interface on staged rounds (`dev/scenes.ts`).

1. **Round 1.** Characters far too small on a 24 × 14 board; flagstones like bathroom tiles; flat
   hedges; confetti weeds; square-block lanterns; a door that looked like a coin. Rebuilt the ground
   (organic stones, moss in the joints, ivy, planters), scaled every sprite, new lanterns, an iron
   and brass vault door with a gem keystone.
2. **Round 2.** Stroking a union of squares drew every square's edge (rings on the hedges, grid
   lines in the pools); joints too dark. Edges now come from masks; joints lighter; chambers 18 × 11.
3. **Round 3.** Snake head and frill too timid; spill glints had no motion; the coil was a tight
   donut; the bank stream went straight up. Bigger head and crown, streaks and a burst, a wider coil.
4. **Round 4.** Added the top bar, the boldness meter, the side panel, the Lucky Break dial and the
   vault card. The coil hid the snake's head behind the explorer; the pour did not read; the panel
   had a hole in the middle.
5. **Round 5.** Head drawn over the explorer; the satchel held out over the vault with glints
   falling into its glow; the sulking snake looks away and huffs; keys legend in the panel.
6. **Round 6.** The wink happened on the hidden eye; it now winks with the outer one. The bank's
   satchel moved above the splash so it reads in both looks.

## Owner checkpoint

Hero frames approved on 2026-10-02 ("setuju, lanjut"), with the decisions above: Classic walks
four ways and runs eight; the Lucky Break keeps the original's bias and its no-refund fold.
