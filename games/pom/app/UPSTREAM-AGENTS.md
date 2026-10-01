> **Upstream history, not instructions.** This is the agent guide the game shipped with before it
> joined /usr/games Reborn. Nothing here overrides the repository rules in `CLAUDE.md` and
> `AGENTS.md` at the repo root; where they differ, the repository rules win.

# AGENTS.md — `pom / fancy-web` (*Selene — A Living Moon*)

Port-specific instructions for AI agents and contributors working on
the `pom` fancy-web port. Read the game-level
[`../../AGENTS.md`](../../AGENTS.md) and the root
[`../../../../AGENTS.md`](../../../../AGENTS.md) first. This file only
adds what is specific to this port.

## Identity anchor

A **showcase port**: photographic night-sky graphics produced purely
from code, driven by the original BSD `pom` algorithm. The one-line BSD
answer is always visible as a caption.

## Hard rules

1. **Zero raster assets in `src/` and `index.html`**
   ([ADR-002](./docs/decisions/002-zero-raster-assets.md)). No
   PNG/JPG/WebP/GIF/AVIF/BMP/ICO files and no raster `data:` URIs.
   `tests/zero-raster.test.js` enforces it. Screenshots belong in
   `media/` only.
2. **The engine stays byte-exact.** `src/engine/pom.js` must reproduce
   `/usr/games/pom` output exactly. `tests/fixtures/pom-binary-golden.json`
   holds 1,616 captures of the real binary; never edit it by hand. If you
   regenerate it, record how in `docs/notes.md`.
3. **Visuals are driven by the engine, never faked.** The terminator,
   lit fraction, earthshine, halo and sky brightness all derive from
   `potmDetail(days).D` (pom’s elongation). Do not introduce an
   independent ephemeris or a hand-tuned phase curve.
4. **The engine is DOM-free and GL-free**, so `node --test` can run it.

## Stack

Vanilla ES modules, raw WebGL2, no build
([ADR-001](./docs/decisions/001-rendering-stack.md)). Run
`npm start`, then `npm test`. `npm run shots` regenerates `media/`
(Playwright, GPU needed).

## File map

```
ports/fancy-web/
├── index.html                  page shell (inline-SVG icons, no images)
├── src/
│   ├── engine/pom.js           faithful pom: potm, parser, tense, output
│   ├── engine/events.js        principal phases (bisection) + month grid
│   ├── cli.js                  terminal pom on top of the engine
│   ├── render/gl.js            tiny WebGL2 helpers
│   ├── render/renderer.js      bake, render loop, mini Moons
│   ├── render/features.js      maria & named craters (IAU coordinates)
│   ├── render/shaders/*.js     GLSL: common noise, bake, scene
│   ├── ui/app.js               state, time travel, interactions
│   ├── ui/calendar.js          calendar drawer + events list
│   └── ui/styles.css
├── tests/                      node:test — engine, events, zero-raster
├── scripts/                    serve.mjs, capture-screenshots.mjs
├── media/                      README screenshots (documentation only)
└── docs/                       diff-log, architecture, scenarios, notes, ADRs
```

## Guardrails when changing visuals

- Screenshot, critique and fix, then re-screenshot. The diff-log records
  the critique loop; keep adding to it.
- Keep photometry physical: lunar-Lambert, relief flattening toward
  Full, shadows only near the terminator, earthshine ∝ Earth’s phase.
- Check all four quarters, plus a crescent near New with the Milky Way
  visible, plus high-contrast and reduced-motion modes, before calling a
  visual change done.
- The surface is seeded. Any change to the bake shaders changes every
  screenshot, so regenerate `media/` in the same change.
- **Never assume a GPU.** Check the three modes in
  `docs/notes.md#machines-without-a-gpu` (GPU, `?q=lite` or SwiftShader,
  WebGL disabled). Anything that reads the renderer must tolerate
  `renderer === null` (text mode) and an unfinished compile
  (`renderer.sceneProg` is null until `bakeStep()` collects it).

## See also

- [`README.md`](./README.md) — user-facing overview.
- [`docs/diff-log.md`](./docs/diff-log.md) — the story of the port.
- [`docs/architecture.md`](./docs/architecture.md) — how the pieces fit.

---

_The upstream `CLAUDE.md` only pointed to the file above._
