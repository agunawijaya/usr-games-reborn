# ADR fancy-web-003: Shipping Format — Single-File HTML for v1

## Status

**Accepted** — 2026-09-17.

## Context

ADR-005 (Reference Language & UI Stack) says the reference stack
for `classic-web` ports and the `@bsdgames/shared` package is
**TypeScript + Vite + PWA + optional Capacitor Android**.

ADR-005 §Revision Note explicitly states that "a port under any
other style prefix... is unconstrained by this ADR" and picks its
own stack under ADR-006's Universal Port Contract.

So this `fancy-web` port could pick any stack.

What ship-format should v1 use?

## Options considered

### Option A: Vite + TypeScript scaffolding from day 1

**Description:** create `package.json`, `vite.config.ts`, `tsconfig.json`,
`src/main.ts`, split game logic into modules (`snake.ts`, `eagle.ts`,
`themes.ts`, `render.ts`, `game.ts`). Add Vitest for unit tests.
Deploy via `vite build` → static host.

**Pros:**
- Aligns with reference stack (ADR-005).
- Type-safety for the ~1900 lines of code.
- Module structure aids future contributors.
- Vitest gives us a proper test harness.
- Hot-reload dev experience.
- Bundle splitting could improve first-load time.

**Cons:**
- **Build step required** to run. No more "double-click index.html
  and play". Contributor needs Node.js + `npm install` + `npm run
  dev`.
- **~30 minutes of scaffolding work** (Vite config, TS config,
  module split, import wiring) before ANY code change is possible.
- **Bundle output is not directly readable.** The single-file
  approach lets a curious visitor View Source and understand the
  whole game. A Vite bundle is minified, tree-shaken, hash-named
  — hostile to that pedagogical read.
- The port is 1900 lines. That's below the threshold where
  "single file becomes unreadable". Split-into-modules gains
  are marginal at this size.

### Option B: Single-file HTML (chosen)

**Description:** everything in `index.html` — HTML, CSS, and JS
inlined. No `package.json`, no build tools, no `node_modules`.
Double-click the file → game plays.

**Pros:**
- **Zero install friction.** Anyone with a modern browser can
  play in ≤3 seconds. Perfect for the "share via URL" story
  ADR-005 emphasizes.
- **Zero build tooling to maintain.** No dependency updates, no
  bundler upgrades, no lockfile drift.
- **Full source visible via View Source.** A pedagogical win —
  the port is a learning artifact, not just a game.
- **Runs offline out of the gate.** No service worker needed for
  offline; the file IS the offline app.
- **1900 lines is manageable.** Well-structured single file with
  clear sections (`// ============= X =============` headers) is
  navigable via search.
- **Fast iteration during design.** Refresh browser = done. No
  build wait, no HMR quirks.

**Cons:**
- **No TypeScript.** JSDoc annotations partially compensate but
  full type safety is unavailable.
- **No import graph.** All globals in one scope. Requires
  discipline to avoid name collisions.
- **No test tooling.** Manual test scenarios in
  `test-scenarios.md` are the acceptance mechanism; no CI
  regression net.
- **No code splitting.** Whole app loads at once. For 1900 LOC
  this is fine (~50 KB minified equivalent).
- **Migrating later is a refactor.** If we later choose to
  scaffold Vite + TS, the split isn't free — but it's also not
  hard for a code base this size.

### Option C: Hybrid — single file now, modules later, both maintained

**Description:** ship `index.html` + `src/modular/*.ts` in
parallel. Users pick their entry point.

**Pros:**
- Best of both worlds during transition.

**Cons:**
- Two implementations to keep in sync. Every bug fix or new
  feature has to be applied twice.
- Increases confusion: which is authoritative?
- No real user gain until the modular version has actual
  advantages (TypeScript for a new contributor, tests, etc.).

## Decision

**Option B: Single-file HTML for v1.**

Rationale:

1. **The port is a v1 pilot** for the `fancy-web` style in this
   monorepo. Getting it shippable and shareable **now** is more
   valuable than perfect tooling.
2. **1900 lines is the sweet spot** where single-file is still
   navigable. If it grows to 5000+ we should revisit.
3. **Zero-install play** aligns with ADR-005's "share via URL"
   philosophy — even more directly than a Vite build would.
4. **Pedagogical value is high right now** — a curious contributor
   can read the entire port from top to bottom in one sitting.
   That property disappears the moment we split into modules.
5. **The Vite + TS migration is cheap when we want it** — the
   code is already organized in clearly-named functions with
   clear boundaries (snake update, snake render, eagle update,
   eagle render, apples, particles, background, main loop). A
   splitter script or 2-hour manual refactor gets us there.

The ADR is scoped to **v1**. When v2 is planned, this ADR should
be revisited — likely superseded by an ADR that migrates to Vite
+ TS + PWA per the reference stack.

## Consequences

### Positive

- Live in a browser in <3 seconds from clone.
- Debuggable in browser DevTools with full source.
- No supply-chain surface (zero third-party dependencies).
- Perfect artifact for a "learn how a fancy-web port is built"
  reader.

### Negative

- No type safety on the ~1900-line JS. Bugs that TypeScript would
  catch (typo'd property access, wrong argument type) are only
  caught at runtime.
- No automated test suite. `docs/test-scenarios.md` is the
  acceptance-test source of truth, executed manually.
- Not a PWA — cannot be installed via "Add to Home Screen" or
  "Install app" until we add a manifest + service worker. v2
  target.
- Not hosted at a URL — v2 target after Vite migration + deploy.

### Migration trigger

Move to Vite + TypeScript + PWA (following ADR-005 reference
stack) when **any of these** becomes true:

- Codebase exceeds 3000 LOC in one file.
- 3+ contributors are actively editing (module boundaries needed
  for parallel work).
- User demand for PWA installability materializes.
- A different port style (e.g. `mobile-gimmicks`) is derived
  from this port's logic and would benefit from shared modules.
- A live-URL deployment is prioritized.

None of these are true in v1. All are plausible for v2.

## References

- [ADR-005](../../../../../../docs/decisions/005-target-language-and-ui-stack.md)
  §Revision Note — non-classic-web ports pick own stack.
- [ADR-006 §Universal Port Contract](../../../../../../docs/decisions/006-multi-port-architecture.md)
  — no stack requirement, only doc-set & spec compliance.
- Sister ADRs:
  [`fancy-web-001-spec-deviations.md`](./fancy-web-001-spec-deviations.md),
  [`fancy-web-002-additive-features.md`](./fancy-web-002-additive-features.md)
- Migration trigger discussion:
  [`../diff-log.md`](../diff-log.md) §Deferred
