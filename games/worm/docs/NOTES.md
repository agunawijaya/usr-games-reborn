# Noodle Nine — notes

Prompt 04. Stage 1 (hero frames) reached its owner checkpoint on 2026-10-02 and was approved the
same day, together with every decision below. Stages 2 to 8 followed: the engine and its tests, the
fill solver and the puzzles, the house noodle's balance runs, the screens, the art pass in both
looks, sound, the critique rounds and the Hall.

## Sources studied

| File (read-only, outside the repo) | What we learned                                                                                      |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `worm/worm.c`                      | Every rule: the box, the starting worm, the order of a move, the score, the dash, the timer, the win |
| `worm/worm.6`                      | What the manual promises, for the verdicts below; the optional starting length                       |

`worm.c` says it was written by Michael Toy at UCSC and carries the Regents' copyright of 1980 (and
1993); the manual page carries 1989 and 1993. The manifest's year, 1980, is taken from `worm.c`.

## Verified behaviour of the original

All read in `worm.c`; the rules marked ✓ are locked by `src/engine/game.test.ts`.

- **The box.** The window under the title line has a border of `*`; the open box inside it is the
  screen less three rows and three columns (77 × 21 on an 80 × 24 terminal). ✓ (layout)
- **The starting worm** is 7 cells behind the head unless a length is given (and given values out
  of range fall back to 7). The head sits a few columns from the left on the middle row; the body is
  laid out to the left, and if it reaches the left edge it folds down a row and runs back right. ✓
- **It waits.** No timer is set until the first key, so the worm does not move until you press
  something. ✓
- **A move**, in this order: if there is no growth left to use, the tail cell is cleared;
  otherwise one unit of growth is used and the tail stays. Then the cell ahead is read from the
  screen: a digit is eaten, anything else that is not blank ends the game. Then the head moves in. ✓
- **Chasing your tail is legal** when not growing (the tail has already left), and fatal while
  growing (it has not). ✓
- **The score** goes up, at each bite, by the whole growth still to come after adding the digit,
  not by the digit. A 9 then a 5 two moves later scores 9 + 12, because 7 of the 9 were still to
  grow. ✓
- **Growth** is exactly the digit, one cell a move from the tail. ✓
- **One digit at a time**, value 1–9 chosen before its place; the place is drawn at random until a
  blank cell is found. Each draw uses two `rand()` calls summed.
- **The timer.** After every move the game asks for an alarm in one second; when it fires, the last
  direction is repeated. A movement key moves at once and resets the second.
- **Other keys stall the worm.** Any other key cancels the pending alarm and sets a new one-second
  alarm without moving, so tapping such a key faster than once a second keeps the worm still. Not
  in the manual; not kept (see the changes).
- **Reversing bites your neck.** A key opposite to the way you are going moves the head into the
  body: the game ends. With the starting worm lying to the left of the head, pressing left as your
  first key ends the game at once. Not kept: Noodle Nine refuses the reverse with a soft bump. ✓
- **The dash.** `H` and `L` move one cell and then eight more, `J` and `K` one and then four more,
  with no pause between steps and no keys read meanwhile; eating a digit stops the dash. ✓
- **The win.** When a digit is eaten and the worm (with its new head) would cover every cell of the
  box, the game says you won. It is checked only at a bite; since the digit always takes a free
  cell, a full box can only happen at one. ✓ (Noodle Nine counts a box filled after any move, which
  is the same while digits remain and lets fill puzzles end when their last digit is gone.)
- **The end.** Hitting the border or the body ends the game with the score; the score is shown on
  the title line at the top right.
- `Ctrl-L` redraws the screen.

### Verdicts on the hooks in prompt 04

| Claim                                                                                        | Verdict                                                                                             |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Left alone the worm creeps one cell a second; a key press moves it at once                   | Confirmed, with two additions: it does not move at all until the first key, and other keys stall it |
| The score adds the whole pending growth at each bite (9 then a quick 5 is worth more than 5) | Confirmed: 9 then 5 two moves later is 9 + 12                                                       |
| Filling the box shows a win almost nobody saw                                                | Confirmed; checked only at a bite                                                                   |
| HJKL dash several cells and stop early at a digit; the manual's 9 and 5 count the first step | Confirmed: 1 + 8 across, 1 + 4 up or down                                                           |
| One digit at a time, on a random empty cell                                                  | Confirmed                                                                                           |
| Ends on the border or itself                                                                 | Confirmed; reversing into the neck counts as itself                                                 |
| Score top right                                                                              | Confirmed                                                                                           |
| `inspiredBy.year: 1980`                                                                      | Kept: `worm.c` carries the Regents' copyright of 1980                                               |

