# ADR-001: Rendering Stack — Raw WebGL2 Multi-Pass, Vanilla ES Modules

- **Status:** Accepted
- **Date:** 2026-09-24
- **Deciders:** Agun Wijaya (repo owner, via port brief), Claude Opus
- **Scope:** Port-level (`worms` / `fancy-web`)

## Context

*Abyssal Worms* turns BSD `worms(6)` into a bioluminescent deep-sea
screensaver. The brief asks for:

- smooth, organic motion interpolated between the engine’s grid steps;
- translucent, internally glowing, segmented bodies, one species per
  original flavor character, with a travelling wave;
- bloom and light scattering, so worms light the sea floor and each
  other, and overlapping cells (ref count ≥ 2) glow brighter;
- a fading luminescent trail (`-t`) and a procedural “WORM” glyph floor
  (`-f`);
- a classic ASCII view and a split view on the **same** engine state;
- 60 fps at `-n 20 -l 64`, with a Low/High quality toggle.

The sibling fancy-web ports use vanilla ES modules with no build step.
The brief allows raw WebGL2 or a vendored Three.js.

Unlike the `pom` port, where everything was analytic, this scene has
**real geometry** (up to thousands of body segments), **HDR
compositing** (glow must add up without clipping) and **post-processing**
(bloom). That changes the trade-offs.

## Options Considered

### Option A — Three.js (vendored ES module) + EffectComposer

**Description:** Worms as `TubeGeometry` or instanced spheres, the floor
as a plane with a `ShaderMaterial`, bloom via `UnrealBloomPass`.

**Pros:**
- Bloom, render targets and HDR are off the shelf.
- Familiar to many contributors.

**Cons:**
- About 1.2 MB vendored for what is really three draw calls: a floor, a
  set of ribbons, and points.
- Re-extruding `TubeGeometry` every frame for smooth interpolation is
  CPU-heavy (Frenet frames, normals). A camera-facing ribbon with a
  shaded fake-tube cross-section looks the same from a top-down camera
  at a fraction of the cost.
- `UnrealBloomPass` is tuned for generic scenes. Controlling *how* light
  spills onto the floor (a separate low-resolution light map) would mean
  fighting the abstraction.

**Suitable when:** a free camera, true 3-D meshes, or model loading are
needed.

### Option B — Raw WebGL2, hand-built passes (chosen)

**Description:** A small pass graph:
1. **Light map** (¼ resolution): worm bodies drawn as wide soft ribbons,
   additive, then blurred. This is how much bioluminescence reaches each
   point of the floor.
2. **Floor** (full screen, HDR): procedural sediment, fog depth,
   caustic shimmer, `-f` glyph field, `-t` trail texture, all lit by the
   light map.
3. **Worms**: one triangle-strip ribbon per worm, extruded on the CPU
   from a spline through the interpolated body, shaded as a translucent
   glowing tube.
4. **Marine snow**: `gl.POINTS` particles lit by the light map.
5. **Bloom**: bright pass, then a 5-level downsample/upsample chain.
6. **Composite**: ACES tone map, vignette, grain, dither.

**Pros:**
- Zero dependencies, zero build, and the same helper as the `pom` port.
- Every pass is shaped for this scene. The light map gives floor
  illumination and overlap brightening almost for free.
- CPU work per frame is tiny: 20 worms × a few hundred vertices.
- The shaders are readable teaching material.

**Cons:**
- More plumbing to write: framebuffers, a blur chain, resize handling.
- No scene graph, so a future 3-D camera would need its own matrices.

**Suitable when:** a fixed camera, custom lighting, a few specialised
passes. That is our case.

### Option C — Canvas 2D with `globalCompositeOperation = 'lighter'`

**Description:** Draw glowing strokes with `shadowBlur` and additive
compositing.

**Pros:** Simplest possible stack; runs everywhere.

**Cons:** No HDR, so additive glow clips to white. `shadowBlur` at
1280 segments per frame is slow. There is no way to light the floor
from the worms without per-pixel work.

**Suitable when:** a flat, illustrative look. Rejected for the main
view; it **is** used for the classic ASCII view, where it is exactly
right.

### Option D — WebGPU

**Pros:** Compute shaders for particles; modern API.

**Cons:** Uneven browser support in 2026 and less reliable headless
capture. Nothing here needs compute.

**Suitable when:** simulation-heavy scenes. Deferred.

### Option E — PixiJS (2-D WebGL engine)

**Pros:** Sprites, filters (bloom/glow) and meshes ready-made.

**Cons:** Another large vendored dependency. Its filter model makes the
worms-light-the-floor coupling awkward. Its generic glow filter looks
like every other Pixi demo.

## Decision

**Option B: raw WebGL2 with a purpose-built pass graph, on vanilla ES
modules with no build step.** The Canvas 2D renderer (Option C) is kept
for the classic ASCII view, and it is also the automatic fallback when
WebGL2 is unavailable.

The look depends on three coupled effects: body glow, light on the
floor, and bloom. Each is one small, tunable pass here. The engine
stays DOM-free and GL-free for `node --test`.

## Consequences

### Positive

- One static folder: `npm start` serves it, `npm test` tests it.
- The split view is just two renderers of one engine state. The classic
  Canvas 2D view is clipped over the WebGL view.
- Graceful degradation (learned from the `pom` port): no WebGL2 → the
  classic view only; software WebGL → Low quality automatically.

### Negative / Risks

- WebGL2 and float render targets (`EXT_color_buffer_float`) are needed
  for the full look. Without float targets the HDR buffers fall back to
  8-bit, with more clipping in the glow.
- The bloom chain costs fill rate. Low quality halves every buffer.

### Follow-on Work

- [ADR-002](./002-zero-raster-assets.md): no raster assets.
- [ADR-003](./003-time-grid-and-live-flags.md): time model, grid and
  live flag changes.

## References

- Root [ADR-005](../../../../../../docs/decisions/005-target-language-and-ui-stack.md), [ADR-006](../../../../../../docs/decisions/006-multi-port-architecture.md)
- Sibling: [`pom/ports/fancy-web` ADR-001](../../../../../pom/ports/fancy-web/docs/decisions/001-rendering-stack.md)
  (raw WebGL2, analytic scene)
- Jorge Jimenez, *Next Generation Post Processing in Call of Duty:
  Advanced Warfare* (SIGGRAPH 2014): the downsample/upsample bloom
  chain.
