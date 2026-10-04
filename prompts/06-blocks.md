# Prompt 06 — Sinkers (inspired by the BSD falling-blocks game, from a 1989 IOCCC winner)

> Wave 2. First read and follow `prompts/wave2-shared.md`. Your folder: `games/blocks/`. Port 5285.
> Recommended: Claude Opus 5.5, effort xhigh. Owner checkpoint after the hero frames.

## 0. Sources and title
- Reference (read-only): `E:\Projects\BSDGames\BSDGames-master\tetris` — all files. BSD-licensed:
  adapt rules with attribution (notice in `LICENSES/`; credit Chris Torek and Darren F. Provine,
  Nancy L. Tinkham for the manual, Hubert Feyrer for the preview, in `CREDITS.md`).
- `title: "Sinkers"`, `inspiredBy: { program: "tetris", originalTitle: "tetris (BSD)",
  uiTitle: "the 1992 Berkeley falling-blocks game", year: 1992 }` — verify the year.
- **Legal (hard rule 3, extra care):** "Tetris", "Tetrimino/Tetromino", and the visual expression of
  the Tetris games are protected and actively enforced (courts have found clones infringing on their
  overall look). The piece shapes and the rule "complete a row and it vanishes" are game mechanics we
  may use; **the look must be unmistakably our own**. Concretely: no 10×20 well (ours is **11 wide ×
  18 tall**), no square bevelled single-colour bricks, no standard colour-per-shape scheme, no
  "ghost piece" drawn as a translucent copy, no "hold" box, no "Tetris"/"tetrimino"/"T-spin" words
  anywhere (UI, code identifiers, docs except CREDITS). Call them "sinkers" or "shapes". Record these
  choices in an ADR.

## 1. The pitch
- **Hooks (verified by the architect; re-verify and record in NOTES.md):**
  - The code began as a winner of the **1989 International Obfuscated C Code Contest** — a game hidden
    in deliberately unreadable C — later made readable for BSD. Its first comment shrugs: "or however
    it is spelled".
  - **Clearing rows scores nothing.** Points come only from landing a shape (1 each) and from the
    distance a shape falls when you drop it (1 per row); the total is multiplied by the level. The
    manual even advises dropping "as a good way to increase your score".
  - Shapes rotate **counter-clockwise only**. The next-shape preview arrived seven years later (1999).
  - The game speeds up a hair on every tick, forever; the manual admits the higher levels were
    "unplayable without a fast terminal connection".
  - The high-score file keeps each level's champion forever "so that following generations can pay
    homage to those who have wasted serious amounts of time".
- **What Sinkers adds:** the drop-to-score idea becomes the heart: shapes **sink through deep water**,
  and the deeper you send them in one fall, the more they're worth; cleared rows turn into bubbles that
  rise and pop for a combo. A look nobody will mistake for anything else.
- **Tagline:** "Drop deep. Fill the row. Ride the bubbles."
- **Teaser:** "Shapes sink slowly through a glowing aquarium. Slide them, spin them, then send them
  plunging — the farther they fall, the more they score. Fill a row and it bursts into a column of
  bubbles. Born as a tiny, deliberately unreadable program in 1989."
- Category `arcade`, directory `/usr/games/arcade`, 1 player, 3–15 minutes, daily: yes.

## 2. What the original does (verify)
Well 10×20 inside walls; 7 shapes chosen uniformly at random (no bag); counter-clockwise rotation only,
no wall kicks (rotation fails if it does not fit); left/right/rotate/drop/pause/quit keys (`jkl pq`
default, remappable); level 1–9, fall rate = level per second, with a tiny speed-up every tick
(`fallrate -= fallrate/3000`); landing scores 1, a drop scores 1 per row fallen; final score = points ×
level; optional preview (`-p`); one high score per player per level, champions kept forever, entries
expire after 5 years. Confirm rotation pivot behaviour and the stick shape that "sticks out".

## 3. Design
- **Well:** 11×18, a tall aquarium tank. Shapes sink at the level's rate, with a gentle wobble.
- **Controls:** move, rotate **both** directions (Classic rules: counter-clockwise only), soft sink,
  **plunge** (instant drop — the original's drop), pause. Simple wall nudge on rotation in Standard
  rules (one cell), none in Classic.
- **Scoring (Standard):** landing 1 × depth bonus; plunge distance × 2; clearing rows releases bubbles:
  1/2/3/4 rows give a bubble burst worth 10/30/60/100 × the current **depth combo** (consecutive
  plunges without a soft landing). **Classic rules:** exactly the original's scoring (no points for
  rows) and speed curve, CCW-only, uniform random shapes.
- **Landing preview:** a **sonar line** — a thin dotted outline drawn on the seabed where the shape
  will land (never a translucent copy of the shape).
- **Next:** one upcoming shape shown inside a rising bubble at the top (the 1999 preview, our way).
- **Modes:** Tutorial (60 s) · **Dives** (campaign of 12 tanks: clear-the-coral goals, currents that
  drift shapes sideways, a tank with pre-placed seaweed blocks, a dark tank lit only by your shape's
  glow, a speed tank…; 3 stars each) · **Marathon** (endless, levels 1–9 with the original's start
  level choice; per-level champions kept like the original's file) · **Classic 1992** (the original
  rules on our tank) · **Daily Dive** (one fixed shape sequence for everyone; share
  `Sinkers #42 · 18,240 · deepest combo ×7 · 🫧🫧🫧`).
- **Achievements (~12):** first-burst · four-row-burst · depth-combo-5 · plunge-100 (100 rows plunged
  in a run) · obfuscated (finish Classic 1992 at level 5+) · counter-clockwise (a 3-star dive using
  only CCW) · seaweed-gardener · night-diver · champion (beat your best on every level 1–9) ·
  steady-hands (a dive with no soft drops) · bubble-chain (three bursts in a row) · daily-regular.

## 4. Art direction — "Sunlit Tank / Abyss Glow"
- **Shapes are not bricks:** each sinker is a soft, rounded, glassy cluster — four pebble-like cells
  fused together, with refraction highlights; colours come from a depth palette (shape identity shown
  by an etched glyph on its cells, not by a fixed colour per shape).
- **Light — Sunlit Tank:** a bright aquarium: caustic light ripples on the back glass, sand floor,
  swaying plants at the sides, tiny fish crossing behind the tank.
- **Dark — Abyss Glow:** deep sea at night: shapes glow from within, marine snow drifts, a lantern-fish
  passes, the sonar line pulses faintly.
- **Signature moment:** a 4-row clear — the rows crack into hundreds of bubbles that rush upward in a
  column, light rays bloom through the water, the score bubbles pop one by one at the surface.
- Loss: the tank fills, water clouds over, shapes settle with a soft thud, a low bubbling sigh.
- Canvas 2D or WebGL (ADR). `poster`: a glowing sinker plunging through a column of bubbles.

## 5. Engineering and tests
Pure engine (well, shapes, rotation per rule set, collision, scoring both sets, speed curves, seeded
sequences, daily). Faithfulness tests for every rule in §2 (Classic). A bot for `demo` and balance;
Dive star targets: bot ≥ 90 % 1-star, 15–35 % 3-star. Guards: a test that no forbidden word appears in
UI strings, identifiers or docs (except CREDITS/NOTES quotes of the original's name in the provenance
section). Playwright: keyboard-only run, both rule sets, plunge scoring, burst, daily share, exits.

## 6. Hero frames (owner checkpoint)
Into `games/blocks/docs/media/hero/`, light and dark: a mid-game tank with a shape about to plunge and
the sonar line; the 4-row bubble burst; the title screen with the tank in attract mode. Then stop.
