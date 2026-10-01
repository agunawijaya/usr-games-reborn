# `worms` · fancy-web — Test Scenarios

(A) sign-off against the canonical
[`../../../docs/test-scenarios.md`](../../../docs/test-scenarios.md),
and (B) scenarios for what this port adds. Automated tests live in
[`../tests/`](../tests/) (`npm test`, 33 tests).

---

## A. Canonical scenarios

| # | Canonical scenario | Port result | Evidence |
|---|---|---|---|
| 1 | `worms -d 100`: 3 worms of length 16; clean exit | ✅ `?args=-d 100`. The “exit” is closing the tab (see 6) | `scenario 1` test; golden screens |
| 2 | `worms -n 5 -l 32 -d 80` | ✅ | `scenario 2` test |
| 3 | `worms -f -d 100`: field filled with WORM, eaten | ✅ Classic: the same characters. Modern: plankton glyphs that scatter when eaten | `scenario 3` test; golden `-f` screens |
| 4 | `worms -t -d 100`: `.` trails | ✅ Classic: permanent dots. Modern: fading luminous trail ([ADR-003](./decisions/003-time-grid-and-live-flags.md) §6) | `scenario 4` test; golden `-t` screens |
| 5 | `worms -d 2000` → `invalid delay (1-1000)` | ✅ Byte-identical message in the settings command line, in the `?args=` notice and from `parseArgs` | `scenario 5` + golden CLI |
| 6 | `SIGTERM` exits and restores the terminal | ➖ Not applicable in a browser; the tab is closed instead (diff-log #19) | — |
| 7 | 10 s smoke test: in bounds, no vanishing segments, flavor characters | ✅ Property test over 7 grid sizes × 3 seeds × 3000 steps: bounds, exact ref counts, no `abort()` | `invariants` test |

## B. Port scenarios

| # | Setup | Action | Expected |
|---|---|---|---|
| P1 | Default load | Watch 20 s | Three worms emerge from the bottom-left burrow; the UI fades after ~3 s; `$ worms` shown bottom-left |
| P2 | `?args=-n 20 -l 64 -t -f` | Watch | Smooth at 60 fps on the reference GPU; trails fade; field eaten |
| P3 | Any | Settings → `-n` 12, `-l` 6, toggle `-t` | Applied live; new worms enter at `(0, bottom)`; bodies shrink from the tail |
| P4 | Any | Command line `-l 1` + Enter | `worms: invalid length (2 - 1024).` in amber; world unchanged |
| P5 | Any | **Split**, drag divider | Classic left and modern right on the same worms |
| P6 | Any | **Classic** | The terminal screen buffer, phosphor green |
| P7 | Any | **Sound** | Drone and bubbles fade in; chimes on crossings; muting fades out |
| P8 | OS reduced motion | Load | No twinkle, sway or drift; ≤ ~7 steps/s |
| P9 | CPU WebGL (`--use-angle=swiftshader`) | Load | Low quality automatically; notice; works |
| P10 | No WebGL (`--disable-webgl`) | Load | Classic view only, other views disabled, notice; settings still live |
| P11 | `?seed=1` at a fixed size | Reload | The identical animation (the original’s glibc sequence) |
| P12 | Any | `F`, `S`, `M`, `R`, `C`, `V`, `Space`, `Esc` | Fullscreen, settings, sound, restart, classic, split, pause, close |

## Sign-Off

| Date | Tester | Build | Result | Notes |
|---|---|---|---|---|
| 2026-09-24 | Claude Opus (node:test + Playwright) | working tree | A1–A5, A7 ✅; A6 n/a; P1–P11 ✅ | 33/33 tests. P3/P4/P7–P10 driven by a Playwright script with zero console errors; P2 measured at 16.6 ms median frame |
