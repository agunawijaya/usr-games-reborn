# Pajamas to Paradise (`battlestar`)

Wake up aboard a dying starship and find your way to paradise. An adopted, hosted game: the
finished port lives in [`app/`](app/) as it was built (plain ES modules, no build step), and the
Hall runs it at `play/battlestar/`.

> **Content note.** The game keeps the 1979 program’s own text, which is not all-ages. The owner
> chose to ship it unchanged until the battlestar modification prompt revises the text; see
> [About](docs/ABOUT.md#a-note-on-content) and `docs/KNOWN-ISSUES.md`.

| Document                                                   | For                      |
| ---------------------------------------------------------- | ------------------------ |
| [About](docs/ABOUT.md)                                     | Players deciding to play |
| [How to play](docs/HOW-TO-PLAY.md)                         | Players                  |
| [Architecture](docs/ARCHITECTURE.md)                       | Programmers              |
| [Changes from the original](docs/CHANGES-FROM-ORIGINAL.md) | Everyone curious         |
| [Notes](docs/NOTES.md)                                     | The next session         |

```bash
pnpm dev                                                # the Hall; open Pajamas to Paradise from it
pnpm --dir games/battlestar/app start                   # the game on its own at http://localhost:5207/
pnpm run test:hosted                                    # its own unit tests (with the other hosted games)
pnpm exec playwright test -c games/battlestar           # the game inside the Hall
SHOTS=1 pnpm exec playwright test -c games/battlestar   # the documentation screenshots
```
