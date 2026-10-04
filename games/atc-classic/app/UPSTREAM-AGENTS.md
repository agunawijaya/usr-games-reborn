> **Upstream history, not instructions.** This is the agent guide the game shipped with before it
> joined /usr/games Reborn. Nothing here overrides the repository rules in `CLAUDE.md` and
> `AGENTS.md` at the repo root; where they differ, the repository rules win.

# AGENTS.md — `atc / fancy-web`

Port-specific instructions for AI coding agents working on the
`atc` fancy-web port. Read the per-game
[`../../AGENTS.md`](../../AGENTS.md) and the root
[`AGENTS.md`](../../../../AGENTS.md) first.

## Port style

**fancy-web** per [ADR-006](../../../../docs/decisions/006-multi-port-architecture.md):
web-first, browser-native, visual-first reimagining of the
BSD original. Aesthetic + interaction paradigm may deviate from
the terminal source; mechanics must not.

## Identity anchor

**Control Room 1986.** Not "an ATC game" — a *simulator of being
an ATC in 1986*. Three atmospheric layers reinforce this:

1. **Visual** — curved CRT phosphor console with scanlines, dot
   grid, dim airway lines, glowing plane letters. Green/amber
   palette exclusively.
2. **Audio** — persistent ambient bed (40 Hz drone + 15.7 kHz
   scanline whine + slow LFO), interaction SFX (radar ping, key
   clack, spawn beep, loss klaxon, success chime). No music.
3. **Session framing** — you clock into a *shift*; the shift timer
   counts down; next-tick countdown shows.

Positioning explicitly: BSD typed-radar lineage, NOT
Flight-Control touch-drag lineage. See
[`../../docs/port-ideas.md`](../../docs/port-ideas.md) §Competitive
Landscape.

## Engine mechanics — must not deviate

Faithful to [`../../docs/spec.md`](../../docs/spec.md):

- **Tick order:** clock++, ground-to-air promotion, per-plane
  update (fuel, altitude ±1, direction ±2 clamp, move, delayed
  release, dest check, crash check), sweep gone, collision check,
  new plane roll. See `engine.js` `tick()`.
- **Direction system:** 0=N, 1=NE, ..., 7=NW. `MAXDIR` sentinel
  = circle.
- **Player commands mutate `newAltitude`, `newDir`, `status`,
  `delayed`, `delayedBeaconNo` only.** Never mutate `altitude`,
  `dir`, `xpos`, `ypos` directly.
- **Rate limits:** altitude ±1/tick, direction ±2/tick.
- **Props tick every other clock; jets every tick.**
- **Fuel = width + height at spawn.**
- **Enter altitude = 7; exit altitude = 9; land altitude = 0.**
- **Collision = |Δalt| ≤ 1 AND |Δx| ≤ 1 AND |Δy| ≤ 1.**
- **Max 26 concurrent planes** (letters A-Z).

If you edit `engine.js`, run `node --test tests/` and all 29 tests
must still pass.

## Command grammar

Subset of BSD grammar.y implemented in `parser.js`:

- `<plane>a<n>` — absolute altitude 0..9
- `<plane>a+<n>` / `<plane>ac<n>` — climb
- `<plane>a-<n>` / `<plane>ad<n>` — descend
- `<plane>t<key>` — turn to compass (qwedcxza)
- `<plane>tL` / `<plane>tR` — hard 90° turn
- `<plane>tt[bae]<n>` — turn towards beacon/airport/exit N
- `<plane>c` — circle
- `<plane>m` / `<plane>i` / `<plane>u` — mark/ignore/unmark

**Not yet implemented** (deferred to v2 per README roadmap):
- Delayed commands `@b<n>` / `ab<n>`
- Circle direction (`cl`/`cr`)
- `?` completion (partial hints work via the hint line already)

Preserve the `PARSE.OK / PARTIAL / ERROR` state machine so the UI
can show completion hints incrementally.

## Rendering guardrails

- Green phosphor `#5eff8a`, dim `#2a8a45`, bright `#c8ffdc`,
  amber `#ffb14f`, red `#ff5252`. No other hues.
- `VT323` for radar labels, `Share Tech Mono` for UI chrome.
- CRT effect is CSS-only in MVP: scanlines via
  `repeating-linear-gradient`, phosphor glow via `drop-shadow`
  filter, barrel distortion approximated by radial vignette.
  WebGL shader = v2.
- Never add colour outside the palette. Any additional visual
  layer must be explicitly authorised by a port ADR.

## Audio guardrails

- Ambient bed is procedural (Web Audio oscillators + filters).
  No sample assets in v1.
- No music.
- Every interaction should have a SFX cue (spawn, tick, command
  accept, command reject, land, exit, loss).
- Master volume respects the `♪ audio` toggle.

## What NOT to add

Per identity discipline:

- **Do not add touch-drag path input.** That belongs to the
  touch-and-drag mobile traffic games; it is not this game.
- **Do not colourise beyond the palette.** No blue skies, no
  purple accents.
- **Do not add music.** Real control rooms don't have music.
- **Do not add a story mode** in v1. Shift-based framing is the
  narrative.

## Testing

- **Engine:** `node --test tests/engine.test.js` — must all pass
  before shipping any change to `src/engine.js` or `src/parser.js`.
- **UI:** manual per `docs/test-scenarios.md` (TODO — v2).
- **Cross-browser:** verify in the major desktop browsers before
  release.

## File map

```
atc/ports/fancy-web/
├── index.html          # shell + CSS + <script type="module">
├── src/
│   ├── engine.js       # headless game engine (BSD-faithful)
│   ├── parser.js       # command grammar parser
│   ├── playfields.js   # built-in sectors (Easy, Default, Killer)
│   └── main.js         # DOM + input + render + audio orchestration
├── tests/
│   └── engine.test.js  # Node unit tests
├── docs/
│   ├── diff-log.md
│   ├── decisions/
│   │   └── 001-tech-stack.md
│   └── test-scenarios.md   # TODO
├── media/                  # port screenshots (TODO)
├── AGENTS.md
├── CLAUDE.md
└── README.md
```

## See also

- [`README.md`](./README.md) — user-facing.
- [`docs/diff-log.md`](./docs/diff-log.md) — decision narrative.
- Root [ADR-002 Porting Philosophy](../../../../docs/decisions/002-porting-philosophy.md).
- Root [ADR-005 Target Language & UI Stack](../../../../docs/decisions/005-target-language-and-ui-stack.md).
- Root [ADR-006 Multi-Port Architecture](../../../../docs/decisions/006-multi-port-architecture.md).

---

_The upstream `CLAUDE.md` only pointed to the file above._
