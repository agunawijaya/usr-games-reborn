# ADR-003: Time, Grid and Live Flag Changes

- **Status:** Accepted
- **Date:** 2026-09-24
- **Deciders:** Agun Wijaya (repo owner, via port brief), Claude Opus
- **Scope:** Port-level (`worms` / `fancy-web`) — deviations from
  [`spec.md`](../../../../docs/spec.md) in *presentation*, not in the
  movement rules

## Context

The engine is faithful to `worms.c`: the same boundary tables, the same
one-cell steps, ring-buffer bodies, reference-counted cells and
`random() % nopts` choices. The brief also asks for three things the
original never had to answer:

1. **Smooth motion.** The terminal jumps one character per step. The
   brief wants organic motion that is “never jumpy”.
2. **A screen.** `COLS × LINES` came from the terminal. A browser has a
   resizable viewport of pixels.
3. **Live settings.** The original reads flags once at start. The brief
   asks for a settings panel with live changes.

The original also has a timing quirk: without `-d` the loop does not
sleep at all (`worms.c:297`), so the speed was set by the terminal’s
baud rate. And `-d 0` given explicitly is **rejected**
(`worms.c:212`: `< 1`), which was confirmed on a binary built from the
original source.

## Options Considered

### 1. Motion between steps

- **A. Discrete steps** (draw the grid state as is). Faithful, but
  exactly the “jumpy” look the brief rules out.
- **B. Physics-based bodies** (springs following the grid head).
  Smooth, but the body would no longer be the grid state: overlaps and
  the ref-count glow would lie.
- **C. Render one step behind and slide along the path (chosen).** Keep
  the previous and current ring buffers. The path of cells from the old
  tail to the new head is `length + 1` cells long. Draw the body as the
  window `[f, f + length − 1]` along a spline through that path, where
  `f ∈ [0, 1)` is the fraction of the current step. At `f = 0` and
  `f = 1` the drawing is *exactly* the grid state; in between it glides.
  The cost is one step (tens of milliseconds) of latency.

### 2. Speed, the meaning of `-d`

- **A. `-d` in ms per step, default as fast as possible.** Unwatchable
  on a 144 Hz monitor.
- **B. `-d` in ms per step, default emulating the terminal (chosen).**
  `-d N` (1–1000) is exactly N ms per step. With no `-d`, the port
  emulates a 9600-baud terminal: a step costs roughly `12 × number`
  bytes of curses output (move + character, twice per worm), so the
  default is **`max(33 ms, number × 12.5 ms)`** per step. More worms move
  more slowly, just as they did on the real terminal. The settings
  panel shows this as “terminal speed”.

### 3. Screen size

- **A. Fixed 80×24.** Tiny cells on a big monitor, or huge ones.
- **B. Grid from the viewport (chosen).** `COLS × LINES` =
  `floor(width / cell) × floor(height / cell)` with a cell of ~14 CSS px
  (adjustable). The engine gets the numbers exactly as curses did.
  Resizing the window is like opening a new terminal: the world
  restarts, debounced.

### 4. Live flag changes

- **A. Restart on every change.** Simple, but jarring for a screensaver.
- **B. Apply in place, reusing the original operations (chosen):**
  - `-n` up: new worms are appended with `xpos = ypos = −1`, so they
    enter from `(0, bottom)` exactly as at start-up (`worms.c:304-309`).
    `-n` down: removed worms release their cells through the normal
    ref-count path (`--ref == 0` ⇒ the trail character is written).
  - `-l` down: the oldest segments are released the same way. `-l` up:
    the ring is extended with `−1` slots behind the tail, so the worm
    grows as it moves (the original’s warm-up behaviour).
  - `-d`: takes effect on the next step.
  - `-t`: changes the character written on future erasures. Turning it
    off also clears existing dots.
  - `-f`: turning it on refills every free cell with the `"WORM"`
    pattern of `worms.c:279-290`; turning it off clears the field.
  - **Restart** always re-creates the world as a fresh launch with the
    current flags.

### 5. Randomness

- **A. `Math.random()`.** Not reproducible.
- **B. A faithful `random()` (chosen).** The engine implements glibc’s
  `random()` (additive feedback, TYPE_3). The original never calls
  `srandom()`, so glibc seeds it with 1. With the default seed 1 and the
  same `COLS × LINES`, the port reproduces the original binary
  **cell for cell**. That is the basis of the golden tests. Any other
  seed is available for variety (`?seed=`).

### 6. How `-t` and `-f` look in the modern view

- **A. Literal:** draw dots and letters as glyphs in the abyss.
  Faithful, but a field of ASCII dots contradicts the organic scene.
- **B. Reinterpret, keep the literal version one click away (chosen).**
  The *engine* writes exactly the original characters (`.` on erasure,
  the `"WORM"` field) and the classic view shows them. The modern view
  draws `-t` as a luminous slime trail that fades over ~10 s, leaving a
  faint residue, and `-f` as breathing plankton glyphs that disappear
  where the screen buffer no longer holds a field letter.

## Decision

**1C, 2B, 3B, 4B, 5B, 6B.** The movement rules are untouched. These choices
only define *when* a step happens, *how big* the screen is, and how
*live* edits map onto the original’s own operations.

## Consequences

### Positive

- The grid state is always recoverable at step boundaries, so the
  classic ASCII view and the modern view never disagree.
- Golden tests can compare whole screens with the original binary.
- `?args=-n 5 -l 32 -d 50 -f` runs the original command line, through a
  faithful `getopt` port with the original error messages.

### Negative / Risks

- One step of display latency (invisible in a screensaver).
- Live `-n`/`-l` changes produce states the original could only reach
  by restarting, although each individual cell operation is one the
  original performs.
- The default speed depends on `-n` (as it did on a real terminal),
  which may surprise users. The panel labels it.

## References

- `worms.c:209-238` (flag parsing), `worms.c:279-290` (field),
  `worms.c:291-341` (main loop). Upstream:
  <https://github.com/vattam/BSDGames/blob/master/worms/worms.c>
- glibc `random_r.c` (TYPE_3 additive feedback generator).
