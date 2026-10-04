# Talon's Shadow (`snake-classic`)

Gather the fruit. Watch the shadow. Slip away over any edge. An adopted, hosted game: the owner’s
earlier fancy-web port of `snake` lives in [`app/`](app/) (one HTML page with a Canvas 2D scene,
plus a few ES modules, no build step), and the Hall runs it at `play/snake-classic/`. It is the
collection’s second interpretation of `snake`, beside the native game listed as `snake`.

| Document                                                   | For                      |
| ---------------------------------------------------------- | ------------------------ |
| [About](docs/ABOUT.md)                                     | Players deciding to play |
| [How to play](docs/HOW-TO-PLAY.md)                         | Players                  |
| [Architecture](docs/ARCHITECTURE.md)                       | Programmers              |
| [Changes from the original](docs/CHANGES-FROM-ORIGINAL.md) | Everyone curious         |
| [Notes](docs/NOTES.md)                                     | The next session         |

```bash
pnpm dev                                                   # the Hall; open Talon's Shadow from it
pnpm run test:hosted                                       # its own unit tests (with the other hosted games)
pnpm exec playwright test -c games/snake-classic           # Talon's Shadow inside the Hall
SHOTS=1 pnpm exec playwright test -c games/snake-classic   # the documentation screenshots
node games/snake-classic/scripts/balance.mjs 40            # a bot flies every region 40 times
node games/snake-classic/scripts/challenges.mjs 12         # bots play every challenge 12 times
```

With `pnpm dev` running, `http://localhost:5173/play/snake-classic/` also opens the game on its
own, outside the Hall’s frame; add `?date=2026-10-31` to try another day’s Daily Flight.
