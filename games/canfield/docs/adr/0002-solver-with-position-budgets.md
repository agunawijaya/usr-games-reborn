# 0002 — A solver with position budgets, in a worker

- **Status:** Accepted
- **Date:** 2026-10-05

## Context

The prompt asks for a solver ("search with memoisation", "with a time budget, run in a worker")
to prove the Daily Deal and "winnable only" deals winnable and to say after a lost deal whether
it could have been won. The Daily must be the same deal for every player on every machine, and
the challenges need lines of play the tests can replay.

## Decision

- Depth-first search with a memory of positions seen (`src/engine/solver.ts`). One step is
  "deal on k times, then move a card", so positions that differ only in how far the hand has
  been dealt are never stored; a card that can never be needed again goes home at once; moves
  that need a turn-over are tried last.
- The budget is counted in **positions**, not milliseconds. Answers are `winnable` with a line,
  `unwinnable` (the whole space searched) or `unknown` (budget spent), plus the most cards the
  search sent home.
- Budgets: 60,000 positions to accept a candidate for the Daily or a "winnable only" deal,
  40,000 for a hint, 400,000 to judge a finished deal.
- The search runs in a Web Worker (`src/play/solver.worker.ts`) behind `SolverClient`; the same
  calls run in the page where workers are missing (unit tests, scripts).
- Goals beyond winning (empty the reserve, N cards home) and a limit on passes let the same search
  build and prove the challenges.

## Consequences

- A position budget gives every machine the same answer, so the Daily Deal is the same for
  everyone; a time budget would not. Measured cost: about 6 µs a position; finding a winnable
  Standard deal took a median of 10 ms and at most 383 ms over 40 seeds (`NOTES.md`).
- About 10 % of random Standard deals stay `unknown` even at 1,500,000 positions; the results
  screen says the solver could not decide rather than guess.
- "Winnable only" deals are proven winnable, not merely likely, so the share of deals offered is
  slightly narrower than the share that can really be won (60–70 %).
