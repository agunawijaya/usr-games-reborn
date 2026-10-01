# Lightkeeper — notes

## Sources studied

Read-only, outside the repository, in `E:\Projects\BSDGames\BSDGames-master\trek`.

| File                                                               | What we learned                                                                                    |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `trek.h`, `externs.c`                                              | The data model: quadrants, the sector map, 14 devices, the event list, the per-move bookkeeping    |
| `setup.c`                                                          | Every number by skill and length; the order of the first five events; the tournament seed          |
| `events.c`, `schedule.c`                                           | The resource clock, the event kinds and their delays, the rest interruption                        |
| `attack.c`, `klmove.c`, `compkl.c`                                 | The enemy volley, fatigue, critical hits, casualties, and how enemies move before and after firing |
| `phaser.c`                                                         | Six banks, automatic distribution, the hit formula and its constants                               |
| `torped.c`, `nova.c`, `snova.c`                                    | Torpedo scatter and misfires, bursts, novas, black holes left behind, supernovas                   |
| `move.c`, `warp.c`, `impulse.c`, `dumpme.c`, `autover.c`           | Movement, collisions, the negative energy barrier, black holes, warp damage, the warp-ten events   |
| `capture.c`, `dock.c`, `rest.c`, `help.c`, `abandon.c`, `visual.c` | The other commands                                                                                 |
| `kill.c`, `checkcond.c`, `lose.c`, `win.c`, `score.c`              | Losses, the end of a game, the score lines and the promotion rule                                  |

## Verified behaviour of the original

All by reading the C source.

- The clock is `resources ÷ enemies`: resources start at enemies × time and drain by the number of
  enemies every stardate, so stopping one makes the time left grow at once (`events.c`, `kill.c`).
- Time is `6 × length + 2` stardates; enemies are `skill × length × 3.5 × (0.75–1.75)`, at least
  `skill × length × 5`; starbases are 2 to `7 − skill`, one at the top skill (`setup.c`).
- Enemy power is `100 + 150 × skill` (plus 150 at the top skill), the same for every enemy, and is
  restored whenever the player re-enters a quadrant (`initquad.c`).
- An enemy's shot is `power × 0.9^distance × 0.5` (roughly; the dust factor is 0.90–0.91), after
  which its power falls by about a fifth. Shields absorb in proportion to how full they are, at a
  quarter to three quarters when they were changed this move (`attack.c`).
- Phasers cannot fire with the shields up (`phaser.c`); torpedoes can, but stray further with the
  shields up (×1 to ×2) and twice as far when docked (`torped.c`). Torpedo scatter is triangular
  ±20°, misfiring past ±12°.
- A torpedo into a star: 15% nothing, 5% supernova, otherwise a nova that removes the star (a
  black hole one time in four) and reaches all eight neighbours, chaining through other stars
  (`nova.c`).
- Warp costs `distance × warp³ × (shields up ? 2 : 1)` power and `distance ÷ (warp² ÷ 10)` time;
  above warp 6 it may damage the engines; above warp 9 come the time portals and worse (`warp.c`).
- Distress calls pick a quadrant with an inhabited system and enemies; if still occupied at the
  deadline the system is enslaved and reproduces an enemy now and then, spilling into a neighbour
  when the quadrant holds nine (`events.c`).
- `Ship.distressed` is incremented and never decremented, so no more than five calls ever happen in
  a game (`events.c`).
- The NetBSD port's negative time portal copies the galaxy _into_ the snapshot instead of out of it
  (`memcpy` with the 4.2BSD `bmove` argument order), so it changes nothing (`warp.c`).
- The automatic phasers' estimate of the energy each enemy needs multiplies by `GAMMA` (0.3)
  instead of `cos(GAMMA)` (0.955) and so asks for about four times too much (`phaser.c`).
- The promotion rule: a win, a score of 1,000 or more, no rescue requests, no starbases or inhabited
  systems destroyed by the player, five times the stars lost plus the deaths under 100, and the
  original ship (`win.c`).

## Balance targets and simulations

The steady captain (`src/engine/bot.ts`) is a heuristic player: it answers the most urgent call it
can reach, fights with beams at a lowered shield and flares at clean close shots, hails worn-down
gleaners, keeps power for the way home and moors when low. It is no expert; humans who plan routes
and flares should do better, especially at the top ranks.

