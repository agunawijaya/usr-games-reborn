# 0001 — The board in Canvas 2D

- **Status:** Accepted (approved by the owner with the hero frames, 2026-10-03)
- **Date:** 2026-10-02

## Context

Prompt 07 asks for Canvas 2D or WebGL, decided in an ADR. Fivefold draws a 15 × 15 or 19 × 19
board with up to 361 pieces in two looks. By day (Zen Sand): raked sand with grain, rocks with moss
and rings raked round them, a granite kerb, the grid as grooves, pebbles of slate and quartz with
soft shadows. By night (Lantern Lake): sky, far shore and moon, a lake with the moon's path, the
grid in light, floating lanterns with halos and reflections that bob, a few more drifting far out.
Over either: the threat lines of "Read the board", the cursor, and the win moment (rings in the
sand; lanterns rising to become stars). 60 fps at 1920 × 1080, zero raster files.

## Decision

- Everything is drawn with Canvas 2D by `src/render/`, in device pixels.
- The still parts are painted once per size and look into two offscreen canvases: the backdrop
  (garden or sky, shore and lake) and the board (bed, kerb, grid, marked points, coordinates). Each
  frame copies them and draws only what moves.
- Pieces are drawn once per cell size into small sprites (six pebble shapes per side by day; one
  lantern, one halo and one reflection per side by night) and stamped; lanterns bob with a
  transform, halos and reflections are added with the `lighter` blend.
- The win moment and the settling ripples are pure functions of their age, so a still can be taken
  at any instant (hero frames, tests) and reduced motion simply shows the settled end state.
- No new dependency.

## Consequences

- One renderer serves play, the replay, the menus' scenery (`SceneryView`), the Hall's demo and
  the poster; no WebGL context to lose.
- The six live hero scenes hold 60 fps at 1920 × 1080 in both looks (median 16.7 ms, 95th
  percentile ≤ 16.8 ms).
- Threat lines and halos use `shadowBlur`; cheap at these counts. The heaviest board tested — 19 ×
  19 with 300 pieces, Read the board on, everything moving — holds 60 fps in both looks (mean 16.7 ms,
  95th percentile 16.8 ms; `e2e/perf.spec.ts`).
