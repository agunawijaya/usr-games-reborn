# 0001 — The table in Canvas 2D, panels in HTML

- **Status:** Accepted (owner approved the hero frames, 2026-10-24)
- **Date:** 2026-10-24

## Context

Prompt 18 asks for a wooden table in two designed looks (a porch in late sun, a table by a
fire), a 3D-looking wooden peg board with brass pegs that leapfrog, the kit's Art Deco cards,
and a counting moment where every fifteen, pair and run lights up, all at 60 fps at
1920 × 1080, in Canvas 2D or WebGL. The deck is already drawn in Canvas 2D
(`@usr-games/kit/cards`).

## Decision

- **Canvas 2D**, no new dependency, the same as the deck it shows.
- **One canvas drawn from a plain `Scene`** (`src/render/scene.ts`): the director builds the
  scene every frame from the table as shown, and the hero scenes build it by hand. Positions are
  on a 1920 × 1080 design sheet scaled to the window, letterboxed by the table's own wood.
- **Painted once, copied every frame**: the planks, sun, railing shadows and light (per size and
  look, `table.ts`), the board with its grain, inlay, holes and marks (`board.ts`), card faces
  (the kit's sprites) and gold faces. Only what moves is drawn each frame: leaves sway, fire
  breathes, embers rise, pegs jump, cards glide, lights bridge the fifteens.
- **No blur filters per frame.** Moving shadows are radial gradients (`shadow.ts`); filters are
  used only in layers painted once. With them the table ran at 9 fps in software; without, 60 fps
  on the GPU and about 30 in software.
- **HTML panels on a design sheet** (`ui/hud.ts`): status, prompt, ledger, key strip, coach,
  claim pad and the clear buttons over your cards live in a 1920 × 1080 element scaled like the
  canvas, so they line up with the table and stay crisp, focusable and readable by screen
  readers. The menus, pages and results card are ordinary HTML scaled with `--ft-u`.

## Consequences

- A still frame can be drawn at any moment (hero frames, poster, reduced motion).
- Text on the canvas is limited to what decorates or repeats the HTML (callouts, the count dial,
  labels); everything a player must read is also announced or written in the panels.
- WebGL was not needed; the board's depth is painted (edge, bevel, sheen, cast shadow).
