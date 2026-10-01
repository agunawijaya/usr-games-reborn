# Prompt 03 — Hush the Wumpus (inspired by "wump", BSD games, after Gregory Yob's Hunt the Wumpus, 1973)

> Run in Claude Code from `E:\Projects\usr-games-reborn`, AFTER prompts 00, 00a and 01 are done.
> Wave 1: runs in parallel with 02 (atc) and the other wave-1 games. **You do NOT own `packages/kit`**
> — the atc session does; if you need a kit change, write it in your report instead of making it.
> Recommended: Claude Opus 5.5, effort xhigh. **Owner checkpoint** after the hero frames (§10.1).

## 0. Read first
1. `CLAUDE.md`, `AGENTS.md`, `.claude/skills/retro-reborn-builder/SKILL.md`, `docs/ARCHITECTURE.md`,
   the ADRs, the kit's public API, the progression rules, prompt 00a §5 (poster contract) and
   `docs/templates/`. In your first message summarise the hard rules in five lines, name this prompt,
   state that you do not own the kit, and name your dev port (**5274**).
2. How native games integrate (manifest, emblem, `demo`, `poster`, `reportResult` with
   `presentation: 'game'`, share, pause-menu items, appearance, game-scoped e2e). Never import from
   another game's folder.
3. Reference (READ-ONLY, outside the repo): `E:\Projects\BSDGames\BSDGames-master\wump` — `wump.c`,
   `wump.info`, `wump.6`. BSD-licensed: you may adapt its rules and cave algorithm with attribution
   (keep the notice in `LICENSES/`; verify the contributor named in the file header and credit them in
   `CREDITS.md` together with Gregory Yob and People's Computer Company, 1973). Never reuse its
   message strings — every line of UI text is ours.
4. This whole prompt; §14 overrides earlier sections.
5. Title rules: `title: "Hush the Wumpus"`, `inspiredBy: { program: "wump", originalTitle:
   "Hunt the Wumpus", uiTitle: "the 1973 cave-hunting classic", year: 1973 }`. "Wumpus" is the
   creature's name and may appear in UI.

## 1. The pitch
- **Hooks (verified by the architect; re-verify and record in NOTES.md):**
  - The wumpus's temper is decided by an operator-precedence bug. After a missed shot the code meant
    "move with a growing chance, 12 on easy and 9 on hard", but C parses the line so that on easy the
    wumpus moves on every fourth miss like clockwork, and on hard it simply moves at least half the
    time.
  - When a missed shot wakes the wumpus and it walks into your room, the game prints your gruesome
    end — and then lets you keep playing.
  - The code has a whole "magic tunnel" feature (shimmering walls, teleport, glowing arrows) that can
    never happen: the cave generator never builds one.
  - The manual says the default cave has 25 rooms; the code builds 20. Pits can land on top of each
    other, so the cave may hold fewer pits than it announces.
  - Tunnels can be one-way on purpose — the manual boasts about it.
  - Gregory Yob, who wrote the 1973 original, told the story of walking into a Stanford conference and
    finding every terminal running Wumpus, the floor covered in scraps of paper with scrawled numbers
    and lines. He also suggested a variant where the wumpus avoids pits and bats can carry *it*.
- **What Hush the Wumpus adds:** that scrap of paper becomes the game — a map that draws itself as you
  explore, a notebook for your deductions, senses you can see and hear, a sleep dart you steer
  room by room with the camera riding along, magic tunnels that finally exist, and Yob's own
  wish-list variant as a campaign chapter.
- **Tagline:** "Follow the stink. Steer the dart. Let it sleep."
- **Teaser:** "Somewhere in the dark, a huge, grumpy, very smelly wumpus is snoring. Map the cave by
  draft, rustle and whiff, dodge the pits and the bats, then thread a sleep dart through five tunnels
  to hush it for good. The 1973 cave hunt that started it all, redrawn by lantern light."
- Category `strategy`, directory `/usr/games/strategy`, 1 player, sessions 3–10 minutes, daily: yes.

## 2. What the original does (verify every point)
- Cave: 20 rooms by default (10–250 allowed), 3 tunnels per room by default (at least 2; the cave
  "collapses" if tunnels exceed `rooms - rooms/4` or 25). Generation: a guaranteed ring of links using
  a random hop whose `gcd` with the room count is 1, plus random extra links that are reciprocated
  only half the time — hence one-way tunnels. Tunnels are sorted for display.
- Hazards: 3 bat rooms, 3 pit rooms (hard: each gets `random(rooms/2) + 1` more; neither may exceed
  half the rooms). The wumpus starts anywhere (it ignores hazards: "sucker feet", too heavy for bats).
  The player never starts in the wumpus room; on hard, never within two rooms of it.
- Senses each turn: bats in an adjacent room (rustle), a pit adjacent (draft), the wumpus within
  **two** rooms (smell).
- Move: only along an existing tunnel from your room. Hitting a wall has a 1-in-6 chance to wake the
  wumpus, which then moves one tunnel (and may walk into you).
- Entering: the wumpus room ends the game; a pit room ends it unless a 2-in-12 chance saves you; a
  bat room carries you to a random room (possibly into another bat room, a pit or the wumpus).
- Shoot: list up to 5 rooms. Each valid hop moves the dart; an invalid hop sends it down a random
  tunnel and ends the flight. After the 3rd room there is a 20 % chance the string breaks; after the
  4th a 60 % chance it wavers and drops. Hit the wumpus: you win. Land in your own room: you lose.
  Out of darts after a miss: you lose. A miss may wake the wumpus (see the precedence bug above).
- Quirks to confirm: the precedence bug; being "eaten" after a miss without the game ending; magic
  tunnels as dead code; the random-deflection message compares a tunnel index with a room number;
  pit placement using `&&` where `||` was meant; 25 vs 20 rooms; `MAX_ARROW_SHOT_DISTANCE` unused;
  the occasional reply to nonsense input in Spanish.

## 3. Game design

### 3.1 Reframe (all ages, owner-approved tone: comic but with a real sense of loss)
You are a cave explorer with a quiver of **sleep darts**. The goal is to **hush** the wumpus — put it
to sleep — not to kill it. The darts keep every rule of the original's crooked arrows.

| Original end | Hush the Wumpus |
|---|---|
| Walked into the wumpus | It bowls you over, slobbers on you, and you flee the cave empty-handed |
| Fell into a pit | Your rope snags on the edge; you are hauled back to the entrance, bruised, expedition over |
| Survived a pit (2 in 12) | You grab a ledge — a heart-stopping wobble, then you climb back |
| Shot yourself | Your own dart ricochets; you nod off; the wumpus finds you snoring and carries you out |
| Last dart missed | The wumpus hears the empty quiver rattle and comes looking; you run |
| Hit the wumpus | It yawns hugely, turns three times, curls up and snores; you tiptoe out |

The loss moment must feel like a loss: the lantern gutters and dies, the self-drawn map crumples at
the edges, a low, sad two-note motif — then a calm results card. Comic, never graphic: no blood, no
teeth closing on you, no falling scream.

### 3.2 Kept
The cave algorithm (including one-way tunnels), hazard counts and placement rules, senses with the
two-room smell, bat carries, pit survival chance, dart flight rules and odds, wall bumps that can wake
the wumpus, the custom-cave options. One action per turn: move or shoot.

### 3.3 Changes and why
| Original | Hush the Wumpus | Why |
|---|---|---|
| Room numbers typed in | Click a tunnel mouth or a room on the map; keyboard picks exits by number | Direct manipulation |
| No map; players drew on scraps of paper | The map draws itself as you explore, as ink on paper (light) or chalk lines in the dark (dark) | Yob's scrap paper, built in |
| No notes | A deduction notebook: mark any room safe, pit?, bats?, wumpus?; optional "Scout" assist auto-marks rooms the evidence proves safe | Turns it into a clear logic puzzle |
| Dart path typed | Drag the dart's path room by room on the map (max 5); known hops solid, unknown hops dashed with their risk | Informed risk |
| Precedence-bug temper | **Standard rules** use the intended rule (growing chance, threshold 12 easy / 9 hard); **Classic rules** toggle reproduces the original exactly, bug included | Honest and faithful |
| Eaten but still playing | Fixed: the wumpus reaching you always ends the run | Obvious bug |
| Magic tunnels never exist | Magic tunnels are real in some caves: shimmering tunnels that drop you (or your dart) in a random room | Fulfil the dead feature |
| Pits stacking | Counts are exact in Standard rules | Fair |
| Smell up to 2 rooms, unexplained | The smell is visible as green wisps whose density tells "1 room" vs "2 rooms" in Standard rules; Classic keeps the single ambiguous whiff | Information over luck, with a pure option |

### 3.4 Modes
1. **Tutorial** (under 90 s): a 10-room cave — a draft, a rustle, a whiff, one safe dart.
2. **Expeditions** (campaign), 12 caves, each adding one idea: the 1973 classic (the dodecahedron,
   20 rooms × 3 tunnels, a tribute to Yob's original topology) · the BSD cave (random, one-way
   tunnels) · more bats · more pits · magic tunnels · four tunnels per room · the hard cave · a
   restless wumpus (wall bumps wake it more easily) · **Yob's wish** (the wumpus avoids pits and bats
   can carry it one room — possibly into yours) · a 60-room labyrinth · darkness (senses only, no
   auto-map; your notebook is your map) · the deep cave (120 rooms). Three stars each: hushed · under
   a move target · no bat rides or darts to spare (pick one per cave).
