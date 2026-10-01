# ADR-001: Tech Stack — TypeScript + React + @react-three/fiber (Three.js)

> **Inherited from `fancy-web`.** This ADR was copied with the code
> when the remaster was made (2026-09-25,
> [ADR-003](./003-remaster-scope.md)). Its decision applies to this
> port unchanged; where it says `fancy-web`, read "`fancy-web` and
> this remaster".

- **Status:** Accepted (revised 2026-09-17 — pivoted from
  react-konva to @react-three/fiber)
- **Original Date:** 2026-09-17 (morning)
- **Revision Date:** 2026-09-17 (afternoon)
- **Deciders:** Agun Wijaya (port author)
- **Scope:** Port-level — applies only to
  `bsdgames/robots/ports/fancy-web/`.

## Revision Note (2026-09-17, afternoon)

This ADR was originally accepted the same morning with
**React + react-konva (Canvas 2D)** as the chosen stack. After
scoping the visual direction (isometric, Monument Valley
reference) and researching available free assets, we
pivoted.

**Reason for pivot:**

1. **Kenney.nl's free asset catalog** — the assumed source of
   isometric character sprites — doesn't offer a coherent
   combination of isometric tiles + isometric robots + isometric
   player in a consistent style. The `Robot Pack` is 2D pixel
   art (side-scroller, not isometric); the isometric packs are
   environmental-only with no characters. Mixing packs would
   produce style clashes.
2. **Procedural 3D with orthographic camera** produces a genuine
   isometric look (Monument Valley, Into the Breach, Mini Metro
   are all built this way) without external assets. All geometry
   is code — no PNGs, no download drama, no style bleed.
3. **Real-time lighting** in 3D delivers visual polish for free.
   Soft shadows, highlights, ambient occlusion via material
   properties — all impossible or expensive to hand-tween in
   Canvas 2D.
4. **Animation in 3D is more expressive** — rotation, tilt,
   bounce, camera drift feel natural. In 2D they read as
   affectations.

The **game logic files remain unchanged** by this pivot
(`state.ts`, `grid.ts`, `rng.ts`, `tests/grid.test.ts`). Only
`Game.tsx`, `package.json`, and this ADR are affected.

## Context

Per
[ADR-006 (multi-port architecture)](../../../../../../docs/decisions/006-multi-port-architecture.md),
each port picks its own stack. This ADR records the choice for
the `robots` `fancy-web` port.

Target profile for this port:

- **Aesthetic:** Fancy — sprite art, smooth animations, sound
  effects, polished UI. Deliberately breaks from the retro
  terminal look that the `classic-web` port will use.
- **Visual reference:** Monument Valley, Into the Breach, Mini
  Metro. Isometric perspective, palette-driven, modernist-clean,
  geometric.
- **Platform:** Web (browser + PWA installable). Mobile via
  responsive layout + touch mapping. Capacitor Android path stays
  open — Forward-Compatibility Rules from
  [ADR-005](../../../../../../docs/decisions/005-target-language-and-ui-stack.md)
  apply here voluntarily.
- **Mechanics:** Faithful to
  [`../../../docs/spec.md`](../../../docs/spec.md) — 60×22 grid,
  turn-based, robots move toward player, collisions leave piles,
  teleport limited per level.
- **Multiplayer:** N/A (`robots` is single-player).
- **Persistence:** `localStorage` for high scores.

## Options Considered

### Option A — React + react-konva + Vite (originally chosen; superseded)

Canvas 2D via `react-konva`. Fast dev, ecosystem-rich. Rejected
after pivot because achieving a cohesive isometric visual with
real-time lighting requires hand-tweening depth/shadow/highlight
per sprite, and free isometric asset packs don't cover our need.
See "Revision Note" above.

### Option B — Svelte 5 + Konva

Smaller bundle but weaker Konva binding and smaller ecosystem.
Rejected before the pivot; still rejected after — smaller
ecosystem hurts more, not less, when moving to 3D.

### Option C — Phaser 3

2D game engine. Rich features. Rejected because most of Phaser's
2D-oriented power (Arcade physics, tweens, scenes) doesn't apply
to a 3D isometric approach.

### Option D — Vanilla TypeScript + Canvas API

Minimalist manual Canvas. Rejected: fancy-web is about polish,
not minimalism. Right choice for `classic-web`, wrong choice
here.

### Option E — React + @react-three/fiber + Three.js (chosen)

**Description:** Full 3D scene rendered via WebGL through
Three.js, wrapped in React components via
`@react-three/fiber` (R3F). Orthographic camera at ~30° angle
produces genuine isometric perspective. All geometry procedural —
box meshes for tiles, grouped meshes for robot/player/pile
sprites. Real-time lighting (ambient + directional) adds depth
and polish without hand-tweening. `@react-three/drei` provides
common R3F helpers (OrthographicCamera, Environment, etc.).

**Pros:**

- **Isometric look without pre-rendered assets.** Orthographic
  camera + procedural boxes gives Monument Valley aesthetic
  natively.
- **Real-time lighting = polish for free.** Soft shadows,
  volumetric feel, highlights — all from material properties, no
  hand-tuning per sprite.
