# ADR-001: Rendering Stack — Raw WebGL2, Vanilla ES Modules, Zero Build

- **Status:** Accepted
- **Date:** 2026-09-24
- **Deciders:** Agun Wijaya (repo owner), implemented with Claude
- **Scope:** Port-level (`rain/ports/fancy-web`)

## Context

*Rain on Still Water* renders one scene: a night pond at a low angle,
its surface a GPU wave-equation simulation that reflects a procedural sky,
with rain streaks and splash particles on top. The heavy lifting is three
fragment shaders (wave step, drop splats, water + sky) and one instanced
particle pass. There are no meshes, no scene graph and no lights in the
usual sense. The engine (`src/engine/`) must stay headless for `node --test`.

Sibling fancy-web ports differ: `sail` vendors Three.js (a scene of many
meshes), `pom` uses raw WebGL2 (a full-screen shader world).

## Options Considered

### Option A — Canvas 2D

**Description:** Draw rings as circles and streaks as lines.

**Pros:** trivial; no GPU needed.
**Cons:** cannot solve a wave equation at 60 fps or do per-pixel
reflection/refraction; rings would not interfere; looks like clip art.
**Suitable when:** the goal is a flat illustration.

### Option B — Raw WebGL2 (chosen)

**Description:** A small helper (`src/render/gl.js`) for programs, a
full-screen triangle and float render targets; everything else is GLSL.

**Pros:**
- The scene *is* shaders; ping-pong framebuffers are a dozen lines.
- No dependency to vendor (~0 KB vs ~2 MB for Three.js).
- Full control over render-target formats and the degradation ladder
  (software renderers, no float targets, no WebGL2).
- Matches the sibling `pom` port.

**Cons:** more plumbing to write by hand (uniform locations, targets).
**Suitable when:** the scene is a few full-screen passes.

### Option C — Vendored Three.js

**Pros:** familiar API; post-processing helpers.
**Cons:** a 2 MB dependency to draw one full-screen quad and one
particle cloud; its material system would sit between us and the GLSL.
**Suitable when:** there are many meshes and lights (the `sail` port).

### Option D — WebGPU

**Pros:** compute shaders are the natural home of a wave simulation.
**Cons:** still unavailable in many browsers and on many machines in
2026; would need a WebGL2 fallback anyway.
**Suitable when:** the audience is known to have it.

## Decision

**Option B.** A screensaver of three shaders does not need a scene graph;
raw WebGL2 keeps the code about water and rain, keeps the payload tiny
and gives exact control of the fallbacks the port must have. Vanilla ES
modules and no build step follow the `atc`, `trek`, `sail` and `pom`
convention: any static file server runs it.

## Consequences

- `npm test` needs only Node; Playwright is a dev dependency for screenshots.
- Rendering to float targets needs `EXT_color_buffer_float` (or the
  half-float variant). Every WebGL2 implementation tested has one; without
  it the port shows the classic view rather than a degraded pond (an
  8-bit height encoding was considered and dropped — ADR-005).
- No WebGL2 at all → the classic ASCII view, which needs no GPU.
- Software rasterisers get their own profile (ADR-005); measured numbers
  are in the README.

## References

- Sibling port `pom/ports/fancy-web` (raw WebGL2, parallel shader compile).
- Khronos, *WebGL 2.0 Specification*; `KHR_parallel_shader_compile`.
