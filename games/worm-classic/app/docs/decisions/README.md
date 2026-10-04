# Local Decisions — `worm / fancy-web`

Port-level ADRs for the `fancy-web` port of BSD `worm(6)`.

Root-level ADRs at
[`../../../../../../docs/decisions/`](../../../../../../docs/decisions/).
These local ADRs **refine** or **document deviations** from root
ADRs — they never override root decisions.

## Naming

`fancy-web-NNN-slug.md`.

## Current ADRs

| # | Title | Status | Summary |
|--:|---|---|---|
| 001 | [Spec deviations](./fancy-web-001-spec-deviations.md) | Accepted | Digit → numbered apple; text grid → canvas; discrete steps → interpolated motion; single tick rate → settings picker; HJKL burst mode deferred. |
| 002 | [Additive features](./fancy-web-002-additive-features.md) | Accepted | 8 cosmetic themes reused from snake port, particle effects, ambient drift, localStorage persistence, restart lockout, head detail, progressive body gradient. |
| 003 | [Shipping format](./fancy-web-003-shipping-format.md) | Accepted | Single-file HTML for v1. Vite + TypeScript + PWA deferred. |
| 004 | [Wild mode](./fancy-web-004-wild-mode.md) | Accepted (Phase 0 shipped) | Two-mode architecture: Pure (spec-faithful, shipped as v1) + Wild (multi-apple + rot + bonus frog now; enemies iterate through Phases 1-4). |

## ADR template

See [`../../../../../snake/ports/fancy-web/docs/decisions/README.md`](../../../../../snake/ports/fancy-web/docs/decisions/README.md)
for the boilerplate template.

## See also

- Root ADR index:
  [`../../../../../../docs/decisions/`](../../../../../../docs/decisions/)
- Sister port's local ADRs:
  [`../../../../../snake/ports/fancy-web/docs/decisions/`](../../../../../snake/ports/fancy-web/docs/decisions/)
