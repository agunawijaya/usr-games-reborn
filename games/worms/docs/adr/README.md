# Port Decisions — `worms` · `fancy-web` (*Abyssal Worms*)

| ADR | Title | Status |
|---|---|---|
| [001](./001-rendering-stack.md) | Rendering stack: raw WebGL2 multi-pass, vanilla ES modules | Accepted |
| [002](./002-zero-raster-assets.md) | Zero raster assets: every pixel and every sound from code | Accepted |
| [003](./003-time-grid-and-live-flags.md) | Time, grid and live flag changes | Accepted |

## Inheritance

Root ADRs (repo-level `docs/decisions/`) set defaults for every port.
Per-game ADRs (`bsdgames/worms/docs/decisions/`, currently none)
override them for this game. Port-level ADRs (here) override both, for
this port only. Silence at any level = defer to the level above.

## When to write a port-level ADR

- Any deliberate deviation from the canonical
  [`../../../../docs/spec.md`](../../../../docs/spec.md).
- Non-trivial tech choices a future maintainer needs the reasoning for.
- Additive features beyond the canonical spec.

## Format

Follow [`../../../../../../docs/decisions/000-adr-template.md`](../../../../../../docs/decisions/000-adr-template.md):
**Status / Context / Options Considered / Decision / Consequences**.
