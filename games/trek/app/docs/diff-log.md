# diff-log — `trek / procedural-web`

Feature-by-feature narrative: what this port kept, changed, added and
removed, compared with BSD `trek(6)` (the canonical
[`spec.md`](../../../docs/spec.md)) and with its sibling
[`fancy-web`](../../fancy-web/), whose engine it shares.

Legend: 🟩 kept · 🟨 changed · 🟦 added · 🟥 removed · 🟪 reinterpreted

---

## 1. The reuse decision (engine)

This port exists to compare two ways of *drawing* the same game, so the
game itself had to be identical. Options and reasoning are in
[ADR 001](./decisions/001-tech-stack.md) §Part 1. What was done, in
order:

1. **Stage 1 — copy, don't touch.** `src/galaxy.js`, `src/engine.js`,
   `src/parser.js`, `src/hints.js` and six test files
   (`engine`, `parser`, `hints`, `autoplay`, `autoplay-trace`,
   `shortcut-conflict`) were copied byte-for-byte from fancy-web at commit
   `fbe3bb0`. SHA-256 comparison confirmed identical bytes, and all
   **45/45** copied tests passed unchanged before anything else was
   written. Autoplay baseline: Novice 90 % wins (18/20), Standard 11.93
   average kills, Expert 10.10, the same as fancy-web's documented
   figures.
2. **Freeze the reference.** `engine.js` and `galaxy.js` were copied a
   second time into `tests/fixtures/baseline/`. They are never edited.
   `baseline-regression.test.js` replays 120 seeded games through that
   frozen engine and through `src/engine.js` with every override off,
   and requires identical results, state, snapshots and RNG state after
   every step.
3. **Pin what must not change.** `galaxy.js`, `parser.js` and `hints.js`
   are still byte-identical to fancy-web. A test pins their SHA-256
   (line endings normalised). The `override` grammar lives in a separate
   `src/override.js` so `parser.js` stays untouched.
4. **Only then extend.** `engine.js` gained the Captain's Override
   flags (§3). Every change is a guard of the form `ov(game, flag)`, or
   an additive field or function.

Because the engine is shared, this port **inherits fancy-web's
deviations from the canonical spec** (§5). They are listed rather than
fixed: fixing them here would break the like-for-like comparison. The
right fix is a change to both ports together.

## 2. Rendering — the reason this port exists

| Feature | fancy-web | procedural-web | |
|---|---|---|:---:|
| Backdrop | 7 painted images, `hash(qx,qy) mod 7`, sine drift | One volumetric GLSL nebula per quadrant, seeded from `(qx, qy)`: palette, cloud envelope, domain-warped 3D-noise emission/absorption march, dust lanes, ionisation rims, filaments, embedded stars that light the gas, a galactic band, a planet in half the quadrants (gas giant ± rings, terran, barren; lit by the key star, kept off the grid); auto-exposed; analytic twinkling stars dimmed behind dust; parallax drift | 🟪 |
| Player ship | painted PNG | Original "Vanguard" cruiser: lofted armoured hull, swept wings, three integrated engines with plumes, cyan sensor band, ~70 lit windows, running lights, idle roll and bob | 🟪 |
| Enemies | 4 painted PNGs rotated to face you | 4 original designs (Talon, Hammer, Trident, Stingray): lofted and extruded hulls, runtime-canvas plating, hot seams, windows, engines, pulsing reactor cores; bows track the Enterprise smoothly | 🟪 |
| Starbase | painted PNG, 6 cells | "Bastion" ring station ≈ 5.6 cells: hub, counter-rotating habitat and module rings, spokes, solar wings, docked tenders, greebles, 600+ windows, chaser beacons, shuttle traffic | 🟪 |
| Stars | SVG sparkle | Shaded sphere (granulation, sunspots, limb darkening), streamer corona, real point light on nearby hulls, lens flare; spectral class hashed per sector; flares when a torpedo hits it | 🟪 |
| Phasers | 3 stroked lines + glow dot, all targets at once | Six phaser banks round the hull fire **simultaneously**, one per Klingon, nearest first, each from the bank that faces its target — BSD trek's automatic mode (`phaser.c`, `NBANKS 6`). Billboarded ribbon with white-hot core, flowing glow, heat-shimmer refraction, emitter flash, impact sparks and light (owner decision, see §6). | 🟪 |
| Torpedoes | glow dot on a straight line to the target (always east on a miss) | The cruiser comes about onto the bearing, then launches from the bow tube: spiky pulsing head along the engine's actual trajectory, ember trail, moving light | 🟪 |
| Klingon fire | red line to the Enterprise | Twin disruptor bolts from the weapon emitters, landing on the shield (hex ripple) or on the hull (sparks, fire, shake) depending on the engine's hull-damage figure | 🟪 |
| Shields | translucent disc | Ellipsoid fitted to the hull: Fresnel rim, hex grid that only lights where hit, up to 4 expanding ripples, power-up sweep, gold under the invulnerability override | 🟪 |
| Explosions | fading sprite + radial flash + SVG blast + 12 dots | Hull heats → flash + light → refracting shockwave (second ring for big hulls) → noise-shaded fireball → sparks → tumbling instanced hull debris with ember trails → cooling embers → smoke; secondary blasts on big hulls; scale by class | 🟪 |
| Warp | instant sky swap | Ship comes about onto the course, stretches and streaks; screen-space tunnel (zoom blur, streak lanes, rings) hides the new quadrant's sky bake; ship decelerates in | 🟦 |
| Impulse | teleport | Ship comes about onto the course, then glides with engine swell | 🟦 |
| Scans, dock, resupply | none | Sensor pings, tractor/resupply beam, gold resupply rings | 🟦 |
| Damaged hull | none | Sparks and smoke wisps below 50 % hull | 🟦 |
| Galaxy chart | flat 2D grid over the backdrop | Tilted hologram: fog-of-war static, Klingon columns + diamonds, rotating starbase gizmos, star pips, your beacon, scan wave and radar sweep, crisp projected labels, hover + click for instant warp | 🟪 |
| Title | opaque panel | Translucent panel over a live composed scene | 🟨 |
| Post | CSS vignette | HDR bloom (13-tap / tent), ACES, split-tone grade, vignette, grain, subtle chromatic aberration, screen flash | 🟦 |

