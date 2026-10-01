# ADR-001: Tech Stack — Vanilla ES Modules + Vendored Three.js, Zero Build

- **Status:** Accepted
- **Date:** 2026-09-24
- **Deciders:** Agun Wijaya (repo owner), implemented with Claude
- **Scope:** Port-level (`battlestar/ports/fancy-web`)

## Context

*Battlestar — Pajamas to Paradise* has two very different halves:

1. A **text-adventure engine** that must be faithful to the 1984 C
   program down to the byte (it is golden-tested against the real
   binary), run headless under `node --test`, and later be usable in a
   Worker or on a server.
2. A **showcase renderer**: five biomes of procedural 3D scenes (a
   battlestar interior, deep space, a tropical coast with surf, a
   rainforest, catacombs and crystal caves), a 3D cockpit dogfight,
   day/night lighting, particles and post-processing, all generated
   from code ([ADR-002](./002-zero-raster-assets.md)).

The house style for showcase `fancy-web` ports is vanilla ES modules,
zero build and `node --test` (atc, trek, pom, rain, worms, sail). The
closest sibling in scope, `sail/ports/fancy-web`, vendors Three.js r186.

## Options Considered

### Option A — Raw WebGL2

**Description:** Hand-written buffers, shaders, matrices and render
passes, as the `pom`, `rain` and `worms` ports do.

**Pros:**
- No third-party code; every line is about this game.
- Smallest payload.

**Cons:**
- Those ports draw *one* scene (a moon, a pond, a sea floor). This port
  needs a scene graph for hundreds of props, five biomes, instancing,
  lights, picking-free camera moves, render targets for transitions —
  weeks of plumbing before the first palm tree.
- Harder for a reader to find the game in the GL.

**Suitable when:** the renderer draws one bespoke effect.

### Option B — Three.js r186 vendored as ES modules, zero build (chosen)

**Description:** Copy `three.module.js` + `three.core.js` (MIT) into
`src/vendor/`, load them through an import map, write every material as
a `ShaderMaterial`/`onBeforeCompile` GLSL and every mesh from
procedural geometry.

**Pros:**
- Scene graph, instancing, lights, render targets and tone mapping are
  solved; the code is about corridors, palms and caves.
- Same version and layout as `sail`, so the two Riggle ports read alike
  (Riggle also wrote `sail`).
- Zero build: any static server runs it; `npm test` needs only Node.
- Custom GLSL stays first-class, so the zero-raster rule is natural.

**Cons:**
- ~2.1 MB of vendored JavaScript (uncompressed).
- No tree shaking without a bundler.

**Suitable when:** a showcase needs real 3D without owning a renderer.

### Option C — Babylon.js / PlayCanvas

**Description:** A heavier engine with editors, stock materials and
particle systems.

**Pros:**
- More built in (GUI, particles, physics).

**Cons:**
- Stock materials and particle textures pull in assets or hide the
  "from code" story; larger payload; diverges from the sibling ports.

**Suitable when:** building a large game with an editor workflow.

### Option D — Vite + TypeScript + Three.js from npm

**Description:** The `canfield` approach with a build step.

**Pros:**
- Types, tree shaking, hot reload.

**Cons:**
- `npm install` and a build before anyone can play; breaks the
  zero-build convention of the showcase ports.
- The engine is a literal translation of C; types add little there.

**Suitable when:** a large, multi-author, UI-heavy port.

## Decision

**We chose Option B.** The engine (`src/engine/`) imports nothing from
Three.js or the DOM and is tested in Node. Only `src/render/`,
`src/ui/` and `src/audio/` touch the browser. Three.js removes the
renderer plumbing so the effort goes into what is specific to this
game: a scene composer that reads the engine's room state, five biome
kits, and a cockpit that draws `fly.c`'s grid in 3D.

## Consequences

### Positive
- `npm test` runs the whole engine, the golden transcripts, the
  planner and the scene composer's room specs with plain Node 18+.
- Opening `index.html` through `npm start` is enough to play.

### Negative / Risks
- The vendored files must be updated by hand (copy the two files from
  the `three` npm package; `package.json` records the version).
- WebGL is required for the scene; without it the page falls back to
  the text-only layout (see the README "Requirements" section).

## References
- Three.js r186, MIT — `src/vendor/THREE-LICENSE`.
- Sibling: `sail/ports/fancy-web/docs/decisions/001-tech-stack.md`.
