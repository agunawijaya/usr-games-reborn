# ADR-003: From ASCII Ages to Ripples — Stage Mapping, Timing and `-d 0`

- **Status:** Accepted
- **Date:** 2026-09-24
- **Deciders:** Agun Wijaya (repo owner), implemented with Claude
- **Scope:** Port-level (`rain/ports/fancy-web`)

## Context

The engine is byte-faithful: it reproduces the original binary's frames
exactly (`tests/engine.test.js`). Each drop lives six frames
(`rain.c:118-145`):

| Age | Characters | Reading as a real raindrop |
|--:|---|---|
| 0 | `.` | the drop touches the water |
| 1 | `o` | a crater opens; a crown of spray rises |
| 2 | `O` | the crater collapses and a jet (Worthington jet) shoots up |
| 3 | `-` `\|.\|` `-` | the first ring; the jet's droplet falls back (`.`) |
| 4 | `-` `/ \` `\| O \|` `\ /` `-` | a wider ring; the centre rebounds (`O`) |
| 5 | blanks | the disturbance has spread out and faded |

The brief asks for the lifecycle to *drive* the visuals, for the `-d`
delay to set the rain intensity, and for a split view comparing the two.
Three questions need a decision: how stages become physics, how time is
kept, and what `-d 0` means in a browser.

## Options Considered

### Option A — Draw rings as overlays at each stage's radius

**Description:** Ignore physics; draw a ring of 1 cell at age 3 and 2
cells at age 4.

**Pros:** literal.
**Cons:** rings do not interfere or reflect the sky properly; flat.

### Option B — Stages inject energy into a wave simulation (chosen)

**Description:** Each age is an *impulse* into a GPU wave-equation
field at the drop's position, shaped like the physical event it names:

| Age | Impulse | Particles / sound |
|--:|---|---|
| 0 | a narrow depression (the impact) | the falling streak ends here; splash crown; plink |
| 1 | a small positive ring (the crown collapsing) | crown droplets arc outward |
| 2 | a sharp central bump (the jet) | one droplet thrown up |
| 3 | a small depression (the droplet falls back) | a quieter, higher plink |
| 4 | a soft central bump (the rebound) | — |
| 5 | none; the field keeps ringing and decays | — |

The rings themselves are *not drawn*: they emerge from the physics, so
neighbouring drops interfere, and each drop leaves a train of concentric
rings like a real one. The wave speed is 0.25 m/s, close to the minimum
phase speed of capillary–gravity waves (≈ 0.23 m/s). The terminal is
laid over the visible water (ADR-004): at 6 m from the camera a column
is about 9 cm wide, and at the man page's `-d 120` the first ring has run
about 9 cm by age 3 and 12 cm by age 4 — one to two columns, roughly the
ASCII picture.

**Pros:** physical, interfering, and still timed by the engine.
**Cons:** at extreme delays the rings no longer line up with the ASCII
radii (the physics does not speed up with the clock) — accepted: at a
downpour the ASCII drawing is illegible anyway.

### Option C — Scale wave speed with the delay

**Pros:** ASCII radii always match.
**Cons:** at `-d 5` ripples would race across the pond at 5 m/s; at
`-d 999` they would crawl. Unphysical in both directions.

## Decision

**Option B**, with these timing rules:

1. **The engine clock ticks every `delay` ms** (`rain.c:147-148`). The
   intensity *is* the delay: drops per second = 1000 / delay, so the
   slider runs from a drizzle (`-d 999`, one drop a second) to a
   downpour (`-d 1`, a thousand drops a second, several engine frames per
   display frame).
2. **Rain has to fall before it lands.** A streak takes about 0.35 s to
   cross the frame, so the picture runs a constant 0.35 s behind the
   engine: each drop's streak starts when the engine creates it and lands
   exactly as age 0 is shown. The classic view uses the same delay, so
   split view stays in lock-step, frame for frame.
3. **`-d 0` means "as fast as a 9600-baud terminal".** The original
   waited for the terminal to drain (`tcdrain`, `rain.c:150`) and the man
   page says the proper effect needs "9600 baud or the `-d` option". The
   port estimates the bytes curses would send for each frame (a cursor
   motion plus the changed cells for every draw call) and waits that long
   at 960 bytes/s — about 120–160 ms per frame, close to the man page's
   recommended 120.
4. **Phantom drops.** The five random start positions (`rain.c:109-112`)
   enter mid-life at ages 1–4 without an impact. They are shown the same
   way (their later impulses only), as the original shows them.

## Consequences

- Split view is always consistent: both panes read one engine and one
  clock.
- `prefers-reduced-motion` starts the pond in a drizzle (`-d 400`),
  stills the camera and softens splashes; the rules are unchanged.

## References

- `rain.c:109-151` (upstream <https://github.com/vattam/BSDGames/tree/master/rain>).
- `rain.6` ("either the terminal must be set for 9600 baud or the -d option").
- Worthington, *A Study of Splashes* (1908) — crown and jet stages.
- Capillary–gravity wave minimum phase speed ≈ 0.23 m/s (water, 20 °C).
- Contract tested in `tests/mapping.test.js` (the impulse table) and
  `tests/timeline.test.js` (clock and latency).