All of it is code: geometry, GLSL and runtime canvas
([ADR 002](./decisions/002-zero-raster-assets.md)). The one runtime-canvas
use is hull plating (albedo, roughness/metal, normal from a height
field, glow seams) and solar-cell texture, drawn once at load from a
seeded RNG.

## 3. Added — Captain's Override (🟦)

A second cheat layer on top of fancy-web's dynamic hints, implemented as
explicit engine flags (`OVERRIDE_FLAGS` in `engine.js`):
`revealMap`, `infiniteEnergy`, `infiniteTorpedoes`, `invulnerable`,
`freezeClock`, `oneShot`, `instantWarp`, plus `overrideResupply()` and
`overrideWarpTo()`. The typed command is `override …` (`src/override.js`)
and the panel key is `!` (the shortcut guard test is extended to cover
both). Using any override sets `game.cheated`. The UI then shows an
**OVERRIDE ACTIVE** badge while a flag is on, a CHEATED tag, gold log
lines, a `[CHEATED]` final log line and a CHEATED stamp on the end screen.

Design choices:
- **Reveal map doesn't write `scanned`.** Releasing it brings the fog
  back, and fancy-web's hints (which read `scanned`) behave as before.
- **Invulnerable still fires.** Klingons shoot and hit. Only the effect
  on the ship is cancelled, so the visual (a gold ripple) stays honest.
- **Instant warp still gets shot at.** Arriving where Klingons are
  triggers their arrival volley, as a normal warp does.
- **Resupply isn't a dock.** You stay undocked.
- **Turning a flag off doesn't remove the CHEATED mark.**

Full player guide: [`how-to-cheat.md`](./how-to-cheat.md).

## 4. Changed / added around the HUD

