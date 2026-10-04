# Figurehead — notes

Built in one session on 2026-10-04, at the owner's request ("ok, setuju. langsung dibangun saja")
after approving the pitch for a from-scratch `sail` reborn: the life of one ship, prizes taken
whole, captains made from her officers, scars that stay. No prompt file; workbench port 5320,
the in-Hall suites on 5321.

## Sources studied

| File                                  | What we learned                                                                                              |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `sail/globals.c`                      | The wind-effect, rigging, hull, ammunition, hit, quality and melee tables; the ship table; the 32 scenarios  |
| `sail/game.c`                         | Allowance by heading (`maxmove`) and turns (`maxturns`)                                                      |
| `sail/pl_3.c`, `pl_5.c`, `pl_6.c`     | The player's broadside, grapples, helm checking, boarding parties, loading and repairs                       |
| `sail/dr_1.c` … `dr_5.c`, `dr_main.c` | The driver: turn order, weather, computer gunnery, boarding, melee, grapples, prize revolts, the helm search |
| `sail/assorted.c`                     | Applying a broadside's hits; striking colours, sinking and fire                                              |
| `sail/misc.c`, `parties.c`            | Range, bearings, arcs; boarding-party bookkeeping                                                            |
| `sail/sail.6`                         | The manual: the intent where the code disagrees                                                              |
| `games/sail/app/src/engine/*.js`      | Broadside's port, read as a cross-check; its ADR 004 fixes carried over                                      |

## Verified behaviour of the original

- The wind decides speed by the angle between heading and wind: best on the quarter, one square
  less before the wind and on the beam, one or two close-hauled, none in the wind's eye; each mast
  shot away costs a square — read in `maxmove`, pinned by tests T-05 to T-10.
- A turn costs a square, two turns in a row are refused, two runs in a row are refused, and after
  two turns without headway a ship drifts a square downwind (small ships on even turns) — read in
  `acceptmove` and `step`, pinned by T-08 and T-09.
- The computer's ships never reload: double shot alongside every turn, chain at a ship under full
  sail within three squares — read in `compcombat`, pinned by T-15.
- A broadside's hits come from a table chosen by the aim (hull or rigging), the broadside's
  weight, the range, a rake, crew quality and a die; a six on the hull table with five hull hits
  shoots away the steering — `assorted.c`, pinned by T-12 to T-14.
- A ship strikes when her hull reaches nothing; one in three then sinks and one in three burns
  and later blows up, damaging ships within three squares — `strike`, `checkup`, T-18 and T-19.
- Boarding: grapnels hold one time in three against an enemy; defenders fight at double strength;
  the boarders' first section stays aboard as prize crew; prisoners who outnumber the prize crew
  six to one take the ship back — `fightitout`, `prizecheck`, T-20 and T-22.
- The angle routine is slightly off (zero vector reads as west); kept and pinned.

## Balance targets and simulations

Bots: `gunner` (the sailing master, aiming at hulls), `seaman` (aiming high to take ships whole),
`computer` (the original's own captain sailing her, with its never-reloading guns, as a
yardstick), `idle` (drifts). Report from `pnpm --filter @usr-games/game-figurehead sim 60`,
2026-10-04, 60 seeds per row (win % / her ship taken or lost % / turns):

| Chapter | Encounter | idle         | computer     | gunner       | seaman       |
| ------- | --------- | ------------ | ------------ | ------------ | ------------ |
| 0       | maiden    | 0 / 0 / 13   | 100 / 0 / 7  | 100 / 0 / 6  | 95 / 0 / 9   |
| 1       | chase     | 0 / 0 / 11   | 2 / 0 / 11   | 72 / 0 / 9   | 75 / 0 / 9   |
| 1       | duel      | 0 / 7 / 15   | 93 / 3 / 14  | 75 / 0 / 18  | 62 / 3 / 20  |
| 2       | convoy    | 20 / 33 / 9  | 88 / 12 / 11 | 68 / 13 / 12 | 80 / 12 / 10 |
| 2       | pair      | 0 / 8 / 17   | 88 / 10 / 17 | 88 / 2 / 17  | 87 / 2 / 22  |
| 3       | duel      | 0 / 2 / 17   | 97 / 0 / 13  | 67 / 0 / 17  | 50 / 2 / 18  |
| 3       | storm     | 0 / 7 / 17   | 97 / 2 / 15  | 82 / 0 / 18  | 58 / 3 / 19  |
| 4       | chase     | 0 / 0 / 11   | 0 / 0 / 11   | 70 / 0 / 11  | 87 / 0 / 9   |
| 4       | convoy    | 25 / 33 / 10 | 92 / 7 / 11  | 87 / 2 / 12  | 92 / 2 / 11  |
| 5       | squadron  | 5 / 5 / 21   | 75 / 20 / 19 | 70 / 7 / 24  | 60 / 13 / 28 |
| 6       | night     | 0 / 15 / 15  | 73 / 25 / 15 | 72 / 3 / 17  | 28 / 25 / 18 |
| 6       | pair      | 0 / 13 / 19  | 80 / 13 / 19 | 77 / 5 / 21  | 67 / 7 / 24  |
| 7       | storm     | 0 / 27 / 16  | 90 / 3 / 17  | 68 / 5 / 18  | 47 / 10 / 16 |
| 7       | chase     | 0 / 0 / 11   | 7 / 0 / 12   | 68 / 2 / 10  | 85 / 0 / 9   |
| 8       | line      | 10 / 0 / 19  | 72 / 25 / 17 | 72 / 15 / 21 | 72 / 13 / 21 |
| 9       | convoy    | 18 / 35 / 10 | 73 / 23 / 12 | 77 / 10 / 12 | 75 / 17 / 12 |
| 9       | duel      | 0 / 22 / 15  | 58 / 40 / 14 | 55 / 22 / 15 | 13 / 58 / 16 |
| 10      | fleet     | 7 / 0 / 22   | 55 / 38 / 24 | 55 / 20 / 30 | 55 / 17 / 33 |
| 11      | passage   | 0 / 0 / 11   | 0 / 0 / 11   | 93 / 0 / 15  | 93 / 0 / 15  |

