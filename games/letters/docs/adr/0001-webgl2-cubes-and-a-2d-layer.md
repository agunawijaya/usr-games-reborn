# ADR 0001 — WebGL 2 cubes under a 2D layer

- Status: accepted (owner, 2026-10-11)
- Date: 2026-10-11

## Context

Prompt 12 makes the cubes the showcase: chunky, tactile cubes with rounded edges, soft studio
light and ambient occlusion by day, glass blocks lit from inside over a slow aurora by night. At
the start of a round they tumble and land in their cells; a traced chain lights its cubes in
order under a flowing ribbon; the reveal lights the whole grid as a web. It asks for WebGL
(three.js, lazy-loaded) or a high-quality Canvas 2D fake, decided in an ADR, at 60 fps at
1920×1080, with zero raster files (collection ADR 0002).

A cube that tumbles shows all six faces, each with its own letter, turning in perspective; a
glass cube shows what lies behind it. Canvas 2D would need a hand-written projected-polygon
renderer with sorting and per-face lighting, and would still look flat. three.js would do it,
but it is a new runtime dependency (installing one needs the owner while other sessions run),
and the scene needs only one mesh, four small shaders and no scene graph.

## Decision

- **WebGL 2, no library.** `src/render/scene.ts` draws, in order, the backdrop (one full-screen
  triangle: the studio sweep with its lamp pool and drifting out-of-focus lights, or the aurora
  with stars), the tray, soft shadows (Studio) or coloured light pools (Arcade) on the tray and
  under it, and the cubes. All cubes are one instanced draw of one rounded-cube mesh
  (`mesh.ts`): per instance a position, an orientation (quaternion), a colour, six glyphs and
  three animation values (trace, flash, dim).
- **Letters from an atlas drawn at start-up.** `atlas.ts` draws A–Z and `Qu` with the
  collection's self-hosted Fredoka into a canvas texture: the crisp glyph in red, a blurred halo
  in green. The cube shader picks the face from the object-space position and samples its
  glyph; glass cubes add the halo as light from inside. No image file exists.
- **Two looks, two shading models.** Studio is opaque pastel with a key light, a fill light,
  hemisphere ambience, a glossy highlight and occlusion towards the base. Arcade is blended glass
  with a neon bevel, Fresnel rim and an emissive letter, drawn far to near.
- **A 2D canvas on top** (`overlay.ts`) for the ribbon, the order badges and the reveal's web.
  Studio multiplies the ribbon over the cubes, so dark letters stay readable through it; Arcade
  adds it as light. Web strands stop short of each cube's centre.
- **HTML for the interface**: clock, score, coverage ring, word wall, word chips and the reveal
  panel stay crisp, focusable and readable aloud.
- **Everything is a function of the clock.** The tumble (`tumble.ts`), flashes, shakes, the
  long-word pop and the web's draw-in are start times; freezing the clock holds any moment, which
  is how the hero frames, posters and tests are made.
- The shader canvas renders at a pixel ratio of at most 1.5; its context is released when a view
  closes. Without WebGL 2, a Canvas 2D painter (`render/painter2d.ts`) draws the cubes flat.

## Consequences

- Both looks come from one renderer and one set of geometry; switching appearance is a palette
  change, never an inversion.
- No new dependency and nothing to lazy-load beyond the game's own chunk; the dictionary is the
  only large asset, and only the solver worker loads it.
- The two layers must agree on geometry: `camera.ts` owns the projection, and every 2D point is
  projected from the same world positions the shaders use.
- The ribbon passes over letters by design; its blend modes, not its alpha, keep them legible.
