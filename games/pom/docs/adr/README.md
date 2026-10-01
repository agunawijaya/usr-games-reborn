# Port Decisions — `pom` · `fancy-web` (*Selene — A Living Moon*)

This directory holds Architecture Decision Records (ADRs) specific
to the `pom` `fancy-web` port.

| ADR | Title | Status |
|---|---|---|
| [001](./001-rendering-stack.md) | Rendering stack: raw WebGL2 + vanilla ES modules | Accepted |
| [002](./002-zero-raster-assets.md) | Zero raster assets: every pixel comes from code | Accepted |

## Inheritance

Root ADRs (in the repo-level `docs/decisions/`) set defaults for
every port in every game. Per-game ADRs (in
`bsdgames/pom/docs/decisions/`, currently empty) override root
defaults for this game across all its ports. Port-level ADRs (here)
override both — but only for this specific port.

Silence at any level = defer to the level above.

## When to write a port-level ADR

- **Any deliberate deviation from the canonical
  [`../../../../docs/spec.md`](../../../../docs/spec.md).** Silent
  deviation is a review-blocker per the Universal Port Contract
  (ADR-006).
- Non-trivial tech choices that a future maintainer of this port
  would need the reasoning behind.
- Additive features beyond the canonical spec, with their rationale
  and consequences.

## Format

Follow the ADR template at
[`../../../../../../docs/decisions/000-adr-template.md`](../../../../../../docs/decisions/000-adr-template.md).
Required sections: **Status / Context / Options Considered /
Decision / Consequences**. Numbering is per-port and independent
from the game and root numbering.
