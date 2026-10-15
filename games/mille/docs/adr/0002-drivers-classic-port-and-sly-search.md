# 0002 — Three drivers: Rookie, Classic as a checked port, Sly as a cautious search

- **Status:** Accepted (the owner approved the hero frames, 2026-10-15)
- **Date:** 2026-10-15

## Context

The prompt asks for three AI levels: Rookie (random legal play), Classic (the original's
`comp.c` strategy ported faithfully) and Sly (counts cards, holds safeties for coups, times
extensions, reads the deck's remaining hazards), with win rates Rookie < Classic < Sly over 2000
games.

## Decision

- **Rookie** plays a random legal card, and only when nothing can be played, a random discard.
- **Classic** is `calcmove`, `onecard`, `canplay` and the computer's half of `check_ext`, ported
  line for line with the original's arithmetic, tie-breaking and slips (NOTES.md lists them). It is
  checked against the original compiled outside the repository: 35,928 sampled positions agree, and
  300 of them are kept as a regression fixture. Where the original's choice indexes outside the
  hand (a phantom discard), Classic discards its least valuable card.
- **Sly** is Classic with a second look before each real choice: it deals the unseen cards out 48
  ways, shaped the way a Classic rival's hand really leans, plays every distinct move to the end of
  the hand in each world, and overrides Classic only when another move is ahead by 2.5 standard
  errors of the paired difference. An extension is decided by 120 playouts both ways. Hand-written
  rules were tried first and every one lost points against Classic (NOTES.md, "Building Sly").
- Every driver keeps its memory and random stream in the saved game, so a restored game plays on
  exactly.

## Consequences

- Classic gains +23 points a hand from extension playouts alone and Sly +69 ± 18 in all (paired,
  NOTES.md). The 2000-game win rates are recorded in NOTES.md.
- Sly needs about 130 ms a choice; it runs in a Web Worker (`src/play/driver.worker.ts`) so the
  table never stutters while it thinks, and its thinking pause doubles as the pacing every driver
  has anyway.
- Sly's strength is measured by simulations that take tens of minutes; the unit tests lock the
  Classic port and Classic over Rookie, and only check Sly for legality and repeatability.
