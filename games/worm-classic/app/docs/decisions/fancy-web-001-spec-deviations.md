# ADR fancy-web-001: Spec Deviations Authorized

## Status

**Accepted** — 2026-09-17.

## Context

BSD `worm(6)` — as documented in
[`../../../../docs/spec.md`](../../../../docs/spec.md) — has a specific
visual + interaction language:

- Worm rendered as `@` (head) + `o` chars (body) on a text grid.
- Food is a literal digit character `1`–`9`.
- Grid is bounded by terminal dimensions (typically 80×24).
- Fixed tick rate via `alarm(1)` — 1 grid step per second.
- HJKL for uppercase = burst movement (multi-cell per tick).

Per ADR-006 §Universal Port Contract #1, any deliberate deviation
from `spec.md` must be documented in a port-level ADR.

This port's style prefix is `fancy-web`, defined in ADR-006 as
"additive OK". The deviations recorded here are visual/UX
reinterpretations that leave the mechanical spec intact.

## Deviations

### 1. Digit character `1`-`9` → numbered apple visual

**What changed:** the food is drawn as a shiny apple with the
digit displayed on its face. Value encoded across three visual
channels:
- **Size** — 55% cell radius (apple 1) to 100% cell radius
  (apple 9)
- **Color** — palette lerp from `T.appleBase` at value 1 to
  `T.appleRipe` at value 9
- **Digit** — bold numeral centered on the apple

**Why:** the digit remains as the primary information — matching
spec — while size and color reinforce it. The player reads value
instantly across all three channels.

**Mechanically:** identical. `apple.value` (1–9) is added to
`worm.growing` on eat, and `worm.growing` is added to `score`
after the increment (chained bonus preserved). No spec violation.

### 2. Text grid on TTY → HTML5 Canvas 2D

**What changed:** rendering is Canvas 2D at 900×600 pixels with
30-pixel cells (30 cols × 20 rows). No text glyphs — procedural
vector rendering throughout.

**Why:** terminal character resolution is a constraint of the
1980 platform. Modern browsers render at ~85 dpi minimum; native
canvas gives ~90× the visual density.

`fancy-web` style is web-target + additive-OK; procedural canvas
is squarely in-scope. Retro terminal aesthetics belong to the
`classic-web` style (per ADR-006 §Port Naming Conventions).

### 3. Discrete grid-step motion → interpolated visual

**What changed:** the worm's *logical state* remains discrete
(each segment is at a grid cell). But rendering interpolates:
- Head extends forward into the next cell as the tick progresses
- Tail retracts from its cell toward the next segment (only when
  not growing that tick)

**Why:** 60 fps continuous motion is expected on modern
platforms. Discrete jumps between cells would feel broken.

**Mechanically:** identical. Death checks, apple pickup, growth
resolution all happen at tick boundaries in discrete cell space.
Interpolation is purely visual.

### 4. Fixed 1 tick/sec → 3 user-selectable speed modes

**What changed:** a settings picker below the theme picker offers:
- **Classic  ·  3×** — 333 ms per tick (comfortable retro pace)
- **Fast  ·  6×** — 167 ms per tick (modern arcade)
- **Progressive  ·  3→6×** *(default)* — 333 ms at length 5
  ramping to 167 ms at length 45+

Persisted in localStorage.

**Why:** BSD's fixed 1 tick/sec was tuned to 1980-era terminal
speeds and player expectations. Modern arcade taste is faster; a
single fixed choice would leave both retro and modern audiences
unsatisfied.

**Note on Classic:** the label evokes the retro feel, but the
tick rate is *not* BSD verbatim (which would be 1×). Playtest
established that even sympathetic "retro pace" players find 1
tick/sec painfully slow on a 30-column grid — worm takes ~30
seconds to traverse. 3× was chosen as the minimum that still
reads as "slow / deliberate" without being unplayable. The pure-
BSD rate is documented and available via a two-character edit
to `updateTickInterval()`.

