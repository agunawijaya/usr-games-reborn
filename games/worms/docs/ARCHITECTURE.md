# Abyssal Worms — architecture

## Overview

Abyssal Worms is a **hosted** game: the finished port the owner built earlier (`worms`, fancy-web),
adopted as it was into `games/worms/app/` and run by the Hall in a same-origin frame at
`play/worms/`. It is plain ES modules with no build step. The abyss is drawn with raw WebGL2 and
GLSL in seven passes; the classic terminal is Canvas 2D, which is also the fallback without WebGL2.
The engine is a faithful JavaScript port of the original C main loop, under 300 lines. The upstream
design notes are kept in [`../app/docs/architecture.md`](../app/docs/architecture.md) and its
decisions in [`adr/`](adr/).

## Module map

```mermaid
flowchart LR
  html["app/index.html<br/>page shell"] --> bridge["../../bridge/bridge.js<br/>the Hall's bridge"]
  html --> main["src/main.js"]
  main --> app["src/ui/app.js<br/>options, clock, views, input"]
  app --> engine["src/engine/worms.js<br/>the worms.c main loop"]
  app --> args["src/engine/args.js<br/>getopt and C conversions"]
  engine --> random["src/engine/random.js<br/>glibc random()"]
  app --> render["src/render/renderer.js<br/>WebGL2 passes"]
  render --> geometry["src/render/geometry.js<br/>glide, ribbons, trails"]
  app --> classic["src/render/classic.js<br/>Canvas 2D terminal"]
  app --> audio["src/audio/ambience.js"]
  app --> hall["src/hall.js<br/>visit, packages, poster"]
  hall --> bridge
```

| Path                        | Responsibility                                                                     |
| --------------------------- | ---------------------------------------------------------------------------------- |
| `app/index.html`            | The page: two canvases, the split divider, toolbar, settings panel                 |
| `app/src/engine/worms.js`   | The world, `step()`, the nine turn tables, live `-n -l -t -f` changes, step timing |
| `app/src/engine/args.js`    | `parseArgs` with GNU `getopt` behaviour and C `strtoul`/`atoi`; `formatArgs`       |
| `app/src/engine/random.js`  | glibc’s `random()`; seed 1 is the original’s sequence                              |
| `app/src/render/`           | WebGL2 helpers, the pass graph, glide geometry, species, the classic view          |
| `app/src/audio/ambience.js` | Synthesised drone, bubbles and crossing chimes                                     |
| `app/src/ui/app.js`         | The controller: frame loop, step clock, views, settings, keys, idle fade, quality  |
| `app/src/ui/styles.css`     | Layout and the night look                                                          |
| `app/src/ui/fonts/`         | Self-hosted Inter and JetBrains Mono (added on adoption)                           |
| `app/src/hall.js`           | The bridge glue (added on adoption)                                                |

## State machine

```mermaid
stateDiagram-v2
  [*] --> Descending: page opens, shaders compile
  Descending --> Crawling: the first frame is drawn
  Crawling --> Paused: Space
  Paused --> Crawling: Space
  Crawling --> Crawling: a slider or box changes, applied live
  Crawling --> Relaunched: R, command line, cell size, new seed, resize
  Relaunched --> Crawling: the worms enter at the corner again
```

The view (Abyssal, Split or Classic) is independent of this: every view reads the same world.

## Engine

`worms.js` keeps exactly the C program’s state (per worm an orientation, a head index and ring
buffers of positions; a reference count per cell; the terminal’s characters), and `step()` is one
pass of its loop. It also records the cells blanked, placed and eaten each step for the renderer and
the sound; that record never feeds back into movement. `random.js` reproduces glibc’s generator
from seed 1, the original’s unseeded start, so the port makes the binary’s own screens. A step
takes `-d` ms, or `max(33, 12.5 × worms)` ms without it (9600-baud pace), at least 150 ms under
reduced motion. The frame loop catches up at most 12 steps a frame and draws each worm gliding
between steps, equal to the grid at every step boundary (upstream ADR 003).

## Where visuals are defined

