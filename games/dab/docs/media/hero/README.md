# Double Cross — hero frames

Live scenes for the owner's checkpoint (prompt 08 §6), rendered by the game's own board view and
interface from positions played by the real engine in `dev/scenes.ts`, at 1920 × 1080. Regenerate
with `pnpm exec playwright test -c games/dab --grep @hero`.

| Frame                         | Sidewalk Chalk (light)                                                                 | Night Neon (dark)                                                                    |
| ----------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| a · Mid-game, chain lens on   | [midgame-chain-lens-light-1920.webp](midgame-chain-lens-light-1920.webp)               | [midgame-chain-lens-dark-1920.webp](midgame-chain-lens-dark-1920.webp)               |
| b · The double cross          | [double-cross-cascade-light-1920.webp](double-cross-cascade-light-1920.webp)           | [double-cross-cascade-dark-1920.webp](double-cross-cascade-dark-1920.webp)           |
| c · Tutorial, the last lesson | [tutorial-the-double-cross-light-1920.webp](tutorial-the-double-cross-light-1920.webp) | [tutorial-the-double-cross-dark-1920.webp](tutorial-the-double-cross-dark-1920.webp) |

- **a.** Ladder match 7 on 5 × 5 against Berlekamp's Pupil. The lens outlines chains of 5, 6 and 5
  and a loop of 4, with a short chain of 2 left faint; the side panel counts them and says who is on
  course for control. The cursor rests on the box that is there to take.
- **b.** You declined the last two boxes of a chain of three; the Pupil took the pair with one line
  and had to open the chain of five. The pair flashes, the scissors cut across where the chain was
  let go, and the cascade is three boxes in, with the trail showing where the rest will fall.
- **c.** Step 5 of the tutorial on a 4 × 2 board: two boxes of the top chain are left, the bottom
  chain of four waits. The coach card sets the two choices side by side (4–4 or 6–2), and the
  dashed border at the far end is the one that gives the pair away.

The "Pause · Esc" button at the top right stands in for the Hall's own, which the player draws over
every native game.
