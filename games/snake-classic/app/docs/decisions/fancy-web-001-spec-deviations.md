# ADR fancy-web-001: Spec Deviations Authorized

## Status

**Accepted** — 2026-09-17.

## Context

BSD `snake(6)` — as documented in
[`../../../../docs/spec.md`](../../../../docs/spec.md) — has a specific
visual language:

- Player is an ASCII `I` on a 60×20 text grid.
- Money is scattered `$` characters worth points.
- The chaser is `~` — a goblin that moves toward the player each
  turn.
- Movement is discrete: one grid step per keypress.

Per **ADR-006 §Universal Port Contract #1**, any deliberate
deviation from `spec.md` must be documented in a port-level ADR.
Silent deviation blocks port acceptance.

This port's style prefix is `fancy-web`, defined in **ADR-006
§Port Naming Conventions** as:

> Additive OK. Web (browser + PWA). Modern polish (animations,
> sprites, sound). Multiplayer, leaderboards, achievements,
> sound, gamepad, etc.

So additive freedom is granted at the style level. This ADR
records the specific reinterpretations executed under that
freedom and confirms none of them break the game's mechanical
identity.

## Deviations

### 1. `$` money → 🍎 apple

**What changed:** the pickup collectible is drawn as an apple
(vector, procedural, theme-adaptive) instead of a dollar sign.

**Why:** across audiences under 40, "collecting apples" is a more
universal metaphor than "collecting floating money icons". BSD
`snake`'s money-and-escape economy remains — only the visual token
changes. This is spiritually consistent with ADR-002:

> Preserve mechanics; modernize everything else.

The theme system uses per-theme apple variants (mango, pomegranate,
prickly pear, etc.) to reinforce biome identity without altering
gameplay.

### 2. `~` goblin → 🦅 eagle (with 🦉 owl variant)

**What changed:** the chaser is a bird of prey, not a goblin
character. Enemy variant depends on theme (African fish eagle,
harpy eagle, osprey, hawk, Mexican-flag eagle, paper eagle, or
horned owl).

**Why:** two reasons:

1. **Genre coherence.** Eagles are natural predators of snakes.
   BSD `snake`'s abstract `~` goblin has no ecological meaning;
   an eagle vs. snake reads immediately across every culture
   (Mexican flag, Aztec myth, Zeus/Python).
2. **Design opportunity.** An aerial predator opens a new visual
   plane: ground-vs-sky reading, shadow-warning telegraphing, dive
   attack patterns. See ADR fancy-web-002 for the state-machine
   details enabled by this shift.

The chaser's mechanical role — "pursue player, kill on contact"
— is unchanged.

### 3. Text grid 60×20 → Canvas 900×600

**What changed:** rendering is HTML5 Canvas 2D at 900×600
pixels. No text glyphs; procedural vector rendering throughout.

**Why:** the original grid was constrained by terminal character
resolution. Modern browsers render at ~85 dpi minimum; a canvas
at native resolution provides ~90× the visual density. Since
`fancy-web` is defined as web-target + additive-OK, procedural
canvas rendering is squarely in-scope for this style. Retro
terminal aesthetics are handled by a different style — see
`classic-web` in ADR-006 §Port Naming Conventions.

The **playable area** is functionally equivalent: bounded rectangle
with an escape edge on all four sides. Apples are placed at
random positions within margin; player moves freely within the
canvas.

### 4. Discrete grid-step motion → continuous smooth motion

**What changed:** the player moves continuously at ~140 px/s
along a smoothed input direction, not one grid cell per keypress.

**Why:** 60 fps continuous motion is expected on any modern
platform. Discrete grid-step motion would feel broken in a
mouse/touch/gamepad era.

**How it's implemented:** head position advances every frame
along `snake.dx, snake.dy` (a unit vector smoothed toward keyboard
input over ~130 ms). Body segments follow via Verlet-style
distance-constraint solving (each segment stays exactly 8 px from
the previous). This produces the classic snake slither.

