# ADR-002: Zero Raster Assets — Every Pixel From Code

- **Status:** Accepted
- **Date:** 2026-09-23
- **Deciders:** Agun Wijaya (repo owner), implemented with Claude
- **Scope:** Port-level (`sail/ports/fancy-web`)

## Context

The owner's brief for this port is a showcase: *cinematic 3D graphics
produced purely from code*. Other ports in this repo lean on painted
art — the `trek` port ships seven painted nebula backdrops and PNG ship
sprites; `hangman` and `canfield` keep `references/` folders of images.
Those are legitimate choices for those ports. This one deliberately
goes the other way, so a reader can open `src/` and find the *recipe*
for every surface on screen rather than a picture of it.

The rule needs to be precise enough to check mechanically, and honest
about the one grey zone (textures generated at run time).

## Options Considered

### Option A — Painted / photographic assets

**Description:** Use sky HDRIs, ocean normal maps, sail and wood
textures, sprite sheets for smoke and fire.

**Pros:**
- Fastest route to photorealism; the industry default.
- Normal maps and flipbooks are cheap at run time.

**Cons:**
- Defeats the stated purpose of the port.
- Licensing and attribution burden for every file.
- Looks "pasted on": a sky photo does not change with the engine's
  wind or storm state.

**Suitable when:** realism per hour of work is the only goal.

### Option B — Zero raster files, strict: no textures at all

**Description:** Geometry + per-fragment shading only; no texture
objects, not even generated ones.

**Pros:**
- Purest possible interpretation.

**Cons:**
- Flags need a painted canvas (stripes, crosses, a union); drawing
  them in fragment shaders is contortion without benefit.
- Blocks cheap tricks such as a soft particle sprite rendered once.

**Suitable when:** the showcase is about shaders specifically.

### Option C — Zero raster FILES; runtime-generated textures allowed (chosen)

**Description:** `src/` contains no PNG/JPG/JPEG/WebP/GIF/AVIF/BMP/
KTX/HDR/EXR/DDS or similar image files and no `data:image/` URIs.
Every texture that exists is produced at load time by code: Canvas 2D
(flags, the tactical chart's paper grain), `DataTexture` filled by a
noise function, or render targets drawn by shaders.

**Pros:**
- Keeps the promise — every pixel has a recipe in `src/`.
- Pragmatic: flags and soft particles use the right tool.
- Mechanically checkable (`npm run check:raster`).

**Cons:**
- Generated textures cost a little start-up time (measured < 100 ms).
- Photoreal detail must be earned in shader code.

**Suitable when:** the goal is "from code" with honest engineering.

## Decision

**We chose Option C.** It keeps the showcase's promise without forcing
absurdities. Concretely:

1. No raster image files anywhere under `src/`; no `data:image/` URIs;
   no network image loads (`TextureLoader`, `ImageLoader`, `<img>`,
   CSS `url()` to images).
2. Allowed: Three.js geometry, GLSL, procedural noise, `CanvasTexture`
   from a canvas drawn with 2D-context calls at run time,
   `DataTexture` filled by code, render targets.
3. Fonts are text, not images; the UI uses system serif stacks (no
   web-font download), so the page makes no third-party requests.
4. Screenshots may live in `media/` — that folder documents the port,
   it is not part of the program.

`scripts/check-no-raster.mjs` enforces rules 1 and the loader part of
rule 1 and runs as `npm run check:raster`.

## Consequences

### Positive

- Everything visual is tied to code that can read engine state — the
  sky darkens with the engine's wind, flags are redrawn when a ship is
  captured, the hull texture grows scorch marks as hull points fall.
- No asset licences to track.

### Negative / Risks

- More shader code to maintain than a texture pipeline would need.
- Some effects (ocean foam, smoke) must fake detail with noise octaves,
  which costs GPU time — mitigated by the Low/High quality toggle.

### Follow-on Work

- None; this is a standing constraint for the port.

## References

- Owner brief, 2026-09-23 ("HARD RULE: ZERO RASTER ASSETS").
- Tessendorf, *Simulating Ocean Water* (2001) and GPU Gems ch. 1
  (Finch, *Effective Water Simulation from Physical Models*) — the
  Gerstner wave model used by `src/render/ocean.js`.