Targets set for the career: most Cadet watches kept by a steady player in a short session; a
gentle decline through Head Keeper; Warden and High Warden as a real summit, still winnable.

Career rules, short watches, 60 seeds per rank (2026-10-02, `tsx scripts/sim.ts 60 commission 1`):

| Rank        | Kept | Promoted | Orders (median) | Days (median) | Calls per watch |
| ----------- | ---- | -------- | --------------- | ------------- | --------------- |
| Cadet       | 97%  | 32%      | 32              | 9.6           | 1.0             |
| Lamplighter | 88%  | 87%      | 41              | 12.4          | 1.1             |
| Keeper      | 83%  | 80%      | 59              | 17.7          | 1.9             |
| Head Keeper | 68%  | 62%      | 73              | 22.1          | 2.1             |
| Warden      | 27%  | 2%       | 74              | 23.6          | 2.1             |
| High Warden | 17%  | 0%       | 55              | 24.0          | 2.1             |

The captain's top-rank losses are mostly failed beacon calls and an empty reserve: it runs low far
from the single harbour. A Cadet promotion needs pace (the score's 1,000), so it often takes a few
watches; that is the original's rule and it reads as a goal, not a wall.

The 1976 rules, short watches, 60 seeds per rank: kept 85%, 68%, 13%, 0%, 0%, 0% from novice to
impossible. The original's swarm grows with skill while its clock does not, so its upper levels are
mostly luck for a heuristic player.

| Locked in                                               | Tolerance                                   |
| ------------------------------------------------------- | ------------------------------------------- |
| `src/engine/balance.test.ts`: Cadet, 20 seeds           | kept ≥ 75%, promoted > 10%, under 60 orders |
| `src/engine/balance.test.ts`: Keeper 16, High Warden 10 | Keeper kept ≥ 65%, High Warden kept ≤ 40%   |

### The career's tuning (`CAREER_TUNING` in `src/engine/params.ts`)

| Knob            | Value | Why                                                                                 |
| --------------- | ----- | ----------------------------------------------------------------------------------- |
| `skillStep`     | 0.55  | Swarm size and strength climb 0.55 of an original skill level per rank, to Warden   |
| Top rank        | —     | High Warden keeps Warden's swarm; its rule is the single harbour and the redline    |
| `baseExtraDays` | 2     | Ten days for a Cadet: a first watch is for learning the Reach                       |
| `extraDays`     | 2     | Two more days per rank                                                              |
| `extraGleaners` | 3     | So that a clean Cadet win can reach 1,000 points                                    |
| `minimumAir`    | 3     | The original gave no air at all at its top level                                    |
| `callDelay`     | 0.4   | Calls about two and a half times as often as the original's, so lights stay in play |

## Performance

On the workbench at 1920×1080 on this machine's GPU (`tsx scripts/perf.ts`): 60 fps (p95 frame
16.8 ms) idle in a zone, while the gleaners fire, and during a volley. Everything is Canvas 2D; the
zone's background is painted once per zone and size into an offscreen canvas.

## Decisions log

| Date       | Decision                                                                                                    | Why                                                                                         |
| ---------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 2026-10-02 | The owner chose the pitch: Lightkeeper, self-replicating mining drones, the old Trek port stays in the Hall | A gamified reborn of trek alongside the adopted typed port                                  |
| 2026-10-02 | Follow the 1976 rules closely in the engine; tune only the career                                           | The hidden systems are the pitch; the 1976 rules stay available in full                     |
| 2026-10-02 | Zones keep their layout from their own seed                                                                 | A place should stay put; the same code gives the same Reach for everyone                    |
| 2026-10-02 | Beams preview and suggestion use the real formula, searched at worst luck                                   | The original's own estimate is about four times too high                                    |
| 2026-10-02 | The time portal rewinds the galaxy, not the ship                                                            | The 1976 intent; the NetBSD copy ran backwards                                              |
| 2026-10-02 | Catalog position: after the toys, before `sail`                                                             | Next to the strategy games; the Hall's progression simulation stays on target with it there |

## Open questions

- The Hall's progression target "a casual player reaches `user` on day 1" depends on the seeded
  choice of favourite games, so adding a catalog row can flip it; Lightkeeper's position was chosen
  to keep it green. A sturdier target is for the kit owner.
- No hero-frame review happened; the owner may want one before promoting the game.
