# Diff log — `hunt / fancy-web` ("Hunt — Ricochet")

The story of this port: what was kept from the original, what was changed,
what was added, what was left out — and why. The rules themselves are in
[`notes.md`](./notes.md) §2; the decisions in [`decisions/`](./decisions/).

---

## 1. Kept — the game `huntd` runs

The engine is a function-by-function port of `huntd` (`execute.c`,
`shots.c`, `expl.c`, `draw.c`, `driver.c`, `answer.c`, `makemaze.c`) and of
`otto.c`, **golden-tested against the real daemon code** step by step
(`tests/golden.test.js`). Everything below is therefore exactly the
original, including its quirks:

| Area | Kept exactly |
|---|---|
| Arena | 51 × 23 perfect maze from `makemaze.c`'s own generator and RNG; one pair of boots; two mines per entry |
| Movement | strafe with `h j k l`, turn with `H J K L`; stab by walking into someone you face |
| Weapons | the whole table: shot, grenade, satchel, bombs 7 × 7 … 21 × 21, four slimes; "biggest you can afford"; three shots then the gun must be cooled by moving |
| Ballistics | 5 cells per step; 90° mirrors that **flip** after every deflection; doors that scatter; walls that stop and die; the 5%/10% interception quirk; catching (10%) and ducking (5%) |
| Blasts | squares of side `2·size−1`, 5 damage per ring; mines set off by blasts; every blast drawn on every screen for 4 steps |
| Walls | any blast removes interior walls; 40 missing at most, the oldest grows back (1% door, 1% mirror); a wall growing under a player throws them |
| Slime & lava | oozing ahead and sideways around walls, one cell per charge, 5 damage per touch; the volcano fed by undetonated ammo |
| Economy | 15 ammo on entry, +5 per entry to everyone; defusing mines; catching shots; **no regeneration** |
| Death | damage over capacity; +2 capacity and 2 healed per kill; ammo detonating where you fell; boots flying out |
| Score | `kills / entries` as a C float, decaying after 15 entries; self- and team-kills cost a kill |
| Sight | the 3 × 3 plus 3-wide strips ahead and sideways, never behind; screen memory that forgets a player as soon as they move; scan and cloak counted in moves; firing shows everyone where you are |
| Teams | single digits; teammates shown as their digit; friendly fire hurts |
| Otto | the whole of `otto.c` — its screen reading, its right-hand wander, its slime salvo, and its three bugs |

## 2. Changed — with an ADR each

