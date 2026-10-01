# ADR 002 — Zero Raster Assets: Every Pixel and Every Sound Comes From Code

- **Status:** Accepted
- **Date:** 2026-09-24
- **Deciders:** Agun Wijaya (owner — hard rule of the port brief), Claude Opus
- **Scope:** `bsdgames/hunt/ports/fancy-web/` only

## Context

The brief makes it a hard rule: no PNG/JPG/WebP/GIF/SVG image files;
everything from Three.js/WebGL2, GLSL, procedural geometry, runtime
canvas and Web Audio synthesis; web fonts allowed. The rule is also the
port's identity: `hunt` was a game of characters on a terminal, and this
port rebuilds it entirely from numbers and code — the neon arena is a
function of the engine state, frame by frame.

A rule only means something if it is strict and checkable.

## Options Considered

### Option A — Allow a few textures where procedural is hard

**Pros:** faster to a polished look (a noise texture, a spark sprite).
**Cons:** breaks the owner's hard rule. **Rejected.**

### Option B — Allow SVG "because it is code"

**Pros:** icons and glyphs are easy in SVG.
**Cons:** an `.svg` file is an authored image loaded from disk; the line
between "vector code" and "art asset" becomes a matter of taste.
**Rejected.**

### Option C — Runtime generation only; web fonts allowed (chosen)

| Allowed source | Used for |
|---|---|
| Three.js geometry built in code | wall blocks, mirror panes, avatars, debris |
| GLSL shaders | floor, walls, light cone/visibility, glass ripple, slime, cloak refraction, bloom, grading |
| Procedural noise | GLSL value/fbm noise; seeded JS noise |
| Runtime `<canvas>` drawing | glyph atlas for the classic view and labels — drawn on load, never saved |
| Web Audio synthesis | hum, footsteps, shots, ricochet pings, blasts, slime, whoosh, death |
| Web fonts (Google Fonts CSS) | the UI and the classic view |

Forbidden anywhere the game loads from: image files (`.png .jpg .jpeg
.webp .gif .avif .bmp .ico .svg .tif .ktx .ktx2 .basis .dds .hdr .exr
.tga .psd`), audio files (`.wav .mp3 .ogg .oga .flac .m4a .aac .opus`),
`data:image/…`/`data:audio/…`, `new Image()`, `new Audio()`,
`TextureLoader` and friends, CSS `url(…)` pointing at images, `<img>`.

`media/` holds documentation screenshots (root `AGENTS.md` §6.5); the
game never loads them, so PNGs are allowed there and only there.

### Option D — Procedural, but baked to PNG by a script

**Pros:** zero runtime cost.
**Cons:** the shipped files are raster assets in every practical sense,
and it adds a build step (ADR 001). **Rejected.**

## Decision

**Option C**, enforced by `tests/no-raster.test.js`, which walks the port
(skipping `media/`, `node_modules/` and the vendored library's internals)
and fails on any forbidden file or loader pattern. `npm run check:raster`
runs the same scan.

## Consequences

### Positive

- Every visual parameter is a number in code: tunable, diffable, reviewable.
- Every visual follows the engine state, because nothing else exists to draw.
- Total payload: the vendored library plus fonts.

### Negative / Risks

- Noise costs GPU time; the Low profile halves particle counts and turns
  off bloom and the slime metaball pass.
- On CPU-only WebGL the scene is slow; the port measures it and falls back
  (README, "Running without a GPU").

### Follow-on Work

- Keep the scanner in sync if a new asset-loading API appears.
