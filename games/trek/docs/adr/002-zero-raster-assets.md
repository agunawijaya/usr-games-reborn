# ADR 002 — Zero Raster Assets: Every Pixel and Every Sound Comes From Code

- **Status:** Accepted
- **Date:** 2026-09-24
- **Deciders:** Agun Wijaya (owner), Claude Opus
- **Scope:** `bsdgames/trek/ports/procedural-web/` only

## Context

The sibling port [`fancy-web`](../../../fancy-web/) is built on curated
art: seven painted nebula backdrops, six painted ship sprites, a painted
starbase and three SVG sprites (star, two blasts). This port exists to
answer one question honestly: **can a purely procedural renderer equal
or beat painted assets for the same game?**

The answer is only meaningful if the rule is strict and checkable. A
"mostly procedural" port that sneaks in one noise texture, one flare
sprite or one SVG icon would muddy the comparison.

## Options Considered

### Option A — Allow painted assets where procedural is weak

**Pros:** the best-looking result for the least effort; could reuse the
sibling's sprites for ships and keep procedural nebulae only.
**Cons:** it is no longer a comparison, it is a remix. The comparison
document could not say where procedural wins or loses.
**Rejected.**

### Option B — Allow vector image files (SVG) but no bitmaps

**Pros:** SVG is "code-like"; icons and flares are easy to author.
**Cons:** an SVG file is still an authored image asset loaded from disk,
exactly the kind of file the sibling uses (`star_yellow.svg`,
`blast_01.svg`). The line between "vector art" and "painted art" is a
matter of taste, which makes the rule unenforceable.
**Rejected.**

### Option C — Procedural at runtime only; web fonts allowed (chosen)

Allowed sources of pixels and sound:

| Source | Examples in this port |
|---|---|
| Three.js geometry built in code | lofted hulls, extruded blades, lathe engine bells, ring station |
| GLSL shaders | nebula volume, star surface, corona, beams, shields, fire, chart |
| Procedural noise | value/fbm/ridged noise in GLSL; seeded JS noise for hull textures |
| Runtime `<canvas>` drawing | hull panel/window/roughness maps, chart glyph atlas — drawn on load, never saved |
| Web Audio synthesis | oscillators, filtered noise, generated reverb impulse |
| Web fonts (CSS `@import` from Google Fonts) | Orbitron, Share Tech Mono (same as the sibling) |

Forbidden anywhere the game loads from:

- Image files: `.png .jpg .jpeg .webp .gif .avif .bmp .ico .svg .tif .ktx .ktx2 .basis .dds .hdr .exr .tga`.
- Audio files: `.wav .mp3 .ogg .flac .m4a .aac`.
- `data:image/…` or `data:audio/…` URIs, `new Image()`, `TextureLoader`,
  `ImageLoader`, `CubeTextureLoader`, `ImageBitmapLoader`, CSS `url(…)`
  pointing at images.

`media/` is **documentation output** (screenshots required by root
`AGENTS.md` §6.5 and the comparison pairs), not something the game
loads, so PNG files are allowed there and only there.

### Option D — Procedural, but baked offline into PNG files by a script

**Pros:** zero runtime cost for expensive textures.
**Cons:** adds a build step (ADR 001 forbids one) and the shipped files
are raster assets in every practical sense.
**Rejected.**

## Decision

**Option C.** It is enforced by `tests/no-raster.test.js`, which walks
the whole port (skipping `media/`, `node_modules/` and the vendored
library's own internals) and fails on any forbidden file extension or
loader pattern. The same scan runs as `npm run check:raster`.

## Consequences

**Positive**

- The comparison in [`../comparison.md`](../comparison.md) is honest:
  every pixel on the procedural side was computed.
- Every quadrant has its own sky, generated from `(qx, qy)`, not one of
  seven pictures. 64 distinct, stable skies instead of seven.
- Visual parameters (palette, density, ship proportions) are numbers in
  code, so they can be tuned, diffed and reviewed like logic.
- Total asset payload is the vendored library plus fonts; no image
  requests.

**Negative / risks**

- GPU cost moves from "decode a JPEG once" to "evaluate noise". Mitigated
  by baking each quadrant's nebula once into a render target (per
  quadrant entry and per resize) and by a Low quality profile.
- On machines without a GPU (SwiftShader) the bake is slow. The README
  documents measured numbers and the Low profile halves the work.
- Painterly qualities that artists get for free (hand-placed
  composition, story in a single image) have to be approximated by
  rules. [`../comparison.md`](../comparison.md) says where that still
  shows.

## See also

- [ADR 001 — Tech stack](./001-tech-stack.md)
- Precedent: `pom`, `sail`, `rain` and `worms` fancy-web ports (each has its own zero-raster ADR 002)
