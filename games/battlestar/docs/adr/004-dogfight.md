# ADR-004: The Dogfight — Real-Time 3D Cockpit on fly.c's Grid, Turn-Based as an Option

- **Status:** Accepted
- **Date:** 2026-09-24
- **Deciders:** Agun Wijaya (repo owner), implemented with Claude
- **Scope:** Port-level (`battlestar/ports/fancy-web`)

## Context

`fly.c` is a curses mini-game: a Cylon `/-\` on an 80×24 screen moves
once per second (a `SIGALRM` handler), the player's keys set a
*persistent drift* of the enemy relative to the fixed crosshair (they
turn the ship; there is no "stop" key), `f` fires two torpedoes that
hit only on the centre row within one column, fuel is spent per key,
and a single 120-second clock (`ourclock`) is shared by every
dogfight in the game. `port-ideas.md` leaves open whether real-time
flight should be optional ("Should there be a `--turn-based` flag?").

The brief asks for a real-time 3D cockpit with original raider designs,
a targeting reticle, torpedo trails and gauges driven by the engine,
and to record whether a turn-based alternative is offered.

## Options Considered

### Option A — New flight model (free 3D flight, physics)

**Description:** Replace the grid with a 6-DOF dogfight.

**Pros:**
- Most "modern".

**Cons:**
- Throws away fly.c's rules (drift, hit window, shared clock, fuel per
  key); breaks RNG alignment with the original, so the golden tests
  could not cover anything after the first Cylon.

**Suitable when:** fidelity is not a goal.

### Option B — fly.c's grid as the model, rendered as a 3D cockpit, real-time (chosen as default)

**Description:** `src/engine/flight.js` (`FlightSim`) keeps fly.c's
state and arithmetic exactly — same `rnd()` calls in the same order
(star field, spawn, jitter), same keys, same fuel and torpedo costs,
same hit test. The renderer maps `(row, column)` to a bearing off the
nose (yaw/pitch), interpolates between the 1 Hz steps with easing and
banking, scrolls the star field at the drift rate, and draws fly.c's
blast (two converging `/` `\` lines) as two torpedo trails.

**Pros:**
- Faithful: the first frame of every golden dogfight (Cylon position,
  fuel, torpedoes, clock) matches the real binary.
- The feel is preserved: you *steer the drift*, not a cursor.

**Cons:**
- 1 Hz enemy steps can feel jerky; mitigated by interpolation.

**Suitable when:** fidelity and a modern look are both goals.

### Option C — Turn-based only

**Description:** The enemy moves one step per key press.

**Pros:**
- Accessible; no reflexes needed.

**Cons:**
- Changes the character of the original's only real-time moment.

**Suitable when:** interactive-fiction purists.

## Decision

**We chose Option B, real-time by default, with Option C available as
an opt-in setting** ("Dogfight pacing: real-time / turn-based"). In
turn-based mode each command key (not `+`, not unknown keys) is
followed by exactly one clock tick; the rules are otherwise identical.
The setting is also recommended with `prefers-reduced-motion` and is
offered (not forced) there.

Keys: the original letters all work (`h j k l r l u d`, capitals, `f`,
space, `+`, `q`); arrow keys map to `r l u d` (Shift = ×5), because the
original mis-read arrow escape sequences. Hint text explains the drift
model in plain words.

## Consequences

### Positive
- Scripts can drive the sim headlessly (`sim.key()`, `sim.tick()`), so
  the autopilot, the hint autoplay and the tests all use the real rules.
- A piped-input mode (`flightMode: 'stdin'`) reproduces exactly what a
  script sees with the real binary (keys arrive instantly, no ticks).

### Negative / Risks
- Turn-based mode is not faithful timing; the score is not marked,
  because the rules themselves are unchanged (only time is paused).

## References
- `fly.c:51-299`; `src/engine/flight.js`; `src/render/cockpit.js`.
