# Notes — `hunt / fancy-web` ("Hunt — Ricochet")

Working notes of the port. The most important section is
[§3 Canonical-doc discrepancies](#3-canonical-doc-discrepancies): the
canonical `hunt` docs were written before anyone read the source closely,
and most of their numbers are wrong. **The canonical docs were not edited**
(owner's instruction); every fix below is a proposal with evidence.

All `file:line` references are to the upstream source at
<https://github.com/vattam/BSDGames/tree/master/hunt> (`huntd/` = daemon,
`hunt/` = client). Line numbers are those of the NetBSD 2004 revision in
that repository.

---

## 1. How the facts were established

1. **Read the source.** Every rule the engine implements is cited in the
   code comments of [`src/engine/hunt.js`](../src/engine/hunt.js) next to
   the function it ports.
2. **Ran the real daemon as an oracle.** `hunt` is not in Debian's
   `bsdgames` package, so [`scripts/oracle/capture.mjs`](../scripts/oracle/capture.mjs)
   copies the upstream `huntd/*.c` and `hunt/otto.c` from a local checkout
   into a scratch directory (never into this repo), compiles them with the
   Linux game flags around [`scripts/oracle/harness.c`](../scripts/oracle/harness.c)
   (a scripted driver loop with a tiny virtual terminal per player), and
   records the daemon's entire state after every step.
3. **Golden traces.** [`tests/golden.test.js`](../tests/golden.test.js)
   replays the same scripts through the JavaScript engine and demands an
   exact match of: the RNG state after every step, the maze, every player
   (including their screen memory and the client screen every 50 steps),
   every bullet in list order, the explosion lists, the wall-regeneration
   ring, the scoreboard (float32), every message, every death and every key
   Otto types. Seven traces, ~6,000 steps: maze seeds, a duel, a four-Otto
   arena, a crafted mirror/door arena, free-for-all and team keystroke fuzz,
   humans vs Ottos. They cover every weapon (up to the 17×17 bomb), slime,
   lava, volcano, flying, boots, mines, doors, regenerated mirrors, cloak,
   scan and all seven death causes.

## 2. The game as the source defines it

### 2.1 Build configuration

The rules depend on compile-time flags. The Linux build
(`hunt/Makeconfig:27-28`) enables `RANDOM REFLECT MONITOR OOZE FLY VOLCANO
BOOTS OTTO`. **`DRONE` is not enabled**, so the wandering `?` bomb the man
page describes (`hunt.6.in:306-310`) does not exist in this build; the
volcano (commented out of the man page) does. The port follows the build.

### 2.2 Arena

| Fact | Source |
|---|---|
| The maze is **51 × 23** cells; the 80 × 24 terminal adds a status panel (columns 60–79) and a message line (row 23). | `hunt.h:120-133` |
| `makemaze()` carves a *perfect* maze (recursive backtracker on odd cells), then `remap()` draws walls as `-`, `+` or a vertical bar from their neighbours. | `makemaze.c:48-65, 139-233` |
| An isolated wall would become a door and then `/` or `\` (`remap`, case 0), but a perfect maze never isolates a pillar, so **a fresh arena has no mirrors and no doors**. Verified for 300 seeds in [`tests/world.test.js`](../tests/world.test.js). | `makemaze.c:219-226` |
| One pair of boots `B` is placed on a random empty cell. | `driver.c:454-467` |
| The border is indestructible; every interior wall — including `/`, `\`, `#` — is removed by any explosion that covers it. | `expl.c:94-108` |
| At most 40 walls are missing at once; destroying one more rebuilds the oldest; a rebuilt wall is a door 1% of the time and then a `/` 1% of the time (overriding the door). Mirrors and doors enter the game this way. | `expl.c:150-244` |
| A wall rebuilt under a player throws them (`&`, "flying") for up to 19 steps; they land hurt by up to 20% of the damage they already had. | `expl.c:196-214`, `shots.c:568-653` |
| Each entry (first or re-entry) drops one small mine `;` and one large mine `g` on random empty cells. Mines have no owner and are visible like any object in view. | `answer.c:295-313` |

### 2.3 Commands (`execute.c:99-187`)

| Keys | Action | Cost |
|---|---|---|
| `h j k l` | move left/down/up/right **without turning** (strafe) | — |
| `H J K L` | turn to face left/down/up/right | — |
| `f` `1` | shot `:` (size 1) | 1 |
| `g` `2` | grenade `o` (size 2, 3×3 blast) | 9 |
| `F` `3` | satchel charge `O` (size 3, 5×5) | 25 |
| `G` `4` | bomb `@` 7×7 | 49 |
| `5 6 7 8 9 0 @` | bombs 9×9 … 21×21 | 81, 121, 169, 225, 289, 361, 441 |
| `o O p P` | slime `$` of 15, 30, 45, 60 charge | 5, 10, 15, 20 |
| `s` | scan (see uncloaked movers anywhere) | 1 |
| `c` | cloak (hidden from scanners) | 1 |
| `q` | quit | — |

If you cannot afford the weapon you asked for you get the biggest one you
can (`execute.c:356-357`). The gun takes three shots, then overheats until
you **move** — only moving cools it (`execute.c:309-313, 362-367`).
Walking into a player you face stabs them for 2 (`execute.c:265-275`).

### 2.4 Shots

* Every projectile moves 5 cells per step (`BULSPD`, `hunt.h:205`), one
  cell at a time (`shots.c:192-363`).
* **Mirrors** (`shots.c:228-269`): `/` turns east→north, north→east,
  west→south, south→west; `\` turns east→south, south→east, west→north,
  north→west — **and the mirror flips (`/`↔`\`) after every deflection**.
  The shot enters the mirror cell and leaves from it.
* **Doors** `#` send a shot off in a random direction (`shots.c:271-287`);
  players can walk through doors (`execute.c:224-229`); doors block sight.
* **Walls** stop the shot inside the wall cell, where it explodes and
  removes the wall (`shots.c:354-357` + `expl.c:94-108`).
* **Players**: a shot flying into someone who faces it is caught 10% of
  the time (its charge becomes their ammo); otherwise it misses ("Zing!")
  5% of the time; otherwise it explodes (`shots.c:295-350`).
* A shot meeting another shot's glyph has a 5% (10% for a grenade) chance
  to trigger an interception check (`shots.c:215-226`) — see §4, quirk 1.
* **Explosion** (`shots.c:659-746`): a square of side `2·size−1`; damage
  `(size − ring) × 5` where ring is the Chebyshev distance from the centre.
  A mine in the square goes off on the next step.

### 2.5 Damage, death, score (`driver.c:475-603`, `answer.c:377-429`)

* You start with capacity 10 and die when damage **exceeds** it: three
  shots (5 each) kill a fresh player.
* A kill: `kills += 1`, the killer's capacity `+2` and damage `−2`.
  Killing yourself **or a teammate** is `kills −= 1`. No friendly-fire
  immunity exists.
* Score = `kills / entries` (C `float`), a decayed average: after 15
  entries, each new entry multiplies past kills by 14/15.
* A dead player's ammo may detonate where they fell (`driver.c:654-721`):
  the larger of two random draws picks a bomb, satchel, grenade or slime
  of up to their ammo. Ammo that does not go off feeds the **volcano**;
  with probability `volcano/50 %` per death, lava (`~`) erupts near the
  centre (`driver.c:722-735`).
* Stabbed-to-death victims drop nothing (`driver.c:518-521`).

### 2.6 Economy — there is no ammo regeneration

Ammo only comes from: 15 on entry, **+5 to everyone already in the game
whenever anyone enters or re-enters, and +5 to the newcomer per player
present** (`answer.c:281, 315-331`); defusing a mine (+1 / +9,
`execute.c:579-607`); catching a shot you face (`shots.c:305-323`).

### 2.7 Slime and lava (`shots.c:753-963`)

Slime oozes — ahead and to both sides, back only when boxed in — one cell
per charge, 5 cells deep per step, splitting its charge between open
directions and going **around** walls, never through them. Every cell it
enters deals 5 damage to a player there. Slime and lava are walls to other
slime. **Slime does not slow anyone down.** Boots halve slime damage (one
boot) or cancel it (a pair) (`driver.c:486-499`).

### 2.8 Visibility (`draw.c:125-282`)

Each player's screen is a **memory** (`p_maze`) updated only by:

* `look()` — the 3×3 around you, plus a 3-wide strip straight ahead and to
  both sides, each running to (and including) the first wall, mirror or
  door on its centre line. **Never behind you.** Players, shots, mines and
  slime are see-through.
* `drawplayer()` — when a player leaves a cell, *everyone's* memory of that
  cell is refreshed (a remembered enemy vanishes as soon as they move, but
  you don't learn where they went); scanners see uncloaked movers anywhere.
* `showexpl()` — explosions, slime, flying players and every fired shot are
  drawn on **every** screen for 4 steps.
* `moveshots()` — each shot's previous cell is re-checked for everyone
  (`shots.c:91-97`); right after firing, that cell holds the shooter, so
  **firing shows your glyph and facing to every player**.

Your own glyph reads `< > ^ v`; other players `{ } i !`; teammates show as
their team digit (`draw.c:368-406`). Cloak hides you only from scanners.
Cloak is spent per own move or turn, scan per *other* player's move —
both are measured in moves, not time (`draw.c:337-350`).

### 2.9 Time

`huntd` has no clock: `poll()` waits forever (`driver.c:135`); each wake-up
executes at most one queued key per player, then moves the world once
(`driver.c:178-191`). **If nobody types, everything stands still**
(`hunt.6.in:312`). Clients may type ahead up to 5 keys (`playit.c:81`).

### 2.10 Otto (`hunt/otto.c`)

Otto is started with `hunt -o` (`hunt.c:157-163`), not `-b` (`-b` turns the
typeahead beep off). It reads its own screen, looks F/L/B/R along 3-wide
strips, attacks a visible opponent head-on with two **small slimes**
(`o o`, `otto.c:470-474`) or from the side with two bullets, picks up
boots and mines, and otherwise wanders a dead-end-avoiding walk. See §4
for its bugs.

## 3. Canonical-doc discrepancies

Each row: where the canonical doc is wrong, what the source says, and the
proposed canonical fix. (`spec` = `docs/spec.md`, etc.)

| # | Canonical claim | Source says | Proposed fix |
|---|---|---|---|
| 1 | `spec:20` Maze is 24 × 80; `spec:32` player x in 1..78 | 51 × 23 (`hunt.h:120-122`); x 1..49, y 1..21 | State the maze and screen sizes separately |
| 2 | `spec:21-22` up to 32 players, 32 slots | 15 players + 1 monitor with MONITOR (`hunt.h:105-111`) | `MAXPL = 15` |
| 3 | `spec:23` `Shot_head` list | `Bullets` (`extern.c:56`) | Rename |
| 4 | `spec:24`, `test-scenarios:10-19`, `how-to-play:78` port 5868 | Test port is `('h' << 8) + 't'` = 26740 (`pathname.c:60`); game/stat sockets are ephemeral (`driver.c:302-386`) | 26740 (UDP rendezvous) |
| 5 | `spec:33` `p_face` holds `^ v < >` | the maze stores `{ } i !` (and `&` flying); `< > ^ v` are only your own glyph on your own screen (`hunt.h:180-191`, `draw.c:368-383`) | Document both glyph sets |
| 6 | `spec:34` ammo 0..50, "replenishes slowly" | no cap; **no regeneration** — ammo comes from entries, mines, catches (§2.6) | Replace |
| 7 | `spec:35` damage 0..100 % | damage points vs a capacity starting at 10, +2 per kill (`hunt.h:209-211`, `driver.c:580-583`) | Replace |
| 8 | `spec:36-37` `p_kills`, `p_deaths` per player | kills/deaths live in the `IDENT` score record (`hunt.h:291-308`) | Replace |
| 9 | `spec:38` cloak 0..100 energy ticks | cloak counts *own moves* (20 per charge) (`execute.c:543`, `draw.c:347-350`) | Replace |
| 10 | `spec:39`, `spec:53-54`, `how-to-play:39-40,63` slime slows by 50% / blinds | **no slow and no blinding exist**; slime deals 5 per cell touched (§2.7) | Remove the slow |
| 11 | `spec:49` bullet 3 cells/tick, 20% damage, glyph `.`/`*` | 5 cells/step, 5 damage points, glyph `:` (`hunt.h:155, 205`, `shots.c:723-731`) | Use §2.3/§2.4 |
| 12 | `spec:50`, `how-to-play:32` `F` = 5-bullet full-auto burst | `F` throws a satchel charge (25) (`execute.c:135-137`) | Replace |
| 13 | `spec:51-52`, `how-to-play:33-34` grenade 2 ammo / bomb 4 ammo, 5×5 | grenade 9 → 3×3; satchel 25 → 5×5; bombs 49…441 → 7×7…21×21 (`extern.c:76-87`) | Use the table in §2.3 |
| 14 | `spec:53-54`, `how-to-play:35-36` slime on `s`/`S` for 3/6 ammo | slime on `o O p P` for 5/10/15/20 (`execute.c:165-176`); `s` is scan | Replace |
| 15 | `spec:55-56`, `how-to-play:37-38` player-laid tripmines `m`/`M`, invisible, 40%/80% | no key lays mines; one `;` and one `g` appear per entry, visible, ownerless; trip odds 2/50/95% by direction; 5/10 damage (`answer.c:295-313`, `execute.c:238-247`) | Replace |
| 16 | `spec:57` mirrors indestructible | removed by any explosion covering them; flip on every deflection (`expl.c:94-108`, `shots.c:243,264`) | Replace |
| 17 | `spec:58`, `how-to-play:47` `#` is the solid perimeter | `#` is a **door** that scatters shots and lets players through; the border is made of `-`, `+` and the vertical-bar wall (`hunt.h:146`, `shots.c:271-287`) | Replace |
| 18 | `spec:59`, `how-to-play:48` masonry `+` absorbs 3 bullets | every interior wall dies to one shot; `+` is just a junction (`makemaze.c:227-229`) | Replace |
| 19 | `spec:60`, `how-to-play:41` `@` electric teleport | no teleports exist; `@` is the bomb glyph (`hunt.h:158`); the nearest mechanic is being thrown by a regrowing wall (§2.2) | Remove |
| 20 | `spec:66` reflection at `shots.c:120-180` | `shots.c:228-269`; the matrix itself is right, but the flip is missing | Fix the cite, add the flip |
| 21 | `spec:76` Points = 100·kills − 50·deaths + accuracy bonus | score = decayed `kills / entries` (`answer.c:398-400`, `driver.c:574`, `hunt.6.in:356`) | Replace |
| 22 | `spec:78` team score = sum of members | there is no team score | Remove |
| 23 | `architecture:39-56` `select()` loop with `TICK_USEC` timeout | `poll(…, INFTIM)`: no timeout, no tick; the world moves only on input (`driver.c:132-229`); `TICK_USEC` does not exist | Replace; this is the defining quirk of hunt's time |
| 24 | `architecture:75-76` "32 concurrent players", "deterministic tick clock" | 15 players; no clock | Replace |
| 25 | `architecture:84-102` `cur_screen`/`new_screen` double buffer | one `p_maze` memory per player diffed against `Maze` by `check()` (`draw.c:260-282`) | Replace (the lesson — send only changed cells — stands) |
| 26 | `architecture:108`, `test-scenarios:56,65`, `how-to-play:72`, README "-b spawns Otto" | Otto is `hunt -o`; `-b` disables the beep (`hunt.c:157-163, 211-212`) | Replace |
| 27 | `architecture:108-123` Otto: 8-direction scan, A* patrol, trajectory prediction, bank shots | 4 relative directions, 3-wide strips, no pathfinding, no prediction, no bank shots, attacks with slime (`otto.c:163-626`) | Replace; "unfair, stupid" is its own description (`otto.c:37`) |
| 28 | `how-to-play:18-24` `hjkl` "move / face", diagonals `yubn` | `hjkl` move without turning; `HJKL` turn; no diagonals | Replace |
| 29 | `how-to-play:39` cloak costs 5, lasts until firing/damage | 1 charge per 20 own moves; firing does not uncloak; cloak hides you only from scanners (`execute.c:525-549`) | Replace |
| 30 | `how-to-play:67`, README "teammates cannot friendly-fire" | full damage to teammates; killing one costs you a kill (`driver.c:565-573`) | Replace |
| 31 | `how-to-play:67` team names like `RED` | a team is a single digit (`hunt.c:150-156`, `hunt.6.in:100`) | Replace |
| 32 | `test-scenarios:24` status bar `[IDENT] [AMMO: 15] [DAMAGE: 0%]` | status panel rows `Ammo:` `Gun:` `Damage:` `dd/cc` `Kills:` `Player:` list (`draw.c:73-123`) | Replace |
| 33 | `test-scenarios:45-49` 20% per bullet; +100 points per kill | 5 of capacity 10; score is a ratio | Replace |
| 34 | `port-ideas:67-68` "variable microsecond delays (`TICK_USEC`)" | no timer at all (#23) | See port ADR 005 for the tick decision |
| 35 | `port-ideas:51` "Aimbot Otto calculates multi-bounce ricochets" | not in otto.c; this port's Sharpshooter is an extension (port ADR 003) | Mark as a proposal |
| 36 | `notes:13-19` `/` gives Δx'=−Δy, Δy'=−Δx | correct as geometry (screen y grows down), but misses the flip | Add the flip |
| 37 | `notes:24-28` packet structs `IDENT_REQ`, `PLAYER_MOVE`, `SCREEN_UPDATE` and ANSI `\033[y;xH` | a raw byte protocol: login fields read in order (`answer.c:93-103`), then keystrokes one way and `MOVE`/`ADDCH`/`REFRESH`/`READY` command bytes (0200-flagged) the other way (`hunt.h:89-98`, `terminal.c:134-158`) | Replace |
| 38 | `diff-log` (game level) "Tick Rate: variable microsecond sleep (`select()` timeout)" | #23 | Replace |
| 39 | `media/01-arena.txt`, `media/02-deathmatch.txt` | they are not captures of the program: wrong maze shape, wrong status panel, invented messages | Recapture from the oracle build (a `hunt -m` monitor screen) |
| 40 | man page symbol list: `s` small slime, `$` big slime (`hunt.6.in:222-224`) | all slime is `$` (`hunt.h:162`); no `s` glyph exists (original doc bug) | Note in `manpage.md` |
| 41 | man page `?` drone every ~30 deaths (`hunt.6.in:306-310`) | `DRONE` is not in the Linux build; the volcano is (`Makeconfig:27`) | Note in `manpage.md` |
| 42 | authors "Conrad Huang, **Kenneth Chung**, Greg Couch" in game `README.md:4,11`, `AGENTS.md:15`, `about.md:32`, `lessons.md:3`, `lineage.md:15` — and `manpage.md:42`, which misquotes its own source | "Conrad Huang, **Ken Arnold**, and Greg Couch" (`hunt.6.in:402-405`, `huntd.6.in:121-124`); "Kenneth C.R.C. Arnold" (`Makeconfig:10`) — Ken Arnold of curses and rogue | Replace "Kenneth Chung" with "Ken Arnold" everywhere (and in `ATTRIBUTION.md` if it repeats it) |

## 4. Daemon quirks this port reproduces on purpose

All are exercised by the golden traces; changing them would break the
match with the real `huntd`.

1. **Interception looks at the wrong cell.** When a shot flies into another
   shot's glyph, `zapshot()` compares the other shots against the moving
   shot's position *before* it moved (`shots.c:1011`), so interceptions
   mostly happen between shots that shared the previous cell.
2. **Walking into a live shot sets it off harmlessly for you**: the shot's
   `b_over` (a space) is written over you before it explodes
   (`shots.c:91`, `execute.c:249-264`).
3. **Stale kill bonuses.** Bullets remember their owner's slot. When a
   death compacts the player array (`driver.c:754-758`), a bullet owned by
   the moved player still points at the old slot, so its kill bonus (+2
   capacity) goes to a stale copy — or to whoever next joins in that slot.
4. **Boots that fly off a cell erase whoever stepped in.** `zap()` never
   draws flying boots into the maze; when they fly on, `move_flyer()`
   restores the space they started on (`shots.c:578`), making a player who
   walked there invisible in the maze until they move. (Found by the
   stress test; `tests/stress.test.js` allows exactly this case.)
5. **A rebuilt door can overwrite a thrown player's `&`** for one step
   (`expl.c:218-225` runs after the throw).
6. **Your own glyph can read `{ } i !` on your own screen** right after
   landing from a flight, because `showexpl()` sends player glyphs
   untranslated (`shots.c:652`). The engine models the client screen as its
   own grid for this reason (`scr` next to `mem`).
7. **Mines can vanish under a newcomer.** `stplayer()` picks the entrant's
   cell before dropping the mines, then draws the player over whatever
   landed there (`answer.c:254-313, 340`).

One daemon hang is guarded instead of reproduced: `remove_wall()` loops
forever if all 40 regeneration slots are blocked (`expl.c:175-193`); the
port gives up after one lap (`removeWall` in `hunt.js`).

## 5. Otto: bugs kept, faults not reproduced

Kept (they are its personality, and the golden traces pin them):

* `otto.c:208` tests `bitem.what & ON_SIDE` instead of `.flags`, so only a
  bomb `@` coming from behind makes it duck.
* `otto.c:325, 345, 365, 385` test `been_there[..] & NORTH` etc. with
  `NORTH == 0`, so "been there going this way" never fires for north.
* `otto.c:338, 358, 378, 398` mark dead ends at `been_there[r][col]` using
  the scan row, not the cell.

Not reproduced (they are faults of the client harness, not of the brain,
and would freeze or blind the bot):

* The client locates Otto by the **last** `< > ^ v` it drew
  (`playit.c:144-159, 212-227`) — message text such as "You've been
  slimed." contains a `v`, which teleports Otto's idea of itself to the
  message line. The port passes the true position and facing.
* Otto only acts when `Otto_count` returns to 0 (`playit.c:201-207`), but
  `driver.c:215-218` sends `READY` only to clients whose socket had input
  in that pass, so typeahead executed in later passes is never
  acknowledged and a multi-key Otto stalls. The port asks Otto for its next
  keys whenever its typeahead is empty — what the code was written for.

A limitation that is simply the design: `wander()` (`otto.c:569-626`)
takes the first open direction in the order right, front, left, back, and
its been-there memory is mostly disabled by the `NORTH == 0` bug above. In
a perfect maze that is a right-hand wall-follower and explores everything;
in a maze with loops (this port's Ricochet arena, ADR 006) it orbits a
block forever. Measured over 3,000 steps with six bots: Otto visits ≈ 490
cells in the Classic arena but ≈ 220 in Ricochet. Classic Otto keeps that
behaviour; the setup screen says so. The extension bots (Novice,
Sharpshooter) navigate with `src/bots/explore.js` instead — a
breadth-first search over their own remembered map toward the stalest part
of it, committing to a goal until they have seen it.

## 6. Where this port deviates (see the ADRs)

| Deviation | Why | ADR |
|---|---|---|
| A fixed step clock (default 10 Hz) instead of "time moves when someone types" | real-time play against bots; a server tick | [005](./decisions/005-time-and-tick.md) |
| Extra arenas: Veteran (regeneration rule at 1%), Ricochet (braided maze, mirrors by `remap()`); Ricochet is the default, Classic one click away | the original arena starts with no mirrors, and regrown mirrors sit inside wall runs | [006](./decisions/006-arena-mirror-seeding.md) |
| Novice and Sharpshooter bots, with a map-based explorer | labelled extensions next to the faithful Otto | [003](./decisions/003-v1-scope.md) |
| Respawn pause (default 2 s) for everyone | readable deaths; the original client re-enters at once | [005](./decisions/005-time-and-tick.md) |
| Coach and Override cheat layers | trek-port parity; Override marks scores | [README](../README.md#cheat-mode) |

## 7. Measurements

All on the development laptop (Node 22; RTX 4060 Laptop GPU; Chromium via
Playwright). Reproduce with `node scripts/measure.mjs` (engine, arenas,
bots) and `node scripts/perf.mjs gpu-high gpu-low cpu` (frame rate).

**Engine** (headless, 8 bots, 20,000 steps): 67,000 steps/s with Classic
Ottos; 7,600 with a mixed field; 1,700 with eight Sharpshooters (their
ricochet planning and path search dominate) — 0.6 ms per 10 Hz step at
worst.

**Arenas** (every free cell × 4 facings × 20 seeds, `trajectory()`):

| Arena | Mirrors / maze | In open space | Shots with ≥ 2 bounces | Longest chain | Open cells |
|---|---:|---:|---:|---:|---:|
| Classic | 0 | — | 0 % | 0 | 549 |
| Veteran | 4.6 | 0 % | 0 % | 1 | 549 |
| Ricochet | 56.8 | 100 % | 2.58 % | 15 | 658 |

**Bots** (kills in 10 duels of 3,000 steps, seeds 1-10):

| Duel | Classic arena | Ricochet arena |
|---|---:|---:|
| Classic Otto vs Novice | 17 – 12 | 11 – 17 |
| Sharpshooter vs Classic Otto | 50 – 19 | 112 – 57 |
| Sharpshooter vs Novice | 5 – 0 | 106 – 4 |

In Ricochet, Classic Otto orbits loops (§5), so even the Novice outscores
him there.

**Frame rate** (`scripts/perf.mjs`: 8 bots in the Ricochet arena, a bomb
or big slime thrown every half second, 1600 × 900):

| Device | Profile | fps | 95th percentile frame |
|---|---|---:|---:|
| RTX 4060 Laptop (D3D11) | High | 59.9 | 16.7 ms |
| RTX 4060 Laptop (D3D11) | Low | 59.9 | 16.8 ms |
| CPU only (SwiftShader) | Lite (auto) | 13.1 | 117 ms |
| no WebGL | terminal view | — | — |

The world keeps its 10 steps/s in every case; only the drawing slows down.
