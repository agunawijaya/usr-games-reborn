# ADR fancy-web-003: Shipping Format — Single-File HTML for v1

## Status

**Accepted** — 2026-09-17.

## Context

Same decision context as the sibling snake port's
[`fancy-web-003`](../../../../../snake/ports/fancy-web/docs/decisions/fancy-web-003-shipping-format.md).
ADR-005 defines the reference `classic-web` stack (TypeScript +
Vite + PWA + optional Capacitor Android) as the *reference for
that style*. `fancy-web` ports are unconstrained by ADR-005
per its §Revision Note.

So this port could pick any stack. What ship-format for v1?

## Options considered

Detailed pros/cons discussion mirrors the snake port's
[`fancy-web-003`](../../../../../snake/ports/fancy-web/docs/decisions/fancy-web-003-shipping-format.md).
Executive summary:

### Option A: Vite + TypeScript scaffolding from day 1

Pros: reference-stack alignment, type safety, module structure,
Vitest tests, HMR dev experience.

Cons: requires Node + `npm install` to run; adds ~30 minutes of
scaffolding before any code change is possible; bundle output is
minified/hostile-to-View-Source; ~1500 LOC is below the module-
split threshold.

### Option B: Single-file HTML (chosen)

Pros: zero install friction, zero build tooling, full source via
View Source, runs offline, ~1500 LOC is manageable single-file,
fast iteration.

Cons: no TypeScript, no import graph, no test tooling, no code
splitting, migration later is a refactor.

### Option C: Hybrid — both maintained

Pros: best of both during transition.

Cons: two implementations to sync — support cost outweighs gain
until modular version has real advantages.

## Decision

**Option B: Single-file HTML for v1** — same reasoning as the
snake port.

Additional reason specific to worm: the worm port **reuses**
snake's visual toolkit (theme system, particle system, offscreen
static-layer cache, single-pass body glow). Building both as
single-file HTMLs keeps their code visually comparable via
side-by-side View Source. That's a real pedagogical win we'd lose
by adding a bundler.

## Consequences

Positive and negative consequences identical to the snake port's
ADR; see there for details.

### Migration trigger

Same criteria as snake port. Migrate to Vite + TS + PWA when
**any of these** becomes true:

- Codebase exceeds 3000 LOC in one file.
- 3+ contributors are actively editing.
- User demand for PWA installability materializes.
- A different port style is derived from this port's logic and
  would benefit from shared modules.
- A live-URL deployment is prioritized.

None true in v1. All plausible for v2.

**Additionally trigger for worm-specific reason:** if we build a
third fancy-web port sharing enough with worm and snake, extract
the shared toolkit to `shared/` (per ADR-005) with all three
ports migrating to import from it. Two-port reuse (worm + snake)
via copy is fine; three-port reuse deserves formalization.

## References

- Sister port's identical ADR:
  [`../../../../../snake/ports/fancy-web/docs/decisions/fancy-web-003-shipping-format.md`](../../../../../snake/ports/fancy-web/docs/decisions/fancy-web-003-shipping-format.md)
- [ADR-005 §Revision Note](../../../../../../docs/decisions/005-target-language-and-ui-stack.md)
- [ADR-006 §Universal Port Contract](../../../../../../docs/decisions/006-multi-port-architecture.md)
- Sister ADRs:
  [`fancy-web-001-spec-deviations.md`](./fancy-web-001-spec-deviations.md),
  [`fancy-web-002-additive-features.md`](./fancy-web-002-additive-features.md)
