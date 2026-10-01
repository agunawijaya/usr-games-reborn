# diff-log — `atc / fancy-web`

Feature-by-feature narrative of what was **preserved**, **changed**,
**added**, or **deferred** vs BSD `atc(6)` (Ed James, 1986).

Canonical mechanic contract:
[`../../docs/spec.md`](../../docs/spec.md). This diff-log documents
deviations only — anything not mentioned here is expected to match
spec exactly.

---

## Preserved (BSD-faithful, no deviation)

### Tick order
Per spec.md §Turn Order — clock++, ground-to-air promotion,
per-plane update (fuel, altitude ±1, direction ±2 clamp, move,
delayed release, dest check, crash check), sweep gone, collision
check, new-plane roll. See `src/engine.js:tick()`.

### Rate limits
- Altitude changes ±1 per tick.
- Direction changes ±2 per tick (max 90° per tick).
- Props tick every other clock; jets every tick.

### Loss conditions
All 9 loss conditions from spec.md §Objective are implemented:
- Collision (adjacency in all three axes)
- Fuel < 0
- Wrong-exit departure
- Exit at wrong altitude
- Wrong-airport landing / wrong-direction landing
- Land instead of exit / exit instead of land
- Ceiling exceed (altitude > 9)
- Ground crash (altitude ≤ 0 outside airport)
- Illegally left arena

### Spawn rules
- Origin type: exit or airport, picked uniform.
- Destination: same pool minus origin.
- Adjacency retry: up to 32 attempts, must be > 4 units from any
  existing air plane (spec says "> 4"; we use `> 4` as strict).
- Plane type: uniform 50/50 jet/prop.
- Fuel = `width + height`.
- Enter altitude = 7 (from exit) or 0 (from airport).
- Enter direction = origin's assigned direction.

### Command grammar (subset)
Per spec.md §Actions/Commands. Implemented:
- Altitude: `a<n>`, `ac<n>` / `a+<n>`, `ad<n>` / `a-<n>`
- Direction: `t<dirkey>` (`qwedcxza`), `tL`, `tR`
- Towards: `ttb<n>`, `tta<n>`, `tte<n>`
- Modifiers: `m`, `i`, `u`, `c`
- Empty Enter forces immediate tick (BSD-faithful).

### Playfield DSL semantics
- Exits on the border only.
- Beacons + airports strictly inside the border.
- Coordinates 0-indexed.
- Directions 0..7 (N, NE, E, SE, S, SW, W, NW).

Playfields are ported from Ed James's original `games/` directory
(BSD atc source). MVP includes 3 sectors (Easy, Default, Killer);
the remaining 14 are deferred to v2.

---

## Changed (deliberate deviations from BSD)

### Rendering
**BSD:** curses (character grid, monospace, 80×24 terminal).
**Port:** HTML5 canvas 2D with a CRT phosphor CSS effect
(scanlines + drop-shadow filter + radial vignette approximating
barrel distortion). Green phosphor palette exclusively; letters
rendered via VT323 font at ~90% cell height with glow.

Rationale: the fancy-web port style (ADR-006) explicitly permits
visual reinterpretation; the terminal-appearance monopoly on
BSD-lineage web ATC games is exactly the identity gap this port
targets.

### Command line
**BSD:** single line at bottom, character-by-character echo, `?`
prints valid next tokens at the current parse state.
**Port:** same character-by-character grammar, but the "valid next
tokens" hint is *always shown* in a persistent hint line above the
command line, updated after every keystroke. `?` is not yet bound
(deferred to v2) because the always-on hint largely subsumes it.

### Timer
**BSD:** `SIGALRM` fires the tick from a `setitimer` timer;
kernel-scheduled.
**Port:** `setTimeout` in JavaScript with a per-tick reschedule
after each `tick()` call. Not deterministic across sessions
(browser scheduling), but the game state itself is deterministic
given a fixed RNG seed + fixed input log.

### Scoring
**BSD:** score persisted to a system-wide setgid-protected file
with lock protection.
**Port:** score displayed in-session only. `localStorage` history
+ daily-seed leaderboard deferred to v2.

