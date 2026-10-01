# `pom` · fancy-web — Original → Port Diff Log

> Feature-by-feature record of what was kept, changed, added and
> removed, and *why*. The story of *Selene*.

---

## Legend

- 🟩 **Kept**: identical or near-identical to the original.
- 🟨 **Changed**: same feature, different implementation or UX.
- 🟦 **Added**: new to the port.
- 🟥 **Removed**: the original had it; the port doesn’t.
- 🟪 **Reinterpreted**: original concept, radically different execution.

---

## Feature Log

| # | Feature | Status | Notes |
|--:|---|:---:|---|
| 1 | Duffett-Smith algorithm (`potm`, secs 46/65/67) | 🟩 | Line-for-line port of `pom.c`, same constants, same `adj360` loop, same section comments. Verified byte-for-byte against 1,534 runs of the real `/usr/games/pom`. |
| 2 | 1990 Jan 0.0 epoch, no TDT/UTC correction | 🟩 | `EPOCH_MINUS_1970 = 20*365+5-1`, kept with the original caveat. |
| 3 | Phase names and quarter detection (today vs tomorrow) | 🟩 | Including the `today += 0.5` quirk and its “doesn’t matter here” comment. |
| 4 | *was / is / will be* tense | 🟩 | Compared in whole seconds (`time_t`). Live mode is `is`; any chosen hour is `was` or `will be`. |
| 5 | `[[[[[cc]yy]mm]dd]HH]` parser | 🟩 | Same right-to-left fall-through, the `yy < 69` → 20yy hack, `mktime` normalisation (`2026022900` → 1 Mar), same error text and usage line. |
| 6 | `printf("%1.0f")` percentages | 🟩 | `cRound0` does glibc round-half-even on the exact double. |
| 7 | Dry one-line output | 🟩 | Shown verbatim as the caption (`$ pom …` + output). Honours port-ideas “What NOT to change”. |
| 8 | Terminal usage | 🟩 | `npm run pom -- <arg>` runs the same engine as a CLI. |
| 9 | `%Z` zone abbreviation | 🟨 | The engine prints whatever abbreviation the zone gives. In browsers that is `Intl`’s (“GMT+7”), where glibc/tzdata prints “WIB”. Tests pin a named zone and match byte-for-byte. |
| 10 | Output medium | 🟪 | A single line becomes a full-screen, ray-traced night scene. The line is still there. |
| 11 | Visual Moon | 🟦 | Procedural surface from real IAU coordinates, lunar-Lambert lighting, cast shadows, earthshine. [ADR-002](./decisions/002-zero-raster-assets.md) |
| 12 | Sky and landscape | 🟦 | Stars, Milky Way, airglow, halo, mountains, lake with a moon glade, pines. All procedural. |
| 13 | Time travel | 🟦 | Scrubber (±15 d), date picker, pom compressed-date field, day steps, Now, one-month timelapse. From port-ideas “Rich web UI”. |
| 14 | Moon calendar | 🟦 | Month grid of shader-rendered mini Moons. From port-ideas “Moon-calendar mode”. |
| 15 | Principal-phase events | 🟦 | Next 8 New/FQ/Full/LQ instants by bisection on pom’s elongation. From port-ideas “Event mode”. |
| 16 | High-contrast mode | 🟦 | Toggle plus `prefers-contrast`. From port-ideas “High-contrast mode”. |
| 17 | Reduced motion | 🟦 | `prefers-reduced-motion`: frozen twinkle and ripples, stepped timelapse, no transitions. |
| 18 | Feature tooltips and drag-to-rock | 🟦 | Hover names maria and craters; drag rotates the surface ±~25° while the terminator stays physical. |
| 19 | Minute precision | 🟨 | pom’s argument resolves to the hour. The *visual* Moon is continuous during animation, but the scene snaps to the hour at rest, so caption and picture always agree. |
| 20 | Out-of-range dates | 🟨 | The original’s `mktime == -1` check exists, but JS dates span ±275,000 years, so every 10-digit input succeeds, as with 64-bit glibc (the golden set includes years 0001 and 9999). |
| 21 | `setregid` privilege drop | 🟥 | Meaningless in a browser. Nothing is setgid. |
| 22 | Output direction (stdout vs stderr) | 🟨 | Kept in `runPom()` (`stdout`, `stderr`, `code`). The UI shows errors in amber in the caption slot. |
| 23 | Runs anywhere pom ran | 🟦 | The original needed only a C compiler. *Selene* degrades in three steps: GPU (full scene), CPU-only WebGL (automatic lite profile) and no WebGL (text mode, where pom still answers). |

