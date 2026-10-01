# Port Decisions

This directory holds Architecture Decision Records (ADRs) specific
to the `robots` `fancy-web-remastered` port.

## Existing ADRs

- [`001-tech-stack.md`](./001-tech-stack.md) — *inherited from
  `fancy-web`* (copied with the code): TypeScript + React 18 +
  @react-three/fiber + Vite.
- [`002-safe-wait-deviation.md`](./002-safe-wait-deviation.md) —
  *inherited from `fancy-web`*: `w` is the safe wait (a deviation
  from the spec's risky wait). Unchanged here.
- [`003-remaster-scope.md`](./003-remaster-scope.md) — the remaster
  is a separate port that changes the presentation only: rules
  identical to `fancy-web`, effects read from state changes.

## Inheritance

Root ADRs (in the repo-level `docs/decisions/`) set defaults for
every port in every game. Per-game ADRs (in
`bsdgames/robots/docs/decisions/`, rare) override root defaults
for `robots` across all its ports. Port-level ADRs (here) override
both — but only for `robots/fancy-web-remastered` specifically.

Silence at any level = defer to the level above.

## When to write a port-level ADR

- **Any deliberate deviation from the canonical
  [`../../../docs/spec.md`](../../../docs/spec.md).** Silent
  deviation is a review-blocker per the Universal Port Contract
  (ADR-006).
- Non-trivial tech choices that a future maintainer would need
  the reasoning behind (framework selection, rendering approach,
  state model, networking transport, etc.).
- Additive features beyond the canonical spec — sound effects,
  achievements, alternate modes — with rationale and consequences.

## When *not* to write a port-level ADR

- Choices already covered by root or per-game ADRs — defer.
- Trivial implementation details a diff-log entry can cover.
- Anything that changes the canonical spec — that requires a PR
  to the canonical spec itself, not a port-level workaround.

## Format

Follow the ADR template at
[`../../../../../../docs/decisions/000-adr-template.md`](../../../../../../docs/decisions/000-adr-template.md).
Required sections: **Status / Context / Options Considered /
Decision / Consequences**. Options analysis is mandatory — it is
what makes the ADR pedagogical.

Numbering is per-port (starts from `001-<slug>.md`) and
independent from the game and root numbering.
