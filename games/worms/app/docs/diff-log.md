# `worms` · fancy-web — Original → Port Diff Log

> What was kept, changed, added and removed, and *why*. The story of
> *Abyssal Worms*.

---

## Legend

- 🟩 **Kept**: identical or near-identical to the original.
- 🟨 **Changed**: same feature, different implementation or UX.
- 🟦 **Added**: new to the port.
- 🟥 **Removed**: the original had it; the port doesn’t.
- 🟪 **Reinterpreted**: original concept, radically different execution.

---

## Feature Log

| # | Feature | Status | Notes |
|--:|---|:---:|---|
| 1 | Boundary orientation tables | 🟩 | All nine tables from `worms.c:72-164`, selected by the same nested ternary (`worms.c:323`). A test proves no reachable state has zero options (`abort()` at `worms.c:325-328` is unreachable). |
| 2 | Movement | 🟩 | One cell per step, `XINC`/`YINC` of `worms.c:170-174`, worms processed in order within a step. |
| 3 | Bodies | 🟩 | Fixed-length ring buffers of positions initialised to −1; start at `(0, bottom)` with orientation 0 (`worms.c:259-271`, `304-309`). |
| 4 | Reference counting | 🟩 | `ref[y][x]`; a tail cell is erased only when its count reaches zero (`worms.c:319-321`). |
| 5 | Randomness | 🟩 | glibc `random()` (TYPE_3) re-implemented; default seed 1 = the original’s unseeded behaviour. Golden screens match the original binary cell for cell. |
| 6 | `-d -f -l -n -t` and their ranges | 🟩 | GNU `getopt`, `strtoul`/`atoi` semantics, identical error text; 31 CLI cases golden-tested. |
| 7 | `-f` field | 🟪 | Same `"WORM"` pattern (`worms.c:279-290`); in the modern view, faint breathing plankton glyphs that stir near light and scatter when eaten. |
| 8 | `-t` trail | 🟪 | Classic view: permanent `.` as in the original. Modern view: a luminous slime trail that cools and fades over ~10 s (brief). A barely visible residue stays. |
| 9 | Flavor characters `O * # $ % 0 @ ~` | 🟪 | Each is a species with its own palette, markings and pulse. The classic view shows the characters. |
| 10 | Display | 🟪 | Curses terminal → WebGL2 deep-sea floor ([ADR-001](./decisions/001-rendering-stack.md)); the classic terminal survives as a view. |
| 11 | Timing | 🟨 | `-d N` is exact. With no `-d`, a 9600-baud terminal is emulated (`max(33, 12.5·n)` ms per step) instead of “as fast as the CPU can go” ([ADR-003](./decisions/003-time-grid-and-live-flags.md)). |
| 12 | Motion | 🟨 | Smooth glide between steps, exactly the grid state at step boundaries ([ADR-003](./decisions/003-time-grid-and-live-flags.md)). |
| 13 | Screen size | 🟨 | `COLS × LINES` from the viewport and a cell size; resizing restarts, like a new terminal. |
| 14 | Live flag changes | 🟦 | Settings panel and command line, applied through the original cell operations ([ADR-003](./decisions/003-time-grid-and-live-flags.md)). |
| 15 | Classic and split views | 🟦 | Same engine state, two renderers, draggable divider. |
| 16 | Light and bloom | 🟦 | Worms light the floor (light map), light each other (sheen), and flare where cells have ref ≥ 2. |
| 17 | Sound | 🟦 | Procedural drone, rumble, bubbles and crossing chimes; muted by default. |
| 18 | Seeds | 🟦 | `?seed=N` or **New seed**; seed 1 is the original’s. |
| 19 | Signals (`SIGINT` etc., `worms.c:273-277`) | 🟥 | There is nothing to interrupt in a browser tab; closing it is the stop gesture. |
| 20 | `setregid`, `malloc` failure paths | 🟥 | Meaningless in a browser. |
| 21 | Tiny screens | 🟨 | The engine requires at least 2×2 cells. On a 1-column terminal the original indexes outside `ref[]` (undefined behaviour). |

---

## Narrative

### 1. The engine, and a binary that turned out to be predictable

The engine was written first, headless. Two facts shaped it.

**`worms` is not in Ubuntu’s `bsdgames` package** (`/usr/games/worm`
is a different game). Like the repo’s own capture script, we built it
from the original `worms.c` with `gcc -lncurses` in WSL.

