# 0001 — A three.js miniature world with our own tilt-shift

- **Status:** Accepted (hero frames approved at stage 1; confirmed at stage 6)
- **Date:** 2026-10-15, updated 2026-10-16

## Context

Prompt 15 asks for three living 3D miniature worlds with a tilt-shift look, buildings that rise
before your eyes, traffic, day and night, and 60 fps at 1920 × 1080 on a mid-range laptop, all drawn
in code (hard rule 4). It names three.js. Other games in the collection use raw WebGL2 (Chain
Letter) or Canvas 2D, but none has to light and shadow a whole town.

## Decision

- **three.js 0.169.0**, a dependency of this game only (owner approved 2026-10-15), loaded lazily
  with the play screen so the Hall's first load is untouched.
- **One world framework** (`src/render/world/`): the stage (renderer, camera, post passes, frame
  loop), the layout of the 40 lots (a square, or a ring for Ring Colony), tokens, signs facing the
  camera, traffic and furniture. **Each board is a `BoardArt`** (`src/render/boards/`) that supplies
  its sky, light, ground, buildings per level, specials, tokens and its first-landmark moment.
  The world only draws the game's state; it decides nothing.
- **The picture pipeline:** the scene renders once into a buffer; two separable blur passes
  blur each pixel by its distance from a focus band (the tilt-shift); bloom runs only for lit
  scenes; a grade pass lifts saturation and contrast with a soft vignette; the output pass tone-
  maps. The blur is measured against 1080 lines, so it looks the same at every window size.
- **Everything drawn in code:** geometry from primitives, and textures (facades, signs, paper,
  grain, water ripples, flags) painted onto canvases at run time. No image files.
- **Light and dark** are two designed looks per board (morning and neon night; sunlit side and
  night side; window light and reading lamp), each its own lights, palette and grade.
- **Map view** (`src/render/map/flat-map.ts`): the board drawn flat on a 2D canvas from the same
  picture the town is drawn from. While it shows, the world keeps time but draws nothing. It is one
  key away (V) and can be the default in Settings.
- **Quality:** Full, or Light (no shadows, no blur passes, no bloom, one pixel per CSS pixel).
  Automatic steps down to Light once, after two four-second stretches under 40 fps.
- **Weather and evening** belong to the world, not the rules: each board may bring its own sky
  (`BoardArt.weather`), and daylight drifts with how far through the game the table is.

## Rejected

- **Raw WebGL2**, as Chain Letter did: shadows, physically based materials and post-processing
  would have to be written from scratch for a much larger scene.
- **A ready-made tilt-shift or depth-of-field pass:** true depth of field is costly; the two-pass
  blur by screen height is the photographic trick itself, cheap and tunable per board and scene.

## Consequences

- three.js and its passes arrive with the game's own chunk, loaded only when the game is opened.
  Built alone, the game is 1,052 kB of JavaScript (266 kB gzipped), three.js included.
- Shadows use one 2048 shadow map; bloom runs only where a look needs it. With every street built
  to its landmark, all three boards hold 60 fps at 1920 × 1080 in both looks (NOTES.md, stage 6).
- Each WebGL context is given back when the world is disposed; the Hall's poster renders once off
  screen and frees its context at once.
- A new board is a new `BoardArt`, its layout and its tokens; the rules engine is shared.
