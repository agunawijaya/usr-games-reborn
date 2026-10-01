# Selene (`pom`)

A living Moon, painted from pom’s own numbers. An adopted, hosted game: the finished port lives in
[`app/`](app/) as it was built, and the Hall runs it at `play/pom/`.

| Document                                                   | For                      |
| ---------------------------------------------------------- | ------------------------ |
| [About](docs/ABOUT.md)                                     | Players deciding to play |
| [How to play](docs/HOW-TO-PLAY.md)                         | Players                  |
| [Architecture](docs/ARCHITECTURE.md)                       | Programmers              |
| [Changes from the original](docs/CHANGES-FROM-ORIGINAL.md) | Everyone curious         |
| [Notes](docs/NOTES.md)                                     | The next session         |

```bash
pnpm dev                                    # the Hall; open Selene from it
pnpm --dir games/pom/app start              # Selene on its own at http://localhost:5201/
pnpm run test:hosted                        # its own unit tests (with the other hosted games)
pnpm exec playwright test -c games/pom      # Selene inside the Hall
```
