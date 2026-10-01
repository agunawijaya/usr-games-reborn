# ADR-002: Zero Raster Assets — Every Pixel and Every Sound From Code

- **Status:** Accepted
- **Date:** 2026-09-24
- **Deciders:** Agun Wijaya (repo owner, hard rule in port brief), Claude Opus
- **Scope:** Port-level (`worms` / `fancy-web`)

## Context

*Abyssal Worms* exists to show that a beautiful, living scene can come
purely from code: a bioluminescent sea floor, glowing worms, drifting
marine snow, a humming ocean. The original `worms.c` is already a small
manifesto for this. Its only “asset” is the ASCII-art **WORMS** banner
in its own header comment (`worms.c:46-61`), and its `-f` field is the
word `"WORM"` typed into the screen (`worms.c:217`, `worms.c:279-290`).

Several sibling fancy-web ports (`trek`, `adventure`, `hangman`) rely on
painted raster art. This port deliberately does not, and the rule
constrains every future contribution, so it is recorded here. The
`pom` port set the precedent ([its ADR-002](../../../../../pom/ports/fancy-web/docs/decisions/002-zero-raster-assets.md)).
This ADR extends it to **audio**.

## Options Considered

### Option A — Painted and recorded assets

**Description:** A painted sea-floor texture, sprite sheets for each
species, sampled ambient ocean audio.

**Pros:** The fastest route to a specific art direction; realistic
recorded ambience.

**Cons:** Defeats the purpose of the port. Sprites cannot follow a
smoothly interpolated, rippling body without visible stretching.
Megabytes of downloads and licensing for audio samples.

### Option B — Hybrid: code for motion, a few small textures and samples

**Description:** Procedural worms, but a noise PNG for the sea floor, a
glyph atlas PNG for the classic view, and a looped drone WAV.

**Pros:** Saves some start-up work; noise PNGs are common practice.

**Cons:** The rule stops being checkable with one test. All three can
be generated at runtime in milliseconds: shader noise, `fillText` into
a canvas, oscillators.

### Option C — Strict: no raster images, no audio samples (chosen)

**Description:** Nothing under `src/` (or in `index.html`) is a PNG,
JPG, JPEG, WebP, GIF, AVIF, BMP, ICO or TIFF file, or a raster `data:`
URI, and no audio file (WAV, MP3, OGG, FLAC, M4A, AAC) either. Instead:

- **Images:** WebGL2/GLSL shaders (sea floor, caustics, worm bodies,
  bloom), procedural geometry (spline ribbons), hash noise, procedural
  stroke glyphs for the `-f` field, Canvas 2D text for the classic ASCII
  view, inline SVG for UI icons.
- **Sound:** the Web Audio API (oscillators, filtered noise buffers
  generated with `Math.random`, envelopes). No `AudioBuffer` is ever
  decoded from a file.

Render targets and noise buffers created at runtime *by code* are
allowed.

## Decision

**Option C, strict.** Enforced by `tests/zero-raster.test.js`, which
scans `src/` and `index.html` for raster or audio files, raster `data:`
URIs, and references to raster or audio extensions.

| Location | Raster / audio allowed? |
|---|---|
| `src/**`, `index.html` | ❌ Never |
| `media/` (README screenshots) | ✅ Documentation only |
| `tests/fixtures/` | ✅ Text captures of the original binary (JSON) |
| Web fonts (Google Fonts, vector outlines) | ✅ Not raster; loaded non-blocking with system fallbacks |

## Consequences

### Positive

- The whole port is a few hundred KB of text. View-source shows the
  entire ocean.
- Every species is a table row plus a few shader branches, so a new
  palette is a code change, not an art commission.
- The rule is mechanically checked, so a PR that drops in a PNG fails.

### Negative / Risks

- Procedural audio is harder to make pleasant than a recording. It is
  kept sparse (a drone and bubbles) and muted by default.
- More shader code means more places to look fake. Mitigated by the
  screenshot → critique → fix loop recorded in the diff-log.

## References

- `worms.c:46-61` (the ASCII banner), `worms.c:217` and `worms.c:279-290`
  (the `-f` field). Upstream: <https://github.com/vattam/BSDGames/blob/master/worms/worms.c>
- [ADR-001](./001-rendering-stack.md): the stack that makes this practical.
