# Skyloom — notes

Prompt 02. Stage 1 (hero frames) reached its owner checkpoint on 2026-10-01 and the owner approved
the frames and the decisions in the log below the same day. Stage 2 (engine, faithfulness tests,
golden runs, the house controller and the balance simulations) followed, then stages 3–8 (input,
art, modes, sound, the critique loop, Hall integration and these docs) on 2026-10-01 and 02. The
game shipped to the Hall on 2026-10-02.

## Sources studied

| File                                                      | What we learned                                                                                                     |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `atc/update.c`                                            | The order of one tick: launch cleared planes, then for each plane fuel, climb, turn, move, beacon, checks           |
| `atc/input.c`                                             | The command grammar as a table of states, what each command changes and how a command is applied to a plane         |
| `atc/list.c`                                              | Plane lists are kept in plane-number order, not arrival order                                                       |
| `atc/log.c`                                               | How the score list is updated and sorted                                                                            |
| `atc/extern.c`, `atc/def.h`, `atc/struct.h`               | The eight steps (heading 0 is north, clockwise), the low-fuel mark at 15, the plane record                          |
| `atc/main.c`, `atc/graphics.c`                            | The seed, the first plane before the first tick, the update timer, how keys are read                                |
| `atc/grammar.y`, `atc/games/*`, `games/Game_List`         | The arena file format and the fifteen arenas, converted once into `src/arenas/classic.ts`                           |
| `atc/atc.6.in`                                            | What the manual promises, for the verdicts below                                                                    |
| `bsdgames/atc/ports/fancy-web` (the owner's earlier port) | Adopted as Control Room 1986 (`atc-classic`); a cross-check for the engine and the bot later, never a design source |

## Verified behaviour of the original

Read in the source and confirmed by the golden runs below.

- A tick first moves every plane on the ground that has been told to climb into the air list, so it
  moves on the same tick it is cleared.
- Both lists keep planes in plane-number (letter) order, because `append` inserts by number. That
  order decides which plane moves first, and which plane of a colliding pair is named.
- Planes of the first type move only on even ticks; the other type moves every tick. The first type
  is drawn in upper case, so upper-case letters are the slow planes (props) and lower case the jets.
- Each moving plane loses one unit of fuel first; below zero the shift ends at once.
- Altitude changes by one thousand feet per move, before the turn.
- A turn is clamped to two eighths (90°) per move. A reversal is not split evenly: the difference
  is kept between −4 and +4, so a plane told to reverse turns right from north or east and left from
  south or west.
- The circle command sets an out-of-range heading; the turn arithmetic then turns the plane right by
  a quarter turn every move (an eighth when it faces north-west). There is no left circle in the
  code.
- A delayed plane keeps its heading until it reaches its beacon; reaching it clears the delay and
  turns an unmarked plane back to marked. The beacon must lie ahead along the current heading.
- After moving, a plane is checked in this order: its own destination (a runway at 0 ft on the
  runway heading, or its gate at 9 000 ft), the ceiling, the ground (a runway that is not its
  destination, or open country), then the border (another gate, or no gate at all).
- Landed and departed planes are removed before the collision check, so a plane that arrives cannot
  collide on its last tick. Planes waiting on the ground are never checked at all.
- Two planes collide when they are within one cell in both directions and within one thousand feet.
- One plane is added before the first tick. Then, on every tick (odd or even), one chance in the
  arena's `newplane` adds another, drawn with `rand()`; its type, destination and origin come from
  `random()`. On GNU libc both draw from the same generator, so `-r seed` fixes the whole shift. A
  gate is retried while any plane in the air is within four cells and four thousand feet of it; a
  runway is never checked. Fuel at the start is the arena's width plus its height. Letters are
  handed out after the last one used; at most 26 planes fly.
- Turning towards a beacon, gate or runway rounds the direction with the formula in `def.h`
  (`DIR_FROM_DXDY`); `src/engine/geometry.ts` keeps the same arithmetic.
- A key the parser does not expect only rings the bell and is ignored; the line stays open. An
  order's checks run when Enter is pressed, and a failed check refuses the whole line.
- After a line is read, only one part of the plane changes: its altitude if the order changed it,
  else its status, else its heading and delay. The grammar never puts an altitude and a heading in
  one order, so this only matters for an order that changes nothing: it then falls through to the
  heading part and quietly clears a pending “at beacon” delay.
- After a relative turn, `a` is read as “at”, never as the 270° key, because the at-rule comes first
  in that state's table.

## Verdicts on the claims in prompt 02

| Claim                                                                                           | Verdict                                                                                                                                                                                                                 |
| ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The manual says the game cannot be paused, yet `!` opens a shell and stops the clock            | Confirmed: the manual says suspending a game is not permitted; `gettoken` stops the interval timer, forks the user's shell and restarts the timer afterwards                                                            |
| The score list ranks by planes safe, but “you beat your previous score” is decided by time      | Confirmed, and more: an existing entry is replaced only when the new game lasted longer; a new entry is inserted ahead of the first shorter game; the list is then sorted by planes safe, ties by the longer game first |
| The manual promises left and right circles the parser never accepts                             | Confirmed: `cl` and `cr` are documented; the parser's circle rule goes straight to the at-or-Enter state                                                                                                                |
| The game is based on “someone's description” of a game for “some unknown PC … maybe”            | Confirmed, in the manual's last section                                                                                                                                                                                 |
| Jets move every tick, props every other tick; at most a 90° turn per move                       | Confirmed (see above)                                                                                                                                                                                                   |
| Gate arrivals at 7 000 ft avoid planes within 4 cells in every axis; runway arrivals do not     | Confirmed; the 4 includes altitude                                                                                                                                                                                      |
| Exit at exactly 9 000 ft; land at 0 ft on the runway heading; fuel width + height; low below 15 | Confirmed                                                                                                                                                                                                               |
| The listed ways to lose                                                                         | Confirmed; also climbing above 9 000 ft (unreachable by orders, guarded in the code)                                                                                                                                    |
| Altitude wins over heading in one order                                                         | Confirmed as the order of the checks; see above for when it matters                                                                                                                                                     |
| New planes come only on even updates, as a comment says                                         | Refuted: the roll happens on every update                                                                                                                                                                               |
| 15 arenas; 7 s (easy) to 1 s (Killer)                                                           | Confirmed                                                                                                                                                                                                               |
| The manual's default arena says `newplane = 5`; the shipped file says 10                        | Confirmed                                                                                                                                                                                                               |
| `setrelalt` compares with `0`, not `'0'`, so its refusal of a zero change never fires           | Confirmed; `+0` is accepted and, changing nothing, clears any “at beacon” delay                                                                                                                                         |
| `-r seed`: “purpose questionable”                                                               | Confirmed wording; on GNU libc the seed does fix the whole shift. Skyloom gives it a purpose: the Daily Sky                                                                                                             |

## Golden runs

The 1986 code was built on 2026-10-01 inside WSL (Ubuntu, gcc 13.3) in a scratch folder outside the
repository: the original `update.c`, `input.c`, `list.c` and `extern.c`, unchanged, linked with a
small harness that stubs the screen, reads an arena and a script on standard input, types each
order through the original `getcommand`, calls `update` and prints one line of state per tick
(clock, safe count, then every plane's letter, position, altitude, heading and fuel). Lines it
cannot finish (keys the parser rejects) are given up. A Python script runs the harness and reduces
each run to an FNV-1a digest of all its lines, the ticks played, the planes safe and the loss.

`src/engine/trace.ts` plays the same scenario with Skyloom's engine and GNU libc's `random()`
reproduced in `src/engine/glibc-random.ts`. Fifteen runs agree tick for tick
(`src/engine/golden.test.ts`): nine short scripted ones (beacon delays, circles, take-offs,
landings, relative and hard turns, refused orders) and six of 300 ticks each in which the house
controller typed every order (`src/engine/golden-long.json`, from `scripts/bot-orders.ts`): 1 800
ticks, 289 planes safe, on Old Reliable, Seven Fields, Overdrive, Square Dance, Saltire and
Lakeside Hub. Only the digests and the derived numbers are kept.

## Balance targets and simulations

The house controller (`src/engine/bot.ts`) plans a legal route for each plane, a height plan
(climb to leave, glide to land) and flies every plan eight ticks ahead; it settles trouble one
change at a time (height, hold, keeping a departure on the ground), trying both planes of a pair.
In 300-tick runs it never lost a sky on any of the 25 arenas (10–20 seeds each) and flew no
near-misses.

| Target (prompt 02 §9)                                             | Result (200 seeds, `scripts/tune-shifts.ts`) | Locked in                                       |
| ----------------------------------------------------------------- | -------------------------------------------- | ----------------------------------------------- |
| Tutorial arena: the bot survives 100 % of 200 seeds for 300 ticks | 200 / 200 on First Light                     | `src/modes/balance.test.ts` (all 200 seeds)     |
| Shifts: one star on ≥ 90 % of seeds                               | 91–98 % on every shift                       | `src/modes/balance.test.ts` (30 seeds, ≥ 80 %)  |
| Shifts: three stars on 20–40 % of seeds                           | 25–34 % on every shift                       | `src/modes/balance.test.ts` (30 seeds, 10–50 %) |
| Daily Sky: no fast arena on two days in a row                     | Fast arenas only on even daily numbers       | `src/modes/balance.test.ts` (two years of days) |

| Shift                | Arena          | Ticks | One in | Target | Fuel star | ★ (200) | ★★★ (200) |
| -------------------- | -------------- | ----- | ------ | ------ | --------- | ------- | --------- |
| 1 First runway       | First Light    | 60    | 9      | 3      | 0.72      | 94 %    | 28 %      |
| 2 Two exits          | Two Gates      | 60    | 8      | 3      | 0.70      | 93 %    | 28 %      |
| 3 Beacons            | Beacon Row     | 70    | 8      | 4      | 0.72      | 98 %    | 26 %      |
| 4 Props and jets     | Little Field   | 60    | 9      | 3      | 0.67      | 97 %    | 31 %      |
| 5 Two airports       | Two Towns      | 70    | 7      | 4      | 0.74      | 97 %    | 31 %      |
| 6 Crossing lines     | Twin Rivers    | 80    | 7      | 5      | 0.75      | 95 %    | 25 %      |
| 7 Night              | Lantern Coast  | 80    | 7      | 5      | 0.72      | 96 %    | 32 %      |
| 8 Crosswind          | Windsock       | 80    | 7      | 6      | 0.72      | 94 %    | 29 %      |
| 9 Rush hour          | Harbour Lights | 90    | 5      | 9      | 0.71      | 96 %    | 34 %      |
| 10 Low fuel          | Long Reach     | 90    | 7      | 6      | 0.41      | 92 %    | 29 %      |
| 11 Old reliable      | Old Reliable   | 100   | 10     | 5      | 0.72      | 91 %    | 28 %      |
| 12 Tower at midnight | Midnight Tower | 120   | 6      | 12     | 0.73      | 94 %    | 30 %      |

The targets are the controller's tenth percentile of planes safe; the fuel star is its seventieth
percentile of fuel left on arrival (as a share of a full tank). It flies no near-misses, so its
three-star rate is the rate of reaching the target with fuel to spare.

## Clearance puzzles

Par is the fewest clearances the solver in `src/modes/puzzle-solver.ts` finds (one plan per plane as
it appears: a route straight or by a beacon, optionally a new height, and for a plane on the ground a
wait and a height to clear it to). `scripts/puzzle-pars.ts` searches upwards one clearance at a time;
each puzzle stores the plan that proves its par, and `src/modes/puzzles.test.ts` flies every plan and
checks that no cheaper plan exists for the puzzles of par 4 or less.

| Puzzle                 | Planes | Par (was guessed) | Proving plan                                                    |
| ---------------------- | ------ | ----------------- | --------------------------------------------------------------- |
| Head on                | 2      | 2 (2)             | Both routed straight                                            |
| One runway, two planes | 2      | 2 (2)             | Both routed straight                                            |
| Crossroads             | 4      | 5 (4)             | All routed, one sent down to 2 000 ft, one by beacon 0          |
| Both ends              | 3      | 3 (3)             | All routed straight                                             |
| Pearls                 | 4      | 4 (4)             | All routed straight                                             |
| Departures             | 3      | 6 (6)             | Cleared at 3 000 ft three, six and ten ticks apart, then routed |
| Saltire                | 4      | 6 (4)             | All routed, two at new heights, one by beacon 0                 |
| Change of wind         | 3      | 4 (5)             | Two routed, the departure cleared at once and routed            |
| Old reliable           | 5      | 6 (8)             | All routed, one by beacon 0, the departure cleared at once      |

The whole search takes about 7 s; a route cache made a flight 0.13 ms instead of 3.4 ms. The house
controller (re-planning every tick) also brings every puzzle home.

## Performance

Measured on 2026-10-02 in Chromium at 1920 × 1080 (device pixel ratio 1, GPU on) with all 26 letters
in the air on Overdrive: drawing a frame of the radar takes 0.6–0.7 ms flat and 2.4 ms with Altitude
Tilt (the average of 60 draws, both looks); animation frames held at 60 Hz with the worst frame at
16.8 ms. The house controller takes 11–190 ms for a 300-tick shift once its route cache is warm
(Node 22, laptop); the unit tests run in about 35 s, most of it the balance sample.

## Hero frames (stage 1)

Live scenes drawn by the game's own play screen, radar and cards, staged from `dev/scenes.ts` and
rendered by `e2e/hero.spec.ts` at 1920 × 1080 into `docs/media/hero/`, in both looks:

| Frame      | Scene                                                                                                                         |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `rush`     | Shift 9, Rush hour, on Harbour Lights: twelve flights in the air, two waiting, k6 and B6 two ticks from a loss, a route drawn |
| `tilt`     | The same sky held in Altitude Tilt: shelves for every thousand feet, shadows, drop lines, routes as ribbons                   |
| `pearls`   | Twin Rivers a moment after the third landing in a row, tilted and leaning in on the two finals                                |
| `loss`     | Nobody answered the ring: the engine runs the rush on until k and B lose separation, and the card replays tick 214            |
| `tapestry` | Shift complete: the shift woven as a tapestry, with its stars and the logbook page                                            |

Run them with the workbench on port 5273: `pnpm --filter @usr-games/game-atc dev` in one terminal,
then `pnpm exec playwright test -c games/atc --grep @hero` (or `HERO_SCENE=pearls` for one scene).
Any scene can be opened live at `http://localhost:5273/?scene=rush&look=scope&live=1`.

### Critique rounds

| Round | Looked at               | Found                                                                                                                      | Changed                                                                                                          |
| ----- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 1     | Rush, both looks        | Land broken into islands; props read as crosses; strip flags covered the numbers; the last strip cut off; dead space aside | Calmer terrain, the chart runs on past the arena under a veil, flags became a band, a ground bay, airfield discs |
| 2     | Rush, both looks        | Prop glyphs still cross-like; no arena name; no sense of the tick passing                                                  | Props got an elliptical wing and a propeller; arena chip and a tick ring in the top bar                          |
| 3     | Tilt, both looks        | The near edge fell off the panel; planes floated far from the ground with no shadows; layer washes greyed the chart        | The camera fits the whole box; plane-shaped soft shadows, drop lines, open shelves and a ruler; washes removed   |
| 4     | Pearls, both looks      | The ripple was too small to notice; gold disappeared on paper; the thread read as a route                                  | Bar lights with a running wave; per-look light colours; the string became landing lights on each final           |
| 5     | Pearls, loss, tapestry  | The moment was tiny in a full frame; replays too small to read; the tapestry looked like a transit map                     | Tilt can lean in on a point (scroll in the tilt view); zoom-aware drawing; the arena's map woven into the cloth  |
| 6     | All ten frames together | Beacon names hidden under routes; the loss mark drained to grey; ground planes in the airborne strips after a loss         | Labels above routes; the loss mark stays in colour; ground planes stay in the bay                                |

## Critique rounds after the hero frames (stages 3–7)

Every screen at 1280 × 720 and 1920 × 1080 in both looks, played through in the workbench and in the
Hall on port 5174.

| Round | Looked at                         | Found                                                                                                                                                   | Changed                                                                                                                                  |
| ----- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Live play: routes, keys, Terminal | The arena name repeated in the bar; airline names cut short on the strips; the title screen black when the canvas was unsized                           | The chip only when it differs; narrower number columns; the radar waits for a size                                                       |
| 2     | Tutorial, puzzles                 | The tutorial froze before its first plane came, and its hint covered that plane; Space ran the clock past a step; puzzles opened empty                  | Both open on their first arrivals; hints move away from their plane and let drags through; steps wait; puzzles stop for each new arrival |
| 3     | Tutorial again                    | The conflict lesson depended on the player's own route and sometimes never came; its rule was misstated                                                 | Two planes timed to meet over the beacon (locked by a test); "more than a cell, or two thousand feet"                                    |
| 4     | Cards, Daily, shift map, settings | Buttons wrapped on the tapestry cards; the Daily page mostly empty; the shift map's route bounced and locked stops looked open                          | The way on above the standard three; map and briefing with quarters and recent days; a flown route and a dashed one ahead                |
| 5     | 1280 × 720, the Hall              | The title menu ran off the bottom; the Hall's Pause covered the bar; the tick ring dropped below its number; the demo at half height and full of labels | A tighter menu at low heights; room for the Hall's button; inline stat values; no host positioning and a compact radar in tiles          |

## Decisions log

| Date       | Decision                                                                                                                                                                                                                           | Why                                                                                                                    |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 2026-10-01 | Canvas 2D for the radar and for Altitude Tilt; no three.js (proposed in [ADR 0001](adr/0001-radar-in-canvas-2d.md))                                                                                                                | The tilt is a pure pitch, so the chart can be copied in strips with exact perspective; nothing to install or lazy-load |
| 2026-10-01 | Upper-case letters are props, lower-case are jets                                                                                                                                                                                  | That is what the original's code does (`name()` and the even-tick rule)                                                |
| 2026-10-01 | "String of pearls" is drawn as landing lights on the planes lined up for the string, on their final                                                                                                                                | The aviation meaning of the phrase; it also shows the order of the next landings                                       |
| 2026-10-01 | In the tilt view the scroll wheel leans in towards the pointer                                                                                                                                                                     | Makes the signature moment readable; flat, the scroll wheel still sets altitude                                        |
| 2026-10-01 | The five extra ideas are carried by the frames where they belong: strips, fictional traffic and the tapestry now; clearance puzzles and the logbook with the modes                                                                 | Owner decision of 2026-10-01 (option A plus five extras)                                                               |
| 2026-10-01 | The owner approved the ten hero frames, Canvas 2D without three.js, the string of pearls as landing lights, scroll-to-lean in the tilt view, and routes to a runway that time their own final descent (Terminal mode stays manual) | Owner checkpoint of stage 1                                                                                            |
| 2026-10-02 | The tutorial has four planes and takes about two minutes, not three planes in ninety seconds                                                                                                                                       | A conflict that does not depend on the player's route needs two planes of its own                                      |
| 2026-10-02 | A near-miss is two planes within two cells and 1 000 ft, or one cell and 2 000 ft, that never lose separation; it costs a shift's calm star                                                                                        | Closes the open question; no separate near-miss meter, the ring already warns in every mode                            |
| 2026-10-02 | Puzzles stop the clock for each new arrival, and every order counts as a clearance                                                                                                                                                 | Planning is the puzzle; the solver counts the same way                                                                 |
| 2026-10-02 | Packages earned in the air install when they happen                                                                                                                                                                                | The moment is the reward                                                                                               |
| 2026-10-02 | The six manifest controls follow the Hall's key bindings; the original's command letters stay fixed                                                                                                                                | Remapping is a Hall promise; the command letters are the game's language                                               |
| 2026-10-02 | Arenas are typed data, not a parsed text format ([ADR 0002](adr/0002-arena-data.md))                                                                                                                                               | Checked by the compiler and a validator, bundled, no parser to keep in step                                            |

## Open questions

- Should players be able to import arena files of their own? Not planned; ADR 0002 leaves the door
  open.
- The Hall's Machine Room tiles are 2 : 1 and most arenas about 3 : 2, so the demo shows country on
  either side of the sky; a lean-in like the poster's would fill the tile but hide the gates.