| Change | Why | ADR |
|---|---|---|
| **Time runs on a 10 Hz clock**, not "only when someone types" | real-time play against bots; a server tick. One tick is one pass of `driver.c`, so every rule keeps its unit | [005](./decisions/005-time-and-tick.md) |
| A 2-second respawn pause, with the cloak / scan / fly choice | readable deaths; the original reconnects at once (the engine does too with the delay at 0) | [005](./decisions/005-time-and-tick.md) |
| Otto's harness: it steers by its true position and acts whenever its typeahead is empty | the original client steered by the last `< > ^ v` it drew (message text included) and could stall waiting for an acknowledgement `huntd` never sent | [notes §5](./notes.md#5-otto-bugs-kept-faults-not-reproduced) |
| **Where `spec.md` and `huntd` disagree, `huntd` wins** (maze size, weapon table, no slime slow, no teleports, no ammo regen, ownerless mines, score formula…) | the brief: the C is ground truth; 42 discrepancies recorded for a canonical fix | [007](./decisions/007-source-over-spec.md) |
| A daemon hang guarded: `remove_wall()` gives up after one lap of its ring | the C spins forever if every slot is blocked | [notes §4](./notes.md#4-daemon-quirks-this-port-reproduces-on-purpose) |

## 3. Added

| Addition | Notes |
|---|---|
| **The 3D arena** | a dark stone labyrinth whose light is hunt's own line-of-sight rule; memory as blueprint ghosts; everything driven by engine events ([ADR 001](./decisions/001-tech-stack.md), [002](./decisions/002-zero-raster-assets.md)) |
| **Arena types** Veteran and **Ricochet** | the original arena has no mirrors; Ricochet braids the maze and lets `remap()` make free-standing mirrors ([ADR 006](./decisions/006-arena-mirror-seeding.md)) |
| **Novice and Sharpshooter** bots | labelled extensions; fair (own screen only); a map-based explorer for both ([ADR 003](./decisions/003-v1-scope.md)) |
| **Modern controls** | twin-stick WASD + arrows/mouse, each input a legal hunt keystroke; remappable ([ADR 004](./decisions/004-input-scheme.md)) |
| **Coach** and **Override** | cheat layers, as in the trek ports; Override marks the score; all-off is byte-identical to the baseline |
| **Views** | 3D (overview / follow camera), split (terminal + 3D follow), terminal only — the terminal is also the no-WebGL fallback |
| **HUD** | the status panel as a card, a scoreboard with K/D and stat marks, a kill feed, the message line, a gunshot radar (faithful: every shot was drawn on every screen) |
| **Sound** | procedural Web Audio, muted by default |
| **Quality ladder** | High / Low / Lite (auto on software WebGL) / terminal |

## 4. Left out (V1)

| Original feature | Why not now |
|---|---|
| Network play (`hunt` ↔ `huntd` over TCP/UDP) | V1 is single player; the engine is server-shaped ([ADR 003](./decisions/003-v1-scope.md), [architecture §7](./architecture.md#7-future-multiplayer-server)) |
| Monitor mode (`hunt -m`) as a role | the death "monitor view" and the see-all flag draw the same thing; a spectator role waits for the server |
| Statistics (`hunt -S`), messages (`-w`), the talk-daemon announcement | tied to multi-user Unix; the engine keeps every statistic (`g.scores`) |
| The `?` drone | not compiled into the Linux build (`Makeconfig:27`) — faithfully absent |

## 5. The narrative

**Reading the source first changed everything.** The canonical `spec.md`
describes a different game: an 80 × 24 maze, a full-auto burst on `F`,
player-laid tripmines, slime that slows, electric teleports on `@`,
masonry that takes three hits, a 100-points-per-kill score. None of it is
in `huntd`. The real game is stranger and better: shots fly five times
faster than you, mirrors flip every time they deflect a shot, any shot
kills a wall, walls grow back under your feet and throw you across the
maze, and firing broadcasts your position to everyone. The discrepancies
became `notes.md` §3 (42 rows, each with `file:line`), and ADR 007 made
"the C wins" explicit.

**The oracle.** `hunt` is not in Debian's `bsdgames`, so there was no
binary to play against. Instead, `scripts/oracle/harness.c` compiles the
upstream daemon itself (from a local copy, never committed) around a
scripted driver loop with a tiny virtual terminal per player, and dumps
the entire state after every step. The first three traces — maze seeds,
a duel, and four Ottos for 1,500 steps — matched the JavaScript engine on
the first run. Keystroke fuzz then exposed one real modelling gap: the
client's screen is not a pure function of `p_maze`, because `showexpl()`
sends player glyphs untranslated. The engine now keeps both (`mem` and
`scr`), and all seven traces match.

**Faithful quirks found by testing.** The stress test flagged a player
standing on a cell whose maze char was a space. It was not a port bug:
`zap()` never draws flying boots into the maze, so when they fly on,
`move_flyer()` restores the space they left over whoever stepped in
(`notes.md` §4, quirk 4). It stays, documented, with the test allowing
exactly that case.

**No mirrors.** The golden maze runs showed that a fresh `hunt` arena has
no mirrors at all — a perfect maze never isolates a pillar, which is the
only way `remap()` makes one. For a port called *Ricochet* that was a real
problem. Seeding mirrors with the regeneration rule was tried and measured:
nearly all such mirrors sit inside wall runs and just turn shots into the
next block (0.24% of shots bounce twice). Braiding the maze and letting
`remap()` do its job produced free-standing mirrors and chains of up to 15
bounces. After comparing the two, the owner made Ricochet the default,
with Mixed bots since Classic Otto circles there; Classic, the original,
is one click away (ADR 006).

**Otto in a braided maze.** In the Ricochet arena, Otto circled a single
block forever: `wander()` is a right-hand wall-follower whose memory is
mostly disabled by its own `NORTH == 0` bug — fine in a perfect maze,
hopeless with loops. Classic Otto keeps that (and the setup screen says
so); the Novice and the Sharpshooter got a real explorer (a search over
their own remembered map, with goal commitment after a first version
oscillated). The Novice was first made "slow" by thinking between moves,
which made it barely walk; "slow reactions" now means reacting 3–6 steps
late to an opponent, not walking slowly.

**Visual iterations** (each after Playwright screenshots and an
art-director critique):

1. First frame: the remembered border drew every cube edge — a blue wire
   cage. Walls became merged masonry runs with neighbour masks, ghosts
   became silhouettes only.
2. The lit area was flat and near-black: three.js converts hex colours to
   linear, so "dark" albedos were ~2% reflectance. Albedos and the beam were
   rebuilt; floor contact shadows added.
3. A black rectangle over half the screen: `pow(negative, 2.0)` in the
   shockwave ring is NaN on Direct3D, and bloom spread it. Fixed, and NaN
   guards added so one bad pixel can never do that again. Then dashed black
   lines along shot streaks: the same class of bug at the ribbon edges.
4. Explosions were a single white ball: rebuilt as a hot core, turbulent
   fireballs, a shockwave ring, dark smoke, the blast square glowing on the
   floor, lit hot debris.
5. The beam did not read as a beam: a masked volumetric shaft was added,
   clipped by the same visibility field.
6. The remembered floor turned into a glowing blue grid — precisely the
   look the brief rules out. Memory is now sparse blueprint registration
   ticks.
7. Slime read as neon smoke with polka dots; it is now a translucent,
   glossy spill with a meniscus shadow and a few bubbles that swell and pop.
8. The cloak refraction warped a whole region into a smear; it is now a
   fine heat-haze ripple with a flickering, nearly invisible marker. The
   respawn beam lost its opaque-pipe look; boots stopped looking like a
   pause icon.

**Performance.** 60 fps at High with eight bots and constant bombs on the
development GPU. The first CPU-only run was 4 fps; the Lite profile (half
resolution, no bloom, cheap shader branches, noise only where goo or burns
are) brought it to ≈ 13 fps under that stress, and Auto picks it on
software WebGL. A cold Direct3D shader compile froze the first second of
play; all programs are now compiled asynchronously during the setup
screen.

## 6. Known limitations and next steps

- Network play and a spectator role (architecture §7).
- The sound has not had a listening pass by the owner yet.
- The canonical docs still need the fixes in `notes.md` §3 (and new
  screenshots of the real program — the game-level `media/*.txt` are not
  captures of `hunt`).
