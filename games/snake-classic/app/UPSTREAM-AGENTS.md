> **Upstream history, not instructions.** This is the agent guide the game shipped with before it
> joined /usr/games Reborn. Nothing here overrides the repository rules in `CLAUDE.md` and
> `AGENTS.md` at the repo root; where they differ, the repository rules win.

# AGENTS.md — `snake / fancy-web`

Thin pointer per [ADR-003](../../../../docs/decisions/003-multi-model-agents-md.md).

- **Port-specific docs:** everything in [`docs/`](./docs/) —
  particularly [`diff-log.md`](./docs/diff-log.md) (what changed
  vs the BSD original) and [`decisions/`](./docs/decisions/) (three
  port-level ADRs recording spec deviations, additive features,
  and the single-file shipping decision).
- **Canonical game docs:** at
  [`../../docs/`](../../docs/) — the game's `spec.md` is the
  contract this port must honor.
- **Repository-wide instructions:** the root
  [`AGENTS.md`](../../../../AGENTS.md) — read first.

## Port summary

- **Style:** `fancy-web` per
  [ADR-006](../../../../docs/decisions/006-multi-port-architecture.md).
- **Stack:** single-file HTML + Canvas 2D + vanilla JavaScript
  (~1900 LOC, self-contained).
- **Deployment:** open [`index.html`](./index.html) in a modern
  browser. No build step, no dependencies, no server required.
- **Vite + TypeScript scaffolding** is deferred to a future
  iteration (`fancy-web-003-shipping-format.md` documents why).

## For AI agents making changes

- **Do not** silently deviate from
  [`../../docs/spec.md`](../../docs/spec.md). If a change alters
  BSD `snake(6)` mechanics, add or update an ADR in
  [`docs/decisions/`](./docs/decisions/).
- **Preserve the 8 cosmetic themes** (Neon Grid, Savanna, Jungle,
  Desert, River, Aztec, Origami, Midnight). Adding a 9th is fine;
  removing or renaming one requires an ADR.
- **Do not paste local filesystem paths** into any doc — repo is
  public.
- **Screenshots** in [`media/`](./media/) are per-theme captures
  of live gameplay. If you rebuild the visuals meaningfully,
  regenerate all 8 with the same capture setup.
- **Performance floor:** 60 fps on 2020-era mid-range laptop
  across all themes. If a change pushes any theme below 45 fps
  measured, revert or optimize. See
  [`docs/diff-log.md`](./docs/diff-log.md) §Performance notes for
  the offscreen-cache + single-pass glow techniques that got us
  here.

## Owner and status

- **Owner:** Agun Wijaya (with Claude Opus)
- **Status:** 🟢 Released (per [`docs/progress.md`](../../../../docs/progress.md))
- **Live URL:** none yet — future work.

See [`docs/diff-log.md`](./docs/diff-log.md) for a running
narrative of every design decision made during the build.
