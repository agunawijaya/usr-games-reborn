# ADR 001 — Tech Stack: DOM-free Engine + Vendored Three.js + GLSL, Zero Build

- **Status:** Accepted
- **Date:** 2026-09-24
- **Deciders:** Agun Wijaya (owner, via the port brief), Claude Opus
- **Scope:** `bsdgames/hunt/ports/fancy-web/` only

## Context

This is the first port of `hunt(6)`, a real-time maze deathmatch. The
brief asks for three things that pull on the stack:

1. **A headless, server-ready engine.** Pure, serialisable state, a fixed
   step, input as commands, deterministic from a seed, no DOM or WebGL, so
   a future Node/WebSocket server can run the same file unchanged.
2. **An art-director-level 3D view.** A tilted top-down arena with lit
   geometry, a light cone that reveals only what the player can see,
   glass mirrors that ripple, bloom, chromatic aberration on big hits,
   particles for sparks, debris and light shards, a fluid-looking slime
   shader, heat-haze cloaks — at 60 fps with 8 bots, with Low/High quality
   and a no-GPU fallback (owner feedback: test CPU-only WebGL and no WebGL).
3. **A classic ASCII view** of the same state, side by side.

The repo's fancy-web convention is vanilla ES modules with no build step
(`worms`, `rain`, `sail`, `trek/procedural-web`). Root
[ADR-005](../../../../../../docs/decisions/005-target-language-and-ui-stack.md)
binds only `classic-web` ports; [ADR-006](../../../../../../docs/decisions/006-multi-port-architecture.md)
leaves the choice to the port.

## Options Considered

### Option A — Raw WebGL2, hand-written everything

**Pros:** smallest payload; full control of every draw call; the `pom`,
`rain` and `worms` ports prove it works in this repo.
**Cons:** this scene is not one or two full-screen shaders — it is
hundreds of instanced wall blocks, glass panes, avatars, particle systems,
lights, shadows and a post chain. Re-implementing a scene graph, instancing,
materials, render targets and bloom by hand is weeks of plumbing that
teaches nothing about `hunt`.
**Suitable when:** the picture is a few screen-space shaders.

### Option B — Vendored Three.js (r186) + custom GLSL, zero build (chosen)

**Pros:** scene graph, instancing, render targets and matrix maths for
free; `ShaderMaterial` keeps every interesting pixel in our own GLSL
(visibility light cone, mirror ripple, slime, cloak refraction, bloom);
the exact same vendored files already ship in `trek/procedural-web`, so
reviewers know them; an import map keeps `import * as THREE from 'three'`
working with no bundler.
**Cons:** ~2 MB of library on first load (cached afterwards); Three's
defaults must be kept away from the zero-raster rule (no loaders).
**Suitable when:** a real 3D scene with post-processing, built by one
person, readable by the next.

### Option C — A bundled engine (Babylon.js / PlayCanvas / Phaser) with a build step

**Pros:** more batteries (physics, GUI, asset pipeline).
**Cons:** a build step breaks the repo's fancy-web convention; most of
those batteries (asset pipelines, physics) are exactly what this port
does not need or may not use (ADR 002); larger surface to learn.
**Suitable when:** asset-heavy games with physics.

### Option D — Canvas 2D

**Pros:** trivial, runs everywhere.
**Cons:** cannot deliver the light cone, glass, bloom or refraction the
brief asks for. Kept only as the idea behind the no-WebGL fallback (the
classic ASCII view, which is DOM text).

## Decision

**Option B.** The engine (`src/engine/`, `src/bots/`) is plain JavaScript
with no imports outside itself — it runs in Node for the tests and would
run in a server as is. The browser side (`src/render/`, `src/ui/`,
`src/audio.js`, `src/main.js`) uses the vendored Three.js r186
(`src/vendor/`, MIT, licence alongside) through an import map, with all
materials written as `ShaderMaterial`/`RawShaderMaterial` in our own GLSL.
No bundler, no transpiler: `node scripts/serve.mjs` and open the page.

## Consequences

### Positive

- The engine is testable at ~50,000 steps/s in Node and golden-tested
  against the real daemon code (`tests/golden.test.js`).
- One stack across the two most recent procedural ports.
- The no-WebGL path degrades to the classic ASCII view, which needs no
  WebGL at all.

### Negative / Risks

- First load pulls the vendored library; mitigated by caching and by
  compiling shaders asynchronously (`renderer.compileAsync`) so a cold
  D3D11 shader compile does not freeze the page.
- Three.js upgrades are manual (replace two files).

### Follow-on Work

- ADR 002 — zero raster assets (how the pictures are made).
- A `scripts/check-no-raster.mjs` + test that also keeps loaders out.
