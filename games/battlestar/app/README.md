# `battlestar` — `fancy-web` port: *Battlestar — Pajamas to Paradise*

> David Riggle's 1979 Berkeley adventure, played exactly as it was — and
> finally seen. You wake in silk pajamas aboard a battlestar under
> attack, fly a Viper through a Cylon ambush to a tropical island, and
> go looking for a goddess. The engine is the original, proved byte for
> byte against the real program; every room is drawn from its own data
> by code. **Zero raster assets**: no image or sound file anywhere.

![The whole page on the village street: the 3D scene above the original text, the status panel beside it](./media/01-ui-village.png)
*The village street by day. The scene is composed from the room's description; the text below is the 1979 program's, unchanged; the panel tracks Pleasure, Power and Ego, your body, a heading-up compass and a fog-of-war map.*

| | |
|---|---|
| ![A luxurious stateroom panelled in dark wood, a window onto space](./media/02-ship-stateroom.png) *Room 22, where you wake: the stateroom, the view of darkest space.* | ![The landing bay under red alert, two Vipers on the deck](./media/03-ship-landing-bay-alert.png) *The landing bay while the Cylons attack.* |
| ![The dogfight: a raider bracketed in the reticle, gauges for torpedoes, fuel and the clock](./media/05-dogfight.png) *The dogfight: fly.c's rules in a 3D cockpit. Original spacecraft designs.* | ![Flying over the island at night](./media/07-air-night.png) *Over the island at night, a moon glade on the sea.* |
| ![A white coral beach under palms](./media/08-coast-day.png) *The coral beach.* | ![The village at night, torches and huts](./media/09-coast-night.png) *The village at night.* |
| ![Deep rainforest with light through the canopy](./media/10-forest-day.png) *In the woods.* | ![Thermal pools glowing in the night forest](./media/11-forest-night.png) *The thermal pools at night.* |
| ![A flooded mine tunnel lit by a lantern, crystals overhead](./media/12-cave-lantern.png) *Under the island, by lantern light: "the flooding is already up to my waist".* | ![The goddess seated on a golden throne in a cave chamber](./media/14-finale-throne.png) *The finale: the goddess's chamber.* |

## Status

