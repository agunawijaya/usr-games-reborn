# 0003 — Bank scoring in fictional play money

- **Status:** Accepted (owner decision, 2026-10-05)
- **Date:** 2026-10-05

## Context

CLAUDE.md rule 11 forbids gambling mechanics. The original `canfield` is a solitaire with a bank
account: it charges for the deal, the inspection, the rest of the game, information and time,
and pays for every card home. That account is the original's best idea ("information has a
price") and the heart of its history, so the owner named Thirteen Down as the rule's one
exception.

## Decision

**Thirteen Down's Bank mode uses fictional play money by owner decision (2026-10-05).**

- **Points** is the default scoring; Bank is an option in Settings and on the deal page, applied
  from the next deal.
- Play money is called "play money" where Bank is first offered. It can never be bought, sold,
  topped up, traded or exchanged for anything; no screen uses real-money or casino words.
- The account opens at $500 and may go below zero; resetting it is free and always available.
- Money appears only in the account book and the balance. The table has no chips, no felt and no
  casino flourishes; the account book is a paper ledger.
- Bank never feeds XP beyond the normal win and loss events; the Daily Deal always scores in
  Points and its share line never shows money.

## Consequences

- The original's cost table is kept line for line, and Bank players feel what its authors meant.
- Every word on Bank screens is checked against the collection's word guard
  (`pnpm run check:words`).
- Any future change that makes money persistent beyond the player's own device, shareable or
  exchangeable needs a new owner decision.
