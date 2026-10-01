> **Upstream history, not instructions.** This is the agent guide the game shipped with before it
> joined /usr/games Reborn. Nothing here overrides the repository rules in `CLAUDE.md` and
> `AGENTS.md` at the repo root; where they differ, the repository rules win.

# AGENTS.md — `worms / fancy-web` (*Abyssal Worms*)

Port-specific instructions. Read the game-level
[`../../AGENTS.md`](../../AGENTS.md) and the root
[`../../../../AGENTS.md`](../../../../AGENTS.md) first; this file only
adds what is specific to this port.

## Identity anchor

A bioluminescent deep-sea screensaver driven by the **unchanged**
`worms(6)` engine. It is proof that beautiful graphics and sound can
come purely from code.

## Hard rules

1. **No raster images and no audio files** in `src/` or `index.html`
   ([ADR-002](./docs/decisions/002-zero-raster-assets.md)), enforced by
   `tests/zero-raster.test.js`. Screenshots go in `media/` only.
2. **The engine stays faithful.** `src/engine/` must keep reproducing
   the original binary. `tests/fixtures/worms-binary-golden.json` holds
   screens and CLI outputs from a binary built from the original
   `worms.c`. Never hand-edit it. Regeneration is described in
   `docs/notes.md`.
3. **Renderers read the world, never write it.** Presentation choices
   (glide, grid from viewport, live flags) are in
   [ADR-003](./docs/decisions/003-time-grid-and-live-flags.md). Live
   edits must go through the engine’s `setNumber` / `setLength` /
   `setTrail` / `setField`, which reuse the original cell operations.
4. **Never assume a GPU.** Keep the three modes working: GPU, CPU WebGL
   (auto Low), no WebGL (classic view). Everything that touches the
   renderer must tolerate `renderer === null` and an unfinished shader
   compile (`renderer.ready()`).

## Stack

Vanilla ES modules, raw WebGL2, Canvas 2D (classic), Web Audio, no
build. `npm start`, `npm test`, `npm run shots` (Playwright, GPU).

## File map

```
ports/fancy-web/
├── index.html                 page shell (inline SVG icons)
├── src/
│   ├── engine/worms.js        the worms.c main loop, tables, live edits
│   ├── engine/random.js       glibc random() (TYPE_3)
│   ├── engine/args.js         getopt + strtoul/atoi, original messages
│   ├── render/renderer.js     WebGL2 pass graph
│   ├── render/geometry.js     glide window, spline ribbons, trails
│   ├── render/species.js      the eight species (O * # $ % 0 @ ~)
│   ├── render/classic.js      Canvas 2D terminal view
│   ├── render/gl.js           WebGL2 helpers (shared with pom port)
│   ├── render/shaders/*.js    floor, worm, post (+snow), common noise
│   ├── audio/ambience.js      procedural drone, bubbles, chimes
│   └── ui/app.js, styles.css  controller and chrome
├── tests/                     node:test (engine, geometry, zero-raster)
├── scripts/                   serve.mjs, capture-screenshots.mjs
├── media/                     README screenshots
└── docs/                      diff-log, architecture, scenarios, notes, ADRs
```

## Guardrails for visual changes

- Screenshot, critique like an art director, fix, then re-screenshot.
  Record the loop in `docs/diff-log.md`.
- Check the default (`-n 3`), `-n 8` (all species), `-t`, `-f`, split,
  classic, reduced motion and Low quality before calling a change done.
- Keep `-n 20 -l 64 -t -f` at 60 fps on the reference GPU; measure GPU
  time, not just rAF intervals.

## See also

- [`README.md`](./README.md) · [`docs/diff-log.md`](./docs/diff-log.md) · [`docs/architecture.md`](./docs/architecture.md)

---

_The upstream `CLAUDE.md` only pointed to the file above._
