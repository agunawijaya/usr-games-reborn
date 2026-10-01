# Trek — Deep Space (`trek`)

Clear the galaxy of hostile ships before time runs out. An adopted, hosted game: the finished
procedural port lives in [`app/`](app/) as it was built (plain ES modules, no build step), and the
Hall runs it at `play/trek/`.

| Document                                                   | For                      |
| ---------------------------------------------------------- | ------------------------ |
| [About](docs/ABOUT.md)                                     | Players deciding to play |
| [How to play](docs/HOW-TO-PLAY.md)                         | Players                  |
| [Architecture](docs/ARCHITECTURE.md)                       | Programmers              |
| [Changes from the original](docs/CHANGES-FROM-ORIGINAL.md) | Everyone curious         |
| [Notes](docs/NOTES.md)                                     | The next session         |

```bash
pnpm dev                                     # the Hall; open Trek — Deep Space from it
pnpm --dir games/trek/app serve              # Trek on its own at http://localhost:5208/
pnpm run test:hosted                         # its own unit tests (with the other hosted games)
pnpm exec playwright test -c games/trek      # Trek inside the Hall
SHOTS=1 pnpm exec playwright test -c games/trek   # the documentation screenshots
```
