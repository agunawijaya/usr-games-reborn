# Prompt 04 — Noodle Nine (inspired by "worm", Michael Toy, UC Santa Cruz, BSD games)

> Run in Claude Code from `E:\Projects\usr-games-reborn`, AFTER prompts 00, 00a and 01 are done.
> Wave 1: runs in parallel with 02 (atc), 03 (wump) and 05 (snake). **You do NOT own `packages/kit`**
> (the atc session does); list any kit change you need in your report.
> Recommended: Claude Opus 5.5, effort xhigh. **Owner checkpoint** after the hero frames (§10.1).

## 0. Read first
1. `CLAUDE.md`, `AGENTS.md`, `.claude/skills/retro-reborn-builder/SKILL.md`, `docs/ARCHITECTURE.md`,
   the ADRs, the kit's public API, the progression rules, prompt 00a §5 (poster contract),
   `docs/templates/`. In your first message summarise the hard rules in five lines, name this prompt,
   state that you do not own the kit, and name your dev port (**5275**).
2. How native games integrate (manifest, emblem, `demo`, `poster`, `reportResult` with
   `presentation: 'game'`, share, pause-menu items, appearance, game-scoped e2e). Never import from
   another game's folder.
3. Reference (READ-ONLY, outside the repo): `E:\Projects\BSDGames\BSDGames-master\worm` — `worm.c`
   and `worm.6`. BSD-licensed: adapt rules with attribution (notice in `LICENSES/`, credit Michael Toy
   in `CREDITS.md`; if you mention his other work, cite a source). Never reuse its message strings.
4. This whole prompt; §14 overrides earlier sections.
5. Title rules: `title: "Noodle Nine"`, `inspiredBy: { program: "worm", originalTitle: "worm",
   uiTitle: "the Berkeley growing-worm game", year: 1980 }` — verify the year from the source history
   or reliable references; if you cannot, omit the year rather than guess.

## 1. The pitch
- **Hooks (verified by the architect; re-verify and record in NOTES.md):**
  - **The worm only hurries when you do.** Left alone it creeps one cell per second; every key press
    moves it immediately. The player, not a clock, sets the speed.
  - **An accidental combo system.** The score adds the worm's *whole pending growth* each time it
    eats, not the digit it ate. Eat a 9, then quickly a 5 while still growing, and the 5 is worth far
    more than 5. Nobody designed it; the formula just does it.
  - **A win screen almost nobody saw:** fill the entire box with worm and the game says you won.
  - Capital H/J/K/L dash several cells at once and stop early if they hit a number; the manual's
    "9 for HL and 5 for JK" matches the code only once you count the first step.
- **What Noodle Nine adds:** the accident becomes the heart of the game — a visible **chain** when you
  bite again while still digesting — and your pace becomes a risk dial: rush for a bigger multiplier,
  creep to stay safe. Plus hand-built gardens, fill-the-box puzzles and a daily board.
- **Tagline:** "Eat the numbers. Chain the bites. Fill the box."
- **Teaser:** "A squishy, glowing noodle that only moves as fast as you dare. Gobble digits 1 to 9 to
  grow, bite again before you finish digesting to chain huge scores, and see if you can do what almost
  nobody did on a Berkeley terminal: fill the whole box."
- Category `arcade`, directory `/usr/games/arcade`, 1 player, sessions 2–10 minutes, daily: yes.

## 2. What the original does (verify every point)
- Box with a border; the worm starts 7 long (configurable), laid out in rows; head `@`, body `o`.
- One digit 1–9 on the board at a time, placed on a random empty cell.
- Idle tick: one move per second in the last direction; any movement key moves at once and re-arms
  the tick. Non-movement keys do nothing (they just re-arm the tick).
- Eating digit *d*: growth += d; score += growth (pending growth, the combo accident); a new digit
  appears; any dash stops.