3. **Daily Cave:** one seeded cave per day for everyone. Share text example:
   `Hush the Wumpus #42 · hushed in 14 moves · 🎯2 · 🦇0 · 💤` (no URL).
4. **Custom Cave:** the original's options as sliders (rooms, tunnels, bats, pits, darts, hard) with
   the same limits; when a setting breaks a limit, a playful one-line refusal in our own words, in
   the spirit of the original's jokes (never its wording).
5. **Rules toggle:** Standard / Classic in every mode except Daily (Standard).

### 3.5 The wumpus
An original character drawn in code: huge, round, shaggy, sleepy-eyed, with the legendary sucker feet
and a faint green haze of stink. It should be lovable and a little ridiculous, never scary. It has
idle, grumpy-awake, charging, yawning and asleep poses.

### 3.6 Scoring and achievements
Score = hushed (base) + darts left + rooms unexplored bonus − moves − bat rides; records per cave.
About 12 packages, for example: first-hush · one-dart-wonder (hush with your first dart) ·
five-room-thread (hush through a full 5-room path) · scrap-paper (finish without Scout assist) ·
bat-taxi (survive three bat rides in one run) · ledge-grabber (survive a pit) · shimmer (use a magic
tunnel) · classic-chaos (win on Classic rules) · yobs-wish (finish that chapter) · lights-out (finish
the darkness cave) · deep-diver (finish the deep cave) · daily-regular (7 Daily Caves).
XP through `reportResult` per the progression rules.

