# ADR 001 — Tech Stack: Reused Engine + Vendored Three.js + Custom GLSL, Zero Build

- **Status:** Accepted
- **Date:** 2026-09-24
- **Deciders:** Agun Wijaya (owner), Claude Opus
- **Scope:** `bsdgames/trek/ports/procedural-web/` only

## Context

`procedural-web` is a **head-to-head comparison port**. Its sibling
[`../../../fancy-web/`](../../../fancy-web/) draws `trek` with painted
PNG/JPG/SVG assets on Canvas 2D. This port must play *identically* and
draw *everything* from code: geometry, GLSL, procedural noise, runtime
canvas and Web Audio (see [ADR 002](./002-zero-raster-assets.md)).

Two separate choices have to be made:

1. **How the game logic is obtained.** The comparison is only fair if the
   mechanics are the same, turn for turn and random number for random
   number.
2. **How the pictures are made.** The visual brief is art-director level:
   volumetric-looking nebulae, lit 3D ships with panelling and emissive
   windows, shader stars with corona and limb darkening, beams with heat
   shimmer, hex-ripple shields, multi-stage explosions, a holographic
   galaxy chart, all at 60 fps with a Low/High quality switch.

The sibling port is vanilla ES modules with no build step. The repo's
root [ADR-005](../../../../../../docs/decisions/005-target-language-and-ui-stack.md)
only binds `classic-web` ports, and
[ADR-006](../../../../../../docs/decisions/006-multi-port-architecture.md)
lets every other port pick its own stack.

## Options Considered

### Part 1 — Game logic

#### Option 1A — Re-implement the engine from `spec.md`

**Pros:** clean slate; could follow the canonical spec more literally
(BSD `trek` has 23 commands, the sibling port implements 13).
**Cons:** the comparison stops being purely visual. Any rule, RNG-order
or balance difference would make "same seed, same commands" produce
different quadrants, so side-by-side screenshots would show different
games. Doubles the test burden.
**Rejected** — defeats the purpose of a head-to-head port.

#### Option 1B — Import the sibling's modules at runtime (`../fancy-web/src/*.js`)

**Pros:** zero duplication; any engine fix lands in both ports at once.
**Cons:** the port is no longer self-contained, which the brief forbids
and which ADR-006 discourages (each port is a deployable unit). A
refactor in `fancy-web` could silently break this port. The Captain's
Override needs engine flags, which cannot be added to a read-only
sibling.
**Rejected.**

#### Option 1C — Copy the engine layer verbatim, then extend it behind flags (chosen)

Copy `galaxy.js`, `engine.js`, `parser.js`, `hints.js` and the engine,
parser, hints, autoplay and shortcut tests byte-for-byte from
`fancy-web` (commit `fbe3bb0`), prove they pass unchanged, and only then
add code.

**Pros:** identical mechanics by construction; the port stays
self-contained; the copied tests are the parity contract.
**Cons:** two copies of the engine can drift. Mitigated by:
- `galaxy.js`, `parser.js`, `hints.js` are kept **byte-identical** to the
  sibling and a test pins their SHA-256 against a frozen fixture copy.
- `engine.js` is the only engine file that changes, and only to add the
  Captain's Override flags. A seeded regression test replays long
  command sequences through a frozen copy of the original engine
  (`tests/fixtures/baseline/`) and through this port's engine with every
  flag off, and requires the full game state and every returned effect
  to be identical at every step.

### Part 2 — Rendering

#### Option 2A — Canvas 2D, procedural (the sibling's own fallback path, pushed further)

**Pros:** zero dependencies; runs everywhere; same tech as the sibling.
**Cons:** no depth, no real lighting, no per-pixel shaders. Nebulae
would be stacked radial gradients; ships would be flat vector art. The
brief asks for volumetric nebulae, limb darkening, heat shimmer and
lit hull panelling. Canvas 2D cannot beat painted art at this.
**Rejected** — not able to meet the visual target.

#### Option 2B — Raw WebGL2 (as in the `pom`, `rain` and `worms` ports)