The cutting-out (pressure 2): idle 0 %, computer 50 %, gunner 70 %, seaman 60 %. Today's
Weather over 60 days: gunner wins 83 %.

Whole lives, 30 seeds, choosing the chapters' options in turn:

| Bot    | Renown | Ships lost per life | Squadron at the end | Elite crew | Endings                               |
| ------ | ------ | ------------------- | ------------------- | ---------- | ------------------------------------- |
| gunner | 601    | 0.20                | 1.4                 | 67 %       | school 18, harbour 6, gate 5, quiet 1 |
| seaman | 577    | 0.87                | 0.9                 | 10 %       | gate 18, harbour 8, school 3, quiet 1 |

What the numbers say: a plain, careful captain wins most actions (55–100 %) and seldom loses her
(about one life in five sees a hull lost); drifting wins nothing and a convoy left alone mostly
fails; late actions are hard but winnable; taking ships whole is the harder road, as it should
be. The first runs were far off (the chase could not be won, the convoy won itself, enemies were
crack crews from chapter three); the fixes were a laden raider started close aboard with chain
on the right side, raiders ahead of the convoy, enemy crews by stage (green, steady, steady,
crack), smaller second ships in the two-against-one, and the yield rule.

| Target                                           | Result (60 seeds)                   | Locked in (`src/bots/balance.test.ts`, 16 seeds) |
| ------------------------------------------------ | ----------------------------------- | ------------------------------------------------ |
| The maiden cruise is won by anyone who fights    | gunner 100 %, idle 0 %              | ≥ 85 %, idle 0                                   |
| Early duel and chase won more often than not     | 75 %, 72 %                          | ≥ 50 % each                                      |
| A convoy needs its escort                        | idle 25 %, gunner 87 % (pressure 1) | idle ≤ 45 %, gunner ≥ 55 %                       |
| Late actions winnable with a seasoned crew       | line 72 %, fleet 55 %               | ≥ 45 %, ≥ 35 %                                   |
| The cutting-out and the passage                  | 70 %, 93 %                          | ≥ 40 %, ≥ 80 %                                   |
| A life reaches its epilogue and seldom loses her | 0.2 hulls lost per life             | 6 lives: every one ends, ≤ 4 hulls lost in all   |

## Performance

The chart redraws on demand and while anything moves (camera, film, flags); a frame is a few
hundred canvas calls (grid, ripples, up to ten ships). Each turn's reach search tries a few
hundred helm strings for the player and one enemy. The sim plays the 19 encounters × 4 bots ×
60 seeds plus 60 lives in under a minute in Node.

## Decisions log

| Date       | Decision                                                                                       | Why                                                            |
| ---------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 2026-10-04 | Build a second interpretation of `sail`, native, beside Broadside                              | The owner approved the pitch and asked to build it directly    |
| 2026-10-04 | An invented sea and three invented flags                                                       | Room for a story of our own; Broadside keeps the history       |
| 2026-10-04 | A yield rule: dismasted, or few hands, or hull badly holed with hands thinned; no sinking roll | Taking ships whole must be possible without boarding every one |
| 2026-10-04 | No retries in the Voyage; defeat leads to a cutting-out or a new hull                          | It is her life; losing is a chapter, never the end             |
| 2026-10-04 | A hurricane ends the action instead of sinking every ship                                      | A life should not end on the weather's die                     |
| 2026-10-04 | The sailing master's advice is on by default                                                   | Teach the wind and the rake by showing                         |

## Open questions

- Should the helm also take the original's `b` (back) order? Left out: the dots cover it.
- A night-fighting mode for Today's Weather in the night look only?
