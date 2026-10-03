# 0002 — The 1994 player as every opponent's engine

- **Status:** Accepted (approved by the owner with the hero frames, 2026-10-03)
- **Date:** 2026-10-02

## Context

Prompt 07 asks for the original AI ported faithfully and tested against the C program, five
opponents "built on the original algorithm with tuned depth and noise", a stronger Referee with a
modern threat-space search, puzzles generated from the combination search, and a replay of what the
AI weighed.

## Decision

- The original `pickmove` is ported structure for structure (`src/engine/campbell/`), including
  its quirks, and proven against the original: the C program was built outside the repo and its
  self-play games recorded with known `srandom` seeds; the port, with a reproduction of glibc's
  `random()`, plays all 30 of them move for move (`pickmove.test.ts`).
- Fivefold's own rules engine (`src/engine/game.ts`) stays separate and decides wins (Freestyle,
  Exactly five) and draws; the 1994 player is attached through `CampbellMind`, which keeps its board
  in step. Under Exactly five the player still thinks in its own Freestyle terms; how much that costs
  it is measured in stage 2.
- Personalities are parameter sets over the same search (`src/engine/opponents.ts`): a combination
  depth cap, a chance to slip on a quiet move, a chance to overlook an open three. The Referee adds a
  threat-space search (continuous fours and threes) before and after the 1994 choice.
- The player records what it weighed (spot values, forcing frames, the chosen and the best spot for
  each side) for the replay overlay; recording does not change its choice.
- In play, the player runs in a Web Worker with a cap on combination work per move, so the board
  never freezes in the rare crowded positions where the uncapped search takes seconds or more.

## Consequences

- "Campbell" really is the 1994 program, give or take the safety cap: 30,000 combinations per side
  per move, which keeps every move under about 0.6 s on 15 × 15 and agrees with a near-uncapped search
  on 97 % of moves (NOTES.md).
- The everyday test suite plays 4 of the 30 reference games (~40 s); `GOMOKU_REFERENCE=all` plays all
  30 (~20 min).
- Tie-breaks in play draw from a kit-seeded generator, so a Daily Puzzle or a replay is reproducible.
