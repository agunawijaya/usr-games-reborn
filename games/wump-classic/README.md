# The Rune Gates (`wump-classic`)

Read the draft, the stench and the wings. Loose a crooked arrow. An adopted, hosted game: the
owner’s earlier fancy-web port of `wump` lives in [`app/`](app/) (plain HTML, ES modules and a
Canvas 2D scene, no build step), and the Hall runs it at `play/wump-classic/`. It is the
collection’s second interpretation of `wump`, beside the native game listed as `wump`.

| Document                                                   | For                      |
| ---------------------------------------------------------- | ------------------------ |
| [About](docs/ABOUT.md)                                     | Players deciding to play |
| [How to play](docs/HOW-TO-PLAY.md)                         | Players                  |
| [Architecture](docs/ARCHITECTURE.md)                       | Programmers              |
| [Changes from the original](docs/CHANGES-FROM-ORIGINAL.md) | Everyone curious         |
| [Notes](docs/NOTES.md)                                     | The next session         |

```bash
pnpm dev                                                  # the Hall; open The Rune Gates from it
pnpm run test:hosted                                      # its own unit tests (with the other hosted games)
pnpm exec playwright test -c games/wump-classic           # The Rune Gates inside the Hall
SHOTS=1 pnpm exec playwright test -c games/wump-classic   # the documentation screenshots
```

With `pnpm dev` running, `http://localhost:5173/play/wump-classic/` also opens the game on its own,
outside the Hall’s frame.