The mechanical spec is preserved: player controls the head's
direction; head interacts with pickups and enemies; escape at
any edge.

### 5. Single-char player `I` → 45-segment slithering body

**What changed:** the player is visualized as a 45-segment chain
with wave physics, tapered gradient, and head-detail (eyes,
tongue). Not a single character.

**Why:** visual richness. A 45-segment body communicates the
"snake" identity through motion (S-curve slither, spring-follow
tail, muscle-pulse rhythm) in a way no static character can.

**Important:** mechanically, only the head is interactive.
- Apple pickup checks `hypot(head.x - apple.x, head.y - apple.y)`.
- Eagle strike checks head position only.
- Edge escape checks head position only.
- **Body segments are visual-only** — they don't collide with
  anything.

This preserves the "single logical entity" semantics of the
original: one player, one control vector, one collision point.

The body is not the Nokia snake growing-longer mechanic. Length
is fixed at 45 segments and does not change with apple pickups.
(Growing-snake mechanics would be a different game — see
`bsdgames/worm/` for that variant.)

## Options considered

Since `fancy-web` allows additive freedom, the only real question
per deviation was "how far to reinterpret". The chosen point is:

- **Maximal visual freedom** (canvas, procedural sprites, body
  segments, cosmetic themes)
- **Minimal mechanical change** (all collision, scoring,
  chase-and-escape mechanics preserved verbatim)

Two rejected alternatives:

**Option R1: Literal port** — text grid, ASCII characters, arrow-
key discrete movement. Rejected: this is what `classic-web` is
for. `fancy-web` explicitly promises additive polish.

**Option R2: Full remix** — introduce new mechanics (power-ups,
combo scoring, multiple enemy types, boss encounters). Rejected:
that's `remix-web` (a style not yet reserved). Adding mechanics
crosses the "reinterpretation" line into "new game", which needs
a different style prefix and separate justification.

The chosen point sits between: everything visual is reimagined,
everything mechanical stays.

## Decision

**Accept the five deviations above as authorized under ADR-006
`fancy-web` style.**

Each is a **visual/UX reinterpretation** that leaves the game's
mechanical spec verbatim. `docs/test-scenarios.md` verifies this
by running canonical `snake` acceptance scenarios against this
port.

## Consequences

### Positive

- The port reads immediately as `snake(6)` to anyone familiar
  with the original.
- The visual richness expands the audience — modern browsers
  render the game in a way that Terminal-era players never saw.
- The 8 cosmetic themes give this single port broader replay
  value than any single-theme port could.

### Negative

- A player expecting literal BSD `snake` (green-on-black text,
  ASCII chars, discrete grid) will find this port's `fancy-web`
  aesthetic surprising. Mitigation: README describes the
  reinterpretation clearly; and the `classic-web` port (when it
  ships) will provide the literal experience.
- Body segmentation could confuse a player into thinking this is
  growing-snake. Mitigation: README explicitly notes the fixed-
  length body and points to `bsdgames/worm/` for growing-snake.
- Adding a new enemy species would require re-tuning the state
  machine's timing across all themes. Not a blocker; just a cost.

## References

- [ADR-002 — Porting philosophy: spiritual successor](../../../../../../docs/decisions/002-porting-philosophy.md)
- [ADR-006 — Multi-port architecture](../../../../../../docs/decisions/006-multi-port-architecture.md)
  §Port Naming Conventions (`fancy-web` style)
- [ADR-006 §Universal Port Contract #1](../../../../../../docs/decisions/006-multi-port-architecture.md)
  — spec-deviation ADR requirement
- Canonical spec:
  [`../../../../docs/spec.md`](../../../../docs/spec.md)
- Related additive-feature decisions:
  [`fancy-web-002-additive-features.md`](./fancy-web-002-additive-features.md)
