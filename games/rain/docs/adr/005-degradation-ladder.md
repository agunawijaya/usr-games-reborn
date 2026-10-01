# ADR-005: Degradation Ladder — High, Low, Lite, Classic

- **Status:** Accepted
- **Date:** 2026-09-24
- **Deciders:** Agun Wijaya (repo owner), implemented with Claude
- **Scope:** Port-level (`rain/ports/fancy-web`)

## Context

The brief asks for 60 fps with a Low/High toggle. A screensaver also has
to run on machines without a usable GPU — office desktops over remote
desktop, virtual machines, locked-down laptops — where the browser falls
back to a software rasteriser (SwiftShader, WARP, llvmpipe) or disables
WebGL altogether. The first measurement on SwiftShader, with the scene
evaluating the whole sky once per pixel and again for its reflection,
was 10 fps.

## Options Considered

### Option A — One quality, and a "sorry" page without WebGL

**Cons:** unusable on half the machines a screensaver meets.

### Option B — A ladder of profiles, chosen automatically (chosen)

| Rung | When | What changes |
|---|---|---|
| **High** | a GPU | full-resolution scene, 473 × 984 wave grid, 6-octave clouds, 5-level bloom, sky rendered analytically, reflections from a 1024 × 384 environment map redrawn every frame |
| **Low** | the Q key, or High measured under 40 fps in the first seconds | scene at half resolution, 251 × 499 grid, 4 octaves, 3-level bloom, the visible sky also read from the environment map (redrawn every 3rd frame, except around the moon), half the streaks |
| **Lite** | a software rasteriser (renderer string matches `swiftshader`, `llvmpipe`, `warp`, …) | as Low, but the canvas itself at half size, 3 octaves, no bloom, 30 % of the streaks, environment map every 4th frame |
| **Classic** | no WebGL2, or no float render targets | the 80 × 24 text screen only; sound still works |

### Option C — An 8-bit fallback for GPUs without float targets

**Description:** encode the height field in RGBA8.
**Cons:** every WebGL2 implementation we could test has half-float or
float targets; the path would be untested code. Dropped in favour of the
classic view, which is honest and exact.

## Decision

**Option B.** Two optimisations made it work on every rung:

1. **The environment map.** The sky, clouds, far bank and mist band are
   rendered once into a computed texture (azimuth × √height) with the
   same GLSL; reflections sample it. This halved the cost of a water
   pixel. It is a render target written by shaders — allowed by ADR-002.
2. **Precomputed lamp azimuths** (uniforms), instead of an `atan` per
   lamp per pixel.

The Q key switches between High and "Low", which means Lite on a
software rasteriser. The automatic drop to Low happens once, early, and
says so; a quality in the URL (`?q=`) turns it off.

## Consequences

Measured on this machine (see the README for the table and how to repeat
it with `npm run measure`): High 60 fps on a GPU; Lite ≈ 25 fps on
SwiftShader; Classic at display rate with no GPU at all.

## References

- Sibling `pom/ports/fancy-web` (same software-renderer detection).
- `scripts/measure.mjs`, `scripts/ui-smoke.mjs` (P-07, P-11).
