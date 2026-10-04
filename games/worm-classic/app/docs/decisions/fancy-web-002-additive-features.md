# ADR fancy-web-002: Additive Features

## Status

**Accepted** — 2026-09-17.

## Context

ADR-006 defines `fancy-web` as "additive OK" — new features
beyond canonical spec are welcome, as long as spec's mechanics
still hold. This ADR records the net-additive features in v1 of
this port.

Where `fancy-web-001` covers **visual reinterpretation** (things
that changed shape but not mechanic), this ADR covers **net-new
features** with no equivalent in BSD `worm(6)`.

## Feature 1: 8 cosmetic themes

**What:** the 8-theme palette system from
[`../../../../../snake/ports/fancy-web/`](../../../../../snake/ports/fancy-web/)
reused verbatim. Neon Grid, Savanna, Jungle, Desert, River,
Aztec, Origami, Midnight — each redefines palette, glow radius,
composite mode, ambient particle behavior, and (for Midnight)
enables star field + moon crescent.

**Why:**

1. **Consistency across ports.** A user who played
   `snake/fancy-web` will recognize the picker and feel
   at-home in `worm/fancy-web`. Building the same visual
   language across ports makes the repo feel like one product
   line.
2. **Replay value.** 8 palettes × 3 speed modes × many-game
   sessions = huge visual variety from one build.
3. **Reuse economics.** The palette + behavior-flag pattern is
   already proven; zero re-engineering cost.

**Cost:** the `THEMES` object is copied from the snake port with
minor field renames (`snakeHead` → `wormHead`, etc.) — ~180 lines
of pure data.

## Feature 2: Settings row — speed picker

**What:** three pills below the theme picker letting the player
choose tick rate: **Classic (1×) · Fast (3×) · Progressive
(1→4×)**. Persisted in localStorage.

**Why:** discussed in
[`fancy-web-001-spec-deviations.md`](./fancy-web-001-spec-deviations.md)
§Deviation 4.

**Additive** because BSD original has a single fixed rate. This
port doesn't eliminate that (Classic mode preserves it) — it
adds two more options.

**Cost:** ~50 lines of picker UI + tick interval calculation.

## Feature 3: Numbered apple visual encoding

**What:** three-channel encoding of apple value (1–9) — size,
color, and digit — for rich readability.

**Why:** discussed in
[`fancy-web-001-spec-deviations.md`](./fancy-web-001-spec-deviations.md)
§Deviation 1.

**Additive** in the sense of encoding richness — the digit alone
is sufficient (spec); size and color are extras that reinforce.

**Cost:** ~40 lines of apple rendering with gradient body, stem,
leaf, digit overlay.

## Feature 4: Particle effects

**What:** two effect types spawn on game events:
- **Apple pickup** — 10 + `value × 2` particles + shockwave ring
  in apple's color, ~550-820 ms fade (bigger apple → longer)
- **Death** — 30 particles + large white ring in worm colors,
  ~900 ms fade

Plus continuous **ambient drift** — 40 particles crossing the
canvas with theme-appropriate colors and behavior.

**Why:** particles turn mechanical events into satisfying moments.
Without them, apple pickup feels like a coincidence; with them, it
feels like an event. Ambient drift keeps the scene alive during
idle moments.

**Cost:** ~110 lines for particle system + spawn functions.

## Feature 5: localStorage persistence

**What:** two keys:
- `worm-fancy-best` — highest score across sessions
- `worm-fancy-settings` — JSON with `speed` and `theme` prefs

Try/catch wrapped for private-browsing / quota safety.

**Why:** persistent stats give a session-spanning goal
("beat your best"). Persistent settings mean the player doesn't
re-configure every load.

**Cost:** ~15 lines.

## Feature 6: Restart flow with 550 ms lockout

**What:** after death or win, a full-canvas overlay ("CAUGHT" or
"GARDEN FILLED") shows for 550 ms before accepting restart input.
Any key restarts after the lockout.

**Why:** without lockout, mashing keys during death restarts
instantly before the player reads the message.

**Cost:** ~15 lines.

## Feature 7: Head detail

**What:** eyes (whites + colored pupils per theme, vertical slit
if pupil is bright), occasional tongue flick.

