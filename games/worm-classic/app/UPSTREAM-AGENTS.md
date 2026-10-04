> **Upstream history, not instructions.** This is the agent guide the game shipped with before it
> joined /usr/games Reborn. Nothing here overrides the repository rules in `CLAUDE.md` and
> `AGENTS.md` at the repo root; where they differ, the repository rules win.

# AGENTS.md — `worm / fancy-web`

Thin pointer per [ADR-003](../../../../docs/decisions/003-multi-model-agents-md.md).

- **Port-specific docs:** [`docs/`](./docs/) —
  [`diff-log.md`](./docs/diff-log.md) (what changed vs BSD
  original) and [`decisions/`](./docs/decisions/) (three port
  ADRs).
- **Canonical game docs:** [`../../docs/`](../../docs/) —
  `spec.md` is the contract.
- **Repository-wide instructions:** root
  [`AGENTS.md`](../../../../AGENTS.md) — read first.

## Port summary

- **Style:** `fancy-web` per
  [ADR-006](../../../../docs/decisions/006-multi-port-architecture.md).
- **Stack:** single-file HTML + Canvas 2D + vanilla JavaScript
  (~1500 LOC, self-contained).
- **Deployment:** open [`index.html`](./index.html) in a modern
  browser. No build, no deps, no server.
- **Sibling reference:** `snake/ports/fancy-web/` — same style,
  same framework, complementary game mechanics.

## For AI agents making changes

- **Do not** silently deviate from
  [`../../docs/spec.md`](../../docs/spec.md). Any change altering
  BSD `worm(6)` mechanics needs an ADR in
  [`docs/decisions/`](./docs/decisions/).
- **Preserve the BSD spec faithfully**:
  - Progressive growth (tail stays N ticks after eating digit N).
  - Chained score bonus (`score += growing` after `growing += N`).
  - Wall = death, self-collision = death.
  - Single apple on grid at a time; respawn after eat.
- **Preserve the 8 cosmetic themes** (reused from snake port).
- **Preserve the 3 speed modes** — Classic / Fast / Progressive.
- **Do not paste local filesystem paths** — public repo.
- **Screenshots** in [`media/`](./media/) are per-theme captures
  via [`media/.capture.py`](./media/.capture.py) (Playwright).

## Owner and status

- **Owner:** Agun Wijaya (with Claude Opus)
- **Status:** 🟢 Released (per
  [`docs/progress.md`](../../../../docs/progress.md))
- **Live URL:** none yet — future work.

See [`docs/diff-log.md`](./docs/diff-log.md) for the running
narrative of every design decision made during the build.
