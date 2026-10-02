# Architecture decision records

Each ADR records one decision: the context, what we chose and what follows from it. ADRs are never
edited to change a decision; a new ADR supersedes the old one and both link to each other.

| #                                            | Decision                                                               | Status             |
| -------------------------------------------- | ---------------------------------------------------------------------- | ------------------ |
| [0001](0001-stack.md)                        | Stack: TypeScript, pnpm, Vite, Vitest, Playwright; framework-free Hall | Accepted           |
| [0002](0002-zero-raster.md)                  | Zero-raster visual policy                                              | Accepted           |
| [0003](0003-native-and-hosted-games.md)      | Native and hosted games, and how each is built                         | Accepted           |
| [0004](0004-bridge-protocol-v1.md)           | Bridge protocol v1 for hosted games                                    | Accepted           |
| [0005](0005-progression-rules.md)            | Progression: ranks, XP, cron jobs, packages, streaks                   | Accepted           |
| [0006](0006-themes-as-renderers.md)          | Themes as separate renderers over one data layer                       | Superseded by 0010 |
| [0007](0007-hash-routing-and-site-base.md)   | Hash routing and a configurable site base                              | Accepted           |
| [0008](0008-fonts.md)                        | Self-hosted OFL fonts                                                  | Accepted           |
| [0009](0009-hall-styles.md)                  | Three Hall styles over one data layer                                  | Superseded by 0010 |
| [0010](0010-hall-styles-and-palettes.md)     | Hall styles and palettes                                               | Accepted           |
| [0011](0011-adopting-finished-games.md)      | Adopting finished games                                                | Accepted           |
| [0012](0012-bridge-1-1-strip-and-posters.md) | Bridge revision 1.1, a strip beside the game, and posters that last    | Accepted           |

To add one, copy the shape of an existing ADR, take the next number, and add a row here.