## Hero frames (stage 1)

Live scenes drawn by the game's own engine, house noodle and renderer, staged from `dev/scenes.ts`
and rendered by `e2e/hero.spec.ts` at 1920 × 1080 into `docs/media/hero/`, in both looks (Garden
Bed by day, Glow Soil by night). Staging only chooses the moment and, for the chain, where three
digits land; the noodle's shape is its own play, picked as the shapeliest of several seeds.

| Frame    | Scene                                                                                                                                             |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `garden` | Garden 6, The Root Cellar, at Rush tempo: three bites in a row, the third popping up as `+30` with **chain ×3**, a rainbow running down the body  |
| `fill`   | Fill puzzle 7, The Snail Shell, the moment the box is full: the coiled body turns into a rainbow mosaic and a ring of light spreads from the head |
| `title`  | The game menu over the attract garden, the house noodle at play, eyeing its next number                                                           |
| `bonk`   | Bonus: the loss, kindly. The noodle runs into a rock, sees stars, its eyes swirl and its colour drains from the head back                         |

Run them with the workbench on port 5275: `pnpm --filter @usr-games/game-worm dev` in one terminal,
then `pnpm exec playwright test -c games/worm --grep @hero` (or `HERO_SCENE=fill` for one scene).
Any scene can be opened live at `http://localhost:5275/?scene=garden&look=glow&live=1`.

### Critique rounds

| Round | Looked at             | Found                                                                                                                                                                                                         | Changed                                                                                                                                                                                                                        |
| ----- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1     | All three, both looks | The noodle read as a thin pink hose lapping the top wall; its face tiny and under the popup; roots like tan letters; a mostly empty bed                                                                       | Smaller gardens with bigger cells; a thicker, shaded tube; staging that searches for a shapely moment                                                                                                                          |
| 2     | Garden, fill          | Gloss beaded into dots; the popup on the body; tunnel mouths hidden under the noodle; the mosaic read as a tile board with a maze line                                                                        | Popups float into open soil; rims drawn over a noodle in a tunnel; the mosaic became the rainbow noodle itself                                                                                                                 |
| 3     | Garden, title         | Gloss became a neon centre line; dim roots looked like grey worms; the attract noodle a straight run; mud like soap bubbles                                                                                   | Gloss on the lit side; roots braided from thin strands; the title searches for a curly moment                                                                                                                                  |
| 4     | Garden, title         | Gloss kinked at corners; bulges invisible; the noodle small in a big attract bed                                                                                                                              | A continuous diagonal gloss; bigger bulges; a smaller attract garden; darker night mud                                                                                                                                         |
| 5     | Fill, title           | Giant cells blew up the grass into the sky; the ripple not visible                                                                                                                                            | Scenery keeps its own scale; a ring of light sweeps out from the head                                                                                                                                                          |
| 6     | Bonk (new), fill      | The bonk small and against the wall, stars tiny, the impact already gone; mushrooms like letter T                                                                                                             | Staged into a rock in the open at the moment of impact; bigger stars; domed glowing toadstools                                                                                                                                 |
| 7     | All four, both looks  | Holds up: the noodle reads as a cute worm at a glance in both looks, the chain and the filled box read as the two big moments                                                                                 | —                                                                                                                                                                                                                              |
| 8     | Owner review          | Rejected: head and tail did not look attached. The head was a ball wider than the tube, the tail a short spike, and a body in a tunnel was cut into capped pieces with the head in a ring beside its own tail | One tube from end to end: the head barely fuller and easing in, a long soft taper to the tail; a body in a tunnel runs into one mouth and out of the other, the mouths drawn over it; a close-up check scene, `?scene=anatomy` |
| 9     | Anatomy close-up      | The saddle a round stain; the inside of every bend creased into a sharp L; the tail tip a thin stick                                                                                                          | The saddle is a band from ring to ring; bends are quarter circles; the tail narrows all the way to a blunt tip                                                                                                                 |
| 10    | All four, both looks  | The garden noodle a knot of pressed coils; its head by the wall; juice and popup over the face; mud like a clutch of brown eggs                                                                               | Staging rules out tunnel passages, a head against its own coils or a wall, and avoids pressed coils; juice splashes from under the head; popups keep clear of landmarks; mud is one puddle                                     |
| 11    | Title, mud            | The attract noodle half under the menu's wash; a puddle spilling over the box's rim; a first puddle redesign looked like a tray                                                                               | The title keeps the noodle out of the wash; puddles stay inside the box; an organic puddle with one reflection                                                                                                                 |
| 12    | All four, both looks  | Holds up: one creature in every frame, its head and tail plainly its two ends                                                                                                                                 | —                                                                                                                                                                                                                              |

