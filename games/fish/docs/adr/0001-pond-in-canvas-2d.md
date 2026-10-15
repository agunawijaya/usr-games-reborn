# 0001 — The pond in Canvas 2D, panels in HTML

- **Status:** Accepted (owner approved the hero frames, 2026-10-15)
- **Date:** 2026-10-15

## Context

Prompt 16 asks for water, fish and characters drawn in code (Canvas 2D or WebGL, decided in an
ADR) at 60 fps at 1920 × 1080, in two designed looks: Morning Pond (sun shafts, dragonflies,
glints) and Firefly Pond (moon path breaking into ripples, fireflies, glowing koi). The signature
moments are a cast reeled in with a wriggling card, a book of four turning into a leaping fish,
and every player's fish swimming a lap of the pond at the end. The deck is the kit's Art Deco
deck, already drawn in Canvas 2D (`@usr-games/kit/cards`).

## Decision

- **Canvas 2D**, no new dependency, the same as the deck it shows.
- **Two canvases.** A still layer painted once per size and look (sky, sun or moon and stars,
  tree line with poplars, bushes, wildflowers, banks, the pond's basin, the trees mirrored in it,
  sun shafts or mist), and a live layer drawn every frame from a plain `PondScene`: water life,
  reflections, pads, the pile, reeds, rivals, flyers, the bucket, the hand, casts and leaps.
- **Everything moving is a pure function of time and age** (waves, koi, fireflies, the cast's
  phases in `cast.ts`, the leap in `leap.ts`), so a still frame can be asked for at any moment and
  reduced motion holds the water, pads, reeds and flyers still.
- **Reflections** are drawn upside down into an off-screen canvas, faded with depth and laid on
  the water in 3 px strips that waver, so they read as reflections, never as animals under water.
- **Fish** are drawn along a spine that can arch and wriggle (`fish/painter.ts`); every part is
  described in the fish's straight frame and bent through one `warp`, so head, body and tail are
  always one animal. Thirteen species are data (`fish/species.ts`); the golden variant maps each
  colour to a gold of the same lightness.
- **Rivals** are painted from vector paths, one painter each, with four moods.
- **Panels in HTML** over the canvases (`ui/hud.ts`): name plates, bubbles, the ask bar, the
  notebook, labels. Text stays crisp and readable by screen readers, and keyboard focus is real.

## Consequences

- Card faces come from the kit's image caches; the live layer copies images.
- Fish and rivals are repainted every frame from paths; at the sizes on screen this is cheap,
  and both can be cached into sprites later if a measurement asks for it.
- The same painters can draw the Hall's demo and the poster.
