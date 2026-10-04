# 0002 — A look of our own

- **Status:** Accepted (approved by the owner with the hero frames, 2026-10-02)
- **Date:** 2026-10-02

## Context

The falling-blocks game this one comes from has famous descendants whose names and visual expression
are protected and actively enforced; courts have found clones infringing on their overall look. The
mechanics are free to use: four-cell shapes, sliding and turning them, a full row vanishing. Prompt
06 (and hard rule 3) ask that the look be unmistakably ours and that these choices be recorded.

## Decision

| Commonly seen | Sinkers |
| --- | --- |
| A 10 × 20 well | An **11 × 18 aquarium tank** of glass, standing on sand, with air above the water and a depth gauge in metres. Classic 1992 keeps the original's 10 × 20 inside the same tank. |
| Square, bevelled, single-colour bricks on a grid | **Glassy pebbles fused into clusters**: one rounded outline per sinker, pinched in between pebbles, refraction highlights, no bevels, no grid lines in the water. |
| A fixed colour per shape | **Colour by depth**: a sinker takes the colour of the water depth it settles at (mint near the surface, blue, violet, magenta at the bottom; glowing by night). The shape is told by a glyph etched in each pebble — wave, chevron, ring, four-point star, spiral, cross, three bubbles — never by colour. |
| A "ghost" copy of the piece where it will land | A **sonar footprint**: a thin dotted outline only, no fill, no glass, plus a dotted ping running down to it. |
| A hold box | **No hold at all.** The one upcoming sinker rides in a bubble beside the tank. |
| Rows flashing and vanishing | Rows **crack and turn into bubbles** that rise in a column while light blooms down; the score rises in bubbles and pops at the surface. |
| The usual names | "Sinkers" (or "shapes"); "plunge" for the drop; "burst" for a cleared row; "depth combo". |

- The trademark and the words for the pieces and a well-known turning trick appear **nowhere** in UI
  strings, code identifiers or docs, except `CREDITS.md` and the provenance section of `NOTES.md`
  (where the original program's name is quoted). A test guards this from stage 2 on.
- The original program's name appears in `manifest.json` only as `inspiredBy.program` and
  `originalTitle`, which the Hall never shows in the UI.

## Consequences

- A screenshot of Sinkers is an aquarium first; nothing in it is a brick, a grid, a ghost or a hold
  box.
- Colour by depth carries information (how deep the stack is), and the glyphs keep the game
  playable without colour vision.
- The guard test fails the build if the forbidden words creep into a string, an identifier or a doc.