## 4. Interaction
- **Mouse:** click a neighbouring room (on the map or a tunnel mouth in the room view) to move. Press
  and hold **Aim** (or right-click) to enter aim mode, then click rooms one by one to lay the dart's
  path; release/confirm to shoot; Escape cancels. Right-click a room on the map for notebook marks.
- **Keyboard:** `1`–`9` pick exits in the order shown; `A` aim, then exit numbers hop by hop from the
  dart's current room, Enter shoots; `N` notebook mode with arrows to move over rooms and letters for
  marks (`S` safe, `P` pit, `B` bats, `W` wumpus); `M` toggles map view; Esc pauses.
- Illegal clicks (a room not adjacent, a one-way tunnel the wrong way) shake gently with a one-line
  reason. Never a modal.

## 5. Screens
1. **Title / game menu** — "← Back to the Hall"; live attract scene (the wumpus snoring in a
   lantern-lit chamber); Continue · Expeditions · Daily Cave · Custom Cave · Tutorial · Records · How
   to play · Settings.
2. **Tutorial.** 3. **Expedition map** (12 caves as a descending trail of lantern dots).
4. **Play:** two linked views on one screen — the **room view** (the chamber you stand in, its tunnel
   mouths labelled with room numbers and your notebook marks, the senses shown as effects) and the
   **map** (every visited room and known tunnel; unknown tunnels as stubs; one-way tunnels as
   arrows). Side strip: darts left, moves, notebook legend, sense log (last 5 turns, in plain words).
5. **Dart flight** — the camera rides the dart through the tunnels (§6), then cuts back.
6. **Results** (win or loss) — card with the full cave revealed on the map (where everything really
   was), stats, and: Play again (R) · Game menu · Back to the Hall (H).
7. **Records.** 8. **Settings.**

## 6. Art direction — "Scrap Paper / Lantern Dark"
- **Light — Scrap Paper:** the map is a real-looking notebook page: squared paper, ink lines that
  draw themselves with a slight hand wobble as tunnels are discovered, pencil marks for notebook
  notes, a faint coffee ring, room numbers in a hand-lettered style. The room view is a warm
  illustrated cave cross-section in soft ochres and slate, like a field sketch come to life.
- **Dark — Lantern Dark:** the cave in near-darkness; your lantern lights the current chamber with a
  warm pool, visited rooms glow as faint chalk marks, unknown tunnels fade into black. Senses: pit
  drafts as drifting dust streams pulled toward a tunnel mouth; bats as a rustle of silhouettes and a
  sound panned toward their tunnel; the wumpus's stink as green wisps curling out of a tunnel.
- **Signature moment — the dart ride:** when you shoot, the camera follows the dart through each
  tunnel in first person, rushing past the walls, a room-number sign flashing at every hop, the string
  twang if it breaks, the wobble if it wavers; a hit ends with the camera arriving on the wumpus
  mid-yawn, its eyes closing, the snore starting. Then the whole cave map lights up room by room.
- Readability: room numbers ≥ 16 px at 1280×720; notebook marks differ by shape and letter, not only
  colour; senses always also appear as text in the sense log.
- Rendering suggestion (decide in an ADR): Canvas 2D for the map, WebGL (three.js, lazy) for the room
  view and the dart ride. Zero raster; paper grain, rock and fur are procedural.
