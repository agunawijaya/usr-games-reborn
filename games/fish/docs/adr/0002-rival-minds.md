# 0002 — Rival minds: the original's two, ported exactly, and a third that sees only the table

- **Status:** Accepted (owner approved the hero frames, 2026-10-15)
- **Date:** 2026-10-15

## Context

The prompt asks for the original's two strategies ported faithfully (Otto: rotation; Hazel: pro
mode) and a new, stronger Miso who "remembers every ask and every transfer and infers likely
hands" but never looks at hidden cards, proved by a test. Classic 1993 must be exactly the
original. Verifying `fish.c` found that its pro mode also peeks at the player's hand one time in
1 024 ("the computer cheats only rarely").

## Decision

- **One port of the Berkeley computer** (`minds/berkeley.ts`) with a rotation and a pro mode,
  holding the original's `lmove`, `asked[]` and `userasked[]` (kept per seat). With one opponent
  it draws the same random numbers in the same order as the C program.
- **Proof by replay:** 1 200 games recorded from the real program, replayed through our engine
  with the C library's `random()` reproduced, must match event for event
  (`berkeley.test.ts`).
- **The table is the information boundary** (`table.ts`): minds receive only `seeEvent` (their
  own seat's view) and `viewFor` (their hand and the public counts). The peek is a separate
  capability the table hands over only in Classic 1993, so Hazel in the other rule sets cannot
  peek even by mistake.
- **Miso** keeps a `Knowledge` of public facts and estimates, for each player and rank, the chance
  they hold it (hypergeometric over unseen cards). She asks sure things first, then her biggest
  group to the likeliest holder, never a rank just denied. The notebook shows the player the same
  `Knowledge`.
- **Proof of honesty:** at each of Miso's decisions, every card she cannot see is dealt again at
  random; her view and her ask must not change (`miso.test.ts`).

## Consequences

- Rival strength is measured, not guessed: Otto < Hazel < Miso in duels, locked by
  `balance.test.ts`; the numbers are in `NOTES.md`.
- The notebook teaches exactly the reasoning the strongest rival uses.
- Whether Classic keeps the rare peek is an owner decision (NOTES open question 1); removing it is
  one flag.
