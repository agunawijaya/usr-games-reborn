# Escape the Gallows (`hangman-classic`)

Five rooms, five ciphers, six mistakes before the room wins. An adopted, hosted game: the owner’s
earlier fancy-web port of `hangman` lives in [`app/`](app/) (one HTML page and ES modules, no
build step), and the Hall runs it at `play/hangman-classic/`. Every picture in it is drawn in code
(`app/src/art/`); the port’s reference images never came along. It is the collection’s second
interpretation of `hangman`, beside the native game listed as `hangman` (Before the Tide).

| Document                                                   | For                      |
| ---------------------------------------------------------- | ------------------------ |
| [About](docs/ABOUT.md)                                     | Players deciding to play |
| [How to play](docs/HOW-TO-PLAY.md)                         | Players                  |
| [Architecture](docs/ARCHITECTURE.md)                       | Programmers              |
| [Changes from the original](docs/CHANGES-FROM-ORIGINAL.md) | Everyone curious         |
| [Notes](docs/NOTES.md)                                     | The next session         |

```bash
pnpm dev                                                    # the Hall; open Escape the Gallows from it
pnpm run test:hosted                                        # its own unit tests (with the other hosted games)
pnpm exec playwright test -c games/hangman-classic          # Escape the Gallows inside the Hall
SHOTS=1 pnpm exec playwright test -c games/hangman-classic  # the documentation screenshots
```

With `pnpm dev` running, `http://localhost:5173/play/hangman-classic/` also opens the game on its
own, outside the Hall’s frame.
