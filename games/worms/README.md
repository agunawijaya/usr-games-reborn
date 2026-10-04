# Abyssal Worms (`worms`)

Glowing worms crawling the floor of a deep, dark sea. An adopted, hosted game: the finished port
lives in [`app/`](app/) as it was built, with a logbook added around it (sightings, a journal of
species, a Daily Dive and postcards), and the Hall runs it at `play/worms/`.

| Document                                                   | For                      |
| ---------------------------------------------------------- | ------------------------ |
| [About](docs/ABOUT.md)                                     | Players deciding to play |
| [How to play](docs/HOW-TO-PLAY.md)                         | Players                  |
| [Architecture](docs/ARCHITECTURE.md)                       | Programmers              |
| [Changes from the original](docs/CHANGES-FROM-ORIGINAL.md) | Everyone curious         |
| [Notes](docs/NOTES.md)                                     | The next session         |

```bash
pnpm dev                                      # the Hall; open Abyssal Worms from it
pnpm --dir games/worms/app start              # Abyssal Worms on its own at http://localhost:5203/
pnpm run test:hosted                          # its own unit tests (with the other hosted games)
pnpm exec playwright test -c games/worms      # Abyssal Worms inside the Hall
SHOTS=1 pnpm exec playwright test -c games/worms   # the documentation screenshots
```