**Why:** the head is where player attention lives. Detail there
communicates "you are here" and adds character.

**Cost:** ~40 lines.

## Feature 8: Progressive body gradient + muscle pulse

**What:** linear gradient from `T.wormHead` to `T.wormBody`
along the worm's bounding box, plus subtle brightness pulse on
each segment (sine wave along body).

**Why:** distinguishes head end from tail end visually — subtle
but reinforces motion direction. Muscle pulse adds "living
animal" quality.

**Cost:** ~25 lines. Reuses snake port's technique.

## Feature 9: HUD row with tick indicator

**What:** score / length / best (left) + current tick interval
(right, updates live).

**Why:** length is a meaningful progression signal for the growing
worm genre. Tick interval helps the player understand progressive
mode's scaling in real time — you can *see* the number drop as
you grow.

**Cost:** ~10 lines of HTML + update calls.

## Feature 10: Wall boundary visualization

**What:** the deadly wall is drawn as a thick lit border around
the canvas (uses `T.gridDot` color, glow enabled per theme).

**Why:** in the original the wall is just "the edge of what fits
on the terminal" — implicit. In canvas rendering the boundary
needs explicit visual weight to communicate "don't touch". A
lit border does this without adding gameplay-affecting UI.

**Cost:** ~5 lines. Rendered into the offscreen cache (zero
per-frame cost).

## Options considered

For each feature, the meaningful question was **include vs
exclude**. Every included feature was tested against:

1. Does it preserve BSD `worm` spec mechanics? (Yes for all.)
2. Does it fit the `fancy-web` "additive polish" style? (Yes —
   none are gameplay-altering.)
3. Is the visual/UX gain worth the code cost? (Yes — costs are
   contained, gains are notable.)

Features **rejected** for v1:

- **Sound design.** Deferred — Tone.js synth for crunch, tension
  buildup, thud, sting. Documented as future work.
- **Screen shake on death.** Deferred — canvas transform +
  easing. Death particles already cover the visual moment.
- **Growing pending indicator** — HUD glyph showing "N more
  segments coming". Nice, but not v1 blocker.
- **Streak / combo visualization** — highlight when chain bonus
  triggers. Deferred.
- **Adjustable grid size** — nice but requires re-tuning
  progressive-speed math.
- **Difficulty modifiers** — starting length, apple value
  distribution.
- **HJKL burst mode** — noted in
  [`fancy-web-001-spec-deviations.md`](./fancy-web-001-spec-deviations.md)
  §Deviation 5 as deferred spec compliance.

## Decision

**Accept features 1–10 as authorized additive features for v1.**

Each serves either **game feel** (particles, head detail, muscle
pulse), **replay value** (themes, persistence), **presentation
polish** (wall boundary, HUD tick indicator), or **UX
correctness** (restart lockout, settings picker).

None alter the mechanical spec.

## Consequences

### Positive

- Playable end-to-end at 60 fps across all 8 themes.
- Data-driven `THEMES` makes adding a 9th theme cheap (~50 lines).
- Persistence hooks in place for v2 leaderboards / cloud sync.
- Snake port's visual toolkit reused efficiently.

### Negative

- Single file at ~1500 LOC — approaching the readable-single-file
  ceiling. See
  [`fancy-web-003-shipping-format.md`](./fancy-web-003-shipping-format.md).
- 8 themes multiply the visual-testing surface (mitigated by
  Playwright automation).
- Settings picker + theme picker together occupy vertical
  screen real estate; mitigated by wrap-friendly CSS.

## References

- [ADR-002](../../../../../../docs/decisions/002-porting-philosophy.md)
  §Modernize freely
- [ADR-006 §Port Naming Conventions](../../../../../../docs/decisions/006-multi-port-architecture.md)
  — `fancy-web` = additive OK
- Sister ADR:
  [`fancy-web-001-spec-deviations.md`](./fancy-web-001-spec-deviations.md)
- Feature-by-feature breakdown:
  [`../diff-log.md`](../diff-log.md) §Added
- Visual toolkit source:
  [`../../../../../../docs/learning/fancy-web-visual-toolkit.md`](../../../../../../docs/learning/fancy-web-visual-toolkit.md)
