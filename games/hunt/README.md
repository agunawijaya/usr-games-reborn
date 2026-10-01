# Hunt — Ricochet (`hunt`)

A maze, a few rivals and nowhere to hide. An adopted, hosted game: the finished port lives in
[`app/`](app/) as it was built (plain ES modules, no build step), and the Hall runs it at
`play/hunt/`.

| Document                                                   | For                      |
| ---------------------------------------------------------- | ------------------------ |
| [About](docs/ABOUT.md)                                     | Players deciding to play |
| [How to play](docs/HOW-TO-PLAY.md)                         | Players                  |
| [Architecture](docs/ARCHITECTURE.md)                       | Programmers              |
| [Changes from the original](docs/CHANGES-FROM-ORIGINAL.md) | Everyone curious         |
| [Notes](docs/NOTES.md)                                     | The next session         |

```bash
pnpm dev                                      # the Hall; open Hunt — Ricochet from it
pnpm --dir games/hunt/app serve               # Hunt on its own at http://localhost:5206/
pnpm run test:hosted                          # its own unit tests (with the other hosted games)
pnpm exec playwright test -c games/hunt       # Hunt inside the Hall
```
