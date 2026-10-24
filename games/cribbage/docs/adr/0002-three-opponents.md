# 0002 — Three opponents: Beginner, Classic and Sharp

- **Status:** Accepted
- **Date:** 2026-10-24

## Context

The owner-approved design asks for one computer opponent at three levels: Beginner; Classic,
Earl Cohen's strategy ported faithfully; and Sharp, which chooses its discard by the expected
hand and crib value over every starter and pegs with lookahead, the three in order of strength
over 2,000 games.

## Decision

- **Classic** is the C program's player, decision for decision, slips included (it scores its
  own kept hand by the crib rule, and its crib table credits four-card crib flushes). It is
  proven against 2,300 positions recorded from the original compiled from source outside the
  repository. The crib table is our own computation; Classic adds the flush sum back.
- **Sharp** lays away by exact averages (the kept hand over all 46 starters; the crib over all
  45,540 deals of the opponent's two cards and the starter, worked out by rank with flush and
  nobs counted directly) and then weighs the five best keeps by how they peg against 24
  imagined opponents. It plays by imagining the opponent's hand 64 times, realistically (six
  unseen cards, the four a sensible player keeps, consistent with every go), playing the rest of
  the play out perfectly for both, and taking the best average. Within 32 holes of the end it
  plays to win rather than for points, counting each imagined deal through the show in order.
- **Beginner** looks only at its own hand, half the time not even that, and takes points in the
  play when it notices them.
- Every mind sees only a player's view and draws randomness from its own seeded stream; searches
  are bounded by sample counts, never by time.

## Consequences

- Cohen's discard is already an expected-value method, so exact averages alone did not beat it.
  Sharp's edge comes from the play, realistic opponents, pegging-aware discards and the endgame:
  **54.9 % ± 2.2** against Classic over 2,000 games to 121 (NOTES.md), with Classic beating
  Beginner 87.0 % and Sharp 90.0 %.
- Sharp takes a few tens of milliseconds a move in the browser, far inside a frame budget at the
  pace the table plays; simulations of 2,000 Sharp games take about ten minutes.
- The coach reuses Sharp's reckoning, so its advice is the strongest play we have.
