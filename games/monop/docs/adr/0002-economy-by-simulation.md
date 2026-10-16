# 0002 — An economy of our own, tuned by simulation

- **Status:** Proposed (stage 2)
- **Date:** 2026-10-16

## Context

The 1980 program's price, rent and card files copy a commercial edition (NOTES.md, "Source"),
so none of its numbers can be used. Prompt 15 asks for our own economy, tuned by thousands of
rival-only games so that no district dominates, a Quick game lasts about thirty minutes, the first
player's edge is small and every board is equally fair.

## Decision

- **A formula, not a table.** About fifteen parameters (`ECONOMY_PARAMS` in
  `src/engine/economy.ts`) build every price, rent and building cost:
  - prices rise district by district round the loop;
  - a bare lot's rent is a share of its price, and that share grows by 40 % from the cheapest
    district to the dearest (`rentTilt`);
  - buildings climb a fixed ladder of multiples of the bare rent;
  - a storey costs 45 coins on the first district and 10 more on each one after.
- **Transit, utilities, taxes, the fine, the salary and the starting purse are our own figures.**
  They are not the original's, and neither are the card amounts or the spaces the movement cards
  send a token to. The 1980 rule shapes stay: transit fares climb with each stop owned, and
  utility rent multiplies the dice.
- **One economy for all three boards.** The boards differ in names, cards' words and look, never
  in numbers, so they are exactly as fair as each other by construction.
- **Later seats start a little richer:** 50 coins more per seat after the first, which brings
  every seat to within about three points of an equal share at every table size. Like komi in Go.
- **Quick's length is set by table size:** 80, 56, 48, 42 and 37 rounds for two to six players.
  That is about thirty minutes on the clock described below.
- **Classic ends when one player is left,** with a long stop at 250 rounds (the richest wins)
  for a table that has stopped changing hands.
- **The tuning tools stay in the repo:**
  - `pnpm --filter @usr-games/game-monop simulate` plays the rival-only games and prints the
    tables;
  - `payback` prints each district's payback;
  - `scripts/tables.ts` prints the NOTES tables.
- **`src/engine/economy.test.ts` locks the result:**
  - the price table's shape;
  - the payback ordering;
  - seat balance, district balance and personality balance over 360 simulated games;
  - game length on the clock.

### The clock

A person's time is estimated from the events of a game. Every event costs its animation time;
events in the person's seat (seat 0), or offers made to or by it, also cost reading and deciding
time. The figures (`SHOWN`, `DECIDING` and `SECONDS_PER_SPACE` in `src/engine/simulate.ts`) are
the pacing the interface is built to:

- the dice take 2.5 s;
- a token walks 0.28 s a space;
- a card takes 3 s;
- a person spends 20 s on a trade.

## What the simulations showed

- **Equal paybacks on paper are not fair in play.** A dear district comes together later and
  costs far more to build, so with equal paybacks it was a trap: formed first, it won 12 % of
  games against 68 % for a cheap one. Tilting rent towards the dear districts and flattening
  building costs evened this out. Now whoever finishes any district wins 90–92 % of three-player
  games, and the spread between districts is under 3 points.
- **Rivals have to plan a district's height, not one storey at a time.** A lone first storey
  never pays, so a greedy builder never starts.
- **Borrowing to build is what wins.** In a Quick game a mortgage does not change net worth, so
  mortgaging to build is simply good play. Every rival does it, past a bar set by its personality.

## Consequences

- **Changing a number means re-running the simulations.** The economy tests fail first, which is
  the point.
- **The Old Docks are the weak district,** two cheap lots with the slowest payback, as the
  cheapest district usually is. They are still worth finishing: their owner wins 9 times in 10.
- **Classic auctions are frequent** (about 17 a game with three players), because a deed's price
  does not count at the end. The auction overlay must be quick.
