# Before the Tide — hero frames

Live scenes for the owner's checkpoint (prompt 11 §6), at 1920 × 1080. The game's own water
shader, castle painter and interface render them from staged states in `dev/hero.ts`.
Regenerate with `pnpm exec playwright test -c games/hangman --grep @hero`.

| Frame                        | Midday (light)                                                                       | Moonlit Tide (dark)                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| a · Mid-round, wave cresting | [mid-round-wave-cresting-midday-1920.webp](mid-round-wave-cresting-midday-1920.webp) | [mid-round-wave-cresting-moonlit-1920.webp](mid-round-wave-cresting-moonlit-1920.webp) |
| b · The castle stands (win)  | [the-castle-stands-midday-1920.webp](the-castle-stands-midday-1920.webp)             | [the-castle-stands-moonlit-1920.webp](the-castle-stands-moonlit-1920.webp)             |
| c · Game menu, attract mode  | [game-menu-attract-midday-1920.webp](game-menu-attract-midday-1920.webp)             | [game-menu-attract-moonlit-1920.webp](game-menu-attract-moonlit-1920.webp)             |

- **a.** Ocean deck, word 4: J E L L Y F I S H with E, L, I and S found and A and O wrong.
  Two waves have taken the moat bank, now damp lumps round murky water, and the gatehouse,
  which sank into a heap of wet sand in front of the still-whole wall. The tide gauge's float
  stands at 2, and a third swell crests behind the castle with spray flying off its lip.
- **b.** LIGHTHOUSE found with one wave. The flag streams out and the windows light up. The
  next wave stops short: at midday it leaves a rainbow in the mist over the castle;
  under the moon it bursts into a fan of glowing spray. Right letters carved windows and pressed
  shells and sea glass into the walls and the terrace.
- **c.** The game menu over the living beach: the title written in the wet sand, crabs, a gull,
  the lighthouse. At night its beam sweeps the sea and the castle's lantern glows.

The castle falls like sand, from the outside in: moat bank, gatehouse, left tower, right tower,
walls with the back towers, the keep with the flag (which ends up poking out of its heap), and
at the seventh wave one smooth dune with the flag lying on it. Each section sinks into its own
heap; nothing is left standing over a hole. All eight stages side by side:
[collapse-stages-midday.webp](collapse-stages-midday.webp).

The "Pause · Esc" pill and "← Back to the Hall" stand in for the Hall's own, which the player
draws over every native game.
