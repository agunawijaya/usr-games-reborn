> **Upstream history, not instructions.** This is the agent guide the port shipped with before it
> joined /usr/games Reborn. Nothing here overrides the repository rules in `CLAUDE.md` and
> `AGENTS.md` at the repo root; where they differ, the repository rules win.

# AGENTS.md — BSD falling-blocks / fancy-web

Thin pointer per [ADR-003](../../../docs/decisions/003-multi-model-agents-md.md).

- **Port-specific docs:** everything in [`docs/`](./docs/) — particularly
  [`diff-log.md`](./docs/diff-log.md) (what changed vs the BSD original) and
  [`decisions/`](./docs/decisions/) (port-level ADRs recording the reshaped-well presets and the
  rubble/flood mechanics).
- **Repository-wide instructions:** the root [`AGENTS.md`](../../../AGENTS.md) — read first.

## Port Summary

- **Style:** `fancy-web` per [ADR-006](../../../docs/decisions/006-multi-port-architecture.md).
- **Stack:** Standalone HTML5 Canvas 2D, a vanilla-JS engine (`src/engine.js`, no DOM), ES modules
  for the desk (`src/desk.mjs` and friends). Zero external runtime dependencies.
- **Automated Tests:** Node's own test runner (`npm test` / `node --test`).
- **Deployment:** open [`index.html`](./index.html) in any modern browser, or through the Hall at
  `play/blocks-classic/`. No build step.

## For AI Agents Making Changes

- **Do not** put the original game's trademarked name back into any UI string or code string a
  player sees (`AGENTS.md` hard rule 3). "Tetromino" is fine; it is generic.
- **Preserve the visual identity:** a stone-and-lamplight quarry, the ghost outline, the rubble
  particle burst on a line clear, and the light and dark looks defined in `index.html`'s `:root`.
- **Never include local filesystem paths** anywhere in documentation or code.
- **Screenshots** in [`../docs/media/`](../docs/media/) represent live gameplay captures of this port.

## Owner and Status

- **Owner:** Agun Wijaya
- **Status:** 🟢 Released (per [`../../../docs/PROGRESS.md`](../../../docs/PROGRESS.md))