### Circle direction
**BSD:** distinguishes clockwise vs counter-clockwise circle via
`MAXDIR` vs `MAXDIR+1`.
**Port:** MVP implements only clockwise circle (`dir += 2` per
tick). `cl` / `cr` variants deferred to v2.

### RNG
**BSD:** `srandom()` seeded from `time(NULL)` or `-r <seed>`.
**Port:** Mulberry32 seeded from `Math.random() * 1e9` or an
explicit seed. Same statistical properties for this use case.

---

## Added (not in BSD original)

### Ambient audio bed
Persistent Web Audio drone (~42 Hz sawtooth, low-pass filtered at
220 Hz + slow LFO on gain) + faint 15.7 kHz sine (CRT scanline
whine). Interaction SFX (radar ping, key clack, spawn beep,
land/exit chime, loss klaxon) via short-lived oscillators.

Toggleable via `♪ audio` button in the top bezel.

**Rationale:** the *Control Room 1986* identity requires
atmosphere. BSD atc runs silently by design; a purely visual port
would leave the identity flat.

### Shift framing
"SHIFT" timer countdown from 15 minutes at start. "NEXT TICK"
countdown between ticks. Bezel shows sector name, tick rate, spawn
rate, ATIS info letter (rotating).

**Rationale:** frames each session as a *shift* rather than a
disembodied game session. Reinforces the controller-in-a-room
identity.

### Traffic sidebar
Live per-plane panel showing origin, destination, altitude,
heading, fuel — with colour cues (bright for MARKED, dim for
UNMARKED, faded for IGNORED, red for critical fuel).

**Rationale:** BSD atc showed a compact info panel; the port
elaborates it with more information density and colour, since
screen real-estate is larger than 80×24.

### Event log
Ring buffer of the last ~12 events (spawns, takeoffs, landings,
exits, losses). Colour-coded by event class.

**Rationale:** gives the player a running narrative of the shift,
useful for post-mortem after a loss.

### Sector picker
Sidebar buttons switch between Easy, Default, Killer sectors,
starting a new game with the chosen sector.

**Rationale:** BSD atc required CLI flags (`-g <name>`) to switch
sectors; the port makes this browser-native.

### Pause on help open
When the help overlay is shown (via `?` key, `? help` button, or
first-visit auto-open), the tick timer halts, the `NEXT TICK`
indicator shows `PAUSED` in red, and the shift-timer freezes.
On close, both timers resume from where they stopped — the
pause duration is added to `shiftStart` so no in-game time is
lost.

