# ADR-011: The Quality Ladder — High, Low, Text; Playable Without a GPU

- **Status:** Accepted
- **Date:** 2026-09-24
- **Deciders:** Agun Wijaya (repo owner), implemented with Claude
- **Scope:** Port-level (`battlestar/ports/fancy-web`)

## Context

The brief asks for 60 fps, Low/High quality settings, and (repository
practice, see the owner's no-GPU testing rule) a port that still works
on machines where the browser renders WebGL on the CPU (SwiftShader,
WARP, llvmpipe) or has no WebGL at all. battlestar is a text adventure:
the scene is an illustration of the room, so a slower frame rate is
acceptable, but a frozen or blank page is not.

The first measurement on SwiftShader (headless Chromium, 1440 × 900)
gave 12–25 fps in most biomes and **2 fps in the rainforest**. Profiling
by hiding parts of the scene showed where the time went: layers of
alpha-tested leaf cards (4 → 25 fps when hidden) and per-pixel
image-based lighting (+50 % when removed).

## Options Considered

### Option A — One quality, let slow machines be slow

**Description:** Ship High only.

**Pros:**
- One look to maintain.

**Cons:**
- 2 fps in the forest on a CPU renderer: input feels broken.

**Suitable when:** the audience is known to have GPUs.

### Option B — A ladder chosen automatically, overridable (chosen)

**Description:**

| Rung | When | What changes |
|---|---|---|
| **High** | a hardware WebGL 2 renderer | 1.75× pixel ratio cap, MSAA ×4, bloom, image-based light, leaf-card foliage, shadows |
| **Low** | chosen automatically when the renderer string is a software rasteriser; or picked in Settings | 0.85× pixel ratio (0.6× on a software renderer), no MSAA or bloom, no shadows, **opaque lumpy crowns instead of leaf cards**, a third of the ground cover, no light shafts or vines; on a software renderer also no image-based light (the ambient is lifted instead) |
| **Text** | no WebGL 2 (or the renderer fails to start) | the scene panel shows the room name large; everything else — console, side panel, map, hints, Override, saves, sound — works |

`?q=high|low` forces a rung for testing.

**Pros:**
- Measured: CPU-only rendering runs 15–60 fps in every biome (forest
  2 → 15 fps), see the README.
- The game never depends on the scene: Text mode is complete.

**Cons:**
- Low's forest is stylised (blob crowns) rather than a thinner copy of
  High.

**Suitable when:** a showcase must still be a playable game everywhere.

### Option C — Adaptive resolution only

**Description:** Keep High's content and drop the render scale until the
frame rate recovers.

**Pros:**
- One look.

**Cons:**
- The forest's cost is overdraw per covered pixel; at a render scale low
  enough to fix it (≈0.3×) the picture is mush.

**Suitable when:** cost is resolution-bound rather than overdraw-bound.

## Decision

**We chose Option B.** Detection is `probeGL()` in `src/render/stage.js`
(the unmasked renderer string); the choice is shown in Settings with
the renderer name and the live frame rate.

## Consequences

### Positive
- Every machine gets a playable game; the test suite checks Text mode
  in a browser with WebGL disabled (`npm run smoke`).

### Negative / Risks
- Low diverges visually from High in the forest; screenshots for both
  are in `media/` (`10-forest-day.png`, `17-no-gpu-low.png`).

### Follow-ups
- An automatic mid-game drop from High to Low when a hardware GPU is
  simply slow (not done: no such machine was available to tune on).

## References
- `src/render/stage.js` (`probeGL`, `resize`, `applyLights`),
  `src/render/flora.js` (`broadleaf` crowns), `src/render/kits/forest.js`.
- `scripts/perf.mjs` — the frame-rate survey behind the numbers.