| Item | What and why | |
|---|---|:---:|
| HUD layout | Same panels, positions, sizes, text and colour rules as fancy-web, for a fair comparison. Restyled finish only: glass panels with a lit top edge and corner ticks, segmented bars. | 🟩/🟨 |
| Bezel | `USS ENTERPRISE` without `NCC-1701` (IP hygiene); adds ⚠ override, quality (◐ high / ◑ low / ○ lite) and ♪ sound buttons, plus the OVERRIDE ACTIVE badge. | 🟨 |
| Title overlay | Starts below the bezel, so sound and quality can be set before the mission. | 🟨 |
| `damages`, `computer` | Print a readout in the hint line (fancy-web shows nothing). | 🟨 |
| `help` | Also lists the override grammar. | 🟨 |
| Energy / torps / shields bars | Show ∞ in gold while the matching override is on. | 🟦 |
| Buttons | Lose focus after a click, so Enter and Space always go to the command line. | 🟨 |
| Chart legend | Visible (fancy-web's is hidden under the command panel), plus a fog-of-war entry. | 🟨 |
| Sound | Procedural Web Audio, **muted by default**: bridge drone and hum, rare console blips, phaser, torpedo, explosion, disruptor, shield ring, hull clang, three-whoop alert klaxon on entering a hostile quadrant, warp. | 🟦 |
| Quality | High / Low / Lite + 2D fallback, auto-selected and auto-stepped-down; measured numbers in the README. | 🟦 |
| Reduced motion | `prefers-reduced-motion` or `?reduced=1`: no drift, bob, shake or tunnel (fade instead), slower ambient animation. | 🟦 |
| Scriptability | `?seed=`, `?difficulty=`, `?cmds=`, `window.__trek` — used by the comparison, screenshot and smoke scripts. | 🟦 |

## 5. Inherited from the shared engine (vs canonical spec)

Kept as fancy-web has them, for parity. Covered in more detail in
fancy-web's own diff-log.

| Canonical | Shared engine | |
|---|---|:---:|
| 23 commands | 13 verbs (`phaser` auto only, `torpedo`, `move`/`warp`/`impulse`, `srscan`, `lrscan`, `damages`, `dock`, `shields`, `computer`, `help`, `quit`) | 🟥 |
| `cloak`, `capture`, `ram`, `rest`, `visual`, `destruct`, `abandon`, `dump`/restart, emergency `help` transporter | not implemented | 🟥 |
| Length × skill (3 × 6) + password | 3 presets: Novice / Standard / Expert | 🟨 |
| 14 devices | 8 subsystems | 🟨 |
| Event queue (supernovas, distress calls, base attacks, reproduction) | none — Klingons are static until destroyed | 🟥 |
| 13 loss codes | 4 (stardate, hull, life support, energy) | 🟨 |
| Docking repairs over time | Docking restores everything at once | 🟨 |
| Warp 10 fatal | warp capped at 8 | 🟨 |
| Klingons move (6-state FSM) | Klingons stay put and return fire each turn | 🟨 |

Canonical scenario coverage is tabulated in
[`test-scenarios.md`](./test-scenarios.md#canonical-coverage).

## 6. Narrative

The build followed the brief's ten stages.

1. Copy and prove the engine: 45/45 green, byte-identical.
2. Write the two ADRs.
3. Add the override flags. The seeded regression came next, and it
   caught its own flaw: a flag switched on and off again legitimately
   marks the final log line `[CHEATED]`, so that one test strips the
   mark before comparing.
4. Nebula. The first bake read as blurry fog under a snowstorm of stars.
   Eroded cloud shapes, ionisation rims, clustered dust lanes and a much
   sparser star field made it read as nebula. Brightness still swung
   10× between quadrants, so the sky got auto-exposure.
5. Ships. Lofted hulls read as ships at game scale. Enemy plating was
   calmed down after it looked like camouflage.
6. Weapons, shields and explosions. The screenshots caught four real
   bugs, each fixed:
   - black NaN specks from MSAA sampling outside triangles;
   - shields sized from bounding boxes inflated by glow quads;
   - torpedo victims vanishing before impact;
   - a Playwright clock that kept ticking during page load.
7. Chart and HUD. The first chart was a noisy tiled floor overlapping
   the panels. It was calmed and resized to sit between the HUD columns.
   The smoke test caught the reference panel swallowing clicks on the
   override panel.
8. Audio.
9. Comparison captures and write-up.
10. Polish, including measuring the no-GPU path. It ran at 3 fps on
    SwiftShader, which is why the Lite profile exists; it now runs at
    18–19 fps in combat. The comparison itself called for the last
    addition: the painted port's biggest lead was *subject matter* (a
    planet, a galaxy). So skies gained procedural planets, drawn from a
    separate RNG stream so no existing nebula changed.

**Review round 1 (owner, 2026-09-24).** Two notes from play-testing:
(1) the ship fired before it had finished turning, so the beam appeared
to leave from empty space; (2) with enemies in opposite directions it
fired at both from the nose. Fixes: every turn now completes before the
ship acts (constant-rate turn with thruster puffs), and beam origins
track their emitters every frame. A latent bug surfaced too: during a
warp the position offset was accumulating frame after frame; positions
are now recomputed from the cell every frame. For (2) the owner first
chose a sequential engagement (turn, fire, turn, fire).

**Review round 2 (owner, 2026-09-24).** The owner asked how the original
does it and chose to follow it. The C source settles it:
- `phaser.c`: up to `NBANKS` = 6 banks fire *simultaneously*. In
  automatic mode there is one bank per Klingon, nearest first, and the
  energy is weighted towards the nearest and capped at what each kill
  needs.
- `attack.c`: every Klingon then fires once per turn.

One turn is one volley each way. The sequential presentation made the
player look slower than the enemy, so it was replaced: six banks round
the Vanguard's hull (bow, forward port/starboard, aft port/starboard,
dorsal aft) fire together, each Klingon from the bank that faces it, with
no turn. Torpedoes (one tube, in the bow) still come about first. The
shared engine's rules were not touched.

Mechanical differences from the original remain in the shared engine
(fancy-web parity; see §5 and [`notes.md`](./notes.md#shared-engine-vs-original-combat-rules)):
the original forbids phasers with shields up, splits phaser energy by
distance, lets Klingons move and tire, allows 3-torpedo bursts, and
gives the Klingons you leave a parting shot.