**The original never calls `srandom()`**, and glibc then behaves as if
seeded with 1. So for a given terminal size, the original animation is
*always the same*. The canonical `spec.md` said the opposite; that has
been corrected. With a JavaScript port of glibc’s `random()` (checked
against `libc.so.6` via Python `ctypes` for several seeds, including
one above 2³¹ that exposed an `int32_t` detail), the port can be
compared with the real program screen for screen. Seven configurations
(80×24 … 23×7, with `-f`, `-t`, 20 worms of 64, 12 worms of 3) were run
in `tmux` and captured four times each. Every capture matches the port
at **exactly one** step with **zero** differing cells; neighbouring
steps differ by 3–45 cells.

One oddity: some captures matched at step 87–90 when `-d 150` over
11.7 s allows at most 78. The capture timing was verified to ±10 ms, so
the binary really ran faster than its delay under WSL/tmux. Its
`usleep()` probably woke early from ncurses’ `SIGWINCH` handling. The
tests therefore *search* for the step instead of predicting it from
time.

The arguments were golden-tested too. `-d 0` is *rejected*: the default
of 0 only exists when `-d` is absent. `-d 4294967297` is *accepted* as
1 ms (the `strtoul` result is cast to `unsigned int`), and
`-l 4294967298` is accepted as 2 (`atoi` truncates to 32 bits).

### 2. Stack

Raw WebGL2 over Three.js ([ADR-001](./decisions/001-rendering-stack.md)).
The look is three coupled effects (body glow, floor light, bloom), and
each is one small tunable pass. Canvas 2D does the classic view, where
it is exactly right, and doubles as the no-WebGL fallback.

### 3. The art-direction loop

Screenshots after every visual stage, critiqued, fixed, re-shot:

- **Scene v1.** Worms glowed, but the floor was invisible: light too
  weak and too short. Caustics read as a cheap “electric web”. No depth.
  → Stronger light map, larger and softer caustics that only appear
  where worm light falls, drifting murk.
- **v2.** The light pools were **rectangles**, because the light was
  drawn as wide ribbons with cut ends. The bodies zig-zagged like
  springs, and the cause was not the sway: a grid walk alternates
  diagonal and straight steps, and the spline faithfully reproduced the
  staircase. → The light became point sprites along the body. The
  path’s interior points are relaxed with `[1 2 1]/4` passes, ends
  pinned, so the head still sits on its cell.
- **v3.** Overexposed white. The light-density arithmetic was off by
  about 12× (two vertices per sample × 7 samples per cell × a 6-cell
  radius). → Recomputed to 0.05 per sample.
- **Worms v1 (close-up).** Pale plastic drinking straws: flat, nearly
  white, zebra stripes. → A translucent tube: darker saturated tissue,
  Fresnel rim glow, a gut channel carrying a pulse from head to tail,
  scalloped segment outlines (bulging annelid rings, done in geometry),
  paired photophores per segment, head light organs, and a wet sheen lit
  by *the other worms’* light (the light map), so worms light each
  other.
- **Floor v2.** The diagonal ripples covered everything, like brushed
  metal. → Ripples only in patches, lumpy ooze elsewhere, faint large
  albedo patches, and burrows with raised rims.
- **Trails v1.** Pixel beads, an LED strip along the grid staircase,
  the opposite of the brief’s “luminous trail instead of dots”. → Each
  worm keeps its tail history. The trail is a smooth strip that cools
  from white to the species colour, thins and fades, and faintly lights
  the sand.
- **Field v1.** Invisible, a screen-door texture. → Brighter strokes
  with slow “breathing” waves; eaten channels read clearly.
- **Polish.** Thin species (`~`) cast as much light as fat ones →
  light ∝ body width². Crossings blew out white → exposure 0.92. A
  horizontal “lens streak” turned out to be a single sand-ripple crest
  lit from the side: realistic, kept. All worms entering at `(0, bottom)`
  became a warm-rimmed home burrow.

### 4. Practicalities learned from the `pom` port

- **Never assume a GPU**: CPU WebGL → automatic Low; no WebGL2 → the
  classic view. Both were tested by forcing Chromium flags.
- Shaders compile **in parallel and asynchronously**
  (`KHR_parallel_shader_compile`), and web fonts load non-blocking.
- A **zero-raster test** that also bans audio files. A first version
  flagged the CSS class `.ico` as an icon file; the pattern now requires
  a real reference (quote, paren or slash before the path).

### 5. Deliberately not done

- No food, collisions or player control. These appear in the canonical
  `port-ideas.md`, but the brief is a screensaver, and the original
  has no such rules.
- No camera movement. The top-down fixed camera keeps the grid honest.

---

## Cross-References

- Canonical [`spec.md`](../../../docs/spec.md) and
  [`port-ideas.md`](../../../docs/port-ideas.md).
- [`./decisions/`](./decisions/): ADR-001, ADR-002, ADR-003.
- [`./architecture.md`](./architecture.md).