## Decisions approved at the checkpoint

| Decision                                                                                                 | Why                                                                                    |
| -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Canvas 2D, no WebGL ([ADR 0001](adr/0001-garden-in-canvas-2d.md))                                        | A 300-cell noodle is a few dozen strokes a layer; the soil is painted once             |
| Gardens are smaller than the original box (22 × 12 for a mid-campaign garden; Endless keeps an open box) | Bigger cells make the noodle and its face readable; 77 × 21 would make it a thread     |
| A reverse into the neck is a soft bump, not a loss                                                       | Prompt §4; the original ended the game                                                 |
| Other keys do not stall the worm, not even in Classic tempo                                              | An unintended freeze; Classic keeps the one-second creep and the instant moves         |
| A box counts as filled after any move                                                                    | Same as the original while digits remain; lets fill puzzles end after their last digit |
| Roots are drawn as braided strands; rocks are mossy stones; mud and tunnels as shown                     | Each reads as itself and none looks like the noodle                                    |
| The digits are lobed number-fruit (as many lobes as the value) with the numeral on them                  | Shape, size, colour and numeral all tell the value apart                               |

## Open questions, settled while building the gardens

- **Roots that grow back** (prompt §3.3). Built as proposed: running into a root does not end the
  run; the noodle chews through it. A mouthful ends a dash and starts the chain over, and the root
  grows back `ROOT_REGROW` (10) moves after the tail has left its cell, closing the shortcut. Roots
  stand in the way of a chain, never of the noodle. **The table at the checkpoint called roots
  obstacles; chewing through them is the open question's proposal, built. To raise with the owner.**
- **Mud that slows.** Built as proposed, with one more rule: a dash stops on entering mud; while
  the head is in mud the noodle creeps half as fast and cannot be pushed past one move every
  340 ms; a turn pressed meanwhile waits for the mud to let go.

## Stage 2: the engine

`src/engine/game.ts` keeps the 1980 order of a move and adds only what the gardens need:

