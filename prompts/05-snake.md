# Prompt 05 — Full Pockets (inspired by "snake", BSD games)

> Run in Claude Code from `E:\Projects\usr-games-reborn`, AFTER prompts 00, 00a and 01 are done.
> Wave 1: runs in parallel with 02 (atc), 03 (wump) and 04 (worm). **You do NOT own `packages/kit`**
> (the atc session does); list any kit change you need in your report.
> Recommended: Claude Opus 5.5, effort xhigh. **Owner checkpoint** after the hero frames (§10.1).

## 0. Read first
1. `CLAUDE.md`, `AGENTS.md`, `.claude/skills/retro-reborn-builder/SKILL.md`, `docs/ARCHITECTURE.md`,
   the ADRs, the kit's public API, the progression rules, prompt 00a §5 (poster contract),
   `docs/templates/`. In your first message summarise the hard rules in five lines, name this prompt,
   state that you do not own the kit, and name your dev port (**5276**).
2. How native games integrate (manifest, emblem, `demo`, `poster`, `reportResult` with
   `presentation: 'game'`, share, pause-menu items, appearance, game-scoped e2e). Never import from
   another game's folder.
3. Reference (READ-ONLY, outside the repo): `E:\Projects\BSDGames\BSDGames-master\snake` —
   `snake/snake.c`, `snake/snake.6.in`, `snscore/snscore.c`. BSD-licensed: adapt rules with
   attribution (notice in `LICENSES/`, credit the authors named in the file headers in `CREDITS.md`).
   Never reuse its message strings.
4. This whole prompt; §14 overrides earlier sections.
5. Title rules: `title: "Full Pockets"`, `inspiredBy: { program: "snake", originalTitle: "snake",
   uiTitle: "the Berkeley snake-and-treasure game", year }` — take the year from the source history
   or reliable references; omit it if you cannot verify it.

## 1. The pitch
- **Hooks (verified by the architect; re-verify and record in NOTES.md):**
  - **The snake gets bolder the richer you are.** Its pull toward you is weighted by your loot; with
    empty pockets that weight is zero, so a brand-new player is never chased head-on. The code even
    admits "this algorithm has bugs; otherwise the snake would get too good."
  - **It is turn-based.** The snake takes exactly one step for each of yours. You can stop and think
    forever.
  - **The snake winks at you** when it catches you on a run that beat your personal best.
  - **A lottery on capture:** when caught, the game rolls a digit; if it matches the last digit of your
    cash, you are thrown clear with a "bonus" and your warp penalties are refunded.
  - Warping costs 10 % of your loot each time, so you can end up owing money.
  - The money value per pickup comes from a hyperbola "derived by feel", and boards smaller than 4×4
    are banned because a 3×3 game lets you win infinite money.
  - User ids 0 and 1 (the system accounts, including root) can never record a score.
- **What Full Pockets adds:** a sly, characterful snake you can read — its boldness visible as your
  pockets fill — a clear look at where it might strike next, a push-your-luck run through chambers
  where every exit asks "bank it or go deeper?", and all the original's odd charms kept on purpose.
- **Tagline:** "Grab the glints. Mind the snake. Know when to leave."
- **Teaser:** "A treasure garden, a door, and one very interested snake. Every coin you pocket makes it
  bolder; every step you take, it takes one too. Bank your haul at the door — or stay for one more
  shiny thing. Turn-based nerve, straight from a Berkeley terminal."
- Category `arcade`, directory `/usr/games/arcade`, 1 player, sessions 3–10 minutes, daily: yes.

## 2. What the original does (verify every point)
- Board defaults to the screen size; the minimum edge is 4. You, one treasure, one exit and a snake of
  six segments start on random distinct cells (the top-left corner strip is reserved for the money
  display).
- Turn-based: each of your steps (8 keys incl. vi keys) is followed by one snake step. Count prefixes
  repeat a move; capital letters jump to the treasure's row/column or to an edge, one step at a time
  with the snake moving each step; `.` repeats.
- Treasure: loot += 25 per pickup; displayed cash = chunk × (loot − penalty) / 25 where chunk comes
  from the hyperbola on the shorter board edge (about $25 at the default size).
- Snake movement: weighted random over 8 directions; the direction most toward you gets weight
  `loot/10`, its previous direction gets `+loot/20`, other legal directions 1; it never steps onto
  the treasure or the exit; borders block it.