No deliberate deviation from the canonical [`spec.md`](../../../docs/spec.md)
mechanics exists, so no spec-deviation ADR is needed. The two ADRs cover
the tech stack and the zero-raster rule.

---

## Narrative

### 1. The engine came first, and the binary settled an argument

The engine was written headless and test-first. The canonical
[`test-scenarios.md`](../../../docs/test-scenarios.md) looked like the
obvious acceptance suite, but running the scenarios against the algorithm
exposed a problem. `pom 20261031` is **eight digits**, so pom parses it as
`yymmddHH`: year 2020, **month 26**, *illegal time format*. Even read
generously as 31 Oct 2026, the Moon then is 74% waning gibbous, not
Full. The real Full is 26–27 Oct, New is 9–10 Nov, and First Quarter is
19 Oct.

Rather than argue from reading the C, we asked the original. Ubuntu’s
`bsdgames` `/usr/games/pom` under WSL confirmed the reading exactly and
became the oracle. 1,616 invocations (random 10- and 8-digit dates from
1902–2100, the relative 6/4/2-digit forms, and a zoo of malformed
inputs, under `TZ=UTC` and `TZ=Asia/Jakarta`) were frozen into
`tests/fixtures/pom-binary-golden.json`. The port matches all 1,534
comparable cases byte for byte. The remaining 82 are pre-1964 Jakarta
dates, when WIB had other offsets; a fixed +07:00 zone cannot represent
them.

Following the porting guide (“if reality contradicts [the canonical
docs], open a PR to fix the canonical docs, do not silently work around
them”), the canonical scenarios 2–4 were rewritten with 10-digit
arguments whose output was captured from the binary. The old 8-digit
inputs became a new scenario 6 that documents the `yymmddHH` rule, and
`spec.md` gained a verified “Parsing & Output Details” table. The port
now passes canonical scenarios 1–7 literally. The full story is in
[`test-scenarios.md`](./test-scenarios.md).

### 2. Choosing no Three.js

The brief allowed a vendored Three.js. We didn’t take it
([ADR-001](./decisions/001-rendering-stack.md)): nothing in this scene is
really a mesh. A ray-traced sphere gives an exact limb at any size, and a
tessellated one never does. The halo is better computed from physics
(distance to the lit region) than from a generic bloom blur. And the
shaders are the thing this port exists to teach.

### 3. The art-direction loop

Every visual stage was screenshotted with Playwright on a real GPU,
critiqued, fixed and re-shot. The honest record:

**Moon, v1.** *“Golf ball on a stick.”* Crater rims glowed deep on the
night side (the shadow march only ran in a band, and perturbed normals
lit everything beyond it). A hard vertical seam ran at the terminator.
The maria were grey circular stickers. Relief was 2.2× too strong.
→ Night beyond ~6° from the terminator is now unconditionally dark, and
relief was lowered to 1.3×.

**v2–v3.** The paper-white gibbous clipped. The Full Moon had ragged
noise at the limb: cast shadows computed when the Sun is behind the
observer, where every shadow hides behind its caster. → Shadows fade out
with phase angle; exposure was re-anchored by measuring pixels against
real Full-Moon photographs (highlands ≈210, maria ≈120).

**v4–v6.** The maria were still separate potato blobs, but the real near
side is one connected chain plus one ocean. → A max-union of circles
became a soft union of lobes, with domain-warped shorelines. Mare
Frigoris became eight overlapping lobes so it reads as a band. The
metaball merge overshot once and swallowed Crisium; it was reined in so
Crisium stays an island. That shape recognition is the difference
between “a moon” and “the Moon”.

