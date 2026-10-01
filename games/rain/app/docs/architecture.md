# `rain / fancy-web` — Architecture

## The shape of it

```
                 ┌──────────────── src/engine/ (pure, node-tested) ───────────────┐
  performance    │ timeline.js ── every frameMs() ──► rain.js step()  ◄── random.js│
  .now() ───────►│   queue of { t, frame, events[6], text }  (curses screen 80×24) │
                 └──────────────┬───────────────────────────────┬─────────────────┘
                   in flight     │ (t + 350 ms ≤ now) due        │ shown.text
                 ┌──────────────▼──────────────┐    ┌───────────▼───────────┐
                 │ main.js: drop world position│    │ ui/classic.js  <pre>  │
                 │ (geometry.termToWorld)      │    └───────────────────────┘
                 └──┬─────────┬──────────┬─────┘
       falling      │ impulse │ splash   │ plink
       streaks      ▼         ▼          ▼
            render/renderer.js        audio/audio.js
```

`main.js` owns the loop (`requestAnimationFrame`): advance the engine to
*now*, take the frames that are due on screen, turn each event into an
impulse, a splash and a sound, update the classic text, draw the pond.

## Engine (`src/engine/`)

| File | What |
|---|---|
| `random.js` | glibc's `random()` (TYPE_3 additive feedback, degree 31, Park–Miller seeding via Schrage, 310 outputs discarded). Unseeded = seed 1. |
| `rain.js` | `rain.c:100-151` on a persistent screen (`put` = curses `mvaddstr`, clipping, erases that blank neighbours). `step()` returns `{age, x, y, slot, phantom}` × 6. `frameMs()` models `-d 0`: the bytes curses would send (cursor address + changed span per draw call) at 960 B/s. |
| `timeline.js` | The clock (ADR 003): an engine frame every `frameMs()`, a queue, `takeDue()` at `t + 350 ms`, catch-up capped at 1 s (a hidden tab resumes, it does not replay). |

## Pond (`src/render/`)

Per frame, in order (High profile, 1600 × 900):

| Pass | Target | What | Shader |
|---|---|---|---|
| wave step × 3 | 473 × 984 RGBA32F ping-pong | Verlet wave equation on the log-polar grid, sponge borders, ≤ 96 drop impulses per frame | `shaders/sim.js` |
| environment | 1024 × 384 RGBA16F | sky, clouds, moon, stars, far bank, mist band — azimuth × √height | `shaders/scene.js` `ENV_FS` |
| scene | 1600 × 900 RGBA16F | sky pixels analytic (+ lantern bokeh); water pixels: slope from the sim (footprint-averaged), ambient rings beyond the border, far shimmer, Fresnel, reflection from the environment map, glitter columns for lanterns and moon, mist | `shaders/scene.js` `SCENE_FS` |
| particles | same, additive | ambient streaks (generated from `gl_InstanceID`), falling engine drops, crown and jet droplets (CPU, uploaded as a float texture); thin-lens circle of confusion; light conserved when widened | `particles.js` |
| bloom | 5 levels, half-float | 13-tap down, tent up | `shaders/post.js` |
| composite | canvas | exposure, cool shadow grade, ACES fit, vignette, grain, fade-in | `shaders/post.js` |

`geometry.js` is shared by JS and GLSL (uniforms): the camera (0.9 m
above the water, horizon at 32 % from the top, 42° vertical FOV), the
log-polar grid (ADR 004), and `termToWorld()`.

`renderer.js` holds the **impulse table** (ADR 003) — the only place
where the ASCII ages turn into physics — and the quality profiles
(ADR 005). Programs compile with `KHR_parallel_shader_compile` when
available, polled so the page never blocks.

## Page (`src/ui/`, `src/audio/`, `index.html`)

- `controls.js`: slider (log scale 999 … 1), presets, views, quality,
  sound, fullscreen, help, keys, idle fade (3.2 s), notices.
- `classic.js`: the `<pre>`, font sized to fit 80 × 24 in its pane.
- `audio.js`: created on the first unmute. Looping generated noise → two
  filters (patter, rumble) whose gains follow the rain; per drop a short
  band-passed noise splash, and for ~25 % of age-0 drops (12 % at age 3)
  a 30-70 ms bubble tone rising slightly in pitch; panned by azimuth,
  darker and quieter with distance, capped at 48 a second.

## Costs and where they went

The scene shader dominates. Rendering the sky once into the environment
map instead of per reflected pixel, and precomputing lamp azimuths, took
the CPU-only renderer from 10 to 15 fps; the Lite profile's half-size
canvas took it to ≈ 25 (`npm run measure`, `?skip=` to isolate passes).