- Capture: if any segment (or the tail's previous cell) is on you. Then the snake "surrounds" you, a
  digit is rolled; match the last digit of your cash → bonus warp (penalties refunded), otherwise the
  game ends ("eaten", or in debt if penalties exceed loot).
- Warp (`w`): teleport to a random cell; penalty += loot / 10.
- Peek (`p`/`d`): if the treasure or exit is nearly aligned with you, arrows draw toward it.
- Exit: step on `#` to win and bank your cash. A score file keeps per-user bests and the all-time
  champion; the snake winks if you beat your best.

## 3. Game design

### 3.1 Reframe (all ages)
You are a treasure-seeker in a sunken garden guarded by a big, vain, lovable snake who adores shiny
things. Money becomes **glints** (gems and coins, never real currency). Being caught: the snake coils
around you, your pockets spill, the glints roll away, you scramble out empty-handed. It must feel
like a loss — the spill and the snake's smug little grin — but nothing violent.

### 3.2 Kept
Turn-based steps, the snake's six segments and its exact weighting (boldness grows with your loot),
the snake avoiding treasure and exit, pickup value via the chunk hyperbola, warp with the 10 %
penalty (debt included), peek, exit-to-bank, the capture lottery, the wink.

### 3.3 Changes and why
| Original | Full Pockets | Why |
|---|---|---|
| Boldness hidden in code | **Boldness meter** on the snake: its eyes and frill brighten as your pockets fill; tooltip explains | Make the hidden rule readable |
| No idea where it goes next | **Strike preview** (toggle): the cells the snake can reach next turn shaded by likelihood | Information over luck |
| Count prefixes, capital jumps | Click a cell in a straight line to walk there step by step (the snake moves each step); a preview shows the path; the classic keys still work | Same power, easy to learn |
| Capture lottery as a flash of a digit | **Lucky Break:** a visible digit wheel against your glint count's last digit; 1 in 10 escapes | Keep the charm, show the odds |
| One board, exit ends everything | **Runs:** a chain of chambers; each exit offers *Bank* (end the run, keep everything) or *Deeper* (next chamber: richer glints, a bolder snake, new obstacles) | Push-your-luck structure |
| Wink only on a beaten record | Kept, and celebrated on the results card | Charm |
| Scores in a shared file, root excluded | Local records; a hidden achievement nods to the root rule | Wink to the original |

### 3.4 Modes
1. **Tutorial** (under 90 s): step, grab, watch the snake answer, peek, bank at the door.
2. **Runs:** up to 10 chambers per run; chamber types include open garden · hedges · pools the snake
   swims through faster · narrow corridors · two treasures at once · a sleeping snake that wakes on the
   third pickup · a mirror chamber where peek always works. Each chamber's glints are worth more; the
   snake's base boldness rises. Score = banked glints.
3. **Classic:** one chamber with the original rules and the board size slider (minimum 4, chunk value
   from the original hyperbola shown live).
4. **Daily Run:** a seeded run of 5 chambers for everyone. Share example:
   `Full Pockets #42 · banked 💎1,240 at chamber 4 · 🍀1 · 😉` (no URL).

### 3.5 Scoring and achievements
About 12 packages, for example: first-glint · banked (first bank) · deep-pockets (bank after chamber
10) · lucky-break (win the capture wheel) · winked-at (get the wink) · in-the-red (end a Classic game
in debt) · no-warp-run · peek-a-boo (use peek 20 times) · snake-charmer (finish a chamber where the
snake never came within 2 cells) · greedy-guts (stay in one chamber for 15 pickups) · root-denied
(hidden: play as a user named "root") · daily-regular (7 Daily Runs). XP through `reportResult`.

## 4. Interaction
- Keyboard: 8 directions (arrows + numpad, or `QWEADZXC`), the classic vi keys `hjkl yubn` for
  the crowd; number prefixes and `.` work as in the original; `W` warp (with confirm showing the
  penalty); `P` peek; `B` bank when on the door; Esc pauses.
- Mouse: click an adjacent cell to step; click a cell in a straight line to walk there step by step
  (preview first, confirm on second click); right-click the snake for its boldness tooltip.
- Illegal moves (into a wall or hedge) bump gently and cost no turn.

## 5. Screens
Title / game menu ("← Back to the Hall", live attract garden with the snake gliding) · Tutorial ·
Run map (the chambers as a descending garden path) · Play (board centred; top bar with Game menu,
pockets, chamber, boldness, pause "Esc"; side panel with peek, warp, strike preview toggle) · Bank or
Deeper choice card · Capture (the coil, the spill, Lucky Break wheel) · Results (Play again (R) · Game
menu · Back to the Hall (H)) · Records · How to play · Settings.

## 6. Art direction — "Sun Garden / Moon Garden"
- **The snake:** an original character — long, glossy, patterned scales, a tiny crown-like frill, big
  expressive eyes; vain, sly, funny. It glides smoothly between cells (turn-based logic, animated
  motion). Its frill and eyes brighten with boldness. Six segments, but drawn as one sinuous body.
- **You:** a small explorer with a satchel that visibly bulges as it fills.
- **Glints:** faceted gems and coins that sparkle; value tiers by shape and colour.
- **Light — Sun Garden:** a sunken stone garden at noon: mossy flagstones, hedges, lily pools,
  warm sand and leaf-green, crisp shadows.
- **Dark — Moon Garden:** the same garden by moonlight: blue-silver stone, glow-worm lanterns, the
  glints catching light like stars, the snake's eyes glowing.
- **Signature moments:** (1) **the coil** — on capture the snake wraps around you in a smooth spiral,
  your satchel bursts and the glints scatter across the flagstones, then the Lucky Break wheel
  spins; (2) **the bank** — stepping on the door pours the satchel into a vault counter with a
  cascade of glints and the snake sulking in the corner; (3) **the wink**.
- Readability: cells ≥ 32 px at 1280×720 on default boards; the strike preview uses pattern + tint.
- Zero raster; procedural stone and scales. Canvas 2D or WebGL (decide in an ADR). 60 fps at
  1920×1080.
- Sound (synthesised): footstep taps, glint chimes rising with pocket size, snake hiss that thickens
  with boldness, the spill cascade, the wheel ticks, a cheeky wink "ting". Quiet by default.
- `demo(seed)`: a bot playing a run. `poster`: the snake coiled around a heap of glints in moonlight,
  one eye winking.

## 7. Settings
Strike preview on/off · board size (Classic) · classic keys hints · sound · reduced motion · Forget my
data.

## 8. Controls table
Full table in HOW-TO-PLAY.md, including the classic keys, counts and `.`.

## 9. Engineering and tests
- Pure engine (no DOM): board, placement rules, turn order, snake weighting (exact), capture incl. the
  tail's previous cell, lottery, warp penalty and debt, peek alignment rule, chunk hyperbola, run
  generation and chamber types, scoring. Seeded with the kit RNG.
- Faithfulness tests per rule in §2, including: at zero loot the snake never picks the straight-toward
  direction; the 3×3 ban; debt display; the wink condition.
- Bots: a cautious and a greedy bot for `demo` and balance. Targets over 1 000 seeds: the cautious bot
  banks in chamber 1 ≥ 95 %; the greedy bot reaches chamber 5 in 30–50 % of runs; the Daily Run's
  first chamber is never forced into capture within 3 steps.
- Provenance and content guards green (no "money", "cash", "eaten" or "kill" in UI copy; use glints,
  caught, scramble).
- Game-scoped Playwright: tutorial, keyboard-only run with counts, mouse walk with preview, warp
  confirm, capture with Lucky Break (seeded both ways), bank and deeper, wink, daily share text, all
  exit paths. Screenshots 1280×720 and 1920×1080, light and dark.

## 10. Staged workflow
1. **Hero frames — OWNER CHECKPOINT.** Three live scenes at 1920×1080, light and dark, into
   `games/snake/docs/media/hero/`: a) a chamber mid-run with a bulging satchel, a bold snake and the
   strike preview; b) the coil-and-spill capture with the Lucky Break wheel; c) the bank cascade with
   the sulking snake (bonus: the wink). Critique ≥ 5 rounds ("README hero image?"). **Stop and wait
   for the owner.**
