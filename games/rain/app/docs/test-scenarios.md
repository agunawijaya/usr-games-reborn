# `rain / fancy-web` — Test Scenarios

How the canonical scenarios ([`../../../docs/test-scenarios.md`](../../../docs/test-scenarios.md))
apply to this port, and the port's own. Automated unless marked
*manual*.

```bash
npm test          # node: tests/*.test.js (23 tests)
npm run smoke     # browser: scripts/ui-smoke.mjs (P-xx checks)
npm run check:raster
npm run measure   # manual reading: start-up and fps per mode
```

## Canonical scenarios

| # | Canonical | Here | Where |
|---|---|---|---|
| 1 | `rain -d 120`: drops appear; exits cleanly | The page opens at `-d 120` (the man page's value) and rains; closing the tab ends it | P-01; `tests/timeline.test.js` (one frame per 120 ms) |
| 2 | `rain` (no `-d`): very fast | `-d 0` (key 0, "9600 baud" preset, `?d=0`) is paced as a 9600-baud terminal would drain: ≈ 150 ms a frame. *Reinterpreted* — see the diff log | `tests/engine.test.js` (baud model), `tests/timeline.test.js`, P-03 |
| 3 | `rain -d 1000` → `` Invalid delay `1000' (1-999) `` | `?d=1000` shows that message and rains at the default | `tests/engine.test.js` (all `strtoul` cases), P-13 |
| 4 | SIGTERM → exits, terminal restored | No signals in a browser; closing or reloading the tab is the stop gesture, and nothing needs restoring. *N/A* | — |
| 5 | Visual smoke: `.`, `o`, `O`, `-` `\|` `/` `\`, blanks; nothing outside the border | Every frame's six events have ages 0–5 in order; each drop's shapes are checked cell by cell; drops stay inside the border for 3000 frames at four terminal sizes; screens match the real binary | `tests/engine.test.js`; classic view equals the engine in the browser (P-05) |

## Engine (node)

| Test | Checks |
|---|---|
| `random()` | glibc 2.39 reference outputs for the default seed and `srandom(42)`; seed 0 behaves as 1 |
| Captured frames | screens 26, 57, 86 equal the captures from the real binary (80 × 24, `-d 120`) |
| `-d` parsing | decimal, hex, octal, `08`, blanks, minus sign, `1000`, junk, empty |
| Lifecycle | six events per frame; every drop runs `. o O ring ring erase` in one place |
| Shapes | each age's exact characters, and an erase blanking a neighbour's cells |
| Bounds | 3000 frames at 80×24, 5×5, 7×30, 132×43 |
| Determinism | same seed, same rain; survives a JSON round trip |
| `-d 0` | the 9600-baud model averages 110–170 ms a frame |

## Clock, geometry, mappings (node)

| Test | Checks |
|---|---|
| `timeline.test.js` | frames per second = 1000 / delay (also at `-d 1`); a frame is shown exactly 350 ms after it is made; queued text is the engine's screen; a hidden tab resumes; a shorter delay takes effect at once |
| `geometry.test.js` | horizon placement; for six aspect ratios × two grids, every terminal cell (corners, jitter) projects on screen and inside the simulated grid; the frame's bottom edge is simulated; square cells and a stable time step |
| `mapping.test.js` | the ADR-003 impulse table (signs and shapes per age); the slider's delay scale; streak counts grow with the rain |

## Page (browser, `scripts/ui-smoke.mjs`)

| ID | Scenario | Expected |
|---|---|---|
| P-01 | Open the page | The pond renders (WebGL 2, High); `-d 120` |
| P-02 | Sound | Off at start, no AudioContext until a gesture; one click → "Sound on", context running, measurable signal; M mutes |
| P-03 | Intensity | Downpour preset → `-d 10` and readout `rain -d 10`; ← makes it lighter; 0 → `rain -d 0` |
| P-04 | Views | 2 → split, both panes; the classic pane is 80 × 24; 3 → classic only; 1 → modern only |
| P-05 | Lock-step | The classic pane's text equals a fresh engine stepped to the shown frame |
| P-06 | Help | ? opens, Esc closes |
| P-07 | Quality | Q → Low (profile changes), Q → High |
| P-08 | Idle | Controls fade after 3.2 s still, return on mouse move; H hides them |
| P-09 | Fullscreen | The button is there (*manual*: it toggles fullscreen) |
| P-10 | `prefers-reduced-motion` | Starts at `-d 400` |
| P-11 | No WebGL (`?nogl`) | Classic view, modern/split disabled, a notice says why, it rains |
| P-12 | Console | No errors or exceptions during P-01…P-09 |
| P-13 | `?d=1000` | The original's message in a notice; rains at `-d 120` |

## Manual

| ID | Scenario | Expected |
|---|---|---|
| M-01 | Listen with sound on at `-d 120`, then `-d 10`, then `-d 1` | Soft splashes with an occasional short plink — not a melody; the patter thickens; a hiss with a low rumble and no machine-gun effect |
| M-02 | Resize the window, rotate a phone | The pond relays out (it restarts calm); the terminal still spans the view |
| M-03 | Leave the tab for a minute, come back | The rain resumes; no burst |
| M-04 | Real device without a GPU (remote desktop, VM) | Lite, with the notice; roughly the README's CPU-only numbers |
| M-05 | Watch split view at `-d 400` | Each `.` on the left lands as a splash on the right at the same moment, in the matching part of the pond |
