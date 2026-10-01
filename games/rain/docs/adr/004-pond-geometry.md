# ADR-004: The Pond — a Log-Polar Wave Grid, and Where the Terminal Lies on the Water

- **Status:** Accepted
- **Date:** 2026-09-24
- **Deciders:** Agun Wijaya (repo owner), implemented with Claude
- **Scope:** Port-level (`rain/ports/fancy-web`)

## Context

The camera stands 0.9 m above a pond and looks out at a low angle, the
horizon a third of the way down the frame (`src/render/geometry.js`). The
ripples come from a wave-equation simulation on the GPU (ADR-003). Two
questions follow:

1. **What grid does the simulation run on?** In a low-angle view, a metre
   of water near the camera covers hundreds of pixels; a metre at 20 m
   covers a few. A uniform grid spends texels where the picture has no
   pixels, and has too few where it has many.
2. **Where does the terminal go?** The original drops fall on the
   80 × 24 screen's bordered area (columns 2 … COLS−3, rows 2 … LINES−3,
   `rain.c:101-102, 118-119`). Every one of them must land somewhere
   visible, and split view should read as the same rain.

## Options Considered

### Option A — A uniform square grid over a world rectangle

**Pros:** the textbook set-up (e.g. Evan Wallace's *WebGL Water*).
**Cons:** 512² over 8 m × 8 m gives 1.6 cm texels — about 11 screen
pixels each at the bottom of the frame (blocky rings) and a small
fraction of a pixel at the far edge (wasted, and aliasing). The rectangle
is a trapezoid on screen: either its far corners are off-screen or its
near corners are.

### Option B — A grid in screen space

**Pros:** texels match pixels.
**Cons:** the grid is not the water: the wave equation on it needs
position-dependent, non-orthogonal metric terms, and rings come out
skewed at the sides.

### Option C — A log-polar grid centred under the camera (chosen)

**Description:** `u` is the azimuth θ, `v` is log(distance). With equal
steps `s` in both, the map is **conformal**: the cells are squares whose
size is `s · r`. The Laplacian of a conformal map is the grid Laplacian
times 1/(s r)², so the wave step stays the plain five-point stencil with
a per-row scale (`src/render/shaders/sim.js`). Texel size grows with
distance exactly as the perspective's pixel footprint does across the
frame.

| | High | Low / Lite |
|---|---|---|
| cell `s` | 0.0029 rad | 0.0059 rad |
| grid (16:9) | 473 × 984 | 251 × 499 |
| texel at 2 m / 20 m | 6 mm / 6 cm | 12 mm / 12 cm |
| sub-steps per frame (CFL ≤ 0.5 at the nearest row) | 3 | 2 |

The grid runs from 0.85 × the nearest visible distance (1.4 m) to 24 m,
and a little wider than the frame's widest azimuth. A 14-texel sponge on
every side absorbs waves before they reflect.

**Pros:** fine rings near the camera, no wasted texels far away, no
skew, and the simplest possible shader.
**Cons:** the far rows are still denser than the picture needs
vertically (the grazing view compresses them); the scene shader averages
the slope over each pixel's footprint there instead of aliasing.

## Decision

**Option C**, and the terminal is laid over the visible water like a
screen tilted back onto it:

- **columns → azimuth**, evenly, across 94 % of the frame's width at the
  far row (a circle of constant distance droops towards the frame's
  corners, so the near row is narrower on screen — it is all visible);
- **rows → distance**, top row far (16 m), bottom row near (just above
  the frame's bottom corners, ≈ 2.4 m at 16:9), spaced logarithmically
  like the grid.

A drop's world position is its cell plus a fixed offset inside the cell
(a hash of the frame it was born in), so it keeps one spot for all six
ages and the drops of a downpour do not line up in rows. The classic
view is the same screen, cell for cell.

Because rows are log-spaced, the rain is spread evenly *on screen* more
than per square metre: nearer water gets more drops per m² than far
water, as a view of the terminal would suggest. Per square metre it is
not uniform; per terminal cell it is exactly the original's.

Beyond the terminal's border — the far water above the top row and the
slivers beside the near rows — a statistical field of small rings
(`ambientSlope` in `scene.js`) keeps the pond from ending in a line; its
density follows the delay. It is decoration, listed in the diff log; it
takes nothing from the engine and gives nothing back.

## Consequences

- `tests/geometry.test.js` checks, for six aspect ratios and both grid
  sizes, that every terminal cell (corners and jitter included) projects
  on screen and inside the simulated grid, that the visible bottom edge
  is simulated, and that the time step is stable.
- A window resize can change the grid's width; the simulation is then
  reallocated and the pond starts calm again (it fills within seconds).
- Split view gives the pond half the width: the terminal's azimuth range
  narrows with it, so the same columns still span the pane.

## References

- `src/render/geometry.js`, `src/render/shaders/sim.js`.
- Conformal maps and the Laplacian: any complex-analysis text
  (the log map w = log z).
- `rain.c:101-102, 118-119` (upstream
  <https://github.com/vattam/BSDGames/tree/master/rain>).
