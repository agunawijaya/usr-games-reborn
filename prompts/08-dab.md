# Prompt 08 — Double Cross (inspired by "dab", Christos Zoulas, NetBSD games)

> Wave 2. First read and follow `prompts/wave2-shared.md`. Your folder: `games/dab/`. Port 5287.
> Recommended: Claude Opus 5.5, effort xhigh. Owner checkpoint after the hero frames.

## 0. Sources and title
- Reference (read-only): `E:\Projects\BSDGames\BSDGames-master\dab` — all files, especially
  `algor.cc` (the computer), `board.cc`, `box.cc`, `main.cc`, `random.cc`, `dab.6`. The licence carries
  an **advertising clause** ("must display the following acknowledgement"): copy the full notice into
  `LICENSES/`, show the required acknowledgement in the game's ABOUT and in `CREDITS.md`, and say how
  you complied in NOTES.md.
- `title: "Double Cross"`, `inspiredBy: { program: "dab", originalTitle: "dab",
  uiTitle: "the NetBSD dots-and-boxes game", year }` — take the year from the source; omit if unsure.

## 1. The pitch
- **Hooks (verified by the architect; re-verify and record in NOTES.md):**
  - The manual points players to Elwyn Berlekamp's book on the game's deep strategy — yet the
    computer's algorithm never uses the book's central trick. It grabs every box it can, avoids giving
    away a third edge, and when forced, hands over the smallest chain. It never declines the last two
    boxes of a chain to keep control: **it never plays the double cross.**
  - It randomises its choices "to randomize the game", and has a pure random player for testing.
  - Any board size from the command line; computer vs computer for many games in a row.
- **What Double Cross adds:** the trick the 1990s computer never learned becomes the game's soul — a
  tutorial that teaches chains, control and the double-cross, opponents that start with the original's
  greedy mind and climb to one that plays the long-chain rule, and endgame puzzles where the right move
  is to give boxes away.
- **Tagline:** "Draw a line. Close a box. Learn when to give one away."
- **Teaser:** "The pencil-and-paper classic, lit up: take turns drawing lines, close a box to claim it
  and move again. Simple — until you learn why the best players hand over boxes on purpose. The
  Berkeley computer never figured that out. You will."
- Category `board`, directory `/usr/games/board`, 1–2 players, 3–10 minutes, daily: yes.

## 2. What the original does (verify)
Grid of boxes (x × y, default per the source); a move draws one edge; completing a box scores it and
gives another turn; ends when all edges are drawn; human/computer per side; the algorithm's order of
choices (as in `algor.cc` comments); the random player; multiple games and scores; key controls (vi
keys, diagonal hops between even and odd rows, space to draw).

## 3. Design
- **Opponents (ladder):** "Scribbler" (the random player) · "Greedy Gus" (the original algorithm,
  ported faithfully) · "Chain Counter" (adds parity of long chains) · "Berlekamp's Pupil" (plays the
  long-chain rule and the double-cross when it keeps control) · "Master" (endgame solved exactly on
  small boards, nimber-style values on loony endgames where feasible). Personality lines are ours.
- **Teaching (the point of the game):** a 5-step interactive **Tutorial** (draw, close, chains, the
  "loony" move, the double cross) using tiny boards; an optional **Chain lens** overlay (off in Daily
  and ranked games) that outlines chains and loops and marks who will get control.
- **Modes:** Tutorial · **Ladder** (board sizes grow 3×3 → 4×4 → 5×5 → 6×6 → 7×7 over 10 matches) ·
  **Endgame puzzles** (40 positions where the right move gives boxes away; verified by the solver) ·
  **Daily Board** (a fixed opening against Berlekamp's Pupil; share `Double Cross #42 · 14–11 · ✂️2`)
  · **Local** two players · **Custom** board size (any x × y like the original, within 2–10).
- **Achievements (~12):** first-box · first-double-cross · control-freak (win having kept control
  through every long chain) · beat-greedy-gus · beat-the-pupil · beat-master-4x4 · shut-out (a game
  where the opponent closes nothing) · loop-de-loop (win a game that ended on a loop) · puzzle-30 ·
  big-board (win 7×7) · sharing-is-winning (give away 4+ boxes in one move and still win) ·
  daily-regular.

## 4. Art direction — "Sidewalk Chalk / Night Neon"
- **Light — Sidewalk Chalk:** a sunny pavement: dots are chalk dots, lines are drawn with a chalky
  stroke that animates as it's drawn (slight wobble, chalk dust), claimed boxes fill with the
  player's chalk colour and a doodled initial or emoji-like mark of our own design.
- **Dark — Night Neon:** dots are tiny neon nodes, edges light up as neon tubes with a flicker-on and a
  soft hum, claimed boxes glow with the player's colour.
- **Signature moment — the double cross:** when a player declines the last two boxes, the two-box
  piece flashes, a pair of scissors-like cut mark (our glyph) slices the chain, and the camera holds a
  beat — then the opponent's forced move cascades the rest of the board to the player who kept
  control (boxes filling in sequence like dominoes).
- Ownership never by colour alone (fill pattern + mark). Canvas 2D or SVG (ADR). `poster`: a neon
  board mid-cascade.

## 5. Engineering and tests
Pure engine (edges, boxes, turns, scoring, chains/loops detection, control analysis); the original
algorithm ported faithfully with tests reproducing its choice order (seeded); the stronger AIs with a
solver for small boards; puzzle generator + uniqueness checks. Balance: each ladder opponent beats the
previous one ≥ 70 % over 1 000 games on 5×5 (record the table). Playwright: mouse play, keyboard play
(cursor between dots, Enter/Space to draw), tutorial, chain lens, a scripted double cross, puzzle,
local, custom size, daily share, exits.

## 6. Hero frames (owner checkpoint)
Into `games/dab/docs/media/hero/`, light and dark: a mid-game 5×5 with the chain lens on; the
double-cross moment with the cascade beginning; the tutorial step that explains the double cross. Then
stop.
