# ADR 0001 — Full Pockets draws with Canvas 2D

- Status: accepted
- Date: 2026-10-02

## Context

Prompt 05 asks for a sunken stone garden drawn entirely in code (zero raster, ADR 0002 of the
collection), in a Sun Garden and a Moon Garden look, at 60 fps at 1920×1080, with a long glossy
snake that glides between squares, sparkling glints, a coil-and-spill capture and a cascade into a
vault. It leaves the choice between Canvas 2D and WebGL to an ADR.

The board is small (about 24 × 14 squares, never more than the original's 78 × 22), the camera
never moves, and nearly everything on it is still from one turn to the next. What moves is a
handful of things: the snake, the explorer, a few glints, water, fireflies and particles.

## Decision

- **Canvas 2D**, one canvas per view, sized to the device pixel ratio.
- The ground (walls, flagstones, hedges, pool basins and the door's stone ring) is painted once per
  chamber, look and size into an offscreen canvas and copied each frame.
- Everything alive is drawn on top each frame from plain data: water glints, glints, the door's
  glow, the strike preview, the snake, the explorer, lights and particles.
- Textures are procedural: a seeded hash gives every flagstone, leaf and scale its own variation,
  so a chamber looks the same every time it is drawn.
- The interface around the board (top bar, side panel, cards and the Lucky Break dial) is HTML and
  SVG, so text stays crisp, focusable and readable by screen readers.

## Consequences

- No dependency and no shader code; the renderer runs in any browser the Hall supports.
- The offscreen ground keeps a frame to a few hundred draw calls; the static layer is rebuilt only
  when the chamber, the look or the size changes.
- Effects that would be cheap in WebGL (bloom, real lighting) are approximated with gradients and
  the `lighter` composite mode, which is enough for a garden at noon or by moonlight.
