> **Upstream history, not instructions.** This is the agent guide the game shipped with before it
> joined /usr/games Reborn. Nothing here overrides the repository rules in `CLAUDE.md` and
> `AGENTS.md` at the repo root; where they differ, the repository rules win.

# AGENTS.md — `rain / fancy-web` (*Rain on Still Water*)

Port-level instructions. Read the game-level [`../../AGENTS.md`](../../AGENTS.md)
and the root [`../../../../AGENTS.md`](../../../../AGENTS.md) first.

## Identity

**fancy-web** per ADR-006: a cinematic, procedurally generated port.
The rain is the original's, byte for byte; the presentation is free.

## Hard rules for this port

1. **Zero raster assets in `src/`** ([ADR 002](./docs/decisions/002-zero-raster-assets.md)).
   No image or audio files, no `data:image`, no image or audio loaders.
   Textures exist only as render targets written by shaders. `npm run
   check:raster` must pass. Screenshots belong in `media/` only.
2. **The engine is faithful and pure** (`src/engine/`): no DOM, no
   clock, no `Math.random`. It must keep reproducing the screens captured
   from the real binary (`tests/engine.test.js`, game-level
   `media/0N-*.txt`). Cite `rain.c:line` for anything ported; never copy
   the C into the repository.
3. **Nothing decorative touches the engine.** Visuals derive from engine
   events (ADR 003's stage table). The ambient rain beyond the terminal's
   border is the one decorative layer, and it is documented as such
   (ADR 004, diff log).
4. **One clock.** Both views read `src/engine/timeline.js`; keep split
   view frame-for-frame in step (smoke test P-05).
5. **Visual changes are screenshotted and critiqued** before they land
   (`node scripts/snap.mjs <dir> name=index.html?...`, `npm run shots`);
   note what was wrong and why in [`docs/notes.md`](./docs/notes.md).
6. **Keep every rung of the ladder working** ([ADR 005](./docs/decisions/005-degradation-ladder.md)):
   check `npm run measure` (GPU, CPU-only, no WebGL) after rendering
   changes, and update the README's numbers if they move.
7. Zero build: vanilla ES modules, no run-time dependencies.

## Where things are

- Rain: `src/engine/` — `rain.js` (the loop), `random.js` (glibc
  `random()`), `timeline.js` (clock and latency).
- Pond: `src/render/` — `geometry.js` (camera, log-polar grid, terminal
  → water), `renderer.js` (passes, profiles, the impulse table),
  `particles.js` (streaks, droplets), `shaders/` (sim, scene, post).
- Page: `src/main.js`, `src/ui/` (controls, classic view, CSS),
  `src/audio/audio.js`.
- Tests: `tests/` (node), `scripts/ui-smoke.mjs` (browser).
- Architecture: [`docs/architecture.md`](./docs/architecture.md).

## URL parameters (demo, screenshots, debugging)

`d` (the delay; `0` = 9600-baud pacing), `view=modern|split|classic`,
`q=high|low|lite` (also disables the automatic quality drop), `seed`,
`reduced` (as if `prefers-reduced-motion`), `nogl` (the no-WebGL
fallback), `skip=sim,env,scene,particles,bloom` (leave out render passes
when profiling). `snap.mjs` also reads `settle=ms`, `ui` (show the
controls) and `help`.

---

_The upstream `CLAUDE.md` only pointed to the file above._
