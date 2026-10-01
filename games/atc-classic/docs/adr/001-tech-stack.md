# ADR 001 — Tech Stack: Vanilla ES Modules, Canvas 2D, CSS-only CRT

**Status:** Accepted
**Date:** 2026-09-21
**Deciders:** Agun Wijaya, Claude Opus

## Context

The `atc/fancy-web` port needs to render a CRT-styled radar console
with typed command input, procedural ambient audio, and a
BSD-faithful tick engine — all shipping as a browser artefact that
runs from `file://` or a trivial static host.

Root [ADR-005 Forward-Compatibility](../../../../../docs/decisions/005-target-language-and-ui-stack.md)
allows a variety of stacks (React + Vite for complex ports, single-
file HTML for simple ones). The question: where does `atc` fall?

## Decision

**Stack:** Vanilla JavaScript (ES modules) + Canvas 2D + Web Audio
+ CSS-only CRT effect. Deliver as a static site with
`<script type="module">` entry — no build step, no dependencies.

**Module structure:**

```
src/engine.js       # headless game engine (BSD spec-faithful)
src/parser.js       # command grammar parser
src/playfields.js   # built-in sectors
src/main.js         # DOM + input + render + audio orchestration
```

Loaded by `index.html` via `<script type="module" src="src/main.js">`.

**CRT effect:** CSS-only via:
- Scanlines: `repeating-linear-gradient(180deg, ...)` overlay with
  `mix-blend-mode: multiply`
- Phosphor glow: `filter: drop-shadow()` on the radar canvas
- Barrel distortion approximation: radial `::before` gradient
  darkening at corners
- Border radius: `32px` on the screen container to suggest curved
  bezel

No WebGL shader in v1.

## Alternatives considered

### A. React + Vite + WebGL (like `robots/ports/fancy-web/`)

React manages complex state trees well and Vite gives a modern dev
loop. But `atc` state is a mutable game object naturally suited to
imperative updates; React's reactivity model adds friction without
benefit for a canvas-first game. WebGL enables a real CRT shader
(barrel, phosphor persistence, chromatic aberration) — but that's
polish, and CSS-only gets us 80% of the visual identity for 5% of
the effort.

**Rejected** for v1. WebGL shader deferred to v2 per README
roadmap.

### B. TypeScript + Vite + Canvas 2D

Adds type safety at the cost of a build step. The engine has
enough structural discipline (JSDoc + tests) to defer full TS to
a v2 refactor.

**Rejected** for v1. TS migration deferred; port structure
remains ES-module-compatible so migration is straightforward.

### C. Single-file HTML (like `snake`/`worm/ports/fancy-web/`)

Simplest possible shipping format. But `atc`'s engine + parser
already run ~800 LOC combined, and inlining them into `index.html`
would harm testability (Node can't easily import from HTML).

**Rejected.** Split source across `src/` modules; the `index.html`
shell remains small (~350 LOC of CSS + HTML markup).

### D. WebAssembly port of the original BSD C source

Maximum fidelity — you literally run Ed James's code compiled to
WASM. But the browser can't `SIGALRM` or read `stdin` naturally,
so extensive I/O shimming would be required, and the code style
of 1986 curses is not amenable to the visual reinterpretation
this port needs.

**Rejected.** A JavaScript reimplementation of `spec.md` is more
tractable and keeps the port hackable.

## Consequences

**Positive:**

- Zero build step → open `index.html` and play.
- Zero dependencies → no supply chain, no `node_modules`.
- Testable engine (Node `node:test` imports `src/engine.js`
  directly).
- Small production surface (~1500 LOC total including all four
  `src/` modules and `index.html`).
- Matches the shipping pattern of `wump/ports/fancy-web/` (single
  HTML shell + separate `src/engine.js` for testability).

**Negative:**

- No real CRT shader in v1. The CSS approximation is good but not
  authentic; screen curvature is faked by radial vignette rather
  than proper barrel distortion.
- No hot-reload dev loop. Manual browser refresh.
- No type safety.
- No PWA / offline manifest yet (deferred to v2 alongside Vite +
  TS migration if we go that route).

## Migration path (v2)

If v2 wants WebGL + TypeScript:

1. Add `package.json` + `vite.config.ts` (build step introduced).
2. Rename `src/*.js` → `src/*.ts`; JSDoc types translate cleanly.
3. Add `src/shaders/crt.frag` + `src/shaders/crt.vert` + WebGL
   post-process pass over the existing Canvas 2D output.
4. Keep the file layout; `index.html` becomes the Vite HTML entry.

No engine changes required.

## See also

- Root [ADR-005 Target Language & UI Stack](../../../../../docs/decisions/005-target-language-and-ui-stack.md)
- Root [ADR-006 Multi-Port Architecture](../../../../../docs/decisions/006-multi-port-architecture.md)
- Root [ADR-002 Porting Philosophy](../../../../../docs/decisions/002-porting-philosophy.md)
- Sibling: `wump/ports/fancy-web/docs/decisions/001-tech-stack.md`
  (same pattern, single-file variant)
- Sibling: `robots/ports/fancy-web/docs/decisions/001-tech-stack.md`
  (React + Vite + R3F variant)