**Pros:** no library; total control; tiny payload.
**Cons:** those ports draw one or two full-screen shaders. This port
needs a scene graph (six ship classes built from dozens of parts, a
starbase with a rotating ring, instanced debris, particles), perspective
cameras, raycasting for the clickable chart, PBR-style lighting with
several point lights, environment reflections and MSAA render targets.
Writing that from scratch would be most of the project.
**Rejected** — too much plumbing for the time budget.

#### Option 2C — Three.js r186, vendored as an ES module, custom GLSL everywhere that matters (chosen)

`src/vendor/three.module.js` + `three.core.js` (MIT, licence file
alongside), imported through an import map. No `examples/jsm` addons:
bloom, tone mapping, heat shimmer, lens flare and the warp tunnel are
this port's own post-processing passes (`src/render/post.js`).

**Pros:** scene graph, lights, `MeshStandardMaterial`, PMREM environment
maps, instancing, raycasting and render targets for free; every visual
that defines the look (nebula, star, shields, beams, fire, chart) is
still hand-written GLSL. Same pattern as the `sail` port, so the repo
already has a precedent. No build step.
**Cons:** ~2.1 MB of unminified library (≈ 420 KB gzipped) versus a few
KB of engine. Three.js's own shader chunks are an abstraction a learner
has to see through.

#### Option 2D — Three.js via npm + Vite

**Pros:** tree shaking, minification, hot reload.
**Cons:** introduces a build step the sibling does not have, so the
comparison would also compare toolchains. `npm install` becomes a
prerequisite for opening the page.
**Rejected** — keep the toolchain identical to the sibling.

#### Option 2E — Babylon.js / PlayCanvas

**Pros:** built-in post stacks, particle editors.
**Cons:** larger, and their built-in effects (particle textures, flare
textures, default env maps) often ship raster assets, which ADR 002
forbids.
**Rejected.**

## Decision

**1C + 2C.** The engine layer is copied verbatim and extended only behind
explicit, default-off override flags; the renderer is vanilla ES modules
on a vendored Three.js r186 with hand-written GLSL and a custom
post-processing chain. No bundler, no framework, no build step. A tiny
Node static server (`scripts/serve.mjs`) exists because browsers refuse
ES modules from `file://` URLs.

### Module map

```
index.html            DOM shell + CSS HUD (layout mirrors fancy-web)
src/galaxy.js         ┐
src/parser.js         │ byte-identical copies of fancy-web
src/hints.js          ┘
src/engine.js         fancy-web engine + Captain's Override flags
src/override.js       `override` command grammar + flag metadata
src/main.js           DOM, input, HUD, effect sequencing
src/audio.js          Web Audio synthesis
src/render/*.js       Three.js scene, GLSL, post-processing, chart
src/fallback2d.js     Canvas 2D renderer when WebGL is unavailable
src/vendor/           three.module.js, three.core.js, THREE-LICENSE
```

## Consequences

**Positive**

- Same seed + same keystrokes ⇒ same game in both ports; the comparison
  screenshots show the same quadrant, the same Klingons, the same shot.
- The engine stays testable in Node (`node --test`) with no DOM and no
  Three.js.
- Visual code is readable top to bottom: no generated bundles.

**Negative / risks**

- The vendored library is large for a zero-build page. Accepted: it is
  fetched once and cached, and it is still far lighter than the
  sibling's painted assets (≈ 16.6 MB of images loaded at start).
- The engine copy can drift from `fancy-web`. The SHA-256 pin and the
  baseline regression test turn drift into a test failure.
- Three.js upgrades are manual (replace two files, re-run the visual
  checks).

## See also

- [ADR 002 — Zero raster assets](./002-zero-raster-assets.md)
- [`../diff-log.md`](../diff-log.md) — the reuse decision in narrative form
- Sibling: [`fancy-web` ADR 001](../../../fancy-web/docs/decisions/001-tech-stack.md)
- Precedent: `sail/ports/fancy-web` (vendored Three.js, own post chain)
