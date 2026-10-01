# Rain on Still Water (`rain`)

Rain on a night pond, every drop from the 1980 loop. An adopted, hosted game: the finished port
lives in [`app/`](app/) as it was built, and the Hall runs it at `play/rain/`.

| Document                                                   | For                      |
| ---------------------------------------------------------- | ------------------------ |
| [About](docs/ABOUT.md)                                     | Players deciding to play |
| [How to play](docs/HOW-TO-PLAY.md)                         | Players                  |
| [Architecture](docs/ARCHITECTURE.md)                       | Programmers              |
| [Changes from the original](docs/CHANGES-FROM-ORIGINAL.md) | Everyone curious         |
| [Notes](docs/NOTES.md)                                     | The next session         |

```bash
pnpm dev                                     # the Hall; open Rain on Still Water from it
pnpm --dir games/rain/app start              # Rain on Still Water on its own at http://localhost:5204/
pnpm run test:hosted                         # its own unit tests (with the other hosted games)
pnpm exec playwright test -c games/rain      # Rain on Still Water inside the Hall
```
