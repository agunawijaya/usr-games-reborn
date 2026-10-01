# Working Notes — `pom` · fancy-web

---

## Legacy layout of the game folder

`bsdgames/pom/` still has the **pre-ADR-006 layout**: `src/`, `tests/`
and `docs/diff-log.md` sit at game level (the first two are empty), from
before ports moved under `ports/<name>/`. This port **does not touch
them**. Its code, tests and diff-log live under `ports/fancy-web/`. A
future cleanup (the owner’s call) can remove the empty game-level `src/`
and `tests/` and fold the game-level `diff-log.md` into this port’s or
retire it.

## Golden fixtures

`tests/fixtures/pom-binary-golden.json` was generated with Ubuntu’s
`bsdgames` package (`/usr/games/pom`) under WSL:

- 900 random `ccyymmddHH` dates (years 1902–2100), 250 random
  `yymmddHH` dates (both sides of the `69` pivot), 40 each of `mmddHH`,
  `ddHH` and `HH`, and 22 malformed inputs;
- all run under `TZ=UTC`, and a subset under `TZ=Asia/Jakarta`;
- each entry records `now` (Unix seconds at capture), `arg`, `stdout`,
  `stderr` and `code`.

To regenerate, run a Python loop over `subprocess.run(['/usr/games/pom',
arg], env={'TZ': tz})` on any Linux with `bsdgames` installed, and
record `int(time.time())` alongside each run. Keep the file as the
binary’s output. Never hand-edit it.

## Time zones

- Browsers expose only `Intl`’s zone names, so the caption shows
  `(GMT+7)` where the C library prints `(WIB)`. The engine accepts any
  zone object; tests use `fixedZone(420, 'WIB')` and match byte-for-byte.
- DST: `localZone().mktime` uses JS `Date`, which picks the post-transition
  offset for skipped local times, as glibc usually does. There is no
  fixture for DST gaps.

## Known limitations

- The procedural Moon is *plausible*, not photographic. The maria and
  named craters are at real coordinates, but their shapes are
  approximations.
- The equirectangular surface map pinches at the poles. Relief is faded
  within about 13° of the poles to hide it. Poles only show at the limb,
  or when the Moon is dragged.
- Moon position in the sky is compositional. pom has no observer
  location, so there is no altitude, azimuth or bright-limb tilt.
- Accuracy is pom’s: Duffett-Smith’s simplified theory puts phase
  instants within a few hours of modern ephemerides (for example,
  pom’s Full Moon is 26 Oct 2026 ≈ 11:14 WIB).
- Works best with a GPU, degrades without one. Details are in the next
  section.

## Machines without a GPU

Measured on 2026-09-24 with Playwright/Chromium on the development
laptop, forcing each mode with Chromium flags.

| Mode | How it is detected | Behaviour | Measured |
|---|---|---|---|
| GPU | default | Full profile | 6 ms/frame at 1440×900 |
| CPU WebGL (SwiftShader, llvmpipe, softpipe, lavapipe, Microsoft Basic Render Driver) | `looksSoftware()` on the unmasked renderer name, then a `failIfMajorPerformanceCaveat` probe | **Lite profile**: 1024×512 surface, 16-row bake tiles, half-resolution drawing buffer (adaptive down to 30%), shader time frozen (no twinkle or ripples), **frames drawn only when state changes** | Before: 28 s to first Moon, 5 fps continuous. After: ~3 s to first Moon, 0 draws while idle, ~1 s per interaction |
| No WebGL2 | `getContext('webgl2')` returns null | **Text mode**: readout, caption, scrubber and inputs work; CSS placeholder ring; calendar button disabled | Instant |

Flags used to reproduce: `--use-angle=swiftshader --enable-unsafe-swiftshader --disable-gpu`
(CPU) and `--disable-gpu --disable-software-rasterizer --disable-webgl`
(no WebGL). `npm run shots` captures both (`media/09`, `media/10`).
`?q=lite` forces the lite profile on any machine.

### First visit on Windows: shader compilation

Chrome and Edge on Windows translate WebGL through ANGLE to Direct3D 11,
whose HLSL compiler is slow on large, loop-heavy shaders. The first
compile of the bake and scene programs took **~5.4 s each** on the dev
laptop. OpenGL took 0.5–0.8 s and Vulkan 0.1 s. Browsers cache compiled
shaders on disk, so later visits are fast (<0.5 s).

The programs are started together and polled with
`KHR_parallel_shader_compile`, so they compile concurrently and the page
never freezes: the text UI appears in ~0.2 s, the veil says “Compiling
shaders…”, and the Moon arrives after ~6–7 s (previously ~11 s with
the page frozen).

Separately, the Google Fonts stylesheet used to be render-blocking: a
fresh browser waited on the font download before running any script,
and an offline one would have waited for the request to time out. It
now loads with `media="print"` + `onload`, and the system fallbacks
render immediately.

## Performance notes

See [`architecture.md`](./architecture.md#performance-rtx-4060-laptop-angled3d11).
The heavy per-pixel pieces are the 25-row lit-distance soft minimum
(skipped beyond 4.5 Moon radii), five star layers, the Milky Way fBm,
and the lake’s second pass through `above()`, which replaces rather than
adds to the direct sky evaluation.

## Screenshot workflow

`npm run shots` starts its own server on port 5399, pins
`Asia/Jakarta` + `en-GB`, and writes `media/01…08`. Captions in the
README describe those exact dates. If the bake shaders change, re-run
it.
