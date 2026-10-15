# 0001 — The road and the table in one Canvas 2D, cards from image caches

- **Status:** Accepted (the owner approved the hero frames, 2026-10-15)
- **Date:** 2026-10-15

## Context

Prompt 17 asks for Canvas 2D or WebGL, decided in an ADR, and 60 fps at 1920 × 1080. The screen
has two halves that must feel like one picture: a road strip across the top, where two cars drive
along a coast in flat poster layers that slide past at their own pace (sea, hills with villages and
a lighthouse, a guard rail, the road, near agaves), with signals, signs, puffs and a gold glow for
the coup fourré; and an open road atlas below, holding both sides' placards, your hand, the deck
and the discard pile. Night adds stars, the moon on the water, a turning lighthouse beam, neon and
headlights. The deck's 19 faces are detailed vignettes that must stay crisp at any size, in two
looks.

## Decision

- **Canvas 2D**, no new dependency: everything is flat shapes and gradients, which Canvas 2D draws
  quickly and crisply; nothing needs depth or shaders.
- **One canvas** for road and table, so a card can fly from the hand across the placards and over
  the road edge in one draw order. Text that people read (the score bar, the line of play, the key
  under each card) and every control sit in the page above it, for sharp type and screen readers.
- **Card faces are painted once per size and look** into offscreen images (`CardSprites`,
  `src/render/sprites.ts`); every frame only copies them.
- **The atlas is painted once per size and look** (`paintAtlas`), then copied.
- **The road is drawn every frame** from a pure description (`RoadFrame`: camera, cars, poses,
  trouble, puffs, slow motion) by `drawRoad`; scenery that repeats as the camera moves is placed
  by a stable hash of its position, so it never jumps.
- **A 1920 × 1080 design grid** (`computeLayout`) scales to the window; the road and the atlas
  fill any spare edge.

## Consequences

- Hero frames render in about 2 s including the search for a real moment. During play the game
  holds 60 fps at 1920 × 1080 by day and by night, the coup's slow motion included (NOTES.md).
- The road strip is the costliest part (a few hundred shapes, a handful of gradients); if it ever
  costs too much, its far layers (sky, islands, sea) can be cached per camera step without
  changing the painters.
- The same painters will draw the Hall's demo and the poster.
