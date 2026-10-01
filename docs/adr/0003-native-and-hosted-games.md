# 0003 — Native and hosted games, and how each is built

- **Status:** Accepted
- **Date:** 2026-09-28

## Context

Most games will be written from scratch in this repository against the kit. Eight finished games,
built earlier by the owner with other stacks (vanilla JavaScript, WebGL, three.js, React), join the
collection as they are. Both kinds must launch from the same Hall, earn the same XP and follow the
same navigation standard, and the whole collection must build into one static site.

## Decision

Two kinds of game, declared by `kind` in each manifest:

- **Native** games live in `games/<id>/` as workspace packages. `src/index.ts` exports a
  `GameModule` (`mount`, `demo`, `achievements`) typed by `@usr-games/kit`. The Hall mounts them in
  its own document and code-splits each into its own chunk.
- **Hosted** games live in `games/<id>/app/` exactly as adopted. They run in a same-origin
  `<iframe>` served from `play/<id>/` and talk to the Hall only through the bridge (ADR 0004).

Each manifest's `build` says how it is built and where the output lands:

| `build.kind`    | What the build does                                                               | Output                        |
| --------------- | --------------------------------------------------------------------------------- | ----------------------------- |
| `native`        | Compiled together with the Hall by Vite                                           | Hall chunks in `dist/assets/` |
| `hosted-static` | Copies `build.source` as is                                                       | `dist/play/<id>/`             |
| `hosted-vite`   | Runs the game's own Vite build with `base` set to the site base plus `play/<id>/` | `dist/play/<id>/`             |

`build.output` must equal `play/<id>/`; the validator enforces it. `pnpm build` builds the Hall, then
the bridge into `dist/bridge/`, then every hosted game whose source folder exists. A hosted game
whose folder is missing (for example before its adoption) is skipped with a clear warning, not an
error. `pnpm build --fixtures` also builds the two bridge fixtures, one per hosted build kind.

## Consequences

- Prompt 01 only adds folders, manifests and catalog lines; the build already knows every kind.
- Hosted games cannot import the kit. What they need (appearance tokens, settings, XP) arrives over
  the bridge.
- Games never import from each other. Shared code goes through `packages/kit` (native) or
  `packages/bridge` (hosted), each owned by one named session per wave.