Progressive is the default because it starts kind (fair curve for
newcomers) and ramps with earned skill (rewards experienced
players). Classic remains available for those who prefer uniform
pace. Fast serves modern-arcade preference.

**Mechanically:** the tick semantics (movement, eat, growth,
death checks) are unchanged — only the *interval* between ticks
varies. All modes preserve the spec.

### 5. HJKL running mode — deferred

**What NOT changed but ALSO not implemented:** BSD original
supports `Shift+H/J/K/L` for a "running" mode where the worm
moves multiple cells per tick until interrupted.

**Why not in v1:** the settings picker's Fast mode approximates
uniform-fast play. The running mode's specific "hold to burst,
release to stop" feel would require a separate input pathway
(keydown/keyup state tracking). Deferred to v2 for scope
containment; documented in
[`../diff-log.md`](../diff-log.md) §Changed.

**Impact:** minor — most modern players wouldn't miss it, and Fast
mode is a reasonable substitute. Speedrunners and BSD faithful
would want this back; v2 target.

## Options considered

Per deviation:

**On apple visualization:** literal ASCII digit vs stylized fruit.
Chose fruit + digit overlay because it satisfies both audiences —
retro readers see the digit; modern players see satisfying food.

**On tick rate:** hard-code 1s (retro faithful, feels slow) vs
hard-code faster (modern, breaks faithful promise). Chose the
settings-picker approach so the user picks.

**On motion:** grid-step (retro faithful, jumpy) vs interpolated
(modern, spec-preserving). Chose interpolated because it doesn't
alter mechanics.

**On Classic tick rate:** 1× BSD verbatim (glacial on modern
hardware) vs faster minimum (~333 ms). Chose faster. The label
"Classic" is preserved for retro feel; the underlying rate is
adjusted to be playable. Documented explicitly rather than
silently retained.

**On HJKL running:** implement now vs defer. Chose defer to keep
v1 scope tractable.

## Decision

**Accept the five deviations above** — four implemented and
authorized under ADR-006 `fancy-web` style, one deferred.

Every implemented deviation is a **visual/UX reinterpretation**
that leaves the mechanical spec verbatim.
[`../test-scenarios.md`](../test-scenarios.md) verifies this by
running canonical `worm` scenarios against this port.

## Consequences

### Positive

- Port reads as `worm(6)` to anyone familiar with the original.
- Visual richness expands audience; user-picked speed handles
  taste variance.
- Numbered-apple encoding makes value tangibly readable at a
  glance.

### Negative

- HJKL running mode is a real gap for speedrunners. Mitigation:
  Fast mode; v2 implementation.
- The 3-speed picker adds UI surface; slight cognitive load for
  first-time players. Mitigation: sensible default (Progressive)
  means most players never touch it.
- Interpolated motion may feel less "retro-faithful" than pure
  grid-step in Classic mode. Mitigation: interpolation is subtle
  at 3× rate; feels natural not disruptive.
- Some "true BSD faithful" players may want the exact 1 tick/sec
  rate. Mitigation: documented one-line code edit in README to
  restore original rate.

## References

- [ADR-002 — Porting philosophy: spiritual successor](../../../../../../docs/decisions/002-porting-philosophy.md)
- [ADR-006 — Multi-port architecture](../../../../../../docs/decisions/006-multi-port-architecture.md)
  §Port Naming Conventions
- [ADR-006 §Universal Port Contract #1](../../../../../../docs/decisions/006-multi-port-architecture.md)
  — spec-deviation ADR requirement
- Canonical spec:
  [`../../../../docs/spec.md`](../../../../docs/spec.md)
- Sister ADR:
  [`fancy-web-002-additive-features.md`](./fancy-web-002-additive-features.md)
- Reference implementation of the visual toolkit:
  [`../../../../../snake/ports/fancy-web/docs/decisions/fancy-web-001-spec-deviations.md`](../../../../../snake/ports/fancy-web/docs/decisions/fancy-web-001-spec-deviations.md)
