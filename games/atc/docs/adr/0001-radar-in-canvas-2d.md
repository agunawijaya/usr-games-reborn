# 0001 — The radar and Altitude Tilt in Canvas 2D

- **Status:** Accepted (approved by the owner with the hero frames, 2026-10-01)
- **Date:** 2026-10-01

## Context

Prompt 02 suggests Canvas 2D or WebGL for the radar and three.js, lazy-loaded, for the tilt view,
and asks for the choice in an ADR. The radar must draw both looks (Day Chart and Night Scope), the
procedural chart, 26 planes with tags, routes and forecasts at 60 fps at 1920 × 1080, and swing
smoothly into a tilted view about fifty degrees back where altitude reads as height.

## Decision

- Everything is drawn with Canvas 2D. The tilt only pitches the ground (it never turns it), so every
  row of the chart stays a horizontal line on screen; the printed ground is painted once into its own
  canvas and copied onto the tilted plane in thin strips, each at its own scale, which is exact
  perspective for a pitch.
- Points in the air are projected by `src/render/camera.ts`; planes are drawn flat on their layer,
  tags and labels stay upright, shadows are the plane's own silhouette on the ground.
- No new dependency: three.js is not installed.

## Consequences

- Nothing to download or lazy-load for the tilt; the same code draws play, replays, the Hall's demo
  and the poster.
- The camera can only pitch and lean in; a free orbit around the sky would need WebGL.
- Performance with 26 planes and the tilt active is measured in the engine stage and recorded in
  NOTES.md; the strip count is the first thing to tune if it falls short.
