# Local Decisions — `snake / fancy-web`

Port-level ADRs for the `fancy-web` port of BSD `snake(6)`.

Root-level ADRs (governing the whole repo) are at
[`../../../../../../docs/decisions/`](../../../../../../docs/decisions/).
These local ADRs **refine** or **document deviations** from root
ADRs — they never override root decisions.

## Naming

`fancy-web-NNN-slug.md` — 3-digit zero-padded number, kebab-case
slug.

## Current ADRs

| # | Title | Status | Summary |
|--:|---|---|---|
| 001 | [Spec deviations](./fancy-web-001-spec-deviations.md) | Accepted | Visual reinterpretation of `$`, `~`, grid, and motion model. Authorized under ADR-002 (spiritual successor) + ADR-006 (`fancy-web` style). |
| 002 | [Additive features](./fancy-web-002-additive-features.md) | Accepted | 8 cosmetic themes, eagle state machine + shadow warning, particle effects, localStorage best-score. |
| 003 | [Shipping format](./fancy-web-003-shipping-format.md) | Accepted | Single-file HTML for v1. Vite + TypeScript + PWA deferred to v2. |

## ADR template

```markdown
# ADR fancy-web-NNN: Title

## Status

Proposed | Accepted | Superseded by ADR fancy-web-XXX

## Context

What forces the decision? What constraint or ambiguity does it
resolve?

## Options

1. **Option A** — description, pros, cons.
2. **Option B** — description, pros, cons.

## Decision

Which option, and why.

## Consequences

What becomes possible / constrained by this decision.

## References

Links to related ADRs, code, or docs.
```

## See also

- Root ADR index:
  [`../../../../../../docs/decisions/`](../../../../../../docs/decisions/)
- [ADR-006 §Universal Port Contract](../../../../../../docs/decisions/006-multi-port-architecture.md#universal-port-contract)
  — the enforcement framework for these local ADRs.