**v7–v10: the halo.** A glow centred on the whole disc makes a quarter
Moon look like it has a glowing ghost half. A first fix (offset centre)
drew a ring on the dark side. The second (terminator ellipse) boxed the
glow above the Full Moon. The third (hard minimum over rows) left
Voronoi streaks. The fourth, a **soft minimum** of distances to 25 rows
of the lit region, finally radiates from the bright limb only.

**Sky, v1.** Wallpaper stars with cheap cross-spikes. The Milky Way was
vertical streaks, because the noise was stretched along the band. The
landscape was three flat bands with the trees black-on-black.
→ Power-law magnitudes, no spikes, isotropic domain-warped star
clouds, a Great Rift, faint Hα knots. The landscape was redesigned as a
nocturne: a far range with mist, a forested headland, an island, and a
**lake** that mirrors the sky through perspective-correct ripples, with
a moon glade and pines framing the shores.

**Polish.** The terminator had “pixel dust” (too many peaks lit past it),
and a staircase at the north pole came from equirectangular texel rows
converging. → Peaks may catch light only ~1° past the terminator, relief
fades within ~12° of the poles, and a wider penumbra hides half-float
height steps.

### 4. Bugs worth remembering

- **The white blob.** With `?date=` set, the Moon rendered as an
  overexposed white oval. The rAF timestamp lagged `performance.now()`,
  `dt` went negative, the fade-in value reached −18, and ACES has a pole
  for negative input. Fix: one clock for everything, `dt` clamped at 0,
  and the uniform clamped in the renderer as well.
- **8-digit dates.** See the narrative above: in pom, an 8-digit
  argument is always `yymmddHH`.

### 5. “What if there is no GPU?”

This was asked after release, and it was the right question, because
the port had only been tested on one fast GPU. Forcing the other cases
in Chromium showed three problems:

- **No WebGL2:** the text UI worked, but the fallback message was
  centred on top of the phase name, and **Calendar** opened an empty
  drawer. → The message now sits where the Moon would hang, beside a
  CSS ring, and the calendar button is disabled with an explanation.
- **CPU-only WebGL (SwiftShader):** everything rendered correctly, but
  took **28 s** behind a veil that said nothing, then ran at **5 fps**.
  → A software renderer is detected (renderer name, then a
  `failIfMajorPerformanceCaveat` probe) and gets a lite profile: a
  1024×512 surface, half resolution, frozen twinkle and ripples, and
  **render-on-demand**, where identical frames are skipped. The Moon now
  appears in ~3 s, costs nothing at rest, and the veil shows a
  percentage and says why.
- **A surprise on the GPU:** a fresh Windows browser took ~11 s with the
  page frozen. The bake was 30 ms; the culprit was D3D11’s shader
  compiler, ~5.4 s per large program, plus a render-blocking font
  stylesheet. → Programs now compile in parallel via
  `KHR_parallel_shader_compile` (~6–7 s total, the page stays live), and
  the fonts load non-blocking.

The lesson: “works on my GPU” is not a test. The three modes are now
scenarios P15–P17 and screenshots `media/09`/`10`.

### 6. What was deliberately *not* done

- No ephemeris of Moon altitude or azimuth. pom has no observer location,
  so the Moon hangs where the composition wants it. Inventing a position
  would contradict the engine.
- No position-angle tilt of the bright limb. Without latitude it would be
  faked; the terminator is exactly what pom’s elongation says.
- No photographic textures, ever ([ADR-002](./decisions/002-zero-raster-assets.md)).

---

## Cross-References

- Canonical [`spec.md`](../../../docs/spec.md): the mechanical contract.
- Canonical [`port-ideas.md`](../../../docs/port-ideas.md): where the
  calendar, event mode, rich web UI and high-contrast mode were planned.
- [`./decisions/`](./decisions/): ADR-001 (stack), ADR-002 (zero raster).
- [`./architecture.md`](./architecture.md): how the pieces fit.
