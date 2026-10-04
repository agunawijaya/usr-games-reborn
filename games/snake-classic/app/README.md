> **Upstream history.** This is the README the port shipped with before it joined /usr/games Reborn
> as **Talon's Shadow** (`snake-classic`). On adoption its eight looks became the regions of an
> expedition, each with its own bird, contracts and stamps, a field book and a Daily Flight were
> added around the flight, its look pills were hidden, and a few bugs were fixed (the lock-on ring
> now follows the snake; being caught no longer sets a best). Its screenshots were not carried
> over; see `../docs/` for the game as it is now.

# snake · fancy-web

> A **spiritual successor** to BSD `snake(6)`, reimagined as a
> visual-first browser game. Cyan-and-magenta neon grids, golden
> savannas, deep midnight forests, folded-paper origami dioramas —
> eight cosmetic themes, one game. Collect apples, dodge the
> eagle (or the owl, depending on where you play), escape via any
> edge with what you've gathered.

[![status](https://img.shields.io/badge/status-released-brightgreen)](../../../../docs/progress.md)
[![style](https://img.shields.io/badge/style-fancy--web-ff00ff)](../../../../docs/decisions/006-multi-port-architecture.md)
[![license](https://img.shields.io/badge/license-MIT-blue)](../../../../LICENSE)

## Play

Open [`index.html`](./index.html) in any modern browser.

That's it. No build step, no server, no dependencies. Drag the
file into Chrome or Firefox, or double-click. All 8 themes,
gameplay, and best-score persistence work offline.

### Controls

- **`W A S D`** or **`↑ ← ↓ →`** — steer the snake
- Any key on Game Over screen — restart (after 550 ms lockout)

### Themes

Click any pill at the top of the page:

| # | Theme | Palette | Enemy variant |
|--:|---|---|---|
| 1 | **Neon Grid** | cyan / magenta / navy | eagle |
| 2 | **Savanna** | sky / dry grass / green | African fish eagle |
| 3 | **Jungle** | canopy green | harpy eagle |
| 4 | **Desert** | pale sand / warm gold | pale hawk |
| 5 | **River** | water blue gradient | osprey |
| 6 | **Aztec** | terracotta / gold / turquoise | Mexican-flag eagle |
| 7 | **Origami** | cream / coral / pastel | paper eagle |
| 8 | **Midnight** | deep purple / silver | horned owl 🦉 |

Screenshots of the game as it is now are in [`../docs/media/`](../docs/media/) (the port's own were
not carried over).

## What is this game?

BSD `snake(6)`, from the classic BSDGames suite (Berkeley, 1980s),
is a **chase game** — not the Nokia growing-snake most people know.
The player controls a character on a text grid, collects money
scattered across the map, and escapes off any edge to keep their
winnings. A goblin (`~`) hunts them from the moment they start.

This port keeps those mechanics verbatim and modernizes
everything else:

- Money `$` → **apple** (theme-dependent variants)
- Goblin `~` → **eagle** (with a **shadow-warning** system) or
  **owl** in Midnight
- Text grid → **canvas** with retro-modern aesthetics
- Discrete grid-step motion → **spring-follow continuous slither**
- Single-character player `I` → **45-segment slithering body**
  with wave physics, tapered gradient, and a flicking tongue

## Tech stack

- **Vanilla JavaScript** (no framework, no bundler)
- **Canvas 2D API** (procedural rendering — zero raster assets)
- **CSS 3** (light-mode gallery frame around the canvas)
- **localStorage** (best-score persistence across sessions)

**No dependencies.** The entire game is ~1900 lines of code in
one HTML file. Runs offline once loaded.

Why single-file? See
[`docs/decisions/fancy-web-003-shipping-format.md`](./docs/decisions/fancy-web-003-shipping-format.md).

## Documentation

- **[`docs/diff-log.md`](./docs/diff-log.md)** — feature-by-feature
  narrative of what was kept, changed, added, or deferred vs the
  BSD original.
- **[`docs/decisions/`](./docs/decisions/)** — port-level ADRs:
  - [`fancy-web-001-spec-deviations.md`](./docs/decisions/fancy-web-001-spec-deviations.md)
    — visual reinterpretation authorized under
    ADR-002 (spiritual successor) and ADR-006 (`fancy-web` style).
  - [`fancy-web-002-additive-features.md`](./docs/decisions/fancy-web-002-additive-features.md)
    — cosmetic themes, eagle state machine, particle effects,
    localStorage persistence.
  - [`fancy-web-003-shipping-format.md`](./docs/decisions/fancy-web-003-shipping-format.md)
    — why single-file HTML now, Vite + TypeScript later.
- **[`docs/test-scenarios.md`](./docs/test-scenarios.md)** —
  port-specific manual acceptance tests (theme switch, restart,
  edge escape, apple pickup, eagle dodge, localStorage).

## Canonical game docs

At [`../../docs/`](../../docs/) — the same for every port of
`snake`. `spec.md` is the mechanical contract every port must
honor.

## Performance

- **Target:** 60 fps on 2020-era mid-range laptop, all 8 themes.
- Achieved via two techniques:
  1. **Single-pass body glow** — the whole snake is drawn as one
     stroke path with shadow, not 45 separate shadow-blurred
     fills. Cuts shadow-blur ops by 45× on high-glow themes.
  2. **Offscreen static-layer cache** — background gradient,
     vignette, grid lines, grid dots (with glow), and Midnight's
     moon are rendered once per theme into an offscreen canvas
     and blitted each frame. Removes ~330 shadow-blur ops per
     frame on Neon Grid and Midnight.

Details in [`docs/diff-log.md`](./docs/diff-log.md) §Performance.

## Attribution

- **Original BSD `snake(6)`** © UC Berkeley (BSD 3-clause).
  Upstream: <https://github.com/vattam/BSDGames/tree/master/snake>.
- **Reference silhouette** for the eagle sprite is *Eagle
  silhouette 4* by **SeriousTux** (2013), CC-PD, via
  [Openclipart](https://openclipart.org/detail/177436/eagle-silhouette-4-by-serioustux-177436).
  Used as a shape reference only — the port draws its own
  procedural eagle.
- **Port design and implementation:** Agun Wijaya + Claude Opus.

See root [`ATTRIBUTION.md`](../../../../ATTRIBUTION.md) for the
project-wide credit list.

## Future work

Deferred to a v2 iteration:

- **Vite + TypeScript** scaffolding (proper module structure,
  test tooling, hot-reload dev server)
- **PWA manifest + service worker** — installable via Chrome
  "Install app" or Safari "Add to Home Screen", offline-first
- **Touch controls** — swipe gestures for mobile
- **Sound design** — Tone.js synthesized or CC0 samples:
  eagle screech, apple crunch, ambient wind, strike thud,
  escape stinger
- **Automated test suite** — Vitest or Playwright for
  smoke/regression
- **Deploy** — Vercel / Netlify / GitHub Pages / Cloudflare Pages
  with a live URL, added to the port row in
  [`docs/progress.md`](../../../../docs/progress.md)
- **Difficulty settings** — eagle patience, apple count, snake
  speed
- **Streak / combo scoring** — bonus for chained pickups
- **Additional themes** — user-contributed palette contributions
- **Instructions modal** on first launch (i18n-ready)

## License

MIT, matching the repository default.