- **Status:** Active (v1)
- **Author:** Agun Wijaya (<https://github.com/agunawijaya>), implemented with Claude
- **License:** MIT (repository default)
- **Live URL:** *(not deployed yet)*

## Pitch

`battlestar` has 275 rooms, a day that becomes a night that changes the
world, 13 kinds of injury, three scores (Pleasure, Power, Ego) with
titles from "novice" to "Marquis De Sade", and a curses dogfight in the
middle of a text adventure. In 1979 all of it was words. This port
keeps every word and every rule — the golden tests replay whole
winning games against the Debian binary and get the same bytes — and
adds what the words describe: the stateroom's wood and platinum, the
launch tube, the island from the air, beaches, a village, a rainforest
that closes over your head, thermal pools, caves you cannot see in
without a light, and a throne. It is all modelled, not boxed: turned
legs and tufted velvet, stairs that go through real openings to the deck
above, huts and cottages built plank by plank, and clothed people who
walk, work, dance and limp like people
([ADR-013](./docs/decisions/013-modelled-art-style.md)).

## Tech Stack

- **Language:** JavaScript (ES modules), GLSL ES 3.0
- **Framework:** none — vanilla ES modules, zero build; Three.js r186 vendored in `src/vendor/` ([ADR-001](./docs/decisions/001-tech-stack.md))
- **Rendering:** a procedural scene composer (room data → scene spec → biome kit), one standard material with procedural surfaces injected per family, Gerstner water, instanced flora, PMREM environments per mood, HDR post (bloom, ACES, grade, status effects, directional travel transitions)
- **Audio:** Web Audio, synthesised (noise, filters, oscillators) — ambience per place, incidentals, event sounds; muted by default
- **Target:** any modern desktop browser with WebGL 2; plays without a GPU and without WebGL (text mode)

## Run

No build step. Serve the folder with any static server:

```bash
cd bsdgames/battlestar/ports/fancy-web
node scripts/serve.mjs          # prints the URL (default http://localhost:8781/)
```

(Opening `index.html` from `file://` does not work: browsers block ES
module imports from disk.)

Useful URLs: `?seed=7` (a game seed; the same seed replays the same
game), `?fresh=1` (skip the title screen), `?wizard=1` (start as a
hereditary wizard), `?q=high|low` (force a quality), `?hc=1` (high
contrast), `?motion=reduce`.

## Test

```bash
npm test                        # 98 node tests: 24 golden transcripts vs the real binary (7 full wins), rules, save/load, planner (40 seeds x 2), walkthroughs, composer, audio, parser helpers, gait
npm install                     # only for the browser tools below
npm run smoke                   # 35 browser checks: UI, hints, Override, save/load, sound levels, text mode, autoplay to "You win!"
npm run check:raster            # ADR-002: no images, no audio files, no loaders
node scripts/perf.mjs           # frame rate per biome (GPU=swiftshader for CPU-only)
node scripts/media.mjs          # regenerate media/
npm run golden                  # re-capture golden transcripts (needs WSL/Linux with bsdgames + gcc)
```

## How to play

You type commands, as in 1979. Movement is **relative** — there are no
compass words in this game: `ahead` (`a`), `back` (`b`), `left` (`l`),
`right` (`r`), `up` (`u`), `down` (`d`). A blocked move still turns you.

| | Commands (a selection — the parser is the original's) |
|---|---|
| Look and inventory | `look`, `i` / `inven`, `score`, `time`, `verbose`, `brief` |
| Things | `take` / `get`, `drop`, `put`, `give`, `throw`, `open`, `wear`, `take off` / `undress`, `eat` (with a knife), `drink`, `light` (a match), `use` |
| Fights | `kill`, `shoot`, `follow`, and during a fight `back` to retreat |
| The ship | `launch`, `land`; in space, move as usual |
| Rest | `sleep`, `jump` |
| Save | `save` (name a slot); Load from the top bar |
| Wizard | `su` (if you are one) |

Combine with commas or `and`: `take sword, take knife`. Typos and
interactive-fiction habits (`x`, `grab`, `pick up`) are corrected **only
when the original would reject the line**, and the correction is shown;
turn that off in Settings (strict parser).

**The dogfight** (when a Cylon attacks in space): the arrow keys, or
the original's `h`/`r`, `l`, `j`/`u`, `k`/`d`, set the drift (Shift or a
capital = ×5, and costs more fuel), `F` or Space fires two torpedoes,
`+` toggles the reticle, `Q` breaks off (the Cylon gets a shot at you). The clock is
shared by every dogfight in the game. Settings has a **turn-based**
mode.

**Keyboard:** everything is playable from the keyboard. `` ` `` hints,
`~` Override, `Ctrl+M` map, `F1` help, `Tab` completion, `↑`/`↓` history,
`Esc` closes panels.

## Cheats

Three layers, from the original's to the port's
([ADR-006](./docs/decisions/006-hints-and-override.md)):

1. **Wizard (original).** Type a hereditary wizard's name in the
   new-game dialog (`riggle`, `chris`, `edward`, `comay`, `yee`, `dmr`,
   `ken`) or open `?wizard=1`: `su` teleports and more, exactly as in the
   source. Holding the three artifacts makes anyone a wizard. The names
   `wnj`, `root` and `ted` are the original's *anti*-wizards.
2. **Hints** (`` ` ``). The next original command toward the win, and
   why. **Autoplay** plays them — all the way to "You win!" (tested in
   the browser). Hints do not mark your score.
3. **Override** (`~`). Infinite fuel, infinite torpedoes, no hunger, no
   fatigue, invulnerable, reveal the map, toggle day/night, and
   teleport by clicking any room on the world map. Any use shows
   **OVERRIDE ACTIVE** and marks the score as cheated. With every flag
   off the game is proved identical to the original.

![Hints: the next original command and why](./media/15-hints.png)
![The Override panel with the world map](./media/16-override-map.png)

## Requirements & running without a GPU

The page degrades in steps instead of failing
([ADR-011](./docs/decisions/011-quality-ladder.md)):

| Machine | What you get |
|---|---|
| A GPU with WebGL 2 | **High**: 60 fps in every biome. |
| No usable GPU (WebGL rendered on the CPU: SwiftShader, WARP, llvmpipe) | **Low**, chosen automatically: smaller render, stylised foliage, coarser rounding on the modelled pieces, no bloom or image-based light — 15–49 fps. |
| No WebGL 2 at all | **Text**: the room name in the scene panel; the whole game, panel, map, hints, Override, saves and sound work. |

Measured on one machine (Windows 11, NVIDIA RTX 4060 Laptop GPU),
Chromium via Playwright 1.63 at 1440 × 900 — `node scripts/perf.mjs`:

