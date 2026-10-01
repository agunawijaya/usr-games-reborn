# `battlestar / fancy-web` — Working Notes

Port working notes: how the canonical docs were checked against the C
source, every discrepancy found (with `file:line` in the upstream
source), proposed fixes for the canonical docs, the verified walkthrough,
and practical notes (golden transcripts, machines without a GPU).

> Upstream: <https://github.com/vattam/BSDGames/tree/master/battlestar>.
> All `file:line` references below are to that tree (NetBSD revisions
> of 2003–2004, identical to Debian `bsdgames` 2.17).

---

## 1. How the verification was done

The canonical docs were **not** trusted. Everything the port relies on
was re-derived from the C source and then confirmed against the real
program:

1. `scripts/extract-data.mjs` transcribes the data tables (rooms,
   placements, objects, vocabulary) straight from `dayfile.c`,
   `nightfile.c`, `dayobjs.c`, `nightobjs.c`, `globals.c`, `words.c`
   and `extern.h`, so the port cannot inherit a mistake from a doc.
2. The engine (`src/engine/battlestar.js`) is a function-by-function
   port of the C, and is **golden-tested byte for byte** against the
   real Debian binary (`/usr/games/battlestar`) run under WSL with
   `getpid()` pinned so its `srand(getpid())` matches the engine's seed
   (see §5). 22 transcripts, including five complete winning games.
3. A graph analysis (`tests/world.test.js`) checks the room table:
   all 275 rooms are reachable from room 22 once launch, landing, the
   two `follow`s, `use amulet` and `jump` are counted; every
   description has exactly four direction placeholders; no link points
   outside 1–275.

---

## 2. Discrepancies between the canonical docs and the source

Severity: **High** = the doc would make a port play differently;
**Med** = wrong detail a port could copy; **Low** = colour/lore.

### 2.1 Movement and the room graph

