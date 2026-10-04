# ADR 0001 — Double Cross draws with Canvas 2D

- Status: accepted
- Date: 2026-10-02

## Context

Prompt 08 asks for two looks drawn entirely in code: **Sidewalk Chalk** (chalk dots and chalky
strokes that draw themselves, with a little wobble and dust) and **Night Neon** (neon nodes and
tubes that flicker on and glow). Its signature moment is a cascade: boxes filling one after another
across the board after a double cross. Boards run from 1 × 1 to 10 × 10 boxes, the Hall runs from
1280 × 720 to 2560 × 1440, and play must hold 60 fps at 1920 × 1080.

SVG would keep each line a separate element, but chalk grain (hundreds of seeded specks per line),
neon glow (layered blurred strokes added together) and pavement or brick textures are far cheaper as
pixels than as nodes and filters.

## Decision

- **Canvas 2D** for the board: one canvas, sized to the device pixel ratio.
- The **ground** (sunny pavement, or the night wall and its sign board) is painted once per look,
  board size and window size into an offscreen canvas and copied each frame.
- **Drawn lines** are painted once into a second offscreen layer when they finish drawing; only the
  line being drawn, the last line's pulse, claimed boxes in their fill-in, the chain lens, the
  cursor and particles are drawn every frame.
- Every texture is seeded from the edge or box number, so a position always looks the same.
- The interface (top bar, players, side panel, cards, the tutorial coach) is HTML and SVG, so text
  stays crisp, focusable and readable by screen readers.

## Consequences

- No dependency; a frame stays a few hundred draw calls even on a 10 × 10 board.
- Neon glow uses stacked strokes in the `lighter` composite mode instead of real blur, which keeps
  it fast and identical across browsers.
- A claimed box never relies on colour: each player fills with their own pattern (hatching or
  stipple) and their own mark.
