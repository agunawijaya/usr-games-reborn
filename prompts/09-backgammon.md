# Prompt 09 — Homeward (inspired by "backgammon" and "teachgammon", BSD games, 1980)

> Wave 2. First read and follow `prompts/wave2-shared.md`. Your folder: `games/backgammon/`. Port 5288.
> Recommended: Claude Opus 5.5, effort xhigh. Owner checkpoint after the hero frames.

## 0. Sources and title
- Reference (read-only): `E:\Projects\BSDGames\BSDGames-master\backgammon` — `backgammon/` (main,
  move.c — the computer's evaluation — extra.c, text.c, version.c), `common_source/` (rules, legal
  moves, odds, board, save), `teachgammon/` (teach.c, tutor.c, data.c, ttext1.c, ttext2.c). BSD-licensed:
  adapt rules and the AI's evaluation with attribution; credit the Regents and the authors you find.
  The tutorial **texts** are not to be reused — we write our own lessons.
- `title: "Homeward"`, `inspiredBy: { program: "backgammon", originalTitle: "backgammon",
  uiTitle: "the 1980 Berkeley backgammon and its tutor", year: 1980 }` — verify.

## 1. The pitch
- **Hooks (verified by the architect; re-verify and record in NOTES.md):**
  - It shipped with **its own teacher**: `teachgammon` walks through moves, bearing off, hitting, the
    endgame, doubling and strategy, then plays a scripted game with you — and if the main program is
    missing it cries for help.
  - The computer can act as a **gamekeeper** for two humans, checking every move.
  - Its brain is a hand-tuned score of a few human ideas: the chance of being hit, open men, protected
    points, the farthest man back, the chance to free men.
  - A version message proudly says it was last updated on a Friday in October 1997 — seventeen years
    after its 1980 copyright.
  - Moves are typed in a tiny language (`13-8`, `13/5`, `13/34`, `b` for the bar, `h` for home).
- **What Homeward adds:** the tutor becomes an interactive course you play through on the board; the
  computer's five ideas become a **Coach** that explains, in plain words, why a move is good or risky;
  drag-and-drop moves with every legal target lit; matches, a daily position, and a friendly
  two-player table with the gamekeeper built in.
- **Tagline:** "Race your fifteen home. Learn every trick on the way."
- **Teaser:** "The 5,000-year-old race game, with a coach at your elbow. Roll, move, hit, build your
  walls, and bring all fifteen home before your rival. Born on Berkeley terminals in 1980 with its own
  tutor — now the tutor plays the board with you."
- Category `board`, directory `/usr/games/board`, 1–2 players, 5–20 minutes, daily: yes.

## 2. What the original does (verify)
Standard rules (bar, hitting, bearing off, gammon and backgammon results); doubling cube with
accept/refuse; red vs white; computer vs human, human vs human with the computer as gamekeeper, or
computer vs itself; the move language; save/restore; the evaluation factors and how the computer picks
among candidate moves; how/when it doubles and accepts; teachgammon's chapter order and its scripted
tutorial game.

## 3. Design
- **Moves:** click/drag a checker; legal destinations light up with the die that gets there; a "use
  both dice" combined hop when unambiguous; undo within the turn; Confirm ends the turn. The original
  move language works in a **Notation box** (typed moves, with completion and error explanation).
- **The cube (no gambling):** match scoring only — the cube doubles the **points of this game in the
  match**, nothing staked, no currency. Toggle "Cube on/off"; off in the tutorial.
- **Coach** (toggle, off in Daily and ranked matches): after each move, a one-line plain-words note
  derived from the original's factors ("leaves a blot that is hit 11 times out of 36", "makes your
  5-point", "frees your back checker"), and a "What would the coach do?" hint (best move by our
  evaluator, which starts from the original's and adds a modern 1-ply rollout).
- **Modes:** **Learn** (9 interactive lessons following teachgammon's arc — the board · moving ·
  doubles · hitting and the bar · bearing off · gammons · the cube · strategy basics · a guided game;
  our own words) · **Match** vs AI (to 1/3/5/7 points; three opponents: "Gamekeeper" — the original
  evaluation; "Strategist"; "Champion" — rollout-based) · **Table** (two players, the gamekeeper checks
  every move) · **Daily Position** (one best-move problem, verified by rollouts; share
  `Homeward #42 · found the best move · 🎲🎲`) · **Classic notation** challenge (play a game with the
  Notation box only).
- **Achievements (~12):** graduate (finish Learn) · first-win · gammon · backgammon · prime-builder
  (six points in a row) · closeout · comeback (win from 60+ pips behind) · cube-master (win a doubled
  game in a match) · notation-native (win using only typed moves) · beat-champion · bar-escape (enter
  from the bar against a 5-point board) · daily-regular.

## 4. Art direction — "Café Table / Lamplit Study"
- Not a casino: no felt, no chips, no dark-green gaming table.
- **Light — Café Table:** a sunny board-game café: inlaid wood board with warm and pale points,
  ceramic checkers with soft speckles, real-looking dice tumbling and settling on the wood.
- **Dark — Lamplit Study:** the same board at night under a desk lamp: deep walnut, brass hinges,
  points inlaid in dark and light woods, checkers like polished stone catching the lamplight.
- **Signature moment — home:** the last checker borne off; all fifteen stack in the tray with a
  satisfying cascade, the board lights up from the far point to home, and (for a gammon) the
  opponent's stack gets a cheeky little wobble.
- Pips count and dice always visible; checker ownership by colour **and** marking (a ring on one side).
- WebGL for dice physics is welcome but keep it light; Canvas 2D for the board (ADR). `poster`: dice
  mid-tumble over the board at lamplight.

## 5. Engineering and tests
Pure engine (positions, legal move generation including forced-max-dice rules, bearing off, results,
cube, match scoring, Crawford rule for matches), the original evaluation ported faithfully (test it
picks the same moves as the C program on recorded positions — capture outside the repo if you can),
stronger evaluators, rollouts in a worker. Lessons are scripted positions with checks. Balance: the
three opponents' win rates against each other over 2 000 games, recorded. Playwright: a full game by
mouse, by keyboard (cursor over points + Enter, digits for dice choice), by notation; lesson 1–9;
cube offer/accept/refuse; daily; exits.

## 6. Hero frames (owner checkpoint)
Into `games/backgammon/docs/media/hero/`, light and dark: a mid-game board with legal targets lit and a
Coach note; dice tumbling (signature dice motion); the bear-off "home" moment. Then stop.
