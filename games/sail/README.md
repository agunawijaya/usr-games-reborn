# Broadside (`sail`)

Command a wooden warship in the age of sail. An adopted, hosted game: the finished port lives in
[`app/`](app/) as it was built (plain ES modules and a vendored three.js, no build step), and the
Hall runs it at `play/sail/`.

| Document                                                   | For                      |
| ---------------------------------------------------------- | ------------------------ |
| [About](docs/ABOUT.md)                                     | Players deciding to play |
| [How to play](docs/HOW-TO-PLAY.md)                         | Players                  |
| [Architecture](docs/ARCHITECTURE.md)                       | Programmers              |
| [Changes from the original](docs/CHANGES-FROM-ORIGINAL.md) | Everyone curious         |
| [Notes](docs/NOTES.md)                                     | The next session         |

```bash
pnpm dev                                     # the Hall; open Broadside from it
pnpm --dir games/sail/app serve              # Broadside on its own at http://localhost:5205/
pnpm run test:hosted                         # its own unit tests (with the other hosted games)
pnpm exec playwright test -c games/sail      # Broadside inside the Hall
SHOTS=1 pnpm exec playwright test -c games/sail   # its documentation screenshots
```