- Dash: H/L move 1 + 8 cells, J/K 1 + 4 cells, one per frame, stopping on a digit.
- Ends on hitting the border or itself. "You won" when the worm fills the box.
- Score shown top right.

## 3. Game design

### 3.1 Kept
Grid, digits 1–9 with growth equal to the digit, the pending-growth score formula, your-input-moves-
you timing (in Classic tempo), dash, wall and self collisions, the fill-the-box win.

### 3.2 Changes and why
| Original | Noodle Nine | Why |
|---|---|---|
| Score formula is an invisible accident | **Chain:** bites while still growing show "Chain ×n" and the score popup shows the pending-growth sum; digestion is visible as bulges travelling down the body | Make the hidden depth readable |
| Pace = whoever presses keys faster | **Tempo dial:** the worm creeps on its own; holding or tapping a direction rushes it. A tempo meter (creep → stroll → rush → zoom) multiplies points ×1 / ×1.5 / ×2 / ×3 | Speed becomes a choice with risk |
| One empty box | Gardens with rocks, roots, one-way soil flows and tunnels (wrap portals) | Variety and level design |
| A win almost nobody could reach | **Fill puzzles:** small hand-made boxes where filling is the goal, with a digit sequence designed to make it possible | Make the forgotten win the star |
| Instant end | A short, warm loss moment (§6) and a "one more" restart under 1 second | Flow |

### 3.3 Modes
1. **Tutorial** (under 60 s): move, eat, dash, chain.
2. **Gardens** (campaign): 12 boards, each introducing one idea (rocks · roots that grow back · a
   tunnel pair · sticky mud that slows · count-up bonus for eating 1→9 in order · a garden at night ·
   bigger digits only · …), three stars each (length target · best chain · no dash).
3. **Fill puzzles:** 15 small boxes from 5×5 to 12×9; the digit sequence is fixed per puzzle and
   always solvable (prove it with the solver, §9). Stars for fewer moves.
4. **Endless:** the original rules in an open box; "Classic tempo" toggle reproduces the one-second
   idle tick exactly; leaderboard per tempo.
5. **Daily Garden:** a seeded garden and digit sequence for everyone. Share example:
   `Noodle Nine #42 · length 87 · best chain ×6 · 🟩🟩🟨` (no URL).

### 3.4 Scoring and achievements
Score = Σ pending growth at each bite × tempo multiplier; length and best chain recorded. About 12
packages, for example: first-bite · chain-3 · chain-7 · count-up (1→9 in order) · zoomer (finish a
garden at zoom tempo) · slowpoke (a 3-star garden at creep) · fill-the-box (first fill puzzle) ·
box-master (all fill puzzles) · ninety-nine (length 99) · dash-dancer (eat with a dash) · night-noodle
(the night garden) · daily-regular (7 Daily Gardens). XP through `reportResult`.

## 4. Interaction
- Keyboard: arrows or WASD (and `hjkl` for the classic crowd) turn; holding a direction rushes; Shift
  + direction dashes (9 horizontal, 5 vertical, stopping on a digit, as the original); Space toggles
  Classic tempo during Endless; Esc pauses.
- Mouse (optional): click a cell in line with the head to dash toward it.
- A 180° reverse input is ignored with a soft bump sound, never a loss.

## 5. Screens
Title / game menu ("← Back to the Hall", live attract garden) · Tutorial · Garden map · Fill puzzle
grid · Play (board centred; top bar with Game menu, length, score, chain, tempo meter, pause "Esc") ·
Results (Play again (R) · Game menu · Back to the Hall (H)) · Records · How to play · Settings.

## 6. Art direction — "Garden Bed / Glow Soil"
- **The noodle:** a soft, squishy, glossy worm with a cheeky face; the body is a smooth spline, not
  squares, with subtle squash-and-stretch at turns and visible bulges while digesting.
- **Digits:** plump, juicy number-fruit (1 smallest, 9 biggest), bobbing gently; colour ramps by
  value; each has a distinct shape so colour is never the only cue.
