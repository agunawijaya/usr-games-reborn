# Robots (`robots`)

Lure the robots into each other. Stay out of reach. An adopted, hosted game: the finished remaster
lives in [`app/`](app/) as it was built (its own Vite build, in the pnpm workspace), and the Hall
runs it at `play/robots/`.

| Document                                                   | For                      |
| ---------------------------------------------------------- | ------------------------ |
| [About](docs/ABOUT.md)                                     | Players deciding to play |
| [How to play](docs/HOW-TO-PLAY.md)                         | Players                  |
| [Architecture](docs/ARCHITECTURE.md)                       | Programmers              |
| [Changes from the original](docs/CHANGES-FROM-ORIGINAL.md) | Everyone curious         |
| [Notes](docs/NOTES.md)                                     | The next session         |

```bash
pnpm dev                                       # the Hall; open Robots from it
pnpm --dir games/robots/app dev                # Robots on its own at http://localhost:5202/
pnpm run test:hosted                           # its own unit tests (with the other hosted games)
pnpm exec playwright test -c games/robots      # Robots inside the Hall
```
