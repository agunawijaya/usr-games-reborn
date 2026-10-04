# 0003 — The house diver

- **Status:** Accepted
- **Date:** 2026-10-02

## Context

Sinkers needs a player of its own: for the attract tank behind the game menu and in the Hall's
tiles, for the hero frames and the poster, for the Daily Dive's par, and for the balance tests the
prompt asks for (dives won by the bot at least 90 % of the time, three stars 15–35 %). It must be
deterministic, cost the same every call, and cope with currents, which push a sinker aside as it
passes a row.

## Decision

- **One sinker of look-ahead.** For the sinker in hand, try every form reachable by turning at the
  top and every column reachable by sliding, find where it would come to rest, and score the tank
  that would result. No search over the next sinker; no clock.
- **The evaluation** is the hand-tuned six-feature one known for this kind of game (after Pierre
  Dellacherie): −4.5 × landing height + 3.4 × rows cleared × own cells in them − 3.2 × row
  transitions − 9.3 × column transitions − 7.9 × holes − 3.4 × well depth, plus 6 for every piece
  of coral a landing clears.
- **Currents are steered through:** the diver sinks a row at a time, slides back towards its column
  after each push, and plunges once no current is left below. A human player can do exactly the
  same with ↓ and the arrows; planning only at the top, the diver lost Riptide 53 times in 60.
- **Always plunge.** The diver plunges every sinker, which makes it a strong scorer of plunge points
  and depth combos: par for the Daily Dive is a real target.
- **Steps, not teleporting.** A placement is a list of keys (`turnLeft`, `right`, `sink`,
  `plunge`…) played through the engine, so the attract tank and the tests move the sinker exactly
  as a player's keys would.

## Consequences

- Dive stars are set from 60 seeded dives per tank and checked by a test over 40 others: every
  dive is won by the diver 100 % of the time, with three stars on 15–35 % of dives (the test
  allows 12–38 % for small samples).
- The diver knows nothing of time, so the speed tank and the night dive are no harder for it; their
  stars come from score, which the speed and the dark make harder for people.
- A stronger diver (two-sinker look-ahead) would raise par and could be swapped in behind
  `choosePlacement` without touching anything else.
