# ADR 0003 — The Duel's hunter

- Status: accepted
- Date: 2026-10-12

## Context

Prompt 12 asks for a Duel against an AI word-hunter with five strengths that plays the same board
in real time, its words appearing as ghost traces after the round. A hunter that simply knew the
solver's list would find everything at once; one that picked words at random would feel random.
It should play like a person: quick with short, common words, slower and less sure with long or
rare ones, and better or worse by a clear, even step.

## Decision

- **A plan, not a search.** When the board is dealt the hunter decides, from a seed, which of
  the board's words it knows and when it finds each. The round screen reveals each find when its
  moment comes, so pausing, hiding the tab or replaying a seed all behave exactly.
- **Knowing a word:** chance = reach(strength) × tier factor (common 1, uncommon 0.72, rare 0.48,
  very rare 0.3) × length factor (1 up to four letters, falling to 0.45 at eight and more).
- **Finding it:** known words are sorted by ease (tier, length, a little noise); a short pause to
  take the board in, then each find costs time that grows with the word's length and shrinks with
  the hunter's pace. Finds past the end of the clock are dropped.
- **Five hunters** (reach / pace): Nibbler 0.22 / 0.42, Browser 0.42 / 0.6, Reader 0.62 / 0.8,
  Scholar 0.8 / 1.05, Lexicon 0.97 / 1.45.
- **Scoring:** the hunter's finds are scored like a player's, chains included; the higher score
  wins the Duel.

## Consequences

- Measured over 200 seeded 4×4 boards in three minutes (`scripts/hunter-sim.ts`): 16, 32, 46,
  60 and 73 % of the board; the same steps hold on the larger grids. The bands are locked in
  `src/game/game.test.ts`.
- The plan is plain data, so the reveal can draw the hunter's words as ghost strands and list
  them in their own tab.
- Tuning is two numbers per strength in `engine/hunter.ts`.