- **Light — Garden Bed:** a sunny soil cross-section: warm loam, pebbles, roots, a strip of grass and
  sky at the top, soft shadows.
- **Dark — Glow Soil:** the same soil at night, bioluminescent: the noodle and the digits glow, fungi
  and roots shimmer faintly, fireflies above the grass line.
- **Signature moments:** (1) a big chain sends a rainbow pulse along the whole body and the score
  pops in chunky numbers; (2) completing a fill puzzle turns the coiled body into a glowing mosaic
  pattern that ripples outward.
- **Loss (feel it, kindly):** the noodle bonks, its eyes go swirly, the body sags and dims segment by
  segment, a soft descending "boing" — then the results card. No injury imagery.
- Zero raster; textures procedural. Canvas 2D or WebGL (decide in an ADR). 60 fps at 1920×1080 with
  a 300-segment worm.
- Sound (synthesised): squishy bite pops pitched by digit value, chain chimes climbing, tempo whoosh,
  soft bonk. Quiet by default.
- `demo(seed)`: a bot playing Endless. `poster`: the glowing noodle mid-chain, curling around a big 9.

## 7. Settings
Tempo default · Classic tempo · grid lines on/off · digit shapes on/off · sound · reduced motion ·
Forget my data.

## 8. Controls table
Full table in HOW-TO-PLAY.md.

## 9. Engineering and tests
- Pure engine (no DOM): board and walls, worm body, growth and score (exact original formula,
  documented), tempo, dash, collisions, digit placement (seeded), fill detection.
- Faithfulness tests per rule in §2, including a scripted sequence that proves the combo accident
  (9 then 5 while growing scores 9 + 12).
- **Fill solver** (search with pruning) that proves every fill puzzle solvable; tests fail if one is
  not.
- Bot for `demo` and balance: Garden star targets set so the bot meets 1 star on ≥ 90 % of runs and 3
  stars on 15–35 %.
- Provenance and content guards green.
- Game-scoped Playwright: tutorial, keyboard-only run, dash stopping on a digit, chain display, fill
  puzzle complete, loss flow, daily share text, all exit paths. Screenshots 1280×720 and 1920×1080,
  light and dark.

## 10. Staged workflow
1. **Hero frames — OWNER CHECKPOINT.** Three live scenes at 1920×1080, light and dark, into
   `games/worm/docs/media/hero/`: a) a mid-game garden with the noodle digesting and a chain popup;
   b) a fill puzzle at the moment of completion (the mosaic ripple); c) the title screen with the
   attract garden. Critique ≥ 5 rounds ("README hero image?"). **Stop and wait for the owner.**
2. Engine, tests, solver, bot → NOTES.md. 3. Wireframes with input. 4. Art pass both appearances.
5. Modes. 6. Sound and moments. 7. Critique loop (≥ 3 rounds). 8. Hall integration, docs, checks.

## 11. Documentation
ABOUT, HOW-TO-PLAY, ARCHITECTURE (engine, tempo, how to add a garden or a fill puzzle),
CHANGES-FROM-ORIGINAL (table like §3.2 plus every verified fact), NOTES. Mermaid only.

## 12. Content rules
All ages, our own words, no original message strings.

## 13. When you finish
Report: what you built; verified facts; solver and bot numbers; fps; deviations; known gaps; kit
changes you need (not made); exact commands to run.

## 14. Hall integration
Manifest per §0.5 with emblem (a curled noodle around a "9", SVG path data), `demo`, `poster`,
results with `presentation: 'game'`, share via the kit, daily numbering from the kit, pause-menu items
(Classic tempo, grid lines). At the very end: re-read the catalog and docs, change only the `worm`
line, status `shipped`.

## 15. Parallel session rules
Your folder: `games/worm/`. No kit changes. Dev port 5275; Playwright config inside your folder; no
repo-wide e2e or screenshot runs while others run; never stop processes you did not start; format
only your own files; ask before installing dependencies. No commits, no pushes.
