# atc · fancy-web

> A **spiritual successor** to BSD `atc(6)` (Ed James, 1986), reimagined
> as a *Control Room 1986* browser simulator: curved CRT phosphor
> radar, typed command grammar, ambient console audio, and a shift
> that expects you to think like a controller — not click like a
> mobile-game player.

[![status](https://img.shields.io/badge/status-released-brightgreen)](../../../../docs/progress.md)
[![style](https://img.shields.io/badge/style-fancy--web-ff00ff)](../../../../docs/decisions/006-multi-port-architecture.md)
[![license](https://img.shields.io/badge/license-MIT-blue)](../../../../LICENSE)

| | |
|---|---|
| ![Title screen: ATC, Control Room · 1986, the Easy / Default / Killer sector picker and a Begin Shift button](./media/01-title.png) *The title screen: pick a sector, begin the shift.* | ![The radar during a shift: sweep line, range rings, exits and airports, two planes with data blocks; the traffic list and event log on the right, the command line below](./media/02-radar.png) *On shift: the phosphor radar, the traffic strips, the typed command line.* |

## Play

Open [`index.html`](./index.html) in any modern browser. No build
step, no server, no dependencies.

**First time?** A comprehensive how-to-play overlay auto-opens on
first visit — explains every screen element, panel, key, and rule.
Press <kbd>?</kbd> anytime to re-open it, or click the `? help`
button in the top bezel.

The page loads a CRT-styled console with:

- A curved phosphor-green radar screen with a rotating sweep line
  (~6-sec revolution, cosmetic — doesn't affect gameplay)
- A live traffic panel with each plane's origin, destination, altitude,
  heading, and fuel (right sidebar)
- A shift-timer + next-tick countdown
- A command line at the bottom with live parse hints
- A live event log tracking spawns, landings, exits, and losses

### Controls

Type commands **character by character**. There is no separate
"enter plane letter, then command" flow — you build the command
incrementally, and the hint line under the command shows valid next
tokens after every keystroke.

**Grammar** (subset of BSD `atc(6)`, per
[`../../docs/spec.md`](../../docs/spec.md)):

| Keystrokes | Meaning |
|---|---|
| `Aa5` | Plane A, set altitude to 5000 ft |
| `Aa+3` | Plane A, climb 3000 ft from current altitude |
| `Aa-2` | Plane A, descend 2000 ft |
| `Atw` | Plane A, turn to compass **N** (`w` in `qwedcxza` layout) |
| `Ate` | Plane A, turn to **NE**  ·  `Atd` = E  ·  `Atc` = SE ... |
| `AtL` | Plane A, hard left (90° counter-clockwise) |
| `AtR` | Plane A, hard right (90° clockwise) |
| `Attb0` | Plane A, turn toward beacon 0 |
| `Atta1` | Plane A, turn toward airport 1 |
| `Atte2` | Plane A, turn toward exit 2 |
| `Ac` | Plane A, circle (currently right/clockwise) |
| `Am` / `Ai` / `Au` | Plane A, mark / ignore / unmark |
| **Enter** (empty) | Force an immediate tick (BSD-faithful) |
| **Enter** (with cmd) | Execute the command |
| **Backspace** | Delete last character |
| **Escape** | Clear the buffer (or close help modal) |
| **?** | Toggle the how-to-play overlay |

The 8-direction compass uses BSD's `qwedcxza` layout:

```
    q w e
     ↖↑↗
    a . d
     ↙↓↘
    z x c
```

### Sector selection

Pick a sector from the top-right sidebar. Each sector has its own
tick rate, spawn frequency, arena size, and feature layout — all
per Ed James's original playfield DSL, ported from
[`../../data/games/`](../../data/games/).

## What is this game?

BSD `atc(6)`, from Ed James's 1986 BSD contribution, is a
**typed-command radar simulator**. You are an air traffic
controller. Planes spawn at exits and airports, you route them
to their destinations by typing commands between tick updates,
and you lose the moment any plane crashes, runs out of fuel,
exits at the wrong altitude, lands wrong-way, or leaves the
arena illegally.

This port keeps the mechanic verbatim and modernises the
delivery. See
[`docs/diff-log.md`](./docs/diff-log.md) for what was preserved,
changed, added, or deferred.

**Positioning:** we live in the *BSD-lineage* typed-radar slot
(see [`../../docs/port-ideas.md`](../../docs/port-ideas.md)
§Competitive Landscape), **not** the Flight Control / Air
Control / Air Control Lite mobile-touch-drag lineage. If you
came here expecting to drag paths with your finger, this is a
different game — and probably not the one you meant.

## Tech stack

- **Vanilla JavaScript** (ES modules, no framework, no bundler)
- **Canvas 2D API** for radar rendering (no WebGL yet — CSS
  scanline overlay + drop-shadow filter is enough for MVP)
- **Web Audio API** for the ambient console bed and interaction
  SFX (procedural — no assets)
- **Google Fonts** (VT323, Share Tech Mono) via preconnect
- **No dependencies.** No `node_modules`, no build step.

Rationale: see
[`docs/decisions/001-tech-stack.md`](./docs/decisions/001-tech-stack.md).

## Documentation

- **[`docs/diff-log.md`](./docs/diff-log.md)** — feature-by-feature
  narrative of what was kept, changed, added, or deferred vs BSD
  `atc(6)`.
- **[`docs/decisions/`](./docs/decisions/)** — port-level ADRs.
- **[`docs/test-scenarios.md`](./docs/test-scenarios.md)** — manual
  acceptance tests (spawn, altitude change, direction change,
  collision loss, exit-at-altitude success, etc.).
- **[`tests/engine.test.js`](./tests/engine.test.js)** — Node
  `node:test` unit tests for the headless engine (29 tests as
  of 2026-09-21 · run: `node --test tests/`).

## Canonical game docs

At [`../../docs/`](../../docs/) — the same for every port of
`atc`. [`../../docs/spec.md`](../../docs/spec.md) is the
mechanical contract every port must honour.

## Attribution

- **Original BSD `atc(6)`** © Ed James (UC Berkeley, 1986;
  BSD 3-clause).
  Upstream: <https://github.com/vattam/BSDGames/tree/master/atc>.
- **Port design and implementation:** Agun Wijaya + Claude Opus.

## Roadmap

**v1 (this MVP):**
- ✅ Headless engine faithful to `spec.md`
- ✅ Canvas 2D radar with CRT phosphor look (CSS-based)
- ✅ Rotating radar sweep line (cosmetic — real-1980s-radar aesthetic)
- ✅ Range rings (10NM/20NM/30NM concentric)
- ✅ 360° compass card around border (tick marks every 10°, bearings every 30°)
- ✅ Radar afterglow / blip persistence (4-position phosphor trail)
- ✅ ATC data blocks: `FL050` altitude + heading + destination
- ✅ Realistic callsigns (UAL42, DAL887, etc. — display only)
- ✅ METAR-style bezel with rotating ATIS
- ✅ Typed command grammar with live hints
- ✅ 3 built-in playfields (Easy, Default, Killer)
- ✅ Ambient audio bed + interaction SFX
- ✅ Shift timer + next-tick countdown
- ✅ Comprehensive how-to-play overlay (auto-shows on first visit)
- ✅ Pause on help open
- ✅ ATC radio chatter with subtitles + optional voice (Web Speech TTS)
- ✅ 3 independent toggles (sound / voice / subs), persisted to localStorage
- ✅ Static HELP panel — command reference (\ key toggle)
- ✅ Dynamic CHEAT panel — context-aware per-plane hints (▶ cheat)
- ✅ Title screen — deferred game start; sector picker; radar animation
- ✅ Auto-play landing tests — hint verified by simulation
- ✅ Full-game stress tests — 50 random seeds across EASY + DEFAULT
- ✅ Cheat: collision-avoidance (AVOID hint), wall-avoidance in HEADING
- ✅ 64/64 tests pass (30 engine + 10 chatter + 14 hints + 5 autoplay + 4 stress + 1 regression)

## Cheat reliability

The dynamic cheat is verified by autoplay stress tests (30 EASY
seeds + 20 DEFAULT seeds, all planes controlled by the cheat):

- **EASY: avg 3.2 planes delivered per shift** (max ~8)
- **DEFAULT: avg 2.6 planes delivered per shift** (max ~6)

Full audit trail of iterative improvements (28 → 96 planes over
30 EASY runs, 3.4× improvement) in
[`docs/diff-log.md`](./docs/diff-log.md).

The cheat covers:

- **Exit-bound planes** — CLIMB to alt 9 with time-to-climb HOLD
  (circle in place if there's not enough distance to reach alt 9).
- **Airport approaches** — waypoint routing to approach line +
  runway alignment + glidepath descent.
- **Collision avoidance** — two-phase (altitude split +
  heading-away) when planes converge within 3 cells and 3 alt.
- **Fuel emergencies** — direct-to-destination when fuel ≤ 6.
- **Wall avoidance** — clamped-direction wall guard prevents
  suggesting turns the engine will interpret as flying into walls.

Residual limitations (documented, ~10-15% of shifts):
- Multi-plane cascades (3+ planes converging tightly)
- Long AVOID sequences that burn fuel
- Edge cases where no wall-safe heading matches destination

A human player following the cheat + applying judgment on
priority-ordering delivers many more planes than autoplay.

**v2 (deferred):**
- WebGL CRT shader (barrel distortion, phosphor persistence,
  chromatic aberration, screen burn-in)
- All 17 canonical playfields
- Voice-command input via Web Speech API (ATC phraseology
  teaching mode)
- Daily-seed global leaderboard (needs server; Cloudflare KV
  candidate)
- LiveATC.net ambient background feed integration
- Delayed commands (`@bN` / `abN` — do action at beacon N)
- Full ICAO phraseology mode (callsigns, ATIS, STAR/approach
  patterns)

**v3 (stretch):**
- Cooperative multiplayer (2-4 controllers share a sector)
- Adversarial "Godmode" (one player controls spawn generator)
- VR tower fantasy

## License

MIT, matching the repository default.
