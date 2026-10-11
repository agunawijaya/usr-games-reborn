# Number Sprint — hero frames

Live scenes for the owner's checkpoint (prompt 13 §6), at 1920 × 1080, in both themes, by day
and by night. The game's own worlds (`src/render/sprint/`, `src/render/atom/`) and interface
pieces (`src/ui/`) render them from staged states in `dev/hero.ts`. Regenerate with
`pnpm exec playwright test -c games/arithmetic --grep @hero` (the workbench starts on port 5292).

| Frame                     | Sprint · Day Stadium                                                                   | Sprint · Night Stadium                                                                     | Atom · Clean Room                                                                  | Atom · Particle Night                                                                  |
| ------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| a · Quick Sums, mid-block | [quick-sums-mid-block-sprint-day-1920.webp](quick-sums-mid-block-sprint-day-1920.webp) | [quick-sums-mid-block-sprint-night-1920.webp](quick-sums-mid-block-sprint-night-1920.webp) | [quick-sums-mid-block-atom-day-1920.webp](quick-sums-mid-block-atom-day-1920.webp) | [quick-sums-mid-block-atom-night-1920.webp](quick-sums-mid-block-atom-night-1920.webp) |
| b · Split, the last split | [split-the-last-split-sprint-day-1920.webp](split-the-last-split-sprint-day-1920.webp) | [split-the-last-split-sprint-night-1920.webp](split-the-last-split-sprint-night-1920.webp) | [split-the-last-split-atom-day-1920.webp](split-the-last-split-atom-day-1920.webp) | [split-the-last-split-atom-night-1920.webp](split-the-last-split-atom-night-1920.webp) |
| c · Game menu and Daily   | [game-menu-daily-sprint-day-1920.webp](game-menu-daily-sprint-day-1920.webp)           | [game-menu-daily-sprint-night-1920.webp](game-menu-daily-sprint-night-1920.webp)           | [game-menu-daily-atom-day-1920.webp](game-menu-daily-atom-day-1920.webp)           | [game-menu-daily-atom-night-1920.webp](game-menu-daily-atom-night-1920.webp)           |

- **a.** Times tables, problem 12 of 20, Rush. The player is typing the answer to 7 × 8, a sum
  the tutor brought back: "Numbers in training" lists 7 × □ (4 chances left), □ × 8 (3) and
  □ − 6 (1). Sprint: the runner is six answers into a streak, and the personal best runs
  half a stride behind as a pale ghost in the next lane. Atom: 7 (one green atom on its
  heptagon orbit) and 8 (three bonded 2s) wait to fuse; the last answer, 54, fades upward; the
  chamber ring is charged 11 of 20.
- **b.** 360 has just been split into 2³ × 3² × 5. Sprint: the runner is in the air over the
  last hurdle, whose badge (5) flares; the hurdles behind carry 3 and 3. Atom: the molecule has
  fired apart, its six atoms flying to the shelf where they settle as 2³, 3² and 5.
- **c.** The game menu: the Daily (#41, Sunday 11 October: 20 sums, 5 numbers to split, a sieve
  from 1,000 to 1,199, 3 numbers in words), the campaign at chapter 4, free play in each mode,
  the prime album and the tutor. Sprint: the scoreboard shows the best Daily; the runner waits
  in the blocks. Atom: the number of the day, 360, as a molecule.

The "Pause · Esc" pill and "← Back to the Hall" stand in for the Hall's own, which the player
draws in the safe zones.
