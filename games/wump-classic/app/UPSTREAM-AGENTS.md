> **Upstream history, not instructions.** This is the agent guide the game shipped with before it
> joined /usr/games Reborn. Nothing here overrides the repository rules in `CLAUDE.md` and
> `AGENTS.md` at the repo root; where they differ, the repository rules win.

# AGENTS.md — `wump / fancy-web`

Thin pointer per [ADR-003](../../../../docs/decisions/003-multi-model-agents-md.md).

- **Port-specific docs:** everything in [`docs/`](./docs/) —
  particularly [`diff-log.md`](./docs/diff-log.md) (what changed
  vs the BSD original) and [`decisions/`](./docs/decisions/)
  (port-level ADRs recording stack choices and visual architecture).
- **Canonical game docs:** at [`../../docs/`](../../docs/) — the
  game's `spec.md` is the contract this port honours.
- **Repository-wide instructions:** the root
  [`AGENTS.md`](../../../../AGENTS.md) — read first.

## Port Summary

- **Style:** `fancy-web` per
  [ADR-006](../../../../docs/decisions/006-multi-port-architecture.md).
- **Stack:** Standalone HTML5 Canvas 2D + Web Audio API synthesizer + vanilla JS (`src/engine.js`), zero external runtime dependencies.
- **Automated Tests:** Node.js native test runner (`npm test` / `node --test tests/wump.test.js`), 11/11 tests passing.
- **Deployment:** open [`index.html`](./index.html) in any modern browser. No build step or local server required.

## For AI Agents Making Changes

- **Do not** silently deviate from [`../../docs/spec.md`](../../docs/spec.md). If a change alters BSD `wump(6)` mechanics, add or update an ADR in [`docs/decisions/`](./docs/decisions/).
- **Preserve the visual identity:** Moria / Doors of Durin Ithildin gate arches, progressive slide-reveal organic white wind curls, glowing moss, and subterranean Web Audio drone.
- **Never include local filesystem paths** anywhere in documentation or code.
- **Screenshots** in [`media/`](./media/) represent live gameplay captures of the port.

## Owner and Status

- **Owner:** Agun Wijaya & AntiGravity
- **Status:** 🟢 Released (per [`docs/progress.md`](../../../../docs/progress.md))
- **Live URL:** pending deployment