| Visual                                             | Defined in                                                       | Change it by                         |
| -------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------ |
| The eight species: colours, markings, pulse, width | `app/src/render/species.js`                                      | Editing the `SPECIES` table          |
| Worm bodies, rim light, gut pulse, crossing flare  | `app/src/render/shaders/worm.js` (`WORM_VS`, `WORM_FS`)          | The worm shader                      |
| Light the worms cast on the floor                  | `worm.js` (`LIGHT_FS`), blurred by `post.js` (`BLUR_FS`)         |                                      |
| Luminous trails                                    | `worm.js` (`TRAIL_FS`), strips from `app/src/render/geometry.js` |                                      |
| Sea floor, burrows, caustics, the WORM plankton    | `app/src/render/shaders/floor.js`                                | The floor shader                     |
| Marine snow                                        | `app/src/render/shaders/post.js` (`SNOW_VS`, `SNOW_FS`)          |                                      |
| Bloom and the final grade                          | `post.js` (`PREFILTER_FS`, `DOWN_FS`, `UP_FS`, `COMPOSITE_FS`)   | Exposure and bloom in `ui/app.js`    |
| Pass order, cell textures, Low and High quality    | `app/src/render/renderer.js`                                     |                                      |
| The classic terminal                               | `app/src/render/classic.js`                                      | Its three phosphor colours           |
| Toolbar, settings panel, notices                   | `app/src/ui/styles.css`                                          | CSS custom properties at the top     |
| Fonts                                              | `app/src/ui/fonts/fonts.css`                                     | Swap the woff2 files and the credits |

Abyssal Worms has one night look and does not read the Hall’s tokens. Reduced motion comes from the
system (`prefers-reduced-motion`) or `?motion=0`. A software renderer gets Low quality at once, and
slow frames on High switch to Low once, with a notice.

## Where sounds are defined

All sound is synthesised in `app/src/audio/ambience.js` (no audio files), and nothing is created
until the player first turns sound on.

| Sound                 | Defined in                                           | Plays when                                             |
| --------------------- | ---------------------------------------------------- | ------------------------------------------------------ |
| Drone and deep rumble | `start()`: low oscillators and generated brown noise | Always, while sound is on                              |
| Bubbles               | `bubble()`, from `update()`                          | Every 0.6–3.2 s, one or three, panned toward a worm    |
| Crossing chime        | `chime()`, from `crossing()`                         | A head lands on an occupied cell (at most every 1.6 s) |

## Hall integration

All of it lives in `app/src/hall.js`, plus one script tag in `index.html` and, in
`app/src/ui/app.js`, one import and calls at six moments the controller already knew about.

| Abyssal Worms moment                                      | Bridge message                                                    |
| --------------------------------------------------------- | ----------------------------------------------------------------- |
| The first key press or click                              | `result { outcome: 'complete', durationSeconds }`, once per visit |
| The classic view is chosen                                | `achievement back-to-the-terminal`                                |
| The split divider is dragged or moved with the arrows     | `achievement side-by-side`                                        |
| Trails are switched on                                    | `achievement luminous-trail`                                      |
| 1,000 letters eaten while the field is on                 | `achievement plankton-feast`                                      |
| Eight or more worms set in the settings or a command line | `achievement full-spectrum`                                       |
| A command line is accepted                                | `achievement command-line`                                        |
| The first abyss frame drawn 5 s after opening             | `poster`, from `#abyss` through `posterFromCanvas`                |

Abyssal Worms sends no title-screen signal: it has no title screen, and the Hall’s strip carries
the ways out. It does not act on pause or appearance messages. Opened on its own, the bridge script
is missing and `hall.js` does nothing.

## Tests

| Test                     | Command                                                               | What it proves                                                                                                      |
| ------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Upstream unit tests (33) | `pnpm run test:hosted` (or `node --test "tests/*.test.js"` in `app/`) | Screens and command-line errors match captures of the real binary; glibc `random()`; invariants; glide; zero raster |
| In the Hall (5)          | `pnpm exec playwright test -c games/worms`                            | Opens with no outside requests; a key press is the visit and installs a package; every way out                      |
| Screenshots              | `SHOTS=1 pnpm exec playwright test -c games/worms`                    | `docs/media/title-1280.webp`, `play-1280.webp`, `signature-1280.webp`, on the machine’s GPU                         |

The screenshots stage each scene with the game’s own `?args`, `?cell`, `?warm` (steps to run before
the first frame) and `?view` parameters. Set `HALL_PORT` when the Hall’s usual port (5173) is
taken. On its own, `pnpm --dir games/worms/app start` serves Abyssal Worms at
`http://localhost:5203/`.

## Kit candidates

None: hosted games talk to the Hall only through the bridge.