| Addition                                                       | Where it shows                                                              |
| -------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Roots chewed open and growing back                             | Garden 2 on; the `chewed` map, the `chewed` and `regrew` events             |
| Mud ends a dash                                                | Garden 4 on (the slowness belongs to the session)                           |
| A goal length and the status `grown`                           | Every garden                                                                |
| A range for random digits                                      | Gardens 1, 6, 8 and 10                                                      |
| A fixed run of digits, with or without their cells             | Fill puzzles (with), Counting Row (without), the tutorial (put out by hand) |
| The count-up bonus: 99 points for one to nine in order         | Counting Row                                                                |
| `out-of-numbers`: a fixed run eaten and digested, box not full | Fill puzzles                                                                |
| The body stays whole on a bonk                                 | Everywhere (the original's tail had already moved when the crash was found) |
| No digit on one-way soil or in a tunnel mouth                  | Downstream once dropped a digit where it could never be reached             |

Tests: `src/engine/game.test.ts` (22), `src/gardens/puzzles.test.ts` (32),
`src/gardens/gardens.test.ts` (25) and `src/content.test.ts` (3): 82, in about ten seconds.

## The fill puzzles and their solver

A puzzle is designed backwards from a proof (`scripts/design-puzzles.ts`). A route through every
open cell becomes the noodle's final body. The starting noodle lies along the route's first cells
with a short tail trailing into cells the route reaches only later: the noodle frees those while it
is hungry, then covers them again. The digits go on the route so that the noodle never runs out of
growth before the box is full. The route must fill the box under the game's own rules, and the
solver (`src/engine/solver.ts`) must then find a way on its own. Rock layouts are checked against
the chessboard colouring first: a box whose two colours differ by more than one can never be filled
(three of the first layouts could not).

The solver searches depth first on a compact copy of the rules, undoing moves in place. It prunes a
planned digit that would come up under the body, positions already searched with as many moves
left, a next digit out of reach of the growth to come plus the hungry moves left and, once the tail
can never move again, any position whose free cells are not one connected run with at most one dead
end. With the cap at par it proves each puzzle in at most 35 239 positions.

| #   | Puzzle          | Box    | Cells | Digits | Par | Positions to prove |
| --- | --------------- | ------ | ----- | ------ | --- | ------------------ |
| 1   | First Fill      | 5 × 5  | 25    | 6      | 23  | 29                 |
| 2   | Corner Shop     | 6 × 5  | 30    | 5      | 28  | 28                 |
| 3   | Little Loop     | 6 × 6  | 32    | 6      | 30  | 30                 |
| 4   | The Hallway     | 8 × 5  | 40    | 7      | 37  | 37                 |
| 5   | Stepping Stones | 7 × 6  | 40    | 8      | 38  | 141                |
| 6   | Two Rooms       | 8 × 6  | 43    | 6      | 40  | 51                 |
| 7   | The Snail Shell | 9 × 7  | 63    | 8      | 62  | 62                 |
| 8   | Garden Ring     | 8 × 8  | 60    | 9      | 57  | 58                 |
| 9   | Zigzag          | 9 × 8  | 66    | 10     | 63  | 280                |
| 10  | The Comb        | 10 × 7 | 61    | 8      | 58  | 345                |
| 11  | Courtyard       | 10 × 8 | 74    | 11     | 72  | 290                |
| 12  | Long Table      | 11 × 8 | 81    | 11     | 78  | 35 239             |
| 13  | Crossroads      | 11 × 9 | 83    | 11     | 80  | 108                |
| 14  | Terraces        | 12 × 8 | 84    | 11     | 82  | 105                |
| 15  | The Big Box     | 12 × 9 | 108   | 15     | 105 | 105                |

Stars: one for filling the box, two within a few moves of par (`secondStarMoves`), three at par.
With a few moves of slack the search widens a great deal (puzzles 10–13 do not finish within
400 000 positions at par + 6), so the test proves each puzzle with the cap at par. In play a slip can
be taken back with Z.

## The house noodle's balance runs

`scripts/balance.ts`, 200 runs a garden. The bot never dashes, so its third star comes with every
grown garden and the chain target sets the three-star rate. The prompt's targets: grown on at least
90 % of runs, three stars on 15–35 %. `gardens.test.ts` repeats the first 100 seeds of each.

| #   | Garden          | Goal | Digits | Chain | Grown | 3 stars | Average moves |
| --- | --------------- | ---- | ------ | ----- | ----- | ------- | ------------- |
| 1   | Sunny Patch     | 38   | 2–9    | 3     | 94 %  | 18 %    | 65            |
| 2   | Tangle Roots    | 36   | 1–9    | 3     | 99 %  | 19 %    | 63            |
| 3   | Rabbit Hole     | 40   | 1–9    | 3     | 96 %  | 20 %    | 68            |
| 4   | Mud Pie         | 36   | 1–9    | 3     | 100 % | 19 %    | 67            |
| 5   | Counting Row    | 51   | 1 to 9 | 3     | 96 %  | 16 %    | 102           |
| 6   | The Root Cellar | 54   | 2–9    | 3     | 95 %  | 20 %    | 98            |
| 7   | Night Bed       | 52   | 1–9    | 3     | 92 %  | 17 %    | 126           |
| 8   | Big Bites       | 56   | 5–9    | 3     | 92 %  | 30 %    | 95            |
| 9   | Downstream      | 48   | 1–9    | 3     | 94 %  | 16 %    | 112           |
| 10  | Rock Garden     | 50   | 3–9    | 3     | 92 %  | 17 %    | 107           |
| 11  | Two Burrows     | 52   | 1–9    | 3     | 94 %  | 24 %    | 95            |
| 12  | The Deep End    | 62   | 1–9    | 3     | 93 %  | 17 %    | 232           |

A chain of three is what the numbers ask for in every garden: the bot reaches a chain of two in
about two runs out of three and a chain of four in fewer than one in ten. A player who speeds up for
chains does far better than the bot, which only ever heads for the next digit.

## Performance

`e2e/perf.spec.ts` times frames in the page at 1920 × 1080 with a 300-cell noodle gliding through a
36 × 18 bed, a rainbow pulse running down it and two bulges: **60 fps in both looks, 95th percentile
16.7 ms**. The first renderer (round stamps, a path of thousands of circles per layer, the glow by
`shadowBlur`) managed 7 fps. Strokes in runs of one width, washes laid from a scratch layer, a
quarter-size blurred glow and dropping the in-between points of straight runs brought it to 60.
