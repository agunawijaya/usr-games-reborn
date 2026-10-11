# 0001 — Two themes as two Canvas 2D worlds behind one interface

- **Status:** Accepted (stage 1, awaiting the owner's hero-frame review)
- **Date:** 2026-10-11

## Context

Prompt 13 asks for one game with two player-chosen themes, Sprint (a running track) and Atom
(numbers as molecules), each designed in light and dark, with the same rules and screens. It
leaves the rendering technology to an ADR and asks for 60 fps at 1920 × 1080, zero raster and
reduced motion honoured.

## Decision

- **One interface, two renderers.** Both themes implement `World` (`src/render/world.ts`):
  screens tell the world what is on stage (`show`) and what just happened (`cue`), and the
  world draws it. Worlds never decide anything about the game; engines never know a world
  exists. Switching theme swaps the world under the same screen.
- **Canvas 2D for both worlds.** Neither theme needs per-pixel effects: Sprint is shapes and
  gradients, Atom is circles, strokes and additive glow. Canvas 2D draws both crisply at any
  size, needs no shader fallback, and keeps the bundle small. Everything static (sky, stands,
  crowd rows, track ground, the lab wall, the chamber) is painted once per size and look into
  offscreen layers; each frame copies those and draws only what moves (the runner, lane
  markings, molecules, sparks).
- **The interface is DOM**, placed from the same `Layout` the worlds use (`src/render/layout.ts`)
  so the problem text sits exactly on the scoreboard or the lab display. Text stays real text:
  readable by screen readers, focusable, never smaller than 16 px.
- **Everything is drawn in code.** The runner is a jointed skeleton drawn with thick round
  strokes from pose angles, so limbs cannot come apart; atoms and molecules are generated from
  each number's prime factors. No image files.

## Consequences

- A third theme would be a third `World` and a set of CSS tokens; no screen changes.
- Glows on light backgrounds must fade to their own colour at zero alpha (`transparentOf` in
  `src/render/paint.ts`): Canvas gradients blend unpremultiplied, and fading to transparent
  black leaves grey fringes.
- Reduced motion: worlds stop scrolling, running cycles and bursts, and show end states.
