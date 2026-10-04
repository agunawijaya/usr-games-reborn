# 0001 — The tank in Canvas 2D

- **Status:** Accepted (approved by the owner with the hero frames, 2026-10-02)
- **Date:** 2026-10-02

## Context

Prompt 06 asks for Canvas 2D or WebGL, decided in an ADR. Sinkers draws an aquarium: caustic light
on the back glass, rays, swaying plants, fish, marine snow, a glass tank with a depth gauge, up to
198 glassy pebbles fused into clusters with etched glyphs and a night glow, a dotted sonar
footprint, and a burst of several hundred bubbles with light blooming through. It must hold 60 fps
at 1920 × 1080 with zero raster files, in two looks.

## Decision

- Everything is drawn with Canvas 2D, in device pixels, by `src/render/`.
- A sinker is one path per touching piece: the outline of its cells, inset so neighbours keep a
  seam of water, corners rounded, and pinched in wherever two pebbles meet along a side. The same
  path is filled (a gradient tinted by depth), stroked darker inside for the rim and brighter offset
  for the refraction edge, and clipped to for the per-pebble bloom, glint and glyph.
- The still scenery (water, back glass, far rocks, sand) is painted once per size and look into an
  offscreen canvas and copied each frame. Caustics are computed on a 192 × 108 buffer and scaled up.
  Plants are generated once per seed and swayed with a transform.
- Bursts and score bubbles are pure functions of their age, so a still can be taken at any instant
  (the hero frames, tests) and reduced motion simply freezes or drops them.
- No new dependency.

## Consequences

- The same code draws play, the title's attract tank, the Hall's demo and the poster; no WebGL
  context to lose.
- All six live hero scenes hold **60 fps at 1920 × 1080 in both looks (median 16.7 ms, 95th
  percentile ≤ 16.8 ms)**, including the four-row burst. A frame-rate test joins the browser suite
  in stage 2.
- The night glow uses `shadowBlur` per cluster. It is cheap at this cluster count; if a fuller tank
  ever drops frames, the glow moves to a quarter-size blurred layer as in Noodle Nine.