- Sound (synthesised): cave drip ambience, drafts as filtered noise, bat flutter, the wumpus's snore
  and grumble, dart twang, the sad two-note loss motif, a lullaby-like win chime. Quiet by default.
- `demo(seed)`: a silent run with the Scout bot exploring and shooting. `poster`: the wumpus asleep
  in a lantern-lit chamber with the map sketched around it.
- 60 fps at 1920×1080, including the dart ride in a 120-room cave.

## 7. Settings
Rules (Standard/Classic) · Scout assist · auto-map (off only in the darkness cave) · camera ride on/off
(off = a quick map animation) · sound · reduced motion (from the kit) · Forget my data.

## 8. Controls table
Full table in HOW-TO-PLAY.md: every mouse and keyboard action, notebook marks, aiming.

## 9. Engineering and tests
- **Pure engine** (TypeScript, no DOM): cave generation (the original algorithm, seeded with the kit
  RNG), hazard placement (Standard and Classic), senses, move, bat carry, pit chance, dart flight,
  wumpus temper (intended and Classic-bug versions), magic tunnels, Yob's-wish variant, scoring, daily
  generation.
- **Faithfulness tests:** one per rule in §2; property tests that every generated cave is connected
  from the start room in Standard rules (and a test that documents Classic behaviour); the precedence
  bug reproduced exactly in Classic (a table of miss sequences and move decisions); the 20 vs 25 note.
- **Scout bot** (logical deduction + risk estimate): used for `demo`, the Scout assist and balance.
  Targets, locked as tests with tolerances over 1 000 seeds: tutorial winnable by the bot 100 %;
  campaign cave 1 ≥ 85 %, hard cave 45–65 %, deep cave 30–50 %; no Daily Cave where the bot's
  first move is forced into an unknown hazard more than 10 % of the time.
- Content checks: no original message strings (provenance test against a list extracted into a
  scratch file outside the repo), deny-list and trademark guards green.
- Game-scoped Playwright: tutorial; mouse and keyboard-only runs; notebook; aiming a 5-room path;
  bat carry; pit ledge; win and loss flows; Classic toggle; daily share text; every navigation exit
  path. Screenshots 1280×720 and 1920×1080, light and dark.

## 10. Staged workflow
1. **Hero frames — OWNER CHECKPOINT.** Build three live scenes (not mockups), each in light and dark
   at 1920×1080, into `games/wump/docs/media/hero/`: a) the play screen mid-expedition with room view,
   half-drawn map, notebook marks and a green whiff from one tunnel; b) the dart ride mid-flight;
   c) the win moment — the wumpus curling up asleep as the full map lights up (bonus: the loss card
   with the guttering lantern). Critique at least five rounds against "would this be the README hero
   image?" Then **stop and wait for the owner.**
2. Engine + faithfulness tests + Scout bot + balance → NOTES.md.
3. Wireframes with full input. 4. Art pass, both appearances. 5. Modes. 6. Sound, the dart ride, the
   win and loss moments. 7. Critique loop (≥ 3 rounds). 8. Hall integration, docs, final checks.

## 11. Documentation
ABOUT, HOW-TO-PLAY (controls table, notebook, senses explained), ARCHITECTURE (module map, cave
generator, turn state machine, where visuals and sounds live, how to add a campaign cave),
CHANGES-FROM-ORIGINAL (table like §3.3 plus every quirk's verdict), NOTES (verified facts, Yob's
story in our words with its source, simulations). Mermaid only. ADRs for rendering and the two rule
sets.

## 12. Content rules
All ages. The wumpus is hushed, never killed, hurt or eaten from; the player is never hurt on screen.
UI copy never says "kill", "dead", "death", "eat you" or "shoot" at a creature — use "dart", "hush",
"send to sleep", "flee". Our own words for every line.

## 13. When you finish
Report: what you built; every quirk's verdict; simulation numbers; fps; deviations; known gaps; kit
changes you need (not made); exact commands to run.

## 14. Hall integration
Manifest per §0.5 with emblem (a round shaggy silhouette with two sleepy eyes, as SVG path data),
`demo`, `poster`, results with `presentation: 'game'`, share via the kit, daily numbering from the
kit, pause-menu items (Rules, Scout assist). Ship through the catalog and the docs script at the very
end: re-read the files, change only the `wump` line, status `shipped`.

## 15. Parallel session rules
- Your folder: `games/wump/`. Do not modify `packages/kit` (the atc session owns it in wave 1).
- Dev port 5274; Playwright config inside `games/wump/`. No repo-wide e2e or screenshot runs while
  other sessions run; never stop processes you did not start; format only your own files.
- Ask the owner before installing dependencies (three.js is expected; say so before installing).
- No commits, no pushes.
