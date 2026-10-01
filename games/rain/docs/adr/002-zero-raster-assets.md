# ADR-002: Zero Raster Assets — Every Pixel From Code

- **Status:** Accepted
- **Date:** 2026-09-24
- **Deciders:** Agun Wijaya (repo owner), implemented with Claude
- **Scope:** Port-level (`rain/ports/fancy-web`)

## Context

The brief for this port is a proof: beautiful rain graphics can come
purely from code. The original `rain` drew with seven characters; this
port draws with shaders. A reader should be able to find, for every
pixel, the code that made it — not a photograph of a pond or a painted
bokeh sprite.

## Options Considered

### Option A — Photographic or painted assets

**Description:** An HDR night-sky panorama, a water normal map, bokeh and
splash sprite sheets.

**Pros:** fastest route to realism.
**Cons:** defeats the purpose; the sky cannot respond to anything; asset
licensing; bytes.

### Option B — No textures at all

**Description:** Only arithmetic in shaders; no texture objects.

**Cons:** the wave simulation itself *must* live in textures (ping-pong
framebuffers). Too strict to be meaningful.

### Option C — No raster files; textures only as computed data (chosen)

**Description:** `src/` contains no PNG/JPG/JPEG/WebP/GIF/AVIF/BMP (or
other image) files, no `data:image` URIs, no image loaders. Textures exist
only as render targets written by shaders (the wave field) or buffers
filled by code. Sound follows the same rule: synthesised with Web Audio,
no samples. The classic view is text.

**Pros:** keeps the promise; checkable by a script.
**Cons:** realism must be earned in GLSL.

## Decision

**Option C.** `scripts/check-no-raster.mjs` enforces it (`npm run
check:raster`). Screenshots in `media/` document the port and are not
part of the program.

## Consequences

- The sky, moon, clouds, far shore, lanterns, mist, water, rings,
  splashes and streaks are all functions in `src/render/`.
- Audio is synthesised (`src/audio/audio.js`): noise, filters, oscillators.

## References

- Owner brief, 2026-09-24 ("HARD RULE: ZERO RASTER ASSETS").
- Sibling ports with the same rule: `sail/ports/fancy-web`, `pom/ports/fancy-web`.
