# `battlestar / fancy-web` — Architecture

## The shape of it

```
            keyboard / clicks
                   │
        ┌──────────▼──────────┐   lines     ┌───────────────────────────┐
        │ src/ui/  (page)      │───────────▶│ src/engine/battlestar.js   │
        │ console, panel,      │◀───────────│ the 1979 game, function by │
        │ dialogs, flight keys │  text +    │ function; generators for   │
        └──┬───────────┬───────┘  events    │ every blocking read        │
           │           │                    └──────┬────────────────────┘
   RoomSpec│      events│                           │ FlightSim (fly.c)
           ▼           ▼                            ▼
  ┌────────────────┐ ┌─────────────┐     ┌──────────────────────┐
  │ src/scene/     │ │ src/audio/  │     │ src/engine/planner.js│
  │ composer.js    │ │ Soundscape  │     │ hints, autoplay      │
  │ (pure)         │ └─────────────┘     └──────────────────────┘
  └──────┬─────────┘
         ▼
  ┌──────────────────────────────────────────────────────────┐
  │ src/render/stage.js — Three.js r186 (vendored), fixed    │
  │ light rig, PMREM moods, HDR post; kits build each room   │
  └──────────────────────────────────────────────────────────┘
```

One rule holds it together: **the engine knows nothing about the
page**. It reads a character stream and writes text, exactly like the C
program on a terminal, and additionally emits events (`move`, `dusk`,
`fightStart`, `launch`, …). Everything visual or audible is derived from
the engine's state and events; nothing decorative writes back.

## Engine (`src/engine/`)

- `battlestar.js` — class `Battlestar`. Globals of the C program are
  fields; each C function is a method; every place the C blocks on
  input (`getcom`, `fgets`, `getchar`, the fight prompt, `su`, `save`,
  the curses loop) is a generator step (`yield*`), so the same code runs
  in a page (one line at a time), in tests (a whole script) and in the
  golden harness. API: `start()`, `send(line)`, `snapshot()`/`restore()`,
  `override(action)`, `setOverrides(flags)`, queries (`has`, `wears`,
  `objectsIn`, `exits`, …) and `atMainPrompt`.
- `data/world.js` — generated from the C initialisers by
  `scripts/extract-data.mjs` (rooms, objects, vocabulary, constants).
- `rng.js` — glibc `random()` (TYPE_3), so a seed reproduces the binary.
- `flight.js` — `FlightSim`, fly.c's state machine; the page drives it
  in real time (1 s ticks) or turn by turn; `autopilotKey()` for tests.
- `planner.js` — the hint engine: a goal sequence (escape, fly, meet the
  goddess, arm, armour, the Dark Lord, the gifts, the finale) over a
  Dijkstra route through walking, flying, launch/land and the amulet's
  teleport, with a fight policy. `autoplay.js` and `run.js` drive whole
  games headless.
- `routes.js` — the two walkthroughs as playable routes (the fastest win;
  the full score), played step by step with the planner filling in;
  `scripts/make-walkthrough-doc.mjs` writes `docs/walkthrough.md` from
  them, `tests/walkthrough.test.js` keeps them winning.

## Scene (`src/scene/`)

`composeRoom(game)` is a **pure** function from engine state to a
`RoomSpec`: room, biome and place (classified from the room's name and
text, not from number ranges), features and landmarks parsed from the
description, what lies ahead/left/right/behind (exits and neighbouring
places, relative to the facing), light (night, sun phase, darkness,
lantern, match, alert), props and people from the room's objects,
status (injuries, fatigue, hunger, wizard) and the dogfight gauges.
`layout.js` is a computed map layout used by the minimap and the
Override world map.

## Render (`src/render/`)

- `stage.js` — renderer, camera, a **fixed** light rig (hemisphere,
  key, four points — reconfigured, never recreated, so shaders do not
  recompile between rooms), environment maps per mood (`env.js`), the
  post chain (`post.js`: bloom, ACES, grade, status effects, travel
  transitions) and the quality ladder (ADR-011).
- `kits/` — one builder per biome (`ship`, `space`, `air`, `coast`,
  `forest`, `cave`) turning a spec into a group, a camera, lights, fog
  and a grade; `kits/index.js` dresses the room with props and people
  and applies darkness.
- Shared pieces: `materials.js` (one `MeshStandardMaterial` with a
  procedural surface injected per family — panel, grate, carpet, wood,
  stone, sand, terrain, bark, leaf, metal, gold, fabric, matte …),
  `terrain.js`, `water.js` (Gerstner), `flora.js`, `props.js` (every
  object), `craft.js` (original spacecraft), `cockpit.js` (the
  dogfight) and `viper-cockpit.js` (its frame), `sky.js`, `fx.js`
  (particles, glows, light shafts).
- The modelled pieces (ADR-013), all built with `model.js` (rounded
  boxes, cushions, drapes, tufting, lathes, mouldings, tubes):
  `furnish.js` (the luxury decks), `shipfit.js` (the rest of the
  battlestar), `stairs.js` (flights, steel stairs, `stairway()` and
  `stairCore()` with their floor and ceiling openings),
  `island-build.js` + `island-furnish.js` behind `buildings.js` and
  `interiors.js`, and `cave-furnish.js` for the caves and the forest.
- People: `humans.js` (clothed bodies on a skeleton, poses, the agents
  that walk between work stations), `gait.js` (foot-planted walking,
  running and limping; tested in `tests/gait.test.js`), `people.js`
  (the crowds a room's description asks for).
- Textures that exist are drawn at run time into canvases or render
  targets (gauges, a rune sign); there are no image files (ADR-002).

## Page (`src/ui/`, `src/audio/`, `index.html`)

- `app.js` — boot (probe WebGL, pick the rung), new game / load, the
  command loop (`submit` → parser helpers → `engine.send` → text,
  events → stage, sound, panel), the dogfight controller, hints and
  Override, dialogs, settings, keyboard, and the `window.__bs` hook used
  by the screenshot and smoke scripts.
- `console.js` (log, history, Tab completion), `panel.js` (status,
  meters, compass, minimap, world map), `helpers.js` (ADR-008),
  `store.js` (localStorage, guarded), `flight.js` (real-time or
  turn-based dogfight input).
- `audio.js` — `bedFor(spec)` and the `Soundscape` mixer (ADR-012).

## Tests and tools

`tests/` (node) and `scripts/`: `golden-capture.mjs` (the real binary
under WSL), `make-golden-cases.mjs`, `make-walkthrough.mjs`,
`shots.mjs` + `contact.mjs` (art-direction screenshots), `media.mjs`
(README images), `perf.mjs`, `ui-smoke.mjs`, `check-no-raster.mjs`,
`serve.mjs`.

## Costs and where they went

- Engine: 2.9k lines; a complete hinted game to "You win!" runs
  headless in about 50 ms.
- Rendering (RTX 4060 laptop, measured with `performance.now()` around
  a room change): building a room's scene takes 3–140 ms of script
  (forests are the heaviest); the first visit to a *biome* also compiles
  its shaders, up to ≈1.6 s before the first frame, after which a room
  change reaches its first frame in 20–130 ms. The travel transition
  covers it. 60 fps everywhere once built; CPU-only numbers and what
  was cut for them are in [notes §6](./notes.md#6-machines-without-a-gpu).
- Foliage (alpha-tested leaf cards) and image-based light are the two
  big costs; both have cheaper Low paths.
