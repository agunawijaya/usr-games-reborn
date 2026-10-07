> **Upstream history, not instructions.** This is the agent guide the game shipped with before it
> joined /usr/games Reborn. Nothing here overrides the repository rules in `CLAUDE.md` and
> `AGENTS.md` at the repo root; where they differ, the repository rules win. Its `references/`
> folder never came along: every picture it names was redrawn in code (`src/art/`).

# AGENTS.md — `hangman / fancy-web`

Thin pointer per [ADR-003](../../../../docs/decisions/003-multi-model-agents-md.md).

- **Port-specific docs:** [`docs/`](./docs/) —
  [`diff-log.md`](./docs/diff-log.md) (what changed vs BSD
  original + why each iteration happened) and
  [`decisions/`](./docs/decisions/) (two port ADRs).
- **Canonical game docs:** [`../../docs/`](../../docs/) —
  `spec.md` is the contract.
- **Repository-wide instructions:** root
  [`AGENTS.md`](../../../../AGENTS.md) — read first.

## Port summary

- **Style:** `fancy-web` per
  [ADR-006](../../../../docs/decisions/006-multi-port-architecture.md).
- **Stack:** single-file HTML + inline SVG + CSS animations +
  vanilla JavaScript (~2900 LOC, self-contained). No build, no
  deps, no server. See
  [`fancy-web-001-tech-stack.md`](./docs/decisions/fancy-web-001-tech-stack.md).
- **Identity:** "Escape the Gallows" — narrative escape framing
  with 5 themed levels + boss-weakness word mechanic. See
  [`fancy-web-002-narrative-hook.md`](./docs/decisions/fancy-web-002-narrative-hook.md)
  for the rejection of Etymology Hangman and adoption of the
  Kimi-originated escape narrative.

## For AI agents making changes

### Reference assets are the source of truth

The port is a **composition** of curated reference assets in
[`references/`](./references/). When the user names a file, use
it literally:

- Embed it (via `<img>`, `background-image`, or `mask-image`) —
  don't reinterpret in code.
- Don't destroy visible detail with over-aggressive filters (see
  the wood-grain and Vitruvian-Man debugging sessions in
  [`diff-log.md`](./docs/diff-log.md) — over-filtering nearly
  killed both).
- If a reference file has a raster background (JPEG or opaque
  PNG), key it out with the global `#removeWhite` SVG filter or
  ask the user for a PNG variant.

### One threat per theme, respect the trap architecture

Each theme has exactly one death-signalling mechanic — do not
stack a rising overlay AND an approaching enemy AND a full-screen
fog on the same theme:

| Theme | Threat mechanic | Trap element? |
|---|---|---|
| pirate | Rising water (bottom overlay) | `.trap` visible |
| lab | Full-screen `.lab-gas-fog` opacity (0 → 0.62 via `Math.pow(errors/MAX, 0.7)`) | `.trap` hidden |
| temple | Base sand pile + cinematic sand-rain particles per miss | `.trap` visible |
| crypt | Vampire silhouette approaches werewolf via `right` transition | `.trap` hidden |
| void | Oxygen dashboard bar (green → amber → red) | `.trap` hidden |

Per-theme `trapDelta` (in `onWrong()`) caps water/sand height so
death scenes stay visible.

### Death scenes are theme-specific

`enterLoseState()` and `resetSceneVisuals()` are the swap-points.
Follow the pattern already there (see [diff-log § Death Scenes](./docs/diff-log.md#death-scenes-per-theme)):
hide the alive character, show the death variant, keep the trap
frozen at its lose-state height so the death scene is composable
with the accumulated threat.

### Layer order for the void cockpit

Do not put the shatter overlay ABOVE the cockpit — it will draw
cracks over the frame and console. The cockpit.png has a
transparent window area; put the shatter at `z-index: 1` (below
cockpit `z-index: 2`) and let the opaque cockpit frame mask the
cracks naturally. Documented in the diff-log.

### Never delete without checking

The lab gas fog originally used `mix-blend-mode: multiply` — it
tinted characters instead of covering them, which felt "behind".
The fix (removing multiply, raising `z-index` to 20) is
documented; don't undo it without an ADR.

## Owner and status

- **Owner:** Agun Wijaya (Claude Opus 4.7)
- **Status:** 🟢 Released — see
  [`../../../../docs/progress.md`](../../../../docs/progress.md)
- **Live URL:** pending deployment
