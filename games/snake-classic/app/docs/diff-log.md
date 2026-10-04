# Diff Log — `snake / fancy-web`

> A running narrative of every meaningful design decision made
> during this port's build. Feature-by-feature comparison of BSD
> `snake(6)` (the canonical spec at
> [`../../../docs/spec.md`](../../../docs/spec.md)) versus this
> `fancy-web` implementation.
>
> Structured as **Kept · Changed · Added · Removed · Deferred**
> per ADR-006 §Universal Port Contract #3.

---

## Kept (mechanically identical to BSD `snake(6)`)

These are the mechanics that make this port faithful — they are
the invariant that lets any player of the original recognize this
as `snake`.

| Original mechanic | Preserved as |
|---|---|
| Player controls a single character/entity that moves through the world | Player controls the head of a 45-segment slithering body; only the head interacts with pickups and enemies |
| Money/valuables scattered on the map | 6 apples spawn at random positions with min-distance from player |
| Collecting money increments score | Touching an apple increments `game.score`; apple respawns elsewhere |
| A predator chases the player from turn 1 | The eagle patrols continuously; enters lock → dive → strike cycles autonomously |
| Reaching any edge = escape with whatever you have | Snake head touching canvas margin (4 px) triggers win with current score |
| Escape counts regardless of amount (even $0 escape is a legal win) | Escape with 0 apples shows "escaped empty-handed" but still counts as escape |
| Getting caught by predator = death, run over | Eagle strike within 26 px of snake head during first 120 ms of strike state = death |
| Player can steer freely within the map bounds | 4-directional keyboard input (WASD + arrow keys) with smoothed head-direction interpolation |
| Score is displayed to the player | HUD row below canvas: `apples <n> · best <n>` |

## Changed (spec-authorized reinterpretation)

Style prefix `fancy-web` per ADR-006 explicitly allows additive
freedom. All changes here are authorized under
[`decisions/fancy-web-001-spec-deviations.md`](./decisions/fancy-web-001-spec-deviations.md).

### 1. `$` money → 🍎 apple

The pickup collectible is rendered as an apple, not a dollar
sign. The metaphor better matches modern audiences ("eating an
apple" is universal; "a floating dollar sign" reads as a
1980s-arcade abstraction). Apple visuals adapt per theme:

- **Neon Grid**: hot-pink neon orb
- **Savanna / Jungle**: mango orange
- **Desert**: prickly pear pink
- **River**: coral fallen fruit
- **Aztec**: pomegranate red
- **Origami**: coral paper apple
- **Midnight**: forbidden berry with purple glow

Rendering includes proper apple silhouette (stem well + calyx
notch), radial gradient body, gloss highlight + specular dot,
freckles (non-origami themes), stem with shading, and detailed
leaf with veins.

### 2. `~` goblin → 🦅 eagle (or 🦉 owl in Midnight)

The chaser is a bird of prey with a **shadow-warning system**:
- Its shadow is projected on the ground plane, scaling with
  altitude — small halo when high, sharp point when diving.
- A dashed red lock-on ring appears at the target during lock &
  dive states, giving the player ~1 second to dodge.

