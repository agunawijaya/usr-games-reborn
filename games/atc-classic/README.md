# Control Room 1986 (`atc-classic`)

Type the orders that bring every flight home. An adopted, hosted game: the owner’s earlier
typed-radar port of `atc` lives in [`app/`](app/) as it was built (plain ES modules, no build
step), and the Hall runs it at `play/atc-classic/`. It is the collection’s second interpretation of
`atc`, beside the native game listed as `atc`.

| Document                                                   | For                      |
| ---------------------------------------------------------- | ------------------------ |
| [About](docs/ABOUT.md)                                     | Players deciding to play |
| [How to play](docs/HOW-TO-PLAY.md)                         | Players                  |
| [Architecture](docs/ARCHITECTURE.md)                       | Programmers              |
| [Changes from the original](docs/CHANGES-FROM-ORIGINAL.md) | Everyone curious         |
| [Notes](docs/NOTES.md)                                     | The next session         |

```bash
pnpm dev                                                 # the Hall; open Control Room 1986 from it
pnpm run test:hosted                                     # its own unit tests (with the other hosted games)
pnpm exec playwright test -c games/atc-classic           # Control Room 1986 inside the Hall
SHOTS=1 pnpm exec playwright test -c games/atc-classic   # the documentation screenshots
```

With `pnpm dev` running, `http://localhost:5173/play/atc-classic/` also opens the game on its own,
outside the Hall’s frame.