2. Engine, tests, bots → NOTES.md. 3. Wireframes with input. 4. Art pass both appearances. 5. Modes.
6. Sound and moments. 7. Critique loop (≥ 3 rounds). 8. Hall integration, docs, checks.

## 11. Documentation
ABOUT, HOW-TO-PLAY, ARCHITECTURE (engine, turn loop, snake AI, chamber generator, how to add a chamber
type), CHANGES-FROM-ORIGINAL (table like §3.3 plus every verified fact), NOTES. Mermaid only.

## 12. Content rules
All ages. The snake catches, never eats or bites; glints, never money; no betting — the Lucky Break is
a free chance with nothing staked. Our own words for every line.

## 13. When you finish
Report: what you built; verified facts; bot numbers; fps; deviations; known gaps; kit changes you need
(not made); exact commands to run.

## 14. Hall integration
Manifest per §0.5 with emblem (a coiled snake around a gem, SVG path data), `demo`, `poster`, results
with `presentation: 'game'`, share via the kit, daily numbering from the kit, pause-menu items (Strike
preview). At the very end: re-read the catalog and docs, change only the `snake` line, status
`shipped`.

## 15. Parallel session rules
Your folder: `games/snake/`. No kit changes. Dev port 5276; Playwright config inside your folder; no
repo-wide e2e or screenshot runs while others run; never stop processes you did not start; format
only your own files; ask before installing dependencies. No commits, no pushes.
