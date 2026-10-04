# 0002 — Every flight ends: carrying, a harvest, rivals and fences

- **Status:** Accepted (the direction by the owner, 2026-10-03; the numbers tuned in the session);
  amended by ADR 0003 (the bird hunts the nearest snake, fruit withers, the bare field's first
  dives are fair)
- **Date:** 2026-10-03

## Context

On first play the owner asked when a flight stops and what its objective is: the snake never
grows, and nothing pushes a flight to its end. As adopted, a flight lasted as long as the player
kept dodging: fruit came back without end, carrying changed nothing, and a snake keeping straight
on from a far bird was safe. The 1980 manual already held the answer the port left out: “as you
get richer, the snake gets hungrier.” The owner asked that every game have an ending, agreed to a
hungrier bird and a slower snake, and proposed rival snakes eating the same fruit and fences shaped
like letters (I, H, HH, O, T or others, our choice).

## Decision

- **Carrying costs.** Every fruit carried makes the snake longer (2 segments), slower (2.5 %, to
  75 %) and slower to turn (3 %, to 60 %), and the bird hungrier: patience 4.5 % shorter (to 45 %),
  the lock 3 % shorter (to 65 %), the dive 1 % quicker (to 92 %). All in `src/carry.mjs`.
- **A fair dive.** A dive takes a set time from wherever it starts (`tuning.diveMs`), instead of
  flying at a set speed. Every region is tuned so the slowest snake keeping straight on clears the
  strike in the quickest dive; the danger is in turning, in fences and in corners. A test checks it.
- **A harvest.** Each region has a set number of fruit (10 to 28), four or five on the field at a
  time. When it is used up the field is bare: the bird turns ravenous, locks on almost at once, and
  every dive is a fifth quicker than the one before, so staying ends in a catch within about a
  minute while the nearest edge is never more than three seconds away.
- **Rivals.** One to three smaller, slower snakes come in from the corners and eat from the
  harvest, going for the nearest fruit round the fences and pausing to swallow after each. They
  never hurt the player. (At first the bird hunted only the player; ADR 0003 has it hunt the
  nearest snake.)
- **Fences.** From the River on, a fence shaped like a letter: I, T, H, a plus, a walled yard
  (the O, with gates east and west), U, and two H’s at Midnight. Heads slide along them; the bird
  flies over; fruit grows only where a snake can reach it.
- **Goals and an ending.** Each region has a goal of fruit to bring home (4 to 12); bringing it
  home clears the region and opens the next; clearing Midnight ends the expedition with an ending
  page that stays to be read.
- **Controls.** The key straight back swings the snake round in a U; in the port it did nothing.
- **Balance by measurement.** `scripts/balance.mjs` flies every region with a simple bot through
  `TalonGame.fastForward`; the regions were tuned until it cleared the early ones almost always and
  Midnight about a third of the time (NOTES.md).

## Consequences

- A flight now has a shape: gather, decide when the load is enough, leave. The goal under the
  field and the banner say when it is.
- The page keeps its own drawing and the bird’s flight; the new rules live in small modules with
  their own tests, handed to the page by `TalonGame.begin({ rules })`. Opened without the desk, the
  page still plays by the port’s rules.
- The Daily Flight uses the day’s region with its fence and rivals, still without a goal.
- Rival snakes and fences are drawn in code like the rest of the scene; no raster.
