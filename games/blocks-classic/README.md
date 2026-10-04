# Broken Well (`blocks-classic`)

The well never holds its shape. Clear it, or outlast the flood. An adopted, hosted game: the
owner's earlier fancy-web port of BSD `tetris` lives in [`app/`](app/) (plain HTML, a classic
engine script and ES modules for the desk, no build step), and the Hall runs it at
`play/blocks-classic/`. It is the collection's second interpretation of `tetris`, beside the native
game listed as `blocks` (Sinkers).

| Document                                                   | For                      |
| ------------------------------------------------------------ | ------------------------ |
| [About](docs/ABOUT.md)                                     | Players deciding to play |
| [How to play](docs/HOW-TO-PLAY.md)                         | Players                  |
| [Architecture](docs/ARCHITECTURE.md)                       | Programmers              |
| [Changes from the original](docs/CHANGES-FROM-ORIGINAL.md) | Everyone curious         |
| [Notes](docs/NOTES.md)                                     | The next session         |

```bash
pnpm dev                                                    # the Hall; open Broken Well from it
pnpm run test:hosted                                        # its own unit tests (with the other hosted games)
pnpm exec playwright test -c games/blocks-classic           # Broken Well inside the Hall
SHOTS=1 pnpm exec playwright test -c games/blocks-classic   # the documentation screenshots
```

With `pnpm dev` running, `http://localhost:5173/play/blocks-classic/` also opens the game on its
own, outside the Hall's frame.
