# ADR-002: Zero Raster Assets — Every Pixel From Code

- **Status:** Accepted
- **Date:** 2026-09-24
- **Deciders:** Agun Wijaya (repo owner), implemented with Claude
- **Scope:** Port-level (`battlestar/ports/fancy-web`)

## Context

The brief for this port is a *zero-raster showcase*: no PNG, JPG, WebP,
GIF or SVG image files. Everything must come from Three.js/WebGL2,
GLSL, procedural geometry and noise, runtime Canvas, and Web Audio
synthesis. Web fonts are allowed. The same rule was adopted by
`pom`, `rain`, `worms` and `sail`.

It needs an explicit boundary, because "zero raster" is ambiguous at
the edges: runtime canvases, `data:` URIs, SVG icons in HTML, and the
screenshots the repo requires in `media/`.

## Options Considered

### Option A — Allow a few textures (sand, bark, stone)

**Description:** Procedural geometry, but photographic or painted
tiling textures for materials.

**Pros:**
- Fastest route to rich surfaces.

**Cons:**
- Breaks the brief; licensing and provenance per texture; tiling
  artefacts across 275 rooms make sameness *worse*, not better.

**Suitable when:** realism matters more than the "from code" story.

### Option B — Zero image files; runtime-generated textures allowed (chosen)

**Description:** No image files and no raster `data:` URIs in `src/`
or `index.html`. Shaders compute surfaces directly; where a texture is
the natural tool (gauge faces, the minimap, noise lookups), it is
drawn at runtime into a Canvas or a `DataTexture` from code.

**Pros:**
- Honours the brief while keeping practical tools (a canvas-drawn
  gauge is still code).
- Every surface can be seeded per room, so rooms differ.

**Cons:**
- More shader work per material.

**Suitable when:** a showcase port whose identity is "made from code".

### Option C — Zero textures of any kind, even runtime ones

**Description:** Forbid `CanvasTexture`/`DataTexture` entirely.

**Pros:**
- The purest reading of the rule.

**Cons:**
- Gauges and the minimap would need text rendered by SDF shaders or DOM
  overlays glued onto 3D — complexity without benefit to the reader.

**Suitable when:** the renderer itself is the teaching subject.

## Decision

**We chose Option B.** Precisely:

- Forbidden in `src/` and `index.html`: files with extensions
  `.png .jpg .jpeg .webp .gif .avif .bmp .ico .svg .tga .ktx .ktx2
  .basis .hdr .exr`, and `data:image/` URIs.
- Allowed: GLSL, procedural `BufferGeometry`, `CanvasTexture` /
  `DataTexture` filled by code at runtime, CSS gradients, inline SVG
  *elements* written in the page markup for UI icons (they are vector
  code, not files), web fonts (loaded non-blocking; system fallbacks).
- Screenshots in `media/` are documentation, not assets; nothing in
  `src/` references them.
- Enforced by `tests/zero-raster.test.js` and `npm run check:raster`.
- Sound follows the same rule: Web Audio synthesis only, no audio files.

## Consequences

### Positive
- The whole port is inspectable code; seeds make every room unique.

### Negative / Risks
- Surfaces cost GPU time; the Low quality profile and the no-GPU
  ladder (README) keep the port playable on weak machines.

## References
- `pom`, `rain`, `worms`, `sail` fancy-web ADR-002.
