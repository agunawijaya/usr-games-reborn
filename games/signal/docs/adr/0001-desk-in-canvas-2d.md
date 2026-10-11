# ADR 0001 — The desk in Canvas 2D, with cached still layers

- Status: accepted (owner approved the hero frames, 2026-10-11)
- Date: 2026-10-12

## Context

Prompt 14 asks for a tactile still life drawn in code: a brass telegraph key, an enamelled
cipher wheel, a stiff manila card, curling paper tape, a banner printer feeding fan-fold paper,
and a signaller on the roof across the street. Every machine moves (the key clicks down, the
wheel turns with detents, the punch stamps, the tape advances, the printer head shuttles) and
must stay readable in two looks, Morning Desk and Night Shift. WebGL is allowed "only where it
earns its keep"; the target is 60 fps at 1920 × 1080 with zero raster files.

Nothing here is per-pixel and continuous the way water or fire is. The machines are crisp
illustrated shapes (gradients, rings, holes, letters), the light is two broad passes (sun
patches by day, a lamp's pool by night), and the banner is thousands of small inked cells that
never change once printed.

## Decision

- **Canvas 2D only**, one canvas per screen in a 1920 × 1080 design frame scaled to the window
  (`src/render/frame.ts`). Extra width shows more wall and desk; extra height shows more wall.
- **Painters are pure functions** of their state and the clock (`src/render/machines/*.ts`,
  `room.ts`, `outside.ts`, `signaller.ts`), so the desk, the hero frames, the attract loop and
  the poster all use the same drawing code, and any moment can be frozen for a still.
- **Still things are painted once into cached layers** (`CachedLayer` in `frame.ts`): the whole
  desk room with the window glass cut out (the view outside, with its moving signaller, clouds
  and stars, is drawn under it each frame), the close-up desk behind every station, the city and
  roof behind the signaller, and the banner's paper and ink, each in its own layer.
- **Light is a pass, not a property of each machine**: by day soft-light and screen fills lay the
  sun on the desk; by night a multiply fill sinks the room into shadow outside the lamp's pool,
  and lamps, phosphor and indicator glows are added after it so they stay bright.
- The interface (cards, answer fields, buttons, charts) is HTML over the canvas, so it is
  accessible, focusable and crisp; machine parts a player can press (the key, the wheel, card
  cells, tape holes, flag positions) also have invisible focusable buttons or keyboard surfaces.

## Consequences

- Painting a frame costs at most 2.5 ms of main-thread time on every screen at 1920 × 1080
  (measured with the workbench's paint probe, see NOTES.md), so 60 fps holds with room to spare.
- No shader code, no WebGL fallback path, nothing lazy-loaded.
- A change to a still element (a new prop on the desk) needs its layer key to change, or the
  layer to be invalidated, as the clock and the look already do.
