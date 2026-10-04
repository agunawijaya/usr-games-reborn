# Orchard Crawl (`worm-classic`)

Numbered apples, hungry neighbours, a burrow to crawl home to. An adopted, hosted game: the
owner’s earlier fancy-web port of `worm` lives in [`app/`](app/) (one HTML page with a Canvas 2D
orchard, plus a few ES modules, no build step), and the Hall runs it at `play/worm-classic/`. It is
the collection’s second interpretation of `worm`, beside the native game listed as `worm`.

| Document                                                   | For                      |
| ---------------------------------------------------------- | ------------------------ |
| [About](docs/ABOUT.md)                                     | Players deciding to play |
| [How to play](docs/HOW-TO-PLAY.md)                         | Players                  |
| [Architecture](docs/ARCHITECTURE.md)                       | Programmers              |
| [Changes from the original](docs/CHANGES-FROM-ORIGINAL.md) | Everyone curious         |
| [Notes](docs/NOTES.md)                                     | The next session         |

```bash
pnpm dev                                                  # the Hall; open Orchard Crawl from it
pnpm run test:hosted                                      # its own unit tests (with the other hosted games)
pnpm exec playwright test -c games/worm-classic           # Orchard Crawl inside the Hall
SHOTS=1 pnpm exec playwright test -c games/worm-classic   # the documentation screenshots
node games/worm-classic/scripts/balance.mjs 20            # a bot crawls every orchard 20 times
```

With `pnpm dev` running, `http://localhost:5173/play/worm-classic/` also opens the game on its own,
outside the Hall’s frame; add `?date=2026-10-31` to try another day’s Daily Orchard.
