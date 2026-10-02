# 0002 — Two rule sets: Standard and Classic

- **Status:** Accepted
- **Date:** 2026-10-02

## Context

The BSD `wump` has rules its author clearly meant and code that does something else. The wumpus's
temper after a miss is written as `random() % level == EASY ? 12 : 9 < (lastchance += 2)`, which C
reads as a choice between 12 and a comparison rather than as the growing chance the comment above it
describes. Pits are re-drawn only while a room holds a pit _and_ bats, so they stack. Magic tunnels
are written but never dug. The hard level's extra hazards are drawn before the generator is seeded.
A wumpus woken by a miss can walk into you and the game plays on. Prompt 03 asks for a game that is
fair and readable and for one that is faithful to the program as it ran.

## Decision

- **Standard rules** (the default, and always the Daily Cave's) play every rule as intended: the
  temper grows a real chance out of 12 (9 on the hard level), hazard counts are exact and distinct,
  no tunnel leads back into its own room, magic tunnels exist in the caves that ask for them, the
  explorer starts in a calm room, the hard level's extras come from the expedition's own stream and
  are capped so the cave never overflows, and the smell tells strong (one room) from faint (two).
- **Classic rules** play the C program exactly as it ran: the precedence bug, stacking pits,
  self-loop tunnels, no magic tunnels, any start but the wumpus's room, the hard level's extras from
  the GNU C library's default seed (`src/engine/glibc.ts`), the single ambiguous whiff, and the
  temper carried from one Classic expedition to the next in one sitting, as the `static` variable did.
- **Both** keep every other rule of the original, and both end the expedition when the wumpus
  reaches you: a results card that kept you playing would read as a broken screen, and the prompt
  names it a bug to fix.
- One engine plays both. Each place they differ reads `expedition.rules` (or `rules` while digging)
  in one function: `digCave`, `population`, `fillClassic`/`fillStandard` and `stirsAfterMiss`; the
  engine always knows how far the smell is, and only the screen (`senseLine`, the chamber's wisps)
  keeps it vague under Classic.
  `faithfulness.test.ts` says for every rule which set it belongs to.
- The rules are chosen in Settings or from the pause menu and apply from the next expedition; the
  play screen shows which set is on.

## Consequences

- Players get a fair puzzle by default and the original's chaos on request, and the docs can say
  exactly where they differ (CHANGES-FROM-ORIGINAL.md).
- Balance numbers are measured and locked under Standard; Classic is not balanced, by design.
- A rule that differs between the sets needs a branch in the engine and a test for each side.
