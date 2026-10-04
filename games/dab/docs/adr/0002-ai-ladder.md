# ADR 0002 — The opponents: a ladder of ideas, a model of the endgame, and an exact solver

- Status: accepted
- Date: 2026-10-02
- Deciders: the prompt 08 session; the owner approved the ladder with the hero frames

## Context

The prompt asks for five opponents, each beating the one below it at least 70 % of the time over
1 000 games on 5 × 5: a random player, the original's algorithm ported faithfully, one that adds
the parity of long chains, one that plays the long chain rule and the double cross, and a Master
that solves small endgames exactly. They must answer within a frame or two of the play screen
(no worker threads in a native game today), be deterministic for tests and the Daily Board, and
use node budgets, never the wall clock.

## Decision

Every opponent is a pure function `chooseMove(id, board, { rng, clock })` in
`src/ai/opponents.ts`. Each rung adds one idea:

| Rung              | Safe-line phase                                                            | Endgame                                                        |
| ----------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Scribbler         | any free line at random                                                    | the same                                                       |
| Greedy Gus        | `algor.cc`, line for line: random order reseeded from the clock (`rand48`) | take the biggest closure; give away the fewest; never declines |
| Chain Counter     | Gus, then with 18 safe lines or fewer, searches them all                   | opens the piece that leaves it best off; still never declines  |
| Berlekamp's Pupil | random safe lines, then with 12 or fewer, searches for the long chain rule | declines the last two (four) when control is worth more        |
| Master            | searches from 16 safe lines, judged by the exact endgame model             | solves the rest outright from 32 free lines                    |

Three pieces of machinery serve them:

- **`Position`** (`src/ai/position.ts`): a mutable board with side counts per box and draw/undraw,
  so searches never copy the immutable engine `Board`.
- **The safe-line search** (`src/ai/search.ts`): while safe lines remain nobody gives anything,
  and drawing one only removes safe lines, so the positions are at most the subsets of the safe
  lines left; a memo over them makes the search exact for its judge. The judges differ by rung:
  a greedy playout of the endgame (Chain Counter), the long chain rule as a ±1 rule of thumb
  (Pupil), and Berlekamp's simple-loony-endgame recursion (Master).
- **The exact solver** (`src/ai/solver.ts`): negamax with alpha–beta and a transposition table on
  the drawn-edge bitmask. Two proven cuts keep it small: a box that can be taken without handing a
  new one over is simply taken; in a run being taken, the only alternative is declining the last
  two (or the last four of an opened loop). It counts nodes and gives up past its budget, and works
  on a copy so giving up never leaves lines drawn.

The endgame model (`src/ai/endgame.ts`) treats the pieces as independent chains and loops:
`loonyValue` is exact for simple loony endgames and an approximation where a box joins three
pieces. Master leaves it behind as soon as the solver can finish the game.

## Consequences

- Balance, 1 000 games a pair on 5 × 5, first move alternating: Gus 100 % over Scribbler, Chain
  Counter 90.0 %, Pupil 83.3 %, Master 82.9 % (table and timings in NOTES.md; a 40-game replay is
  locked in `src/ai/balance.test.ts`). The slowest move measured was 232 ms (Chain Counter's
  search at its widest); typical moves take well under 2 ms.
- The solver is checked against a plain memoised search on 40 random small positions
  (`ai.test.ts`) and verifies all forty endgame puzzles (`puzzles.test.ts`).
- Larger boards (8 × 8 to 10 × 10 in Custom) stay quick because every search is gated by the number
  of safe or free lines, not the board's size.
- If a future kit offers workers, Master could search deeper; nothing else would change.
