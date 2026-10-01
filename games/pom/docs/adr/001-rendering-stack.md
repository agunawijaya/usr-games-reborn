# ADR-001: Rendering Stack — Raw WebGL2 + Vanilla ES Modules

- **Status:** Accepted
- **Date:** 2026-09-23
- **Deciders:** Agun Wijaya (repo owner, via port brief), Claude Opus
- **Scope:** Port-level (`pom` / `fancy-web`)

## Context

*Selene* is a showcase port. Its purpose is to prove that a
photographic-quality night-sky scene can be produced **purely from
code** (see [ADR-002](./002-zero-raster-assets.md)). The brief asks
for:

1. A Moon sphere shaded by a custom GLSL shader, with procedural
   maria, craters, rims, ejecta rays and normal perturbation. The
   lit fraction and terminator angle must be driven by the `pom`
   engine, not faked.
2. Earthshine on the dark side, a twinkling starfield, a Milky Way
   band, a halo around the Moon, and an optional procedural
   landscape silhouette.
3. A calendar where **each day's mini Moon is rendered by the same
   shader** (not icons).
4. Drag-to-rotate, hover tooltips, reduced-motion and high-contrast
   modes.

The sibling fancy-web ports [`atc`](../../../../../atc/ports/fancy-web/)
and [`trek`](../../../../../trek/ports/fancy-web/) use a
**vanilla-ES-modules, zero-build** convention: open a static page,
`node --test` runs the engine tests. The brief asks us to follow
that unless there is a strong reason otherwise, and to choose between
a vendored Three.js ES module and raw WebGL2.

The key technical observation for this scene: **almost nothing in it
is a mesh**. The Moon is a perfect sphere, the sky is a
screen-covering gradient, stars are point sources, the landscape is
a 1-D height profile. All of it can be evaluated per pixel.

## Options Considered

### Option A — Three.js (vendored `three.module.js`) + ShaderMaterial

**Description:** Vendor the Three.js ES module build (~1.2 MB unminified)
into `src/vendor/`, use a `SphereGeometry` with a custom
`ShaderMaterial` for the Moon, `Points` for stars, and
`EffectComposer` + `UnrealBloomPass` for the halo.

**Pros:**
- Familiar to many contributors; lots of documentation.
- Bloom, render targets and multi-view scissoring come ready-made.
- Scene graph makes adding meshes (e.g. a 3-D foreground) easy.

**Cons:**
- 1+ MB vendored dependency for a scene whose geometry is one sphere.
- A tessellated sphere has a faceted silhouette at the limb unless it
  is very dense; the limb is the most scrutinised edge in the image.
- Generic bloom is a screen-space blur. It makes everything bright
  glow the same way, including UI-adjacent highlights, and costs
  several full-screen passes.
- The custom shaders are the whole point of the port. Three.js would
  mostly wrap `gl.useProgram` and `gl.drawArrays`, and it would hide
  them from the reader instead of teaching them.

**Suitable when:** a scene has real meshes, many objects, or needs
loaders (glTF) and a scene graph.

### Option B — Raw WebGL2, analytic full-screen shaders (chosen)

**Description:** One small hand-written WebGL2 helper (~150 lines:
compile, link, full-screen triangle, framebuffer). The Moon is
**ray-traced analytically** in the fragment shader (ray–sphere
intersection per pixel), so the silhouette is mathematically exact
at any resolution. Sky, stars, Milky Way, halo and landscape are
evaluated in the same full-screen pass. The Moon's surface
(albedo + height + normals) is **baked once at start-up** into a
float texture by a procedural shader pass, then sampled every frame.