The eagle is a top-down silhouette based on the reference
[Eagle silhouette 4 by SeriousTux](https://openclipart.org/detail/177436/eagle-silhouette-4-by-serioustux-177436)
(CC-PD) — used as shape reference only, redrawn procedurally with
5 tapered primary "finger" feathers, secondary scallops, tail
wedge with feather-separation lines, curved hooked beak, and
fierce yellow raptor eyes.

Owl variant (Midnight theme only): rounder body, facial disc,
large forward-facing yellow eyes with pupils, ear tufts, barred
wings, and short tail.

### 3. Text grid 60×20 → canvas 900×600

Rendered on HTML5 Canvas 2D at 900×600 px. `getContext('2d')`
with procedural drawing — zero raster assets.

Justification: the original grid was constrained by terminal
character resolution. Modern browsers render at ~85 dpi; the
canvas at native resolution provides ~90× more visual density.
Since `fancy-web` is defined as web-target + additive-OK, this is
squarely in-scope.

### 4. Discrete grid-step motion → continuous smooth motion

BSD `snake` moves one grid cell per key press. This port uses a
**spring-follow chain constraint** for the body:

- Head position advances at `0.14 px/ms` (140 px/s) along
  smoothed input direction.
- Each body segment maintains fixed distance (`8 px`) from the
  previous via Verlet-style constraint solving each frame.
- A perpendicular **sine wave offset** is applied at render time
  (amplitude 3.2 px, phase shift 0.35 per segment) to produce the
  classic S-curve slither.

Justification: 60 fps continuous motion is expected on modern
platforms. Discrete grid-step would feel broken in a mouse/touch
era.

### 5. Single-char player `I` → 45-segment slithering body

The visual player is a chain of 45 segments rendered as tapered
overlapping filled circles with:

- Gradient color from head (`snakeHead`) to tail (`snakeTail`)
- Single-pass shadow glow (one stroke path around the whole body)
- Per-segment muscle-pulse highlight (sine-wave brightness pulse)
- Head detail: eyes with vertical slit pupils, occasional tongue
  flick

Only the head is interactable (apple pickup, eagle collision).
The 44 following segments are visual. This preserves the "single
entity" semantics of the original.

### 6. Single map → 8 cosmetic themes with different biomes

Each theme redefines:
- Background gradient
- Grid line/dot colors + glow
- Snake head-tail palette + glow radius
- Apple color, leaf, stem, glow
- Enemy species (eagle variant) with distinct body/tip colors
- Ambient drift particle colors and behavior (bubbles rise in
  River; sand blows horizontally in Desert; stars twinkle in
  Midnight)

## Added (net-new features, no equivalent in BSD original)

Authorized under
[`decisions/fancy-web-002-additive-features.md`](./decisions/fancy-web-002-additive-features.md).

### 1. Eagle state machine

The chaser is no longer a naive "move-toward-player" AI. It
cycles through 5 states:

- **`GLIDE`** (4.5–7 s randomized) — circles player in wide arc
  with slow wing flap
- **`LOCK`** (900 ms) — decelerates, locks onto current player
  position, drops altitude slightly, warning ring appears
- **`DIVE`** — accelerates toward locked target at 440 px/s,
  wings fold, altitude drops rapidly, rapid wing flap
- **`STRIKE`** (260 ms) — impact frame; strike burst spawns; kill
  window active during first 120 ms
- **`CLIMB`** — reverse velocity, gravity-like decel, wings flap
  hard, altitude rises back to 0.75

This gives the player a **dodge window**: from LOCK → DIVE →
STRIKE they have ~1 second between seeing the warning ring and
the strike landing. Move the head out of the target zone → strike
misses.

### 2. Shadow-warning system

Eagle's shadow is rendered separately from the eagle sprite:
- Position: eagle's `.x, .y` (ground plane)
- Scale: proportional to altitude (0.4 + altitude × 1.2)
- Alpha: darker when altitude drops
- Rendered as radial gradient ellipse for a soft-edge shadow

Combined with the lock-on ring, this gives spatial + temporal
warning without any text UI.

### 3. Cosmetic theme system

Runtime-swappable palette + behavioral flags:
- `composite` (`'lighter'` for neon themes, `'source-over'` for
  natural themes)
- `enemyShape` (`'eagle'` or `'owl'`)
- `stars` (true → Midnight adds twinkling stars + moon)
- `paperFold` (true → Origami adds fold lines on entities)
- `sandBlow` (true → Desert drift moves horizontally faster)
- `risingParticles` (true → River drift rises with sinusoidal
  wobble like bubbles)

Theme is stored in memory only (not persisted). Best score
persists across theme switches.

### 4. Ambient drift particles

40 particles drift across the canvas with theme-appropriate
colors and behavior. Non-interactive — purely atmospheric.

### 5. Effect particles

Spawned by game events:
- **Apple pickup burst**: 14 particles + shockwave ring (~380 ms
  fade)
- **Eagle strike burst**: 22 particles + shockwave ring (~700 ms
  fade)
- **Death burst**: 30 particles + large ring (~900 ms fade)

Particles use `globalCompositeOperation = 'lighter'` on neon
themes for additive glow.

### 6. localStorage best-score persistence

Key `snake-fancy-best` stores the highest score achieved. Read at
page load, written on every death or escape. Wrapped in
try/catch so failure (private mode, quota exceeded) is silent.

### 7. Light-mode gallery frame

The page frame (outside the canvas) is a cream/off-white
"gallery" — soft drop shadow around the canvas, quiet typography,
pill-button theme picker. The canvas becomes the visual centerpiece
regardless of which theme is active inside it.

### 8. Restart flow with lockout

After death or escape:
- Overlay fades in with title + subtitle + "press any key" prompt
- 550 ms lockout on restart to prevent accidental restart
- Any key restarts: snake resets to center, apples respawn, eagle
  resets far from player with 2-second delay before first lock

### 9. Snake head detail

- Eyes with vertical slit pupils (per-theme eye color)
- Occasional tongue flick (visible when `sin(time × 0.0032) > 0.7`)
- Head tilt matches direction of movement

### 10. Multiple-attempt apple spawn

`spawnApple()` tries 6 attempts to find a location ≥90 px from
the player. Prevents unfair "apple spawns on top of you" edge
case.

## Removed (from BSD original)

Nothing.

Every mechanic from BSD `snake(6)` is preserved in some form.
Visual reinterpretation ≠ removal.

## Deferred (v2 backlog)

Intentionally not implemented in v1; documented as future work:

- **Vite + TypeScript** scaffolding (rationale in
  [`decisions/fancy-web-003-shipping-format.md`](./decisions/fancy-web-003-shipping-format.md))
- **PWA manifest** + service worker for installable + offline
  loading via URL
- **Touch controls** — swipe gestures for mobile browsers
- **Sound design** — Tone.js synthesized or CC0 samples
- **Automated tests** — Vitest/Playwright test suite
- **Deploy** — Vercel/Netlify/GitHub Pages with live URL
- **Difficulty settings** — configurable eagle patience, apple
  count, snake speed
- **Streak / combo scoring** — bonus multipliers for chained
  pickups
- **User-authored theme packs** — importable JSON palettes
- **Instructions modal** on first launch
- **i18n** — localized text (overlay messages, meta labels)
- **Additional enemy species** — hawk, kite, harrier variants per
  theme
- **Sound effect on theme switch**
- **Screen shake** on death (currently deferred; particles
  compensate visually)

## Performance notes

The two optimizations that let this hit 60 fps across all 8
themes:

### 1. Single-pass body glow

Snake body glow was originally 45 separate shadow-blurred fills
(one per segment). On Neon Grid with `shadowBlur = 22`, that was
45 × ~44-pixel-radius blur ops per frame → dropped frames.

Changed to: draw the whole body as one path stroke with shadow
once. Same visual halo, ~45× cheaper. Individual segment fills
still drawn but without shadow (fast).

### 2. Offscreen static-layer cache

Background gradient + vignette + grid lines + grid dots (with
glow) + Midnight's moon crescent are all **static per theme** —
they don't change between frames. All rendered once per theme
into an offscreen canvas, then blitted each frame with
`drawImage()`.

On Neon Grid this removed **330 shadow-blur ops per frame** (grid
dots × `shadowBlur = 4`). On Midnight it removed those plus the
moon's `shadowBlur = 30` op.

Cache is invalidated in `setTheme()`; next `renderGrid()` call
regenerates. Overhead ~30-50 ms per theme switch (one-time).

## Chronological log

*(Consolidated design highlights in chronological order.)*

- **2026-09-17 morning** — Port folder scaffolded at
  `bsdgames/snake/ports/fancy-web/`. Initial `mockup.html` with
  Neon Grid theme only. Basic snake + eagle + shadow warning +
  no gameplay yet.
- **2026-09-17 midday** — Added 3 more themes (Savanna v0,
  Origami, Midnight). Owl variant for Midnight introduced.
- **2026-09-17 later** — Redesigned Savanna (was too desert-like),
  added Desert / Jungle / River / Aztec themes (total 8).
- **2026-09-17 afternoon** — Eagle sprite redesigned using
  reference silhouette (5 finger primaries, tail wedge, curved
  beak). Apple sprite gained proper apple silhouette + gloss +
  freckles + veined leaf.
- **2026-09-17 late** — Midnight moon fix: `destination-out` was
  punching through to canvas CSS background, causing "two circles
  overlapping" look. Replaced with clip-based crescent so the
  moon's glow halo only appears on the bright side.
- **2026-09-17 evening** — Gameplay wired: multi-apple spawn,
  pickup collision, eagle-strike death detection, edge-escape,
  score display, localStorage best score, restart flow with
  lockout, game over overlay.
- **2026-09-17 late evening** — Performance fix. Neon Grid and
  Midnight were dropping frames due to per-segment shadow blurs
  and per-frame grid dot glow rendering. Single-pass body glow +
  offscreen static layer cache pushed all themes back to 60 fps.
- **2026-09-17 finalization** — Renamed `mockup.html` →
  `index.html`, wrote port ADRs, this diff-log, per-theme
  screenshots, promoted to 🟢 Released.

## See also

- Canonical game docs: [`../../../docs/`](../../../docs/)
- Port ADRs: [`decisions/`](./decisions/)
- Manual test scenarios: [`test-scenarios.md`](./test-scenarios.md)
- Root porting philosophy:
  [`../../../../../docs/decisions/002-porting-philosophy.md`](../../../../../docs/decisions/002-porting-philosophy.md)
- Universal Port Contract:
  [`../../../../../docs/decisions/006-multi-port-architecture.md`](../../../../../docs/decisions/006-multi-port-architecture.md)