| Room | GPU (ANGLE/D3D11), High | CPU only (SwiftShader), Low |
|---|--:|--:|
| Ship: stateroom / parlor (stairs) | 60 / 60 | 49 / 29 |
| Ship: control room / hangar (crew) | 60 / 60 | 36 / 35 |
| Ship: dining hall (14 seated) / closet | 60 / 60 | 24 / 26 |
| Ship: landing bay | 60 | 48 |
| Deep space | 60 | 40 |
| Over the beach | 60 | 28 |
| Coast: village, day / night | 60 / 60 | 23 / 16 |
| Rainforest: woods / pools at night | 60 / 60 | 15 / 16 |
| Caves (lantern): catacombs / throne | 60 / 60 | 20 / 29 |

The first visit to each biome compiles its shaders (up to ≈1.6 s on
the GPU above); later room changes reach their first frame in
20–130 ms, under the travel transition.

| | |
|---|---|
| ![Low quality on a CPU renderer: stylised forest](./media/17-no-gpu-low.png) *Low on SwiftShader (no GPU): stylised crowns, no bloom.* | ![Text mode without WebGL](./media/18-no-webgl-text.png) *No WebGL: text mode, fully playable.* |

`prefers-reduced-motion` (or Settings) removes the travel slides and
camera shake; Settings also has a high-contrast theme.

## What makes this port different

- **Nothing invented about the game.** 22 transcripts from the real
  binary, including five complete winning games, are reproduced byte
  for byte; the dogfight's first frame too. The canonical docs were
  wrong in 29 places (and missed one quirk); each is listed with its
  `file:line` in [notes](./docs/notes.md) with a proposed fix.
- **Rooms drawn from their words.** The composer reads the room's name
  and description — "a tall narrow fissure in the rock cliffs", "the
  flooding is already up to my waist" — and builds that, lit by the
  engine's clock. Darkness is exactly the original's: without a light
  underground you see nothing.
- **A tested way to the end.** The hint planner wins every one of 80
  seeded games; the browser autoplay reaches the victory dialog.
- **Zero raster assets, zero samples.** `npm run check:raster`.

## Spec compliance

Canonical [`test-scenarios.md`](../../docs/test-scenarios.md): scenario 1
passes; 5 passes for the wizard text; 2, 3, 4 and the rest of 5 describe
things the program does not do and are given in corrected form, each
automated — see [`docs/test-scenarios.md`](./docs/test-scenarios.md).
Deviations are in the [diff log](./docs/diff-log.md) and
[ADR-010](./docs/decisions/010-engine-deviations.md).

## Content

The names *Viper*, *Cylon* and *Battlestar* stay in the text as the
original has them; every spacecraft on screen is an original design,
not a *Battlestar Galactica* silhouette. The original's adult humour is
kept verbatim in the text; the pictures are non-explicit — people are
clothed, the goddess is light and water.

## Docs

[**Walkthroughs**](./docs/walkthrough.md) (the fastest win, and the full
score) · [Diff log](./docs/diff-log.md) · [Architecture](./docs/architecture.md) ·
[Test scenarios](./docs/test-scenarios.md) · [Notes](./docs/notes.md) ·
[Decisions](./docs/decisions/)

- [001 Tech stack](./docs/decisions/001-tech-stack.md) — vanilla ES modules, vendored Three.js, zero build
- [002 Zero raster assets](./docs/decisions/002-zero-raster-assets.md)
- [003 Game text](./docs/decisions/003-upstream-text.md) — transcribed verbatim from the C data
- [004 The dogfight](./docs/decisions/004-dogfight.md) — real-time 3D on fly.c's grid; turn-based option
- [005 Wizards without logins](./docs/decisions/005-wizard-login.md)
- [006 Cheat layers](./docs/decisions/006-hints-and-override.md) — wizard, hints, Override
- [007 Persistence](./docs/decisions/007-persistence.md) — versioned JSON in localStorage
- [008 Parser helpers](./docs/decisions/008-parser-helpers.md) — never change an original command
- [009 Scene composer](./docs/decisions/009-scene-composer.md) — biomes, content guardrails
- [010 Engine deviations](./docs/decisions/010-engine-deviations.md)
- [011 Quality ladder](./docs/decisions/011-quality-ladder.md) — High, Low, Text
- [012 Soundscape](./docs/decisions/012-procedural-soundscape.md)

## Attribution

- **`battlestar`** by David W. Riggle (UC Berkeley, 1979; 4.2BSD).
  Upstream: <https://github.com/vattam/BSDGames/tree/master/battlestar>.
  Copyright (c) 1983, 1993 The Regents of the University of California.
  See root [`ATTRIBUTION.md`](../../../../ATTRIBUTION.md).
- The engine is reimplemented from the C source; the game's text and
  data tables are transcribed from its initialisers
  (`src/engine/data/world.js` carries the BSD notice). No C code is
  copied into this repository.
- Three.js r186 (MIT), vendored in `src/vendor/` with its licence.