- **Animation is 3D-native.** Rotation, tilt, bounce, camera
  drift feel intuitive and expressive.
- **Zero external assets.** Bundle contains no PNGs, no sprite
  atlases. All visuals emerge from code + palette.
- **Style consistency guaranteed.** No pack-mixing, no asset-drift
  risk over time.
- **R3F is React-idiomatic.** Components, hooks, refs work
  familiarly. State management is React's problem, rendering is
  R3F's.
- **Three.js is battle-tested.** Used by NASA, Google Earth Web,
  A-Frame VR, thousands of shipped titles.
- **Path to fancier polish stays open.** Post-processing effects
  (bloom, DoF, chromatic aberration) via
  `@react-three/postprocessing` — trivial to add later.

**Cons:**

- **Bundle larger than 2D:** three (~150 KB gzipped) + R3F
  (~10 KB) + drei (~30 KB tree-shaken) ≈ 190 KB gzipped before
  app code. Still well under Forward-Compatibility Rule 3
  (≤ 500 KB gzipped per route), but not free.
- **Learning curve:** 3D concepts (cameras, lights, materials,
  vectors) require a mental model beyond 2D Canvas. Mitigated by
  R3F's React-native API and the excellent R3F docs.
- **Mobile GPU cost:** WebGL on low-end Android phones can be
  slower than 2D Canvas. Mitigation: keep scene simple (few
  hundred meshes for the whole 60×22 grid), avoid overdraw, no
  post-processing on mobile by default.
- **Test infra:** R3F components need a Canvas mock in Vitest.
  `@react-three/test-renderer` exists but adds complexity;
  Vitest can also skip rendering tests and cover game logic
  (which lives outside R3F anyway).

## Decision

**Option E — React + @react-three/fiber + Three.js.**

The trade-off is deliberate: for a fancy-styled isometric game
where visuals must "carry" the fun, a 3D rendering pipeline pays
off far more than a 2D Canvas one. Bundle cost is real but well
within budget. The learning curve is mitigated by R3F's
React-idiomatic API. Style consistency and lighting-for-free
alone justify the choice; the animation expressiveness is bonus.

## Consequences

### Positive

- **Monument Valley aesthetic achievable directly** — orthographic
  camera + palette + geometric shapes = the look.
- **No asset dependency chain.** The port ships whatever code we
  write, nothing more.
- **Lighting/shadow/highlight from material properties, not from
  hand-drawn assets.** Adjustments require touching one file, not
  regenerating a sprite atlas.
- **Animation library-ready** — `@react-spring/three`,
  `framer-motion-3d` both work with R3F for higher-level animation
  primitives when we get there.
- **Path to fancier effects preserved** — bloom, motion blur,
  chromatic aberration, particle systems all available.

### Negative / Risks

- **Bundle discipline required.** Three.js is not tree-shakeable
  in the traditional sense; whole modules get pulled in. Ship
  in strict production mode, verify final gzip size ≤ 500 KB per
  Forward-Compatibility Rule 3.
- **Mobile GPU performance** must be verified on real devices
  before marking Released. Add a low-quality fallback (disable
  shadows, reduce ambient occlusion) if needed.
- **Test approach revised** — game logic tests (Grid, RNG, engine)
  still trivially runnable via Vitest. Rendering tests either use
  `@react-three/test-renderer` (heavy) or are treated as visual
  smoke tests (manual, per Forward-Compatibility Rule 6).
- **Contributors familiar with 2D Canvas** will need to learn R3F
  before touching `src/Game.tsx` and successors.

### Follow-on Work

- **This batch (Phase 1 revised):** Swap `react-konva` → R3F in
  `package.json`, rewrite `src/Game.tsx` as R3F walking skeleton
  showing an empty isometric grid.
- **Phase 2:** Game state model, engine (init, move, AI,
  collision, teleport, wait), keyboard input, place player/robot/
  pile procedural meshes on the grid. Verify canonical
  `test-scenarios.md` passes.
- **Phase 3:** Visual polish — lighting tuning, particle effects
  (explosion on collision, teleport shimmer), camera drift,
  ambient stars, sound (procedural via Tone.js or CC0 samples),
  menu screens, HUD, high-score screen.
- **Phase 4:** PWA manifest, deploy pipeline, media capture,
  mobile performance verification on real device (per
  Forward-Compatibility Rule 6), mark port Released.

## References

- [ADR-005 — Reference Language & UI Stack](../../../../../../docs/decisions/005-target-language-and-ui-stack.md)
  — Forward-Compatibility Rules voluntarily followed.
- [ADR-006 — Multi-port Architecture](../../../../../../docs/decisions/006-multi-port-architecture.md).
- [Three.js docs](https://threejs.org/)
- [@react-three/fiber docs](https://docs.pmnd.rs/react-three-fiber)
- [@react-three/drei docs](https://github.com/pmndrs/drei)
- Visual references: Monument Valley (ustwo games, 2014), Into
  the Breach (Subset Games, 2018), Mini Metro (Dinosaur Polo
  Club, 2015). Not citations; design analogs.
