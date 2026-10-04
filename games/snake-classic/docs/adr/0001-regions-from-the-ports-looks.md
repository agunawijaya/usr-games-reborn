# 0001 — The port’s eight looks become an expedition of eight regions

- **Status:** Accepted (the gamification by the owner, 2026-10-02; the region order and tuning in
  the session)
- **Date:** 2026-10-02

## Context

The adopted port offers eight cosmetic looks (Neon Grid, Savanna, Jungle, Desert, River, Aztec,
Origami, Midnight), picked with pills above the field; the game is the same in all of them, with
one bird tuned by fixed numbers. The owner chose four ideas for its gamification: an expedition
of eight regions, a Daily Flight, contracts per region, and a field book with records. The
collection’s progression must be honest: no loss framing, no timers that pull players back.

## Decision

- **Each look is a region**, flown in order from day to night: Savanna, River, Jungle, Desert,
  Neon Grid, Aztec, Origami, Midnight. Each region names its bird and its fruit and has a temper
  of a line.
- **The bird is tuned per region** through `TalonGame.begin({ tuning })`: patience and its
  spread, lock time, dive speed, strike radius, glide speed, first delay, and the number of fruit
  on the field. Each region is a little harder than the one before; Neon Grid keeps the port’s
  own numbers, so the bird the port shipped with sits in the middle of the expedition.
- **A region opens** when the one before it has been escaped with enough fruit (4 for the
  Savanna up to 10 for Origami); once open, it stays open.
- **Contracts are checked once, after a flight**, from a summary (escaped, fruit, dodges, lock-ons,
  edge, seconds); each earns its stamp once. Nothing is taken away for a catch.
- **The pills are hidden**, not removed: the page still has them if it is opened without the
  desk.

## Consequences

- The port’s rules stay in the page; everything the expedition adds lives in small, pure modules
  with their own tests.
- The Daily Flight can land on a region the player has not opened: it is a preview, so it keeps
  apart from the expedition (no stamps, no best, no opening).
- Changing a region’s difficulty is a change to `src/regions.mjs` alone.
