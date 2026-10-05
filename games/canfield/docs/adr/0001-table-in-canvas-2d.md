# 0001 — The table in Canvas 2D, cards from image caches, light in blend layers

- **Status:** Accepted (approved by the owner with the hero frames, 2026-10-05)
- **Date:** 2026-10-05

## Context

Prompt 10 asks for Canvas 2D or WebGL, decided in an ADR, and 60 fps while dragging at
1920 × 1080. The table must show a full deck with thickness, shadows that grow as a card lifts, a
lean that follows the drag, 3D flips, four animated lotus blooms, a spiral finish of 52 cards, and
two rooms whose light falls across the cards: window light and leaf shade in the Sunroom, a warm
lamp in the Observatory under a slowly turning sky. The deck's faces are detailed (twelve court
figures of many paths each) and must stay crisp at any size.

## Decision

- **Canvas 2D**, no new dependency.
- Each card face and back is painted **once per size and look** into an offscreen image
  (`CardSprites` in `@usr-games/kit/cards`); the table only copies images, scaled for the flip and
  turned for the lean. The deck is painted while the dealing animation runs (`warmUp`).
- The table is **five stacked canvases**: the sky (Observatory only, repainted at most thirty
  times a second), the room (painted once per size), the cards (every frame while anything
  moves), a **shade** layer blended with `multiply` and a **light** layer blended with
  `soft-light`. The shade and light layers sit above the cards, so the same light falls across
  table and cards without repainting either.
- Blooms and the finish are drawn on the card layer from pure functions of time
  (`drawBloom`, `finishPose`), so reduced motion simply asks for their final state.

## Consequences

- Measured 16.7 ms steady frames at 1920 × 1080 in both rooms, mid-game and finish
  (`NOTES.md`); the first frame costs about 1.1 s of painting.
- The card layer is redrawn whole while anything moves; with at most 52 image copies a frame
  this is cheap, and partial redraws were not needed.
- Card lighting is an approximation: the blend layers know nothing of a card's height, so a lifted
  card is lit like the table under it. Its own shadow carries the height instead.
- The same painters draw the Hall's demo and the poster; the poster composites the blend layers
  by hand onto one canvas, which `src/render/poster.ts` does.
