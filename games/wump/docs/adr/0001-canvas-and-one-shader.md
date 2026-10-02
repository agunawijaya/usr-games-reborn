# 0001 — Canvas 2D for the cave, one WebGL shader for the dart ride

- **Status:** Accepted (with the hero frames, approved by the owner on 2026-10-02)
- **Date:** 2026-10-02

## Context

Prompt 03 suggests Canvas 2D for the map and WebGL (three.js, lazy-loaded) for the room view and the
dart ride, and asks for the choice in an ADR. The room view is an illustration in two looks: a
watercolour field sketch on the notebook page (Scrap Paper) and a lantern-lit cross-section of the
cave (Lantern Dark). The dart ride follows the dart down each tunnel of its path in first person and
must hold 60 fps at 1920 × 1080, in caves of up to 120 rooms.

## Decision

- **The map and the room view are drawn with Canvas 2D.** The chamber, its arched mouths, the
  explorer, the wumpus, the senses and the lantern's darkness are all paths, gradients and a little
  per-pixel noise cached per room. Nothing in either view is a 3D scene.
- **The dart ride is one fragment shader on a WebGL 2 canvas** (`src/render/tunnel-gl.ts`), with
  no library. Each pixel looks down a bending tube: a polar mapping whose bend is projected back
  onto the screen, a swelling chamber at every room on the path, rock streaked along the tunnel so
  it streams past. Scrap Paper shades it with pencil hatching on cream paper; Lantern Dark lights it
  with the dart's lavender glow. The dart, the passing plaques and the path are drawn over it by
  Canvas 2D and the page.
- The shader renders at three quarters of the screen's size and is scaled up; its work per pixel
  does not depend on the size of the cave.
- Where WebGL 2 is not available, and when the player turns the camera ride off or asks for reduced
  motion, the ride becomes a quick animation of the dart's path on the map.

## Consequences

- Nothing to install or lazy-load: three.js is not added. The same code draws play, the hero
  frames, the Hall's demo and the poster.
- The camera can only fly forward down a tunnel; a free-roaming 3D cave would need a real scene.
- Measured on 2026-10-02 in the deep cave (120 rooms) at 1920 × 1080: 60 fps while exploring and
  59–60 fps during the ride, in both looks (`e2e/perf.spec.ts`, figures in NOTES.md). The render
  scale is the first thing to tune if a slower machine falls short.