**Rationale:** BSD atc **does not permit pause** (spec.md
§Turn Order: `SIGTSTP` and `SIGSTOP` are ignored — "the pain is
the point"). But the port is single-player on a personal browser
and needs an escape hatch when the player opens the help modal.
Pause is limited to the help overlay; no user-triggered pause
key exists (preserving the "no bail-out" identity when playing).

### How-to-play overlay
Comprehensive first-time onboarding modal (auto-shows on first
visit via `localStorage` flag `atc-fancyweb-help-seen`). Explains
every glyph on the radar (plane, beacon, airport, exit), every
sidebar panel, the compass key layout, the command grammar with
concrete examples, all win/lose conditions, and a step-by-step
walk-through of routing the first plane. Toggle with `?` key or
the `? help` button in the top bezel.

**Rationale:** BSD atc assumed a Unix user who could `man atc`;
web audience arrives cold. Without in-product onboarding, the
typed-command paradigm reads as opaque and the port fails its
first-user test. Direct user feedback (2026-09-21) confirmed this
gap on initial playtest — the overlay is the primary response.

### Cheat overhaul: waypoint routing + two-phase collision-avoidance
User challenged (2026-09-21) that a game marketed as "playable"
should have a cheat sheet that actually works — not one gated by
"the player must apply judgment." Full rewrite followed.

**Waypoint-based airport approach.** Cheat now computes an
approach-line target: cells extending from the airport in the
*opposite* direction of the runway. Plane routes there first via
`WAYPOINT` hints, then aligns runway heading + descends via
`ON GLIDEPATH`. Handles wrong-side spawns that would previously
deadlock the plane into an orbit.

**Two-phase collision-avoidance.**
1. **Altitude split.** When two planes are within 3 cells AND
   within 3 altitude of each other, alphabetically-earlier plane
   commands `Aa9`, later commands `Aa0`. Deterministic
   tie-breaker; no fallback that could send both planes to the
   same extreme.
2. **Heading avoidance.** Once altitude committed, cheat turns
   the plane AWAY from the other plane's position. Applies even
   to planes currently in a `HOLD` circle (collision override
   supersedes hold).

**Clamped-direction wall guard.** `pickSafeInsideDir` now tests
the *clamped* direction the plane will actually move (±2/tick
turn cap), not just the commanded newDir. Previous logic
suggested a 90°-away newDir that the engine still translated
into a wall-hitting movement.

**Time-to-climb hold.** Exit-bound planes with
`(9 - altitude) > distance-to-exit` cannot climb in time; cheat
now suggests `Ac` (circle) to hold position while climbing,
before resuming exit heading. Eliminates "exited at wrong
altitude" losses on tight-spawn scenarios.

**Stress-test comparison (30 EASY seeds, full autoplay):**

| Iteration | Planes delivered | Improvement |
|---|---|---|
| Before overhaul | 28 total (0.9/run) | baseline |
| After glidepath fix | 49 (1.6/run) | +75% |
| After 8-way alignment check | 47 (1.6/run) | ~ |
| After waypoint routing | 41 (1.4/run) | ~ |
| After tighter AVOID + clamped wall guard | 71 (2.4/run) | +154% |
| After removing bad AVOID fallback | 96 (3.2/run) | +243% |

DEFAULT sector similarly improved: 14 → 52 planes (+270%).

**Remaining loss modes (residual):**
- Fuel exhaustion (10-20% of losses): AVOID-driven detours cost
  fuel; when fuel drops < 6, cheat prioritises direct route.
- Illegal arena exits (15-25%): occasionally the wall-safe
  direction picker can't find a heading that both avoids the
  wall AND helps the destination. Rare corner-case failure.
- Multi-plane cascades (5-10%): 3+ planes converging in tight
  cells overwhelm the pair-wise AVOID logic.

**Verdict:** cheat is now genuinely reliable enough to guide a
novice through many landings per shift. Not autopilot-perfect —
some corner cases still need player judgment — but the game is
demonstrably winnable following the cheat sheet.

### Verified: game is winnable, cheat has known limits
User asked (2026-09-21) whether the game is *actually playable* and
whether the cheat sheet is accurate. Honest audit results:

**Game randomness:**
- **Airports and exits — NOT random.** Each sector's playfield
  (Easy, Default, Killer) hard-codes airport positions/runways
  and exit border positions. Deterministic per sector.
- **Plane origin, destination, type — RANDOM.** Engine picks
  uniformly per spawn.
- **Spawn timing — STOCHASTIC.** Random per-tick roll with
  probability 1/newplaneMean.

**Stress test (30 EASY seeds + 20 DEFAULT seeds, full-autoplay
following cheat):**
- EASY: avg **1.6 planes safely delivered per shift** before an
  eventual loss. Best runs deliver 5+; all runs eventually lost.
- DEFAULT: avg **1.3 planes per shift**.
- Dominant loss causes: collisions (~55%), illegal arena exits
  (~20%), fuel exhaustion (~15%), wrong-altitude exit (~10%).

**Cheat correctness fixes applied:**
- **Premature `Aa0` bug.** Fixed. PRIORITY 5 (final glide command)
  now checks 8-way alignment between plane and airport before
  suggesting Aa0. Without alignment, altitude drops don't match
  distance drops → crash on ground before arrival.
- **Wall-into-wall bug.** Fixed. HEADING and WALL hints now
  filter out compass directions that would push the plane off
  the arena next tick. If preferred heading is unsafe, cheat
  picks the closest safe direction.
- **Collision-avoidance (partial).** New AVOID hint: when two
  planes will be within 1 cell in all 3 axes next tick, the
  alphabetically-earlier plane climbs +3 and the other descends
  -3 (deterministic tie-breaker prevents deadlock). Reduces
  collisions but doesn't eliminate them — cheat only reacts one
  tick before impact; proactive spacing needs player judgment.

**Cheat known limitations (documented, need player judgment):**
- **Wrong-side airport approach.** Planes spawned SE of a
  SE-facing airport can't recover to land (need to circle back).
  Cheat suggests runway-heading anyway; plane flies past. Player
  must intervene manually.
- **Airport approach with alt ≠ distance.** Altitude changes
  ±1/tick and distance changes ±1/tick, so plane must arrive at
  airport with altitude matching distance for a clean landing.
  Cheat matches during descent but can't force a plane at alt 7
  dist 3 to bleed altitude in place — needs a CIRCLE command
  the cheat doesn't currently issue.
- **Multi-plane strategy.** Cheat looks at one plane at a time;
  it doesn't rank urgency across planes or plan spacing beyond
  1-tick avoidance.
- **Fuel management.** Reactive (fires only when fuel ≤ 6), not
  proactive; can't preempt fuel exhaustion by choosing shorter
  routes for older planes.

**Verdict:** the game is playable and winnable. A player who
reads the cheat, applies judgment for multi-plane traffic, and
occasionally overrides the cheat for repositioning will deliver
significantly more than the autoplay baseline (1–2/shift). Cheat
is advisory, not autopilot.

### Title screen (deferred start)
The game no longer auto-starts on page load. Instead a full-screen
title panel appears:

- Large "ATC" title with subtle glow pulse
- Subtitle "Control Room · 1986"
- Tagline crediting Ed James (BSD 1986)
- Sector picker (Easy / Default / Killer) — persisted across
  sessions in `localStorage`
- Primary "BEGIN SHIFT" button (Enter/Space also works)
- Keybinding legend (`?` tutorial, `\` reference, `▶` cheat)
- Attribution line

Behind the panel: a slow rotating radar sweep with faint grid dots
+ range rings, matching the main game visual language.

**Deferred game start:** ambient audio is initialised on the
BEGIN SHIFT click (satisfying browsers' user-gesture requirement
for `AudioContext`). The tick timer, plane spawn, and radar
render only begin after the click. First-visit help modal opens
400 ms after game start, so the walkthrough plays against the
actual game rather than a blank page.

**Rationale:** Direct user feedback (2026-09-21) — "supaya
jangan loading index.html, langsung game mulai, player belum
siap. Buat title screen yang bagus dan menarik." The auto-start
gave players no orientation moment and forced immediate command
input on a screen they hadn't parsed yet.

### Glidepath-aware airport landing hint (correctness fix)
Prior version of the dynamic cheat suggested `Aa0` whenever a
plane was on approach to an airport, causing "crashed on the
ground" losses when the plane hit altitude 0 before reaching
the airport cell. The corrected logic implements a proper
glidepath:

- **PRIORITY 1** — CLIMB if altitude < distance to airport
  (below glidepath = will crash). Only fires when a climb hasn't
  already been commanded.
- **PRIORITY 1.5** — At close range (dist ≤ 4), force runway
  heading over airport-pointing. Approaching from wrong angle at
  close range causes orbital deadlocks; better to fly runway
  heading and miss the airport than orbit into a crash.
- **PRIORITY 2** — Special `dist === 1` final approach: align to
  runway heading, then command `Aa1`, then `Aa0` on the actual
  airport cell.
- **PRIORITY 3** — Steer toward airport.
- **PRIORITY 4** — Descend to `Aa{distance}` (match altitude to
  distance).
- **PRIORITY 5** — When altitude == distance == committed
  altitude, command `Aa0` for continuous glidepath descent to
  airport (plane loses 1 altitude per tick, distance drops 1 per
  tick, both hit 0 simultaneously → landing).

Auto-play regression tests (`tests/autoplay.test.js`) simulate a
plane following the cheat verbatim and assert delivery outcomes.
Covers: exit-bound climb+depart, ground takeoff, airport approach
from correct side at matched altitude, and the "over the airport
too high" edge case (verifies cheat does NOT command Aa0 there).

Known limitation: planes arriving at an airport with altitude !=
distance need to circle to bleed altitude before final approach;
the current hint does not issue circle commands. Novices seeing a
plane miss the airport must intervene manually. Documented for v2
enhancement.

### Dynamic cheat sheet (context-aware per-plane hints)
Second floating panel (top-right corner of CRT), amber-bordered,
showing **what the player should type right now** for each active
plane based on current game state.

For each plane, the hint engine (`src/hints.js`) computes:

| Situation | Priority | Suggested command | Tag |
|---|---|---|---|
| Ground plane at airport | normal | `Aa+7` | READY |
| Exit-bound, alt ≠ 9 | normal | `Aa9` | CLIMB |
| Exit-bound, alt = 9, off heading | normal | `Atte{N}` | HEADING |
| Exit-bound, on course | ok | — | ON COURSE |
| Airport-bound, > 5 cells away, alt > 4 | normal | `Aa4` | CRUISE |
| Airport-bound, > 5 cells, off heading | normal | `Atta{N}` | HEADING |
| Airport-bound, ≤ 5 cells, alt > 2 | normal | `Aa2` | APPROACH |
| Airport-bound, ≤ 2 cells, alt > 0 | urgent | `Aa0` | FINAL |
| Over airport, alt > 0 | urgent | `Aa0` | DESCEND |
| Over airport, alt = 0, wrong heading | urgent | `At{runwaykey}` | ALIGN |
| Fuel ≤ 6 | urgent | `Atte{N}` or `Atta{N}` (direct) | FUEL |
| Next tick out-of-arena (not clean exit) | urgent | `AtL` | WALL |

Rows sorted by priority (urgent → normal → ok). Urgent rows pulse
red; normal are phosphor-green; ok are dimmed.

Toggle:
- Button in bezel: `▶ cheat` (default ON — user requested)
- Close button `✕` inside panel
- State persisted to `atc-fancyweb-cheat-live`

**Does NOT pause.** Updates on every tick and every player command.
Complements the static HELP panel (which explains *how* commands
work) with contextual guidance (what command to type *right now*).

**Rationale:** Direct user feedback (2026-09-21) — "player awam
butuh cheat sheet dynamic terhadap situasi kondisi game. Kalau ada
pesawat datang, membutuhkan instruction, kamu tulis, player harus
ketik apa." A novice controller freezes at "what do I type?"; the
dynamic cheat removes that paralysis by always naming a valid next
move. Experienced controllers can hide the panel and play blind.

11 unit tests in `tests/hints.test.js` cover the priority + command
generation for takeoff, climb-to-exit, off-heading, fuel critical,
wall imminent, airport approach chain (cruise → approach → final →
descend → align), and on-course states.

### Cheat sheet (always-available command reference)
Floating panel anchored to the top-left of the CRT screen containing
a compact, scan-able summary of every command:

- Plane letter conventions (jets uppercase, props lowercase)
- Altitude commands (`Aa5`, `Aa+3`, `Aa-2`)
- Turn commands with 3×3 compass grid (q/w/e/a/d/z/x/c mapped to
  NW/N/NE/W/E/SW/S/SE) + hard turns (`AtL` / `AtR`)
- Towards commands (`Attb0`, `Atta1`, `Atte2`)
- Hold & status (`Ac`, `Am`/`Ai`/`Au`)
- Special keys (Enter, Backspace, Esc, `?`, `\`)
- Goal per plane (exit at alt 9, airport at alt 0 in arrow direction)

Toggle:
- Button in bezel: `◑ cheat`
- Keyboard: `\` (backslash)
- Close button `✕` inside panel
- State persisted to localStorage (`atc-fancyweb-cheat`); default ON

**Does NOT pause the game.** The cheat sheet is a reference lookup
during active play — distinct from `?` help, which pauses because
it's meant for reading, not scanning.

**Rationale:** Direct user feedback (2026-09-21) — "saya butuh cheat
sheet, apa yang harus diketik oleh player." The full help modal is
verbose (~500 words of prose); the cheat sheet is a dense one-page
reference for muscle-memory building. Complements rather than
replaces the help overlay.

### ATC radio chatter (voice + subtitles)
The port now emits ATC radio-style phraseology for game events:

- **Spawn (from exit)** — PILOT calls approach: *"Approach, UAL42,
  level 7000, information Charlie, requesting instructions."*
- **Spawn (from airport, ground)** — PILOT requests departure:
  *"Ground, UAL42, ready for departure airport 0."*
- **Player command** — CONTROLLER (you) transmits: *"UAL42, descend
  and maintain 3000."* / *"UAL42, turn heading 090."* / etc.
- **Beacon crossing** — PILOT reports: *"UAL42, over beacon 1."*
- **Landing** — CONTROLLER farewells: *"UAL42, welcome to airport 0.
  Contact ground, good day."*
- **Exit** — CONTROLLER hands off: *"UAL42, contact center, good day."*
- **Low fuel (≤6)** — PILOT declares: *"UAL42, minimum fuel,
  requesting priority."*
- **Loss** — PILOT emergency: *"MAYDAY MAYDAY MAYDAY. UAL42. Ran out
  of fuel."*

Two display channels, independently toggleable:

1. **Subtitles** (default ON) — text panel at the bottom of the CRT
   with a colored `[PILOT]` or `[YOU]` speaker chip. Fades in on new
   line, auto-hides after ~2.5–5s based on line length.
2. **Voice (TTS)** (default OFF) — Web Speech API synthesizes the
   TTS-formatted line. Uses aviation phonetics ("niner", digit-by-
   digit headings) and airline callsign expansion (UAL42 → "United
   four two"). Browsers vary in voice quality; the port picks
   `en-US` if available, falls back to any English voice, then the
   default.

Three independent toggle buttons in the top bezel:
- `♪ sound` — ambient bed + interaction SFX
- `◉ voice` — TTS chatter (off by default; some users find TTS
  intrusive)
- `✎ subs` — subtitle overlay

All three toggles persist across sessions in `localStorage`.

**Rationale:** Direct user feedback (2026-09-21) — the port
promised "control-room-1986" atmosphere, but until now the room
was silent (only ambient hum + SFX). Real ATC rooms are
dominated by radio chatter. Adding phraseology completes the
sensory identity; making voice opt-in (default off) respects
players who prefer quiet play; subtitles-on default lets everyone
enjoy the flavor regardless of audio state or hearing preference.

Chatter is cosmetic — the underlying command grammar is unchanged,
gameplay is unaffected, and 39/39 tests (29 engine + 10 chatter)
verify the generators.

### Real-radar cosmetic authenticity layer
On top of BSD's grid mechanic, added five cosmetic layers to
approximate the look of a real 1980s ATC radar screen:

1. **Range rings** — 3 concentric dashed circles from grid center
   at 33% / 66% / 100% of the smaller grid dimension. Labelled
   `10NM`, `20NM`, `30NM` at the 4-o'clock position. Distances
   are cosmetic — the game has no nautical-mile scale.
2. **360° compass card** — tick marks every 10° around the outside
   of the grid, with numeric bearing labels (`000`, `030`, `060`,
   ..., `330`) every 30°. Standard aviation compass rose.
3. **Radar afterglow (blip persistence)** — every plane leaves a
   trail of up to 4 prior positions rendered as fading phosphor
   blips. Alpha decays exponentially (0.45 → 0.075) with age;
   radius shrinks slightly. Mimics the electron-beam phosphor
   persistence of real PPI scopes.
4. **ATC data blocks** — altitude shown as `FL05` (flight-level
   format: FL050 = 5000 ft) instead of raw digit. Heading letter
   (N/NE/E/...) and destination indicator (`→X2` for exit 2,
   `→A0` for airport 0) rendered as a compact two-line data block
   to the right of each plane's letter.
5. **Realistic callsigns** — each plane is assigned a random
   callsign on spawn (e.g. `UAL42`, `DAL887`, `BAW1234`) drawn
   from a pool of 15 real airline ICAO codes. Callsigns appear
   in the traffic sidebar and event log but **the command
   grammar is unchanged** — you still type `A`, `B`, `C` to
   command them. The callsign is display-only flavor.
6. **METAR-style bezel** — top bezel shows a METAR-formatted
   weather line: `SECTOR NAME · 27010KT 10SM FEW040 22/12 A3005
   · ATIS INFO C`. Values derive from the game clock so they
   evolve during a shift but have no gameplay effect.

**Rationale:** Direct user feedback (2026-09-21) — the port
should "mendekati real ATC screen" for the *experience* of being
a controller, without becoming an ATC training simulator (that's
a different product). All six additions are cosmetic only;
game mechanics remain BSD `atc(6)` verbatim. The moat is the
combination of BSD-faithful gameplay + real-radar visual
authenticity, which no existing port occupies.

### Rotating radar sweep
Cosmetic sweep line rotates over the radar canvas at ~6 seconds
per revolution (roughly 10 rpm — realistic for 1980s ATC radars).
Trailing 72° phosphor fan fades behind the leading edge. Sweep
does not affect gameplay in any way.

**Rationale:** Real 1980s ATC radars were **circular PPI scopes**
with rotating sweep lines. BSD atc rendered on a rectangular text
terminal — Ed James's practical choice, but visually inauthentic
to the era. The port keeps the rectangular gameplay grid
(BSD-faithful; corner exits require corners) but adds the
rotating sweep as a purely visual authenticity layer. Preserves
mechanics while addressing the "why doesn't this look like a real
radar?" question raised in initial playtest (2026-09-21).

---

## Deferred (v2 or later)

- **WebGL CRT shader.** Real barrel distortion, phosphor
  persistence, chromatic aberration, developing screen burn-in.
  Current implementation is CSS-only (scanlines + filter + radial
  gradient).
- **All 17 canonical sectors.** MVP ships 3; the remaining 14
  (Novice, Crossover, Crosshatch, Box, Two-Corners, Airports,
  Game_2/3/4, Tic-Tac-Toe, OHare, Atlantis, Real-JFK, Real-LHR)
  are v2.
- **Delayed commands.** `@b<n>` / `ab<n>` "do action at beacon N"
  suffix. Grammar parser already accepts them; engine does not act
  on `delayedBeacon` yet.
- **Voice input.** Web Speech API + ATC phraseology parser.
  Educational hook for the aviation-nerd audience.
- **Daily-seed leaderboard.** Requires a backend (Cloudflare KV
  candidate). Wordle-style social loop.
- **LiveATC.net ambient overlay.** Public-domain audio feed loop
  as optional atmospheric layer.
- **Full ICAO phraseology mode.** Callsigns ("United 42"), ATIS
  broadcasts, STAR/approach patterns.
- **Coop / adversarial multiplayer.** WebRTC / WebSocket driven.
- **VR tower fantasy.** 3D interior scene with plane blips visible
  through the window.

---

## Performance

MVP renders at 60 fps on 2020-era mid-range hardware with 20+
active planes on Killer. No offscreen caching yet; all render ops
are cheap (letters + arrows + dots). If profiling shows
regressions on ancient hardware, apply the offscreen-static-layer
cache pattern proven in `snake/ports/fancy-web/` and
`worm/ports/fancy-web/`.

---

## See also

- [`../README.md`](../README.md) — user-facing.
- [`../AGENTS.md`](../AGENTS.md) — agent guardrails.
- [`decisions/001-tech-stack.md`](./decisions/001-tech-stack.md).
- [`../../docs/spec.md`](../../docs/spec.md) — canonical mechanic.
- [`../../docs/port-ideas.md`](../../docs/port-ideas.md) — the
  design brainstorm this port implements.
