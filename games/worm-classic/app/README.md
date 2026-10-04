> **Upstream history.** This is the README the port shipped with before it joined /usr/games Reborn
> as **Orchard Crawl** (`worm-classic`). On adoption its eight looks became the orchards of a
> season, each with a harvest, a burrow to crawl home to and three stars; an almanac, records and a
> Daily Orchard were added around the crawl; its pickers moved into the desk’s free orchard, which
> plays as the port always did; and a few bugs were fixed (see `../docs/CHANGES-FROM-ORIGINAL.md`).
> Its screenshots were not carried over; see `../docs/` for the game as it is now.

# worm · fancy-web

> A **spiritual successor** to BSD `worm(6)` (Michael Toy, 1980) —
> the growing-worm game where you eat numbered fruit for score and
> length. Same **chained-bonus** and **progressive-growth** math
> as the original, wrapped in 8 cosmetic themes and a settings row
> for speed. Player-first UX: retro faithful, modern smooth.

[![status](https://img.shields.io/badge/status-released-brightgreen)](../../../../docs/progress.md)
[![style](https://img.shields.io/badge/style-fancy--web-ff00ff)](../../../../docs/decisions/006-multi-port-architecture.md)
[![license](https://img.shields.io/badge/license-MIT-blue)](../../../../LICENSE)

## Play

Open [`index.html`](./index.html) in any modern browser.

Double-click, drag to Chrome/Firefox — no build, no server, no
deps. All 8 themes, settings, and localStorage persistence work
offline.

### Controls

- **`W A S D`** or **`↑ ← ↓ →`** — steer the worm's head
- Any key on Game Over screen — restart (after 550 ms lockout)
- **Cannot** reverse 180° into own neck (spec-faithful)

### Modes

Two coexisting game modes — choose in the mode picker.

| Mode | What you get |
|---|---|
| **Pure** *(default)* | Spec-faithful BSD `worm(6)`: single apple on the grid, no enemies, no bonuses. Meditative preservation mode. |
| **Wild** | Arcade layer: 10-apple pool with rot state, always-on bonus frog, and up to four opt-in enemies (per checkbox). |

#### Wild-mode enemies (all opt-in, checkbox-toggled)

| Enemy | Behavior | Threat |
|---|---|---|
| 🐦 **Bird** | Thief that races you to the highest-value ripe apple. | Non-lethal — you only lose potential score if it steals first. |
| 🐝 **Wasps** | Emerges from an apple left rotting too long (20s ripe → 5s rotten). Chases your head at ~82 px/sec. | LETHAL on head-contact. One rotten apple + one wasp at a time. |
| 🪱 **Rival** | AI worm following the same rules as you — grows on apples, dies on wall/self, competes for food. | LETHAL body = wall (Ruleset A). Head-to-head = both die. Trap it to force its suicide. |
| 🧑‍🌾 **Gardener** | Rare (45-60s cycle) ground-walker that enters from the far edge and hunts the nearest head — you or the rival. | LETHAL on ~14px head-proximity. 25s hunt window then retreats. |

#### Fences

Optional static internal obstacles — pick a layout in the fence picker:

| | Name | Layout |
|---|---|---|
| — | **None** *(default)* | Empty grid |
| **H** | Single H | One H at grid center |
| **HH** | Double H | Two H's, symmetric around center |
| **+** | Cross | Plus sign at center |
| **□** | Box | Hollow square with 4 side openings |
| **≡** | Corridors | Two horizontal bars with center gap |

Fence cells are walls to the player, rival, and gardener. Wasp and bird pass over (airborne). Wooden post-and-rail aesthetic across all themes.

### Speed settings

Below the theme picker: three speed modes.

| Mode | Tick rate | Feel |
|---|---|---|
| **Classic  ·  3×** | 3 ticks / sec | Comfortable retro pace |
| **Fast  ·  6×** | 6 ticks / sec | Modern arcade |
| **Progressive  ·  3→6×** *(default)* | Starts at Classic (3/sec) when length = 5; ramps toward Fast (6/sec) at length 45+ | Natural difficulty curve |

*BSD `worm(6)` originally ticked at exactly 1× (1 sec/tick). That
felt uncomfortably slow in playtest, so the three modes here start
at 3× and above. If you want the pure-original feel, edit
`updateTickInterval` in [`index.html`](./index.html) — set
`interval = 1000` in the `classic` branch.*

Setting persists across sessions in localStorage.

### Themes

Same 8 as the sibling `snake/ports/fancy-web/` port:

| # | Theme | Palette |
|--:|---|---|
| 1 | Neon Grid | cyan / magenta / navy |
| 2 | Savanna | sky / grass / earth |
| 3 | Jungle | canopy green |
| 4 | Desert | pale sand / warm gold |
| 5 | River | water blue gradient |
| 6 | Aztec | terracotta / gold / turquoise |
| 7 | Origami | cream / coral / pastel |
| 8 | Midnight | deep purple / silver + moon |

Screenshots of the game as it is now are in [`../docs/media/`](../docs/media/) (the port’s own
were not carried over).

## What is this game?

BSD `worm(6)`, written by Michael Toy (co-author of Rogue) in
1980, is the **growing-worm** genre — you steer a worm on a
bounded grid, eat digit food (1-9) which grows your body by that
number of segments over the next N ticks, and try not to hit
walls or your own tail. Score accumulates via a **chained
bonus**: eat while still growing and the bonus stacks.

This port preserves the mechanics verbatim and modernizes
everything else:

- Digit character `7` → **apple with the digit "7" on it**, sized
  and colored by value
- Text grid on TTY → **canvas** with retro-modern aesthetics
- Static grid-step motion → discrete cell logic with **visual
  interpolation** between ticks
- Single control speed → **3 speed modes** as a user setting
- Zero polish → particles, glow, ambient drift, restart flow,
  8 cosmetic themes

## Tech stack

- **Vanilla JavaScript** (no framework, no bundler)
- **Canvas 2D API** (procedural rendering — zero raster assets)
- **CSS 3** (light-mode gallery frame)
- **localStorage** (best score + settings persistence)

**No dependencies.** ~1500 LOC in one HTML file. Runs offline.

Why single-file? See
[`docs/decisions/fancy-web-003-shipping-format.md`](./docs/decisions/fancy-web-003-shipping-format.md)
(same rationale as the snake port's ADR of the same number).

## Documentation

- **[`docs/diff-log.md`](./docs/diff-log.md)** — feature-by-feature
  narrative vs BSD original.
- **[`docs/decisions/`](./docs/decisions/)** — port-level ADRs:
  - [`fancy-web-001-spec-deviations.md`](./docs/decisions/fancy-web-001-spec-deviations.md)
    — visual reinterpretation under ADR-002 (spiritual successor)
    + ADR-006 (`fancy-web` style).
  - [`fancy-web-002-additive-features.md`](./docs/decisions/fancy-web-002-additive-features.md)
    — themes, settings, particles, persistence.
  - [`fancy-web-003-shipping-format.md`](./docs/decisions/fancy-web-003-shipping-format.md)
    — single-file HTML now, Vite + TS later.
- **[`docs/test-scenarios.md`](./docs/test-scenarios.md)** — port
  acceptance tests (chained bonus, progressive scaling, 180°-turn
  guard, wall death, etc.).

## Canonical game docs

At [`../../docs/`](../../docs/) — the same for every port of
`worm`. `spec.md` is the mechanical contract every port must honor.

## Performance

- **Target:** 60 fps on 2020-era mid-range laptop, all 8 themes.
- Techniques inherited from
  [`snake/ports/fancy-web/`](../../../snake/ports/fancy-web/):
  1. **Single-pass body glow** — the whole worm is drawn as one
     stroke path with shadow, then filled without shadow. Cuts
     shadow-blur ops by ~N× on high-glow themes.
  2. **Offscreen static-layer cache** — background gradient,
     vignette, grid lines, grid dots (with glow), Midnight's moon
     rendered once per theme; blitted each frame.

Details in [`docs/diff-log.md`](./docs/diff-log.md) §Performance.

## Attribution

- **Original BSD `worm(6)`** © UC Berkeley (Michael Toy, 1980).
  Upstream: <https://github.com/vattam/BSDGames/tree/master/worm>.
- **Port design and implementation:** Agun Wijaya + Claude Opus.
- **Visual toolkit** (single-pass glow, offscreen cache, theme
  system) originally developed for
  [`snake/ports/fancy-web/`](../../../snake/ports/fancy-web/) —
  reused here.

See root [`ATTRIBUTION.md`](../../../../ATTRIBUTION.md).

## Future work

Deferred to a v2 iteration:

- **Vite + TypeScript** scaffolding
- **PWA manifest + service worker** — installable + offline
- **Touch controls** — swipe gestures
- **Sound design** — Tone.js synth or CC0 samples (crunch on
  eat, warning as tick rate increases, thud on wall)
- **Automated test suite** — Vitest / Playwright
- **Deploy** — live URL published to progress dashboard
- **Growing indicator** — HUD count showing "N more segments
  coming"
- **HJKL running mode** — spec-faithful "hold Shift for burst
  speed" (currently not implemented)
- **Additional themes** — user-contributed palettes
- **Difficulty modifiers** — start length, grid size, apple value
  distribution
- **Streak / combo visualization** — highlight when chain-bonus
  triggers

## License

MIT, matching repo default.
