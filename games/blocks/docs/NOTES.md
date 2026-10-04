# Sinkers — working notes

Prompt 06, wave 2. **Status: shipped (2026-10-02).** The hero frames and the seven decisions below
were approved by the owner at the checkpoint; stages 2–8 followed.

## Sources read

This section is the provenance: the only place outside `CREDITS.md` where the original program's
name appears.

`E:\Projects\BSDGames\BSDGames-master\tetris\` (read-only, outside the repo): `tetris.c` (cited
below as **main**), `tetris.h` (**header**), `tetris.6.in` (**manual**), and `shapes.c`, `input.c`,
`screen.c`, `scores.c`, `scores.h`. BSD licence; copyright "1992, 1993 The Regents of the University
of California", code "derived from software contributed to Berkeley by Chris Torek and Darren F.
Provine". The main file's first comment calls it "Tetris (or however it is spelled)" (main:44).
Nothing from these files is copied into the repo. The rules are re-implemented in `src/engine/`
with attribution to follow in `LICENSES/` and `CREDITS.md` at the end.

## Verified facts about the original

| What          | Where                                                      | Verified                                                                                                                                                                                                                                                          |
| ------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Year          | `main:4`, `manual:35`                                      | Copyright 1992, 1993; the manual is dated May 31, 1993. **The manifest's year 1992 is right.**                                                                                                                                                                    |
| Origin        | `manual:151–152`                                           | The manual's authors section: Torek and Provine adapted it from a winning entry of the 1989 International Obfuscated C Code Contest.                                                                                                                              |
| Manual credit | `manual:154–155`                                           | The manual grew from the contest entry's own notes, credited to Nancy L. Tinkham with Darren F. Provine.                                                                                                                                                          |
| Preview       | `manual:97, 157`; `main:163–164`                           | `-p` turns the preview on; "added by Hubert Feyrer in 1999".                                                                                                                                                                                                      |
| The board     | `header:54–56, 66–67`; `main:88–97`                        | 12 × 23 cells. Play area: columns 1–10, rows 1–20. The side columns and the two bottom rows are set solid; row 0 is a hidden row above the well.                                                                                                                  |
| Spawn         | `main:208, 242`                                            | Row 1, column 5 of the board (`A_FIRST*B_COLS + B_COLS/2 - 1`): the shape's top cells start in the hidden row.                                                                                                                                                    |
| Random shapes | `header:131`; `main:209–210`                               | `random() % 7`, no bag. The next shape is drawn _before_ the current one.                                                                                                                                                                                         |
| Turning       | `main:279–283`; `shapes.c:56–74`                           | One direction only: each of the 19 forms names the form it turns into (counter-clockwise on screen). The turn happens only if the new form fits where it is: no kick, no second try.                                                                              |
| Pivot         | `shapes.c:56–74`                                           | Forms are three offsets round a centre cell. The square's centre is its bottom-right cell and it turns into itself. The long one has a cell two away from the centre ("sticks out", `shapes.c:62, 74`), so it wobbles: lying it covers x−1…x+2, standing y−1…y+2. |
| Collision     | `shapes.c:82–92`                                           | A form fits if the centre and its three offsets are all empty.                                                                                                                                                                                                    |
| Landing       | `main:223–245`                                             | When the tick finds no room below: `score++`, then rows are cleared, then the next shape spawns. Game over when a new shape does not fit at spawn.                                                                                                                |
| Drop          | `main:291–297`                                             | Moves the shape to the bottom, `score++` for every row. It is **not** locked: it lands at the next tick, and may still be slid or turned until then.                                                                                                              |
| Rows          | `main:103–125`                                             | A full row is blanked, shown, and the game sleeps one fall period; then everything above moves down, shown, and another sleep. Keys typed during those sleeps are read and thrown away (`input.c:121–131`). Clearing rows scores nothing.                         |
| Speed         | `main:134, 157, 180`; `header:146–147`; `input.c:146–152`  | Level 1–9 (default 2); `fallrate = 1000000 / level` microseconds; every time a tick runs out, `fallrate -= fallrate / 3000`. Keys do not restart the tick.                                                                                                        |
| Final score   | `main:309`; `manual:125`                                   | Points × level ("…points on level 3 gives you a score of 600").                                                                                                                                                                                                   |
| High scores   | `scores.h:47–49`; `scores.c:66, 271–342`; `manual:126–134` | 80 entries in all, at most 9 per person (one per level), expired after 5 years — except each level's top score, kept for good.                                                                                                                                    |
| Keys          | `manual:57–86`                                             | Six keys in order, default `jkl pq` (left, turn, right, drop, pause, quit), remappable with `-k`.                                                                                                                                                                 |

### Hook verdicts (prompt §1)

- **IOCCC beginnings:** confirmed (`manual:151`). The "or however it is spelled" shrug is the
  main file's first comment (main:44, quoted above).
- **Rows score nothing:** confirmed. Points come only from landing (1) and dropping (1 a row), times
  the level at the end. The manual's own tip — dropping "is therefore a good way to increase your
  score" — is at `manual:120`.
- **Counter-clockwise only:** confirmed; the preview came in 1999 (Feyrer), seven years after 1992.
- **A hair faster every tick, forever:** confirmed in the code (`fallrate / 3000` per tick); the
  "unplayable without a fast terminal connection" line is under BUGS at `manual:149`.
  Correction to the hook: it doesn't speed up _forever_ in effect — integer division stops it once
  `fallrate` drops below 3000 µs, which no one reaches.
- **Champions kept for generations:** confirmed (`manual:131–134`, `scores.c:66`).
- **New finding worth a line in ABOUT:** each cleared row froze the game for two fall periods and ate
  any key pressed meanwhile.

## The engine

- `src/engine/forms.ts` — the 19 forms, re-expressed as offsets round a centre in our own order
  and names, with both turning directions (the right turn is the inverse of the left).
- `src/engine/game.ts` — one engine, two rule sets:
  - **Classic** (10 × 20): exactly the original's scoring, speed curve, left turns only with no
    kick, uniform draws (next drawn first), a dropped shape movable until the tick, rows for
    nothing.
  - **Standard** (11 × 18): both turns with a one-cell nudge, plunge (lands at once), landing =
    depth bonus (1–3) × level, plunge = rows × 2 × level, bursts 10/30/60/100 × depth combo ×
    level; currents, coral and seaweed for the dives; Marathon's climb (a level every ten rows, to
    15).
- `src/engine/bot.ts` — the house diver (ADR 0003): every turn and slide, steering through
  currents, scored with the six-feature evaluation plus a reward for coral.

### Simulation (Standard, level 3, 300 sinkers a run, 20 runs per style, always plunging)

| Diver style    | Rows a run | Points a run | Topped out | Bursts 1/2/3/4 rows | Combo cashed: median / p90 / max |
| -------------- | ---------- | ------------ | ---------- | ------------------- | -------------------------------- |
| tidy (default) | 107        | 43,656       | 0 of 20    | 1541 / 280 / 13 / 0 | ×3 / ×6 / ×15                    |
| keeps a well   | 84         | 41,192       | 11 of 20   | 304 / 523 / 99 / 8  | ×4 / ×12 / ×22                   |

### Dives: the diver against the stars (40 seeded dives each, `src/dives/dives.test.ts`)

Thresholds were set from 60 other seeded dives per tank (second star at about the 45th percentile
of the diver's scores or sinkers, third at about the 75th), then checked here. Prompt target: at
least 90 % one star, 15–35 % three stars.

| Dive              | One star | Three stars | Stars 2 / 3 (score, or most sinkers) |
| ----------------- | -------- | ----------- | ------------------------------------ |
| 1. Shallows       | 100 %    | 28 %        | 1240 / 1350                          |
| 2. Coral Garden   | 100 %    | 25 %        | 11 / 7                               |
| 3. The Drift      | 100 %    | 18 %        | 2300 / 2560                          |
| 4. Kelp Forest    | 100 %    | 20 %        | 3160 / 3390                          |
| 5. Deep Plunge    | 100 %    | 15 %        | 6500 / 6920                          |
| 6. Crosscurrents  | 100 %    | 20 %        | 3550 / 3880                          |
| 7. Night Dive     | 100 %    | 15 %        | 5310 / 5680                          |
| 8. Reef Wall      | 100 %    | 25 %        | 26 / 13                              |
| 9. Riptide        | 100 %    | 23 %        | 4210 / 4720                          |
| 10. Fast Water    | 100 %    | 35 %        | 14180 / 15230                        |
| 11. Sunken Garden | 100 %    | 20 %        | 9 / 5                                |
| 12. The Trench    | 100 %    | 25 %        | 12 / 8                               |

Before the diver learned to steer through currents (it planned at the top and plunged), it won
Crosscurrents 46 times in 60 and Riptide only 7; a player who slides back after each push does
what the diver now does. The diver knows nothing of time, so Fast Water's level 8 and the Night
Dive's dark cost it nothing; for people they do, which is why those stars are about score.

### Daily Dive

100 sinkers at level 3; par is the diver's score on the day's plan (13,731 on 2026-10-02, 14,334
on 2026-10-04). In real time a sinker sinks a little before most plunges, so a person scores a
little less per plunge than the diver: the bubbles start at half of par.

### Tests

57 unit tests (engine 27, dives 14, modes 12, words 4), 7 workbench browser tests
(`e2e/game.spec.ts`), 6 in the Hall (`e2e/hall.spec.ts`), 3 frame-rate tests.

### Frame rate

`e2e/perf.spec.ts`, the busiest tank (Sunken Garden's coral, seaweed and current under a built
stack, a falling sinker with sonar, a four-row burst every 2.6 s) at 1920 × 1080: mean 16.7 ms
(60 fps), 95th percentile ≤ 16.8 ms, by day, by night and as a night dive.

## Hero frames

`docs/media/hero/`, 1920 × 1080, both looks, rendered by `e2e/hero.spec.ts` from the workbench
(`dev/scenes.ts`). Every cell drawn comes from a game the house diver really played; staging only
picks the moment.

| Scene            | Files                                       | The moment                                                                                                                                                                                                    |
| ---------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mid-dive         | `dive-sunlit.webp`, `dive-abyss.webp`       | A sinker three rows into the water, lined up over its spot; the dotted sonar footprint below with a ping half-way down.                                                                                       |
| The 4-row burst  | `burst-sunlit.webp`, `burst-abyss.webp`     | A long one plunged into the open column: 0.46 s in, the rows turning into bubbles from the walls inwards, the column rising, light blooming, the score's bubbles (100 · ×8 combo · ×3 level) on their way up. |
| Title            | `title-sunlit.webp`, `title-abyss.webp`     | The game menu over the attract tank, the diver playing.                                                                                                                                                       |
| Close-up (check) | `closeup-sunlit.webp`, `closeup-abyss.webp` | Not a hero frame: the sinkers drawn large, to judge their anatomy.                                                                                                                                            |

All six live scenes hold 60 fps at 1920 × 1080 (median 16.7 ms, 95th percentile ≤ 16.8 ms, both
looks).

### Critique log

1. **First render.** Bar showed _Depth combo ×50_: the combo as specified never ends if a player
   always plunges. The new sinker poked out over the tank's rim. The burst was caught after the rows
   had gone, the stack mid-drop. The long one's glyph (three dots in a row) read as "…". At close
   range the square was a single rounded square: a single-colour brick, exactly what we must not
   draw.
2. **Pebbles, not bricks.** The outline now pinches in wherever two pebbles meet along a side, so a
   cluster reads as fused pebbles (the square became a four-lobed cushion, the long one a string of
   beads). New long-one glyph: three little bubbles. Combo rethought (decision 1). The dive frame
   now catches the sinker in the water. The score became bubbles that carry its factors.
3. **Air above the water.** The tank gained a band of air above the surface (the original's hidden
   row): a new sinker is lowered in and may stand out of the water at first, inside the glass. The
   crack was made visible; bubbles sped up; the score bubbles were too small to read at 1080p
   ("combo" was 8 px) — enlarged.
4. **The crack.** The rows were greying into a grid of flat tiles — dull, and grid-like. Now the
   sinkers in the rows light up still fused, crack, and break pebble by pebble from the walls in.
   Fish passing behind the tank read as things in play — they are now faint behind the glass. The
   crack's length grows with the rows (0.45 s for one, 0.75 s for four).
5. **Density and light.** The column was sparse and lost in the night bloom: bubbles larger and
   more of them, the bloom softer by night. The burst was staged under four rows of hanging stack,
   so the bubbles fought the clusters: the scene now picks the burst with the least above it. Found
   and fixed a real drawing bug: two pebbles of one sinker left touching only at a corner (after a
   burst) broke the outline tracer; such pieces are now drawn apart.
6. **Bubbles that rise.** Breaking pebbles were pale grey discs: each now becomes a big bubble,
   draining its colour, rising as it swells and pops. Bubbles are clear in the middle and bright at
   the rim (the next-shape bubble had turned into a grey plate). The sonar got a ping — a dotted arc
   that runs down from the sinker to its footprint every 1.6 s (not drawn with reduced motion), so
   the eye finds the footprint at once.

Remaining, for later stages: the title could use a small flourish by the wordmark; the sonar
footprint is faint in Abyss Glow by design but should be checked with players; check 1280 × 720.

## Decisions (approved by the owner, 2026-10-02)

1. **The depth combo is cashed in by a burst.** The prompt defines it as plunges in a row without a
   soft landing and multiplies bursts by it. Taken literally it grows without end (the diver reached
   ×58 in 120 sinkers), which turns score into run length squared, and makes "depth-combo-5" and the
   share line's "deepest combo ×7" trivial. So the combo still counts plunges since the last
   soft landing, but **a burst cashes it in and it starts over**. It then measures how much you build
   before letting rows go: median ×3–4, ninety per cent of bursts at ×6–12, best seen ×22. "Deepest
   combo" is the biggest one cashed.
2. **The tank has air above the water** (one row and a bit): the original's hidden row made
   visible. New sinkers are lowered in through it.
3. **A burst holds the next sinker** for its crack and the drop of what was above it: 0.73 s for one
   row up to 1.03 s for four (the original froze two fall periods per row). Classic 1992 copies
   the original's two beats per row instead.
4. **Sonar = dotted footprint + a ping.** The footprint follows the prompt (a thin dotted outline,
   never a copy); the ping is our addition.
5. **The score shown as factor bubbles** (rows' worth, ×combo, ×level) that pop one by one at the
   surface, leaving the total floating above the tank.
6. **Standard landing and plunge points are multiplied by the level** (the prompt gives the base
   values only), so all of Standard scales with level the way Classic's final score does.
7. **Shape identity by glyph**: wave, chevron, ring, four-point star, spiral, cross, three bubbles;
   colour is depth only (shallow mint → deep magenta in Sunlit Tank; cyan → magenta glow in Abyss
   Glow).

## After the checkpoint

- **Resting.** A Standard sinker that cannot go down waits half a second before it settles; a slide
  or a turn starts that wait again, up to 15 times. Without it, level 8 was unplayable by hand. The
  tutorial, where nothing sinks on its own, still settles a resting sinker after the wait.
- **P pauses.** The Hall pauses on Escape; P (the 1992 key) asks for the same pause by sending an
  Escape key event, since the kit has no call for it (kit candidate `requestPause`).
- **Coral and seaweed floors are filled from the floor up** with no row starting full, so every
  dive can be cleared; a test holds every floor to it.
- **The daily's par is cached per seed** in the page (it costs about 50 ms to compute).

### Screen critique log (1280 × 720 and 1920 × 1080, both looks)

1. **First pass over every screen.** The keys hint sat over the tank's bottom rows: moved to the
   bottom left, clear of the tank. The Daily Dive page was a line of text in an empty page: it now
   shows the day's first eight sinkers in bubbles and the three bubble scores, with the button at
   the top. A burst's total floated over the tank's rim: lifted above it.
2. **Pages.** The dive tiles' previews were flat dots: they are drawn now with the game's own
   coral, seaweed and currents, tall enough to show every current. How to play gained the seven
   sinkers with their glyphs, so a new player learns the marks before the first dive.
3. **Play, night and results in both looks** checked again after the changes; coral reads as coral
   at a glance (matte, knobbly, dotted with polyps), currents as moving water, the night dive's tank
   as dark water with a pool of light.
