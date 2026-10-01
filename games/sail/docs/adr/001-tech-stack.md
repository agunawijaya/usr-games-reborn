# ADR-001: Tech Stack — Vanilla ES Modules + Vendored Three.js, Zero Build

- **Status:** Accepted
- **Date:** 2026-09-23
- **Deciders:** Agun Wijaya (repo owner), implemented with Claude
- **Scope:** Port-level (`sail/ports/fancy-web`)

## Context

*Broadside — Wooden Walls* is meant to prove that cinematic 3D can be
produced purely from code: a Gerstner-wave ocean, a procedural sky,
procedurally lofted wooden ships, volumetric-looking powder smoke,
storms. That needs a real-time 3D renderer with custom GLSL shaders,
instancing and shadows. At the same time the rules engine must stay
headless, pure and testable in Node, so that it can later run on a
server (see [ADR-003](./003-v1-scope.md)).

The sibling `fancy-web` ports set a house style:
[`atc`](../../../../../atc/ports/fancy-web/) and
[`trek`](../../../../../trek/ports/fancy-web/) are vanilla ES modules
with zero build and `node --test`; `canfield` uses React + Vite +
TypeScript. Root [ADR-005](../../../../../../docs/decisions/005-target-language-and-ui-stack.md)
recommends TypeScript + Vite for `classic-web` ports only;
[ADR-006](../../../../../../docs/decisions/006-multi-port-architecture.md)
leaves other ports free.

## Options Considered

### Option A — Canvas 2D (like `trek`)

**Description:** Draw a top-down or isometric scene with the 2D canvas
API, as the trek port does.

**Pros:**
- Zero dependencies; matches the closest sibling port.
- Trivial to test and screenshot.

**Cons:**
- Cannot deliver the brief: no lit 3D hulls, no wave shader, no
  camera orbit, no depth-sorted translucent smoke.
- Faking 3D in 2D would cost more code than a real renderer.

**Suitable when:** the visual target is a board or chart, not a scene.

### Option B — Raw WebGL2, hand-written

**Description:** Own the whole pipeline: buffers, shaders, matrices,
shadow maps.

**Pros:**
- No third-party code at all; maximally "from code".
- Smallest possible payload.

**Cons:**
- Weeks of plumbing (matrix math, shadow mapping, tone mapping,
  instancing, picking) before the first wave is drawn; none of it is
  about sail.
- Much harder for a reader to learn from — the game drowns in GL.

**Suitable when:** the renderer itself is the subject of the project.

### Option C — Three.js vendored as an ES module, zero build (chosen)

**Description:** Copy `three.module.js` + `three.core.js` (r186, MIT)
into `src/vendor/`, load it through an import map, write every visual
as Three.js geometry plus custom `ShaderMaterial` GLSL. No bundler.

**Pros:**
- Proven scene graph, PBR lighting, shadows, instancing, tone mapping,
  raycasting — the plumbing is solved, the code is about ships and sea.
- Custom GLSL is first-class (`ShaderMaterial`, `onBeforeCompile`), so
  the ocean and smoke are still "written from code".
- Zero build matches `atc`/`trek`: open `index.html` through any static
  server and it runs; nothing to install to play.
- Vendoring pins the version and keeps the port working offline and
  forever, independent of CDNs.

**Cons:**
- ~2.1 MB of vendored JavaScript (uncompressed) in `src/vendor/`.
- No tree shaking without a bundler.
- Readers must learn a little Three.js.

**Suitable when:** a small team wants real 3D without owning a renderer.

### Option D — Babylon.js or PlayCanvas

**Description:** A heavier engine with built-in ocean, particles, GUI.

**Pros:**
- More batteries included (particle editor, GUI layer, physics).

**Cons:**
- Batteries like a stock water material or particle textures would
  pull in assets or hide the "from code" story.
- Larger payload; less idiomatic for small custom-shader work.

**Suitable when:** building a large game with an editor workflow.

### Option E — Vite + TypeScript + Three.js from npm

**Description:** The `canfield` approach with a build step.

**Pros:**
- Types, tree shaking, hot reload.

**Cons:**
- Requires `npm install` + build to play; breaks the zero-build
  convention shared with the other simulator ports.
- The engine is ~2k lines of plain JS; types add little.

**Suitable when:** the port is large, multi-author, and UI-heavy.

## Decision

**We chose Option C.** Three.js removes the renderer plumbing so all
the effort goes into things that are about *this* game — a wave field
driven by the engine's wind, masts that fall when that mast's rigging
counter hits zero, smoke that drifts down the engine's wind vector.
Vendoring as an ES module keeps the `atc`/`trek` promise: no build, a
static file server is enough, and the pure engine (`src/engine/`) runs
unchanged in Node for `node --test`.

The engine imports nothing from Three.js or the DOM; only
`src/render/`, `src/ui/` and `src/audio/` touch the browser.

## Consequences

### Positive

- `npm test` needs nothing but Node 18+; `npm install` is only for the
  optional Playwright screenshot script.
- Every visual is inspectable GLSL/JS in this folder.
- The engine can be lifted into a Worker or a server verbatim.

### Negative / Risks

- The vendored bundle must be updated by hand (copy the two files from
  the `three` npm package; `package.json` pins the version used).
- WebGL2 is required; the page shows a clear message without it.

### Follow-on Work

- [ADR-002](./002-zero-raster-assets.md) — the zero-raster rule this
  stack makes possible.
- A Worker-hosted engine would make long AI searches jank-free on slow
  machines (not needed at v1 sizes: a 10-ship turn resolves in < 5 ms).

## References

- Three.js r186, MIT — `src/vendor/THREE-LICENSE`.
- Sibling ports: `atc/ports/fancy-web`, `trek/ports/fancy-web`.