**Pros:**
- Zero dependencies, zero build. Matches `atc` / `trek` conventions.
- Pixel-perfect limb and terminator: no tessellation.
- The halo is computed analytically (a scattering falloff around the
  disc, scaled by the engine's illumination). That is cheaper and
  physically motivated, unlike a generic bloom blur.
- The same Moon program renders the calendar's mini Moons into a
  small framebuffer. Keeping it to one GL context avoids the
  browser's ~16-context limit.
- Every line is readable. The shader code *is* the teaching artifact
  for this port.

**Cons:**
- More boilerplate to write (shader compile errors, FBO setup,
  resize handling).
- No scene graph. If a future contributor wants real 3-D foreground
  meshes, they must write the vertex plumbing themselves.
- Requires WebGL2 (≈97 % of browsers in 2026). A static fallback
  message is shown otherwise.

**Suitable when:** the scene is dominated by analytic or procedural
content evaluated per pixel. This is exactly our case.

### Option C — Canvas 2D (like `trek` / `atc`)

**Description:** Draw the Moon as radial gradients and composited
paths; stars as `fillRect` dots; landscape as paths.

**Pros:**
- Simplest possible stack, works everywhere.
- Consistent with the two sibling ports.

**Cons:**
- No per-pixel lighting. A correct terminator with crater rims catching
  light needs a normal-mapped lighting model, which Canvas 2D cannot
  express at interactive rates.
- The "procedural surface" would have to be pre-rasterised in JS on
  the CPU (millions of noise evaluations). That is slow, and it would
  still be a fake lit disc rather than a lit sphere.

**Suitable when:** the visuals are illustrative and flat. Rejected
because the brief asks for photographic realism.

### Option D — WebGPU + WGSL

**Description:** Same analytic design as Option B, on WebGPU.

**Pros:**
- Modern API, compute shaders for the surface bake.

**Cons:**
- Browser support in 2026 is still uneven (Safari/Linux/Android
  gaps), and headless Playwright capture is less reliable.
- No capability we need that WebGL2 lacks.

**Suitable when:** heavy compute (particles, simulation) is needed.
Deferred. The shaders translate to WGSL almost line for line if a v2
wants it.

### Option E — SVG / CSS only

**Description:** Moon as SVG circles with `feTurbulence` filters.

**Pros:**
- Declarative, resolution-independent.

**Cons:**
- `feTurbulence` cannot produce lit craters or a physical terminator;
  filters are slow at full-screen sizes.

**Rejected.** SVG is still used for small UI glyphs (icons in
buttons), where it shines.

## Decision

**We chose Option B — raw WebGL2 with analytic, per-pixel shaders, on
vanilla ES modules with no build step.**

The Moon is the whole product. An analytic ray-traced sphere with a
baked procedural surface gives the most convincing result: exact
limb, real Lambert/Lommel-Seeliger lighting, cast shadows near the
terminator. It also keeps the codebase small enough that a reader
can follow every pixel from `pom`'s `potm()` elongation to the final
colour. Three.js would add a megabyte of generality for no visual
benefit here, and would put a layer between the reader and the
shaders this port exists to show off.

The engine (`src/engine/`) stays DOM-free and GL-free so that
`node --test` can exercise it headlessly, exactly like `trek`'s
`engine.js`.

## Consequences

### Positive

- `index.html` + ES modules, served by any static server; a
  zero-dependency `scripts/serve.mjs` is included because browsers
  refuse ES module imports from `file://`.
- Mini Moons in the calendar come from the **same fragment shader**
  as the hero Moon, rendered into a small framebuffer and copied to
  per-cell canvases.
- Deterministic rendering (the surface is seeded), so screenshots
  are reproducible.

### Negative / Risks

- WebGL2 is required. The page shows a text-only fallback (the BSD
  caption still works, since it comes from the engine) when WebGL2
  is unavailable.
- The surface bake takes a noticeable moment on low-end GPUs; it is
  split into horizontal tiles across frames so the page stays
  responsive, and the Moon fades in when ready.
- Contributors used to Three.js will find less scaffolding.

### Follow-on Work

- [ADR-002](./002-zero-raster-assets.md) — the zero-raster rule that
  this stack makes practical.
- A v2 could port the shaders to WGSL (Option D) without changing the
  engine.

## References

- Root [ADR-005 — Target language & UI stack](../../../../../../docs/decisions/005-target-language-and-ui-stack.md)
- Root [ADR-006 — Multi-port architecture](../../../../../../docs/decisions/006-multi-port-architecture.md)
- Sibling: [`trek/ports/fancy-web` ADR-001](../../../../../trek/ports/fancy-web/docs/decisions/001-tech-stack.md) (vanilla ES modules + Canvas 2D)
- Iñigo Quilez, *ray–sphere intersection* and *analytic normals*
  articles — <https://iquilezles.org/articles/>
- Hapke, B. *Theory of Reflectance and Emittance Spectroscopy*
  (Lommel–Seeliger law for regolith surfaces).
