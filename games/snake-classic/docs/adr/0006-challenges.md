# 0006 — Challenges: five single games beside the expedition

- **Status:** Accepted (by the owner, 2026-10-04)
- **Date:** 2026-10-04

## Context

The owner asked for single games with challenges beside the expedition: a snake that eats and
grows until it fills the screen (with enemies and obstacles possible), “King Drift” scored by
combos of zigzags, and other ideas of ours; and accepted coil, survival and courier on the
condition that snakes die when they run into each other (ADR 0005).

## Decision

- **A Challenges page** on the desk, apart from the expedition: five cards with each one’s best and
  stars; a briefing with its rules and star thresholds; a report with the score, the stars, a new
  best, Play again (R), Challenges, Back to the Hall (H).
- **Each challenge borrows a region’s look, bird and hunter** and sets its own field and rules
  through a mode in `src/challenges.mjs`, which plays on a small handle the page gives it
  (`TalonGame.modeApi`) and draws its own marks.
  - **Fill the Field** (Origami): every fruit adds 22 segments of an even-width body; running into
    yourself ends the game; fruit grows only where the snake is not; the bird hunts from a quarter
    full or after a minute, its dives quicker every half minute after; the paper hen comes at half
    full. Score: the share of the field’s 600 cells the body covers. Stars at 25, 50, 75 %.
  - **King Drift** (Neon Grid, plus-shaped fence): a drift is a quick turn of at least 50°; drifts
    turning the other way within 0.9 s chain a combo, 10 points a link, doubled after a close call
    with a fence, an edge, a rival or the hen; touching a wall or running straight breaks it. Sixty
    seconds. Stars at 900, 2200, 3800.
  - **Coil** (Jungle): bring the head back to the body beyond the neck to close a loop; n fruit
    inside score n × n, a rival inside 15. Fruit comes in clusters. Ninety seconds. Stars at 30,
    90, 180.
  - **Survival** (Midnight, an H): the edges never open; every 30 seconds the hunt grows (a heron,
    two rivals, a second heron, a hungrier owl, a rival, hungrier still), then every dive comes a
    fifth quicker each half minute. Score: seconds plus fruit. Stars at 180, 380, 480.
  - **Courier** (Desert, an I): deliver what you carry to the burrow; n at once score n × n; the
    expedition’s load rules apply. Two minutes. Stars at 60, 140, 240.
- **Stars kept for good**, the best kept, in the saved progress (`challenges`). Two packages:
  Challenger (a star in every challenge) and Full field (100 % in Fill the Field). The Hall hears a
  complete session with the score; new stars earn 3 XP each.
- **Calibrated by bots** (`scripts/challenges.mjs`): a plain bot should earn one star, rarely
  two, and every game must end.

## Consequences

- The challenges reuse the expedition’s rules and drawing; a new one is a mode object and a card.
- Fill the Field grows to some two thousand segments; drawing and self-collision stay linear in
  the body (NOTES.md has the frame times measured).
