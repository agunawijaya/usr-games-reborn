# ADR fancy-web-002: Additive Features

## Status

**Accepted** — 2026-09-17.

## Context

ADR-006 defines `fancy-web` style as "additive OK" — new features
beyond canonical spec are welcome, as long as spec's mechanics
still hold. This ADR records the net-additive features
implemented in v1 of this port and their rationale.

Where fancy-web-001 covers **visual reinterpretation** (things
that changed shape but not mechanic), this ADR covers **net-new
features** with no equivalent in BSD `snake(6)`.

## Feature 1: Eagle state machine + shadow warning

**What:** the chaser cycles through 5 states — `GLIDE` → `LOCK`
→ `DIVE` → `STRIKE` → `CLIMB` → back to `GLIDE`. Each state has
distinct movement, wing-flap rate, and altitude behavior. A
red dashed **lock-on ring** appears at the target during LOCK
and DIVE, giving the player a visual telegraph.

**Why:** BSD `snake`'s `~` goblin was a naive turn-by-turn
"move toward player" AI. Adequate for a text game, but boring
in continuous-motion play — the chase becomes a monotone approach
with no strategic depth.

The state machine introduces:
- **Rhythm.** Predator alternates hunting and idle behavior, so
  the game has tension arcs, not constant threat.
- **Skill expression.** Player can learn the timing (LOCK →
  DIVE is ~900 ms; DIVE → STRIKE is ~500 ms) and use it to dodge.
  A skilled player can play indefinitely; a novice will die.
- **Visual clarity.** The shadow projection on the ground plane
  + lock-on ring makes the threat spatially readable without any
  text UI.

**Cost:** ~120 lines of state-machine JS + shadow rendering. Not
free but well-contained in `updateEagle()` / `renderEagle()`.

## Feature 2: Cosmetic theme system (8 themes)

**What:** 8 runtime-swappable palettes and behavior variants:
Neon Grid, Savanna, Jungle, Desert, River, Aztec, Origami,
Midnight. Each redefines background gradient, entity colors,
grid style, drift-particle color/behavior, and (for Midnight)
the enemy species (owl instead of eagle).

**Why:**

1. **Replay value.** A single-theme port has a fixed aesthetic;
   the game either fits your mood or it doesn't. 8 themes let a
   player pick whatever they're in the mood for.
2. **Educational demonstration.** The `THEMES` object shows how
   a rich visual identity is a palette + a few behavior flags —
   the code underneath is uniform. A porter learning from this
   codebase can add a 9th theme in ~50 lines of pure data.
3. **Cultural / regional appeal.** Aztec, Savanna, and Origami
   each have specific cultural reference points that give the
   port more character than a single generic palette could.

**Cost:** the `THEMES` object is ~180 lines of pure data. Runtime
cost is zero (all palette lookups are direct property access;
composite mode + shadow behavior branches are single boolean
checks).

## Feature 3: Particle effects

**What:** three effect types spawn on game events:

- **Apple pickup** — 14 radiating particles + 1 shockwave ring
  in the apple's theme color, ~550 ms fade
- **Eagle strike** — 22 particles + 1 shockwave ring in enemy
  colors, ~700 ms fade
- **Death** — 30 particles + 1 large ring in snake colors + white,
  ~900 ms fade

Plus continuous **ambient drift particles** (40 particles) that
move across the canvas with theme-specific colors and behavior
(bubbles rise in River; sand blows horizontally in Desert).

**Why:** particles provide **game feel** ("juice") that turns
mechanical events into satisfying moments. A collision without
particles reads as a coincidence; a collision with a burst reads
as an event.

The ambient drift particles serve a different purpose: they
make the scene feel **alive** during idle moments (when the eagle
is far away and no pickups have happened recently). Without them
the canvas would feel dead.

**Cost:** ~110 lines for particle system + spawn functions. Each
frame processes ~40-80 active particles (drift + spawned effects).
Well under the frame budget.

## Feature 4: localStorage best-score persistence

**What:** the player's best score across sessions is stored in
`localStorage['snake-fancy-best']`. Read at page load, written on
every death or escape (if the new score exceeds the stored best).

**Why:** even a small persistent stat gives the player a
long-term goal beyond the current run. Without it, the game is
purely momentary; with it, "beat your best" becomes a session-
spanning motivation.

Storage is wrapped in try/catch — if localStorage is unavailable
(private browsing, quota exceeded, disabled), the game still
plays but the best score is always shown as 0 for that session.

**Cost:** ~10 lines. Negligible.

## Feature 5: Light-mode gallery frame

