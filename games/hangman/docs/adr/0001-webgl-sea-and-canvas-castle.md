# ADR 0001 — A WebGL sea under a Canvas 2D castle

- Status: proposed (owner checkpoint, prompt 11 §6)
- Date: 2026-10-05

## Context

Prompt 11 makes the beach the showcase. It must be always alive: the sea breathing, foam
drawing itself along the shore, glints on the water at midday, breakers that glow at night,
stars caught in the wet sand. A wrong letter sends a swell that crests behind the castle and
surges up the sand. The prompt asks for WebGL water, or a polished Canvas 2D fake, decided in
an ADR. It must run at 60 fps at 1920 × 1080 with zero raster files (collection ADR 0002).

Everything on the water is per-pixel and continuous: depth colour, rolling swells, lacy foam,
the glint path under the sun or moon, swash thinning over wet sand, reflections. In Canvas 2D
that means hundreds of gradient strokes a frame and still looks banded. The castle, the
creatures and the props are crisp illustrated shapes that change in discrete ways (a section
slumps, a shell appears), which is what Canvas 2D does well.

## Decision

- **WebGL 1** (GLSL ES 1.0) for the backdrop: one full-screen triangle and one fragment shader
  (`src/render/sea-shader.ts`, driven by `src/render/sea.ts`) for the sky, sea, breakers, swash,
  and wet and dry sand. Value noise and fbm make the foam, ripples and grains. The sea breathes
  on a seven-second cycle. A wrong letter's swell and surge are uniforms aimed at the castle.
- **Canvas 2D** on a second canvas on top (`src/render/beach-view.ts`): the castle
  (`castle.ts`), crabs, gulls and footprints (`life.ts`), the headland, lighthouse, tide gauge,
  bucket and shells (`props.ts`), and spray, sand slides and the win flourishes (`effects.ts`).
  Everything is a pure function of the state and the clock, so any moment can be frozen for a
  still, a poster or a test.
- **HTML** for the interface: the score, the word in the sand, the shell keyboard, the gauge
  label and the Lighthouse. It stays crisp, focusable and readable aloud.
- **Fallback:** without WebGL, `painted-sea.ts` draws the same sky, sea and sand as gradients
  with a moving foam line, and the game stays complete.
- The shader canvas renders at a device pixel ratio of at most 1.5. Its context is released at
  once (`WEBGL_lose_context`) when a view closes, so attract loops and posters never pile up
  contexts.

## Consequences

- Rich, continuous water for one draw call. The fragment shader is the main GPU cost; its noise
  is four octaves at most.
- The two layers must agree on geometry: the shared `layout.ts` and the same swell-line formula
  in shader and effects keep the castle, spray and water lined up.
- Effects that belong behind the castle (the swell's spray, the win flourishes) paint before it
  on the 2D layer; the sand's effects paint after it.
- A poster must render the shader to an offscreen WebGL canvas and copy it into the 2D canvas
  the Hall provides. This is a stage-2 task.
