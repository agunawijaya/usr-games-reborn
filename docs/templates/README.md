# Game documentation templates

Every game ships five documents in `games/<id>/docs/`, copied from these templates and filled in:

| File                                                   | For                      | Contents                                                                  |
| ------------------------------------------------------ | ------------------------ | ------------------------------------------------------------------------- |
| [`ABOUT.md`](ABOUT.md)                                 | Players deciding to play | The hook, where it comes from, what is new                                |
| [`HOW-TO-PLAY.md`](HOW-TO-PLAY.md)                     | Players                  | Controls, rules, modes, settings, scoring, packages, tips                 |
| [`ARCHITECTURE.md`](ARCHITECTURE.md)                   | Programmers              | Module map, state machines, AI, where every visual and sound lives, tests |
| [`CHANGES-FROM-ORIGINAL.md`](CHANGES-FROM-ORIGINAL.md) | Everyone curious         | What we kept, what changed and why, quirks, derived logic                 |
| [`NOTES.md`](NOTES.md)                                 | The next session         | Verified facts, simulations, measurements, decisions                      |

Diagrams are Mermaid only; `pnpm check` validates every block. Screenshots go in
`games/<id>/docs/media/`.