**What:** the page around the canvas is a cream/off-white
"gallery" — soft drop shadow around the canvas, quiet mono-font
typography, pill-button theme picker. The canvas becomes the
visual centerpiece.

**Why:** with 8 themes, the page frame can't match all of them.
Instead of picking one theme's color for the frame (which would
clash with the other 7), the frame is intentionally quiet — a
neutral canvas-carrier. This is a **presentation** decision that
lets any theme feel intentional inside its frame.

**Cost:** ~50 lines of CSS. Zero runtime overhead.

## Feature 6: Restart flow with 550 ms lockout

**What:** after death or escape, the game shows a full-canvas
overlay ("CAUGHT" or "ESCAPED") for 550 ms before accepting
restart input. Any key restarts after the lockout.

**Why:** without lockout, a player who was mashing keys during
death would restart instantly before reading the game-over
message. With lockout, they see the message, then press a key.

550 ms is short enough not to feel obstructive but long enough
to prevent accidental skip.

**Cost:** ~15 lines. Negligible.

## Feature 7: Head detail (eyes, tongue, tilt)

**What:** the snake head has procedurally-rendered eyes with
vertical slit pupils (or non-slit for themes with black eyes),
occasional tongue flicks (visible when sine phase > 0.7), and
tilts to match direction.

**Why:** the head is the interactive part of the snake — where
the player's attention lives. Detail here rewards close looking
and communicates "you are here" more clearly than an unmarked
segment would. The tongue flick adds a "living animal" quality
without costing much.

**Cost:** ~40 lines for eye + tongue rendering. Runs once per
frame (head only, not per segment).

## Feature 8: Multiple-attempt apple spawn

**What:** when an apple respawns, `spawnApple()` tries 6 random
positions and picks the one farthest from the player's head, as
long as distance > 90 px.

**Why:** without this, apples can spawn directly on the snake's
current path, feeling unfair. With it, respawn is always some
distance away, giving the player travel time between pickups.

**Cost:** ~15 lines. Runs on every pickup — 6 hypot ops. Trivial.

## Options considered

For each feature, the meaningful decision was **include vs
exclude**. Every included feature was tested against these
questions:

1. Does it preserve BSD `snake` spec mechanics? (Yes for all.)
2. Does it fit the `fancy-web` "additive polish" style? (Yes for
   all — none are gameplay-altering.)
3. Is the visual/UX gain worth the code cost? (Yes for all —
   costs are contained, gains are notable.)
4. Would removing it later be difficult? (No for any — every
   feature is well-encapsulated.)

Features **rejected** for v1:

- **Sound design.** Deferred — significant scope (either compose
  synth via Tone.js or curate CC0 sample library, integrate,
  volume UI, mute state, cross-browser audio quirks). Documented
  as future work.
- **Screen shake on death.** Deferred — canvas transform + easing
  work. Death particles already cover the visual moment.
- **Score animation** on pickup (count-up number). Deferred —
  aesthetic, not gameplay.
- **Combo / streak scoring.** Deferred — this is a spec deviation
  requiring a separate ADR if pursued.
- **Difficulty settings.** Deferred — UI complexity + testing
  matrix.

## Decision

**Accept features 1-8 as authorized additive features for v1.**

Every one of them serves either **game feel** (particles, shadow
warning), **replay value** (themes, persistence), **presentation
polish** (gallery frame, head detail, apple respawn fairness), or
**UX correctness** (restart lockout).

None of them alter the mechanical spec.

## Consequences

### Positive

- The port is 60 fps playable end-to-end with none of the
  "additive" features feeling forced or gratuitous.
- The `THEMES` data-driven approach makes future theme additions
  cheap (~50 lines each).
- Persistence hooks are already in place; adding leaderboards or
  cloud sync in v2 would extend rather than replace.

### Negative

- Total code footprint is ~1900 lines in one file — pushing the
  upper limit of "readable single-file". A future refactor to
  modules (see `fancy-web-003-shipping-format.md`) will help.
- 8 themes multiply the visual-testing surface. Any future
  rendering change must be verified across all 8 (per AGENTS.md
  §Performance floor).
- The state-machine timing constants (glide duration, lock
  duration, dive speed) are tuned by feel. Future changes must
  re-test dodgeability.

## References

- [ADR-002](../../../../../../docs/decisions/002-porting-philosophy.md)
  §Modernize freely
- [ADR-006 §Port Naming Conventions](../../../../../../docs/decisions/006-multi-port-architecture.md)
  — `fancy-web` = additive OK
- Sister ADR:
  [`fancy-web-001-spec-deviations.md`](./fancy-web-001-spec-deviations.md)
- Feature-by-feature breakdown:
  [`../diff-log.md`](../diff-log.md) §Added
