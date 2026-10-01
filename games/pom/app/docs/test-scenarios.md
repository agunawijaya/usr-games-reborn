# `pom` · fancy-web — Test Scenarios

Two parts: (A) sign-off against the **canonical**
[`../../../docs/test-scenarios.md`](../../../docs/test-scenarios.md),
and (B) scenarios for the features this port adds.

Automated equivalents live in [`../tests/`](../tests/) (`npm test`).
Times below are in WIB (UTC+7), matching the canonical doc, and use
“now” = 2026-09-23 12:00 WIB.

---

## A. Canonical scenarios

| # | Canonical scenario | Port result | Automated test |
|---|---|---|---|
| 1 | `pom` shows the current phase, exit 0 | ✅ `The Moon is Waxing Gibbous (87% of Full)` (matches the binary at that hour); the UI caption shows the same in live mode | `scenario 1` |
| 2 | `pom 2026102600` → Full | ✅ `Mon 2026 Oct 26 00:00:00 (WIB):  The Moon will be Full` | `scenario 2` |
| 3 | `pom 2026110900` → New | ✅ `Mon 2026 Nov  9 00:00:00 (WIB):  The Moon will be New` | `scenario 3` |
| 4 | `pom 2026101900` → Quarter | ✅ `Mon 2026 Oct 19 00:00:00 (WIB):  The Moon will be at the First Quarter` | `scenario 4` |
| 5 | `pom 991399` → usage on stderr, exit 1 | ✅ exactly as written | `scenario 5` |
| 6 | 8 digits mean `yymmddHH` | ✅ `20261031` rejected; `26103100` → `… Waning Gibbous (74% of Full)` | `scenario 6` |
| 7 | Past tense and `mktime` normalisation | ✅ `25011400` → `was Full`; `2026022900` → `Sun 2026 Mar  1 …` | `scenario 7` |

### History: the canonical scenarios 2–4 erratum (fixed)

Before 2026-09-24, the canonical doc ran `pom 20261031`, `pom 20261101`
and `pom 20261024` and expected Full, New and First Quarter. The
original program cannot produce those outputs:

1. **Parsing.** An 8-digit argument is `yymmddHH` (see `pom.c`
   `parsetime()`, `case 8`). `20261031` means year 20→2020, **month 26**,
   so it prints `pom: illegal time format`. The same happens for all
   three.
2. **Astronomy.** Even read as the intended dates, pom’s algorithm gives
   31 Oct 2026 = 74% Waning Gibbous, 1 Nov = 64% Waning Gibbous,
   24 Oct = 93% Waxing Gibbous.

Both points were confirmed on the real binary (bsdgames 2.17,
`TZ=Asia/Jakarta`). The canonical doc was corrected, following the
porting guide’s rule that a contradiction is fixed canonically, never
worked around in a port. It now uses 10-digit arguments verified on the
binary, and keeps the old inputs as scenario 6.

### Extra fidelity evidence

- **Golden set:** 1,534 of 1,534 comparable captures of the real binary
  match on stdout, stderr and exit code (`golden` test). 82 pre-1964
  Jakarta captures are skipped because WIB’s historical offsets differ
  from +07:00.
- **Game-level screenshots** (`../../../media/02-midgame.txt`,
  `03-gameover.txt`) reproduce exactly: `25011400` → `was Full`,
  `25030700` → `was at the First Quarter`.

---

## B. Port-specific scenarios

| # | Setup | Action | Expected |
|---|---|---|---|
| P1 | Open the page | Wait for the veil to fade | Moon fades in; caption `$ pom` + live line; **Now** pressed |
| P2 | Any date | Type `991399` in the `pom` field, press Enter | Field shakes amber; caption shows `$ pom 991399` + `pom: illegal time format` / `usage: …`; scene unchanged |
| P3 | Any date | Type `2026102612`, press Enter | Moon animates to Full; readout “Full Moon”, 100.0%; caption `… The Moon will be Full` |
| P4 | Any date | Press **Timelapse** | The phase sweeps one lunar month in ≈14 s; thumb crosses the scrubber; button shows pause; the caption updates hourly |
| P5 | Any date | Drag the scrubber | Time snaps to whole hours; caption and inputs follow; on release the window re-centres |
| P6 | Waxing gibbous | Hover over Mare Crisium | Tooltip “Mare Crisium · Sea of Crises · lunar sea · 17.0°N 59.1°E · in sunlight” |
| P7 | Any | Drag the Moon | Surface rotates; terminator stays put; on release it springs back |
| P8 | Any | Press **C** | Drawer opens; Moon glides left; 28–31 mini Moons match the phases; clicking a day jumps there |
| P9 | Any | Press **H** | High-contrast: black panels, white borders, yellow focus; Moon limb outlined; night side slate |
| P10 | OS “reduce motion” on | Load | No twinkle or ripples; date jumps are instant; timelapse steps daily |
| P11 | Phone (390×844) | Load | Moon on top, readout below, stacked dock, icon-only tools |
| P12 | Browser without float render targets | `?lp=1` | 8-bit fallback path renders the same scene with slightly softer relief |
| P13 | Near New Moon (`2026111018`) | Load | Thin crescent, faint bluish earthshine on the dark disc, Milky Way clearly visible |
| P14 | Full Moon (`2026102612`) | Load | Flat, relief-free disc; fewer stars; navy sky; moon glade on the lake |
| P15 | No WebGL2 (`--disable-webgl`) | Load, press **›** | Text mode: CSS placeholder ring and message beside (not over) the readout; caption and readout update; **Calendar** button disabled; no console errors |
| P16 | CPU-only WebGL (SwiftShader) | Load, idle, press **›** | Veil shows progress and “No GPU found…”; lite profile; Moon within a few seconds; 0 draws while idle; About shows “CPU (software WebGL), lite profile” |
| P17 | Windows GPU, fresh browser profile | Load | Text UI within a fraction of a second; veil “Compiling shaders…” while the page keeps animating; Moon arrives after the one-time compile |

## Sign-Off

| Date | Tester | Build | Scenarios Passed | Notes |
|---|---|---|---|---|
| 2026-09-24 | Claude Opus (automated + Playwright) | working tree | A1–A7, P1–P14 | 26/26 `npm test`; interaction script covered P2, P3, P4, P6, P7 and keyboard **N** / **Shift+→** with zero console errors |
| 2026-09-24 | Claude Opus (Playwright, forced GPU modes) | working tree | P15–P17 | 29/29 `npm test`. P15: text mode, no errors. P16: ready 3.3 s, 0 idle draws. P17: text UI 0.2 s, 57 fps during compile, Moon at 6.9 s |