| # | Canonical claim | Source says | Where | Sev |
|---|---|---|---|---|
| 1 | Compass verbs `north`/`south`/`east`/`west`/`n`… move you (how-to-play §2, architecture §4, walkthrough everywhere). | There are **no** compass words in the vocabulary. Movement is only `ahead a back b left l right r up u down d`. `NORTH`…`WEST` exist only as internal constants. | `words.c:114-125`; `extern.h:131-134` | High |
| 2 | Room 22 connects west to hallway 17; the ship map (world-map §1) links 22→17→16→12→9→1→3→4→5→7. | Room 22's exits are south→8 (closet) and east→16. The shortest escape is 22→16→13→(down)11→9→1→5→7. Most edges in the ship diagram do not exist. | `dayfile.c` rooms 1–31 (e.g. room 22 at `dayfile.c:174`) | High |
| 3 | Sectors: coast 69–120, rainforest 121–200, ruins 201–275 (world-map, README, notes §1). | Rooms 69–100 and 104 are **airspace** (`flyhere` = 1): you fly *over* the island there. The ground is 80, 89, 91–93, 98, 101–103, 105–245; the caves are 160, 230–231 and 246–275. Beach, forest, village and groves are interleaved across 101–245. | `dayfile.c` `link[7]`; `extern.h:46` `OUTSIDE` | High |
| 4 | Space is a chain 32→33→36→40→49→55→64→68 with "re-entry corridor" 68→70. | Space is a 35-room tangle (32–66) plus two orbits (67 blue planet, 68 tropical planet). Room 64 (a Cylon) is the only way to 66→68; 67 descends into the fog trap 69 whose every exit loops back to itself. | `dayfile.c` rooms 32–69 | Med |
| 5 | Day/night swap changes "exit connections across all 275 rooms". | Only six rooms change links: 114 (a night path down to the sea cave 160), 247, 248, 249, 252 and 261 (the ladder 261→262 exists **only at night**). | `dayfile.c:1405` vs `nightfile.c:1381` (room 261) etc. | High |
| 6 | Room 218 is a "Sacred Springs / Grotto of the Sea Nymph" enclosed cave. | Room 218 is the **bedroom** of the bungalow; it is excluded from `OUTSIDE` presumably because it is indoors. | `extern.h:46`; `dayfile.c` room 218 | Low |
| 7 | "High Altar of the Heavens" (275), "Crystal Chamber" (268), "Citadel", "Armory of the Gods"… | No altar or citadel exists. 268 is "a rather large chamber" with a golden throne (the goddess's), 275 is "the bottom of a pit", 258 the catacombs, 260 the Sepulcher. The world-map names are invented. | `dayfile.c:1443` (268), `dayfile.c:1477` (275) | Med |

### 2.2 Objects, placements and properties

| # | Canonical claim | Source says | Where | Sev |
|---|---|---|---|---|
| 8 | Spec §5 weights/bulk (e.g. knife 1/1, sword 5/2, Viper 5000/100, woodsman 70/10). | e.g. sword 5/5, two-handed sword 15/10, broadsword 10/5, mail 10/2, Viper 2500/10, woodsman 10/150, warhead 55/7, laser 5/4. Use the tables. | `globals.c` `objwt`/`objcumber` | High |
| 9 | Amulet also at 126; medallion appears at night in 218; talisman at 275. | The amulet starts **only** in room 13 (the ship). The medallion appears in the throne room (268) when you `love` the goddess. The talisman (and the amulet) appear where you end up after the second Dark Lord fight. Nothing is placed at 218 except levis, ring and (at night) pajamas. | `dayobjs.c:106`; `command5.c:124`; `command2.c:333-336` | High |
| 10 | Lantern at 268 (day) and 92/181/236 (night) — ok; "brass lantern", "negates darkness" after `light lamp`. | The lantern is "a kerosene lantern … burning luridly": it is always lit. `light` only strikes a match. Holding the lantern (or it lying in the room) lets you see in the dark. | `globals.c` objdes[12]; `command6.c` `light()` | Med |
| 11 | Food values (+20/+25/+30 nutrition), "starvation" loss condition, `ate` starting at 50. | `ate` starts at 0 and **never harms you**. Eating needs a knife in hand, adds 10 to `snooze` and sets `ate = max(ourtime, ate) + 33`; you are "stuffed" only while `ourtime <= ate - 100`. There is no starvation. | `globals.c:259`; `command4.c:395-400` | High |
| 12 | Potion "+5 pleasure"; `drink water`. | The potion heals every injury, restores `WEIGHT`/`CUMBER` and puts you to sleep (`zzz`). There is no water to drink ("I'm not thirsty."). | `command3.c` `drink()` | Med |
| 13 | Treasures give Ego (+10/+15/+20). | Taking treasure gives nothing. Ego comes from `give` (+1, +2 to the girl, +5 to the goddess), burying bodies (+2) and loving the goddess (+1); cruelty costs Ego. | `command5.c` `give()`, `command3.c` `bury()` | Med |
| 14 | Cylons destroyed give +10 Power; Elf killed +10 Power. | A dogfight win gives no points. Any fight won gives +2 Power. | `command1.c:185-199`; `command7.c:238-244` | Med |
| 15 | The Viper is boarded with `take viper` / `board viper`. | You `launch` in a room containing the Viper; there is no boarding verb. | `command6.c:44-60` | Med |
| 16 | The flight segment starts at launch. | Launching puts you in space room 32; the curses dogfight (`visual()`) only runs when you enter a room holding a Cylon (36, 49, 64; 68 at night). | `command1.c:185`; `dayobjs.c:102` | High |

### 2.3 The win condition

| # | Canonical claim | Source says | Where | Sev |
|---|---|---|---|---|
| 17 | Holding the three artifacts makes you a wizard and **wins** (`live()`), or `live`/`quit` after `su 275`. | Holding all three sets `tempwiz` (a wizard: `su`, free lifts, thin-air takes) but does **not** win. `live()` ("You win!") is only reached by killing or shooting the goddess **after** you gave her all three artifacts (`win >= 3` sets `wintime`). Taking the medallion does `win--`; each artifact given does `win++`. | `command1.c:136-139`; `command4.c:73`; `command5.c:332-343`; `command2.c` `murder()`; `command3.c` `shoot()` | High |
| 18 | The Dark Lord is simply fought. | To get the talisman you must wound him (`lifeline > strength*0.33`), then **retreat** (`back`) while holding the amulet and *not* the medallion (holding it ends the world). He takes the amulet and flees; `follow` at once. After the second fight the talisman and amulet are dropped **wherever you are standing** — a retreat moves you by the *previous* room's `back`, so they usually fall in 263. | `command7.c:170-205`; `command2.c:329-338` | High |
| 19 | The bathing goddess is always at 126. | She is removed at the first dusk and never returns (night objects are subtracted at dawn, but she was cleared from the day copy). You must `take goddess` (with the amulet) and `follow` her on day 1. | `command1.c:125` | High |

### 2.4 Rules and numbers

| # | Canonical claim | Source says | Where | Sev |
|---|---|---|---|---|
| 20 | Day/night: `ourtime % 200 < 100` is day. | The swap happens in `news()` when `ourtime > rythmn + CYCLE`, then `rythmn = ourtime - ourtime % CYCLE`. `news()` only runs after turn-ending commands; a long sleep can skip a whole half-cycle. (`time` uses the parity of `ourtime/100` and can disagree with the actual file.) | `command1.c:115-131`; `command5.c` `chime()` | High |
| 21 | `snooze` decrements each turn; collapse at 0. | `snooze` is a **deadline**: it starts at 150; you collapse when `ourtime > snooze` and sleep; "You're getting tired" when `ourtime > snooze - 5`. Each fight round costs 5; food adds 10; sleeping adds 3 per turn slept. Sleeping outdoors (`OUTSIDE`) has a 50 % chance of an event, including an elf stealing a random held item (an artifact stolen is **destroyed**). | `command1.c:109-114`; `command5.c:165-200`; `command7.c:57` | High |
| 22 | `beenthere[22] = 1` at start. | All zero; the start block increments it before describing. Descriptions are shown while `beenthere < 3`. The score counts indices 0–274 (so room 275 never counts). | `battlestar.c:77`; `cypher.c` SCORE | Low |
| 23 | Encumbrance: broken arm −15 kg, broken back −30 kg. | Every new injury costs 5 kg of `WEIGHT`; a broken arm also −5 `CUMBER`, broken ribs −2 `CUMBER`, a broken back sets `WEIGHT` to 0. Three specific injuries together (skull, incisions, neck) kill. | `command1.c:200-231` | Med |
| 24 | Fight RNG "uniform [0,30]"; Elf strength fixed. | Damage depends on the weapon: two-handed `rnd(70)`, sword/broadsword `rnd(50) % (WEIGHT-carrying)`, knife/mallet/chain/mace/halberd `rnd(15)`, bare hands `rnd(7)`, minus injuries, bulk or worn items and exhaustion. An elf's strength is `rnd(30)`, a woodsman's 50, the Dark Lord's 100 then 75. The laser always hits when `strength - lifeline <= 50`, otherwise the enemy takes it. Worn mail and helm and a held shield lower the injury index; worn artifacts raise it. | `command7.c:54-270` | High |
| 25 | fly.c: `l`/`f` turn right, `k`/`d` pitch up, one torpedo per shot. | `h`/`r` set the drift `dc = -1` (turn right), `l` sets +1, `j`/`u` `dr = +1`, `k`/`d` −1; capitals ×5 and cost 10 fuel. `f` or space fires **two** torpedoes (`torps -= 2`). A hit needs the Cylon on the centre row within one column. `ourclock` (120 s) is shared by **all** dogfights and is only checked after a key press; running out kills you. `q` leaves the fight and the Cylon wounds you. | `fly.c:51-185` | High |
| 26 | Hereditary wizards riggle, chris, edward, dmr, ken. | Also comay and yee. Logins wnj, root and ted are "anti-wizards": tiny carrying limits, 10 s of flight clock, woodsmen/elves/darkness on the ship. | `init.c:92-145` | Low |
| 27 | Save files are "XOR-encrypted". | `.Bstar` is a raw binary dump of the variables (`fwrite`), without `beenthere`, `wiz`, `tempwiz` or `verbose`, and only the current day or night room file. | `save.c:40-145` | Low |
| 28 | Relative-direction table in spec §3. | Correct (`room.c` `whichway`). One subtlety the port preserves: `ahead`/`back`/`left`/`right` are recomputed only at the start of a turn, so a fight triggered on arrival escapes relative to the *previous* room. | `room.c` `whichway()`; `command7.c:185-200` | Med |
| 29 | rate() titles table. | Correct for all three axes (`novice`…`Marquis De Sade`, `serf`…`Sauron the Great`, `Polyanna`…`Mr. Roarke`); ties go to pleasure, then power. | `command6.c:145-178` | — |
| 30 | (not documented) A blocked move leaves you where you were. | A blocked move still **turns you** to face that way and recomputes the relative exits. From the start (room 22, facing north) `left` fails and leaves you facing west, so `right` (now north) fails too and turns you back; `back` then leads to the closet. Confirmed on the real binary. | `command1.c:56-59` | Med |

### 2.5 Walkthroughs

Both canonical walkthroughs are **not playable**: they use compass
verbs that do not exist (#1), a ship layout that does not exist (#2),
`take viper`/`board viper` (#15), treasure points that are not awarded
(#13), and a win condition that is not the game's (#17). The
"Grandmaster" score table (35/38/80, 215 rooms in 184 turns) cannot be
reproduced.

---

## 3. Proposed fixes to the canonical docs (not applied here)

The port does not edit canonical docs (AGENTS.md §6.2). Proposed changes
for a follow-up PR:

1. **spec.md** — replace §3 movement with the relative-only vocabulary;
   replace the object table with the `globals.c` values (the port's
   `src/engine/data/world.js` is a generated, citable transcription);
   rewrite §1 objective and §7 termination with #17–#19; replace the
   fatigue/hunger knobs with #11 and #21; document `ourclock` (#25).
2. **world-map.md** — regenerate the sector diagrams from the room
   table (airspace 69–104, ground, caves) and rename rooms to their
   in-game names; the port's `src/scene/layout.js` has a computed
   layout that can be rendered to Mermaid.
3. **walkthrough.md** — replace with the verified walkthrough in §4
   below (it ends in "You win!" on the real binary).
4. **how-to-play.md** — fix the verbs table (#1, #10, #12, #15), the
   flight keys (#25) and the win condition (#17).
5. **architecture.md** — fix the day/night pseudo-code (#20), the
   fly.c key table (#25) and the `news()` description (#21).
6. **test-scenarios.md** — scenario 2 uses `left` from room 22 facing
   north, which is blocked ("You can't go this way.") and turns you
   (#30); scenario 3's
   route and `board viper` do not exist; scenario 4's dusk text is
   wrong; scenario 5 expects `su` to accept a room as the win. The
   port's `docs/test-scenarios.md` gives corrected versions and maps
   each canonical scenario to an automated test.
7. **notes.md** — rooms 69–100 are air, 218 is a bedroom (#3, #6); the
   parser does not split on semicolons (commas and `and` only, and a
   comma before a verb starts a new command).

---

## 4. Verified walkthrough (shortest reliable line)

(The walkthroughs for players — the fastest win in about 128 commands and
the full score on all three scales — are in [walkthrough.md](./walkthrough.md).
This section is the hint planner's own, more cautious line.)

Generated by the hint planner and replayed on the real binary for
seeds 1, 7, 31, 42 and 99 (`tests/golden/walkthrough-seed*.out` all
end in `You win!`). The exact commands depend on the dice (fights,
injuries), so this is the *plan*; the per-seed command lists are in
`tests/golden/cases.json`.

**Ship (must launch before turn 31, when the hull breaks):**
`right` (16) · `right` (13) · `take amulet` · `back` (16) · `ahead`
(20) · `take laser` · `back` (16) · `left` (21) · `take knife` ·
`back` (16) · `left` (13) · `down` (11) · `right` (9) · `ahead` (1) ·
`right` (5) · `right` (7) · `launch`.

**Space:** `right` (34) · `ahead` (44) · `ahead` (64, a Cylon: win
the dogfight, or `q` and take a wound) · `ahead` (66) · `ahead` (68)
· `down` (70, over the island) · `left` (73, over the beach) · `land`
(the coral beach, 80).

**Goddess (day 1 only):** `use amulet` (it carries you to the stream,
229) · `back` (180) · `ahead` (the thermal pools, 126) · `take
goddess` · `follow` (268) · `kiss goddess` · `kiss goddess` · `love
goddess` (the medallion appears — leave it).

**Arm and descend by day:** walk east to the cottage (103 → 134 →
190): `wear laser` · `wear knife` · `take two-handed` · `take potion`;
then to the woods near the road (216) · `down` (257) · `down` (252) ·
along the tunnels to the flooded shaft (261) and wait for nightfall.

**Night:** from 252 fetch the mail and helm in the catacombs (249 →
248 → 250 → 253 → 258: put the sword down, `take`/`wear` both, take
the sword again); back to 261 · `down` · `sleep` (safe underground) ·
`down` (263) · west to the Dark Lord (266): `kill` until he is wounded
by more than a third · `back` (he takes the amulet and flees) ·
`follow` (the pit, 275) · `back` at once (you escape to 263 and the
talisman and amulet fall there) · `drink potion` if wounded · `drop
two-handed` · `take talisman` · `take amulet`.

**Finale:** `use amulet` (the stream, 229) · walk to the throne room
(180 → 126 → 181 → 230 → 267 → 268) · `take medallion` ("You are now
a wizard") · `give amulet to goddess` · `give medallion to goddess` ·
`give talisman to goddess` (the wedding) · `draw laser` · `shoot
goddess` → **You win!**

Typical length: 140–150 commands, 190–220 turns.

---

## 5. Golden transcripts

- `tests/golden/cases.json` — the input scripts (16 hand-authored
  feature cases from `scripts/make-golden-cases.mjs`, five planner
  walkthroughs from `scripts/make-walkthrough.mjs`, one dogfight probe).
- `scripts/golden-capture.mjs` — runs each case through the Debian
  binary under WSL/Linux. The binary is setgid, so `LD_PRELOAD` would be
  ignored: the script runs a plain copy with a tiny shim whose
  `getpid()` returns `$FAKEPID` (pinning `srand(getpid())`) and whose
  `getpwuid()` can report `$FAKEUSER` (to test the wizard logins).
- The dogfight's curses screen is stripped from the comparison; its
  first frame (Cylon position, torpedoes, fuel, clock) is checked
  against the engine's `FlightSim` separately.
- Re-capture after changing a case: `npm run golden` (needs WSL with
  the `bsdgames` package and `gcc`). Never edit `.out` files by hand.

---

## 6. Machines without a GPU

The ladder ([ADR-011](./decisions/011-quality-ladder.md)) is **High**
(GPU) → **Low** (automatic when the WebGL renderer is software, e.g.
SwiftShader) → **Text** (no WebGL: the scene panel shows the room name;
the game is fully playable). Measured with `scripts/perf.mjs`
(Chromium via Playwright 1.63, 1440 × 900, one room per biome; the
README has the table):

- GPU (RTX 4060 Laptop, ANGLE/D3D11): 60 fps everywhere (display cap).
- SwiftShader, before tuning: 12–25 fps, **2 fps in the rainforest**.
  Profiling by hiding scene parts: alpha-tested leaf cards cost the most
  (4 → 25 fps when hidden), then per-pixel image-based light (+50 %).
- SwiftShader, after: Low draws opaque lumpy crowns instead of leaf
  cards, a third of the ground cover, no vines or light shafts, renders
  at 0.6× and drops image-based light for a lifted ambient: **15–60
  fps** (forest 15, coast 27–33, air 29, caves 28–31, ship 40–60).
- SwiftShader after the modelled style (ADR-013), first measurement:
  13–47 fps, the dining hall slowest. Counting triangles per room found
  over-tessellation, not shading, as the avoidable cost: a 116k-triangle
  tablecloth, 11.6k-triangle dining chairs, hundreds of small rounded
  boxes at three segments per edge (588 triangles each). Fixes: sensible
  cloth and cushion resolutions, and on Low `model.js` builds every
  rounded edge with one segment and cloths and tufting at half
  resolution (`setDetail`, called by the stage per room) — the parlor
  went from 377k to about 150k triangles. Collapsing static meshes into
  one per material was tried and removed: no gain, and it re-based
  object-space patterns (wood grain). Result: **15–49 fps** (ship 24–49,
  space 40, air 28, coast 16–23, forest 15–16, caves 20–29).
- No WebGL: Text mode; `npm run smoke` checks it plays.

---

## 7. Art-direction log (what the screenshots showed, and the fix)

Every visual stage was shot with Playwright (`scripts/shots.mjs`,
contact sheets via `scripts/contact.mjs`), critiqued, fixed and shot
again. The findings that changed the renderer, in order:

| Seen | Cause | Fix |
|---|---|---|
| Ship rooms black or blown out | point lights uncalibrated, no ambient | procedural PMREM environments per mood; lights scaled by room size² |
| Floors looked like a Tron grid | panel shader seams too regular | noise-broken panel and grate families |
| Tube corridors rendered white | `material.clone()` drops `onBeforeCompile` | materials built per use through `mat()` |
| Stars like snow | point sprites with soft falloff | crisp sparse star function in the sky shader |
| Raider hidden behind the dashboard | vertical scale of fly.c rows too small | 1.35° per row, raised gauges, a target bracket |
| Coast washed out | sand albedo and exposure too high | palette, exposure 0.82, sand level |
| Lagoon water behind the camera; lookout with no sea | terrain did not dip for water | basins for lagoon/dock; sea drop below cliffs |
| Caves black even with the lantern | single-sided rock, weak lantern | double-sided rock, lantern tuned with inverse-square falloff |
| Forest thin, sky showing through | too few trees | closed canopy roof, mid-storey, darker greener fog |
| Thermal pools as a white sheet | one big water plane | separate pool discs with steam and glow |
| Canyon walls as blobs | dodecahedron rocks | noise-displaced rock faces; same for the cave-mouth cliff |
| Abyss a white blowout | the trail was a tube; the held lantern sat 0.3 m from its wall | open ledge, wall set back, layered heat-haze glows below |
| A wooden strip under the cockpit dash | unused rig lights kept their old base intensity, so `animateLights` re-lit the previous cave's lantern beside the camera | clear the base when a light is unused |
| **Every shadow crushed to black** | contrast applied as `(c − 0.5)·k + 0.5` in *linear* space clamps everything under ≈17 % sRGB | contrast as a power curve around mid-grey (`post.js`) |
| Nights pitch black below the horizon | hemisphere colours defined as dark sRGB are darker still in linear light | moonlit hemisphere and moon key raised; night grade +exposure |
| Night sea from the air as white noise | foam and ripple detail aliasing at distance | detail fades with distance; broad moon glade far away |
| Cave water looked like a sand floor | uniform lantern glow, blocky glitter | glow falls off from the viewer; glints from the lit walls ahead |
| Throne a white flare hiding the goddess | held lantern mirrored in a flat polished gold backrest | satin gold, tilted backrest, goddess seated on the throne, lit softly from in front |
| Grain crawling in the shadows | grain added in linear space | grain added in display space |
| **Owner: "almost everything is a simple polygon … the bed is a box"** | every set piece was a bare primitive | the modelled style (ADR-013): a stateroom built both ways (A realistic-warm, B stylised), A chosen, then rolled out to all 31 ship rooms, the island's buildings and interiors, the caves and the forest |
| **Owner: the stairs in room 16 hit the ceiling** | stairs were drawn into a closed shell | floors and ceilings take polygon holes; every up/down exit on the ship is a real stair or torn opening with the deck beyond built and lit |
| The space window on the wrong wall facing east or west | the wall table was ordered ahead/left/back/right while the facing maths is ahead/right/back/left | one `REL` order for both |
| Closet robes as flat coloured panels facing the viewer | garments hung along the rail | hung across it, shoulder to hem, with folds deepening toward the hem |
| Rifles sticking out of the armory racks | Euler XYZ applies the turn about y first | `rotation.order = 'YXZ'`: stand the rifle up, then turn it |
| Dashboard gauges half hidden | the dash top and a glare shield crossed the display | display raised; the glare shield overhangs it from beyond |
| Gold "confetti" floating in the dark mines | ore veins in the stone shader glowed, so on unlit rock they hung in the air | veins are polished metal with a faint glow |
| Black speckle on coarse stone | the stone bump's finite difference grows with its frequency | bump scaled down above `uP.x = 1` |
| Owner: people "move like robots"; the running pilot "very strange" | sinusoidal hip/knee angles slide the feet | foot-planted gait with two-bone IK (`gait.js`); the wounded drag a stiff leg; GIFs timed from the game clock (the first ones played 2.3× fast) |

Sameness: space rooms share one original description, so they share a
look (planet and carrier vary); `tests/composer.test.js` keeps the
number of distinct looks per biome above a floor.
